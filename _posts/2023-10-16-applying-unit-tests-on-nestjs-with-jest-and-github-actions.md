---
title: "Applying unit tests on NestJS with Jest and GitHub Actions"
excerpt: "Hello fellow coders! In this post we are still going to talk about tests, but, instead of e2e we are going to implement unit tests, I’d say they are kind of siblings, however, each one does different things, and they hav"
coverImage: "/blog-assets/applying-unit-tests-on-nestjs-with-jest-and-github-actions/untitled.png"
date: "2023-10-16T12:00:00.000Z"
author:
  name: "Henrique Weiand"
  picture: "/nestjs-ninja.png"
ogImage:
  url: "/blog-assets/applying-unit-tests-on-nestjs-with-jest-and-github-actions/untitled.png"
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
Hello fellow coders! In this post we are still going to talk about tests, but, instead of e2e we are going to implement `unit tests`, I’d say they are kind of siblings, however, each one does different things, and they have a taste in common, but they delivery value on their way. Ok! I will stop playing with the concept and focus on the details.

I am not going to rewrite the thousands of definitions that we can find on the internet, basically, `unit tests` will help your project to guarantee the consistency of some parts, and methods. As the proper name says, it is a unit, something simple and important for the whole process at the same time. To have a better vision of unit tests, we can compare them to e2e, where we are running the whole nestjs application basically, with unit tests we are going to run a module, a service, and pieces of the system, right?

Some references

[bliki: UnitTest](https://martinfowler.com/bliki/UnitTest.html)

[Definition of a Unit Test — The Art of Unit Testing](https://www.artofunittesting.com/definition-of-a-unit-test)

### The project

We are going to use a base project that was built previously on our last post about e2e, just because I don’t want to spend more time with setting up etc.

[https://github.com/nestjsninja/nestjs-auth-flow-blog-post-with-e2e](https://github.com/nestjsninja/nestjs-auth-flow-blog-post-with-e2e)

### Setting up

As the same we did for e2e tests, we have just a few details to do in order to make sure the unit tests will work well. First, let's create another jest configuration file, it will be called `jest-unit.json` 

```jsx
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "./src/",
  "testEnvironment": "node",
  "testRegex": ".spec-unit.ts$",
  "transform": {
    "^.+\\.(t|j)s$": ["@swc/jest"]
  }
}
```

I’m creating this configuration because I am applying different criteria to recognize the unit files to e2e.

```jsx
  "testRegex": ".spec-unit.ts$",
```

In our `package.json` I added one more command

```jsx
"test:unit": "jest --config ./jest-unit.json",
```

That’s all 😎

### Creating first unit test

In our example, we are going to do unit-tests for our two services

- auth.service.ts
- user.service.ts

It doesn’t mean that you can apply unit tests for something else, OK? You need to be aware of what you expect to guarantee the logic or something and then I’d suggest you apply tests on them.

### Applying unit tests into the auth.service

The first unit test that we are going to implement will be inside the auth.service, and the first step that we need to do is to create a new test file I will do it just beside the auth.service.ts file with the name `auth.service.spec-unit.ts`. I will post the whole file ready and then I will break it down little by little. OK?

<aside>
💡 Remember `spec-unit.ts` is an important part of the name because the jest will only run unit tests for those files that have this in their names.

</aside>

```jsx
import { TestingModule, Test } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
    let authService: AuthService;
    let usersServiceMock: UsersService;
    let jwtServiceMock: JwtService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: UsersService,
                    useValue: {
                        validateCredentials: jest.fn(),
                        create: jest.fn(),
                    },
                },
                {
                    provide: JwtService,
                    useValue: {
                        signAsync: jest.fn(),
                    },
                },
            ],
        }).compile();

        authService = module.get<AuthService>(AuthService);
        usersServiceMock = module.get<UsersService>(UsersService);
        jwtServiceMock = module.get<JwtService>(JwtService);
    });

    it('should sign in a user and return an access token', async () => {
        const user = {
            id: 1,
            username: 'testuser',
            password: 'password',
        };

        usersServiceMock.validateCredentials.mockResolvedValueOnce(user);
        jwtServiceMock.signAsync.mockResolvedValueOnce('token');

        const response = await authService.signIn('testuser', 'password');

        expect(response).toEqual({ access_token: 'token' });
    });

    it('should throw an UnauthorizedException if the user cannot be signed in', async () => {
        usersServiceMock.validateCredentials.mockResolvedValueOnce(null);

        await expect(
            authService.signIn('testuser', 'password'),
        ).rejects.toThrowError(UnauthorizedException);
    });

    it('should sign up a user and return the user', async () => {
        const user = {
            id: 1,
            username: 'testuser',
            password: 'password',
        };

        usersServiceMock.create.mockResolvedValueOnce(user);

        const response = await authService.signUp('testuser', 'password');

        expect(response).toEqual(user);
        expect(response.password).toBeUndefined();
    });

    it('should throw an InternalServerErrorException if the user cannot be signed up', async () => {
        usersServiceMock.create.mockRejectedValueOnce(new Error());

        await expect(
            authService.signUp('testuser', 'password'),
        ).rejects.toThrowError(Error);
    });
});
```

To give an overview of this test, let’s start looking at the beginning because this unit test was almost the same that we did with e2e, I mean, both tests have the `beforeAll` part, where we’re declaring the vars that are going to be used and the test module indeed.

```jsx
let authService: AuthService;
let usersServiceMock: UsersService;
let jwtServiceMock: JwtService;

beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
        providers: [
            AuthService,
            {
                provide: UsersService,
                useValue: {
                    validateCredentials: jest.fn(),
                    create: jest.fn(),
                },
            },
            {
                provide: JwtService,
                useValue: {
                    signAsync: jest.fn(),
                },
            },
        ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    usersServiceMock = module.get<UsersService>(UsersService);
    jwtServiceMock = module.get<JwtService>(JwtService);
});
```

IMPORTANT: We are testing the main methods of the `auth.service`, which means, we don’t need to task the behaviors of the libraries that it is using. For those libraries, we can mock (it was what I did) and force a return as it was done well or not, but remember, you have to focus on your unit test. These lines create a mock of UserService and JWTService. 

```jsx
{
    provide: UsersService,
    useValue: {
        validateCredentials: jest.fn(),
        create: jest.fn(),
    },
},
{
    provide: JwtService,
    useValue: {
        signAsync: jest.fn(),
    },
},
```

Once you have a mock of the function, you can take advantage of it and force a response on the defined methods. It is also important to know that they are dependencies for the service that we are applying our unit test, which makes us put them inside our providers.

![Untitled](/blog-assets/applying-unit-tests-on-nestjs-with-jest-and-github-actions/untitled.png)

### First test

```jsx
it('should sign in a user and return an access token', async () => {
    const user = {
        id: 1,
        username: 'testuser',
        password: 'password',
    };

    usersServiceMock.validateCredentials.mockResolvedValueOnce(user);
    jwtServiceMock.signAsync.mockResolvedValueOnce('token');

    const response = await authService.signIn('testuser', 'password');

    expect(response).toEqual({ access_token: 'token' });
});
```

This is a simple test, and I’d say that even though we have two mocks inside this test, which is almost everything for this function, I still think that this is one valid test because we are expecting to have always the same outcome in order to not break possible functions that are going to use this method 

```jsx
    expect(response).toEqual({ access_token: 'token' });
```

Let’s see one more from this service.

```jsx
it('should sign up a user and return the user', async () => {
    const user = {
        id: 1,
        username: 'testuser',
        password: 'password',
    };

    usersServiceMock.create.mockResolvedValueOnce(user);

    const response = await authService.signUp('testuser', 'password');

    expect(response).toEqual(user);
    expect(response.password).toBeUndefined();
});
```

One of the values from this unit test, for example, is to guarantee that we are not passing the user’s password outside of the response of the signUp method, besides having the other information.

### Unit tests for users.service

Create a file called `users.service.spec-unit.ts` close to the users.service indeed and there we are going to have something similar to the previous test.

```jsx
import { UsersService } from './users.service';
import { Users } from './users.entity';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpException } from '@nestjs/common';

export class userRepositoryMock {
    findOne = jest.fn();
    create = jest.fn();
    save = jest.fn();
}

describe('UsersService', () => {
    let usersService: UsersService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UsersService,
                {
                    provide: getRepositoryToken(Users),
                    useClass: userRepositoryMock,
                },
            ],
        }).compile();

        usersService = module.get<UsersService>(UsersService);
    });

    describe('findOneByUsername', () => {
        it('should return a user if found', async () => {
            const user = new Users();
            user.username = 'testuser';
            user.password = 'password';
            (usersService as any).userRepository.findOne.mockResolvedValueOnce(
                user,
            );
            const foundUser = await usersService.findOneByUsername('testuser');
            expect(foundUser).toEqual(user);
        });

        it('should return undefined if user not found', async () => {
            (usersService as any).userRepository.findOne.mockResolvedValueOnce(
                undefined,
            );
            const foundUser = await usersService.findOneByUsername('testuser');
            expect(foundUser).toBeUndefined();
        });
    });

    describe('validateCredentials', () => {
        it('should return a user if credentials are valid', async () => {
            const user = new Users();
            user.username = 'testuser';
            user.password = 'password';

            jest.spyOn(usersService, 'comparePasswords');

            (usersService as any).userRepository.findOne.mockResolvedValueOnce(
                user,
            );
            (usersService as any).comparePasswords.mockResolvedValueOnce(true);

            const validatedUser = await usersService.validateCredentials({
                username: 'testuser',
                password: 'password',
            });
            expect(validatedUser).toEqual(user);
        });

        it('should throw a 401 error if user not found', async () => {
            (usersService as any).userRepository.findOne.mockResolvedValueOnce(
                undefined,
            );
            await expect(
                usersService.validateCredentials({
                    username: 'testuser',
                    password: 'password',
                }),
            ).rejects.toThrowError(HttpException);
        });

        it('should throw a 401 error if password is invalid', async () => {
            const user = new Users();
            user.username = 'testuser';
            user.password = 'password';
            (usersService as any).userRepository.findOne.mockResolvedValueOnce(
                user,
            );
            await expect(
                usersService.validateCredentials({
                    username: 'testuser',
                    password: 'incorrect-password',
                }),
            ).rejects.toThrowError(HttpException);
        });
    });

    describe('create', () => {
        it('should create a new user if username is not already in use', async () => {
            const user = new Users();
            user.username = 'testuser';
            user.password = 'password';
            (usersService as any).userRepository.findOne.mockResolvedValueOnce(
                undefined,
            );
            (usersService as any).userRepository.create.mockReturnValue(user);
            const createdUser = await usersService.create({
                username: 'testuser',
                password: 'password',
            });
            expect(createdUser).toEqual(user);
        });

        it('should throw a 400 error if username is already in use', async () => {
            const user = new Users();
            user.username = 'testuser';
            user.password = 'password';
            (usersService as any).userRepository.findOne.mockResolvedValueOnce(
                user,
            );
            await expect(
                usersService.create({
                    username: 'testuser',
                    password: 'password',
                }),
            ).rejects.toThrowError(HttpException);
        });
    });
});
```

This time we are testing only the methods from user.service, so we can get one example

```jsx
describe('findOneByUsername', () => {
    it('should return a user if found', async () => {
        const user = new Users();
        user.username = 'testuser';
        user.password = 'password';
        (usersService as any).userRepository.findOne.mockResolvedValueOnce(
            user,
        );
        const foundUser = await usersService.findOneByUsername('testuser');
        expect(foundUser).toEqual(user);
    });

    it('should return undefined if user not found', async () => {
        (usersService as any).userRepository.findOne.mockResolvedValueOnce(
            undefined,
        );
        const foundUser = await usersService.findOneByUsername('testuser');
        expect(foundUser).toBeUndefined();
    });
});
```

Important to remember that we don’t want to test the repository functionality, and that’s why we are mocking the repository functions that are used inside of the service.

This part of the test is making sure that any service or place that uses the findOneByUsername method from user.service, can return nothing or a user, which helps the project to have a guarantee of the function’s behavior for the future. And yes, we have to think a lot about the future team, and everything that we implement today to avoid problems in the future. It looks like unnecessary, but it is necessary.

Two more interesting tests

```jsx
it('should throw a 401 error if user not found', async () => {
      (usersService as any).userRepository.findOne.mockResolvedValueOnce(
          undefined,
      );
      await expect(
          usersService.validateCredentials({
              username: 'testuser',
              password: 'password',
          }),
      ).rejects.toThrowError(HttpException);
  });

  it('should throw a 401 error if password is invalid', async () => {
      const user = new Users();
      user.username = 'testuser';
      user.password = 'password';
      (usersService as any).userRepository.findOne.mockResolvedValueOnce(
          user,
      );
      await expect(
          usersService.validateCredentials({
              username: 'testuser',
              password: 'incorrect-password',
          }),
      ).rejects.toThrowError(HttpException);
  });
```

This time we are validating the function’s behavior when something does not go well, like the wrong password or when the user is not found by using the usersService.validateCredentials method. 

### Adding tests on the GitHub Actions pipeline

As easy as it was on the e2e case, let’s open the `cy.yml` and edit it

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
  unit-test:
    runs-on: ubuntu-latest

    steps:
    - name: Checkout repository
      uses: actions/checkout@v2

    - name: Use Node.js ${{ env.NODE_VERSION }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ env.NODE_VERSION }}

    - name: Install Dependencies
      run: yarn install

    - name: Unit testing
      run: |
        yarn test:unit
```

What I changed here was, that I removed the Postgres service and changed the command that is going to run on the pipeline to execute the tests. 

![Untitled](/blog-assets/applying-unit-tests-on-nestjs-with-jest-and-github-actions/untitled-1.png)

### Conclusion

You can get the entire code from this repo

[https://github.com/nestjsninja/nestjs-auth-flow-blog-post-with-unit-tests](https://github.com/nestjsninja/nestjs-auth-flow-blog-post-with-unit-tests)

Ok, fellow coders, we finished one more post about tests, I hope you can get something from it, and I strongly recommend you if you don’t have any tests, to think a bit more about implementing, because as I mentioned before, maybe it can save some hours of debugging the software in the future because you simply changed the behavior of one method that was being referenced from other scripts. 

![Untitled](/blog-assets/applying-unit-tests-on-nestjs-with-jest-and-github-actions/untitled-2.png)
