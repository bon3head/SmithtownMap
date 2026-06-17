#!/usr/bin/env bun
/**
 * test-quality:lint — Bun-test-aware lint gate scoped to tests/**\/*.test.ts.
 *
 * Enforces the Tier 5 custom ESLint rules (AST-only, no type information):
 *   - tier5-no-trivial/no-trivial-literal-expect
 *   - tier5-no-trivial/require-expect-in-bun-test
 *
 * Usage: bun run scripts/test-quality-lint.ts [file-or-dir]   (default: tests/)
 *
 * ESLint 10 flat-config Linter API: custom rules are registered via the
 * config's `plugins` map (the legacy `linter.defineRule` + eslintrc configType
 * were removed). TypeScript test files are parsed with @typescript-eslint/parser.
 * The source is verified without a filename — a flat config carrying no `files`
 * matcher otherwise reports "No matching configuration found"; the parser
 * handles TS regardless and we render the path ourselves.
 *
 * Divergence from impl plan §5.4/§5.5 (documented in SESSION_RESUME_PRIMER.md):
 *   - No `.eslintrc.tier5.cjs` — eslintrc is gone in ESLint 10; rule wiring lives
 *     here (single source of truth).
 *   - eslint-plugin-proper-tests rules are deferred: they require type
 *     information (parserOptions.project), which contradicts the plan's
 *     "typed-rules off for speed" and the sovereign fast-local mandate.
 *
 * stdout carries the GitHub Actions `::error::` annotation protocol in CI;
 * human-readable diagnostics go to stderr.
 */
import { Linter } from "eslint";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { resolve, join, relative } from "node:path";

const IS_CI = !!process.env.GITHUB_ACTIONS;

const tsParser = require("@typescript-eslint/parser");
const noTrivial = require(
  resolve(process.cwd(), "scripts/eslint-rules/no-trivial-literal-expect.cjs"),
);
const requireExpect = require(
  resolve(process.cwd(), "scripts/eslint-rules/require-expect-in-bun-test.cjs"),
);

const linter = new Linter();

const config: Linter.Config = {
  plugins: {
    "tier5-no-trivial": {
      rules: {
        "no-trivial-literal-expect": noTrivial,
        "require-expect-in-bun-test": requireExpect,
      },
    },
  },
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
  },
  rules: {
    "tier5-no-trivial/no-trivial-literal-expect": "error",
    "tier5-no-trivial/require-expect-in-bun-test": "error",
  },
};

function collectTests(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) collectTests(full, out);
    else if (name.endsWith(".test.ts")) out.push(full);
  }
}

const targetArg = process.argv[2];
const targets: string[] = [];
if (targetArg) {
  if (statSync(targetArg).isFile()) targets.push(targetArg);
  else collectTests(targetArg, targets);
} else if (existsSync("tests")) {
  collectTests("tests", targets);
}

let errorCount = 0;
for (const file of targets) {
  const source = readFileSync(file, "utf-8");
  const messages = linter.verify(source, config);
  for (const m of messages) {
    errorCount++;
    const rel = relative(process.cwd(), file);
    if (IS_CI) {
      console.log(
        `::error file=${rel},line=${m.line},col=${m.column}::${m.ruleId} ${m.message}`,
      );
    } else {
      console.error(`ERROR ${rel}:${m.line}:${m.column} ${m.ruleId} ${m.message}`);
    }
  }
}

if (errorCount === 0) {
  console.error(`✓ test-quality:lint — ${targets.length} file(s) clean`);
}

process.exit(errorCount > 0 ? 1 : 0);
