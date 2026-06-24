import test from "node:test";
import assert from "node:assert/strict";
import { extractRepos, stackblitzEmbedUrl } from "../src/lib/stackblitz.ts";

test("extractRepos finds an org repo from a plain link", () => {
  const repos = extractRepos(
    "See [the repo](https://github.com/nestjsninja/typeorm-test-factory).",
  );
  assert.equal(repos.length, 1);
  assert.equal(repos[0].slug, "nestjsninja/typeorm-test-factory");
  assert.equal(
    repos[0].openUrl,
    "https://stackblitz.com/github/nestjsninja/typeorm-test-factory",
  );
});

test("extractRepos normalizes blob/tree URLs to the repo root and dedupes", () => {
  const repos = extractRepos(`
    https://github.com/nestjsninja/demo/blob/main/src/main.ts
    https://github.com/nestjsninja/demo/tree/main/test
    https://github.com/nestjsninja/demo
  `);
  assert.equal(repos.length, 1);
  assert.equal(repos[0].slug, "nestjsninja/demo");
});

test("extractRepos keeps distinct org repos in first-seen order", () => {
  const repos = extractRepos(
    "https://github.com/nestjsninja/lib and https://github.com/nestjsninja/lib-demo",
  );
  assert.deepEqual(
    repos.map((r) => r.slug),
    ["nestjsninja/lib", "nestjsninja/lib-demo"],
  );
});

test("extractRepos keeps the author's accounts but drops third-party + profiles", () => {
  const repos = extractRepos(`
    Keep https://github.com/nestjsninja/keep
    Keep https://github.com/henriqueweiand/old-example
    Drop https://github.com/release-it/release-it
    Profile https://github.com/nestjsninja
  `);
  assert.deepEqual(
    repos.map((r) => r.slug),
    ["nestjsninja/keep", "henriqueweiand/old-example"],
  );
});

test("extractRepos flags repos with native deps", () => {
  const [withNative] = extractRepos(
    "https://github.com/nestjsninja/typeorm-test-factory",
  );
  assert.equal(withNative.nativeDeps, true);

  const [pureJs] = extractRepos(
    "https://github.com/nestjsninja/nestjs-design-patterns",
  );
  assert.equal(pureJs.nativeDeps, false);
});

test("extractRepos strips a trailing .git and punctuation", () => {
  const repos = extractRepos(
    "clone https://github.com/nestjsninja/widgets.git, then run",
  );
  assert.equal(repos[0].slug, "nestjsninja/widgets");
});

test("stackblitzEmbedUrl is click-to-load in editor view", () => {
  const url = stackblitzEmbedUrl("nestjsninja", "widgets");
  assert.ok(
    url.startsWith("https://stackblitz.com/github/nestjsninja/widgets?"),
  );
  assert.match(url, /embed=1/);
  assert.match(url, /ctl=1/);
  assert.match(url, /view=editor/);
});
