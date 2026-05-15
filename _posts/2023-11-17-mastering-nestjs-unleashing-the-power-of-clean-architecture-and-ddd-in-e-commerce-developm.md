---
title: >-
  Mastering NestJS: Unleashing the Power of Clean Architecture and DDD in
  E-commerce Development — part 1
excerpt: >-
  Hello, dev! Let's start one more sequence of exciting technical posts related
  to the NestJS ecosystem, and in this sequence, I am going to review and
  exercise with you concepts like:
coverImage: >-
  /blog-assets/mastering-nestjs-unleashing-the-power-of-clean-architecture-and-ddd-in-e-commerce-developm/cover.png
date: '2023-11-17T12:00:00.000Z'
author:
  name: Henrique Weiand
  picture: /nestjs-ninja.png
ogImage:
  url: >-
    /blog-assets/mastering-nestjs-unleashing-the-power-of-clean-architecture-and-ddd-in-e-commerce-developm/cover.png
tags:
  - Clean Architecture
  - Domain Driven Design
  - Ecommerce
  - Mongo
  - NestJS
  - Postgres
  - Software Development
---
Hello, dev! Let's start one more sequence of exciting technical posts related to the NestJS ecosystem, and in this sequence, I am going to review and exercise with you concepts like:

- [Clean Architecture;](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [DDD](https://en.wikipedia.org/wiki/Domain-driven_design);

The idea is to only go through some parts of the application, ok? I recommend this post for those who have some knowledge about NestJS already and want to see & apply a different architectural approach to have applications with as little coupling as possible.

There's another post that I wrote in the past, that also applied this approach of less coupling. If you want to take a look the link is

[Creating Smart Questions with NestJS and OpenAI](https://medium.com/nestjs-ninja/creating-smart-questions-with-nestjs-and-openai-83089829cdf5)

### What is going to be the project?

This is a simple project that represents part of an `e-commerce ecosystem`. We are going to design a solution with four basic entities, they are

![Screen Shot 2024-03-09 at 15.51.23.png](/blog-assets/mastering-nestjs-unleashing-the-power-of-clean-architecture-and-ddd-in-e-commerce-developm/screen-shot-2024-03-09-at-15-51-23.png)

Plus, we will integrate this solution with the `Stripe payment platform and a Cache` layer for the GET endpoints to respond faster! 🏃🏻‍♂️💨

---

### Start 🎬

For this project, I am going to use a few different technologies for two reasons:

1. I want to share how Clean Architecture can help a project not rely on the technology; For example, if you want to change the database, or payment provider… it is going to be very simple.
2. To have a clear project pattern applied;

The technologies are going to be:

- NestJS
- MongoDB
- Postgres
- SWC

I am starting this project, following the same steps that I have shown in this post (I just skipped the deploy step)

[Implementing auth flow as fast as possible using NestJS](https://medium.com/nestjs-ninja/implementing-auth-flow-as-fast-as-possible-using-nestjs-bdf87488bc00)

With the project created and the setup done, we can organize the folders and the main files. The final version is gonna be like this:

```jsx
assets
├── prisma
└── src
    ├── application
    │   └── ecommerce
    │       ├── ports
    │       └── use-case
    ├── core
    │   └── entities
    ├── domain
    │   └── ecommerce
    └── infra
        ├── env
        ├── http
        │   └── dto
        ├── payment
        │   └── stripe
        └── persistence
            ├── cache
            │   └── interceptor
            ├── mongoose
            │   ├── entities
            │   ├── mapper
            │   └── repositories
            └── prisma
                ├── mapper
                └── repositories
```

To start with something visual, let's start with the `infra/http` This HTTP, represents one of the external layers that compound the architecture, so, everything related to external technologies, for example, databases, presenters, and libraries, will be inside this folder.

To make things clear, we are following this diagram. (don't worry about everything else yet)

![Screen Shot 2024-03-09 at 15.37.40.png](/blog-assets/mastering-nestjs-unleashing-the-power-of-clean-architecture-and-ddd-in-e-commerce-developm/screen-shot-2024-03-09-at-15-37-40.png)

As HTTP is a module, let's create a module and its related files

```jsx
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
├── user.controller-e2e-spec.ts
└── user.controller.ts
```

This is the final version with everything inside, but you can start off with the `http.module.ts` and `product.controller.ts`.

The module is pretty simple, he initially is going to have the `product.controller` declared in it and speaking about the product.controller, you can create a simple GET method just to have something in it as well. (you can find the final version [here](https://github.com/henriqueweiand/nestjs-ecommerce/blob/master/src/infra/http/http.module.ts)).

With the HTTP module created, you can add it to the app.module and make things work.

### Domain entities 🎨

As you might have seen, we have a folder called `src/domain/ecoomerce`, and in there we are declaring the classes that will represent the three entities that I mentioned in the beginning.

```jsx
ecommerce
    ├── order-product.ts
    ├── order.ts
    ├── product.ts
    └── user.ts
```

Each one is a Class and has its properties, for example, `products`

[https://gist.github.com/henriqueweiand/a0f70aadd295b27690ee8972e15901cc](https://gist.github.com/henriqueweiand/a0f70aadd295b27690ee8972e15901cc)

In this case, I am declaring a Product class and this domain contains fields, they are:

- id (optional, because at the moment of creating the record still doesn't have value)
- title
- price

### Other entities 🦿

The other entities are kind of similar to the Product, however, if we take a look at Order, we will see that this one has a relation to others like orderProduct.

```jsx
import { Entity } from "@app/core/entities/entity";
import { OrderProduct } from "./order-product";

export interface OrderProps {
    id?: string;
    user: string
    total?: number
    status?: "paid" | "open" | "canceled"
    paymentId?: string,
    paymentMethod?: "stripe" | "paddle" | "paypal" | "other", // It is only working with stripe for now
    orderProduct?: OrderProduct[]
}

export class Order extends Entity<OrderProps> {
    constructor(props: OrderProps) {
        props.total = props.total ?? 0;
        props.status = props.status ?? "open";

        super(props);
    }
    
    ...
```

(The final folder with all the entities → [here](https://github.com/henriqueweiand/nestjs-ecommerce/tree/master/src/domain/ecommerce))

The reason for those relations is simple, an order in this context has one or more products. One more detail that this entity knows can be seen in the construction method. If this Domain is declared without total and status defined, it will assume 0 as price and “open” as status. We could have more methods or conditions that we understand are correct for the domain if that is the case, okay?

Just to reinforce, when we talk about Domain, we are referring to the main layer of the diagram.

![Screen Shot 2024-03-09 at 16.02.32.png](/blog-assets/mastering-nestjs-unleashing-the-power-of-clean-architecture-and-ddd-in-e-commerce-developm/screen-shot-2024-03-09-at-16-02-32.png)

### Connecting the layers 🥗

Following the diagram, we have to follow the sequence:

## **Controller → Use case → Entities**

During usage, we can use anything from the `external layer` in order to execute the logic, and all of this is held in the use case, so we are going to connect the layers inside the HTTP + Use cases, especially because of the dependency injection that NestJS has.

Check out this final version of the http.module

[https://gist.github.com/henriqueweiand/a3727f5e0264351ddbd3951c5b865831](https://gist.github.com/henriqueweiand/a3727f5e0264351ddbd3951c5b865831)

As I said, we have the Controllers that are going to receive the use cases, and the use cases rely on the `Payment module and Database module`. One detail, Database module is declared as `global` , and for that reason, it is not included here. The database module is declared in the app.module like this final version [here](https://github.com/henriqueweiand/nestjs-ecommerce/blob/master/src/app.module.ts).

<aside>
💡 It is important to understand the dependency injection and the module strategy that NestJS applied to understand the most from this example.

</aside>

To have a better understanding of all of these, let's see the following files

1. [app.module.ts](https://github.com/henriqueweiand/nestjs-ecommerce/blob/master/src/app.module.ts)
2. [ecommerce.module.ts](https://github.com/henriqueweiand/nestjs-ecommerce/blob/master/src/application/ecommerce/ecommerce.module.ts)
3. [http.module.ts](https://github.com/henriqueweiand/nestjs-ecommerce/blob/master/src/infra/http/http.module.ts)
4. [product.controller.ts](https://github.com/henriqueweiand/nestjs-ecommerce/blob/master/src/infra/http/product.controller.ts)
5. [use-case/create-product.ts](https://github.com/henriqueweiand/nestjs-ecommerce/blob/master/src/application/ecommerce/use-case/create-product.ts)

This is the flow that the request follows when it is requested.

### Conclusion 👨🏼‍🏫

We have covered a bunch of parts of this application and concepts so far, and as I said, it is a sequence of posts. For the next one, we are going to see and understand more about `abstractions` and how to create a module, service, and functionality with as little coupling as possible. The idea is to apply this technique for the use cases and the repositories that later are going to persist the information in the database.
