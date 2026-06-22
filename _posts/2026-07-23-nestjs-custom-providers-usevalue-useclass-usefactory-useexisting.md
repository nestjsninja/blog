---
title: >-
  NestJS Custom Providers: useValue, useClass, useFactory, and useExisting in
  the Real World
excerpt: >-
  The official docs show you the four provider shapes. This post shows you when
  to reach for each one in production code — typed injection tokens, async
  factory initialization, environment-aware class swapping, alias providers, and
  a multi-provider plugin system you can extend without touching existing code.
date: '2026-07-23T12:00:00.000Z'
author:
  name: Henrique Weiand
  picture: /nestjs-ninja.png
tags:
  - NestJS
  - TypeScript
  - Dependency Injection
  - Software Development
coverImage: >-
  /blog-assets/nestjs-custom-providers-usevalue-useclass-usefactory-useexisting/cover.png
ogImage:
  url: >-
    /blog-assets/nestjs-custom-providers-usevalue-useclass-usefactory-useexisting/cover.png
---
Hello, dev!

The NestJS documentation introduces four provider shapes. You have probably read them — `useValue`, `useClass`, `useFactory`, `useExisting`. You know they exist. But knowing their names is different from knowing _when to reach for each one_, or what they look like beyond a contrived example.

Today we go past the docs. We build a checkout system — config loading, file storage, email delivery, payment gateways, and fan-out notifications — and every piece is wired together with custom providers. By the end you will have a clear mental model for the full provider API.

> The four provider shapes are not alternatives. Each one solves a different problem.

💻 The full, runnable example is on GitHub: [nestjsninja/nestjs-custom-providers](https://github.com/nestjsninja/nestjs-custom-providers).

## The provider contract

Every provider in NestJS is a **token–value pair**. NestJS stores this pair in a module-scoped container. When a class declares `@Inject(TOKEN)` in its constructor, the container resolves the token and hands back the value.

The four provider shapes are four different ways to describe the _value side_ of that pair:

| Shape         | Produces the value by…                                        |
| ------------- | ------------------------------------------------------------- |
| `useValue`    | using a pre-built value you hand over directly                |
| `useClass`    | instantiating a class (with its own DI-resolved dependencies) |
| `useFactory`  | calling a function that returns the value (can be `async`)    |
| `useExisting` | aliasing an already-registered token to a new one             |

The _token side_ — the thing you inject — deserves as much attention as the value side. That is where we start.

## Injection tokens: the DI contract 🔑

The docs use strings for tokens: `provide: 'CONNECTION'`. Strings work, but they are the worst tokens you can use: they live in a global namespace, typos crash at runtime, and you get no type inference.

### Symbol tokens

A `Symbol` is unique by identity. Two `Symbol('STORAGE_SERVICE')` calls produce two _different_ symbols, which eliminates naming collisions across modules:

```ts
// storage/storage.constants.ts
export const STORAGE_SERVICE = Symbol("STORAGE_SERVICE");
```

Symbols are the right default for feature-module tokens.

### Typed Symbol tokens

NestJS does not ship an instantiable `InjectionToken` class (unlike Angular). The `InjectionToken<T>` export from `@nestjs/common` is a **type alias** — `string | symbol | Type<T> | ...` — not something you can `new` up. For typed tokens, annotate the `const` with `unique symbol` and add the generic at the `@Inject()` call site:

```ts
// config/app.config.ts
export interface AppConfig {
  apiKey: string;
  apiUrl: string;
  environment: "development" | "production" | "test";
}

// unique symbol ensures this token cannot be accidentally widened to `symbol`
export const APP_CONFIG: unique symbol = Symbol("APP_CONFIG");
```

The type safety comes from annotating `@Inject(APP_CONFIG) private readonly config: AppConfig` — TypeScript checks the declared type against what the container actually returns. The token itself is just a unique key.

### Custom `@Inject` decorators

When you end up typing `@Inject(STORAGE_SERVICE)` at every injection site, wrap it in a decorator that carries the token:

```ts
// storage/storage.constants.ts
import { Inject } from "@nestjs/common";

export const STORAGE_SERVICE = Symbol("STORAGE_SERVICE");

export const InjectStorage = (): ParameterDecorator => Inject(STORAGE_SERVICE);
```

```ts
// before
constructor(@Inject(STORAGE_SERVICE) private readonly storage: StorageService) {}

// after
constructor(@InjectStorage() private readonly storage: StorageService) {}
```

This is exactly how `@nestjs/typeorm` ships `@InjectRepository()` and `@InjectDataSource()`. It is not magic — just a function returning a parameter decorator. Token changes propagate from a single file.

---

## useValue: inject what you already have 📦

`useValue` hands a pre-built value to the container as-is. NestJS does not instantiate anything. Reach for it when:

- you need to inject a typed config object or a constant
- you are wrapping a third-party SDK instance that is constructed outside NestJS
- you want a globally-scoped pipe, guard, or interceptor without calling `app.useGlobalPipes()`

### Config injection

Instead of reaching for `process.env.API_KEY` in every service, register a typed config object once at module startup:

```ts
// config/config.module.ts
@Module({
  providers: [
    {
      provide: APP_CONFIG,
      useValue: {
        apiKey: process.env.API_KEY ?? "dev-key",
        apiUrl: process.env.API_URL ?? "http://localhost:3000",
        environment:
          (process.env.NODE_ENV as AppConfig["environment"]) ?? "development",
      } satisfies AppConfig,
    },
  ],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
```

Services inject the typed object — no `process.env` scattered through business logic:

```ts
@Injectable()
export class CheckoutService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  buildReceiptUrl(orderId: string) {
    return `${this.config.apiUrl}/receipts/${orderId}`;
  }
}
```

### Third-party SDK injection

Always inject SDK instances — never create them inside a service. Injected instances are swappable in tests; hardcoded instances are not:

```ts
// mailer/mailer.module.ts (simplified SDK injection)
@Module({
  providers: [
    {
      provide: RESEND_CLIENT,
      useValue: new Resend(process.env.RESEND_API_KEY),
    },
    MailerService,
  ],
  exports: [MailerService],
})
export class MailerModule {}
```

In tests you override the token:

```ts
const moduleRef = await Test.createTestingModule({
  providers: [
    MailerService,
    { provide: RESEND_CLIENT, useValue: { emails: { send: jest.fn() } } },
  ],
}).compile();
```

Zero changes to `MailerService`. The token is the seam.

### Global pipes, guards, and interceptors

NestJS ships three tokens from `@nestjs/core` — `APP_PIPE`, `APP_GUARD`, `APP_INTERCEPTOR` — that apply a provider globally when registered under them:

```ts
@Module({
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({ transform: true, whitelist: true }),
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard, // note: useClass works here too
    },
  ],
})
export class AppModule {}
```

The advantage over `app.useGlobalPipes()` in `main.ts`: providers registered via `APP_PIPE` are present in `Test.createTestingModule()` scans. `app.useGlobalPipes()` registrations are not.

---

## useClass: swap implementations at the token 🔄

`useClass` tells the container to instantiate a class for a given token. The class can have its own constructor dependencies — the container resolves those too. Reach for it when:

- you want a single token to map to different implementations depending on the environment
- you are implementing the strategy pattern at the module level

### The interface + token pattern

NestJS has no runtime concept of an interface (TypeScript interfaces are erased at compile time), so you represent a contract with two things: a TypeScript interface (compile-time) and a Symbol/`InjectionToken` (runtime):

```ts
// storage/storage.interface.ts
export interface StorageService {
  upload(filename: string, buffer: Buffer): Promise<string>;
  download(filename: string): Promise<Buffer>;
  delete(filename: string): Promise<void>;
}
```

Two concrete implementations:

```ts
// storage/local-storage.service.ts
@Injectable()
export class LocalStorageService implements StorageService {
  async upload(filename: string, buffer: Buffer): Promise<string> {
    const path = join(process.cwd(), "uploads", filename);
    await writeFile(path, buffer);
    return path;
  }
  // download, delete...
}
```

```ts
// storage/s3-storage.service.ts
@Injectable()
export class S3StorageService implements StorageService {
  async upload(filename: string, buffer: Buffer): Promise<string> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: filename,
        Body: buffer,
      }),
    );
    return `https://${this.bucket}.s3.amazonaws.com/${filename}`;
  }
  // download, delete...
}
```

The module picks the class based on the environment — nowhere else in the codebase makes this decision:

```ts
// storage/storage.module.ts
const isProduction = process.env.NODE_ENV === "production";

@Module({
  providers: [
    {
      provide: STORAGE_SERVICE,
      useClass: isProduction ? S3StorageService : LocalStorageService,
    },
  ],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
```

Controllers, services, and even `AppModule` do not know which implementation is running. If you add a `GCSStorageService` next quarter, the change is one line in `StorageModule`.

### Testing with useClass

Override at module compile time to pin the implementation in tests:

```ts
const moduleRef = await Test.createTestingModule({
  providers: [
    UploadController,
    { provide: STORAGE_SERVICE, useClass: LocalStorageService },
  ],
}).compile();
```

For unit tests you could go further and create an `InMemoryStorageService` with zero I/O — keeping `LocalStorageService` only for integration tests.

---

## useFactory: build the value with code 🏭

`useFactory` accepts a function that returns the value. The function can be synchronous or `async` and can receive injected dependencies via the `inject` array. Reach for it when:

- initialization requires async work — connecting to Redis, loading remote config
- the value depends on one or more other providers
- you need conditional logic more complex than a ternary

### Async initialization

A Redis connection needs `await client.connect()` before it is ready. You cannot do async work in a constructor or with `useValue` (the value is already built). `useFactory` makes this natural:

```ts
// cache/cache.module.ts
export const REDIS_CLIENT = Symbol("REDIS_CLIENT");

@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: async () => {
        const client = createClient({ url: process.env.REDIS_URL });
        await client.connect();
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class CacheModule {}
```

NestJS awaits the factory promise before resolving any dependent provider. The application will not start until `client.connect()` settles.

### Factory with injected dependencies

The `inject` array lists tokens whose resolved values are passed as arguments to the factory, in order:

```ts
// mailer/mailer.module.ts
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: MAILER_SERVICE,
      useFactory: async (config: AppConfig) => {
        // Return a no-op mailer outside production to avoid real sends
        if (config.environment !== "production") {
          return new NoopMailerService();
        }
        return new ResendMailerService(config.apiKey);
      },
      inject: [APP_CONFIG], // resolved and passed as the first argument
    },
  ],
  exports: [MAILER_SERVICE],
})
export class MailerModule {}
```

The `inject` array and factory arguments must be in the same order — NestJS passes resolved values positionally. If you need more than three or four dependencies, consider a dedicated factory class (the same pattern used in `@nestjs/typeorm`'s `forRootAsync`).

### When to choose useFactory over useClass

If initialization fits neatly in a class constructor — even with async work done via `onModuleInit` — `useClass` is simpler. Reserve `useFactory` for cases where:

- the SDK you are wrapping returns a plain object, not a class instance (`createClient()`, `new Pool()`)
- the provider needs to make a runtime decision between multiple implementations
- initialization is inherently async and sequential

---

## useExisting: aliasing tokens 🔗

`useExisting` maps one token to another that is already registered. The container resolves the alias to the original — both tokens point to the same singleton instance. Reach for it when:

- you want to expose the same service under a generic token and a specific one
- you are doing a backward-compatible token rename in a library
- two different consumers should see the same provider under two different names

### A payment gateway with an alias

`StripeGateway` is the concrete implementation. We want two tokens:

- `StripeGateway` — for any code that is explicitly Stripe-aware
- `PAYMENT_GATEWAY` — for code that only cares about the generic interface

```ts
// payment/payment.module.ts
@Module({
  providers: [
    // The real instance — registered once under its class token
    StripeGateway,

    // Alias: PAYMENT_GATEWAY resolves to the same StripeGateway singleton
    {
      provide: PAYMENT_GATEWAY,
      useExisting: StripeGateway,
    },
  ],
  exports: [PAYMENT_GATEWAY],
})
export class PaymentModule {}
```

```ts
@Injectable()
export class CheckoutService {
  constructor(
    // Does not know it's Stripe — only the interface matters here
    @InjectPaymentGateway() private readonly gateway: PaymentGateway,
  ) {}

  async charge(amount: number, currency: string, source: string) {
    return this.gateway.charge({ amount, currency, source });
  }
}
```

Swapping from Stripe to Adyen later only requires touching `PaymentModule`. Every consumer stays the same.

### `useExisting` vs `useClass`: the critical difference

```ts
// Wrong — creates a SECOND StripeGateway instance
{ provide: PAYMENT_GATEWAY, useClass: StripeGateway }

// Correct — aliases to the EXISTING StripeGateway instance
{ provide: PAYMENT_GATEWAY, useExisting: StripeGateway }
```

`useClass` always instantiates. `useExisting` always reuses. Using `useClass` here would create two separate Stripe clients — a subtle bug that is hard to spot in module definitions.

---

## Multi-provider arrays: the plugin system pattern 🔌

The most powerful and least-documented pattern combines `useFactory` with an `inject` array to build a _collection_ of providers under a single token. This is the exact mechanism NestJS uses internally for `APP_GUARD`, `APP_PIPE`, and `APP_INTERCEPTOR`.

### A pluggable notification system

Our system should send alerts across email, SMS, and Slack — without the core service knowing how many channels exist or what they are. New channels must be addable without modifying `NotificationService`.

The interface:

```ts
// notification/notifier.interface.ts
export interface Notifier {
  channel: string;
  send(message: string, recipient: string): Promise<void>;
}
```

The token that resolves to an array:

```ts
// notification/notification.constants.ts
export const NOTIFIERS = Symbol("NOTIFIERS");
```

Three independent implementations — each is a normal injectable class with its own dependencies:

```ts
@Injectable()
export class EmailNotifier implements Notifier {
  readonly channel = "email";

  constructor(@InjectMailer() private readonly mailer: MailerService) {}

  async send(message: string, recipient: string) {
    await this.mailer.send(recipient, "Notification", `<p>${message}</p>`);
  }
}

@Injectable()
export class SmsNotifier implements Notifier {
  readonly channel = "sms";

  async send(message: string, recipient: string) {
    // await twilio.messages.create(...)
  }
}

@Injectable()
export class SlackNotifier implements Notifier {
  readonly channel = "slack";

  async send(message: string, recipient: string) {
    // await slackClient.chat.postMessage(...)
  }
}
```

The module registers each notifier first (so NestJS can resolve their own dependencies), then collects them into an array via a factory:

```ts
// notification/notification.module.ts
@Module({
  imports: [MailerModule],
  providers: [
    EmailNotifier,
    SmsNotifier,
    SlackNotifier,
    {
      provide: NOTIFIERS,
      useFactory: (
        email: EmailNotifier,
        sms: SmsNotifier,
        slack: SlackNotifier,
      ) => [email, sms, slack],
      inject: [EmailNotifier, SmsNotifier, SlackNotifier],
    },
    NotificationService,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
```

`NotificationService` injects the array and fans out:

```ts
@Injectable()
export class NotificationService {
  constructor(@InjectNotifiers() private readonly notifiers: Notifier[]) {}

  async broadcast(message: string, recipient: string): Promise<void> {
    await Promise.all(this.notifiers.map((n) => n.send(message, recipient)));
  }

  async sendVia(
    channel: string,
    message: string,
    recipient: string,
  ): Promise<void> {
    const notifier = this.notifiers.find((n) => n.channel === channel);
    if (!notifier) throw new Error(`No notifier for channel "${channel}"`);
    await notifier.send(message, recipient);
  }
}
```

Adding a `PushNotifier` next sprint is purely additive: create the class, add it to the `inject` array and the returned array. No existing file changes.

### Why use a factory instead of `multi: true`?

NestJS does support `multi: true`:

```ts
{ provide: NOTIFIERS, useClass: EmailNotifier, multi: true }
{ provide: NOTIFIERS, useClass: SmsNotifier, multi: true }
```

But this approach falls apart when each notifier has its own constructor dependencies — NestJS instantiates each class separately, and you lose the ability to inject other providers into them easily. The factory approach is explicit: each notifier receives its own DI-resolved dependencies, and the composition into an array happens in one visible place.

---

## Putting it all together 🧩

Here is how the checkout `AppModule` ties every provider shape together:

```ts
// app.module.ts
@Module({
  imports: [
    ConfigModule, // useValue      — typed AppConfig object from process.env
    StorageModule, // useClass      — S3StorageService in prod, LocalStorageService elsewhere
    MailerModule, // useFactory    — async; reads AppConfig, picks implementation
    PaymentModule, // useExisting   — PAYMENT_GATEWAY aliases StripeGateway singleton
    NotificationModule, // useFactory    — NOTIFIERS collects [email, sms, slack]
    CheckoutModule,
  ],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({ transform: true, whitelist: true }),
    },
  ],
})
export class AppModule {}
```

Each module encapsulates its provider decision. `AppModule` composes them without knowing which class is behind each token. The checkout flow that uses all four shapes:

```ts
// checkout/checkout.service.ts
@Injectable()
export class CheckoutService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig, // useValue
    @InjectPaymentGateway() private readonly gateway: PaymentGateway, // useExisting
    @InjectStorage() private readonly storage: StorageService, // useClass
    private readonly notifications: NotificationService, // useFactory array
  ) {}

  async checkout(
    amount: number,
    currency: string,
    source: string,
    customerEmail: string,
  ) {
    const orderId = `ord_${Date.now()}`;
    const charge = await this.gateway.charge({ amount, currency, source });

    const receipt = Buffer.from(
      JSON.stringify({ orderId, chargeId: charge.id }),
    );
    const receiptUrl = await this.storage.upload(
      `${orderId}-receipt.json`,
      receipt,
    );

    await this.notifications.broadcast(
      `Order ${orderId} placed — ${amount} ${currency.toUpperCase()}`,
      customerEmail,
    );

    return { orderId, chargeId: charge.id, receiptUrl, status: charge.status };
  }
}
```

`CheckoutService` does not reference `StripeGateway`, `S3StorageService`, `EmailNotifier`, or `ResendMailerService`. It codes against contracts. The implementations are module-level decisions, hidden behind tokens.

---

## Quick reference 📋

**Provider shapes:**

| Shape         | Use when…                                                               |
| ------------- | ----------------------------------------------------------------------- |
| `useValue`    | Pre-built value, SDK instances, `APP_PIPE`/`APP_GUARD`, config objects  |
| `useClass`    | Environment-aware implementation swap, strategy pattern at module level |
| `useFactory`  | Async init, depends on other providers, returns a plain object          |
| `useExisting` | Aliasing — same instance, two names; backward-compat renames            |

**Injection tokens:**

| Token type            | When to use                                           |
| --------------------- | ----------------------------------------------------- |
| `string`              | Almost never — no type safety, global namespace       |
| `Symbol`              | Feature module tokens, no cross-module collision      |
| `InjectionToken<T>`   | When you want typed autocomplete at injection sites   |
| Custom `@InjectXxx()` | When the token is used in more than one or two places |

---

## What's next 🚀

Custom providers are the foundation of every advanced NestJS pattern. Once you have a solid grip on them, the next logical step is [dynamic modules](https://nestjs-ninja.com/blog/2026-07-16-building-and-publishing-a-nestjs-library/) — how libraries like `@nestjs/typeorm` use `forRoot` and `forFeature` to produce different module configurations at call time.

Both skills compose: a dynamic module is a function that returns a module descriptor filled with custom providers.
