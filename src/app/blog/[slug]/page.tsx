import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllPosts, getPostBySlug } from "@/lib/api";
import markdownToHtml from "@/lib/markdownToHtml";
import { buildArticleMetadata } from "@/lib/seo";
import { articleJsonLd, serializeJsonLd } from "@/lib/structured-data";
import styles from "./post-body.module.css";

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
    image: { url: post.ogImage.url, alt: post.title },
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

  const content = await markdownToHtml(post.content);

  return (
    <article className="mx-auto w-full max-w-3xl px-5 py-12 text-zinc-100 sm:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(articleJsonLd(post)) }}
      />
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
            <time className="text-sm text-zinc-500" dateTime={post.date}>
              {new Date(post.date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
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

      <div
        className={styles.markdown}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </article>
  );
}
