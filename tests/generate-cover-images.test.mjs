import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import matter from "gray-matter";
import {
  buildPrompt,
  parseArgs,
  sanitizeFileName,
  slugFromPostFile,
  stripMarkdown,
  writeUpdatedPost,
} from "../scripts/generate-cover-images.mjs";

test("parseArgs enables check mode as a dry-run", () => {
  const options = parseArgs(["--check"], {});

  assert.equal(options.check, true);
  assert.equal(options.dryRun, true);
});

test("parseArgs supports all regeneration aliases", () => {
  for (const flag of ["--all", "--regenerate-all", "--force"]) {
    const options = parseArgs([flag], {});

    assert.equal(options.regenerateAll, true);
  }
});

test("parseArgs reads optional model, size, limit, and file name", () => {
  const options = parseArgs(
    ["--limit", "3", "--model", "image-model", "--size", "1024x1024", "--file-name", "Hero Image.PNG"],
    {},
  );

  assert.equal(options.limit, 3);
  assert.equal(options.model, "image-model");
  assert.equal(options.size, "1024x1024");
  assert.equal(options.fileName, "Hero Image.PNG");
});

test("sanitizeFileName normalizes generated cover names", () => {
  assert.equal(sanitizeFileName("Hero Image.PNG"), "hero-image.png");
  assert.equal(sanitizeFileName(""), "cover.png");
  assert.equal(sanitizeFileName("cover"), "cover.png");
});

test("slugFromPostFile removes the leading date", () => {
  assert.equal(
    slugFromPostFile("2023-01-09-creating-a-tinymce-6-plugin.md"),
    "creating-a-tinymce-6-plugin",
  );
});

test("stripMarkdown removes code blocks, images, and markdown syntax", () => {
  const markdown = [
    "# Title",
    "",
    "![Screenshot](/image.png)",
    "",
    "Use [NestJS](https://nestjs.com) with `TypeScript`.",
    "",
    "```ts",
    "const secret = true;",
    "```",
  ].join("\n");

  assert.equal(stripMarkdown(markdown), "Title Use NestJS with TypeScript.");
});

test("buildPrompt includes article metadata and excludes readable-text requirements", () => {
  const prompt = buildPrompt({
    data: {
      title: "Testing NestJS",
      excerpt: "A practical guide to tests.",
      tags: ["NestJS", "Jest"],
    },
    content: "This article explains integration tests and CI.",
  });

  assert.match(prompt, /Testing NestJS/);
  assert.match(prompt, /A practical guide to tests/);
  assert.match(prompt, /NestJS, Jest/);
  assert.match(prompt, /Avoid: text/);
});

test("writeUpdatedPost writes coverImage and synchronizes ogImage.url", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cover-post-"));
  const filePath = path.join(directory, "post.md");
  const original = [
    "---",
    'title: "Post"',
    'coverImage: "/old.png"',
    "ogImage:",
    '  url: "/old-og.png"',
    "---",
    "",
    "Body",
  ].join("\n");

  fs.writeFileSync(filePath, original);
  writeUpdatedPost(filePath, matter(original), "/blog-assets/post/cover.png");

  const updated = matter(fs.readFileSync(filePath, "utf8"));

  assert.equal(updated.data.coverImage, "/blog-assets/post/cover.png");
  assert.equal(updated.data.ogImage.url, "/blog-assets/post/cover.png");
  assert.equal(updated.content.trim(), "Body");
});
