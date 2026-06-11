import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KNOWLEDGE_BUNDLE_PATH = join(ROOT, 'frontend', 'src', 'data', 'public_clinical_knowledge_bundle.json');
const QUALITY_REPORT_PATH = join(ROOT, 'frontend', 'src', 'data', 'public_clinical_source_quality_report.json');
const EVIDENCE_BACKLOG_PATH = join(ROOT, 'docs', 'evidence_review_backlog.json');
const CLINICAL_ADJUDICATION_STATUS_PATH = join(ROOT, 'docs', 'clinical_review_adjudication_status.json');
const SOURCE_LINK_QUOTE_VERIFICATION_REPORT_PATH = join(ROOT, 'docs', 'source_link_quote_verification_report.json');
const SOURCE_FRESHNESS_REPORT_PATH = join(ROOT, 'docs', 'source_freshness_report.json');
const HIGH_RISK_QUOTE_COVERAGE_DEPTH_REPORT_PATH = join(ROOT, 'docs', 'high_risk_quote_coverage_depth_report.json');
const OPEN_EVIDENCE_RETRIEVAL_RUNTIME_REPORT_PATH = join(ROOT, 'docs', 'open_evidence_retrieval_runtime_report.json');
const LEARNER_FACING_EVIDENCE_COVERAGE_REPORT_PATH = join(ROOT, 'docs', 'learner_facing_evidence_coverage_report.json');
const FEEDBACK_CLAIM_REFERENCE_ALIGNMENT_REPORT_PATH = join(ROOT, 'docs', 'feedback_claim_reference_alignment_report.json');
const CLAIM_REFERENCE_GAP_REVIEW_PACKETS_PATH = join(ROOT, 'docs', 'claim_reference_gap_review_packets.json');
const FEEDBACK_CLAIM_ENTAILMENT_ADJUDICATION_STATUS_PATH = join(ROOT, 'docs', 'feedback_claim_entailment_adjudication_status.json');
const JSON_OUTPUT_PATH = join(ROOT, 'docs', 'evidence_quality_dashboard.json');
const MD_OUTPUT_PATH = join(ROOT, 'docs', 'evidence_quality_dashboard.md');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readOptionalJson(path) {
  return existsSync(path) ? readJson(path) : null;
}

function percent(numerator, denominator) {
  if (!denominator) return 0;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

function countBy(items, selector) {
  return items.reduce((acc, item) => {
    const key = selector(item) || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function markdownEscape(value) {
  return String(value ?? '').replaceAll('|', '\\|').replace(/\s+/g, ' ').trim();
}

function statusLabel(value) {
  return value ? 'cleared' : 'blocked';
}

const knowledgeBundle = readJson(KNOWLEDGE_BUNDLE_PATH);
const qualityReport = readJson(QUALITY_REPORT_PATH);
const evidenceBacklog = readOptionalJson(EVIDENCE_BACKLOG_PATH);
const clinicalReviewAdjudicationStatus = readOptionalJson(CLINICAL_ADJUDICATION_STATUS_PATH);
const sourceLinkQuoteVerificationReport = readOptionalJson(SOURCE_LINK_QUOTE_VERIFICATION_REPORT_PATH);
const sourceFreshnessReport = readOptionalJson(SOURCE_FRESHNESS_REPORT_PATH);
const highRiskQuoteCoverageDepthReport = readOptionalJson(HIGH_RISK_QUOTE_COVERAGE_DEPTH_REPORT_PATH);
const openEvidenceRetrievalRuntimeReport = readOptionalJson(OPEN_EVIDENCE_RETRIEVAL_RUNTIME_REPORT_PATH);
const learnerFacingEvidenceCoverageReport = readOptionalJson(LEARNER_FACING_EVIDENCE_COVERAGE_REPORT_PATH);
const feedbackClaimReferenceAlignmentReport = readOptionalJson(FEEDBACK_CLAIM_REFERENCE_ALIGNMENT_REPORT_PATH);
const claimReferenceGapReviewPackets = readOptionalJson(CLAIM_REFERENCE_GAP_REVIEW_PACKETS_PATH);
const feedbackClaimEntailmentAdjudicationStatus = readOptionalJson(FEEDBACK_CLAIM_ENTAILMENT_ADJUDICATION_STATUS_PATH);

const chunks = knowledgeBundle.chunks || [];
const activeChunks = chunks.filter((chunk) => chunk.active !== false && !chunk.superseded_by);
const quoteBackedChunks = activeChunks.filter((chunk) => chunk.evidence_status === 'quote_backed');
const generatedNeedsReviewChunks = activeChunks.filter((chunk) => chunk.evidence_status === 'generated_needs_review');
const highRiskTopicRows = highRiskQuoteCoverageDepthReport?.topic_rows || [];
const missingTopicFacetRows = highRiskTopicRows
  .filter((row) => (row.missing_core_facets || []).length > 0)
  .sort((a, b) => (b.missing_core_facets || []).length - (a.missing_core_facets || []).length
    || a.quote_backed_chunks - b.quote_backed_chunks
    || a.topic.localeCompare(b.topic))
  .map((row) => ({
    topic: row.topic,
    quote_backed_chunks: row.quote_backed_chunks,
    generated_needs_review_chunks: row.generated_needs_review_chunks,
    covered_core_facets: row.covered_core_facets || [],
    missing_core_facets: row.missing_core_facets || [],
    release_ready: Boolean(row.release_ready)
  }));

const dashboardReleaseReady = Boolean(
  learnerFacingEvidenceCoverageReport?.summary?.learner_facing_evidence_release_ready
    && sourceLinkQuoteVerificationReport?.summary?.quote_verification_release_ready
    && qualityReport.generated_needs_review_count === 0
    && qualityReport.needs_review_count === 0
    && sourceFreshnessReport?.summary?.learner_facing_source_freshness_release_ready
    && highRiskQuoteCoverageDepthReport?.summary?.quote_coverage_depth_release_ready
    && feedbackClaimReferenceAlignmentReport?.summary?.claim_reference_alignment_release_ready
    && feedbackClaimReferenceAlignmentReport?.summary?.domain_specific_quote_support_release_ready
    && claimReferenceGapReviewPackets?.summary?.total_gap_packets === 0
    && feedbackClaimEntailmentAdjudicationStatus?.summary?.ready_for_national_feedback_release
);

const alignmentChecks = {
  bundle_source_count_matches_quality_report:
    (knowledgeBundle.sources || []).length === qualityReport.total_sources,
  bundle_chunk_count_matches_quality_report:
    chunks.length === qualityReport.total_chunks,
  active_quote_backed_count_matches_quality_report:
    quoteBackedChunks.length === qualityReport.quote_backed_count,
  active_generated_count_matches_quality_report:
    generatedNeedsReviewChunks.length === qualityReport.generated_needs_review_count,
  learner_facing_quote_count_matches_quality_report:
    learnerFacingEvidenceCoverageReport?.summary?.learner_facing_eligible_quote_backed_chunks
      === qualityReport.quote_backed_count,
  high_risk_topic_count_matches_quality_report:
    highRiskQuoteCoverageDepthReport?.summary?.high_risk_topic_count
      === (qualityReport.high_risk_quote_core_topics || []).length,
  generated_backlog_matches_quality_report:
    evidenceBacklog?.summary?.pending_generated_or_unverified_chunks
      === qualityReport.generated_needs_review_count
};

const releaseBlockers = [
  {
    id: 'generated_backlog_unreviewed',
    status: statusLabel(qualityReport.generated_needs_review_count === 0),
    current_value: qualityReport.generated_needs_review_count,
    required_value: 0,
    owner: 'clinical evidence reviewer',
    action: 'Review, replace, remove, or formally adjudicate generated-needs-review chunks before learner-facing use.'
  },
  {
    id: 'source_link_quote_verification_not_ready',
    status: statusLabel(Boolean(sourceLinkQuoteVerificationReport?.summary?.quote_verification_release_ready)),
    current_value: sourceLinkQuoteVerificationReport?.summary?.quote_records_requiring_repair
      ?? sourceLinkQuoteVerificationReport?.summary?.quote_records_with_any_issue
      ?? 0,
    required_value: 0,
    owner: 'medical librarian and evidence engineer',
    action: 'Repair failed source URLs, update quote/search phrases, or record manual PDF/source-location verification for every learner-facing quote.'
  },
  {
    id: 'source_freshness_not_ready',
    status: statusLabel(Boolean(sourceFreshnessReport?.summary?.learner_facing_source_freshness_release_ready)),
    current_value: sourceFreshnessReport?.summary?.learner_facing_quote_backed_sources_release_blocked || 0,
    required_value: 0,
    owner: 'medical librarian or evidence lead',
    action: 'Record local review dates and replace stale learner-facing quote-backed sources.'
  },
  {
    id: 'high_risk_quote_depth_not_ready',
    status: statusLabel(Boolean(highRiskQuoteCoverageDepthReport?.summary?.quote_coverage_depth_release_ready)),
    current_value: highRiskQuoteCoverageDepthReport?.summary?.missing_required_topic_facet_pairs || 0,
    required_value: 0,
    owner: 'clinical evidence reviewer',
    action: 'Fill missing high-risk topic/facet quote-backed evidence for recognition, assessment, diagnostics, management, and reassessment.'
  },
  {
    id: 'claim_entailment_not_reviewed',
    status: statusLabel(Boolean(feedbackClaimEntailmentAdjudicationStatus?.summary?.ready_for_national_feedback_release)),
    current_value: feedbackClaimEntailmentAdjudicationStatus?.summary?.valid_claim_reviews || 0,
    required_value: learnerFacingEvidenceCoverageReport?.summary?.claim_entailment_required_claim_sets || 0,
    owner: 'emergency clinician and simulation educator',
    action: 'Complete claim-entailment reviews for every learner-facing feedback domain.'
  },
  {
    id: 'domain_specific_claim_reference_support_not_ready',
    status: statusLabel(Boolean(feedbackClaimReferenceAlignmentReport?.summary?.domain_specific_quote_support_release_ready)),
    current_value: feedbackClaimReferenceAlignmentReport?.summary?.claim_sets_missing_domain_specific_quote_support || 0,
    required_value: 0,
    owner: 'clinical evidence reviewer',
    action: 'Add quote-backed ESI/triage-standard references or record a clinician-approved local standard before named-standard feedback is learner-facing.'
  },
  {
    id: 'claim_reference_gap_packets_not_clear',
    status: statusLabel(Boolean(claimReferenceGapReviewPackets)
      && (claimReferenceGapReviewPackets?.summary?.total_gap_packets || 0) === 0),
    current_value: claimReferenceGapReviewPackets?.summary?.total_gap_packets || 0,
    required_value: 0,
    owner: 'clinical evidence reviewer',
    action: 'Use claim-reference gap packets to close named-standard evidence gaps and rerun alignment before national feedback release.'
  },
  {
    id: 'evidence_adjudication_not_complete',
    status: statusLabel((clinicalReviewAdjudicationStatus?.evidence?.approved_chunks || 0) >= activeChunks.length),
    current_value: clinicalReviewAdjudicationStatus?.evidence?.approved_chunks || 0,
    required_value: activeChunks.length,
    owner: 'clinical evidence adjudication lead',
    action: 'Record approved evidence chunks in the adjudication file before national release.'
  }
];

const summary = {
  total_sources: qualityReport.total_sources,
  total_chunks: qualityReport.total_chunks,
  quote_backed_chunks: qualityReport.quote_backed_count,
  quote_backed_percentage: percent(qualityReport.quote_backed_count, qualityReport.total_chunks),
  auditable_chunks: qualityReport.auditable_count,
  auditable_percentage: percent(qualityReport.auditable_count, qualityReport.total_chunks),
  generated_needs_review_chunks: qualityReport.generated_needs_review_count,
  generated_needs_review_percentage: percent(qualityReport.generated_needs_review_count, qualityReport.total_chunks),
  missing_locator_chunks: Array.isArray(qualityReport.missing_locator_chunk_ids)
    ? qualityReport.missing_locator_chunk_ids.length
    : 0,
  learner_facing_eligible_quote_backed_chunks:
    learnerFacingEvidenceCoverageReport?.summary?.learner_facing_eligible_quote_backed_chunks || 0,
  learner_facing_evidence_release_ready:
    Boolean(learnerFacingEvidenceCoverageReport?.summary?.learner_facing_evidence_release_ready),
  generated_chunks_quarantined_by_default:
    Boolean(learnerFacingEvidenceCoverageReport?.summary?.generated_chunks_quarantined_by_default),
  runtime_retrieval_all_probes_passed:
    Boolean(openEvidenceRetrievalRuntimeReport?.summary?.all_runtime_probes_passed),
  runtime_retrieval_quality_badge_visible:
    Boolean(openEvidenceRetrievalRuntimeReport?.summary?.retrieval_quality_badge_visible),
  source_link_quote_records:
    sourceLinkQuoteVerificationReport?.summary?.quote_records || 0,
  source_link_quote_source_urls_fetch_failed:
    sourceLinkQuoteVerificationReport?.summary?.source_urls_fetch_failed || 0,
  source_link_quote_hash_mismatches:
    sourceLinkQuoteVerificationReport?.summary?.quote_hash_mismatches || 0,
  source_link_quote_records_matched_in_fetched_source:
    sourceLinkQuoteVerificationReport?.summary?.quote_records_matched_in_fetched_source || 0,
  source_link_quote_records_unmatched_in_fetched_source:
    sourceLinkQuoteVerificationReport?.summary?.quote_records_unmatched_in_fetched_source || 0,
  source_link_quote_records_pdf_fetch_only:
    sourceLinkQuoteVerificationReport?.summary?.quote_records_pdf_fetch_only || 0,
  source_link_quote_records_without_machine_text_match:
    sourceLinkQuoteVerificationReport?.summary?.quote_records_without_machine_text_match || 0,
  source_link_quote_records_requiring_repair:
    sourceLinkQuoteVerificationReport?.summary?.quote_records_requiring_repair || 0,
  source_link_quote_verification_release_ready:
    Boolean(sourceLinkQuoteVerificationReport?.summary?.quote_verification_release_ready),
  learner_facing_quote_backed_sources_release_blocked:
    sourceFreshnessReport?.summary?.learner_facing_quote_backed_sources_release_blocked || 0,
  stale_learner_facing_quote_backed_sources:
    sourceFreshnessReport?.summary?.stale_learner_facing_quote_backed_sources || 0,
  missing_local_review_date_sources:
    sourceFreshnessReport?.summary?.missing_local_review_date_sources || 0,
  high_risk_topic_count:
    highRiskQuoteCoverageDepthReport?.summary?.high_risk_topic_count || 0,
  high_risk_topics_meeting_core_facet_depth:
    highRiskQuoteCoverageDepthReport?.summary?.topics_meeting_core_facet_depth || 0,
  high_risk_missing_topic_facet_pairs:
    highRiskQuoteCoverageDepthReport?.summary?.missing_required_topic_facet_pairs || 0,
  source_limited_formative_feedback_rows:
    learnerFacingEvidenceCoverageReport?.summary?.source_limited_formative_feedback_rows || 0,
  claim_reference_alignment_release_ready:
    Boolean(feedbackClaimReferenceAlignmentReport?.summary?.claim_reference_alignment_release_ready),
  claim_reference_alignment_domain_specific_release_ready:
    Boolean(feedbackClaimReferenceAlignmentReport?.summary?.domain_specific_quote_support_release_ready),
  claim_reference_alignment_claim_sets_missing_domain_specific_support:
    feedbackClaimReferenceAlignmentReport?.summary?.claim_sets_missing_domain_specific_quote_support || 0,
  claim_reference_alignment_claim_sets_requiring_domain_specific_support:
    feedbackClaimReferenceAlignmentReport?.summary?.claim_sets_requiring_domain_specific_quote_support || 0,
  claim_reference_gap_packets_present: Boolean(claimReferenceGapReviewPackets),
  claim_reference_gap_packets_total:
    claimReferenceGapReviewPackets?.summary?.total_gap_packets || 0,
  claim_reference_gap_packets_pending:
    claimReferenceGapReviewPackets?.summary?.pending_gap_packets || 0,
  claim_reference_gap_packets_generated_candidates:
    claimReferenceGapReviewPackets?.summary?.generated_needs_review_candidate_chunks_packeted || 0,
  claim_reference_gap_packets_all_domain_specific_gaps_packeted:
    Boolean(claimReferenceGapReviewPackets?.summary?.all_domain_specific_gaps_packeted),
  claim_entailment_valid_reviews:
    feedbackClaimEntailmentAdjudicationStatus?.summary?.valid_claim_reviews || 0,
  claim_entailment_required_claim_sets:
    learnerFacingEvidenceCoverageReport?.summary?.claim_entailment_required_claim_sets || 0,
  evidence_adjudication_approved_chunks:
    clinicalReviewAdjudicationStatus?.evidence?.approved_chunks || 0,
  dashboard_release_ready: dashboardReleaseReady,
  alignment_checks_passed: Object.values(alignmentChecks).every(Boolean),
  open_release_blockers: releaseBlockers.filter((blocker) => blocker.status !== 'cleared').length
};

const dashboard = {
  schema_version: 'evidence_quality_dashboard_v1',
  generated_at: new Date().toISOString(),
  review_status: dashboardReleaseReady
    ? 'evidence_quality_dashboard_ready_for_release'
    : 'evidence_quality_dashboard_open_backlog_review_required',
  warning: 'This dashboard is a maintainer-facing triage view. It summarizes source coverage and review work but does not replace clinician, librarian, or institutional approval.',
  source_contract: {
    public_knowledge_bundle_schema: knowledgeBundle.schema_version,
    public_source_quality_report_schema: qualityReport.schema_version,
    public_source_quality_report_path: 'frontend/src/data/public_clinical_source_quality_report.json',
    learner_facing_coverage_report_present: Boolean(learnerFacingEvidenceCoverageReport),
    learner_facing_coverage_report_path: 'docs/learner_facing_evidence_coverage_report.json',
    high_risk_quote_depth_report_present: Boolean(highRiskQuoteCoverageDepthReport),
    high_risk_quote_depth_report_path: 'docs/high_risk_quote_coverage_depth_report.json',
    source_freshness_report_present: Boolean(sourceFreshnessReport),
    source_freshness_report_path: 'docs/source_freshness_report.json',
    retrieval_runtime_report_present: Boolean(openEvidenceRetrievalRuntimeReport),
    retrieval_runtime_report_path: 'docs/open_evidence_retrieval_runtime_report.json',
    source_link_quote_verification_report_present: Boolean(sourceLinkQuoteVerificationReport),
    source_link_quote_verification_report_path: 'docs/source_link_quote_verification_report.json',
    evidence_backlog_report_present: Boolean(evidenceBacklog),
    evidence_backlog_report_path: 'docs/evidence_review_backlog.json',
    claim_reference_gap_review_packets_present: Boolean(claimReferenceGapReviewPackets),
    claim_reference_gap_review_packets_path: 'docs/claim_reference_gap_review_packets.json'
  },
  summary,
  alignment_checks: alignmentChecks,
  evidence_status_counts: countBy(activeChunks, (chunk) => chunk.evidence_status),
  quote_backed_by_facet: countBy(quoteBackedChunks, (chunk) => chunk.facet_id),
  generated_needs_review_by_facet: countBy(generatedNeedsReviewChunks, (chunk) => chunk.facet_id),
  high_risk_quote_depth: {
    required_core_facets: highRiskQuoteCoverageDepthReport?.coverage_policy?.required_core_facets || [],
    topics_meeting_core_facet_depth: summary.high_risk_topics_meeting_core_facet_depth,
    missing_required_topic_facet_pairs: summary.high_risk_missing_topic_facet_pairs,
    missing_topic_facet_rows: missingTopicFacetRows
  },
  release_blockers: releaseBlockers,
  reviewer_queue: {
    pending_generated_or_unverified_chunks:
      evidenceBacklog?.summary?.pending_generated_or_unverified_chunks || 0,
    pending_source_count: evidenceBacklog?.summary?.pending_source_count || 0,
    pending_review_batch_count: evidenceBacklog?.summary?.pending_review_batch_count || 0,
    evidence_adjudication_approved_chunks:
      clinicalReviewAdjudicationStatus?.evidence?.approved_chunks || 0,
    claim_reference_alignment_claim_sets:
      feedbackClaimReferenceAlignmentReport?.summary?.total_claim_sets || 0,
    claim_reference_alignment_missing_domain_specific_support:
      feedbackClaimReferenceAlignmentReport?.summary?.claim_sets_missing_domain_specific_quote_support || 0,
    claim_reference_gap_packets_total:
      claimReferenceGapReviewPackets?.summary?.total_gap_packets || 0,
    claim_reference_gap_packets_generated_candidates:
      claimReferenceGapReviewPackets?.summary?.generated_needs_review_candidate_chunks_packeted || 0,
    claim_entailment_valid_reviews:
      feedbackClaimEntailmentAdjudicationStatus?.summary?.valid_claim_reviews || 0
  },
  next_actions: [
    'Use docs/evidence_review_backlog.json to prioritize generated-needs-review chunks for replacement or formal review.',
    'Use docs/source_link_quote_verification_report.json to repair failed URLs, unmatched quote/search phrases, and PDF-only quote verification gaps.',
    'Use docs/high_risk_quote_coverage_depth_report.json to fill missing core facets for high-risk ED topics.',
    'Use docs/feedback_claim_reference_alignment_report.json to close named-standard quote support gaps such as ESI before learner-facing release.',
    'Use docs/claim_reference_gap_review_packets.json to assign evidence acquisition work for named-standard feedback gaps.',
    'Use docs/source_freshness_report.json to record local review dates and replace stale learner-facing sources.',
    'Use docs/feedback_claim_entailment_review_packets.json to assign clinical and simulation educator claim review.',
    'Keep docs/open_evidence_retrieval_runtime_report.json passing so learner-facing retrieval remains quote-backed and visibly quality-badged.'
  ]
};

function toMarkdown(data) {
  const lines = [
    '# Evidence Quality Dashboard',
    '',
    `Generated: ${data.generated_at}`,
    '',
    data.warning,
    '',
    '## At A Glance',
    '',
    '| Signal | Current State | Release Target |',
    '|---|---:|---:|',
    `| Quote-backed chunks | ${data.summary.quote_backed_chunks}/${data.summary.total_chunks} (${data.summary.quote_backed_percentage}%) | All learner-facing claims backed by reviewed evidence |`,
    `| Generated-needs-review chunks | ${data.summary.generated_needs_review_chunks} (${data.summary.generated_needs_review_percentage}%) | 0 learner-facing unresolved chunks |`,
    `| Missing locator chunks | ${data.summary.missing_locator_chunks} | 0 |`,
    `| Source-link quote records requiring repair | ${data.summary.source_link_quote_records_requiring_repair} | 0 |`,
    `| Quote records without machine text match | ${data.summary.source_link_quote_records_without_machine_text_match} | 0 or manually verified |`,
    `| High-risk topic/facet gaps | ${data.summary.high_risk_missing_topic_facet_pairs} | 0 |`,
    `| Claim sets missing domain-specific quote support | ${data.summary.claim_reference_alignment_claim_sets_missing_domain_specific_support}/${data.summary.claim_reference_alignment_claim_sets_requiring_domain_specific_support} | 0 |`,
    `| Claim-reference gap packets | ${data.summary.claim_reference_gap_packets_total} | 0 |`,
    `| Claim-entailment reviews | ${data.summary.claim_entailment_valid_reviews}/${data.summary.claim_entailment_required_claim_sets} | All feedback claim sets reviewed |`,
    `| Evidence adjudication approvals | ${data.summary.evidence_adjudication_approved_chunks}/${data.summary.total_chunks} | All learner-facing chunks approved |`,
    `| Runtime retrieval quality badge | ${data.summary.runtime_retrieval_quality_badge_visible} | true |`,
    `| Learner-facing evidence release ready | ${data.summary.learner_facing_evidence_release_ready} | true |`,
    '',
    '## High-Risk Quote Depth',
    '',
    `Required core facets: ${data.high_risk_quote_depth.required_core_facets.join(', ')}`,
    '',
    '| Topic | Quote-Backed | Missing Core Facets | Release Ready |',
    '|---|---:|---|---|',
    ...data.high_risk_quote_depth.missing_topic_facet_rows.map((row) =>
      `| ${markdownEscape(row.topic)} | ${row.quote_backed_chunks} | ${markdownEscape(row.missing_core_facets.join(', '))} | ${row.release_ready} |`
    ),
    '',
    '## Release Blockers',
    '',
    '| Blocker | Status | Current | Target | Owner | Action |',
    '|---|---|---:|---:|---|---|',
    ...data.release_blockers.map((blocker) =>
      `| ${blocker.id} | ${blocker.status} | ${blocker.current_value} | ${blocker.required_value} | ${markdownEscape(blocker.owner)} | ${markdownEscape(blocker.action)} |`
    ),
    '',
    '## Reviewer Queue',
    '',
    `- Pending generated or unverified chunks: ${data.reviewer_queue.pending_generated_or_unverified_chunks}`,
    `- Pending source count: ${data.reviewer_queue.pending_source_count}`,
    `- Pending review batches: ${data.reviewer_queue.pending_review_batch_count}`,
    `- Claim reference-alignment sets: ${data.reviewer_queue.claim_reference_alignment_claim_sets}`,
    `- Claim reference-alignment domain-specific gaps: ${data.reviewer_queue.claim_reference_alignment_missing_domain_specific_support}`,
    `- Claim reference-gap packets: ${data.reviewer_queue.claim_reference_gap_packets_total}`,
    `- Claim reference-gap generated candidates: ${data.reviewer_queue.claim_reference_gap_packets_generated_candidates}`,
    `- Valid claim-entailment reviews: ${data.reviewer_queue.claim_entailment_valid_reviews}`,
    '',
    '## Next Actions',
    '',
    ...data.next_actions.map((action) => `- ${action}`),
    ''
  ];

  return `${lines.join('\n')}\n`;
}

writeFileSync(JSON_OUTPUT_PATH, `${JSON.stringify(dashboard, null, 2)}\n`, 'utf8');
writeFileSync(MD_OUTPUT_PATH, toMarkdown(dashboard), 'utf8');

console.log(JSON.stringify({
  review_status: dashboard.review_status,
  quote_backed_chunks: dashboard.summary.quote_backed_chunks,
  generated_needs_review_chunks: dashboard.summary.generated_needs_review_chunks,
  source_link_quote_records_requiring_repair:
    dashboard.summary.source_link_quote_records_requiring_repair,
  high_risk_missing_topic_facet_pairs: dashboard.summary.high_risk_missing_topic_facet_pairs,
  open_release_blockers: dashboard.summary.open_release_blockers,
  report_path: JSON_OUTPUT_PATH
}, null, 2));
