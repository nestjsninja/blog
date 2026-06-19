---
title: 'Building and Publishing a NestJS Library: Dynamic Modules, forRoot, and npm'
excerpt: >-
  Most devs spend their careers installing NestJS libraries. Today you learn how
  they are built. We reverse-engineer the patterns from @nestjs/typeorm and
  @nestjs/config — forRoot, forRootAsync, forFeature, custom decorators — then
  apply them to a real context-aware logger you can publish to npm.
date: '2026-07-16T12:00:00.000Z'
author:
  name: Henrique Weiand
  picture: /nestjs-ninja.png
tags:
  - NestJS
  - TypeScript
  - Libraries
  - npm
  - Software Development
coverImage: /blog-assets/building-and-publishing-a-nestjs-library/cover.png
ogImage:
  url: /blog-assets/building-and-publishing-a-nestjs-library/cover.png
---
Hello, dev!

Most developers who work with NestJS spend their time installing libraries: `@nestjs/typeorm`, `@nestjs/config`, `@nestjs/jwt`. They know how to call `TypeOrmModule.forRoot()`. Today we flip it: you learn what happens on the inside, and you build one yourself.

We will reverse-engineer the exact patterns that official NestJS libraries use — the dynamic module, `forRoot`, `forRootAsync`, `forFeature`, and the custom `@Inject` decorator — then apply them to a context-aware logger you can publish to npm.

> Most devs install NestJS libraries. Today you build one.

💻 The full, runnable example is on GitHub: [nestjsninja/nestjs-library-example](https://github.com/nestjsninja/nestjs-library-example).

## What a NestJS library looks like from the outside 📦

Before we build anything, let's nail down what we are building *toward*. A well-designed NestJS library is consumed like this:

```ts
// AppModule — global registration, once for the whole app
@Module({
  imports: [
    LoggerModule.forRoot({
      level: 'debug',
      prefix: 'MyApp',
      timestamp: true,
    }),
  ],
})
export class AppModule {}

// PaymentsModule — scoped instance for just this module
@Module({
  imports: [LoggerModule.forFeature('PaymentsService')],
  providers: [PaymentsService],
})
export class PaymentsModule {}

// PaymentsService — inject the scoped logger with a decorator
@Injectable()
export class PaymentsService {
  constructor(
    @InjectLogger('PaymentsService')
    private readonly logger: LoggerService,
  ) {}
}
```

Three import patterns (`forRoot`, `forFeature`, constructor injection with a custom decorator), all familiar from `@nestjs/typeorm` and `@nestjs/config`. Our job is to implement each one.

## Static vs dynamic modules 🧱

A regular NestJS module is **static** — every consumer gets the exact same module:

```ts
@Module({ providers: [LoggerService], exports: [LoggerService] })
export class LoggerModule {}
```

A **dynamic** module returns a `DynamicModule` object from a static factory method. The object looks like a regular module descriptor (`module`, `providers`, `imports`, `exports`) but is constructed at runtime with the caller's options:

```ts
@Module({})
export class LoggerModule {
  static forRoot(options: LoggerModuleOptions): DynamicModule {
    return {
      module: LoggerModule,   // required — points to this class
      global: true,           // makes the module available app-wide
      providers: [/* ... */],
      exports: [/* ... */],
    };
  }
}
```

The `@Module({})` decorator on the class stays empty — all the real registration happens inside the factory methods.

## The five files every library needs 🗂️

Looking at official libraries like `@nestjs/typeorm`, you consistently find the same five concerns:

```
lib/
├── logger.interfaces.ts   # options types, async options, factory interface
├── logger.constants.ts    # injection tokens, token generators
├── logger.service.ts      # the actual service consumers will use
├── logger.module.ts       # the dynamic module (forRoot / forRootAsync / forFeature)
├── logger.decorators.ts   # @InjectLogger() helper
└── index.ts               # public API barrel
```

Let's build each one.

## Interfaces 📐

The options type is what the consumer passes to `forRoot`. The async options type drives `forRootAsync`. The factory interface supports the `useClass` pattern.

```ts
// lib/logger.interfaces.ts
import { ModuleMetadata, Type } from '@nestjs/common';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerModuleOptions {
  level?: LogLevel;
  prefix?: string;
  timestamp?: boolean;
}

export interface LoggerOptionsFactory {
  createLoggerOptions(): Promise<LoggerModuleOptions> | LoggerModuleOptions;
}

export interface LoggerModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  useFactory?: (
    ...args: any[]
  ) => Promise<LoggerModuleOptions> | LoggerModuleOptions;
  inject?: any[];
  useClass?: Type<LoggerOptionsFactory>;
  useExisting?: Type<LoggerOptionsFactory>;
}
```

`LoggerModuleAsyncOptions` mirrors `TypeOrmModuleAsyncOptions` exactly — three flavours, same interface shape. The `extends Pick<ModuleMetadata, 'imports'>` line lets consumers pass their own imports (like `ConfigModule`) alongside the factory.

## Injection tokens 🔑

Interfaces disappear at runtime — TypeScript compiles them away. So we cannot inject `LoggerModuleOptions` by type. We need a string (or `Symbol`) token:

```ts
// lib/logger.constants.ts
export const LOGGER_OPTIONS = 'LOGGER_OPTIONS';
export const LOGGER_CONTEXT = 'LOGGER_CONTEXT';

export const getLoggerToken = (context: string) =>
  `LoggerService_${context}`;
```

`getLoggerToken` is the same pattern as `@nestjs/typeorm`'s `getRepositoryToken(Entity)` — it generates a unique token per context so multiple `forFeature` calls in different modules get their own scoped instances without clashing.

> Name tokens by what they identify, not where they came from. `LOGGER_OPTIONS` is clearer than `NEST_LOGGER_CONFIG_42`.

## The service 🛠️

```ts
// lib/logger.service.ts
import { Inject, Injectable, Optional } from '@nestjs/common';
import { LOGGER_CONTEXT, LOGGER_OPTIONS } from './logger.constants';
import { LoggerModuleOptions, LogLevel } from './logger.interfaces';

const LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];

@Injectable()
export class LoggerService {
  constructor(
    @Inject(LOGGER_OPTIONS)
    private readonly options: LoggerModuleOptions,
    @Optional()
    @Inject(LOGGER_CONTEXT)
    private readonly context?: string,
  ) {}

  debug(message: string): void { this.write('debug', message); }
  log(message: string): void   { this.write('info',  message); }
  warn(message: string): void  { this.write('warn',  message); }
  error(message: string): void { this.write('error', message); }

  private write(level: LogLevel, message: string): void {
    if (!this.shouldLog(level)) return;

    const parts: string[] = [];
    if (this.options.timestamp) parts.push(new Date().toISOString());
    if (this.options.prefix)    parts.push(`[${this.options.prefix}]`);
    if (this.context)           parts.push(`[${this.context}]`);
    parts.push(`[${level.toUpperCase()}]`);
    parts.push(message);

    console.log(parts.join(' '));
  }

  private shouldLog(level: LogLevel): boolean {
    const min = this.options.level ?? 'debug';
    return LEVELS.indexOf(level) >= LEVELS.indexOf(min);
  }
}
```

Two constructor parameters: `LOGGER_OPTIONS` (always required, provided by `forRoot`) and `LOGGER_CONTEXT` (optional via `@Optional()`, provided by `forFeature`). When NestJS creates the service through `forRoot`, the context is not in the container, so it defaults to `undefined` — no error because of `@Optional()`.

## The module: forRoot 🟢

```ts
// lib/logger.module.ts
import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { LOGGER_OPTIONS } from './logger.constants';
import { LoggerModuleAsyncOptions, LoggerOptionsFactory,
         LoggerModuleOptions } from './logger.interfaces';
import { LoggerService } from './logger.service';
import { getLoggerToken } from './logger.constants';

@Module({})
export class LoggerModule {
  static forRoot(options: LoggerModuleOptions): DynamicModule {
    return {
      module: LoggerModule,
      global: true,
      providers: [
        { provide: LOGGER_OPTIONS, useValue: options },
        LoggerService,
      ],
      exports: [LoggerService],
    };
  }
```

`global: true` mirrors what `@nestjs/config` does — the `LoggerService` becomes available in every module without re-importing `LoggerModule`. If you want consumers to explicitly import the module in each feature, leave `global` out or set it to `false`.

## The module: forRootAsync 🔵

Async registration is the one that trips most people up. The consumer wants to drive configuration from another injectable (typically `ConfigService`):

```ts
LoggerModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (config: ConfigService) => ({
    level: config.get('LOG_LEVEL', 'info'),
    prefix: config.get('APP_NAME'),
    timestamp: true,
  }),
  inject: [ConfigService],
})
```

For that to work, `LOGGER_OPTIONS` cannot be a static value — it must be a factory provider that NestJS resolves after its `inject` dependencies are ready:

```ts
  static forRootAsync(asyncOptions: LoggerModuleAsyncOptions): DynamicModule {
    return {
      module: LoggerModule,
      global: true,
      imports: asyncOptions.imports ?? [],
      providers: [
        ...LoggerModule.createAsyncProviders(asyncOptions),
        LoggerService,
      ],
      exports: [LoggerService],
    };
  }

  private static createAsyncProviders(
    options: LoggerModuleAsyncOptions,
  ): Provider[] {
    // useFactory — the most common case
    if (options.useFactory) {
      return [
        {
          provide: LOGGER_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
      ];
    }

    // useClass or useExisting — delegate to a factory class
    const factory = (options.useClass ?? options.useExisting) as Type<LoggerOptionsFactory>;

    const providers: Provider[] = [
      {
        provide: LOGGER_OPTIONS,
        useFactory: async (f: LoggerOptionsFactory) =>
          f.createLoggerOptions(),
        inject: [factory],
      },
    ];

    // useClass needs its own provider; useExisting points to an already-provided one
    if (options.useClass) {
      providers.push({ provide: factory, useClass: factory });
    }

    return providers;
  }
```

The `createAsyncProviders` helper is the same structure you find in `TypeOrmCoreModule`. The key insight: **`useClass` needs two providers** — one that provides the factory class itself, and one that calls it to produce `LOGGER_OPTIONS`. `useExisting` skips the first one because the class is already in the container.

> `useFactory` is the most common async pattern. `useClass`/`useExisting` exist for when the options logic is complex enough to deserve its own injectable class.

## The module: forFeature 🟡

`forFeature` creates a new, scoped `LoggerService` instance for a specific context. The trick: use `useFactory` to instantiate it directly with the context baked in, and give it a unique token so multiple feature modules do not step on each other.

```ts
  static forFeature(context: string): DynamicModule {
    const token = getLoggerToken(context);

    return {
      module: LoggerModule,
      providers: [
        {
          provide: token,
          useFactory: (options: LoggerModuleOptions) =>
            new LoggerService(options, context),
          inject: [LOGGER_OPTIONS],
        },
      ],
      exports: [token],
    };
  }
}
```

`LOGGER_OPTIONS` is available here because `forRoot` (or `forRootAsync`) was called first with `global: true` — the same mechanism that makes `@nestjs/typeorm`'s `forFeature([Entity])` work after `forRoot()` was called in `AppModule`.

The `new LoggerService(options, context)` bypasses NestJS DI on purpose — we are passing the context directly to the constructor instead of going through the token system. This is the same technique `@nestjs/typeorm` uses when building entity repository providers.

> `forFeature` is for scoped instances. It depends on `forRoot` having been called first — document that.

## The custom decorator 🎨

`@InjectLogger('PaymentsService')` is just a thin wrapper around `Inject(getLoggerToken('PaymentsService'))`. The exact same pattern as `@InjectRepository(Entity)` in `@nestjs/typeorm`:

```ts
// lib/logger.decorators.ts
import { Inject } from '@nestjs/common';
import { getLoggerToken } from './logger.constants';
import { LoggerService } from './logger.service';

export const InjectLogger = (context?: string): ParameterDecorator =>
  Inject(context ? getLoggerToken(context) : LoggerService);
```

Without a context, `@InjectLogger()` resolves the global `LoggerService`. With a context, it resolves the scoped instance created by `forFeature`.

## The public API barrel 📋

Only export what consumers need. Everything else is an internal implementation detail.

```ts
// lib/index.ts
export { LoggerModule } from './logger.module';
export { LoggerService } from './logger.service';
export { InjectLogger } from './logger.decorators';
export { getLoggerToken } from './logger.constants';
export type {
  LogLevel,
  LoggerModuleOptions,
  LoggerModuleAsyncOptions,
  LoggerOptionsFactory,
} from './logger.interfaces';
```

`LOGGER_OPTIONS`, `LOGGER_CONTEXT`, and the internal helpers stay hidden. Consumers import only from this barrel — they should never need to reach into specific implementation files.

## Package.json for publishing 📤

This is where most library tutorials fall short. The `package.json` fields that matter for publishing:

```json
{
  "name": "@yourscope/context-logger",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "require": "./dist/index.js",
      "types":   "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build:lib": "tsc -p tsconfig.lib.json",
    "prepublishOnly": "npm run build:lib"
  },
  "peerDependencies": {
    "@nestjs/common": "^10.0.0 || ^11.0.0",
    "@nestjs/core":   "^10.0.0 || ^11.0.0",
    "reflect-metadata": "^0.1.13 || ^0.2.0",
    "rxjs": "^7.0.0"
  }
}
```

- **`peerDependencies`** — not `dependencies`. NestJS and rxjs must come from the consumer's own `node_modules`, not yours. Otherwise you end up with two copies of the DI container and nothing works.
- **`files: ["dist"]`** — only the compiled output goes to npm. Source files, tests, and `tsconfig.lib.json` stay out.
- **`prepublishOnly`** — runs the build automatically before `npm publish`. You can never accidentally publish stale compiled output.
- **`exports`** — required for modern Node.js module resolution. Match the `main` + `types` fields.

A separate `tsconfig.lib.json` builds only the library source, with declaration files included:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": false
  },
  "include": ["lib/**/*"],
  "exclude": ["lib/_test/**/*", "src/**/*", "node_modules/**/*"]
}
```

It excludes `src/` (the demo app) and `lib/_test/` so no test code ends up in the published package.

## Publishing

```bash
# Log in once
npm login

# Build and publish
npm publish --access public   # required for scoped packages on a free npm account
```

That is it. `prepublishOnly` runs `tsc -p tsconfig.lib.json` before the publish, so `dist/` is always fresh.

For versioning, follow semver: patch for bug fixes (`1.0.1`), minor for new features (`1.1.0`), major for breaking changes (`2.0.0`). Use `npm version patch/minor/major` to bump and tag in one command.

## Lessons from @nestjs/config 📖

The patterns above are the baseline. `@nestjs/config` pushes them further in three ways that are worth understanding before you publish your own library.

### 1. Attaching a token to a factory with `registerAs`

In `@nestjs/config`, `forFeature` does not take a string context. It takes a **factory function** that already knows its own token — attached via `Object.defineProperty`:

```ts
// How @nestjs/config's registerAs works
export function registerAs(namespace: string, configFactory: () => Record<string, any>) {
  // attach the token as a hidden, non-enumerable property on the function itself
  Object.defineProperty(configFactory, PARTIAL_CONFIGURATION_KEY, {
    configurable: false,
    enumerable:   false,
    value:        namespace,
    writable:     false,
  });
  Object.defineProperty(configFactory, PARTIAL_CONFIGURATION_PROPNAME, {
    configurable: false,
    enumerable:   false,
    value:        `CONFIGURATION(${namespace})`,
    writable:     false,
  });
  return configFactory;
}
```

Then consumers declare a namespaced config like this:

```ts
// configs/database.config.ts
export const databaseConfig = registerAs('database', () => ({
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
}));

// AppModule
ConfigModule.forRoot({ load: [databaseConfig] });

// DatabaseModule
ConfigModule.forFeature(databaseConfig);

// Service — inject the namespace slice directly
constructor(
  @Inject(databaseConfig.KEY) private readonly dbConfig: ReturnType<typeof databaseConfig>
) {}
```

The key insight: **the token travels with the factory**. `forFeature` reads the token off the function via `configFactory[PARTIAL_CONFIGURATION_KEY]` instead of asking the caller to pass it separately. This removes the risk of token typos across files.

You can apply the same idea to your own library. Instead of:

```ts
// Fragile — caller must spell the string correctly in two places
LoggerModule.forFeature('PaymentsService')
@InjectLogger('PaymentsService')
```

You could expose a factory builder:

```ts
// safe — the token is derived once from the factory object
export const paymentsLogger = createLoggerContext('PaymentsService');

LoggerModule.forFeature(paymentsLogger)
@InjectLogger(paymentsLogger)
```

### 2. Merging partial config at load time

`@nestjs/config`'s `forFeature` does not create a new isolated instance — it registers a **loader** that merges its slice into a shared configuration host. Each `forFeature` call adds its namespace to the same `CONFIGURATION_TOKEN` object that `ConfigService.get()` reads from.

This is why you can call `configService.get('database.host')` even if `databaseConfig` was loaded in a different feature module. The merge happens during module initialization, before any service consumes the data.

The pattern for our logger would be different — we genuinely want separate instances per context, not a merge. So our `forFeature` using `getLoggerToken(context)` is the right model here.

### 3. Type-safe `get()` with conditional generics

`ConfigService` uses two generic parameters to make `get()` type-aware:

```ts
export class ConfigService<
  K = Record<string | symbol, unknown>,
  WasValidated extends boolean = false
> {
  get<T = any>(
    propertyPath: KeyOf<K>,
    defaultValue?: T,
  ): WasValidated extends true ? T : T | undefined;
}
```

`WasValidated` is set to `true` when the consumer calls `ConfigModule.forRoot({ validate: mySchema })`. That makes `configService.get('key')` return `T` (not `T | undefined`) because validated config is guaranteed to have every key present.

You can use the same conditional generic pattern when your library's `get()` or equivalent method has different return guarantees depending on whether the consumer configured validation:

```ts
export class LoggerService<Validated extends boolean = false> {
  log(message: string): void { ... }

  // If the library validated the log level, it is guaranteed to be set
  getLevel(): Validated extends true ? LogLevel : LogLevel | undefined {
    return this.options.level as any;
  }
}
```

This is advanced TypeScript, but it is what makes `@nestjs/config` feel tight to use — the return types narrow automatically based on what you told the module at registration time.

## The two-module pattern (how real libraries do it) 🏗️

If you look at the actual `@nestjs/typeorm` source, `TypeOrmModule.forRoot()` does not register providers directly. It delegates to an internal `TypeOrmCoreModule`:

```ts
// What TypeOrmModule.forRoot actually does
static forRoot(options): DynamicModule {
  return {
    module: TypeOrmModule,
    imports: [TypeOrmCoreModule.forRoot(options)],   // ← delegate
    exports: [TypeOrmCoreModule],
  };
}
```

`TypeOrmCoreModule` is the module that sets `global: true` and registers the `DataSource` token. `TypeOrmModule` is just the public facade.

This split matters for `forFeature`: when both `forRoot` and `forFeature` return `{ module: LoggerModule }`, NestJS merges them into one module. If `forFeature`'s factory injects `LOGGER_OPTIONS`, it needs that token to be visible. The two-module pattern guarantees it: `LoggerCoreModule` is global and exports `LOGGER_OPTIONS`, so `LoggerModule.forFeature()` can always resolve it, whether it is used in a feature module during an actual app run or in `Test.createTestingModule`.

The example project ([nestjsninja/nestjs-library-example](https://github.com/nestjsninja/nestjs-library-example)) uses this pattern exactly — `LoggerCoreModule` is internal (not exported from the barrel), and `LoggerModule` is the facade. If you are building a library for others to publish and use, this is the right structure.

## `ConfigurableModuleBuilder` — the modern shortcut ⚡

NestJS 9.1 introduced `ConfigurableModuleBuilder` to eliminate the `forRoot`/`forRootAsync` boilerplate. Instead of writing both static methods and the `createAsyncProviders` helper by hand, the builder generates them:

```ts
// lib/logger.module-builder.ts
import { ConfigurableModuleBuilder } from '@nestjs/common';
import { LoggerModuleOptions } from './logger.interfaces';

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  ASYNC_OPTIONS_TYPE,
  OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<LoggerModuleOptions>()
  .setClassMethodName('forRoot')
  .setExtras({ isGlobal: false }, (definition, extras) => ({
    ...definition,
    global: extras.isGlobal,
  }))
  .build();
```

```ts
// lib/logger.module.ts — forRoot and forRootAsync are auto-generated
@Module({})
export class LoggerModule extends ConfigurableModuleClass {
  // You only need to add forFeature manually
  static forFeature(context: string): DynamicModule { ... }
}
```

And in your service, swap the manual token for the generated one:

```ts
@Injectable()
export class LoggerService {
  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: LoggerModuleOptions,
  ) {}
}
```

Consumers call it the same way:

```ts
LoggerModule.forRoot({ level: 'debug', isGlobal: true })

LoggerModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (c: ConfigService) => ({ level: c.get('LOG_LEVEL') }),
  inject: [ConfigService],
})
```

`setExtras` is how you add custom properties (like `isGlobal`) that are not in your options type but control module behaviour.

**When to use `ConfigurableModuleBuilder` vs writing it by hand:**

| | Hand-written | `ConfigurableModuleBuilder` |
|---|---|---|
| `forRoot` + `forRootAsync` | You write both | Auto-generated |
| `forFeature` | You write it | You still write it |
| `useClass` / `useExisting` | You write both provider shapes | Auto-handled |
| Two-module pattern | You decide | You still decide |
| Learning value | High | Hides the details |

If you are building a library for your org and you already understand the underlying patterns, `ConfigurableModuleBuilder` saves time. If you are learning, write it by hand once — then the builder is just a shortcut, not a black box.

## Testing dynamic modules 🧪

Testing a library has two layers: unit tests for the service, and integration tests for the dynamic module registration.

**Service (no NestJS needed):**

```ts
it('suppresses messages below the configured level', () => {
  const spy = jest.spyOn(console, 'log').mockImplementation();
  const service = new LoggerService({ level: 'warn' });

  service.debug('should be suppressed');
  service.log('should be suppressed');

  expect(spy).not.toHaveBeenCalled();
  spy.mockRestore();
});

it('includes the context in the output when provided', () => {
  const spy = jest.spyOn(console, 'log').mockImplementation();
  const service = new LoggerService({ level: 'debug' }, 'PaymentsService');

  service.log('payment ok');

  expect(spy).toHaveBeenCalledWith(expect.stringContaining('[PaymentsService]'));
  spy.mockRestore();
});
```

**Dynamic module (uses `@nestjs/testing`):**

```ts
it('forRoot provides LoggerService', async () => {
  const ref = await Test.createTestingModule({
    imports: [LoggerModule.forRoot({ level: 'warn' })],
  }).compile();

  expect(ref.get(LoggerService)).toBeDefined();
});

it('forRootAsync resolves options from useFactory', async () => {
  const ref = await Test.createTestingModule({
    imports: [
      LoggerModule.forRootAsync({
        useFactory: () => ({ level: 'debug', prefix: 'Test' }),
      }),
    ],
  }).compile();

  expect(ref.get(LoggerService)).toBeDefined();
});

// forFeature must be tested inside a real feature module — that is how it
// is used in production, and it ensures global token resolution works correctly.
it('forFeature provides a scoped instance under the context token', async () => {
  @Module({ imports: [LoggerModule.forFeature('PaymentsService')] })
  class PaymentsModule {}

  const ref = await Test.createTestingModule({
    imports: [LoggerModule.forRoot({ level: 'debug' }), PaymentsModule],
  }).compile();

  const scoped = ref.select(PaymentsModule).get(getLoggerToken('PaymentsService'));
  expect(scoped).toBeInstanceOf(LoggerService);
});
```

These tests prove the DI wiring is correct without starting an HTTP server. They are the most valuable tests for a library author.

## Final thoughts

The patterns from `@nestjs/typeorm` and `@nestjs/config` are not magic. They reduce to five concepts:

1. **`DynamicModule`** — a plain object with `module`, `providers`, `exports`, and `global`.
2. **`forRoot(options)`** — provide a value under a token; export the service.
3. **`forRootAsync(asyncOptions)`** — use a factory or class to produce that value asynchronously; support `useFactory`, `useClass`, and `useExisting`.
4. **`forFeature(context)`** — use `getToken(context)` to avoid token collisions between feature modules; `useFactory` to bake the context into the instance.
5. **Custom `@Inject` decorator** — wrap `Inject(getToken(context))` behind a readable name.

Once you know these five, every official NestJS library is readable. And building your own is straightforward.

> The official libraries are not clever — they are consistent. That consistency is what makes them trustworthy.

### Takeaways ✍️

- `@Module({})` stays empty on the class; all logic goes inside the static factory methods.
- `global: true` in `forRoot` means the module does not need to be imported in every feature module.
- Injection tokens are strings or Symbols — use `const TOKEN = 'TOKEN'` for options, and `getToken(key)` for per-feature instances.
- `forRootAsync` needs `createAsyncProviders()`: `useFactory` returns one provider; `useClass` returns two (the factory class itself plus the options provider).
- `useFactory` in `forFeature` lets you instantiate the service directly with the context baked in, without going through the token system.
- For published libraries, split into `LibraryCoreModule` (global, holds the tokens) and `LibraryModule` (public facade) — the same pattern `@nestjs/typeorm` uses.
- Test `forFeature` inside a real `@Module` class (not as a bare import in the test root) — this mirrors production use and ensures global token resolution works correctly.
- `ConfigurableModuleBuilder` (NestJS 9.1+) auto-generates `forRoot` and `forRootAsync` — worth using once you understand what it generates.
- `peerDependencies` (not `dependencies`) for NestJS packages — two copies of the container break DI.
- `files: ["dist"]` keeps tests and source out of the published package.
- `prepublishOnly` builds the library automatically before every `npm publish`.
- Test dynamic modules with `Test.createTestingModule` — it proves the DI wiring without an HTTP server.
