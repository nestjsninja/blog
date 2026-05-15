---
title: "Creating Smart Questions with NestJS and OpenAI"
excerpt: "A product-oriented NestJS service that uses OpenAI to generate answer options for educational questions and stores the result with Prisma."
coverImage: "/nestjs-ninja.png"
date: "2023-11-06T12:00:00.000Z"
author:
  name: "Henrique Weiand"
  picture: "/nestjs-ninja.png"
ogImage:
  url: "/nestjs-ninja.png"
tags:
  - NestJS
  - OpenAI
  - Prisma
  - Education
---

AI integrations are most useful when they solve a product problem. This post is based on my original Medium article, [Creating Smart Questions with NestJS and OpenAI](https://medium.com/p/83089829cdf5).

The example imagines an education product that wants to improve knowledge retention by generating quiz answers from a question.

## The product need

Students often consume videos and written content without enough active recall. A quiz experience can help them engage with the material immediately after learning it.

The backend service needs to:

- receive a question
- call OpenAI to generate possible answers
- mark one answer as correct
- store the question and answers
- expose the flow through an API

## Project shape

The project uses:

- NestJS
- Postgres
- Prisma
- OpenAI API
- Jest
- SWC

Modules are organized by responsibility. The AI module owns the OpenAI integration, the question module owns the use case, and the database layer persists users, questions, and answers.

## AI boundary

The AI module exposes an abstraction like `AIChatGenerator`. Other modules call that contract instead of depending directly on the concrete OpenAI implementation.

That makes the integration easier to test and replace.

## The use case

The create-question use case validates the author, asks the AI service for answer options, parses the returned structure, creates the question, and persists the generated answers.

There is still room for improvement. AI responses need defensive parsing, validation, retries, and observability. But the MVP demonstrates the core product loop.

## Takeaways

AI features still need normal backend design: modules, boundaries, persistence, validation, and tests. The model call is only one part of the workflow.
