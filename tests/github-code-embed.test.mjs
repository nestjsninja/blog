import test from "node:test";
import assert from "node:assert/strict";
import { githubFileLinkFromUrl } from "../src/lib/githubCodeEmbed.ts";
import markdownToHtmlModule from "../src/lib/markdownToHtml.ts";

const markdownToHtml =
  typeof markdownToHtmlModule === "function"
    ? markdownToHtmlModule
    : markdownToHtmlModule.default;

test("githubFileLinkFromUrl converts GitHub blob URLs to raw URLs", () => {
  const link = githubFileLinkFromUrl(
    "https://github.com/henriqueweiand/nestjs-real-time-chat/blob/master/src/chat/chat-gateway.ts",
  );

  assert.deepEqual(link, {
    displayUrl:
      "https://github.com/henriqueweiand/nestjs-real-time-chat/blob/master/src/chat/chat-gateway.ts",
    language: "typescript",
    rawUrl:
      "https://raw.githubusercontent.com/henriqueweiand/nestjs-real-time-chat/master/src/chat/chat-gateway.ts",
  });
});

test("githubFileLinkFromUrl ignores repository and tree URLs", () => {
  assert.equal(
    githubFileLinkFromUrl("https://github.com/henriqueweiand/nestjs-real-time-chat"),
    null,
  );
  assert.equal(
    githubFileLinkFromUrl(
      "https://github.com/henriqueweiand/nestjs-real-time-chat/tree/master/src/chat",
    ),
    null,
  );
});

test("markdownToHtml expands standalone GitHub file links into code blocks", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    assert.equal(
      url,
      "https://raw.githubusercontent.com/owner/repo/main/src/index.ts",
    );

    return new Response("export const answer = 42;\n", {
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    });
  };

  try {
    const html = await markdownToHtml(
      "[https://github.com/owner/repo/blob/main/src/index.ts](https://github.com/owner/repo/blob/main/src/index.ts)",
    );

    assert.match(html, /Source:/);
    assert.match(html, /https:\/\/github\.com\/owner\/repo\/blob\/main\/src\/index\.ts/);
    assert.match(html, /language-typescript/);
    assert.match(html, /answer = <span class="hljs-number">42<\/span>/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("markdownToHtml keeps inline GitHub file links as links", async () => {
  const html = await markdownToHtml(
    "Check this [code](https://github.com/owner/repo/blob/main/src/index.ts) before continuing.",
  );

  assert.match(html, /Check this/);
  assert.doesNotMatch(html, /language-typescript/);
});
