"use client";

import { useState } from "react";
import type { RepoRef } from "@/lib/stackblitz";

export default function StackBlitzEmbeds({ repos }: { repos: RepoRef[] }) {
  const [active, setActive] = useState(0);

  if (!repos.length) {
    return null;
  }

  const multiple = repos.length > 1;
  const index = Math.min(active, repos.length - 1);
  const repo = repos[index];

  return (
    <section className="mt-12 border-t border-white/10 pt-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">
            Run it in your browser
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            Spin up the companion{" "}
            {multiple ? "repositories" : "repository"} on StackBlitz — no local
            setup required.
          </p>
        </div>

        {multiple ? (
          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              onClick={() =>
                setActive((i) => (i - 1 + repos.length) % repos.length)
              }
              className="rounded-md border border-white/15 px-2.5 py-1 text-zinc-200 hover:border-violet-300/50 hover:text-white"
              aria-label="Previous repository"
            >
              ‹
            </button>
            <span className="tabular-nums text-zinc-400">
              {index + 1} / {repos.length}
            </span>
            <button
              type="button"
              onClick={() => setActive((i) => (i + 1) % repos.length)}
              className="rounded-md border border-white/15 px-2.5 py-1 text-zinc-200 hover:border-violet-300/50 hover:text-white"
              aria-label="Next repository"
            >
              ›
            </button>
          </div>
        ) : null}
      </div>

      {multiple ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {repos.map((item, i) => (
            <button
              key={item.slug}
              type="button"
              onClick={() => setActive(i)}
              className={`rounded-full px-3 py-1 font-mono text-xs ${
                i === index
                  ? "bg-violet-500/90 text-white"
                  : "border border-white/15 text-zinc-300 hover:border-violet-300/50 hover:text-white"
              }`}
              aria-current={i === index}
            >
              {item.repo}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-4">
        {/* keyed by slug so switching repos resets the embed (one iframe at a time) */}
        <RepoCard key={repo.slug} repo={repo} />
      </div>
    </section>
  );
}

function RepoCard({ repo }: { repo: RepoRef }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-md border border-white/10 bg-white/[0.03]">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate font-mono text-sm text-white">{repo.slug}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {repo.nativeDeps
              ? "Opens the code on StackBlitz"
              : "Runs on StackBlitz WebContainers"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="rounded-md bg-violet-500/90 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-400"
            aria-expanded={open}
          >
            {repo.nativeDeps
              ? open
                ? "Hide editor"
                : "Open editor"
              : open
                ? "Hide preview"
                : "Run online"}
          </button>
          <a
            href={repo.openUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-white/15 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:border-violet-300/50 hover:text-white"
          >
            Open in StackBlitz ↗
          </a>
          <a
            href={repo.githubUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-white/15 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:border-violet-300/50 hover:text-white"
          >
            GitHub ↗
          </a>
        </div>
      </div>

      {repo.nativeDeps ? (
        <p className="border-t border-white/10 px-4 py-2.5 text-xs text-amber-200/80">
          This repo uses a native dependency StackBlitz can&apos;t build in the
          browser, so it won&apos;t run here — the editor still opens for reading
          the code. Clone it to run locally.
        </p>
      ) : null}

      {open ? (
        <iframe
          src={repo.embedUrl}
          title={`StackBlitz — ${repo.slug}`}
          className="h-[600px] w-full border-0 border-t border-white/10"
          loading="lazy"
          allow="cross-origin-isolated"
        />
      ) : null}
    </div>
  );
}
