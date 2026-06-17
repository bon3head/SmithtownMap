#!/usr/bin/env bun
/**
 * run-contextlint — inline SPEC structural linter for docs/specs/.
 * Sovereign: no external `bunx contextlint` (built inline against
 * .contextlintrc.yml using the present `yaml` dep). Built incrementally per TDD.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import { parse as parseYaml } from "yaml";

const CONFIG = resolve(process.cwd(), ".contextlintrc.yml");
const SPECS_DIR = resolve(process.cwd(), "docs/specs");
const IS_CI = !!process.env.GITHUB_ACTIONS;

function emit(severity: "error" | "warning", file: string, line: number, msg: string): void {
  if (IS_CI) {
    console.log(`::${severity} file=${file},line=${line},col=1::${msg}`);
  } else {
    console.error(`${severity.toUpperCase()} ${file}:${line} — ${msg}`);
  }
}

if (!existsSync(CONFIG)) {
  console.error("ERROR: .contextlintrc.yml not found");
  process.exit(1);
}

const cfg: any = parseYaml(readFileSync(CONFIG, "utf-8")) ?? {};

function walk(dir: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith(".md")) out.push(full);
  }
}

const files: string[] = [];
walk(SPECS_DIR, files);

const requiredRule = cfg.rules?.["required-sections"];
const required: string[] =
  requiredRule?.enabled ? (requiredRule.sections ?? []) : [];

const placeholderRule = cfg.rules?.["no-placeholders"];
const placeholderPatterns: string[] =
  placeholderRule?.enabled ? (placeholderRule.patterns ?? []) : [];

const excludePaths: string[] = cfg.excludePaths ?? [];
function isExcluded(rel: string): boolean {
  return excludePaths.some((g) => {
    const base = g.replace(/\/\*\*$/, ""); // dir/** -> dir; exact paths unchanged
    return rel === base || rel.startsWith(base + "/");
  });
}

let hasError = false;

for (const file of files) {
  const rel = relative(process.cwd(), file);
  if (isExcluded(rel)) continue;
  const content = readFileSync(file, "utf-8");

  for (const section of required) {
    const esc = section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const heading = new RegExp(`^#{1,6}\\s+.*${esc}`, "m");
    if (!heading.test(content)) {
      emit("error", rel, 1, `missing required section "${section}"`);
      hasError = true;
    }
  }

  // no-placeholders: flag TBD/TODO/FIXME/XXX outside fenced code blocks.
  const fileLines = content.split("\n");
  let inFence = false;
  for (let i = 0; i < fileLines.length; i++) {
    const ln = fileLines[i];
    if (/^\s*```/.test(ln)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    for (const p of placeholderPatterns) {
      if (new RegExp(p).test(ln)) {
        emit("error", rel, i + 1, `placeholder marker matches /${p}/`);
        hasError = true;
      }
    }
  }
}

if (!hasError) {
  console.error("✓ contextlint clean");
}

process.exit(hasError ? 1 : 0);
