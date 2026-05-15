---
title: "Unit Tests in NestJS with Jest and GitHub Actions"
excerpt: "How to add focused unit tests to a NestJS auth flow with Jest, mocked providers, repository mocks, and a GitHub Actions pipeline."
coverImage: "/nestjs-ninja.png"
date: "2023-10-18T12:00:00.000Z"
author:
  name: "Henrique Weiand"
  picture: "/nestjs-ninja.png"
ogImage:
  url: "/nestjs-ninja.png"
tags:
  - NestJS
  - Jest
  - Unit Testing
  - GitHub Actions
---

Unit tests protect small pieces of a codebase. In a NestJS application, that usually means testing a service, provider, or isolated method without booting the entire application.

This post is based on my original Medium article, [Applying Unit Tests on NestJS with Jest and GitHub Actions](https://medium.com/p/9e1d6c672fb7). The example builds on an authentication flow and adds focused unit coverage for the auth and user services.

The final code from the original article is available at [nestjsninja/nestjs-auth-flow-blog-post-with-unit-tests](https://github.com/nestjsninja/nestjs-auth-flow-blog-post-with-unit-tests).

## Unit tests versus e2e tests

End-to-end tests exercise the application through a broader path. They usually start the NestJS app, call real routes, and verify complete behavior across modules.

Unit tests are narrower. They should answer questions like:

- does this service return the expected value?
- does this method throw when input is invalid?
- does this auth method avoid leaking a password?
- does this service call its dependencies correctly?

That smaller scope makes unit tests fast and useful during everyday development.

## Jest configuration

The project uses a separate Jest configuration for unit tests:

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "./src/",
  "testEnvironment": "node",
  "testRegex": ".spec-unit.ts$",
  "transform": {
    "^.+\\\\.(t|j)s$": ["@swc/jest"]
  }
}
```

The important line is the test regex:

```json
"testRegex": ".spec-unit.ts$"
```

That naming convention keeps unit tests separate from e2e specs. A unit test file should end with:

```text
.spec-unit.ts
```

Then add a package script:

```json
{
  "scripts": {
    "test:unit": "jest --config ./jest-unit.json"
  }
}
```

## What to test first

In the example auth project, the first targets are:

- `auth.service.ts`
- `users.service.ts`

Those services contain behavior that other parts of the system depend on. If their contract changes unexpectedly, login and signup flows can break.

## Testing `AuthService`

The `AuthService` depends on `UsersService` and `JwtService`. A unit test for `AuthService` should not test the real user service or the real JWT library. Those dependencies can be mocked.

```ts
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
```

This creates a Nest testing module with the real service under test and fake versions of its dependencies.

## Testing sign in

For a successful sign-in test, force the user service and JWT service to return known values:

```ts
usersServiceMock.validateCredentials.mockResolvedValueOnce(user);
jwtServiceMock.signAsync.mockResolvedValueOnce("token");

const response = await authService.signIn("testuser", "password");

expect(response).toEqual({ access_token: "token" });
```

Even though the dependencies are mocked, the test still protects the `signIn` contract. If the method stops returning `{ access_token }`, this test will catch it.

For the failure path, mock invalid credentials and expect an exception:

```ts
usersServiceMock.validateCredentials.mockResolvedValueOnce(null);

await expect(
  authService.signIn("testuser", "password"),
).rejects.toThrow(UnauthorizedException);
```

That verifies the behavior callers should expect when authentication fails.

## Testing sign up

Signup has another important rule: the response should not expose the user's password.

```ts
usersServiceMock.create.mockResolvedValueOnce(user);

const response = await authService.signUp("testuser", "password");

expect(response).toEqual(user);
expect(response.password).toBeUndefined();
```

That final assertion is the reason the test matters. It guards against accidentally leaking sensitive data when the implementation changes later.

## Testing `UsersService`

The user service depends on a TypeORM repository. Again, the repository should be mocked because the unit test is not trying to verify TypeORM.

```ts
export class UserRepositoryMock {
  findOne = jest.fn();
  create = jest.fn();
  save = jest.fn();
}
```

Then register the mock with Nest's testing module:

```ts
const module: TestingModule = await Test.createTestingModule({
  providers: [
    UsersService,
    {
      provide: getRepositoryToken(Users),
      useClass: UserRepositoryMock,
    },
  ],
}).compile();
```

This keeps the test focused on service behavior.

## Testing lookup behavior

The `findOneByUsername` method has two basic outcomes:

- return a user when one exists
- return `undefined` when one does not

```ts
userRepository.findOne.mockResolvedValueOnce(user);

const foundUser = await usersService.findOneByUsername("testuser");

expect(foundUser).toEqual(user);
```

And the empty case:

```ts
userRepository.findOne.mockResolvedValueOnce(undefined);

const foundUser = await usersService.findOneByUsername("testuser");

expect(foundUser).toBeUndefined();
```

The repository implementation is not the target. The service contract is.

## Testing invalid credentials

Credential validation needs negative tests. Two important cases are:

- the user is not found
- the password is wrong

Those cases should throw instead of silently returning a valid result.

```ts
userRepository.findOne.mockResolvedValueOnce(undefined);

await expect(
  usersService.validateCredentials({
    username: "testuser",
    password: "password",
  }),
).rejects.toThrow(HttpException);
```

And for an invalid password:

```ts
userRepository.findOne.mockResolvedValueOnce(user);

await expect(
  usersService.validateCredentials({
    username: "testuser",
    password: "incorrect-password",
  }),
).rejects.toThrow(HttpException);
```

Those tests help preserve the security behavior of the auth flow.

## Running unit tests in GitHub Actions

Once the local script works, the pipeline can run it on every push or pull request.

```yaml
name: Run unit testing

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

      - name: Install dependencies
        run: yarn install

      - name: Unit testing
        run: yarn test:unit
```

This pipeline is simpler than an e2e test pipeline because it does not need to start Postgres or boot external services. The dependencies are mocked, so the tests can run quickly in CI.

## Final thoughts

Good unit tests are not about testing every line. They are about protecting behavior that other parts of the system rely on.

In this example, the valuable guarantees are clear:

- signing in returns a token
- invalid credentials throw
- signup does not expose passwords
- user lookup returns predictable values
- repository behavior is mocked, not retested

That is enough to make future refactors safer and reduce the amount of time spent debugging accidental behavior changes.
