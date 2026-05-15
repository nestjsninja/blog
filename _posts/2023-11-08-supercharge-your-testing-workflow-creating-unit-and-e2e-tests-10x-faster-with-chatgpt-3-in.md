---
title: >-
  Supercharge Your Testing Workflow: Creating Unit and E2E Tests 10x Faster with
  ChatGPT-3 Inside NestJS
excerpt: >-
  Hello fellow coders! I have a polemic topic to talk about today, it is “using
  AI to create the unit and e2e tests” and how it can improve the velocity of
  writing tests!!!
coverImage: >-
  /blog-assets/supercharge-your-testing-workflow-creating-unit-and-e2e-tests-10x-faster-with-chatgpt-3-in/cover.png
date: '2023-11-08T12:00:00.000Z'
author:
  name: Henrique Weiand
  picture: /nestjs-ninja.png
ogImage:
  url: >-
    /blog-assets/supercharge-your-testing-workflow-creating-unit-and-e2e-tests-10x-faster-with-chatgpt-3-in/cover.png
tags:
  - Jest
  - NestJS
  - SWC
  - Typescript
  - openAI
---
Hello fellow coders! I have a polemic topic to talk about today, it is “using AI to create the unit and e2e tests” and how it can improve the velocity of writing tests!!!

Before we dive into the topic, I want to be clear, that it is just one idea, and looking at the new worlds and new possibilities with AI I wonder if we don’t have to take advantage of these new technologies when we talk about tests!!!

I have to be honest with you all readers, for all the posts that I have been doing I am using AI to help me write the code faster, it doesn’t mean that I don’t know about the content, code, etc, it means that I am taking advantage of ChatGPT-3 and Phind to have things done faster, for example.

In this post we have a few unit-tests

[Applying Unit Tests on NestJS with Jest and GitHub Actions](https://medium.com/nestjs-ninja/applying-unit-tests-on-nestjs-with-jest-and-github-actions-9e1d6c672fb7)

In this post we have e2e-tests

[Applying integration test on NestJS with Jest and GitHub Actions](https://medium.com/nestjs-ninja/applying-integration-test-on-nestjs-with-jest-and-github-actions-95e4c5221e7a)

For both, during my circle of development, I didn’t use TDD or other methods, I just wrote the services, classes, and modules and then I went to the tests, at this time I already had the base structure, so I opened Phind or ChatGPT-3 and I asked them to create a test to cover as much cases as possible using NestJS and its way of implementing tests, and in just a few seconds I have lots of tests ready! For a few of them I had to fix some small details, but overall, it was very good!

One important point here is, that sometimes this approach does not guarantee some specific or important cases that just you know, so for those cases I had to implement it myself.

Guys! It gives me back lots of time! So the question that I have is:

> **Should we rethink the way of implementing tests? TDD? Whatever other method still relevant? Or we can have one approach like that?**
> 

I’m not sure about you all, but at the place where I work, we are both focused on quality but mainly on time and productivity, so the time aspect weighs a lot. 

### Real example

I am going to use a real example that was implemented in our previous post

[Creating Smart Questions with NestJS and OpenAI](https://medium.com/nestjs-ninja/creating-smart-questions-with-nestjs-and-openai-83089829cdf5)

1. Using the use-case [“modules/question/use-case/create-question.ts”](https://github.com/nestjsninja/nestjs-generate-questions/blob/main/src/modules/question/use-case/create-question.ts)
2. Open AI buddy tool, in my case [https://www.phind.com/](https://www.phind.com/)
3. Ask 
”I have the code below inside a NestJS project and I need to implement a unit-tests. Please write all possible cases to cover the class as much as possible. It must be written using the NestJS test module.
CODE OF THE CREATE-QUESTION HERE”
4. Create the local test file and put the content over there
    
    ![ai.gif](/blog-assets/supercharge-your-testing-workflow-creating-unit-and-e2e-tests-10x-faster-with-chatgpt-3-in/ai.gif)
    
5. Fix the necessary lines;
6. Create new cases or change something (if necessary)
7. Run the tests `npm run test`

![Untitled](/blog-assets/supercharge-your-testing-workflow-creating-unit-and-e2e-tests-10x-faster-with-chatgpt-3-in/untitled.png)

So amazing, isn’t it?

You can see that it created the mocks for those necessary cases etc! 🧙‍♂️

### Some possible approches

- Use the AI tools to help you to remember something that maybe is not clear or you just don't remember;
- For those who are starting, try to notice the way of the implementation that AI is providing you and then use this content as input to understand better how it works;
- For those who are more senior, try to get some codes from the AI and do the adjusts only on those areas that you know that are important;

### Conclusion

The world and technology have been changing so fast this 2023 and I can assure you that 2024 will be much harder in terms of innovation, so let’s get out of our comfort zone and review the process of implementing and maybe be even better in this new moment.
