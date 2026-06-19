---
title: 'Design Patterns in NestJS: Strategy, Observer, and Factory'
excerpt: >-
  Three patterns that come up constantly in NestJS applications — all in the
  same order-processing domain so you see how they compose. Strategy picks the
  shipping algorithm at runtime, Factory decouples order creation from usage,
  and Observer decouples "order placed" from "what to do about it".
date: '2026-07-09T12:00:00.000Z'
author:
  name: Henrique Weiand
  picture: /nestjs-ninja.png
tags:
  - NestJS
  - TypeScript
  - Design Patterns
  - Software Development
coverImage: /blog-assets/nestjs-design-patterns-strategy-observer-factory/cover.png
ogImage:
  url: /blog-assets/nestjs-design-patterns-strategy-observer-factory/cover.png
---
Hello, dev!

In the [previous post](https://nestjs-ninja.com/blog/2026-07-02-nestjs-classes-abstract-extends-implements-overrides/) we looked at abstract classes, `extends`, `implements`, and `override` — the TypeScript class features that make shared behavior explicit. Today we go one level higher: the **design patterns** those features enable.

Design patterns are not templates to copy. They are names for problems you already encounter. Once you name them, you spot them in code review, in library APIs, and in your own PRs.

We will cover three that come up constantly in NestJS — all in the same order-processing domain, so you see not just each pattern in isolation but how they compose in a single request:

- **Strategy** — pick the shipping-cost algorithm at runtime without changing the caller
- **Factory** — decouple order creation from the code that uses the orders
- **Observer** — decouple "order placed" from "what to do about it"

> These are not three independent exercises. They compose.

💻 The full, runnable example is on GitHub: [nestjsninja/nestjs-design-patterns](https://github.com/nestjsninja/nestjs-design-patterns).

## The domain

Our app does two things: place orders (digital or physical) and calculate shipping rates. When an order is placed, multiple listeners react — an email goes out, inventory is updated. That maps directly to the three patterns.

```
POST /orders            → Factory (which type?) + Observer (who reacts?)
GET  /shipping-rate     → Strategy (which algorithm?)
```

## Strategy: pick the algorithm at runtime 🔄

### The problem

Shipping cost depends on the delivery speed: standard, express, or overnight. Each formula is different. But the service that places orders should not contain a giant `if/else` — it should just ask "what is the rate for this method?" and get a number back.

**Strategy**: extract each algorithm into its own class behind a shared interface and select one at runtime.

### The interface and strategies

For Strategy, a plain `interface` is the right choice — the algorithms share no behavior, so there is nothing to put in a base class. This is exactly the trade-off from the [previous post](https://nestjs-ninja.com/blog/2026-07-02-nestjs-classes-abstract-extends-implements-overrides/): abstract class when you need shared behavior, interface when you only need the contract.

```ts
// strategies/shipping-strategy.interface.ts
export const SHIPPING_STRATEGIES = 'SHIPPING_STRATEGIES';

export interface ShippingStrategy {
  readonly name: string;
  calculate(weightKg: number, distanceKm: number): number;
}
```

```ts
// strategies/standard-shipping.strategy.ts
@Injectable()
export class StandardShippingStrategy implements ShippingStrategy {
  readonly name = 'standard';

  calculate(weightKg: number, distanceKm: number): number {
    return round(weightKg * 1.5 + distanceKm * 0.01);
  }
}

// strategies/express-shipping.strategy.ts
@Injectable()
export class ExpressShippingStrategy implements ShippingStrategy {
  readonly name = 'express';

  calculate(weightKg: number, distanceKm: number): number {
    return round((weightKg * 1.5 + distanceKm * 0.01) * 2.5);
  }
}

// strategies/overnight-shipping.strategy.ts
@Injectable()
export class OvernightShippingStrategy implements ShippingStrategy {
  readonly name = 'overnight';

  calculate(weightKg: number, distanceKm: number): number {
    return round((weightKg * 1.5 + distanceKm * 0.01) * 5.0);
  }
}
```

(`round` is a local helper: `Math.round(n * 100) / 100`)

### Wiring it in NestJS

The key move: inject all strategies as an array via a named token, then pick by `name` at runtime.

```ts
// orders.module.ts
@Module({
  providers: [
    StandardShippingStrategy,
    ExpressShippingStrategy,
    OvernightShippingStrategy,
    {
      provide: SHIPPING_STRATEGIES,
      useFactory: (std, exp, over) => [std, exp, over],
      inject: [StandardShippingStrategy, ExpressShippingStrategy, OvernightShippingStrategy],
    },
    ShippingService,
    // ...
  ],
})
export class OrdersModule {}
```

```ts
// strategies/shipping.service.ts
@Injectable()
export class ShippingService {
  constructor(
    @Inject(SHIPPING_STRATEGIES)
    private readonly strategies: ShippingStrategy[],
  ) {}

  calculate(name: string, weightKg: number, distanceKm: number): number {
    const strategy = this.strategies.find((s) => s.name === name);
    if (!strategy) {
      throw new NotFoundException(
        `Unknown shipping method: "${name}". Available: ${this.availableMethods().join(', ')}`,
      );
    }
    return strategy.calculate(weightKg, distanceKm);
  }

  availableMethods(): string[] {
    return this.strategies.map((s) => s.name);
  }
}
```

Adding a fourth shipping method is a one-file change: write the class, add it to the `useFactory` array. `ShippingService` does not change.

> Adding a new Strategy is a one-file, one-line-in-module change. The service that calls it never changes.

## Factory: decouple creation from usage 🏭

### The problem

A `DigitalOrder` has a `downloadUrl`. A `PhysicalOrder` has a `shippingAddress` and `weightKg`. If `OrdersService` calls `new DigitalOrder()` or `new PhysicalOrder()` directly, it is coupled to the construction details of every type. When a third type appears, the service changes.

**Factory**: one class owns the "which concrete type + which fields" decision so callers only deal with the abstract result.

### The products

```ts
// models/order.ts
export type OrderType = 'digital' | 'physical';

export abstract class Order {
  id: string;
  abstract readonly type: OrderType;
  abstract validate(): void;
}

// models/digital-order.ts
export class DigitalOrder extends Order {
  override readonly type = 'digital' as const;
  downloadUrl: string;

  override validate(): void {
    if (!this.downloadUrl) throw new Error('Digital order requires a downloadUrl');
  }
}

// models/physical-order.ts
export class PhysicalOrder extends Order {
  override readonly type = 'physical' as const;
  shippingAddress: string;
  weightKg: number;

  override validate(): void {
    if (!this.shippingAddress) throw new Error('Physical order requires a shippingAddress');
    if (this.weightKg <= 0) throw new Error('weightKg must be positive');
  }
}
```

`Order` is abstract — you cannot do `new Order()`. The `validate` method is also abstract: each concrete type enforces its own invariants. Notice `override` on every subclass method because `"noImplicitOverride": true` is in the tsconfig.

### The factory

```ts
// factories/order.factory.ts
@Injectable()
export class OrderFactory {
  create(dto: CreateOrderDto): Order {
    switch (dto.type) {
      case 'digital':  return this.buildDigital(dto);
      case 'physical': return this.buildPhysical(dto);
      default:
        throw new BadRequestException(`Unknown order type: "${(dto as any).type}"`);
    }
  }

  private buildDigital(dto: CreateOrderDto): DigitalOrder {
    const order = new DigitalOrder();
    order.id = crypto.randomUUID();
    order.downloadUrl = dto.downloadUrl!;
    order.validate();
    return order;
  }

  private buildPhysical(dto: CreateOrderDto): PhysicalOrder {
    const order = new PhysicalOrder();
    order.id = crypto.randomUUID();
    order.shippingAddress = dto.shippingAddress!;
    order.weightKg = dto.weightKg!;
    order.validate();
    return order;
  }
}
```

`OrdersService` calls `this.orderFactory.create(dto)` and gets back an `Order`. It never imports `DigitalOrder` or `PhysicalOrder`. When you add `SubscriptionOrder`, you extend the switch and add a private builder — the service does not change.

> The Factory owns the "which class + which fields" decision. The rest of the codebase sees only the abstract type.

## Observer: decouple producers from consumers 📢

### The problem

When an order is placed, several things need to happen: send an email, update inventory, log to analytics. If `OrdersService` calls each of these directly, it is coupled to all of them — every new "thing that should happen" requires a service change.

**Observer**: let the producer publish one event; let each consumer subscribe independently.

### A typed EventBus

```ts
// common/event-bus.ts
type EventHandler<T> = (payload: T) => void | Promise<void>;

@Injectable()
export class EventBus {
  private readonly handlers = new Map<string, EventHandler<any>[]>();

  subscribe<T>(event: string, handler: EventHandler<T>): void {
    const list = this.handlers.get(event) ?? [];
    this.handlers.set(event, [...list, handler]);
  }

  async publish<T>(event: string, payload: T): Promise<void> {
    const list = this.handlers.get(event) ?? [];
    await Promise.all(list.map((h) => h(payload)));
  }
}
```

### Listeners register themselves at startup

Each listener uses NestJS's `OnModuleInit` lifecycle hook to subscribe when the app starts:

```ts
// listeners/email-notification.listener.ts
@Injectable()
export class EmailNotificationListener implements OnModuleInit {
  constructor(private readonly eventBus: EventBus) {}

  onModuleInit(): void {
    this.eventBus.subscribe<OrderPlacedEvent>('order.placed', async (event) => {
      console.log(`[EMAIL] receipt → ${event.customerEmail} for order ${event.orderId}`);
      // In a real app: call your email provider (SendGrid, SES, etc.)
    });
  }
}

// listeners/inventory.listener.ts
@Injectable()
export class InventoryListener implements OnModuleInit {
  constructor(private readonly eventBus: EventBus) {}

  onModuleInit(): void {
    this.eventBus.subscribe<OrderPlacedEvent>('order.placed', async (event) => {
      if (event.orderType === 'physical') {
        console.log(`[INVENTORY] reserving stock for order ${event.orderId}`);
        // In a real app: decrement stock, reserve slot, etc.
      }
    });
  }
}
```

Adding a third listener — `AnalyticsListener`, say — means one new file and one line in the module's `providers`. `OrdersService` does not change.

### Publishing in the service

```ts
async placeOrder(dto: CreateOrderDto): Promise<Order> {
  const order = this.orderFactory.create(dto);          // Factory
  this.orders.set(order.id, order);

  await this.eventBus.publish(                           // Observer
    'order.placed',
    new OrderPlacedEvent(order.id, order.type, dto.customerEmail),
  );

  return order;
}
```

The service publishes one event and returns. It does not know how many listeners exist or what they do.

> The Observer decouples "something happened" from "what do we do about it". Add a listener without touching the publisher.

## How the three patterns compose 🔗

A single `POST /orders` runs through Factory and Observer. A `GET /shipping-rate` runs through Strategy. The patterns share the same module but have no knowledge of each other:

```
POST /orders
  → OrderFactory.create(dto)
      → new DigitalOrder()  |  new PhysicalOrder()
      → order.validate()
  → orders.set(order.id, order)
  → EventBus.publish('order.placed', event)
      → EmailNotificationListener   (async, parallel)
      → InventoryListener           (async, parallel)

GET /shipping-rate?method=express&weight=2&distance=200
  → ShippingService.calculate('express', 2, 200)
      → ExpressShippingStrategy.calculate(2, 200)
      → 10.00
```

Each pattern has a clear boundary. The factory knows about types. The strategies know about rates. The event bus knows about subscriptions. The service just coordinates.

> Patterns are small. Their value comes from composition, not from being used in isolation.

## Testing 🧪

Each pattern has natural unit tests because the pieces are small and injected dependencies can be replaced without a full NestJS module.

**Strategy:**

```ts
it('standard: weightKg * 1.5 + distanceKm * 0.01', () => {
  expect(new StandardShippingStrategy().calculate(2, 100)).toBe(4.00);
});

it('express: standard * 2.5', () => {
  expect(new ExpressShippingStrategy().calculate(2, 100)).toBe(10.00);
});

it('ShippingService throws NotFoundException for an unknown method', () => {
  const service = new ShippingService([new StandardShippingStrategy()]);
  expect(() => service.calculate('carrier_pigeon', 1, 100)).toThrow(NotFoundException);
});
```

**Factory:**

```ts
it('creates a DigitalOrder from a digital DTO', () => {
  const order = new OrderFactory().create({
    type: 'digital', downloadUrl: 'https://x.com/f.zip', customerEmail: 'x@x.com',
  });
  expect(order).toBeInstanceOf(DigitalOrder);
  expect(order.type).toBe('digital');
});

it('throws BadRequestException for an unknown type', () => {
  expect(() =>
    new OrderFactory().create({ type: 'subscription' as any, customerEmail: 'x@x.com' }),
  ).toThrow(BadRequestException);
});
```

**Observer:**

```ts
it('calls all handlers subscribed to the same event', async () => {
  const bus = new EventBus();
  const a = jest.fn();
  const b = jest.fn();
  bus.subscribe('order.placed', a);
  bus.subscribe('order.placed', b);
  await bus.publish('order.placed', { id: '1' });
  expect(a).toHaveBeenCalledWith({ id: '1' });
  expect(b).toHaveBeenCalledWith({ id: '1' });
});

it('does not cross-fire handlers for other events', async () => {
  const bus = new EventBus();
  const handler = jest.fn();
  bus.subscribe('order.placed', handler);
  await bus.publish('order.shipped', {});
  expect(handler).not.toHaveBeenCalled();
});
```

These tests require no NestJS bootstrap — just `new ClassName()` and your assertions. That is the practical benefit of keeping each pattern in its own injectable class.

## A note on production Observer

The `EventBus` above is a clean illustration of the pattern, but for production NestJS apps there is a battle-tested alternative: `@nestjs/event-emitter`. It follows the same model (publish/subscribe, `OnModuleInit` or `@OnEvent` decorator) but adds wildcard listeners, ordered handlers, async queuing, and error isolation. Reach for it when you outgrow the hand-rolled bus.

## Final thoughts

Strategy, Factory, and Observer each solve a different kind of coupling:

- **Strategy** decouples the caller from *which algorithm* runs.
- **Factory** decouples the caller from *how the object was built*.
- **Observer** decouples the publisher from *who reacts and what they do*.

None of these required a new framework feature. They used abstract classes, `implements`, `@Injectable()`, injection tokens, and `OnModuleInit` — things you already use in NestJS every day. That is the point: these patterns are not exotic. They are the natural next step once you are comfortable with the class features from the [previous post](https://nestjs-ninja.com/blog/2026-07-02-nestjs-classes-abstract-extends-implements-overrides/).

> Patterns solve coupling problems. NestJS's DI makes them straightforward to wire.

### Takeaways ✍️

- **Strategy**: inject all strategies as an array via a named token; pick by `name` at runtime; adding a new strategy never changes the caller.
- **Factory**: one injectable owns `new ConcreteType()` + field assignment + validation; callers see only the abstract type.
- **Observer**: a typed `EventBus` with `subscribe`/`publish`; listeners self-register in `onModuleInit`; the publisher knows nothing about them.
- Use a plain `interface` for Strategy (no shared behavior). Use `abstract class` for products when types share behavior — like `validate()` in our case.
- For production Observer, reach for `@nestjs/event-emitter` over a hand-rolled bus.
- Each pattern's unit tests need no NestJS module setup: pass injected dependencies manually with `new ClassName()`.
