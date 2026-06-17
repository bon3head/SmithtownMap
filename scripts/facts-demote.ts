#!/usr/bin/env bun
import { execSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { parseStaging, serializeStaging, validateEntry, type StagedFact } from "./lib/factsStaging";

const FACTS = resolve(process.cwd(), ".facts");
const STAGING = resolve(process.cwd(), ".facts.staging");

function fail(message: string): never {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function specArg(): string {
  const index = process.argv.indexOf("--spec");
  if (index === -1 || !process.argv[index + 1]) fail("--spec <path> required");
  return process.argv[index + 1];
}

function findFactBlock(content: string, id: string): { start: number; end: number; entry: any } | null {
  const lines = content.split("\n");
  const idIndex = lines.findIndex((line) => line.trim() === `id: ${id}`);
  if (idIndex === -1) return null;

  let start = idIndex;
  while (start > 0 && !lines[start].startsWith("- ")) start--;

  let end = idIndex + 1;
  while (end < lines.length && !lines[end].startsWith("- ") && !lines[end].startsWith("#")) end++;

  const parsed = parseYaml(lines.slice(start, end).join("\n"));
  const entry = Array.isArray(parsed) ? parsed[0] : parsed;
  return { start, end, entry };
}

const id = process.argv[2];
if (!id) fail("usage: bun run facts:demote <id> --spec <path>");

const spec = specArg();
if (!existsSync(resolve(process.cwd(), spec))) fail(`spec file not found: ${spec}`);

const factsContent = readFileSync(FACTS, "utf-8");
const found = findFactBlock(factsContent, id);
if (!found) fail(`fact '${id}' not found in .facts`);

const stagingContent = readFileSync(STAGING, "utf-8");
const staging = parseStaging(stagingContent);
if (staging.entries.some((entry) => entry.id === id)) {
  fail(`duplicate id '${id}' already exists in .facts.staging`);
}

const tags = (found.entry.tags as string[]).map((tag) => tag === "implemented" ? "spec" : tag);
const stagedEntry: StagedFact = {
  label: found.entry.label,
  id: found.entry.id,
  command: found.entry.command,
  tags,
  spec,
  staged_at: new Date().toISOString(),
  chronology: { staged_in_commit: "pending" },
};
validateEntry(stagedEntry);

const factsLines = factsContent.split("\n");
const newFacts = [...factsLines.slice(0, found.start), ...factsLines.slice(found.end)].join("\n");
staging.entries.push(stagedEntry);

writeFileSync(`${FACTS}.tmp`, newFacts);
writeFileSync(`${STAGING}.tmp`, serializeStaging(staging));
renameSync(`${FACTS}.tmp`, FACTS);
renameSync(`${STAGING}.tmp`, STAGING);

try {
  execSync("bun run facts:sync", { cwd: process.cwd(), stdio: "inherit" });
} catch {
  console.warn("WARNING: facts:sync failed; baselines may be stale");
}
console.log(`Demoted fact '${id}' to .facts.staging`);
