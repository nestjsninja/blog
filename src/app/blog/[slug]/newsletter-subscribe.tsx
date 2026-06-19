"use client";

import { FormEvent, useState } from "react";

type Status = "idle" | "loading" | "success" | "error";

export default function NewsletterSubscribe() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setStatus("success");
        setEmail("");
      } else {
        const data = await res.json() as { error?: string };
        setErrorMsg(data.error ?? "Something went wrong");
        setStatus("error");
      }
    } catch {
      setErrorMsg("Network error, please try again");
      setStatus("error");
    }
  }

  return (
    <section className="mt-12 rounded-md border border-white/10 bg-white/[0.03] p-6">
      <h2 className="text-lg font-semibold text-white">
        Get new posts in your inbox
      </h2>
      <p className="mt-1 text-sm text-zinc-400">
        No spam. NestJS, TypeScript, and backend architecture — when there is
        something worth reading.
      </p>

      {status === "success" ? (
        <p className="mt-4 text-sm font-medium text-violet-300">
          You&apos;re subscribed. See you in your inbox.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
          <label htmlFor="newsletter-email" className="sr-only">
            Email address
          </label>
          <input
            id="newsletter-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={status === "loading"}
            className="min-w-0 flex-1 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-violet-300/70 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="shrink-0 rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {status === "loading" ? "Subscribing…" : "Subscribe"}
          </button>
        </form>
      )}

      {status === "error" && (
        <p className="mt-2 text-xs text-red-400">{errorMsg}</p>
      )}
    </section>
  );
}
