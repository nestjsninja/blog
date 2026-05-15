import Image from "next/image";
import Link from "next/link";
import { getAllPosts } from "@/lib/api";
import { buildPageMetadata } from "@/lib/seo";
import { blogJsonLd, serializeJsonLd } from "@/lib/structured-data";

export const metadata = buildPageMetadata({
  title: "Blog",
  description:
    "Articles on software engineering, Next.js, React, TypeScript, and practical product development.",
  path: "/blog",
  keywords: ["software engineering blog", "Next.js blog", "React", "TypeScript"],
});

export default function BlogIndex() {
  const posts = getAllPosts();

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-14 sm:py-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(blogJsonLd(posts)) }}
      />
      <div className="mb-12 max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
          Writing
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-normal text-zinc-950 sm:text-5xl">
          Blog
        </h1>
        <p className="mt-4 text-lg leading-8 text-zinc-600">
          Technical notes, implementation guides, and durable lessons from
          building software.
        </p>
      </div>

      <div className="grid gap-8">
        {posts.map((post) => (
          <article
            key={post.slug}
            className="grid gap-5 border-t border-zinc-200 pt-8 sm:grid-cols-[260px_1fr]"
          >
            <Link
              href={`/blog/${post.slug}`}
              className="group relative aspect-video overflow-hidden rounded-md bg-zinc-100 sm:aspect-[4/3]"
              aria-label={post.title}
            >
              <Image
                src={post.coverImage}
                alt={post.title}
                fill
                sizes="(min-width: 640px) 260px, 100vw"
                className="object-cover transition duration-300 group-hover:scale-105"
              />
            </Link>
            <div>
              <time className="text-sm text-zinc-500" dateTime={post.date}>
                {new Date(post.date).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
              <h2 className="mt-2 text-2xl font-semibold tracking-normal text-zinc-950">
                <Link href={`/blog/${post.slug}`} className="hover:text-teal-700">
                  {post.title}
                </Link>
              </h2>
              <p className="mt-3 text-base leading-7 text-zinc-600">
                {post.excerpt}
              </p>
              {post.tags?.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-sm bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
