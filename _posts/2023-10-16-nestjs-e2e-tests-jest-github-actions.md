---
title: "E2E Tests in NestJS with Jest and GitHub Actions"
excerpt: "How to add end-to-end tests to a NestJS auth flow and run them in GitHub Actions with a reproducible test environment."
coverImage: "/nestjs-ninja.png"
date: "2023-10-16T12:00:00.000Z"
author:
  name: "Henrique Weiand"
  picture: "/nestjs-ninja.png"
ogImage:
  url: "/nestjs-ninja.png"
tags:
  - NestJS
  - Testing
  - Jest
  - GitHub Actions
---

End-to-end tests verify the application through real request paths. This post is based on my original Medium article, [Applying integration test on NestJS with Jest and GitHub Actions](https://medium.com/p/95e4c5221e7a).

The example uses the NestJS auth flow project and focuses on testing the exposed controller behavior.

## What e2e tests cover

Unlike unit tests, e2e tests start the NestJS application and call HTTP routes. They are useful for checking:

- request validation
- controller routing
- guards
- service integration
- authentication behavior
- response shape

They are slower than unit tests but protect the full request path.

## Test setup

NestJS provides `@nestjs/testing` for creating a testing module and initializing the app in memory. Supertest can then call the HTTP server.

The test flow is:

1. Create the testing module.
2. Compile it.
3. Initialize the Nest application.
4. Call endpoints with Supertest.
5. Assert status codes and response bodies.
6. Close the app after tests.

## GitHub Actions

Once the local e2e command works, CI can run it on pull requests. If the test requires Postgres, the workflow should define a database service or start one before executing the command.

That makes integration problems visible before merge.

## Takeaways

Unit tests and e2e tests serve different purposes. For an auth flow, e2e tests are valuable because they validate how controllers, guards, services, and modules behave together.
