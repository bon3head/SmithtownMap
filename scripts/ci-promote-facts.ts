#!/usr/bin/env bun
// scripts/ci-promote-facts.ts
//
// CI-side fact ratification (Tier 5 Phase 7). Runs ONLY in CI under the GitHub
// App bot identity (promote-facts.yml). For every entry in .facts.staging it
// re-runs the fact's command, and on exit 0 rewrites it into .facts with an
// evidence block (promoted_by: "facts-bot[bot]"). Failures stay staged.
//
// The pure core `promoteAll(parsed, deps)` keeps execSync/git/fs behind injectable
// seams so it is unit-testable; the I/O shell (import.meta.main) wires the real deps.
import { createHash } from "node:crypto";
import { execFileSync, execSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { stringify as stringifyYaml } from "yaml";
import { computeBundleHash } from "./lib/evidenceBundle";
import { parseStaging, serializeStaging, type ParsedStaging, type StagedFact } from "./lib/factsStaging";

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf-8").digest("hex");
}

export interface PromoteDeps {
  runCommand(command: string): { ok: boolean; output: string };
  specSha(specPath: string): string;
  headSha(): string;
  now(): string;
  testFileShas(command: string): string[];
  /** ids already present in canonical .facts — used to keep promotion idempotent. */
  existingFactIds(): string[];
}

export interface PromotedFact {
  label: string;
  id: string;
  command: string;
  tags: string[];
  evidence: {
    bundle_hash: string;
    promoted_at: string;
    promoted_by: "facts-bot[bot]";
    spec_sha: string;
    code_sha: string;
    test_file_shas: string[];
    red_evidence_sha: "ci-reverify";
    green_evidence_sha: string;
  };
}

export interface PromoteResult {
  promoted: PromotedFact[];
  failed: { id: string; output: string }[];
  remainingStaging: ParsedStaging;
}

export function promoteAll(parsed: ParsedStaging, deps: PromoteDeps): PromoteResult {
  const promoted: PromotedFact[] = [];
  const failed: { id: string; output: string }[] = [];
  const remaining: StagedFact[] = [];
  const alreadyPromoted = new Set(deps.existingFactIds());
  const promotedAt = deps.now();
  for (const entry of parsed.entries) {
    // Idempotency: a fact already in canonical .facts is cleaned out of staging,
    // never re-promoted (no duplicate canonical entry on a re-run/crash-retry).
    if (alreadyPromoted.has(entry.id)) {
      continue;
    }
    const run = deps.runCommand(entry.command);
    if (!run.ok) {
      failed.push({ id: entry.id, output: run.output });
      remaining.push(entry);
      continue;
    }
    const promotedTags = entry.tags.map((tag) => (tag === "spec" ? "implemented" : tag));
    const testFileShas = deps.testFileShas(entry.command);
    const greenEvidenceSha = sha256(run.output);
    const bundleHash = computeBundleHash({
      label: entry.label,
      id: entry.id,
      command: entry.command,
      tags: promotedTags,
      test_file_shas: testFileShas,
      red_evidence_sha: "ci-reverify",
      green_evidence_sha: greenEvidenceSha,
    });
    promoted.push({
      label: entry.label,
      id: entry.id,
      command: entry.command,
      tags: promotedTags,
      evidence: {
        bundle_hash: bundleHash,
        promoted_at: promotedAt,
        promoted_by: "facts-bot[bot]",
        spec_sha: deps.specSha(entry.spec),
        code_sha: deps.headSha(),
        test_file_shas: testFileShas,
        red_evidence_sha: "ci-reverify",
        green_evidence_sha: greenEvidenceSha,
      },
    });
  }
  return { promoted, failed, remainingStaging: { ...parsed, entries: remaining } };
}

// Real-dependency I/O shell. Runs only when invoked directly (CI bot context).
function realDeps(cwd: string): PromoteDeps {
  return {
    runCommand(command) {
      try {
        const output = execSync(command, {
          cwd,
          encoding: "utf-8",
          stdio: ["ignore", "pipe", "pipe"],
          maxBuffer: 32 * 1024 * 1024,
        });
        return { ok: true, output };
      } catch (error: any) {
        const output = `${error.stdout?.toString() ?? ""}${error.stderr?.toString() ?? ""}`;
        return { ok: false, output };
      }
    },
    specSha(specPath) {
      // argv array (no shell) — specPath is untrusted staging data; never build a shell string.
      try {
        return execFileSync("git", ["log", "-1", "--format=%H", "--", specPath], {
          cwd,
          encoding: "utf-8",
        }).trim();
      } catch {
        return "";
      }
    },
    headSha() {
      try {
        return execFileSync("git", ["rev-parse", "HEAD"], { cwd, encoding: "utf-8" }).trim();
      } catch {
        return "";
      }
    },
    now() {
      return new Date().toISOString();
    },
    testFileShas(command) {
      const matches = command.match(/\btests\/[\w./-]+\.test\.ts\b/g) ?? [];
      const shas: string[] = [];
      for (const path of matches) {
        try {
          shas.push(sha256(readFileSync(resolve(cwd, path), "utf-8")));
        } catch {
          // unreadable test file -> omit its sha (spec-staging-lint catches missing files pre-merge)
        }
      }
      return shas;
    },
    existingFactIds() {
      const factsPath = resolve(cwd, ".facts");
      if (!existsSync(factsPath)) return [];
      // .facts is markdown-with-yaml-sections; a line-anchored id: scan is robust to the mix.
      const ids: string[] = [];
      const re = /^\s*id:\s*(\S+)\s*$/gm;
      const content = readFileSync(factsPath, "utf-8");
      let m: RegExpExecArray | null;
      while ((m = re.exec(content)) !== null) ids.push(m[1]);
      return ids;
    },
  };
}

if (import.meta.main) {
  const cwd = process.cwd();
  const STAGING = resolve(cwd, ".facts.staging");
  const FACTS = resolve(cwd, ".facts");

  const parsed = parseStaging(readFileSync(STAGING, "utf-8"));
  const { promoted, failed, remainingStaging } = promoteAll(parsed, realDeps(cwd));

  // Atomic append to .facts (temp-file + rename).
  if (promoted.length > 0) {
    const factsContent = existsSync(FACTS) ? readFileSync(FACTS, "utf-8") : "";
    const head = factsContent.trimEnd();
    const newFacts = `${head}${head ? "\n\n" : ""}${stringifyYaml(promoted)}`;
    writeFileSync(`${FACTS}.tmp`, newFacts);
    renameSync(`${FACTS}.tmp`, FACTS);
  }

  // Atomic rewrite of staging — only when entries actually left staging (promoted or
  // deduped). Skipping the no-op write avoids re-triggering this push-on-.facts.staging
  // workflow with a commit that lacks [skip ci]. .facts is written first: with the
  // idempotency guard above, a crash between the two renames self-heals on the next run
  // (the re-promotion is deduped) rather than losing a promotion.
  if (remainingStaging.entries.length !== parsed.entries.length) {
    writeFileSync(`${STAGING}.tmp`, serializeStaging(remainingStaging));
    renameSync(`${STAGING}.tmp`, STAGING);
  }

  const failureDetails = failed
    .map((f) => `### ${f.id}\n\n\`\`\`\n${f.output.slice(0, 2000)}\n\`\`\``)
    .join("\n\n");

  const ghOutput = process.env.GITHUB_OUTPUT;
  if (ghOutput) {
    let block = `promoted=${promoted.length}\nfailed=${failed.length}\n`;
    if (failed.length > 0) {
      block += `failure_details<<__FACTS_EOF__\n${failureDetails}\n__FACTS_EOF__\n`;
    }
    appendFileSync(ghOutput, block);
  }

  for (const f of failed) {
    console.error(`FAILED re-verification: ${f.id}`);
    console.error(f.output);
  }
  console.log(`Promoted ${promoted.length} fact(s), ${failed.length} failed re-verification.`);
}
