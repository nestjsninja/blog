import { spawn } from "node:child_process";
import fs from "node:fs";
import process from "node:process";
import { pathToFileURL } from "node:url";

const checks = [
  {
    name: "Cover images",
    command: "npm",
    args: ["run", "covers:check"],
    gate: "Every post has coverImage",
  },
  {
    name: "Tests",
    command: "npm",
    args: ["test"],
    gate: "Unit tests pass",
  },
  {
    name: "Lint",
    command: "npm",
    args: ["run", "lint"],
    gate: "ESLint passes",
  },
  {
    name: "Build",
    command: "npm",
    args: ["run", "build"],
    gate: "Next.js production build passes",
  },
  {
    name: "Dependencies",
    command: "npm",
    args: ["audit", "--audit-level=high"],
    gate: "No high or critical npm audit findings",
  },
];

function runCheck(check) {
  const startedAt = Date.now();

  return new Promise((resolve) => {
    const child = spawn(check.command, check.args, {
      env: {
        ...process.env,
        NEXT_PUBLIC_SITE_URL:
          process.env.NEXT_PUBLIC_SITE_URL ?? "https://nestjs-ninja.com",
      },
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";

    child.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);
      output += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
      output += chunk.toString();
    });

    child.on("close", (code) => {
      resolve({
        ...check,
        code,
        durationMs: Date.now() - startedAt,
        output: output.trim(),
        status: code === 0 ? "Passed" : "Failed",
      });
    });
  });
}

export function markdownTable(rows) {
  return [
    "| Check | Gate | Status | Duration |",
    "| --- | --- | --- | ---: |",
    ...rows.map((row) => {
      const icon = row.code === 0 ? "✅" : "❌";
      const seconds = `${(row.durationMs / 1000).toFixed(1)}s`;

      return `| ${row.name} | ${row.gate} | ${icon} ${row.status} | ${seconds} |`;
    }),
  ].join("\n");
}

export function writeSummary(results) {
  const failed = results.filter((result) => result.code !== 0);
  const status = failed.length === 0 ? "✅ Passed" : "❌ Failed";
  const summary = [
    `# Quality Gate`,
    "",
    `**Status:** ${status}`,
    "",
    "## Checks",
    "",
    markdownTable(results),
    "",
  ];

  if (failed.length > 0) {
    summary.push("## Failures", "");

    for (const result of failed) {
      const tail = result.output.split("\n").slice(-30).join("\n");
      summary.push(`### ${result.name}`, "", "```text", tail, "```", "");
    }
  }

  const content = `${summary.join("\n")}\n`;

  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, content);
  } else {
    console.log(content);
  }
}

export async function main() {
  const results = [];

  for (const check of checks) {
    console.log(`\n==> ${check.name}`);
    results.push(await runCheck(check));
  }

  writeSummary(results);

  if (results.some((result) => result.code !== 0)) {
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
