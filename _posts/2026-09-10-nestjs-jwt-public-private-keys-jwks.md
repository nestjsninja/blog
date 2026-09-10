---
title: 'Public and Private Keys in NestJS: Signing JWTs and Publishing a JWKS'
excerpt: >-
  How the keys an SSO provider generates actually work, built in NestJS: sign
  access tokens with a private key, publish the matching public key at
  /.well-known/jwks.json, verify every request against it, and let an outside
  service or the browser verify with nothing but the URL. Then hand the trusted
  claims to the CASL authorization layer.
date: '2026-09-10T12:00:00.000Z'
author:
  name: Henrique Weiand
  picture: /nestjs-ninja.png
tags:
  - NestJS
  - Authentication
  - JWT
  - JWKS
  - Security
  - Typescript
coverImage: /blog-assets/nestjs-jwt-public-private-keys-jwks/cover.png
ogImage:
  url: /blog-assets/nestjs-jwt-public-private-keys-jwks/cover.png
---
Hello, dev!

When you plug an SSO provider into a backend — Auth0, Cognito, Okta, Keycloak, "Sign in with Google" — you never see the key that signs your tokens. The provider keeps a **private key** locked away, signs every JWT with it, and publishes the matching **public key** at a URL like `https://issuer/.well-known/jwks.json`. Your API downloads that public key and uses it to check signatures. It can verify tokens all day, and it still cannot forge one.

That asymmetry is the whole point, and it is worth understanding by building it. In this post the NestJS app plays **both roles**:

- **the issuer** — it holds an RSA private key, signs access tokens with it, and serves its public key as a JWKS document;
- **the verifier** — a global guard checks every incoming token against those published public keys;
- and we finish with an **outside verifier** — a separate service, or browser code, that trusts the same tokens with nothing but the JWKS URL.

Then, once a token is trusted, its `roles` and `scope` claims feed the [CASL authorization layer](https://nestjs-ninja.com/blog/2026-06-11-nestjs-authorization-with-casl-abilities-roles-and-guards/) we built earlier.

> A shared secret lets you verify _and_ forge. A public/private key pair lets you publish the verification half to the whole world and still be the only one who can sign.

💻 The full, runnable example is on GitHub: [nestjsninja/nestjs-jwt-public-private-keys](https://github.com/nestjsninja/nestjs-jwt-public-private-keys).

## What makes a request trusted 🧱

"Auth" is a few checks stacked in order, cheapest first. Naming them up front makes the rest of the post easier to place:

| Check                    | Question                                                   | Where it runs                                         | Covered in                                                                                                                                                                                                                                                       |
| ------------------------ | ---------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Signature (keys)**     | Was this token really minted by us, and is it still valid? | global `AuthGuard`, against the published public keys | this post                                                                                                                                                                                                                                                        |
| **Scopes**               | Does the token carry the coarse claim for this area?       | same guard, `@Scopes()`                               | this post                                                                                                                                                                                                                                                        |
| **Abilities (roles)**    | Does _this user's role_ allow the action?                  | `AuthorizationGuard` + `@CheckAbility()`              | [CASL part 1](https://nestjs-ninja.com/blog/2026-06-11-nestjs-authorization-with-casl-abilities-roles-and-guards/)                                                                                                                                               |
| **Conditions (records)** | Can this user act on _this specific_ record?               | the service, `throwUnlessCan`                         | [CASL part 2](https://nestjs-ninja.com/blog/2026-06-18-nestjs-authorization-with-casl-conditions-and-record-level-permissions/), [TypeORM branch](https://nestjs-ninja.com/blog/2026-06-25-nestjs-authorization-with-casl-and-typeorm-record-level-permissions/) |

Everything in this post is that first row: proving the token is genuine using a key pair, and publishing the half that makes independent verification possible.

## Symmetric vs asymmetric, quickly 🔑

A JWT is `base64url(header).base64url(payload).signature`. The only real difference between algorithms is how that signature is produced and checked.

- **HS256 (symmetric).** One secret string. `HMAC(secret, header.payload)`. Whoever can verify a token can also sign one, because it is the same key. Fine when a single service both issues and consumes tokens and nothing else touches them.
- **RS256 / ES256 (asymmetric).** A key _pair_. The **private key** signs; the **public key** verifies. They are mathematically linked but you cannot derive the private key from the public one. So you can hand the public key to every downstream service, print it in docs, serve it to the browser — and you are still the only party that can mint a valid token.

The moment more than one service needs to trust your tokens, or you want an audit story like "only the auth service can sign", you want asymmetric. That is why every SSO provider uses it.

I will use **RS256** here because it is what Auth0, Cognito, and Okta default to. Swapping to **ES256** (smaller keys and tokens, elliptic curve) is a one-line change in the code below.

For the JOSE plumbing I use [`jose`](https://github.com/panva/jose): it is dependency-free, typed, and the exact same calls run in Node and in the browser, which matters for the last section.

```bash
npm install jose
```

## The keystore: where the private key lives 🗝️

One service owns the keys. Everything else is derived from them.

```ts
// auth/keystore.service.ts
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import {
  calculateJwkThumbprint,
  exportJWK,
  generateKeyPair,
  importPKCS8,
  type JWK,
  type KeyLike,
} from "jose";

export const SIGNING_ALG = "RS256";

export interface SigningKey {
  kid: string; // RFC 7638 thumbprint — goes in the JWT header and the JWKS
  privateKey: KeyLike; // the secret half; never leaves the server
  publicJwk: JWK; // the shareable half, ready for the JWKS
  current: boolean; // only one key signs new tokens
}

@Injectable()
export class KeystoreService implements OnModuleInit {
  private readonly logger = new Logger(KeystoreService.name);
  private keys: SigningKey[] = [];

  async onModuleInit(): Promise<void> {
    const pems = this.readPrivateKeyPems();

    if (pems.length === 0) {
      this.logger.warn("No JWT_PRIVATE_KEYS — generating an ephemeral key.");
      const { privateKey } = await generateKeyPair(SIGNING_ALG, {
        extractable: true,
      });
      this.keys = [await this.toSigningKey(privateKey, true)];
      return;
    }

    this.keys = await Promise.all(
      pems.map(async (pem, i) =>
        this.toSigningKey(await importPKCS8(pem, SIGNING_ALG), i === 0),
      ),
    );
  }

  currentKey(): SigningKey {
    const current = this.keys.find((k) => k.current);
    if (!current) throw new Error("Keystore has no current signing key");
    return current;
  }

  // Every public key, as a JWKS. The previous key stays here through a rotation.
  publicJwks(): { keys: JWK[] } {
    return { keys: this.keys.map((k) => k.publicJwk) };
  }

  private async toSigningKey(
    privateKey: KeyLike,
    current: boolean,
  ): Promise<SigningKey> {
    // exportJWK on a private key returns BOTH halves (n, e, d, p, q, ...).
    // The public JWK is just the public members — n and e for RSA.
    const full = await exportJWK(privateKey);
    const publicJwk: JWK = { kty: full.kty, n: full.n, e: full.e };
    const kid = await calculateJwkThumbprint(publicJwk);

    return {
      kid,
      privateKey,
      publicJwk: { ...publicJwk, kid, use: "sig", alg: SIGNING_ALG },
      current,
    };
  }

  private readPrivateKeyPems(): string[] {
    const raw = process.env.JWT_PRIVATE_KEYS; // JSON array of PKCS#8 PEMs
    if (!raw) return [];
    return (JSON.parse(raw) as string[]).map((pem) =>
      pem.replace(/\\n/g, "\n"),
    );
  }
}
```

A few decisions worth calling out.

**The private key comes from the environment**, as a JSON array of PKCS#8 PEM strings. In production that array is injected from a secret manager or KMS, never committed. With nothing set, the demo generates a throwaway key so it runs with zero setup.

**The public JWK is literally the private JWK minus the secret fields.** For RSA that means keeping `n` and `e` and dropping `d`, `p`, `q`, `dp`, `dq`, `qi`. `exportJWK` hands you everything; you publish only the public members. (In the repo there is a test asserting none of the private fields ever appear in `publicJwks()`.)

**`kid` is the RFC 7638 thumbprint** of the public JWK — a hash of the key itself. Two upsides: it is stable (restart the app, same key, same `kid`), and it is unique per key, which is exactly what you need for rotation.

**It is an array.** One key is `current` and signs new tokens; any others are previous keys that are still published so their tokens keep verifying. More on that below.

## Signing with the private key ✍️

```ts
// auth/token.service.ts
import { Injectable } from "@nestjs/common";
import { createLocalJWKSet, jwtVerify, SignJWT, type JWTPayload } from "jose";

import { KeystoreService, SIGNING_ALG } from "./keystore.service";

export const ISSUER = process.env.JWT_ISSUER ?? "https://api.example.com";
export const AUDIENCE = process.env.JWT_AUDIENCE ?? "https://api.example.com";

export interface AccessTokenClaims extends JWTPayload {
  roles: string[];
  scope: string; // space-delimited, OAuth2 style
}

@Injectable()
export class TokenService {
  constructor(private readonly keystore: KeystoreService) {}

  async sign(
    input: { sub: string; roles: string[]; scope: string },
    ttlSeconds = 3600,
  ): Promise<string> {
    const key = this.keystore.currentKey();

    return new SignJWT({ roles: input.roles, scope: input.scope })
      .setProtectedHeader({ alg: SIGNING_ALG, kid: key.kid }) // <- kid here
      .setSubject(input.sub)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${ttlSeconds}s`)
      .sign(key.privateKey); // <- private key here
  }

  async verify(token: string): Promise<AccessTokenClaims> {
    const jwks = createLocalJWKSet(this.keystore.publicJwks());

    const { payload } = await jwtVerify(token, jwks, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    return payload as AccessTokenClaims;
  }
}
```

Two things make this work later:

- **`kid` goes in the header.** A verifier that holds several public keys uses `kid` to pick the right one without trial and error.
- **`iss` and `aud` are set and checked.** Signature alone only proves "some holder of this private key signed this". `issuer` pins _which_ signer you accept, and `audience` pins that the token was minted for _this_ API and not some other service that trusts the same issuer. `jose` rejects the token if either does not match.

`verify` uses `createLocalJWKSet` because this service both issues and consumes its own tokens — the public keys are right there in memory. A pure consumer swaps that one line, which is the whole next section.

## Publishing the public key as a JWKS 🌐

This is the endpoint that makes independent verification possible. It is public, cacheable, and contains only public key material.

```ts
// auth/jwks.controller.ts
import { Controller, Get, Header } from "@nestjs/common";

import { KeystoreService } from "./keystore.service";
import { Public } from "./public.decorator";

@Controller(".well-known")
export class JwksController {
  constructor(private readonly keystore: KeystoreService) {}

  @Public()
  @Get("jwks.json")
  @Header("Cache-Control", "public, max-age=300")
  jwks() {
    return this.keystore.publicJwks();
  }
}
```

`@Public()` here is the small opt-out decorator on top of a global auth guard — if you have not set that up, the [pattern is a one-liner](https://nestjs-ninja.com/blog/2026-06-11-nestjs-authorization-with-casl-abilities-roles-and-guards/): register the guard as `APP_GUARD`, and let routes mark themselves public with `SetMetadata`. The JWKS route and `/auth/login` are the two endpoints that must stay reachable without a token.

The response looks like this:

```json
{
  "keys": [
    {
      "kty": "RSA",
      "n": "xuhKntXJ...1w",
      "e": "AQAB",
      "kid": "dpGh9nYwmC8W_hMkZJiA575Rcd1tNLnmafFcuTofTCk",
      "use": "sig",
      "alg": "RS256"
    }
  ]
}
```

`n` and `e` _are_ the RSA public key, just encoded as JSON instead of PEM. Anyone can rebuild the key from those two numbers and check a signature. There is nothing secret to protect here, which is why serving it to any origin is fine.

## Verifying every incoming token 🛡️

The guard is where the public key does its job on the request path.

```ts
// auth/auth.guard.ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { IS_PUBLIC_KEY } from "./public.decorator";
import { SCOPES_KEY } from "./scopes.decorator";
import { AccessTokenClaims, TokenService } from "./token.service";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const [type, token] = request.headers.authorization?.split(" ") ?? [];
    if (type !== "Bearer" || !token) {
      throw new UnauthorizedException("Missing bearer token");
    }

    try {
      // signature + iss + aud + exp, all against the published public keys
      request.user = await this.tokens.verify(token);
    } catch (error) {
      throw new UnauthorizedException(
        `Invalid token: ${(error as Error).message}`,
      );
    }

    return this.checkScopes(context, request.user);
  }

  private checkScopes(
    context: ExecutionContext,
    user: AccessTokenClaims,
  ): boolean {
    const required =
      this.reflector.getAllAndOverride<string[]>(SCOPES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (required.length === 0) return true;

    const granted = new Set((user.scope ?? "").split(" ").filter(Boolean));
    const missing = required.filter((scope) => !granted.has(scope));
    if (missing.length > 0) {
      throw new ForbiddenException(`Missing scope(s): ${missing.join(", ")}`);
    }

    return true;
  }
}
```

Registered once as a global guard, this makes every route private: a request without a validly signed, unexpired, correctly-addressed token gets a `401` before the handler runs.

### The pure-consumer version

A service that only _verifies_ — a downstream microservice, an API gateway, a partner backend — does not have the keys in memory. It fetches them from the issuer's JWKS URL. With `jose` that is `createRemoteJWKSet`:

```ts
import { createRemoteJWKSet, jwtVerify } from "jose";

const JWKS = createRemoteJWKSet(
  new URL("https://api.example.com/.well-known/jwks.json"),
);

const { payload } = await jwtVerify(token, JWKS, {
  issuer: "https://api.example.com",
  audience: "https://api.example.com",
});
```

`createRemoteJWKSet` fetches the document once, caches it, and — this is the useful part — automatically refetches when it sees a `kid` it does not recognize, which is exactly what happens right after a key rotation. You do not write any cache or refresh logic.

If you are on Passport, the equivalent is `passport-jwt` with `jwks-rsa` as the `secretOrKeyProvider`; `@nestjs/jwt` also accepts a `publicKey` or a provider function. Same idea, different wrapper.

## The browser, with only the URL 🪪

Because `jose` runs in the browser too, client code can verify a token with the same three lines:

```ts
import { createRemoteJWKSet, jwtVerify } from "jose";

const JWKS = createRemoteJWKSet(
  new URL("https://api.example.com/.well-known/jwks.json"),
);

const { payload } = await jwtVerify(accessToken, JWKS, {
  issuer: "https://api.example.com",
  audience: "https://api.example.com",
});

// payload.exp, payload.roles, payload.scope — all available client-side
```

This is genuinely useful for UX: the SPA can read `exp` to refresh proactively, or hide a button the token's `scope` does not allow, without a round trip. One caveat worth stating plainly:

> Client-side verification is for user experience, not for security. The browser decides what to _show_; the API still re-verifies every request and decides what to _allow_. Never trust a check that runs on a machine the user controls.

## Scopes: the coarse claim in the token 🎟️

Once the signature is trusted, the `scope` claim is the cheapest useful authorization check. It is a space-delimited string the issuer put in at sign time (OAuth2, RFC 6749).

```ts
// auth/scopes.decorator.ts
import { SetMetadata } from "@nestjs/common";

export const SCOPES_KEY = "requiredScopes";
export const Scopes = (...scopes: string[]) => SetMetadata(SCOPES_KEY, scopes);
```

```ts
@Controller("orders")
export class OrderController {
  @Get()
  @Scopes("orders:read")
  list() {
    /* ... */
  }

  @Post(":id/refund")
  @Scopes("orders:write")
  refund(@Param("id") id: string) {
    /* ... */
  }
}
```

The guard already handles it (`checkScopes` above). Different issuers ship scopes differently — one space-delimited `scope` string, or an array in `scp` or `permissions` — so normalize whatever your provider sends inside `TokenService` and let the rest of the app read one shape.

> By the way, these are **token scopes**. They have nothing to do with NestJS _injection scopes_ (`DEFAULT` / `REQUEST` / `TRANSIENT`) from [that other post](https://nestjs-ninja.com/blog/2026-07-30-nestjs-injection-scopes-default-request-transient/) — same word, different topic.

## Where the keys stop and CASL begins 🔗

Signature verification answers "is this token real and current?". Scopes answer "may this token touch this area?". Neither can answer:

- "editors can update **their own** articles" (needs the record);
- "support can refund orders **under $100**" (needs the record);
- rules the product team edits at runtime.

Those live in the [CASL authorization layer](https://nestjs-ninja.com/blog/2026-06-11-nestjs-authorization-with-casl-abilities-roles-and-guards/). The handoff is clean because the guard has already produced a trustworthy `request.user` from the verified payload:

- **Keys** (this post) — the token is genuine, unexpired, and addressed to us. `request.user` is now safe to read.
- **Scopes** (this post) — a database-free gate from the token's own claims.
- **Abilities** ([part 1](https://nestjs-ninja.com/blog/2026-06-11-nestjs-authorization-with-casl-abilities-roles-and-guards/)) — `@CheckAbility(['refund', 'Order'])`, computed per request from `request.user.roles`.
- **Conditions** ([part 2](https://nestjs-ninja.com/blog/2026-06-18-nestjs-authorization-with-casl-conditions-and-record-level-permissions/) / [TypeORM](https://nestjs-ninja.com/blog/2026-06-25-nestjs-authorization-with-casl-and-typeorm-record-level-permissions/)) — `throwUnlessCan('refund', order)` in the service, after the record is loaded.

The `roles` array the CASL layer needs rode in on the same asymmetrically-signed token that carried the scopes. One verification, every later layer trusts the result.

## Key rotation without downtime 🔄

The reason the keystore is an array. To rotate:

1. Generate a new key pair. Add its public JWK to `publicJwks()` **alongside** the current one, and deploy. Verifiers now accept both.
2. After the JWKS cache TTL has passed everywhere (say a few minutes), flip the new key to `current` so new tokens are signed with it. Old tokens still verify — their `kid` still resolves.
3. Once every token signed by the old key has expired (wait one max token TTL), drop the old key from the array.

`kid` is what makes this seamless: every token says which key signed it, and as long as that key is still in the JWKS, verification just works. `createRemoteJWKSet` even handles step 1's propagation for you — the first token with the new `kid` triggers a refetch.

Do the same thing on a schedule, and a leaked key is a contained incident instead of a crisis.

## Testing 🧪

The pieces are small and pure, so the tests are too:

- **Keystore** — a PEM in, a public JWK out; the `kid` is stable across reloads; the JWKS never contains `d`, `p`, or `q`.
- **Token service** — sign/verify round-trip; the header carries the current `kid`; expired and wrong-issuer tokens are rejected; and a **rotation** case: a token signed by the previous key still verifies while that key is published, and stops the moment it is removed.
- **Guard** — public route with no token passes; missing/!bad token is `401`; missing scope is `403`.
- **e2e** — `GET /.well-known/jwks.json` returns public-only material, and an _outside_ verifier (`jose` + the fetched JWKS, no shared secret) can validate a freshly issued token.

```ts
it("an outside verifier trusts the token using only the JWKS", async () => {
  const token = await login();
  const jwks = (
    await request(app.getHttpServer()).get("/.well-known/jwks.json")
  ).body;

  const { payload } = await jwtVerify(token, createLocalJWKSet(jwks), {
    issuer: ISSUER,
    audience: AUDIENCE,
  });

  expect(payload.sub).toBe("u1");
});
```

That test is the thesis of the whole post in ten lines: the public document is enough to verify, and it is all you ever have to share.

## Final thoughts

The keys an SSO provider generates are not magic. A private key signs, a public key verifies, and the public key is published at a well-known URL so anyone can check a signature without being able to produce one.

- The **keystore** holds the private key (from a secret manager in production) and derives the public JWK — the private JWK minus its secret fields.
- **Signing** stamps a `kid` in the header and sets `iss` / `aud` so verifiers know exactly what to accept.
- **`/.well-known/jwks.json`** is public, cacheable, and safe to serve to any origin, including the browser.
- The **guard** verifies every request against those public keys; a pure consumer or browser code does the same with `createRemoteJWKSet` and just the URL.
- **`kid`** turns key rotation into a non-event.
- Past the signature, `roles` and `scope` are trustworthy input for [scopes and the CASL layer](https://nestjs-ninja.com/blog/2026-06-11-nestjs-authorization-with-casl-abilities-roles-and-guards/).

That is it for today. Build it once and the JWKS endpoints on Auth0, Cognito, and Okta stop looking like a black box.

### Takeaways ✍️

- Use asymmetric signing (RS256/ES256) the moment more than one party must trust your tokens.
- Keep private keys in a secret manager / KMS and load them from the environment, never the repo.
- The public JWK is the private JWK with the secret fields removed — publish only `n` / `e` (RSA) or `x` / `y` (EC).
- Put a stable `kid` (RFC 7638 thumbprint) in the token header and every JWKS entry.
- Always verify `iss` and `aud`, not just the signature.
- Serve the JWKS with a cache header; consumers should use `createRemoteJWKSet` (or `jwks-rsa`), not hand-rolled fetching.
- Browser-side verification is for UX only — the API re-verifies everything.
- Rotate by publishing the new key first, flipping `current` after the cache TTL, and dropping the old key after one token lifetime.
