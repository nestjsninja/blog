---
title: "Migrating NestJS project with TypeORM to Prisma"
excerpt: "Hello fellow coders! Today we are going to replace TypeORM with Prisma inside a simple previous project that we built, it’s gonna be simple and quick, so let’s get started!"
coverImage: "/blog-assets/migrating-nestjs-project-with-typeorm-to-prisma/untitled.png"
date: "2023-10-16T12:00:00.000Z"
author:
  name: "Henrique Weiand"
  picture: "/nestjs-ninja.png"
ogImage:
  url: "/blog-assets/migrating-nestjs-project-with-typeorm-to-prisma/untitled.png"
tags:
  - "Jest"
  - "NestJS"
  - "Node.js"
  - "Passion Economy"
  - "SWC"
  - "Tests"
  - "Typescript"
  - "auth"
---
Hello fellow coders! Today we are going to replace TypeORM with Prisma inside a simple previous project that we built, it’s gonna be simple and quick, so let’s get started!

This repository is the final project, if you want to check it out.

[https://github.com/nestjsninja/nestjs-auth-flow-with-prisma](https://github.com/nestjsninja/nestjs-auth-flow-with-prisma)

---

### Setting up

As I mentioned we are going to use the previous project that we built in our first blog post, which is this one:

[https://github.com/nestjsninja/nestjs-auth-flow-blog-post](https://github.com/nestjsninja/nestjs-auth-flow-blog-post)

Clone this repository and let’s start by installing the Prisma libraries with the command

```jsx
npm i @prisma/client
```

and

```jsx
npm i prisma -D
```

Just after executing these command lines, we need to initialize the Prisma project with the command

```jsx
npx prisma init
```

This command will create a base config, like the folder `prisma`, and insert the `.env` with the example of the connection string.

Now, for the next steps we will need to have the Postgres running, so make sure you have yours. In my case, I decided to change the Postgres image inside the `docker-compose.yml` to this

```jsx
version: '3'

services:
    api-solid-pg:
        image: bitnami/postgresql
        ports:
            - 5432:5432
        environment:
            - POSTGRESQL_USERNAME=docker
            - POSTGRESQL_PASSWORD=docker
            - POSTGRESQL_DATABASE=project
```

Now, I am going to run

```jsx
docker-compose up -d
```

At this point, you will need to fix the connection string in the `.env` file, this is mine for example

```jsx
DATABASE_URL="postgresql://docker:docker@localhost:5432/project?schema=public"
```

### Syncing entity files with user schema

The Prisma format for the tables and everything inside its ecosystem is based on the schema, different from what we had as a user.entity.ts file with the decorators from TypeORM, which means, we can delete the file `user.entity.ts` and update the schema.prisma

```jsx

generator client {
    provider = "prisma-client-js"
}

datasource db {
    provider = "postgresql"
    url      = env("DATABASE_URL")
}

model User {
    id       String @id @default(uuid())
    username String @unique
    password String
    @@map("users")
}
```

I’m setting up the same format as we had with TypeORM previously. 

Now, it is time to run a command

```jsx
npx prisma generate dev
```

This command will access the database to check if the table users already exist and if not it will create the migration for the new table in this case.

### Changing database module

We need to adapt a few things inside database.module in order to work properly, but first, let’s create a service for Prisma. I will do it inside `src/database/prisma.service.ts`

```jsx
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
    extends PrismaClient
    implements OnModuleInit, OnModuleDestroy
{
    constructor() {
        super({
            log: ['warn', 'error'],
        });
    }

    onModuleInit() {
        return this.$connect();
    }

    onModuleDestroy() {
        return this.$disconnect();
    }
}
```

This service will be responsible for handling the Prisma client/connection.

Our `src/database/database.module.ts` will be changed to this

```jsx
import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { UserRepository } from '../users/user.repository';

@Module({
    providers: [PrismaService, UserRepository],
    exports: [PrismaService, UserRepository],
})
export class DatabaseModule {}
```

And finally, let’s create the user.repository

```jsx
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class UserRepository {
    constructor(private prisma: PrismaService) {}

    async findOne(where: Prisma.UserWhereUniqueInput) {
        const user = await this.prisma.user.findUnique({
            where,
        });

        return user;
    }

    async create(data: Prisma.UserCreateInput) {
        const user = await this.prisma.user.create({
            data,
        });

        return user;
    }
}
```

As we had to create a user.repository, we will have to edit the `user.service.ts`to adapt whatever is necessary to be aligned with the user.repository.

```jsx
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserRepository } from './user.repository';
import { User } from '@prisma/client';

@Injectable()
export class UsersService {
    constructor(private readonly userRepository: UserRepository) {}

    private async comparePasswords(
        userPassword: string,
        currentPassword: string,
    ) {
        return await bcrypt.compare(currentPassword, userPassword);
    }

    async validateCredentials({
        username,
        password,
    }: {
        username: string;
        password: string;
    }): Promise<User> {
        const user = await this.userRepository.findOne({ username });

        if (!user) {
            throw new HttpException('User not found', HttpStatus.UNAUTHORIZED);
        }

        const areEqual = await this.comparePasswords(user.password, password);

        if (!areEqual) {
            throw new HttpException(
                'Invalid credentials',
                HttpStatus.UNAUTHORIZED,
            );
        }

        return user;
    }

    async create({
        username,
        password,
    }: {
        username: string;
        password: string;
    }): Promise<User> {
        const userInDb = await this.userRepository.findOne({ username });
        if (userInDb) {
            throw new HttpException(
                'User already exists',
                HttpStatus.BAD_REQUEST,
            );
        }

        const passwordHashed = await bcrypt.hash(password, 10);

        const user: User = this.userRepository.create({
            username,
            password: passwordHashed,
        });

        return user;
    }
}
```

Now we are receiving the user.repository as dependency injection and using it inside the user.service. I also changed a few things inside this service to be a little bit simpler than it was.

### Fixing the app.module

We don't need to change anything on the Auth.module, but we need to adapt the app.module

```jsx
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';

@Module({
    imports: [AuthModule],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
```

This app.module turned to a simple file, because the database usage was moved to users.module, and as the users.module is only used inside auth.module, we can keep the users.module there. 

### Running the app

We have everything ready to run, so inside your terminal run

```jsx
npm run start:dev
```

And we have all endpoints working perfectly! 

![Untitled](/blog-assets/migrating-nestjs-project-with-typeorm-to-prisma/untitled.png)

![Untitled](/blog-assets/migrating-nestjs-project-with-typeorm-to-prisma/untitled-1.png)

### Conclusion

I won't say which framework is better and to be honest, I love working with both, but, this blog post was just an example of changing ORM inside NesjJS and how hard or easy it can be. The project that was used here was a pretty simple project, and I personally think that in a real-world project, it can also be easy, depending on the way that the software was built, for example, if you have applied approaches like repositories where you are centralizing the ORM and etc it can become easy.
