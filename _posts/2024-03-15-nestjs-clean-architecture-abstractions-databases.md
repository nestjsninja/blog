---
title: "Clean Architecture in NestJS: Abstractions and Databases"
excerpt: "How repository abstractions let a NestJS application work with different persistence implementations while keeping use cases focused on domain behavior."
coverImage: "/nestjs-ninja.png"
date: "2024-03-15T12:00:00.000Z"
author:
  name: "Henrique Weiand"
  picture: "/nestjs-ninja.png"
ogImage:
  url: "/nestjs-ninja.png"
tags:
  - NestJS
  - Clean Architecture
  - Databases
  - Abstractions
---

This post continues the Clean Architecture and DDD e-commerce series. It is based on my original Medium article, [Mastering NestJS: Building Scalable Systems with Abstractions](https://medium.com/p/ea30a02699f9).

The main idea is that infrastructure should be replaceable. A use case should not care whether data is stored with Prisma, Mongoose, or another tool.

## Persistence is an outer layer

In Clean Architecture, persistence lives outside the domain and application rules. The database exists to store and retrieve data, but it should not dictate how the domain model works.

The project uses a `PersistenceModule` that can register different implementations:

```ts
interface DatabaseOptions {
  type: "prisma" | "mongoose";
  global?: boolean;
}
```

That module decides which database integration to expose.

## Repository ports

The application layer defines abstract repositories:

```ts
export abstract class OrderRepository {
  abstract findMany(): Promise<Order[]>;
  abstract findById(id: string): Promise<Order>;
  abstract create(data: Order): Promise<Order>;
  abstract update(id: string, data: Order): Promise<Order>;
}
```

Use cases depend on this abstraction. Prisma and Mongoose implementations live in infrastructure and satisfy the same contract.

## Use cases stay stable

A use case can create an order, calculate the total, build domain entities, and call `orderRepository.create(order)`.

It does not need to know:

- which ORM is active
- how tables or collections are named
- how documents are mapped
- how IDs are represented internally

Mappers handle translation between persistence records and domain objects.

## The same pattern applies elsewhere

The same abstraction idea can be used for payment providers, environment loading, queues, email providers, caches, and search engines.

Every external dependency is a candidate for a boundary when the application needs flexibility.

## Takeaways

Abstractions are not about adding interfaces everywhere. They are useful where change is likely or where external technology should not leak into business rules. Persistence is one of the clearest examples.
