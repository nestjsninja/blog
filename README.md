# Henrique Weiand Blog

A markdown-powered Next.js blog with static post generation, article metadata,
JSON-LD, sitemap, robots.txt, and manifest support.

## Development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Content

Posts live in `_posts` as Markdown files with frontmatter. Each file becomes a
static page under `/blog/[slug]`.

## Verify

```bash
npm run lint
npm run build
```

The production build uses Next.js static export and writes deployable files to
`out/`.

## Cloudflare Pages

Use these settings:

```text
Framework preset: Next.js (Static HTML Export)
Build command: npm run build
Build output directory: out
```

Set this environment variable in Cloudflare Pages:

```text
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

That value is used for canonical URLs, Open Graph URLs, the sitemap, and
robots.txt.
