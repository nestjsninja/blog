---
title: Optimistic vs Pessimistic Locking in NestJS with TypeORM and Postgres
excerpt: >-
  Two concurrent requests read the same row, both decide it is safe to write,
  and one silently overwrites the other. We reproduce that lost update on
  purpose, then fix it two ways in NestJS and TypeORM: SELECT ... FOR UPDATE
  inside a transaction, and a single conditional UPDATE guarded by a version
  column. Proven with real concurrent races against Postgres, not a mock.
date: '2026-09-17T12:00:00.000Z'
author:
  name: Henrique Weiand
  picture: /nestjs-ninja.png
tags:
  - NestJS
  - TypeORM
  - PostgreSQL
  - Concurrency
  - Databases
  - Typescript
coverImage: /blog-assets/nestjs-typeorm-optimistic-pessimistic-locking-postgres/cover.png
ogImage:
  url: >-
    /blog-assets/nestjs-typeorm-optimistic-pessimistic-locking-postgres/cover.png
---
Hello, dev!

Here is a bug that looks completely innocent in code review:

```ts
async bookSeat(eventId: string, seats: number) {
  const event = await this.events.findOneByOrFail({ id: eventId });

  if (event.availableSeats < seats) {
    throw new ConflictException('Not enough seats');
  }

  event.availableSeats -= seats;
  return this.events.save(event);
}
```

Read, check, subtract, save. It is correct for one request at a time. The moment two requests hit `bookSeat` for the same event within a few milliseconds of each other, it stops being correct — both read the same `availableSeats`, both decide there is room, and whichever one saves last wins, silently. The other request's booking still returned `200 OK` to its caller. It just never happened.

This is called a **lost update**, and it does not need heavy traffic to happen — a flash sale, a popular event going on sale, two browser tabs, a retried request. In this post we reproduce it on purpose against a real Postgres, then fix it two different ways with TypeORM: **pessimistic locking** (`SELECT ... FOR UPDATE`) and **optimistic locking** (a version column and a conditional update). By the end you will know exactly which one to reach for and why.

> A lost update is not a crash. It is worse — everything reports success, and the data is simply wrong.

💻 The full, runnable example is on GitHub: [nestjsninja/nestjs-typeorm-locking-strategies](https://github.com/nestjsninja/nestjs-typeorm-locking-strategies).

## The setup 🎟️

One entity, `Event`, with a seat count and a version column we will get to later:

```ts
// events/event.entity.ts
import { Column, Entity, PrimaryGeneratedColumn, VersionColumn } from "typeorm";

@Entity("events")
export class Event {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column("int")
  availableSeats: number;

  @VersionColumn()
  version: number;
}
```

And one service with three methods that all do the exact same job — book `seats` on an event — using three different strategies, so they are directly comparable. Every method also `await`s a short delay between reading the row and writing it back:

```ts
const RACE_WINDOW_MS = 50;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
```

That delay is not a trick to make the bug easier to write about. A real handler almost always awaits _something_ between the read and the write — a payment charge, a fraud check, an email send, a call to another service. That await is exactly the window a second request can land in. Simulating it here means the race triggers on every single run instead of only under production load, which is what makes it possible to write a deterministic test for it.

## Watch it break: no locking at all 💥

```ts
// events/event.service.ts
async bookNaive(eventId: string, seats: number): Promise<Event> {
  const event = await this.events.findOneByOrFail({ id: eventId });

  if (event.availableSeats < seats) {
    throw new ConflictException('Not enough seats');
  }

  await sleep(RACE_WINDOW_MS);

  event.availableSeats -= seats;
  return this.events.save(event); // whoever saves last wins, and nobody is told
}
```

Now fire five concurrent bookings of one seat each at an event that starts with five seats:

```ts
const eventId = await seedEvent(5);

const results = await Promise.all(
  Array.from({ length: 5 }, () => service.bookNaive(eventId, 1)),
);

expect(results).toHaveLength(5); // all 5 calls "succeeded"

const event = await service.findOne(eventId);
expect(event.availableSeats).toBe(4); // should be 0
```

That last assertion is the whole bug in one line. All five calls read `availableSeats = 5` before any of them had written anything, so all five independently computed `5 - 1 = 4` and saved it. Five confirmations went out. One decrement stuck. The other four seats are still marked available — and will happily be sold again to someone else.

> The naive version is not "occasionally wrong under heavy load". Given two requests close enough together, it is wrong every time. That is what makes it worth a deterministic test instead of a "seems fine in staging" shrug.

## Fix 1: pessimistic locking — `SELECT ... FOR UPDATE` 🔒

Pessimistic locking assumes the conflict is likely, so it prevents it outright: the first transaction to touch the row locks it, and every other transaction that wants the same lock simply waits.

```ts
async bookPessimistic(eventId: string, seats: number): Promise<Event> {
  return this.dataSource.transaction(async (manager) => {
    const event = await manager.findOne(Event, {
      where: { id: eventId },
      lock: { mode: 'pessimistic_write' }, // SELECT ... FOR UPDATE
    });

    if (!event) {
      throw new NotFoundException(`Event ${eventId} not found`);
    }
    if (event.availableSeats < seats) {
      throw new ConflictException('Not enough seats');
    }

    await sleep(RACE_WINDOW_MS); // still slow, but no one else can read a stale row now

    event.availableSeats -= seats;
    return manager.save(event);
  });
}
```

Two details make this work, and both are easy to get wrong the first time.

**It must run inside a transaction.** `FOR UPDATE` is a row lock, and a lock only means something if it is held across more than one statement — the row has to stay locked from the `SELECT` through the `UPDATE`, which requires an open transaction. TypeORM does not let you forget this: call `lock: { mode: 'pessimistic_write' }` outside a transaction and it throws immediately with _"An open transaction is required for pessimistic lock."_ rather than silently running an unlocked query.

**The lock is held until commit, not until the next statement.** That includes our `sleep(RACE_WINDOW_MS)`. A second request's `FOR UPDATE` on the same row genuinely blocks — the database connection sits there waiting — until the first transaction commits or rolls back. Run the same five-concurrent-bookings test against `bookPessimistic` and the result is exactly what you want:

```ts
const results = await Promise.all(
  Array.from({ length: 5 }, () => service.bookPessimistic(eventId, 1)),
);

expect(results).toHaveLength(5);
const event = await service.findOne(eventId);
expect(event.availableSeats).toBe(0); // all 5 decrements landed
```

And when demand exceeds supply — three seats, five bookings — it rejects exactly the right number instead of oversellling:

```ts
const outcomes = await Promise.allSettled(
  Array.from({ length: 5 }, () => service.bookPessimistic(eventId, 1)),
);
// { fulfilled: 3, rejected: 2 }
```

The five requests are no longer racing. They are queued, one behind the other, each seeing the true up-to-date count when its turn comes.

### The modes and the knobs

`lock.mode` has more than one value, and the choice matters:

- `pessimistic_write` — `SELECT ... FOR UPDATE`. Blocks any other `FOR UPDATE` **or** `FOR SHARE` on the same row. Use this when you are about to change the row.
- `pessimistic_read` — `SELECT ... FOR SHARE`. Multiple readers can hold it at once; it only blocks writers. Use it to say "nobody may change this while I am reading it", without blocking other readers doing the same.
- `pessimistic_write_or_fail` / `onLocked: 'nowait'` — fails immediately with an error instead of waiting, for callers that would rather retry themselves than sit in a queue.
- `onLocked: 'skip_locked'` — skips rows that are already locked instead of waiting for them. This is the pattern behind most Postgres-backed job queues: several workers `SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1` and each one grabs a _different_ pending job instead of piling up behind the same lock.

One more thing worth knowing so it does not surprise you: `FOR UPDATE` blocks other lockers, not every reader. A plain `SELECT` with no lock still reads a consistent snapshot under Postgres's MVCC without waiting for anything — it is `FOR UPDATE`/`FOR SHARE` specifically that queue up behind each other.

### The cost

Pessimistic locking trades throughput for certainty. While a transaction holds `FOR UPDATE`, it is also holding a pooled database connection for the full duration — including our simulated `RACE_WINDOW_MS`. Lock a popular row under high concurrency and requests start queuing for the _connection pool_ before they even get to queue for the _lock_. And if you ever lock more than one row per transaction, lock them in a **consistent order** everywhere in the codebase — locking `A` then `B` in one code path and `B` then `A` in another is the textbook recipe for a deadlock.

> Pessimistic locking is a promise: while I hold this, nothing else can move it. That promise is exactly what you want for a short, high-value critical section — and exactly what makes it expensive to hold for a long one.

## Fix 2: optimistic locking — a version you check on the way out 🎯

Optimistic locking assumes the conflict is rare, so instead of blocking anyone, it lets every request proceed right up to the write — and makes the _write itself_ fail cleanly if someone else got there first.

The `@VersionColumn()` on `Event` is the mechanism: TypeORM bumps it by one on every `save()`. The part that actually protects us is checking it, and I want to be precise about how, because there are two ways to do this in TypeORM and they answer slightly different questions.

### The single-statement version I actually use

```ts
async bookOptimistic(
  eventId: string,
  seats: number,
  attempt = 1,
): Promise<Event> {
  const event = await this.events.findOneByOrFail({ id: eventId });

  if (event.availableSeats < seats) {
    throw new ConflictException('Not enough seats');
  }

  await sleep(RACE_WINDOW_MS);

  const result = await this.events
    .createQueryBuilder()
    .update(Event)
    .set({
      availableSeats: event.availableSeats - seats,
      // save() bumps the version for you; a raw update does not — we do it ourselves.
      version: () => 'version + 1',
    })
    .where('id = :id AND version = :version', {
      id: eventId,
      version: event.version,
    })
    .execute();

  if (!result.affected) {
    if (attempt >= MAX_OPTIMISTIC_ATTEMPTS) {
      throw new ConflictException('Too much contention on this event, please retry');
    }
    return this.bookOptimistic(eventId, seats, attempt + 1); // reload fresh state, try again
  }

  return this.events.findOneByOrFail({ id: eventId });
}
```

The whole protection is one line: `WHERE id = :id AND version = :version`. Postgres evaluates the `WHERE` clause and performs the write as a single atomic operation — there is no gap between "check" and "write" for another transaction to land in, because there is no separate check. Either the row still has the version we read, and the update lands, or it does not, and `result.affected` is `0`. No exception, no lock, just zero rows touched.

That is also exactly what makes retrying safe: `bookOptimistic` reloads the row from scratch on every attempt, so a retry always evaluates the business rule (`availableSeats < seats`) against current data, not stale data. Run it against the same five-bookings-for-five-seats race and every request eventually succeeds — some on the first attempt, some after a retry or two:

```ts
const results = await Promise.all(
  Array.from({ length: 5 }, () => service.bookOptimistic(eventId, 1)),
);

expect(results).toHaveLength(5);
const event = await service.findOne(eventId);
expect(event.availableSeats).toBe(0);
```

And the over-demand case rejects the same 3-fulfilled-2-rejected split as the pessimistic version — same correctness, different mechanism: nobody was ever blocked, some were told to look again.

> `save()` will bump the version column for you. It will not add a `WHERE version = ...` guard to protect you from a race — you get that only by checking the version yourself, or by asking for it explicitly, which is the next part.

### What TypeORM's built-in optimistic lock is actually for

TypeORM also ships a `lock: { mode: 'optimistic', version }` option on `find`, and it is worth knowing precisely what it checks, because it is not the same thing as the query above:

```ts
const event = await this.events.findOne({
  where: { id: eventId },
  lock: { mode: "optimistic", version: clientSuppliedVersion },
});
// throws OptimisticLockVersionMismatchError if event.version !== clientSuppliedVersion
```

Under the hood this runs a plain `SELECT`, fetches the row, and compares the version **in application code** against the number you passed in — it is not a `WHERE version = ...` on the `SELECT` itself. That makes it the right tool for a specific, different scenario: the client already saw a version earlier (a page load, a previous response, an `ETag`) and is now submitting a change based on it — "fail this request if the record changed since the user last looked at it." That is an edit-conflict check, and it is genuinely useful for exactly that UX.

It is **not** a safe way to close a race between two requests that both start from scratch in the same process, like our booking example, because the version check and the eventual `save()` are still two separate round trips with a gap between them — the same shape of gap that got the naive version in trouble in the first place, just much narrower. For that scenario, the single conditional `UPDATE` above is the version with no gap at all.

> Two different questions: "has anything changed since I loaded this?" (TypeORM's optimistic lock option, checked at read time) vs. "did I just overwrite someone else's write?" (a conditional update, checked atomically at write time). Our booking race is the second question.

## Head to head 📊

Same domain, same race, three outcomes:

| Strategy          | 5 bookings, 5 seats        | 5 bookings, 3 seats        | Mechanism                      |
| ----------------- | -------------------------- | -------------------------- | ------------------------------ |
| `bookNaive`       | **4 confirmed, 1 lost** ❌ | oversold ❌                | none                           |
| `bookPessimistic` | 5 confirmed, 0 lost ✅     | 3 confirmed, 2 rejected ✅ | blocks (`FOR UPDATE`)          |
| `bookOptimistic`  | 5 confirmed, 0 lost ✅     | 3 confirmed, 2 rejected ✅ | retries (conditional `UPDATE`) |

Both locking strategies get to the same correct place. The difference is what happens to the _losing_ request while they get there: pessimistic locking makes it wait; optimistic locking makes it fail fast and, in our implementation, retry itself.

## Why READ COMMITTED does not save you 🐘

Postgres's default isolation level, `READ COMMITTED`, guarantees each individual statement sees a consistent snapshot — but a new snapshot is taken for _every_ statement in the transaction, not once for the whole transaction. That is enough to stop you from reading a half-written row. It does nothing to stop the sequence in `bookNaive`: read, then — arbitrarily later — write, based on a decision made from data that is now stale. The isolation level was never the problem; the gap between statements was.

Postgres's `SERIALIZABLE` isolation level takes a different approach to the same problem: it lets both transactions run, then detects at commit time that they would not have been safe to interleave, and fails one of them with a `40001 serialization_failure` you are expected to catch and retry. It is a legitimate alternative to explicit locking — you write the naive-looking code and let the database catch the conflict — but it applies to the whole transaction, has real throughput cost under contention, and needs the same retry discipline the optimistic path already showed. Worth knowing it exists; not something I would reach for before the two options above.

## Choosing between them 🧭

- **Reach for pessimistic locking** when contention on the same row is common, the critical section is short, and you would rather a request wait a few milliseconds than fail: seat inventory during the exact moment a flash sale opens, a wallet balance during a transfer, anything where "definitely correct, slightly slower" beats "fast, but tell the user to try again."
- **Reach for optimistic locking** when most requests do _not_ conflict, you want to avoid holding a database connection open for the slow part of a request, or you are running multiple app instances against the same database and do not want them queuing behind each other's locks: profile edits, order status updates, anything read-often-written-occasionally.
- **A hybrid is normal.** Lock the hot inventory row pessimistically at the exact moment of the sale; use optimistic checks everywhere else in the same service for the rows that rarely collide.

This connects to a point from the [transactions post](https://nestjs-ninja.com/blog/2026-06-01-nestjs-architecture-dtos-services-transactions-and-boundaries/): one orchestrator should own the transaction boundary. That is doubly true here — a pessimistic lock held by an inner service the caller does not know about is exactly how you end up with a lock nobody expected, held for longer than anyone intended.

## Final thoughts

The lost update in `bookNaive` is not a contrived example — it is what "read, check, save" looks like by default, and it is correct right up until two requests overlap. Both fixes close that gap, they just close it in opposite directions: pessimistic locking removes the race by making the second request wait; optimistic locking lets the race happen and makes sure only one side of it can win, cleanly, in a single statement.

The version that matters most in this post might be the smallest one: `@VersionColumn()` alone does nothing to protect you. It is the `WHERE version = :version` — whether you write it yourself or ask TypeORM's `pessimistic_write` to hold the row instead — that turns "probably fine" into "provably correct," and it is the only part of either strategy actually worth testing under real concurrency.

That is it for today. Whichever strategy you pick, test it the way we did here: fire real concurrent requests at a real database and assert on the final row, not on whether the promises resolved.

### Takeaways ✍️

- "Read, check, save" is a lost update waiting for two concurrent requests — it does not need production traffic to break, only overlap.
- `SELECT ... FOR UPDATE` needs an open transaction; TypeORM throws immediately if you forget one, rather than running it unlocked.
- A pessimistic lock is held until commit, including anything you `await` in between — that is the whole mechanism, and the whole cost.
- `save()` bumps `@VersionColumn()` for you; it does not add a `WHERE version = ...` guard. A raw `UPDATE` bumps neither unless you do it yourself.
- A single `UPDATE ... WHERE id = ? AND version = ?`, checked via `result.affected`, closes the race atomically in one statement — no lock, no gap.
- TypeORM's `lock: { mode: 'optimistic', version }` compares versions in application code at read time — built for "did this change since the client last saw it?", not for closing a same-process race.
- Lock rows in a consistent order across the codebase, or a pessimistic strategy will eventually hand you a deadlock instead of a lost update.
- Test locking strategies as concurrent races against a real database — the bug (and the fix) only shows up under real interleaving, never in a single-threaded run.
