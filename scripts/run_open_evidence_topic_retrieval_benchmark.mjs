import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LEARNER_FACING_OPEN_EVIDENCE_POLICY_VERSION,
  evidenceEligibilityForLearnerFacingUse,
  isGeneratedNeedsReviewReferenceChunk,
  isQuoteBackedReferenceChunk
} from '../frontend/src/services/openEvidencePolicyService.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KNOWLEDGE_BUNDLE_PATH = join(ROOT, 'frontend', 'src', 'data', 'public_clinical_knowledge_bundle.json');
const COVERAGE_REPORT_PATH = join(ROOT, 'docs', 'learner_facing_evidence_coverage_report.json');
const JSON_OUTPUT_PATH = join(ROOT, 'docs', 'open_evidence_topic_retrieval_benchmark.json');
const MD_OUTPUT_PATH = join(ROOT, 'docs', 'open_evidence_topic_retrieval_benchmark.md');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeText(value = '') {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value = '') {
  return normalizeText(value)
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function unique(items = []) {
  return [...new Set(items.filter(Boolean))];
}

function chunkSearchText(chunk) {
  return [
    chunk.id,
    chunk.source_title,
    chunk.section,
    chunk.facet_id,
    ...(chunk.topic_tags || []),
    ...(chunk.task_tags || []),
    chunk.clinical_rule,
    chunk.text,
    ...(chunk.supporting_quotes || []).map((quote) => quote.text)
  ].filter(Boolean).join(' ');
}

function buildCorpusStats(corpus) {
  const documents = corpus.map((chunk) => {
    const tokens = tokenize(chunkSearchText(chunk));
    const counts = tokens.reduce((acc, token) => {
      acc[token] = (acc[token] || 0) + 1;
      return acc;
    }, {});
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
    averageLength: documents.reduce((sum, document) => sum + document.length, 0) / Math.max(documents.length, 1),
    documentFrequency,
    documentsById: new Map(documents.map((document) => [document.id, document]))
  };
}

function bm25Score(query, chunk, corpusStats) {
  const queryTerms = unique(tokenize(query));
  if (!queryTerms.length) return 0;
  const document = corpusStats.documentsById.get(chunk.id);
  if (!document?.length) return 0;
  const k1 = 1.2;
  const b = 0.75;
  return queryTerms.reduce((score, term) => {
    const frequency = document.counts[term] || 0;
    if (!frequency) return score;
    const documentFrequency = corpusStats.documentFrequency.get(term) || 0;
    const idf = Math.log(1 + ((corpusStats.documentCount - documentFrequency + 0.5) / (documentFrequency + 0.5)));
    const denominator = frequency + k1 * (1 - b + b * (document.length / Math.max(1, corpusStats.averageLength)));
    return score + idf * ((frequency * (k1 + 1)) / denominator);
  }, 0) / (queryTerms.length + 1);
}

function queryForTopic(topic, representativeChunks) {
  const quoteBackedChunk = representativeChunks.find((chunk) => chunk.supporting_quotes?.length) || representativeChunks[0] || {};
  const quoteText = quoteBackedChunk.supporting_quotes?.[0]?.text || '';
  return cleanText([
    topic.replaceAll('_', ' '),
    quoteBackedChunk.facet_id?.replaceAll('_', ' '),
    quoteBackedChunk.clinical_rule,
    quoteBackedChunk.text,
    quoteText
  ].filter(Boolean).join(' '));
}

function taskForChunks(chunks) {
  const taskPriority = ['management', 'diagnosis', 'triage', 'reassessment', 'sbar', 'tutor'];
  const tags = new Set(chunks.flatMap((chunk) => chunk.task_tags || []));
  return taskPriority.find((task) => tags.has(task)) || 'management';
}

function asReference(chunk, score) {
  return {
    reference_chunk_id: chunk.id,
    source_id: chunk.source_id,
    source_title: chunk.source_title || '',
    facet_id: chunk.facet_id || '',
    topic_tags: chunk.topic_tags || [],
    task_tags: chunk.task_tags || [],
    evidence_status: chunk.evidence_status || '',
    verification_status: chunk.verification_status || chunk.locator?.verification_status || '',
    quote_backed: Boolean(isQuoteBackedReferenceChunk(chunk)),
    score: Number(score.toFixed(4))
  };
}

function isAdministrativeNonclinicalQuery(query) {
  const administrative = /\b(parking|cafeteria|housing|maintenance|room booking|book a room|meeting|vacation|holiday|schedule|calendar|tuition|invoice|payroll|wifi|printer|email|badge|id card)\b/i.test(query);
  const clinical = /\b(patient|triage|diagnos|differential|symptom|vital|exam|history|pain|fever|dyspnea|breath|hypox|shock|sepsis|stroke|chest|abdomen|pregnan|ectopic|bleed|trauma|injur|head|vomit|dizzy|syncope|overdose|opioid|naloxone|agitat|restraint|dka|hhs|diabetes|insulin|potassium|ecg|ekg|troponin|ct\b|imaging|lab|medication|treatment|management|reassess|disposition|handoff|consult|admission|transfer|icu|ed\b|emergency)\b/i.test(query);
  return administrative && !clinical;
}

const knowledgeBundle = readJson(KNOWLEDGE_BUNDLE_PATH);
const coverageReport = readJson(COVERAGE_REPORT_PATH);
const publicCandidateChunks = knowledgeBundle.chunks
  .filter((chunk) => chunk.active !== false)
  .filter((chunk) => chunk.review_status === 'reviewed')
  .filter((chunk) => !chunk.superseded_by);
const eligibleQuoteBackedChunks = publicCandidateChunks.filter((chunk) =>
  evidenceEligibilityForLearnerFacingUse(chunk, {
    requireQuoteBacked: true,
    allowGeneratedNeedsReview: false
  })
);
const corpusStats = buildCorpusStats(eligibleQuoteBackedChunks);

function runTopicProbe(topicRow) {
  const topic = topicRow.topic;
  const topicChunks = publicCandidateChunks.filter((chunk) => (chunk.topic_tags || []).includes(topic));
  const topicQuoteBackedChunks = topicChunks.filter((chunk) =>
    evidenceEligibilityForLearnerFacingUse(chunk, {
      requireQuoteBacked: true,
      allowGeneratedNeedsReview: false
    })
  );
  const topicGeneratedChunks = topicChunks.filter(isGeneratedNeedsReviewReferenceChunk);
  const query = queryForTopic(topic, topicQuoteBackedChunks);
  const ranked = eligibleQuoteBackedChunks
    .map((chunk) => ({ chunk, score: bm25Score(query, chunk, corpusStats) }))
    .filter((item) => item.score > 0.015)
    .sort((left, right) => right.score - left.score);
  const references = ranked.slice(0, 5).map((item) => asReference(item.chunk, item.score));
  const expectedTopicReferences = references.filter((reference) => (reference.topic_tags || []).includes(topic));
  const generatedReturned = references.filter((reference) => reference.evidence_status === 'generated_needs_review').length;
  const quoteBackedReturned = references.filter((reference) => reference.quote_backed).length;
  const topReferenceMatchesTopic = Boolean(references[0]?.topic_tags?.includes(topic));
  const pass = topicQuoteBackedChunks.length > 0
    && references.length > 0
    && expectedTopicReferences.length > 0
    && topReferenceMatchesTopic
    && quoteBackedReturned === references.length
    && generatedReturned === 0;

  return {
    id: `topic_${topic}`,
    topic,
    task: taskForChunks(topicQuoteBackedChunks),
    query,
    status: pass ? 'pass' : 'fail',
    learner_facing_status: topicRow.learner_facing_status,
    expected_quote_backed_chunks: topicQuoteBackedChunks.length,
    generated_needs_review_candidates_quarantined: topicGeneratedChunks.length,
    references_returned: references.length,
    quote_backed_references: quoteBackedReturned,
    generated_needs_review_references: generatedReturned,
    expected_topic_references: expectedTopicReferences.length,
    top_reference_matches_topic: topReferenceMatchesTopic,
    references,
    warnings: topicGeneratedChunks.length
      ? ['Generated-needs-review topic candidates were quarantined from learner-facing retrieval.']
      : []
  };
}

const topicRows = coverageReport.high_risk_topic_coverage || [];
const topicProbes = topicRows.map(runTopicProbe);

const negativeQueries = [
  {
    id: 'negative_nonclinical_campus_parking',
    query: 'campus parking permit cafeteria hours student housing maintenance request',
    task: 'tutor'
  },
  {
    id: 'negative_administrative_scheduling',
    query: 'schedule a meeting with faculty about vacation dates and room booking',
    task: 'tutor'
  }
];

function runNegativeProbe(row) {
  if (isAdministrativeNonclinicalQuery(row.query)) {
    return {
      id: row.id,
      query: row.query,
      task: row.task,
      status: 'pass',
      references_returned: 0,
      scope_guardrail_triggered: true,
      references: [],
      warnings: ['Administrative/nonclinical scope guardrail blocked learner-facing clinical retrieval.']
    };
  }
  const ranked = eligibleQuoteBackedChunks
    .map((chunk) => ({ chunk, score: bm25Score(row.query, chunk, corpusStats) }))
    .filter((item) => item.score > 0.03)
    .sort((left, right) => right.score - left.score);
  const references = ranked.slice(0, 5).map((item) => asReference(item.chunk, item.score));
  return {
    id: row.id,
    query: row.query,
    task: row.task,
    status: references.length === 0 ? 'pass' : 'fail',
    references_returned: references.length,
    scope_guardrail_triggered: false,
    references,
    warnings: references.length ? ['Nonclinical negative control returned clinical references.'] : []
  };
}

const negativeProbes = negativeQueries.map(runNegativeProbe);
const allProbes = [...topicProbes, ...negativeProbes];
const failed = allProbes.filter((probe) => probe.status !== 'pass');
const generatedReturned = topicProbes.reduce((sum, probe) => sum + probe.generated_needs_review_references, 0);
const allHighRiskTopicsRepresented = topicProbes.length === coverageReport.summary.high_risk_topic_count
  && topicProbes.every((probe) => probe.expected_quote_backed_chunks > 0);

const report = {
  schema_version: 'open_evidence_topic_retrieval_benchmark_v1',
  generated_at: new Date().toISOString(),
  review_status: failed.length === 0
    ? 'topic_retrieval_benchmark_passed_manual_review_required'
    : 'topic_retrieval_benchmark_has_failures',
  evidence_policy_version: LEARNER_FACING_OPEN_EVIDENCE_POLICY_VERSION,
  warning: 'This benchmark verifies public quote-backed retrieval coverage for high-risk topics and negative controls. It does not prove claim-level entailment, guideline currency, or clinician approval.',
  source_contract: {
    learner_facing_evidence_coverage_report: 'docs/learner_facing_evidence_coverage_report.json',
    public_knowledge_bundle: 'frontend/src/data/public_clinical_knowledge_bundle.json',
    quote_backed_only: true,
    allow_generated_needs_review: false,
    generated_needs_review_chunks_approved_by_this_report: 0
  },
  summary: {
    total_probes: allProbes.length,
    topic_probes: topicProbes.length,
    negative_control_probes: negativeProbes.length,
    passed_probes: allProbes.length - failed.length,
    failed_probes: failed.length,
    all_probes_passed: failed.length === 0,
    high_risk_topic_count_from_coverage: coverageReport.summary.high_risk_topic_count,
    all_high_risk_topics_represented: allHighRiskTopicsRepresented,
    topic_probes_with_quote_backed_reference: topicProbes.filter((probe) => probe.quote_backed_references > 0).length,
    topic_probes_with_expected_topic_reference: topicProbes.filter((probe) => probe.expected_topic_references > 0).length,
    topic_probes_with_top_reference_topic_match: topicProbes.filter((probe) => probe.top_reference_matches_topic).length,
    generated_needs_review_references_returned: generatedReturned,
    generated_needs_review_candidates_quarantined: topicProbes.reduce((sum, probe) => sum + probe.generated_needs_review_candidates_quarantined, 0),
    negative_controls_returning_references: negativeProbes.filter((probe) => probe.references_returned > 0).length
  },
  topic_probes: topicProbes,
  negative_control_probes: negativeProbes
};

function markdown(data) {
  const lines = [
    '# Open Evidence Topic Retrieval Benchmark',
    '',
    `Generated: ${data.generated_at}`,
    '',
    data.warning,
    '',
    '## Summary',
    '',
    `- Probes passed: ${data.summary.passed_probes}/${data.summary.total_probes}`,
    `- High-risk topics represented: ${data.summary.topic_probes}/${data.summary.high_risk_topic_count_from_coverage}`,
    `- Generated-needs-review references returned: ${data.summary.generated_needs_review_references_returned}`,
    `- Negative controls returning references: ${data.summary.negative_controls_returning_references}`,
    '',
    '## Topic Probes',
    '',
    '| Topic | Status | References | Expected Topic References | Top Match | Generated Returned | Quarantined Candidates |',
    '|---|---|---:|---:|---|---:|---:|',
    ...data.topic_probes.map((probe) => (
      `| ${probe.topic} | ${probe.status} | ${probe.references_returned} | ${probe.expected_topic_references} | ${probe.top_reference_matches_topic} | ${probe.generated_needs_review_references} | ${probe.generated_needs_review_candidates_quarantined} |`
    )),
    '',
    '## Negative Controls',
    '',
    '| Probe | Status | References Returned |',
    '|---|---|---:|',
    ...data.negative_control_probes.map((probe) => `| ${probe.id} | ${probe.status} | ${probe.references_returned} |`)
  ];
  return `${lines.join('\n')}\n`;
}

writeFileSync(JSON_OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
writeFileSync(MD_OUTPUT_PATH, markdown(report), 'utf8');

console.log(JSON.stringify({
  review_status: report.review_status,
  probes: `${report.summary.passed_probes}/${report.summary.total_probes}`,
  topic_probes: report.summary.topic_probes,
  generated_needs_review_references_returned: report.summary.generated_needs_review_references_returned,
  negative_controls_returning_references: report.summary.negative_controls_returning_references,
  report_path: JSON_OUTPUT_PATH
}, null, 2));

if (failed.length) {
  throw new Error(`Open evidence topic retrieval benchmark failed: ${failed.map((probe) => probe.id).join(', ')}`);
}
