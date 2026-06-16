---
title: 'NestJS Classes Deep Dive: Abstract Classes, Extends, Implements, and Overrides'
excerpt: >-
  Most NestJS projects default to interfaces. But abstract classes let you
  define a contract AND ship shared behavior in one construct. This post covers
  the template method pattern, hook methods, the override keyword, DTO
  inheritance, and generic base services — all in a real NestJS notification
  system.
date: '2026-07-02T12:00:00.000Z'
author:
  name: Henrique Weiand
  picture: /nestjs-ninja.png
tags:
  - NestJS
  - TypeScript
  - Classes
  - Patterns
  - Software Development
coverImage: /blog-assets/nestjs-classes-abstract-extends-implements-overrides/cover.png
ogImage:
  url: /blog-assets/nestjs-classes-abstract-extends-implements-overrides/cover.png
---
Hello, dev!

TypeScript gives you interfaces and abstract classes. Most NestJS projects default to interfaces — they feel familiar, they compile away, and they pair well with DI tokens. But abstract classes do something interfaces cannot: they let you define a contract **and** ship shared behavior in the same construct.

Today we build a notification system with email and SMS channels. Both share the same orchestration logic — log before, send, log after — but each implements its own delivery. That difference is exactly the kind of problem abstract classes solve.

> An interface defines the shape. An abstract class defines the shape **and** can own shared behavior.

💻 The full, runnable example is on GitHub: [nestjsninja/nestjs-classes-abstractions](https://github.com/nestjsninja/nestjs-classes-abstractions).

## Abstract class vs interface 🏗️

Before we build, a quick comparison. When you want to express "every notification channel must have a `type` and a `send` method", you have two options:

```ts
// Option 1: interface — shape only, compiles away
interface INotificationChannel {
  type: string;
  send(payload: NotificationPayload): Promise<void>;
}

// Option 2: abstract class — shape + optional behavior, survives to runtime
abstract class NotificationChannel {
  abstract readonly type: string;
  abstract send(payload: NotificationPayload): Promise<void>;
}
```

Both enforce the contract at compile time. The difference shows up the moment you want to share behavior. With an interface, you have to copy the shared logic into every implementing class or reach for a mixin. With an abstract class, you add a concrete method and every subclass gets it for free.

The other practical difference: abstract classes compile to real JavaScript and can be used as NestJS injection tokens. Interfaces disappear at compile time, so you cannot use them directly as tokens.

## The abstract notification channel 📡

Here is the base class:

```ts
// channels/notification-channel.abstract.ts
export interface NotificationPayload {
  recipient: string;
  message: string;
}

export abstract class NotificationChannel {
  abstract readonly type: string;

  // Subclasses must implement the actual delivery
  protected abstract deliver(payload: NotificationPayload): Promise<void>;

  // Template method — shared orchestration that subclasses do not touch
  async send(payload: NotificationPayload): Promise<void> {
    this.log(`dispatching to ${payload.recipient}`);
    await this.deliver(payload);
    this.log(`delivered to ${payload.recipient}`);
  }

  // Hook — concrete but overridable
  protected log(message: string): void {
    console.log(`[${this.type.toUpperCase()}] ${message}`);
  }
}
```

A few things worth naming:

- `deliver` is `protected abstract` — it is the extension point between the base and its subclasses, not exposed to callers. Callers use `send`.
- `send` is the **template method**: it owns the sequence (log → deliver → log) and calls `deliver` where the subclass-specific work lives. Subclasses cannot accidentally skip the logging.
- `log` is a **hook**: concrete enough to work by default, but `protected` so a subclass can override it when it needs different behavior.

> `abstract` enforces what must exist. `protected` controls who can see it. The two keywords work together.

You cannot instantiate `NotificationChannel` directly — TypeScript will give you *"Cannot create an instance of an abstract class"*. That is the contract: use it through a concrete subclass.

## Concrete subclasses with `extends` and `override` 🔧

`EmailChannel` extends the base and provides both required members:

```ts
// channels/email.channel.ts
import { Injectable } from '@nestjs/common';
import { NotificationChannel, NotificationPayload } from './notification-channel.abstract';

@Injectable()
export class EmailChannel extends NotificationChannel {
  override readonly type = 'email';

  protected override async deliver(payload: NotificationPayload): Promise<void> {
    // In a real app: call an SMTP client, SendGrid, SES, etc.
    console.log(`[SMTP] → ${payload.recipient}: ${payload.message}`);
  }

  protected override log(message: string): void {
    // Extend the parent hook rather than replace it
    super.log(`[smtp] ${message}`);
  }
}
```

`SmsChannel` is similar but skips the `log` override — it inherits the base implementation as-is:

```ts
// channels/sms.channel.ts
import { Injectable } from '@nestjs/common';
import { NotificationChannel, NotificationPayload } from './notification-channel.abstract';

@Injectable()
export class SmsChannel extends NotificationChannel {
  override readonly type = 'sms';

  protected override async deliver(payload: NotificationPayload): Promise<void> {
    // In a real app: call Twilio, AWS SNS, etc.
    console.log(`[SMS] → ${payload.recipient}: ${payload.message}`);
  }
}
```

## The `override` keyword 🛡️

I wrote `override` on every method above intentionally. TypeScript 4.3 introduced this keyword, and it solves a real problem: **silent typos**.

Without `override`, if you mistype a method name, TypeScript is fine with it — you just added a new method that never gets called:

```ts
class EmailChannel extends NotificationChannel {
  // No 'override', no error — but this is a typo: 'deliverr' not 'deliver'
  protected async deliverr(payload: NotificationPayload): Promise<void> {
    // This never gets called. Silent bug.
  }
}
```

With `override`, TypeScript verifies the method exists in the parent:

```ts
class EmailChannel extends NotificationChannel {
  protected override async deliverr(payload: NotificationPayload): Promise<void> {
    // TS error: This member cannot have an 'override' modifier because
    // it is not declared in the base class 'NotificationChannel'.
  }
}
```

You can make this mandatory project-wide by adding `"noImplicitOverride": true` to `tsconfig.json`. Once that flag is on, any method that shadows a parent method without the keyword becomes a compile error. I recommend turning it on.

> Add `"noImplicitOverride": true` to tsconfig. Accidental overrides become compile errors.

`super.method()` lets you extend rather than replace. `EmailChannel.log` adds an `[smtp]` prefix and then calls `super.log()` — the parent still owns the actual format, the subclass only adds its piece. Omit `super` and you replace the behavior entirely.

## `implements` in NestJS 🧩

`implements` is how you tell TypeScript that your class satisfies an interface. In NestJS you use it constantly:

```ts
@Injectable()
export class AuthorizationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    // ...
  }
}

@Catch(ForbiddenError)
export class CaslForbiddenFilter implements ExceptionFilter {
  catch(exception: ForbiddenError<any>, host: ArgumentsHost): void {
    // ...
  }
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // ...
  }
}
```

`CanActivate`, `ExceptionFilter`, and `NestInterceptor` are interfaces. When you write `implements CanActivate`, TypeScript verifies you have the right method with the right signature. The same pattern applies to your own contracts:

```ts
interface INotificationChannel {
  type: string;
  send(payload: NotificationPayload): Promise<void>;
}

// The abstract class satisfies the interface — concrete subclasses satisfy both
abstract class NotificationChannel implements INotificationChannel {
  abstract readonly type: string;
  abstract send(payload: NotificationPayload): Promise<void>;
}
```

The rule of thumb: `implements` when you only need the compile-time contract. `extends` (from an abstract class) when you also need shared behavior.

## DTO inheritance with `extends` 📋

DTO inheritance is probably the most common place NestJS developers reach for `extends`. The scenario: a shared set of base fields, and some endpoints add more on top.

```ts
// dto/create-notification.dto.ts
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateNotificationDto {
  @IsString()
  @IsNotEmpty()
  recipient: string;

  @IsString()
  @IsNotEmpty()
  message: string;
}
```

```ts
// dto/email-notification.dto.ts
import { IsEmail, IsOptional, IsString } from 'class-validator';
import { CreateNotificationDto } from './create-notification.dto';

export class EmailNotificationDto extends CreateNotificationDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  subject?: string;
}
```

```ts
// dto/sms-notification.dto.ts
import { Matches } from 'class-validator';
import { CreateNotificationDto } from './create-notification.dto';

export class SmsNotificationDto extends CreateNotificationDto {
  @Matches(/^\+[1-9]\d{1,14}$/, { message: 'phone must be in E.164 format (+15551234567)' })
  phone: string;
}
```

The `ValidationPipe` respects inheritance: validators from the parent class are picked up by the child. `EmailNotificationDto` validates `recipient`, `message`, and `email` without repeating a single decorator.

One practical note: always type the `@Body()` parameter with the **concrete** class, not the base. `@Body() dto: EmailNotificationDto` — NestJS needs the concrete type to instantiate and validate it correctly.

> `class-validator` decorators are inherited. Type `@Body()` with the concrete DTO, not the base class.

## A generic base service 🗂️

Abstract classes are not only for domain concepts. A generic base service is a pattern that removes a lot of boilerplate across services:

```ts
// common/base.service.ts
export abstract class BaseService<T extends { id: string }> {
  private readonly store = new Map<string, T>();

  findAll(): T[] {
    return [...this.store.values()];
  }

  findById(id: string): T | undefined {
    return this.store.get(id);
  }

  protected persist(entity: T): T {
    this.store.set(entity.id, entity);
    return entity;
  }
}
```

The constraint `T extends { id: string }` means the base can use `entity.id` as the map key without knowing anything else about `T`. `persist` is `protected` — callers cannot call it directly, only subclasses decide when to save.

`NotificationsService` extends this and stays a fully injectable NestJS service:

```ts
// notifications.service.ts
@Injectable()
export class NotificationsService extends BaseService<NotificationLog> {
  constructor(
    private readonly emailChannel: EmailChannel,
    private readonly smsChannel: SmsChannel,
  ) {
    super();
  }

  async sendEmail(dto: EmailNotificationDto): Promise<NotificationLog> {
    await this.emailChannel.send({ recipient: dto.email, message: dto.message });
    return this.persist({
      id: crypto.randomUUID(),
      channel: this.emailChannel.type,
      recipient: dto.email,
      message: dto.message,
      sentAt: new Date(),
    });
  }

  async sendSms(dto: SmsNotificationDto): Promise<NotificationLog> {
    await this.smsChannel.send({ recipient: dto.phone, message: dto.message });
    return this.persist({
      id: crypto.randomUUID(),
      channel: this.smsChannel.type,
      recipient: dto.phone,
      message: dto.message,
      sentAt: new Date(),
    });
  }
}
```

The `super()` call in the constructor is required when the parent has a constructor — it initializes the parent's `store`. NestJS handles this naturally; it sees `@Injectable()` on the subclass and instantiates it with the injected dependencies. One rule: `@Injectable()` goes on the **concrete** subclass, not the abstract base (NestJS cannot instantiate abstract classes).

## Injecting with abstract classes as tokens 🪝

Abstract classes survive to runtime, which means they can be NestJS injection tokens. This gives you a clean way to swap implementations:

```ts
// provide the abstract class, bind to the concrete one
{
  provide: NotificationChannel,
  useClass: EmailChannel,
}

// consuming service — depends on the abstract type
constructor(private readonly channel: NotificationChannel) {}
```

Change `useClass: EmailChannel` to `useClass: SmsChannel` and the service gets a different implementation without any change to its code.

For a router pattern where one service picks a channel at runtime, inject both concrete classes and let the service decide:

```ts
export const NOTIFICATION_CHANNELS = 'NOTIFICATION_CHANNELS';

@Module({
  providers: [
    EmailChannel,
    SmsChannel,
    {
      provide: NOTIFICATION_CHANNELS,
      useFactory: (email: EmailChannel, sms: SmsChannel) => ({ email, sms }),
      inject: [EmailChannel, SmsChannel],
    },
    NotificationsService,
  ],
})
export class NotificationsModule {}
```

The example project uses direct injection of `EmailChannel` and `SmsChannel` to keep the module simple. The abstract-class-as-token pattern is most useful when you want a single active implementation swappable per environment.

## Testing class hierarchies 🧪

Abstract classes have one testing advantage: you can test the shared behavior through any concrete subclass. No test double for `NotificationChannel` needed — use `EmailChannel` or `SmsChannel` and spy on the parts you want to isolate:

```ts
// _test/channels.spec.ts
describe('NotificationChannel (via EmailChannel)', () => {
  it('calls deliver when send is called', async () => {
    const channel = new EmailChannel();
    const spy = jest
      .spyOn(channel as any, 'deliver')
      .mockResolvedValue(undefined);

    await channel.send({ recipient: 'test@example.com', message: 'hello' });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('calls log twice per send (before and after deliver)', async () => {
    const channel = new EmailChannel();
    jest.spyOn(channel as any, 'deliver').mockResolvedValue(undefined);
    const log = jest.spyOn(channel as any, 'log');

    await channel.send({ recipient: 'x@x.com', message: 'hi' });

    expect(log).toHaveBeenCalledTimes(2);
  });
});
```

The `log` count test proves the template method orchestrates both the before and after hooks without the subclass having to do anything — the sequence is locked in the base.

Service tests are straightforward because the channels are injected and can be replaced with spied-on instances:

```ts
// _test/notifications.service.spec.ts
describe('NotificationsService', () => {
  let service: NotificationsService;
  let emailChannel: EmailChannel;
  let smsChannel: SmsChannel;

  beforeEach(() => {
    emailChannel = new EmailChannel();
    smsChannel = new SmsChannel();
    jest.spyOn(emailChannel, 'send').mockResolvedValue(undefined);
    jest.spyOn(smsChannel, 'send').mockResolvedValue(undefined);
    service = new NotificationsService(emailChannel, smsChannel);
  });

  it('sends email and stores a log entry', async () => {
    const log = await service.sendEmail({
      recipient: 'alice',
      email: 'alice@example.com',
      message: 'hello',
    });

    expect(emailChannel.send).toHaveBeenCalled();
    expect(log.channel).toBe('email');
    expect(service.findAll()).toHaveLength(1);
  });

  it('accumulates log entries across calls', async () => {
    await service.sendEmail({ recipient: 'a', email: 'a@a.com', message: 'a' });
    await service.sendSms({ recipient: 'b', phone: '+5511999999999', message: 'b' });

    expect(service.findAll()).toHaveLength(2);
  });
});
```

## Final thoughts

`abstract class`, `extends`, `implements`, and `override` are not academic TypeScript features. They map to real NestJS problems:

- **Abstract class** — shared orchestration across channels, guards, filters, or repositories. Use it when multiple concrete classes share the same sequence but vary in one step.
- **`extends`** — DTO inheritance so validators are not repeated, service inheritance so CRUD boilerplate is not repeated, channel hierarchy so delivery logic is not repeated.
- **`implements`** — satisfying NestJS contracts (`CanActivate`, `ExceptionFilter`, `NestInterceptor`) and your own interfaces. A light touch that just says "this class has the right shape".
- **`override`** — catching typos in method names before they become silent runtime bugs. Turn on `noImplicitOverride` and never guess again.

The template method pattern from `NotificationChannel` is probably the one I reach for most: put the sequence in the base, put the variation in a `protected abstract` method. The base controls the shape of the operation; the subclass controls only what varies.

> Abstract classes own the sequence. Subclasses own the variation.

### Takeaways ✍️

- Prefer abstract classes over interfaces when you need shared behavior alongside the contract.
- `abstract` methods are the extension point between the base and its subclasses, not between the class and its callers.
- Use `protected` to expose extension points to subclasses without leaking them to callers.
- Add `"noImplicitOverride": true` to tsconfig — explicit `override` catches silent method-name typos.
- `super.method()` extends parent behavior; omitting `super` replaces it entirely.
- `@Injectable()` goes on the concrete subclass, not the abstract base.
- DTO validators from a parent class are inherited — type `@Body()` with the concrete class for correct validation.
- Test abstract behavior through a concrete subclass — no test double needed for the base.
- Abstract classes can serve as NestJS DI tokens; pair with `useClass` to swap implementations per environment.
