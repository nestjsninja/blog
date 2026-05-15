---
title: "NestJS Auth Flow with TypeORM, Postgres, and Neon"
excerpt: "The third auth-flow step: add Postgres with TypeORM, hash user passwords, run migrations, and prepare the database for Neon deployment."
coverImage: "/nestjs-ninja.png"
date: "2023-10-09T12:00:00.000Z"
author:
  name: "Henrique Weiand"
  picture: "/nestjs-ninja.png"
ogImage:
  url: "/nestjs-ninja.png"
tags:
  - NestJS
  - Authentication
  - TypeORM
  - Postgres
---

Authentication becomes more real once users are stored in a database. This post is based on my original Medium article, [Authentication part 3 using NestJS and Postgres database neon.tech](https://medium.com/p/39306a41b7a0).

It continues a simple NestJS auth flow by adding TypeORM, Postgres, password hashing, and database migrations.

## Local Postgres

The local database runs through Docker Compose. That gives the project a repeatable Postgres instance with known credentials and a known port.

Once Postgres is running, NestJS can connect through `TypeOrmModule`.

## User entity

The user table starts with:

- `id`
- `username`
- `password`

The password should never be stored as plain text. TypeORM's `BeforeInsert` hook can hash the password before saving the entity.

## User service

The user service uses a TypeORM repository to:

- find a user by username
- create a user
- reject duplicate usernames
- validate credentials
- compare hashed passwords

That gives the auth service a clean dependency.

## Auth service and controller

The auth service signs in users by validating credentials and issuing a JWT. It signs up users by creating the account and removing the password from the response.

The controller exposes:

- `POST /auth/signUp`
- `POST /auth/signIn`
- protected `GET /auth/profile`

## Neon

Neon can host the production Postgres database. The main difference is configuration: production database credentials should come from environment variables instead of local Docker values.

## Takeaways

This step turns the in-memory auth example into a database-backed flow. It is still simple, but it includes the core pieces: persistence, hashing, migrations, and deployment-ready configuration.
