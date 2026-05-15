# Henrique Weiand Blog

A markdown-powered Next.js blog with static post generation, article metadata,
JSON-LD, sitemap, robots.txt, and manifest support.

## Development

This project uses npm. Keep `package-lock.json` committed and do not add a
second package-manager lockfile.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

`NEXT_PUBLIC_SITE_URL` controls canonical URLs, Open Graph URLs, the sitemap,
and robots.txt. Keep it set to the production domain for deployed builds.

## Content

Posts live in `_posts` as Markdown files with frontmatter. Each file becomes a
static page under `/blog/[slug]`.

Required frontmatter:

```yaml
title: "Post title"
excerpt: "Short description used in cards and metadata."
coverImage: "/blog-assets/post-slug/cover.png"
date: "2025-01-01T12:00:00.000Z"
author:
  name: "Henrique Weiand"
  picture: "/nestjs-ninja.png"
ogImage:
  url: "/blog-assets/post-slug/cover.png"
tags:
  - NestJS
```

## Cover Images

Generate missing post cover images with:

```bash
npm run covers:generate
```

The script scans `_posts`, skips posts that already have `coverImage`, generates
a cover from the article title, excerpt, tags, and body, saves it under
`public/blog-assets/<post-slug>/cover.png`, and updates the post frontmatter.
It writes both `coverImage` and `ogImage.url` to the generated image path.

Set `OPENAI_API_KEY` in `.env.local` before running it. Optional settings are
available in `.env.example`.

Useful commands:

```bash
npm run covers:generate -- --dry-run
npm run covers:generate -- --limit 3
npm run covers:generate -- --all
npm run covers:generate -- --file-name cover.png
```

Use `--all` to regenerate covers for every current post, including posts that
already have `coverImage`. `--regenerate-all` and `--force` are supported aliases
for the same behavior.

The default generated filename is `cover.png`. Override it with `--file-name` or
`OPENAI_COVER_IMAGE_FILENAME`.

## Verify

```bash
npm run lint
npm test
npm run build
npm run quality:gate
```

The regular Next.js build is useful for local verification.

`quality:gate` is the same command used by GitHub Actions. It checks:

- every post has a `coverImage`
- unit tests pass and coverage is measured
- ESLint passes
- the production build passes
- `npm audit --audit-level=high` passes

On pull requests, GitHub Actions also generates coverage on the base branch and
the quality gate summary shows a baseline/current/delta table for line, branch,
and function coverage.

## Git Hooks

Husky runs a pre-commit hook that:

```bash
npm run covers:generate
npm test
npm run lint
npm run build
```

`covers:generate` only creates covers for posts missing `coverImage`. If the
hook generates or updates post/asset files, the commit stops so you can stage
those generated files and commit again.

## Dependency Updates

Dependabot is configured in `.github/dependabot.yml`.

It opens weekly pull requests for:

- npm patch and minor updates, grouped separately
- GitHub Actions updates

Major npm updates are ignored by default to avoid surprise breaking changes.
Each Dependabot PR still has to pass the quality gate before merge.

## Cloudflare Pages

Use these settings:

```text
Framework preset: Next.js
Build command: npx @cloudflare/next-on-pages@1
Build output directory: .vercel/output/static
```

Cloudflare should install with npm. The repo pins npm in `package.json` and only
commits `package-lock.json`, so Cloudflare Pages should not try to run Yarn.

Enable the `nodejs_compat` compatibility flag for both production and preview
environments. The same flag is also declared in `wrangler.toml`.

Set this environment variable in Cloudflare Pages:

```text
NEXT_PUBLIC_SITE_URL=https://nestjs-ninja.com
```

That value is used for canonical URLs, Open Graph URLs, the sitemap, and
robots.txt.

`OPENAI_API_KEY` is only needed locally when generating cover images. It is not
required for normal builds unless you run the cover generation script in CI.
