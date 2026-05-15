---
title: "Clean Architecture and DDD in NestJS E-commerce: Part 1"
excerpt: "A first look at structuring a NestJS e-commerce project around domain entities, use cases, infrastructure, and low coupling."
coverImage: "/nestjs-ninja.png"
date: "2024-03-09T12:00:00.000Z"
author:
  name: "Henrique Weiand"
  picture: "/nestjs-ninja.png"
ogImage:
  url: "/nestjs-ninja.png"
tags:
  - NestJS
  - Clean Architecture
  - DDD
  - E-commerce
---

Clean Architecture and Domain-Driven Design are useful when a NestJS application starts to grow beyond simple CRUD. They help keep business rules away from framework details, database decisions, and external providers.

This post is based on my original Medium article, [Mastering NestJS: Unleashing the Power of Clean Architecture and DDD in E-commerce Development - part 1](https://medium.com/p/97850131fd87). It starts a small e-commerce example and focuses on the first structural decisions.

The point is not to build a complete commerce platform in one pass. The point is to show how NestJS can host an application where the domain stays independent from infrastructure.

## The project idea

The sample project represents part of an e-commerce ecosystem. The domain includes a few basic concepts:

- users
- products
- orders
- order products

The project also introduces external concerns that a real system often needs:

- a payment provider, using Stripe as the first implementation
- a cache layer for faster read endpoints
- multiple persistence options, including MongoDB and Postgres

Those technology choices are intentional. They make the architecture more interesting because the application should not collapse if one infrastructure detail changes.

## Why this architecture

There are two main goals:

1. Keep business logic independent from technology choices.
2. Make the project structure predictable as features grow.

If the application is designed around the domain, changing a database adapter or payment provider should mostly affect the infrastructure layer. Product creation, order calculation, and checkout use cases should not need to know whether persistence happens through Prisma, Mongoose, or another tool.

## Folder structure

The application is organized around explicit layers:

```text
src
├── application
│   └── ecommerce
│       ├── ports
│       └── use-case
├── core
│   └── entities
├── domain
│   └── ecommerce
├── infra
│   ├── env
│   ├── http
│   │   └── dto
│   ├── payment
│   │   └── stripe
│   └── persistence
│       ├── cache
│       │   └── interceptor
│       ├── mongoose
│       │   ├── entities
│       │   ├── mapper
│       │   └── repositories
│       └── prisma
│           ├── mapper
│           └── repositories
```

The names communicate intent:

- `domain` holds the business objects.
- `application` holds use cases and ports.
- `infra` holds framework, HTTP, database, cache, and payment details.
- `core` holds base primitives shared by the domain.

The most important rule is dependency direction. Infrastructure can depend on application and domain code, but domain entities should not depend on controllers, ORMs, or payment SDKs.

## Starting from HTTP

The HTTP layer is one of the external adapters. It receives requests, validates input through DTOs, and delegates work to use cases.

A first version of the HTTP folder can look like this:

```text
http
├── app.controller.ts
├── checkout.controller.ts
├── dto
│   ├── create-order-product.dto.ts
│   ├── create-order.dto.ts
│   ├── create-product.dto.ts
│   └── create-user.dto.ts
├── http.module.ts
├── order.controller.ts
├── product.controller.ts
└── user.controller.ts
```

You can start smaller with just `http.module.ts` and `product.controller.ts`. The important part is that controllers should stay thin. They translate HTTP input into application calls.

## Domain entities

The domain layer contains classes that represent the e-commerce concepts:

```text
domain/ecommerce
├── order-product.ts
├── order.ts
├── product.ts
└── user.ts
```

A product can be simple:

```ts
export interface ProductProps {
  id?: string;
  title: string;
  price: number;
}

export class Product extends Entity<ProductProps> {
  constructor(props: ProductProps) {
    super(props);
  }
}
```

The class is not a database schema. It is a domain object. It can later be mapped to a Prisma model, a Mongoose document, or another persistence format.

## Orders contain rules

Orders are more interesting because they have relationships and defaults. An order can include products, a total, a payment method, and a status.

```ts
export interface OrderProps {
  id?: string;
  user: string;
  total?: number;
  status?: "paid" | "open" | "canceled";
  paymentId?: string;
  paymentMethod?: "stripe" | "paddle" | "paypal" | "other";
  orderProduct?: OrderProduct[];
}

export class Order extends Entity<OrderProps> {
  constructor(props: OrderProps) {
    props.total = props.total ?? 0;
    props.status = props.status ?? "open";

    super(props);
  }
}
```

Those defaults belong in the domain because they describe how the business object should behave. A new order starts open. If no total is provided yet, it starts at zero.

That kind of rule should not be hidden inside a controller or database mapper.

## Connecting the layers

The main request flow is:

```text
Controller -> Use case -> Entity
```

The controller receives input. The use case coordinates the operation. The entity protects the business rules.

Infrastructure can be used to complete the operation, but through boundaries. For example, a use case may rely on a repository port rather than importing Prisma or Mongoose directly.

That is where NestJS dependency injection becomes useful. Modules can wire concrete implementations to abstract ports while the use case stays focused on application behavior.

## NestJS modules and dependency injection

The HTTP module can declare controllers that receive use cases. Those use cases can depend on payment and persistence abstractions.

The database module can be declared globally when it provides infrastructure used across the application, but that should be a conscious choice. Global modules are convenient, but they also hide dependencies if overused.

Understanding NestJS modules, providers, and dependency injection is essential for this architecture. The architecture is not only about folders. It is about making dependencies point in the right direction.

## What comes next

This first part establishes the structure:

- external adapters live in `infra`
- domain entities live away from framework code
- use cases connect input, rules, and infrastructure boundaries
- NestJS modules wire everything together

The next step is abstraction: defining ports for repositories and external services, then providing concrete implementations for different databases or providers.

That is where Clean Architecture starts to pay off. The system can evolve without rewriting the core behavior every time an infrastructure choice changes.
