import test from "node:test";
import assert from "node:assert/strict";
import {
  coverageComparisonTable,
  markdownTable,
} from "../scripts/quality-gate.mjs";

test("markdownTable renders passed and failed quality checks", () => {
  const table = markdownTable([
    {
      name: "Tests",
      gate: "Unit tests pass",
      code: 0,
      durationMs: 1234,
      status: "Passed",
    },
    {
      name: "Build",
      gate: "Next.js production build passes",
      code: 1,
      durationMs: 2500,
      status: "Failed",
    },
  ]);

  assert.match(table, /\| Check \| Gate \| Status \| Duration \|/);
  assert.match(table, /\| Tests \| Unit tests pass \| ✅ Passed \| 1\.2s \|/);
  assert.match(table, /\| Build \| Next\.js production build passes \| ❌ Failed \| 2\.5s \|/);
});

test("coverageComparisonTable renders baseline, current, and delta", () => {
  const table = coverageComparisonTable({
    baseline: {
      lines: 47.52,
      branches: 76.47,
      functions: 53.33,
    },
    current: {
      lines: 50.12,
      branches: 75.47,
      functions: 53.33,
    },
  });

  assert.match(table, /\| Metric \| Baseline \| Current \| Δ \|/);
  assert.match(table, /\| Lines \| 47\.52% \| 50\.12% \| \+2\.60% \|/);
  assert.match(table, /\| Branches \| 76\.47% \| 75\.47% \| -1\.00% \|/);
  assert.match(table, /\| Functions \| 53\.33% \| 53\.33% \| 0\.00% \|/);
});
