---
title: Real-time chat with NestJS and Socket.io
excerpt: >-
  Real-time communication is an intriguing topic, and I wanted to share my
  thoughts on it. I came across one of my old blog posts about micro frontends,
  where I developed an interface for a micro frontend chat feature that
coverImage: /blog-assets/real-time-chat-with-nestjs-and-socket-io/cover.png
date: '2025-01-24T12:00:00.000Z'
author:
  name: Henrique Weiand
  picture: /nestjs-ninja.png
ogImage:
  url: /blog-assets/real-time-chat-with-nestjs-and-socket-io/cover.png
tags:
  - NestJS
  - Socket.io
  - chat
  - real-time
---
Real-time communication is an intriguing topic, and I wanted to share my thoughts on it. I came across one of my old blog posts about micro frontends, where I developed an interface for a micro frontend chat feature that was shared across two other pages. In that project, I focused solely on the front end and interface without addressing the backend or ensuring everything functioned properly. So, what did I do next? I implemented the backend using NestJS with [Socket.io](http://Socket.io) to facilitate chat functionality among the different pages utilizing the micro frontend chat.

<aside>
📎

This is the old micro frontend project [Building a system as lego with react and micro frontends](Building%20a%20system%20as%20lego%20with%20react%20and%20micro%20fro%20cd08c5cfc3af4cea95fdc234524513d4.md) 

</aside>

> ⚠️ Before we continue, I wanna let you know that this will be an important year for the blog, I am planning to start publishing more frequent blog posts and even videos! My advice for you is to subscribe to the page and don't miss any new publications or updates!
> 

### Target 🎯

I'm building a simple system without much complexity in terms of modules and services to handle the pure and basic functionality of sending and receiving messages among the users connected to the chat.

**Backend project**

[https://github.com/henriqueweiand/nestjs-real-time-chat](https://github.com/henriqueweiand/nestjs-real-time-chat)

**Frontend project**

[https://github.com/henriqueweiand/nextjs-real-time-chat-with-micro-frontends](https://github.com/henriqueweiand/nextjs-real-time-chat-with-micro-frontends)

### Starting point

I first created a project by using the [NestJS CLI](https://docs.nestjs.com/cli/overview). With the project ready, I make a module  with the command:

```bash
nest generate module chat
```

By the way, you can create the module manually if you want. Then, I create one more file called `chat-gateway.ts` with the content

[https://github.com/henriqueweiand/nestjs-real-time-chat/blob/master/src/chat/chat-gateway.ts](https://github.com/henriqueweiand/nestjs-real-time-chat/blob/master/src/chat/chat-gateway.ts)

For the chat project, I have a few functionalities in mind:

- Notify when a user connects;
- Notify when a user disconnects;
- Broadcast the messages;

Let's go through some of the methods defined inside the `chat-gateway` to detail how the gateway is addressing the features.

ChatGateway is decorated with the `WebSocketGateway`, which words as equal to a provider, which means we also have to add it as a provider inside the chat.module. WebSocketGateway has properties that can be set as needed, and in our case, I allowed the cors to work with any page and I also changed the port (because I wanted to, but it is not necessary). 

ChatGateway is implementing two interfaces, and those interfaces will allow us to implement two methods:

- handleConnection
- handleDisconnect

The name of the function is pretty self-explanation, right? One deals with new connections to the socket and the other for the disconnections.

<aside>
💡

The official documentation about WebSocketGateway is available https://docs.nestjs.com/websockets/gateways

</aside>

### handleConnection

As described in the official documentation:  https://docs.nestjs.com/websockets/gateways#lifecycle-hooks the `handleConnection` receives an argument that is the library-specific client socket instance.

In this example, I am emitting a message to the event `user-joined`. Every client that is connected and listening to this event will know that somebody else joined. By the way, `broadcast` emits to everybody but the user who is joining, which is perfect for what we need!

### handleDisconnect

This method also receives the client instance as a parameter, and for this example, the difference is that we are using the WebSocketServer instance to emit a message to everybody connected that someone left on the `user-left`event. 

### Dealing with all messages

The method `handleNewMessage` is decorated with SubscribeMessage and defines the main event for all the messages. The name of the function could be anything else, ok? Just to let you know. Same here as we did for the disconnect event, we are emitting the message received to everybody.

## Frontend

The frontend project as I said previously, is the same as I implemented and described in this post[Building a system as lego with react and micro frontends](Building%20a%20system%20as%20lego%20with%20react%20and%20micro%20fro%20cd08c5cfc3af4cea95fdc234524513d4.md), so please take a look at the other blog post to get more details about the frontend project. I will just explain where I applied the changes to make the real-time part work.

### Adding [Socket.io](http://Socket.io) to the frontend

This project runs three micro frontends, but there's one that is the chat component and the one that we have to apply the changes. All the changes were applied to this file

[https://github.com/henriqueweiand/nextjs-real-time-chat-with-micro-frontends/blob/master/apps/chat/src/components/Chat/index.tsx](https://github.com/henriqueweiand/nextjs-real-time-chat-with-micro-frontends/blob/master/apps/chat/src/components/Chat/index.tsx)

The changes made were:

- socket.io-client library;
- Initiated the connecting with the port that we defined on the Backend project;
- Added the listening to all events defined on the backend
    - user-joined
    - user-left
    - message
    - newMessage
- Minor changes to remove the old “bot replies”

It's quite easy to read the component and understand what is happening there.

### Conclusion

This blog post was directly to the point and without much complexity. I didn't make an abstraction or anything else; I just created the Chat module and added all that I needed, so I recommend you review the module and gateway according to all your necessities. 

I'm planning to continue this post soon with more details related to other features that are possible to apply to NestJS and Sockets.io

![Kapture 2025-01-24 at 14.45.12.gif](/blog-assets/real-time-chat-with-nestjs-and-socket-io/kapture-2025-01-24-at-14-45-12.gif)
