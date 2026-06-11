import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLE_PATH = join(ROOT, 'frontend', 'src', 'data', 'public_clinical_knowledge_bundle.json');
const QUALITY_REPORT_PATH = join(ROOT, 'frontend', 'src', 'data', 'public_clinical_source_quality_report.json');
const JSON_OUTPUT_PATH = join(ROOT, 'docs', 'high_risk_quote_coverage_depth_report.json');
const MD_OUTPUT_PATH = join(ROOT, 'docs', 'high_risk_quote_coverage_depth_report.md');

const COVERAGE_POLICY = {
  required_core_facets: [
    'recognition',
    'focused_assessment',
    'diagnostic_strategy',
    'initial_management',
    'disposition_reassessment'
  ],
  supporting_facets: [
    'red_flags',
    'medication_procedure',
    'teaching_handoff'
  ],
  minimum_quote_backed_chunks_per_topic: 4,
  minimum_covered_core_facets_per_topic: 4,
  minimum_unique_sources_per_topic: 1,
  generated_needs_review_approved_by_this_report: 0
};

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function markdownEscape(value) {
  return String(value ?? '').replaceAll('|', '\\|').replace(/\s+/g, ' ').trim();
}

function countBy(items, selector) {
  return items.reduce((acc, item) => {
    const key = selector(item) || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function hasTopic(chunk, topic) {
  return (chunk.topic_tags || []).includes(topic);
}

function isQuoteBacked(chunk) {
  return chunk.evidence_status === 'quote_backed' || chunk.quote_backed === true;
}

function isGeneratedNeedsReview(chunk) {
  return chunk.evidence_status === 'generated_needs_review';
}

function buildTopicRow(topic, chunks, sourceById) {
  const topicChunks = chunks.filter((chunk) => hasTopic(chunk, topic));
  const quoteBackedChunks = topicChunks.filter(isQuoteBacked);
  const generatedNeedsReviewChunks = topicChunks.filter(isGeneratedNeedsReview);
  const coveredCoreFacets = COVERAGE_POLICY.required_core_facets
    .filter((facet) => quoteBackedChunks.some((chunk) => chunk.facet_id === facet));
  const missingCoreFacets = COVERAGE_POLICY.required_core_facets
    .filter((facet) => !coveredCoreFacets.includes(facet));
  const coveredSupportingFacets = COVERAGE_POLICY.supporting_facets
    .filter((facet) => quoteBackedChunks.some((chunk) => chunk.facet_id === facet));
  const uniqueSourceIds = [...new Set(quoteBackedChunks.map((chunk) => chunk.source_id).filter(Boolean))].sort();
  const blockers = [];

  if (quoteBackedChunks.length < COVERAGE_POLICY.minimum_quote_backed_chunks_per_topic) {
    blockers.push('minimum_quote_backed_chunks_not_met');
  }
  if (coveredCoreFacets.length < COVERAGE_POLICY.minimum_covered_core_facets_per_topic) {
    blockers.push('minimum_core_facet_depth_not_met');
  }
  if (missingCoreFacets.length > 0) {
    blockers.push('required_core_facets_missing');
  }
  if (uniqueSourceIds.length < COVERAGE_POLICY.minimum_unique_sources_per_topic) {
    blockers.push('minimum_unique_sources_not_met');
  }
  if (generatedNeedsReviewChunks.length > 0) {
    blockers.push('generated_needs_review_backlog_present');
  }

  return {
    topic,
    status: blockers.length ? 'coverage_depth_gap_manual_review_required' : 'quote_depth_available_claim_review_required',
    release_ready: blockers.length === 0,
    quote_backed_chunks: quoteBackedChunks.length,
    generated_needs_review_chunks: generatedNeedsReviewChunks.length,
    unique_quote_backed_sources: uniqueSourceIds.length,
    unique_quote_backed_source_ids: uniqueSourceIds,
    covered_core_facets: coveredCoreFacets,
    missing_core_facets: missingCoreFacets,
    covered_supporting_facets: coveredSupportingFacets,
    facet_counts: countBy(quoteBackedChunks, (chunk) => chunk.facet_id),
    blockers,
    representative_quote_backed_chunks: quoteBackedChunks
      .slice()
      .sort((a, b) => String(a.facet_id).localeCompare(String(b.facet_id)) || String(a.id).localeCompare(String(b.id)))
      .map((chunk) => {
        const source = sourceById.get(chunk.source_id) || {};
        return {
          chunk_id: chunk.id,
          facet_id: chunk.facet_id || '',
          source_id: chunk.source_id || '',
          source_title: source.title || chunk.source_title || '',
          citation_label: chunk.citation_label || ''
        };
      })
  };
}

function markdown(report) {
  const lines = [
    '# High-Risk Quote Coverage Depth Report',
    '',
    `Generated at: ${report.generated_at}`,
    '',
    report.warning,
    '',
    '## Summary',
    '',
    `- High-risk topics: ${report.summary.high_risk_topic_count}`,
    `- Topics with any quote-backed coverage: ${report.summary.topics_with_any_quote_backed_coverage}`,
    `- Topics meeting minimum quote chunks: ${report.summary.topics_meeting_minimum_quote_chunks}`,
    `- Topics meeting core facet depth: ${report.summary.topics_meeting_core_facet_depth}`,
    `- Topics missing required core facets: ${report.summary.topics_missing_required_core_facets}`,
    `- Missing topic-facet pairs: ${report.summary.missing_required_topic_facet_pairs}`,
    `- Generated-needs-review chunks on high-risk topics: ${report.summary.generated_needs_review_chunks_on_high_risk_topics}`,
    `- Quote coverage depth release ready: ${report.summary.quote_coverage_depth_release_ready}`,
    '',
    '## Policy',
    '',
    `- Required core facets: ${report.coverage_policy.required_core_facets.join(', ')}`,
    `- Minimum quote-backed chunks per topic: ${report.coverage_policy.minimum_quote_backed_chunks_per_topic}`,
    `- Minimum covered core facets per topic: ${report.coverage_policy.minimum_covered_core_facets_per_topic}`,
    `- Minimum unique sources per topic: ${report.coverage_policy.minimum_unique_sources_per_topic}`,
    '',
    '## Topic Depth',
    '',
    '| Topic | Status | Quotes | Sources | Covered Core Facets | Missing Core Facets | Blockers |',
    '|---|---|---:|---:|---|---|---|',
    ...report.topic_rows.map((row) =>
      `| ${row.topic} | ${row.status} | ${row.quote_backed_chunks} | ${row.unique_quote_backed_sources} | ${markdownEscape(row.covered_core_facets.join(', '))} | ${markdownEscape(row.missing_core_facets.join(', '))} | ${markdownEscape(row.blockers.join(', '))} |`
    ),
    '',
    '## Next Actions',
    '',
    ...report.next_actions.map((action) => `- ${action}`)
  ];
  return `${lines.join('\n')}\n`;
}

const bundle = readJson(BUNDLE_PATH);
const qualityReport = readJson(QUALITY_REPORT_PATH);
const chunks = bundle.chunks || [];
const sourceById = new Map((bundle.sources || []).map((source) => [source.id, source]));
const highRiskTopics = qualityReport.high_risk_quote_core_topics || [];
const topicRows = highRiskTopics.map((topic) => buildTopicRow(topic, chunks, sourceById));
const generatedNeedsReviewOnHighRisk = chunks.filter((chunk) =>
  isGeneratedNeedsReview(chunk) && highRiskTopics.some((topic) => hasTopic(chunk, topic))
);
const missingTopicFacetPairs = topicRows.reduce((sum, row) => sum + row.missing_core_facets.length, 0);

const summary = {
  high_risk_topic_count: highRiskTopics.length,
  topics_with_any_quote_backed_coverage: topicRows.filter((row) => row.quote_backed_chunks > 0).length,
  topics_meeting_minimum_quote_chunks: topicRows.filter((row) =>
    row.quote_backed_chunks >= COVERAGE_POLICY.minimum_quote_backed_chunks_per_topic
  ).length,
  topics_meeting_core_facet_depth: topicRows.filter((row) =>
    row.covered_core_facets.length >= COVERAGE_POLICY.minimum_covered_core_facets_per_topic
  ).length,
  topics_missing_required_core_facets: topicRows.filter((row) => row.missing_core_facets.length > 0).length,
  missing_required_topic_facet_pairs: missingTopicFacetPairs,
  generated_needs_review_chunks_on_high_risk_topics: generatedNeedsReviewOnHighRisk.length,
  topics_release_ready_for_claim_review: topicRows.filter((row) => row.release_ready).length,
  quote_coverage_depth_release_ready: topicRows.length > 0 && topicRows.every((row) => row.release_ready)
};

const report = {
  schema_version: 'high_risk_quote_coverage_depth_report_v1',
  generated_at: new Date().toISOString(),
  review_status: summary.quote_coverage_depth_release_ready
    ? 'high_risk_quote_depth_ready_for_claim_review'
    : 'high_risk_quote_depth_gaps_found_manual_review_required',
  warning: 'This report measures whether high-risk topics have enough quote-backed depth across core teaching facets. It does not prove claim-level entailment, guideline currency, or clinician approval.',
  source_contract: {
    public_knowledge_bundle_schema: bundle.schema_version,
    public_source_quality_report_schema: qualityReport.schema_version,
    high_risk_topic_source: 'public_clinical_source_quality_report.high_risk_quote_core_topics',
    quote_backed_only: true,
    generated_needs_review_approved_by_this_report: 0
  },
  coverage_policy: COVERAGE_POLICY,
  summary,
  topic_rows: topicRows,
  facet_summary: {
    quote_backed_by_facet: countBy(chunks.filter(isQuoteBacked), (chunk) => chunk.facet_id),
    high_risk_quote_backed_by_facet: countBy(
      chunks.filter((chunk) => isQuoteBacked(chunk) && highRiskTopics.some((topic) => hasTopic(chunk, topic))),
      (chunk) => chunk.facet_id
    )
  },
  next_actions: [
    'Add or review quote-backed source excerpts for missing high-risk topic/facet pairs before relying on nuanced learner feedback.',
    'Prioritize core facets used in clinical judgment: recognition, focused assessment, diagnostic strategy, initial management, and reassessment/disposition.',
    'Keep generated-needs-review high-risk material quarantined until clinician/librarian review converts it into quote-backed or approved source-backed evidence.',
    'Use this report with claim-entailment packets so each feedback claim has both topic coverage and exact supporting evidence.'
  ]
};

writeFileSync(JSON_OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
writeFileSync(MD_OUTPUT_PATH, markdown(report), 'utf8');
console.log(JSON.stringify({
  review_status: report.review_status,
  high_risk_topics: summary.high_risk_topic_count,
  topics_meeting_core_facet_depth: summary.topics_meeting_core_facet_depth,
  missing_required_topic_facet_pairs: summary.missing_required_topic_facet_pairs,
  quote_coverage_depth_release_ready: summary.quote_coverage_depth_release_ready,
  report_path: JSON_OUTPUT_PATH
}, null, 2));
