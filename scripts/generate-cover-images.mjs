import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import matter from "gray-matter";

const repoRoot = process.cwd();
const postsDir = path.join(repoRoot, "_posts");
const publicDir = path.join(repoRoot, "public");
const assetsDir = path.join(publicDir, "blog-assets");
const defaultModel = "gpt-image-1";
const defaultSize = "1536x1024";
const defaultCoverFileName = "cover.png";

function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    const envPath = path.join(repoRoot, file);

    if (!fs.existsSync(envPath)) {
      continue;
    }

    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        continue;
      }

      const [key, ...valueParts] = trimmed.split("=");
      const value = valueParts.join("=").replace(/^['"]|['"]$/g, "");

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

export function parseArgs(args = process.argv.slice(2), env = process.env) {
  const options = {
    check: false,
    dryRun: false,
    regenerateAll: false,
    limit: Number.POSITIVE_INFINITY,
    model: env.OPENAI_IMAGE_MODEL ?? defaultModel,
    fileName: env.OPENAI_COVER_IMAGE_FILENAME ?? defaultCoverFileName,
    size: env.OPENAI_IMAGE_SIZE ?? defaultSize,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--check") {
      options.check = true;
      options.dryRun = true;
      continue;
    }

    if (arg === "--all" || arg === "--regenerate-all" || arg === "--force") {
      options.regenerateAll = true;
      continue;
    }

    if (arg === "--limit") {
      options.limit = Number(args[index + 1]);
      index += 1;
      continue;
    }

    if (arg === "--model") {
      options.model = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--file-name") {
      options.fileName = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--size") {
      options.size = args[index + 1];
      index += 1;
      continue;
    }
  }

  return options;
}

export function slugFromPostFile(fileName) {
  return path
    .basename(fileName, path.extname(fileName))
    .replace(/^\d{4}-\d{2}-\d{2}-/, "");
}

export function sanitizeFileName(fileName) {
  const parsed = path.parse(fileName || defaultCoverFileName);
  const name = parsed.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const ext = parsed.ext.toLowerCase() || ".png";

  return `${name || "cover"}${ext}`;
}

export function stripMarkdown(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/[#>*_`~-]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,:;!?])/g, "$1")
    .trim();
}

export function buildPrompt({ data, content }) {
  const title = data.title ?? "Technical blog post";
  const excerpt = data.excerpt ?? "";
  const tags = Array.isArray(data.tags) ? data.tags.join(", ") : "";
  const articleText = stripMarkdown(content).slice(0, 1800);

  return [
    "Use case: ads-marketing",
    "Asset type: technical blog cover image, 16:9 crop-safe website hero",
    `Primary request: Create a polished editorial cover image for a software engineering article titled "${title}".`,
    `Article excerpt: ${excerpt}`,
    `Topics/tags: ${tags}`,
    `Article context: ${articleText}`,
    "Visual direction: modern backend/software architecture aesthetic, concrete technical scene, clean composition, professional lighting, high contrast, enough negative space for cropping.",
    "Avoid: text, letters, logos, watermarks, UI gibberish, code that needs to be readable, distorted hands, crowded collage, generic abstract gradient background.",
  ].join("\n");
}

export async function generateImage({ apiKey, model, prompt, size }) {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt,
      size,
      n: 1,
    }),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = body.error?.message ?? `${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  const base64 = body.data?.[0]?.b64_json;

  if (!base64) {
    throw new Error("Image response did not include b64_json.");
  }

  return Buffer.from(base64, "base64");
}

export function writeUpdatedPost(filePath, parsed, coverImagePath) {
  const nextData = {
    ...parsed.data,
    coverImage: coverImagePath,
    ogImage: {
      ...(parsed.data.ogImage ?? {}),
      url: coverImagePath,
    },
  };

  const output = matter.stringify(parsed.content.trimStart(), nextData);
  fs.writeFileSync(filePath, output);
}

export async function main() {
  loadLocalEnv();

  const options = parseArgs();
  const apiKey = process.env.OPENAI_API_KEY;
  const coverFileName = sanitizeFileName(options.fileName);
  const postFiles = fs
    .readdirSync(postsDir)
    .filter((file) => file.endsWith(".md") || file.endsWith(".mdx"))
    .sort((a, b) => a.localeCompare(b));
  const missingCoverPosts = postFiles
    .map((file) => {
      const filePath = path.join(postsDir, file);
      const parsed = matter(fs.readFileSync(filePath, "utf8"));
      return { file, filePath, parsed, slug: slugFromPostFile(file) };
    })
    .filter(({ parsed }) => options.regenerateAll || !parsed.data.coverImage)
    .slice(0, options.limit);

  if (missingCoverPosts.length === 0) {
    console.log("Every post already has coverImage.");
    return;
  }

  if (options.dryRun) {
    const action = options.regenerateAll
      ? "would receive regenerated covers"
      : "would receive generated covers";

    console.log(`Posts that ${action}: ${missingCoverPosts.length}`);
    for (const post of missingCoverPosts) {
      console.log(`- ${path.relative(repoRoot, post.filePath)}`);
    }

    if (options.check) {
      process.exitCode = 1;
    }

    return;
  }

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required. Add it to your shell, .env.local, or .env.");
  }

  fs.mkdirSync(assetsDir, { recursive: true });

  for (const post of missingCoverPosts) {
    const title = post.parsed.data.title ?? post.slug;
    const prompt = buildPrompt(post.parsed);
    const postAssetDir = path.join(assetsDir, post.slug);
    const outputPath = path.join(postAssetDir, coverFileName);
    const publicPath = `/blog-assets/${post.slug}/${coverFileName}`;

    fs.mkdirSync(postAssetDir, { recursive: true });
    console.log(`Generating cover for "${title}"...`);

    const image = await generateImage({
      apiKey,
      model: options.model,
      prompt,
      size: options.size,
    });

    fs.writeFileSync(outputPath, image);
    writeUpdatedPost(post.filePath, post.parsed, publicPath);
    console.log(`- ${publicPath}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
