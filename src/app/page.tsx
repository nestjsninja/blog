import Image from "next/image";
import Link from "next/link";
import { getAllPosts } from "@/lib/api";
import { readingTime } from "@/lib/post-reader";
import { buildPageMetadata } from "@/lib/seo";
import { serializeJsonLd, websiteJsonLd } from "@/lib/structured-data";

export const metadata = buildPageMetadata({
  title: "Backend Architecture Notes",
  description:
    "A markdown-powered engineering blog about NestJS, TypeScript, backend architecture, and pragmatic development workflows.",
  path: "/",
});

const ninjaLogo = "/nestjs-ninja.png";

export default function Home() {
  const allPosts = getAllPosts();
  const featuredPost = allPosts[0] ?? null;
  const posts = allPosts.slice(featuredPost ? 1 : 0, featuredPost ? 6 : 5);
  const yearsCovered = new Set(
    allPosts.map((post) => new Date(post.date).getFullYear()),
  ).size;
  const topTags = Object.entries(
    allPosts.reduce<Record<string, number>>((accumulator, post) => {
      for (const tag of post.tags ?? []) {
        accumulator[tag] = (accumulator[tag] ?? 0) + 1;
      }

      return accumulator;
    }, {}),
  )
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return left[0].localeCompare(right[0]);
    })
    .slice(0, 5);

  return (
    <main className="bg-[#0b0714] text-zinc-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(websiteJsonLd()) }}
      />
      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,#3b176f_0,#12091f_36%,#0b0714_72%)]">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-12 sm:py-16 lg:grid-cols-[1fr_420px] lg:items-center">
          <div>
            <div className="mb-7 flex items-center gap-4">
              <Image
                src={ninjaLogo}
                alt="NestJS Ninja logo"
                width={64}
                height={64}
                className="rounded-lg ring-1 ring-violet-300/30"
                priority
              />
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-300">
                  NestJS Ninja
                </p>
                <p className="mt-1 text-sm text-zinc-400">
                  Backend lessons & architecture notes
                </p>
              </div>
            </div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-fuchsia-300">
              TypeScript servers
            </p>
            <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-normal text-white sm:text-6xl">
              Build sharper NestJS systems.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
              Practical writing on modules, providers, queues, testing,
              microservices, and the decisions that keep backend codebases
              easy to change.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/blog"
                className="rounded-md bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_32px_rgba(139,92,246,0.35)] hover:bg-violet-400"
              >
                Read the blog
              </Link>
              <a
                href="/sitemap.xml"
                className="rounded-md border border-white/15 px-4 py-2.5 text-sm font-semibold text-zinc-200 hover:border-violet-300/60 hover:text-white"
              >
                Sitemap
              </a>
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-white/10 bg-[#120d1f] shadow-2xl shadow-violet-950/40">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-rose-400" />
              <span className="h-3 w-3 rounded-full bg-amber-300" />
              <span className="h-3 w-3 rounded-full bg-emerald-400" />
              <span className="ml-3 text-xs text-zinc-500">
                app.module.ts
              </span>
            </div>
            <pre className="overflow-x-auto p-5 text-sm leading-7 text-zinc-200">
              <code>{`@Module({
  imports: [
    ConfigModule.forRoot(),
    QueueModule,
    ObservabilityModule,
  ],
  controllers: [ArticlesController],
  providers: [ArticlesService],
})
export class AppModule {}`}</code>
            </pre>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 py-10 sm:py-12">
        <div className="grid gap-4 lg:grid-cols-[220px_220px_1fr]">
          <article className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-300">
              Archive
            </p>
            <p className="mt-4 text-3xl font-semibold text-white">{allPosts.length}</p>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              practical posts on NestJS, testing, architecture, and backend delivery.
            </p>
          </article>

          <article className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-fuchsia-300">
              Coverage
            </p>
            <p className="mt-4 text-3xl font-semibold text-white">{yearsCovered}</p>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              years of notes, experiments, and backend implementation write-ups.
            </p>
          </article>

          <article className="rounded-lg border border-white/10 bg-[#120d1f] p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-300">
                  Topics
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  What you will find here
                </h2>
              </div>
              <Link
                href="/blog"
                className="text-sm font-semibold text-violet-300 hover:text-violet-100"
              >
                Browse archive
              </Link>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              {topTags.map(([tag, count]) => (
                <Link
                  key={tag}
                  href="/blog"
                  className="rounded-full border border-violet-300/25 bg-violet-400/10 px-3 py-1.5 text-sm text-violet-100 hover:border-violet-200/50 hover:text-white"
                >
                  {tag}
                  <span className="ml-2 text-violet-300/80">{count}</span>
                </Link>
              ))}
            </div>
          </article>
        </div>
      </section>

      {featuredPost ? (
        <section className="mx-auto w-full max-w-6xl px-5 py-8 sm:py-10">
          <div className="mb-8 flex items-end justify-between gap-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-fuchsia-300">
                Featured
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-normal text-white">
                Start with the latest deep dive
              </h2>
            </div>
            <Link
              href={`/blog/${featuredPost.slug}`}
              className="text-sm font-semibold text-violet-300 hover:text-violet-100"
            >
              Read featured post
            </Link>
          </div>

          <article className="grid gap-6 overflow-hidden rounded-xl border border-white/10 bg-[#120d1f] p-4 shadow-2xl shadow-violet-950/20 md:grid-cols-[1.2fr_1fr] md:p-5">
            <Link
              href={`/blog/${featuredPost.slug}`}
              className="group relative aspect-[16/10] overflow-hidden rounded-lg bg-[#171026] ring-1 ring-white/10"
              aria-label={featuredPost.title}
            >
              <Image
                src={featuredPost.coverImage}
                alt={featuredPost.title}
                fill
                priority
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover transition duration-300 group-hover:scale-105"
              />
            </Link>

            <div className="flex flex-col justify-center">
              <div className="flex flex-wrap gap-2">
                {featuredPost.tags?.slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-sm bg-violet-400/10 px-2.5 py-1 text-xs font-medium text-violet-200 ring-1 ring-violet-300/15"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
                <time dateTime={featuredPost.date}>
                  {new Date(featuredPost.date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
                <span aria-hidden="true">•</span>
                <span>{readingTime(featuredPost.content)}</span>
              </div>

              <h3 className="mt-3 text-3xl font-semibold tracking-normal text-white">
                <Link
                  href={`/blog/${featuredPost.slug}`}
                  className="hover:text-violet-300"
                >
                  {featuredPost.title}
                </Link>
              </h3>
              <p className="mt-4 text-base leading-8 text-zinc-400">
                {featuredPost.excerpt}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={`/blog/${featuredPost.slug}`}
                  className="rounded-md bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-400"
                >
                  Read article
                </Link>
                <Link
                  href="/blog"
                  className="rounded-md border border-white/15 px-4 py-2.5 text-sm font-semibold text-zinc-200 hover:border-violet-300/60 hover:text-white"
                >
                  More recent posts
                </Link>
              </div>
            </div>
          </article>
        </section>
      ) : null}

      <section className="mx-auto w-full max-w-6xl px-5 py-14 sm:py-16">
        <div className="mb-8 flex items-end justify-between gap-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-300">
              Latest
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-normal text-white">
              More recent posts
            </h2>
          </div>
          <Link href="/blog" className="text-sm font-semibold text-violet-300 hover:text-violet-100">
            View all
          </Link>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {posts.map((post) => (
            <article
              key={post.slug}
              className="rounded-lg border border-white/10 bg-white/[0.03] p-5"
            >
              <time className="text-sm text-zinc-500" dateTime={post.date}>
                {new Date(post.date).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
              <h3 className="mt-2 text-xl font-semibold text-white">
                <Link href={`/blog/${post.slug}`} className="hover:text-violet-300">
                  {post.title}
                </Link>
              </h3>
              <p className="mt-3 text-base leading-7 text-zinc-400">
                {post.excerpt}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
