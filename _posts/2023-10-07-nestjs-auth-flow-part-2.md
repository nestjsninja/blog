---
title: "Authentication Part 2 with NestJS"
excerpt: "Create the first auth and users modules, wire JWT sign-in and sign-up behavior, and protect a profile route with a NestJS guard."
coverImage: "/nestjs-ninja.png"
date: "2023-10-07T12:00:00.000Z"
author:
  name: "Henrique Weiand"
  picture: "/nestjs-ninja.png"
ogImage:
  url: "/nestjs-ninja.png"
tags:
  - NestJS
  - Authentication
  - JWT
  - Guards
---

This post continues the fast NestJS authentication flow. It is based on my original Medium article, [Authentication part 2 using NestJS](https://medium.com/p/4985fc05ffbc).

The goal is to create the basic auth and users modules before adding a real database in the next step.

## Modules

Start with two modules:

- `AuthModule`
- `UsersModule`

The users module owns basic user lookup and creation behavior. The auth module owns sign-in, sign-up, JWT generation, and route protection.

## Auth service

The auth service depends on the users service and the NestJS JWT service.

For sign-in, it validates credentials, builds a payload, and returns an access token.

For sign-up, it delegates user creation and removes sensitive fields from the response.

## Auth guard

The protected profile route uses a guard to validate the incoming JWT. The guard extracts the token, verifies it, and attaches the user payload to the request.

That gives the controller access to authenticated user data.

## Controller

The controller exposes a small API:

- sign up
- sign in
- profile

At this stage, the project keeps persistence simple. The next step is adding Postgres and TypeORM so users survive application restarts.

## Takeaways

This part creates the shape of the auth flow: modules, services, JWTs, and guards. It is intentionally small so the structure is clear before adding database complexity.
