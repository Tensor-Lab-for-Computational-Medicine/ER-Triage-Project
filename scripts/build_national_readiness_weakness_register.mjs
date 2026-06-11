import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const AUDIT_PATH = join(ROOT, 'docs', 'open_evidence_feedback_audit.md');
const READINESS_REPORT_PATH = join(ROOT, 'docs', 'national_scale_readiness_report.json');
const RUBRIC_PATH = join(ROOT, 'docs', 'medical_education_validation_rubric.json');
const JSON_OUTPUT_PATH = join(ROOT, 'docs', 'national_readiness_weakness_register.json');
const MD_OUTPUT_PATH = join(ROOT, 'docs', 'national_readiness_weakness_register.md');

function readOptionalJson(path) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
}

function markdownEscape(value) {
  return String(value ?? '').replaceAll('|', '\\|').replace(/\s+/g, ' ').trim();
}

function parseWeaknessRows(markdown) {
  const start = markdown.indexOf('## Weaknesses and Improvement Areas');
  if (start === -1) {
    throw new Error('Could not find weaknesses section in open evidence feedback audit');
  }

  const section = markdown.slice(start);
  const end = section.indexOf('\n## ', 4);
  const tableSection = end === -1 ? section : section.slice(0, end);

  return tableSection
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\|\s*\d+\s*\|/.test(line))
    .map((line) => {
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim());
      const [number, area, weakness, improvement] = cells;
      return {
        source_number: Number(number),
        area,
        weakness,
        improvement
      };
    });
}

function areaGate(area) {
  const normalized = area.toLowerCase();
  if (normalized.includes('evidence') || normalized.includes('retrieval')) return 'open_evidence_grounding';
  if (normalized.includes('feedback') || normalized.includes('scoring')) return 'feedback_integrity';
  if (normalized.includes('case')) return 'case_truth';
  if (normalized.includes('curriculum')) return 'educational_validity';
  if (normalized.includes('virtual patient')) return 'learner_safety';
  if (normalized.includes('governance')) return 'scale_governance_accessibility';
  if (normalized.includes('product')) return 'scale_governance_accessibility';
  return 'all';
}

function areaPriority(area, sourceNumber) {
  const normalized = area.toLowerCase();
  if (
    normalized.includes('evidence')
    || normalized.includes('retrieval')
    || normalized.includes('feedback')
    || normalized.includes('case')
    || sourceNumber <= 20
  ) {
    return 'P0';
  }
  if (
    normalized.includes('scoring')
    || normalized.includes('curriculum')
    || normalized.includes('virtual patient')
    || normalized.includes('governance')
  ) {
    return 'P1';
  }
  return 'P2';
}

function sourceRefsForArea(area) {
  const normalized = area.toLowerCase();
  if (normalized.includes('evidence') || normalized.includes('retrieval')) {
    return ['cheng_mcgregor_2025_ai_simulation', 'jo_2025_llm_virtual_patients'];
  }
  if (normalized.includes('feedback') || normalized.includes('virtual patient')) {
    return ['cheng_mcgregor_2025_ai_simulation', 'jo_2025_llm_virtual_patients'];
  }
  if (normalized.includes('case') || normalized.includes('scoring')) {
    return ['hawks_2023_clinical_reasoning_curricula', 'ivanov_2021_esi_ml'];
  }
  if (normalized.includes('curriculum')) {
    return ['hawks_2023_clinical_reasoning_curricula'];
  }
  if (normalized.includes('governance')) {
    return ['cheng_mcgregor_2025_ai_simulation', 'jo_2025_llm_virtual_patients'];
  }
  return ['codex_goal_guide'];
}

function localProgress(row, report) {
  const feedback = report?.metrics?.feedback_integrity || {};
  const evidence = report?.metrics?.evidence || {};
  const cases = report?.metrics?.cases || {};
  const scale = report?.metrics?.scale_governance_accessibility || {};

  if ([19, 20, 28].includes(row.source_number)) {
    return feedback.feedback_integrity_runtime_all_probes_passed
      ? 'local_runtime_mitigation_verified_manual_review_required'
      : 'open';
  }
  if ([15].includes(row.source_number)) {
    return evidence.open_evidence_retrieval_runtime_all_probes_passed
      && evidence.open_evidence_runtime_generated_needs_review_badges_rendered === 0
      ? 'local_runtime_mitigation_verified_manual_review_required'
      : 'open';
  }
  if ([16].includes(row.source_number)) {
    return feedback.optional_ai_guardrail_runtime_all_probes_passed
      && feedback.optional_ai_guardrail_bad_ai_debrief_blocked
      && feedback.optional_ai_guardrail_bad_ai_support_quality_issue_visible
      && feedback.optional_ai_guardrail_bad_ai_debrief_content_not_rendered
      && feedback.optional_ai_guardrail_deterministic_debrief_preserved
      ? 'local_runtime_mitigation_verified_manual_review_required'
      : 'open';
  }
  if ([8].includes(row.source_number)) {
    return evidence.source_link_quote_verification_report_present
      && evidence.source_link_quote_verification_all_quote_hashes_valid
      && evidence.source_link_quote_verification_all_quote_records_have_locator
      && evidence.source_link_quote_verification_all_quote_records_have_source_url
      && evidence.source_link_quote_verification_quote_records_matched_in_fetched_source > 0
      ? 'local_runtime_mitigation_verified_manual_review_required'
      : 'open';
  }
  if ([7].includes(row.source_number)) {
    return evidence.source_freshness_report_present
      && evidence.source_freshness_total_sources > 0
      && evidence.source_freshness_sources_with_publication_year === evidence.source_freshness_total_sources
      && evidence.source_freshness_learner_facing_quote_backed_sources > 0
      && evidence.source_freshness_review_packets_present
      && evidence.source_freshness_review_packet_count === evidence.source_freshness_learner_facing_quote_backed_sources
      && evidence.source_freshness_review_packets_alignment
      && evidence.source_freshness_adjudication_status_present
      && evidence.source_freshness_adjudication_invalid_review_inputs === 0
      && evidence.source_freshness_adjudication_packets_missing_review === evidence.source_freshness_review_packet_count
      ? 'local_runtime_mitigation_verified_manual_review_required'
      : 'open';
  }
  if ([9].includes(row.source_number)) {
    const quoteDepthAuditedWithOpenGaps = evidence.high_risk_quote_coverage_depth_missing_required_topic_facet_pairs > 0;
    const quoteDepthCompleteButReviewBlocked = evidence.high_risk_quote_coverage_depth_topics_meeting_core_facet_depth === evidence.learner_facing_high_risk_topic_count
      && evidence.high_risk_quote_coverage_depth_missing_required_topic_facet_pairs === 0
      && evidence.high_risk_quote_coverage_depth_generated_needs_review_chunks > 0
      && evidence.high_risk_quote_coverage_depth_release_ready === false;
    return evidence.high_risk_quote_coverage_depth_report_present
      && evidence.high_risk_quote_coverage_depth_topic_count === evidence.learner_facing_high_risk_topic_count
      && evidence.high_risk_quote_coverage_depth_topics_with_any_quote === evidence.learner_facing_high_risk_topics_with_quote_backed_coverage
      && (quoteDepthAuditedWithOpenGaps || quoteDepthCompleteButReviewBlocked)
      ? 'local_runtime_mitigation_verified_manual_review_required'
      : 'open';
  }
  if ([10].includes(row.source_number)) {
    return evidence.evidence_quality_dashboard_present
      && evidence.evidence_quality_dashboard_alignment_checks_passed
      && evidence.evidence_quality_dashboard_quote_backed_chunks === evidence.quote_backed_count
      && evidence.evidence_quality_dashboard_generated_needs_review_chunks === evidence.generated_needs_review_count
      && evidence.evidence_quality_dashboard_high_risk_missing_topic_facet_pairs === evidence.high_risk_quote_coverage_depth_missing_required_topic_facet_pairs
      && evidence.evidence_quality_dashboard_open_release_blockers > 0
      && evidence.evidence_quality_dashboard_release_ready === false
      ? 'local_runtime_mitigation_verified_manual_review_required'
      : 'open';
  }
  if ([11].includes(row.source_number)) {
    return evidence.open_evidence_topic_retrieval_benchmark_present
      && evidence.open_evidence_topic_retrieval_all_probes_passed
      && evidence.open_evidence_topic_retrieval_all_high_risk_topics_represented
      && evidence.open_evidence_topic_retrieval_generated_needs_review_references_returned === 0
      && evidence.open_evidence_topic_retrieval_negative_controls_returning_references === 0
      ? 'local_runtime_mitigation_verified_manual_review_required'
      : 'open';
  }
  if ([12].includes(row.source_number)) {
    return evidence.claim_reference_alignment_report_present
      && evidence.claim_reference_alignment_claim_sets === evidence.learner_facing_claim_entailment_packet_count
      && evidence.claim_reference_alignment_claim_sets_with_candidates === evidence.claim_reference_alignment_claim_sets
      && evidence.claim_reference_alignment_claim_sets_missing_domain_specific_support > 0
      && evidence.claim_reference_alignment_domain_specific_release_ready === false
      && evidence.claim_reference_alignment_generated_needs_review_references_returned === 0
      ? 'local_runtime_gap_detection_mitigation_verified_manual_review_required'
      : 'open';
  }
  if ([13].includes(row.source_number)) {
    return evidence.high_risk_clinical_classification_report_present
      && evidence.high_risk_clinical_classification_policy_ready
      && evidence.high_risk_clinical_classification_topic_count === evidence.learner_facing_high_risk_topic_count
      && evidence.high_risk_clinical_classification_topics_with_alias_policy === evidence.high_risk_clinical_classification_topic_count
      && evidence.high_risk_clinical_classification_topic_alias_probes_passed === evidence.high_risk_clinical_classification_topic_alias_probes
      && evidence.high_risk_clinical_classification_retrieval_matrix_rows_passed === evidence.high_risk_clinical_classification_retrieval_matrix_rows
      && evidence.high_risk_clinical_classification_claim_sets_classified === evidence.learner_facing_claim_entailment_packet_count
      && evidence.high_risk_clinical_classification_negative_controls_classified_nonclinical === evidence.high_risk_clinical_classification_negative_control_probes
      && evidence.high_risk_clinical_classification_regex_fallback_only_high_risk_probes === 0
      && evidence.high_risk_clinical_classification_generated_needs_review_approved === 0
      ? 'local_runtime_mitigation_verified_manual_review_required'
      : 'open';
  }
  if ([14].includes(row.source_number)) {
    return evidence.open_evidence_runtime_retrieval_quality_badge_visible
      && evidence.open_evidence_runtime_high_risk_retrieval_quality_threshold_passed
      && evidence.open_evidence_runtime_high_risk_retrieval_quality_minimum_base_score >= 0.08
      && evidence.open_evidence_runtime_high_risk_retrieval_quality_top_base_score >= evidence.open_evidence_runtime_high_risk_retrieval_quality_minimum_base_score
      && evidence.open_evidence_runtime_bm25_fallback_badge_visible
      ? 'local_runtime_mitigation_verified_manual_review_required'
      : 'open';
  }
  if ([41].includes(row.source_number)) {
    return feedback.source_limited_domain_label_present
      ? 'partial_local_mitigation_manual_review_required'
      : 'open';
  }
  if ([31, 32].includes(row.source_number) && cases.total_cases < 100) {
    return 'open_case_bank_shortfall';
  }
  if ([55, 59].includes(row.source_number) && scale.scale_operations_runtime_all_probes_passed) {
    return 'draft_controls_present_institutional_review_required';
  }
  return 'open';
}

const auditMarkdown = readFileSync(AUDIT_PATH, 'utf8');
const report = readOptionalJson(READINESS_REPORT_PATH);
const rubric = readOptionalJson(RUBRIC_PATH);
const rows = parseWeaknessRows(auditMarkdown);

if (rows.length < 40) {
  throw new Error(`Weakness register requires at least 40 rows; found ${rows.length}`);
}

const weaknesses = rows.map((row) => {
  const gate = areaGate(row.area);
  const status = localProgress(row, report);
  return {
    id: `WR-${String(row.source_number).padStart(3, '0')}`,
    source_audit_row: row.source_number,
    area: row.area,
    priority: areaPriority(row.area, row.source_number),
    readiness_gate: gate,
    current_weakness: row.weakness,
    needed_improvement: row.improvement,
    source_refs: sourceRefsForArea(row.area),
    local_progress_status: status,
    blocks_national_release_without_review: true
  };
});

const statusCounts = weaknesses.reduce((acc, item) => {
  acc[item.local_progress_status] = (acc[item.local_progress_status] || 0) + 1;
  return acc;
}, {});
const gateCounts = weaknesses.reduce((acc, item) => {
  acc[item.readiness_gate] = (acc[item.readiness_gate] || 0) + 1;
  return acc;
}, {});
const priorityCounts = weaknesses.reduce((acc, item) => {
  acc[item.priority] = (acc[item.priority] || 0) + 1;
  return acc;
}, {});

const register = {
  schema_version: 'national_readiness_weakness_register_v1',
  generated_at: new Date().toISOString(),
  review_status: 'weakness_register_open_improvements_prioritized',
  warning: 'This register structures the paper-informed audit into implementation and review work. Local engineering mitigations do not replace clinician, educator, accessibility, privacy, or institutional review.',
  source_contract: {
    source_audit: 'docs/open_evidence_feedback_audit.md',
    source_audit_rows_found: rows.length,
    national_readiness_report_present: Boolean(report),
    national_readiness_verdict: report?.verdict || 'missing',
    medical_education_validation_rubric_present: Boolean(rubric),
    medical_education_validation_criteria: rubric?.summary?.total_criteria || 0
  },
  summary: {
    total_weaknesses: weaknesses.length,
    minimum_required_weaknesses: 40,
    weakness_count_requirement_met: weaknesses.length >= 40,
    blocks_national_release_without_review: weaknesses.filter((item) => item.blocks_national_release_without_review).length,
    local_runtime_mitigations_verified: weaknesses.filter((item) => item.local_progress_status.includes('mitigation_verified')).length,
    status_counts: statusCounts,
    readiness_gate_counts: gateCounts,
    priority_counts: priorityCounts
  },
  weaknesses
};

const md = [
  '# National Readiness Weakness Register',
  '',
  `Generated: ${register.generated_at}`,
  '',
  register.warning,
  '',
  '## Summary',
  '',
  `- Weaknesses tracked: ${register.summary.total_weaknesses}`,
  `- Minimum required: ${register.summary.minimum_required_weaknesses}`,
  `- Requirement met: ${register.summary.weakness_count_requirement_met}`,
  `- Local runtime mitigations verified: ${register.summary.local_runtime_mitigations_verified}`,
  `- National readiness verdict: ${register.source_contract.national_readiness_verdict}`,
  '',
  '## Weaknesses',
  '',
  '| ID | Priority | Gate | Area | Current Weakness | Needed Improvement | Local Progress |',
  '|---|---|---|---|---|---|---|',
  ...weaknesses.map((item) => (
    `| ${item.id} | ${item.priority} | ${item.readiness_gate} | ${markdownEscape(item.area)} | ${markdownEscape(item.current_weakness)} | ${markdownEscape(item.needed_improvement)} | ${item.local_progress_status} |`
  )),
  ''
].join('\n');

writeFileSync(JSON_OUTPUT_PATH, `${JSON.stringify(register, null, 2)}\n`, 'utf8');
writeFileSync(MD_OUTPUT_PATH, md, 'utf8');

console.log(JSON.stringify({
  review_status: register.review_status,
  weaknesses: register.summary.total_weaknesses,
  minimum_required_weaknesses: register.summary.minimum_required_weaknesses,
  local_runtime_mitigations_verified: register.summary.local_runtime_mitigations_verified,
  report_path: JSON_OUTPUT_PATH
}, null, 2));
