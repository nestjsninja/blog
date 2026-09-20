import test from "node:test";
import assert from "node:assert/strict";
import {
  buildArticleMetadata,
  buildPageMetadata,
  rootMetadata,
} from "../src/lib/seo.ts";

const article = {
  title: "A Post",
  path: "/blog/a-post",
  publishedTime: "2026-09-17T12:00:00.000Z",
};

test("root metadata asks for large image previews", () => {
  assert.equal(rootMetadata.robots.googleBot["max-image-preview"], "large");
  assert.equal(rootMetadata.robots.googleBot["max-snippet"], -1);
});

test("page metadata keeps the preview directives", () => {
  // Regression guard. This previously returned robots: undefined, and because Next.js treats a
  // present-but-undefined key as an override rather than as "inherit", every page silently
  // lost the root's directives and Google saw no robots meta at all.
  const meta = buildPageMetadata({ title: "Blog", path: "/blog" });

  assert.equal(meta.robots.googleBot["max-image-preview"], "large");
});

test("article metadata keeps them too", () => {
  const meta = buildArticleMetadata(article);

  assert.equal(meta.robots.googleBot["max-image-preview"], "large");
});

test("noIndex still wins where it is asked for", () => {
  const meta = buildPageMetadata({ title: "Secret", path: "/secret", noIndex: true });

  assert.equal(meta.robots.index, false);
  assert.equal(meta.robots.follow, false);
});

test("the feed stays discoverable on every page", () => {
  // alternates is replaced wholesale by page metadata, so the feed has to be repeated or it
  // only ever appears on the root.
  for (const meta of [
    rootMetadata,
    buildPageMetadata({ title: "Blog", path: "/blog" }),
    buildArticleMetadata(article),
  ]) {
    assert.equal(meta.alternates.types["application/rss+xml"][0].url, "/rss.xml");
  }
});

test("canonical URLs carry the trailing slash the site redirects to", () => {
  assert.equal(buildPageMetadata({ title: "Blog", path: "/blog" }).alternates.canonical, "/blog/");
});

test("the default social image is local rather than hotlinked", () => {
  const image = rootMetadata.openGraph.images[0];

  assert.match(image.url, /^https:\/\/nestjs-ninja\.com\//);
  assert.doesNotMatch(image.url, /unsplash/);
  assert.equal(image.width, 1200);
  assert.equal(image.height, 630);
});
