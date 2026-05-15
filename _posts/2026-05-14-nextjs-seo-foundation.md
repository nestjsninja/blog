---
title: "A Practical Next.js SEO Foundation"
excerpt: "The baseline SEO pieces every App Router site should have: root metadata, canonical URLs, sitemap, robots.txt, and article metadata."
coverImage: "https://images.unsplash.com/photo-1432888622747-4eb9a8f2c293?q=80&w=1400&auto=format&fit=crop"
coverImageCredit:
  photographerName: "William Iven"
  photographerUrl: "https://unsplash.com/@firmbee"
  sourceUrl: "https://unsplash.com/photos/person-using-macbook-pro-SYTO3xs06fU"
date: "2026-05-14T12:00:00.000Z"
author:
  name: "Henrique Weiand"
  picture: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&w=160&h=160&auto=format&fit=crop"
ogImage:
  url: "https://images.unsplash.com/photo-1432888622747-4eb9a8f2c293?q=80&w=1200&auto=format&fit=crop"
tags:
  - SEO
  - Next.js
  - Metadata
---

Search visibility starts with predictable metadata. A good foundation does not need to be complicated, but it does need to be consistent across every route.

## Baseline checklist

1. Set `metadataBase` in the root layout.
2. Use a title template so child routes inherit the site name.
3. Give each page a canonical URL.
4. Generate `/sitemap.xml` from the same content source as the site.
5. Serve `/robots.txt` with the sitemap location.
6. Add article metadata for blog posts.

## Why helpers help

Reusable helpers keep metadata consistent as the site grows. A blog index and an article page need different Open Graph types, but they should still share the same canonical URL, title, and image normalization rules.

> SEO implementation is easier to maintain when content, metadata, and sitemaps come from the same source of truth.

This project keeps those rules in `src/lib/seo.ts` and uses the markdown post frontmatter for article-specific fields.
