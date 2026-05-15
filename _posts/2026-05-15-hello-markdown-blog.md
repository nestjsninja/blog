---
title: "Hello Markdown Blog"
excerpt: "A first post showing frontmatter, GitHub-flavored markdown, tables, and highlighted code in this Next.js blog."
coverImage: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?q=80&w=1400&auto=format&fit=crop"
coverImageCredit:
  photographerName: "Andrew Neel"
  photographerUrl: "https://unsplash.com/@andrewtneel"
  sourceUrl: "https://unsplash.com/photos/macbook-pro-white-ceramic-mug-and-black-smartphone-on-table-cckf4TsHAuw"
date: "2026-05-15T12:00:00.000Z"
author:
  name: "Henrique Weiand"
  picture: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&w=160&h=160&auto=format&fit=crop"
ogImage:
  url: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?q=80&w=1200&auto=format&fit=crop"
tags:
  - Next.js
  - Markdown
  - SEO
---

This blog stores posts as markdown files in the repository. That keeps writing close to the code, makes every change versioned, and avoids running a separate CMS for a simple publishing workflow.

## What this setup supports

- Frontmatter metadata parsed with `gray-matter`
- GitHub-flavored markdown through `remark-gfm`
- Heading anchors via `rehype-slug`
- Syntax highlighting with `rehype-highlight`
- Static generation for every post route

## Code blocks

```ts
type PostPreview = {
  slug: string;
  title: string;
  excerpt: string;
};

export function publish(post: PostPreview) {
  return `/blog/${post.slug}`;
}
```

## Tables

| Feature | Status |
| ------- | ------ |
| Static routes | Ready |
| Sitemap | Ready |
| Robots.txt | Ready |
| Article metadata | Ready |

The result is a small, fast blog that can be deployed as a regular Next.js application.
