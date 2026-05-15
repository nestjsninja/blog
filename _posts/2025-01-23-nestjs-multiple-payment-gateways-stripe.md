---
title: "Multiple Payment Gateways in NestJS with a Stripe Example"
excerpt: "How to design a payment abstraction in NestJS so Stripe is only one implementation behind a stable application contract."
coverImage: "/nestjs-ninja.png"
date: "2025-01-23T12:00:00.000Z"
author:
  name: "Henrique Weiand"
  picture: "/nestjs-ninja.png"
ogImage:
  url: "/nestjs-ninja.png"
tags:
  - NestJS
  - Payments
  - Stripe
  - Architecture
---

Payment integrations tend to start simple and become strategic. Today you may only need Stripe. Later, you may need Paddle, PayPal, regional providers, or a fallback gateway. This post is based on my original Medium article, [How to Integrate Multiple Payment Gateways in NestJS](https://medium.com/p/978be76af17f).

The architecture goal is simple: application code should not depend directly on Stripe everywhere.

## Define a payment contract

Start with an abstraction that represents what the application needs from a payment provider:

```ts
export abstract class PaymentGateway {
  abstract createPayment(input: CreatePaymentInput): Promise<PaymentResult>;
}
```

The application layer can depend on `PaymentGateway`, while infrastructure provides a concrete implementation.

## Stripe as one implementation

The Stripe service imports Stripe's SDK, handles provider-specific payloads, and maps the response back to the application's `PaymentResult`.

That keeps Stripe-specific concerns in one place:

- API keys
- SDK initialization
- provider payload shape
- error mapping
- returned IDs and statuses

The rest of the application only sees the payment contract.

## Wiring with NestJS

NestJS dependency injection can bind the abstract provider to the concrete class:

```ts
{
  provide: PaymentGateway,
  useClass: StripePaymentGateway,
}
```

If a different gateway is needed later, the binding can change without rewriting every use case.

## Why it matters

Payments are external infrastructure. They should sit near the edge of the system, not inside domain logic.

This design makes it easier to:

- add another provider
- test checkout flows with mocks
- isolate provider errors
- keep use cases readable
- change payment strategy later

## Takeaways

Start with Stripe if that is the current need, but do not let the entire application become Stripe-shaped. A small payment abstraction gives the system room to evolve.
