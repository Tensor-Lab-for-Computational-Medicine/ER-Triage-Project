import publicClinicalKnowledgeBundle from '../data/public_clinical_knowledge_bundle.json';
import { rankSemanticMatches, semanticEmbeddingMetadata, semanticEmbeddingsReady } from './embeddingService';
import {
  LEARNER_FACING_OPEN_EVIDENCE_POLICY_VERSION,
  evidenceEligibilityForLearnerFacingUse,
  isGeneratedNeedsReviewReferenceChunk,
  isQuoteBackedReferenceChunk
} from './openEvidencePolicyService';
import {
  classifyClinicalRisk,
  isHighRiskClinicalQuery
} from './highRiskClinicalClassificationService';

const LOCAL_KNOWLEDGE_STATE_KEY = 'ed_triage_local_clinical_knowledge_state_v1';
const LOCAL_KNOWLEDGE_DB = 'ed_triage_local_clinical_knowledge_v1';
const LOCAL_KNOWLEDGE_STORE = 'bundles';
const ACTIVE_LOCAL_KNOWLEDGE_ID = 'active';
const KNOWLEDGE_EMBEDDING_NAMESPACE = 'clinical-knowledge-v2-bge-small';
const CURRENT_KNOWLEDGE_SCHEMA = 'clinical_knowledge_bundle_v2';
const LEGACY_KNOWLEDGE_SCHEMA = 'clinical_knowledge_bundle_v1';
const CURRENT_EMBEDDING_MODEL = 'Xenova/bge-small-en-v1.5';
const LEGACY_EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';
const CURRENT_EMBEDDING_DIMENSIONS = 384;
const CURRENT_DISTANCE = 'cosine';
const SEMANTIC_RETRIEVAL_TIMEOUT_MS = 2500;
const HIGH_RISK_MIN_RETRIEVAL_BASE_SCORE = 0.08;
const STANDARD_MIN_RETRIEVAL_BASE_SCORE = 0.01;
const MIN_CASE_SUPPORT_SCORE = 0.18;
const MIN_REFERENCE_SUPPORT_SCORE = 0.12;
const CLAIM_SUPPORT_STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'patient',
  'case',
  'from',
  'into',
  'after',
  'before',
  'should',
  'would',
  'could',
  'needs',
  'need',
  'clinical',
  'recommendation',
  'recommendations',
  'evidence'
]);
const DEFAULT_VECTOR_STORAGE = {
  mode: 'indexeddb_runtime_embeddings',
  planned_assets: ['manifest.json', 'chunks.json', 'vectors.f32.bin']
};

const SOURCE_TIER_WEIGHT = {
  ed_specific_guideline: 0.22,
  society_guideline: 0.18,
  textbook: 0.14,
  systematic_review: 0.1,
  primary_study: 0.06,
  local_teaching_note: 0.03
};

const TASK_FACET_WEIGHT = {
  triage: {
    recognition: 0.2,
    red_flags: 0.18,
    focused_assessment: 0.08
  },
  diagnosis: {
    diagnostic_strategy: 0.22,
    focused_assessment: 0.16,
    recognition: 0.08
  },
  management: {
    initial_management: 0.24,
    medication_procedure: 0.22,
    diagnostic_strategy: 0.12,
    disposition_reassessment: 0.08
  },
  reassessment: {
    disposition_reassessment: 0.22,
    initial_management: 0.1,
    red_flags: 0.08
  },
  sbar: {
    teaching_handoff: 0.2,
    disposition_reassessment: 0.16
  },
  tutor: {
    teaching_handoff: 0.12,
    focused_assessment: 0.1,
    diagnostic_strategy: 0.08
  }
};

const REQUIRED_SOURCE_FIELDS = [
  'schema_version',
  'id',
  'title',
  'organization',
  'publisher',
  'publication_date',
  'source_tier',
  'license_scope',
  'review_status',
  'external_ai_use_allowed'
];

const REQUIRED_CHUNK_FIELDS = [
  'schema_version',
  'id',
  'source_id',
  'section',
  'topic_tags',
  'task_tags',
  'source_tier',
  'review_status',
  'text'
];

const VERIFICATION_STATUS_LABELS = {
  human_verified: 'Human verified',
  anchored: 'Anchored',
  local_extracted: 'Quote extracted',
  source_level_only: 'Source-level only',
  needs_review: 'Needs review'
};

const EVIDENCE_STATUS_LABELS = {
  quote_backed: 'Quote-backed',
  source_level_only: 'Source-level only',
  generated_needs_review: 'Generated needs review'
};

let localClinicalKnowledgeBundle = null;

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizedText(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value) {
  return normalizedText(value)
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function unique(items = []) {
  return [...new Set(items.filter(Boolean))];
}

function withTimeout(promise, timeoutMs, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([
    promise.finally(() => clearTimeout(timeoutId)),
    timeout
  ]);
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function normalizeSearchPhrases(value) {
  return asArray(value)
    .flat()
    .map(cleanText)
    .filter(Boolean)
    .slice(0, 5);
}

function sourceById(bundle) {
  return Object.fromEntries((bundle.sources || []).map((source) => [source.id, source]));
}

function assertRequired(record, fields, label) {
  for (const field of fields) {
    if (record[field] === undefined || record[field] === null || record[field] === '') {
      throw new Error(`${label} ${record.id || 'unknown'} is missing ${field}.`);
    }
  }
}

function normalizeSource(source) {
  assertRequired(source, REQUIRED_SOURCE_FIELDS, 'Clinical source');
  if (source.schema_version !== 'clinical_source_v1') {
    throw new Error(`Clinical source ${source.id} must use clinical_source_v1.`);
  }
  return {
    ...source,
    id: cleanText(source.id),
    title: cleanText(source.title),
    organization: cleanText(source.organization),
    publisher: cleanText(source.publisher),
    edition: cleanText(source.edition),
    version: cleanText(source.version),
    publication_date: cleanText(source.publication_date),
    url: cleanText(source.url),
    doi: cleanText(source.doi),
    pmid: cleanText(source.pmid),
    isbn: cleanText(source.isbn),
    source_tier: cleanText(source.source_tier),
    license_scope: cleanText(source.license_scope),
    review_status: cleanText(source.review_status),
    external_ai_use_allowed: Boolean(source.external_ai_use_allowed),
    local_file_id: cleanText(source.local_file_id),
    file_name: cleanText(source.file_name),
    imported_at: cleanText(source.imported_at),
    page_count: Number(source.page_count || 0)
  };
}

function normalizeLocator(chunk, source) {
  const raw = chunk.locator && typeof chunk.locator === 'object' ? chunk.locator : {};
  const sourceUrl = cleanText(raw.url || chunk.source_url || source.url);
  const sectionHeading = cleanText(raw.section_heading || chunk.section);
  const page = cleanText(raw.page || chunk.page);
  const searchPhrases = normalizeSearchPhrases(raw.search_phrases);
  const explicitAnchor = Boolean(
    raw.section_heading ||
    raw.page ||
    searchPhrases.length ||
    chunk.doi ||
    source.doi ||
    chunk.pmid ||
    source.pmid ||
    chunk.isbn ||
    source.isbn
  );
  const providedStatus = cleanText(raw.verification_status);
  const verificationStatus = VERIFICATION_STATUS_LABELS[providedStatus]
    ? providedStatus
    : (sourceUrl && explicitAnchor ? 'anchored' : 'source_level_only');
  return {
    url: sourceUrl,
    section_heading: sectionHeading,
    page,
    search_phrases: searchPhrases,
    locator_quality: cleanText(raw.locator_quality || (explicitAnchor ? 'source_url_with_search_phrase' : 'broad_source_link')),
    verification_status: verificationStatus
  };
}

function normalizeSupportingQuotes(chunk, source, locator) {
  return asArray(chunk.supporting_quotes)
    .filter((quote) => quote && typeof quote === 'object')
    .map((quote) => ({
      text: cleanText(quote.text),
      source_url: cleanText(quote.source_url || locator?.url || chunk.source_url || source.url),
      source_title: cleanText(quote.source_title || chunk.source_title || source.title),
      organization: cleanText(quote.organization || chunk.organization || source.organization),
      local_file_id: cleanText(quote.local_file_id || chunk.local_file_id || source.local_file_id),
      section_heading: cleanText(quote.section_heading || locator?.section_heading || chunk.section),
      page: cleanText(quote.page || locator?.page || chunk.page),
      search_phrase: cleanText(quote.search_phrase || quote.text || locator?.search_phrases?.[0]),
      quote_hash: cleanText(quote.quote_hash),
      word_count: Number(quote.word_count || cleanText(quote.text).split(/\s+/).filter(Boolean).length),
      extraction_date: cleanText(quote.extraction_date),
      verification_status: cleanText(quote.verification_status || 'needs_review')
    }))
    .filter((quote) => quote.text && (quote.source_url || quote.local_file_id) && quote.quote_hash);
}

function evidenceStatusForChunk(chunk, supportingQuotes = []) {
  const explicit = cleanText(chunk.evidence_status);
  if (explicit && EVIDENCE_STATUS_LABELS[explicit]) return explicit;
  if (supportingQuotes.length) return 'quote_backed';
  if (chunk.locator?.verification_status === 'source_level_only') return 'source_level_only';
  return 'generated_needs_review';
}

function locatorIsAuditable(locator, chunk = {}, source = {}) {
  const status = locator?.verification_status || chunk.verification_status || '';
  if (!['anchored', 'human_verified', 'local_extracted'].includes(status)) return false;
  const sourceUrl = cleanText(locator?.url || chunk.source_url || source.url);
  const localFileId = cleanText(chunk.local_file_id || source.local_file_id);
  const hasLocator = Boolean(
    locator?.section_heading ||
    locator?.page ||
    chunk.doi ||
    source.doi ||
    chunk.pmid ||
    source.pmid ||
    chunk.isbn ||
    source.isbn ||
    (Array.isArray(locator?.search_phrases) && locator.search_phrases.length)
  );
  if (status === 'local_extracted') {
    return Boolean(localFileId && locator?.page && hasLocator && chunk.supporting_quotes?.length);
  }
  return Boolean(sourceUrl && hasLocator);
}

function verificationLabel(status) {
  return VERIFICATION_STATUS_LABELS[status] || VERIFICATION_STATUS_LABELS.needs_review;
}

function normalizeChunk(chunk, sources, bundleId) {
  assertRequired(chunk, REQUIRED_CHUNK_FIELDS, 'Reference chunk');
  if (chunk.schema_version !== 'reference_chunk_v1') {
    throw new Error(`Reference chunk ${chunk.id} must use reference_chunk_v1.`);
  }
  const source = sources[chunk.source_id];
  if (!source) throw new Error(`Reference chunk ${chunk.id} points to missing source ${chunk.source_id}.`);
  const text = cleanText(chunk.text);
  if (text.length < 40) throw new Error(`Reference chunk ${chunk.id} is too short to ground a clinical claim.`);
  const locator = normalizeLocator(chunk, source);
  const supportingQuotes = normalizeSupportingQuotes(chunk, source, locator);
  const evidenceStatus = evidenceStatusForChunk(chunk, supportingQuotes);
  const quoteBacked = evidenceStatus === 'quote_backed' && supportingQuotes.length > 0;
  return {
    ...chunk,
    id: cleanText(chunk.id),
    source_id: cleanText(chunk.source_id),
    section: cleanText(chunk.section),
    page: cleanText(chunk.page),
    citation_label: cleanText(chunk.citation_label),
    facet_id: cleanText(chunk.facet_id),
    topic_tags: unique((chunk.topic_tags || []).map(cleanText)),
    task_tags: unique((chunk.task_tags || []).map(cleanText)),
    source_tier: cleanText(chunk.source_tier || source.source_tier),
    source_url: cleanText(chunk.source_url || source.url),
    source_title: cleanText(chunk.source_title || source.title),
    organization: cleanText(chunk.organization || source.organization),
    publication_date: cleanText(chunk.publication_date || source.publication_date),
    doi: cleanText(chunk.doi || source.doi),
    pmid: cleanText(chunk.pmid || source.pmid),
    isbn: cleanText(chunk.isbn || source.isbn),
    local_file_id: cleanText(chunk.local_file_id || source.local_file_id),
    source_file_name: cleanText(chunk.source_file_name || source.file_name),
    locator,
    verification_status: locator.verification_status,
    locator_quality: locator.locator_quality,
    auditable: locatorIsAuditable(locator, chunk, source),
    evidence_status: evidenceStatus,
    evidence_label: EVIDENCE_STATUS_LABELS[evidenceStatus] || EVIDENCE_STATUS_LABELS.generated_needs_review,
    quote_backed: quoteBacked,
    supporting_quotes: supportingQuotes,
    review_status: cleanText(chunk.review_status),
    active: chunk.active !== false,
    superseded_by: cleanText(chunk.superseded_by),
    clinical_rule: cleanText(chunk.clinical_rule),
    text,
    normalized_text: normalizedText(chunk.normalized_text || text),
    bundle_id: bundleId,
    source
  };
}

export function validateClinicalKnowledgeBundle(payload, fileName = '') {
  const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
  const schemaVersion = parsed?.schema_version;
  if (![CURRENT_KNOWLEDGE_SCHEMA, LEGACY_KNOWLEDGE_SCHEMA].includes(schemaVersion)) {
    throw new Error(`Clinical knowledge bundle must use ${CURRENT_KNOWLEDGE_SCHEMA} or ${LEGACY_KNOWLEDGE_SCHEMA}.`);
  }
  if (!Array.isArray(parsed.sources) || !parsed.sources.length) {
    throw new Error('Clinical knowledge bundle must include a non-empty sources array.');
  }
  if (!Array.isArray(parsed.chunks) || !parsed.chunks.length) {
    throw new Error('Clinical knowledge bundle must include a non-empty chunks array.');
  }

  const sources = parsed.sources.map(normalizeSource);
  const sourceMap = sourceById({ sources });
  const chunks = parsed.chunks.map((chunk) =>
    normalizeChunk(chunk, sourceMap, parsed.bundle_id || fileName || 'clinical_knowledge_bundle')
  );

  const duplicateSource = sources.find((source, index) => sources.findIndex((item) => item.id === source.id) !== index);
  const duplicateChunk = chunks.find((chunk, index) => chunks.findIndex((item) => item.id === chunk.id) !== index);
  if (duplicateSource) throw new Error(`Duplicate clinical source id: ${duplicateSource.id}.`);
  if (duplicateChunk) throw new Error(`Duplicate reference chunk id: ${duplicateChunk.id}.`);

  return {
    ...parsed,
    bundle_id: cleanText(parsed.bundle_id || fileName || 'clinical_knowledge_bundle'),
    title: cleanText(parsed.title || fileName || 'Clinical knowledge bundle'),
    description: cleanText(parsed.description),
    generated_at: cleanText(parsed.generated_at),
    embedding_model: cleanText(parsed.embedding_model || (schemaVersion === LEGACY_KNOWLEDGE_SCHEMA ? LEGACY_EMBEDDING_MODEL : CURRENT_EMBEDDING_MODEL)),
    embedding_dimensions: Number(parsed.embedding_dimensions || CURRENT_EMBEDDING_DIMENSIONS),
    distance: cleanText(parsed.distance || CURRENT_DISTANCE),
    vector_storage: parsed.vector_storage || DEFAULT_VECTOR_STORAGE,
    retrieval_policy: parsed.retrieval_policy || {
      mode: 'hybrid_dense_bm25_source_rerank',
      quality_goal: 'safety_precision',
      high_risk_fail_closed: true
    },
    file_name: fileName,
    sources,
    chunks
  };
}

const publicBundle = validateClinicalKnowledgeBundle(publicClinicalKnowledgeBundle, 'public_clinical_knowledge_bundle.json');
let publicVectorAssetsPromise = null;

function activeBundles() {
  return [publicBundle, localClinicalKnowledgeBundle].filter(Boolean);
}

function allChunks() {
  return activeBundles().flatMap((bundle) => bundle.chunks || []);
}

function openLocalKnowledgeDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available for local clinical knowledge storage.'));
      return;
    }
    const request = indexedDB.open(LOCAL_KNOWLEDGE_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LOCAL_KNOWLEDGE_STORE)) {
        db.createObjectStore(LOCAL_KNOWLEDGE_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Local clinical knowledge store could not be opened.'));
  });
}

async function persistLocalKnowledgeBundle(bundle) {
  try {
    const db = await openLocalKnowledgeDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(LOCAL_KNOWLEDGE_STORE, 'readwrite');
      tx.objectStore(LOCAL_KNOWLEDGE_STORE).put({
        id: ACTIVE_LOCAL_KNOWLEDGE_ID,
        bundle,
        saved_at: new Date().toISOString()
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Local clinical knowledge bundle could not be saved.'));
    });
  } catch {
    // Browser persistence is best-effort; the active in-memory bundle remains usable.
  }
}

async function readPersistedLocalKnowledgeBundle() {
  try {
    const db = await openLocalKnowledgeDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(LOCAL_KNOWLEDGE_STORE, 'readonly');
      const request = tx.objectStore(LOCAL_KNOWLEDGE_STORE).get(ACTIVE_LOCAL_KNOWLEDGE_ID);
      request.onsuccess = () => resolve(request.result?.bundle || null);
      request.onerror = () => reject(request.error || new Error('Local clinical knowledge bundle could not be read.'));
    });
  } catch {
    return null;
  }
}

async function deletePersistedLocalKnowledgeBundle() {
  try {
    const db = await openLocalKnowledgeDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(LOCAL_KNOWLEDGE_STORE, 'readwrite');
      tx.objectStore(LOCAL_KNOWLEDGE_STORE).delete(ACTIVE_LOCAL_KNOWLEDGE_ID);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Local clinical knowledge bundle could not be cleared.'));
    });
  } catch {
    // Best-effort cleanup.
  }
}

async function loadPublicVectorAssets() {
  if (typeof fetch !== 'function') return null;
  if (publicVectorAssetsPromise) return publicVectorAssetsPromise;

  publicVectorAssetsPromise = (async () => {
    const basePath = publicBundle.vector_storage?.asset_base_path;
    if (!basePath) return null;
    try {
      const [manifestResponse, chunksResponse, vectorsResponse] = await Promise.all([
        fetch(`${basePath}manifest.json`),
        fetch(`${basePath}chunks.json`),
        fetch(`${basePath}vectors.f32.bin`)
      ]);
      if (!manifestResponse.ok || !chunksResponse.ok || !vectorsResponse.ok) return null;
      const manifest = await manifestResponse.json();
      const chunks = await chunksResponse.json();
      const vectorBuffer = await vectorsResponse.arrayBuffer();
      if (
        manifest.bundle_id !== publicBundle.bundle_id ||
        manifest.embedding_model !== publicBundle.embedding_model ||
        Number(manifest.embedding_dimensions) !== publicBundle.embedding_dimensions
      ) {
        return null;
      }
      const vectors = new Float32Array(vectorBuffer);
      if (vectors.length !== chunks.length * publicBundle.embedding_dimensions) return null;
      const vectorsByChunkId = new Map();
      chunks.forEach((chunk, index) => {
        vectorsByChunkId.set(
          chunk.id,
          vectors.subarray(
            index * publicBundle.embedding_dimensions,
            (index + 1) * publicBundle.embedding_dimensions
          )
        );
      });
      return {
        manifest,
        vectorsByChunkId
      };
    } catch {
      return null;
    }
  })();

  return publicVectorAssetsPromise;
}

function isLocalRestrictedChunk(chunk) {
  const scope = `${chunk.license_scope || chunk.source?.license_scope || ''}`.toLowerCase();
  return chunk.bundle_id !== publicBundle.bundle_id || /licensed|restricted|textbook|local/.test(scope);
}

function eligibleForExternalAi(chunk, allowLicensedSnippets) {
  const sourceAllows = chunk.source?.external_ai_use_allowed !== false;
  if (!sourceAllows) return false;
  if (!isLocalRestrictedChunk(chunk)) return true;
  return Boolean(allowLicensedSnippets);
}

function chunkSearchText(chunk) {
  return [
    chunk.section,
    chunk.clinical_rule,
    chunk.evidence_status,
    chunk.text,
    ...(chunk.supporting_quotes || []).map((quote) => quote.text),
    ...(chunk.supporting_quotes || []).map((quote) => quote.search_phrase),
    ...(chunk.topic_tags || []),
    ...(chunk.task_tags || []),
    chunk.source?.title,
    chunk.source?.organization
  ].filter(Boolean).join(' ');
}

function tokenCounts(tokens = []) {
  return tokens.reduce((counts, token) => {
    counts[token] = (counts[token] || 0) + 1;
    return counts;
  }, {});
}

function buildCorpusStats(corpus = []) {
  const documents = corpus.map((chunk) => {
    const tokens = tokenize(chunkSearchText(chunk));
    const counts = tokenCounts(tokens);
    return {
      id: chunk.id,
      length: tokens.length,
      counts,
      uniqueTerms: new Set(tokens)
    };
  });
  const documentFrequency = new Map();
  for (const document of documents) {
    for (const term of document.uniqueTerms) {
      documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1);
    }
  }
  return {
    documentCount: documents.length,
    averageLength: Math.max(
      1,
      documents.reduce((sum, document) => sum + document.length, 0) / Math.max(documents.length, 1)
    ),
    documentFrequency,
    documentsById: new Map(documents.map((document) => [document.id, document]))
  };
}

function bm25Score(query, chunk, corpusStats = null) {
  const queryTerms = unique(tokenize(query));
  if (!queryTerms.length) return 0;

  const fallbackTokens = corpusStats ? [] : tokenize(chunkSearchText(chunk));
  const fallbackDocument = {
    id: chunk.id,
    length: fallbackTokens.length,
    counts: tokenCounts(fallbackTokens),
    uniqueTerms: new Set(fallbackTokens)
  };
  const document = corpusStats?.documentsById.get(chunk.id) || fallbackDocument;
  if (!document.length) return 0;

  const documentCount = corpusStats?.documentCount || 1;
  const averageLength = corpusStats?.averageLength || Math.max(1, document.length);
  const k1 = 1.2;
  const b = 0.75;

  const rawScore = queryTerms.reduce((score, term) => {
    const frequency = document.counts[term] || 0;
    if (!frequency) return score;
    const documentFrequency = corpusStats?.documentFrequency.get(term) || (document.uniqueTerms.has(term) ? 1 : 0);
    const idf = Math.log(1 + ((documentCount - documentFrequency + 0.5) / (documentFrequency + 0.5)));
    const denominator = frequency + k1 * (1 - b + b * (document.length / averageLength));
    return score + idf * ((frequency * (k1 + 1)) / denominator);
  }, 0);

  return rawScore / (rawScore + queryTerms.length + 1);
}

function lexicalScore(query, chunk, corpusStats = null) {
  return bm25Score(query, chunk, corpusStats);
}

function recencyScore(source) {
  const yearMatch = String(source?.publication_date || '').match(/\b(19|20)\d{2}\b/);
  if (!yearMatch) return 0;
  const year = Number(yearMatch[0]);
  if (!year || year < 2010) return 0;
  return Math.min(0.08, Math.max(0, (year - 2010) * 0.005));
}

function taskScore(task, chunk) {
  const normalizedTask = String(task || '').toLowerCase();
  if (!normalizedTask) return 0;
  const tags = (chunk.task_tags || []).map((item) => item.toLowerCase());
  const facetWeight = TASK_FACET_WEIGHT[normalizedTask]?.[chunk.facet_id] || 0;
  if (tags.includes(normalizedTask)) return 0.28 + facetWeight;
  return -0.18;
}

function taskAligned(task, chunk) {
  const normalizedTask = String(task || '').toLowerCase();
  if (!normalizedTask) return true;
  const tags = (chunk.task_tags || []).map((item) => item.toLowerCase());
  return tags.includes(normalizedTask) || Boolean(TASK_FACET_WEIGHT[normalizedTask]?.[chunk.facet_id]);
}

function evidenceScore(chunk) {
  if (chunk.quote_backed || chunk.evidence_status === 'quote_backed') return 0.5;
  if (chunk.evidence_status === 'generated_needs_review') return -0.35;
  if (chunk.evidence_status === 'source_level_only') return -0.2;
  return 0;
}

function sourceModeScore(chunk, sourceMode, highRisk = false) {
  if (sourceMode !== 'guidelines_first') return 0;
  if (!isLocalRestrictedChunk(chunk)) return 0.16;
  if (chunk.source_tier === 'textbook') return highRisk ? -0.22 : 0.04;
  return -0.08;
}

function finalScore(query, task, chunk, semanticScore = 0, lexical = 0, sourceMode = 'guidelines_first') {
  const base = Math.max(semanticScore, lexical);
  return base +
    (SOURCE_TIER_WEIGHT[chunk.source_tier] || 0) +
    sourceModeScore(chunk, sourceMode, isHighRiskClinicalQuery(query, { task })) +
    evidenceScore(chunk) +
    recencyScore(chunk.source) +
    taskScore(task, chunk);
}

function citationLabel(index) {
  return `C${index + 1}`;
}

function citationTitle(chunk) {
  const source = chunk.source || {};
  const edition = source.edition ? `, ${source.edition}` : '';
  const location = [chunk.section, chunk.page ? `p. ${chunk.page}` : ''].filter(Boolean).join(', ');
  return `${source.title || 'Clinical source'}${edition}${location ? `, ${location}` : ''}`;
}

function diversifyBySource(ranked, maxResults) {
  const limit = Math.max(1, maxResults);
  const selected = [];
  const sourceCounts = new Map();
  const minUniqueSources = Math.min(3, limit, new Set(ranked.map((item) => item.chunk.source_id)).size);
  const hasSelected = (item) => selected.includes(item);

  for (const item of ranked) {
    if (sourceCounts.has(item.chunk.source_id)) continue;
    selected.push(item);
    sourceCounts.set(item.chunk.source_id, 1);
    if (selected.length >= minUniqueSources) break;
  }

  for (const item of ranked) {
    if (hasSelected(item)) continue;
    const count = sourceCounts.get(item.chunk.source_id) || 0;
    if (count >= 2) continue;
    selected.push(item);
    sourceCounts.set(item.chunk.source_id, count + 1);
    if (selected.length >= limit) break;
  }

  if (selected.length >= limit) return selected;
  for (const item of ranked) {
    if (hasSelected(item)) continue;
    selected.push(item);
    if (selected.length >= limit) break;
  }
  return selected;
}

function roundedScore(value) {
  return Number((Number(value || 0)).toFixed(3));
}

function retrievalSemanticStatus({ useSemantic, semanticScores, semanticWarning, vectorAssetsLoaded }) {
  if (!useSemantic) return 'bm25_requested';
  if (semanticScores?.size > 0) return vectorAssetsLoaded ? 'semantic_rerank_used' : 'semantic_rerank_runtime_embeddings';
  if (semanticWarning) return 'bm25_fallback_visible';
  return 'bm25_fallback_visible';
}

function buildRetrievalQuality({
  highRisk,
  requireQuoteBacked,
  useSemantic,
  semanticScores,
  semanticWarning,
  vectorAssetsLoaded,
  selected,
  failClosed,
  weakHighRiskRetrieval,
  weakQuoteSupport,
  weakSourceVerification,
  selectedViolatesEvidencePolicy,
  quoteBackedCandidateChunks
}) {
  const topBaseScore = selected[0]?.baseScore || 0;
  const minimumBaseScoreRequired = highRisk ? HIGH_RISK_MIN_RETRIEVAL_BASE_SCORE : STANDARD_MIN_RETRIEVAL_BASE_SCORE;
  const semanticStatus = retrievalSemanticStatus({
    useSemantic,
    semanticScores,
    semanticWarning,
    vectorAssetsLoaded
  });
  const quoteBackedSupportPresent = selected.some((item) => isQuoteBackedReferenceChunk(item.chunk));
  const auditableSupportPresent = selected.some((item) =>
    locatorIsAuditable(item.chunk.locator, item.chunk, item.chunk.source)
  );
  const failClosedReasons = [];
  if (!selected.length) failClosedReasons.push('no_references_selected');
  if (weakHighRiskRetrieval) failClosedReasons.push('high_risk_minimum_score_not_met');
  if (weakQuoteSupport) failClosedReasons.push('quote_backed_support_missing');
  if (weakSourceVerification) failClosedReasons.push('auditable_locator_missing');
  if (selectedViolatesEvidencePolicy) failClosedReasons.push('evidence_policy_violation');
  if (requireQuoteBacked && !quoteBackedCandidateChunks.length) failClosedReasons.push('no_quote_backed_candidates');

  const qualityBadges = [
    highRisk ? 'High-risk retrieval' : 'Standard retrieval',
    semanticStatus === 'semantic_rerank_used' || semanticStatus === 'semantic_rerank_runtime_embeddings'
      ? 'Semantic rerank visible'
      : 'BM25 fallback visible',
    requireQuoteBacked ? 'Quote-backed required' : 'Reviewed evidence only',
    failClosed ? 'Fail closed' : 'Threshold met'
  ];

  return {
    schema_version: 'clinical_retrieval_quality_v1',
    badge: failClosed
      ? 'Fail closed retrieval'
      : (highRisk ? 'High-risk retrieval quality met' : 'Retrieval quality met'),
    status: failClosed ? 'fail_closed' : 'usable',
    high_risk: Boolean(highRisk),
    semantic_status: semanticStatus,
    semantic_fallback_visible: semanticStatus === 'bm25_fallback_visible',
    semantic_warning: semanticWarning || '',
    minimum_base_score_required: roundedScore(minimumBaseScoreRequired),
    top_base_score: roundedScore(topBaseScore),
    threshold_passed: !highRisk || topBaseScore >= HIGH_RISK_MIN_RETRIEVAL_BASE_SCORE,
    quote_backed_only_required: Boolean(requireQuoteBacked),
    quote_backed_support_present: quoteBackedSupportPresent,
    auditable_support_present: auditableSupportPresent,
    generated_needs_review_allowed: false,
    fail_closed: Boolean(failClosed),
    fail_closed_reasons: failClosedReasons,
    quality_badges: qualityBadges
  };
}

function emptyRetrievalQuality({ badge, status = 'fail_closed', reason = 'no_query', semanticStatus = 'not_run' } = {}) {
  return {
    schema_version: 'clinical_retrieval_quality_v1',
    badge: badge || 'Fail closed retrieval',
    status,
    high_risk: false,
    semantic_status: semanticStatus,
    semantic_fallback_visible: false,
    semantic_warning: '',
    minimum_base_score_required: roundedScore(STANDARD_MIN_RETRIEVAL_BASE_SCORE),
    top_base_score: 0,
    threshold_passed: false,
    quote_backed_only_required: true,
    quote_backed_support_present: false,
    auditable_support_present: false,
    generated_needs_review_allowed: false,
    fail_closed: true,
    fail_closed_reasons: [reason],
    quality_badges: [badge || 'Fail closed retrieval']
  };
}

function isAdministrativeNonclinicalQuery(query) {
  const administrative = /\b(parking|cafeteria|housing|maintenance|room booking|book a room|meeting|vacation|holiday|schedule|calendar|tuition|invoice|payroll|wifi|printer|email|badge|id card)\b/i.test(query);
  const clinical = /\b(patient|triage|diagnos|differential|symptom|vital|exam|history|pain|fever|dyspnea|breath|hypox|shock|sepsis|stroke|chest|abdomen|pregnan|ectopic|bleed|trauma|injur|head|vomit|dizzy|syncope|overdose|opioid|naloxone|agitat|restraint|dka|hhs|diabetes|insulin|potassium|ecg|ekg|troponin|ct\b|imaging|lab|medication|treatment|management|reassess|disposition|handoff|consult|admission|transfer|icu|ed\b|emergency)\b/i.test(query);
  return administrative && !clinical;
}

function asReference(index, chunk, score, includeSnippet, details = {}) {
  const locator = chunk.locator || normalizeLocator(chunk, chunk.source || {});
  const sourceUrl = chunk.source_url || locator.url || chunk.source?.url || '';
  return {
    reference_chunk_id: chunk.id,
    citation_label: citationLabel(index),
    source_citation_label: chunk.citation_label || '',
    citation_title: citationTitle(chunk),
    source_id: chunk.source_id,
    source_title: chunk.source_title || chunk.source?.title || '',
    source_organization: chunk.organization || chunk.source?.organization || '',
    source_tier: chunk.source_tier,
    source_url: sourceUrl,
    doi: chunk.doi || chunk.source?.doi || '',
    pmid: chunk.pmid || chunk.source?.pmid || '',
    isbn: chunk.isbn || chunk.source?.isbn || '',
    local_file_id: chunk.local_file_id || chunk.source?.local_file_id || '',
    source_file_name: chunk.source_file_name || chunk.source?.file_name || '',
    publication_date: chunk.publication_date || chunk.source?.publication_date || '',
    section: chunk.section,
    page: chunk.page || '',
    locator,
    locator_quality: locator.locator_quality,
    verification_status: locator.verification_status,
    verification_label: verificationLabel(locator.verification_status),
    auditable: locatorIsAuditable(locator, chunk, chunk.source || {}),
    evidence_status: chunk.evidence_status || 'generated_needs_review',
    evidence_label: chunk.evidence_label || EVIDENCE_STATUS_LABELS[chunk.evidence_status] || EVIDENCE_STATUS_LABELS.generated_needs_review,
    quote_backed: Boolean(chunk.quote_backed || chunk.evidence_status === 'quote_backed'),
    learner_facing_authoritative: isQuoteBackedReferenceChunk(chunk),
    supporting_quotes: chunk.supporting_quotes || [],
    original_quote: chunk.supporting_quotes?.[0]?.text || '',
    facet_id: chunk.facet_id || '',
    license_scope: chunk.source?.license_scope || '',
    private_source: isLocalRestrictedChunk(chunk),
    topic_tags: chunk.topic_tags || [],
    task_tags: chunk.task_tags || [],
    bundle_id: chunk.bundle_id || '',
    external_ai_use_allowed: eligibleForExternalAi(chunk, true),
    score: Number(score.toFixed(3)),
    semantic_score: Number((details.semanticScore || 0).toFixed(3)),
    lexical_score: Number((details.lexicalScore || 0).toFixed(3)),
    snippet: includeSnippet ? chunk.text : '',
    text: includeSnippet ? chunk.text : ''
  };
}

export async function retrieveClinicalReferences({
  queryText,
  task = '',
  maxResults = 6,
  allowLicensedSnippets = false,
  includePrivateSources = false,
  includeSnippets = true,
  useSemantic = true,
  quoteBackedOnly = false,
  allowGeneratedNeedsReview = false,
  sourceMode = 'guidelines_first'
} = {}) {
  const query = cleanText(queryText);
  if (!query) return {
    schema_version: 'clinical_retrieval_result_v1',
    evidence_policy_version: LEARNER_FACING_OPEN_EVIDENCE_POLICY_VERSION,
    retrieval_quality: emptyRetrievalQuality({
      badge: 'No query supplied',
      reason: 'no_query',
      semanticStatus: 'not_run'
    }),
    references: [],
    warnings: ['No clinical retrieval query supplied.'],
    fail_closed: true
  };
  if (isAdministrativeNonclinicalQuery(query)) {
    return {
      schema_version: 'clinical_retrieval_result_v1',
      evidence_policy_version: LEARNER_FACING_OPEN_EVIDENCE_POLICY_VERSION,
      query,
      task,
      retrieval_mode: 'scope_guardrail',
      retrieval_quality: emptyRetrievalQuality({
        badge: 'Scope guardrail',
        reason: 'nonclinical_scope_guardrail',
        semanticStatus: 'scope_guardrail'
      }),
      quote_backed_only: true,
      allow_generated_needs_review: false,
      generated_needs_review_candidate_count: 0,
      quarantined_candidate_count: 0,
      candidate_count: 0,
      background_candidate_count: 0,
      quote_backed_candidate_count: 0,
      fail_closed: true,
      references: [],
      warnings: ['This query does not appear to ask a clinical education question; learner-facing clinical references were not retrieved.']
    };
  }

  const riskClassification = classifyClinicalRisk({ queryText: query, task });
  const highRisk = riskClassification.high_risk;
  const baseCandidateChunks = allChunks()
    .filter((chunk) => chunk.active !== false)
    .filter((chunk) => chunk.review_status === 'reviewed')
    .filter((chunk) => !chunk.superseded_by)
    .filter((chunk) => includePrivateSources || !isLocalRestrictedChunk(chunk))
    .filter((chunk) => {
      if (sourceMode === 'public_only') return chunk.bundle_id === publicBundle.bundle_id;
      if (sourceMode === 'local_textbook_only') return isLocalRestrictedChunk(chunk) && chunk.source_tier === 'textbook';
      return true;
    })
    .filter((chunk) => !isLocalRestrictedChunk(chunk) || allowLicensedSnippets || includePrivateSources);
  const generatedNeedsReviewCandidateCount = baseCandidateChunks.filter(isGeneratedNeedsReviewReferenceChunk).length;
  const quoteBackedCandidateChunks = baseCandidateChunks.filter(isQuoteBackedReferenceChunk);
  const requireQuoteBacked = Boolean(quoteBackedOnly || highRisk);
  const candidateChunks = baseCandidateChunks.filter((chunk) =>
    evidenceEligibilityForLearnerFacingUse(chunk, {
      requireQuoteBacked,
      allowGeneratedNeedsReview
    })
  );
  const quarantinedCandidateCount = baseCandidateChunks.length - candidateChunks.length;

  if (!candidateChunks.length) {
    const retrievalQuality = buildRetrievalQuality({
      highRisk,
      requireQuoteBacked,
      useSemantic,
      semanticScores: new Map(),
      semanticWarning: useSemantic ? 'No eligible candidates; semantic rerank was not attempted.' : '',
      vectorAssetsLoaded: false,
      selected: [],
      failClosed: true,
      weakHighRiskRetrieval: highRisk,
      weakQuoteSupport: false,
      weakSourceVerification: false,
      selectedViolatesEvidencePolicy: false,
      quoteBackedCandidateChunks
    });
    return {
      schema_version: 'clinical_retrieval_result_v1',
      evidence_policy_version: LEARNER_FACING_OPEN_EVIDENCE_POLICY_VERSION,
      query,
      task,
      retrieval_mode: useSemantic ? 'hybrid_dense_bm25_source_rerank' : 'bm25_source_rerank',
      risk_classification: riskClassification,
      retrieval_quality: retrievalQuality,
      source_mode: sourceMode,
      quote_backed_only: requireQuoteBacked,
      allow_generated_needs_review: Boolean(allowGeneratedNeedsReview),
      generated_needs_review_candidate_count: generatedNeedsReviewCandidateCount,
      quarantined_candidate_count: quarantinedCandidateCount,
      candidate_count: 0,
      background_candidate_count: baseCandidateChunks.length,
      quote_backed_candidate_count: quoteBackedCandidateChunks.length,
      fail_closed: true,
      references: [],
      warnings: [
        requireQuoteBacked
          ? 'No quote-backed clinical chunks are available for this query; learner-facing recommendations are blocked.'
          : 'No eligible clinical reference chunks were available after evidence policy filtering.'
      ]
    };
  }

  let semanticScores = new Map();
  let semanticWarning = '';
  let vectorAssetsLoaded = false;
  if (useSemantic && semanticEmbeddingsReady()) {
    try {
      const vectorAssets = await loadPublicVectorAssets();
      vectorAssetsLoaded = Boolean(vectorAssets?.vectorsByChunkId?.size);
      const ranked = await withTimeout(rankSemanticMatches({
        namespace: KNOWLEDGE_EMBEDDING_NAMESPACE,
        queryText: query,
        candidates: candidateChunks,
        threshold: 0,
        topK: candidateChunks.length,
        maxCandidates: candidateChunks.length,
        candidateText: chunkSearchText,
        candidateId: (chunk) => chunk.id,
        candidateVector: (chunk) => (
          chunk.bundle_id === publicBundle.bundle_id ? vectorAssets?.vectorsByChunkId.get(chunk.id) : null
        )
      }), SEMANTIC_RETRIEVAL_TIMEOUT_MS, 'Semantic retrieval timed out; using BM25 fallback.');
      semanticScores = new Map(ranked.map((item) => [item.candidate.id, item.score]));
    } catch (error) {
      semanticWarning = error?.message || 'Semantic retrieval unavailable; using BM25 fallback.';
      semanticScores = new Map();
    }
  } else if (useSemantic) {
    semanticWarning = 'Semantic vector model is warming; using BM25 fallback for this request.';
  }

  const corpusStats = buildCorpusStats(candidateChunks);
  const ranked = candidateChunks
    .map((chunk) => {
      const semanticScore = semanticScores.get(chunk.id) || 0;
      const lexical = lexicalScore(query, chunk, corpusStats);
      const baseScore = Math.max(semanticScore, lexical);
      return {
        chunk,
        baseScore,
        semanticScore,
        lexicalScore: lexical,
        score: finalScore(query, task, chunk, semanticScore, lexical, sourceMode)
      };
    })
    .filter((item) => item.baseScore > 0.01)
    .sort((left, right) => right.score - left.score);

  const taskAlignedRanked = task ? ranked.filter((item) => taskAligned(task, item.chunk)) : ranked;
  const selected = diversifyBySource(taskAlignedRanked.length >= Math.min(maxResults, 3) ? taskAlignedRanked : ranked, maxResults);
  const weakHighRiskRetrieval = highRisk && (!selected.length || selected[0].baseScore < 0.08);
  const weakQuoteSupport = highRisk && selected.length > 0 &&
    !selected.some((item) => isQuoteBackedReferenceChunk(item.chunk));
  const weakSourceVerification = highRisk && selected.length > 0 &&
    !selected.some((item) => locatorIsAuditable(item.chunk.locator, item.chunk, item.chunk.source));
  const selectedViolatesEvidencePolicy = selected.some((item) =>
    !evidenceEligibilityForLearnerFacingUse(item.chunk, {
      requireQuoteBacked,
      allowGeneratedNeedsReview
    })
  );
  const warnings = [];
  if (semanticWarning) warnings.push(semanticWarning);
  if (!selected.length) warnings.push('No relevant clinical references matched the query.');
  if (!allowGeneratedNeedsReview && quarantinedCandidateCount > 0) {
    warnings.push('Generated-needs-review chunks were quarantined and not used for learner-facing retrieval.');
  }
  if (requireQuoteBacked && quoteBackedCandidateChunks.length && quoteBackedCandidateChunks.length < baseCandidateChunks.length) {
    warnings.push('Quote-backed-only mode hid generated background chunks that still need review.');
  }
  if (requireQuoteBacked && !quoteBackedCandidateChunks.length) {
    warnings.push('No quote-backed clinical chunks are available for this high-risk query; block learner-facing recommendations.');
  }
  if (weakHighRiskRetrieval) {
    warnings.push('High-risk clinical query has weak retrieval support; block learner-facing AI recommendations until stronger sources are retrieved.');
  }
  if (weakQuoteSupport) {
    warnings.push('High-risk clinical query lacks quote-backed source support; block learner-facing AI recommendations until verified quotes are retrieved.');
  }
  if (weakSourceVerification) {
    warnings.push('High-risk clinical query lacks an auditable source locator in the retrieved references; verify source support before learner-facing recommendations.');
  }
  const failClosed = selectedViolatesEvidencePolicy
    || weakHighRiskRetrieval
    || weakSourceVerification
    || weakQuoteSupport
    || (requireQuoteBacked && !quoteBackedCandidateChunks.length);
  const retrievalQuality = buildRetrievalQuality({
    highRisk,
    requireQuoteBacked,
    useSemantic,
    semanticScores,
    semanticWarning,
    vectorAssetsLoaded,
    selected,
    failClosed,
    weakHighRiskRetrieval,
    weakQuoteSupport,
    weakSourceVerification,
    selectedViolatesEvidencePolicy,
    quoteBackedCandidateChunks
  });

  return {
    schema_version: 'clinical_retrieval_result_v1',
    query,
    task,
    embedding_namespace: KNOWLEDGE_EMBEDDING_NAMESPACE,
    embedding_model: publicBundle.embedding_model,
    distance: publicBundle.distance,
    retrieval_mode: useSemantic ? 'hybrid_dense_bm25_source_rerank' : 'bm25_source_rerank',
    evidence_policy_version: LEARNER_FACING_OPEN_EVIDENCE_POLICY_VERSION,
    source_mode: sourceMode,
    risk_classification: riskClassification,
    retrieval_quality: retrievalQuality,
    quote_backed_only: requireQuoteBacked,
    allow_generated_needs_review: Boolean(allowGeneratedNeedsReview),
    semantic_ready: semanticEmbeddingsReady(),
    vector_assets_loaded: vectorAssetsLoaded,
    candidate_count: candidateChunks.length,
    background_candidate_count: baseCandidateChunks.length,
    quote_backed_candidate_count: quoteBackedCandidateChunks.length,
    generated_needs_review_candidate_count: generatedNeedsReviewCandidateCount,
    quarantined_candidate_count: quarantinedCandidateCount,
    fail_closed: failClosed,
    references: selected.map((item, index) => asReference(index, item.chunk, item.score, includeSnippets, item)),
    warnings
  };
}

export function loadLocalClinicalKnowledgeBundle(payload, fileName = '') {
  localClinicalKnowledgeBundle = validateClinicalKnowledgeBundle(payload, fileName);
  try {
    window.sessionStorage?.setItem(LOCAL_KNOWLEDGE_STATE_KEY, JSON.stringify({
      file_name: fileName,
      bundle_id: localClinicalKnowledgeBundle.bundle_id,
      title: localClinicalKnowledgeBundle.title,
      chunk_count: localClinicalKnowledgeBundle.chunks.length,
      source_count: localClinicalKnowledgeBundle.sources.length
    }));
  } catch {
    // The source text intentionally stays in memory only.
  }
  persistLocalKnowledgeBundle(localClinicalKnowledgeBundle);
  return getClinicalKnowledgeState();
}

export function clearLocalClinicalKnowledgeBundle() {
  localClinicalKnowledgeBundle = null;
  try {
    window.sessionStorage?.removeItem(LOCAL_KNOWLEDGE_STATE_KEY);
  } catch {
    // Session storage is best-effort.
  }
  deletePersistedLocalKnowledgeBundle();
  return getClinicalKnowledgeState();
}

export async function restoreLocalClinicalKnowledgeBundle() {
  if (localClinicalKnowledgeBundle) return getClinicalKnowledgeState();
  const persisted = await readPersistedLocalKnowledgeBundle();
  if (!persisted) return getClinicalKnowledgeState();
  localClinicalKnowledgeBundle = validateClinicalKnowledgeBundle(persisted, persisted.file_name || 'local_clinical_knowledge_bundle');
  return getClinicalKnowledgeState();
}

export function getClinicalKnowledgeState() {
  const localChunks = localClinicalKnowledgeBundle?.chunks || [];
  const localSources = localClinicalKnowledgeBundle?.sources || [];
  return {
    schema_version: 'clinical_knowledge_state_v1',
    public_bundle: {
      bundle_id: publicBundle.bundle_id,
      title: publicBundle.title,
      source_count: publicBundle.sources.length,
      chunk_count: publicBundle.chunks.length,
      schema_version: publicBundle.schema_version,
      embedding_model: publicBundle.embedding_model,
      embedding_dimensions: publicBundle.embedding_dimensions,
      distance: publicBundle.distance,
      vector_storage: publicBundle.vector_storage,
      retrieval_policy: publicBundle.retrieval_policy
    },
    local_bundle: localClinicalKnowledgeBundle ? {
      bundle_id: localClinicalKnowledgeBundle.bundle_id,
      title: localClinicalKnowledgeBundle.title,
      file_name: localClinicalKnowledgeBundle.file_name || '',
      source_count: localSources.length,
      chunk_count: localChunks.length,
      schema_version: localClinicalKnowledgeBundle.schema_version,
      embedding_model: localClinicalKnowledgeBundle.embedding_model,
      embedding_dimensions: localClinicalKnowledgeBundle.embedding_dimensions,
      distance: localClinicalKnowledgeBundle.distance,
      restricted_chunk_count: localChunks.filter(isLocalRestrictedChunk).length,
      local_file_id: localClinicalKnowledgeBundle.sources?.[0]?.local_file_id || '',
      page_count: localClinicalKnowledgeBundle.sources?.[0]?.page_count || localClinicalKnowledgeBundle.local_import?.page_count || 0,
      imported_at: localClinicalKnowledgeBundle.sources?.[0]?.imported_at || localClinicalKnowledgeBundle.local_import?.imported_at || '',
      source_tier: localClinicalKnowledgeBundle.sources?.[0]?.source_tier || ''
    } : null,
    total_source_count: publicBundle.sources.length + localSources.length,
    total_chunk_count: publicBundle.chunks.length + localChunks.length,
    has_local_bundle: Boolean(localClinicalKnowledgeBundle),
    has_restricted_local_snippets: localChunks.some(isLocalRestrictedChunk),
    embedding_runtime: semanticEmbeddingMetadata()
  };
}

export function compactReferencesForPrompt(retrievalResult) {
  return (retrievalResult?.references || []).map((reference) => ({
    reference_chunk_id: reference.reference_chunk_id,
    citation_label: reference.citation_label,
    source: reference.citation_title,
    source_tier: reference.source_tier,
    publication_date: reference.publication_date,
    url: reference.source_url,
    verification_status: reference.verification_status,
    auditable: Boolean(reference.auditable),
    evidence_status: reference.evidence_status,
    quote_backed: Boolean(reference.quote_backed),
    supporting_quotes: (reference.supporting_quotes || []).map((quote) => ({
      text: quote.text,
      quote_hash: quote.quote_hash,
      section_heading: quote.section_heading,
      page: quote.page,
      search_phrase: quote.search_phrase
    })),
    locator: {
      section_heading: reference.locator?.section_heading || reference.section || '',
      page: reference.locator?.page || reference.page || '',
      search_phrases: reference.locator?.search_phrases || []
    },
    snippet: reference.snippet
  }));
}

function claimSupportTokens(value) {
  return tokenize(value).filter((token) => !CLAIM_SUPPORT_STOPWORDS.has(token));
}

function supportTextForCaseEvidence(item = {}) {
  return [
    item.label,
    item.text,
    item.provenance,
    item.use
  ].filter(Boolean).join(' ');
}

function supportTextForReference(reference = {}) {
  return [
    reference.snippet,
    reference.text,
    reference.original_quote,
    ...(reference.supporting_quotes || []).map((quote) => quote.text),
    ...(reference.supporting_quotes || []).map((quote) => quote.search_phrase),
    reference.citation_title,
    reference.source_title,
    reference.facet_id,
    ...(reference.topic_tags || []),
    ...(reference.task_tags || [])
  ].filter(Boolean).join(' ');
}

function textSupportScore(claimText, supportText) {
  const claimTokens = claimSupportTokens(claimText);
  const supportTokens = claimSupportTokens(supportText);
  if (!claimTokens.length || !supportTokens.length) return 0;
  const supportTokenSet = new Set(supportTokens);
  const claim = normalizedText(claimText);
  const support = normalizedText(supportText);
  if (claim && support && (support.includes(claim) || claim.includes(support))) return 1;
  const overlap = claimTokens.filter((token) => supportTokenSet.has(token)).length;
  return roundedScore(overlap / Math.max(claimTokens.length, 1));
}

function bestTextSupport(claimText, supportItems = [], supportTextBuilder) {
  return supportItems.reduce((best, item) => {
    const score = textSupportScore(claimText, supportTextBuilder(item));
    if (score <= best.score) return best;
    return {
      score,
      support_id: item.case_evidence_id || item.reference_chunk_id || '',
      support_label: item.label || item.citation_label || item.source_citation_label || item.reference_chunk_id || ''
    };
  }, {
    score: 0,
    support_id: '',
    support_label: ''
  });
}

function referenceEsiFromCaseEvidence(caseEvidence = []) {
  const joined = caseEvidence.map(supportTextForCaseEvidence).join(' ');
  const match = joined.match(/\bReference\s+ESI\s*([1-5])\b/i) || joined.match(/\bESI\s*([1-5])\b/i);
  return match?.[1] || '';
}

function dispositionFromCaseEvidence(caseEvidence = []) {
  const disposition = caseEvidence.find((item) =>
    /disposition/i.test(`${item.case_evidence_id || ''} ${item.label || ''}`)
  );
  return cleanText(disposition?.text || '');
}

function contradictionReasonForClaim(claimText, caseEvidence = []) {
  const text = cleanText(claimText);
  const lowered = text.toLowerCase();
  const referenceEsi = referenceEsiFromCaseEvidence(caseEvidence);
  const claimEsi = text.match(/\bESI\s*([1-5])\b/i)?.[1] || '';
  if (referenceEsi && claimEsi && referenceEsi !== claimEsi) {
    return `mentions ESI ${claimEsi} but case evidence says Reference ESI ${referenceEsi}`;
  }

  const disposition = dispositionFromCaseEvidence(caseEvidence);
  const dispositionLower = disposition.toLowerCase();
  if (dispositionLower) {
    const claimSaysDischarge = /\b(discharge|discharged|home)\b/.test(lowered);
    const claimSaysAdmit = /\b(admit|admitted|admission|floor|ward|icu|observation)\b/.test(lowered);
    const sourceSaysAdmit = /\b(admit|admitted|admission|floor|ward|icu|observation)\b/.test(dispositionLower);
    const sourceSaysDischarge = /\b(discharge|discharged|home)\b/.test(dispositionLower);
    if (sourceSaysAdmit && claimSaysDischarge) {
      return `mentions discharge/home but case disposition is ${disposition}`;
    }
    if (sourceSaysDischarge && claimSaysAdmit) {
      return `mentions admission/observation but case disposition is ${disposition}`;
    }
  }
  return '';
}

function claimNeedsReferenceSupport({ highRiskClaim, category, referenceRefs }) {
  const normalizedCategory = cleanText(category).toLowerCase();
  const referenceRequiredCategory = /diagnos|test|treat|management|medication|procedure|triage|red_flag|disposition|safety/.test(normalizedCategory);
  return Boolean(highRiskClaim && (referenceRefs.length || referenceRequiredCategory));
}

export function validateGroundedClinicalOutput(rawOutput, { caseEvidence = [], references = [] } = {}) {
  const caseIds = new Set(caseEvidence.map((item) => item.case_evidence_id).filter(Boolean));
  const referenceIds = new Set(references.map((item) => item.reference_chunk_id).filter(Boolean));
  const sourceByReference = Object.fromEntries(references.map((item) => [item.reference_chunk_id, item]));
  const claims = Array.isArray(rawOutput?.claims) ? rawOutput.claims : [];
  const citations = Array.isArray(rawOutput?.citations) ? rawOutput.citations : [];
  const issues = [];
  const supportQualityClaims = [];

  if (!claims.length) {
    issues.push('Model output did not include claim-level citations.');
  }

  const normalizedClaims = claims.map((claim, index) => {
    const text = cleanText(claim.text || claim.claim);
    const category = cleanText(claim.category || 'clinical_claim');
    const caseRefs = unique([
      ...asArray(claim.case_evidence_ids).flat(),
      ...asArray(claim.case_evidence_id)
    ].map(cleanText));
    const referenceRefs = unique([
      ...asArray(claim.reference_chunk_ids).flat(),
      ...asArray(claim.reference_chunk_id)
    ].map(cleanText));
    const invalidCaseRefs = caseRefs.filter((id) => !caseIds.has(id));
    const invalidReferenceRefs = referenceRefs.filter((id) => !referenceIds.has(id));
    if (!caseRefs.length && !referenceRefs.length) {
      issues.push(`Claim ${index + 1} has no citation.`);
    }
    if (invalidCaseRefs.length) {
      issues.push(`Claim ${index + 1} cites unavailable case evidence: ${invalidCaseRefs.join(', ')}.`);
    }
    if (invalidReferenceRefs.length) {
      issues.push(`Claim ${index + 1} cites unavailable clinical references: ${invalidReferenceRefs.join(', ')}.`);
    }
    const highRiskClaim = classifyClinicalRisk({
      queryText: `${text} ${category}`,
      claimDomain: category
    }).high_risk;
    const citedCaseEvidence = caseRefs.map((id) => caseEvidence.find((item) => item.case_evidence_id === id)).filter(Boolean);
    const citedReferences = referenceRefs.map((id) => sourceByReference[id]).filter(Boolean);
    const bestCaseSupport = bestTextSupport(text, citedCaseEvidence, supportTextForCaseEvidence);
    const bestReferenceSupport = bestTextSupport(text, citedReferences, supportTextForReference);
    const contradictionReason = contradictionReasonForClaim(text, caseEvidence);
    const needsReferenceSupport = claimNeedsReferenceSupport({
      highRiskClaim,
      category,
      referenceRefs
    });
    let supportStatus = 'not_checked';
    if (contradictionReason) {
      supportStatus = 'contradicted';
      issues.push(`Claim ${index + 1} contradicts case evidence: ${contradictionReason}.`);
    } else if (highRiskClaim) {
      const caseSupported = bestCaseSupport.score >= MIN_CASE_SUPPORT_SCORE;
      const referenceSupported = bestReferenceSupport.score >= MIN_REFERENCE_SUPPORT_SCORE;
      if (needsReferenceSupport && !referenceRefs.length) {
        supportStatus = 'missing_reference_support';
        issues.push(`Claim ${index + 1} is high-risk and lacks a clinical reference citation.`);
      } else if (needsReferenceSupport && !referenceSupported) {
        supportStatus = 'weak_reference_support';
        issues.push(`Claim ${index + 1} cites clinical references that do not textually support the claim.`);
      } else if (caseRefs.length && !caseSupported) {
        supportStatus = 'weak_case_support';
        issues.push(`Claim ${index + 1} cites case evidence that does not textually support the claim.`);
      } else {
        supportStatus = 'supported';
      }
    } else if (caseRefs.length || referenceRefs.length) {
      supportStatus = bestCaseSupport.score >= MIN_CASE_SUPPORT_SCORE || bestReferenceSupport.score >= MIN_REFERENCE_SUPPORT_SCORE
        ? 'supported'
        : 'weak_support_not_high_risk';
    }
    if (referenceRefs.length && highRiskClaim && !referenceRefs.some((id) => sourceByReference[id]?.auditable)) {
      issues.push(`Claim ${index + 1} cites clinical references without auditable source locators.`);
    }
    if (referenceRefs.length && highRiskClaim && !referenceRefs.some((id) =>
      sourceByReference[id]?.quote_backed && sourceByReference[id]?.supporting_quotes?.length
    )) {
      issues.push(`Claim ${index + 1} cites high-risk clinical support without an original quote.`);
    }
    supportQualityClaims.push({
      claim_id: cleanText(claim.claim_id || `claim_${index + 1}`),
      status: supportStatus,
      high_risk: Boolean(highRiskClaim),
      contradiction_reason: contradictionReason,
      best_case_support_score: bestCaseSupport.score,
      best_case_support_id: bestCaseSupport.support_id,
      best_reference_support_score: bestReferenceSupport.score,
      best_reference_support_id: bestReferenceSupport.support_id,
      minimum_case_support_score: MIN_CASE_SUPPORT_SCORE,
      minimum_reference_support_score: MIN_REFERENCE_SUPPORT_SCORE
    });
    return {
      claim_id: cleanText(claim.claim_id || `claim_${index + 1}`),
      text,
      category,
      case_evidence_ids: caseRefs,
      reference_chunk_ids: referenceRefs,
      citation_labels: referenceRefs.map((id) => sourceByReference[id]?.citation_label).filter(Boolean),
      support_quality: supportQualityClaims[supportQualityClaims.length - 1]
    };
  });

  const citedReferenceIds = unique([
    ...normalizedClaims.flatMap((claim) => claim.reference_chunk_ids),
    ...citations.map((citation) => cleanText(citation.reference_chunk_id)).filter(Boolean)
  ]);
  const citedCaseIds = unique([
    ...normalizedClaims.flatMap((claim) => claim.case_evidence_ids),
    ...citations.map((citation) => cleanText(citation.case_evidence_id)).filter(Boolean)
  ]);

  return {
    schema_version: 'grounded_llm_output_v1',
    status: issues.length ? 'needs_review' : 'grounded',
    issues,
    support_quality: {
      schema_version: 'grounded_claim_support_quality_v1',
      status: issues.length ? 'needs_review' : 'passed',
      checked_claims: supportQualityClaims.length,
      supported_claims: supportQualityClaims.filter((claim) => claim.status === 'supported').length,
      weak_support_claims: supportQualityClaims.filter((claim) => /weak|missing_reference_support/.test(claim.status)).length,
      contradicted_claims: supportQualityClaims.filter((claim) => claim.status === 'contradicted').length,
      minimum_case_support_score: MIN_CASE_SUPPORT_SCORE,
      minimum_reference_support_score: MIN_REFERENCE_SUPPORT_SCORE,
      claims: supportQualityClaims
    },
    claims: normalizedClaims,
    citations: {
      case_evidence_ids: citedCaseIds,
      reference_chunk_ids: citedReferenceIds,
      references: references.filter((item) => citedReferenceIds.includes(item.reference_chunk_id)),
      case_evidence: caseEvidence.filter((item) => citedCaseIds.includes(item.case_evidence_id))
    }
  };
}
