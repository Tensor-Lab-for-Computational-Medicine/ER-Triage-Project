import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLE_PATH = join(ROOT, 'frontend', 'src', 'data', 'public_clinical_knowledge_bundle.json');
const QUALITY_REPORT_PATH = join(ROOT, 'frontend', 'src', 'data', 'public_clinical_source_quality_report.json');
const OUTPUT_PATH = join(ROOT, 'docs', 'evidence_review_backlog.json');

const SAFETY_CRITICAL_FACETS = new Set([
  'red_flags',
  'diagnostic_strategy',
  'initial_management',
  'medication_procedure',
  'disposition_reassessment'
]);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function countBy(items, selector) {
  return items.reduce((acc, item) => {
    const key = selector(item) || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function sourceIndex(bundle) {
  return new Map((bundle.sources || []).map((source) => [source.id, source]));
}

function needsReview(chunk) {
  const verification = chunk.locator?.verification_status || '';
  const locatorQuality = chunk.locator?.locator_quality || '';
  return verification !== 'human_verified' || locatorQuality !== 'direct_quote_short_excerpt';
}

function topicIsHighRisk(chunk, highRiskTopics) {
  const tags = chunk.topic_tags || [];
  const normalizedSection = cleanText(chunk.section).toLowerCase().replace(/[^a-z0-9]+/g, '_');
  return tags.some((tag) => highRiskTopics.has(tag))
    || highRiskTopics.has(normalizedSection)
    || /(shock|sepsis|stroke|acs|troponin|overdose|naloxone|infant|ectopic|restraints|agitation|dka|hhs|arrest|airway|thrombolytic)/i.test(`${tags.join(' ')} ${chunk.section || ''}`);
}

function priorityForChunk(chunk, source, highRiskTopics) {
  if (topicIsHighRisk(chunk, highRiskTopics)) return 'P1_high_risk_clinical_safety';
  if (SAFETY_CRITICAL_FACETS.has(chunk.facet_id)) return 'P2_management_or_disposition_safety';
  if (['ed_specific_guideline', 'society_guideline', 'systematic_review'].includes(source?.source_tier)) return 'P3_guideline_source_grounding';
  return 'P4_background_reference_review';
}

function chunkPreview(chunk) {
  return cleanText(chunk.text || chunk.content || '').slice(0, 220);
}

function addToMapArray(map, key, item) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(item);
}

function representativeChunks(chunks) {
  return chunks
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, 6)
    .map((chunk) => ({
      chunk_id: chunk.id,
      facet_id: chunk.facet_id || '',
      section: cleanText(chunk.section),
      topic_tags: chunk.topic_tags || [],
      locator_quality: chunk.locator?.locator_quality || 'missing',
      verification_status: chunk.locator?.verification_status || 'missing',
      search_phrases: (chunk.locator?.search_phrases || []).slice(0, 3),
      summary_preview: chunkPreview(chunk)
    }));
}

const bundle = readJson(BUNDLE_PATH);
const quality = readJson(QUALITY_REPORT_PATH);
const sourcesById = sourceIndex(bundle);
const highRiskTopics = new Set(quality.high_risk_quote_core_topics || []);
const chunksNeedingReview = (bundle.chunks || []).filter(needsReview);
const chunksWithPriority = chunksNeedingReview.map((chunk) => {
  const source = sourcesById.get(chunk.source_id) || {};
  return {
    chunk,
    source,
    priority: priorityForChunk(chunk, source, highRiskTopics)
  };
});

const chunksBySource = new Map();
for (const item of chunksWithPriority) {
  addToMapArray(chunksBySource, item.chunk.source_id || 'unknown_source', item);
}

const sources = [...chunksBySource.entries()]
  .map(([sourceId, items]) => {
    const source = items[0].source || {};
    const chunks = items.map((item) => item.chunk);
    return {
      source_id: sourceId,
      title: source.title || chunks[0]?.source_title || '',
      organization: source.organization || chunks[0]?.organization || '',
      publication_date: source.publication_date || chunks[0]?.publication_date || '',
      url: source.url || chunks[0]?.source_url || '',
      source_tier: source.source_tier || 'unknown',
      source_review_status: source.review_status || 'unknown',
      pending_chunk_count: chunks.length,
      priority_counts: countBy(items, (item) => item.priority),
      facet_counts: countBy(chunks, (chunk) => chunk.facet_id || 'unknown'),
      topic_tags: unique(chunks.flatMap((chunk) => chunk.topic_tags || [])).slice(0, 24),
      representative_chunks: representativeChunks(chunks)
    };
  })
  .sort((a, b) => {
    const p1a = a.priority_counts.P1_high_risk_clinical_safety || 0;
    const p1b = b.priority_counts.P1_high_risk_clinical_safety || 0;
    if (p1a !== p1b) return p1b - p1a;
    return b.pending_chunk_count - a.pending_chunk_count;
  });

const batchGroups = new Map();
for (const item of chunksWithPriority) {
  const chunk = item.chunk;
  const key = [
    item.priority,
    chunk.source_id || 'unknown_source',
    chunk.facet_id || 'unknown_facet'
  ].join('|');
  addToMapArray(batchGroups, key, item);
}

const reviewBatches = [...batchGroups.entries()]
  .map(([key, items]) => {
    const [priority, sourceId, facetId] = key.split('|');
    const source = items[0].source || {};
    const chunks = items.map((item) => item.chunk);
    return {
      batch_id: `${priority}_${sourceId}_${facetId}`.replace(/[^a-zA-Z0-9_:-]+/g, '_'),
      priority,
      source_id: sourceId,
      source_title: source.title || chunks[0]?.source_title || '',
      source_tier: source.source_tier || 'unknown',
      facet_id: facetId,
      pending_chunk_count: chunks.length,
      topic_tags: unique(chunks.flatMap((chunk) => chunk.topic_tags || [])).slice(0, 20),
      review_tasks: [
        'Open the cited public source and verify the chunk statement against a retrievable section, page, DOI, PMID, or URL.',
        'Replace generated public-safe summaries with a quote-backed short excerpt or a clinician-approved paraphrase.',
        'Record applicability limits, contraindications, pediatric/geriatric/pregnancy caveats, and local-practice variation.',
        'Mark whether the chunk may be used for deterministic feedback, high-risk prompting, background teaching only, or must be removed.'
      ],
      representative_chunks: representativeChunks(chunks)
    };
  })
  .sort((a, b) => {
    const priorityRank = {
      P1_high_risk_clinical_safety: 1,
      P2_management_or_disposition_safety: 2,
      P3_guideline_source_grounding: 3,
      P4_background_reference_review: 4
    };
    const priorityDelta = (priorityRank[a.priority] || 9) - (priorityRank[b.priority] || 9);
    if (priorityDelta !== 0) return priorityDelta;
    return b.pending_chunk_count - a.pending_chunk_count;
  });

const artifact = {
  schema_version: 'evidence_review_backlog_v1',
  generated_at: new Date().toISOString(),
  review_status: 'draft_source_review_backlog',
  warning: 'Generated-needs-review chunks are not medical source-of-truth material. They must stay excluded from high-risk deterministic feedback until replaced or approved.',
  quality_report_alignment: {
    bundle_id: bundle.bundle_id,
    total_sources: quality.total_sources,
    total_chunks: quality.total_chunks,
    quote_backed_count: quality.quote_backed_count,
    generated_needs_review_count_from_quality_report: quality.generated_needs_review_count,
    needs_review_count_from_quality_report: quality.needs_review_count,
    missing_locator_chunk_count: Array.isArray(quality.missing_locator_chunk_ids) ? quality.missing_locator_chunk_ids.length : 0,
    derived_needs_review_chunk_count: chunksNeedingReview.length,
    count_alignment: chunksNeedingReview.length === quality.generated_needs_review_count
  },
  review_policy: {
    high_risk_generated_chunks_allowed_for_feedback: false,
    minimum_acceptance_for_high_risk_feedback: 'human_verified_quote_backed_or_clinician_approved_with_locator',
    required_reviewer_roles: [
      'emergency_medicine_clinician',
      'medical_educator',
      'source_or_library_reviewer_for_locator_quality'
    ]
  },
  summary: {
    pending_source_count: sources.length,
    pending_review_batch_count: reviewBatches.length,
    pending_generated_or_unverified_chunks: chunksNeedingReview.length,
    reviewed_generated_chunks: 0,
    priority_counts: countBy(chunksWithPriority, (item) => item.priority),
    facet_counts: countBy(chunksNeedingReview, (chunk) => chunk.facet_id || 'unknown'),
    source_tier_counts: countBy(chunksWithPriority, (item) => item.source?.source_tier || 'unknown')
  },
  sources,
  review_batches: reviewBatches
};

writeFileSync(OUTPUT_PATH, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
console.log(`Wrote evidence review backlog for ${chunksNeedingReview.length} chunks to ${OUTPUT_PATH}`);
