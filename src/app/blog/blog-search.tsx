"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { filterPosts } from "@/lib/post-filter";

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
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // Read ?tag= from the URL on mount (e.g. when arriving from the home page).
  // Done in an effect (not a lazy initializer) so the server still renders the
  // full list into static HTML for SEO, then the client narrows it after mount.
  useEffect(() => {
    const tag = new URLSearchParams(window.location.search).get("tag");
    if (tag) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from the URL on mount
      setActiveTag(tag);
    }
  }, []);

  function selectTag(tag: string | null) {
    setActiveTag(tag);
    const url = tag ? `/blog?tag=${encodeURIComponent(tag)}` : "/blog";
    window.history.replaceState(null, "", url);
  }

  const filteredPosts = useMemo(
    () => filterPosts(posts, { query, tag: activeTag }),
    [activeTag, query, posts],
  );

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
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <p className="text-sm text-zinc-500">
            {filteredPosts.length} of {posts.length} posts
          </p>
          {activeTag ? (
            <button
              type="button"
              onClick={() => selectTag(null)}
              className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/90 px-3 py-1 text-xs font-medium text-white hover:bg-violet-400"
            >
              Tag: {activeTag}
              <span aria-hidden="true">✕</span>
              <span className="sr-only">Clear tag filter</span>
            </button>
          ) : null}
        </div>
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
                    <button
                      key={tag}
                      type="button"
                      onClick={() => selectTag(tag)}
                      aria-pressed={tag === activeTag}
                      className={`rounded-sm px-2.5 py-1 text-xs font-medium ring-1 transition ${
                        tag === activeTag
                          ? "bg-violet-500/90 text-white ring-violet-300/40"
                          : "bg-violet-400/10 text-violet-200 ring-violet-300/15 hover:bg-violet-400/20 hover:text-white"
                      }`}
                    >
                      {tag}
                    </button>
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
