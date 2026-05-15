---
title: "NestJS, TypeORM, and Multi-Tenancy"
excerpt: "A practical architecture for serving multiple customer databases from one NestJS application using TypeORM and request-scoped tenant context."
coverImage: "/nestjs-ninja.png"
date: "2024-12-14T12:00:00.000Z"
author:
  name: "Henrique Weiand"
  picture: "/nestjs-ninja.png"
ogImage:
  url: "/nestjs-ninja.png"
tags:
  - NestJS
  - TypeORM
  - Multi-tenancy
  - Architecture
---

Multi-tenancy is one of those architecture topics that sounds more exotic than it usually is. At its core, the problem is direct: one system needs to serve multiple customers while keeping each customer's data properly isolated.

This post is based on my original Medium article, [NestJS TypeORM and Multi-Tenancy](https://medium.com/p/a7f6176e8319), and the sample project at [henriqueweiand/nestjs-typeorm-multi-tenancy](https://github.com/henriqueweiand/nestjs-typeorm-multi-tenancy). The implementation focuses on one specific model:

- one NestJS application
- one default database that stores tenant metadata
- one separate database per customer
- TypeORM managing tenant connections and migrations

## The tenancy model

There are several common ways to structure a multi-tenant system:

- one application and one shared database
- one application and multiple databases
- multiple applications and multiple databases

The example uses the second option: a single NestJS application with a dedicated database for each tenant. This gives stronger data isolation than a shared-schema approach while keeping the deployment model simpler than running a separate application per customer.

The tradeoff is connection management. The application needs to know which database belongs to the current request, and it needs a reliable way to create, store, and retrieve TypeORM data sources.

## Project shape

The implementation is centered around two internal libraries:

```text
src/libs/database
src/libs/tenancy
```

The database library owns connection creation and lookup. The tenancy library owns request context, extracting the tenant identifier and making it available during the request lifecycle.

That separation matters. Database infrastructure should not need to know about HTTP headers directly, and application services should not need to manually parse tenant metadata on every method call.

## Bootstrapping tenant databases

On application startup, the database service initializes the tenant connection map. The flow looks like this:

1. Start the NestJS application.
2. Open a default database connection.
3. Read tenant records from a central tenant table.
4. For each tenant, verify that the customer database exists.
5. Create missing databases when needed.
6. Run migrations for each tenant database.
7. Create a TypeORM `DataSource` for each tenant and keep it available in memory.
8. Close the default setup connection.

This gives the app a ready-to-use registry of tenant database connections before normal request handling begins.

The main limitation is freshness. If a new tenant is added after the application starts, this version will not automatically discover it. A production-ready version could add a refresh mechanism, an admin provisioning flow, or a shared cache layer for tenant connection metadata.

## Request context with `nestjs-cls`

The tenancy module uses [`nestjs-cls`](https://github.com/Papooch/nestjs-cls), which builds on Node's `AsyncLocalStorage` model. The idea is to store request-specific state once and retrieve it later from deeper layers of the application.

In this case, the important value is the `tenant-id` header. A middleware or interceptor captures it at the edge of the request and stores it in continuation-local storage.

That makes the current tenant available without passing `tenantId` manually through every controller, service, and repository call.

## Resolving the right TypeORM data source

Once the current tenant is stored in request context, the database service can expose a small lookup method:

```ts
getDataSource() {
  const tenantId = this.cls.get(TENANT_KEY);

  return this.tenantConnections.get(tenantId);
}
```

The method reads the current tenant from local storage, then returns the matching TypeORM `DataSource` from the in-memory connection map.

This is the bridge between request context and database access. The rest of the application does not need to know how tenant connections were created.

## Using repositories

The usual TypeORM integration pattern in NestJS often relies on `TypeOrmModule.forFeature`. In this setup, repositories need to come from the tenant-specific data source instead.

A service can resolve the repository like this:

```ts
this.userRepository = this.databaseService
  .getDataSource()
  .getRepository(User);
```

That repository now points to the database selected by the current request's `tenant-id`.

This pattern is simple, but it also means services should be designed carefully. Repository resolution needs to happen at a point where request context is available, not during static module initialization.

## Migrations

The sample project is configured so TypeORM migrations can still be generated from entity changes. After a migration is generated, the application applies it to tenant databases during startup.

That startup behavior is convenient for a demo and for controlled environments. In a larger production system, you may want a more explicit migration rollout process so tenant database changes can be audited, retried, and monitored independently.

## What to improve next

This architecture is a useful foundation, but there are a few improvements worth considering before using it in a high-scale production environment:

- automatically refresh tenant connections after new tenants are created
- move shared connection metadata into a cache or external coordination layer
- add stronger validation for missing or invalid `tenant-id` headers
- expose health checks for each tenant database connection
- separate tenant provisioning from normal application startup
- make migration execution observable and retryable

## Final thoughts

The core idea is straightforward: resolve tenant identity from the request, map it to a TypeORM data source, and make repositories come from that tenant-specific connection.

NestJS gives enough structure to keep those responsibilities clean. TypeORM provides the database abstraction. `AsyncLocalStorage`, through `nestjs-cls`, keeps request context available without turning every method signature into plumbing.

For applications that need one database per customer, this is a practical starting point.
