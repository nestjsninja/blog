#!/usr/bin/env node
/**
 * The dependency gate: fail on high and critical advisories, except ones that
 * are named here with a reason.
 *
 * This replaces a bare `npm audit --audit-level=high`, which had left the gate
 * permanently red — and a permanently red gate stops being read. The advisory
 * holding it red has no fix: `braces@3.0.3` is the latest published version and
 * the advisory covers every version, so npm's suggested remedy is to downgrade
 * eslint-config-next from 16.x to 14.2.35. Going back two majors on a lint
 * config to dodge a denial-of-service in a glob library that never runs outside
 * CI is not a security improvement.
 *
 * An allowlist is a liability if it is silent, so this prints every entry it
 * applied and fails if an allowlisted advisory has stopped appearing — that is
 * the signal the entry can be deleted.
 */
import { execFileSync } from 'node:child_process';

const ALLOWED = [
  {
    id: 'GHSA-vfj7-8cjw-p6xm',
    package: 'braces',
    why: 'No published fix: braces 3.0.3 is the latest release and the advisory covers all versions. Reached only through eslint-config-next -> @next/eslint-plugin-next -> fast-glob -> micromatch, so it runs at lint time and is not in anything served. `npm audit --omit=dev` reports no high findings.',
    remove_when: 'braces publishes a patched release, or eslint-config-next stops pinning fast-glob 3.3.1.',
  },
];

function audit() {
  try {
    return JSON.parse(execFileSync('npm', ['audit', '--json'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }));
  } catch (error) {
    // npm exits non-zero when it finds anything; the report is still on stdout.
    if (error.stdout) return JSON.parse(error.stdout);
    throw error;
  }
}

const report = audit();
const serious = new Map();

for (const [name, entry] of Object.entries(report.vulnerabilities ?? {})) {
  if (entry.severity !== 'high' && entry.severity !== 'critical') continue;
  for (const via of entry.via) {
    // A string `via` means this package is only affected because something it
    // depends on is. The advisory itself is recorded on that dependency.
    if (typeof via !== 'object') continue;
    const id = String(via.url ?? '').split('/').pop();
    if (id) serious.set(id, { id, package: name, severity: entry.severity, title: via.title });
  }
}

const allowedIds = new Set(ALLOWED.map((a) => a.id));
const blocking = [...serious.values()].filter((a) => !allowedIds.has(a.id));
const applied = ALLOWED.filter((a) => serious.has(a.id));
const stale = ALLOWED.filter((a) => !serious.has(a.id));

for (const entry of applied) {
  console.log(`allowed  ${entry.id}  (${entry.package})`);
  console.log(`         ${entry.why}`);
  console.log(`         remove when: ${entry.remove_when}`);
}

for (const entry of stale) {
  console.error(`stale allowlist entry: ${entry.id} (${entry.package}) no longer appears in npm audit — delete it from scripts/audit-check.mjs`);
}

for (const entry of blocking) {
  console.error(`BLOCKING ${entry.severity}  ${entry.id}  ${entry.package}  ${entry.title ?? ''}`);
}

if (blocking.length > 0 || stale.length > 0) {
  console.error(`\n${blocking.length} unallowed high/critical advisory(ies), ${stale.length} stale allowlist entry(ies).`);
  process.exit(1);
}

console.log(`\nNo unallowed high or critical advisories (${applied.length} allowed, documented above).`);
