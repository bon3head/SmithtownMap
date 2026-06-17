// scripts/lib/tddGuardBunReporter.ts
// Pure transform library: Bun JUnit XML -> tdd-guard TestResult JSON.
// Zero new dependencies; hand-rolled regex parser.

import { mkdirSync, writeFileSync, renameSync } from "node:fs";
import { dirname } from "node:path";

export const DEFAULT_TDD_GUARD_TARGET = ".claude/tdd-guard/data/test.json";

export type TestState = "passed" | "failed" | "skipped";

export interface JunitTestcase {
  name: string;
  classname: string;
  file: string;
  state: TestState;
  failureMessage?: string;
}

export interface JunitDoc {
  testcases: JunitTestcase[];
}

export interface TddGuardTestError {
  message: string;
  stack?: string;
}

export interface TddGuardTest {
  name: string;
  fullName: string;
  state: TestState;
  errors?: TddGuardTestError[];
}

export interface TddGuardModule {
  moduleId: string;
  tests: TddGuardTest[];
}

export interface TddGuardReport {
  testModules: TddGuardModule[];
  reason: "passed" | "failed" | "interrupted";
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}

export function buildTddGuardReport(doc: JunitDoc): TddGuardReport {
  const moduleMap = new Map<string, TddGuardModule>();
  let anyFailed = false;
  for (const tc of doc.testcases) {
    const moduleId = normalizePath(tc.file);
    let mod = moduleMap.get(moduleId);
    if (!mod) {
      mod = { moduleId, tests: [] };
      moduleMap.set(moduleId, mod);
    }
    if (tc.state === "failed") anyFailed = true;
    const test: TddGuardTest = {
      name: tc.name,
      fullName: tc.classname ? `${tc.classname} > ${tc.name}` : tc.name,
      state: tc.state,
    };
    if (tc.state === "failed") {
      test.errors = [{ message: tc.failureMessage ?? "test failed" }];
    }
    mod.tests.push(test);
  }
  return {
    testModules: [...moduleMap.values()],
    reason: anyFailed ? "failed" : "passed",
  };
}

export function writeTddGuardReport(
  report: TddGuardReport,
  path: string = DEFAULT_TDD_GUARD_TARGET,
): void {
  mkdirSync(dirname(path), { recursive: true });
  // Atomic: write to a sibling tmp file, then rename into place.
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmp, JSON.stringify(report));
  renameSync(tmp, path);
}

function unescapeXml(s: string): string {
  return s
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function getAttr(attrs: string, name: string): string {
  const m = attrs.match(new RegExp(`${name}="([^"]*)"`));
  return m ? unescapeXml(m[1]) : "";
}

export function parseJunitXml(xml: string): JunitDoc {
  const testcases: JunitTestcase[] = [];
  // Suite stack tracks the nested <testsuite> ancestry so we can reconstruct
  // each test's describe() path. Bun's own `classname` attr is unreliable for
  // nested describes (it double-escapes the separator, e.g. "a &gt; b"), so we
  // derive classname from ancestry instead. `\b` keeps us from matching the
  // root <testsuites> / </testsuites> wrapper.
  const stack: { name: string; file: string }[] = [];
  const tokenRe =
    /<testsuite\b([^>]*)>|<\/testsuite>|<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(xml)) !== null) {
    if (m[0].startsWith("</testsuite")) {
      stack.pop();
      continue;
    }
    if (m[0].startsWith("<testsuite")) {
      stack.push({ name: getAttr(m[1], "name"), file: getAttr(m[1], "file") });
      continue;
    }
    // testcase
    const attrs = m[2];
    const body = m[4] ?? "";
    let state: TestState = "passed";
    let failureMessage: string | undefined;
    const failure = body.match(/<failure\b([^>]*)/);
    if (failure) {
      state = "failed";
      failureMessage = getAttr(failure[1], "message") || getAttr(failure[1], "type") || "test failed";
    } else if (/<skipped\b/.test(body)) {
      state = "skipped";
    }
    // Describe path = ancestor suites, excluding the file-level suite. The
    // file-level <testsuite> is always the outermost (index 0), so drop it by
    // position — robust even when a describe() is named identically to its file
    // path. The stack resets between files (suites are balanced), so index 0 is
    // always the current file's suite, including multi-file runs.
    const classname = stack
      .slice(1)
      .map((s) => s.name)
      .join(" > ");
    testcases.push({
      name: getAttr(attrs, "name"),
      classname,
      file: getAttr(attrs, "file"),
      state,
      ...(failureMessage ? { failureMessage } : {}),
    });
  }
  return { testcases };
}
