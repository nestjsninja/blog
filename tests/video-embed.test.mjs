import test from "node:test";
import assert from "node:assert/strict";
import markdownToHtmlModule from "../src/lib/markdownToHtml.ts";
import { videoEmbedFromUrl } from "../src/lib/videoEmbed.ts";

const markdownToHtml =
  typeof markdownToHtmlModule === "function"
    ? markdownToHtmlModule
    : markdownToHtmlModule.default;

test("videoEmbedFromUrl detects YouTube links", () => {
  assert.deepEqual(videoEmbedFromUrl("https://youtu.be/OYsF6sO5Duw?si=x"), {
    sourceUrl: "https://youtu.be/OYsF6sO5Duw?si=x",
    embedUrl: "https://www.youtube-nocookie.com/embed/OYsF6sO5Duw",
    title: "YouTube video",
    type: "iframe",
  });
});

test("videoEmbedFromUrl detects Vimeo links", () => {
  assert.deepEqual(videoEmbedFromUrl("https://vimeo.com/123456"), {
    sourceUrl: "https://vimeo.com/123456",
    embedUrl: "https://player.vimeo.com/video/123456",
    title: "Vimeo video",
    type: "iframe",
  });
});

test("videoEmbedFromUrl detects direct video files", () => {
  assert.deepEqual(videoEmbedFromUrl("https://example.com/demo.webm"), {
    sourceUrl: "https://example.com/demo.webm",
    title: "Video",
    type: "video",
    videoUrl: "https://example.com/demo.webm",
  });
});

test("markdownToHtml embeds standalone video links", async () => {
  const html = await markdownToHtml(
    "[https://www.youtube.com/watch?v=zztOW_yS5EU](https://www.youtube.com/watch?v=zztOW_yS5EU)",
  );

  assert.match(html, /class="video-embed"/);
  assert.match(html, /youtube-nocookie\.com\/embed\/zztOW_yS5EU/);
  assert.match(html, /allowfullscreen/);
});

test("markdownToHtml keeps inline video links as normal links", async () => {
  const html = await markdownToHtml(
    "Watch [this video](https://youtu.be/OYsF6sO5Duw) before continuing.",
  );

  assert.match(html, /Watch/);
  assert.match(html, /href="https:\/\/youtu\.be\/OYsF6sO5Duw"/);
  assert.doesNotMatch(html, /class="video-embed"/);
});
