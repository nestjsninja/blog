import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllPosts, getPostBySlug } from "@/lib/api";
import markdownToHtml from "@/lib/markdownToHtml";
import {
  getRelatedPosts,
  getSeriesNavigation,
  getTableOfContents,
  readingTime,
} from "@/lib/post-reader";
import { buildArticleMetadata } from "@/lib/seo";
import { articleJsonLd, serializeJsonLd } from "@/lib/structured-data";
import ArticleFeedback from "./article-feedback";
import styles from "./post-body.module.css";
import ReaderEnhancements from "./reader-enhancements";

type Params = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return {};
  }

  return buildArticleMetadata({
    title: post.title,
    description: post.excerpt,
    path: `/blog/${post.slug}`,
    image: {
      url: `/blog/${post.slug}/opengraph-image`,
      alt: post.title,
    },
    publishedTime: new Date(post.date).toISOString(),
    modifiedTime: new Date(post.date).toISOString(),
    authors: [post.author.name],
    tags: post.tags,
    keywords: post.tags,
  });
}

export default async function PostPage({ params }: Params) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const posts = getAllPosts();
  const content = await markdownToHtml(post.content);
  const toc = getTableOfContents(post.content);
  const relatedPosts = getRelatedPosts(post, posts);
  const seriesNavigation = getSeriesNavigation(post, posts);
  const postReadingTime = readingTime(post.content);

  return (
    <article className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-12 text-zinc-100 lg:grid-cols-[220px_minmax(0,768px)_220px] sm:py-16">
      <ReaderEnhancements />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(articleJsonLd(post)) }}
      />

      <aside className="hidden lg:block">
        {toc.length ? (
          <nav className="sticky top-24 text-sm" aria-label="Table of contents">
            <p className="font-semibold text-white">On this page</p>
            <div className="mt-3 grid gap-2 border-l border-white/10 pl-3">
              {toc.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className={`text-zinc-500 hover:text-violet-200 ${item.level === 3 ? "pl-3" : ""
                    }`}
                >
                  {item.title}
                </a>
              ))}
            </div>
          </nav>
        ) : null}
      </aside>

      <div className="min-w-0">
        <Link href="/blog" className="text-sm font-medium text-violet-300 hover:text-violet-100">
          Back to blog
        </Link>

        <header className="mt-8">
          <div className="flex flex-wrap gap-2">
            {post.tags?.map((tag) => (
              <span
                key={tag}
                className="rounded-sm bg-violet-400/10 px-2.5 py-1 text-xs font-medium text-violet-200 ring-1 ring-violet-300/15"
              >
                {tag}
              </span>
            ))}
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-normal text-white sm:text-5xl">
            {post.title}
          </h1>
          <p className="mt-5 text-xl leading-8 text-zinc-400">{post.excerpt}</p>

          <div className="mt-8 flex items-center gap-4 border-y border-white/10 py-5">
            <Image
              src={post.author.picture}
              alt={post.author.name}
              width={48}
              height={48}
              className="rounded-full"
            />
            <div>
              <p className="font-medium text-white">{post.author.name}</p>
              <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500">
                <time dateTime={post.date}>
                  {new Date(post.date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
                <span aria-hidden="true">•</span>
                <span>{postReadingTime}</span>
              </div>
            </div>
          </div>

          <div className="relative mt-8 aspect-video overflow-hidden rounded-md bg-[#171026] ring-1 ring-white/10">
            <Image
              src={post.coverImage}
              alt={post.title}
              fill
              priority
              sizes="(min-width: 768px) 768px, 100vw"
              className="object-cover"
            />
            {post.coverImageCredit ? (
              <p className="absolute bottom-0 right-0 bg-zinc-950/70 px-2 py-1 text-xs text-white">
                Photo by{" "}
                <a
                  href={post.coverImageCredit.photographerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  {post.coverImageCredit.photographerName}
                </a>
              </p>
            ) : null}
          </div>
        </header>

        {toc.length ? (
          <details className="mt-8 rounded-md border border-white/10 bg-white/[0.03] p-4 lg:hidden">
            <summary className="cursor-pointer text-sm font-semibold text-white">
              On this page
            </summary>
            <div className="mt-3 grid gap-2">
              {toc.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className={`text-sm text-zinc-400 hover:text-violet-200 ${item.level === 3 ? "pl-3" : ""
                    }`}
                >
                  {item.title}
                </a>
              ))}
            </div>
          </details>
        ) : null}

        <div
          className={styles.markdown}
          dangerouslySetInnerHTML={{ __html: content }}
        />
        <ArticleFeedback slug={post.slug} />

        {seriesNavigation ? (
          <section className="mt-12 border-t border-white/10 pt-8">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-300">
              {seriesNavigation.name}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {seriesNavigation.previous ? (
                <Link
                  href={`/blog/${seriesNavigation.previous.slug}`}
                  className="rounded-md border border-white/10 bg-white/[0.03] p-4 hover:border-violet-300/50"
                >
                  <span className="text-xs text-zinc-500">Previous</span>
                  <p className="mt-1 font-semibold text-white">
                    {seriesNavigation.previous.title}
                  </p>
                </Link>
              ) : null}
              {seriesNavigation.next ? (
                <Link
                  href={`/blog/${seriesNavigation.next.slug}`}
                  className="rounded-md border border-white/10 bg-white/[0.03] p-4 hover:border-violet-300/50"
                >
                  <span className="text-xs text-zinc-500">Next</span>
                  <p className="mt-1 font-semibold text-white">
                    {seriesNavigation.next.title}
                  </p>
                </Link>
              ) : null}
            </div>
          </section>
        ) : null}

        {relatedPosts.length ? (
          <section className="mt-12 border-t border-white/10 pt-8">
            <h2 className="text-xl font-semibold text-white">Related posts</h2>
            <div className="mt-5 grid gap-4">
              {relatedPosts.map((relatedPost) => (
                <Link
                  key={relatedPost.slug}
                  href={`/blog/${relatedPost.slug}`}
                  className="rounded-md border border-white/10 bg-white/[0.03] p-4 hover:border-violet-300/50"
                >
                  <p className="font-semibold text-white">{relatedPost.title}</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">
                    {relatedPost.excerpt}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-24 rounded-md border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-400">
          <p className="font-semibold text-white">Article tools</p>
          <p className="mt-2">{postReadingTime}</p>
          <p className="mt-2">Code blocks include copy buttons when available.</p>
        </div>
      </aside>
    </article>
  );
}
