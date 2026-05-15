import fs from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import type { Post } from "@/interfaces/post";

const postsDirectory = join(process.cwd(), "_posts");

export function getPostSlugs() {
  if (!fs.existsSync(postsDirectory)) {
    return [];
  }

  return fs
    .readdirSync(postsDirectory)
    .filter((slug) => slug.endsWith(".md") || slug.endsWith(".mdx"));
}

export function getPostBySlug(slug: string): Post | null {
  const realSlug = slug.replace(/\.mdx?$/, "");
  const markdownPath = join(postsDirectory, `${realSlug}.md`);
  const mdxPath = join(postsDirectory, `${realSlug}.mdx`);
  const fullPath = fs.existsSync(markdownPath) ? markdownPath : mdxPath;

  if (!fs.existsSync(fullPath)) {
    return null;
  }

  const fileContents = fs.readFileSync(fullPath, "utf8");
  const { data, content } = matter(fileContents);

  return {
    ...data,
    slug: realSlug,
    content,
  } as Post;
}

export function getAllPosts(): Post[] {
  return getPostSlugs()
    .map((slug) => getPostBySlug(slug))
    .filter((post): post is Post => post !== null)
    .sort((post1, post2) => (post1.date > post2.date ? -1 : 1));
}

export function getFeaturedPosts(count = 3): Post[] {
  return getAllPosts().slice(0, count);
}
