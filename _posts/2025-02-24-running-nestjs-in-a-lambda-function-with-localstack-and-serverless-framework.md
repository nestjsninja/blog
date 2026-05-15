---
title: Running NestJS in a Lambda function with LocalStack and Serverless Framework
excerpt: Running NestJS in a Lambda function with LocalStack and Serverless Framework
coverImage: >-
  /blog-assets/running-nestjs-in-a-lambda-function-with-localstack-and-serverless-framework/cover.png
date: '2025-02-24T12:00:00.000Z'
author:
  name: Henrique Weiand
  picture: /nestjs-ninja.png
ogImage:
  url: >-
    /blog-assets/running-nestjs-in-a-lambda-function-with-localstack-and-serverless-framework/cover.png
tags:
  - AWS
  - Lambda
  - LocalStack
  - NestJS
  - Serverless
---
Hey there, tech enthusiasts! Ever found yourself needing a quick and efficient way to whip up QR codes for your projects? Well, in today's blog post, we will cover an awesome solution that brings together NestJS and AWS Lambda, all while keeping things super smooth with the Serverless Framework and LocalStack.

In this post, we’ll dive into on [nestjs-lambda-qrcode-generator-with-local-stack](https://github.com/henriqueweiand/nestjs-lambda-qrcode-generator-with-local-stack) project that tackles real-world challenges by turning NestJS applications into Lambda functions. We’ll also see how the Serverless Framework makes deploying these functions a breeze and how LocalStack lets you test everything locally without breaking a sweat.

Whether you’re a seasoned developer or just starting out, this guide will show you how to create a scalable, serverless QR code generator that’s ready for any project you throw at it. Let’s get started!

### Local Stack and Serverless ⚔

It's important to give some context before going deeper into the two technologies that are applied to the project

- [LocalStack](https://www.localstack.cloud/) is a powerful tool that emulates AWS services on your local machine, enabling developers to test and develop cloud applications without the need to deploy them to the actual AWS environment. This local emulation accelerates development cycles and reduces costs associated with cloud deployments.
- [The Serverless Framework](https://www.serverless.com/) is a popular open-source framework that simplifies the deployment and management of serverless applications across various cloud providers, including AWS. It streamlines the process of defining and deploying serverless functions, making it easier for developers to build scalable applications.

By integrating LocalStack with the Serverless Framework, developers can deploy and test their serverless applications locally, ensuring that everything works as expected before moving to the cloud. This combination provides a seamless workflow for building, testing, and deploying serverless applications efficiently.

### Running a NestJS project on lambda 🚀

Running a NestJS application on AWS Lambda allows you to build serverless applications that automatically scale and reduce infrastructure management. By using tools like @vendia/serverless-express, you can adapt your NestJS app to function within the Lambda environment, handling cases like HTTP requests, cron-jobs, processing tasks internally by demand, and so on. This setup enables you to focus on developing features without worrying about server maintenance, as AWS manages the underlying infrastructure for you.  ￼

NOW A BIG BUT! Running a NestJS application on a lambda function has its disadvantages, and the biggest is the `cold start`. **As big as your application gets with the usage of libraries, connections, async/await executions, or just because the project is complex and big, it can take more time for the lambda to start responding to a request or any execution**. It depends on the context, so it is recommended to pay attention to the requirements to design a better solution.

I recommend you access the official NestJS documentation ([https://docs.nestjs.com/faq/serverless](https://docs.nestjs.com/faq/serverless)), and spend a few minutes reading from the top to bottom. There are some important points about how to make the standalone application and also benchmarks with different approaches. A simple example is how you define your application:

```bash
// #2 Nest (with @nestjs/platform-express)
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['error'] });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

// #3 Nest as a Standalone application (no HTTP server)
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppService } from './app.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });
  console.log(app.get(AppService).getHello());
}
bootstrap();
```

See that we have an application without an HTTP server that will respond faster.

For every solution, there will always be pros and cons, so think about the architecture before starting coding like crazy!

---

## Getting into the project 🎯

[https://github.com/henriqueweiand/nestjs-lambda-qrcode-generator-with-local-stack](https://github.com/henriqueweiand/nestjs-lambda-qrcode-generator-with-local-stack)

If you ask me how I come up with ideas for projects, I keep an eye on the websites with job opportunities, like [Upwork](upwork.com), not because I want to get a job, but eventually, I find good ideas for projects (simple ones of course) that I can use as a context to practice, and this project was one of that cases. 

### Context

This is quite a simple project, the job description required a Lambda function that was able to receive a GET request and through the query params, a URL that should be used to build the QRCode. The QRCode should be storeged into an S3 bucket with a public link.

> I did this idea two times, the first one I didn't wrote anything about, but, the first version was working only with Serverless, and the new one is working with both Serverless Framework and LocalStack, which makes everything much more real. This is the link of the first version → https://github.com/henriqueweiand/nestjs-lambda-qrcode-generator
> 

Ok, as I quickly explained before, we generate different types of NestJS instances, and with those requirements, I knew I needed an HTTP server, so that's why I am applying `NestFactory.create`

[https://github.com/henriqueweiand/nestjs-lambda-qrcode-generator-with-local-stack/blob/master/src/serverless.ts](https://github.com/henriqueweiand/nestjs-lambda-qrcode-generator-with-local-stack/blob/master/src/serverless.ts)

By the way, you will see two starting points, I mean, both serverless.ts and main.ts, and each one of them is creating a NestJS instance. The reason is that I wanted to be able to test it outside the Serverless and Local Stack, like a normal NestJS app, so the main.ts is executed as a normal NestJS application, while the serverless.ts is used for the Serverless Framework.

The starting point for the Serverless framework is the `serverless.yml`, which holds the recipe of the application, for example, the application needs to run in a lambda function, this method needs to be able to receive POST or GET requests, and it uses S3 and the AWS IAM roles should be XPTO… got it?

[https://github.com/henriqueweiand/nestjs-lambda-qrcode-generator-with-local-stack/blob/master/serverless.yaml](https://github.com/henriqueweiand/nestjs-lambda-qrcode-generator-with-local-stack/blob/master/serverless.yaml)

It is important to mention the initial method called by the lambda when executing. In this case, it is `serverless.handler` which matches with https://github.com/henriqueweiand/nestjs-lambda-qrcode-generator-with-local-stack/blob/master/src/serverless.ts

At this point I know you want to see the Lamda function running, but, I suggest making the application work first, so you can reduce the doubts that you might have when running the Lamda and seeing unexpected issues happen. 

### Code structure 🧠

There's no right or wrong in terms of how to organize the application modules and files, so, create your application as you want, mine ended up like this

![Screenshot 2025-02-20 at 16.59.16.png](/blog-assets/running-nestjs-in-a-lambda-function-with-localstack-and-serverless-framework/screenshot-2025-02-20-at-16-59-16.png)

The controller holds one route and receives a query parameter which will be the URL

[https://github.com/henriqueweiand/nestjs-lambda-qrcode-generator-with-local-stack/blob/master/src/qr/qrcode.controller.ts](https://github.com/henriqueweiand/nestjs-lambda-qrcode-generator-with-local-stack/blob/master/src/qr/qrcode.controller.ts)

And then QRCodeService only receives the URL and generates the QRCode, and then, the qrCodeBuffer is passed down to the s3Service for the upload.

The s3Service has a few details, for example, when it's running for `production` it is not getting the ENV files because the lambda will use the roles applied for the service itself.

[https://github.com/henriqueweiand/nestjs-lambda-qrcode-generator-with-local-stack/blob/master/src/qr/s3.service.ts](https://github.com/henriqueweiand/nestjs-lambda-qrcode-generator-with-local-stack/blob/master/src/qr/s3.service.ts)

## Running the project with and without Local Stack 🦾

Instead of writing more, I decided to make a video with the 3 possible ways to run the application, they are:

- Running a normal NestJS application;
- Running NestJS Application with Serverless Framework + serverless-offline + serverless-s3-local;
- Running NestJS Application with Serverless Framework + Local Stack;

[https://youtu.be/h_u47QHLz1I](https://youtu.be/h_u47QHLz1I)

## Conclusion 👨🏼‍🔧

In this journey, we’ve explored how to build a scalable, serverless QR code generator using NestJS, AWS Lambda, the Serverless Framework, and LocalStack. By integrating these technologies, you can efficiently develop, test, and deploy applications that meet real-world needs without the hassle of managing server infrastructure. Remember to consider the specific requirements of your project, such as the necessity of an HTTP server, and be mindful of potential challenges like cold starts in Lambda functions. For more insights and detailed guidance, refer to the official NestJS documentation on serverless applications. Embrace these tools to streamline your development process and deliver robust solutions with ease.

### Takeaways

- Pay attention to the necessities of your application, for instance, using HTTP or not;
- Add logs, it helps to debug the Lambda on the providers, even console.info, error, …
- Use as less libraries as possible;
- Keep the project simple, don't put lots of responsibility for each lambda;
- A [Monorepo](https://docs.nestjs.com/cli/monorepo) approach can help to share a common code while different lamdas;
- Be aware of the final size of your project, the providers have limits - https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html#function-configuration-deployment-and-execution;
- Read the official documentation to get the most of different approaches to reduce the size and perform the project https://docs.nestjs.com/faq/serverless
