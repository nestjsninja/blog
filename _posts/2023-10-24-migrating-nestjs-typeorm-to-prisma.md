---
title: "Migrating a NestJS Project from TypeORM to Prisma"
excerpt: "How to replace TypeORM with Prisma in a small NestJS auth project while keeping the application behavior focused and testable."
coverImage: "/nestjs-ninja.png"
date: "2023-10-24T12:00:00.000Z"
author:
  name: "Henrique Weiand"
  picture: "/nestjs-ninja.png"
ogImage:
  url: "/nestjs-ninja.png"
tags:
  - NestJS
  - Prisma
  - TypeORM
  - Migration
---

Changing ORMs is a useful exercise because it shows where infrastructure details have leaked into the application. This post is based on my original Medium article, [Migrating NestJS project with TypeORM to Prisma](https://medium.com/p/eff0ac7e04ed).

The final example is available at [nestjsninja/nestjs-auth-flow-with-prisma](https://github.com/nestjsninja/nestjs-auth-flow-with-prisma).

## Starting point

The project begins from a previous NestJS auth flow that used TypeORM, Postgres, and a simple users table.

To migrate, install Prisma:

```bash
npm i @prisma/client
npm i prisma -D
npx prisma init
```

Prisma creates a schema file and environment configuration for the database URL.

## Model the user

The TypeORM entity becomes a Prisma model. Instead of decorators in a class, Prisma uses schema definitions and generates a client.

After updating the schema, run a migration and generate the client.

## Replace repository access

Services that previously used `@InjectRepository` and TypeORM repositories now use Prisma Client.

The important part is not only changing method calls. It is keeping the auth behavior stable:

- create users
- hash passwords
- validate credentials
- issue JWTs
- hide passwords from responses

## What migration reveals

If ORM calls are scattered everywhere, migration becomes painful. If persistence is isolated behind services or repositories, the change is much smaller.

## Takeaways

Prisma and TypeORM both work with NestJS. The better question is how much the rest of the application knows about the ORM. Keep persistence details close to the infrastructure layer, and migrations become less risky.
