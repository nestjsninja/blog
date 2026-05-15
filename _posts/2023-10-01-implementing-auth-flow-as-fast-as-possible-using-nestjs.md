---
title: Implementing auth flow as fast as possible using NestJS
excerpt: "Hey there, fellow coders! \U0001F680 Ready to dive into the world of authentication flows? Buckle up because we're about to take a turbo-charged ride with NestJS to implement auth flow faster than you can say \"password reset.\" I"
coverImage: /blog-assets/implementing-auth-flow-as-fast-as-possible-using-nestjs/cover.png
date: '2023-10-01T12:00:00.000Z'
author:
  name: Henrique Weiand
  picture: /nestjs-ninja.png
ogImage:
  url: >-
    /blog-assets/implementing-auth-flow-as-fast-as-possible-using-nestjs/cover.png
tags:
  - NestJS
  - Node.js
  - SWC
  - Typescript
  - Vercel
  - auth
series: NestJS Auth Flow
seriesOrder: 1
---
Hey there, fellow coders! 🚀 Ready to dive into the world of authentication flows? Buckle up because we're about to take a turbo-charged ride with NestJS to implement auth flow faster than you can say "password reset." In this article, we're going to show you how to make authentication feel like a breeze. So grab your favorite coding snack, and let's get this authentication party started! 💻🎉

This article will be fragmented into a few parts and in this first part, we are going to discuss the base of the project using Nestjs CLI and a few tricks.

## Pre-requirement 🛠

Before we start this project, it´s essential to double-check if you have all the necessary pre-requirements. As we are going to create a NodeJS project, we are going to need these items below:

### NVM

For those who don´t know, NVM is a great tool that is going to help you to switch between node versions smoothly, this tool is beneficial especially when you work with many projects and maybe one or two will require you to use a specific version.

[https://github.com/nvm-sh/nvm](https://github.com/nvm-sh/nvm)

### Using CLI to start a project

ref: [https://docs.nestjs.com/cli/overview#installation](https://docs.nestjs.com/cli/overview#installation)

In order to keep the NestJS patterns as much as we can, I am going to use the CLI and also to make the process faster.

In your terminal, check the node version you are running, and remember to use the latest stable version. Finally, run the following command to create the base project.

```bash
nest g application nestjs-auth-flow-blog-post
```

The command will create a few files as a base project, we probably won't need all those, but let's keep them for a while. After the command, go into the project folder and install de dependencies with `pnpn`, `yarn` or `npm` as you prefer. Before we continue, I'd like to apply a few nice tricks that I consider a booster for the application.

### Running with SWC ⚙️

ref: [https://docs.nestjs.com/recipes/swc#swc](https://docs.nestjs.com/recipes/swc#swc)

As the reference explains "[**SWC**](https://swc.rs/) (Speedy Web Compiler) is an extensible Rust-based platform that can be used for both compilation and bundling. Using SWC with Nest CLI is a great and simple way to significantly speed up your development process.”

To install it is simple, first install two dependencies inside `dev dependencies` , they are:

```bash
@swc/cli @swc/core
```

Next on, open `nest-cli.json` and add this command line inside `compilerOptions`

```bash
{
  "compilerOptions": {
    "builder": "swc"
  }
}
```

### Choosing a suitable **Node Target Mapping 🗺**

ref: [https://github.com/microsoft/TypeScript/wiki/Node-Target-Mapping](https://github.com/microsoft/TypeScript/wiki/Node-Target-Mapping)

You can let TypeScript compile as little as possible by knowing what baseline support for ECMAScript features is available in your node version.

For example, I am running node 18, so the suitable version is `ES2022`. This target value you have to put inside of the `tsconfig.json`.

![Screen Shot 2023-10-05 at 20.05.11.png](/blog-assets/implementing-auth-flow-as-fast-as-possible-using-nestjs/screen-shot-2023-10-05-at-20-05-11.png)

### Deploy

I know that you want to put it or any other solution online, and using [Vercel](https://vercel.com/) we can do it easily. First, create a file called **`vercel.json`** inside the root folder and then fill it out with this content.

```json
{
    "version": 2,
    "builds": [
      {
        "src": "src/main.ts",
        "use": "@vercel/node"
      }
    ],
    "routes": [
      {
        "src": "/(.*)",
        "dest": "src/main.ts",
        "methods": ["GET", "POST", "PUT", "DELETE"]
      }
    ]
  }
```

<aside>
💡 If you want to deploy it on vercel, you'll need to have your repository on Github already.

</aside>

Now, you can create your account and link your project to Vercel in order to make the deploy, check this video out.

[https://youtu.be/OYsF6sO5Duw?si=HkpZsATpkSm_nwk_](https://youtu.be/OYsF6sO5Duw?si=HkpZsATpkSm_nwk_)

**We are online!! 🚀**

---

## Conclusion 🧙‍♂️

We've taken just a few steps on this exciting journey so far, but don't fret! You can expect the next post to drop soon. If you're eager to get your hands on the code base, it's right [here](https://github.com/henriqueweiand/nestjs-auth-flow-blog-post) in this repository. In our upcoming article, we'll dive headfirst into creating the user and auth modules – the real MVPs of this application. Don't miss out on that action! See you in the next one! 👋🏻

[https://github.com/henriqueweiand/nestjs-auth-flow-blog-post](https://github.com/henriqueweiand/nestjs-auth-flow-blog-post)
