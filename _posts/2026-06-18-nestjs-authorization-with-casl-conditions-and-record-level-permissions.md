---
title: >-
  NestJS Authorization with CASL (Part 2): Conditions and Record-Level
  Permissions
excerpt: >-
  The sequel to the CASL authorization post. We go from "editors can update
  articles" to "editors can update their own articles" using CASL conditions,
  subject detection, a two-layer guard plus service check, query filtering, and
  field-level permissions in NestJS.
date: '2026-06-18T12:00:00.000Z'
author:
  name: Henrique Weiand
  picture: /nestjs-ninja.png
tags:
  - NestJS
  - Authorization
  - CASL
  - Permissions
  - Typescript
  - Software Development
coverImage: >-
  /blog-assets/nestjs-authorization-with-casl-conditions-and-record-level-permissions/cover.png
ogImage:
  url: >-
    /blog-assets/nestjs-authorization-with-casl-conditions-and-record-level-permissions/cover.png
---
Hello, dev!

In the [previous post](https://nestjs-ninja.com/blog/2026-06-11-nestjs-authorization-with-casl-abilities-roles-and-guards/) we built an authorization layer in NestJS with [@casl/ability](https://casl.js.org/): a `Role` enum, an `AuthorizationUser` that answers role questions, one permission file per subject, an `AbilityFactory`, and a guard with a `CheckAbility` decorator.

Everything there was **role-based**. The rules answered questions like "can editors update articles?". And right at the end I left this line as a teaser:

```ts
allow('update', 'Article', { authorId: user.id });
```

That third argument changes the whole game. It moves us from role-based ("editors can update articles") to **record-based** ("editors can update *their own* articles"). Today we go deep into that.

> Role-based asks "can this user update articles?". Record-based asks "can this user update *this* article?".

If you have not read part 1, I recommend starting there, because we will reuse the exact same structure and only add conditions on top of it.

💻 The full, runnable example is on GitHub: [nestjsninja/nestjs-authorization-casl-conditions](https://github.com/nestjsninja/nestjs-authorization-casl-conditions).

## What a condition actually is 🧠

When you build an ability with `createMongoAbility` (which we did in part 1), CASL accepts a third argument that is a **MongoDB-style query object**. The rule only applies when the record matches that query.

```ts
allow('update', 'Article', { authorId: user.id });
```

This reads as: "allow `update` on an `Article`, but only when the article's `authorId` equals this user's id".

The query object is not limited to equality. CASL understands operators like `$in`, `$gt`, `$lt`, `$ne`, `$all`, and nested fields:

```ts
allow('read', 'Article', { status: { $in: ['published', 'archived'] } });
allow('refund', 'Order', { total: { $lte: 100 } });
allow('update', 'Order', { 'customer.tier': 'premium' });
```

That is the same query language you already know from MongoDB, and it is why the factory uses `createMongoAbility`. This is also the reason I told you, in part 1, to pick that factory from day one even when you only had simple role rules.

## The gotcha: how does CASL know the subject type? 🕵️

Here is the part that confuses almost everyone the first time, so let's get it out of the way early.

A condition like `{ authorId: user.id }` can only be evaluated against a **real record**. So instead of checking against a string subject, you now check against an object:

```ts
ability.can('update', article); // article is a real object from the database
```

But CASL needs to know that `article` is an `Article`. How? By default it looks at `article.constructor.name`. That works if `article` is an instance of a class named `Article`. The problem is that records coming from Prisma, TypeORM (with plain objects), or a raw query are usually **plain objects**, and their constructor is just `Object`.

There are two clean ways to solve this.

### Option 1: tag the object with the `subject` helper

CASL ships a tiny helper that attaches the type to a plain object:

```ts
import { subject } from '@casl/ability';

ability.can('update', subject('Article', article));
```

This is my default. It is explicit, it works with any plain object, and it does not force you to wrap database results in classes.

### Option 2: configure `detectSubjectType` once

If your records always carry a type field (for example a Prisma model name, a `__typename`, or your own `kind` property), you can teach the builder how to detect the type, and then never call `subject()` again:

```ts
return builder.build({
  detectSubjectType: (item) => item.kind,
});
```

Both are valid. I will use `subject()` in this article because it keeps the example explicit and does not assume anything about your data shape.

> A condition needs a record. A record needs a known type. Use `subject()` or `detectSubjectType` so CASL can match the rule.

## Adding conditions to the permission file ✍️

Let's upgrade the `Article` permissions from part 1. First, I like to describe the shape of the subject so the conditions are type-checked:

```ts
// permissions/article.ts
import { AbilityBuilder, MongoAbility } from '@casl/ability';

import { AuthorizationUser } from '../authorization-user';
import { CrudAction } from './crud';

export interface Article {
  id: string;
  authorId: string;
  status: 'draft' | 'published' | 'archived';
}

export type ArticleSubject = 'Article';

export type ArticleActions = CrudAction | 'publish' | 'archive';

// the subject can be the string (type-level checks) or a record (conditions)
export type ArticleAbilities = [ArticleActions, ArticleSubject | Article];

export function defineArticlePermissions(
  { can: allow, cannot: forbid }: AbilityBuilder<MongoAbility<ArticleAbilities>>,
  user: AuthorizationUser,
) {
  if (user.isSuperAdmin()) {
    allow('manage', 'Article');
    return;
  }

  if (user.isEditor()) {
    // editors can read every article
    allow('read', 'Article');

    // but only create and change their own
    allow(['create', 'update', 'publish', 'archive'], 'Article', {
      authorId: user.id,
    });

    // and nobody edits an article that was already archived
    forbid('update', 'Article', { status: 'archived' });
  }

  if (user.isViewer()) {
    // viewers only see published content
    allow('read', 'Article', { status: 'published' });
  }
}
```

By adding `Article` to the subject union (`ArticleSubject | Article`), the condition object `{ authorId: user.id }` is now type-checked against the real fields. A typo like `{ autohrId: ... }` becomes a compile error.

Notice two new ideas here.

The first is `allow` *with* a condition next to `allow` *without* one. Editors can `read` any article, but only `update` their own. Those are two different rules for the same subject, and that is perfectly fine.

The second is `forbid` (CASL's `cannot`). This is a rule that **removes** a permission. The order matters: a `cannot` rule is only effective if it comes after the `can` it is meant to restrict, because CASL evaluates rules in order and the last matching rule wins. So "editors can update their own articles, **except** archived ones" is expressed by allowing first and forbidding after.

> `can` grants, `cannot` revokes. Define the revoke rule after the grant, because the last matching rule wins.

## The two-layer model 🛡️

Now the most important architectural point of this post, and the one that trips people up when they try to put conditions inside the guard.

Remember from part 1 that the guard runs **before** the route handler. At that moment, we do not have the article yet. We only know the user and the action they want to perform. So the guard simply **cannot** evaluate `{ authorId: user.id }`, because there is no record to compare against.

This is not a limitation we fight. It is actually a clean separation:

- **Layer 1 — the guard (coarse, type-level).** "Can this user update articles *at all*?" This is a cheap gate that blocks users who have no business on the endpoint.
- **Layer 2 — the service (fine, instance-level).** "Can this user update *this specific* article?" This runs after we load the record.

The nice thing is that CASL makes layer 1 work automatically. When you check against the **string** subject, conditions are ignored and the check is optimistic:

```ts
// only a conditional rule exists: allow('update', 'Article', { authorId })
ability.can('update', 'Article'); // true  -> "maybe, for some article"
ability.can('update', subject('Article', someArticle)); // depends on the record
```

So the guard from part 1 keeps working unchanged. `@CheckAbility(['update', 'Article'])` lets through anyone who *could* update *some* article, and then the service decides if they can update *this* one.

```ts
@Patch(':id')
@CheckAbility(['update', 'Article']) // layer 1: coarse gate
update(@Param('id') id: string, @Body() dto: UpdateArticleDto, @Req() req) {
  return this.articleService.update(req.user, id, dto);
}
```

## Enforcing the condition in the service 🔒

Layer 2 lives where the record is loaded. CASL gives us a clean way to throw a `403` with `ForbiddenError`:

```ts
import { ForbiddenError, subject } from '@casl/ability';
import { Injectable, NotFoundException } from '@nestjs/common';

import { AbilityFactory, AuthorizationUser } from '@app/authorization';

@Injectable()
export class ArticleService {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly abilityFactory: AbilityFactory,
  ) {}

  async update(user: AuthorizationUser, id: string, dto: UpdateArticleDto) {
    const article = await this.repo.findById(id);

    if (!article) {
      throw new NotFoundException();
    }

    const ability = this.abilityFactory.createForUser(user);

    ForbiddenError.from(ability)
      .setMessage('You can only update your own articles')
      .throwUnlessCan('update', subject('Article', article));

    return this.repo.update(id, dto);
  }
}
```

`throwUnlessCan` does exactly what it says: if the ability does not allow the action on that record, it throws a `ForbiddenError`. You can catch it in an exception filter and translate it into a NestJS `ForbiddenException` (we talked about that error-translation idea in the [architecture post](https://nestjs-ninja.com/blog/2026-06-01-nestjs-architecture-dtos-services-transactions-and-boundaries/)), or register CASL's error globally.

The key detail is `subject('Article', article)`. Without it, CASL would look at `article.constructor` and have no idea this plain object is an `Article`, so the condition would never match.

> Coarse check in the guard, fine check in the service. The service is where the record exists, so that is where conditions belong.

## Lists: do not fetch everything and filter 📚

There is a trap waiting on list endpoints. If "viewers only see published articles", you might be tempted to do this:

```ts
const articles = await this.repo.findAll();
return articles.filter((a) => ability.can('read', subject('Article', a)));
```

This works, but it loads the whole table into memory just to throw most of it away. It also breaks pagination, because you paginate *before* filtering.

CASL can convert the rules into a database query instead, so the condition runs in the `WHERE` clause. The official adapters do this for you. With Prisma, `@casl/prisma` gives you `accessibleBy`:

```bash
npm install @casl/prisma
```

```ts
import { accessibleBy } from '@casl/prisma';

async findReadable(user: AuthorizationUser) {
  const ability = this.abilityFactory.createForUser(user);

  return this.prisma.article.findMany({
    where: accessibleBy(ability).Article,
  });
}
```

For a viewer, `accessibleBy(ability).Article` becomes a `where` like `{ status: 'published' }`. For a super admin with `manage`, it becomes an empty filter that returns everything. The same rules that protect a single record now also shape the query, and you keep pagination, sorting, and indexes.

A couple of honest notes:

- `@casl/prisma` builds the ability with its own `createPrismaAbility` instead of `createMongoAbility`, because the supported operators are aligned with Prisma. If you want query filtering, build the ability with the matching adapter factory.
- For Mongoose there is `@casl/mongoose` with `accessibleBy` too, and for custom data sources there is the lower-level `rulesToQuery` helper.

So the rule of thumb is:

> Check single records with `can` / `throwUnlessCan`. Filter lists by translating rules into a database query.

## Field-level permissions 🧩

Conditions answer "*which records*". CASL can also answer "*which fields*". You pass the allowed fields as an argument:

```ts
// support can read orders, but not the customer's full card data
allow('read', 'Order', ['id', 'status', 'total', 'createdAt']);

// editors can update only the editorial fields of their own articles
allow('update', 'Article', ['title', 'summary', 'body'], {
  authorId: user.id,
});
```

The check accepts a field too:

```ts
ability.can('update', subject('Article', article), 'status'); // false
ability.can('update', subject('Article', article), 'title'); // true (if it is theirs)
```

And if you want to strip non-permitted fields from an incoming payload, `permittedFieldsOf` lists what is allowed:

```ts
import { permittedFieldsOf } from '@casl/ability/extra';

const fields = permittedFieldsOf(ability, 'update', subject('Article', article), {
  fieldsFrom: (rule) => rule.fields ?? [],
});

const safeUpdate = pick(dto, fields);
```

This is handy when you want a single source of truth for "which fields can this role change", instead of duplicating that logic in DTOs and services.

## Testing conditions ✅

The best part of keeping permissions as pure functions (from part 1) is that conditions are just as easy to test. We reuse the same `userFactory` and `abilityBuilderFactory` helpers and add `subject()` to build sample records:

```ts
// _test/article.spec.ts
import { subject } from '@casl/ability';

import { defineArticlePermissions } from '../permissions/article';
import { abilityBuilderFactory, userFactory } from './helpers';
import { Role } from '../role.enum';

describe('Article conditions', () => {
  function abilityFor(user: ReturnType<typeof userFactory>) {
    const builder = abilityBuilderFactory();
    defineArticlePermissions(builder, user);
    return builder.build();
  }

  it('lets an editor update their own draft', () => {
    const ability = abilityFor(userFactory({ id: 'u1', role: Role.EDITOR }));

    const own = subject('Article', { authorId: 'u1', status: 'draft' });

    expect(ability.can('update', own)).toBe(true);
  });

  it('blocks an editor from updating someone else article', () => {
    const ability = abilityFor(userFactory({ id: 'u1', role: Role.EDITOR }));

    const others = subject('Article', { authorId: 'u2', status: 'draft' });

    expect(ability.can('update', others)).toBe(false);
  });

  it('blocks updating an archived article even when it is yours', () => {
    const ability = abilityFor(userFactory({ id: 'u1', role: Role.EDITOR }));

    const archived = subject('Article', { authorId: 'u1', status: 'archived' });

    expect(ability.can('update', archived)).toBe(false);
  });

  it('only shows published articles to a viewer', () => {
    const ability = abilityFor(userFactory({ role: Role.VIEWER }));

    const published = subject('Article', { status: 'published' });
    const draft = subject('Article', { status: 'draft' });

    expect(ability.can('read', published)).toBe(true);
    expect(ability.can('read', draft)).toBe(false);
  });
});
```

These tests read like the product rules written in plain English, and they run in milliseconds because no NestJS, no HTTP, and no database are involved. For an authorization layer, that is exactly the kind of test coverage you want.

## A small performance note ⚡

Building the ability is cheap, but `createForUser` does run every permission function each time you call it. If a single request checks several records, I like to build the ability **once per request** and reuse it, instead of rebuilding it inside a loop.

A simple approach is to build it in the service method and pass it down, or to expose a request-scoped provider that memoizes the ability for the current user. Nothing fancy is required, just avoid rebuilding it inside a `for` loop over a thousand records.

## Final thoughts

Conditions are where CASL really pays off. With the same structure from part 1 and one extra argument, we covered the cases that role-based checks simply cannot express:

- ownership rules with `{ authorId: user.id }`;
- status and operator rules like `{ status: { $in: [...] } }`;
- revoking with `cannot` / `forbid`;
- field-level permissions;
- list filtering pushed into the database.

The mental model that keeps all of this clean is the two-layer model: the guard answers the coarse "can this user touch this kind of thing at all?", and the service answers the fine "can this user touch *this* record?". Both share the exact same ability, built from the exact same permission files, so there is still a single source of truth.

That is it for today. Between part 1 and part 2 you now have a complete, testable, and scalable authorization layer for NestJS, powered by [@casl/ability](https://casl.js.org/).

### Takeaways ✍️

- Conditions are MongoDB-style query objects matched against real records.
- Always give CASL the subject type with `subject()` or `detectSubjectType`.
- Type your subject shape so condition fields are checked at compile time.
- Guard checks the type level (coarse); the service checks the instance (fine).
- Enforce instance rules with `ForbiddenError.throwUnlessCan`.
- Filter lists by translating rules into a query (`@casl/prisma`, `@casl/mongoose`), not by loading everything.
- Use field-level rules to control which properties a role can change.
- Conditions are pure functions too, so test them with simple `subject()` records.
