import Image from "next/image";
import Link from "next/link";
import { getFeaturedPosts } from "@/lib/api";
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
  const posts = getFeaturedPosts(3);

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

      <section className="mx-auto w-full max-w-6xl px-5 py-14 sm:py-16">
        <div className="mb-8 flex items-end justify-between gap-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-300">
              Latest
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-normal text-white">
              Recent posts
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
