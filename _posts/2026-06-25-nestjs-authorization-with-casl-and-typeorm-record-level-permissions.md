---
title: >-
  NestJS Authorization with CASL and TypeORM: Record-Level Permissions and Query
  Filtering
excerpt: >-
  The TypeORM branch of the CASL conditions post. Same record-level idea, but
  with TypeORM: configure detectSubjectType once so entities need no subject()
  wrapper, and translate the ability rules into a TypeORM QueryBuilder since
  there is no official @casl/typeorm adapter.
date: '2026-06-25T12:00:00.000Z'
author:
  name: Henrique Weiand
  picture: /nestjs-ninja.png
tags:
  - NestJS
  - Authorization
  - CASL
  - TypeORM
  - Permissions
  - Typescript
coverImage: >-
  /blog-assets/nestjs-authorization-with-casl-and-typeorm-record-level-permissions/cover.png
ogImage:
  url: >-
    /blog-assets/nestjs-authorization-with-casl-and-typeorm-record-level-permissions/cover.png
---
Hello, dev!

In the [conditions post](https://nestjs-ninja.com/blog/2026-06-18-nestjs-authorization-with-casl-conditions-and-record-level-permissions/) we added record-level permissions to a NestJS app with [@casl/ability](https://casl.js.org/): rules like `allow('update', 'Article', { authorId: user.id })`, the `subject()` helper, and the two-layer model (a coarse guard plus a fine check in the service).

For the list-filtering part of that post, I used `@casl/prisma` and its `accessibleBy(ability).Article` helper. A few readers asked the obvious question:

> What if my project uses TypeORM instead of Prisma?

So this is a small branch of that post for TypeORM users. The good news: almost everything stays the same. The permission files, the conditions, the `ForbiddenError` check, the two-layer model — all identical. Only two things change, and both are interesting.

> Same CASL rules. The only TypeORM-specific parts are subject detection and translating rules into a query.

If you have not read the conditions post, start there. Here I will only highlight the TypeORM differences.

## What changes with TypeORM 🧠

There is no official `@casl/typeorm` adapter (CASL ships `@casl/prisma` and `@casl/mongoose`, but not TypeORM). That sounds like bad news, but it only affects one thing: list filtering. Let me name the two differences up front.

1. **Subject detection is easier.** TypeORM entities are real classes, so CASL can detect the subject type from the instance. We configure it once and never call `subject()` again.
2. **Query filtering is manual.** Without an adapter, we translate the ability rules into a TypeORM `QueryBuilder` ourselves. It is less code than you would expect.

## Difference 1: detect the subject from the entity class 🕵️

In the Prisma post, records were plain objects, so we tagged them with `subject('Article', record)` before checking. TypeORM entities are different — they are instances of a class:

```ts
import { Column, Entity, PrimaryColumn } from 'typeorm';

export type ArticleStatus = 'draft' | 'published' | 'archived';

@Entity('articles')
export class Article {
  @PrimaryColumn('text')
  id: string;

  @Column('text')
  title: string;

  @Column('text')
  authorId: string;

  @Column('text')
  status: ArticleStatus;
}
```

Because `article.constructor.name` is `'Article'`, we can teach CASL to use the class name as the subject type. We do this once, in the ability factory, with `detectSubjectType`:

```ts
import { AbilityBuilder, createMongoAbility, ExtractSubjectType, MongoAbility } from '@casl/ability';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AbilityFactory {
  createForUser(user: AuthorizationUser) {
    const builder = new AbilityBuilder<MongoAbility<AppAbilityTuple>>(createMongoAbility);

    definePermissionsArray.forEach((definePermissionFn) => definePermissionFn(builder, user));

    return builder.build({
      detectSubjectType: (subject: any) =>
        (typeof subject === 'string' ? subject : subject.constructor.name) as ExtractSubjectType<AppAbilityTuple>,
    });
  }
}
```

There is one detail that is easy to miss, and it will silently break everything if you skip it: **handle the string case**.

CASL calls `detectSubjectType` for *every* subject you check, including string subjects. The guard still does coarse checks like `ability.can('update', 'Article')`. If your function blindly returned `subject.constructor.name`, then `'Article'.constructor.name` would be `'String'`, no rule would match, and the guard would reject everyone. The `typeof subject === 'string'` branch keeps those type-level checks working.

> If you override `detectSubjectType`, you must still return strings as-is. `'Article'.constructor.name` is `'String'`, not `'Article'`.

With this in place, the per-record check in the service no longer needs `subject()`:

```ts
import { ForbiddenError } from '@casl/ability';

async update(user: AuthorizationUser, id: string, data: UpdateArticleData): Promise<Article> {
  const article = await this.articles.findOne({ where: { id } });

  if (!article) {
    throw new NotFoundException(`Article ${id} not found`);
  }

  const ability = this.abilityFactory.createForUser(user);

  // `article` is a TypeORM entity instance, so detectSubjectType resolves it
  // to 'Article' automatically — no subject() wrapper needed.
  ForbiddenError.from(ability)
    .setMessage('You can only update your own articles')
    .throwUnlessCan('update', article);

  Object.assign(article, data);
  return this.articles.save(article);
}
```

Compare this with the Prisma version: it is the same code, minus the `subject('Article', article)` wrapper. That is a small but real ergonomic win for TypeORM.

The two-layer model is unchanged. The guard does `@CheckAbility(['update', 'Article'])` (coarse, type-level), and the service does the fine, record-level check above. CASL's `ForbiddenError` is not an HTTP exception, so I translate it into a `403` with the same exception filter from the conditions post.

## Difference 2: translate rules into a TypeORM query 🧩

This is the part that `@casl/prisma` did for us with `accessibleBy`. For list endpoints, we do not want to load the whole table and filter in memory — that breaks pagination and ignores indexes. We want the conditions to run in the `WHERE` clause.

Without an adapter, we write a small helper. The idea is straightforward: take the rules for an `(action, subjectType)` pair and build a SQL clause that is **(OR of the allow conditions) AND (NOT each cannot)**.

```ts
import { MongoAbility } from '@casl/ability';
import { SelectQueryBuilder } from 'typeorm';

export function applyAccessibleBy<Entity extends object>(
  qb: SelectQueryBuilder<Entity>,
  ability: MongoAbility,
  action: string,
  subjectType: string,
  alias: string = qb.alias,
): SelectQueryBuilder<Entity> {
  const rules = ability.rulesFor(action, subjectType);
  const allow = rules.filter((rule) => !rule.inverted);
  const deny = rules.filter((rule) => rule.inverted);

  // No matching allow rule -> the user cannot access anything of this type.
  if (allow.length === 0) {
    return qb.andWhere('1 = 0');
  }

  const params: Record<string, unknown> = {};
  const clauses: string[] = [];

  // A rule without conditions means "allowed for every record of this type".
  const unconditionalAllow = allow.some((rule) => !rule.conditions);

  if (!unconditionalAllow) {
    const orParts = allow.map((rule) => conditionToSql(alias, rule.conditions, params));
    clauses.push(`(${orParts.join(' OR ')})`);
  }

  for (const rule of deny) {
    if (!rule.conditions) {
      return qb.andWhere('1 = 0'); // an unconditional cannot revokes everything
    }
    clauses.push(`NOT ${conditionToSql(alias, rule.conditions, params)}`);
  }

  if (clauses.length > 0) {
    qb.andWhere(clauses.join(' AND '), params);
  }

  return qb;
}
```

The interesting bit is `ability.rulesFor(action, subjectType)`. CASL exposes the rules that apply to an action and subject, including their `conditions` and whether they are `inverted` (a `cannot`). That is exactly the information we need to rebuild the query.

The `conditionToSql` helper converts one Mongo-style condition object into a parametrized SQL fragment:

```ts
const COMPARISON: Record<string, string> = {
  $eq: '=', $ne: '!=', $gt: '>', $gte: '>=', $lt: '<', $lte: '<=',
};

function conditionToSql(alias: string, conditions: any, params: Record<string, unknown>): string {
  const parts: string[] = [];

  for (const [field, matcher] of Object.entries(conditions)) {
    const column = `${alias}.${field}`;

    if (matcher && typeof matcher === 'object' && !Array.isArray(matcher)) {
      for (const [operator, value] of Object.entries(matcher)) {
        const name = nextParamName(field);
        params[name] = value;

        if (operator === '$in') parts.push(`${column} IN (:...${name})`);
        else if (COMPARISON[operator]) parts.push(`${column} ${COMPARISON[operator]} :${name}`);
        else throw new Error(`Unsupported operator "${operator}"`);
      }
    } else {
      const name = nextParamName(field);
      params[name] = matcher;
      parts.push(`${column} = :${name}`);
    }
  }

  return parts.length ? `(${parts.join(' AND ')})` : '1 = 1';
}
```

Note the parametrized placeholders (`:name`, `:...name`). We never concatenate values into the SQL string, so this is safe from injection — the values go through TypeORM's parameter binding.

Using it in the service is then a one-liner:

```ts
listReadable(user: AuthorizationUser): Promise<Article[]> {
  const ability = this.abilityFactory.createForUser(user);

  const qb = this.articles.createQueryBuilder('article');
  applyAccessibleBy(qb, ability, 'read', 'Article');

  return qb.getMany();
}
```

For a viewer (who can only `read` published articles), the generated query becomes `WHERE (article.status = ?)`. For an editor or a super admin (who can read everything), there is an unconditional allow rule, so no filter is added and the query returns all rows. The same rules that protect a single record now also shape the list query.

> Check single records with `throwUnlessCan`. Filter lists by translating `rulesFor(...)` into a `QueryBuilder` clause.

### How far should this helper go?

The version above covers equality and the common comparison operators, which is enough for most role/ownership rules. If your conditions get richer — deep `$and`/`$or`/`$nor` nesting, relations, JSON columns — do not keep growing this by hand. CASL is built on top of [ucast](https://github.com/stalniy/ucast), and `@ucast/sql` exists exactly to turn these conditions into SQL for different SQL dialects. Reach for it when the simple helper stops being enough.

There is also `rulesToQuery` from `@casl/ability/extra`, which gives you the rules as a single Mongo-style query object (`{ $or, $and }`) if you would rather map that structure instead of iterating the rules yourself.

## Testing 🧪

The record-level rules are still testable as pure functions. Because we configured `detectSubjectType`, we can test with real entity instances instead of `subject()`:

```ts
function asArticle(data: Partial<Article>): Article {
  return Object.assign(new Article(), data);
}

it('lets an editor update their own draft', () => {
  const ability = new AbilityFactory().createForUser(userFactory({ id: 'u1', role: Role.EDITOR }));

  expect(ability.can('update', asArticle({ id: 'a1', authorId: 'u1', status: 'draft' }))).toBe(true);
  expect(ability.can('update', asArticle({ id: 'a3', authorId: 'u2', status: 'draft' }))).toBe(false);
});
```

And the query translator deserves an integration test against a real database. With an in-memory SQLite, that stays fast and needs no infrastructure:

```ts
const dataSource = new DataSource({
  type: 'better-sqlite3',
  database: ':memory:',
  entities: [Article],
  synchronize: true,
});

// seed a1..a4, then:
it('viewer only reads published articles', async () => {
  const ability = new AbilityFactory().createForUser(userFactory({ role: Role.VIEWER }));
  const qb = articles.createQueryBuilder('article');
  applyAccessibleBy(qb, ability, 'read', 'Article');

  const rows = await qb.getMany();
  expect(rows.map((row) => row.id)).toEqual(['a2']);
});
```

This proves the filtering happens in SQL, not in JavaScript.

## Final thoughts

Switching the conditions post from Prisma to TypeORM turned out to be a small change with two takeaways. Subject detection got *easier* because entities are classes, and the only thing we really had to build ourselves was a query translator, which is a compact, reusable helper.

Everything that matters about the design is untouched: permissions live in one file per subject, conditions express ownership and status rules, the guard does the coarse check, and the service does the record-level check. The ORM is just an implementation detail at the edges.

> The ORM is an edge detail. The permission rules, the conditions, and the two-layer model do not care whether you use Prisma, TypeORM, or something else.

That is it for today. If you are on TypeORM, you now have everything from the conditions post working in your stack.

### Takeaways ✍️

- The permission files, conditions, and two-layer model are identical to the Prisma version.
- TypeORM entities are classes, so configure `detectSubjectType` once and drop `subject()`.
- When overriding `detectSubjectType`, still return string subjects as-is.
- There is no official `@casl/typeorm` adapter, so translate `rulesFor(...)` into a `QueryBuilder` clause.
- Always use parametrized placeholders in the generated SQL.
- For complex conditions, use `@ucast/sql` instead of growing the helper by hand.
- Test conditions with entity instances and the query translator against in-memory SQLite.
