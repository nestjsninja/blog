---
title: "Error Tracking in NestJS with Sentry"
excerpt: "How to add Sentry to a NestJS project with an exception filter so production errors are visible before users report them."
coverImage: "/nestjs-ninja.png"
date: "2023-11-17T12:00:00.000Z"
author:
  name: "Henrique Weiand"
  picture: "/nestjs-ninja.png"
ogImage:
  url: "/nestjs-ninja.png"
tags:
  - NestJS
  - Sentry
  - Observability
  - Errors
---

Production errors are easier to fix when you can see them quickly and with context. This post is based on my original Medium article, [Mastering Error Tracking: A Beginner's Guide to Sentry in Your NestJS Project](https://medium.com/p/31299b961e40).

The goal is to wire Sentry into NestJS so unhandled exceptions are captured and reported.

## Why error tracking matters

Without an error tracker, teams often learn about bugs from users, logs, or support tickets. That is late feedback.

Tools like Sentry help answer:

- what error happened?
- how often is it happening?
- when did it start?
- which route or user context is involved?
- which stack trace caused it?

## Install Sentry

Create a Sentry project, copy the DSN, then install the Node packages:

```bash
npm install --save @sentry/node @sentry/profiling-node
```

The DSN should be configured through environment variables, not hard-coded.

## Capture exceptions

NestJS exception filters are a good integration point. A filter can receive the error, send it to Sentry, and then delegate normal HTTP response behavior back to Nest.

That gives centralized capture without putting `Sentry.captureException` in every controller or service.

## Testing the integration

Force a test error from a route or service, call the endpoint locally, and confirm the issue appears in Sentry.

After that, remove the forced error and keep the integration as part of the application infrastructure.

## Takeaways

Error tracking should be added early. It is a small setup cost, and it gives production systems a much clearer feedback loop when something breaks.
