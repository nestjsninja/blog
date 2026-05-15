import { getAllPosts } from "@/lib/api";
import {
  readingTime,
  stripMarkdownForSearch,
} from "@/lib/post-reader";
import { buildPageMetadata } from "@/lib/seo";
import { blogJsonLd, serializeJsonLd } from "@/lib/structured-data";
import BlogSearch from "./blog-search";

export const metadata = buildPageMetadata({
  title: "Blog",
  description:
    "Articles on NestJS, TypeScript, backend architecture, and practical product development.",
  path: "/blog",
  keywords: ["NestJS blog", "backend architecture", "TypeScript", "Node.js"],
});

export default function BlogIndex() {
  const posts = getAllPosts();
  const searchablePosts = posts.map((post) => ({
    coverImage: post.coverImage,
    date: post.date,
    excerpt: post.excerpt,
    readingTime: readingTime(post.content),
    searchText: [
      post.title,
      post.excerpt,
      post.tags?.join(" "),
      stripMarkdownForSearch(post.content),
    ]
      .join(" ")
      .toLowerCase(),
    slug: post.slug,
    tags: post.tags,
    title: post.title,
  }));

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-14 text-zinc-100 sm:py-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(blogJsonLd(posts)) }}
      />
      <div className="mb-12 max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-300">
          Writing
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-normal text-white sm:text-5xl">
          Blog
        </h1>
        <p className="mt-4 text-lg leading-8 text-zinc-400">
          Technical notes, implementation guides, and durable lessons from NestJS
          backend projects.
        </p>
      </div>

      <BlogSearch posts={searchablePosts} />
    </main>
  );
}
