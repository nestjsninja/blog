---
title: 'Mapped Error Handling in NestJS: Base Exception, Domains, and One Filter'
excerpt: >-
  Most NestJS apps throw a mix of HttpException, raw Error, and string messages
  — so the client gets a different shape every time. This post builds a layered
  error model instead: a base domain error with stable, namespaced string codes,
  per-domain exception families with typed constructors, cause-chaining, and a
  single global filter that renders any of them into one consistent, leak-free
  response (with an RFC 9457 variant).
date: '2026-08-20T12:00:00.000Z'
author:
  name: Henrique Weiand
  picture: /nestjs-ninja.png
tags:
  - NestJS
  - TypeScript
  - Error Handling
  - Software Development
coverImage: /blog-assets/nestjs-mapped-error-handling-domain-exceptions/cover.png
ogImage:
  url: /blog-assets/nestjs-mapped-error-handling-domain-exceptions/cover.png
---
Hello, dev!

In the [previous post](https://nestjs-ninja.com/blog/2026-08-13-version-safe-typeorm-test-data-factories/) we built a small library for seeding test data. Today we stay in "things every backend needs but few do well" territory: **error handling**.

Open a NestJS service that has grown for a year and you will find every error style at once — `throw new NotFoundException('reservation not found')` here, `throw new Error('room busy')` there, a bare string somewhere else, and a raw database error leaking to the client when nobody caught it. The frontend ends up matching message strings, the status codes are inconsistent, and production sometimes returns a stack trace.

A little structure fixes all of it. The shape is three layers and one filter:

1. A **base domain error** that gives every error a stable, namespaced code.
2. **Per-domain error families** — small classes that name what can go wrong.
3. A **single global filter** that renders any of them into one response, and never leaks internals.

I will use a tiny hotel-booking API (reservations and rooms) to keep the examples concrete.

> An error is a domain object, not a string. Model it like one.

💻 The full, runnable example is on GitHub: [nestjsninja/nestjs-error-handling](https://github.com/nestjsninja/nestjs-error-handling) — and it runs in your browser on StackBlitz.

## The response contract

Decide the output shape first. Every error the API returns should look the same:

```json
{
  "error": {
    "code": "reservations.not_found",
    "message": "Reservation not found",
    "details": { "reservationId": "res_123" }
  }
}
```

- **`code`** — a stable, namespaced string the client switches on. `domain.reason`. It never changes, even when we reword the message.
- **`message`** — developer-facing English. The frontend localizes from `code`, not from this.
- **`details`** — structured context for this occurrence.

Why string codes like `reservations.not_found` instead of numbers? They are self-describing, they namespace themselves (the domain is right there in the prefix), and you never maintain a numeric registry to avoid collisions. A frontend `switch (error.code)` reads like English.

## Layer 1: the base domain error

One class underneath everything. Its job is to standardize the parts every error shares — a namespaced `code`, an HTTP status, optional `details`, and the original `cause`.

```ts
// errors/domain.error.ts
export abstract class DomainError<Details = undefined> extends Error {
  /** Domain segment of the code, e.g. "reservations". */
  abstract readonly domain: string;
  /** Reason segment of the code, e.g. "not_found". */
  abstract readonly reason: string;
  /** Suggested HTTP status for the REST transport. */
  abstract readonly status: number;

  readonly details?: Details;

  constructor(message: string, options?: { details?: Details; cause?: unknown }) {
    // `cause` chains the original error without losing this one (ES2022).
    super(message, { cause: options?.cause });
    this.name = this.constructor.name;
    this.details = options?.details;
  }

  /** Stable, namespaced identifier: `${domain}.${reason}`. */
  get code(): string {
    return `${this.domain}.${this.reason}`;
  }
}
```

Two things worth calling out:

- `code` is **derived**, not stored. A subclass declares `domain` and `reason`; the full code falls out. There is no number to allocate and nothing to keep in sync.
- The constructor forwards `cause` to `super(message, { cause })`. This is the ES2022 [error cause](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause) — when we wrap a database or HTTP failure as a domain error, the original is still attached for the logs, but it never reaches the client.

It is `abstract` on purpose: you never throw a bare `DomainError`, only a specific one.

## Layer 2: domains and their errors

Add a thin per-domain base that fixes the `domain` once, then small concrete classes that set the `reason`, `status`, and a typed constructor:

```ts
// reservations/reservations.errors.ts
import { DomainError } from '../errors/domain.error';

abstract class ReservationError<D = undefined> extends DomainError<D> {
  readonly domain = 'reservations';
}

export class ReservationNotFound extends ReservationError<{ reservationId: string }> {
  readonly reason = 'not_found';
  readonly status = 404;

  constructor(reservationId: string) {
    super('Reservation not found', { details: { reservationId } });
  }
}

export class ReservationAlreadyCancelled extends ReservationError<{ reservationId: string }> {
  readonly reason = 'already_cancelled';
  readonly status = 409;

  constructor(reservationId: string) {
    super('Reservation is already cancelled', { details: { reservationId } });
  }
}
```

```ts
// rooms/rooms.errors.ts
abstract class RoomError<D = undefined> extends DomainError<D> {
  readonly domain = 'rooms';
}

export class RoomNotAvailable extends RoomError<{ roomId: string; from: string; to: string }> {
  readonly reason = 'unavailable';
  readonly status = 409;

  constructor(details: { roomId: string; from: string; to: string }) {
    super('Room is not available for the selected dates', { details });
  }
}
```

The concrete classes are tiny, and each one owns a **typed constructor** — `new ReservationNotFound('res_123')`, `new RoomNotAvailable({ roomId, from, to })`. The call site cannot forget the context the error needs, and editors autocomplete it. Adding a new error is a five-line class, so people add one instead of reaching for a generic `BadRequestException`.

Throwing them reads like the business rules:

```ts
// reservations/reservations.service.ts
async cancel(reservationId: string): Promise<Reservation> {
  const reservation = await this.reservations.findById(reservationId);
  if (!reservation) {
    throw new ReservationNotFound(reservationId);
  }
  if (reservation.status === 'cancelled') {
    throw new ReservationAlreadyCancelled(reservationId);
  }
  return this.reservations.cancel(reservation);
}
```

Not a single HTTP concept in the service — just domain language. The same method works unchanged behind REST, GraphQL, or a queue consumer.

## Why not just throw `NotFoundException`?

Fair question — NestJS already ships `NotFoundException`, `ConflictException`, and friends, so why extend `Error` at all? Those built-ins are excellent, but they are **HTTP** exceptions, and that is exactly the problem for *domain* failures:

- **They couple your domain to a transport.** `throw new ConflictException(...)` inside `ReservationsService` bakes an HTTP decision into business logic. Run that same service from a queue consumer, a cron job, or a gRPC handler and "409" means nothing. A `DomainError` carries no transport — the filter decides how to render it per transport.
- **They have no stable application code.** An `HttpException` is essentially a status plus a message. Two unrelated failures can both be `400`, and the client cannot tell them apart without string-matching the message. `reservations.already_cancelled` is a contract; `400` is not.
- **They scatter the mapping.** With built-ins you choose the HTTP status at every throw site. With domain errors the status lives in one place — the error class — and the *rule* ("an already-cancelled reservation is a 409") is declared once, next to the error.
- **Their response shape is the framework's, not yours.** `HttpException` bodies vary (`ValidationPipe` returns a `message` array; others a string), so clients special-case them. Domain errors give you one shape you own.

This is not "never use `HttpException`." It is the right tool at the **HTTP edge** — guards rejecting a token, `ValidationPipe` rejecting a body, a controller guard. Those *are* HTTP concerns, and our filter deliberately lets them through. The rule of thumb: **`HttpException` for transport-level failures, `DomainError` for business failures.** Both coexist, and the filter renders both.

## Where to throw what: a real case

Take `GET /reservations/:id`. Most of the time the controller stays thin and the **service** throws the domain error, because "this reservation does not exist" is a domain fact a GraphQL resolver or a billing worker needs too:

```ts
// reservations.service.ts — owns the domain fact
async getById(id: string): Promise<Reservation> {
  const reservation = await this.reservations.findById(id);
  if (!reservation) {
    throw new ReservationNotFound(id);
  }
  return reservation;
}
```

```ts
// reservations.controller.ts — thin; the filter maps ReservationNotFound → 404
@Get(':id')
get(@Param('id') id: string) {
  return this.reservations.getById(id);
}
```

Now a case where the **controller** legitimately throws NestJS's `NotFoundException` — authorization hiding. A user requests a reservation that exists but is not theirs. Returning `403` would reveal it exists; the policy is to answer `404`. That is a decision about the HTTP response, not a domain rule, so it belongs at the edge:

```ts
@Get(':id')
async get(@Param('id') id: string, @CurrentUser() user: User) {
  const reservation = await this.reservations.findVisibleTo(id, user);
  if (!reservation) {
    // existence is hidden on purpose — an HTTP/authorization choice, not a domain fact
    throw new NotFoundException();
  }
  return reservation;
}
```

Request-shape problems are the same story — a missing required query param, an unsupported `Accept` header, a malformed pagination cursor. Those only mean something in HTTP, so a built-in `BadRequestException` (or letting `ValidationPipe` do it) is correct, not a domain error.

The rule of thumb:

| Throw… | …from | …for |
|---|---|---|
| `DomainError` (`ReservationNotFound`, `RoomNotAvailable`) | the **service / domain layer** | business facts and rule violations any caller cares about |
| `HttpException` (`NotFoundException`, `BadRequestException`) | the **controller, guard, or pipe** | concerns that only exist in HTTP: validation, auth, content negotiation, deliberate status choices |

The smell to watch for: importing `@nestjs/common` exceptions into a *service* to pick an HTTP status. That means the service is making a transport decision — push it back, throw a domain error, and let the filter choose the status.

## Layer 3: one filter to render them all

Now the piece that turns any thrown error into the contract — a single global [exception filter](https://docs.nestjs.com/exception-filters):

```ts
// errors/domain-error.filter.ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { DomainError } from './domain.error';
import { matchDbError } from './db-error.translator';

@Catch()
export class DomainErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();

    // 1. Our domain errors — intentional, safe to surface.
    if (exception instanceof DomainError) {
      return this.sendDomainError(response, exception);
    }

    // 2. Database errors that slipped past the boundary — translate or contain.
    //    Some DB failures (a bad enum/uuid cast, a constraint) only blow up at
    //    query time. Map the known ones to domain errors; never leak raw SQL.
    if (exception instanceof QueryFailedError) {
      const domainError = matchDbError(exception);
      if (domainError) {
        return this.sendDomainError(response, domainError);
      }
      this.logger.error('Unhandled database error', exception);
      return response.status(HttpStatus.CONFLICT).json({
        error: { code: 'database.constraint_violation', message: 'Request could not be completed' },
      });
    }

    // 3. Framework HTTP exceptions (validation pipes, guards) — keep their body.
    if (exception instanceof HttpException) {
      return response
        .status(exception.getStatus())
        .json({ error: asObject(exception.getResponse()) });
    }

    // 4. Anything else is a bug. Log the real thing; return an opaque body.
    this.logger.error('Unhandled exception', exception as Error);
    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: { code: 'internal.unexpected', message: 'Unexpected error' },
    });
  }

  private sendDomainError(response: any, error: DomainError) {
    return response.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details },
    });
  }
}

function asObject(body: string | object) {
  return typeof body === 'string' ? { message: body } : body;
}
```

Four branches in priority order: domain errors become the contract; **TypeORM `QueryFailedError`s** are translated to a domain error when we recognize the constraint and otherwise contained (logged in full, returned as an opaque `database.constraint_violation` — never raw SQL); framework `HttpException`s keep their body; everything else is logged and reduced to an opaque `internal.unexpected` so a stray `TypeError` can never expose a stack trace.

That second branch is the safety net for the database errors that only surface at query time — an invalid cast, or a constraint you forgot to translate at the boundary. It reuses the same matcher the boundary uses (next section), so there is one source of truth for "which DB error means which domain error."

A note on production: domain errors are *intentional* — their messages describe expected outcomes, so they are safe to return. The only thing you must never leak is the **unexpected** branch's real message, stack, or `cause`, which is exactly what branch 3 guarantees. (If your policy is stricter and you want domain messages hidden in prod too, gate branch 1 on `process.env.NODE_ENV` and drop `message`.)

Register it once, globally, with `APP_FILTER` — no per-controller decorators:

```ts
// errors/errors.module.ts
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { DomainErrorFilter } from './domain-error.filter';

@Module({
  providers: [{ provide: APP_FILTER, useClass: DomainErrorFilter }],
})
export class ErrorsModule {}
```

Import `ErrorsModule` in the root module and every `throw new ReservationNotFound(...)` anywhere in the app now returns the same envelope.

## Translating infrastructure errors

The filter keeps unknown errors safe, but a generic 500 for a duplicate booking reference is a poor experience. The fix is to **translate low-level failures into domain errors at the boundary** — and `cause` lets you do it without losing the original.

The inline version, at the persistence call:

```ts
async create(input: CreateReservation): Promise<Reservation> {
  try {
    return await this.reservations.insert(input);
  } catch (error) {
    if (isUniqueViolation(error, 'reservations_reference_key')) {
      // wrap the DB error as the cause — visible in logs, hidden from clients
      throw new DuplicateReservationReference(input.reference, { cause: error });
    }
    throw error; // anything else bubbles to the filter
  }
}
```

At scale you lift this into a small **translator** — a map from `(driver error, constraint)` to a domain error. Expose it as a pure `matchDbError` that *returns* the domain error (or `null`), so both the boundary and the filter can reuse it:

```ts
// errors/db-error.translator.ts
import { DomainError } from './domain.error';

const byConstraint: Record<string, (cause: unknown) => DomainError> = {
  reservations_reference_key: (cause) => new DuplicateReservationReference({ cause }),
  guests_email_key: (cause) => new GuestEmailAlreadyUsed({ cause }),
};

/** Returns the matching domain error for a DB failure, or null if unknown. */
export function matchDbError(error: unknown): DomainError | null {
  const constraint = uniqueViolationConstraint(error);
  const make = constraint ? byConstraint[constraint] : undefined;
  return make ? make(error) : null;
}
```

The boundary uses it to throw; the filter (branch 2 above) uses it to render. One source of truth:

```ts
async create(input: CreateReservation): Promise<Reservation> {
  try {
    return await this.reservations.insert(input);
  } catch (error) {
    const domainError = matchDbError(error);
    if (domainError) throw domainError; // wraps the DB error as `cause`
    throw error; // anything else bubbles to the filter
  }
}
```

A unique-index violation now surfaces as `reservations.duplicate_reference` (status `409`, clean details, original error chained in `cause`) — whether it is caught at the boundary or by the filter — instead of a leaked Postgres error.

## Catch only when you can help

A global filter changes how you write `try/catch`: most of the time you should not write one at all. If a method cannot do anything useful with an error, let it bubble — the filter is the single place that turns it into a response and logs it.

Catch at a boundary only for one of three reasons:

- **translate** — turn a low-level error into a domain error (the `matchDbError` boundary above),
- **enrich** — attach context as `cause` (or `details`) before rethrowing,
- **recover** — actually handle it and continue (a fallback, a retry, a default value).

And whenever you catch something you did not handle, **rethrow it**. Swallowing is how a 500 quietly becomes a `200` with half-written data.

```ts
// ✅ catch to translate; rethrow the rest
try {
  return await this.reservations.insert(input);
} catch (error) {
  const domainError = matchDbError(error);
  if (domainError) throw domainError;
  throw error; // not ours to handle — let it bubble to the filter
}
```

What to avoid:

```ts
// ❌ swallows everything — the caller thinks it worked
try { await charge(order); } catch { /* ignore */ }

// ❌ catch-log-rethrow at every layer — the same error lands in the logs five times
try { await doThing(); } catch (e) { this.logger.error(e); throw e; }

// ❌ flattens a typed error into an HTTP one inside a service —
//    loses the class, the cause, and the stack, and couples the service to HTTP
try { await doThing(); } catch (e) { throw new BadRequestException(e.message); }
```

Log **once**, at the filter — it already sees every uncaught error with its `cause` intact. Lower layers should either resolve an error or get out of its way. And when you do wrap, always pass the original as `cause` so nothing is lost:

```ts
catch (error) {
  throw new ReservationSyncFailed({ cause: error }); // original kept for the logs
}
```

## Prefer a standard? RFC 9457 Problem Details

If you would rather not invent an envelope, there is a standardized one: [RFC 9457 Problem Details](https://www.rfc-editor.org/rfc/rfc9457) (the successor to 7807), served as `application/problem+json`. Because our errors are transport-agnostic, the filter is the only thing that changes — map the same `DomainError` to the standard fields:

```ts
response
  .status(exception.status)
  .type('application/problem+json')
  .json({
    type: `https://errors.example.com/${exception.domain}/${exception.reason}`,
    title: exception.message,
    status: exception.status,
    detail: exception.message,
    ...exception.details,
  });
```

Same exceptions, same services — a different rendering. Pick whichever your clients prefer; the layered model underneath does not care.

## Testing your errors

Stable, typed errors make tests sharp. Assert on the class or the code, never on a message string:

```ts
it('rejects cancelling twice', async () => {
  const reservation = await factories.reservation.create({ status: 'cancelled' });

  await expect(service.cancel(reservation.id)).rejects.toBeInstanceOf(
    ReservationAlreadyCancelled,
  );
});

it('uses a stable code for an already-cancelled reservation', async () => {
  const reservation = await factories.reservation.create({ status: 'cancelled' });

  const error = await service.cancel(reservation.id).catch((e) => e);
  expect(error.code).toBe('reservations.already_cancelled');
});
```

The `code` assertion is the one that guards your public contract: reword the message all you like — the test, and the client, keep passing.

## Wrapping up

The error mess most apps live with is not a lack of effort; it is the lack of a home for errors. Give them one:

- a **base error** that derives stable, namespaced codes and chains the original `cause`,
- **per-domain families** of small classes with typed constructors that read like business rules,
- a **single global filter** that renders them consistently and never leaks internals,
- a **translator** that lifts infrastructure failures into the same model,
- and, if you want a standard, an **RFC 9457** rendering for free.

The payoff is an API where every error has one shape, a stable code the frontend can build on, and a server that says exactly as much as it should — no more, no less.
