---
title: "NestJS TypeORM and Multi-Tenancy"
excerpt: "A practical implementation of multi-tenancy using NestJS and TypeORM, managing multiple databases for customers, with features like database migrations and connection handling. Future improvements could include real-time database verification and a caching layer for better scalability."
coverImage: "/blog-assets/nestjs-typeorm-multi-tenancy/types-of-multi-tenant-architecture-f.png"
date: "2024-12-14T12:00:00.000Z"
author:
  name: "Henrique Weiand"
  picture: "/nestjs-ninja.png"
ogImage:
  url: "/blog-assets/nestjs-typeorm-multi-tenancy/types-of-multi-tenant-architecture-f.png"
tags:
  - "Multi-tenancy"
  - "NestJS"
  - "TypeORM"
---
Not so different from any other ordinary type of project, multi-tenancy is a software architecture that has been in place for quite a while, and as with any other approach, there are pros and cons. In this article, I plan to walk you through a simple solution I implemented to tackle basic architecture inside the universe of the NestJS framework with TypeORM.

### Context

I've been studying and trying new approaches whenever something pops up and I wonder how to do that technically, or when I found something cool! I've written a few articles with this idea in mind, and this one is no different! I was talking to my brother the other day and he is planning to migrate a project that runs with PHP to node and he asked me if I knew an example of multi-tenancy with NestJS. Despite being in the technology for a while, I worked on something with C++ in the past but not with Node or NestJS. In the end, it wasn't a problem, I took it as my new study subject and tried it! 

The final code is available on the link below on GitHub

[https://github.com/henriqueweiand/nestjs-typeorm-multi-tenancy](https://github.com/henriqueweiand/nestjs-typeorm-multi-tenancy)

I don’t describe the details in this article, just the overview and how the application works according to the target, which is:

- NestJS project;
- Multiple databases, one for each customer;
- Use TypeORM to deal with the database connection;

### Multi-tenancy

Let me start by saying that multi-tenancy has different types, some of them are:

- A single application, single database;
- A single application, multiple database;
- Multiple applications, multiple databases;

![types_of_multi_tenant_architecture-f.png](/blog-assets/nestjs-typeorm-multi-tenancy/types-of-multi-tenant-architecture-f.png)

You can find more details about the concept online. ([What is multi-tenancy (multi-tenant architecture](https://bit.ly/4g8wmDN))).

In case you want to know, this project uses a single application and multiple databases. 🎯

## Developing

Before I started, I researched NestJS packages, existing libraries, public projects, and articles and I found a few interesting contents, for example:

https://dev.to/logeek/nestjs-and-typeorm-efficient-schema-level-multi-tenancy-with-auto-generated-migrations-a-dx-approach-jla

[https://github.com/mguay22/nestjs-multitenancy](https://github.com/mguay22/nestjs-multitenancy)

None of them matched exactly what I needed, which motivated me to continue and implement it, and in the end, I got some shared knowledge from all the materials and included them into my project version. 

The project has two main folders that are essential for the idea. 

- /src/libs/database
- /src/libs/tenancy

### Database

Starting with the database, it is important to note that the service implements OnModuleInit, which executes a logic when the app starts and the service is instantiated. What I implemented consists of the following sequence:

1. App starts;
2. The app initiates a default DB connection;
3. This instance gets the data from a default database and table tenant which holds the database information for all the customers;
4. This connection verifies if each database from the data is created and if so, it runs the migrations over the customer's database, otherwise, it creates a new database and also runs the migrations over it.
5. An exclusive Data source is created for each one of the databases and stored in memory;
6. Close the default connection (this connection is different from the other databases);

<aside>
💡

The low point of this approach is that the app won't verify if new databases were created unless the app is restarted. I didn't want to focus on this, so I left this improvement open on the project. Feel free to help with 😉

</aside>

All this logic is happening inside the [database.service.ts](https://github.com/henriqueweiand/nestjs-typeorm-multi-tenancy/blob/main/src/libs/database/database.service.ts) in case you want to check it out.

[https://github.com/henriqueweiand/nestjs-typeorm-multi-tenancy/blob/main/src/libs/database/database.service.ts](https://github.com/henriqueweiand/nestjs-typeorm-multi-tenancy/blob/main/src/libs/database/database.service.ts)

### Tenancy

Despite being a simple module if you take a look, it's a crucial part of the project and it put everything together! 

This module uses the library [nestjs-cls](https://github.com/Papooch/nestjs-cls), which is "A continuation-local storage module compatible with NestJS' dependency injection based on AsyncLocalStorage". You also can use the node implementation with async_hooks if you want. The module gets the `tenant-id` from the request and adds it to the local storage which makes the info available through the request lifecycle.

> *Continuation-local storage allows to store state and propagate it throughout callbacks and promise chains. It allows storing data throughout the lifetime of a web request or any other asynchronous duration. It is similar to thread-local storage in other languages.*
> 

[https://github.com/henriqueweiand/nestjs-typeorm-multi-tenancy/blob/main/src/libs/tenancy/tenancy.module.ts](https://github.com/henriqueweiand/nestjs-typeorm-multi-tenancy/blob/main/src/libs/tenancy/tenancy.module.ts)

Finally, with all that in place, one method inside the database.service.ts, will help us to connect the repositories later to the right database.

```jsx
/**
 * Get the data source for the current tenant
 */
getDataSource() {
  const tenantId = this.cls.get(TENANT_KEY);

  return this.tenantConnections.get(tenantId);
}
```

it will get the `tenant-id` from the local storage as explained before and also the connection from the variable in memory

<aside>
💡

Speaking of memory, another possible improvement for the future is, making this memory part available in a cache layer or somewhere else, otherwise, if you scale the application the connection won't be shared, but each application will have its own. It is not a big deal, but it is a nice to have.

</aside>

## Connecting a repository to the database

Different from the normal way of using TypeORM, I mean, by using the `forFeature` method, etc, in this case, you need to do something a bit different. 

[https://github.com/henriqueweiand/nestjs-typeorm-multi-tenancy/blob/main/src/components/users/users.service.ts](https://github.com/henriqueweiand/nestjs-typeorm-multi-tenancy/blob/main/src/components/users/users.service.ts)

With the `DatabaseModule` module added to your Module, you can import the Database service and call 

```jsx
this.userRepository = this.databaseService.getDataSource().getRepository(User);
```

This line will return an instance of the correct database according to the `tenant-id` from the header and the User repository to use as needed. 

And that's all my friends! We did it!!!

## Bonus: Generating migrations

This project is set up in a way that you can use the TypeORM generate command! After making any change in the entities, you can run `yarn typeorm:generate`, and it will generate the migrations for you. You won't need to run with another command, because the application will run for you once it starts because of the `migrationsRun: true` 

In the readme file, you can find a section about how to run the application

[https://github.com/henriqueweiand/nestjs-typeorm-multi-tenancy/blob/main/README.md](https://github.com/henriqueweiand/nestjs-typeorm-multi-tenancy/blob/main/README.md)

### Conclusion

In this article, we explored a practical implementation of multi-tenancy using NestJS and TypeORM. The solution demonstrates how to handle multiple databases for different customers while maintaining a clean and organized codebase.

The key achievements of this implementation include:

- Successfully setting up a NestJS project with multiple database support
- Creating a system that manages database connections for each customer
- Implementing database migrations and proper connection handling

While this implementation provides a solid foundation, there are opportunities for improvement, such as:

- Adding real-time database verification without requiring app restart
- Implementing a caching layer for better connection management across scaled applications

Overall, this approach offers a practical solution for implementing multi-tenancy in NestJS applications while maintaining flexibility and scalability.
