---
title: "Kubernetes Jobs with NestJS and nest-commander"
excerpt: "A practical approach for running NestJS command-line workers as Kubernetes Jobs with nest-commander, Docker, shared libraries, and TypeORM."
coverImage: "/nestjs-ninja.png"
date: "2025-02-18T12:00:00.000Z"
author:
  name: "Henrique Weiand"
  picture: "/nestjs-ninja.png"
ogImage:
  url: "/nestjs-ninja.png"
tags:
  - NestJS
  - Kubernetes
  - CLI
  - Jobs
---

Not every NestJS process needs to be an HTTP API. Sometimes the right shape is a command that runs once, processes data, and exits. This post is based on my original Medium article, [Implementing Kubernetes Jobs with NestJS and nest-commander](https://medium.com/p/67c38b610d4f).

The example repository is [henriqueweiand/nestjs-job-commander](https://github.com/henriqueweiand/nestjs-job-commander), which shows a NestJS CLI process packaged as a Kubernetes Job.

## The idea

`nest-commander` lets a NestJS application expose commands while still using modules, providers, dependency injection, configuration, and database services.

That makes it useful for workloads like:

- one-time imports
- scheduled enrichment jobs
- background data repair
- third-party API synchronization
- report generation

Kubernetes Jobs provide the runtime wrapper. They start a pod, execute the command, and mark the run as succeeded or failed.

## Repository shape

The project is organized as a monorepo:

```text
apps/cli-enricher
libs
k8s
Dockerfile
.env
```

The CLI app imports shared modules from `libs`, just like a normal NestJS app would. The `k8s` folder contains Kubernetes manifests for running the command in the cluster.

## Bootstrapping the CLI

The CLI app starts through `CommandFactory.run`. The app module imports infrastructure like environment handling, database configuration, and the CLI feature module.

The command itself is a provider decorated for `nest-commander`. It receives dependencies in the constructor, executes its task, and exits when the command is done.

That keeps the command testable and avoids turning the script into a pile of global functions.

## Running in Kubernetes

The Dockerfile builds the CLI app. The Kubernetes Job references that image and runs the command entrypoint.

This works well when the workload is finite. If the process needs to run forever, it should probably be a Deployment or worker service instead of a Job.

## Takeaways

NestJS is useful beyond controllers. For operational workloads, `nest-commander` gives you the same dependency injection and module system in a CLI shape. Kubernetes Jobs then give the process a reliable execution model in the cluster.
