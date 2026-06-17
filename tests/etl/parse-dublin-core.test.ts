import { test, expect } from "bun:test";
// RED until src/etl/parse.ts exists (Scaffold §2a/§2b parse_dublin_core_xml).
import { parseDublinCoreXml } from "../../src/etl/parse";

const SAMPLE = `<?xml version="1.0"?>
<export>
  <record>
    <accessno>1998.12.3</accessno>
    <dc:title xmlns:dc="http://purl.org/dc/elements/1.1/">Smithtown Main Street</dc:title>
    <place>Main Street, Smithtown</place>
  </record>
</export>`;

test("maps accessno to id and dc:title to title", () => {
  const records = parseDublinCoreXml(SAMPLE);
  expect(records).toHaveLength(1);
  expect(records[0].id).toBe("1998.12.3");
  expect(records[0].title).toBe("Smithtown Main Street");
});

test("missing optional element yields empty string, not a crash", () => {
  const records = parseDublinCoreXml(SAMPLE);
  expect(records[0].creator).toBe("");
});
