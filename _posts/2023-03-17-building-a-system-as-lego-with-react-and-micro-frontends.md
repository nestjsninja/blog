---
title: "Building a system as lego with react and micro frontends"
excerpt: "Hey! Let's talk, this time, about frontend and one cool approach that I have seen more and more often lately. It is called micro frontends."
coverImage: "/blog-assets/building-a-system-as-lego-with-react-and-micro-frontends/screen-shot-2023-03-20-at-21-23-37.png"
date: "2023-03-17T12:00:00.000Z"
author:
  name: "Henrique Weiand"
  picture: "/nestjs-ninja.png"
ogImage:
  url: "/blog-assets/building-a-system-as-lego-with-react-and-micro-frontends/screen-shot-2023-03-20-at-21-23-37.png"
tags:
  - "Micro frontends"
  - "React.js"
  - "Software Development"
  - "Tech"
  - "Typescript"
  - "Web Dev"
---
Hey! Let's talk, this time, about frontend and one cool approach that I have seen more and more often lately. It is called `micro frontends`.

I like this approach because it can give the project a better way to organize by scope and responsibilities; however, it also has some points that are not so good. In this article, I want to share more about a base structure of a frontend project with ReactJS, NextJS 13, Turbo Pack, and mono repo in three micro frontends, where two of them are going to use the third one.

**What is going to be the application?**

I am going to create a fake chat. It will be something like this:

![[https://drive.google.com/file/d/1AauD6tU50rXo84VKplVYIO0Ss0dmc5yq/view?usp=sharing](https://drive.google.com/file/d/1AauD6tU50rXo84VKplVYIO0Ss0dmc5yq/view?usp=sharing)](/blog-assets/building-a-system-as-lego-with-react-and-micro-frontends/screen-shot-2023-03-20-at-21-23-37.png)

[https://drive.google.com/file/d/1AauD6tU50rXo84VKplVYIO0Ss0dmc5yq/view?usp=sharing](https://drive.google.com/file/d/1AauD6tU50rXo84VKplVYIO0Ss0dmc5yq/view?usp=sharing)

Here we are a “chat component” which will be a micro-frontend shared between the two pages “website 1” and “website 2”.

### Project link

[react-tests-lab/microfrontends-as-lego-example at master · henriqueweiand/react-tests-lab](https://github.com/henriqueweiand/react-tests-lab/tree/master/microfrontends-as-lego-example)

## Project structure

let's review first the structure of the folder because, as I told you, this project was built using the mono repo approach (with yarn workspaces), so we start having this base:

```jsx
├───.husky
├───apps
│   ├───app1
│   └───app2
│   └───chat
└───packages
    ├───config
    │   ├───eslint-config-custom
    │   └───tsconfig
    └───shared
        └───theme
```

Let's review the `shared` and `apps` folder with more details

### Package folder

This folder has everything that we think can be shared between projects, but not as a micro frontend, here we have things like:

- Function;
- UI;
- Configurations (eslint, …)

It is important to create things with less coupling as possible inside here, just because as less coupling they have, the more reusable they will be. For example, you can have a util function

```jsx
function hasImageExtension(str) {
  const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".svg"];
  const extension = str.substring(str.lastIndexOf("."));
  return imageExtensions.includes(extension.toLowerCase());
}
```

Or a component…

```jsx
import React from 'react';
import './Button.css'; // Import CSS file for styling

function Button(props) {
  const { text, onClick } = props;
  
  return (
    <button className="Button" onClick={onClick}>
      {text}
    </button>
  );
}

export default Button;
```

There are some real examples here

[react-tests-lab/microfrontends-as-lego-example/packages at master · henriqueweiand/react-tests-lab](https://github.com/henriqueweiand/react-tests-lab/tree/master/microfrontends-as-lego-example/packages)

In this project I only added a few things inside the package folder, they are:

### Theme

Is a centralize script that contains the theme configuration from [Chrakra-UI](https://chakra-ui.com/). For example, we can see that this script will be added around the projects in order to keep the same initial configuration.

### TSConfig & Eslint-config

Similar to the theme, but, here for useful tools, that usually they repeat along the projects. With this approach, we can centralize and create an easy pattern for all the projects inside this Monorepo.

---

## Apps folder

This is one important folder, besides “packages”, it because here we are going to have all the apps, and they can be micro frontends, frontends, backends, … In this article we are using the Monorepo strategy only for a case with micro frontends, but you can use the same approach for a interey project with all services.

Now, we are going to deep dive inside each app.

## Chat

This is basically the main character of this project, I mean, this project is the chat application that will be added inside of each app. The interface is quite simple as you can see

![Screen Shot 2023-03-22 at 21.22.35.png](/blog-assets/building-a-system-as-lego-with-react-and-micro-frontends/screen-shot-2023-03-22-at-21-22-35.png)

<aside>
⛄ This is not a real application, it is just a fake interaction.

</aside>

The functionality of this micro frontend end is to use to chat with others.

As it was built as a micro frontend, we should be able to include this project inside the others, and in order to do that we have to configure a few things, let's see that.

First of all, we have to think that it is a NextJS project, so the codebase is the same! However, there are some files that we have to change are:

**next.config.js**

This is one important configuration file for the NextJS and here, we included a `@module-federation/nextjs-mf` which will help us to work with the other projects from the monorepo in special. Plus, we have here `webpack`, which is a very well-known library, and in our case it is helping us to make the micro frontend works.

> I am going to explain this part quickly, but, I will go back this part of the code later in order to explain better. Because it is essential to understand if you want to work with micro frontends with webpack.
> 

We are using this project as a micro frontend that will be included by the others, so as you can see we are defining a name and also **exposing** the main component of the chat.

```jsx
/** @type {import('next').NextConfig} */
const NextFederationPlugin = require("@module-federation/nextjs-mf");

module.exports = {
  transpilePackages: ['theme'],
  reactStrictMode: true,
  swcMinify: true,
  webpack(config, options) {
    const { webpack } = options;
    Object.assign(config.experiments, { topLevelAwait: true });
    if (!options.isServer) {
      //config.cache=false
      config.plugins.push(
        new NextFederationPlugin({
          name: "chat",

          filename: "static/chunks/remoteEntry.js",
          exposes: {
            "./App": "./src/index.tsx",
          },
          shared: {},
        })
      );
    }

    return config;
  },
};
```

**.eslintrc.js**

This eslint configuration is importing the configuration from our packages directory. `packages/config/eslint-config-custom`. The idea here as I mentioned before, is to centralize the team patterns inside one directory and use it in all projects.

Even though we are using the pattern from `eslint-config-custom` we still can put the project configuration as well.

```jsx
module.exports = {
  ...require('eslint-config-custom/index'),
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: './tsconfig.json',
  },
};
```

**.tsconfig**

The same idea of `eslint-config-custom` , here we are importing the base configurations from `packages/config/tsconfig` and also adding a few more specific configurations for this project in special.

```jsx
{
  "extends": "tsconfig/nextjs.json",
  "compilerOptions": {
    "plugins": [
      {
        "name": "next"
      }
    ],
    "baseUrl": ".",
    "paths": {
      "@/*": [
        "./src/*"
      ]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    "build/types/**/*.ts"
  ],
  "exclude": [
    "node_modules"
  ]
}
```

**package.json**

As we are using a mono repo strategy in this repository, is important to mention that each one of the apps or even the packages that are using one or more components, functions, … from another project, is necessary to add it inside the package.json, for example:

![Screen Shot 2023-03-25 at 13.18.24.png](/blog-assets/building-a-system-as-lego-with-react-and-micro-frontends/screen-shot-2023-03-25-at-13-18-24.png)

This configuration + next.config.js (@module-federation/nextjs-mf), will turn the project able to include codes from other projects, like this example:

```jsx
import { ChakraProvider, CSSReset } from "@chakra-ui/react";
import { theme } from "theme";

export const Provider: React.FC<any> = ({ children }) => {
    return (
        <ChakraProvider theme={theme}>
            <CSSReset />
            {children}
        </ChakraProvider>
    );
}
```

Here we are using the `theme` from the package theme that comes from `packages/shared/theme`.

## App1

Let's see now, how is our `App1`, which is using our micro frontend `chat`

![Kapture 2023-03-25 at 13.10.49.gif](/blog-assets/building-a-system-as-lego-with-react-and-micro-frontends/kapture-2023-03-25-at-13-10-49.gif)

This is one more NextJS project that is running inside this folder `apps/app1`. For this project and for the App2, we are going to have the same configuration of:

- packages/config/eslint-config-custom
- packages/config/tsconfig
- package.json (for the shared packages)

I’ll skip the explanation of them.

**next.config.js**

This project and App2 are going to have a few differences from `chat`. Because these two projects are including from a remote place another component, so we have a different configuration of next.config.js

```jsx
/** @type {import('next').NextConfig} */
const NextFederationPlugin = require("@module-federation/nextjs-mf");

module.exports = {
  transpilePackages: ['theme'],
  reactStrictMode: true,
  swcMinify: true,
  webpack(config, options) {
    const { webpack } = options;
    Object.assign(config.experiments, { topLevelAwait: true });
    if (!options.isServer) {
      //config.cache=false
      config.plugins.push(
        new NextFederationPlugin({
          name: "app1",
          remotes: {
            chat: `chat@http://localhost:3000/_next/static/chunks/remoteEntry.js`,
          },
          filename: "static/chunks/remoteEntry.js",

          shared: {},
        })
      );
    }

    return config;
  },
};
```

Besides `NextFederationPlugin` configurations, we also have webpack, however, here webpack is including a remote script, which is our chat app. Note that we have to set the endpoint where this component will be.

```jsx
chat: `chat@http://localhost:3000/_next/static/chunks/remoteEntry.js`,
```

This part of the code means:

- chat = how we are going to call the app on the App1 code.
- chat@http://localhost:3000/_next/static/chunks/remoteEntry.js = Name of the micro frontend (from webpack name) plus the endpoint of the javascript code, which will be imported.

With these configurations set, we can have something like:

```jsx
import { Box, Center, Flex, Heading } from '@chakra-ui/react';
import dynamic from "next/dynamic";

const ChatApp = dynamic(
  () => import("chat/App").then((m) => m.App),
  {
    ssr: false,
    loading: () => <p>Loading...</p>,
  }
);

export default function Home() {
  return (
    <Center display={"flex"} flexDirection="column">
      <Box px={4} py={3}>
        <Flex justifyContent="space-between" alignItems="center">
          <Heading color="white" size="lg">
            My APP
          </Heading>
        </Flex>
      </Box>
      <Box maxW='lg' width={'100%'} borderRadius="md" boxShadow="md">
        <ChatApp />
      </Box>
    </Center>
  );
}
```

We have to use `dynamic` from `next` in order to include the remote content, and one more detail, as you can see we are including something from `chat/App`

![Screen Shot 2023-03-25 at 13.29.33.png](/blog-assets/building-a-system-as-lego-with-react-and-micro-frontends/screen-shot-2023-03-25-at-13-29-33.png)

One last suggestion is to configure the type, it will help to say to the code that this remote exists.

![Screen Shot 2023-03-25 at 13.30.49.png](/blog-assets/building-a-system-as-lego-with-react-and-micro-frontends/screen-shot-2023-03-25-at-13-30-49.png)

And that's all! We are ready to run the project in have a chat inside our first app!!

## App2

This second App, follows exactly the previous one, the only difference here is how we have our design.

![Kapture 2023-03-25 at 13.33.38.gif](/blog-assets/building-a-system-as-lego-with-react-and-micro-frontends/kapture-2023-03-25-at-13-33-38.gif)

# Conclusion

We are finishing our article, I hope you enjoyed it. I did this article especially to show everybody that we can build projects fragmented and make them work together easily. The article was more practical about the main configurations that are necessary to do in order to have this approach, also I added mono repo because it is a common way to improve team patterns and shared things.

For sure, this approach has good and bad points, my personal reports are:

**Good points**

1. Improved scalability: Microfrontends allows for more efficient scaling of individual parts of a web application, making it easier to handle large volumes of traffic.
2. Independent development: Teams can work independently on different parts of the application, reducing the risk of conflicts and facilitating faster development cycles.
3. Reusability: Microfrontends can be reused across multiple applications, which can help to reduce development time and improve consistency.
4. Technology flexibility: Different teams can use different technologies and frameworks, as long as they can interface with the overall architecture.
5. Flexibility in deployment: Microfrontends can be deployed separately, allowing for more flexibility in deployment strategies.

**Bad points**

1. Complexity: Microfrontends can add complexity to a web application, especially in terms of configuration, communication, and integration.
2. Communication overhead: Intercommunication between different micro frontends can be challenging, requiring additional effort and coordination.
3. Integration challenges: Integrating micro frontends with other parts of the application can be difficult and requires careful planning.

Additionally, in this article, I didn’t bring up any communication examples between the projects, but it is possible to do, and there are a few different ways, I am not going to talk now, but you can use postMessage API for example. Here you can see a little bit more about it.

[5 Different Techniques for Cross Micro Frontend Communication](https://sharvishi9118.medium.com/cross-micro-frontend-communication-techniques-a10fedc11c59)

Ok, that's all guys! I love this subject and I hope I could help you!
