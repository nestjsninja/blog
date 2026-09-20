import { getAllPosts } from "@/lib/api";
import { buildRssFeed } from "@/lib/feed";
import { absoluteUrl, siteConfig } from "@/lib/seo";

export const dynamic = "force-static";

export function GET() {
  const body = buildRssFeed({
    title: siteConfig.name,
    description: siteConfig.description,
    siteUrl: siteConfig.url,
    feedUrl: absoluteUrl("/rss.xml"),
    items: getAllPosts().map((post) => ({
      title: post.title,
      link: absoluteUrl(`/blog/${post.slug}`),
      guid: absoluteUrl(`/blog/${post.slug}`),
      description: post.excerpt,
      pubDate: new Date(post.date).toUTCString(),
      categories: post.tags,
    })),
  });

  return new Response(body, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
