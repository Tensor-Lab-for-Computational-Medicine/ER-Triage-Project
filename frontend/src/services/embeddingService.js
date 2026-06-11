const EMBEDDING_DB = 'ed_triage_embedding_cache_v2';
const EMBEDDING_STORE = 'embeddings';
const EMBEDDING_MODEL = 'Xenova/bge-small-en-v1.5';
const LEGACY_EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';
const EMBEDDING_DIMENSIONS = 384;
const EMBEDDING_VERSION = 'bge_small_en_v1_5_mean_normalized_v1';
const DEFAULT_MAX_CANDIDATES = 512;

let extractorPromise = null;
let extractorReady = false;
const memoryVectors = new Map();

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function hashText(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function openEmbeddingDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB is not available.'));
      return;
    }

    const request = window.indexedDB.open(EMBEDDING_DB, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(EMBEDDING_STORE)) {
        const store = db.createObjectStore(EMBEDDING_STORE, { keyPath: 'id' });
        store.createIndex('namespace', 'namespace', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Embedding cache could not be opened.'));
  });
}

async function readEmbedding(id) {
  const memory = memoryVectors.get(id);
  if (memory) return memory;

  try {
    const db = await openEmbeddingDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(EMBEDDING_STORE, 'readonly');
      const request = tx.objectStore(EMBEDDING_STORE).get(id);
      request.onsuccess = () => {
        const record = request.result;
        if (
          record?.version === EMBEDDING_VERSION &&
          record?.model === EMBEDDING_MODEL &&
          Array.isArray(record.vector) &&
          record.vector.length === EMBEDDING_DIMENSIONS
        ) {
          memoryVectors.set(id, record.vector);
          resolve(record.vector);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error || new Error('Embedding cache read failed.'));
    });
  } catch {
    return null;
  }
}

async function writeEmbedding(record) {
  memoryVectors.set(record.id, record.vector);

  try {
    const db = await openEmbeddingDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(EMBEDDING_STORE, 'readwrite');
      tx.objectStore(EMBEDDING_STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Embedding cache write failed.'));
    });
  } catch {
    // IndexedDB writes are best-effort. In-memory vectors still support the active session.
  }
}

async function loadExtractor() {
  const { pipeline } = await import('@huggingface/transformers');
  const attempts = [];

  if (typeof navigator !== 'undefined' && navigator.gpu) attempts.push({ device: 'webgpu', dtype: 'q8' });
  attempts.push({ dtype: 'q8' });
  attempts.push({});

  let lastError = null;
  for (const options of attempts) {
    try {
      const loaded = await pipeline('feature-extraction', EMBEDDING_MODEL, options);
      extractorReady = true;
      return loaded;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Embedding model could not be loaded.');
}

async function extractor() {
  if (!extractorPromise) extractorPromise = loadExtractor();
  return extractorPromise;
}

function textForEmbedding(text, metadata = {}) {
  const normalized = normalizeText(text);
  if (metadata.role === 'query') {
    return `Represent this sentence for searching relevant emergency medicine passages: ${normalized}`;
  }
  return normalized;
}

async function embedText(text, metadata = {}) {
  const model = await extractor();
  const output = await model(textForEmbedding(text, metadata), { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

async function getStoredEmbedding(namespace, text, metadata = {}) {
  const normalized = normalizeText(text);
  if (!normalized) return null;

  const id = `${namespace}:${hashText(normalized)}`;
  const cached = await readEmbedding(id);
  if (cached) return cached;

  const vector = await embedText(normalized, metadata);
  await writeEmbedding({
    id,
    namespace,
    model: EMBEDDING_MODEL,
    version: EMBEDDING_VERSION,
    text_hash: hashText(normalized),
    vector,
    metadata,
    updated_at: new Date().toISOString()
  });
  return vector;
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    magA += a[index] * a[index];
    magB += b[index] * b[index];
  }

  if (!magA || !magB) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export function semanticEmbeddingMetadata() {
  const hasNavigator = typeof navigator !== 'undefined';
  const hasWebGpu = hasNavigator && Boolean(navigator.gpu);
  return {
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    distance: 'cosine',
    legacy_fallback_model: LEGACY_EMBEDDING_MODEL,
    ready: extractorReady,
    storage: 'IndexedDB',
    runtime: hasWebGpu ? 'WebGPU when available, WASM fallback' : 'WASM fallback'
  };
}

export function semanticEmbeddingsReady() {
  return extractorReady;
}

export async function prewarmSemanticEmbeddings() {
  const vector = await getStoredEmbedding(
    'system:prewarm',
    'emergency triage symptom risk history vital signs question',
    { role: 'prewarm' }
  );
  return {
    ready: Boolean(vector?.length),
    ...semanticEmbeddingMetadata()
  };
}

export async function findSemanticMatch({
  namespace,
  queryText,
  candidates,
  threshold = 0.86,
  candidateText = (item) => item.text,
  candidateId = (item) => item.id
}) {
  const ranked = await rankSemanticMatches({
    namespace,
    queryText,
    candidates,
    threshold,
    candidateText,
    candidateId,
    topK: 1
  });
  return ranked[0] || null;
}

export async function rankSemanticMatches({
  namespace,
  queryText,
  candidates,
  threshold = 0,
  candidateText = (item) => item.text,
  candidateId = (item) => item.id,
  candidateVector = null,
  topK = 10,
  maxCandidates = DEFAULT_MAX_CANDIDATES
}) {
  const filtered = (candidates || [])
    .filter((item) => normalizeText(candidateText(item)))
    .slice(0, Math.max(1, maxCandidates));

  if (!normalizeText(queryText) || !filtered.length) return [];

  const queryVector = await getStoredEmbedding(`${namespace}:query`, queryText, { role: 'query' });
  if (!queryVector) return [];

  const ranked = [];

  for (const candidate of filtered) {
    const text = candidateText(candidate);
    const existingVector = candidateVector?.(candidate);
    const vector = existingVector || await getStoredEmbedding(`${namespace}:candidate`, text, {
      role: 'candidate',
      candidate_id: candidateId(candidate)
    });
    const score = cosineSimilarity(queryVector, vector);
    if (score >= threshold) ranked.push({ candidate, score });
  }

  return ranked
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(1, topK));
}
