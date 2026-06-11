const EMBEDDING_MODEL = 'Xenova/bge-small-en-v1.5';
const EMBEDDING_DIMENSIONS = 384;
const DISTANCE = 'cosine';
const MAX_LOCAL_CHUNKS = 3000;
const TARGET_CHUNK_TOKENS = 450;
const CHUNK_OVERLAP_TOKENS = 60;
const QUOTE_WORD_LIMIT = 25;

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function slug(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

function normalizeText(value) {
  return String(value || '')
    .replace(/(\w)-\s*\n\s*(\w)/g, '$1$2')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function tokens(value) {
  return cleanText(value).split(/\s+/).filter(Boolean);
}

function stableHash(value) {
  let hash = 2166136261;
  const text = String(value || '');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

async function sha256(value) {
  const text = cleanText(value);
  if (globalThis.crypto?.subtle) {
    const data = new TextEncoder().encode(text);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  return `${stableHash(text).repeat(8)}`.slice(0, 64);
}

function firstWords(value, limit = QUOTE_WORD_LIMIT) {
  return tokens(value).slice(0, limit).join(' ');
}

function pageRangeLabel(pages = []) {
  const uniquePages = [...new Set(pages.filter(Boolean).map(Number))].sort((left, right) => left - right);
  if (!uniquePages.length) return '';
  if (uniquePages.length === 1) return `p. ${uniquePages[0]}`;
  return `pp. ${uniquePages[0]}-${uniquePages[uniquePages.length - 1]}`;
}

function stripExtension(fileName = '') {
  return cleanText(fileName).replace(/\.[^.]+$/, '');
}

function looksLikeHeading(line) {
  const text = cleanText(line);
  if (text.length < 3 || text.length > 90) return false;
  if (/[.;:]$/.test(text)) return false;
  if (/^(table|figure|chapter|section)\s+\d+/i.test(text)) return true;
  const words = text.split(/\s+/);
  if (words.length > 9) return false;
  const letters = text.replace(/[^A-Za-z]/g, '');
  if (letters.length < 3) return false;
  const upperRatio = letters.replace(/[^A-Z]/g, '').length / letters.length;
  const titleCaseRatio = words.filter((word) => /^[A-Z][a-zA-Z0-9/-]*$/.test(word)).length / words.length;
  return upperRatio > 0.75 || titleCaseRatio > 0.65;
}

function normalizeLine(line) {
  return cleanText(line)
    .replace(/\s+/g, ' ')
    .replace(/^[•·\-–—]\s*/, '')
    .trim();
}

function commonBoundaryLines(pages = []) {
  const counts = new Map();
  for (const page of pages) {
    const lines = (page.lines || []).map(normalizeLine).filter(Boolean);
    for (const line of [...lines.slice(0, 2), ...lines.slice(-2)]) {
      if (line.length > 4 && line.length < 90) counts.set(line, (counts.get(line) || 0) + 1);
    }
  }
  const threshold = Math.max(3, Math.ceil(pages.length * 0.35));
  return new Set([...counts.entries()].filter(([, count]) => count >= threshold).map(([line]) => line));
}

export function normalizeExtractedPages(rawPages = []) {
  const pages = rawPages
    .map((page, index) => {
      const lines = Array.isArray(page.lines)
        ? page.lines.map(normalizeLine).filter(Boolean)
        : normalizeText(page.text || '').split(/\n+/).map(normalizeLine).filter(Boolean);
      return {
        page: Number(page.page || index + 1),
        lines,
        text: normalizeText(lines.join('\n'))
      };
    })
    .filter((page) => page.text);

  const repeated = commonBoundaryLines(pages);
  return pages.map((page) => {
    const lines = page.lines.filter((line) => !repeated.has(normalizeLine(line)));
    return {
      ...page,
      lines,
      text: normalizeText(lines.join('\n'))
    };
  }).filter((page) => page.text);
}

function splitOversizedBlock(block) {
  const blockTokens = tokens(block.text);
  if (blockTokens.length <= TARGET_CHUNK_TOKENS) return [block];
  const chunks = [];
  let start = 0;
  while (start < blockTokens.length) {
    const end = Math.min(start + TARGET_CHUNK_TOKENS, blockTokens.length);
    const text = blockTokens.slice(start, end).join(' ');
    if (tokens(text).length >= 40) {
      chunks.push({
        ...block,
        text,
        section_heading: block.section_heading || 'Textbook excerpt'
      });
    }
    if (end >= blockTokens.length) break;
    start = Math.max(end - CHUNK_OVERLAP_TOKENS, start + 1);
  }
  return chunks;
}

export function chunkExtractedPages(pages = [], options = {}) {
  const maxChunks = Number(options.maxChunks || MAX_LOCAL_CHUNKS);
  const normalizedPages = normalizeExtractedPages(pages);
  const blocks = [];
  let current = { section_heading: '', pages: [], lines: [] };

  const flush = () => {
    const text = normalizeText(current.lines.join('\n'));
    if (tokens(text).length >= 40) {
      blocks.push({
        section_heading: current.section_heading || 'Textbook excerpt',
        pages: [...new Set(current.pages)],
        text
      });
    }
    current = { section_heading: '', pages: [], lines: [] };
  };

  for (const page of normalizedPages) {
    for (const line of page.lines) {
      const heading = looksLikeHeading(line);
      if (heading && current.lines.length) flush();
      if (heading) current.section_heading = line;
      else current.lines.push(line);
      current.pages.push(page.page);
      if (tokens(current.lines.join(' ')).length > TARGET_CHUNK_TOKENS + 90) flush();
    }
  }
  flush();

  const chunks = blocks.flatMap(splitOversizedBlock).slice(0, maxChunks);
  return {
    chunks,
    page_count: normalizedPages.length,
    skipped_chunk_count: Math.max(0, blocks.flatMap(splitOversizedBlock).length - chunks.length),
    warnings: blocks.length > chunks.length ? [`Imported first ${chunks.length} chunks; skipped remaining chunks to keep browser storage bounded.`] : []
  };
}

function inferTaskTags(text) {
  const haystack = text.toLowerCase();
  const tags = new Set(['tutor', 'debrief']);
  if (/\b(workup|diagnos|evaluation|test|imaging|laborator|ecg|ct|ultrasound)\b/.test(haystack)) tags.add('diagnosis');
  if (/\b(treat|management|therapy|medication|dose|fluid|antibiotic|procedure|insulin|naloxone)\b/.test(haystack)) tags.add('management');
  if (/\b(admit|discharge|follow[- ]?up|reassess|monitor|consult|icu)\b/.test(haystack)) tags.add('reassessment');
  return [...tags];
}

function inferTopicTags(text) {
  const haystack = text.toLowerCase();
  const tags = new Set(['local_textbook', 'uploaded_source']);
  const patterns = [
    ['dka_or_hhs', /\b(dka|diabetic ketoacidosis|hhs|hyperosmolar)\b/],
    ['syncope', /\bsyncope\b/],
    ['pneumonia', /\bpneumonia\b/],
    ['sepsis', /\bsepsis|septic shock\b/],
    ['chest_pain_possible_acs', /\b(acs|acute coronary|myocardial infarction|chest pain)\b/],
    ['stroke', /\bstroke|thrombolysis|alteplase\b/],
    ['pulmonary_embolism', /\bpulmonary embol|pe\b/],
    ['ectopic_pregnancy_rupture_concern', /\bectopic pregnancy\b/],
    ['opioid_overdose', /\bopioid|naloxone|overdose\b/],
    ['asthma_exacerbation', /\basthma\b/]
  ];
  for (const [tag, pattern] of patterns) {
    if (pattern.test(haystack)) tags.add(tag);
  }
  return [...tags];
}

function buildLinesFromTextItems(items = []) {
  const positioned = items
    .map((item) => ({
      text: cleanText(item.str),
      x: Number(item.transform?.[4] || 0),
      y: Number(item.transform?.[5] || 0)
    }))
    .filter((item) => item.text);
  positioned.sort((left, right) => Math.round(right.y) - Math.round(left.y) || left.x - right.x);
  const lines = [];
  let currentY = null;
  let current = [];
  for (const item of positioned) {
    const y = Math.round(item.y / 3) * 3;
    if (currentY !== null && Math.abs(y - currentY) > 3) {
      lines.push(current.map((part) => part.text).join(' '));
      current = [];
    }
    currentY = y;
    current.push(item);
  }
  if (current.length) lines.push(current.map((part) => part.text).join(' '));
  return lines.map(normalizeLine).filter(Boolean);
}

async function loadPdfJs() {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();
  return pdfjsLib;
}

export async function extractPdfPages(file, onProgress = () => {}) {
  const pdfjsLib = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const lines = buildLinesFromTextItems(textContent.items || []);
    pages.push({
      page: pageNumber,
      lines,
      text: normalizeText(lines.join('\n'))
    });
    onProgress({
      phase: 'extracting',
      current: pageNumber,
      total: pdf.numPages,
      message: `Extracted page ${pageNumber}/${pdf.numPages}`
    });
  }
  return normalizeExtractedPages(pages);
}

export async function buildLocalTextbookKnowledgeBundleFromPages(rawPages, {
  fileName = 'local-textbook.pdf',
  fileSize = 0,
  fileLastModified = Date.now(),
  title = '',
  maxChunks = MAX_LOCAL_CHUNKS
} = {}) {
  const normalizedPages = normalizeExtractedPages(rawPages);
  const detectedTitle = cleanText(title) || stripExtension(fileName) || 'Local textbook source';
  const fileHash = await sha256(`${fileName}:${fileSize}:${fileLastModified}:${normalizedPages[0]?.text || ''}`);
  const fileId = `local_textbook_${fileHash.slice(0, 16)}`;
  const importedAt = new Date().toISOString();
  const generatedAt = importedAt.slice(0, 10);
  const chunkResult = chunkExtractedPages(normalizedPages, { maxChunks });
  const source = {
    schema_version: 'clinical_source_v1',
    id: fileId,
    title: detectedTitle,
    organization: 'User uploaded source',
    publisher: 'Local user upload',
    edition: '',
    version: 'local PDF import',
    publication_date: generatedAt,
    url: '',
    doi: '',
    pmid: '',
    isbn: '',
    license_scope: 'licensed_local_only',
    source_tier: 'textbook',
    review_status: 'reviewed',
    external_ai_use_allowed: true,
    local_file_id: fileId,
    file_name: fileName,
    imported_at: importedAt,
    page_count: chunkResult.page_count
  };

  const chunks = [];
  for (const [index, chunk] of chunkResult.chunks.entries()) {
    const pageLabel = pageRangeLabel(chunk.pages);
    const quoteText = firstWords(chunk.text);
    const quoteHash = await sha256(quoteText);
    const sectionHeading = cleanText(chunk.section_heading || detectedTitle);
    const chunkId = `${fileId}_chunk_${String(index + 1).padStart(4, '0')}`;
    chunks.push({
      schema_version: 'reference_chunk_v1',
      id: chunkId,
      source_id: source.id,
      section: sectionHeading,
      page: pageLabel,
      source_url: '',
      source_title: source.title,
      organization: source.organization,
      publication_date: source.publication_date,
      doi: '',
      pmid: '',
      isbn: '',
      local_file_id: fileId,
      source_file_name: fileName,
      locator: {
        url: '',
        section_heading: sectionHeading,
        page: pageLabel,
        search_phrases: [quoteText, sectionHeading, detectedTitle].filter(Boolean).slice(0, 3),
        locator_quality: 'local_pdf_page_quote',
        verification_status: 'local_extracted'
      },
      citation_label: `LOCAL-${String(index + 1).padStart(4, '0')}`,
      facet_id: 'textbook_excerpt',
      topic_tags: inferTopicTags(`${sectionHeading} ${chunk.text}`),
      task_tags: inferTaskTags(chunk.text),
      source_tier: 'textbook',
      review_status: 'reviewed',
      evidence_status: 'quote_backed',
      verification_status: 'local_extracted',
      supporting_quotes: [{
        text: quoteText,
        source_url: '',
        source_title: source.title,
        organization: source.organization,
        local_file_id: fileId,
        section_heading: sectionHeading,
        page: pageLabel,
        search_phrase: quoteText,
        quote_hash: quoteHash,
        word_count: tokens(quoteText).length,
        extraction_date: generatedAt,
        verification_status: 'local_extracted'
      }],
      active: true,
      superseded_by: '',
      clinical_rule: sectionHeading,
      text: cleanText(chunk.text),
      normalized_text: cleanText(chunk.text).toLowerCase()
    });
  }

  if (!chunks.length) {
    throw new Error('No usable textbook chunks were extracted from this PDF.');
  }

  return {
    schema_version: 'clinical_knowledge_bundle_v2',
    bundle_id: `${fileId}_bundle`,
    title: detectedTitle,
    description: 'Private local textbook PDF import. Stored only in this browser and never shipped with the public app.',
    generated_at: generatedAt,
    embedding_model: EMBEDDING_MODEL,
    embedding_dimensions: EMBEDDING_DIMENSIONS,
    distance: DISTANCE,
    vector_storage: {
      mode: 'indexeddb_runtime_embeddings',
      source: 'local_pdf_import',
      max_chunks: maxChunks
    },
    retrieval_policy: {
      mode: 'hybrid_dense_bm25_source_rerank',
      quality_goal: 'local_textbook_supplement',
      high_risk_fail_closed: true,
      source_priority: ['ed_specific_guideline', 'society_guideline', 'textbook']
    },
    local_import: {
      type: 'pdf',
      local_file_id: fileId,
      file_name: fileName,
      file_size: fileSize,
      imported_at: importedAt,
      page_count: chunkResult.page_count,
      chunk_count: chunks.length,
      skipped_chunk_count: chunkResult.skipped_chunk_count,
      warnings: chunkResult.warnings
    },
    sources: [source],
    chunks
  };
}

export async function buildLocalTextbookKnowledgeBundle(file, options = {}, onProgress = () => {}) {
  if (!file?.name?.toLowerCase().endsWith('.pdf')) {
    throw new Error('Select a PDF textbook or a clinical knowledge JSON bundle.');
  }
  onProgress({ phase: 'starting', current: 0, total: 1, message: 'Preparing PDF import' });
  const pages = await extractPdfPages(file, onProgress);
  onProgress({ phase: 'chunking', current: pages.length, total: pages.length, message: 'Chunking extracted textbook text' });
  const bundle = await buildLocalTextbookKnowledgeBundleFromPages(pages, {
    fileName: file.name,
    fileSize: file.size,
    fileLastModified: file.lastModified,
    title: options.title || stripExtension(file.name),
    maxChunks: options.maxChunks || MAX_LOCAL_CHUNKS
  });
  onProgress({
    phase: 'complete',
    current: bundle.chunks.length,
    total: bundle.chunks.length,
    message: `Imported ${bundle.chunks.length} textbook chunks`
  });
  return bundle;
}
