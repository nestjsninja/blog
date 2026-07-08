---
title: >-
  Mocking External APIs in NestJS (Part 2): Stateful Scenarios and Fault
  Injection with WireMock
excerpt: >-
  Part 2 of mocking external APIs: the same NestJS backend, now pointed at
  WireMock in Docker. File-based stubs, a stateful scenario that starts
  returning 429 after three calls, runtime switching through the __admin API,
  and network-level faults like connection resets and malformed responses.
date: "2026-07-15T12:00:00.000Z"
author:
  name: Henrique Weiand
  picture: /nestjs-ninja.png
tags:
  - NestJS
  - TypeScript
  - Software Development
  - Testing
  - Mocks
  - API
  - WireMock
  - Docker
coverImage: /
ogImage:
  url: /
---

Hello, dev!

In the [previous post](https://nestjs-ninja.com/blog/2026-07-08-mocking-external-apis-in-nestjs-with-mockoon/) we took a NestJS backend that depends on a fictional payment provider (AcmePay), isolated the provider behind a requester service, and ran the whole app against a Mockoon mock that could simulate 500s, 403s, 429 rate limiting, and slow responses — all triggered on demand.

And it ended with an honest limitation: Mockoon's response rules are **stateless**. Each request is judged on its own, so "return 429 when this header is present" is easy, but "return 200 three times and _then_ start throttling" is not expressible. Neither is "drop the TCP connection halfway through the response", because that is not an HTTP response at all.

Today we pick up exactly there. Same backend, same env var, different mock: [WireMock](https://wiremock.org/). What we gain:

- **stateful scenarios** — the mock remembers previous calls;
- **runtime control** — switch scenarios with an HTTP call to an admin API, no restarts;
- **fault injection** — connection resets, empty replies, malformed bytes;
- and a bonus: the mock doubles as a **spy** that records everything your backend sent.

If you have not read part 1, I recommend starting there, because we reuse the exact same backend and only swap the mock underneath it.

💻 The full, runnable example is on GitHub: [nestjsninja/nestjs-mocking-external-apis-wiremock](https://github.com/nestjsninja/nestjs-mocking-external-apis-wiremock). One heads-up: WireMock runs on the JVM through Docker, so the StackBlitz embed on this one opens the code for browsing rather than running — clone it locally to play.

## Recap: one env var away from any mock 🧱

The reason this post can say "same backend, zero code changes" is the requester pattern from part 1. Every call to AcmePay goes through one service, failures are normalized into one `ExternalApiError`, and — the part that matters today — the base URL comes from config:

```ts
// src/acmepay/acmepay.config.ts
export const acmepayConfig = registerAs("acmepay", () => ({
  baseUrl: process.env.ACMEPAY_BASE_URL ?? "http://localhost:3010",
  apiKey: process.env.ACMEPAY_API_KEY ?? "test_key_123",
  timeoutMs: parseInt(process.env.ACMEPAY_TIMEOUT_MS ?? "2000", 10),
}));
```

Mockoon listened on `:3010`. WireMock will listen on `:3010`. The backend cannot tell the difference, and that is the whole point.

> Mock #2 costs nothing, because the backend never knew which mock it was talking to.

## Running WireMock with Docker 🐳

WireMock is a Java server, and the friendly way to run it is the official Docker image:

```yaml
# docker-compose.yml
services:
  wiremock:
    image: wiremock/wiremock:3.13.0
    ports:
      - "3010:8080"
    volumes:
      - ./wiremock:/home/wiremock
    command: ["--verbose", "--global-response-templating"]
```

The volume is where the mock lives, and it follows a two-folder convention:

```text
wiremock/
  mappings/   # stubs: request matching + response definitions (JSON)
  __files/    # response bodies referenced by the stubs
```

`--global-response-templating` turns on Handlebars templating in every response, which we will use to echo request data back. Start it with `npm run mock` (an alias for `docker compose up wiremock`), run `npm run start:dev` in another terminal, and the same `.env` from part 1 does the rest.

## Stubs as files: the happy path 📦

Where Mockoon has a GUI, WireMock has JSON files — one stub per file (or several per file, as we will see with scenarios). This is the happy path for creating a charge:

```json
// wiremock/mappings/charges-create-ok.json
{
  "priority": 10,
  "request": {
    "method": "POST",
    "urlPath": "/v1/charges"
  },
  "response": {
    "status": 201,
    "headers": { "Content-Type": "application/json" },
    "body": "{\n  \"id\": \"ch_{{randomValue length=16 type='ALPHANUMERIC'}}\",\n  \"status\": \"succeeded\",\n  \"amount\": {{jsonPath request.body '$.amount'}},\n  \"currency\": \"{{jsonPath request.body '$.currency'}}\",\n  \"customerId\": \"{{jsonPath request.body '$.customerId'}}\",\n  \"createdAt\": \"{{now}}\"\n}"
  }
}
```

Two things to notice. First, `{{jsonPath request.body '$.amount'}}` reads the incoming JSON and echoes it back, and `{{randomValue ...}}` generates a fresh charge id per call — the same "feels like a real API" tricks we used in Mockoon, just with WireMock's helpers. Second, the `priority` field: **lower number wins**. Happy-path stubs sit at 10 so that scenario stubs (5) and the auth guard (1) can shadow them.

For `GET /v1/charges/:id` the body lives in `__files/charge.json`, and because global templating is on, even body files can template:

```json
// wiremock/__files/charge.json
{
  "id": "{{request.pathSegments.[2]}}",
  "status": "succeeded",
  "amount": 4990,
  "currency": "EUR",
  "customerId": "cus_1",
  "createdAt": "{{now}}"
}
```

`request.pathSegments.[2]` is the third path segment — the id — so `GET /payments/ch_wm42` through the backend answers with `"paymentId": "ch_wm42"`. Small detail, huge difference when you are clicking through a frontend wired to this mock.

> In WireMock the mock is a folder of JSON files. It reviews like code, diffs like code, and ships in the repo like code.

## Error responses: 500, 403, and a missing token 🚨

The header-driven scenarios from part 1 translate one-to-one. A stub only matches when the `x-mock-scenario` header says so:

```json
// wiremock/mappings/charges-create-500.json
{
  "priority": 5,
  "request": {
    "method": "POST",
    "urlPath": "/v1/charges",
    "headers": { "x-mock-scenario": { "equalTo": "server-error" } }
  },
  "response": {
    "status": 500,
    "headers": { "Content-Type": "application/json" },
    "jsonBody": {
      "error": {
        "type": "api_error",
        "message": "Something went wrong on AcmePay's side."
      }
    }
  }
}
```

And the "you forgot the token" guard from part 1 becomes a priority-1 stub with an `absent` matcher covering the whole API surface:

```json
// wiremock/mappings/auth-missing-401.json
{
  "priority": 1,
  "request": {
    "urlPathPattern": "/v1/.*",
    "headers": { "Authorization": { "absent": true } }
  },
  "response": {
    "status": 401,
    "jsonBody": {
      "error": {
        "type": "authentication_error",
        "message": "No API key provided."
      }
    }
  }
}
```

Through the backend, the results match part 1 exactly — provider 500/403 come out as our 502, courtesy of the same `ExternalApiErrorFilter`:

```bash
curl -s -w '\n[%{http_code}]\n' -X POST -H 'content-type: application/json' \
  -H 'x-mock-scenario: server-error' \
  -d '{"amount":100,"currency":"EUR","customerId":"cus_1"}' \
  http://localhost:3000/payments
```

```json
{"statusCode":502,"message":"The payment provider rejected the request."}
[502]
```

## Stateful scenarios: a 429 that kicks in after three calls ⛔

Here is the section this whole post exists for. A real rate limit is not a header you send — it is a **budget you spend**. The first calls succeed, and then the provider cuts you off. WireMock models this with _scenarios_: named state machines where each stub can require a state and transition to another.

Our `rate-limit` scenario walks through `Started → ok-2 → ok-1 → Throttled`. Three stubs answer 201 and step the state forward; the fourth answers 429 and stays put. They all live in one file:

```json
// wiremock/mappings/scenario-rate-limit.json (abridged)
{
  "mappings": [
    {
      "priority": 4,
      "scenarioName": "rate-limit",
      "requiredScenarioState": "Started",
      "newScenarioState": "ok-2",
      "request": {
        "method": "POST",
        "urlPath": "/v1/charges",
        "headers": { "x-mock-scenario": { "equalTo": "rate-limit" } }
      },
      "response": { "status": 201, "body": "{ ...same templated charge... }" }
    },
    { "...": "ok-2 -> ok-1 and ok-1 -> Throttled look identical" },
    {
      "priority": 4,
      "scenarioName": "rate-limit",
      "requiredScenarioState": "Throttled",
      "request": {
        "method": "POST",
        "urlPath": "/v1/charges",
        "headers": { "x-mock-scenario": { "equalTo": "rate-limit" } }
      },
      "response": {
        "status": 429,
        "headers": { "Retry-After": "30" },
        "jsonBody": {
          "error": {
            "type": "rate_limit_error",
            "message": "Too many requests. Slow down."
          }
        }
      }
    }
  ]
}
```

Now hammer the backend five times:

```bash
for i in 1 2 3 4 5; do
  curl -s -o /dev/null -w '%{http_code} ' -X POST \
    -H 'content-type: application/json' -H 'x-mock-scenario: rate-limit' \
    -d '{"amount":100,"currency":"EUR","customerId":"cus_1"}' \
    http://localhost:3000/payments
done; echo
```

```text
201 201 201 429 429
```

That is a provider quota, reproduced on your laptop. This is the setup where you can _actually_ develop and test backoff logic, circuit breakers, or queue-based retry — behaviors that only make sense across a sequence of calls, which is exactly what stateless rules could not give us.

> A WireMock scenario is a tiny state machine. Every request can move it forward, so the mock finally remembers what you did to it.

## Driving the mock at runtime: the \_\_admin API 🎛️

Everything WireMock does is also exposed as a REST API under `/__admin`, and this changes how it feels to use. You do not restart anything; you _talk_ to the mock:

```bash
# reset all scenarios back to Started
curl -X POST http://localhost:3010/__admin/scenarios/reset

# or jump straight into the throttled state — no need to spend the three calls
curl -X PUT http://localhost:3010/__admin/scenarios/rate-limit/state \
  -H 'content-type: application/json' -d '{"state":"Throttled"}'
```

You can even inject a brand-new stub with no file edits at all — here is a temporary "everything is on fire" toggle:

```bash
# every charge creation now fails, priority 1 shadows everything
curl -X POST http://localhost:3010/__admin/mappings \
  -H 'content-type: application/json' \
  -d '{"priority":1,"request":{"method":"POST","urlPath":"/v1/charges"},"response":{"status":500,"jsonBody":{"error":{"type":"api_error","message":"chaos"}}}}'

# and when you are done, restore the file-based stubs
curl -X POST http://localhost:3010/__admin/mappings/reset
```

The part I use constantly: the **request journal**. WireMock records every request it receives, so the mock is also a spy on your backend:

```bash
curl -s 'http://localhost:3010/__admin/requests?limit=1'
```

Did the requester actually send the `Authorization: Bearer` header? Is the body shaped the way the provider expects? You stop guessing and look. In e2e tests, the journal is how you assert "our backend called the provider exactly once, with this payload".

> The admin API turns the mock from a config file into an instrument: set state, inject failures, and read back what your app really sent.

## Fault injection: when the network itself breaks 🔥

An HTTP 500 is a _polite_ failure — the provider still answered you with a well-formed response. Networks are not polite. Connections die mid-request, load balancers return zero bytes, proxies truncate bodies. WireMock simulates these with `fault` responses:

```json
// wiremock/mappings/faults.json (abridged)
{
  "mappings": [
    {
      "priority": 5,
      "request": {
        "method": "POST",
        "urlPath": "/v1/charges",
        "headers": { "x-mock-scenario": { "equalTo": "connection-reset" } }
      },
      "response": { "fault": "CONNECTION_RESET_BY_PEER" }
    },
    { "scenario 'malformed'": { "fault": "MALFORMED_RESPONSE_CHUNK" } },
    { "scenario 'empty'": { "fault": "EMPTY_RESPONSE" } }
  ]
}
```

Note there is no `status` — a fault replaces the response entirely. Through the backend, all three surface as errors with **no HTTP status code**: axios reports `ECONNRESET` or a parse failure, the requester wraps it in an `ExternalApiError` with `code: undefined`, and the filter maps "no response at all" to a 504:

```bash
curl -s -w '\n[%{http_code}]\n' -X POST -H 'content-type: application/json' \
  -H 'x-mock-scenario: connection-reset' \
  -d '{"amount":100,"currency":"EUR","customerId":"cus_1"}' \
  http://localhost:3000/payments
```

```json
{"statusCode":504,"message":"The payment provider did not answer in time."}
[504]
```

If your error handling has a branch for `err.response?.status` and nothing else, faults are the tests that expose it. This is the category Mockoon simply does not cover, and in my experience it is the category that causes the 3 a.m. incidents.

> An HTTP 500 is a polite failure. Networks are not polite — test the impolite ones too.

## Latency: fixed delays and dribbles 🐌

Latency works like part 1 — the `slow` scenario delays `GET /v1/balance` past our 2-second axios timeout — just declared on the stub:

```json
// wiremock/mappings/balance-slow.json (response part)
{
  "status": 200,
  "bodyFileName": "balance.json",
  "fixedDelayMilliseconds": 5000
}
```

The backend gives up at ~2s with a 504, same as before. WireMock goes further when you need it: `chunkedDribbleDelay` trickles the response out in pieces (great for testing streaming and body-timeout handling), and `POST /__admin/settings` can add a global delay to _every_ stub — a one-liner "the provider is having a bad day" switch for the whole API.

## Mockoon or WireMock? 🤔

I would not frame it as a competition; after building the same mock twice, this is how I split them:

- **Runtime**: Mockoon is Node (`@mockoon/cli` from npm, StackBlitz-friendly); WireMock is Java in Docker.
- **Authoring**: Mockoon has the GUI and one exported JSON; WireMock is JSON files by hand — less friendly to start, friendlier to code-review.
- **State**: Mockoon rules are stateless; WireMock scenarios are state machines.
- **Faults**: only WireMock can reset connections and send malformed bytes.
- **Runtime control**: WireMock's `__admin` API (switch state, inject stubs, read the journal) has no Mockoon equivalent.
- **In tests**: the journal makes WireMock a natural fit for e2e assertions about _what your backend sent_.

My rule of thumb: **Mockoon for everyday local development** — fast, visual, zero infrastructure; **WireMock when the failure you are chasing has memory or lives below HTTP** — quotas, retries, circuit breakers, chaos. The requester pattern makes the choice cheap to revisit: both mocks sit behind the same env var, and switching is a `docker compose up` away.

## Final thoughts

Across the two posts, the theme did not change: if you cannot trigger a failure, you have never tested how you handle it. Part 1 gave us the pattern (requester service, env-driven base URL, one domain error, one filter) and a friendly mock for responses, errors, and latency. Part 2 added the failures with memory — quotas that run out, connections that die, and an admin API to orchestrate all of it.

The examples here are a payment provider, but nothing is payment-specific. A POS system, a shipping API, an identity provider — the recipe is identical: isolate, configure, normalize, and then make your mock as hostile as the real world.

### Takeaways ✍️

- The requester pattern pays again: swapping Mockoon for WireMock needed zero backend changes.
- WireMock stubs are JSON files in `wiremock/mappings`, with `priority` deciding who wins (lower first).
- Response templating (`jsonPath`, `randomValue`, `pathSegments`) makes canned responses feel like a live API.
- Scenarios are state machines: model "429 after three calls" and finally test backoff and circuit breakers.
- The `__admin` API sets scenario states, injects stubs on the fly, and records every request (mock as spy).
- Faults (`CONNECTION_RESET_BY_PEER`, `EMPTY_RESPONSE`, `MALFORMED_RESPONSE_CHUNK`) test the code path where there is no HTTP status at all.
- `fixedDelayMilliseconds` per stub, dribbled chunks, or a global delay simulate slow providers.
- Mockoon for everyday dev; WireMock when failures need state, faults, or runtime control.
