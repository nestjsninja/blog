---
title: "Creating a Node.js Project Without Frameworks in 2023"
excerpt: "A Fastify, Prisma, Zod, and Vitest backend built without a full framework to revisit the fundamentals behind modern Node.js APIs."
coverImage: "/nestjs-ninja.png"
date: "2023-10-21T12:00:00.000Z"
author:
  name: "Henrique Weiand"
  picture: "/nestjs-ninja.png"
ogImage:
  url: "/nestjs-ninja.png"
tags:
  - Node.js
  - Fastify
  - Prisma
  - Testing
---

Frameworks are useful, but it is worth occasionally revisiting what they abstract away. This post is based on my original Medium article, [Creating a NodeJS project without frameworks in 2023](https://medium.com/p/144e97a03776).

The project builds a small backend API with Fastify, Prisma, Zod, JWT auth, Vitest, and GitHub Actions.

## The stack

The project uses:

- Fastify for HTTP
- Prisma for database access
- Zod for environment and payload validation
- bcrypt for password hashing
- JWT for sessions
- Vitest for unit and e2e tests
- Supertest for HTTP assertions

It is not framework-free in the sense of zero libraries. It is framework-light: the structure is assembled manually.

## App setup

The Fastify app registers routes, configures JWT, and defines a centralized error handler. Zod handles validation errors with a clean response.

Environment variables are parsed through a Zod schema so invalid configuration fails early.

## Use cases and repositories

The project still uses useful architecture ideas:

- controllers handle HTTP
- use cases hold business behavior
- repositories isolate database access
- factories wire concrete dependencies

That mirrors patterns you might use inside NestJS, but without the NestJS module system.

## Testing

Unit tests use in-memory repositories. E2E tests run through Fastify and Prisma. GitHub Actions runs both pipelines so the project keeps feedback in CI.

## Takeaways

Building without a full framework is a good reminder of what frameworks provide: dependency injection, module structure, lifecycle hooks, and convention. After writing the wiring manually, it is easier to appreciate why NestJS exists.
