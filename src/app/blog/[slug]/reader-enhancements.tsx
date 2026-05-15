"use client";

import { useEffect, useState } from "react";

function labelForLanguage(pre: HTMLPreElement) {
  const code = pre.querySelector("code");
  const className = code?.className ?? "";
  const language = className.match(/language-([a-z0-9-]+)/i)?.[1];

  return language ?? "code";
}

function sourceLabel(pre: HTMLPreElement) {
  const previous = pre.previousElementSibling;

  if (previous?.textContent?.trim().startsWith("Source:")) {
    const link = previous.querySelector("a");
    return link?.textContent?.trim() ?? "GitHub source";
  }

  return null;
}

export default function ReaderEnhancements() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const updateProgress = () => {
      const article = document.querySelector("article");

      if (!article) {
        return;
      }

      const rect = article.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const read = Math.min(Math.max(-rect.top, 0), total);

      setProgress(total > 0 ? (read / total) * 100 : 0);
    };

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);

    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, []);

  useEffect(() => {
    const preBlocks = Array.from(document.querySelectorAll<HTMLPreElement>("article pre"));

    for (const pre of preBlocks) {
      if (pre.parentElement?.classList.contains("code-frame")) {
        continue;
      }

      const wrapper = document.createElement("div");
      const header = document.createElement("div");
      const label = document.createElement("span");
      const button = document.createElement("button");
      const language = labelForLanguage(pre);
      const source = sourceLabel(pre);

      wrapper.className = `code-frame ${language === "bash" ? "code-frame-terminal" : ""}`;
      header.className = "code-frame-header";
      label.className = "code-frame-label";
      label.textContent = source ?? language;
      button.className = "code-copy-button";
      button.type = "button";
      button.textContent = "Copy";
      button.setAttribute("aria-label", `Copy ${source ?? language} code`);

      button.addEventListener("click", async () => {
        const code = pre.textContent ?? "";

        await navigator.clipboard.writeText(code);
        button.textContent = "Copied";
        window.setTimeout(() => {
          button.textContent = "Copy";
        }, 1400);
      });

      header.append(label, button);
      pre.replaceWith(wrapper);
      wrapper.append(header, pre);
    }
  }, []);

  return (
    <div
      aria-hidden="true"
      className="fixed left-0 top-0 z-[60] h-1 bg-violet-400 transition-[width] duration-150"
      style={{ width: `${progress}%` }}
    />
  );
}
