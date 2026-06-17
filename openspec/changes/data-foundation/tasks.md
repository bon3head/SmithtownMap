# Tasks: data-foundation (Phase 1)

Each capability follows the gated loop: **stage fact (RED) → implement TDD-green →
`facts:promote` → facts-bot ratifies**. Staging commands below are the canonical
`facts:stage` invocations (already run for this change; re-runnable idempotently by id).

## 1. Data ingestion (src/etl/)
- [ ] 1.1 Write RED test `tests/etl/parse-dublin-core.test.ts` (Scaffold §2a/§2b).
- [ ] 1.2 Stage fact `etl-parse`:
  `bun run facts:stage --id etl-parse --label "[Scaffold §2a/§2b] ETL parses PastPerfect Dublin Core XML export into raw record dicts (accessno→id, dc:title→title, …)" --command "bun test tests/etl/parse-dublin-core.test.ts" --tags "spec,phase1,etl" --spec openspec/changes/data-foundation/specs/data-ingestion/spec.md`
- [ ] 1.3 Write RED test `tests/etl/normalize-record.test.ts` (Scaffold §3e).
- [ ] 1.4 Stage fact `etl-normalize`.
- [ ] 1.5 Write RED test `tests/etl/load-postgis.test.ts` (Audit: Postgres+PostGIS).
- [ ] 1.6 Stage fact `etl-load`.
- [ ] 1.7 Implement `src/etl/` to green; `facts:promote etl-parse etl-normalize etl-load`.

## 2. Geocoding (src/geocoding/)
- [ ] 2.1 Write RED test `tests/geocoding/batch-geocode.test.ts` (Scaffold §9a).
- [ ] 2.2 Stage fact `geocode-batch`.
- [ ] 2.3 Write RED test `tests/geocoding/gazetteer.test.ts` (Scaffold §9c).
- [ ] 2.4 Stage fact `geocode-gazetteer`.
- [ ] 2.5 Implement to green; promote both.

## 3. Tag normalization (src/tagging/)
- [ ] 3.1 Write RED test `tests/tagging/aat-normalize.test.ts` (Scaffold §3c/§3e).
- [ ] 3.2 Stage fact `aat-normalize`.
- [ ] 3.3 Implement to green; promote.

## 4. Search index (src/search/)
- [ ] 4.1 Write RED test `tests/search/typesense-schema.test.ts` (Scaffold §7a; Audit: Typesense).
- [ ] 4.2 Stage fact `search-index`.
- [ ] 4.3 Implement to green; promote.

## 5. Gate
- [ ] 5.1 `/opsx:verify data-foundation` green (openspec validate + scoped facts:check + bun test).
- [ ] 5.2 Open PR; facts-bot ratifies the promoted facts into `.facts` post-merge.
