import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const BUNDLE_PATH = resolve(ROOT, 'frontend/src/data/public_clinical_knowledge_bundle.json');
const OUTPUT_DIR = resolve(ROOT, 'frontend/public/clinical_vectors/public_em_core_vector_bundle_v1');
const MODEL = 'Xenova/bge-small-en-v1.5';
const DIMENSIONS = 384;

function normalizeText(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function embeddingText(chunk) {
  return normalizeText([
    chunk.section,
    chunk.clinical_rule,
    chunk.evidence_status,
    chunk.text,
    ...(chunk.supporting_quotes || []).map((quote) => quote.text),
    ...(chunk.supporting_quotes || []).map((quote) => quote.search_phrase),
    ...(chunk.topic_tags || []),
    ...(chunk.task_tags || [])
  ].filter(Boolean).join(' '));
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function assertBundle(bundle) {
  if (bundle?.schema_version !== 'clinical_knowledge_bundle_v2') {
    throw new Error('Expected clinical_knowledge_bundle_v2 public bundle.');
  }
  if (bundle.embedding_model !== MODEL || bundle.embedding_dimensions !== DIMENSIONS) {
    throw new Error(`Expected ${MODEL} with ${DIMENSIONS} dimensions.`);
  }
  if (!Array.isArray(bundle.chunks) || !bundle.chunks.length) {
    throw new Error('Public bundle has no chunks to embed.');
  }
}

async function main() {
  const bundle = JSON.parse(readFileSync(BUNDLE_PATH, 'utf8'));
  assertBundle(bundle);
  const requireFromFrontend = createRequire(resolve(ROOT, 'frontend/package.json'));
  const { pipeline } = await import(pathToFileURL(requireFromFrontend.resolve('@huggingface/transformers')).href);

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const chunks = bundle.chunks.map((chunk, index) => ({
    index,
    id: chunk.id,
    source_id: chunk.source_id,
    citation_label: chunk.citation_label,
    section: chunk.section,
    page: chunk.page || '',
    source_url: chunk.source_url || '',
    source_title: chunk.source_title || '',
    organization: chunk.organization || '',
    publication_date: chunk.publication_date || '',
    doi: chunk.doi || '',
    pmid: chunk.pmid || '',
    isbn: chunk.isbn || '',
    locator: chunk.locator || null,
    facet_id: chunk.facet_id,
    topic_tags: chunk.topic_tags,
    task_tags: chunk.task_tags,
    source_tier: chunk.source_tier,
    review_status: chunk.review_status,
    evidence_status: chunk.evidence_status || '',
    supporting_quotes: chunk.supporting_quotes || [],
    clinical_rule: chunk.clinical_rule || '',
    active: chunk.active !== false,
    text_hash_input: embeddingText(chunk)
  }));

  const extractor = await pipeline('feature-extraction', MODEL, { dtype: 'q8' });
  const vectors = new Float32Array(chunks.length * DIMENSIONS);

  for (const chunk of chunks) {
    const output = await extractor(chunk.text_hash_input, { pooling: 'mean', normalize: true });
    if (output.data.length !== DIMENSIONS) {
      throw new Error(`Chunk ${chunk.id} produced ${output.data.length} dimensions.`);
    }
    vectors.set(output.data, chunk.index * DIMENSIONS);
    if ((chunk.index + 1) % 25 === 0 || chunk.index === chunks.length - 1) {
      console.log(`Embedded ${chunk.index + 1}/${chunks.length} chunks`);
    }
  }

  const chunksJson = `${JSON.stringify(chunks.map(({ text_hash_input, ...chunk }) => chunk), null, 2)}\n`;
  const vectorBuffer = Buffer.from(vectors.buffer);

  const manifest = {
    schema_version: 'clinical_vector_manifest_v1',
    bundle_id: bundle.bundle_id,
    generated_at: new Date().toISOString().slice(0, 10),
    embedding_model: MODEL,
    embedding_dimensions: DIMENSIONS,
    distance: bundle.distance || 'cosine',
    vector_dtype: 'float32',
    chunk_count: chunks.length,
    chunks_path: 'chunks.json',
    vectors_path: 'vectors.f32.bin',
    chunks_sha256: sha256(chunksJson),
    vectors_sha256: sha256(vectorBuffer),
    source_bundle_path: '/src/data/public_clinical_knowledge_bundle.json'
  };

  writeFileSync(resolve(OUTPUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(resolve(OUTPUT_DIR, 'chunks.json'), chunksJson);
  writeFileSync(resolve(OUTPUT_DIR, 'vectors.f32.bin'), vectorBuffer);
  console.log(`Wrote vector assets to ${OUTPUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
