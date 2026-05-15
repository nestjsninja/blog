---
title: "A Typed NestJS Configuration Module with Zod"
excerpt: "How to centralize environment variables in NestJS with @nestjs/config, Zod validation, inferred TypeScript types, and a small EnvService."
coverImage: "/nestjs-ninja.png"
date: "2023-10-10T12:00:00.000Z"
author:
  name: "Henrique Weiand"
  picture: "/nestjs-ninja.png"
ogImage:
  url: "/nestjs-ninja.png"
tags:
  - NestJS
  - Configuration
  - Zod
  - TypeScript
---

Every backend project needs configuration. Ports, database credentials, queue names, API keys, feature flags, and external service URLs usually arrive through environment variables.

NestJS already makes this easy with `@nestjs/config`, but a little structure can make the setup safer and more pleasant to use. This post is based on my original Medium article, [Creating a configuration module like a specialist with Zod inside NestJS](https://medium.com/p/c61430de896b).

The example project is available at [nestjsninja/nestjs-config-module](https://github.com/nestjsninja/nestjs-config-module).

## The goal

The configuration layer should do a few things well:

- centralize all environment variable definitions
- validate required values when the app starts
- provide defaults when appropriate
- expose typed access to configuration values
- keep the rest of the app from reading `process.env` directly

The combination of `@nestjs/config` and Zod works well for this.

## Create the project

Start with a regular NestJS project:

```bash
nest new nestjs-config-module
```

Then create a dedicated module for environment handling:

```bash
nest g module env
nest g service env
```

Install the dependencies:

```bash
yarn add zod @nestjs/config
```

The `EnvModule` becomes the place where the application exposes configuration access.

## Export the environment service

The module should export its service so other modules can inject it:

```ts
import { Module } from "@nestjs/common";
import { EnvService } from "./env.service";

@Module({
  providers: [EnvService],
  exports: [EnvService],
})
export class EnvModule {}
```

That keeps usage simple. Other providers can depend on `EnvService` without needing to know how validation or parsing works internally.

## Define the schema

Create an `env.ts` file for the schema:

```ts
import { z } from "zod";

export const envSchema = z.object({
  PORT: z.coerce.number().optional().default(3000),
});

export type Env = z.infer<typeof envSchema>;
```

This file is the source of truth for the app's configuration.

The `PORT` example shows a useful Zod pattern:

- read the value from the environment
- coerce it to a number
- make it optional
- default to `3000`

The `z.infer` call derives a TypeScript type from the schema, so runtime validation and compile-time types stay connected.

## Create a typed service

The `EnvService` wraps Nest's `ConfigService`:

```ts
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Env } from "./env";

@Injectable()
export class EnvService {
  constructor(private configService: ConfigService<Env, true>) {}

  get<T extends keyof Env>(key: T) {
    return this.configService.get(key, { infer: true });
  }
}
```

The important detail is the generic:

```ts
ConfigService<Env, true>
```

That gives the service knowledge of the validated environment shape. The `get` method only accepts keys that exist in `Env`, and `{ infer: true }` helps preserve the correct return type.

## Wire it in `AppModule`

The root module imports `ConfigModule.forRoot` and applies the Zod schema during application startup:

```ts
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EnvModule } from "./env/env.module";
import { envSchema } from "./env/env";

@Module({
  imports: [
    ConfigModule.forRoot({
      validate: (env) => envSchema.parse(env),
      isGlobal: true,
    }),
    EnvModule,
  ],
})
export class AppModule {}
```

The `validate` function is where Zod checks the environment. If required variables are missing or invalid, the app fails early instead of running with broken configuration.

Setting `isGlobal: true` makes `ConfigService` available across the application. The custom `EnvModule` still gives the rest of the codebase a cleaner and more specific API.

## Add `.env`

At the project root, create a `.env` file:

```env
PORT=3000
```

As the project grows, add every environment variable to the Zod schema instead of reading it directly from `process.env`.

## Using the service

Any provider can now inject `EnvService`:

```ts
@Injectable()
export class AppService {
  constructor(private readonly env: EnvService) {}

  getPort() {
    return this.env.get("PORT");
  }
}
```

The editor can autocomplete available keys, and TypeScript can infer the value type from the schema.

## Why this helps

This pattern improves configuration in a few practical ways:

- invalid environment values fail at startup
- defaults are documented in code
- configuration keys are discoverable
- TypeScript can help prevent typos
- `process.env` access stays centralized
- adding a new variable requires updating one schema

The result is still simple. There is no heavy abstraction, only a small module around a common project need.

## Final thoughts

Environment variables are easy to ignore until one of them is missing, misspelled, or parsed incorrectly in production.

A dedicated NestJS configuration module with Zod gives the application an early validation step and a typed API. That small investment makes the rest of the codebase cleaner and reduces runtime surprises.
