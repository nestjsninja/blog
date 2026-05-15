---
title: Questions generator with NestJS and OpenAI
excerpt: >-
  Hello fellow coders! This time we are going to have a different post, I am not
  going to focus on Nestjs technical details instead, I'm going to explain a bit
  more different concepts than those that we've already seen on
coverImage: /blog-assets/questions-generator-with-nestjs-and-openai/cover.png
date: '2023-11-06T12:00:00.000Z'
author:
  name: Henrique Weiand
  picture: /nestjs-ninja.png
ogImage:
  url: /blog-assets/questions-generator-with-nestjs-and-openai/cover.png
tags:
  - Jest
  - NestJS
  - SWC
  - Typescript
  - openAI
---
Hello fellow coders! This time we are going to have a different post, I am not going to focus on Nestjs technical details instead, I'm going to explain a bit more different concepts than those that we've already seen on the other blog posts, so if you haven't had the chances to check them out, please access

[NestJS Ninja – Medium](https://medium.com/nestjs-ninja)

I want to take this repository as a real-world necessity where the company needs to launch a new feature, so let's start playing this kind of role game. 

### Setting the target

As an education company that provides lots of online resources to its students, we observed that the students did not retain the knowledge just by watching the videos or reading content, and running a survey it was clear that we as a company could improve the quality of the education by creating an interactive game with questions and answers that could be generated in real-time and using some tech trends as OpenAI / ChatGPT-3.

### Value

- Engage the knowledge retention of the students by asking them questions about the content as soon as they finish the content.
- Having the students online using the company's tools for a longer period.
- By having the right and wrong answers, understand how they are making progress on retention.

### Idea

![Untitled](/blog-assets/questions-generator-with-nestjs-and-openai/untitled.png)

By understanding the necessities of the tech team understood that it's necessary to launch a service that is in charge of receiving input and by using OpenAI API, generating the questions properly to be used on the interfaces, which can be a website or even other integrated solutions. 

**It must have:**

- Integration with OpenAI;
- Integration with a database to persist the usage by the students;
- Save who generates the question;
- Must be a scalable and independent service;

### Project

The project will use:

- NestJS
- Postgres
- Prisma
- Jest (unit and e2e)
- SWC
- OpenAI API

These definitions were based on the team's experience in order to have a better prediction of the deliveries and to be able to launch the first version as soon as possible to get more time and review by the staff and students.

### Setting the project up

![Untitled](/blog-assets/questions-generator-with-nestjs-and-openai/untitled-1.png)

The project was organized in a really simple way, where all the modules are inside the `modules` folder, inside of it, there’s a folder `common` which has all the common services that will be used inside of the modules. Outside I have the default Prisma folder with the migrations and schema, that’s basically the organization that we have for this project.

### Entities

![Untitled](/blog-assets/questions-generator-with-nestjs-and-openai/untitled-2.png)

Based on the Prisma schema, we can notice that this project has three entities: user, questions, and answers, which were mapped inside the `database` module.

![Untitled](/blog-assets/questions-generator-with-nestjs-and-openai/untitled-3.png)

The structure of the files of each entity is quite similar as you can see 

Each module has its use-case, and controllers, DTOs so with this organization we can have a clear segmentation of the module. The DTO is in charge of the swagger definitions making it possible for the solution to have a swagger interface to test the endpoints. By running

```jsx
npm run start:dev
```

Accessing the http://localhost:3000/api

![swagger.png](/blog-assets/questions-generator-with-nestjs-and-openai/swagger.png)

So far, the project has a simple configuration and that persists the data inside a database, nothing so different, right? maybe just the approach and the folder’s segmentation. Speaking about the AI, it was created a module, that is in charge of the `OpenaAI` integration and the methods to facilitate the usage. Let’s take a look.

 

```jsx
import { Module } from '@nestjs/common';
import { AIChatGenerator } from './interface/ai-chat-generator';
import { AIChat } from './ai-chat';
import { EnvModule } from '../env';

@Module({
  imports: [EnvModule],
  providers: [
    {
      provide: AIChatGenerator,
      useClass: AIChat
    },
  ],
  exports: [AIChatGenerator],
})
export class AIModule { }
```

This class has an interface to make it possible to have better integration with the modules, I mean, instead of just adding the service, those modules will use the interface as a definition of the methods, so as soon as the AI Module needs to have any maintenance in its scripts, it won’t affect the modules that may have implemented the class.

### OpenAI Integration

```jsx
import { Injectable, InternalServerErrorException, OnModuleInit } from '@nestjs/common';
import { ChatGPTAPI as IChatGPTAPI, ChatMessage } from 'chatgpt';
import { EnvService } from '../env';
import { AIChatGenerator } from './interface/ai-chat-generator';

@Injectable()
export class AIChat implements AIChatGenerator, OnModuleInit {
  private API: IChatGPTAPI;

  constructor(
    private envService: EnvService) {
  }

  async onModuleInit() {
    const importDynamic = new Function('modulePath', 'return import(modulePath)')
    const { ChatGPTAPI } = await importDynamic('chatgpt')

    this.API = new ChatGPTAPI({
      apiKey: this.envService.get('OPENAI_API_KEY'),
    });
  }

  async ask(question: string): Promise<ChatMessage | null> {
    try {
      const response = await this.API.sendMessage(question);
      return response;
    } catch (e) {
      throw new InternalServerErrorException('Was not possible to generate the answers');
    }

    return null;
  }
}
```

This code uses a library called https://github.com/transitive-bullshit/chatgpt-api that provides some methods to integrate the application. Unfortunately, as NestJS uses a different approach for the compilation of this library, was necessary to use a different approach to be able to include the library as you can see in the onModuleInit method. By the way, this method was implemented by this class and it will execute as soon as the class is ready to run.

The `ask` method requests the OpenAI API, with the question that was provided, in our case, it will be executed by the question module.

### create-question.ts

This is the core of the application, where there are some conditionals and also the treatment of the information

```jsx
import { AIChatGenerator, QuestionRepository, UserRepository } from '@app/common';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateQuestionDto } from '../dto/create-question.dto';
import { AnswerRepository } from '@app/common/database/repository/answer.repositoy';

type Message = {
    text: string;
    correct: boolean;
};

@Injectable()
export class CreateQuestionUseCase {
    private NUMBER_OF_QUESTIONS_REQUESTS = 3;

    constructor(
        private readonly answerRepository: AnswerRepository,
        private readonly questionRepository: QuestionRepository,
        private readonly userRepository: UserRepository,
        private readonly aIChatGenerator: AIChatGenerator
    ) { }

    async execute(createQuestionDto: CreateQuestionDto) {
        const user = await this.userRepository.findById(createQuestionDto.authorId);

        if (!user)
            throw new NotFoundException('Author not found');

        const encodedQuestion = encodeURIComponent(createQuestionDto.content);
        const AIAnswers = await this.aIChatGenerator.ask(`Generate ${this.NUMBER_OF_QUESTIONS_REQUESTS} different answers for the question "${encodedQuestion}". One of these answers must be the correct answer. Follow this formar [{text: 'Answer', correct: true/false}], it will be an array of objects. Do not provide the answers as a list. Remove any space or breakline that the response can have, send it as raw as possible`)
        const formatedAnswer = AIAnswers.text.trim();

        const regex = /\[([^\]]*)\]/;
        const match = formatedAnswer.match(regex);

        if (!match)
            throw new BadRequestException('Generated answers are not compatable');

        try {
            const jsonArrayString = `[${match[1]}]`;
            const answers: Message[] = JSON.parse(jsonArrayString);

            const question = await this.questionRepository.create({
                content: createQuestionDto.content,
                author: {
                    connect: {
                        id: user.id
                    }
                },
            });

            if (answers.length < this.NUMBER_OF_QUESTIONS_REQUESTS)
                throw new BadRequestException(`It was not possible to generate the amount (${this.NUMBER_OF_QUESTIONS_REQUESTS}) of answers requested`);

            for (const answerData of answers) {
                await this.answerRepository.create({
                    content: answerData.text,
                    correct: answerData.correct,
                    question: {
                        connect: {
                            id: question.id
                        }
                    },
                });
            }

            const updatedQuestion = await this.questionRepository.findById(question.id);

            return updatedQuestion;
        } catch (e) {
            throw new BadRequestException('Was not possible to register');
        }
    }
}
```

There are some nice topics to talk about in this use-case, let’s see:

- As it was written with a unique controller to use this use case and the use case represents a unit of execution, it helps us to have a single responsibility and turn the tests much easier afterward.
- Even though this class has a few dependencies, they are representing simple logic just to guarantee the consistency of the data.
- this.aIChatGenerator.ask is a method that was used in a very simple way that can be reusable in multiple places.

### Running locally

To run the project is very simple, as it is using docker because of the database, first it is necessary to run 

```jsx
docker-compose up -d
```

Next, configure the .env file. You can use the .env.example as a base. Install the dependencies and finally run.

```jsx
npm run start:dev
```

<aside>
💡 You’ll need to have OpenAI key - [https://platform.openai.com/](https://platform.openai.com/)

</aside>

### Create a question

Once you have started the service, you can access the documentation and first create an user and then just use the question endpoint

1. Create a user by using POST /user
2. Create a question using POST /question

![example.png](/blog-assets/questions-generator-with-nestjs-and-openai/example.png)

### Conclusion

With the implementation was possible to reach the product expectations and necessities. There is still space for improvement, but that’s pretty good for an MVP. Also, the code was covered by tests e2e and unit-tests to guarantee the business logic of the main parts.

I hope you guys have enjoyed this post, this was a bit different because I didn't focus too much on the code details and more on the requirements and value besides how easy is to develop solutions with [NestJS](https://nestjs.com/)

[https://github.com/nestjsninja/nestjs-generate-questions](https://github.com/nestjsninja/nestjs-generate-questions)
