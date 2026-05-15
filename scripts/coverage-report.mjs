import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const defaultOutputPath = ".coverage/current.json";

export function parseArgs(args = process.argv.slice(2)) {
  const options = {
    cwd: process.cwd(),
    json: defaultOutputPath,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--cwd") {
      options.cwd = path.resolve(args[index + 1]);
      index += 1;
      continue;
    }

    if (arg === "--json") {
      options.json = args[index + 1];
      index += 1;
    }
  }

  return options;
}

export function parseCoverageOutput(output) {
  const lines = output.split(/\r?\n/);
  const allFilesLine = lines.find((line) => line.includes("all files") && line.includes("|"));

  if (!allFilesLine) {
    throw new Error("Could not find the aggregate coverage row.");
  }

  const columns = allFilesLine
    .replace(/^[^a-zA-Z]*/, "")
    .split("|")
    .map((column) => column.trim());

  if (columns.length < 4 || columns[0] !== "all files") {
    throw new Error("Could not parse aggregate coverage values.");
  }

  return {
    lines: Number(columns[1]),
    branches: Number(columns[2]),
    functions: Number(columns[3]),
  };
}

function runCoverage(cwd) {
  return new Promise((resolve) => {
    const child = spawn("node", ["--import", "tsx", "--test", "--experimental-test-coverage"], {
      cwd,
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
      resolve({ code, output });
    });
  });
}

export async function main() {
  const options = parseArgs();
  const { code, output } = await runCoverage(options.cwd);

  if (code !== 0) {
    process.exitCode = code;
    return;
  }

  const coverage = parseCoverageOutput(output);
  const outputPath = path.resolve(process.cwd(), options.json);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(coverage, null, 2)}\n`);
  console.log(`Coverage JSON written to ${path.relative(process.cwd(), outputPath)}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
