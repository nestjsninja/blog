---
title: 'NestJS Injection Scopes: DEFAULT, REQUEST, and TRANSIENT in Production'
excerpt: >-
  Most NestJS services are singletons — and that is fine until you need
  per-request isolation for tenant context, correlation IDs, or stateful
  helpers. This post explains all three scopes, scope bubbling, durable
  providers, and when each one belongs in your application.
date: '2026-07-30T12:00:00.000Z'
author:
  name: Henrique Weiand
  picture: /nestjs-ninja.png
tags:
  - NestJS
  - TypeScript
  - Dependency Injection
  - Software Development
coverImage: /blog-assets/nestjs-injection-scopes-default-request-transient/cover.png
ogImage:
  url: /blog-assets/nestjs-injection-scopes-default-request-transient/cover.png
---
Hello, dev!

In the [previous post](https://nestjs-ninja.com/blog/2026-07-23-nestjs-custom-providers-usevalue-useclass-usefactory-useexisting/) we looked at the four provider shapes — `useValue`, `useClass`, `useFactory`, `useExisting` — and how they describe the _value side_ of the token–value pair NestJS stores in its DI container.

Today we look at the _lifetime side_: how long does the container keep that value alive?

By default every provider is a singleton. One instance is created, and every class that injects the token gets the same object. That is almost always what you want. But there are patterns where a shared instance is the wrong model: per-request state, per-tenant isolation, stateful helpers that must not leak data between callers. NestJS covers all of these with **injection scopes**.

> Scope is not a performance dial. It is a correctness decision.

💻 The full, runnable example is on GitHub: [nestjsninja/nestjs-injection-scopes](https://github.com/nestjsninja/nestjs-injection-scopes).

## The three scopes

| Scope       | Lifetime                                | Instance count          |
| ----------- | --------------------------------------- | ----------------------- |
| `DEFAULT`   | Application lifetime                    | One per module context  |
| `REQUEST`   | Single HTTP request (or RPC/WS message) | One per inbound message |
| `TRANSIENT` | Per injection site                      | One per consumer        |

```ts
import { Injectable, Scope } from "@nestjs/common";

@Injectable({ scope: Scope.DEFAULT }) // ← default, same as @Injectable()
class ConfigService {}

@Injectable({ scope: Scope.REQUEST })
class TenantService {}

@Injectable({ scope: Scope.TRANSIENT })
class QueryBuilder {}
```

---

## DEFAULT scope — the singleton

When NestJS compiles a module it creates one instance of each provider and caches it. Every subsequent injection reuses that same object. The container never creates a second one.

```ts
// order/order.service.ts
@Injectable() // scope: Scope.DEFAULT is the implicit default
export class OrderService {
  constructor(private readonly db: DatabaseService) {}
}
```

`DatabaseService` is created once. `OrderService` is created once. The same `OrderService` handles every incoming request. This is what makes NestJS fast at scale: the cost of construction is paid once at bootstrap, not per-request.

**What goes wrong when you ignore this?** A singleton that accumulates state across requests. Classic example:

```ts
@Injectable()
export class BadCartService {
  private items: CartItem[] = []; // shared across ALL requests — bug

  addItem(item: CartItem) {
    this.items.push(item); // user A's items leak into user B's cart
  }
}
```

The fix is almost never "make it REQUEST scoped." The fix is to not store mutable per-request state in a service field. Store it in a database, a cache, or pass it as method arguments. Reach for non-DEFAULT scopes only when the data genuinely must live at the service level for the duration of a single request.

---

## REQUEST scope — one instance per message

A REQUEST-scoped provider is instantiated fresh for every inbound HTTP request (or WebSocket message, or microservice event). NestJS tears it down when the response is sent.

```ts
import { Injectable, Scope } from "@nestjs/common";

@Injectable({ scope: Scope.REQUEST })
export class TenantService {
  private tenantId: string;

  setTenant(id: string) {
    this.tenantId = id;
  }

  getTenant(): string {
    return this.tenantId;
  }
}
```

### Accessing the raw request

Inject the request object via the `REQUEST` token from `@nestjs/core`:

```ts
import { Injectable, Scope, Inject } from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import { Request } from "express";

@Injectable({ scope: Scope.REQUEST })
export class TenantService {
  private readonly tenantId: string;

  constructor(@Inject(REQUEST) private readonly request: Request) {
    // Resolve once at construction time — the request is already populated
    this.tenantId = this.extractTenantId(request);
  }

  getTenantId(): string {
    return this.tenantId;
  }

  private extractTenantId(req: Request): string {
    // In practice: decode a JWT, read a subdomain, or check a header
    const tenantHeader = req.headers["x-tenant-id"];
    if (!tenantHeader || Array.isArray(tenantHeader)) {
      throw new Error("Missing or ambiguous X-Tenant-Id header");
    }
    return tenantHeader;
  }
}
```

Because NestJS constructs `TenantService` after the request arrives, `REQUEST` is already populated. You resolve what you need in the constructor and store it as a typed field — no more `@Inject(REQUEST)` repetition across the class.

### Real example: correlation ID logger

A correlation ID (or trace ID) ties every log line from a single request together. Without REQUEST scope you have to thread the ID through every method call manually. With it, the ID lives in the logger itself:

```ts
// logger/request-logger.service.ts
import { Injectable, Scope, Inject } from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import { Request } from "express";
import { randomUUID } from "crypto";

@Injectable({ scope: Scope.REQUEST })
export class RequestLogger {
  private readonly requestId: string;
  private readonly tenantId: string;

  constructor(@Inject(REQUEST) req: Request) {
    this.requestId = (req.headers["x-request-id"] as string) ?? randomUUID();
    this.tenantId = (req.headers["x-tenant-id"] as string) ?? "unknown";
  }

  log(message: string, context?: Record<string, unknown>) {
    console.log(
      JSON.stringify({
        level: "info",
        requestId: this.requestId,
        tenantId: this.tenantId,
        message,
        ...context,
      }),
    );
  }

  error(message: string, err?: unknown) {
    console.error(
      JSON.stringify({
        level: "error",
        requestId: this.requestId,
        tenantId: this.tenantId,
        message,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}
```

Any service that injects `RequestLogger` gets the same instance within a request — the same `requestId`, the same `tenantId` — without any argument passing.

```ts
@Injectable({ scope: Scope.REQUEST })
export class OrderService {
  constructor(
    private readonly logger: RequestLogger,
    private readonly tenant: TenantService,
  ) {}

  async create(dto: CreateOrderDto): Promise<Order> {
    this.logger.log("Creating order", { tenantId: this.tenant.getTenantId() });
    // ...
  }
}
```

---

## Scope bubbling — the most important rule

**If a REQUEST-scoped provider is injected into a singleton, the singleton must also be REQUEST-scoped.**

NestJS enforces this automatically: when the container sees a singleton that depends on a REQUEST-scoped provider, it promotes the singleton to REQUEST scope. This "bubbles up" the dependency tree.

```
OrderController (REQUEST)
  └─ OrderService    ← was DEFAULT, promoted to REQUEST
       └─ RequestLogger (REQUEST)
       └─ TenantService (REQUEST)
       └─ DatabaseService (DEFAULT — fine, no promotion needed)
```

In practice: declare REQUEST scope on every service in the chain that needs per-request state, and let NestJS take care of the rest. You only need to be explicit when you want to _prevent_ promotion — for example, if `DatabaseService` must stay a singleton even though something further up the tree is REQUEST-scoped (it can be, because it does not depend on a REQUEST-scoped provider itself).

**The performance cost of bubbling**: every REQUEST-scoped provider in the chain is re-instantiated on every request. If `OrderService` does expensive initialization in its constructor, making it REQUEST-scoped pays that cost on every HTTP call. Keep expensive setup in DEFAULT-scoped services and inject them into REQUEST-scoped ones — that direction is always safe.

---

## TRANSIENT scope — a fresh instance per injection site

TRANSIENT providers are created once per _consumer_, not once per request. If three services inject a TRANSIENT provider, each gets its own private instance.

```ts
@Injectable({ scope: Scope.TRANSIENT })
export class QueryBuilder {
  private conditions: string[] = [];
  private tableName = "";

  from(table: string): this {
    this.tableName = table;
    return this;
  }

  where(condition: string): this {
    this.conditions.push(condition);
    return this;
  }

  build(): string {
    const where =
      this.conditions.length > 0
        ? ` WHERE ${this.conditions.join(" AND ")}`
        : "";
    return `SELECT * FROM ${this.tableName}${where}`;
  }
}
```

Because each consumer owns its own `QueryBuilder`, building a query in `OrderRepository` does not affect the `QueryBuilder` inside `UserRepository`.

```ts
@Injectable()
export class OrderRepository {
  constructor(private readonly qb: QueryBuilder) {} // its own instance

  findByTenant(tenantId: string): string {
    return this.qb.from("orders").where(`tenant_id = '${tenantId}'`).build();
  }
}

@Injectable()
export class UserRepository {
  constructor(private readonly qb: QueryBuilder) {} // different instance

  findActive(): string {
    return this.qb.from("users").where("active = true").build();
  }
}
```

TRANSIENT is the right scope when a provider accumulates state that is meaningless outside a single consumer. The key difference from REQUEST: TRANSIENT instances are not shared even within the same request.

---

## Controller scope

Controllers can also be scoped. A REQUEST-scoped controller creates a fresh instance per request, which is useful when you want to resolve route params or headers once and store them as fields:

```ts
@Controller({ path: "orders", scope: Scope.REQUEST })
export class OrderController {
  constructor(
    @Inject(REQUEST) private readonly req: Request,
    private readonly orderService: OrderService,
  ) {}

  @Get()
  findAll() {
    const page = parseInt(this.req.query["page"] as string, 10) || 1;
    return this.orderService.findAll({ page });
  }
}
```

Scoping the controller is less common than scoping a service — most of the time you read query params from the handler arguments (`@Query('page')`) rather than the raw request — but the option exists.

---

## Durable providers

Multi-tenant applications face a specific problem with REQUEST scope: every request creates new provider instances even when two requests from the same tenant could safely share them. If tenant-specific initialization is expensive — opening a per-tenant DB connection, compiling a per-tenant schema — paying it per-request is wasteful.

**Durable providers** solve this. Mark a provider as durable and supply a context ID factory. NestJS reuses the same instance for all requests that share the same context ID.

```ts
// tenant/tenant.module.ts
import {
  Injectable,
  Scope,
  Module,
  ContextIdFactory,
  ContextIdStrategy,
} from "@nestjs/core";
import { Request } from "express";

// 1. Strategy: map each request to a context ID based on tenant
export class TenantContextIdStrategy implements ContextIdStrategy {
  attach(contextId: import("@nestjs/core").ContextId, request: Request) {
    const tenantId = (request.headers["x-tenant-id"] as string) ?? "default";

    // Retrieve (or create) the shared context ID for this tenant
    const tenantSubTreeId = ContextIdFactory.getByRequest(request, [
      "x-tenant-id",
    ]);

    return {
      resolve: () => tenantSubTreeId,
      payload: { tenantId },
    };
  }
}
```

```ts
// Register the strategy globally in main.ts
import { ContextIdFactory } from "@nestjs/core";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  ContextIdFactory.apply(new TenantContextIdStrategy());
  await app.listen(3000);
}
```

```ts
// tenant/tenant-db.service.ts — expensive to create, shared per tenant
@Injectable({ scope: Scope.REQUEST, durable: true })
export class TenantDatabaseService {
  private readonly connection: DatabaseConnection;

  constructor(@Inject(REQUEST) { payload }: { payload: { tenantId: string } }) {
    // This constructor runs once per unique tenant context, not per request
    this.connection = createConnectionForTenant(payload.tenantId);
  }

  query(sql: string) {
    return this.connection.execute(sql);
  }
}
```

The `durable: true` flag tells NestJS: "this provider's instance can be shared across requests that resolve to the same context ID." Two simultaneous requests from `tenant-a` share one `TenantDatabaseService`. A request from `tenant-b` gets its own.

Durable providers are the right answer when:

- Initialization is expensive and tenant-specific
- The provider carries no per-request mutable state (only per-tenant state)
- You want REQUEST isolation between tenants but not between requests within the same tenant

---

## The INQUIRER token — knowing who injected you

Sometimes a provider needs to know _which class_ requested it — most commonly for logging, where you want the class name to appear automatically:

```ts
import { Injectable, Scope, Inject } from "@nestjs/common";
import { INQUIRER } from "@nestjs/core";

@Injectable({ scope: Scope.TRANSIENT })
export class ContextLogger {
  private context: string;

  constructor(@Inject(INQUIRER) parentClass: object) {
    this.context = parentClass?.constructor?.name ?? "Unknown";
  }

  log(message: string) {
    console.log(`[${this.context}] ${message}`);
  }

  error(message: string) {
    console.error(`[${this.context}] ${message}`);
  }
}
```

```ts
@Injectable()
export class OrderService {
  constructor(private readonly logger: ContextLogger) {}

  create(dto: CreateOrderDto) {
    this.logger.log("Creating order"); // prints: [OrderService] Creating order
  }
}

@Injectable()
export class UserService {
  constructor(private readonly logger: ContextLogger) {}

  register(dto: RegisterDto) {
    this.logger.log("Registering user"); // prints: [UserService] Registering user
  }
}
```

`INQUIRER` requires TRANSIENT scope — if `ContextLogger` were DEFAULT, every consumer would see the same instance, meaning `context` would be set to whichever class happened to inject it first. TRANSIENT guarantees each consumer gets its own instance with its own `context` string.

---

## Performance considerations

| Scope       | Construction cost             | Memory pressure                 | Use when                                  |
| ----------- | ----------------------------- | ------------------------------- | ----------------------------------------- |
| `DEFAULT`   | Once at bootstrap             | Lowest                          | Always — unless you need isolation        |
| `REQUEST`   | Once per request              | Proportional to RPS             | Per-request state is correct model        |
| `TRANSIENT` | Once per consumer per request | Highest                         | Stateful helper, must not be shared       |
| Durable     | Once per context ID           | Proportional to unique contexts | Expensive init, shareable across requests |

REQUEST scope has a real cost at high RPS. If your application handles 10,000 req/s and a REQUEST-scoped provider does 1ms of work in its constructor, you are spending 10 seconds of CPU per second on construction alone — before any business logic runs.

The practical rule: keep DEFAULT wherever you can, and push to REQUEST only at the _boundary_ — the service that actually reads from the request object. Everything else injects that boundary service rather than the raw request.

---

## Decision guide

```
Does the provider need per-request isolation?
├── No  → DEFAULT (singleton)
└── Yes → Does it need to be shared across requests for the same context?
          ├── Yes → Durable REQUEST
          └── No  → Does it need a private instance per consumer?
                    ├── Yes → TRANSIENT
                    └── No  → REQUEST
```

In concrete terms:

- **Config, database connections, caches, HTTP clients** → DEFAULT
- **Tenant context, correlation ID logger, request-scoped audit trail** → REQUEST
- **Per-context DB connections in multi-tenant apps** → Durable REQUEST
- **Stateful query builder, per-consumer formatter** → TRANSIENT
- **Auto-contextual logger (knows its caller)** → TRANSIENT + INQUIRER

---

## Putting it all together

The full example in the companion repo wires all three scopes into a single multi-tenant order API:

```
src/
├── tenant/
│   ├── tenant.service.ts           ← REQUEST: resolves tenant from JWT
│   └── tenant-db.service.ts        ← Durable REQUEST: per-tenant DB connection
├── logger/
│   ├── request-logger.service.ts   ← REQUEST: correlation ID + tenant context
│   └── context-logger.service.ts   ← TRANSIENT + INQUIRER: auto class name
├── order/
│   ├── order.repository.ts         ← DEFAULT: injects QueryBuilder (TRANSIENT)
│   ├── order.service.ts            ← REQUEST: injects TenantService + RequestLogger
│   └── order.controller.ts         ← REQUEST: resolves tenant early
└── shared/
    └── query-builder.service.ts    ← TRANSIENT: stateful, per-consumer
```

When a `POST /orders` request arrives:

1. NestJS creates a new request context
2. REQUEST-scoped providers are instantiated: `TenantService` (reads JWT), `RequestLogger` (sets correlation ID), `OrderService`
3. TRANSIENT providers are instantiated per consumer: `QueryBuilder` in `OrderRepository` is a fresh copy, isolated from any other repository
4. DEFAULT providers — `DatabaseService`, `ConfigService` — are reused from the singleton pool
5. The durable `TenantDatabaseService` is reused if another request from the same tenant is already in-flight

Scope is a correctness decision first, a performance decision second. Get the correctness right, and then optimize by pushing state out of REQUEST scope and into DEFAULT providers wherever the data can legitimately be shared.

💻 Full source with tests: [nestjsninja/nestjs-injection-scopes](https://github.com/nestjsninja/nestjs-injection-scopes)
