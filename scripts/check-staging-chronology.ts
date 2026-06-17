#!/usr/bin/env bun
/**
 * check-staging-chronology — Verifies each staged fact's staged_in_commit
 * precedes (is an ancestor of) the commit that ADDS its referenced test file.
 *
 * Detects retroactive backfill: if a fact is "staged" in a commit that is not
 * an ancestor of the commit adding its test, the test predates/is independent
 * of the staging claim — FAIL. Git-integration code (also exercised by the
 * Phase 9 acceptance PR).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import { parseStaging } from "./lib/factsStaging";

const STAGING = resolve(process.cwd(), ".facts.staging");
const IS_CI = !!process.env.GITHUB_ACTIONS;

function emit(severity: "error" | "warning", msg: string): void {
  if (IS_CI) {
    console.log(`::${severity} file=.facts.staging,line=1,col=1::${msg}`);
  } else {
    console.error(`${severity.toUpperCase()} .facts.staging — ${msg}`);
  }
}

if (!existsSync(STAGING)) {
  console.error("✓ no staging file; nothing to check.");
  process.exit(0);
}

const content = readFileSync(STAGING, "utf-8");
const parsed = parseStaging(content);

let hasError = false;

for (const entry of parsed.entries) {
  const staged = entry.chronology?.staged_in_commit;
  if (!staged || staged === "pending") continue;

  const testMatch = entry.command.match(/\b(tests\/[\w./-]+\.test\.ts)\b/);
  if (!testMatch) continue;
  const testFile = testMatch[1];

  let testAddedSha: string;
  try {
    testAddedSha = execSync(`git log --diff-filter=A --format=%H -- "${testFile}"`, {
      encoding: "utf-8",
    })
      .trim()
      .split("\n")[0];
  } catch {
    continue; // not tracked yet — spec-staging-lint covers existence
  }
  if (!testAddedSha) continue;

  // staged_in_commit must be an ANCESTOR of the test-add commit.
  try {
    execSync(`git merge-base --is-ancestor ${staged} ${testAddedSha}`);
  } catch {
    emit(
      "error",
      `chronology violation: fact '${entry.id}' staged in ${staged.slice(0, 8)} but test ${testFile} was added in ${testAddedSha.slice(0, 8)}, which is not a descendant. Retroactive backfill detected.`,
    );
    hasError = true;
  }
}

if (!hasError) {
  console.error(`✓ chronology OK (${parsed.entries.length} staged fact(s))`);
}

process.exit(hasError ? 1 : 0);
