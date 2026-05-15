import test from "node:test";
import assert from "node:assert/strict";
import {
  parseArgs,
  parseCoverageOutput,
} from "../scripts/coverage-report.mjs";

test("parseArgs supports cwd and json output path", () => {
  const options = parseArgs(["--cwd", "baseline", "--json", ".coverage/base.json"]);

  assert.equal(options.cwd.endsWith("baseline"), true);
  assert.equal(options.json, ".coverage/base.json");
});

test("parseCoverageOutput reads aggregate node test coverage", () => {
  const output = [
    "ℹ start of coverage report",
    "ℹ -----------------------------------------------------------------------------------------------",
    "ℹ file                       | line % | branch % | funcs % | uncovered lines",
    "ℹ -----------------------------------------------------------------------------------------------",
    "ℹ all files                  |  47.52 |    76.47 |   53.33 | ",
    "ℹ -----------------------------------------------------------------------------------------------",
    "ℹ end of coverage report",
  ].join("\n");

  assert.deepEqual(parseCoverageOutput(output), {
    lines: 47.52,
    branches: 76.47,
    functions: 53.33,
  });
});
