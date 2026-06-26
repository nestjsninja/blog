---
title: 'Validation in NestJS: Pipes, DTOs, and Errors That Fit Your API'
excerpt: >-
  Pipes are the front door of a NestJS request — they transform and validate
  input before it ever reaches a service. This post covers the ValidationPipe
  and DTOs, the options that actually matter (whitelist, transform), parsing and
  custom pipes, a Zod alternative, generating Swagger/OpenAPI docs from the same
  DTOs, and how to make validation failures come back in the same error shape as
  the rest of your API.
date: '2026-08-27T12:00:00.000Z'
author:
  name: Henrique Weiand
  picture: /nestjs-ninja.png
tags:
  - NestJS
  - TypeScript
  - Validation
  - Software Development
coverImage: /blog-assets/nestjs-validation-pipes-dtos/cover.png
ogImage:
  url: /blog-assets/nestjs-validation-pipes-dtos/cover.png
---
Hello, dev!

In the [previous post](https://nestjs-ninja.com/blog/2026-08-20-nestjs-mapped-error-handling-domain-exceptions/) we built a layered error model — a base domain error, per-domain families, and one filter that renders everything into a single response shape. Today we look at the **front door** that decides what even gets into your services: **pipes and validation**.

A service should be able to trust its input. If `book()` receives a `checkOut` that is before `checkIn`, or a `guestEmail` that is not an email, that is not a domain failure to handle later — it is bad input that should be rejected at the edge, before any business logic runs. In NestJS, that edge is a **pipe**.

> Validation is not error handling. It is the boundary that keeps invalid data out.

## Where pipes run

A pipe sits between the parsed request and your handler. In the request pipeline the order is:

```
middleware → guards → interceptors → pipes → route handler
```

By the time a pipe runs, the request is authenticated and authorized; the pipe's job is the last gate before your code: **transform** the raw value (a string `"42"` into a number, a plain object into a DTO instance) and **validate** it (reject anything that does not fit). If a pipe throws, the handler never runs.

Pipes apply to whatever they are bound to — a `@Body()`, a `@Param()`, a `@Query()`, or globally to all of them.

## The ValidationPipe and DTOs

The built-in `ValidationPipe` validates an incoming object against a **DTO class** decorated with [class-validator](https://github.com/typestack/class-validator) rules. Describe the shape once:

```ts
// reservations/dto/create-reservation.dto.ts
import { IsEmail, IsInt, IsISO8601, IsString, Length, Min } from 'class-validator';

export class CreateReservationDto {
  @IsString()
  @Length(3, 32)
  reference!: string;

  @IsInt()
  @Min(1)
  roomId!: number;

  @IsEmail()
  guestEmail!: string;

  @IsISO8601()
  checkIn!: string;

  @IsISO8601()
  checkOut!: string;
}
```

Wire `ValidationPipe` globally so every DTO is checked without decorating each handler. Registering it as `APP_PIPE` (rather than `app.useGlobalPipes`) means it participates in DI, so custom validators can inject providers:

```ts
// app.module.ts
import { APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';

@Module({
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
  ],
})
export class AppModule {}
```

The controller just declares the DTO type — no validation code in sight:

```ts
@Post()
book(@Body() dto: CreateReservationDto) {
  return this.reservations.book(dto);
}
```

### The three options that matter

Most of the `ValidationPipe` config is noise; these three are the ones to get right:

- **`whitelist: true`** strips any property not declared on the DTO. This is a security feature, not a nicety: it stops **mass assignment**, where a client sends `{ "role": "admin", … }` and it silently flows into your entity. With `whitelist`, unknown fields simply disappear.
- **`forbidNonWhitelisted: true`** goes further and *rejects* the request when unknown fields are present, instead of stripping them. Good for catching client mistakes early.
- **`transform: true`** runs class-transformer so the handler receives a real `CreateReservationDto` instance (not a plain object), and primitive route params/queries are coerced to their declared types. Without it, a `@Param('id') id: number` is still the string `"42"`.

One caveat on transform: `transformOptions: { enableImplicitConversion: true }` will coerce based on the TypeScript type alone, which can hide bugs (a non-numeric string becoming `NaN`). I prefer explicit `@Type(() => Number)` from class-transformer on the fields that need it, and leaving implicit conversion off.

### Validating nested objects and arrays

Real payloads nest. A reservation might carry a `guest` object and a list of `extras`. The catch: **class-validator does not recurse on its own.** You have to ask it to, with `@ValidateNested()`, and you have to tell class-transformer which class to build, with `@Type()`. Miss either decorator and the nested data is treated as an opaque object — validated as nothing at all:

```ts
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsInt, IsString, Length, Min, ValidateNested } from 'class-validator';

export class GuestDto {
  @IsString() @Length(1, 120)
  name!: string;

  @IsInt() @Min(1)
  partySize!: number;
}

export class ExtraDto {
  @IsString()
  code!: string;
}

export class CreateReservationDto {
  // …reference, roomId, checkIn, checkOut…

  @ValidateNested()                 // recurse into the nested object
  @Type(() => GuestDto)             // tell class-transformer which class to build
  guest!: GuestDto;

  @ValidateNested({ each: true })   // validate every item in the array
  @ArrayMaxSize(10)
  @Type(() => ExtraDto)
  extras!: ExtraDto[];
}
```

Two rules to keep in mind:

- **`@Type(() => Child)` is mandatory.** Without it, `transform` produces a plain object, the child instance is never created, and the nested decorators silently pass.
- **`{ each: true }`** makes `@ValidateNested` — and most class-validator decorators, like `@IsString` — apply to *each element* of an array rather than to the array itself.

For Swagger (covered below), point `@ApiProperty({ type: GuestDto })` or `@ApiProperty({ type: [ExtraDto] })` at the child DTO so the nested schema is documented too.

### A field-decorator cheat sheet

class-validator ships a large vocabulary; these are the ones worth keeping at hand for everyday DTOs:

- **Presence / optionality:** `@IsOptional` (skip the remaining checks when the value is missing), `@IsDefined`, `@IsNotEmpty`.
- **Primitives:** `@IsString`, `@IsInt`, `@IsNumber`, `@IsBoolean`, `@IsEnum(MyEnum)`, `@IsDate`.
- **Strings:** `@Length(min, max)`, `@MinLength` / `@MaxLength`, `@Matches(/regex/)`, `@IsEmail`, `@IsUrl`, `@IsUUID`, `@IsISO8601` (dates as strings).
- **Numbers:** `@Min`, `@Max`, `@IsPositive`, `@IsInt`.
- **Arrays:** `@IsArray`, `@ArrayMinSize` / `@ArrayMaxSize`, `@ArrayUnique`, plus `{ each: true }` on any item-level rule.
- **Coercion (class-transformer):** `@Type(() => Number)` to convert query/param strings before validating, `@Transform(({ value }) => value.trim())` for ad-hoc tweaks.

One subtle but important behavior: **`@IsOptional` short-circuits the rest of the chain when the value is `undefined` or `null`.** So `@IsOptional() @IsString() note?: string` accepts a missing `note` but still rejects `note: 42`. Pair it with `@ApiPropertyOptional` so the docs and the validator agree.

## Parsing pipes for params and queries

Route params and query strings arrive as strings. For single values, the built-in parsing pipes are simpler than a DTO:

```ts
import { DefaultValuePipe, ParseIntPipe, ParseUUIDPipe } from '@nestjs/common';

@Get(':id')
get(@Param('id', ParseIntPipe) id: number) {
  return this.reservations.getById(id);
}

@Get()
list(
  @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  @Query('roomId', new ParseUUIDPipe({ optional: true })) roomId?: string,
) {
  return this.reservations.list({ page, roomId });
}
```

`ParseIntPipe`, `ParseBoolPipe`, `ParseUUIDPipe`, `ParseEnumPipe`, and `ParseArrayPipe` each validate *and* convert, and `DefaultValuePipe` fills in a value before the next pipe runs. If `id` is not an integer, the request is rejected before `getById` is called.

## Writing a custom pipe

When the built-ins do not fit, a pipe is just a class implementing `PipeTransform`. Here is one that turns a comma-separated query (`?amenities=wifi,parking`) into a validated string array:

```ts
// common/pipes/parse-csv.pipe.ts
import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class ParseCsvPipe implements PipeTransform<string | undefined, string[]> {
  transform(value: string | undefined, _metadata: ArgumentMetadata): string[] {
    if (!value) return [];
    return value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  }
}
```

```ts
@Get()
search(@Query('amenities', ParseCsvPipe) amenities: string[]) {
  return this.rooms.search(amenities);
}
```

`transform(value, metadata)` receives the raw value and metadata about where it came from (`body`, `query`, `param`, the expected type). Return the transformed value, or throw to reject. That is the whole contract.

Cross-field rules — "`checkOut` must be after `checkIn`" — are better expressed as a custom class-validator constraint on the DTO, so they live with the shape:

```ts
import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export function IsAfter(property: string, options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isAfter',
      target: object.constructor,
      propertyName,
      constraints: [property],
      options,
      validator: {
        validate(value: string, args: ValidationArguments) {
          const other = (args.object as Record<string, string>)[args.constraints[0]];
          return Boolean(value) && Boolean(other) && value > other;
        },
        defaultMessage: (args) => `${args.property} must be after ${args.constraints[0]}`,
      },
    });
}
```

```ts
export class CreateReservationDto {
  // …
  @IsISO8601()
  checkIn!: string;

  @IsISO8601()
  @IsAfter('checkIn')
  checkOut!: string;
}
```

## Make validation errors fit your API

Here is the part that ties back to [last week](https://nestjs-ninja.com/blog/2026-08-20-nestjs-mapped-error-handling-domain-exceptions/). By default `ValidationPipe` throws a `BadRequestException` whose body is NestJS-shaped — `{ "statusCode": 400, "message": ["checkOut must be after checkIn", …], "error": "Bad Request" }`. That does **not** match the `{ error: { code, message, details } }` envelope the rest of your API returns. A client now has two error formats to parse.

Fix it with `exceptionFactory`: convert class-validator's errors into a **domain error**, and let the same exception filter render it.

```ts
// validation/validation.errors.ts
import { DomainError } from '../errors/domain.error';

export class ValidationFailed extends DomainError<{
  fields: Record<string, string[]>;
}> {
  readonly domain = 'validation';
  readonly reason = 'invalid_input';
  readonly status = 422;

  constructor(fields: Record<string, string[]>) {
    super('Request validation failed', { details: { fields } });
  }
}
```

```ts
import { ValidationError, ValidationPipe } from '@nestjs/common';

function toFields(errors: ValidationError[], parent = ''): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const error of errors) {
    const path = parent ? `${parent}.${error.property}` : error.property;
    if (error.constraints) {
      fields[path] = Object.values(error.constraints);
    }
    if (error.children?.length) {
      Object.assign(fields, toFields(error.children, path)); // nested objects/arrays
    }
  }
  return fields;
}

export const validationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  exceptionFactory: (errors) => new ValidationFailed(toFields(errors)),
});
```

Now an invalid request comes back in the same shape as every other error, and the frontend handles one format:

```json
{
  "error": {
    "code": "validation.invalid_input",
    "message": "Request validation failed",
    "details": {
      "fields": {
        "guestEmail": ["guestEmail must be an email"],
        "checkOut": ["checkOut must be after checkIn"]
      }
    }
  }
}
```

`validation.invalid_input` is a stable code the client can switch on, and `details.fields` is structured per-field feedback the form can render inline — no string-matching a message array.

## A Zod alternative

class-validator is decorator-first and pairs naturally with DTO classes and Swagger. If you prefer **schema-first** validation with types *inferred* from the schema, [Zod](https://zod.dev) fits NestJS through a tiny custom pipe:

```ts
// common/pipes/zod-validation.pipe.ts
import { Injectable, PipeTransform } from '@nestjs/common';
import { ZodSchema } from 'zod';
import { ValidationFailed } from '../../validation/validation.errors';

@Injectable()
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const fields: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const path = issue.path.join('.') || '_';
        (fields[path] ??= []).push(issue.message);
      }
      throw new ValidationFailed(fields);
    }
    return result.data;
  }
}
```

```ts
const createReservationSchema = z.object({
  reference: z.string().min(3).max(32),
  roomId: z.number().int().positive(),
  guestEmail: z.string().email(),
  checkIn: z.string().date(),
  checkOut: z.string().date(),
});
type CreateReservation = z.infer<typeof createReservationSchema>;

@Post()
book(@Body(new ZodValidationPipe(createReservationSchema)) dto: CreateReservation) {
  return this.reservations.book(dto);
}
```

Note it throws the **same `ValidationFailed`** domain error, so the response shape is identical whichever library you pick. The trade-off: class-validator keeps validation on the DTO class (great with `@nestjs/swagger`), while Zod gives you one schema as the single source of truth for both validation and the inferred type, with no decorators.

## Documentation for free: Swagger

A DTO is already a precise description of your input, so [`@nestjs/swagger`](https://docs.nestjs.com/openapi/introduction) turns that same class into an OpenAPI schema — your validation rules and your API docs come from one place and never drift.

First install it:

```bash
npm install @nestjs/swagger
```

Then enable it once in `main.ts`:

```ts
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

const config = new DocumentBuilder()
  .setTitle('Bookings API')
  .setVersion('1.0')
  .build();
SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
```

`/docs` now serves interactive documentation. The real magic is the **CLI plugin** — add it to `nest-cli.json`:

```json
{ "compilerOptions": { "plugins": ["@nestjs/swagger"] } }
```

With the plugin, Nest infers the OpenAPI schema straight from your TypeScript types and class-validator decorators: required vs optional (`?`), the property types, and constraints like `@Min` / `@Length` all flow into the schema automatically. The `CreateReservationDto` from earlier documents itself — no extra annotations. Reach for `@ApiProperty` only to *enrich* (a description, an example, an enum):

```ts
@ApiProperty({ example: 'RES-1024', description: 'Unique booking reference' })
@IsString()
@Length(3, 32)
reference!: string;
```

Derived DTOs stay in sync through **mapped types** — `PartialType`, `PickType`, `OmitType`, and `IntersectionType` carry both the validation decorators *and* the schema across, covered in their own section just below. That is the strongest argument for class-validator DTOs: one class is the type, the validator, and the documentation at once.

### Documenting every field by hand

The CLI plugin fills in the basics, but for anything a consumer actually reads — descriptions, examples, enums, formats, bounds — annotate explicitly. Here is the same `CreateReservationDto`, fully described. `@ApiProperty` / `@ApiPropertyOptional` accept the full OpenAPI vocabulary, and the annotations sit right next to the class-validator rules:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsInt, IsISO8601, IsString, Length, Min } from 'class-validator';

export enum BoardType {
  RoomOnly = 'room_only',
  Breakfast = 'breakfast',
  AllInclusive = 'all_inclusive',
}

export class CreateReservationDto {
  @ApiProperty({
    description: 'Unique, human-readable booking reference',
    example: 'RES-1024',
    minLength: 3,
    maxLength: 32,
  })
  @IsString()
  @Length(3, 32)
  reference!: string;

  @ApiProperty({ description: 'Id of the room to book', example: 42, minimum: 1 })
  @IsInt()
  @Min(1)
  roomId!: number;

  @ApiProperty({ format: 'email', example: 'guest@example.com' })
  @IsEmail()
  guestEmail!: string;

  @ApiProperty({ format: 'date', example: '2026-01-10' })
  @IsISO8601()
  checkIn!: string;

  @ApiProperty({ format: 'date', example: '2026-01-12' })
  @IsISO8601()
  checkOut!: string;

  @ApiProperty({ enum: BoardType, enumName: 'BoardType', example: BoardType.Breakfast })
  @IsEnum(BoardType)
  board!: BoardType;

  @ApiPropertyOptional({
    description: 'Free-text notes for the front desk',
    example: 'Late check-in, arriving around 23:00',
    maxLength: 280,
  })
  @IsString()
  @Length(0, 280)
  notes?: string;
}
```

The options worth keeping in your back pocket: `description`, `example` (or `examples`), `enum` + `enumName`, `format` (`email`, `date`, `date-time`, `uuid`, …), numeric `minimum`/`maximum`, string `minLength`/`maxLength`, `default`, `nullable`, `deprecated`, and for collections `type: [String]` or `isArray: true`. Each field now carries both its runtime check *and* its documented contract.

### Composing DTOs with mapped types

Most DTOs are variations of one another — create, update, a filtered query. Instead of redeclaring fields (and their validators *and* their `@ApiProperty`s), derive them with **mapped types** from `@nestjs/swagger`. Each one copies the validation decorators and the OpenAPI schema across, so the derived DTO is documented and validated for free.

**`PartialType`** — every field becomes optional. Perfect for `PATCH`:

```ts
import { PartialType } from '@nestjs/swagger';
export class UpdateReservationDto extends PartialType(CreateReservationDto) {}
```

**`PickType`** — keep only some fields. A reschedule endpoint needs just the dates:

```ts
import { PickType } from '@nestjs/swagger';
export class RescheduleReservationDto extends PickType(CreateReservationDto, [
  'checkIn',
  'checkOut',
] as const) {}
```

**`OmitType`** — keep everything except some fields. Walk-in bookings let the system generate the reference, so the client must not send it:

```ts
import { OmitType } from '@nestjs/swagger';
export class CreateWalkInReservationDto extends OmitType(CreateReservationDto, [
  'reference',
] as const) {}
```

**`IntersectionType`** — merge two DTOs into one. The classic case is a list query assembled from reusable pagination + filter DTOs:

```ts
import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

class PaginationQuery {
  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page = 1;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit = 20;
}

class ReservationFilterQuery {
  @ApiPropertyOptional({ enum: ['confirmed', 'cancelled'] })
  @IsOptional() @IsIn(['confirmed', 'cancelled'])
  status?: 'confirmed' | 'cancelled';
}

export class ListReservationsQuery extends IntersectionType(
  PaginationQuery,
  ReservationFilterQuery,
) {}
```

```ts
@Get()
list(@Query() query: ListReservationsQuery) {
  return this.reservations.list(query); // { page, limit, status? } — validated + documented
}
```

They compose, too: `PartialType(PickType(CreateReservationDto, ['checkIn', 'checkOut'] as const))` is a valid, fully typed-and-documented DTO. Import the mapped types from `@nestjs/swagger` (not `@nestjs/mapped-types`) so the OpenAPI schema travels along with the validators.

### Type your responses too

DTOs are not only for input. Define a **response DTO** so the success body is documented and type-checked — and avoid returning entities directly, which leak columns and relations you did not mean to expose. A response DTO is your public output contract:

```ts
export class ReservationDto {
  @ApiProperty({ example: 42 }) id!: number;
  @ApiProperty({ example: 'RES-1024' }) reference!: string;
  @ApiProperty({ example: 42 }) roomId!: number;
  @ApiProperty({ format: 'email', example: 'guest@example.com' }) guestEmail!: string;
  @ApiProperty({ format: 'date', example: '2026-01-10' }) checkIn!: string;
  @ApiProperty({ format: 'date', example: '2026-01-12' }) checkOut!: string;
  @ApiProperty({ enum: ['confirmed', 'cancelled'], example: 'confirmed' }) status!: string;

  static from(reservation: Reservation): ReservationDto {
    return Object.assign(new ReservationDto(), {
      id: reservation.id,
      reference: reservation.reference,
      roomId: reservation.roomId,
      guestEmail: reservation.guestEmail,
      checkIn: reservation.checkIn,
      checkOut: reservation.checkOut,
      status: reservation.status,
    });
  }
}
```

Return it from the handler and point `@ApiOkResponse({ type: ReservationDto })` at it (shown under *Richer endpoint docs* below). For nested or list responses, use `@ApiProperty({ type: () => RoomDto })` or `type: [ReservationDto]` to reference the child DTO. If you would rather not hand-write a mapper, there is a second approach built on class-transformer's `@Exclude()` / `@Expose()` and a `ClassSerializerInterceptor` — worth its own section, next.

### Serializing responses with `@Exclude` and `@Expose`

Writing a `from()` mapper for every response DTO gets tedious, and it is easy to forget a field. NestJS offers a second approach: decorate the class with class-transformer's `@Exclude` / `@Expose`, return an instance of it, and let a `ClassSerializerInterceptor` strip anything that is not meant to be public.

**When to use which.** Reach for serialization (over a hand-written mapper) when your response is *close to* an entity and you mainly need to **hide** a few fields — password hashes, internal flags, soft-delete columns. Reach for an explicit response DTO + `from()` when the response shape genuinely differs from the entity (renamed or computed fields, flattened relations), because that keeps the transformation visible and unit-testable.

**How.** Turn the interceptor on globally:

```ts
// app.module.ts
import { ClassSerializerInterceptor } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

providers: [{ provide: APP_INTERCEPTOR, useClass: ClassSerializerInterceptor }];
```

Then annotate the class. The safest default is **`@Exclude()` on the class** (hide everything) with `@Expose()` on the fields you publish — that way a forgotten decorator leaks *nothing* instead of leaking a secret:

```ts
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class UserDto {
  @Expose() id!: number;
  @Expose() email!: string;

  passwordHash!: string; // no @Expose → never serialized

  @Expose()
  get displayName() {     // computed fields work too
    return this.email.split('@')[0];
  }
}
```

The interceptor runs `instanceToPlain` on whatever the handler returns, so you must return a **class instance** — a plain object is passed through untouched. Useful extras:

- **`@Exclude()` on a single property** (instead of the whole class) when you only need to hide one or two fields and are happy to expose the rest by default. This is the "allowlist vs denylist" choice: class-level `@Exclude` is the safer allowlist; property-level `@Exclude` is the convenient denylist.
- **`@Expose({ groups: ['admin'] })`** combined with `@SerializeOptions({ groups: ['admin'] })` on a handler shows a field only to certain callers.
- **`@Transform(({ value }) => …)`** reshapes a value on the way out (format a date, round a number).

**Why it matters.** It is a safety net: the password hash never depends on a developer remembering to omit it in a mapper. The trade-off is that the transformation is implicit — it lives in decorators rather than in a function you can read top to bottom — so for anything beyond hiding fields, the explicit response DTO is easier to reason about. Many codebases use both: serialization to guarantee secrets never leak, explicit DTOs where the output really is a different shape.

### Auth, headers, and persisted tokens

Most APIs are not public, and a docs page you cannot authenticate against is half useful. Declare the auth scheme on the document, turn on **`persistAuthorization`** so the token you type survives page reloads (Swagger keeps it in the browser — no re-pasting it on every refresh), and mark the routes that need it.

```ts
const config = new DocumentBuilder()
  .setTitle('Bookings API')
  .setDescription('Reservations and rooms')
  .setVersion('1.0')
  .addBearerAuth()                  // a JWT "bearer" scheme + an Authorize button
  .addServer('http://localhost:3000')
  .build();

SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config), {
  swaggerOptions: { persistAuthorization: true }, // remember the token across reloads
});
```

Mark the protected routes so Swagger sends the token (and shows a lock icon):

```ts
@ApiBearerAuth()
@Controller('reservations')
export class ReservationsController { /* … */ }
```

For a custom header a route requires — a tenant id, an idempotency key — `@ApiHeader` both documents it and adds an input field in the UI:

```ts
@ApiHeader({ name: 'X-Tenant-Id', required: true, description: 'Tenant the request belongs to' })
@Post()
book(@Body() dto: CreateReservationDto) { /* … */ }
```

#### Multiple auth methods

`addBearerAuth` is one of several schemes — `addApiKey`, `addBasicAuth`, `addCookieAuth`, and `addOAuth2`. A real API often supports more than one (a user JWT *and* a service API key, say). Register each on the builder and give it a **name** (the last argument) so you can target it per route:

```ts
const config = new DocumentBuilder()
  .setTitle('Bookings API')
  .setVersion('1.0')
  .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
  .addApiKey({ type: 'apiKey', name: 'X-Api-Key', in: 'header' }, 'api-key')
  .addBasicAuth({ type: 'http', scheme: 'basic' }, 'basic')
  // .addSecurityRequirements('access-token') // make one apply to every route by default
  .build();
```

The **Authorize** dialog now lists all three. Apply the one a route needs by its name — `@ApiBearerAuth(name)` targets a bearer scheme, `@ApiSecurity(name)` targets any named scheme:

```ts
@ApiBearerAuth('access-token')      // user JWT
@Get('me')
me() { /* … */ }

@ApiSecurity('api-key')            // service-to-service key
@Post('webhooks/payment')
webhook() { /* … */ }
```

Stack the decorators when a route requires more than one (a JWT *and* an API key together). Put a decorator on the controller to cover all its routes, or use `.addSecurityRequirements('access-token')` on the builder to default every operation to a scheme.

### Richer endpoint docs

A handful of decorators turn a bare schema into docs people can actually use:

- **`@ApiTags('reservations')`** groups endpoints into sections.
- **`@ApiOperation({ summary, description })`** gives each route a title and explanation.
- **`@ApiQuery` / `@ApiParam`** document query/route params (mark them optional, add examples).
- **`@ApiOkResponse` / `@ApiCreatedResponse` / `@ApiResponse`** document the responses — including your *error* shapes.

That last point closes the loop with last week's error model: describe the envelope once as a DTO and attach it to the responses, so consumers see exactly what a failure looks like.

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class ApiError {
  @ApiProperty({ example: 'validation.invalid_input' }) code!: string;
  @ApiProperty({ example: 'Request validation failed' }) message!: string;
  @ApiPropertyOptional({ type: Object }) details?: Record<string, unknown>;
}

export class ApiErrorResponse {
  @ApiProperty({ type: ApiError }) error!: ApiError;
}
```

```ts
@ApiTags('reservations')
@ApiBearerAuth()
@Controller('reservations')
export class ReservationsController {
  @Post()
  @ApiOperation({ summary: 'Book a reservation' })
  @ApiCreatedResponse({ type: ReservationDto })
  @ApiResponse({ status: 422, description: 'Validation failed', type: ApiErrorResponse })
  @ApiResponse({ status: 404, description: 'Room not found', type: ApiErrorResponse })
  book(@Body() dto: CreateReservationDto) { /* … */ }

  @Get(':id')
  @ApiParam({ name: 'id', example: 42 })
  @ApiOkResponse({ type: ReservationDto })
  @ApiResponse({ status: 404, description: 'Reservation not found', type: ApiErrorResponse })
  get(@Param('id', ParseIntPipe) id: number) { /* … */ }
}
```

Now `/docs` shows each endpoint grouped and authorizable, with its success body **and** the exact error envelope it returns — docs and implementation kept honest by the same DTOs.

### Swagger with Zod

A Zod schema is not a class, so `@nestjs/swagger`'s class reflection cannot see it on its own. The bridge is [`nestjs-zod`](https://github.com/BenLorantfy/nestjs-zod): `createZodDto(schema)` builds a DTO class from a Zod schema that works as both a validation target *and* a Swagger model, and `patchNestjsSwagger()` teaches `SwaggerModule` to read it.

```ts
import { createZodDto, patchNestjsSwagger } from 'nestjs-zod';

export class CreateReservationDto extends createZodDto(createReservationSchema) {}

// call once, before SwaggerModule.createDocument(...)
patchNestjsSwagger();
```

Now the Zod schema is the single source of truth for the inferred type, validation, **and** the OpenAPI schema. (`nestjs-zod` also ships its own `ZodValidationPipe`, so you can drop the hand-rolled one if you adopt it.) Without a bridge like this, Zod still gives you types and validation — but not automatic docs, which is the main thing you trade away versus class-validator.

## Testing validation

A pipe is a plain class, so unit-testing one is direct:

```ts
it('splits and trims a CSV query', () => {
  expect(new ParseCsvPipe().transform(' wifi , parking ', {} as ArgumentMetadata))
    .toEqual(['wifi', 'parking']);
});
```

For DTO rules, an e2e test asserting the response contract is the most valuable — it proves both the rule and the error shape your clients depend on:

```ts
it('rejects an invalid booking with the standard error shape', async () => {
  const res = await request(app.getHttpServer())
    .post('/reservations')
    .send({ reference: 'ab', roomId: 0, guestEmail: 'nope', checkIn: '2026-01-10', checkOut: '2026-01-05' })
    .expect(422);

  expect(res.body.error.code).toBe('validation.invalid_input');
  expect(res.body.error.details.fields).toHaveProperty('guestEmail');
  expect(res.body.error.details.fields).toHaveProperty('checkOut');
});
```

## Wrapping up

Pipes are the boundary that keeps invalid data out of your services:

- **DTOs + `ValidationPipe`** describe and enforce the shape, with `whitelist`/`transform` doing the heavy lifting (and quietly preventing mass assignment),
- **parsing pipes** validate and convert single params and queries,
- **custom pipes** and **custom validators** handle the cases the built-ins do not,
- the **same DTOs generate your Swagger/OpenAPI docs** — validation and documentation from one source (and `nestjs-zod` brings Zod schemas along too),
- and an **`exceptionFactory`** makes validation failures come back in the *same* error envelope as the rest of your API — one shape, one stable code, structured per-field details.

Validate at the edge, and your services get to assume their input is already good.
