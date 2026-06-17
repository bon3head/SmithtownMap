import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

export interface StagedFact {
  label: string;
  id: string;
  command: string;
  tags: string[];
  spec: string;
  staged_at: string;
  chronology?: { staged_in_commit: string };
}

export interface ParsedStaging {
  schemaVersion: number;
  entries: StagedFact[];
  // Raw header (preserved for round-trip)
  headerComment: string;
}

const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

export function parseStaging(content: string): ParsedStaging {
  const lines = content.split("\n");
  const headerLines: string[] = [];
  let bodyStart = 0;
  let schemaVersion = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("#") || line.trim() === "") {
      headerLines.push(line);
      const m = line.match(/Schema-version:\s*(\d+)/i);
      if (m) schemaVersion = parseInt(m[1], 10);
      bodyStart = i + 1;
    } else {
      break;
    }
  }

  const body = lines.slice(bodyStart).join("\n");
  const raw = body.trim() === "" ? [] : (parseYaml(body) ?? []);

  if (!Array.isArray(raw)) {
    throw new Error("Staging file body must be a YAML array");
  }

  const entries: StagedFact[] = raw.map((e: any, idx: number) => {
    if (typeof e.tags === "string") {
      throw new Error(`Entry ${idx}: tags must be a YAML array, not a comma-string`);
    }
    return e as StagedFact;
  });

  return {
    schemaVersion,
    entries,
    headerComment: headerLines.join("\n"),
  };
}

export function validateEntry(entry: StagedFact): void {
  if (entry.tags.includes("implemented")) {
    throw new Error("staged facts must not contain 'implemented' tag; use 'spec'");
  }
  if (!entry.tags.includes("spec")) {
    throw new Error("staged facts must contain 'spec' tag");
  }
  if (!entry.spec) throw new Error("spec back-reference required");
  if (!ISO_8601.test(entry.staged_at)) {
    throw new Error("staged_at must be ISO 8601 (YYYY-MM-DDTHH:MM:SSZ)");
  }
}

export function serializeStaging(parsed: ParsedStaging): string {
  const body = parsed.entries.length === 0 ? "" : stringifyYaml(parsed.entries);
  return parsed.headerComment + "\n" + body;
}
