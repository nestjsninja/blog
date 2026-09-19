---
title: Building an MCP Server with NestJS
excerpt: >-
  An MCP server is how you hand your application to an AI client like Claude or
  ChatGPT without writing a chatbot. We build one on top of a normal NestJS
  service using @rekog/mcp-nest, expose tools, resources and prompts with Zod,
  and call every one of them with curl. Along the way we hit two things the
  README does not warn you about: your exceptions arrive at the model as
  "Internal server error", and your guards do not protect tools/list.
date: '2026-09-24T12:00:00.000Z'
author:
  name: Henrique Weiand
  picture: /nestjs-ninja.png
tags:
  - NestJS
  - MCP
  - AI
  - Zod
  - Typescript
ogImage:
  url: /blog-assets/building-an-mcp-server-with-nestjs/cover.png
coverImage: /blog-assets/building-an-mcp-server-with-nestjs/cover.png
---
Hello, dev!

Every few months something shows up that changes how we are expected to wire systems together, and right now that thing is **MCP**, the Model Context Protocol. The idea behind it is small enough to explain in one sentence: instead of building a chat interface into your product, you expose your product as a set of tools, and any AI client that speaks MCP (Claude Desktop, Claude Code, ChatGPT, Cursor, and a growing list of others) can call them.

I want to be precise about what that means, because the hype around it hides how ordinary it is. An MCP server is a JSON-RPC server. It answers a handful of methods: "what tools do you have?", "call this tool with these arguments", "read this resource". That is it. There is no model inside it, no prompt engineering, no embedding. You are writing a typed API whose consumer happens to be a language model instead of a React app.

Which is exactly why NestJS is such a comfortable place to build one. You already have the services, the validation, the guards, the dependency injection, and the exception handling. An MCP server on top of that should be a transport, not a rewrite. In this post we build one, expose tools, resources and prompts from a plain `@Injectable()` service, and call every single one of them with `curl` so nothing here is taken on faith.

> By the way, if you have only seen MCP demonstrated with a weather API or a to-do list, it is worth knowing that the interesting version is the boring one: pointing it at the service layer you already have in production.

## What we are building 🎯

A tiny task tracker, exposed over MCP:

- **Two tools**: `list-tasks` (filter by status or assignee) and `close-task` (mark one done).
- **One resource**: `tasks://open`, the current open tasks as JSON.
- **One prompt**: `standup-summary`, a reusable prompt template the client can offer the user.

All four are backed by a single `TasksService` that knows nothing about MCP. That separation is the whole point, and it is what I want you to take away even if you never use this exact library.

Versions used here, because this ecosystem is moving fast: NestJS `12.0.3`, `@rekog/mcp-nest` `2.0.6`, the official MCP SDK packages at `2.0.0`, and Zod `4.6.5`.

💻 The full, runnable project is on GitHub: [nestjsninja/nestjs-mcp-server](https://github.com/nestjsninja/nestjs-mcp-server). Every response printed in this post came out of it, and every claim I make below has a test in there holding it in place.

## Setting the project up ⚙️

[`@rekog/mcp-nest`](https://github.com/rekog-labs/MCP-Nest) is the NestJS module for this, and it does the heavy lifting: discovery, schema conversion, the HTTP transport, session handling.

Before you copy the install line from its README, one warning that cost me a few minutes. The README still tells you to install `@modelcontextprotocol/sdk`, but version 2 of the package moved to the split SDK packages. Look at the actual peer dependencies and install these:

```bash
npm install @rekog/mcp-nest \
  @modelcontextprotocol/core \
  @modelcontextprotocol/node \
  @modelcontextprotocol/server \
  zod
```

Zod 4 is required, not optional, and not Zod 3. The tool schemas are Zod schemas, and the library converts them to JSON Schema for you.

## The service that knows nothing about MCP 🧱

Start here, because this is the part that should look completely unremarkable:

```ts
// tasks.service.ts
import { Injectable, NotFoundException } from "@nestjs/common";

export interface Task {
  id: string;
  title: string;
  status: "open" | "done";
  assignee: string;
}

@Injectable()
export class TasksService {
  private readonly tasks = new Map<string, Task>([
    ["T-1", { id: "T-1", title: "Ship the MCP server", status: "open", assignee: "henrique" }],
    ["T-2", { id: "T-2", title: "Write the blog post", status: "open", assignee: "henrique" }],
    ["T-3", { id: "T-3", title: "Fix the flaky test", status: "done", assignee: "ana" }],
  ]);

  findAll(filter: { status?: "open" | "done"; assignee?: string } = {}): Task[] {
    return [...this.tasks.values()].filter(
      (task) =>
        (!filter.status || task.status === filter.status) &&
        (!filter.assignee || task.assignee === filter.assignee),
    );
  }

  findOne(id: string): Task {
    const task = this.tasks.get(id);
    if (!task) throw new NotFoundException(`Task ${id} does not exist`);
    return task;
  }

  close(id: string): Task {
    const task = this.findOne(id);
    task.status = "done";
    return task;
  }
}
```

A `Map` stands in for your repository here. In a real project this is your TypeORM repository, your Prisma client, your HTTP client to another service. Nothing below will care which.

## The strategy API 🔌

If you have read older tutorials about this library, or asked an AI assistant about it, you will have seen `McpModule.forRoot({ ... })`. That API is gone in version 2. MCP now runs as a **NestJS microservice transport strategy**, and your tools live on controllers decorated with `@McpController()`.

That is not a cosmetic change. It is the reason the rest of this post works: because tools are real `@MessagePattern` handlers underneath, NestJS guards, pipes, interceptors and exception filters apply to them the same way they apply to an HTTP route.

The strategy itself is the configuration, and it is a plain object you export:

```ts
// app.module.ts
import { Module } from "@nestjs/common";
import { McpStrategy, MCP_STRATEGY, StreamableHttpTransport } from "@rekog/mcp-nest";
import { TasksMcpController } from "./tasks.controller";
import { TasksService } from "./tasks.service";

export const mcp = new McpStrategy({
  name: "tasks-mcp",
  version: "1.0.0",
  transports: [new StreamableHttpTransport({ statefulMode: false })],
});

@Module({
  controllers: [TasksMcpController],
  providers: [TasksService, { provide: MCP_STRATEGY, useValue: mcp }],
})
export class AppModule {}
```

And bootstrapping, where the ordering genuinely matters:

```ts
// main.ts
import { NestFactory } from "@nestjs/core";
import { AppModule, mcp } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  mcp.setHttpAdapter(app.getHttpAdapter()); // required for HTTP transports
  app.connectMicroservice({ strategy: mcp });
  await app.startAllMicroservices(); // mounts /mcp
  await app.listen(3000); // your normal REST routes still work
}
void bootstrap();
```

`startAllMicroservices()` must come **before** `listen()`. It is what mounts the `/mcp` route onto the same Express adapter your REST controllers use. Get the order wrong and you get a perfectly healthy application with a 404 where your MCP server should be.

Start it, and Nest tells you it worked:

```text
[McpStrategy] MCP streamable-http transport mounted at /mcp (stateless)
```

Notice that this is one process serving both your existing REST API and your MCP server on port 3000. You are adding a transport to the app you already have.

## Tools: the part the model actually calls 🔧

```ts
// tasks.controller.ts
import { McpController, Tool, McpContext } from "@rekog/mcp-nest";
import { Ctx, Payload } from "@nestjs/microservices";
import { z } from "zod";
import { TasksService } from "./tasks.service";

@McpController()
export class TasksMcpController {
  constructor(private readonly tasks: TasksService) {}

  @Tool({
    name: "list-tasks",
    description:
      "List tasks in the tracker, optionally filtered by status or assignee. " +
      "Returns every task when no filter is given.",
    parameters: z.object({
      status: z.enum(["open", "done"]).optional(),
      assignee: z.string().optional(),
    }),
    annotations: { readOnlyHint: true },
  })
  listTasks(@Payload() filter: { status?: "open" | "done"; assignee?: string }) {
    const found = this.tasks.findAll(filter);

    return {
      content: [{
        type: "text" as const,
        text: found.length === 0
          ? "No tasks matched that filter."
          : `${found.length} task(s):\n${JSON.stringify(found, null, 2)}`,
      }],
    };
  }

  @Tool({
    name: "close-task",
    description: "Mark a task as done.",
    parameters: z.object({ id: z.string() }),
    annotations: { destructiveHint: false, idempotentHint: true },
  })
  async closeTask(@Payload() { id }: { id: string }, @Ctx() ctx: McpContext) {
    await ctx.reportProgress({ progress: 50, total: 100 });
    const task = this.tasks.close(id);
    return { content: [{ type: "text" as const, text: `Closed ${task.id}: ${task.title}` }] };
  }
}
```

A few things worth pointing out in there:

- **`@Payload()` is the tool arguments**, already parsed and validated against your Zod schema. **`@Ctx()`** is the MCP request context, and it gives you `reportProgress`, `log`, the client info, the session, and the raw HTTP request.
- **Constructor injection is completely normal.** `TasksService` arrived through the usual DI container. This is the thing that makes NestJS worth using here at all: your MCP tools get your real services, your real database connection, your real config, with no adapter layer in between.
- **`annotations` are hints for the client**, not enforcement. `destructiveHint` and `idempotentHint` let a client decide whether to ask the user before calling. Set them honestly. They are how a well-behaved client knows `close-task` is safe to retry and something like `delete-project` is not.

Now let us see what a client actually receives. MCP over Streamable HTTP is plain JSON-RPC, so `curl` is a perfectly good client:

```bash
curl -s -X POST http://127.0.0.1:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

```json
{
  "result": {
    "tools": [
      {
        "name": "list-tasks",
        "description": "List tasks in the tracker, optionally filtered by status or assignee. Returns every task when no filter is given.",
        "annotations": { "readOnlyHint": true },
        "inputSchema": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "type": "object",
          "properties": {
            "status": { "type": "string", "enum": ["open", "done"] },
            "assignee": { "type": "string" }
          }
        }
      }
    ]
  },
  "jsonrpc": "2.0",
  "id": 1
}
```

Your Zod schema came out the other side as JSON Schema, including the enum. That is what the model reads to decide how to call you. And calling it:

```bash
curl -s -X POST http://127.0.0.1:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call",
       "params":{"name":"close-task","arguments":{"id":"T-1"}}}'
```

```json
{
  "result": { "content": [{ "type": "text", "text": "Closed T-1: Ship the MCP server" }] },
  "jsonrpc": "2.0",
  "id": 2
}
```

That `Accept` header with both `application/json` and `text/event-stream` is mandatory in the Streamable HTTP spec. If you are debugging a client that cannot connect, that header is the first thing to check.

Validation comes for free, and the error is genuinely useful:

```json
{
  "result": {
    "content": [{
      "type": "text",
      "text": "Invalid parameters: [id]: Invalid input: expected string, received number"
    }],
    "isError": true
  }
}
```

Read that response shape carefully, because it is the single most confusing thing about MCP for people coming from REST. A failed tool call is **not** a JSON-RPC error. It is a successful result with `isError: true` and the message in the content. That is deliberate: the model is supposed to *read* the failure and decide what to do next, the same way you would read a stack trace. A protocol-level error would just break the conversation.

## Gotcha 1: your exceptions arrive as "Internal server error" 🚨

Here is the first thing that will bite you, and it bit me while writing this post. `TasksService.findOne` throws a perfectly descriptive `NotFoundException("Task NOPE does not exist")`. Ask for a task that does not exist:

```json
{
  "result": {
    "content": [{ "type": "text", "text": "Internal server error" }],
    "isError": true
  }
}
```

The model is told nothing. It cannot correct itself, so it will either guess again or give up, and you will be reading your own logs to find out why. Your careful domain exceptions are being flattened.

The fix is one line, and the library ships the filter for you:

```ts
import { UseFilters } from "@nestjs/common";
import { McpController, McpExceptionFilter } from "@rekog/mcp-nest";

@McpController()
@UseFilters(McpExceptionFilter)
export class TasksMcpController {
  // ...
}
```

Same request, after:

```json
{
  "result": {
    "content": [{ "type": "text", "text": "Task NOPE does not exist" }],
    "isError": true
  }
}
```

Now the model knows the ID was wrong and can try a different one, or tell the user. It is a real behavioural difference, not a cosmetic one.

But now look at what that filter does, because it has a sharp edge:

```ts
const message = exception instanceof Error ? exception.message : "Internal server error";
```

**Every** `Error` message goes to the client. That is exactly what you want for `NotFoundException` and exactly what you do not want for a Postgres connection error carrying a connection string, or a third-party client that puts the request URL and an API key in the message. If your service throws anything other than deliberate domain exceptions, write your own filter that maps known exception types to safe messages and collapses everything else into a generic one. This is the same discipline as [mapped error handling in a REST API](https://nestjs-ninja.com/blog/2026-08-20-nestjs-mapped-error-handling-domain-exceptions/), and the reason it matters more here is that the recipient is a model that will happily repeat whatever it is told back to a user.

## Resources and prompts 📁

Tools get all the attention, but MCP has two other primitives, and they are cheap to add.

A **resource** is content the client can read. Not an action, just data at a URI, and clients typically attach them to the conversation rather than calling them:

```ts
@Resource({
  uri: "tasks://open",
  name: "open-tasks",
  description: "The current open tasks as JSON.",
  mimeType: "application/json",
})
openTasks() {
  return {
    contents: [{
      uri: "tasks://open",
      mimeType: "application/json",
      text: JSON.stringify(this.tasks.findAll({ status: "open" })),
    }],
  };
}
```

A **prompt** is a reusable template the client can surface to the user, usually as a slash command or a menu item:

```ts
@Prompt({
  name: "standup-summary",
  description: "Ask the model for a standup summary for one assignee.",
  parameters: z.object({ assignee: z.string() }),
})
standup(@Payload() { assignee }: { assignee: string }) {
  return {
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text: `Summarise these tasks for standup: ${JSON.stringify(
          this.tasks.findAll({ assignee }),
        )}`,
      },
    }],
  };
}
```

Both live on the same controller, both use the same injected service. `resources/read` and `prompts/get` answer exactly as you would expect:

```bash
curl -s -X POST http://127.0.0.1:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":3,"method":"resources/read",
       "params":{"uri":"tasks://open"}}'
```

```json
{
  "result": {
    "contents": [{
      "uri": "tasks://open",
      "mimeType": "application/json",
      "text": "[{\"id\":\"T-2\",\"title\":\"Write the blog post\",\"status\":\"open\",\"assignee\":\"henrique\"}]"
    }]
  }
}
```

The rule of thumb I use: if the model should **do** something, it is a tool. If the model should **know** something, it is a resource. If the **user** should be offered something, it is a prompt.

## Gotcha 2: guards protect `tools/call`, not `tools/list` 🔐

Because tools are message-pattern handlers, a normal NestJS guard works. Here is one reading the HTTP `Authorization` header out of the MCP context:

```ts
// api-key.guard.ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { McpContext } from "@rekog/mcp-nest";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const mcp = context.switchToRpc().getContext<McpContext>();
    const request = mcp.getRawRequest<{ headers: Record<string, string> }>();

    if (request?.headers?.authorization !== `Bearer ${process.env.MCP_API_KEY}`) {
      throw new UnauthorizedException("Missing or invalid API key");
    }
    return true;
  }
}
```

`switchToRpc().getContext()` rather than `switchToHttp()`, because underneath this is a microservice handler. `getRawRequest()` is the escape hatch back to the Express request.

Apply it with `@UseGuards(ApiKeyGuard)` on the controller and unauthenticated calls are rejected properly:

```json
{
  "result": {
    "content": [{ "type": "text", "text": "Missing or invalid API key" }],
    "isError": true
  }
}
```

Now, the part nobody tells you. With that guard in place, run `tools/list` with **no credentials at all**:

```json
{
  "result": {
    "tools": [
      {
        "name": "list-tasks",
        "description": "List tasks in the tracker, optionally filtered by status or assignee. ...",
        "inputSchema": { "...": "..." }
      }
    ]
  }
}
```

It answers. Discovery is handled by the transport before any handler runs, so a guard on the controller never sees it. Anyone who can reach your `/mcp` endpoint can enumerate every tool you expose, with full descriptions and argument schemas.

Whether that matters depends on you. Tool names and schemas are usually not secret, and the guard is still doing its job where it counts, since nothing can be *called*. But if your tool list itself is sensitive, and internal tool names have a way of being sensitive, then a controller guard is the wrong layer. Put authentication in front of the endpoint: middleware on `/mcp`, a reverse proxy, or the library's OAuth support, which is designed for exactly this and is how the spec expects a remote MCP server to be secured.

> Worth saying plainly: an authenticated MCP server is not an authorised one. The guard above proves a caller holds a key. It says nothing about *which* tasks they should see. `list-tasks` currently returns everyone's. Scope your queries to the authenticated principal, the same as any other API.

## STDIO, for local clients 💻

Everything so far was Streamable HTTP, which is what you want for a remote server. Local clients like Claude Desktop and Claude Code usually launch your server as a subprocess and talk to it over stdin and stdout. Same controllers, different transport:

```ts
// main.stdio.ts
const mcp = new McpStrategy({
  name: "tasks-mcp",
  version: "1.0.0",
  transports: [new StdioTransport()],
});

async function bootstrap() {
  const app = await NestFactory.createMicroservice(StdioModule, {
    strategy: mcp,
    logger: false, // mandatory, see below
  });
  await app.listen();
}
```

`logger: false` is not a preference. In STDIO mode, stdout **is** the protocol channel. One stray `console.log`, or Nest's own cheerful startup banner, lands in the middle of the JSON-RPC stream and the client drops the connection with a parse error that does not point anywhere near the cause. If you need logs, write them to stderr.

You can test it without any client at all, by piping frames in:

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list-tasks","arguments":{"status":"open"}}}' \
  | node dist/main.stdio.js
```

```json
{"result":{"protocolVersion":"2025-06-18","capabilities":{"tools":{"listChanged":true},"resources":{"listChanged":true},"prompts":{"listChanged":true},"logging":{}},"serverInfo":{"name":"tasks-mcp","version":"1.0.0"}},"jsonrpc":"2.0","id":1}
{"result":{"content":[{"type":"text","text":"[\n  {\n    \"id\": \"T-1\", ... }]"}]},"jsonrpc":"2.0","id":2}
```

That handshake is worth looking at once. `initialize` is where the client and server agree a protocol version and the server declares its capabilities. Everything after it is just method calls.

To wire it into a desktop client, point it at the built file:

```json
{
  "mcpServers": {
    "tasks": {
      "command": "node",
      "args": ["/absolute/path/to/dist/main.stdio.js"]
    }
  }
}
```

Use an absolute path. The client does not run it from your project directory.

## Stateful or stateless? 🗂️

`StreamableHttpTransport` takes a `statefulMode` flag, and the choice has real deployment consequences.

**Stateless** (`statefulMode: false`, what we used) treats every request independently. No session, no server-side memory, so any instance can serve any request. If you are deploying behind a load balancer, in a container that scales, or anywhere serverless, this is the one you want, and it is the same reasoning behind building a fresh handler per request rather than a long-lived one.

**Stateful** keeps a session per client, identified by an `Mcp-Session-Id` header, and lets the server push notifications back over a held-open stream. You need it for server-initiated messages: progress on a long job, or telling a connected client that your tool list changed. The cost is that sessions live in one process's memory, so you now need sticky sessions or a shared store, and a restart disconnects everyone.

Start stateless. Move to stateful when you have a concrete need to push something to the client, not before.

## Designing tools a model can actually use 🧭

The protocol is the easy half. The half that decides whether your server is any good is tool design, and it is genuinely different from REST API design, because your caller reads English and guesses.

What I would keep in mind:

- **The description is the API contract.** The model has your description and your JSON Schema, and nothing else. "Mark a task as done" is worth more than any amount of clever code underneath. Write it for a competent new colleague with no context.
- **Fewer, higher-level tools beat many CRUD tools.** Do not port your twelve REST endpoints one for one. A model given `createTask`, `updateTask`, `patchTaskStatus`, `assignTask` and `reassignTask` will pick wrong. Expose the operations your domain actually has.
- **Return text the model can reason about.** Dumping raw JSON works, but a short sentence plus the data works better, and it costs you one template literal. Every byte you return is context the model pays for.
- **Be honest with annotations.** `destructiveHint` and `idempotentHint` drive whether a client asks the user for confirmation. Understating them is how you end up with an agent deleting something at 2am.
- **Validate like you mean it.** Zod is doing real work here. The model will send you a string where you wanted a number, and a clear validation message is genuinely how it corrects itself, as we saw above.
- **Never trust the arguments.** They were produced by a language model, which may have been reading a web page, an email, or a document written by someone who would like your tool to be called with different arguments than the user intended. Prompt injection is the threat model. Authorise every call against the real principal, not against what the payload claims.

That last point deserves more than a bullet, honestly, and it may well be its own post. For now: treat MCP tool arguments with exactly the suspicion you would treat an unauthenticated public form submission, because architecturally that is what they are.

## Proving it 🧪

I want to be honest about why the repo has tests, because "example project with tests" usually means coverage theatre. These exist because both gotchas above are *quiet*: nothing crashes, nothing logs, you simply get worse behaviour than you expected. A test is the only thing that keeps them visible.

```bash
npm run build && npm test
```

```text
ℹ tests 21
ℹ pass 21
ℹ fail 0
```

The ones worth reading:

- **`exception-filter.spec.ts`** stands the same controller up twice, with and without `McpExceptionFilter`, and asserts `"Internal server error"` in one and `"Task NOPE does not exist"` in the other. The difference is the whole section above, in two assertions.
- **`api-key.guard.spec.ts`** ends with a test named "DOES NOT protect tools/list". It asserts the hole on purpose. If a future version of the library closes it, that test fails and I find out, which is exactly what I want from a surprise.
- **`stdio.spec.ts`** spawns the STDIO server the way a desktop client does and parses every stdout line as JSON. Leave Nest's logger on and it fails on the startup banner, which is a much nicer way to learn that lesson than watching a client disconnect.

One thing I ran into setting that up, which will catch you too: **NestJS 12 ships as pure ESM**, and Jest's CommonJS runtime cannot `require` it. The workarounds all involve experimental flags, so the repo compiles with `tsc` and runs Node's built-in test runner instead. That also sidesteps a second trap, which is that esbuild-based runners like `tsx` do not emit decorator metadata, and NestJS dependency injection needs it. If your tools suddenly cannot resolve their constructor arguments under test, that is why.

## Final thoughts

What I find genuinely good about this approach is how little of it is new. The MCP-specific code in this whole post is four decorators and a bootstrap ordering rule. Everything that makes the server worth anything, the service, the validation, the guard, the exception mapping, is ordinary NestJS that you either already have or already know how to write.

So if you are looking at MCP and wondering whether it means learning a new stack: it does not. It means adding a transport to the application you already run, and then thinking carefully about which of your existing operations you are comfortable handing to something that will call them on a user's behalf. The second part is the hard part, and it is a design problem, not a framework problem.

The two gotchas are the ones I would want to have known before starting. Both are quiet failures: nothing crashes, nothing logs an error, you just get worse behaviour than you expected and no obvious reason why. Apply the exception filter on day one, and be clear-eyed about what a controller guard does and does not cover.

That is it for today. Build one against a service you already have, connect it to a client, and watch a model use your code. It is a strange and slightly unsettling experience the first time, and it will teach you more about your own API design than any review ever has.

### Takeaways ✍️

- An MCP server is a JSON-RPC server with a small fixed vocabulary. There is no model inside it, and NestJS is a good fit precisely because it is so ordinary.
- `@rekog/mcp-nest` v2 dropped `McpModule.forRoot()` for an `McpStrategy` plus `@McpController()`. Older tutorials, and AI assistants trained on them, will hand you the removed API.
- Install the split SDK packages (`@modelcontextprotocol/core`, `/node`, `/server`) and Zod 4. The README's install line is out of date.
- Call `startAllMicroservices()` before `listen()`, or `/mcp` silently 404s.
- A failed tool call is a **successful** result with `isError: true`, not a JSON-RPC error. The model is meant to read the failure and retry.
- Without `@UseFilters(McpExceptionFilter)`, your domain exceptions reach the model as "Internal server error" and it cannot self-correct.
- That filter forwards every `Error` message to the client. Write your own mapping if anything you throw could carry a credential or a connection string.
- Guards run on `tools/call` but not on `tools/list`. Discovery happens in the transport, so authenticate in front of the endpoint if your tool list is sensitive.
- In STDIO mode stdout is the protocol. Pass `logger: false` and keep every log on stderr.
- Prefer stateless HTTP unless you need to push notifications to the client, then accept that you have taken on sticky sessions.
- Tool descriptions are the API contract, and tool arguments are untrusted input authored by a model. Authorise every call against the real principal.
- NestJS 12 is pure ESM, so Jest cannot `require` it. Compile with `tsc` and use Node's test runner, and avoid esbuild-based runners, which do not emit the decorator metadata DI depends on.
