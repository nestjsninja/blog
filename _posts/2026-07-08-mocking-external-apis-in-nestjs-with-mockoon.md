---
title: >-
  Mocking External APIs in NestJS (Part 1): Errors, Rate Limits, and Latency
  with Mockoon
excerpt: >-
  Your backend depends on a third-party API you cannot control. We build a
  requester pattern where the provider base URL is a single env var, then point
  the whole app at a Mockoon mock that simulates happy paths, 500s, 403s, 429
  rate limiting, and slow responses — with the GUI and @mockoon/cli.
date: '2026-07-08T12:00:00.000Z'
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
  - Mockoon
coverImage: /blog-assets/mocking-external-apis-in-nestjs-with-mockoon/cover.png
ogImage:
  url: /blog-assets/mocking-external-apis-in-nestjs-with-mockoon/cover.png
---
Hello, dev!

Almost every backend I have worked on depends on at least one API that belongs to someone else: a payment provider, a POS system, a shipping carrier, a CRM. And sooner or later the same problems show up. The provider's sandbox is down exactly when you want to demo. You cannot force it to return a 500 to see what your error handling does. You have no idea how your app behaves when the provider starts rate limiting you, because you (hopefully) never hit the limit in development. And running a load test against someone else's sandbox is a great way to get your credentials blocked.

The uncomfortable truth is this: if you cannot trigger a failure, you have never really tested how your backend handles it.

So today we are going to fix that. We will run a NestJS backend against a **mock of the external API**, and make that mock fail on demand: error responses, rate limiting, slow answers. The mock is [Mockoon](https://mockoon.com/) — a free tool with a GUI for designing the mock and a CLI for running it headlessly, locally and in CI.

💻 The full, runnable example is on GitHub: [nestjsninja/nestjs-mocking-external-apis-mockoon](https://github.com/nestjsninja/nestjs-mocking-external-apis-mockoon).

## The problem: your backend depends on someone else's API 🌍

For the example, our backend integrates with a fictional payment provider called **AcmePay**. It is a classic REST API with a bearer token:

| Endpoint              | What it does    |
| --------------------- | --------------- |
| `POST /v1/charges`    | create a charge |
| `GET /v1/charges/:id` | fetch a charge  |
| `POST /v1/refunds`    | refund a charge |
| `GET /v1/balance`     | account balance |

Our NestJS app exposes its own `/payments` endpoints and calls AcmePay behind the scenes. What we want to simulate, without touching AcmePay at all:

- **normal responses**, so the app runs fully offline;
- **error responses**: 500s and 403s;
- **blocks**: 429 rate limiting with a `Retry-After` header;
- **latency**: a response that takes 5 seconds when our timeout is 2.

> You cannot test error handling you cannot trigger. A mock gives you the trigger.

## The requester pattern 🧱

Before the mock, let's look at how the backend talks to AcmePay, because the way you structure this code decides how easy the mocking will be. I like to isolate every external API behind a **requester service**: one class whose only job is to send HTTP requests to that provider. The pattern has three pieces.

The first piece is a domain error. Whatever goes wrong with the provider — a 500, a timeout, nonsense in the body — the rest of the app only ever sees this:

```ts
// src/common/external-api.error.ts
export class ExternalApiError extends Error {
  readonly url: string;
  readonly code?: number; // upstream HTTP status; undefined = no response at all
  readonly retryAfter?: string;

  constructor({ url, message, code, retryAfter }: ExternalApiErrorPayload) {
    super(message ?? `External API call to [${url}] failed`);
    this.name = ExternalApiError.name;
    this.url = url;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}
```

The second piece is an abstract base requester. It owns the transport concerns: auth header, JSON headers, timing logs, and the error normalization. Concrete requesters never touch axios errors directly:

```ts
// src/common/base-requester.service.ts
@Injectable()
export abstract class BaseRequesterService {
  protected readonly logger = new Logger(this.constructor.name);

  protected constructor(
    protected readonly httpService: HttpService,
    protected readonly tokenProvider: TokenProvider,
  ) {}

  protected async _fetch<T>(
    endpointSpec: EndpointSpec,
    data?: unknown,
  ): Promise<T> {
    const token = await this.tokenProvider.getToken();
    const headers = {
      Authorization: token ? `Bearer ${token}` : undefined,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...endpointSpec.headers,
    };

    const { url, method, apiSpec } = endpointSpec;

    const response = await this.httpService
      .axiosRef({
        url,
        baseURL: apiSpec.baseUrl,
        method,
        headers,
        data,
        timeout: apiSpec.timeoutMs,
      })
      .catch((err) => {
        throw new ExternalApiError({
          url,
          message: err.response?.data
            ? JSON.stringify(err.response.data)
            : err.message,
          code: err.response?.status,
          retryAfter: err.response?.headers?.["retry-after"],
        });
      });

    return response.data;
  }
}
```

Notice the `baseURL` does not live in the code. It comes from `apiSpec`, and `apiSpec` comes from configuration. That is the third piece, and it is the one that makes this whole post work:

```ts
// src/acmepay/acmepay.config.ts
export const acmepayConfig = registerAs("acmepay", () => ({
  baseUrl: process.env.ACMEPAY_BASE_URL ?? "http://localhost:3010",
  apiKey: process.env.ACMEPAY_API_KEY ?? "test_key_123",
  timeoutMs: parseInt(process.env.ACMEPAY_TIMEOUT_MS ?? "2000", 10),
}));
```

The concrete requester extends the base, injects the config with `@Inject(acmepayConfig.KEY)`, and exposes one typed method per endpoint:

```ts
// src/acmepay/acmepay-requester.service.ts
@Injectable()
export class AcmePayRequesterService extends BaseRequesterService {
  constructor(
    httpService: HttpService,
    authService: AcmePayAuthService,
    @Inject(acmepayConfig.KEY)
    private readonly config: AcmePayConfig,
  ) {
    super(httpService, authService);
  }

  async createCharge(data: CreateChargeRequest): Promise<Charge> {
    return this._fetch<Charge>(
      { apiSpec: this.config, method: "POST", url: "/v1/charges" },
      data,
    );
  }

  async getBalance(): Promise<Balance> {
    return this._fetch<Balance>({
      apiSpec: this.config,
      method: "GET",
      url: "/v1/balance",
    });
  }

  // getCharge, createRefund...
}
```

And on the way out, a global exception filter is the single place where "the provider failed" becomes an HTTP answer for **our** clients:

```ts
// src/common/external-api-error.filter.ts
@Catch(ExternalApiError)
export class ExternalApiErrorFilter implements ExceptionFilter {
  catch(exception: ExternalApiError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception.code === 429) {
      if (exception.retryAfter)
        response.setHeader("Retry-After", exception.retryAfter);
      return response.status(429).json({
        statusCode: 429,
        message: "The payment provider is throttling us. Please retry shortly.",
      });
    }

    if (exception.code) {
      // A provider 401/403 is OUR misconfiguration, not the client's fault.
      return response.status(502).json({
        statusCode: 502,
        message: "The payment provider rejected the request.",
      });
    }

    // No status at all: timeout, connection reset, malformed response...
    return response.status(504).json({
      statusCode: 504,
      message: "The payment provider did not answer in time.",
    });
  }
}
```

We talked about this error-translation idea in the [architecture post](https://nestjs-ninja.com/blog/2026-06-01-nestjs-architecture-dtos-services-transactions-and-boundaries/): domain errors inside, HTTP at the edge. Here it pays off twice, because every failure the mock simulates will flow through this exact filter — which is precisely the code we want to exercise.

> When the base URL lives in config, pointing your whole backend at a mock is a one-line .env change. No test-only branches in the code.

## Meet Mockoon 🎭

[Mockoon](https://mockoon.com/) is a desktop app where you design a mock API visually: an _environment_ (one fake API on one port) containing _routes_, and each route can have **several responses**. That last part is the feature we care about — one route, many possible answers, and rules that decide which one is served.

You define the four AcmePay endpoints, give each a realistic JSON body, and Mockoon even templates dynamic values with Handlebars helpers:

```json
{
  "id": "ch_{{faker 'string.alphanumeric' 16}}",
  "status": "succeeded",
  "amount": {{body 'amount'}},
  "currency": "{{body 'currency'}}",
  "customerId": "{{body 'customerId'}}",
  "createdAt": "{{now}}"
}
```

`{{body 'amount'}}` echoes back whatever the backend sent, `{{faker ...}}` generates a fresh id per call, and `GET /v1/charges/:id` can answer with `"id": "{{urlParam 'id'}}"` so the response always matches the request. Small details, but they make the mock feel like a real API instead of a static fixture.

The part I like most: the whole environment exports to a **single JSON file** that you commit to the repo — `mockoon/acmepay-mock.json` in our example. Anyone on the team opens it in the GUI to edit, and the CLI runs the same file headlessly:

```bash
npm install --save-dev @mockoon/cli concurrently
```

```json
// package.json (scripts)
{
  "mock": "mockoon-cli start --data ./mockoon/acmepay-mock.json --port 3010",
  "dev": "concurrently -n mock,api -c blue,green \"npm run mock\" \"npm run start:dev\""
}
```

> The mock definition is code: one JSON file in the repo, edited in a GUI, executed by a CLI. Everyone runs the same fake provider.

## Pointing the backend at the mock 🔌

This is the anticlimax of the post, and that is the point:

```bash
# .env
ACMEPAY_BASE_URL=http://localhost:3010
ACMEPAY_API_KEY=test_key_123
ACMEPAY_TIMEOUT_MS=2000
```

Run `npm run dev` and both processes come up: the mock on `:3010`, the API on `:3000`. The backend has no idea it is talking to a fake:

```bash
curl -s -w '\n[%{http_code}]\n' -X POST -H 'content-type: application/json' \
  -d '{"amount":4990,"currency":"EUR","customerId":"cus_1"}' \
  http://localhost:3000/payments
```

```json
{"paymentId":"ch_X5m8rUiazFGxgcwL","status":"succeeded","amount":4990,"currency":"EUR"}
[201]
```

A full checkout flow — charge, fetch, refund, balance — works offline, with realistic ids, echoed amounts, and fresh timestamps. That alone is already worth the setup: no more "the sandbox is down" mornings.

## Simulating errors: 500 and 403 🚨

Now the fun part. In Mockoon, every response can carry **rules**: serve this response only when a header, query param, body field, or route param matches something. When no rule matches, the response marked as _default_ is served.

For the demo I use a header called `x-mock-scenario`. The route `POST /v1/charges` gets extra responses:

- status `500`, rule: header `x-mock-scenario` equals `server-error`;
- status `403`, rule: header `x-mock-scenario` equals `forbidden`;
- and one more with a rule of type "header `Authorization` is null" that answers `401` — so if your requester ever forgets the token, the mock behaves like the real provider would.

To steer the mock through the backend, the example app forwards the `x-mock-scenario` header down to the requester. Let me be explicit about this: it is a **demo-only passthrough**, a couple of lines guarded by nothing because the repo is a playground. In a real project you would drive scenarios by editing the mock file, not by forwarding client headers through production code.

```bash
curl -s -w '\n[%{http_code}]\n' -X POST -H 'content-type: application/json' \
  -H 'x-mock-scenario: server-error' \
  -d '{"amount":4990,"currency":"EUR","customerId":"cus_1"}' \
  http://localhost:3000/payments
```

```json
{"statusCode":502,"message":"The payment provider rejected the request."}
[502]
```

Look at what actually happened there. The mock returned a 500 with an AcmePay-style error body. The requester caught it, wrapped it into `ExternalApiError` with `code: 500`, and the filter translated it into a 502 for our client. The `forbidden` scenario takes the same path. That is _our_ error handling running end to end — not a unit test with a mocked axios, but the real HTTP stack, the real filter, the real logs.

> The mock returns a 500; your users see whatever your error layer decides. That translation is exactly what you are testing.

## Simulating blocks: 429 rate limiting ⛔

Every serious provider will throttle you eventually, and "we never tested the 429 path" is how a small provider hiccup becomes an outage on your side. The mock makes it a one-header experiment. The `rate-limit` response answers `429` with a `Retry-After: 30` header:

```bash
curl -s -i -X POST -H 'content-type: application/json' \
  -H 'x-mock-scenario: rate-limit' \
  -d '{"amount":4990,"currency":"EUR","customerId":"cus_1"}' \
  http://localhost:3000/payments
```

```text
HTTP/1.1 429 Too Many Requests
Retry-After: 30

{"statusCode":429,"message":"The payment provider is throttling us. Please retry shortly."}
```

The filter propagates the provider's `Retry-After` to our own client, so a well-behaved frontend can back off with the right delay. This is the kind of behavior that is trivial to implement and impossible to verify — until the provider can be told to throttle you on demand.

One honest limitation: Mockoon rules are **stateless**. Each request is evaluated on its own, so you can say "answer 429 when this header is present", but not "answer 200 three times, _then_ start answering 429". Mockoon does offer sequential and random response modes per route, which help simulate flakiness, but a real stateful "you exceeded your quota" machine needs a tool with scenario state. That is the opening scene of part 2.

> A 429 is a contract: the provider says "back off". If you never simulated it, you do not know whether your app backs off or hammers harder.

## Simulating latency and timeouts 🐌

The failure mode that hurts the most in production is not the error response — it is the response that never comes. Remember the config: our axios calls carry `timeout: 2000`. In Mockoon, any response can have its own latency, so the `slow` scenario on `GET /v1/balance` answers correctly... after 5 seconds:

```bash
curl -s -w '\n[%{http_code}] %{time_total}s\n' \
  -H 'x-mock-scenario: slow' \
  http://localhost:3000/payments/balance
```

```json
{"statusCode":504,"message":"The payment provider did not answer in time."}
[504] 2.004392s
```

The 2.004s tells the story: the backend did not wait for the mock's 5 seconds. Axios gave up at 2000ms, the requester turned the timeout into an `ExternalApiError` with no `code`, and the filter mapped "no response at all" to a 504. If you comment out the `timeout` in the requester and run this again, you will feel personally what your users feel when a dependency hangs and you have no timeout configured.

> A timeout is not an error response — it is the absence of one. It deserves its own simulated scenario, because it takes a different path through your code.

## Running it with the CLI (and in CI) 🤖

Because `@mockoon/cli` is a plain npm package, the mock is not tied to anyone's desktop. The `npm run dev` script above runs mock + API together for daily development. In CI the same file boots in a step before your e2e tests:

```yaml
# .github/workflows/e2e.yml (fragment)
- run: npx mockoon-cli start --data ./mockoon/acmepay-mock.json --port 3010 &
- run: npm run test:e2e
  env:
    ACMEPAY_BASE_URL: http://localhost:3010
```

Your e2e suite can then assert the interesting cases — "when the provider throttles, our API answers 429 with Retry-After" — with nothing but curl-level requests and the scenario header. The unit tests in the repo still mock `axiosRef` for the fast feedback loop (that has not changed since the [tests are pure functions philosophy](https://nestjs-ninja.com/blog/2026-06-18-nestjs-authorization-with-casl-conditions-and-record-level-permissions/)), but now there is a second layer: the whole running app against a fake provider.

## Final thoughts

The recipe is short: isolate the provider behind a requester service, put the base URL in config, normalize failures into one domain error, and run a Mockoon mock that can fail on demand. From there, "what happens if AcmePay returns a 500 / throttles us / takes 5 seconds?" stops being a thought experiment and becomes a curl command.

There is a class of situations Mockoon cannot express, though: **state**. "The third call fails", "the quota resets after a minute", "the provider drops the TCP connection mid-response". In part 2 I will swap Mockoon for WireMock — same backend, same env var — to get stateful scenarios, runtime scenario switching through an admin API, and network-level fault injection.

### Takeaways ✍️

- If you cannot trigger a failure, you have not tested how you handle it.
- Isolate every external API behind a requester service; normalize failures into one domain error.
- Keep the provider base URL in env-driven config: pointing the backend at a mock becomes a one-line change.
- Mockoon = GUI to design, one committed JSON file, `@mockoon/cli` to run it anywhere — including CI.
- Use response rules (a scenario header, a missing Authorization) to simulate 500s, 403s, 401s, and 429s.
- Propagate `Retry-After` on 429s, and verify it by simulating the throttle.
- Give latency its own scenario: timeouts take a different code path than error responses.
- Mockoon rules are stateless; for "fails after N calls" and network faults, see part 2 (WireMock).
