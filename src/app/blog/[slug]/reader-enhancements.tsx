"use client";

import { useEffect, useState } from "react";

type LightboxImage = {
  alt: string;
  src: string;
};

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
  const [lightboxImage, setLightboxImage] = useState<LightboxImage | null>(null);

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

  useEffect(() => {
    const content = document.querySelector<HTMLElement>("[data-post-content]");

    if (!content) {
      return;
    }

    const openImage = (event: MouseEvent) => {
      const image = (event.target as Element | null)?.closest("img");

      if (!image || !content.contains(image)) {
        return;
      }

      event.preventDefault();
      setLightboxImage({
        alt: image.getAttribute("alt") ?? "",
        src: image.currentSrc || image.src,
      });
    };

    content.addEventListener("click", openImage);

    return () => {
      content.removeEventListener("click", openImage);
    };
  }, []);

  useEffect(() => {
    if (!lightboxImage) {
      return;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLightboxImage(null);
      }
    };

    const originalOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [lightboxImage]);

  return (
    <>
      <div
        aria-hidden="true"
        className="fixed left-0 top-0 z-[60] h-1 bg-violet-400 transition-[width] duration-150"
        style={{ width: `${progress}%` }}
      />

      {lightboxImage ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-[80] grid place-items-center bg-zinc-950/90 p-4 backdrop-blur-sm"
          role="dialog"
          onClick={() => setLightboxImage(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-md border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20"
            onClick={() => setLightboxImage(null)}
          >
            Close
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- Markdown images can be external or generated HTML, so the lightbox uses the resolved browser source. */}
          <img
            src={lightboxImage.src}
            alt={lightboxImage.alt}
            className="max-h-[88vh] max-w-[94vw] rounded-md object-contain shadow-2xl ring-1 ring-white/15"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
}
