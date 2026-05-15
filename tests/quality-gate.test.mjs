import test from "node:test";
import assert from "node:assert/strict";
import { markdownTable } from "../scripts/quality-gate.mjs";

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
