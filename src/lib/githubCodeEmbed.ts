type MarkdownNode = {
  type: string;
  children?: MarkdownNode[];
  lang?: string;
  meta?: string;
  title?: string;
  url?: string;
  value?: string;
};

type GithubCodeLink = {
  displayUrl: string;
  language: string;
  rawUrl: string;
};

const codeCache = new Map<string, string | null>();
const maxCodeLength = 120_000;

const extensionLanguages: Record<string, string> = {
  css: "css",
  dockerfile: "dockerfile",
  env: "dotenv",
  graphql: "graphql",
  js: "javascript",
  json: "json",
  jsx: "jsx",
  md: "markdown",
  mjs: "javascript",
  prisma: "prisma",
  py: "python",
  sh: "bash",
  sql: "sql",
  ts: "typescript",
  tsx: "tsx",
  yaml: "yaml",
  yml: "yaml",
};

function languageFromPath(filePath: string) {
  const fileName = filePath.split("/").at(-1)?.toLowerCase() ?? "";

  if (fileName === "dockerfile") {
    return "dockerfile";
  }

  const extension = fileName.split(".").at(-1) ?? "";

  return extensionLanguages[extension] ?? "";
}

export function githubFileLinkFromUrl(value: string): GithubCodeLink | null {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.hostname === "raw.githubusercontent.com") {
    const [, owner, repo, ref, ...filePathParts] = url.pathname.split("/");

    if (!owner || !repo || !ref || filePathParts.length === 0) {
      return null;
    }

    const filePath = filePathParts.join("/");

    return {
      displayUrl: value,
      language: languageFromPath(filePath),
      rawUrl: url.toString(),
    };
  }

  if (url.hostname !== "github.com") {
    return null;
  }

  const [, owner, repo, action, ref, ...filePathParts] = url.pathname.split("/");

  if (!owner || !repo || action !== "blob" || !ref || filePathParts.length === 0) {
    return null;
  }

  const filePath = filePathParts.join("/");
  const rawUrl = new URL(
    `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${filePath}`,
  );

  return {
    displayUrl: value,
    language: languageFromPath(filePath),
    rawUrl: rawUrl.toString(),
  };
}

async function fetchCode(rawUrl: string) {
  if (codeCache.has(rawUrl)) {
    return codeCache.get(rawUrl) ?? null;
  }

  try {
    const response = await fetch(rawUrl, {
      headers: {
        Accept: "text/plain",
      },
    });

    if (!response.ok) {
      codeCache.set(rawUrl, null);
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (!contentType.includes("text/") && !contentType.includes("json")) {
      codeCache.set(rawUrl, null);
      return null;
    }

    const code = await response.text();
    const trimmedCode =
      code.length > maxCodeLength
        ? `${code.slice(0, maxCodeLength)}\n\n/* File truncated for display. */`
        : code;

    codeCache.set(rawUrl, trimmedCode);
    return trimmedCode;
  } catch {
    codeCache.set(rawUrl, null);
    return null;
  }
}

function standaloneGithubLink(node: MarkdownNode) {
  if (node.type !== "paragraph" || node.children?.length !== 1) {
    return null;
  }

  const [child] = node.children;

  if (child.type === "link" && child.url) {
    return githubFileLinkFromUrl(child.url);
  }

  if (child.type === "text" && child.value) {
    return githubFileLinkFromUrl(child.value.trim());
  }

  return null;
}

async function transformChildren(children?: MarkdownNode[]) {
  if (!children) {
    return;
  }

  for (let index = 0; index < children.length; index += 1) {
    const node = children[index];
    const githubLink = standaloneGithubLink(node);

    if (githubLink) {
      const code = await fetchCode(githubLink.rawUrl);

      if (code) {
        children.splice(
          index,
          1,
          {
            type: "paragraph",
            children: [
              { type: "text", value: "Source: " },
              {
                type: "link",
                url: githubLink.displayUrl,
                children: [{ type: "text", value: githubLink.displayUrl }],
              },
            ],
          },
          {
            type: "code",
            lang: githubLink.language,
            value: code,
          },
        );
        index += 1;
        continue;
      }
    }

    await transformChildren(node.children);
  }
}

export function remarkGithubCodeEmbeds() {
  return async function transformer(tree: MarkdownNode) {
    await transformChildren(tree.children);
  };
}
