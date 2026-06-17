#!/usr/bin/env bun
// scripts/tdd-guard-bun-reporter.ts
// Runner: `bun run scripts/tdd-guard-bun-reporter.ts <bun test args>`
//
// tdd-guard ships reporters for Vitest/Jest/pytest but NOT bun:test. This shim
// closes that gap: it spawns `bun test <args> --reporter=junit
// --reporter-outfile=<tmp>`, lets Bun's normal output stream to the terminal
// (Bun writes its pass/fail summary to stderr; the JUnit XML goes to the file),
// then transforms the JUnit XML into the tdd-guard TestResult JSON at
// .claude/tdd-guard/data/test.json and forwards Bun's exit code.

import { spawnSync } from "node:child_process";
import { readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseJunitXml,
  buildTddGuardReport,
  writeTddGuardReport,
  DEFAULT_TDD_GUARD_TARGET,
} from "./lib/tddGuardBunReporter";

const userArgs = process.argv.slice(2);
const tmpXml = join(tmpdir(), `tdd-guard-bun-${process.pid}-${Date.now()}.xml`);

const result = spawnSync(
  "bun",
  ["test", ...userArgs, "--reporter=junit", `--reporter-outfile=${tmpXml}`],
  { stdio: "inherit" },
);

try {
  if (existsSync(tmpXml)) {
    const xml = readFileSync(tmpXml, "utf8");
    const report = buildTddGuardReport(parseJunitXml(xml));
    writeTddGuardReport(report, DEFAULT_TDD_GUARD_TARGET);
  } else {
    // Bun produced no JUnit output (e.g., a crash before any test ran).
    // Record an interrupted run so tdd-guard does not treat stale state as green.
    writeTddGuardReport(
      { testModules: [], reason: "interrupted" },
      DEFAULT_TDD_GUARD_TARGET,
    );
  }
} finally {
  if (existsSync(tmpXml)) rmSync(tmpXml, { force: true });
}

process.exit(result.status ?? 1);
