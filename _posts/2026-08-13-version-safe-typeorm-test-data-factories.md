---
title: Version-Safe Test Data Factories for TypeORM
excerpt: >-
  Unit tests mock the repository. Integration and e2e tests hit a real database
  — and that is where you need realistic seed data. The TypeORM ecosystem has no
  great answer for this, and the libraries that exist break every time TypeORM
  changes its internals. This post builds a tiny factory library that inverts
  the dependency: TypeORM becomes a six-line adapter, so upgrading it can never
  break your seeds.
date: '2026-08-13T12:00:00.000Z'
author:
  name: Henrique Weiand
  picture: /nestjs-ninja.png
tags:
  - NestJS
  - TypeScript
  - TypeORM
  - Testing
  - Software Development
coverImage: /blog-assets/version-safe-typeorm-test-data-factories/cover.png
ogImage:
  url: /blog-assets/version-safe-typeorm-test-data-factories/cover.png
---
Hello, dev!

In the [previous post](https://nestjs-ninja.com/blog/2026-08-06-nestjs-lifecycle-events-oninit-bootstrap-destroy-shutdown/) we looked at lifecycle hooks and how to bring a real application up and down cleanly — which is exactly what an integration test does on every run. Today we tackle the other half of integration testing: getting realistic **data** into that real database.

Let me draw the line up front, because it matters:

- **Unit tests** mock the repository. No database, no seeding. You assert that your service called `save` with the right arguments.
- **Integration and e2e tests** run against a real database — an in-memory SQLite, a throwaway Postgres container, a test schema. Here you cannot mock the repository, because the whole point is to exercise real queries, real constraints, real relations.

That second category is where seed data lives. And the TypeORM ecosystem has never had a great, durable answer for it.

> Mocks answer "did my code call the database correctly?" Seed data answers "does my code work against a real one?"

💻 The full, runnable library is on GitHub: [nestjsninja/typeorm-test-factory](https://github.com/nestjsninja/typeorm-test-factory). It is published on npm, so you can use everything in this post today:

```bash
npm install --save-dev typeorm-test-factory
```

## The problem

Every integration test follows the same three-beat rhythm: **arrange** state in the database, **act** through your code, **assert** the result. The arrange step is the painful one. Done by hand it looks like this:

```ts
const user = await dataSource.getRepository(User).save({
  name: 'Test User',
  email: 'test@example.com',
  role: 'admin',
  status: 'active',
  createdAt: new Date(),
  // ...every non-nullable column, every time
});

const post = await dataSource.getRepository(Post).save({
  title: 'Test Post',
  body: 'Lorem ipsum',
  author: user,
  published: true,
  // ...
});
```

Multiply that across a hundred tests and you get walls of boilerplate where the *one field that matters to this test* (`role: 'admin'`) is buried under fifteen that do not. Change a non-nullable column and a hundred tests break at once.

Other ecosystems solved this years ago — FactoryBot in Ruby, Laravel's factories in PHP. The pattern is always the same: define the boring defaults once, override only what the test cares about.

```ts
// The dream
const admin = await userFactory.create({ role: 'admin' });
```

TypeORM has had several attempts at this. `typeorm-seeding` was the popular one and is now unmaintained. [`typeorm-extension`](https://github.com/tada5hi/typeorm-extension) is actively maintained and genuinely full-featured — a CLI, glob-based discovery of seeders, run-once tracking, and factories with Faker built in. [`@jorgebodega/typeorm-factory`](https://github.com/jorgebodega/typeorm-factory) focuses on factories with relation support. They are all worth knowing.

What they share is that they are built **on top of TypeORM's own types** — `DataSource`, `DataSourceOptions`, the entity manager — and several bundle Faker too. That is fine until a version moves.

### Why that hurts

The cautionary tale: TypeORM 0.3 renamed `Connection` to `DataSource` and removed the global `getConnection()` / `getRepository()` helpers. Anything that imported `Connection` or `ConnectionOptions` — and most seeding code did — stopped compiling. `typeorm-seeding` never made the jump, and projects pinned TypeORM to 0.2 to keep their seeds alive. Faker's own `v5 → v8` breaking changes told the same story from the data-generation side.

The root cause is a dependency-direction problem: the seeding library depends on TypeORM's (and Faker's) concrete, moving APIs, so it is hostage to every rename and refactor they ship. None of this means those libraries are bad — for full database seeding, `typeorm-extension` is a strong choice. But for **test data specifically**, we can sidestep the coupling entirely.

We are going to invert that.

## The design: one method

Here is the entire surface where our library is allowed to touch a database:

```ts
// src/types.ts
export type EntityTarget = Function | string | { name: string };

export interface Persister {
  save<T extends object>(target: EntityTarget, entity: object): Promise<T>;
}
```

One method. `save` takes a target (for TypeORM, the entity class) and an entity, and returns the saved row. That is the **port** — in the Ports & Adapters sense we touched on in the [design patterns post](https://nestjs-ninja.com/blog/2026-07-09-nestjs-design-patterns-strategy-observer-factory/). The factory engine talks only to this interface. It never imports TypeORM. It does not even know TypeORM exists.

The factory itself is the [Factory pattern](https://nestjs-ninja.com/blog/2026-07-09-nestjs-design-patterns-strategy-observer-factory/) made concrete: a definition function that produces entities, with hooks to override and persist them.

## Building the factory

A factory needs three things: the entity target, a definition of its default fields, and (eventually) a persister. The definition is just a function — pass it `faker` calls, sequences, whatever you like:

```ts
import { defineFactory } from 'typeorm-test-factory';
import { faker } from '@faker-js/faker';
import { User } from '../src/user.entity';

export const userFactory = defineFactory(User)(() => ({
  name: faker.person.fullName(),
  email: faker.internet.email(),
  role: 'user',
}));
```

`defineFactory` is curried — `defineFactory(User)(definition)` — and that is on purpose. The entity type is captured from the class first, then the definition is type-checked against it precisely: a union column like `status: 'open'` is checked against `'open' | 'paid' | 'cancelled'` with no casts, while `create()` still returns the full entity (with its `id`). One call where the type is inferred from the definition shape would force you to choose between those.

Notice there is no persister yet. You define factories at module scope, once, and bind them to a database connection later inside your test. That separation is what keeps factories reusable across test files and parallel-safe.

The definition receives a context with the batch index, which is perfect for guaranteed-unique values:

```ts
export const userFactory = defineFactory(User)((f) => ({
  name: `User ${f.index}`,
  email: `user${f.index}@test.dev`, // user0@, user1@, user2@…
  role: 'user',
}));
```

### make vs create

The factory exposes two pairs of methods:

```ts
// In memory — no database. Useful for unit tests and pure functions.
const user = userFactory.make();
const users = userFactory.makeMany(3);

// Persisted — the integration-test workhorse.
const user = await userFactory.create();
const users = await userFactory.createMany(3);
```

`make` builds a plain entity object with your defaults applied — no id, nothing saved. `create` runs the same build, then hands the result to the persister and returns the saved row, id and all.

Both take overrides, and overrides always win:

```ts
const admin = await userFactory.create({ role: 'admin' });
```

Here is the whole engine. It is small enough to read in one sitting:

```ts
// src/factory.ts (abridged)
export class Factory<T extends object> {
  constructor(
    private readonly target: EntityTarget,
    private readonly definition: FactoryDefinition<T>,
    private readonly persister?: Persister,
  ) {}

  make(overrides: FactoryShape<T> = {}, ctx = { index: 0 }): T {
    const shape = { ...this.definition(ctx), ...overrides };
    return this.resolveInMemory(shape);
  }

  async create(overrides: FactoryShape<T> = {}, ctx = { index: 0 }): Promise<T> {
    const persister = this.requirePersister();
    const shape = { ...this.definition(ctx), ...overrides };
    const resolved = await this.resolvePersisted(shape, persister);
    return persister.save<T>(this.target, resolved);
  }

  // createMany loops create() so nested relations resolve per row.
  async createMany(count: number, overrides: FactoryShape<T> = {}): Promise<T[]> {
    const created: T[] = [];
    for (let index = 0; index < count; index++) {
      created.push(await this.create(overrides, { index }));
    }
    return created;
  }
}
```

### Reusable states

When a particular variant shows up again and again, freeze it with `with`. It returns a *new* factory whose defaults fold in your overrides — the original is untouched:

```ts
const adminFactory = userFactory.with({ role: 'admin' });

await adminFactory.create();              // an admin
await adminFactory.create({ name: 'Bob' }); // an admin named Bob
```

This composes cleanly because each `with` just wraps the previous definition.

### Relations via nested factories

Relations are the part hand-written seeds get most wrong. In this library, any field can itself be a factory:

```ts
export const postFactory = defineFactory(Post)(() => ({
  title: faker.lorem.sentence(),
  author: userFactory, // ← a Factory, not a User
}));
```

When you `create` a post, the engine sees that `author` is a factory, persists it first, then assigns the saved user to the post before saving it:

```ts
const post = await postFactory.create();
// post.author is a real, persisted User with an id
```

And when you already have the related row, pass it explicitly — the override wins and no extra row is created:

```ts
const author = await userFactory.create();
const post = await postFactory.create({ author });
```

The resolution is six lines: walk the shape, and for any value that is a factory, recurse.

```ts
private async resolvePersisted(shape, persister) {
  const result = {};
  for (const [key, value] of Object.entries(shape)) {
    result[key] = Factory.is(value)
      ? await value.withPersister(persister).create() // relation first
      : value;
  }
  return result;
}
```

> Small detail worth stealing: `Factory.is` checks a `Symbol.for(...)` brand instead of `instanceof`. If two copies of the package ever end up in the tree, `instanceof` silently fails; a global-symbol brand does not.

## The adapter: where TypeORM plugs in

Now the only part that knows about TypeORM. Brace yourself — it is six lines:

```ts
// src/adapters/typeorm.ts
import type { EntityTarget, Persister } from '../types';

export interface RepositoryProvider {
  getRepository(target: any): { save(entity: any): Promise<any> };
}

export function typeormPersister(source: RepositoryProvider): Persister {
  return {
    save: (target, entity) => source.getRepository(target).save(entity),
  };
}
```

Look at what is **not** here: there is no `import ... from 'typeorm'`. Anywhere. In the whole package.

`RepositoryProvider` is a structural type — a shape, not a class. And the shape `getRepository(target).save(entity)` is satisfied by:

- TypeORM 0.2's `Connection`
- TypeORM 0.3+'s `DataSource`
- `EntityManager` in every version
- a transaction's manager
- a custom test double

That single method signature has been stable since TypeORM 0.1. The `Connection` → `DataSource` rename that broke every other seeding library? It cannot touch us, because we never named `Connection` in the first place. We named a *shape*, and the shape did not change.

This is the version-safety guarantee, stated plainly: **the library has zero runtime dependencies and imports nothing from TypeORM.** You bring your own TypeORM; we only assume it can hand back something with a `save`.

## Using it in an integration test

Here is the real workflow. Spin up a real schema (in-memory SQLite needs no external service), truncate between tests, and arrange state with factories:

```ts
import { DataSource } from 'typeorm';
import { typeormPersister, bindFactories } from 'typeorm-test-factory';
import { User } from '../src/user.entity';
import { Post } from '../src/post.entity';
import { userFactory, postFactory } from './factories';

describe('PostsService (integration)', () => {
  let dataSource: DataSource;
  let factories: { user: typeof userFactory; post: typeof postFactory };

  beforeAll(async () => {
    dataSource = await new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [User, Post],
      synchronize: true,
    }).initialize();

    // Bind every factory to this connection in one call
    factories = bindFactories(typeormPersister(dataSource), {
      user: userFactory,
      post: postFactory,
    });
  });

  afterAll(() => dataSource.destroy());

  beforeEach(async () => {
    // Each test arranges its own world
    await dataSource.getRepository(Post).clear();
    await dataSource.getRepository(User).clear();
  });

  it('returns only published posts for an author', async () => {
    const author = await factories.user.create();
    await factories.post.create({ author, published: true });
    await factories.post.create({ author, published: false });

    const posts = await dataSource
      .getRepository(Post)
      .findBy({ author: { id: author.id }, published: true });

    expect(posts).toHaveLength(1);
  });
});
```

The test reads like the requirement: one author, one published post, one draft, expect one result. The columns that do not matter never appear.

## Isolation, rollback, and parallel runs

The `clear()` calls above keep the example simple, but truncating tables between tests is the slow, blunt option. It also helps to be precise about what this library does and does not do, because integration testing has two separate concerns:

- **Arrange** — building the data a test needs. That is what factories are for.
- **Isolation** — making sure each test starts from a known state and leaves nothing behind. That is a *separate* axis, and the factory library is deliberately agnostic about it.

Isolation has three recurring problems: every run needs the database in a known (or empty) base state; tests cannot run in parallel when they all lean on one shared seed; and cleaning up after each test by hand is tedious and easy to get wrong.

The cleanest answer to all three is **transaction rollback**: open a transaction before the test, run everything inside it, and roll it back afterwards. Nothing is ever committed, so cleanup is free and perfect. The trick is to make every repository call in the test use the *same* transactional query runner. A small helper patches the DataSource to do exactly that:

```ts
// test/tools/transaction-context.ts
import { DataSource } from 'typeorm';

export async function beginRollbackContext(dataSource: DataSource) {
  const queryRunner = dataSource.createQueryRunner();

  // Block intermediate releases so the transaction survives the whole test
  const originalRelease = queryRunner.release.bind(queryRunner);
  queryRunner.release = () => Promise.resolve();

  // Every repository in the test now runs through THIS runner
  const originalCreate = dataSource.createQueryRunner.bind(dataSource);
  dataSource.createQueryRunner = () => queryRunner;

  await queryRunner.connect();
  await queryRunner.startTransaction();

  return async function rollback() {
    await queryRunner.rollbackTransaction();
    dataSource.createQueryRunner = originalCreate;
    queryRunner.release = originalRelease;
    await queryRunner.release();
  };
}
```

The important part: **factories compose with this for free.** The persister calls plain `repository.save()`, which uses `dataSource.createQueryRunner()` under the hood — now patched to return the transactional runner. So everything a factory writes lands inside the transaction and vanishes on rollback. No special integration, no awareness on the library's side:

```ts
let rollback: () => Promise<void>;

beforeEach(async () => {
  rollback = await beginRollbackContext(dataSource);
});

afterEach(() => rollback()); // every row created in the test disappears

it('returns only published posts', async () => {
  const author = await factories.user.create();
  await factories.post.create({ author, published: true });
  await factories.post.create({ author, published: false });
  // ...assert; rollback happens automatically after
});
```

That handles the clean-state and cleanup problems directly. (This is the pattern a transaction-context helper implements; a production-grade one will also handle the case where the code under test opens its own nested transaction by mapping it to a savepoint.)

### What about parallelism?

Parallelism is subtler, and factories help with the *root cause* rather than being a silver bullet. The reason a shared seed blocks parallel runs is that every test reads — and sometimes mutates — the same committed rows, so two tests running at once step on each other. Factories remove that coupling: each test creates exactly the data it needs and depends on nothing global. Combined with rollback, nothing is ever committed, so concurrent tests cannot see or clobber each other's data.

Two ways to actually run in parallel:

- **Transaction rollback per test** (above): on a shared database, each worker holds its own connection and its own uncommitted transaction, so the data is naturally isolated. This works as long as the code under test does not commit on its own.
- **A database per worker**: when the code under test manages its own transactions (so you cannot wrap it in one), give each test runner its own schema or database — e.g. keyed by the worker id. Factories do not change here at all; you just point the persister at that worker's DataSource.

```ts
// jest: one schema per worker, so workers never share rows
const schema = `test_${process.env.JEST_WORKER_ID ?? '1'}`;
```

The division of labour is the point: this library owns the **arrange** half — building specialized, relation-heavy entities without boilerplate — while isolation and rollback stay where they belong, in a small transaction helper. The two compose without either knowing about the other.

## Using it in NestJS

Two flavors matter in a NestJS codebase: **service integration tests** (drive a provider against a real database) and **HTTP e2e tests** (drive the whole app through the router). Both run in the companion repo — [`examples/nestjs`](https://github.com/nestjsninja/typeorm-test-factory/tree/main/examples/nestjs) — against in-memory SQLite locally and real PostgreSQL in CI.

### Service integration test

Boot a testing module with the feature module, pull the service and the `DataSource` out of it, seed with factories, and wrap each test in the rollback helper:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { typeormPersister, bindFactories } from 'typeorm-test-factory';
import { OrderModule } from '../src/order/order.module';
import { OrderService } from '../src/order/order.service';
import { beginRollbackContext } from './tools/transaction-context';
import { userFactory, orderFactory } from './factories';

describe('OrderService (integration)', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let service: OrderService;

  let rollback: () => Promise<void>;
  let factories: { user: typeof userFactory; order: typeof orderFactory };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [TypeOrmModule.forRoot(testDbOptions), OrderModule],
    }).compile();

    dataSource = moduleRef.get(DataSource);
    service = moduleRef.get(OrderService);
  });

  afterAll(() => moduleRef.close());

  beforeEach(async () => {
    rollback = await beginRollbackContext(dataSource);
    factories = bindFactories(typeormPersister(dataSource), {
      user: userFactory,
      order: orderFactory,
    });
  });

  afterEach(() => rollback());

  it('pay() transitions an open order to paid', async () => {
    const user = await factories.user.create();
    const order = await factories.order.create({ user, status: 'open' });

    const paid = await service.pay(order.id);

    expect(paid.status).toBe('paid');
  });

  it('pay() rejects an order that is already paid', async () => {
    const user = await factories.user.create();
    const order = await factories.order.create({ user, status: 'paid' });

    await expect(service.pay(order.id)).rejects.toThrow(/cannot pay/);
  });
});
```

The seed reads like the precondition — *an open order owned by a user* — and the assertion is the behavior under test. Nothing else is on screen, and `afterEach` rolls it all back. Note `factories` is typed straight from the definitions with `typeof userFactory`; no need to restate the entity types.

### HTTP e2e test

For a full e2e test you boot the application, grab the `DataSource` Nest already created, and build the persister from it. Note the [lifecycle hooks](https://nestjs-ninja.com/blog/2026-08-06-nestjs-lifecycle-events-oninit-bootstrap-destroy-shutdown/) doing their job: `app.init()` runs `onModuleInit`, `app.close()` runs the shutdown sequence.

```ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { typeormPersister, bindFactories } from 'typeorm-test-factory';
import { AppModule } from '../src/app.module';
import { beginRollbackContext } from './tools/transaction-context';
import { userFactory } from './factories';

describe('Users (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let users: typeof userFactory;
  let rollback: () => Promise<void>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init(); // onModuleInit / onApplicationBootstrap fire here

    dataSource = app.get(DataSource);
    ({ users } = bindFactories(typeormPersister(dataSource), { users: userFactory }));
  });

  afterAll(() => app.close()); // graceful shutdown hooks fire here

  // The HTTP calls run through the same patched connection, so seeded rows and
  // anything the request writes all roll back together.
  beforeEach(async () => {
    rollback = await beginRollbackContext(dataSource);
  });
  afterEach(() => rollback());

  it('GET /users returns seeded users', async () => {
    await users.createMany(3);

    const res = await request(app.getHttpServer()).get('/users').expect(200);
    expect(res.body).toHaveLength(3);
  });
});
```

A note on DI: factories are **test-only** infrastructure, so there is no reason to register the persister as a provider in your application module. Keep it in the test. (If you ever do need seeding inside the app — a dev-only seed endpoint, say — that is the moment to reach for a [custom provider with an injection token](https://nestjs-ninja.com/blog/2026-07-23-nestjs-custom-providers-usevalue-useclass-usefactory-useexisting/), exactly as we covered earlier in the series.)

## The same factories seed your dev database

Because a factory is just "defaults + a persister", the same definitions you use in tests can populate a local or staging database from a script — no second seeding tool:

```ts
// scripts/seed.ts
import { AppDataSource } from '../src/data-source';
import { typeormPersister, bindFactories } from 'typeorm-test-factory';
import { userFactory, postFactory } from '../test/factories';

async function seed() {
  await AppDataSource.initialize();
  const { user, post } = bindFactories(typeormPersister(AppDataSource), {
    user: userFactory,
    post: postFactory,
  });

  const author = await user.create({ role: 'admin' });
  await post.createMany(20, { author });

  await AppDataSource.destroy();
}

seed();
```

## Wrapping up

The reason the TypeORM seeding story has been so rocky is a dependency pointed the wrong way: the seeding libraries depended on TypeORM's concrete, moving internals. Flip it — define a one-method port, make TypeORM a six-line adapter against a structural shape — and the coupling that kept breaking simply disappears.

The whole library is about 150 lines:

- A `Factory` with `make`/`create`/`with` and automatic relation resolution
- A one-method `Persister` port
- A six-line TypeORM adapter that imports nothing from TypeORM

Define your defaults once, override only what each test cares about, and never pin your TypeORM version to keep your seeds alive again.

It is on npm now — `npm install --save-dev typeorm-test-factory` — built and published from CI with provenance, and tested against real PostgreSQL on every push.

💻 Full source with tests (including a real TypeORM + SQLite integration suite): [nestjsninja/typeorm-test-factory](https://github.com/nestjsninja/typeorm-test-factory)
