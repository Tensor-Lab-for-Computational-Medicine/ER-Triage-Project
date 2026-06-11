import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LEARNER_FACING_OPEN_EVIDENCE_POLICY_VERSION,
  isGeneratedNeedsReviewReferenceChunk,
  isQuoteBackedReferenceChunk
} from '../frontend/src/services/openEvidencePolicyService.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CASES_PATH = join(ROOT, 'frontend', 'src', 'data', 'cases.json');
const KNOWLEDGE_BUNDLE_PATH = join(ROOT, 'frontend', 'src', 'data', 'public_clinical_knowledge_bundle.json');
const QUALITY_REPORT_PATH = join(ROOT, 'frontend', 'src', 'data', 'public_clinical_source_quality_report.json');
const FEEDBACK_TRACEABILITY_MATRIX_PATH = join(ROOT, 'docs', 'feedback_traceability_matrix.json');
const OPEN_EVIDENCE_POLICY_RUNTIME_REPORT_PATH = join(ROOT, 'docs', 'open_evidence_runtime_policy_report.json');
const OPEN_EVIDENCE_RETRIEVAL_RUNTIME_REPORT_PATH = join(ROOT, 'docs', 'open_evidence_retrieval_runtime_report.json');
const SOURCE_FRESHNESS_REPORT_PATH = join(ROOT, 'docs', 'source_freshness_report.json');
const HIGH_RISK_QUOTE_COVERAGE_DEPTH_REPORT_PATH = join(ROOT, 'docs', 'high_risk_quote_coverage_depth_report.json');
const HIGH_RISK_CLINICAL_CLASSIFICATION_REPORT_PATH = join(ROOT, 'docs', 'high_risk_clinical_classification_report.json');
const CLINICAL_REVIEW_ADJUDICATION_STATUS_PATH = join(ROOT, 'docs', 'clinical_review_adjudication_status.json');
const CLAIM_ENTAILMENT_REVIEW_PACKETS_PATH = join(ROOT, 'docs', 'feedback_claim_entailment_review_packets.json');
const CLAIM_ENTAILMENT_ADJUDICATION_STATUS_PATH = join(ROOT, 'docs', 'feedback_claim_entailment_adjudication_status.json');
const CLAIM_REFERENCE_ALIGNMENT_REPORT_PATH = join(ROOT, 'docs', 'feedback_claim_reference_alignment_report.json');
const CLAIM_REFERENCE_GAP_REVIEW_PACKETS_PATH = join(ROOT, 'docs', 'claim_reference_gap_review_packets.json');
const CLAIM_ENTAILMENT_REVIEWS_PATH = join(ROOT, 'docs', 'learner_facing_claim_entailment_reviews.json');
const JSON_OUTPUT_PATH = join(ROOT, 'docs', 'learner_facing_evidence_coverage_report.json');
const MD_OUTPUT_PATH = join(ROOT, 'docs', 'learner_facing_evidence_coverage_report.md');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readOptionalJson(path) {
  return existsSync(path) ? readJson(path) : null;
}

function countBy(items, selector) {
  return items.reduce((acc, item) => {
    const key = selector(item) || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function uniqueSorted(items) {
  return [...new Set(items.filter(Boolean))].sort();
}

function isActiveReviewedChunk(chunk) {
  return chunk?.active !== false && !chunk?.superseded_by && chunk?.review_status === 'reviewed';
}

function chunkHasTopic(chunk, topic) {
  return (chunk.topic_tags || []).includes(topic);
}

function sourceSummaryForChunk(chunk, sourceById) {
  const source = sourceById.get(chunk.source_id) || {};
  return {
    chunk_id: chunk.id,
    source_id: chunk.source_id,
    citation_label: chunk.citation_label || '',
    source_title: chunk.source_title || source.title || '',
    organization: chunk.organization || source.organization || '',
    source_tier: chunk.source_tier || source.source_tier || '',
    publication_date: chunk.publication_date || source.publication_date || '',
    facet_id: chunk.facet_id || '',
    topic_tags: chunk.topic_tags || [],
    locator: {
      url: chunk.locator?.url || chunk.source_url || source.url || '',
      section_heading: chunk.locator?.section_heading || chunk.section || '',
      page: chunk.locator?.page || chunk.page || '',
      locator_quality: chunk.locator?.locator_quality || '',
      verification_status: chunk.locator?.verification_status || chunk.verification_status || ''
    },
    supporting_quote_hashes: (chunk.supporting_quotes || [])
      .map((quote) => quote.quote_hash)
      .filter(Boolean)
  };
}

function flattenClaimReviews(rawReviews) {
  if (!rawReviews) return [];
  if (Array.isArray(rawReviews)) return rawReviews;
  for (const key of ['claim_reviews', 'reviews', 'claims']) {
    if (Array.isArray(rawReviews[key])) return rawReviews[key];
  }
  return [];
}

function toPercent(numerator, denominator) {
  if (!denominator) return 0;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

const cases = readJson(CASES_PATH);
const knowledgeBundle = readJson(KNOWLEDGE_BUNDLE_PATH);
const qualityReport = readJson(QUALITY_REPORT_PATH);
const feedbackTraceabilityMatrix = readOptionalJson(FEEDBACK_TRACEABILITY_MATRIX_PATH);
const openEvidenceRuntimeReport = readOptionalJson(OPEN_EVIDENCE_POLICY_RUNTIME_REPORT_PATH);
const openEvidenceRetrievalRuntimeReport = readOptionalJson(OPEN_EVIDENCE_RETRIEVAL_RUNTIME_REPORT_PATH);
const sourceFreshnessReport = readOptionalJson(SOURCE_FRESHNESS_REPORT_PATH);
const highRiskQuoteCoverageDepthReport = readOptionalJson(HIGH_RISK_QUOTE_COVERAGE_DEPTH_REPORT_PATH);
const highRiskClinicalClassificationReport = readOptionalJson(HIGH_RISK_CLINICAL_CLASSIFICATION_REPORT_PATH);
const clinicalReviewAdjudicationStatus = readOptionalJson(CLINICAL_REVIEW_ADJUDICATION_STATUS_PATH);
const claimReviewPacketReport = readOptionalJson(CLAIM_ENTAILMENT_REVIEW_PACKETS_PATH);
const claimEntailmentAdjudicationStatus = readOptionalJson(CLAIM_ENTAILMENT_ADJUDICATION_STATUS_PATH);
const claimReferenceAlignmentReport = readOptionalJson(CLAIM_REFERENCE_ALIGNMENT_REPORT_PATH);
const claimReferenceGapReviewPackets = readOptionalJson(CLAIM_REFERENCE_GAP_REVIEW_PACKETS_PATH);
const claimReviews = flattenClaimReviews(readOptionalJson(CLAIM_ENTAILMENT_REVIEWS_PATH));

const sourceById = new Map((knowledgeBundle.sources || []).map((source) => [source.id, source]));
const activeReviewedChunks = (knowledgeBundle.chunks || []).filter(isActiveReviewedChunk);
const eligibleQuoteBackedChunks = activeReviewedChunks.filter(isQuoteBackedReferenceChunk);
const generatedNeedsReviewChunks = activeReviewedChunks.filter(isGeneratedNeedsReviewReferenceChunk);
const highRiskTopics = qualityReport.high_risk_quote_core_topics || [];
const highRiskTopicCoverage = highRiskTopics.map((topic) => {
  const topicEligibleChunks = eligibleQuoteBackedChunks.filter((chunk) => chunkHasTopic(chunk, topic));
  const topicGeneratedChunks = generatedNeedsReviewChunks.filter((chunk) => chunkHasTopic(chunk, topic));
  return {
    topic,
    learner_facing_status: topicEligibleChunks.length
      ? 'quote_backed_subset_available'
      : 'blocked_no_quote_backed_coverage',
    quote_backed_chunk_count: topicEligibleChunks.length,
    generated_needs_review_chunk_count: topicGeneratedChunks.length,
    representative_quote_backed_chunk_ids: topicEligibleChunks.slice(0, 5).map((chunk) => chunk.id),
    representative_generated_chunk_ids: topicGeneratedChunks.slice(0, 5).map((chunk) => chunk.id)
  };
});

const highRiskTopicsWithoutQuoteCoverage = highRiskTopicCoverage
  .filter((entry) => entry.quote_backed_chunk_count === 0)
  .map((entry) => entry.topic);

const domainSummary = feedbackTraceabilityMatrix?.domain_summary || [];
const packetQueue = (claimReviewPacketReport?.claim_review_packets || []).map((packet) => ({
  domain_key: packet.domain_key,
  label: packet.label,
  scoring_mode: packet.scoring_mode,
  feedback_basis: packet.feedback_basis,
  current_status_counts: packet.traceability?.status_counts || {},
  source_limited_formative_cases: packet.traceability?.source_limited_formative_cases || 0,
  numeric_cases_missing_required_evidence: packet.traceability?.numeric_cases_missing_required_evidence || 0,
  review_need: packet.required_entailment_evidence?.join(' '),
  packet_id: packet.id,
  current_release_status: packet.current_release_status,
  reviewer_roles: packet.reviewer_roles || [],
  required_review_actions: [
    'Complete this packet in docs/learner_facing_claim_entailment_reviews.json.',
    'Verify every learner-facing feedback claim against case truth, quote-backed open evidence, or a clinician-approved local standard.'
  ]
}));
const claimReviewQueue = packetQueue.length ? packetQueue : domainSummary.map((domain) => ({
  domain_key: domain.domain_key,
  label: domain.label,
  scoring_mode: domain.scoring_mode,
  feedback_basis: domain.feedback_basis,
  current_status_counts: domain.status_counts || {},
  source_limited_formative_cases: domain.source_limited_formative_cases || 0,
  numeric_cases_missing_required_evidence: domain.numeric_cases_missing_required_evidence || 0,
  review_need: domain.national_review_need,
  required_review_actions: [
    'Map every learner-facing feedback claim in this domain to case truth, quote-backed open evidence, or clinician-approved local standard.',
    'Record claim-level entailment review before this domain is used for national summative assessment.'
  ]
}));

const approvedClaimReviews = claimReviews.filter((review) =>
  ['approved', 'approved_for_learner_feedback', 'clinician_approved'].includes(review.status)
);
const validatedClaimReviews = claimEntailmentAdjudicationStatus?.summary?.valid_claim_reviews ?? approvedClaimReviews.length;
const claimEntailmentReadyForNationalRelease =
  Boolean(claimEntailmentAdjudicationStatus?.summary?.ready_for_national_feedback_release);
const claimEntailmentInvalidReviewInputCount =
  claimEntailmentAdjudicationStatus?.summary?.invalid_review_input_count ?? 0;
const generatedReferencesReturned = openEvidenceRuntimeReport?.summary?.generated_references_returned ?? null;
const generatedChunksQuarantined = Boolean(openEvidenceRuntimeReport?.summary?.generated_chunks_quarantined_by_default);
const runtimeRetrievalAllProbesPassed = Boolean(openEvidenceRetrievalRuntimeReport?.summary?.all_runtime_probes_passed);
const runtimeRetrievalQuoteBackedOnlyDefault =
  Boolean(openEvidenceRetrievalRuntimeReport?.summary?.quote_backed_only_default_enabled);
const runtimeRetrievalReferenceCount =
  openEvidenceRetrievalRuntimeReport?.summary?.runtime_retrieval_reference_count || 0;
const runtimeRetrievalGeneratedBadges =
  openEvidenceRetrievalRuntimeReport?.summary?.generated_needs_review_badges_rendered || 0;
const runtimeRetrievalNeedsReviewBadges =
  openEvidenceRetrievalRuntimeReport?.summary?.needs_review_badges_rendered || 0;
const runtimeRetrievalSmokeReviewItems =
  openEvidenceRetrievalRuntimeReport?.summary?.smoke_review_items || 0;
const runtimeRetrievalQuarantineWarningVisible =
  Boolean(openEvidenceRetrievalRuntimeReport?.summary?.generated_backlog_quarantine_warning_visible);
const runtimeRetrievalQualityBadgeVisible =
  Boolean(openEvidenceRetrievalRuntimeReport?.summary?.retrieval_quality_badge_visible);
const runtimeHighRiskRetrievalQualityThresholdPassed =
  Boolean(openEvidenceRetrievalRuntimeReport?.summary?.high_risk_retrieval_quality_threshold_passed);
const runtimeHighRiskRetrievalQualityTopBaseScore =
  openEvidenceRetrievalRuntimeReport?.summary?.high_risk_retrieval_quality_top_base_score || 0;
const runtimeHighRiskRetrievalQualityMinimumBaseScore =
  openEvidenceRetrievalRuntimeReport?.summary?.high_risk_retrieval_quality_minimum_base_score || 0;
const runtimeBm25FallbackBadgeVisible =
  Boolean(openEvidenceRetrievalRuntimeReport?.summary?.bm25_fallback_badge_visible);
const runtimeRetrievalNonclinicalScopeGuardrailWarningVisible =
  Boolean(openEvidenceRetrievalRuntimeReport?.summary?.nonclinical_scope_guardrail_warning_visible);
const runtimeRetrievalNonclinicalScopeGuardrailReferenceCount =
  openEvidenceRetrievalRuntimeReport?.summary?.nonclinical_scope_guardrail_reference_count || 0;
const learnerFacingSourceFreshnessReleaseReady =
  Boolean(sourceFreshnessReport?.summary?.learner_facing_source_freshness_release_ready);
const learnerFacingQuoteBackedSourcesReleaseBlocked =
  sourceFreshnessReport?.summary?.learner_facing_quote_backed_sources_release_blocked || 0;
const staleLearnerFacingQuoteBackedSources =
  sourceFreshnessReport?.summary?.stale_learner_facing_quote_backed_sources || 0;
const missingLocalReviewDateSources =
  sourceFreshnessReport?.summary?.missing_local_review_date_sources || 0;
const quoteCoverageDepthReleaseReady =
  Boolean(highRiskQuoteCoverageDepthReport?.summary?.quote_coverage_depth_release_ready);
const quoteCoverageDepthTopicsMeetingCoreFacetDepth =
  highRiskQuoteCoverageDepthReport?.summary?.topics_meeting_core_facet_depth || 0;
const quoteCoverageDepthMissingTopicFacetPairs =
  highRiskQuoteCoverageDepthReport?.summary?.missing_required_topic_facet_pairs || 0;
const quoteCoverageDepthGeneratedNeedsReviewChunks =
  highRiskQuoteCoverageDepthReport?.summary?.generated_needs_review_chunks_on_high_risk_topics || 0;
const highRiskClassificationPolicyReady =
  Boolean(highRiskClinicalClassificationReport?.summary?.high_risk_classification_policy_ready);
const highRiskClassificationTopicCount =
  highRiskClinicalClassificationReport?.summary?.structured_topic_policy_rows || 0;
const highRiskClassificationTopicsWithAlias =
  highRiskClinicalClassificationReport?.summary?.topics_with_alias_policy || 0;
const highRiskClassificationTopicAliasProbes =
  highRiskClinicalClassificationReport?.summary?.topic_alias_probes || 0;
const highRiskClassificationTopicAliasProbesPassed =
  highRiskClinicalClassificationReport?.summary?.topic_alias_probes_passed || 0;
const highRiskClassificationRetrievalMatrixRows =
  highRiskClinicalClassificationReport?.summary?.retrieval_matrix_rows || 0;
const highRiskClassificationRetrievalMatrixRowsPassed =
  highRiskClinicalClassificationReport?.summary?.retrieval_matrix_rows_passed || 0;
const highRiskClassificationCaseRowsClassified =
  highRiskClinicalClassificationReport?.summary?.case_rows_classified || 0;
const highRiskClassificationClaimSetsClassified =
  highRiskClinicalClassificationReport?.summary?.claim_sets_classified || 0;
const highRiskClassificationNegativeControls =
  highRiskClinicalClassificationReport?.summary?.negative_control_probes || 0;
const highRiskClassificationNegativeControlsNonclinical =
  highRiskClinicalClassificationReport?.summary?.negative_controls_classified_nonclinical || 0;
const highRiskClassificationFallbackOnlyProbes =
  highRiskClinicalClassificationReport?.summary?.regex_fallback_only_high_risk_probes || 0;
const highRiskClassificationGeneratedApproved =
  highRiskClinicalClassificationReport?.summary?.generated_needs_review_approved_by_this_report || 0;
const claimReferenceAlignmentClaimSets =
  claimReferenceAlignmentReport?.summary?.total_claim_sets || 0;
const claimReferenceAlignmentMeetingThreshold =
  claimReferenceAlignmentReport?.summary?.claim_sets_meeting_minimum_reference_threshold || 0;
const claimReferenceAlignmentRequiringDomainSpecificSupport =
  claimReferenceAlignmentReport?.summary?.claim_sets_requiring_domain_specific_quote_support || 0;
const claimReferenceAlignmentWithDomainSpecificSupport =
  claimReferenceAlignmentReport?.summary?.claim_sets_with_domain_specific_quote_support || 0;
const claimReferenceAlignmentMissingDomainSpecificSupport =
  claimReferenceAlignmentReport?.summary?.claim_sets_missing_domain_specific_quote_support || 0;
const claimReferenceAlignmentDomainSpecificReleaseReady =
  Boolean(claimReferenceAlignmentReport?.summary?.domain_specific_quote_support_release_ready);
const claimReferenceGapPacketsPresent = Boolean(claimReferenceGapReviewPackets);
const claimReferenceGapPacketsTotal =
  claimReferenceGapReviewPackets?.summary?.total_gap_packets || 0;
const claimReferenceGapPacketsPending =
  claimReferenceGapReviewPackets?.summary?.pending_gap_packets || 0;
const claimReferenceGapPacketsGeneratedCandidates =
  claimReferenceGapReviewPackets?.summary?.generated_needs_review_candidate_chunks_packeted || 0;
const claimReferenceGapPacketsAllDomainSpecificGapsPacketed =
  Boolean(claimReferenceGapReviewPackets?.summary?.all_domain_specific_gaps_packeted);
const claimReferenceAlignmentGeneratedReferences =
  claimReferenceAlignmentReport?.summary?.generated_needs_review_references_returned || 0;
const claimReferenceAlignmentSourceLimitedBlocked =
  claimReferenceAlignmentReport?.summary?.source_limited_claim_sets_blocked || 0;
const claimReferenceAlignmentReleaseReady =
  Boolean(claimReferenceAlignmentReport?.summary?.claim_reference_alignment_release_ready);
const clinicianLibrarianReviewedGeneratedChunks =
  openEvidenceRuntimeReport?.summary?.clinician_librarian_reviewed_generated_chunks || 0;
const evidenceAdjudicationApprovedChunks = clinicalReviewAdjudicationStatus?.evidence?.approved_chunks || 0;

const claimEntailmentPacketReportPresent = Boolean(claimReviewPacketReport);
const claimEntailmentAdjudicationStatusPresent = Boolean(claimEntailmentAdjudicationStatus);
const learnerFacingEvidenceReleaseReady = Boolean(
  eligibleQuoteBackedChunks.length > 0
    && highRiskTopicsWithoutQuoteCoverage.length === 0
    && generatedNeedsReviewChunks.length === 0
    && generatedChunksQuarantined
    && generatedReferencesReturned === 0
    && runtimeRetrievalAllProbesPassed
    && runtimeRetrievalQuoteBackedOnlyDefault
    && runtimeRetrievalReferenceCount > 0
    && runtimeRetrievalGeneratedBadges === 0
    && runtimeRetrievalNeedsReviewBadges === 0
    && runtimeRetrievalSmokeReviewItems === 0
    && runtimeRetrievalQuarantineWarningVisible
    && runtimeRetrievalQualityBadgeVisible
    && runtimeHighRiskRetrievalQualityThresholdPassed
    && runtimeHighRiskRetrievalQualityMinimumBaseScore >= 0.08
    && runtimeHighRiskRetrievalQualityTopBaseScore >= runtimeHighRiskRetrievalQualityMinimumBaseScore
    && runtimeBm25FallbackBadgeVisible
    && runtimeRetrievalNonclinicalScopeGuardrailWarningVisible
    && runtimeRetrievalNonclinicalScopeGuardrailReferenceCount === 0
    && learnerFacingSourceFreshnessReleaseReady
    && learnerFacingQuoteBackedSourcesReleaseBlocked === 0
    && staleLearnerFacingQuoteBackedSources === 0
    && quoteCoverageDepthReleaseReady
    && quoteCoverageDepthTopicsMeetingCoreFacetDepth === highRiskTopics.length
    && quoteCoverageDepthMissingTopicFacetPairs === 0
    && quoteCoverageDepthGeneratedNeedsReviewChunks === 0
    && highRiskClassificationPolicyReady
    && highRiskClassificationTopicCount === highRiskTopics.length
    && highRiskClassificationTopicsWithAlias === highRiskClassificationTopicCount
    && highRiskClassificationTopicAliasProbesPassed === highRiskClassificationTopicAliasProbes
    && highRiskClassificationRetrievalMatrixRowsPassed === highRiskClassificationRetrievalMatrixRows
    && highRiskClassificationCaseRowsClassified === cases.length
    && highRiskClassificationClaimSetsClassified === claimReviewQueue.length
    && highRiskClassificationNegativeControlsNonclinical === highRiskClassificationNegativeControls
    && highRiskClassificationFallbackOnlyProbes === 0
    && highRiskClassificationGeneratedApproved === 0
    && claimReferenceAlignmentReleaseReady
    && claimReferenceAlignmentClaimSets === claimReviewQueue.length
    && claimReferenceAlignmentMeetingThreshold === claimReferenceAlignmentClaimSets
    && claimReferenceAlignmentMissingDomainSpecificSupport === 0
    && claimReferenceAlignmentDomainSpecificReleaseReady
    && claimReferenceGapPacketsPresent
    && claimReferenceGapPacketsTotal === 0
    && claimReferenceGapPacketsPending === 0
    && claimReferenceAlignmentGeneratedReferences === 0
    && clinicianLibrarianReviewedGeneratedChunks >= generatedNeedsReviewChunks.length
    && evidenceAdjudicationApprovedChunks >= activeReviewedChunks.length
    && claimEntailmentPacketReportPresent
    && claimEntailmentAdjudicationStatusPresent
    && claimEntailmentInvalidReviewInputCount === 0
    && claimEntailmentReadyForNationalRelease
    && validatedClaimReviews >= claimReviewQueue.length
);

const report = {
  schema_version: 'learner_facing_evidence_coverage_report_v1',
  generated_at: new Date().toISOString(),
  review_status: 'learner_facing_quote_backed_subset_available_claim_review_required',
  evidence_policy_version: LEARNER_FACING_OPEN_EVIDENCE_POLICY_VERSION,
  warning: 'This report measures quote-backed coverage and runtime quarantine policy. It does not prove clinical truth, guideline currency, claim-level entailment, or faculty acceptance for national learner feedback.',
  source_contract: {
    public_knowledge_bundle_schema: knowledgeBundle.schema_version,
    public_source_quality_report_schema: qualityReport.schema_version,
    learner_facing_generated_needs_review_allowed: false,
    learner_facing_minimum_source_standard: 'reviewed_active_quote_backed_chunk_with_human_or_local_extracted_verification',
    open_evidence_retrieval_runtime_report_present: Boolean(openEvidenceRetrievalRuntimeReport),
    open_evidence_retrieval_runtime_report_path: 'docs/open_evidence_retrieval_runtime_report.json',
    source_freshness_report_present: Boolean(sourceFreshnessReport),
    source_freshness_report_path: 'docs/source_freshness_report.json',
    high_risk_quote_coverage_depth_report_present: Boolean(highRiskQuoteCoverageDepthReport),
    high_risk_quote_coverage_depth_report_path: 'docs/high_risk_quote_coverage_depth_report.json',
    high_risk_clinical_classification_report_present: Boolean(highRiskClinicalClassificationReport),
    high_risk_clinical_classification_report_path: 'docs/high_risk_clinical_classification_report.json',
    claim_reference_alignment_report_present: Boolean(claimReferenceAlignmentReport),
    claim_reference_alignment_report_path: 'docs/feedback_claim_reference_alignment_report.json',
    claim_reference_gap_review_packets_present: claimReferenceGapPacketsPresent,
    claim_reference_gap_review_packets_path: 'docs/claim_reference_gap_review_packets.json',
    claim_entailment_review_packet_file_present: claimEntailmentPacketReportPresent,
    claim_entailment_review_packet_file_path: 'docs/feedback_claim_entailment_review_packets.json',
    claim_entailment_adjudication_status_file_present: claimEntailmentAdjudicationStatusPresent,
    claim_entailment_adjudication_status_file_path: 'docs/feedback_claim_entailment_adjudication_status.json',
    claim_entailment_review_file_present: existsSync(CLAIM_ENTAILMENT_REVIEWS_PATH),
    claim_entailment_review_file_path: 'docs/learner_facing_claim_entailment_reviews.json'
  },
  summary: {
    total_sources: knowledgeBundle.sources?.length || 0,
    total_chunks: knowledgeBundle.chunks?.length || 0,
    active_reviewed_chunks: activeReviewedChunks.length,
    quote_backed_chunks: qualityReport.quote_backed_count || 0,
    learner_facing_eligible_quote_backed_chunks: eligibleQuoteBackedChunks.length,
    learner_facing_eligible_percentage: toPercent(eligibleQuoteBackedChunks.length, knowledgeBundle.chunks?.length || 0),
    generated_needs_review_chunks: generatedNeedsReviewChunks.length,
    generated_chunks_quarantined_by_default: generatedChunksQuarantined,
    generated_references_returned_by_policy_probes: generatedReferencesReturned,
    runtime_retrieval_all_probes_passed: runtimeRetrievalAllProbesPassed,
    runtime_retrieval_quote_backed_only_default: runtimeRetrievalQuoteBackedOnlyDefault,
    runtime_retrieval_reference_count: runtimeRetrievalReferenceCount,
    runtime_retrieval_generated_needs_review_badges: runtimeRetrievalGeneratedBadges,
    runtime_retrieval_needs_review_badges: runtimeRetrievalNeedsReviewBadges,
    runtime_retrieval_smoke_review_items: runtimeRetrievalSmokeReviewItems,
    runtime_retrieval_quarantine_warning_visible: runtimeRetrievalQuarantineWarningVisible,
    runtime_retrieval_quality_badge_visible: runtimeRetrievalQualityBadgeVisible,
    runtime_high_risk_retrieval_quality_threshold_passed:
      runtimeHighRiskRetrievalQualityThresholdPassed,
    runtime_high_risk_retrieval_quality_top_base_score:
      runtimeHighRiskRetrievalQualityTopBaseScore,
    runtime_high_risk_retrieval_quality_minimum_base_score:
      runtimeHighRiskRetrievalQualityMinimumBaseScore,
    runtime_bm25_fallback_badge_visible: runtimeBm25FallbackBadgeVisible,
    runtime_retrieval_nonclinical_scope_guardrail_warning_visible:
      runtimeRetrievalNonclinicalScopeGuardrailWarningVisible,
    runtime_retrieval_nonclinical_scope_guardrail_reference_count:
      runtimeRetrievalNonclinicalScopeGuardrailReferenceCount,
    source_freshness_report_present: Boolean(sourceFreshnessReport),
    learner_facing_source_freshness_release_ready: learnerFacingSourceFreshnessReleaseReady,
    learner_facing_quote_backed_sources_release_blocked: learnerFacingQuoteBackedSourcesReleaseBlocked,
    stale_learner_facing_quote_backed_sources: staleLearnerFacingQuoteBackedSources,
    missing_local_review_date_sources: missingLocalReviewDateSources,
    high_risk_quote_coverage_depth_report_present: Boolean(highRiskQuoteCoverageDepthReport),
    high_risk_quote_coverage_depth_release_ready: quoteCoverageDepthReleaseReady,
    high_risk_quote_coverage_depth_topics_meeting_core_facet_depth:
      quoteCoverageDepthTopicsMeetingCoreFacetDepth,
    high_risk_quote_coverage_depth_missing_topic_facet_pairs:
      quoteCoverageDepthMissingTopicFacetPairs,
    high_risk_quote_coverage_depth_generated_needs_review_chunks:
      quoteCoverageDepthGeneratedNeedsReviewChunks,
    high_risk_clinical_classification_report_present: Boolean(highRiskClinicalClassificationReport),
    high_risk_clinical_classification_policy_ready: highRiskClassificationPolicyReady,
    high_risk_clinical_classification_topic_count: highRiskClassificationTopicCount,
    high_risk_clinical_classification_topics_with_alias_policy: highRiskClassificationTopicsWithAlias,
    high_risk_clinical_classification_topic_alias_probes: highRiskClassificationTopicAliasProbes,
    high_risk_clinical_classification_topic_alias_probes_passed:
      highRiskClassificationTopicAliasProbesPassed,
    high_risk_clinical_classification_retrieval_matrix_rows:
      highRiskClassificationRetrievalMatrixRows,
    high_risk_clinical_classification_retrieval_matrix_rows_passed:
      highRiskClassificationRetrievalMatrixRowsPassed,
    high_risk_clinical_classification_case_rows_classified:
      highRiskClassificationCaseRowsClassified,
    high_risk_clinical_classification_current_case_count: cases.length,
    high_risk_clinical_classification_claim_sets_classified:
      highRiskClassificationClaimSetsClassified,
    high_risk_clinical_classification_negative_controls_classified_nonclinical:
      highRiskClassificationNegativeControlsNonclinical,
    high_risk_clinical_classification_negative_control_probes:
      highRiskClassificationNegativeControls,
    high_risk_clinical_classification_regex_fallback_only_high_risk_probes:
      highRiskClassificationFallbackOnlyProbes,
    high_risk_clinical_classification_generated_needs_review_approved:
      highRiskClassificationGeneratedApproved,
    claim_reference_alignment_report_present: Boolean(claimReferenceAlignmentReport),
    claim_reference_alignment_claim_sets: claimReferenceAlignmentClaimSets,
    claim_reference_alignment_claim_sets_meeting_threshold: claimReferenceAlignmentMeetingThreshold,
    claim_reference_alignment_claim_sets_requiring_domain_specific_support:
      claimReferenceAlignmentRequiringDomainSpecificSupport,
    claim_reference_alignment_claim_sets_with_domain_specific_support:
      claimReferenceAlignmentWithDomainSpecificSupport,
    claim_reference_alignment_claim_sets_missing_domain_specific_support:
      claimReferenceAlignmentMissingDomainSpecificSupport,
    claim_reference_alignment_domain_specific_release_ready:
      claimReferenceAlignmentDomainSpecificReleaseReady,
    claim_reference_gap_packets_present: claimReferenceGapPacketsPresent,
    claim_reference_gap_packets_total: claimReferenceGapPacketsTotal,
    claim_reference_gap_packets_pending: claimReferenceGapPacketsPending,
    claim_reference_gap_packets_generated_candidates: claimReferenceGapPacketsGeneratedCandidates,
    claim_reference_gap_packets_all_domain_specific_gaps_packeted:
      claimReferenceGapPacketsAllDomainSpecificGapsPacketed,
    claim_reference_alignment_generated_needs_review_references: claimReferenceAlignmentGeneratedReferences,
    claim_reference_alignment_source_limited_claim_sets_blocked: claimReferenceAlignmentSourceLimitedBlocked,
    claim_reference_alignment_release_ready: claimReferenceAlignmentReleaseReady,
    high_risk_topic_count: highRiskTopics.length,
    high_risk_topics_with_quote_backed_coverage: highRiskTopicCoverage
      .filter((entry) => entry.quote_backed_chunk_count > 0)
      .length,
    high_risk_topics_without_quote_backed_coverage: highRiskTopicsWithoutQuoteCoverage.length,
    feedback_domains_total: feedbackTraceabilityMatrix?.summary?.domains_tracked || 0,
    feedback_case_domain_rows: feedbackTraceabilityMatrix?.summary?.total_case_domain_rows || 0,
    source_limited_formative_feedback_rows: feedbackTraceabilityMatrix?.summary?.source_limited_formative_rows || 0,
    numeric_feedback_rows_missing_required_case_evidence:
      feedbackTraceabilityMatrix?.summary?.numeric_rows_missing_required_case_evidence ?? null,
    claim_entailment_packet_report_present: claimEntailmentPacketReportPresent,
    claim_entailment_packet_status: claimReviewPacketReport?.review_status || 'missing',
    claim_entailment_packet_count: claimReviewPacketReport?.summary?.total_claim_sets || 0,
    claim_entailment_packet_ready_for_national_release:
      Boolean(claimReviewPacketReport?.summary?.ready_for_national_feedback_release),
    claim_entailment_adjudication_status_present: claimEntailmentAdjudicationStatusPresent,
    claim_entailment_adjudication_status: claimEntailmentAdjudicationStatus?.review_status || 'missing',
    claim_entailment_validated_reviews: validatedClaimReviews,
    claim_entailment_invalid_review_input_count: claimEntailmentInvalidReviewInputCount,
    claim_entailment_adjudication_ready_for_national_release: claimEntailmentReadyForNationalRelease,
    claim_entailment_required_claim_sets: claimReviewQueue.length,
    claim_entailment_reviewed_claims: validatedClaimReviews,
    clinician_librarian_reviewed_generated_chunks: clinicianLibrarianReviewedGeneratedChunks,
    evidence_adjudication_approved_chunks: evidenceAdjudicationApprovedChunks,
    learner_facing_evidence_release_ready: learnerFacingEvidenceReleaseReady
  },
  high_risk_topic_coverage: highRiskTopicCoverage,
  eligible_quote_backed_chunk_summary: {
    by_facet: countBy(eligibleQuoteBackedChunks, (chunk) => chunk.facet_id),
    by_source_tier: countBy(eligibleQuoteBackedChunks, (chunk) => chunk.source_tier),
    by_source_id: countBy(eligibleQuoteBackedChunks, (chunk) => chunk.source_id),
    representative_chunks: eligibleQuoteBackedChunks
      .slice(0, 50)
      .map((chunk) => sourceSummaryForChunk(chunk, sourceById))
  },
  generated_chunk_quarantine_summary: {
    learner_facing_use_allowed: false,
    generated_needs_review_chunks: generatedNeedsReviewChunks.length,
    generated_needs_review_by_facet: countBy(generatedNeedsReviewChunks, (chunk) => chunk.facet_id),
    generated_needs_review_by_source_tier: countBy(generatedNeedsReviewChunks, (chunk) => chunk.source_tier),
    representative_generated_chunk_ids: generatedNeedsReviewChunks.slice(0, 25).map((chunk) => chunk.id)
  },
  feedback_claim_review_queue: claimReviewQueue,
  release_blockers: [
    {
      id: 'runtime_retrieval_not_locked',
      status: runtimeRetrievalAllProbesPassed
        && runtimeRetrievalQuoteBackedOnlyDefault
        && runtimeRetrievalReferenceCount > 0
        && runtimeRetrievalGeneratedBadges === 0
        && runtimeRetrievalNeedsReviewBadges === 0
        && runtimeRetrievalSmokeReviewItems === 0
        && runtimeRetrievalQuarantineWarningVisible
        && runtimeRetrievalNonclinicalScopeGuardrailWarningVisible
        && runtimeRetrievalNonclinicalScopeGuardrailReferenceCount === 0
        ? 'cleared'
        : 'blocked',
      evidence: {
        runtime_retrieval_all_probes_passed: runtimeRetrievalAllProbesPassed,
        runtime_retrieval_quote_backed_only_default: runtimeRetrievalQuoteBackedOnlyDefault,
        runtime_retrieval_reference_count: runtimeRetrievalReferenceCount,
        runtime_retrieval_generated_needs_review_badges: runtimeRetrievalGeneratedBadges,
        runtime_retrieval_needs_review_badges: runtimeRetrievalNeedsReviewBadges,
        runtime_retrieval_smoke_review_items: runtimeRetrievalSmokeReviewItems,
        runtime_retrieval_quarantine_warning_visible: runtimeRetrievalQuarantineWarningVisible,
        runtime_retrieval_quality_badge_visible: runtimeRetrievalQualityBadgeVisible,
        runtime_high_risk_retrieval_quality_threshold_passed:
          runtimeHighRiskRetrievalQualityThresholdPassed,
        runtime_high_risk_retrieval_quality_top_base_score:
          runtimeHighRiskRetrievalQualityTopBaseScore,
        runtime_high_risk_retrieval_quality_minimum_base_score:
          runtimeHighRiskRetrievalQualityMinimumBaseScore,
        runtime_bm25_fallback_badge_visible: runtimeBm25FallbackBadgeVisible,
        runtime_retrieval_nonclinical_scope_guardrail_warning_visible:
          runtimeRetrievalNonclinicalScopeGuardrailWarningVisible,
        runtime_retrieval_nonclinical_scope_guardrail_reference_count:
          runtimeRetrievalNonclinicalScopeGuardrailReferenceCount
      },
      required_to_clear: 'Keep docs/open_evidence_retrieval_runtime_report.json passing so the built app proves quote-backed-only learner-facing retrieval.'
    },
    {
      id: 'high_risk_retrieval_quality_badge_not_ready',
      status: runtimeRetrievalQualityBadgeVisible
        && runtimeHighRiskRetrievalQualityThresholdPassed
        && runtimeHighRiskRetrievalQualityMinimumBaseScore >= 0.08
        && runtimeHighRiskRetrievalQualityTopBaseScore >= runtimeHighRiskRetrievalQualityMinimumBaseScore
        && runtimeBm25FallbackBadgeVisible
        ? 'cleared'
        : 'blocked',
      evidence: {
        runtime_retrieval_quality_badge_visible: runtimeRetrievalQualityBadgeVisible,
        runtime_high_risk_retrieval_quality_threshold_passed:
          runtimeHighRiskRetrievalQualityThresholdPassed,
        runtime_high_risk_retrieval_quality_top_base_score:
          runtimeHighRiskRetrievalQualityTopBaseScore,
        runtime_high_risk_retrieval_quality_minimum_base_score:
          runtimeHighRiskRetrievalQualityMinimumBaseScore,
        runtime_bm25_fallback_badge_visible: runtimeBm25FallbackBadgeVisible
      },
      required_to_clear: 'Keep the built grounding lab showing the high-risk retrieval quality badge, BM25 fallback state, and minimum score threshold before learner-facing use.'
    },
    {
      id: 'source_freshness_not_ready',
      status: learnerFacingSourceFreshnessReleaseReady
        && learnerFacingQuoteBackedSourcesReleaseBlocked === 0
        && staleLearnerFacingQuoteBackedSources === 0
        ? 'cleared'
        : 'blocked',
      evidence: {
        source_freshness_report_present: Boolean(sourceFreshnessReport),
        learner_facing_source_freshness_release_ready: learnerFacingSourceFreshnessReleaseReady,
        learner_facing_quote_backed_sources_release_blocked: learnerFacingQuoteBackedSourcesReleaseBlocked,
        stale_learner_facing_quote_backed_sources: staleLearnerFacingQuoteBackedSources,
        missing_local_review_date_sources: missingLocalReviewDateSources
      },
      required_to_clear: 'Use docs/source_freshness_report.json to replace stale learner-facing sources and record local review dates before national release.'
    },
    {
      id: 'high_risk_quote_depth_not_ready',
      status: quoteCoverageDepthReleaseReady
        && quoteCoverageDepthTopicsMeetingCoreFacetDepth === highRiskTopics.length
        && quoteCoverageDepthMissingTopicFacetPairs === 0
        && quoteCoverageDepthGeneratedNeedsReviewChunks === 0
        ? 'cleared'
        : 'blocked',
      evidence: {
        high_risk_quote_coverage_depth_report_present: Boolean(highRiskQuoteCoverageDepthReport),
        high_risk_topic_count: highRiskTopics.length,
        high_risk_quote_coverage_depth_release_ready: quoteCoverageDepthReleaseReady,
        high_risk_quote_coverage_depth_topics_meeting_core_facet_depth:
          quoteCoverageDepthTopicsMeetingCoreFacetDepth,
        high_risk_quote_coverage_depth_missing_topic_facet_pairs:
          quoteCoverageDepthMissingTopicFacetPairs,
        high_risk_quote_coverage_depth_generated_needs_review_chunks:
          quoteCoverageDepthGeneratedNeedsReviewChunks
      },
      required_to_clear: 'Use docs/high_risk_quote_coverage_depth_report.json to fill missing high-risk topic/facet quote-backed evidence before national learner feedback.'
    },
    {
      id: 'high_risk_classification_policy_not_ready',
      status: highRiskClassificationPolicyReady
        && highRiskClassificationTopicCount === highRiskTopics.length
        && highRiskClassificationTopicsWithAlias === highRiskClassificationTopicCount
        && highRiskClassificationTopicAliasProbesPassed === highRiskClassificationTopicAliasProbes
        && highRiskClassificationRetrievalMatrixRowsPassed === highRiskClassificationRetrievalMatrixRows
        && highRiskClassificationCaseRowsClassified === cases.length
        && highRiskClassificationClaimSetsClassified === claimReviewQueue.length
        && highRiskClassificationNegativeControlsNonclinical === highRiskClassificationNegativeControls
        && highRiskClassificationFallbackOnlyProbes === 0
        && highRiskClassificationGeneratedApproved === 0
        ? 'cleared'
        : 'blocked',
      evidence: {
        high_risk_clinical_classification_report_present: Boolean(highRiskClinicalClassificationReport),
        high_risk_clinical_classification_policy_ready: highRiskClassificationPolicyReady,
        high_risk_clinical_classification_topic_count: highRiskClassificationTopicCount,
        high_risk_clinical_classification_topics_with_alias_policy: highRiskClassificationTopicsWithAlias,
        high_risk_clinical_classification_topic_alias_probes:
          highRiskClassificationTopicAliasProbes,
        high_risk_clinical_classification_topic_alias_probes_passed:
          highRiskClassificationTopicAliasProbesPassed,
        high_risk_clinical_classification_retrieval_matrix_rows:
          highRiskClassificationRetrievalMatrixRows,
        high_risk_clinical_classification_retrieval_matrix_rows_passed:
          highRiskClassificationRetrievalMatrixRowsPassed,
        high_risk_clinical_classification_case_rows_classified:
          highRiskClassificationCaseRowsClassified,
        high_risk_clinical_classification_current_case_count: cases.length,
        high_risk_clinical_classification_claim_sets_classified:
          highRiskClassificationClaimSetsClassified,
        high_risk_clinical_classification_negative_controls_classified_nonclinical:
          highRiskClassificationNegativeControlsNonclinical,
        high_risk_clinical_classification_regex_fallback_only_high_risk_probes:
          highRiskClassificationFallbackOnlyProbes,
        high_risk_clinical_classification_generated_needs_review_approved:
          highRiskClassificationGeneratedApproved
      },
      required_to_clear: 'Use docs/high_risk_clinical_classification_report.json to keep high-risk routing topic/facet-based across cases, actions, claims, and negative controls.'
    },
    {
      id: 'claim_reference_alignment_not_ready',
      status: claimReferenceAlignmentReleaseReady
        && claimReferenceAlignmentClaimSets === claimReviewQueue.length
        && claimReferenceAlignmentMeetingThreshold === claimReferenceAlignmentClaimSets
        && claimReferenceAlignmentMissingDomainSpecificSupport === 0
        && claimReferenceAlignmentDomainSpecificReleaseReady
        && claimReferenceAlignmentGeneratedReferences === 0
        ? 'cleared'
        : 'blocked',
      evidence: {
        claim_reference_alignment_report_present: Boolean(claimReferenceAlignmentReport),
        claim_reference_alignment_claim_sets: claimReferenceAlignmentClaimSets,
        claim_reference_alignment_claim_sets_meeting_threshold: claimReferenceAlignmentMeetingThreshold,
        claim_reference_alignment_claim_sets_requiring_domain_specific_support:
          claimReferenceAlignmentRequiringDomainSpecificSupport,
        claim_reference_alignment_claim_sets_with_domain_specific_support:
          claimReferenceAlignmentWithDomainSpecificSupport,
        claim_reference_alignment_claim_sets_missing_domain_specific_support:
          claimReferenceAlignmentMissingDomainSpecificSupport,
        claim_reference_alignment_domain_specific_release_ready:
          claimReferenceAlignmentDomainSpecificReleaseReady,
        claim_reference_gap_packets_present: claimReferenceGapPacketsPresent,
        claim_reference_gap_packets_total: claimReferenceGapPacketsTotal,
        claim_reference_gap_packets_pending: claimReferenceGapPacketsPending,
        claim_reference_gap_packets_generated_candidates: claimReferenceGapPacketsGeneratedCandidates,
        claim_reference_gap_packets_all_domain_specific_gaps_packeted:
          claimReferenceGapPacketsAllDomainSpecificGapsPacketed,
        claim_reference_alignment_generated_needs_review_references: claimReferenceAlignmentGeneratedReferences,
        claim_reference_alignment_source_limited_claim_sets_blocked: claimReferenceAlignmentSourceLimitedBlocked,
        claim_reference_alignment_release_ready: claimReferenceAlignmentReleaseReady
      },
      required_to_clear: 'Use docs/feedback_claim_reference_alignment_report.json as reviewer input, then complete expert claim-entailment reviews before national feedback release.'
    },
    {
      id: 'claim_reference_gap_packets_not_clear',
      status: claimReferenceGapPacketsPresent
        && claimReferenceGapPacketsTotal === 0
        && claimReferenceGapPacketsPending === 0
        ? 'cleared'
        : 'blocked',
      evidence: {
        claim_reference_gap_packets_present: claimReferenceGapPacketsPresent,
        claim_reference_gap_packets_total: claimReferenceGapPacketsTotal,
        claim_reference_gap_packets_pending: claimReferenceGapPacketsPending,
        claim_reference_gap_packets_generated_candidates: claimReferenceGapPacketsGeneratedCandidates,
        claim_reference_gap_packets_all_domain_specific_gaps_packeted:
          claimReferenceGapPacketsAllDomainSpecificGapsPacketed
      },
      required_to_clear: 'Use docs/claim_reference_gap_review_packets.json to close named-standard evidence gaps before learner-facing national feedback release.'
    },
    {
      id: 'generated_backlog_unreviewed',
      status: generatedNeedsReviewChunks.length === 0 ? 'cleared' : 'blocked',
      evidence: {
        generated_needs_review_chunks: generatedNeedsReviewChunks.length,
        generated_chunks_quarantined_by_default: generatedChunksQuarantined,
        generated_references_returned_by_policy_probes: generatedReferencesReturned
      },
      required_to_clear: 'Replace, remove, or formally approve generated-needs-review chunks before they can become learner-facing source material.'
    },
    {
      id: 'claim_entailment_not_reviewed',
      status: claimEntailmentReadyForNationalRelease && validatedClaimReviews >= claimReviewQueue.length && claimReviewQueue.length > 0 ? 'cleared' : 'blocked',
      evidence: {
        claim_entailment_packet_report_present: claimEntailmentPacketReportPresent,
        claim_entailment_packet_count: claimReviewPacketReport?.summary?.total_claim_sets || 0,
        claim_entailment_adjudication_status_present: claimEntailmentAdjudicationStatusPresent,
        claim_entailment_adjudication_status: claimEntailmentAdjudicationStatus?.review_status || 'missing',
        claim_entailment_invalid_review_input_count: claimEntailmentInvalidReviewInputCount,
        claim_entailment_required_claim_sets: claimReviewQueue.length,
        claim_entailment_reviewed_claims: validatedClaimReviews
      },
      required_to_clear: 'Use docs/feedback_claim_entailment_review_packets.json, then record valid clinician and educator reviews in docs/learner_facing_claim_entailment_reviews.json and keep docs/feedback_claim_entailment_adjudication_status.json valid.'
    },
    {
      id: 'evidence_adjudication_not_complete',
      status: evidenceAdjudicationApprovedChunks >= activeReviewedChunks.length ? 'cleared' : 'blocked',
      evidence: {
        active_reviewed_chunks: activeReviewedChunks.length,
        evidence_adjudication_approved_chunks: evidenceAdjudicationApprovedChunks
      },
      required_to_clear: 'Record evidence chunk approvals in docs/evidence_chunk_adjudications.json using the clinical adjudication contract.'
    }
  ],
  next_actions: [
    'Keep runtime policy probes passing so generated-needs-review chunks stay quarantined from learner-facing retrieval.',
    'Keep browser-runtime retrieval probes passing so the built app renders quote-backed references and zero generated-needs-review badges.',
    'Use the high-risk topic coverage table to preserve quote-backed support for each high-risk domain while replacing generated background chunks.',
    'Use docs/feedback_claim_entailment_review_packets.json to assign reviewer work, then create docs/learner_facing_claim_entailment_reviews.json and review every feedback claim set against case truth, quote-backed open evidence, or a clinician-approved local standard.',
    'Record source-review approvals in docs/evidence_chunk_adjudications.json before promoting any generated-needs-review chunk.',
    'Keep source-limited diagnosis, consult, and reassessment feedback formative until case truth adjudication is complete.'
  ]
};

function toMarkdown(data) {
  const lines = [
    '# Learner-Facing Evidence Coverage Report',
    '',
    `Generated: ${data.generated_at}`,
    '',
    data.warning,
    '',
    '## Summary',
    '',
    `- Eligible quote-backed chunks: ${data.summary.learner_facing_eligible_quote_backed_chunks}/${data.summary.total_chunks} (${data.summary.learner_facing_eligible_percentage}%)`,
    `- Generated-needs-review chunks quarantined: ${data.summary.generated_needs_review_chunks}`,
    `- Generated references returned by policy probes: ${data.summary.generated_references_returned_by_policy_probes}`,
    `- Runtime retrieval probes passed: ${data.summary.runtime_retrieval_all_probes_passed}`,
    `- Runtime generated-needs-review badges: ${data.summary.runtime_retrieval_generated_needs_review_badges}`,
    `- Runtime nonclinical scope guardrail references: ${data.summary.runtime_retrieval_nonclinical_scope_guardrail_reference_count}`,
    `- Runtime retrieval quality badge visible: ${data.summary.runtime_retrieval_quality_badge_visible}`,
    `- Runtime high-risk retrieval threshold passed: ${data.summary.runtime_high_risk_retrieval_quality_threshold_passed}`,
    `- Runtime BM25 fallback badge visible: ${data.summary.runtime_bm25_fallback_badge_visible}`,
    `- Learner-facing source freshness release ready: ${data.summary.learner_facing_source_freshness_release_ready}`,
    `- Learner-facing quote-backed sources release-blocked: ${data.summary.learner_facing_quote_backed_sources_release_blocked}`,
    `- High-risk quote-depth release ready: ${data.summary.high_risk_quote_coverage_depth_release_ready}`,
    `- Missing high-risk topic/facet quote pairs: ${data.summary.high_risk_quote_coverage_depth_missing_topic_facet_pairs}`,
    `- High-risk classification policy ready: ${data.summary.high_risk_clinical_classification_policy_ready}`,
    `- High-risk classification fallback-only probes: ${data.summary.high_risk_clinical_classification_regex_fallback_only_high_risk_probes}`,
    `- Claim sets meeting reference-alignment threshold: ${data.summary.claim_reference_alignment_claim_sets_meeting_threshold}/${data.summary.claim_reference_alignment_claim_sets}`,
    `- Claim sets missing domain-specific quote support: ${data.summary.claim_reference_alignment_claim_sets_missing_domain_specific_support}/${data.summary.claim_reference_alignment_claim_sets_requiring_domain_specific_support}`,
    `- Claim-reference gap packets pending: ${data.summary.claim_reference_gap_packets_pending}/${data.summary.claim_reference_gap_packets_total}`,
    `- Claim-reference alignment release ready: ${data.summary.claim_reference_alignment_release_ready}`,
    `- High-risk topics with quote-backed coverage: ${data.summary.high_risk_topics_with_quote_backed_coverage}/${data.summary.high_risk_topic_count}`,
    `- Source-limited formative feedback rows: ${data.summary.source_limited_formative_feedback_rows}`,
    `- Claim-entailment packet report present: ${data.summary.claim_entailment_packet_report_present}`,
    `- Claim-entailment adjudication status: ${data.summary.claim_entailment_adjudication_status}`,
    `- Claim-entailment reviewed claims: ${data.summary.claim_entailment_reviewed_claims}/${data.summary.claim_entailment_required_claim_sets}`,
    `- Learner-facing evidence release ready: ${data.summary.learner_facing_evidence_release_ready}`,
    '',
    '## High-Risk Topic Coverage',
    '',
    '| Topic | Status | Quote-backed chunks | Generated-needs-review chunks |',
    '|---|---|---:|---:|',
    ...data.high_risk_topic_coverage.map((topic) =>
      `| ${topic.topic} | ${topic.learner_facing_status} | ${topic.quote_backed_chunk_count} | ${topic.generated_needs_review_chunk_count} |`
    ),
    '',
    '## Release Blockers',
    '',
    '| Blocker | Status | Required to clear |',
    '|---|---|---|',
    ...data.release_blockers.map((blocker) =>
      `| ${blocker.id} | ${blocker.status} | ${blocker.required_to_clear} |`
    ),
    '',
    '## Feedback Claim Review Queue',
    '',
    '| Domain | Scoring mode | Source-limited cases | Review need |',
    '|---|---|---:|---|',
    ...data.feedback_claim_review_queue.map((domain) =>
      `| ${domain.label} | ${domain.scoring_mode} | ${domain.source_limited_formative_cases} | ${domain.review_need} |`
    )
  ];
  return `${lines.join('\n')}\n`;
}

writeFileSync(JSON_OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
writeFileSync(MD_OUTPUT_PATH, toMarkdown(report), 'utf8');

console.log(`Learner-facing evidence coverage: ${report.summary.learner_facing_eligible_quote_backed_chunks}/${report.summary.total_chunks} chunks eligible.`);
console.log(`Coverage report written to ${JSON_OUTPUT_PATH}`);
