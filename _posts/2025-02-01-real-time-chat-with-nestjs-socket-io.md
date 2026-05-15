---
title: "Real-time Chat with NestJS and Socket.io"
excerpt: "A focused walkthrough of a simple NestJS WebSocket gateway that tracks connections, disconnections, and chat messages with Socket.io."
coverImage: "/nestjs-ninja.png"
date: "2025-02-01T12:00:00.000Z"
author:
  name: "Henrique Weiand"
  picture: "/nestjs-ninja.png"
ogImage:
  url: "/nestjs-ninja.png"
tags:
  - NestJS
  - Socket.io
  - Realtime
  - WebSockets
---

Real-time features are a good way to make a system feel alive. Chat is the classic example: one user sends a message, and everyone else should see it without refreshing the page.

This post is based on my original Medium article, [Real-time chat with NestJS and Socket.io](https://medium.com/p/642d10044201). The goal is intentionally small: build the backend pieces needed for a basic chat flow using NestJS gateways and Socket.io.

The related projects are:

- [nestjs-real-time-chat](https://github.com/henriqueweiand/nestjs-real-time-chat)
- [nextjs-real-time-chat-with-micro-frontends](https://github.com/henriqueweiand/nextjs-real-time-chat-with-micro-frontends)

## The target

The backend does not try to model a full chat product. There are no rooms, message persistence, authentication, delivery receipts, or moderation rules.

The first version only needs to do three things:

- notify connected users when someone joins
- notify connected users when someone leaves
- broadcast messages to everyone connected to the chat

That is enough to prove the real-time flow and connect it to a frontend chat component.

## Creating the chat module

The project starts as a standard NestJS application. After generating the app, the chat feature can live in its own module:

```bash
nest generate module chat
```

The core file in that module is the gateway:

```text
src/chat/chat-gateway.ts
```

In NestJS, a WebSocket gateway behaves like a provider. That means it must be registered in the module's `providers` array so Nest can instantiate it and wire the lifecycle hooks.

## The gateway

The gateway is decorated with `@WebSocketGateway`. That decorator tells Nest to create a WebSocket server for the class.

For a local demo, the gateway can also define CORS and a custom port:

```ts
@WebSocketGateway(3002, {
  cors: {
    origin: "*",
  },
})
export class ChatGateway {}
```

Open CORS is fine for a learning project, but production systems should restrict origins to the frontend domains that are allowed to connect.

## Connection lifecycle

Nest gateways can implement lifecycle interfaces for socket connections:

- `OnGatewayConnection`
- `OnGatewayDisconnect`

Those interfaces map to two methods:

```ts
handleConnection(client: Socket) {}

handleDisconnect(client: Socket) {}
```

The `client` argument is the Socket.io client instance for the active connection.

## Handling new users

When a user connects, the gateway can notify everyone else that a new user joined.

The useful detail here is `broadcast`: it emits to every connected socket except the socket that triggered the event.

```ts
handleConnection(client: Socket) {
  client.broadcast.emit("user-joined", {
    message: "A user joined the chat",
  });
}
```

For a chat interface, that behavior usually makes sense. The person who just connected already knows they joined. The other connected clients are the ones who need the update.

## Handling disconnected users

When a user disconnects, the gateway can notify all connected clients through the WebSocket server instance.

```ts
@WebSocketServer()
server: Server;

handleDisconnect(client: Socket) {
  this.server.emit("user-left", {
    message: "A user left the chat",
  });
}
```

This event goes to everyone currently connected. In a more complete application, this payload would likely include a user id, display name, or room id.

## Broadcasting messages

Chat messages can be handled with `@SubscribeMessage`. The decorator tells Nest which socket event should call the method.

```ts
@SubscribeMessage("newMessage")
handleNewMessage(@MessageBody() message: string) {
  this.server.emit("message", message);
}
```

The client emits `newMessage`, and the backend broadcasts `message` to connected clients.

The event names do not need to be different, but using separate names can make the direction explicit:

- `newMessage`: client to server
- `message`: server to clients

## Frontend integration

The frontend uses `socket.io-client` inside the chat micro frontend. The component connects to the backend gateway port and listens to the events exposed by the server:

- `user-joined`
- `user-left`
- `message`

It also emits `newMessage` whenever the current user sends a message.

That is the minimum contract between the UI and the gateway. As long as both sides agree on those event names and payloads, the implementation stays easy to reason about.

## What to improve next

This version is intentionally small, but it creates a base for more useful real-time features:

- rooms or channels
- authenticated socket connections
- persisted message history
- typing indicators
- online user lists
- message delivery status
- rate limiting
- stricter CORS and origin checks

Each of those features adds product value, but also adds architecture decisions. Starting with a small gateway keeps the learning surface manageable.

## Final thoughts

NestJS makes Socket.io integration straightforward through gateways, lifecycle hooks, and message decorators.

For a basic chat, the backend only needs a module, a gateway, connection hooks, and a message handler. Once those pieces are in place, the frontend can connect with `socket.io-client` and react to the same event names.

It is not a full chat platform yet, but it is a solid first step into real-time NestJS applications.
