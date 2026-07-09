---
title: 'GraphQL Federation in NestJS: Subgraphs, Entities, and a Gateway'
excerpt: >-
  One GraphQL schema, many NestJS services. We take a code-first GraphQL API and
  split it into Apollo Federation v2 subgraphs — a users service that owns the
  User entity, an orders service that extends it — composed by a gateway that
  plans queries across both without the client ever knowing.
date: '2026-09-03T12:00:00.000Z'
author:
  name: Henrique Weiand
  picture: /nestjs-ninja.png
tags:
  - NestJS
  - TypeScript
  - Software Development
  - GraphQL
  - Apollo Federation
  - Microservices
coverImage: /blog-assets/nestjs-graphql-federation-apollo-subgraphs-gateway/cover.png
ogImage:
  url: /blog-assets/nestjs-graphql-federation-apollo-subgraphs-gateway/cover.png
---
Hello, dev!

GraphQL has a scaling problem, and it is not about traffic — it is about **people**. One of the best things about GraphQL is that the whole API is one schema: one graph the frontend can query however it likes. But "one schema" quietly becomes "one service", and "one service" becomes "every team commits to the same codebase, waits for the same deploys, and untangles the same resolver spaghetti". The thing that made GraphQL pleasant for consumers makes it painful for producers.

Federation is the way out: you keep the **one graph** the clients love, but you split the implementation into **subgraphs** — separate services, separately deployed, each owning the part of the schema it knows about — and a **gateway** composes them back into a single endpoint. Today we build exactly that with NestJS and Apollo Federation v2: a `users` service, an `orders` service, and a gateway in front, all in one monorepo you can run with a single command.

💻 The full, runnable example is on GitHub: [nestjsninja/nestjs-graphql-federation](https://github.com/nestjsninja/nestjs-graphql-federation).

## A sixty-second GraphQL-in-NestJS refresher ⚡

I will not spend long here — I wrote a [full introduction to GraphQL with NestJS](https://nestjs-ninja.com/blog/2023-11-15-unlocking-the-power-of-graphql-for-beginners-a-step-by-step-guide-to-integrating-graphql-i/) a while back — but let's set the baseline, because federation builds directly on it.

In the **code-first** approach, TypeScript classes _are_ the schema. An `@ObjectType()` class declares a type, a resolver declares queries with decorators, and NestJS generates the SDL for you:

```ts
@ObjectType()
export class User {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;
}

@Resolver(() => User)
export class UsersResolver {
  @Query(() => [User])
  users(): User[] { ... }
}
```

One driver setup in the module (`@nestjs/graphql` + `@nestjs/apollo` + Apollo Server), and you have `/graphql` running. That single-service setup is where most projects start — and where the "everything in one schema, everything in one service" problem starts too.

## Why federation: one graph, many owners 🧩

Picture the shop we are building. The **users** team owns identity: ids, names, emails. The **orders** team owns purchases: totals, statuses, and _which user made them_. In a single GraphQL service, both teams edit the same schema and the `User.orders` field forces the user module to know about orders — the exact coupling modules were supposed to prevent.

Federation redraws the lines with three ideas:

- a **subgraph** is a normal GraphQL service that owns a slice of the schema;
- an **entity** is a type that can cross subgraph boundaries, identified by a `@key` (think: primary key for the graph);
- the **gateway** reads all subgraph schemas, composes them into one **supergraph**, and plans each incoming query across the services that can answer it.

The part that makes federation actually good, and not just "microservices but GraphQL": a subgraph can **contribute fields to an entity it does not own**. `User.orders` is declared _in the orders service_, next to the data, and the users service never learns that orders exist.

> Federation keeps one graph for consumers and many owners for producers. Entities with `@key` are the bridge between them.

## The monorepo layout 🗂️

For the example, one NestJS monorepo with three apps (in real life these would likely be three repos — the code is identical either way):

```text
apps/
  users/     # subgraph on :3001 — owns User
  orders/    # subgraph on :3002 — owns Order, contributes User.orders
  gateway/   # :3000 — composes both, the only endpoint clients see
```

```bash
npm install @nestjs/graphql @nestjs/apollo @apollo/server @apollo/subgraph graphql
npm install @apollo/gateway            # gateway app only
npm install -D concurrently wait-on
```

One heads-up that will save you ten minutes of red logs: with NestJS 11 (Express 5) and Apollo Server 5, you also need the express integration package, `@as-integrations/express5` — the error message tells you, but only after the app refuses to boot.

```json
// package.json (scripts)
{
  "dev": "concurrently -n users,orders,gateway -c blue,magenta,green \"nest start users --watch\" \"nest start orders --watch\" \"wait-on tcp:3001 tcp:3002 && nest start gateway --watch\""
}
```

The `wait-on` matters: our gateway introspects the subgraphs at startup, so it has to boot last. We will come back to that.

## The users subgraph: owning an entity 👤

A subgraph looks almost exactly like a normal NestJS GraphQL app, with two differences. The first is the driver — `ApolloFederationDriver` instead of `ApolloDriver`, with federation v2 enabled:

```ts
// apps/users/src/users-app.module.ts
@Module({
  imports: [
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      autoSchemaFile: { federation: 2 },
    }),
  ],
  providers: [UsersService, UsersResolver],
})
export class UsersAppModule {}
```

The second is the `@key` directive on the type. This is what promotes `User` from a plain type to an **entity** — a type other subgraphs are allowed to reference:

```ts
// apps/users/src/user.model.ts
@ObjectType()
@Directive('@key(fields: "id")')
export class User {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  email: string;
}
```

And because other subgraphs will reference users _by id only_, this subgraph must be able to answer the question "here is `{ __typename: 'User', id: 'u1' }` — who is that?". That is the **reference resolver**:

```ts
// apps/users/src/users.resolver.ts
@Resolver(() => User)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => [User])
  users(): User[] {
    return this.usersService.findAll();
  }

  @Query(() => User)
  user(@Args('id', { type: () => ID }) id: string): User { ... }

  // Called by the gateway when ANOTHER subgraph references a User by key.
  @ResolveReference()
  resolveReference(reference: { __typename: string; id: string }): User | undefined {
    return this.usersService.findById(reference.id);
  }
}
```

`@ResolveReference()` is the single most important decorator in this post. Regular queries are how _clients_ enter your subgraph; the reference resolver is how _the gateway_ enters it.

> An entity is a type with a `@key` and a reference resolver: a promise that "given the key, I can give you the rest".

## The orders subgraph: extending someone else's entity 📦

The orders service owns the `Order` entity — same recipe as above — but the interesting part is how it deals with `User`. It declares its own, deliberately skeletal, version of the type:

```ts
// apps/orders/src/user.model.ts
// The orders subgraph's VIEW of User: just the key, plus what this
// subgraph contributes (the orders field, added by UsersResolver).
@ObjectType()
@Directive("@extends")
@Directive('@key(fields: "id")')
export class User {
  @Field(() => ID)
  @Directive("@external")
  id: string;
}
```

Read it as: "there is an entity called `User` somewhere else (`@extends`), its key is `id`, and that field is owned externally (`@external`) — I am only holding a stub of it". No name, no email. The orders service knows _that_ users exist, not _what_ they are.

Now the two directions of the relationship. First, this subgraph **contributes** `User.orders` — a field on an entity it does not own:

```ts
// apps/orders/src/users.resolver.ts
@Resolver(() => User)
export class UsersResolver {
  constructor(private readonly ordersService: OrdersService) {}

  @ResolveField(() => [Order])
  orders(@Parent() user: User): Order[] {
    return this.ordersService.findByUserId(user.id);
  }
}
```

Second, `Order.user` goes the other way — and here is the trick. The orders service cannot build a full `User` (it has no names or emails), so it returns a **reference**: the typename and the key, nothing more.

```ts
// apps/orders/src/orders.resolver.ts
@ResolveField(() => User)
user(@Parent() order: Order): { __typename: string; id: string } {
  return { __typename: 'User', id: order.userId };
}
```

That `{ __typename: 'User', id }` object is exactly what arrives at the users subgraph's `@ResolveReference()` from the previous section. The two halves click together — through the gateway, never directly.

> To point at an entity you do not own, return its reference: `__typename` plus the key. The owning subgraph fills in the rest.

## The gateway: composing the supergraph 🚪

The gateway is the smallest app of the three — it has no resolvers, no types, no business logic. It knows one thing: where the subgraphs live.

```ts
// apps/gateway/src/gateway-app.module.ts
@Module({
  imports: [
    GraphQLModule.forRoot<ApolloGatewayDriverConfig>({
      driver: ApolloGatewayDriver,
      gateway: {
        supergraphSdl: new IntrospectAndCompose({
          subgraphs: [
            {
              name: "users",
              url:
                process.env.USERS_SUBGRAPH_URL ??
                "http://localhost:3001/graphql",
            },
            {
              name: "orders",
              url:
                process.env.ORDERS_SUBGRAPH_URL ??
                "http://localhost:3002/graphql",
            },
          ],
        }),
      },
    }),
  ],
})
export class GatewayAppModule {}
```

`IntrospectAndCompose` fetches each subgraph's schema at startup and composes the supergraph in memory. This is why the `dev` script boots the gateway last with `wait-on`: if a subgraph is down at composition time, the gateway fails to start. Convenient for development, and we will be honest about its production story in a moment.

## One query, two services 🔀

Run `npm run dev` and query the **gateway** — the only URL a client ever sees:

```bash
curl -s -X POST http://localhost:3000/graphql -H 'content-type: application/json' \
  -d '{"query":"{ user(id: \"u1\") { name email orders { id total status } } }"}'
```

```json
{
  "data": {
    "user": {
      "name": "Ada Lovelace",
      "email": "ada@example.com",
      "orders": [
        { "id": "o1", "total": 49.9, "status": "delivered" },
        { "id": "o2", "total": 120, "status": "processing" }
      ]
    }
  }
}
```

It looks like one resolver answered. It was two services. The gateway built a **query plan**: fetch `user(id: "u1")` with `name` and `email` from the users subgraph; then call the orders subgraph's `_entities` field with the representation `{ __typename: "User", id: "u1" }` to resolve `orders` — the field the orders team contributed. `_entities` is machinery federation adds to every subgraph; you never call it yourself, but seeing it in the subgraph logs demystifies the whole thing.

The reverse direction crosses the boundary the other way — `Order.user` returns a reference, and the gateway asks the users subgraph to expand it:

```bash
curl -s -X POST http://localhost:3000/graphql -H 'content-type: application/json' \
  -d '{"query":"{ orders { id total user { name email } } }"}'
```

```json
{
  "data": {
    "orders": [
      {
        "id": "o1",
        "total": 49.9,
        "user": { "name": "Ada Lovelace", "email": "ada@example.com" }
      },
      {
        "id": "o2",
        "total": 120,
        "user": { "name": "Ada Lovelace", "email": "ada@example.com" }
      },
      {
        "id": "o3",
        "total": 15.5,
        "user": { "name": "Alan Turing", "email": "alan@example.com" }
      }
    ]
  }
}
```

Notice what did _not_ happen: the orders service never called the users service. Subgraphs do not talk to each other — the gateway orchestrates everything. That keeps the services genuinely independent: no service discovery between them, no shared clients, no cascading deploys.

> Subgraphs never call each other. The gateway plans, fans out, and stitches — that is the entire job description.

## Production notes 🧭

The example is honest about being an example, so let me be honest about what changes in production.

**`IntrospectAndCompose` is a development tool.** It composes the supergraph from live subgraphs at boot, which means a subgraph outage at the wrong moment breaks gateway startup, and a bad schema change is discovered at runtime. In production you compose the supergraph SDL **at build time** — with [Rover](https://www.apollographql.com/docs/rover/) (`rover supergraph compose`) in CI, or Apollo's managed federation (GraphOS) publishing schema changes — and the gateway loads a static, already-validated supergraph. Composition errors become CI failures instead of incidents.

**Hide the subgraphs.** Clients should only reach the gateway; `:3001` and `:3002` belong on the private network. The `_entities` field is powerful and not meant for public traffic.

**Watch for N+1 across the boundary.** The gateway batches entity lookups per query — our three orders became _one_ `_entities` call with three representations, not three calls. But inside your reference resolver, `findById` per representation against a database is still N queries. The classic fix applies: batch with a DataLoader keyed by id inside the subgraph.

**The stub types are a contract.** When the users team renames a field, composition fails loudly in CI (another reason to compose at build time). Treat your `@key` fields as you treat a database primary key: stable, boring, never recycled.

## Final thoughts

We started from GraphQL's people-scaling problem and ended with three small NestJS apps: a subgraph that owns `User` and answers references to it, a subgraph that owns `Order` and _contributes_ `User.orders` from where the data actually lives, and a gateway that makes the split invisible to clients. The client still sees the one graph GraphQL promised — `{ user { name orders { total } } }` — with no idea a team boundary sits in the middle of that query.

If you are on a single GraphQL service today, none of this forces itself on you. Federation earns its complexity when the schema has more than one owner. When that day comes, the migration is surprisingly mechanical: swap the driver, add `@key` to the types that cross boundaries, write the reference resolvers, and put the gateway in front.

### Takeaways ✍️

- GraphQL's one-schema superpower becomes a bottleneck when several teams own one service — federation splits ownership, not the graph.
- A subgraph is a normal NestJS GraphQL app using `ApolloFederationDriver` with `autoSchemaFile: { federation: 2 }`.
- `@Directive('@key(fields: "id")')` turns a type into an entity; `@ResolveReference()` answers the gateway's "who is this key?".
- To reference an entity you do not own, return `{ __typename, id }` — the owning subgraph expands it.
- Contribute fields where the data lives: `User.orders` is declared in the orders subgraph, and the users service never knows.
- Subgraphs never call each other; the gateway plans and stitches every cross-service query.
- `IntrospectAndCompose` is for development — compose the supergraph in CI (Rover / managed federation) for production.
- Batch inside reference resolvers (DataLoader): the gateway batches the calls, but your database access is still yours to optimize.
- NestJS 11 + Apollo Server 5 needs `@as-integrations/express5` — install it before the error message finds you.
