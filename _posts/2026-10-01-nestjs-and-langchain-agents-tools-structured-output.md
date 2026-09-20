---
title: 'NestJS and LangChain: Agents, Tools and Structured Output'
excerpt: >-
  LangChain v1 inside a NestJS application, built as a real support API: two
  models behind injection tokens so switching vendor is an environment
  variable, structured output with Zod, an LCEL drafting chain, cross-provider
  fallback, and an agent whose tools call your ordinary services. Plus the
  finding that changed how I write this code: withStructuredOutput parses the
  reply but does not validate it, so an invalid enum arrives typed and wrong.
  Every one of the 23 tests runs without an API key.
date: '2026-10-01T12:00:00.000Z'
author:
  name: Henrique Weiand
  picture: /nestjs-ninja.png
tags:
  - NestJS
  - LangChain
  - AI
  - Zod
  - Agents
  - Typescript
ogImage:
  url: /blog-assets/nestjs-and-langchain-agents-tools-structured-output/cover.png
coverImage: /blog-assets/nestjs-and-langchain-agents-tools-structured-output/cover.png
---
Hello, dev!

Last week I wrote about [building an MCP server with NestJS](https://nestjs-ninja.com/blog/2026-09-24-building-an-mcp-server-with-nestjs/), which is how you hand your application to somebody else's AI client. This week is the other direction: your application does the calling. Same framework, opposite arrow.

And I want to start with a claim that the rest of the post is going to spend its time earning. **Almost none of the interesting code here is AI code.** It is dependency injection, validating untrusted input at the boundary, and putting authorisation inside the thing that acts rather than in a string you hope the model respects. If you already write careful NestJS, you already know most of this. What LangChain gives you is a tidy way to call models, compose steps, and let a model choose which of your functions to run. What NestJS gives you is somewhere sane to put all of it.

I am going to build a support API for a small shop: classify a ticket, draft a reply, and run an assistant that can look up orders and issue small refunds by calling real services. Then I am going to test all of it without an API key.

> Before we start, versions matter a lot in this ecosystem. This is **LangChain v1** (`langchain` 1.5, `@langchain/core` 1.2), NestJS 12, Zod 4, Node 24. LangChain v1 renamed and moved enough that a v0 tutorial, or an AI assistant trained on one, will hand you code that does not compile. I hit that twice while writing this, and I will point out where.

💻 The full, runnable project is on GitHub: [nestjsninja/nestjs-langchain](https://github.com/nestjsninja/nestjs-langchain). Every output in this post came out of it, and all 23 tests run in CI with no key and no network.

## Setting the project up ⚙️

```bash
npm install langchain @langchain/core zod
npm install @nestjs/config

# one package per provider you actually want to use
npm install @langchain/openai @langchain/anthropic
```

That second line has a trap in it. `@nestjs/config` jumped straight from `4.x` to `12.x` to line up with the NestJS major version, so if you write `"^4.0.0"` by habit you get a package that only supports NestJS 10 and 11, and the install dies on a peer dependency conflict:

```text
npm error Could not resolve dependency:
npm error peer @nestjs/common@"^10.0.0 || ^11.0.0" from @nestjs/config@4.0.4
```

You want `^12.0.0`. A version number going 4, then 12, is unusual enough to catch you out once.

## The model belongs in the container 🧱

Here is the single most useful idea in this post, and it is pure NestJS.

Most LangChain examples start with `const model = new ChatOpenAI({ ... })` at the top of a file. That is fine for a script. In an application it means your provider choice, your temperature, your timeouts and your API key are scattered across every service that talks to a model, and it means every test touches the network.

So build the model once, in a factory, and put it behind a token:

```ts
// llm/llm.tokens.ts
export const CHAT_MODEL = Symbol("CHAT_MODEL");
```

```ts
// llm/llm.module.ts
async function build(spec: string, apiKey: string | undefined): Promise<BaseChatModel> {
  const [provider] = spec.split(":");

  if (!apiKey) {
    throw new Error(`No API key for provider "${provider}".`);
  }

  return initChatModel(spec, {
    apiKey,
    temperature: 0,
    maxRetries: 2,
    timeout: 30_000,
  });
}

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: CHAT_MODEL,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const spec = config.get<string>("CHAT_MODEL_SPEC") ?? "openai:gpt-4o";
        return build(spec, keyFor(spec, config));
      },
    },
  ],
  exports: [CHAT_MODEL],
})
export class LlmModule {}
```

`initChatModel` is doing the interesting work there. You hand it a `"provider:model"` string, it reads the prefix, lazily imports that provider's package, and returns something implementing the same interface as everything else:

```bash
CHAT_MODEL_SPEC=openai:gpt-4o
CHAT_MODEL_SPEC=anthropic:claude-sonnet-4-5
CHAT_MODEL_SPEC=google:gemini-2.0-flash
```

Changing provider is an environment variable. Not a refactor, not a new adapter, not a single edit inside `src/`.

Three more things I would not skip:

- **The token is typed as `BaseChatModel`**, LangChain's provider-agnostic interface. Every provider's model implements it, and so does every fake. That one decision is what makes both the next section and the testing section possible.
- **It throws at startup when the key is missing.** A missing key is a deployment mistake. Finding out at boot costs you a failed deploy; finding out lazily costs you a customer hitting a 500 at 2am. The lazy import means the same is true of a missing *package*: `anthropic:...` without `@langchain/anthropic` installed fails at boot, which is exactly when you want to hear about it.
- **`temperature: 0`.** Classification and extraction should give the same answer for the same ticket. Save the creativity for the part that writes prose.

Now nothing else in the codebase ever names a vendor:

```ts
constructor(@Inject(CHAT_MODEL) private readonly model: BaseChatModel) {}
```

## Two models, because it is a per-job decision 🔀

Once the model is a provider, an obvious question follows: why only one?

Classifying a ticket into one of five categories and writing the sentence a customer actually reads are different jobs. One is cheap, mechanical and happens on every ticket. The other is worth paying for. Using one model for both means either overpaying for triage or under-delivering on the reply.

So there are two tokens:

```ts
// llm/llm.tokens.ts
export const CHAT_MODEL = Symbol("CHAT_MODEL");   // prose, agent reasoning
export const FAST_MODEL = Symbol("FAST_MODEL");   // classification, routing
```

and each service asks for the one it needs:

```ts
// triage/triage.service.ts
constructor(@Inject(FAST_MODEL) private readonly model: BaseChatModel) {}
```

Two environment variables, and they do not have to be the same vendor:

```bash
CHAT_MODEL_SPEC=anthropic:claude-sonnet-4-5
FAST_MODEL_SPEC=openai:gpt-4o-mini
```

That is a real production setup, not a party trick: the good model where quality is visible to a customer, the cheap one on the hot path. And because both are `BaseChatModel`, no service in the application can tell which is which, or change if you swap them.

Worth testing, since "which model did that actually use" is invisible at runtime. Give the two tokens different scripted replies and the assertion can only pass if the right one was called:

```ts
const smart = new FakeListChatModel({ responses: ["THIS IS THE EXPENSIVE MODEL"] });
const fast = new FakeListChatModel({ responses: [TRIAGE_JSON] });

const moduleRef = await Test.createTestingModule({ imports: [LlmModule], providers: [TriageService] })
  .overrideProvider(CHAT_MODEL).useValue(smart)
  .overrideProvider(FAST_MODEL).useValue(fast)
  .compile();

const result = await moduleRef.get(TriageService).triage("Where is my invoice?");

assert.equal(result.category, "billing");   // only the fast model could have produced this
```

### Falling back when a provider has a bad day

Here is where two providers earns its keep. Every Runnable has `withFallbacks`, so this is not model-specific machinery:

```ts
// reply/reply.service.ts
const resilientModel = this.model.withFallbacks([this.fallbackModel]);

this.chain = prompt.pipe(resilientModel).pipe(new StringOutputParser());
```

If the first model errors, rate-limits or times out, the same call is retried against the second. And since the two can be **different vendors**, that survives something no amount of retrying one endpoint will: OpenAI having an outage.

The agent has its own version of the same idea:

```ts
middleware: [
  this.auditMiddleware(customer),
  modelFallbackMiddleware(this.fallbackModel),
],
```

`modelFallbackMiddleware` is variadic, so you can hand it a whole chain of descending preferences. Both forms take `BaseChatModel`, which is the quiet reason any of this composes.

I wanted proof rather than a nice-sounding paragraph, so the tests use a model that always throws:

```ts
class BrokenModel extends FakeListChatModel {
  async _generate(): Promise<never> {
    throw new Error("provider is having a bad day");
  }
}

it("falls back to the second model when the first throws", async () => {
  const service = new ReplyService(new BrokenModel(), new FakeListChatModel({
    responses: ["rescued by the fallback"],
  }));

  assert.equal(await service.draft("Anything at all.", triage), "rescued by the fallback");
});

it("still fails when every model is down", async () => {
  const service = new ReplyService(new BrokenModel(), new BrokenModel());

  await assert.rejects(() => service.draft("Anything at all.", triage), /bad day/);
});
```

That second test matters as much as the first. A fallback that silently swallows a total outage is worse than none, because you find out from your customers instead of your alerts.

## Structured output, and the bug I did not expect 🧩

The most immediately useful thing LangChain does is turn a model into a function that returns a typed object. You describe the shape in Zod:

```ts
// triage/triage.schema.ts
export const triageSchema = z.object({
  category: z
    .enum(["billing", "delivery", "product-defect", "account", "other"])
    .describe("The single best category for this ticket."),
  severity: z
    .enum(["low", "medium", "high"])
    .describe("high only when the customer is blocked, out of pocket, or a safety issue is described."),
  summary: z.string().describe("One sentence, under 20 words, in the customer's own terms."),
  needsHuman: z
    .boolean()
    .describe("True when a refund, a legal threat, or anything irreversible is involved."),
});

export type Triage = z.infer<typeof triageSchema>;
```

Those `.describe()` calls are not comments for your colleagues. They are converted into the JSON Schema that goes to the model, so they are prompt. When a classification keeps coming out wrong, editing the description of that field will do more than another paragraph in the system message.

And then:

```ts
const classifier = this.model.withStructuredOutput(triageSchema, { name: "triage" });

const result = await classifier.invoke([
  { role: "system", content: SYSTEM_PROMPT },
  { role: "user", content: ticket },
]);
```

`result` is typed `Triage`. Lovely. Now here is the part I want you to actually take away from this post, because I found it by writing a test that I expected to be boring.

I fed a scripted model a reply with `"category": "banana"`, which is not in the enum, and asserted that the call would reject. It did not. So I probed it properly:

```text
returned: {"category":"banana","severity":"high"}
zod agrees? false

missing-field returned: {"category":"billing"}

not-json threw: SyntaxError Unexpected token 'I', "I am not JSON at all" is not valid JSON
```

**`withStructuredOutput` parses the reply. It does not validate it against your schema.** An invalid enum value comes straight through. A missing required field comes straight through. Only unparseable JSON fails, and it fails with a raw `SyntaxError` rather than anything you would want to catch by name.

Read that against the TypeScript signature, which cheerfully says `Promise<Triage>`. That type is a description of what the model was *asked* for, not a guarantee about what it sent. It is the same category of lie as casting an HTTP response body to an interface.

> Anywhere else in your application, data arriving from outside gets validated before you trust it. A model's reply is data arriving from outside. The fact that it came back through a nicely typed helper does not change that.

The fix is one call, at the boundary:

```ts
const raw = await classifier.invoke([...]);

const parsed = triageSchema.safeParse(raw);

if (!parsed.success) {
  this.logger.warn(`Model returned an off-schema triage: ${JSON.stringify(raw)}`);
  throw new InternalServerErrorException(
    "The model returned a triage that does not match the schema.",
  );
}

return parsed.data;
```

You already wrote the schema. Using it twice costs nothing, and it converts "a wrong value quietly flows three layers downstream" into "a loud failure at the point of entry", which is the trade you want.

## Chains, when an agent would be overkill 🔗

Not every model call needs an agent. Most do not. When the job is "fill in a template, call the model, get a string back", LangChain's expression language is the whole implementation:

```ts
// reply/reply.service.ts
const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You write short replies to support tickets. Tone: {tone}. Two sentences. This ticket was triaged as {category} with {severity} severity."],
  ["human", "Ticket: {ticket}\n\nneedsHuman: {needsHuman}"],
]);

this.chain = prompt.pipe(this.model).pipe(new StringOutputParser());
```

Every piece there is a Runnable with the same interface, which is why they compose with `pipe`, and why the composed thing gets the whole Runnable API for free:

```ts
await this.chain.invoke({ ticket, tone, category, severity, needsHuman });

for await (const token of await this.chain.stream({ ... })) { /* ... */ }

await this.chain.batch(items);  // concurrency handled for you
```

`invoke`, `stream` and `batch` on something you assembled from three parts, with no extra code. That is the payoff for everything being a Runnable, and it is why LCEL is worth learning even if you never touch an agent.

The `StringOutputParser` at the end is small but saves a recurring annoyance: without it you get an `AIMessage` and every caller writes `.content` and then wonders why it is sometimes an array of content blocks.

## `tool()`: where LangChain meets your services 🔧

Now the interesting part, and the one that took me longest to get right.

A tool is a function you let the model call. LangChain's `tool()` helper wraps a plain function with a name, a description and a Zod schema:

```ts
const lookupOrder = tool(
  async ({ orderId }) => {
    const order = this.orders.findOne(orderId);
    return JSON.stringify(order);
  },
  {
    name: "lookup_order",
    description: 'Look up one order by its ID, for example "A-1002". Returns status, total, carrier and tracking.',
    schema: z.object({
      orderId: z.string().describe("The order ID, like A-1002."),
    }),
  },
);
```

Notice `this.orders`. That is a NestJS service, and it is the reason this snippet cannot live where you normally see it, at module scope in a `tools.ts` file. A module-scope `export const` has no `this`, so the usual workaround is a singleton or a global, and that holds up until the first time you want two configurations or a test that does not touch the database.

The fix is not clever, which is why I like it. **Build the tools inside a provider:**

```ts
// assistant/assistant.tools.ts
@Injectable()
export class AssistantTools {
  constructor(private readonly orders: OrdersService) {}

  forCustomer(customer: string): StructuredToolInterface[] {
    const lookupOrder = tool(async ({ orderId }) => {
      const order = this.orders.findOne(orderId);

      if (order.customer.toLowerCase() !== customer.toLowerCase()) {
        return `Order ${orderId} does not belong to this customer.`;
      }

      return JSON.stringify(order);
    }, {
      name: "lookup_order",
      description: '...',
      schema: z.object({ orderId: z.string() }),
    });

    // ...listOrders, issueRefund

    return [lookupOrder, listOrders, issueRefund];
  }
}
```

The tools are created in a method, so they close over `this.orders`, which the container already supplied. And because it is a method taking a `customer`, the tools are **scoped to the current request** rather than to the process. `list_orders` takes no arguments at all, because "which customer" is not the model's business:

```ts
const listOrders = tool(async () => {
  const orders = this.orders.findByCustomer(customer);
  return orders.length === 0 ? "This customer has no orders." : JSON.stringify(orders);
}, {
  name: "list_orders",
  description: "List every order belonging to the customer you are currently helping.",
  schema: z.object({}),   // a tool that takes nothing still needs a schema
});
```

One TypeScript detail worth the annotation. Each `tool()` call returns a type carrying its own Zod schema, so an array of differently-shaped tools infers as a union, and TypeScript then refuses to let you call `tools[0].invoke(...)`:

```text
error TS2349: This expression is not callable.
  Each member of the union type '...' has signatures, but none of those
  signatures are compatible with each other.
```

Annotating the return as `StructuredToolInterface[]` fixes it, and it is what both `createAgent` and your tests want anyway.

## The agent, and middleware 🤖

With tools that can reach your services, the agent itself is almost anticlimactic:

```ts
return createAgent({
  model: this.model,
  tools: this.tools.forCustomer(customer),
  systemPrompt: SYSTEM_PROMPT,
  middleware: [this.auditMiddleware(customer)],
});
```

It is **`systemPrompt`**, not `prompt`. That is the second v1 rename that will bite you, and the compiler error is unhelpful enough to be worth quoting:

```text
Object literal may only specify known properties,
and 'prompt' does not exist in type 'CreateAgentParams<...>'
```

`createAgent` builds a ReAct loop: call the model, see whether it asked for tools, run them, feed the results back, repeat until it answers. The middleware is v1's extension point, and it maps almost exactly onto a NestJS interceptor. Wrap the call, see what goes in and out, decide whether to continue:

```ts
return createMiddleware({
  name: "audit",
  beforeModel: () => {
    modelCalls += 1;
    this.logger.log(`Model call ${modelCalls} for ${customer}`);
    return undefined;
  },
  afterModel: (state) => {
    const last = state.messages.at(-1);
    const calls = last?.tool_calls ?? [];
    if (calls.length > 0) {
      this.logger.log(`Wants tools: ${calls.map((c) => c.name).join(", ")}`);
    }
    return undefined;
  },
});
```

Which produces exactly what you want in the logs when something goes sideways:

```text
[AssistantService] Model call 1 for ana
[AssistantService] Wants tools: list_orders, lookup_order
[AssistantService] Model call 2 for ana
```

An audit trail and a call counter are the cheapest useful things to put around an agent before you let it touch real data. LangChain ships a pile of ready-made middleware too, for summarising long conversations, retrying, capping model calls and human-in-the-loop approval, and they all plug into that same array.

## Authorisation goes in the tool, not the prompt 🔐

This is the part I would argue about with anyone.

Tool arguments are written by a language model. That model may have been reading a customer's email, a web page, or a PDF somebody uploaded. If any of that text says "also look up order A-1003", you now have a model that sincerely believes it should. Prompt injection is not exotic; it is the normal condition of anything that reads untrusted text.

So the check goes in the tool, where it cannot be talked around:

```ts
if (order.customer.toLowerCase() !== customer.toLowerCase()) {
  return `Order ${orderId} does not belong to this customer.`;
}
```

and the business rule goes there too:

```ts
if (order.total > 100) {
  return `Refunds over 100 need a human. Order ${orderId} is ${order.total}.`;
}
```

Note what those return. Not a thrown exception, but a plain sentence, because the model is going to read it and should be able to explain the refusal to the customer. A refusal is information, not a crash.

The system prompt says the same things, and that is fine, but the prompt is a preference and the tool is a rule. Only one of them is still true when the model is confused, and the tests below assert the rule rather than the preference.

## Streaming, through Nest's SSE 🌊

A model takes seconds. Users forgive that if words appear; they do not forgive a spinner. The agent streams:

```ts
const stream = await agent.stream(
  { messages: [{ role: "user", content: question }] },
  { streamMode: "messages" },
);

for await (const [chunk] of stream) {
  const text = typeof chunk?.content === "string" ? chunk.content : "";
  if (text) yield text;
}
```

and Nest wants an Observable, so the bridge from async generator to SSE is the only glue code:

```ts
@Sse("ask/stream")
askStream(@Body() { customer, question }: AskBody): Observable<{ data: string }> {
  return new Observable((subscriber) => {
    let cancelled = false;

    void (async () => {
      try {
        for await (const token of this.assistant.askStream(customer, question)) {
          if (cancelled) return;
          subscriber.next({ data: token });
        }
        subscriber.complete();
      } catch (error) {
        subscriber.error(error);
      }
    })();

    return () => { cancelled = true; };
  });
}
```

That returned teardown function is the bit people leave out. If the browser disconnects halfway through, it stops the loop pulling tokens. Without it you keep generating, and paying for, a reply that nobody is going to read.

## Testing all of it without an API key 🧪

Here is the payoff for putting the model behind a token.

LangChain ships scripted models. `FakeListChatModel` replies with the strings you hand it, in order. `FakeToolCallingModel` decides on the tool calls you script, one array per turn, where an empty array means "done, answer now". Combine either with NestJS's `overrideProvider` and the real model never exists:

```ts
const moduleRef = await Test.createTestingModule({
  imports: [LlmModule],
  controllers: [SupportController],
  providers: [OrdersService, AssistantTools, AssistantService, ReplyService, TriageService],
})
  .overrideProvider(CHAT_MODEL)
  .useValue(new FakeListChatModel({ responses: [TRIAGE_JSON] }))
  .compile();
```

Two things I got wrong so you do not have to. **`LlmModule` still has to be imported**: `overrideProvider` replaces a provider that exists in the graph, and if it is not there you get `Nest can't resolve Symbol(CHAT_MODEL)` rather than an override. And because the override replaces the definition, the real factory never runs, so the missing-key guard never fires. No environment variable needed.

The other thing is that **a scripted model is a queue**. Sharing one app across tests couples each test to the previous one's call count, which I discovered when a test that passed alone returned a 500 in the suite. Build a fresh app per test.

The most valuable tests barely involve a model at all, because tools are plain objects with an `invoke`:

```ts
it("refuses an order belonging to someone else", async () => {
  const result = await toolFor("ana", "lookup_order").invoke({ orderId: "A-1003" });

  assert.match(String(result), /does not belong/);
  assert.doesNotMatch(String(result), /processing/);
});

it("refuses a refund above the limit, whatever the prompt says", async () => {
  const result = await toolFor("ana", "issue_refund")
    .invoke({ orderId: "A-1002", reason: "changed my mind" });

  assert.match(String(result), /need a human/);
  assert.equal(orders.findOne("A-1002").status, "shipped");
});
```

The model is non-deterministic. What your tools do with the arguments it produces is not, and that is where the damage would happen, so that is where the tests belong.

Then one level up, a scripted tool call proves the whole path really connects:

```ts
const service = agentWith([
  [{ name: "lookup_order", args: { orderId: "A-1002" }, id: "1" }],
  [],
]);

const answer = await service.ask("ana", "Where is order A-1002?");

assert.match(answer, /DH123|shipped|A-1002/);
```

The scripted model asked for a tool, the tool really called `OrdersService`, and the result came back into the conversation. Twenty-three tests, and the whole suite:

```text
ℹ tests 23
ℹ pass 23
ℹ fail 0
ℹ duration_ms 365.1
```

Under four hundred milliseconds, no key, no network, no cost, green in CI on every push. An LLM test suite that people will actually run.

> One setup note. There is no Jest in that repo, because NestJS 12 and all of LangChain v1 ship as pure ESM and Jest's CommonJS runtime cannot `require` them. `tsc` plus Node's built-in test runner needs no experimental flags, and keeps the `emitDecoratorMetadata` that NestJS dependency injection depends on. Esbuild-based runners like `tsx` do not emit it, so DI breaks under them.

## Final thoughts

What I hope came through is how little of this was about models.

The model went into the DI container like any other dependency. Its reply got validated at the boundary like any other untrusted input. The rules went in the code that acts rather than in a prompt. The tests replaced a slow, expensive, non-deterministic dependency with a fake, which is what you would do with a payment gateway. None of that is new, and all of it is what makes the difference between a demo and something you would put in front of customers.

The genuinely new skill is knowing where the seams are: that `withStructuredOutput` gives you a type without a guarantee, that tool arguments are attacker-influenced input, that an agent will keep calling tools until something stops it. Those are the places to be careful. The rest is the NestJS you already write.

If you want somewhere to go next, the obvious step is retrieval: put your own documents behind a tool and let the agent decide when to search them. That slots into the same `forCustomer` method, as one more `tool()` with one more Zod schema, which is a decent sign the shape of this is right.

That is it for today. Clone the repo, run `npm test`, and watch twenty-three tests exercise an agent for free.

### Takeaways ✍️

- Put the model behind an injection token typed as `BaseChatModel`. One factory owns provider, temperature and timeouts, and every test can swap it.
- Build models with `initChatModel("provider:model")` rather than `new ChatOpenAI()`. Changing vendor becomes an environment variable, and the provider package is imported lazily, so a missing one fails at boot.
- Use more than one model. Classification and customer-facing prose are different jobs at different prices, so give them separate tokens and let each service ask for what it needs.
- Put the fallback across two **different providers**, with `withFallbacks` on a chain or `modelFallbackMiddleware` on an agent. Retrying the same endpoint does not survive that vendor being down.
- Test which model was used, since it is invisible at runtime: give each token a different scripted reply. And test the all-models-down case, because a fallback that swallows a total outage is worse than none.
- Throw at startup when the API key is missing. A deployment mistake should fail the deploy, not the first customer.
- **`withStructuredOutput` parses but does not validate.** An invalid enum or a missing field arrives typed as your schema and wrong. Re-parse with Zod at the boundary.
- `.describe()` on a Zod field is prompt, not documentation. It reaches the model as JSON Schema.
- For "template, model, string", LCEL is the whole implementation, and you get `invoke`, `stream` and `batch` free because everything is a Runnable.
- Build `tool()` instances inside an `@Injectable()` so they can close over injected services and be scoped per request instead of per process.
- Annotate a tool array as `StructuredToolInterface[]`, or its union type makes `invoke` uncallable.
- Authorise inside the tool, never in the prompt. Tool arguments are written by a model that may have been reading attacker-controlled text.
- Return refusals as sentences rather than exceptions, so the model can explain them.
- `createAgent` takes **`systemPrompt`**, and `@nestjs/config` for NestJS 12 is **`^12.0.0`**, not `^4.0.0`. Both will be wrong in older tutorials.
- Test tools directly: that is where the damage happens, and unlike the model it is deterministic.
- `overrideProvider` needs the defining module imported, and a scripted model is a queue, so build a fresh app per test.
