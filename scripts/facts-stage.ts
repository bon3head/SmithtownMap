#!/usr/bin/env bun
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseStaging, serializeStaging, validateEntry, type StagedFact } from "./lib/factsStaging";

const STAGING = resolve(process.cwd(), ".facts.staging");
const FACTS = resolve(process.cwd(), ".facts");

function parseArgs(): Record<string, string> {
  const values: Record<string, string> = {};
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, "");
    const value = args[i + 1];
    if (key && value !== undefined) values[key] = value;
  }
  return values;
}

function fail(message: string): never {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

const args = parseArgs();
for (const required of ["id", "label", "command", "tags", "spec"]) {
  if (!args[required]) fail(`missing required flag --${required}`);
}

if (!existsSync(resolve(process.cwd(), args.spec))) {
  fail(`spec file not found: ${args.spec}`);
}

const entry: StagedFact = {
  label: args.label,
  id: args.id,
  command: args.command,
  tags: args.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
  spec: args.spec,
  staged_at: new Date().toISOString(),
  chronology: { staged_in_commit: "pending" },
};

try {
  validateEntry(entry);
} catch (error) {
  fail((error as Error).message);
}

const stagingContent = readFileSync(STAGING, "utf-8");
const factsContent = existsSync(FACTS) ? readFileSync(FACTS, "utf-8") : "";
const idLine = `id: ${entry.id}`;
if (stagingContent.includes(idLine) || factsContent.includes(idLine)) {
  fail(`duplicate id '${entry.id}' already exists`);
}

const parsed = parseStaging(stagingContent);
parsed.entries.push(entry);

const tmp = `${STAGING}.tmp`;
writeFileSync(tmp, serializeStaging(parsed));
renameSync(tmp, STAGING);

console.log(`Staged fact '${entry.id}' added to .facts.staging`);
