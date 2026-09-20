/** Minimal RSS 2.0 generation. No dependency for something this small. */

export type FeedItem = {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
  categories?: string[];
};

export type FeedOptions = {
  title: string;
  description: string;
  siteUrl: string;
  feedUrl: string;
  items: FeedItem[];
  now?: Date;
};

/**
 * Escapes the five XML entities.
 *
 * Post titles here contain colons and ampersands, and excerpts contain quotes, so this is not
 * theoretical: one unescaped `&` makes the whole document unparseable and every reader drops
 * the feed silently.
 */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildRssFeed({
  title,
  description,
  siteUrl,
  feedUrl,
  items,
  now = new Date(),
}: FeedOptions): string {
  const entries = items
    .map((item) =>
      [
        "    <item>",
        `      <title>${escapeXml(item.title)}</title>`,
        `      <link>${escapeXml(item.link)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(item.guid)}</guid>`,
        `      <pubDate>${item.pubDate}</pubDate>`,
        `      <description>${escapeXml(item.description)}</description>`,
        ...(item.categories ?? []).map(
          (category) => `      <category>${escapeXml(category)}</category>`,
        ),
        "    </item>",
      ].join("\n"),
    )
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(title)}</title>`,
    `    <link>${escapeXml(siteUrl)}</link>`,
    `    <description>${escapeXml(description)}</description>`,
    "    <language>en</language>",
    `    <lastBuildDate>${now.toUTCString()}</lastBuildDate>`,
    `    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />`,
    entries,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}
