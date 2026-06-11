# Clinical Grounding

The browser app now supports a local retrieval layer for grounding LLM tutor, debrief, and rationale-review text.

## Bundles

Public, redistributable references live in:

```text
frontend/src/data/public_clinical_knowledge_bundle.json
```

Licensed or private textbook bundles should stay local and ignored by git. Recommended names:

```text
clinical_knowledge_bundle.local.json
data/clinical_knowledge_bundle.local.json
frontend/src/data/clinical_knowledge_bundle.local.json
*.local.pdf
data/clinical_sources/local/
frontend/src/data/local_sources/
```

The public production bundle uses `clinical_knowledge_bundle_v2` and declares:

```json
{
  "embedding_model": "Xenova/bge-small-en-v1.5",
  "embedding_dimensions": 384,
  "distance": "cosine"
}
```

Legacy `clinical_knowledge_bundle_v1` files remain loadable for local/private bundles. Each bundle contains:

- `clinical_source_v1` records for source-level metadata.
- `reference_chunk_v1` records for retrievable clinical rules or teaching points.
- `external_ai_use_allowed` on each source, plus a per-session UI opt-in before local snippets are sent to an external model provider.

The v2 browser retrieval path uses dense BGE-small embeddings stored in IndexedDB, BM25 lexical fallback, and source-tier reranking. No API key is required for the default vector database.

## Local Textbook PDF Imports

The Clinical Knowledge panel can import a locally licensed PDF such as a personal Pocket Medicine copy. The import runs entirely in the browser:

- PDF text is extracted page-by-page with PDF.js.
- Repeated page headers/footers are removed when detectable.
- Text is chunked by headings when possible, otherwise into bounded overlapping textbook excerpts.
- Each chunk is private/local-only, has `source_tier: "textbook"`, `license_scope: "licensed_local_only"`, `verification_status: "local_extracted"`, and a short quote excerpt with page locator plus quote hash.
- Chunks are stored in IndexedDB and persist across reloads until the user clears the local source.

Private textbook snippets are not sent to an external LLM provider unless the user enables the existing per-session restricted-snippet opt-in. The Retrieval Test Lab offers `Guidelines first`, `Public only`, `Local textbook only`, and `All sources` modes so local imports can be tested directly without changing the default public guideline behavior.

Public candidate vectors are generated into:

```text
frontend/public/clinical_vectors/public_em_core_vector_bundle_v1/manifest.json
frontend/public/clinical_vectors/public_em_core_vector_bundle_v1/chunks.json
frontend/public/clinical_vectors/public_em_core_vector_bundle_v1/vectors.f32.bin
```

Regenerate the source bundle and vector assets with:

```powershell
node scripts/build_public_clinical_knowledge_bundle.mjs
node scripts/build_public_clinical_vector_assets.mjs
```

## Chunking Guidance

Use short, stable chunks of roughly 250-500 tokens. Prefer one clinical rule, recommendation, or textbook teaching point per chunk. Preserve source title, edition, section, page, URL, DOI, PMID, or ISBN in metadata rather than repeating it in the text.

Use `source_tier` values that reflect citation priority:

```text
ed_specific_guideline
society_guideline
textbook
systematic_review
primary_study
local_teaching_note
```

Retire superseded chunks by setting `active: false` or `superseded_by`, rather than deleting them from historical audit bundles.

## LLM Contract

Grounded LLM outputs should include:

- `claims`: every clinical claim with `case_evidence_ids` and/or `reference_chunk_ids`.
- `citations`: the IDs used by those claims.

Case-specific facts cite case evidence. General clinical principles cite reference chunks. If a model response lacks valid claim-level citations, the app falls back to browser-grounded deterministic guidance instead of rendering the uncited text as clinical advice.

## Audit

The grounding audit can validate cited claims against case data and an optional clinical knowledge bundle:

```powershell
python scripts/audit_grounding.py --cases data/restricted/mimic_iv_ext_cases.restricted.json --outputs data/restricted/generated_outputs.restricted.json --knowledge clinical_knowledge_bundle.local.json
```

The audit classifies cited outputs as `case_supported`, `clinical_supported`, `unsupported`, `contradicted`, `stale_source`, or `license_violation`.
