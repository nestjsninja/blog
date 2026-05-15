# Project Rules

This is a Next.js 16 App Router markdown blog for NestJS Ninja.

## Important Next.js Note

This project uses Next.js `16.2.6`. APIs and conventions may differ from older
Next.js versions. When unsure, read the local docs in `node_modules/next/dist/docs/`
before changing route, metadata, image, or config behavior.

## Stack

- Next.js App Router with `src/app`
- React 19
- TypeScript
- Tailwind CSS v4 via `@import "tailwindcss"` in `src/app/globals.css`
- Markdown posts in `_posts`
- Raw unpublished drafts in `_backlog`
- `gray-matter` for frontmatter
- `remark`/`rehype` for Markdown to HTML
- `highlight.js` for code highlighting
- Cloudflare Pages deployment through `@cloudflare/next-on-pages`

## Main Files

- `src/lib/api.ts`: reads `_posts` from disk and sorts posts by date.
- `src/lib/markdownToHtml.ts`: converts Markdown to HTML.
- `src/lib/seo.ts`: shared metadata helpers and site config.
- `src/lib/structured-data.ts`: JSON-LD helpers.
- `src/lib/post-og-data.ts`: Edge-safe data used by generated social images.
- `src/app/page.tsx`: homepage.
- `src/app/blog/page.tsx`: blog index.
- `src/app/blog/[slug]/page.tsx`: post page and article metadata.
- `src/app/blog/[slug]/opengraph-image.tsx`: generated social share image.
- `src/app/blog/[slug]/twitter-image.tsx`: generated Twitter image.
- `src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/manifest.ts`: SEO files.
- `wrangler.toml`: Cloudflare Pages output and compatibility config.

## Backlog Drafts

`_backlog` is a private working area for raw ideas and rough source material.
Files in `_backlog` are not published and are not read by the app.

Use `_backlog` for:

- rough outlines
- pasted notes
- links to articles or docs
- incomplete thoughts
- technical findings
- transcripts or command outputs
- prompts for future posts

Suggested backlog filename:

```text
topic-short-name.md
```

or, when a date is important:

```text
YYYY-MM-DD-topic-short-name.md
```

When asked to turn a backlog item into a post:

1. Read the referenced `_backlog/*.md` file.
2. Preserve the user's technical intent, but rewrite into a clear publishable
   article.
3. Do not publish raw notes directly.
4. Create a new file in `_posts` using `YYYY-MM-DD-slug.md`.
5. Add the required frontmatter.
6. Use `/nestjs-ninja.png` for `coverImage`, `author.picture`, and
   `ogImage.url` unless the user provides a better local/public asset.
7. Add the new slug to `src/lib/post-og-data.ts`.
8. Keep the backlog file in place unless the user explicitly asks to move,
   archive, or delete it.
9. Run verification commands before finishing.

If a backlog file is ambiguous, make a reasonable article structure from the
available notes and mention any assumptions in the final response.

## Writing Posts

Posts are Markdown files in `_posts`.

Filename format:

```text
YYYY-MM-DD-slug.md
```

Required frontmatter:

```yaml
---
title: "Post title"
excerpt: "Short summary used on listing pages and metadata."
coverImage: "/nestjs-ninja.png"
date: "2025-02-01T12:00:00.000Z"
author:
  name: "Henrique Weiand"
  picture: "/nestjs-ninja.png"
ogImage:
  url: "/nestjs-ninja.png"
tags:
  - NestJS
  - TypeScript
---
```

After adding a post, also update `src/lib/post-og-data.ts` with the same slug,
title, excerpt, date, author, and tags. The generated Open Graph/Twitter image
routes run on the Edge runtime for Cloudflare, so they cannot read Markdown from
the filesystem.

The route slug is the filename without `.md`, for example:

```text
_posts/2025-02-01-real-time-chat-with-nestjs-socket-io.md
/blog/2025-02-01-real-time-chat-with-nestjs-socket-io
```

## Social Sharing Images

Each post has generated share images:

```text
/blog/[slug]/opengraph-image/
/blog/[slug]/twitter-image/
```

These routes use `next/og` and must export:

```ts
export const runtime = "edge";
```

Do not import `src/lib/api.ts`, `fs`, `gray-matter`, or any Node-only code into
these image routes. Use `src/lib/post-og-data.ts` instead.

## Cloudflare Pages

Cloudflare build settings:

```text
Build command: npx @cloudflare/next-on-pages@1
Build output directory: .vercel/output/static
```

`wrangler.toml` must include:

```toml
pages_build_output_dir = ".vercel/output/static"
compatibility_flags = ["nodejs_compat"]
```

Also enable `nodejs_compat` in Cloudflare Pages compatibility flags for both
Production and Preview if the dashboard does not pick it up from `wrangler.toml`.

Set this environment variable in Cloudflare:

```text
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

It controls canonical URLs, Open Graph URLs, sitemap URLs, and robots.txt.

## Verification

Run these before considering changes done:

```bash
npm run lint
npm run build
npx @cloudflare/next-on-pages@1
```

If `next-on-pages` fails due to stale generated output, remove generated build
artifacts and retry:

```bash
rm -rf .next .vercel/output
npm run build
npx @cloudflare/next-on-pages@1
```

## Design Direction

The site uses a dark NestJS/NestJS Ninja style:

- dark background
- purple/violet accents
- compact documentation-style layout
- local logo at `public/nestjs-ninja.png`

Keep new UI changes consistent with that style.
