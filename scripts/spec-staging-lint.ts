#!/usr/bin/env bun
/**
 * spec-staging-lint — Validates .facts.staging structure and SPEC back-references.
 *
 * Reuses parseStaging() from ./lib/factsStaging (Scope Rule: no duplicated YAML
 * parsing). Unlike validateEntry() in that lib (fail-fast guard), this is a lint
 * tool: it collects ALL violations and emits GitHub Actions annotations on stdout
 * when GITHUB_ACTIONS=true. Human-readable info goes to stderr.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parseStaging } from "./lib/factsStaging";

const STAGING = resolve(process.cwd(), ".facts.staging");
const IS_CI = !!process.env.GITHUB_ACTIONS;

function emit(severity: "error" | "warning", line: number, msg: string): void {
  if (IS_CI) {
    console.log(`::${severity} file=.facts.staging,line=${line},col=1::${msg}`);
  } else {
    console.error(`${severity.toUpperCase()} .facts.staging:${line} — ${msg}`);
  }
}

if (!existsSync(STAGING)) {
  console.error("✓ .facts.staging absent (empty repo or pre-Tier-5); nothing to lint.");
  process.exit(0);
}

const content = readFileSync(STAGING, "utf-8");
const parsed = parseStaging(content);

// Best-effort line index for annotations.
const lines = content.split("\n");
function findLine(id: string): number {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(`id: ${id}`)) return i + 1;
  }
  return 1;
}

let hasError = false;
const seenIds = new Set<string>();

for (const entry of parsed.entries) {
  const line = findLine(entry.id);

  // Rule 1: no 'implemented' tag (staged facts are 'spec' until CI promotes them)
  if (entry.tags.includes("implemented")) {
    emit("error", line, `staged fact '${entry.id}' has 'implemented' tag — must be 'spec'`);
    hasError = true;
  }

  // Rule 2: 'spec' tag required
  if (!entry.tags.includes("spec")) {
    emit("error", line, `staged fact '${entry.id}' missing 'spec' tag`);
    hasError = true;
  }

  // Rule 3: spec back-reference required
  if (!entry.spec) {
    emit("error", line, `staged fact '${entry.id}' missing 'spec:' back-reference`);
    hasError = true;
    continue;
  }

  // Rule 4: referenced spec file must exist
  if (!existsSync(resolve(process.cwd(), entry.spec))) {
    emit("error", line, `staged fact '${entry.id}' references non-existent spec file: ${entry.spec} (not found)`);
    hasError = true;
  }

  // Rule 5: command's referenced test file (if any) must exist
  const testFile = entry.command.match(/\b(tests\/[\w./-]+\.test\.ts)\b/);
  if (testFile && !existsSync(resolve(process.cwd(), testFile[1]))) {
    emit("error", line, `staged fact '${entry.id}' command references non-existent test file: ${testFile[1]} (not found)`);
    hasError = true;
  }

  // Rule 6: id uniqueness within staging
  if (seenIds.has(entry.id)) {
    emit("error", line, `duplicate id '${entry.id}' within .facts.staging`);
    hasError = true;
  }
  seenIds.add(entry.id);

  // Rule 7: chronology.staged_in_commit still 'pending' — warn (non-failing).
  if (entry.chronology?.staged_in_commit === "pending") {
    emit("warning", line, `staged fact '${entry.id}' chronology.staged_in_commit is still 'pending'`);
  }
}

if (!hasError) {
  console.error(`✓ spec-staging-lint: ${parsed.entries.length} staged fact(s) validated`);
}

process.exit(hasError ? 1 : 0);
