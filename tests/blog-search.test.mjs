import test from "node:test";
import assert from "node:assert/strict";
import { filterPosts } from "../src/lib/post-filter.ts";

// The filtering behind the blog search box + tag chips (blog-search.tsx).
const posts = [
  { slug: "a", searchText: "nestjs providers tutorial", tags: ["NestJS", "DI"] },
  { slug: "b", searchText: "typeorm testing with sqlite", tags: ["TypeORM", "Testing"] },
  { slug: "c", searchText: "graphql basics", tags: ["GraphQL"] },
  { slug: "d", searchText: "untagged draft" }, // no tags
];

const slugs = (result) => result.map((post) => post.slug);

test("returns all posts when there is no query and no tag", () => {
  assert.deepEqual(slugs(filterPosts(posts)), ["a", "b", "c", "d"]);
  assert.deepEqual(slugs(filterPosts(posts, {})), ["a", "b", "c", "d"]);
});

test("filters by free-text query against searchText", () => {
  assert.deepEqual(slugs(filterPosts(posts, { query: "typeorm" })), ["b"]);
});

test("query is trimmed and case-insensitive", () => {
  assert.deepEqual(slugs(filterPosts(posts, { query: "  GraphQL  " })), ["c"]);
});

test("an empty/whitespace query matches everything", () => {
  assert.equal(filterPosts(posts, { query: "   " }).length, posts.length);
});

test("filters by tag", () => {
  assert.deepEqual(slugs(filterPosts(posts, { tag: "Testing" })), ["b"]);
});

test("a null tag matches everything", () => {
  assert.equal(filterPosts(posts, { tag: null }).length, posts.length);
});

test("posts without tags are excluded when a tag is active", () => {
  assert.deepEqual(slugs(filterPosts(posts, { tag: "NestJS" })), ["a"]);
});

test("tag and query are AND-ed together", () => {
  assert.deepEqual(
    slugs(filterPosts(posts, { tag: "TypeORM", query: "sqlite" })),
    ["b"],
  );
  assert.deepEqual(
    slugs(filterPosts(posts, { tag: "TypeORM", query: "graphql" })),
    [],
  );
});

test("tag matching is exact (not substring)", () => {
  assert.deepEqual(slugs(filterPosts(posts, { tag: "Test" })), []);
});

test("preserves input order", () => {
  // "i" appears in a (provIders), b (testIng), c (basIcs) but not d
  assert.deepEqual(slugs(filterPosts(posts, { query: "i" })), ["a", "b", "c"]);
});
