import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CASES_PATH = join(ROOT, 'frontend', 'src', 'data', 'cases.json');
const CASE_TRUTH_PACKETS_PATH = join(ROOT, 'docs', 'case_truth_review_packets.json');
const CLINICAL_ADJUDICATION_STATUS_PATH = join(ROOT, 'docs', 'clinical_review_adjudication_status.json');
const JSON_OUTPUT_PATH = join(ROOT, 'docs', 'case_generation_quality_report.json');
const MD_OUTPUT_PATH = join(ROOT, 'docs', 'case_generation_quality_report.md');

const PUBLIC_CASE_SCHEMA_VERSION = 'public_case_v2';
const NATIONAL_CASE_COUNT_MINIMUM = 100;
const REQUIRED_DOCUMENTED_DOMAINS = [
  'demographics',
  'chief_complaint',
  'triage_narrative',
  'vitals',
  'reference_esi',
  'disposition',
  'adjudication'
];
const REQUIRED_VITAL_FIELDS = ['temp', 'hr', 'rr', 'o2', 'sbp', 'dbp'];
const TRUTH_FIELD_KEYS = [
  'source_record_diagnosis',
  'clinician_approved_referral_or_consult_truth',
  'retrospective_ground_truth',
  'optional_objective_data_truth'
];

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readOptionalJson(path) {
  return existsSync(path) ? readJson(path) : null;
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

function hasAny(value, keys) {
  if (!value || typeof value !== 'object') return false;
  return keys.some((key) => {
    const item = value[key];
    return Array.isArray(item) ? item.length > 0 : Boolean(item);
  });
}

function hasSourceRecordDiagnosis(caseRecord) {
  return hasAny(caseRecord.source, [
    'primary_diagnosis',
    'source_record_diagnosis',
    'diagnosis',
    'diagnoses',
    'icd',
    'icd_code',
    'icd_title'
  ]) || hasAny(caseRecord.ground_truth?.diagnoses, ['primary', 'icd']);
}

function hasClinicianApprovedReferral(caseRecord) {
  return hasAny(caseRecord.source, [
    'clinician_approved_referral',
    'clinician_approved_specialty',
    'consult_reference',
    'referral_reference'
  ]) || hasAny(caseRecord.augmentation, [
    'clinician_approved_referral',
    'clinician_approved_specialty',
    'consult_reference',
    'referral_reference'
  ]) || hasAny(caseRecord.ground_truth?.referral, ['clinician_approved_specialty']);
}

function hasRetrospectiveTruth(caseRecord) {
  return hasAny(caseRecord, ['retrospective_ground_truth'])
    || hasAny(caseRecord.source, ['retrospective_ground_truth', 'linked_context', 'diagnostic_truth']);
}

function hasOptionalObjectiveData(caseRecord) {
  return hasAny(caseRecord, ['optional_objective_data'])
    || hasAny(caseRecord.source, ['optional_objective_data'])
    || hasAny(caseRecord.augmentation, ['optional_objective_data'])
    || hasAny(caseRecord.ground_truth, ['optional_objective_data']);
}

function truthFieldStatus(caseRecord) {
  return {
    source_record_diagnosis: hasSourceRecordDiagnosis(caseRecord),
    clinician_approved_referral_or_consult_truth: hasClinicianApprovedReferral(caseRecord),
    retrospective_ground_truth: hasRetrospectiveTruth(caseRecord),
    optional_objective_data_truth: hasOptionalObjectiveData(caseRecord)
  };
}

function sourceScaffoldIssues(caseRecord) {
  const issues = [];
  const source = caseRecord.source || {};
  const demographics = caseRecord.demographics || {};
  const vitals = caseRecord.vitals || {};
  const domains = new Set((caseRecord.documented_evidence || []).map((item) => item.domain).filter(Boolean));
  const acuity = Number(caseRecord.acuity ?? source.reference_esi);

  if (caseRecord.schema_version !== PUBLIC_CASE_SCHEMA_VERSION) issues.push('invalid_public_case_schema');
  if (!cleanText(caseRecord.id)) issues.push('missing_case_id');
  if (!Number.isFinite(Number(demographics.age ?? source.age))) issues.push('missing_age');
  if (!cleanText(demographics.sex || source.sex)) issues.push('missing_sex');
  if (!cleanText(caseRecord.complaint || source.chief_complaint)) issues.push('missing_chief_complaint');
  if (!cleanText(caseRecord.history || source.triage_narrative)) issues.push('missing_triage_narrative');
  if (!Number.isFinite(acuity) || acuity < 1 || acuity > 5) issues.push('invalid_reference_esi');
  if (!cleanText(caseRecord.disposition || source.disposition)) issues.push('missing_disposition');
  if (!cleanText(source.dataset)) issues.push('missing_source_dataset');
  if (!cleanText(source.public_case_uid)) issues.push('missing_public_case_uid');
  if (!source.resource_signals && !Number.isFinite(Number(caseRecord.resources_used))) issues.push('missing_resource_signals');
  if (!source.interventions && !caseRecord.interventions) issues.push('missing_intervention_flags');
  if (!source.outcomes) issues.push('missing_outcome_flags');
  if (!source.adjudication) issues.push('missing_source_esi_adjudication');
  if (source.adjudication && source.adjudication.final_decision !== 'RETAIN') issues.push('source_adjudication_not_retained');
  if (source.adjudication && Number(source.adjudication.expert_review_count || 0) < 2) issues.push('fewer_than_two_source_esi_reviewers');

  for (const field of REQUIRED_VITAL_FIELDS) {
    if (!Number.isFinite(Number(vitals[field] ?? source.vitals?.[field]))) {
      issues.push(`missing_vital_${field}`);
    }
  }
  for (const domain of REQUIRED_DOCUMENTED_DOMAINS) {
    if (!domains.has(domain)) {
      issues.push(`missing_documented_evidence_${domain}`);
    }
  }

  return [...new Set(issues)];
}

function augmentationIssues(caseRecord) {
  const issues = [];
  const augmentation = caseRecord.augmentation || {};
  const inferredFacts = augmentation.inferred_facts || [];
  if (augmentation.review_status !== 'reviewed') issues.push('augmentation_not_engineering_reviewed');
  if (!cleanText(augmentation.likely_working_diagnosis)) issues.push('missing_likely_working_diagnosis');
  if (!Array.isArray(augmentation.ddx) || augmentation.ddx.length < 2) issues.push('insufficient_differential_diagnoses');
  if (!Array.isArray(augmentation.teaching_points) || augmentation.teaching_points.length < 1) issues.push('missing_teaching_points');
  if (!inferredFacts.length) issues.push('missing_inferred_teaching_facts');
  for (const fact of inferredFacts) {
    if (fact.review_status !== 'reviewed') issues.push('non_reviewed_inferred_teaching_fact');
    if (!Array.isArray(fact.source_anchors) || fact.source_anchors.length === 0) issues.push('inferred_fact_without_source_anchor');
  }
  return [...new Set(issues)];
}

function missingTruthFields(caseRecord) {
  const status = truthFieldStatus(caseRecord);
  return TRUTH_FIELD_KEYS.filter((key) => !status[key]);
}

function simulationStructuringGaps(caseRecord) {
  const coveredDomains = new Set((caseRecord.simulation_reveal_data || []).flatMap((item) => [
    item.domain,
    ...(item.covers_domains || [])
  ].filter(Boolean)));
  return (caseRecord.missing_evidence || [])
    .map((item) => item.domain)
    .filter(Boolean)
    .filter((domain) => !coveredDomains.has(domain));
}

function missingSourceEvidenceDomains(caseRecord) {
  return (caseRecord.missing_evidence || [])
    .map((item) => item.domain)
    .filter(Boolean);
}

function simulationRevealDomains(caseRecord) {
  return [...new Set((caseRecord.simulation_reveal_data || []).flatMap((item) => [
    item.domain,
    ...(item.covers_domains || [])
  ].filter(Boolean)))];
}

function inferredGradingFacts(caseRecord) {
  return (caseRecord.augmentation?.inferred_facts || [])
    .filter((fact) => (fact.use_in || []).includes('grading_reference'))
    .map((fact) => ({
      id: fact.id || '',
      domain: fact.domain || '',
      provenance: fact.provenance || 'reviewed_teaching_inference',
      review_status: fact.review_status || 'missing',
      source_anchor_count: fact.source_anchors?.length || 0
    }));
}

function caseAudit(caseRecord, adjudicationStatus) {
  const sourceIssues = sourceScaffoldIssues(caseRecord);
  const augmentationIssueList = augmentationIssues(caseRecord);
  const missingTruth = missingTruthFields(caseRecord);
  const missingSourceEvidence = missingSourceEvidenceDomains(caseRecord);
  const structuringGaps = simulationStructuringGaps(caseRecord);
  const revealDomains = simulationRevealDomains(caseRecord);
  const gradingFacts = inferredGradingFacts(caseRecord);
  const caseTruthReady = (adjudicationStatus?.case_truth?.ready_case_truth_adjudications || 0) > 0;
  const sourceScaffoldComplete = sourceIssues.length === 0;
  const augmentationScaffoldComplete = augmentationIssueList.length === 0;
  const draftPracticeEligible = sourceScaffoldComplete && augmentationScaffoldComplete;
  const nationalReleaseEligible = draftPracticeEligible
    && missingTruth.length === 0
    && structuringGaps.length === 0
    && gradingFacts.length === 0
    && caseTruthReady;

  return {
    case_id: caseRecord.id,
    public_case_uid: caseRecord.source?.public_case_uid || '',
    acuity: Number(caseRecord.acuity),
    complaint: cleanText(caseRecord.complaint),
    source_scaffold_complete: sourceScaffoldComplete,
    augmentation_scaffold_complete: augmentationScaffoldComplete,
    source_scaffold_issues: sourceIssues,
    augmentation_issues: augmentationIssueList,
    missing_source_evidence_domains: missingSourceEvidence,
    simulation_reveal_domains: revealDomains,
    missing_truth_fields: missingTruth,
    simulation_structuring_gaps: structuringGaps,
    inferred_grading_reference_facts: gradingFacts,
    draft_practice_scaffold_eligible: draftPracticeEligible,
    national_release_eligible: nationalReleaseEligible,
    release_status: nationalReleaseEligible
      ? 'national_release_eligible_after_current_adjudication'
      : draftPracticeEligible
        ? 'draft_practice_scaffold_only_clinician_truth_pending'
        : 'construction_quality_issue_needs_repair'
  };
}

function summarizeCriteria(summary) {
  return [
    {
      id: 'source_record_provenance_complete',
      status: summary.cases_with_source_scaffold_issues === 0 ? 'pass' : 'fail',
      evidence: {
        cases_with_source_scaffold_issues: summary.cases_with_source_scaffold_issues,
        required_schema_version: PUBLIC_CASE_SCHEMA_VERSION
      }
    },
    {
      id: 'reviewed_teaching_augmentation_scaffold',
      status: summary.cases_with_augmentation_issues === 0 ? 'pass' : 'fail',
      evidence: {
        cases_with_augmentation_issues: summary.cases_with_augmentation_issues,
        reviewed_augmentation_cases: summary.reviewed_augmentation_cases,
        inferred_teaching_fact_count: summary.inferred_teaching_fact_count
      }
    },
    {
      id: 'truth_fields_adjudicated_for_national_release',
      status: summary.cases_missing_any_truth_field === 0 && summary.case_truth_adjudication_ready_cases >= summary.total_cases ? 'pass' : 'fail',
      evidence: {
        cases_missing_any_truth_field: summary.cases_missing_any_truth_field,
        missing_truth_field_counts: summary.missing_truth_field_counts,
        case_truth_adjudication_ready_cases: summary.case_truth_adjudication_ready_cases
      }
    },
    {
      id: 'simulation_reveal_data_complete',
      status: summary.cases_with_simulation_structuring_gaps === 0 ? 'pass' : 'fail',
      evidence: {
        cases_with_simulation_structuring_gaps: summary.cases_with_simulation_structuring_gaps,
        simulation_structuring_gap_counts: summary.simulation_structuring_gap_counts
      }
    },
    {
      id: 'national_case_bank_size_and_acuity_coverage',
      status: summary.total_cases >= NATIONAL_CASE_COUNT_MINIMUM && summary.esi_levels_present.length === 5 ? 'pass' : 'fail',
      evidence: {
        total_cases: summary.total_cases,
        national_case_count_minimum: NATIONAL_CASE_COUNT_MINIMUM,
        esi_distribution: summary.esi_distribution,
        esi_levels_present: summary.esi_levels_present
      }
    },
    {
      id: 'augmented_grading_references_adjudicated',
      status: summary.augmented_grading_reference_fact_count === 0 ? 'pass' : 'fail',
      evidence: {
        augmented_grading_reference_fact_count: summary.augmented_grading_reference_fact_count,
        cases_with_augmented_grading_reference_facts: summary.cases_with_augmented_grading_reference_facts
      }
    }
  ];
}

function markdown(report) {
  const lines = [
    '# Case Generation Quality Report',
    '',
    `Generated at: ${report.generated_at}`,
    '',
    `Review status: ${report.review_status}`,
    '',
    'This report separates source-record construction quality from national clinical-release readiness. A case can have a usable draft teaching scaffold and still be blocked for national learner-facing assessment until clinician truth adjudication, simulation reveal data, and faculty calibration are complete.',
    '',
    '## Summary',
    '',
    `- Cases audited: ${report.summary.total_cases}`,
    `- Draft practice scaffold eligible: ${report.summary.draft_practice_scaffold_eligible_cases}`,
    `- National release eligible: ${report.summary.national_release_eligible_cases}`,
    `- Source scaffold issues: ${report.summary.cases_with_source_scaffold_issues}`,
    `- Augmentation issues: ${report.summary.cases_with_augmentation_issues}`,
    `- Cases with missing source evidence limitations: ${report.summary.cases_with_missing_source_evidence}`,
    `- Cases missing any truth field: ${report.summary.cases_missing_any_truth_field}`,
    `- Cases with simulation structuring gaps: ${report.summary.cases_with_simulation_structuring_gaps}`,
    `- Augmented grading-reference facts requiring adjudication: ${report.summary.augmented_grading_reference_fact_count}`,
    '',
    '## Criteria',
    '',
    '| Criterion | Status |',
    '|---|---:|'
  ];

  for (const criterion of report.criteria) {
    lines.push(`| ${criterion.id} | ${criterion.status} |`);
  }

  lines.push(
    '',
    '## Required Next Actions',
    '',
    ...report.next_actions.map((item) => `- ${item}`)
  );

  return `${lines.join('\n')}\n`;
}

const cases = readJson(CASES_PATH);
const truthPackets = readOptionalJson(CASE_TRUTH_PACKETS_PATH);
const adjudicationStatus = readOptionalJson(CLINICAL_ADJUDICATION_STATUS_PATH);
const caseAudits = cases.map((caseRecord) => caseAudit(caseRecord, adjudicationStatus));
const allMissingTruthFields = caseAudits.flatMap((item) => item.missing_truth_fields);
const allMissingSourceEvidence = caseAudits.flatMap((item) => item.missing_source_evidence_domains);
const allStructuringGaps = caseAudits.flatMap((item) => item.simulation_structuring_gaps);
const inferredFacts = cases.flatMap((caseRecord) => caseRecord.augmentation?.inferred_facts || []);
const augmentedGradingReferenceFacts = caseAudits.flatMap((item) => item.inferred_grading_reference_facts.map((fact) => ({
  case_id: item.case_id,
  ...fact
})));
const esiLevelsPresent = [...new Set(cases.map((caseRecord) => Number(caseRecord.acuity)).filter(Number.isFinite))].sort((left, right) => left - right);

const summary = {
  total_cases: cases.length,
  national_case_count_minimum: NATIONAL_CASE_COUNT_MINIMUM,
  case_count_shortfall_for_national_bank: Math.max(0, NATIONAL_CASE_COUNT_MINIMUM - cases.length),
  schema_version_counts: countBy(cases, (caseRecord) => caseRecord.schema_version),
  esi_distribution: countBy(cases, (caseRecord) => `ESI_${caseRecord.acuity}`),
  esi_levels_present: esiLevelsPresent,
  source_adjudication_final_decision_counts: countBy(cases, (caseRecord) => caseRecord.source?.adjudication?.final_decision || 'missing'),
  source_adjudication_expert_review_count_distribution: countBy(cases, (caseRecord) => String(caseRecord.source?.adjudication?.expert_review_count ?? 'missing')),
  reviewed_augmentation_cases: cases.filter((caseRecord) => caseRecord.augmentation?.review_status === 'reviewed').length,
  inferred_teaching_fact_count: inferredFacts.length,
  reviewed_inferred_teaching_fact_count: inferredFacts.filter((fact) => fact.review_status === 'reviewed').length,
  inferred_teaching_facts_without_source_anchors: inferredFacts.filter((fact) => !Array.isArray(fact.source_anchors) || fact.source_anchors.length === 0).length,
  augmented_grading_reference_fact_count: augmentedGradingReferenceFacts.length,
  cases_with_augmented_grading_reference_facts: new Set(augmentedGradingReferenceFacts.map((fact) => fact.case_id)).size,
  cases_with_source_scaffold_issues: caseAudits.filter((item) => item.source_scaffold_issues.length).length,
  cases_with_augmentation_issues: caseAudits.filter((item) => item.augmentation_issues.length).length,
  cases_with_missing_source_evidence: caseAudits.filter((item) => item.missing_source_evidence_domains.length).length,
  missing_source_evidence_counts: countBy(allMissingSourceEvidence, (item) => item),
  cases_missing_any_truth_field: caseAudits.filter((item) => item.missing_truth_fields.length).length,
  missing_truth_field_counts: countBy(allMissingTruthFields, (item) => item),
  cases_with_simulation_structuring_gaps: caseAudits.filter((item) => item.simulation_structuring_gaps.length).length,
  simulation_structuring_gap_counts: countBy(allStructuringGaps, (item) => item),
  truth_review_packets_present: Boolean(truthPackets),
  truth_review_packets: truthPackets?.summary?.total_packets || 0,
  case_truth_adjudication_ready_cases: adjudicationStatus?.case_truth?.ready_case_truth_adjudications || 0,
  draft_practice_scaffold_eligible_cases: caseAudits.filter((item) => item.draft_practice_scaffold_eligible).length,
  national_release_eligible_cases: caseAudits.filter((item) => item.national_release_eligible).length,
  national_release_ready: caseAudits.every((item) => item.national_release_eligible)
    && cases.length >= NATIONAL_CASE_COUNT_MINIMUM
};

const criteria = summarizeCriteria(summary);
const sourceScaffoldClean = summary.cases_with_source_scaffold_issues === 0
  && summary.cases_with_augmentation_issues === 0
  && summary.draft_practice_scaffold_eligible_cases === cases.length;
const reviewStatus = summary.national_release_ready
  ? 'national_case_generation_quality_ready'
  : sourceScaffoldClean
    ? 'source_scaffold_complete_national_truth_review_required'
    : 'case_construction_quality_issues_require_repair';

const report = {
  schema_version: 'case_generation_quality_report_v1',
  generated_at: new Date().toISOString(),
  review_status: reviewStatus,
  warning: 'This report is an engineering and source-structure audit. It does not replace emergency clinician adjudication, curriculum committee review, or learner outcome validation.',
  quality_policy: {
    national_case_count_minimum: NATIONAL_CASE_COUNT_MINIMUM,
    release_rule: 'A public case is national-release eligible only when source scaffolding is complete, teaching augmentation is reviewed, case truth fields are clinician adjudicated, simulation reveal gaps are closed, and augmented grading-reference facts are removed or adjudicated.',
    allowed_current_use: 'Draft formative practice and engineering validation only; not national summative assessment.',
    blocked_current_use: 'National medical-student deployment as reliable clinically adjudicated simulation case bank.'
  },
  summary,
  criteria,
  case_audits: caseAudits,
  augmented_grading_reference_facts: augmentedGradingReferenceFacts,
  next_actions: [
    'Complete clinician case-truth adjudication for diagnosis, consult/referral, reassessment triggers, disposition rationale, and optional objective reveal data.',
    'Close simulation structuring gaps such as focused physical exam, relevant negatives, mechanism, neurovascular status, and imaging/exam-result reveal data before national case release.',
    'Remove augmented grading-reference facts from scoring or record clinician adjudication before using them as assessment anchors.',
    `Expand the case bank from ${cases.length} to at least ${NATIONAL_CASE_COUNT_MINIMUM} clinically reviewed cases with balanced acuity, demographics, and presenting complaints.`,
    'Keep source-record scaffolding and reviewed teaching augmentation separate from medical truth in learner-facing feedback.'
  ]
};

writeFileSync(JSON_OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
writeFileSync(MD_OUTPUT_PATH, markdown(report), 'utf8');

console.log(JSON.stringify({
  review_status: report.review_status,
  total_cases: report.summary.total_cases,
  draft_practice_scaffold_eligible_cases: report.summary.draft_practice_scaffold_eligible_cases,
  national_release_eligible_cases: report.summary.national_release_eligible_cases,
  cases_missing_any_truth_field: report.summary.cases_missing_any_truth_field,
  cases_with_simulation_structuring_gaps: report.summary.cases_with_simulation_structuring_gaps,
  augmented_grading_reference_fact_count: report.summary.augmented_grading_reference_fact_count
}, null, 2));
