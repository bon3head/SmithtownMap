# Spec delta: tag-normalization

## ADDED Requirements

### Requirement: AAT subject normalization
The tagging step SHALL map raw PastPerfect lexicon/subject terms to controlled Getty AAT
terms (Scaffold §3c "Controlled Vocabulary: Getty AAT" / §3e `aat_subjects`), producing
`AATTerm` entries of the shape `{ term, aat_id, hierarchy }`. Smithtown-specific synonyms
SHALL resolve to their canonical AAT term (e.g. "houses"/"homes"/"dwelling" → "Dwellings").
Unmapped terms SHALL be retained as free-text `subject` entries, never dropped.

#### Scenario: Synonym resolves to canonical AAT term
- **WHEN** a raw subject "homes" is normalized
- **THEN** an `aat_subjects` entry exists with `term` = "Dwellings" and a non-empty `aat_id`.

#### Scenario: Unmapped term is preserved
- **WHEN** a raw subject has no AAT mapping
- **THEN** it remains in the `subject` array and produces no `aat_subjects` entry.
