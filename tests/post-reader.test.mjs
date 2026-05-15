import test from "node:test";
import assert from "node:assert/strict";
import {
  getRelatedPosts,
  getSeriesNavigation,
  getTableOfContents,
  readingTime,
  stripMarkdownForSearch,
} from "../src/lib/post-reader.ts";

function post(overrides) {
  return {
    author: { name: "Henrique", picture: "/ninja.png" },
    content: "Hello",
    coverImage: "/cover.png",
    date: "2025-01-01T12:00:00.000Z",
    excerpt: "Excerpt",
    ogImage: { url: "/cover.png" },
    slug: "post",
    title: "Post",
    tags: [],
    ...overrides,
  };
}

test("stripMarkdownForSearch creates plain searchable text", () => {
  const text = stripMarkdownForSearch(
    "Use [NestJS](https://nestjs.com) with `TypeScript`.\n\n![Image](/x.png)",
  );

  assert.equal(text, "Use NestJS with TypeScript.");
});

test("readingTime returns at least one minute", () => {
  assert.equal(readingTime("Short post"), "1 min read");
});

test("getTableOfContents extracts h2 and h3 headings", () => {
  assert.deepEqual(
    getTableOfContents("## Setup 🛠\n\n### Install deps\n\n## Setup 🛠"),
    [
      { id: "setup-", level: 2, title: "Setup 🛠" },
      { id: "install-deps", level: 3, title: "Install deps" },
      { id: "setup--1", level: 2, title: "Setup 🛠" },
    ],
  );
});

test("getRelatedPosts ranks posts by shared tags", () => {
  const current = post({ slug: "current", tags: ["NestJS", "Jest"] });
  const related = getRelatedPosts(current, [
    current,
    post({ slug: "one", tags: ["NestJS"], date: "2025-01-02T12:00:00.000Z" }),
    post({ slug: "two", tags: ["NestJS", "Jest"], date: "2025-01-01T12:00:00.000Z" }),
    post({ slug: "three", tags: ["React"] }),
  ]);

  assert.deepEqual(
    related.map((item) => item.slug),
    ["two", "one"],
  );
});

test("getSeriesNavigation returns previous and next posts", () => {
  const first = post({ slug: "first", series: "Auth", seriesOrder: 1 });
  const second = post({ slug: "second", series: "Auth", seriesOrder: 2 });
  const third = post({ slug: "third", series: "Auth", seriesOrder: 3 });

  assert.deepEqual(getSeriesNavigation(second, [third, first, second]), {
    name: "Auth",
    previous: first,
    next: third,
  });
});
