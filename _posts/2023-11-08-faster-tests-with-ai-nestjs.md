---
title: "Creating NestJS Tests Faster with AI Assistance"
excerpt: "How AI tools can accelerate unit and e2e test drafting in NestJS while still requiring developer review, corrections, and understanding."
coverImage: "/nestjs-ninja.png"
date: "2023-11-08T12:00:00.000Z"
author:
  name: "Henrique Weiand"
  picture: "/nestjs-ninja.png"
ogImage:
  url: "/nestjs-ninja.png"
tags:
  - NestJS
  - Testing
  - AI
  - Jest
---

AI can help write tests faster, but it cannot replace understanding the system. This post is based on my original Medium article, [Supercharge Your Testing Workflow: Creating Unit and E2E Tests 10x Faster with ChatGPT-3 Inside NestJS](https://medium.com/p/7af12e1c957c).

The idea is simple: use AI to draft test cases, then let the developer verify behavior, fix gaps, and keep only what adds value.

## The workflow

The article uses a real NestJS use case from a previous OpenAI question-generation project. The process is:

1. Pick a use case or controller.
2. Paste the code into an AI assistant.
3. Ask for unit tests or e2e tests using NestJS testing utilities.
4. Review the generated cases.
5. Fix mocks, imports, and edge cases.
6. Run the tests locally.
7. Keep improving until the tests describe real behavior.

## Where AI helps

AI is useful for repetitive setup:

- `TestingModule` scaffolding
- provider mocks
- common success and failure cases
- exception assertions
- e2e request structure
- missing branch suggestions

That can save time, especially when the developer already knows what correct behavior should look like.

## Where AI is risky

Generated tests can be shallow. They may assert implementation details, miss important branches, or mock too much.

The developer still needs to ask:

- does this test protect behavior?
- is this mock realistic?
- is the assertion meaningful?
- are security or failure paths covered?

## Takeaways

Use AI as a drafting tool, not as an authority. It can make testing faster, but the final responsibility stays with the engineer reviewing the behavior.
