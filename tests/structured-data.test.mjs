import test from "node:test";
import assert from "node:assert/strict";
import {
  articleJsonLd,
  breadcrumbJsonLd,
  serializeJsonLd,
} from "../src/lib/structured-data.ts";

const post = {
  author: { name: "Henrique Weiand", picture: "/nestjs-ninja.png" },
  content: "Hello",
  coverImage: "/cover.png",
  date: "2026-09-17T12:00:00.000Z",
  excerpt: "An excerpt",
  ogImage: { url: "/blog-assets/post/cover.png" },
  slug: "2026-09-17-a-post",
  tags: ["NestJS", "TypeORM"],
  title: "A Post",
};

test("breadcrumbs run Home > Blog > post, numbered from one", () => {
  const crumbs = breadcrumbJsonLd(post);

  assert.equal(crumbs["@type"], "BreadcrumbList");
  assert.deepEqual(
    crumbs.itemListElement.map((entry) => [entry.position, entry.name]),
    [
      [1, "Home"],
      [2, "Blog"],
      [3, "A Post"],
    ],
  );
});

test("breadcrumb items are absolute URLs", () => {
  for (const entry of breadcrumbJsonLd(post).itemListElement) {
    assert.match(entry.item, /^https:\/\//);
  }
});

test("article carries publisher, language and keywords", () => {
  const article = articleJsonLd(post);

  assert.equal(article.publisher["@type"], "Organization");
  assert.equal(article.inLanguage, "en");
  assert.equal(article.keywords, "NestJS, TypeORM");
  assert.equal(article.articleSection, "NestJS");
  assert.equal(article.mainEntityOfPage["@id"], article.url);
});

test("a post with no tags omits keywords rather than emitting empty ones", () => {
  const article = articleJsonLd({ ...post, tags: undefined });

  assert.equal("keywords" in article, false);
  assert.equal("articleSection" in article, false);
});

test("headline is truncated to what Google will actually show", () => {
  const long = "x".repeat(200);
  const article = articleJsonLd({ ...post, title: long });

  assert.equal(article.headline.length, 110);
});

test("serializeJsonLd escapes < so a title cannot break out of the script tag", () => {
  const output = serializeJsonLd({ title: "</script><script>alert(1)" });

  assert.doesNotMatch(output, /<\/script>/);
  assert.match(output, /\\u003c/);
});
