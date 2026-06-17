import { createHash } from "node:crypto";

export interface EvidenceBundle {
  label: string;
  id: string;
  command: string;
  tags: string[];
  test_file_shas: string[];
  red_evidence_sha: string;
  green_evidence_sha: string;
}

export function computeBundleHash(bundle: EvidenceBundle): string {
  const sortedTags = [...bundle.tags].sort().join(",");
  const sortedShas = [...bundle.test_file_shas].sort().join(",");
  const canonical = [
    bundle.label,
    bundle.id,
    bundle.command,
    sortedTags,
    sortedShas,
    bundle.red_evidence_sha,
    bundle.green_evidence_sha,
  ].join("\n");

  return createHash("sha256").update(canonical, "utf-8").digest("hex");
}
