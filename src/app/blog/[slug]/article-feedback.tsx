"use client";

import { useSyncExternalStore } from "react";

type ArticleFeedbackProps = {
  slug: string;
};

export default function ArticleFeedback({ slug }: ArticleFeedbackProps) {
  const storageKey = `article-feedback:${slug}`;
  const value = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener(storageKey, onStoreChange);

      return () => window.removeEventListener(storageKey, onStoreChange);
    },
    () => window.localStorage.getItem(storageKey),
    () => null,
  );


  function choose(nextValue: string) {
    window.localStorage.setItem(storageKey, nextValue);
    window.dispatchEvent(new Event(storageKey));
  }

  return (
    <section className="mt-12 border-t border-white/10 pt-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Was this helpful?</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Your answer stays in this browser for now.
          </p>
        </div>
        <div className="flex gap-2">
          {["Yes", "Not yet"].map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => choose(option)}
              className={`rounded-md px-3 py-2 text-sm font-semibold ring-1 ${
                value === option
                  ? "bg-violet-400 text-zinc-950 ring-violet-300"
                  : "bg-white/[0.03] text-zinc-200 ring-white/15 hover:ring-violet-300/60"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
