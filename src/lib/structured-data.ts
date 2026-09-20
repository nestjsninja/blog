import type { Post } from "@/interfaces/post";
import { absoluteUrl, siteConfig } from "@/lib/seo";

export function serializeJsonLd(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
  };
}

export function blogJsonLd(posts: Post[]) {
  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: `${siteConfig.name} Blog`,
    url: absoluteUrl("/blog"),
    blogPost: posts.map((post) => ({
      "@type": "BlogPosting",
      headline: post.title,
      datePublished: post.date,
      url: absoluteUrl(`/blog/${post.slug}`),
    })),
  };
}

export function articleJsonLd(post: Post) {
  const url = absoluteUrl(`/blog/${post.slug}`);

  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    // Google truncates headlines past 110 characters in rich results.
    headline: post.title.slice(0, 110),
    description: post.excerpt,
    image: absoluteUrl(post.ogImage.url),
    datePublished: post.date,
    dateModified: post.date,
    inLanguage: "en",
    author: {
      "@type": "Person",
      name: post.author.name,
      url: siteConfig.url,
    },
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      url: siteConfig.url,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl("/nestjs-ninja.png"),
      },
    },
    isPartOf: {
      "@type": "Blog",
      name: `${siteConfig.name} Blog`,
      url: absoluteUrl("/blog"),
    },
    ...(post.tags?.length
      ? { keywords: post.tags.join(", "), articleSection: post.tags[0] }
      : {}),
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    url,
  };
}

/**
 * Breadcrumbs for a post.
 *
 * Google uses this to replace the bare URL in a search result with a Home > Blog > Title
 * trail, which takes up more space and reads better. It is one of the cheapest structured-data
 * wins available, and the site had none.
 */
export function breadcrumbJsonLd(post: Post) {
  const trail = [
    { name: "Home", item: absoluteUrl("/") },
    { name: "Blog", item: absoluteUrl("/blog") },
    { name: post.title, item: absoluteUrl(`/blog/${post.slug}`) },
  ];

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: entry.name,
      item: entry.item,
    })),
  };
}
