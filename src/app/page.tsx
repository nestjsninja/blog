import Image from "next/image";
import Link from "next/link";
import { getFeaturedPosts } from "@/lib/api";
import { buildPageMetadata } from "@/lib/seo";
import { serializeJsonLd, websiteJsonLd } from "@/lib/structured-data";

export const metadata = buildPageMetadata({
  title: "Notes on Software and Product",
  description:
    "A markdown-powered engineering blog about Next.js, React, TypeScript, and product development.",
  path: "/",
});

export default function Home() {
  const posts = getFeaturedPosts(3);

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(websiteJsonLd()) }}
      />
      <section className="border-b border-zinc-200 bg-zinc-50">
        <div className="mx-auto grid w-full max-w-5xl gap-10 px-5 py-14 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
              Engineering notes
            </p>
            <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-normal text-zinc-950 sm:text-6xl">
              Henrique Weiand
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600">
              A markdown-powered blog for practical writing about software
              engineering, Next.js, React, TypeScript, and product decisions.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/blog"
                className="rounded-md bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
              >
                Read the blog
              </Link>
              <a
                href="/sitemap.xml"
                className="rounded-md border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-800 hover:border-zinc-400"
              >
                Sitemap
              </a>
            </div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-zinc-200">
            <Image
              src="https://images.unsplash.com/photo-1515879218367-8466d910aaa4?q=80&w=1200&auto=format&fit=crop"
              alt="A code editor open on a laptop"
              fill
              priority
              sizes="(min-width: 1024px) 460px, 100vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-5 py-14 sm:py-16">
        <div className="mb-8 flex items-end justify-between gap-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
              Latest
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950">
              Recent posts
            </h2>
          </div>
          <Link href="/blog" className="text-sm font-semibold text-teal-700 hover:text-teal-900">
            View all
          </Link>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {posts.map((post) => (
            <article
              key={post.slug}
              className="border-t border-zinc-200 pt-6"
            >
              <time className="text-sm text-zinc-500" dateTime={post.date}>
                {new Date(post.date).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
              <h3 className="mt-2 text-xl font-semibold text-zinc-950">
                <Link href={`/blog/${post.slug}`} className="hover:text-teal-700">
                  {post.title}
                </Link>
              </h3>
              <p className="mt-3 text-base leading-7 text-zinc-600">
                {post.excerpt}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
