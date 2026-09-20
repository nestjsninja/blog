/**
 * Tells search engines that the site changed, after a deploy.
 *
 * IndexNow only, which covers Bing, Yandex, Seznam and Naver. It is a real push protocol: you
 * submit URLs and they fetch them, usually within minutes.
 *
 * Google is deliberately not here. There is no API to request indexing of an ordinary page, as
 * the Indexing API is restricted to JobPosting and BroadcastEvent. The only thing that could be
 * automated was resubmitting the sitemap, and Search Console showed Google already re-reading it
 * every few days unprompted, so that call was pure ceremony. What actually helps Google is an
 * honest `lastmod`, which src/lib/sitemap-dates.ts now guarantees.
 *
 * Run with --dry-run to see what would be submitted without submitting anything.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import matter from "gray-matter";

const repoRoot = process.cwd();
const dryRun = process.argv.includes("--dry-run");

function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    const envPath = path.join(repoRoot, file);
    if (!fs.existsSync(envPath)) continue;

    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      const value = rest.join("=").replace(/^['"]|['"]$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

export function postUrls(siteUrl, postsDir = path.join(repoRoot, "_posts")) {
  if (!fs.existsSync(postsDir)) return [];

  return fs
    .readdirSync(postsDir)
    .filter((file) => file.endsWith(".md") || file.endsWith(".mdx"))
    .map((file) => file.replace(/\.mdx?$/, ""))
    .sort()
    .reverse()
    .map((slug) => `${siteUrl}/blog/${slug}/`);
}

/**
 * IndexNow caps a submission at 10,000 URLs, and there is no point resubmitting the whole
 * archive on every deploy. Recent posts plus the pages that list them is what actually changed.
 */
export function urlsToSubmit(siteUrl, limit = 10) {
  return [siteUrl + "/", `${siteUrl}/blog/`, ...postUrls(siteUrl).slice(0, limit)];
}

async function submitToIndexNow({ siteUrl, key, urlList }) {
  const host = new URL(siteUrl).host;
  const body = { host, key, keyLocation: `${siteUrl}/${key}.txt`, urlList };

  if (dryRun) {
    console.log(`[dry-run] IndexNow would submit ${urlList.length} URLs for ${host}`);
    for (const url of urlList) console.log(`  ${url}`);
    return;
  }

  const response = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });

  // 200 accepted, 202 accepted but key still being validated. Both are fine.
  if (response.ok || response.status === 202) {
    console.log(`IndexNow: submitted ${urlList.length} URLs (HTTP ${response.status})`);
    return;
  }

  // Never fail the deploy over this. A search engine ping is not worth a red pipeline.
  console.warn(`IndexNow: HTTP ${response.status} ${await response.text().catch(() => "")}`);
}

export async function main() {
  loadLocalEnv();

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://nestjs-ninja.com"
  ).replace(/\/$/, "");
  const urlList = urlsToSubmit(siteUrl);

  const key = process.env.INDEXNOW_KEY;
  if (key) {
    await submitToIndexNow({ siteUrl, key, urlList });
  } else {
    console.log("INDEXNOW_KEY is not set; skipping IndexNow.");
  }

}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    // Still do not fail the deploy.
  });
}
