---
title: 'NestJS Lifecycle Events: From Bootstrap to Graceful Shutdown'
excerpt: >-
  The constructor is not where initialization belongs. NestJS gives you five
  lifecycle hooks — OnModuleInit, OnApplicationBootstrap, OnModuleDestroy,
  BeforeApplicationShutdown, and OnApplicationShutdown — each firing at a
  precise moment in the application's life. This post shows you what each one is
  for, the order they run in, and what graceful shutdown actually looks like in
  production.
date: '2026-08-06T12:00:00.000Z'
author:
  name: Henrique Weiand
  picture: /nestjs-ninja.png
tags:
  - NestJS
  - TypeScript
  - Software Development
coverImage: >-
  /blog-assets/nestjs-lifecycle-events-oninit-bootstrap-destroy-shutdown/cover.png
ogImage:
  url: >-
    /blog-assets/nestjs-lifecycle-events-oninit-bootstrap-destroy-shutdown/cover.png
---
Hello, dev!

In the [previous post](https://nestjs-ninja.com/blog/2026-07-30-nestjs-injection-scopes-default-request-transient/) we looked at injection scopes — how long NestJS keeps a provider alive and when it creates new instances. Today we zoom out one level and look at the entire application lifetime: from the first line of `bootstrap()` to the last cleanup before the process exits.

NestJS defines five lifecycle hooks, two for startup and three for shutdown. Each fires at a specific, deterministic moment. If you have ever seen a service that tries to query a database in its constructor before the connection is open, or a worker that accepts new jobs while the process is shutting down, these hooks are what you were missing.

> The constructor is for wiring. Lifecycle hooks are for work.

💻 The full, runnable example is on GitHub: [nestjsninja/nestjs-lifecycle-events](https://github.com/nestjsninja/nestjs-lifecycle-events).

---

## The full sequence

```
Application starts
│
├─ Modules resolved (DI graph built)
│   └─ onModuleInit()          ← per provider/controller, depth-first
│
├─ All modules initialized
│   └─ onApplicationBootstrap() ← per provider/controller
│
└─ App listening for connections
         ⋮
         ⋮  (serving traffic)
         ⋮
OS signal received (SIGTERM / SIGINT)
│
├─ onModuleDestroy()            ← per provider/controller
├─ beforeApplicationShutdown()  ← per provider/controller (receives signal string)
├─ Connections closed
└─ onApplicationShutdown()      ← per provider/controller
```

The interfaces live in `@nestjs/common`. Every hook can return a `Promise` — NestJS awaits it before moving to the next step.

```ts
import {
  OnModuleInit,
  OnApplicationBootstrap,
  OnModuleDestroy,
  BeforeApplicationShutdown,
  OnApplicationShutdown,
} from "@nestjs/common";
```

---

## OnModuleInit — the right place for async setup

`onModuleInit()` fires after all of a module's providers have been instantiated and their dependencies injected, but before the rest of the application continues. If you return a `Promise`, NestJS will wait for it before moving on.

This is the correct place for:

- Opening database connections
- Validating configuration against an external system
- Warming up caches
- Running migrations

### Database connection

```ts
// database/database.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private connection: DatabaseConnection | null = null;

  async onModuleInit() {
    this.connection = await connectToDatabase({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      database: process.env.DB_NAME,
    });
    console.log("Database connection established");
  }

  async onModuleDestroy() {
    await this.connection?.close();
    this.connection = null;
    console.log("Database connection closed");
  }

  getConnection(): DatabaseConnection {
    if (!this.connection) throw new Error("Database not initialized");
    return this.connection;
  }
}
```

Opening the connection in `onModuleInit()` instead of the constructor means:

1. Any async error (wrong credentials, unreachable host) surfaces as a thrown exception that NestJS can catch and log clearly.
2. The rest of the DI graph is fully constructed first — no race between `DatabaseService` and services that depend on it.
3. Teardown in `onModuleDestroy()` is symmetric: the connection is released before the process exits.

### Config validation

```ts
// config/config.service.ts
import { Injectable, OnModuleInit } from "@nestjs/common";

@Injectable()
export class ConfigService implements OnModuleInit {
  private config: AppConfig;

  async onModuleInit() {
    this.config = this.loadConfig();
    await this.validate(this.config);
  }

  private loadConfig(): AppConfig {
    return {
      apiKey: process.env.API_KEY ?? "",
      webhookSecret: process.env.WEBHOOK_SECRET ?? "",
      paymentGatewayUrl: process.env.PAYMENT_GATEWAY_URL ?? "",
    };
  }

  private async validate(cfg: AppConfig) {
    if (!cfg.apiKey) throw new Error("API_KEY is required");
    if (!cfg.webhookSecret) throw new Error("WEBHOOK_SECRET is required");

    // Verify the payment gateway is reachable before accepting traffic
    const healthy = await pingGateway(cfg.paymentGatewayUrl);
    if (!healthy)
      throw new Error(`Payment gateway unreachable: ${cfg.paymentGatewayUrl}`);
  }

  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }
}
```

If `validate()` throws, NestJS stops bootstrapping and exits. The application never reaches a state where it is accepting traffic with a broken config.

---

## OnApplicationBootstrap — when the whole app is ready

`onApplicationBootstrap()` fires once — after every module's `onModuleInit()` has completed. The full dependency graph is live. Every connection is open. This hook exists for work that depends on the _whole application_ being ready, not just a single module.

Typical uses:

- Registering with service discovery (Consul, Kubernetes health endpoints)
- Starting a message queue consumer
- Scheduling the first run of a recurring job
- Sending an "application started" event to your monitoring system

### Queue consumer

```ts
// worker/order-worker.service.ts
import {
  Injectable,
  OnApplicationBootstrap,
  BeforeApplicationShutdown,
} from "@nestjs/common";
import { OrderService } from "../order/order.service";

@Injectable()
export class OrderWorkerService
  implements OnApplicationBootstrap, BeforeApplicationShutdown
{
  private consumer: QueueConsumer | null = null;
  private inFlight = 0;

  constructor(private readonly orderService: OrderService) {}

  async onApplicationBootstrap() {
    // All modules are initialized — it is safe to start consuming
    this.consumer = await createQueueConsumer("orders", async (message) => {
      this.inFlight++;
      try {
        await this.orderService.process(message);
      } finally {
        this.inFlight--;
      }
    });

    console.log("Order worker started");
  }

  async beforeApplicationShutdown(signal: string) {
    console.log(`Received ${signal} — draining queue consumer`);

    // Stop accepting new messages
    await this.consumer?.stop();

    // Wait for in-flight messages to finish (up to 30 seconds)
    const deadline = Date.now() + 30_000;
    while (this.inFlight > 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
    }

    if (this.inFlight > 0) {
      console.warn(
        `Shutdown timeout: ${this.inFlight} messages still in flight`,
      );
    }
  }
}
```

Starting the consumer in `onApplicationBootstrap()` instead of `onModuleInit()` matters here: `OrderService` depends on `DatabaseService`. If the database is still connecting when the worker tries to process its first message, things break. By the time `onApplicationBootstrap()` fires, `DatabaseService.onModuleInit()` has already completed — the connection is guaranteed to be open.

### Service discovery registration

```ts
// health/consul.service.ts
import {
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from "@nestjs/common";

@Injectable()
export class ConsulService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private serviceId: string;

  async onApplicationBootstrap() {
    this.serviceId = `order-api-${process.env.POD_NAME ?? "local"}`;

    await registerWithConsul({
      id: this.serviceId,
      name: "order-api",
      port: 3000,
      check: { http: `http://localhost:3000/health`, interval: "10s" },
    });

    console.log(`Registered with Consul: ${this.serviceId}`);
  }

  async onApplicationShutdown(signal: string) {
    await deregisterFromConsul(this.serviceId);
    console.log(
      `Deregistered from Consul: ${this.serviceId} (signal: ${signal})`,
    );
  }
}
```

---

## Enabling shutdown hooks

The three shutdown hooks — `onModuleDestroy`, `beforeApplicationShutdown`, `onApplicationShutdown` — only fire automatically if you call `app.enableShutdownHooks()` before `app.listen()`:

```ts
// main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks(); // ← required for OS signal handling

  await app.listen(3000);
}
```

`enableShutdownHooks()` registers listeners for `SIGTERM`, `SIGINT`, and `SIGHUP`. When the OS sends one of these (a Kubernetes pod termination, a `ctrl+c`, a process manager restart), NestJS runs the shutdown sequence in order and then calls `app.close()`.

Without this call, pressing `ctrl+c` or receiving `SIGTERM` will kill the process immediately — no cleanup, no graceful drain, no deregistration from service discovery.

---

## OnModuleDestroy — per-module cleanup

`onModuleDestroy()` is the symmetrical counterpart of `onModuleInit()`. It fires per module, in reverse initialization order, before `beforeApplicationShutdown`.

```ts
// cache/cache.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private client: RedisClient | null = null;
  private pendingWrites: Map<string, string> = new Map();

  async onModuleInit() {
    this.client = await createRedisClient(process.env.REDIS_URL);
  }

  async set(key: string, value: string) {
    this.pendingWrites.set(key, value);
    await this.client?.set(key, value);
  }

  async onModuleDestroy() {
    // Flush any pending writes before disconnecting
    for (const [key, value] of this.pendingWrites) {
      await this.client?.set(key, value).catch(() => {});
    }
    await this.client?.quit();
    this.client = null;
    console.log("Redis connection closed");
  }
}
```

Use `onModuleDestroy()` for cleanup that is scoped to a single module's resources: closing a connection pool, flushing a write buffer, cancelling module-level timers.

---

## BeforeApplicationShutdown — the signal arrives

`beforeApplicationShutdown(signal?: string)` fires after `onModuleDestroy()` completes across all modules. It receives the OS signal string (`'SIGTERM'`, `'SIGINT'`, etc.), which lets you adjust behavior based on why the process is shutting down.

This hook is the right place for _cross-module_ shutdown coordination: stopping the load balancer from routing new traffic, draining shared connection pools, flushing metrics.

```ts
// metrics/metrics.service.ts
import {
  Injectable,
  OnApplicationBootstrap,
  BeforeApplicationShutdown,
} from "@nestjs/common";

@Injectable()
export class MetricsService
  implements OnApplicationBootstrap, BeforeApplicationShutdown
{
  private startTime: number;

  onApplicationBootstrap() {
    this.startTime = Date.now();
    this.record("app.started", 1);
  }

  async beforeApplicationShutdown(signal: string) {
    const uptimeSeconds = (Date.now() - this.startTime) / 1000;
    this.record("app.shutdown", 1, { signal, uptimeSeconds });

    // Flush the metrics buffer to the remote endpoint before the process exits
    await this.flush();
    console.log(
      `Metrics flushed (signal: ${signal}, uptime: ${uptimeSeconds}s)`,
    );
  }

  private record(name: string, value: number, tags?: Record<string, unknown>) {
    // In practice: Datadog, Prometheus push gateway, etc.
    console.log(JSON.stringify({ metric: name, value, tags }));
  }

  private async flush(): Promise<void> {
    // Push buffered metrics to the remote endpoint
  }
}
```

---

## OnApplicationShutdown — final teardown

`onApplicationShutdown(signal?: string)` is the last hook in the sequence. It fires after the HTTP server has stopped accepting new connections. At this point, no more requests are coming in — this is safe for final cleanup that must happen after traffic stops.

```ts
// audit/audit.service.ts
import { Injectable, OnApplicationShutdown } from "@nestjs/common";

@Injectable()
export class AuditService implements OnApplicationShutdown {
  private readonly buffer: AuditEvent[] = [];

  record(event: AuditEvent) {
    this.buffer.push(event);
    if (this.buffer.length >= 100) {
      this.flush().catch(console.error);
    }
  }

  async onApplicationShutdown(signal: string) {
    // Flush any remaining audit events that haven't been batched yet
    if (this.buffer.length > 0) {
      await this.flush();
      console.log(`Flushed ${this.buffer.length} audit events on ${signal}`);
    }
  }

  private async flush() {
    const events = this.buffer.splice(0);
    await writeAuditEvents(events);
  }
}
```

---

## Execution order across modules

NestJS builds a dependency graph of modules at startup. Lifecycle hooks fire in **depth-first order** during initialization (leaves first, root last) and in **reverse order** during shutdown (root first, leaves last).

Given this module graph:

```
AppModule
├─ DatabaseModule      → DatabaseService (OnModuleInit, OnModuleDestroy)
├─ CacheModule         → CacheService (OnModuleInit, OnModuleDestroy)
└─ OrderModule
    ├─ imports: DatabaseModule, CacheModule
    └─ OrderService (OnModuleInit)
```

Startup order:

1. `DatabaseService.onModuleInit()`
2. `CacheService.onModuleInit()`
3. `OrderService.onModuleInit()`
4. All `onApplicationBootstrap()` hooks (same order)

Shutdown order:

1. All `onModuleDestroy()` — reverse order: `OrderService` → `CacheService` → `DatabaseService`
2. All `beforeApplicationShutdown()`
3. All `onApplicationShutdown()`

This ordering guarantee is what makes it safe to close `DatabaseService` _after_ `OrderService` — you know `OrderService` is done first.

---

## Testing lifecycle hooks

NestJS's testing module exposes `init()` and `close()`, which trigger the full hook sequence:

```ts
// order/order.module.spec.ts
import { Test, TestingModule } from "@nestjs/testing";
import { DatabaseService } from "../database/database.service";
import { OrderService } from "./order.service";
import { OrderModule } from "./order.module";

describe("OrderModule lifecycle", () => {
  let moduleRef: TestingModule;
  let db: DatabaseService;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [OrderModule],
    }).compile();

    // init() triggers onModuleInit and onApplicationBootstrap
    await moduleRef.init();

    db = moduleRef.get(DatabaseService);
  });

  afterEach(async () => {
    // close() triggers onModuleDestroy, beforeApplicationShutdown,
    // and onApplicationShutdown
    await moduleRef.close();
  });

  it("DatabaseService is connected after init", () => {
    expect(db.isConnected()).toBe(true);
  });

  it("DatabaseService is disconnected after close", async () => {
    await moduleRef.close();
    expect(db.isConnected()).toBe(false);
  });
});
```

When testing individual hooks without the full module, call the method directly:

```ts
it("onModuleDestroy flushes pending writes before closing", async () => {
  const service = new CacheService(mockRedis);
  service.set("key", "value"); // stage a pending write

  const flushSpy = jest.spyOn(mockRedis, "set");
  await service.onModuleDestroy();

  expect(flushSpy).toHaveBeenCalledWith("key", "value");
  expect(mockRedis.quit).toHaveBeenCalled();
});
```

---

## Common pitfalls

**1. Blocking work in the constructor**

```ts
// ❌ constructor is synchronous — cannot await, error handling is opaque
constructor(private readonly config: ConfigService) {
  this.connection = db.connect(config.get('DB_HOST'));  // sync call, no await
}

// ✅
async onModuleInit() {
  this.connection = await db.connect(this.config.get('DB_HOST'));
}
```

**2. Forgetting `enableShutdownHooks()`**

Kubernetes sends `SIGTERM` to your pod before force-killing it. Without `app.enableShutdownHooks()`, that signal kills the process immediately. Your database connections are left open, in-flight requests are dropped, and service discovery still lists your instance as healthy.

**3. `onApplicationBootstrap` for module-only setup**

```ts
// ❌ does not need the full app to be ready — use onModuleInit instead
async onApplicationBootstrap() {
  this.connection = await db.connect(this.config.get('DB_HOST'));
}

// ✅ reserve onApplicationBootstrap for cross-module dependencies
async onApplicationBootstrap() {
  // Safe to start consuming — OrderService (in another module) is fully ready
  await this.consumer.start();
}
```

**4. No timeout in `beforeApplicationShutdown`**

A drain loop that waits forever will block the process from ever exiting. Always pair a drain with a hard deadline:

```ts
async beforeApplicationShutdown() {
  const deadline = Date.now() + 30_000;   // 30 second hard limit
  while (this.inFlight > 0 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 100));
  }
  // Process exits regardless of inFlight count after the deadline
}
```

---

## Quick reference

| Hook                                | Fires after                                   | Typical use                                                     |
| ----------------------------------- | --------------------------------------------- | --------------------------------------------------------------- |
| `onModuleInit()`                    | Module's DI graph is resolved                 | Open connections, validate config, warm caches                  |
| `onApplicationBootstrap()`          | All modules are initialized                   | Start consumers, register with service discovery, schedule jobs |
| `onModuleDestroy()`                 | Shutdown begins (after `enableShutdownHooks`) | Close module-level connections, flush write buffers             |
| `beforeApplicationShutdown(signal)` | All `onModuleDestroy` complete                | Drain traffic, flush metrics, stop accepting new work           |
| `onApplicationShutdown(signal)`     | HTTP server closed                            | Final audit flush, deregister from service discovery            |

The two startup hooks and three shutdown hooks are symmetric. For every resource you open in `onModuleInit`, close it in `onModuleDestroy`. For every system you join in `onApplicationBootstrap`, leave it in `onApplicationShutdown`. The sequence is deterministic — use it.

💻 Full source with tests: [nestjsninja/nestjs-lifecycle-events](https://github.com/nestjsninja/nestjs-lifecycle-events)
