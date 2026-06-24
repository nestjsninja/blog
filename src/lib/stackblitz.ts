export interface RepoRef {
  owner: string;
  repo: string;
  /** `owner/repo` */
  slug: string;
  githubUrl: string;
  /** Full StackBlitz IDE (open in a new tab). */
  openUrl: string;
  /** StackBlitz iframe embed (click-to-load WebContainer). */
  embedUrl: string;
  /** True if the repo uses a native module that WebContainers can't build. */
  nativeDeps: boolean;
}

// Only surface repositories from the author's own GitHub accounts — not
// third-party libraries or tools that posts reference in prose.
const OWNED_OWNERS = new Set(["nestjsninja", "henriqueweiand"]);

// Repos that depend on a native module (e.g. better-sqlite3) which StackBlitz's
// in-browser WebContainers cannot build. The editor still opens for browsing.
// (The demo runs on sql.js, so it works in the browser and is not listed here.)
const NATIVE_DEP_REPOS = new Set(["nestjsninja/typeorm-test-factory"]);

export function stackblitzOpenUrl(owner: string, repo: string): string {
  return `https://stackblitz.com/github/${owner}/${repo}`;
}

export function stackblitzEmbedUrl(owner: string, repo: string): string {
  // ctl=1 → "click to load" the WebContainer (no auto npm install on render);
  // view=editor → show the code first, which works even before it runs.
  const params = new URLSearchParams({
    embed: "1",
    view: "editor",
    hideNavigation: "1",
    ctl: "1",
  });
  return `https://stackblitz.com/github/${owner}/${repo}?${params.toString()}`;
}

/**
 * Finds the distinct GitHub repositories referenced in a markdown document.
 * File/branch links (…/blob/…, …/tree/…) are normalized to their `owner/repo`
 * root, and duplicates are removed (first occurrence wins).
 */
export function extractRepos(markdown: string): RepoRef[] {
  const pattern =
    /https?:\/\/github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)\/([A-Za-z0-9._-]+)/g;

  const byKey = new Map<string, RepoRef>();

  for (const match of markdown.matchAll(pattern)) {
    const owner = match[1];
    if (!OWNED_OWNERS.has(owner.toLowerCase())) {
      continue;
    }

    const repo = match[2].replace(/\.git$/i, "").replace(/[.]+$/, "");
    if (!repo) {
      continue;
    }

    const key = `${owner}/${repo}`.toLowerCase();
    if (byKey.has(key)) {
      continue;
    }

    byKey.set(key, {
      owner,
      repo,
      slug: `${owner}/${repo}`,
      githubUrl: `https://github.com/${owner}/${repo}`,
      openUrl: stackblitzOpenUrl(owner, repo),
      embedUrl: stackblitzEmbedUrl(owner, repo),
      nativeDeps: NATIVE_DEP_REPOS.has(key),
    });
  }

  return [...byKey.values()];
}
