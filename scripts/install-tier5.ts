#!/usr/bin/env bun
// scripts/install-tier5.ts
//
// One-command Tier 5 setup verifier: `bun run tier5:install`.
// Installs dev-deps, confirms the Layer-3 hooks + Layer-4 workflows + scripts are
// present, then smoke-tests the REAL gates that run on this branch. Exits non-zero
// if any required file is missing or any smoke check fails.
//
// NOTE: it does NOT run `facts:check`/`facts:tests` — facts:check is wired to the
// Windows facts.exe (brittle on Linux) and facts:tests does not exist on this branch.
// The runnable gates below are the source of truth (per openspec/config.yaml).
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export interface SmokeCheck {
  name: string;
  command: string;
}

/** The real, runnable Tier 5 gates on this branch (no Windows-only facts.exe). */
export function tier5SmokeChecks(): SmokeCheck[] {
  return [
    { name: "spec-staging-lint", command: "bun run spec:lint" },
    { name: "staging-chronology", command: "bun run spec:chronology" },
    { name: "contextlint", command: "bun run spec:contextlint" },
    { name: "test-quality-lint", command: "bun run test-quality:lint" },
    // NOTE: no app-test smoke check here — Phase-1 exemplar tests are authored
    // RED-first (intentionally failing until implemented), so running them here
    // would wrongly fail install. The lint gates above are the install contract.
  ];
}

/** Files that MUST exist for the four-layer model to hold. */
export function tier5RequiredFiles(): string[] {
  return [
    // Layer 3 — local keel hook
    ".claude/hooks/protect-facts.sh",
    ".claude/hooks/tdd-guard-wrapper.sh",
    // Layer 2 — ledger pipeline
    "scripts/facts-stage.ts",
    "scripts/facts-promote.ts",
    "scripts/lib/factsStaging.ts",
    "scripts/lib/evidenceBundle.ts",
    // Layer 4 — CI integrity
    ".github/workflows/spec-staging-lint.yml",
    ".github/workflows/test-quality-lint.yml",
    ".github/workflows/promote-facts.yml",
    "scripts/ci-promote-facts.ts",
    // OpenSpec local gate
    ".claude/commands/opsx/verify.md",
  ];
}

if (import.meta.main) {
  const cwd = process.cwd();
  let failures = 0;

  console.log("Tier 5 install/verify\n");

  console.log("• Installing dev-dependencies (bun install)...");
  try {
    execSync("bun install", { cwd, stdio: "inherit" });
  } catch {
    console.error("  bun install failed");
    failures++;
  }

  console.log("\n• Checking required files...");
  for (const file of tier5RequiredFiles()) {
    const ok = existsSync(resolve(cwd, file));
    console.log(`  ${ok ? "✅" : "🔴"} ${file}`);
    if (!ok) failures++;
  }

  console.log("\n• Smoke-testing the live gates...");
  for (const check of tier5SmokeChecks()) {
    process.stdout.write(`  ${check.name}: `);
    try {
      execSync(check.command, { cwd, stdio: "ignore" });
      console.log("✅");
    } catch {
      console.log("🔴");
      failures++;
    }
  }

  if (failures > 0) {
    console.error(`\nTier 5 verify FAILED: ${failures} problem(s).`);
    process.exit(1);
  }
  console.log("\nTier 5 verify OK — all required files present and all gates green.");
}
