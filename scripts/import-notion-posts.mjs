import fs from "node:fs";
import path from "node:path";

const exportRoot =
  "/Users/henriqueweiand/Desktop/ExportBlock-a2fc37d6-51a0-4aef-aff9-e14dc075fe05-Part-1";
const postsSourceDir = path.join(exportRoot, "Blog Posts");
const csvPath = path.join(exportRoot, "Blog Posts 48f804f442b748cf8e57dd6a6c51d8ae_all.csv");
const repoRoot = process.cwd();
const postsOutputDir = path.join(repoRoot, "_posts");
const assetsOutputRoot = path.join(repoRoot, "public", "blog-assets");
const defaultImage = "/nestjs-ninja.png";

function parseCsv(input) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];

    if (char === '"' && quoted && next === '"') {
      field += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(field);
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  row.push(field);
  if (row.some((value) => value.length > 0)) {
    rows.push(row);
  }

  const [headers, ...records] = rows;
  headers[0] = headers[0].replace(/^\uFEFF/, "");

  return records.map((record) =>
    Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""])),
  );
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function toIsoDate(value) {
  const parsed = Date.parse(value || "");
  if (Number.isNaN(parsed)) {
    return "2023-01-01T12:00:00.000Z";
  }
  const date = new Date(parsed);
  date.setUTCHours(12, 0, 0, 0);
  return date.toISOString();
}

function yamlString(value) {
  return JSON.stringify(value.replace(/\r?\n/g, " ").trim());
}

function extractMetadata(markdown) {
  const lines = markdown.split(/\r?\n/);
  const title = lines.find((line) => line.startsWith("# "))?.replace(/^#\s+/, "").trim();
  const tags = lines
    .find((line) => line.startsWith("Tags: "))
    ?.replace(/^Tags:\s+/, "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const published = lines
    .find((line) => line.startsWith("Published: "))
    ?.replace(/^Published:\s+/, "")
    .trim();
  const author = lines
    .find((line) => line.startsWith("Author: "))
    ?.replace(/^Author:\s+/, "")
    .trim();

  return { title, tags, published, author };
}

function stripNotionMetadata(markdown) {
  const lines = markdown.split(/\r?\n/);
  let index = 0;

  if (lines[index]?.startsWith("# ")) {
    index += 1;
  }

  while (
    index < lines.length &&
    (lines[index] === "" ||
      lines[index].startsWith("Tags: ") ||
      lines[index].startsWith("Published: ") ||
      lines[index].startsWith("Author: "))
  ) {
    index += 1;
  }

  return lines.slice(index).join("\n").trim();
}

function firstParagraph(markdown) {
  return (
    markdown
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .find(
        (part) =>
          part &&
          !part.startsWith("#") &&
          !part.startsWith("!") &&
          !part.startsWith("```") &&
          !part.startsWith("|"),
      ) ?? ""
  )
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_>#]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

function decodeMarkdownPath(value) {
  return decodeURIComponent(value.replace(/\\([() ])/g, "$1"));
}

function publicAssetName(sourcePath, usedNames) {
  const parsed = path.parse(sourcePath);
  const base = slugify(parsed.name) || "asset";
  const ext = parsed.ext.toLowerCase();
  let candidate = `${base}${ext}`;
  let count = 2;

  while (usedNames.has(candidate)) {
    candidate = `${base}-${count}${ext}`;
    count += 1;
  }

  usedNames.add(candidate);
  return candidate;
}

function rewriteImages(markdown, sourceDir, slug) {
  const usedNames = new Set();
  const copied = [];
  const warnings = [];

  const rewritten = markdown
    .split(/\r?\n/)
    .map((line) => {
      const leadingWhitespace = line.match(/^\s*/)?.[0] ?? "";
      const trimmedLine = line.slice(leadingWhitespace.length);

      if (!trimmedLine.startsWith("![")) {
        return line;
      }

      const marker = "](";
      const targetStart = trimmedLine.lastIndexOf(marker);
      if (targetStart === -1 || !trimmedLine.endsWith(")")) {
        return line;
      }

      const rawTarget = trimmedLine.slice(targetStart + marker.length, -1);
      if (/^https?:\/\//i.test(rawTarget)) {
        return line;
      }

      const decodedTarget = decodeMarkdownPath(rawTarget);
      const sourcePath = path.resolve(sourceDir, decodedTarget);

      if (!sourcePath.startsWith(sourceDir) || !fs.existsSync(sourcePath)) {
        warnings.push(`Missing image: ${rawTarget}`);
        return line;
      }

      const assetName = publicAssetName(sourcePath, usedNames);
      const outputDir = path.join(assetsOutputRoot, slug);
      const outputPath = path.join(outputDir, assetName);
      fs.mkdirSync(outputDir, { recursive: true });
      fs.copyFileSync(sourcePath, outputPath);
      copied.push(`/blog-assets/${slug}/${assetName}`);

      return `${leadingWhitespace}${trimmedLine.slice(
        0,
        targetStart + marker.length,
      )}/blog-assets/${slug}/${assetName})`;
    })
    .join("\n");

  return { markdown: rewritten, copied, warnings };
}

const csvRows = parseCsv(fs.readFileSync(csvPath, "utf8"));
const rowsByName = new Map(csvRows.map((row) => [row.Name.trim().toLowerCase(), row]));
const mdFiles = fs
  .readdirSync(postsSourceDir)
  .filter((file) => file.endsWith(".md"))
  .sort((a, b) => a.localeCompare(b));

fs.mkdirSync(postsOutputDir, { recursive: true });
fs.mkdirSync(assetsOutputRoot, { recursive: true });

const results = mdFiles.map((file) => {
  const sourcePath = path.join(postsSourceDir, file);
  const original = fs.readFileSync(sourcePath, "utf8");
  const metadata = extractMetadata(original);
  const title = metadata.title || path.basename(file, ".md").replace(/\s+[a-f0-9]{32}$/i, "");
  const csv = rowsByName.get(title.toLowerCase()) ?? {};
  const slug = slugify(csv.Slug || title);
  const date = toIsoDate(metadata.published || csv.Published || csv.Created);
  const contentWithoutMetadata = stripNotionMetadata(original);
  const { markdown, copied, warnings } = rewriteImages(contentWithoutMetadata, postsSourceDir, slug);
  const excerpt = csv.Description?.trim() || firstParagraph(markdown) || title;
  const tags = metadata.tags?.length
    ? metadata.tags
    : (csv.Tags ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
  const author = metadata.author || csv.Author || "Henrique Weiand";
  const coverImage = copied[0] ?? defaultImage;
  const outputPath = path.join(postsOutputDir, `${date.slice(0, 10)}-${slug}.md`);
  const frontmatter = [
    "---",
    `title: ${yamlString(title)}`,
    `excerpt: ${yamlString(excerpt)}`,
    `coverImage: ${yamlString(coverImage)}`,
    `date: ${yamlString(date)}`,
    "author:",
    `  name: ${yamlString(author.replace(/\b\w/g, (match) => match.toUpperCase()))}`,
    `  picture: ${yamlString(defaultImage)}`,
    "ogImage:",
    `  url: ${yamlString(coverImage)}`,
    "tags:",
    ...(tags.length ? tags.map((tag) => `  - ${yamlString(tag)}`) : ["  - \"Blog\""]),
    "---",
    "",
  ].join("\n");

  fs.writeFileSync(outputPath, `${frontmatter}${markdown}\n`);

  return {
    file,
    output: path.relative(repoRoot, outputPath),
    images: copied.length,
    warnings,
  };
});

const totalImages = results.reduce((sum, result) => sum + result.images, 0);
const warnings = results.flatMap((result) =>
  result.warnings.map((warning) => `${result.file}: ${warning}`),
);

console.log(`Imported ${results.length} posts and ${totalImages} local images.`);
for (const result of results) {
  console.log(`- ${result.output} (${result.images} images)`);
}

if (warnings.length) {
  console.log("\nWarnings:");
  for (const warning of warnings) {
    console.log(`- ${warning}`);
  }
}
