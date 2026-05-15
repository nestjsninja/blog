---
title: "Running NestJS in Lambda with LocalStack and Serverless"
excerpt: "How to package a NestJS QR code generator as an AWS Lambda function, test it locally with LocalStack, and deploy it through the Serverless Framework."
coverImage: "/nestjs-ninja.png"
date: "2025-02-23T12:00:00.000Z"
author:
  name: "Henrique Weiand"
  picture: "/nestjs-ninja.png"
ogImage:
  url: "/nestjs-ninja.png"
tags:
  - NestJS
  - Lambda
  - LocalStack
  - Serverless
---

Serverless applications can be a good fit when the workload is small, bursty, or naturally event-driven. This post is based on my original Medium article, [Running NestJS in a Lambda function with LocalStack and Serverless Framework](https://medium.com/p/2751cf09a493).

The example project is a QR code generator: receive a URL, generate a QR code, upload it to S3, and return a public link. The final code is available at [henriqueweiand/nestjs-lambda-qrcode-generator-with-local-stack](https://github.com/henriqueweiand/nestjs-lambda-qrcode-generator-with-local-stack).

## Why LocalStack and Serverless

The Serverless Framework describes the Lambda function, HTTP events, S3 bucket, IAM permissions, and handler entrypoint. LocalStack gives a local AWS-like environment so the flow can be tested before touching real cloud resources.

That combination gives you a tight development loop:

- run the NestJS app normally
- run through Serverless offline plugins
- run against LocalStack for a closer AWS simulation

## NestJS on Lambda

NestJS can run in different shapes. A normal HTTP server uses `NestFactory.create` and listens on a port. A standalone Nest application can use `createApplicationContext` without creating an HTTP server.

For this project, the function needs to receive HTTP requests, so the Lambda entrypoint wraps the Nest HTTP application through the Serverless adapter. The repository keeps two startup files:

- `main.ts` for running like a normal NestJS app
- `serverless.ts` for Lambda execution

That split makes debugging easier because you can first confirm the normal NestJS behavior, then move to the serverless runtime.

## The QR code flow

The controller receives a URL from the request. The QR service generates the QR code buffer. The S3 service uploads the generated file and returns the final location.

The important part is keeping responsibilities small. The controller should not know S3 details, and the S3 service should not care how QR codes are created.

## Things to watch

Lambda is convenient, but not free of tradeoffs. NestJS can have cold-start overhead, especially when the app grows with many modules, libraries, connections, and asynchronous startup tasks.

Before choosing Lambda, ask:

- does this function need an HTTP server?
- can the app be a standalone task?
- how large is the deployment artifact?
- how much startup time is acceptable?
- can this function stay focused on one responsibility?

## Takeaways

Use LocalStack to reduce cloud feedback loops. Keep the Lambda small. Prefer clear entrypoints. Test the application normally before testing it as a function. And read the NestJS serverless documentation before committing to a runtime shape.
