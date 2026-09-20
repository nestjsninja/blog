import test from "node:test";
import assert from "node:assert/strict";
import { postUrls, urlsToSubmit } from "../scripts/ping-search-engines.mjs";

const SITE = "https://nestjs-ninja.com";

test("builds absolute post URLs with a trailing slash", () => {
  const urls = postUrls(SITE);

  assert.ok(urls.length > 0);
  for (const url of urls) {
    assert.match(url, /^https:\/\/nestjs-ninja\.com\/blog\/[^/]+\/$/);
  }
});

test("lists the newest posts first", () => {
  // Filenames start with the date, so reverse-sorted is newest-first, and the newest posts
  // are the ones worth telling a search engine about.
  const urls = postUrls(SITE);

  assert.ok(urls[0] > urls[1]);
});

test("submits the home page and the blog index alongside the posts", () => {
  const urls = urlsToSubmit(SITE);

  assert.equal(urls[0], `${SITE}/`);
  assert.equal(urls[1], `${SITE}/blog/`);
});

test("caps how many posts are submitted", () => {
  // IndexNow allows 10,000 per submission, but resubmitting the whole archive on every deploy
  // is noise. Only what plausibly changed.
  const urls = urlsToSubmit(SITE, 3);

  assert.equal(urls.length, 5);
});

test("produces no duplicates", () => {
  const urls = urlsToSubmit(SITE);

  assert.equal(new Set(urls).size, urls.length);
});
