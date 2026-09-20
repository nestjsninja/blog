import test from "node:test";
import assert from "node:assert/strict";
import { buildRssFeed, escapeXml } from "../src/lib/feed.ts";

const now = new Date("2026-09-20T12:00:00.000Z");

function feed(items) {
  return buildRssFeed({
    title: "NestJS Ninja",
    description: "Backend architecture notes",
    siteUrl: "https://nestjs-ninja.com",
    feedUrl: "https://nestjs-ninja.com/rss.xml",
    items,
    now,
  });
}

const item = {
  title: "NestJS and LangChain: Agents, Tools & Structured Output",
  link: "https://nestjs-ninja.com/blog/post",
  guid: "https://nestjs-ninja.com/blog/post",
  description: 'He said "hello" & left',
  pubDate: new Date("2026-10-01T12:00:00.000Z").toUTCString(),
  categories: ["NestJS", "AI"],
};

test("escapes the five XML entities", () => {
  assert.equal(escapeXml(`&<>"'`), "&amp;&lt;&gt;&quot;&apos;");
});

test("escapes ampersands in titles and descriptions", () => {
  // One unescaped & makes the document unparseable and readers drop the feed silently.
  const xml = feed([item]);

  assert.match(xml, /Agents, Tools &amp; Structured Output/);
  assert.match(xml, /He said &quot;hello&quot; &amp; left/);
  assert.doesNotMatch(xml, / & /);
});

test("includes the channel metadata and a self link", () => {
  const xml = feed([item]);

  assert.match(xml, /<title>NestJS Ninja<\/title>/);
  assert.match(xml, /rel="self"/);
  assert.match(xml, /<lastBuildDate>Sun, 20 Sep 2026 12:00:00 GMT<\/lastBuildDate>/);
});

test("renders items with RFC 822 dates and categories", () => {
  const xml = feed([item]);

  assert.match(xml, /<pubDate>Thu, 01 Oct 2026 12:00:00 GMT<\/pubDate>/);
  assert.match(xml, /<category>NestJS<\/category>/);
  assert.match(xml, /<category>AI<\/category>/);
});

test("produces a well-formed document with no items", () => {
  const xml = feed([]);

  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<\/rss>/);
});
