---
title: Flash-cards apps with OpenIA
excerpt: >-
  Hi guys! Let’s start another technical post and this time I did something that
  I really enjoyed, it was an App that uses the famous OpeanIA, and the best
  part about everything, this app is a Flashcard app, so you can use
coverImage: /blog-assets/flash-cards-apps-with-openia/cover.png
date: '2023-03-17T12:00:00.000Z'
author:
  name: Henrique Weiand
  picture: /nestjs-ninja.png
ogImage:
  url: /blog-assets/flash-cards-apps-with-openia/cover.png
tags:
  - Cloud function
  - Expo
  - Firebase
  - GCP
  - Native-base
  - React-Native
  - Sentry
  - Software Development
  - Tech
  - Typescript
---
Hi guys! Let’s start another technical post and this time I did something that I really enjoyed, it was an App that uses the famous OpeanIA, and the best part about everything, this app is a Flashcard app, so you can use that to learn a new language for example. For those who don’t know what is flashcards, it is a game that will help you to stick with those words, phrasal verbs, or even the meaning of them in your memory. I am going to link here, another article that explains much better than me how effective this kind of game is for learners.

[Do Flashcards Work for College Students?](https://www.herzing.edu/blog/do-flashcards-work-college-students)

Ok, I want just to share a few more important things about the target of this article.

- I won’t detail so deep all the structure of either the app or the backend.
- You will be able to check out the two repositories of this application.
- I will detail the way and steps to define the app as done.
- This project still has a lot of improvements that are possible to do, however, I won’t do that for now.

## Overview

### Tecnologies

This time, I decided to use as much simple tools as possible in order to have the intere solition done quickly, for that, I decided to use:

- Firebase (database and auth autenticator)
- Expo - React-native
    - [Native-base](https://nativebase.io/)
- Google Cloud platform (Cloud functions)
    - [Sentry](https://sentry.io/)
- OpenIA API

### How is OpenIA working in this project?

I decide to apply this technology to get some new experience in that, and also because it is very useful for many different areas. I’ve already seen a lot of different software using OpenIA like a digital buddy, with a chat and other features but in my case, I decided to reduce the scope of the project and use the OpenIA API as a service to get some right and wrong options for the word that the user is inputting.

![[https://drive.google.com/file/d/1L7yev2elT7yhuUQepcpOmHBYBkb6q76f/view?usp=share_link](https://drive.google.com/file/d/1L7yev2elT7yhuUQepcpOmHBYBkb6q76f/view?usp=share_link)](/blog-assets/flash-cards-apps-with-openia/screen-shot-2023-05-10-at-20-07-15.png)

[https://drive.google.com/file/d/1L7yev2elT7yhuUQepcpOmHBYBkb6q76f/view?usp=share_link](https://drive.google.com/file/d/1L7yev2elT7yhuUQepcpOmHBYBkb6q76f/view?usp=share_link)

Very simple, isn't it?

### **The architecture of the solution**

I designed a pretty simple architecture for this project and as I mentioned at the beginning, I wanted to use as many tools as possible and also didn't want to have a server and big setups of a database, infrastructure, and all that stuff.

![[https://drive.google.com/file/d/11nRKsbdQdXWWCDnkGfZ1tGJb9rCvpCvq/view?usp=share_link](https://drive.google.com/file/d/11nRKsbdQdXWWCDnkGfZ1tGJb9rCvpCvq/view?usp=share_link)](/blog-assets/flash-cards-apps-with-openia/screen-shot-2023-05-10-at-20-15-04.png)

[https://drive.google.com/file/d/11nRKsbdQdXWWCDnkGfZ1tGJb9rCvpCvq/view?usp=share_link](https://drive.google.com/file/d/11nRKsbdQdXWWCDnkGfZ1tGJb9rCvpCvq/view?usp=share_link)

Explaining, the user starts making the signup or sign in (with Firebase auth) then he must need to set the target language and then register the words. If all of these steps are done, the user can start the game. Once the user has registered the words he can directly start the game as many times as he wants, the app will get the collections from Firestore and make the user able to play.

## Code time

Now, it’s time for the show guys!!! Are you ready?

Ok, ok… So you’ve already seen the design of the solution, so I suppose that you have in mind that we have a “backend”, I mean, our cloud function on GCP that makes the requests to OpenIA API, right? Let’s start looking at that.

### Backend

[https://github.com/henriqueweiand/flash-cards.app-cloud-functions](https://github.com/henriqueweiand/flash-cards.app-cloud-functions)

This project is organized like this

```jsx
functions
    └── src
        ├── core
        │   ├── providers
        │   │   └── openia
        │   └── validators
        ├── modules
        │   ├── default
        │   └── suggestions
        └── routes
```

It is a simples example of a function that can be used inside of GCP, very simples and it's usign the Express with routes, modules, …

If you want to run locally, it is possible with the command `serve`, as you can see on the `package.json` file.

```jsx
"scripts": {
    "lint": "eslint --fix --ext .js,.ts ./src",
    "build": "tsc",
    "serve": "npm run build && firebase emulators:start --only functions",
    "shell": "npm run build && firebase functions:shell",
    "start": "npm run shell",
    "deploy": "firebase deploy --only functions",
    "logs": "firebase functions:log",
    "compile": "cp ../../../tsconfig.template.json ./tsconfig-compile.json && tsc --project tsconfig-compile.json"
  },
```

Its important to define the envs, like copying the `.env-local`and rename it to `.env` and fill it out.

```jsx
OPENIA_TOKEN=
OPENIA_URL=https://api.openai.com/v1/engines/text-davinci-003-playground/completions
SENTRY_DSN=
```

<aside>
🔭 If you don't have an OpenIA token, just access [https://platform.openai.com/](https://platform.openai.com/) and sign up there.

</aside>

Ohh, I forgot to mention that I added Sentry in this project just because it is a easy way to track the errors. But don't worry, it is free and you can create [here](https://sentry.io/).

### Integration with **OpenIA**

Guys, here is the secret of everything, and I know that you are going to lough after seeing it, so take a look at this code `functions/src/core/providers/openia/index.ts`

```jsx
const response = await axios.post<ResponseChatGPT>(
        `${this.openIAURL}`,
        {
          prompt: `return a JSON of four right translation options for the word “${word}” from ${fromLanguage} into ${targetLanguage} and then more four wrong options. Use index called right and wrong. don't send anything else`,
          temperature: 0.22,
          max_tokens: 500,
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.TOKEN}`,
          },
        },
      );
```

It is amazing, isn't it? You can see, how easy it is to use ChatGPT3 for something simple. I am just asking him to give me some options based on the language.

![mind-blow-galaxy.gif](/blog-assets/flash-cards-apps-with-openia/mind-blow-galaxy.gif)

### Deploy

First of all, don’t forget to install the project dependencies, and then let’s start configuring the Firebase. To configure the deployment of the backend is really simple, just install the Firebase CLI [https://firebase.google.com/docs/cli](https://firebase.google.com/docs/cli), and inside of the main folder run the command yarn deploy or firebase deploy. I honestly don’t remember the next steps but I am sure that the CLI will ask you all the necessary things in order to deploy your function. After that you will get the endpoint for your app makes the requests.

## App

[https://github.com/henriqueweiand/flash-cards.app](https://github.com/henriqueweiand/flash-cards.app)

This app structure is organized like this

```jsx
├── assets
└── src
    ├── @types
    ├── components
    ├── core
    │   ├── context
    │   ├── domain
    │   │   ├── entities
    │   │   └── enums
    │   ├── hooks
    │   ├── providers
    │   │   ├── async-storage
    │   │   └── database
    │   └── services
    │       ├── AuthAsyncStorage
    │       ├── AuthFirebase
    │       ├── FireStoreLesson
    │       ├── FireStoreWord
    │       ├── Language
    │       ├── LanguageAsyncStorage
    │       └── Suggestions
    ├── routes
    └── screens
        └── GameOptions
```

As I mentioned, this project uses Expo ([https://expo.dev/](https://expo.dev/)), and for sure, React-Native.

I decidesd to make it easy, however, I created an abstraction for some classes as you can see such as:

- Firebase functionalities;
- Entities;

### Integrations with Firebase

As this project is usign Firebase, you will need to have an account, so please access [https://console.firebase.google.com/](https://console.firebase.google.com/) and sign up, after that create a new project. You will need to access the configuration section and get all the informations for the `.env-example`, by the way, don't forget to change the name to `.env`. 

The only one value that you will need to get outside of the firebase is `OPENIA_ENDPOINT`, which will be the endpoint from the backend when you deploy it or when you use local. 

### Usign the app

A short video about the app and it's funcionalities.

[https://www.youtube.com/watch?v=zztOW_yS5EU](https://www.youtube.com/watch?v=zztOW_yS5EU)

After install the dependencies and fill out all of the variables, you can run the project with the command `yarn ios` or even with `year web` in case if you want to see it on the website.

## Conclusions

Just to close the article with my 10 cents 😅, I really enjoyed doing this project for many reasons. I didn’t know how easy and useful the OpenIA can be for every kind of project like I did here, you just need to have an idea and think about how this technology can help you, we can’t forget that this API is not free, however, if you have a nice approach the price is ok to pay. I also appreciated all the technologies and was nice to see how easy is to build an app with Expo and Native-base, I would say that I could finish this project earlier if I had managed my time better, I mean, with my personal activities because all of these tools helped me to be faster and productive in their areas.

If you have an idea and want to have an MPV as fast as possible, I would recommend approaches like this, where I just had to focus some organization with a simple Kanban, and the idea was done. Actually, this is the same approach that I’ve been doing since my first blog post, so I did four projects, four posts each per month, just like I had set my goals and steps. 🚀
