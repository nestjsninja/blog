import type { Post } from "@/interfaces/post";
import GithubSlugger from "github-slugger";

export type TocItem = {
  id: string;
  level: 2 | 3;
  title: string;
};

export function stripMarkdownForSearch(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_`~|:-]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,:;!?])/g, "$1")
    .trim();
}

export function readingTime(markdown: string) {
  const words = stripMarkdownForSearch(markdown)
    .split(/\s+/)
    .filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 220));

  return `${minutes} min read`;
}

export function getTableOfContents(markdown: string): TocItem[] {
  const slugger = new GithubSlugger();

  return markdown
    .split(/\r?\n/)
    .map((line) => line.match(/^(#{2,3})\s+(.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => {
      return {
        id: slugger.slug(match[2]),
        level: match[1].length as 2 | 3,
        title: match[2].replace(/[`*_~]/g, "").trim(),
      };
    });
}

export function getRelatedPosts(post: Post, posts: Post[], count = 3) {
  const tags = new Set(post.tags ?? []);

  return posts
    .filter((candidate) => candidate.slug !== post.slug)
    .map((candidate) => ({
      post: candidate,
      score: (candidate.tags ?? []).filter((tag) => tags.has(tag)).length,
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return a.post.date > b.post.date ? -1 : 1;
    })
    .slice(0, count)
    .map(({ post: relatedPost }) => relatedPost);
}

export function getSeriesNavigation(post: Post, posts: Post[]) {
  if (!post.series || typeof post.seriesOrder !== "number") {
    return null;
  }

  const seriesPosts = posts
    .filter(
      (candidate) =>
        candidate.series === post.series &&
        typeof candidate.seriesOrder === "number",
    )
    .sort((a, b) => (a.seriesOrder ?? 0) - (b.seriesOrder ?? 0));
  const index = seriesPosts.findIndex((candidate) => candidate.slug === post.slug);

  if (index === -1) {
    return null;
  }

  return {
    name: post.series,
    previous: seriesPosts[index - 1] ?? null,
    next: seriesPosts[index + 1] ?? null,
  };
}
