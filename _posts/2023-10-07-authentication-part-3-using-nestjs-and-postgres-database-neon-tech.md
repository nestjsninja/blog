---
title: Authentication part 3 using NestJS and Postgres database neon.tech
excerpt: >-
  Hello fellow coders! Let's continue our series of NestJS auth flow
  implementations, and today we are going to add a database integration to keep
  users saved basically to work with the auth module.
coverImage: >-
  /blog-assets/authentication-part-3-using-nestjs-and-postgres-database-neon-tech/cover.png
date: '2023-10-07T12:00:00.000Z'
author:
  name: Henrique Weiand
  picture: /nestjs-ninja.png
ogImage:
  url: >-
    /blog-assets/authentication-part-3-using-nestjs-and-postgres-database-neon-tech/cover.png
tags:
  - NestJS
  - Node.js
  - Passion Economy
  - SWC
  - Typescript
  - Vercel
  - auth
---
Hello fellow coders! Let's continue our series of NestJS auth flow implementations, and today we are going to add a database integration to keep users saved basically to work with the auth module. 

> I am going to focus on the database integration and functionality instead of creating the entire CRUD for the user entity etc, OK?
> 

We are going to start using [TypeORM](https://typeorm.io/) as an [ORM](https://en.wikipedia.org/wiki/Object%E2%80%93relational_mapping) to help us interact with Postgres, but we also have an example of using [Prisma](https://www.prisma.io/) in the future and everything that we have to adapt to switch the ORMs if necessary. At the end we are implementing [neon.tech](http://neon.tech) as a production database, right? 😉

## Setting up TypeORM

First, as we don't have this in either the library or the module, let's use a few commands inside our project's folder to do it.

```bash
nest g module databse
```

and add the dependencies that we are going to use

```bash
npm install @nestjs/typeorm typeorm pg bcrypt

```

And then 

```bash
npm install -D reflect-metadata @types/bcrypt
```

<aside>
💡 Use any package manager that you like.

</aside>

Let's edit the created module `database.module.ts`

```bash
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
    imports: [
        TypeOrmModule.forRoot({
            type: 'postgres',
            host: 'localhost',
            port: 5432,
            username: 'postgres',
            password: 'root',
            database: 'project',
            entities: [`${__dirname}/../**/*.entity{.ts,.js}`],
            migrations: [`${__dirname}/../migrations/*{.ts,.js}`],
            synchronize: false,
            migrationsRun: true,
            logging: true,
        }),
    ],
})
export class DatabaseModule { }
```

For those who know a bit about NestJS, I know that we can improve this file, for example, by getting the values of this configuration from an ENV, and with ConfigModule, hold on! We are going to talk about it later, for now, we are focusing on the database and setup only. 

There are a few important configurations here to understand.

- Type: The database type you are going to use.
- Host, port, username, password, database: The traditional fields.
- Entities: In this case, it will guide the framework to find the files that we are eventually created to be as our tables and the code representation of them.
- Migrations: This will be the folder with all migrations that we are going to create to be used as a "recipe” for the developers to set up the same database inside their environments. If you want to understand more about it, check this link out → [https://docs.nestjs.com/techniques/database#migrations](https://docs.nestjs.com/techniques/database#migrations).
- Synchronize: I usually keep this option off, because if you keep it on, when your application starts it will try to sync your entity to your database, which can be a problem sometimes and make you lose some data, take care of using it!
- migrationsRun: It will make the application run the migrations with its starts.
- logging: This is to log everything that is happening inside the TypeORM. (Don't run it in production).

Well done fellow coders! Now that we already have the module, we can use it inside of the other places that intend to interact with the database.

Before we continue, let's open the `package.json` and add a few commands that will be useful ahead. 

```bash
"typeorm": "typeorm-ts-node-commonjs",
"migration:generate": "yarn typeorm migration:generate src/migrations/migration -d src/database/data-source.ts"
```

### Install local database with Docker

As you may have noticed, we don't have any database running, which means, if you run your project now, it will be like this.

![Screen Shot 2023-10-07 at 16.24.08.png](/blog-assets/authentication-part-3-using-nestjs-and-postgres-database-neon-tech/screen-shot-2023-10-07-at-16-24-08.png)

To solve it, we need to run the Postgres, and we are going to do it quickly with [Docker](https://www.docker.com/). Please access the website and install it before continuing.

Now, we have to create a new file inside the root folder called `docker-compose.yaml` with this content

```bash
version: '3.3'

services:
  postgres:
    container_name: postgres
    image: postgres:16-alpine
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: root
      POSTGRES_DB: project
      PGDATA: /data/postgres
      POSTGRES_HOST_AUTH_METHOD: trust
    ports:
      - '5432:5432'
    restart: unless-stopped
```

Speaking of it quickly, it is a "recipe” of a database Postgress that we are going to run inside Docker, it helps to have a smooth environment that can be easily replicated anywhere. We also have in this file the database credentials and the PORT that is going to be exposed inside the container. Now that we have the "recipe”, we need to run, so inside your terminal run

```bash
docker-compose up -d
```

And then, if you try to run the application again, it will be like this

![Screen Shot 2023-10-07 at 16.36.52.png](/blog-assets/authentication-part-3-using-nestjs-and-postgres-database-neon-tech/screen-shot-2023-10-07-at-16-36-52.png)

### Creating user entity

Inside our user's folder, let's create a file called `users.entity.ts`, and inside it, this content

```tsx
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'users' })
export class Users {
    @PrimaryGeneratedColumn('uuid', { name: 'id' })
    id: string;

    @Column()
    username: string;

    @Column()
    password: string;
}
```

This file represents basically a table, its columns, and all specifications, and in our context, we are only creating a table with three fields.

### Using migrations

As our idea is to use the command to create the migrations from our entities, we will need to create another file with the database credentials and repeat all the data over there.

<aside>
⚠️ We are going to improve this data repetition later

</aside>

Inside of database folder, create a new file called `data-source.ts`

```tsx
import 'reflect-metadata';
import { DataSource } from 'typeorm';

export const AppDataSource = new DataSource({
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password: 'root',
    database: 'project',
    entities: [`${__dirname}/../**/*.entity{.ts,.js}`],
    migrations: [`${__dirname}/../migrations/*{.ts,.js}`],
    synchronize: false,
});
```

The difference with the other is, that we are exporting a DataSource, and with the other, we just input the data inside a method, unfortunately, that method doesn't receive a DataSource, which means we are going to change a few things later, but for now, let's keep two files with the configurations.

To create our first migration after all of that, run the command

```tsx
yarn migration:generate
```

It will create folder migrations with the `users` migration inside, look:

![Screen Shot 2023-10-08 at 15.38.52.png](/blog-assets/authentication-part-3-using-nestjs-and-postgres-database-neon-tech/screen-shot-2023-10-08-at-15-38-52.png)

To run and finally create the table you just need to run the project

```tsx
yarn start:dev
```

The initialization process will create the table

![Screen Shot 2023-10-08 at 15.39.41.png](/blog-assets/authentication-part-3-using-nestjs-and-postgres-database-neon-tech/screen-shot-2023-10-08-at-15-39-41.png)

### Adjusting a few things

It is important to keep the user's credentials unredable to anyone so now, we will need to change the user.entity in order to be aligned with this rule

```jsx
import { BeforeInsert, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import * as bcrypt from 'bcrypt';

@Entity({ name: 'users' })
export class Users {
    @PrimaryGeneratedColumn('uuid', { name: 'id' })
    id: string;

    @Column()
    username: string;

    @Column()
    password: string;

    @BeforeInsert()
    async hashPassword() {
        this.password = await bcrypt.hash(this.password, 10);
    }
}
```

This decorator @BeforeInsert will run always before inserting a new user and it will apply a hash to the user’s password.

```jsx
@BeforeInsert()
async hashPassword() {
    this.password = await bcrypt.hash(this.password, 10);
}
```

Next, we have to make a few changes to our `users.service.ts`, these changes are important because they will interact with the input data and the database by using the repository.

```jsx
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Users } from './users.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(Users)
        private readonly userRepository: Repository<Users>,
    ) {}

    private async comparePasswords(
        userPassword: string,
        currentPassword: string,
    ) {
        return await bcrypt.compare(currentPassword, userPassword);
    }

    async findOneByUsername(username: string): Promise<Users | undefined> {
        return this.userRepository.findOne({ where: { username } });
    }

    async validateCredentials({
        username,
        password,
    }: {
        username: string;
        password: string;
    }): Promise<Users> {
        const user = await this.findOneByUsername(username);

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
    }): Promise<Users> {
        const userInDb = await this.findOneByUsername(username);
        if (userInDb) {
            throw new HttpException(
                'User already exists',
                HttpStatus.BAD_REQUEST,
            );
        }

        const user: Users = this.userRepository.create({
            username,
            password,
        });

        await this.userRepository.save(user);

        return user;
    }
}
```

 

Just after changing this service, we will also need to change the `auth.service.ts` because this service uses the `users.service.ts` by dependency injection and then its methods, so let’s do it as well.

```jsx
import {
    Injectable,
    InternalServerErrorException,
    UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private jwtService: JwtService,
    ) {}

    async signIn(username: string, pass: string) {
        const user = await this.usersService.validateCredentials({
            username,
            password: pass,
        });
        if (!user) {
            throw new UnauthorizedException();
        }
        const payload = { sub: user.id, username: user.username };
        return {
            access_token: await this.jwtService.signAsync(payload),
        };
    }

    async signUp(username: string, pass: string) {
        const user = await this.usersService.create({
            username,
            password: pass,
        });
        if (!user) {
            throw new InternalServerErrorException();
        }
        delete user.password;
        return user;
    }
}
```

Finally, let’s edit our Controller, which is our main port to the world, where the users hit the API to interact.

```jsx
import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Post,
    Request,
    UseGuards,
} from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) {}

    @HttpCode(HttpStatus.OK)
    @Post('signUp')
    signUp(@Body() signInDto: Record<string, any>) {
        return this.authService.signUp(signInDto.username, signInDto.password);
    }

    @HttpCode(HttpStatus.OK)
    @Post('signIn')
    signIn(@Body() signInDto: Record<string, any>) {
        return this.authService.signIn(signInDto.username, signInDto.password);
    }

    @UseGuards(AuthGuard)
    @Get('profile')
    getProfile(@Request() req) {
        return req.user;
    }
}
```

Well done! We are ready to run the project and test it.

```jsx
yarn start:dev
```

### Running the solution

First, let’s register a new user with the endpoint `auth/signUp`, like this

![Untitled](/blog-assets/authentication-part-3-using-nestjs-and-postgres-database-neon-tech/untitled.png)

After we can make the sign In like this

![Untitled](/blog-assets/authentication-part-3-using-nestjs-and-postgres-database-neon-tech/untitled-1.png)

---

## Using Neon.tech

As I had promised, let’s use [neon.tech](http://neon.tech) as a Postgres provider. You will have to open their website, create your account, and then create a project until you see this screen. 

![credentiaos-neon.png](/blog-assets/authentication-part-3-using-nestjs-and-postgres-database-neon-tech/credentiaos-neon.png)

Now, you have to find an option to create a database

![Untitled](/blog-assets/authentication-part-3-using-nestjs-and-postgres-database-neon-tech/untitled-2.png)

Create a database with the name that you want, in my case `nestjs-auth-flow-blog-post` and after that go to our file called `database.module.ts` where we have to put the credentials. Yours probably will be similar to mine

```jsx
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
    imports: [
        TypeOrmModule.forRoot({
            type: 'postgres',
            host: 'ep-yellow-bush-89528540.us-east-1.aws.neon.tech',
            port: 5432,
            username: 'henriqueweiand',
            password: 'YOUR PASSWORD HERE',
            database: 'nestjs-auth-flow-blog-post',
            entities: [`${__dirname}/../**/*.entity{.ts,.js}`],
            migrations: [`${__dirname}/../migrations/*{.ts,.js}`],
            synchronize: false,
            migrationsRun: true,
            logging: true,
            sslmode: 'require',
            ssl: true,
        }),
    ],
})
export class DatabaseModule {}
```

If you take a look, I also added these two lines to the original file.

```jsx
sslmode: 'require',
ssl: true,
```

Which is necessary! 

And then you can run your project again, and magically, you are already using the [neon.tech](http://neon.tech) database!!

---

### Conclusion

This was our last post about auth flow, it was a pretty simple way to implement an auth flow with username and password and of course, there are many other ways and advanced technical approaches to apply here, however, the target here was to show how we could do it as faster as we can. Feel free to improve and change anything that you like.

Thank you fellow devs!
