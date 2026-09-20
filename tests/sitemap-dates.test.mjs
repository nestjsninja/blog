import test from "node:test";
import assert from "node:assert/strict";
import { sitemapLastModified } from "../src/lib/sitemap-dates.ts";

const now = new Date("2026-09-20T12:00:00.000Z");

test("keeps a past date as it is", () => {
  const result = sitemapLastModified("2026-09-17T12:00:00.000Z", now);

  assert.equal(result.toISOString(), "2026-09-17T12:00:00.000Z");
});

test("clamps a future-dated post to now", () => {
  // Posts are dated for the Thursday they belong to, so this is the normal case for the
  // newest post on the site, not an edge case.
  const result = sitemapLastModified("2026-10-01T12:00:00.000Z", now);

  assert.equal(result.toISOString(), now.toISOString());
});

test("treats the current instant as not in the future", () => {
  const result = sitemapLastModified(now.toISOString(), now);

  assert.equal(result.toISOString(), now.toISOString());
});

test("falls back to now for an unparseable date", () => {
  const result = sitemapLastModified("not a date", now);

  assert.equal(result.toISOString(), now.toISOString());
});

test("accepts a Date as well as a string", () => {
  const result = sitemapLastModified(new Date("2026-01-01T00:00:00.000Z"), now);

  assert.equal(result.toISOString(), "2026-01-01T00:00:00.000Z");
});
