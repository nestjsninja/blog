---
title: 'NestJS Architecture: DTOs, Services, Transactions, and Boundaries'
excerpt: >-
  A practical discussion about where DTOs should live, how services should
  receive input, when to create interfaces, and how to organize errors,
  interceptors, filters, and transactions in a NestJS application.
date: '2026-06-01T12:00:00.000Z'
author:
  name: Henrique Weiand
  picture: /nestjs-ninja.png
tags:
  - Architecture
  - Clean Architecture
  - DTO
  - NestJS
  - Software Development
  - Typescript
coverImage: >-
  /blog-assets/nestjs-architecture-dtos-services-transactions-and-boundaries/cover.png
ogImage:
  url: >-
    /blog-assets/nestjs-architecture-dtos-services-transactions-and-boundaries/cover.png
---
Hello, dev!

In this post, I want to share a practical architecture discussion that appears a lot when we start building NestJS applications with more care: should services receive DTOs? Should we create interfaces for every input? Where should the mapping happen? What about errors, response DTOs, exception filters, interceptors, and transactions?

This article is not about creating a huge architecture just because it looks beautiful. The main idea is to understand the boundaries in a NestJS application and decide where each responsibility should live.

The official NestJS documentation already gives us the pieces: [controllers](https://docs.nestjs.com/controllers), [providers](https://docs.nestjs.com/providers), [pipes](https://docs.nestjs.com/pipes), [exception filters](https://docs.nestjs.com/exception-filters), [interceptors](https://docs.nestjs.com/interceptors), [serialization](https://docs.nestjs.com/techniques/serialization), and the [request lifecycle](https://docs.nestjs.com/faq/request-lifecycle). What I want to do here is connect those pieces from an architecture perspective.

### The main idea

When we build an API with NestJS, it is very easy to start with this flow:

```tsx
@Post()
create(@Body() dto: CreateOrderDto) {
  return this.orderService.create(dto);
}
```

This works, and for very small applications, it can be enough. The problem starts when the application grows and the service begins to depend on HTTP details.

DTOs are usually created for the API layer. They describe what arrives from the request body, query string, params, and sometimes how the response should be serialized. NestJS works very well with classes for validation because pipes, especially `ValidationPipe`, can validate and transform the incoming request before the controller method runs.

However, the service should represent the application or business behavior. It should not need to know if the data came from REST, GraphQL, a queue, a scheduled job, or a CLI command.

So, the first rule that I like to follow is:

> Controllers translate transport concerns into application concerns.

### DTOs vs service inputs

Let's imagine an order creation endpoint. In the HTTP layer, the DTO can be like this:

```tsx
import { IsArray, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class CreateOrderItemDto {
  @IsString()
  productId: string;

  @IsString()
  quantity: string;
}

export class CreateOrderDto {
  @IsString()
  customerId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
```

This DTO is doing an HTTP job. It receives a payload and helps NestJS validate the request with pipes.

The service input can be another type:

```tsx
export interface CreateOrderInput {
  customerId: string;
  items: {
    productId: string;
    quantity: number;
  }[];
}
```

And the service method becomes:

```tsx
@Injectable()
export class OrderService {
  async create(input: CreateOrderInput): Promise<Order> {
    // business rules, domain creation, repository calls...
  }
}
```

Notice one small but important difference: in the DTO, `quantity` arrived as a string. In the service input, it is already a number. The controller is the place where we can normalize that data before sending it to the service.

### Where should mapping happen?

The mapping should happen at the boundary. In a simple case, the controller can do it directly:

```tsx
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  async create(@Body() dto: CreateOrderDto): Promise<OrderResponseDto> {
    const input: CreateOrderInput = {
      customerId: dto.customerId,
      items: dto.items.map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity),
      })),
    };

    const order = await this.orderService.create(input);

    return OrderResponseDto.fromDomain(order);
  }
}
```

For small payloads, this is clear enough. For bigger modules, I like to introduce a mapper or presenter:

```tsx
export class OrderHttpMapper {
  static toCreateInput(dto: CreateOrderDto): CreateOrderInput {
    return {
      customerId: dto.customerId,
      items: dto.items.map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity),
      })),
    };
  }

  static toResponse(order: Order): OrderResponseDto {
    return OrderResponseDto.fromDomain(order);
  }
}
```

Then the controller becomes a thin bridge:

```tsx
@Post()
async create(@Body() dto: CreateOrderDto): Promise<OrderResponseDto> {
  const order = await this.orderService.create(
    OrderHttpMapper.toCreateInput(dto),
  );

  return OrderHttpMapper.toResponse(order);
}
```

This is one of those decisions that should grow with the project. You do not need a mapper for everything on day one, but you will probably want one when the controller starts becoming noisy.

### Do I need interfaces for everything?

No.

Sometimes we create too many interfaces because we are trying to keep everything "clean", but the result is only more files and more names to maintain.

I usually create a dedicated input type or interface when at least one of these things is true:

- The service is used by more than one transport layer.
- The API contract is different from the application contract.
- The input needs a name from the business language, like `CreateOrderCommand`.
- The service should be protected from validation decorators, Swagger decorators, or HTTP-specific fields.

If the application is small and the DTO is exactly the same shape needed by the service, it is not a tragedy to pass it directly. The important point is to understand the tradeoff.

My practical rule is:

> Start simple, but introduce boundaries when they protect the system from coupling.

### Should services return DTOs?

In most cases, I prefer services to return domain objects, application models, or plain application results. Then the controller maps the result into a response DTO.

```tsx
export class OrderResponseDto {
  id: string;
  status: string;
  total: number;

  static fromDomain(order: Order): OrderResponseDto {
    return {
      id: order.id,
      status: order.status,
      total: order.total,
    };
  }
}
```

The service can return the `Order`:

```tsx
const order = await this.orderService.create(input);

return OrderResponseDto.fromDomain(order);
```

This gives us a few benefits:

- We avoid exposing internal fields accidentally.
- We can change the API response without changing the domain.
- We can keep persistence models away from the external contract.
- We can use NestJS serialization features in the HTTP layer when needed.

The [serialization documentation](https://docs.nestjs.com/techniques/serialization) is useful here, especially when using `ClassSerializerInterceptor`, `@Exclude()`, `@Expose()`, or response classes.

### Error handling inside services

Another common question is: should services catch errors?

My answer is: only when they can do something meaningful.

This does not help:

```tsx
try {
  return await this.customerRepository.findById(customerId);
} catch (error) {
  throw error;
}
```

The service caught the error, but it did not add context, translate it, log it, retry it, or recover from it.

This is better:

```tsx
const customer = await this.customerRepository.findById(customerId);

if (!customer) {
  throw new CustomerNotFoundError(customerId);
}
```

Now the service is speaking the domain language. It is not exposing a database error, Prisma error, TypeORM error, or any other infrastructure detail.

The domain error can be very simple:

```tsx
export class CustomerNotFoundError extends Error {
  constructor(customerId: string) {
    super(`Customer ${customerId} was not found`);
    this.name = 'CustomerNotFoundError';
  }
}
```

At this point, the service does not care if this error becomes a `404`, a GraphQL error, a message sent to a dead-letter queue, or something else. That translation belongs to the boundary.

### Domain errors and HTTP errors

In the HTTP layer, we can translate domain errors into HTTP responses.

One simple mapping could be:

| Domain error | HTTP status |
| --- | --- |
| `CustomerNotFoundError` | `404 Not Found` |
| `OrderAlreadyExistsError` | `409 Conflict` |
| `InvalidOrderError` | `400 Bad Request` |
| `UnauthorizedOrderActionError` | `403 Forbidden` |

NestJS [exception filters](https://docs.nestjs.com/exception-filters) are a good place for this translation:

```tsx
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  NotFoundException,
} from '@nestjs/common';

@Catch(CustomerNotFoundError)
export class CustomerNotFoundFilter implements ExceptionFilter {
  catch(exception: CustomerNotFoundError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const httpError = new NotFoundException(exception.message);

    response.status(httpError.getStatus()).json(httpError.getResponse());
  }
}
```

Another approach is to create a global filter that knows how to map different domain errors:

```tsx
const domainErrorToStatus = new Map<string, number>([
  ['CustomerNotFoundError', 404],
  ['OrderAlreadyExistsError', 409],
  ['InvalidOrderError', 400],
]);
```

The exact implementation is up to your project, but the architecture idea remains the same:

> Services throw meaningful application or domain errors. The HTTP layer translates them.

### Exception filters vs interceptors

I like to keep this distinction very clear:

> Filters handle failures. Interceptors handle successful flows or cross-cutting behavior around the route execution.

Exception filters are for errors. They can format an error response, translate a domain error to HTTP, or add error logging.

Interceptors are different. According to the NestJS lifecycle, interceptors can run before and after the route handler. They are useful for things like:

- Response wrapping
- Serialization
- Metrics
- Logging execution time
- Cache behavior
- Mapping successful responses

For example, a simple response wrapper can be an interceptor:

```tsx
@Injectable()
export class ResponseWrapperInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(
      map((data) => ({
        data,
        metadata: {
          timestamp: new Date().toISOString(),
        },
      })),
    );
  }
}
```

This should not be an exception filter because it is not handling an exception.

On the other hand, this should not be an interceptor:

```tsx
if (error instanceof CustomerNotFoundError) {
  return response.status(404).json(...);
}
```

This is failure translation, so an exception filter is a better fit.

### Transactions

Transactions are one of the places where boundaries can get messy very fast.

Imagine this:

```txt
OrderService starts a transaction
  CustomerService starts another transaction
    PaymentService starts another transaction
```

This is hard to understand, hard to test, and easy to break.

I prefer having one owner for the transaction. Usually, this owner is the use case or orchestrator that knows the complete operation.

```txt
CreateOrderUseCase starts transaction
  Validate customer
  Create order
  Reserve stock
  Register payment intent
Commit transaction
```

In code, the shape can be something like this:

```tsx
@Injectable()
export class CreateOrderUseCase {
  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly orderRepository: OrderRepository,
    private readonly stockService: StockService,
  ) {}

  async execute(input: CreateOrderInput): Promise<Order> {
    return this.transactionManager.run(async (transaction) => {
      const order = Order.create(input);

      await this.orderRepository.create(order, transaction);
      await this.stockService.reserve(order.items, transaction);

      return order;
    });
  }
}
```

The implementation depends on your database library. Prisma, TypeORM, MikroORM, and Mongoose have different APIs for transactions. The architecture point is more important than the specific ORM:

> The operation that knows the full business workflow should own the transaction.

Lower-level services and repositories can receive a transaction context, but they should not secretly create nested transactions unless that is a very intentional decision.

### A practical folder shape

For a medium or large NestJS project, I would be comfortable with a structure like this:

```txt
src
+-- application
|   +-- orders
|       +-- create-order.input.ts
|       +-- create-order.use-case.ts
|       +-- errors
|           +-- customer-not-found.error.ts
+-- domain
|   +-- orders
|       +-- order.ts
+-- infra
|   +-- http
|   |   +-- dto
|   |   |   +-- create-order.dto.ts
|   |   |   +-- order-response.dto.ts
|   |   +-- filters
|   |   |   +-- domain-exception.filter.ts
|   |   +-- mappers
|   |   |   +-- order-http.mapper.ts
|   |   +-- order.controller.ts
|   +-- persistence
|       +-- order.repository.ts
```

This is not the only possible structure. The important thing is that each layer has a reason to exist.

The HTTP folder contains HTTP concerns. The application folder contains use cases and application inputs. The domain folder contains business concepts. The persistence folder contains database details.

### Final thoughts

NestJS gives us a very powerful structure, but it does not force us to separate responsibilities automatically. We still need to decide what belongs to controllers, providers, DTOs, filters, interceptors, and use cases.

My current recommendation is:

- Use DTOs at the transport boundary.
- Map DTOs to service inputs when the boundary matters.
- Let services work with application or domain language.
- Return domain/application results from services.
- Map responses in controllers, presenters, serializers, or mappers.
- Throw domain errors from business code.
- Translate errors with exception filters.
- Use interceptors for successful response transformations and cross-cutting behavior.
- Let one orchestrator own the transaction.

That is it for today. I hope this article helps you make more intentional decisions when organizing your NestJS applications.
