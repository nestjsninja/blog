---
title: Creating a NodeJS project without frameworks in 2023
excerpt: 'Hello fellow coders! Let''s start with a few questions:'
coverImage: /blog-assets/creating-a-nodejs-project-without-frameworks-in-2023/cover.png
date: '2023-10-16T12:00:00.000Z'
author:
  name: Henrique Weiand
  picture: /nestjs-ninja.png
ogImage:
  url: /blog-assets/creating-a-nodejs-project-without-frameworks-in-2023/cover.png
tags:
  - Fastify
  - Github
  - Node.js
  - Patterns
  - Prisma
  - Tests
  - Typescript
  - Vitest
  - auth
---
Hello fellow coders! Let's start with a few questions:

- How difficult is it to keep up to date with all technologies, trends, libs, and frameworks?
- Do you feel aligned with the most used technologies?
- Do you still know how to implement a simple NodeJS in 2023? I mean, with everything that was updated so far inside this ecosystem?

I know, that many of us who started working in 2000 or even later, may feel an impostors because we have to be up-to-date with so many subjects, and recently this topic came to my mind, "a NodeJS project without frameworks in 2023”, **what is it looks like?**

![Among-Us-Logo-1.png](/blog-assets/creating-a-nodejs-project-without-frameworks-in-2023/among-us-logo-1.png)

Today's mission is to review a few approaches to building a NodeJS project using common libraries to build a backend API that saves users and is able to make sign-up and sign-in.

---

### Disclaimer 💡

This post is not a source of truth about this subject, it's just one way of building an API according to reachers that I made. The target here is just one, exercise of the "old way” of building an API without a framework.

### Curios fact 🤔

Even though, this post does not use a Framework as many posts that I usually write do, like NestJS. It's interesting to compare and see some patterns that are applied in both cases like good and bad points.

### The project 🛠

The project is simple and we are going to implement an API its response will be a user entity with its addresses that can be saved, also, this API will be able to make a login.

<aside>
⚠️ I am not going to be so deep into the points, because I intend to finish this post this year 😅

</aside>

[https://github.com/nestjsninja/nodejs-basic-structure](https://github.com/nestjsninja/nodejs-basic-structure)

### Setting up

As a node project, let's start with the command to start the project

```tsx
npm init -y
```

After that, we need to install the required libraries to create an API. (I'm about to use Fastify instead of ExpressJS).

```tsx
npm i @fastify/jwt bcryptjs dotenv fastify zod @prisma/client
```

And also the development dependencies

```tsx
npm install --save-dev @rocketseat/eslint-config @types/bcryptjs @types/node @types/supertest @vitest/coverage-c8 @vitest/ui eslint npm-run-all prisma supertest tsup tsx typescript vite-tsconfig-paths vitest
```

After the commands, let's configure the `scripts` inside your `package.json`

```tsx
"scripts": {
    "start:dev": "tsx watch src/server.ts",
    "start": "node build/server.js",
},
```

Let's create the tsconfig base by using the command

```tsx
npx tsc --init
```

Besides these configurations above, I also configured things like .**gitignore, ESLint, .env, .npmrc, vite.confg, and the docker-compose.yml**. All those configurations can be found inside the repository's URL because I am not going to talk about each one here. ([Repository](https://github.com/nestjsninja/nodejs-basic-structure))

![Screen Shot 2023-10-21 at 13.59.22.png](/blog-assets/creating-a-nodejs-project-without-frameworks-in-2023/screen-shot-2023-10-21-at-13-59-22.png)

**Overview**

- ESLint: Project patterns among the developers;
- npmrc: A specific configuration to keep the libraries' versions exactly;
- docker-compose: The project dependency, in this case, we need a Postgres database;
- .env: The environment configs, necessary to run the project;
- vite.config: File that sets up the Vitest to understand the repository configurations;

And finally, we can create some files:

- src/app.ts
- src/server.ts

Our server.ts, will have the following code

```tsx
import { app } from "./app";
import { env } from "./env";

app
  .listen({
    host: "0.0.0.0",
    port: env.PORT,
  })
  .then(() => {
    console.log("🚀 HTTP Server Running!");
  });
```

We are going to get the environment configs soon, but let's keep it ready for that.

The app.ts, will have lots of configurations already done, but don't worry we are going to talk about them soon as well.

```tsx
import fastifyJwt from '@fastify/jwt'
import fastify from 'fastify'
import { ZodError } from 'zod'
import { env } from '@/env'
import { usersRoutes } from '@/http/controllers/users/routes'

export const app = fastify()

app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    cookie: {
        cookieName: 'refreshToken',
        signed: false,
    },
    sign: {
        expiresIn: '10m',
    },
})

app.register(usersRoutes)

app.setErrorHandler((error, _, reply) => {
    if (error instanceof ZodError) {
        return reply
            .status(400)
            .send({ message: 'Validation error.', issues: error.format() })
    }

    if (env.NODE_ENV !== 'production') {
        console.error(error)
    } else {
        // TODO: Here we should log to a external tool like DataDog/NewRelic/Sentry
    }

    return reply.status(500).send({ message: 'Internal server error.' })
})
```

Reviewing what we have inside this app.ts file is:

- Definition of fastify instance and the register of the routes as well as the JWT configuration.
- Definition of the error handle, that is using ZOD to interpratate the erros to display a nice message.
- The env is also present in this file to get the environment configs like JWT_SECRET.

### Getting the environment automatically

Let's take a look at the `src/env/index.ts` file

```jsx
import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['dev', 'test', 'production']).default('dev'),
  JWT_SECRET: z.string(),
  PORT: z.coerce.number().default(3333),
	DATABASE_URL: z.string(),
})

const _env = envSchema.safeParse(process.env)

if (_env.success === false) {
  console.error('❌ Invalid environment variables', _env.error.format())

  throw new Error('Invalid environment variables.')
}

export const env = _env.data
```

Here we are using ZOD with dotenv library, to get the environments that were set inside .env file and ZOD is doing an amazing job by validating their values and when necessary applying a default value.

### Database

In this project, we are using [Prisma](https://www.prisma.io/) as ORM and in order to set it up, we need to run the command

```jsx
npx prisma init
```

This command will create a file inside `prisma/schema.prisma` this is the file where we are going to design the tables with code and then Prisma will transform it to migrations.

[](https://github.com/nestjsninja/nodejs-basic-structure/blob/778d280f533cd8dcf82ffe14d9b92edb74997d58/prisma/schema.prisma)

You can check out the final version of the file on the link above, but, as I mentioned in this project we are creating two tables, one for the users’ data and another one for the addresses, which is connected to a one-user.

<aside>
💡 Don't forget to install and configure the [VSCode extension](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma) for Prisma
 ‣

</aside>

I also like to add the two basic Prisma commands to my scripts section in the `packages.json`

```jsx
"prisma:migrate": "npx prisma migrate dev",
"prisma:studio": "npx prisma studio"
```

What do they do?

- prisma:migrate - This command will interpret the prisma.schema and create the migration according to the changes (Database ↔ schema).
- prisma:studio - This is the visual interface where you can see and manage manually the database data.

Before we run the command, make sure you have two things:

1. You are running the docker, you can do it with the command `docker-compose up -d` inside the root of the project;
2. You have configured the `.env` file

Now, run the command

```jsx
npm run prisma:migrate
```

### Backing to the project files and structure

Backing to the app.ts file, we can see that we defined a route with the register method and also we are importing a route file

```jsx
import { usersRoutes } from '@/http/controllers/users/routes'
```

We are implementing the [concept of controllers](https://github.com/FastifyResty/fastify-resty/blob/main/docs/Entity-Controllers.md). As our application is very small, we just have one entity and just one file to centralize all routes of this entity

```jsx
import { FastifyInstance } from 'fastify'

import { verifyJwt } from '@/http/middlewares/verify-jwt'

import { authenticate } from './authenticate'
import { profile } from './profile'
import { register } from './register'

export async function usersRoutes(app: FastifyInstance) {
  app.post('/users', register)
  app.post('/sessions', authenticate)

  /** Authenticated */
  app.get('/me', { onRequest: [verifyJwt] }, profile)
}
```

Using the register route as an example, we can see it

```jsx
import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { UserAlreadyExistsError } from '@/use-cases/errors/user-already-exists-error'
import { makeRegisterUseCase } from '@/use-cases/factories/make-register-use-case'

export async function register(request: FastifyRequest, reply: FastifyReply) {
  const registerBodySchema = z.object({
    name: z.string(),
    email: z.string().email(),
    password: z.string().min(6),
    address: z.array(
      z.object({
        title: z.string(),
        street_address: z.string(),
        city: z.string(),
        postal_code: z.string(),
        country: z.string(),
      })
    ).optional().default([]),
  })

  const { name, email, password, address } = registerBodySchema.parse(request.body)

  try {
    const registerUseCase = makeRegisterUseCase()

    await registerUseCase.execute({
      name,
      email,
      password,
      address
    })
  } catch (err) {
    if (err instanceof UserAlreadyExistsError) {
      return reply.status(409).send({ message: err.message })
    }

    throw err
  }

  return reply.status(201).send()
}
```

The controller is just an open door to the requests and once it receives the request, in this example, we are validating the input with ZOD, and in case of not having errors it will call a `use-case`. The use case is also a well-known strategy that comes from clear architecture, of having a specific code that is in charge of dealing with a problem, and that's exactly what we are about to do here.

> In Clean Architecture, a use case is a piece of business logic that represents a single task that the system needs to perform. The use case encapsulates the rules and logic required to perform the task, and defines the inputs and outputs required for the operation. - [font](https://nanosoft.co.za/blog/post/clean-architecture-use-cases)
> 

### Register use-case

The use case inside the register file is calling one file before the use case indeed, and with this file we are using another concept called `factories` , you can notice it by looking at the URL of the import "@/use-cases/factories/make-register-use-case”.

```tsx
import { PrismaUsersRepository } from '@/repositories/prisma/prisma-users-repository'
import { RegisterUseCase } from '../register'

export function makeRegisterUseCase() {
  const usersRepository = new PrismaUsersRepository()
  const registerUseCase = new RegisterUseCase(usersRepository)

  return registerUseCase
}
```

The `factory` is responsible for centralizing all dependencies that the use case is going to have, with this approach, we can centralize the imports as the applicating tents grow.

**RegisterUseCase**

```tsx
import { UsersRepository } from '@/repositories/users-repository'
import { UserAlreadyExistsError } from '@/use-cases/errors/user-already-exists-error'
import { Address, User } from '@prisma/client'
import { hash } from 'bcryptjs'

interface RegisterUseCaseRequest {
  name: string
  email: string
  password: string
  address: Address[]
}

interface RegisterUseCaseResponse {
  user: User
}

export class RegisterUseCase {
  constructor(private usersRepository: UsersRepository) { }

  async execute({
    name,
    email,
    password,
    address = []
  }: RegisterUseCaseRequest): Promise<RegisterUseCaseResponse> {
    const password_hash = await hash(password, 6)

    const userWithSameEmail = await this.usersRepository.findByEmail(email)

    if (userWithSameEmail) {
      throw new UserAlreadyExistsError()
    }

    const user = await this.usersRepository.create({
      name,
      email,
      password_hash,
      Address: {
        create: address.map((addr: Address) => ({
          title: addr.title,
          street_address: addr.street_address,
          city: addr.city,
          postal_code: addr.postal_code,
          country: addr.country,
        })),
      }
    })

    return {
      user,
    }
  }
}
```

Okay, here we have lots of things happening, so let's take a look.

First, we are using a concept called [dependency injection](https://stackify.com/dependency-injection/), which will provide `UsersRepository` to the use case. The user repository is responsible for handling the database in this case and giving the class the ability to manage de data, again, in this case, related to the database. The repository is applying the concept called [repository pattern](https://blog.logrocket.com/exploring-repository-pattern-typescript-node/). You can see more about the user repository indeed by accessing the **prisma-users-repository.ts.** I also created the same idea of repository but instead of handling the database, I used it [in memory](https://github.com/nestjsninja/nodejs-basic-structure/blob/main/src/repositories/in-memory/in-memory-users-repository.ts). In memory is important because it will be necessary to run the tests later.

[](https://github.com/nestjsninja/nodejs-basic-structure/blob/main/src/repositories/prisma/prisma-users-repository.ts)

This use case initially can be confusing because there are many things and patterns here, but with more time you’ll get used to it, especially, because if you are coming from a Framework, many of these approaches are similar.

Overall, inside our use-case, we are receiving the data and applying the business logic, as is expected to happen inside a use-case. In case of success, we create the user and in case of failure, we return a `throw new UserAlreadyExistsError()`

### Recapping what we saw already

We have other methods, use cases, etc, and all functions after here are basically the same process of the register, as I am not covering all the files, I hope you can get the idea with this example. Here we have an overview of the layers and the flow

![Screen Shot 2023-10-21 at 16.24.27.png](/blog-assets/creating-a-nodejs-project-without-frameworks-in-2023/screen-shot-2023-10-21-at-16-24-27.png)

### Unit tests

We are going to use [Vitest](https://vitest.dev/) for all the tests and partially we did the setup, once we installed the dependencies at the beginning of this post and also when we copied the [vite.cofig.ts](https://github.com/nestjsninja/nodejs-basic-structure/blob/main/vite.config.js)

Now, let's add the scripts inside the package.json

```tsx
"test": "vitest run --dir src/use-cases",
"test:watch": "vitest --dir src/use-cases",
```

The plan is to implement the unit tests for all the use cases, however, as the unit test must test only the business logic, we don’t need to test anything that comes outside of the use case, and in this case, I am talking about the database that is used inside the userRepository. Fortunately, we did an implementation previously that will help us with this dependency, with the [in memory repository](https://github.com/nestjsninja/nodejs-basic-structure/blob/main/src/repositories/in-memory/in-memory-users-repository.ts). Our first test will look like this

```tsx
import { InMemoryUsersRepository } from '@/repositories/in-memory/in-memory-users-repository'
import { UserAlreadyExistsError } from '@/use-cases/errors/user-already-exists-error'
import { compare } from 'bcryptjs'
import { expect, describe, it, beforeEach } from 'vitest'
import { RegisterUseCase } from './register'

let usersRepository: InMemoryUsersRepository
let sut: RegisterUseCase

describe('Register Use Case', () => {
  beforeEach(() => {
    usersRepository = new InMemoryUsersRepository()
    sut = new RegisterUseCase(usersRepository)
  })

  it('should to register', async () => {
    const { user } = await sut.execute({
      name: 'John Doe',
      email: 'johndoe@example.com',
      password: '123456',
    })

    expect(user.id).toEqual(expect.any(String))
  })

  it('should hash user password upon registration', async () => {
    const { user } = await sut.execute({
      name: 'John Doe',
      email: 'johndoe@example.com',
      password: '123456',
    })

    const isPasswordCorrectlyHashed = await compare(
      '123456',
      user.password_hash,
    )

    expect(isPasswordCorrectlyHashed).toBe(true)
  })

  it('should not be able to register with same email twice', async () => {
    const email = 'johndoe@example.com'

    await sut.execute({
      name: 'John Doe',
      email,
      password: '123456',
    })

    await expect(() =>
      sut.execute({
        name: 'John Doe',
        email,
        password: '123456',
      }),
    ).rejects.toBeInstanceOf(UserAlreadyExistsError)
  })
})
```

Here we can see how nicely the concept of dependency injection was applied, look below, at the differences between when we use it for tests (in memory) and when we use using for developing. We are defining the interface and both classes must implement it, in case it is valid as a dependency for the use-case. 👏🏻

![Screen Shot 2023-10-21 at 17.14.20.png](/blog-assets/creating-a-nodejs-project-without-frameworks-in-2023/screen-shot-2023-10-21-at-17-14-20.png)

the result is, we can test everything smoothly.

```tsx
beforeEach(() => {
  usersRepository = new InMemoryUsersRepository()
  sut = new RegisterUseCase(usersRepository)
})

it('should to register', async () => {
  const { user } = await sut.execute({
    name: 'John Doe',
    email: 'johndoe@example.com',
    password: '123456',
  })

  expect(user.id).toEqual(expect.any(String))
})
```

### e2e tests

The e2e tests will test the whole interaction with the endpoints, so we need to configure the setup of the Vitest to create basically a database with the tables apart from the main database and then we can execute methods to simulate the request, get the response and create the expectations.

I created this configuration in the folder `vitest-environment-prisma`, in order to make the Vitests run before the e2e starts.

[](https://github.com/nestjsninja/nodejs-basic-structure/tree/main/prisma/vitest-environment-prisma)

This code will be executed, and if you take a look at the code, it's easy to understand what is happening. We are running a few steps to create a new schema and inside this schema, we are going to run the migrations then, we have the database pre-requirement for our application and e2e tests.
Don't forget to add the scripts inside the packeage.json

```tsx
"test:create-prisma-environment": "npm link ./prisma/vitest-environment-prisma",
"test:install-prisma-environment": "npm link vitest-environment-prisma",
"pretest:e2e": "run-s test:create-prisma-environment test:install-prisma-environment",
"test:e2e": "vitest run --dir src/http",
"test:e2e:watch": "vitest --dir src/http",
```

- pretest: will run before the e2e test and it will run two scripts at the same time because of the run-s library that was installed as well. These commands are related to the setup of the e2e test.

Next, we are able to create the e2e test.

```tsx
import request from 'supertest'
import { app } from '@/app'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

describe('Register (e2e)', () => {
  beforeAll(async () => {
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('should be able to register', async () => {
    const response = await request(app.server).post('/users').send({
      name: 'John Doe',
      email: 'johndoe@example.com',
      password: '123456',
    })

    expect(response.statusCode).toEqual(201)
  })
})
```

This test creates the application and once it's ready, the library `supertest` creates a request to the endpoint according to the contract.

<aside>
⚠️ Don’t forget to close the app, exactly like we are doing inside afterAll method.

</aside>

### GitHub Actions

To finilize the post, we have the automated pipeline with GitHub Actions that will run both, unit test and e2e. 

[](https://github.com/nestjsninja/nodejs-basic-structure/tree/main/.github/workflows)

- The unit pipeline is very simple, it's just running the `npm run test` and validating the result.
- The e2e test, is a bit more complex than the unit test, just because it requires the postgres instance as you can check out, apart from that, it’s almost equal, just run the command `npm run test:e2e`

### Conclusion

Oh gosh, that's a lot, right? 

We applied lots of things, techniques, and patterns, but in the end, I felt good with the application that was built. Now I also can say that I am feeling a bit up-to-date with the technologies that this project involved and the way of building software without a framework, it also reminds me, why I like so much of using Frameworks…. go NestJS 💪🏼
