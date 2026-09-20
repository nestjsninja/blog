/**
 * Tells search engines that the site changed, after a deploy.
 *
 * Two mechanisms, because they cover different engines:
 *
 *   IndexNow      Bing, Yandex, Seznam, Naver. A real push protocol: you submit URLs and they
 *                 fetch them, usually within minutes. Google declined to adopt it.
 *
 *   Search Console  Google. There is NO API to request indexing of an ordinary page; the
 *                 Indexing API is restricted to JobPosting and BroadcastEvent. The most you can
 *                 do is resubmit the sitemap, which nudges Google to re-read it. That is what
 *                 this does, and only when a service account is configured.
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

/** Exchanges a service account key for an access token, without pulling in googleapis. */
async function googleAccessToken(credentials, scope) {
  const { createSign } = await import("node:crypto");
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: credentials.client_email,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode(header)}.${encode(claims)}`;
  const signature = createSign("RSA-SHA256")
    .update(unsigned)
    .sign(credentials.private_key, "base64url");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()).access_token;
}

async function resubmitSitemap({ siteUrl, serviceAccountJson }) {
  const sitemap = `${siteUrl}/sitemap.xml`;

  if (dryRun) {
    console.log(`[dry-run] Search Console would resubmit ${sitemap}`);
    return;
  }

  const credentials = JSON.parse(serviceAccountJson);
  const token = await googleAccessToken(
    credentials,
    "https://www.googleapis.com/auth/webmasters",
  );

  // The property must exist in Search Console and the service account must be an owner of it.
  const property = process.env.GSC_PROPERTY ?? `sc-domain:${new URL(siteUrl).host}`;
  const endpoint =
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}` +
    `/sitemaps/${encodeURIComponent(sitemap)}`;

  const response = await fetch(endpoint, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.ok) {
    console.log(`Search Console: resubmitted ${sitemap} for ${property}`);
    return;
  }

  console.warn(
    `Search Console: HTTP ${response.status} ${await response.text().catch(() => "")}`,
  );
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

  const serviceAccountJson = process.env.GSC_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    await resubmitSitemap({ siteUrl, serviceAccountJson });
  } else {
    console.log("GSC_SERVICE_ACCOUNT_JSON is not set; skipping the sitemap resubmission.");
  }

  console.log(
    "\nNote: Google has no API for requesting indexing of ordinary pages. The Indexing API " +
      "is limited to JobPosting and BroadcastEvent, so the sitemap is the mechanism that " +
      "actually applies here.",
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    // Still do not fail the deploy.
  });
}
