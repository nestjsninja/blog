---
title: "Applying integration test on NestJS with Jest and GitHub Actions"
excerpt: "Hello fellow coders! Today we are going to talk a bit about tests inside NestJS, let’s start looking at and applying one type of test and later we are going to see another, so the first one will be e2e."
coverImage: "/blog-assets/applying-integration-test-on-nestjs-with-jest-and-github-actions/untitled.png"
date: "2023-10-16T12:00:00.000Z"
author:
  name: "Henrique Weiand"
  picture: "/nestjs-ninja.png"
ogImage:
  url: "/blog-assets/applying-integration-test-on-nestjs-with-jest-and-github-actions/untitled.png"
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
Hello fellow coders! Today we are going to talk a bit about tests inside NestJS, let’s start looking at and applying one type of test and later we are going to see another, so the first one will be e2e. 

### Definition

“End-to-end testing is a software testing technique that verifies the functionality and performance of an entire software application from start to finish by simulating real-world user scenarios and replicating live data. Its objective is to identify bugs that arise when all components are integrated, ensuring that the application delivers the expected output as a unified entity.” - [https://katalon.com/resources-center/blog/end-to-end-e2e-testing](https://katalon.com/resources-center/blog/end-to-end-e2e-testing)

In this example, we are going to use the auth project ([one that we did previously from another post](https://medium.com/@henrique.weiand/implementing-auth-flow-as-fast-as-possible-using-nestjs-bdf87488bc00)) and focus on applying the e2e test inside the unique controller that this application has. Our focus will be to test the possible responses that we can have when a user interacts with the endpoints from the auth controller. 

### Setting the project up

Even though the project is previously finished, we need to change one thing inside the setup to run our tests with the `SWC`.  Let’s start with the dependencies

```jsx
npm --save-dev @swc/jest
```

Create inside the root directory a file called `.swcrc`

```jsx
{
    "$schema": "https://json.schemastore.org/swcrc",
    "sourceMaps": true,
    "jsc": {
      "parser": {
        "syntax": "typescript",
        "decorators": true,
        "dynamicImport": true
      },
      "transform": {
        "legacyDecorator": true,
        "decoratorMetadata": true
      },
      "baseUrl": "./"
    },
    "minify": false
  }
```

Let`s change the `jest-e2e.json` 

![Untitled](/blog-assets/applying-integration-test-on-nestjs-with-jest-and-github-actions/untitled.png)

Inside the `package.json`, we also need to make some changes

![Untitled](/blog-assets/applying-integration-test-on-nestjs-with-jest-and-github-actions/untitled-1.png)

All these changes above are important to make the `jest` run integrated with `SWC`, but also to guarantee that the files are getting the right configuration.

### Creating the tests

Before we start, make sure you are running Postgres, in my case, inside the project folder I am going to run the command. 

```jsx
docker-compose up -d
```

Let’s create the file `auth.controller.e2e-spec.ts` inside the `auth` folder, and our first test will be to test if we are able to create a new user. 

```jsx
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Repository } from 'typeorm';
import { Users } from '../users/users.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthModule } from './auth.module';
import { DatabaseModule } from '../database/database.module';

const testUsername = 'authControllerE2ETests';

describe('AuthController', () => {
    let app: any;
    let httpServer: any;
    let repository: Repository<Users>;
    let authService: AuthService;

    beforeAll(async () => {
        const module = await Test.createTestingModule({
            imports: [DatabaseModule, AuthModule],
        }).compile();

        app = module.createNestApplication();
        authService = module.get<AuthService>(AuthService);
        repository = module.get<Repository<Users>>(getRepositoryToken(Users));

        await app.init();
        httpServer = app.getHttpServer();
    });

    afterAll(async () => {
        await app.close();
    });

    afterEach(async () => {
        await repository.delete({
            username: testUsername,
        });
    });

    describe('SingUp', () => {
        it('should create a user', async () => {
            const createUserRequest: { username: string; password: string } = {
                username: testUsername,
                password: 'password',
            };
            const response = await request(httpServer)
                .post('/auth/signUp')
                .send(createUserRequest);

            expect(response.status).toBe(HttpStatus.OK);
            expect(response.body).toHaveProperty(
                'username',
                createUserRequest.username,
            );
            expect(response.body).toHaveProperty('id');

            const user = await repository.findOne({
                where: {
                    username: createUserRequest.username,
                },
            });
            expect(user).toMatchObject({
                username: createUserRequest.username,
            });
        });
    });

});
```

We have lots of new information just in this first part, right? let’s break it down in a few parts in order to understand the concepts.

### Base

```jsx
let app: any;
let httpServer: any;
let repository: Repository<Users>;
let authService: AuthService;

beforeAll(async () => {
    const module = await Test.createTestingModule({
        imports: [DatabaseModule, AuthModule],
    }).compile();

    app = module.createNestApplication();
    authService = module.get<AuthService>(AuthService);
    repository = module.get<Repository<Users>>(getRepositoryToken(Users));

    await app.init();
    httpServer = app.getHttpServer();
});

afterAll(async () => {
    await app.close();
});
```

I am calling this part of “base”, however, it can change according to the test that you are going to apply, OK?

`beforeAll` is a function that is going to run every time before every test inside this file, you can take advantage here of pre-defined mocks, connections, and everything that you will need to run it. 

`afterAll` is almost the same concept as beforeAll, but, instead of running at the beginning, it will run at the end and in this case, we here are just closing the app instance. 

Going deep into the `beforeAll`, we have the definition of the module (this one basically you will always have inside a test, however, its content will change according to what it's going to test, in our example, we are testing the application focus on AuthContollers, so I am focusing this test file with all the dependencies that the `AuthModule` can have, that’s why I am importing DatabaseModule besides AuthModule indeed.

Both `authService` and `repository` are variables that are getting the service and repository instance that were previously called inside the `createTestingModule`, they will be used inside of the tests to create and check if some behaviors really happened inside of the system by the interaction with the endpoints.

Lastly, `httpServer = app.getHttpServer();` is the URL of the test application, it will be used with [Supertest](https://www.npmjs.com/package/supertest) to send requests to the endpoints.

---

### Keeping the base clean

> Have in mind that we are using the APIs inside of one same Postgres instance, so in this case according to our tests are running, it can turns out being dirty because of the tests
> 

There are several approaches to keep the test database clean, in this example, I am defining one `username` fixed and between each test, I am cleaning the record in order to keep everything as neat as possible, for example.

```jsx
const testUsername = 'authControllerE2ETests';

afterEach(async () => {
    await repository.delete({
        username: testUsername,
    });
});
```

In this case, I am using the repository that I mentioned previously to interact with the database directly and keep it clear.

### SingUp

Let’s break this first test into two parts, the first one is testing the usage of the endpoint. It is clear to read what is happening here, look

```jsx
const createUserRequest: { username: string; password: string } = {
      username: testUsername,
      password: 'password',
  };
  const response = await request(httpServer)
      .post('/auth/signUp')
      .send(createUserRequest);

  expect(response.status).toBe(HttpStatus.OK);
  expect(response.body).toHaveProperty(
      'username',
      createUserRequest.username,
  );
  expect(response.body).toHaveProperty('id');
```

We are basically, using the endpoint and sending the data as it was defined, and using the response we are checking the values with the `expect` methods.

In the second part, we are making sure the value was saved adequately inside the database. Here again, we are using the `repository` to access the database and check the record.

```jsx
const user = await repository.findOne({
    where: {
        username: createUserRequest.username,
    },
});
expect(user).toMatchObject({
    username: createUserRequest.username,
});
```

To test it, you need to run

```jsx
npm run test:e2e
```

I hope you can see something like this 😅

![Untitled](/blog-assets/applying-integration-test-on-nestjs-with-jest-and-github-actions/untitled-2.png)

---

### SignIn

```jsx
describe('signIn', () => {
    it('should create the JWT', async () => {
        const createUserRequest = {
            username: testUsername,
            password: 'password',
        };
        const newUser = repository.create(createUserRequest);
        await repository.save(newUser);

        const signInRequest = {
            username: testUsername,
            password: 'password',
        };
        const signInResponse = await request(httpServer)
            .post('/auth/signIn')
            .send(signInRequest);

        expect(signInResponse.status).toBe(HttpStatus.OK);
        expect(signInResponse.body).toHaveProperty('access_token');
    });
});
```

The case here is similar, however, we are no longer testing the SignUp endpoint, instead, we are using the `repository` to create the user record inside the database and then we are using the SignIn endpoint to make the sign-in and finally, checking the response properly. 

We are doing the test like that, because we tested the Sign up previously, and we want to keep the segregation of test responsibilities, and the responsibility of this test now is to check if the JWT is being created when the endpoint is used.   

### Get profile data

```jsx
describe('getProfile', () => {
    it('should get the user profile with valid JWT', async () => {
        const createUserRequest = {
            username: testUsername,
            password: 'password',
        };
        const newUser = repository.create(createUserRequest);
        await repository.save(newUser);

        const signInResponse = await authService.signIn(
            createUserRequest.username,
            createUserRequest.password,
        );

        expect(signInResponse).toHaveProperty('access_token');

        const { access_token } = signInResponse;

        const profileResponse = await request(httpServer)
            .get('/auth/profile')
            .set('Authorization', `Bearer ${access_token}`);

        expect(profileResponse.status).toBe(HttpStatus.OK);
        expect(profileResponse.body).toHaveProperty(
            'username',
            createUserRequest.username,
        );
    });

    it('should not get the user profile without a valid JWT', async () => {
        const profileResponse =
            await request(httpServer).get('/auth/profile');

        expect(profileResponse.status).toBe(HttpStatus.UNAUTHORIZED);
    });
});
```

For this last case, we are testing if after the user creates his account, he can use the endpoint to get his data, and respecting the guards and the usage of JWT inside of the endpoint.

As you can see, we have two tests, one to test the “happy case” and the second one to test the “bad case” when the user is doing something wrong. 

### Configuring the environments

The main idea is to run the tests inside a CI/CD pipeline, for this reason, we need to adapt the way that our system is getting the running environments, in this case, I am going to get the code related to the module `env` from the other post that we did.

[Creating a configuration module like a specialist with Zod inside NestJS](https://blog.henriquew.com/creating-a-configuration-module-like-a-specialist-with-zod-insidenestjs)

As we are going to have a new module, It is necessary to add it inside of the `app.module.ts`

```jsx
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DatabaseModule } from './database/database.module';
import { EnvModule } from './env/env.module';

@Module({
    imports: [EnvModule, AuthModule, UsersModule, DatabaseModule],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
```

Now, our `database.module.ts` also needs to be improved

 

```jsx
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnvModule } from '../env/env.module';
import { EnvService } from '../env/env.service';

@Module({
    imports: [
        TypeOrmModule.forRootAsync({
            imports: [EnvModule],
            inject: [EnvService],
            useFactory(env: EnvService) {
                const isTesting = env.get('NODE_ENV') === 'test';

                return {
                    type: 'postgres',
                    host: 'localhost',
                    port: 5432,
                    username: 'postgres',
                    password: 'root',
                    database: isTesting ? 'tests' : 'project',
                    entities: [`${__dirname}/../**/*.entity{.ts,.js}`],
                    migrations: [`${__dirname}/../migrations/*{.ts,.js}`],
                    synchronize: false,
                    migrationsRun: true,
                    logging: true,
                };
            },
        }),
    ],
})
export class DatabaseModule {}
```

There’s something important here, look at the conditional

```jsx
database: isTesting ? 'tests' : 'project',
```

It means that when the test is running, it will use a database called `tests`. By default, jest will put the `NODE_ENV` with the value `test` and then this conditional will be true.

> As we importanted the code from the other project, don’t forget to install the two necessery dependencies, `zod` ****and **`@nestjs/config`**
> 

As we made some changes to how the software works, we also had to update the test dependencies

```jsx
const module = await Test.createTestingModule({
    imports: [EnvModule, DatabaseModule, AuthModule],
}).compile();
```

### Adding Github actions to run the e2e

To finish our post, let’s add something else very cool and useful, let’s add the tests to run inside our CI/CD pipeline, it will help the project to guarantee that everybody is respecting the tests. Let’s create a file inside `.github/workflows/ci.yml`

```jsx
name: Run integration testing

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: 19.0.1

jobs:
  integration-test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: root
          POSTGRES_DB: tests
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
    - name: Checkout repository
      uses: actions/checkout@v2

    - name: Use Node.js ${{ env.NODE_VERSION }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ env.NODE_VERSION }}

    - name: Install Dependencies
      run: yarn install

    - name: Integration testing
      run: |
        yarn test:e2e
      env:
        NODE_ENV: test
```

This configuration looks like a “cake recipe”, where we are setting all steps, look at the beginning where we are saying that we need a container of Postgres with a specific configuration

```jsx
services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: root
          POSTGRES_DB: tests
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
```

Then, we are saying to install the dependencies and run the e2e

```jsx
steps:
    - name: Checkout repository
      uses: actions/checkout@v2

    - name: Use Node.js ${{ env.NODE_VERSION }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ env.NODE_VERSION }}

    - name: Install Dependencies
      run: yarn install

    - name: Integration testing
      run: |
        yarn test:e2e
      env:
        NODE_ENV: test
```

Our service is ready to understand the `NODE_ENV` with the value `test` and set the test environments according to what we need.

![Untitled](/blog-assets/applying-integration-test-on-nestjs-with-jest-and-github-actions/untitled-3.png)

### Conclusion

In the end, I hope you can see something like this.

![Untitled](/blog-assets/applying-integration-test-on-nestjs-with-jest-and-github-actions/untitled-4.png)

I always feel so good about myself in seeing all green 😅.

We did here a basic example of e2e tests for our auth controller, but remember, it is important to guarantee the essential use cases of your system, just to make sure any changes that can have been implemented do not cause a bad experience to users. Even though we don’t want to create bugs, some things happen eventually. 

## Codebase

[https://github.com/nestjsninja/nestjs-auth-flow-blog-post-with-e2e](https://github.com/nestjsninja/nestjs-auth-flow-blog-post-with-e2e)
