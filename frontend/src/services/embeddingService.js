const EMBEDDING_DB = 'ed_triage_embedding_cache_v1';
const EMBEDDING_STORE = 'embeddings';
const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';
const EMBEDDING_VERSION = 'minilm_l6_v2_mean_normalized_v1';
const MAX_CANDIDATES = 80;

let extractorPromise = null;
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
        if (record?.version === EMBEDDING_VERSION && Array.isArray(record.vector)) {
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

  if (navigator.gpu) attempts.push({ device: 'webgpu', dtype: 'q8' });
  attempts.push({ dtype: 'q8' });
  attempts.push({});

  let lastError = null;
  for (const options of attempts) {
    try {
      return await pipeline('feature-extraction', EMBEDDING_MODEL, options);
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

async function embedText(text) {
  const model = await extractor();
  const output = await model(normalizeText(text), { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

async function getStoredEmbedding(namespace, text, metadata = {}) {
  const normalized = normalizeText(text);
  if (!normalized) return null;

  const id = `${namespace}:${hashText(normalized)}`;
  const cached = await readEmbedding(id);
  if (cached) return cached;

  const vector = await embedText(normalized);
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
  return {
    model: EMBEDDING_MODEL,
    storage: 'IndexedDB',
    runtime: navigator.gpu ? 'WebGPU when available, WASM fallback' : 'WASM fallback'
  };
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
  const filtered = (candidates || [])
    .filter((item) => normalizeText(candidateText(item)))
    .slice(0, MAX_CANDIDATES);

  if (!normalizeText(queryText) || !filtered.length) return null;

  const queryVector = await getStoredEmbedding(`${namespace}:query`, queryText, { role: 'query' });
  if (!queryVector) return null;

  let best = null;

  for (const candidate of filtered) {
    const text = candidateText(candidate);
    const vector = await getStoredEmbedding(`${namespace}:candidate`, text, {
      role: 'candidate',
      candidate_id: candidateId(candidate)
    });
    const score = cosineSimilarity(queryVector, vector);
    if (!best || score > best.score) {
      best = {
        candidate,
        score
      };
    }
  }

  if (!best || best.score < threshold) return null;
  return best;
}
