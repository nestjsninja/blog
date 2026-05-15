import Link from "next/link";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Contribute",
  description:
    "Contribute ideas, fixes, examples, and practical NestJS projects to the NestJS Ninja community.",
  path: "/community",
  keywords: ["NestJS community", "contribute", "backend articles", "open source"],
});

const contributionPaths = [
  {
    title: "Share a project",
    description:
      "Send a NestJS project, architecture decision, integration, or bug you solved. Practical examples are the best source for new articles.",
    href: "https://github.com/nestjsninja/blog/issues/new?title=Project%20idea%3A%20&body=Project%20link%3A%0AWhat%20problem%20does%20it%20solve%3F%0AWhat%20should%20the%20article%20explain%3F",
    label: "Submit project idea",
  },
  {
    title: "Suggest an article",
    description:
      "Ask for a topic you want explained: tests, modules, queues, authentication, deployment, observability, or anything around backend architecture.",
    href: "https://github.com/nestjsninja/blog/issues/new?title=Article%20request%3A%20&body=Topic%3A%0AContext%3A%0AWhat%20would%20make%20this%20useful%3F",
    label: "Request topic",
  },
  {
    title: "Fix a post",
    description:
      "Found a typo, broken link, outdated command, missing image, or confusing explanation? Open a small pull request with the correction.",
    href: "https://github.com/nestjsninja/blog",
    label: "Open repository",
  },
  {
    title: "Contribute code",
    description:
      "Improve the reader experience, automation, quality gate, cover generation, or markdown rendering. Keep the changes focused and tested.",
    href: "https://github.com/nestjsninja/blog/pulls",
    label: "Create pull request",
  },
];

const contributionChecklist = [
  "Keep examples runnable or link to a public repository.",
  "Mention required services like Docker, databases, queues, or API keys.",
  "Prefer small pull requests with one clear goal.",
  "Run npm run quality:gate before opening a pull request.",
  "Use the existing practical, first-person tutorial tone for posts.",
];

export default function CommunityPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-14 text-zinc-100 sm:py-20">
      <section className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-300">
          Community
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-normal text-white sm:text-5xl">
          Contribute to NestJS Ninja
        </h1>
        <p className="mt-5 text-lg leading-8 text-zinc-400">
          This blog works better when it is close to real projects. If you have
          a problem you solved, a topic you want to understand, or a fix for an
          existing article, there is a simple path to contribute.
        </p>
      </section>

      <section className="mt-12 grid gap-5 md:grid-cols-2">
        {contributionPaths.map((item) => (
          <article
            key={item.title}
            className="rounded-md border border-white/10 bg-white/[0.03] p-5"
          >
            <h2 className="text-xl font-semibold text-white">{item.title}</h2>
            <p className="mt-3 text-base leading-7 text-zinc-400">
              {item.description}
            </p>
            <a
              href={item.href}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex rounded-md border border-violet-300/30 px-3 py-2 text-sm font-semibold text-violet-200 hover:border-violet-200 hover:text-white"
            >
              {item.label}
            </a>
          </article>
        ))}
      </section>

      <section className="mt-12 grid gap-8 border-t border-white/10 pt-10 lg:grid-cols-[1fr_360px]">
        <div>
          <h2 className="text-2xl font-semibold text-white">What helps most</h2>
          <p className="mt-4 text-base leading-7 text-zinc-400">
            The most useful contributions are specific. Instead of only saying
            “write about testing”, share the type of app, the test problem, the
            dependency that made it hard, and what result you expected. That
            context makes the future article much more practical.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/blog"
              className="rounded-md bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-400"
            >
              Read examples
            </Link>
            <a
              href="https://medium.com/nestjs-ninja"
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-white/15 px-4 py-2.5 text-sm font-semibold text-zinc-200 hover:border-violet-300/60 hover:text-white"
            >
              Follow on Medium
            </a>
          </div>
        </div>

        <aside className="rounded-md border border-white/10 bg-[#120d1f] p-5">
          <h2 className="text-lg font-semibold text-white">Before submitting</h2>
          <ul className="mt-4 grid gap-3 text-sm leading-6 text-zinc-400">
            {contributionChecklist.map((item) => (
              <li key={item} className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-violet-300" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </aside>
      </section>
    </main>
  );
}
