---
title: Implementing an Auth Flow Fast with NestJS
excerpt: >-
  The first step in a NestJS auth-flow series: project setup, CLI usage, SWC
  compilation, TypeScript target tuning, and Vercel deployment basics.
coverImage: /blog-assets/nestjs-auth-flow-fast-start/cover.png
date: '2023-10-06T12:00:00.000Z'
author:
  name: Henrique Weiand
  picture: /nestjs-ninja.png
ogImage:
  url: /blog-assets/nestjs-auth-flow-fast-start/cover.png
tags:
  - NestJS
  - Authentication
  - SWC
  - Vercel
---
This post starts a small NestJS authentication series. It is based on my original Medium article, [Implementing auth flow as fast as possible using NestJS](https://medium.com/p/bdf87488bc00).

The first part is not about JWT logic yet. It is about creating a solid project base quickly.

## Create the app

Use the NestJS CLI to generate the application:

```bash
nest g application nestjs-auth-flow-blog-post
```

The CLI gives you a familiar NestJS structure, default scripts, and the first module/controller/service files.

## Use SWC

SWC can make development builds faster. Install the compiler dependencies and configure the Nest CLI builder:

```bash
npm install -D @swc/cli @swc/core
```

Then configure `nest-cli.json` with the SWC builder.

## Tune TypeScript for your Node version

The TypeScript target should match the Node runtime. If the project runs on a modern Node version, compiling to a modern ECMAScript target avoids unnecessary output.

That keeps the build cleaner and closer to what the runtime already supports.

## Deployment shape

The article also shows a simple Vercel deployment setup through `vercel.json`, routing requests to the NestJS entrypoint.

For real production APIs, review platform limits and runtime behavior carefully. But for a fast demo, it is a quick way to put the application online.

## Takeaways

Before implementing auth logic, create a fast development base. CLI scaffolding, SWC, a suitable TypeScript target, and a known deployment path make the next steps easier.
