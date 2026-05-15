"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

export type SearchPost = {
  coverImage: string;
  date: string;
  excerpt: string;
  readingTime: string;
  searchText: string;
  slug: string;
  tags?: string[];
  title: string;
};

type BlogSearchProps = {
  posts: SearchPost[];
};

export default function BlogSearch({ posts }: BlogSearchProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredPosts = useMemo(() => {
    if (!normalizedQuery) {
      return posts;
    }

    return posts.filter((post) => post.searchText.includes(normalizedQuery));
  }, [normalizedQuery, posts]);

  return (
    <>
      <div className="mb-8">
        <label htmlFor="post-search" className="sr-only">
          Search posts
        </label>
        <input
          id="post-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by topic, tag, or code..."
          className="w-full rounded-md border border-white/10 bg-white/[0.03] px-4 py-3 text-base text-white outline-none placeholder:text-zinc-600 focus:border-violet-300/70"
        />
        <p className="mt-2 text-sm text-zinc-500">
          {filteredPosts.length} of {posts.length} posts
        </p>
      </div>

      <div className="grid gap-8">
        {filteredPosts.map((post) => (
          <article
            key={post.slug}
            className="grid gap-5 border-t border-white/10 pt-8 sm:grid-cols-[260px_1fr]"
          >
            <Link
              href={`/blog/${post.slug}`}
              className="group relative aspect-video overflow-hidden rounded-md bg-[#171026] ring-1 ring-white/10 sm:aspect-[4/3]"
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
              <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500">
                <time dateTime={post.date}>
                  {new Date(post.date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
                <span aria-hidden="true">•</span>
                <span>{post.readingTime}</span>
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-normal text-white">
                <Link href={`/blog/${post.slug}`} className="hover:text-violet-300">
                  {post.title}
                </Link>
              </h2>
              <p className="mt-3 text-base leading-7 text-zinc-400">
                {post.excerpt}
              </p>
              {post.tags?.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-sm bg-violet-400/10 px-2.5 py-1 text-xs font-medium text-violet-200 ring-1 ring-violet-300/15"
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
    </>
  );
}
