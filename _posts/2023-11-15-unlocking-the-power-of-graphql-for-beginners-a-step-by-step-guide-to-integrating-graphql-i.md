---
title: "Unlocking the Power of GraphQL for Beginners: A Step-by-Step Guide to Integrating GraphQL into Your Existing Project"
excerpt: "Hello fellow coders!"
coverImage: "/blog-assets/unlocking-the-power-of-graphql-for-beginners-a-step-by-step-guide-to-integrating-graphql-i/screen-shot-2023-11-15-at-14-36-07.png"
date: "2023-11-15T12:00:00.000Z"
author:
  name: "Henrique Weiand"
  picture: "/nestjs-ninja.png"
ogImage:
  url: "/blog-assets/unlocking-the-power-of-graphql-for-beginners-a-step-by-step-guide-to-integrating-graphql-i/screen-shot-2023-11-15-at-14-36-07.png"
tags:
  - "GraphQL"
  - "Jest"
  - "NestJS"
  - "SWC"
  - "Typescript"
  - "openAI"
---
Hello fellow coders! 

I’ve been noticing an increase in the number of companies requiring GraphQL experience for a job opportunity, and that triggers me to create another useful technical blog post in one interesting way, I want to implement GraphQL inside an existent project! Cool, right? My idea initially, is to implement something not so deep but that works at the same time. 

I am going to use my project, which is an AI question generator, that you can find in the link below. 

[Creating Smart Questions with NestJS and OpenAI](https://medium.com/nestjs-ninja/creating-smart-questions-with-nestjs-and-openai-83089829cdf5)

Let’s set the scope of this project

- It must cover the `user module`, by offering a GraphQL interface to handle the functionalities below
    - Create user
    - Get users
    - Get user
    - Update user
    - Delete user
    

### Setting up the project to work with GraphQL

Let's use the official documentation to follow the correct setup

[Documentation | NestJS - A progressive Node.js framework](https://docs.nestjs.com/graphql/quick-start)

First, we have to install the dependencies

```tsx
npm i @nestjs/graphql @nestjs/apollo @apollo/server graphql
```

Then is necessary to set up GraphQL and I'm going to do it by adding the module into the app.module.ts like this

```jsx
import { EnvModule } from '@app/common';
import { Module } from '@nestjs/common';
import { DevtoolsModule } from '@nestjs/devtools-integration';
import { Modules } from './modules/module';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      playground: true,
      autoSchemaFile: true,
    }),
    DevtoolsModule.register({
      http: process.env.NODE_ENV !== 'production',
    }),
    EnvModule,
    Modules,
  ],
})
export class AppModule { }
```

if you keep `playground` as true, it will enable the visual playground to try the queries and mutations on the browser. We will use it later.

In my case, I also kept `autoSchemaFile` true and as I'm using the "code first approach”, the official documentation says 

> In the **code first** approach, you use decorators and TypeScript classes to generate the corresponding GraphQL schema.
> 

Also, the doc mentioned the case of using `true` as a value

> The `autoSchemaFile` property value is the path where your automatically generated schema will be created. Alternatively, the schema can be generated on-the-fly in memory. To enable this, set the `autoSchemaFile` property to `true`
> 

### Configuring the resolvers

Resolvers provide the instructions for turning a [**GraphQL**](https://graphql.org/) operation (a query, mutation, or subscription) into data. They return the same shape of data we specify in our schema -- either synchronously or as a promise that resolves to a result of that shape. Typically, you create a **resolver map** manually. The `@nestjs/graphql` package, on the other hand, generates a resolver map automatically using the metadata provided by decorators you use to annotate classes. To demonstrate the process of using the package features to create a GraphQL API, we'll create a simple authors API.

In the `code-first approach`, we don't follow the typical process of creating our GraphQL schema by writing GraphQL SDL by hand. Instead, we use TypeScript decorators to generate the SDL from TypeScript class definitions. The `@nestjs/graphql` package reads the metadata defined through the decorators and automatically generates the schema for you.

### Code on

Speaking about code, as we only need to apply GraphQL to the `user` module, I will start showing the files inside the folder `/src/modules/user`, just to show you some differences from the previous project. By the way, I will keep REST working at the same time.

**The folder & files strcuture** 

```jsx
./user
├── controllers
│   ├── controllers...
├── dto
│   ├── args
│   │   └── get-user.args.ts
│   ├── create-user.dto.ts
│   ├── input
│   │   ├── create-user.input.ts
│   │   ├── delete-user.input.ts
│   │   └── update-user.input.ts
│   ├── update-user.dto.ts
│   └── user.dto.ts
├── resolvers
│   └── user.resolver.ts
├── use-case
│   ├── use-cases...
├── user.model.ts
└── user.module.ts
```

We are going to work on basically with:

- user.model.ts;
- resolvers folder;
- dto/args folder;
- dto/input folder;

Our resolver will provide an interface between the user and the use cases, which we have with the controllers when we use REST, right? So you can see that we are injecting the use cases as dependencies just because we need to call them with the required input for those use cases that need.

```jsx
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GetUserArgs } from '../dto/args/get-user.args';
import { CreateUserInput } from '../dto/input/create-user.input';
import { UpdateUserInput } from '../dto/input/update-user.input';
import { CreateUserUseCase } from '../use-case/create-user';
import { DeleteUserUseCase } from '../use-case/delete-user';
import { GetManyUsersUseCase } from '../use-case/get-many-users';
import { GetUserByIdUseCase } from '../use-case/get-user-by-id';
import { UpdateUserUseCase } from '../use-case/update-user';
import { User } from '../user.model';

@Resolver('User')
export class UserResolver {
    constructor(
        private getManyUsersUseCase: GetManyUsersUseCase,
        private createUserUseCase: CreateUserUseCase,
        private updateUserUseCase: UpdateUserUseCase,
        private getUserByIdUseCase: GetUserByIdUseCase,
        private deleteUserUseCase: DeleteUserUseCase
    ) { }

    @Query(() => User, { name: 'user', nullable: false })
    async getUser(@Args() getUserArgs: GetUserArgs) {
        return this.getUserByIdUseCase.execute(getUserArgs.id)
    }

    @Query(() => [User], { name: 'users', nullable: false })
    async getUsers() {
        return await this.getManyUsersUseCase.execute();
    }

    @Mutation(() => User)
    async createUser(
        @Args('createUserInput') createUserInput: CreateUserInput,
    ) {
        return await this.createUserUseCase.execute(createUserInput);
    }

    @Mutation(() => User)
    async updateUser(
        @Args('updateUserInput') updateUserInput: UpdateUserInput,
    ) {
        return await this.updateUserUseCase.execute(updateUserInput.id, updateUserInput);
    }

    @Mutation(() => User)
    async deleteUser(
        @Args('id') id: string
    ) {
        return await this.deleteUserUseCase.execute(id);
    }
}
```

(If you prefer the same code can be accessed [here](https://github.com/nestjsninja/nestjs-generate-questions-graphql/blob/main/src/modules/user/resolvers/user.resolver.ts))

I am not going to detail this file yet, let's do it later after having the complements of this file to work properly. 

As you may notice looking at the resolvers, we changed the approach of using the DTO as body and get parameters to 

- Args
- Inputs

Which is a more usual way of talking when we are working with GraphQL. They will represent the DTO as it is, and there we specify the props according to the necessity. This is very easy work to be honest, because as we have already the DTO for the REST protocol, we can copy and change just a few details.  Loot at this example

![Screen Shot 2023-11-15 at 14.36.07.png](/blog-assets/unlocking-the-power-of-graphql-for-beginners-a-step-by-step-guide-to-integrating-graphql-i/screen-shot-2023-11-15-at-14-36-07.png)

Again, I am not going throuth each one of the inputs and args, so feel free to check all of them out.

[](https://github.com/nestjsninja/nestjs-generate-questions-graphql/tree/main/src/modules/user/dto)

Last but not least, user.model.ts

```jsx
import { Field, ID, ObjectType } from '@nestjs/graphql';
import { User as UserDB } from '@prisma/client';

@ObjectType()
export class User {
    @Field(() => ID)
    id: UserDB[`id`];

    @Field(() => String)
    username: UserDB[`username`];

    @Field(() => String)
    password: UserDB[`password`];
}
```

([code](https://github.com/nestjsninja/nestjs-generate-questions-graphql/blob/main/src/modules/user/user.model.ts))

This model is ObjectType which represents our User schema on Prisma, and in this file, we are mapping the fields properly.

### Running the application

After understanding and setting everything up, it's time to run, right?

```jsx
npm run start:dev
```

and then you can access [http://localhost:3000/graphql](http://localhost:3000/graphql) , where you can play with your query, mutations, etc.

**Mutation**

![Screen Shot 2023-11-15 at 14.46.53.png](/blog-assets/unlocking-the-power-of-graphql-for-beginners-a-step-by-step-guide-to-integrating-graphql-i/screen-shot-2023-11-15-at-14-46-53.png)

Query

![Screen Shot 2023-11-15 at 14.47.47.png](/blog-assets/unlocking-the-power-of-graphql-for-beginners-a-step-by-step-guide-to-integrating-graphql-i/screen-shot-2023-11-15-at-14-47-47.png)

### Conclusion

The final code can be found in this like

[https://github.com/nestjsninja/nestjs-generate-questions-graphql](https://github.com/nestjsninja/nestjs-generate-questions-graphql)

It was pretty simple, right? Now I hope you feel a bit more comfortable applying GraphQL to your project when it's necessary.

### References

The repository below is an old project in which I implemented the `authentication` and `authorization` modules using GraphQL. The funny part is that it is still up-to-date.

[https://github.com/henriqueweiand/nestjs-account-graphql](https://github.com/henriqueweiand/nestjs-account-graphql)

Some good references

[NestJS GraphQL/Prisma/PostgreSQL Set Up](https://medium.com/@shkim04/nestjs-graphql-prisma-postgresql-set-up-6cc76a624bde)

[Ultimate Guide: How To Use Prisma With NestJS [2022]](https://www.tomray.dev/nestjs-prisma)
