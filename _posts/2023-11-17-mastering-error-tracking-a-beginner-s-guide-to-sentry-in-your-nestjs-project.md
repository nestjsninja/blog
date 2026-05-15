---
title: "Mastering Error Tracking: A Beginner's Guide to Sentry in Your NestJS Project"
excerpt: "Hello fellow coders!"
coverImage: "/blog-assets/mastering-error-tracking-a-beginner-s-guide-to-sentry-in-your-nestjs-project/screen-shot-2023-11-16-at-19-11-59.png"
date: "2023-11-17T12:00:00.000Z"
author:
  name: "Henrique Weiand"
  picture: "/nestjs-ninja.png"
ogImage:
  url: "/blog-assets/mastering-error-tracking-a-beginner-s-guide-to-sentry-in-your-nestjs-project/screen-shot-2023-11-16-at-19-11-59.png"
tags:
  - "NestJS"
  - "SWC"
  - "Sentry"
  - "Typescript"
---
Hello fellow coders! 

The topic today is extremely important, it is something simple but can be a game change when we are running a service on production and suddenly, the users are having problems, errors, etc. 

We are going to have a hands-on example of implementing an error track inside a NestJS project, we are going to use Sentry as a tool to help us see and be ahead of the problem before they are properly reported by the users.

[Application Performance Monitoring & Error Tracking Software](https://sentry.io/)

### Why should I use a tool like that inside my project?

There are many reasons, but the most important one is "to know the error with details in advance before they are reported”. 

Imagine that you have lots of microservices or even a large code base, many times a difficult large codebase, and eventually, bugs happen! Some bugs, sometimes require the context or the parameters to be able to simulate. Sometimes you have so many errors that you don't know which one is the priority, or in which frequency they happen. So many different cases right? That's why I always put a tool like that into my projects.

### Other options

You can find easily many tools that do almost the same as Sentry, some are cool, some are easy to set up, some don't have a nice view or require more of you to set up… I always choose Sentry or New Relic, but mostly Sentry because they solve my problems very well.

Other options are

- **Da**tadog
- New Relic
- Elastic Observability
- Dynatrace
- AppDynamics

### Setting the project up

For those who never read my articles, I am going to follow the basic setup from this post

[Implementing auth flow as fast as possible using NestJS](https://medium.com/nestjs-ninja/implementing-auth-flow-as-fast-as-possible-using-nestjs-bdf87488bc00)

Because I want to run this project with SWC and the correct tsconfig configuration. Don't worry, you can find the whole codebase at the end of this post as well.

```tsx
nest g application nestjs-sentry-configuration
```

### Sentry account

Visit the website [https://sentry.io/](https://sentry.io/) and create your account.

Then, let's create a new project and select Node.JS

![Screen Shot 2023-11-16 at 19.11.59.png](/blog-assets/mastering-error-tracking-a-beginner-s-guide-to-sentry-in-your-nestjs-project/screen-shot-2023-11-16-at-19-11-59.png)

Install the dependencies and copy the `DSN` value.

```tsx
npm install --save @sentry/node @sentry/profiling-node
```

![Screen Shot 2023-11-16 at 19.12.35.png](/blog-assets/mastering-error-tracking-a-beginner-s-guide-to-sentry-in-your-nestjs-project/screen-shot-2023-11-16-at-19-12-35.png)

Now let's go back to the NestJS project.

### Creating an **ExceptionFilter**

I am going to create an Exception called `sentry.filter.ts`. If you want to learn more about Exceptions and how they are handling inside the NestJS, check out this link

[Documentation | NestJS - A progressive Node.js framework](https://docs.nestjs.com/exception-filters)

My exception file will be like this

```tsx
import { Catch, ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import * as Sentry from '@sentry/node';

@Catch()
export class SentryFilter extends BaseExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
        Sentry.captureException(exception);
        super.catch(exception, host);
    }
}
```

This is an ordinary exception and we are also extending the BaseExceptionFilter, because I want to keep the original Exception response as soon as the error is tracked. I was doing it when I called.

```tsx
super.catch(exception, host);
```

Is important to notice that our @Catch() is empty, it will make that this Exception handles every exception that can happen. 

### Adding an exception to the global scope

We need to add the Custom exception to the project, and we can do that by editing the `main.ts` 

```tsx
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import * as Sentry from '@sentry/node';
import { SentryFilter } from './sentry.filter';
import { AppModule } from './app.module';

async function bootstrap() {
  Sentry.init({
    dsn: process.env.SENTRY_DNS,
  });

  const app = await NestFactory.create(AppModule);
  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new SentryFilter(httpAdapter));

  await app.listen(3000);
}
bootstrap();
```

Please, don't forget to put the `SENTRY_DNS` value! Otherwise, it won't work as we want.

And we are done!! 

### Testing the changes

First, let's start the project

```tsx
npm run start:dev
```

A simple example can be an error like

```tsx
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    throw new Error('Ops, theres a problem!');
    return 'Hello World!';
  }
}
```

I am forcing an error, and after requesting the route of this method, I got this report

![Screen Shot 2023-11-16 at 19.27.43.png](/blog-assets/mastering-error-tracking-a-beginner-s-guide-to-sentry-in-your-nestjs-project/screen-shot-2023-11-16-at-19-27-43.png)

Here you can find for example:

- User
- Context
- How many times this issue happens
- When

### Plus (optional)

If you want to implement it as a module and use dependency injecting etc to get more from the errors, and also to have it global, you can do it using the example below as a starting point.

"Binding interceptiors” [https://docs.nestjs.com/interceptors#binding-interceptors](https://docs.nestjs.com/interceptors#binding-interceptors)

```tsx
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
```

More examples of using different approaches

[Sentry Integration With NestJS](https://abrialstha.medium.com/sentry-integration-with-nestjs-7f967c5cc8ab)

[https://github.com/ericjeker/nestjs-sentry-example](https://github.com/ericjeker/nestjs-sentry-example)

### Conclusion

It’s been easy to add Sentry or any other Error tracker, and knowing how important it is for any project, I would suggest you add it right now 😄
