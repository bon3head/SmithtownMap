# Spec delta: search-index

## ADDED Requirements

### Requirement: Build a Typesense index from ArchiveRecord with typed field mappings
The search layer SHALL build a search index from the normalized `ArchiveRecord` schema
using the field-type intent of Scaffold §7a, realized on **Typesense v27+** (Audit
supersedes the Scaffold's Elasticsearch). The index schema SHALL map:
`title`, `description`, `people` → full-text searchable string fields;
`aat_subjects.term`, `creator`, `collection`, `catalog_type`, `neighborhood`,
`date_decade` → faceted keyword fields; `date_year` → int32 (range faceting);
`lat`, `lng` → a geopoint field (geo distance queries).

#### Scenario: Field-type mapping is correct
- **WHEN** the Typesense collection schema is generated from `ArchiveRecord`
- **THEN** `date_year` is typed `int32` with `facet: true`
- **AND** `title` is a `string` field that is searchable but not faceted
- **AND** `lat`/`lng` are emitted as a single `geopoint` field.

#### Scenario: Only geocoded records get a geopoint
- **WHEN** a record has null `lat`/`lng`
- **THEN** the generated document omits the geopoint field rather than sending nulls.
