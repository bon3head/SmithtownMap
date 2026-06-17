#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { stringify as stringifyYaml } from "yaml";
import { computeBundleHash } from "./lib/evidenceBundle";
import { parseStaging, serializeStaging } from "./lib/factsStaging";

const STAGING = resolve(process.cwd(), ".facts.staging");
const FACTS = resolve(process.cwd(), ".facts");

function fail(message: string): never {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf-8").digest("hex");
}

function testFileShas(command: string): string[] {
  const matches = command.match(/\btests\/[\w./-]+\.test\.ts\b/g) ?? [];
  return matches.map((path) => {
    const content = readFileSync(resolve(process.cwd(), path), "utf-8");
    return sha256(content);
  });
}

const id = process.argv[2];
if (!id) fail("usage: bun run facts:promote <id>");

const stagingContent = readFileSync(STAGING, "utf-8");
const parsed = parseStaging(stagingContent);
const entryIndex = parsed.entries.findIndex((entry) => entry.id === id);
if (entryIndex === -1) fail(`staged fact '${id}' not found`);

const entry = parsed.entries[entryIndex];
let greenOutput = "";
try {
  greenOutput = execSync(entry.command, {
    cwd: process.cwd(),
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch (error: any) {
  console.error(`ERROR: command failed (exit ${error.status ?? "unknown"})`);
  if (error.stdout) console.error(error.stdout.toString());
  if (error.stderr) console.error(error.stderr.toString());
  process.exit(1);
}

const promotedTags = entry.tags.map((tag) => tag === "spec" ? "implemented" : tag);
const fileShas = testFileShas(entry.command);
const greenEvidenceSha = sha256(greenOutput);
const bundleHash = computeBundleHash({
  label: entry.label,
  id: entry.id,
  command: entry.command,
  tags: promotedTags,
  test_file_shas: fileShas,
  red_evidence_sha: "local-promote",
  green_evidence_sha: greenEvidenceSha,
});

const promotedEntry = {
  label: entry.label,
  id: entry.id,
  command: entry.command,
  tags: promotedTags,
  evidence: {
    bundle_hash: bundleHash,
    promoted_at: new Date().toISOString(),
    promoted_by: "local-promote",
    test_file_shas: fileShas,
    red_evidence_sha: "local-promote",
    green_evidence_sha: greenEvidenceSha,
  },
};

const factsContent = existsSync(FACTS) ? readFileSync(FACTS, "utf-8") : "";
const newFacts = `${factsContent.trimEnd()}\n${factsContent.trimEnd() ? "\n" : ""}${stringifyYaml([promotedEntry])}`;

parsed.entries.splice(entryIndex, 1);
const newStaging = serializeStaging(parsed);

writeFileSync(`${FACTS}.tmp`, newFacts);
writeFileSync(`${STAGING}.tmp`, newStaging);
renameSync(`${FACTS}.tmp`, FACTS);
renameSync(`${STAGING}.tmp`, STAGING);

try {
  execSync("bun run facts:sync", { cwd: process.cwd(), stdio: "inherit" });
} catch {
  console.warn("WARNING: facts:sync failed; baselines may be stale");
}
console.log(`Promoted fact '${id}' to .facts`);
