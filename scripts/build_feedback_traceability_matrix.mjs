import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CASES_PATH = join(ROOT, 'frontend', 'src', 'data', 'cases.json');
const OBJECTIVE_MATRIX_PATH = join(ROOT, 'docs', 'case_objective_matrix.json');
const CLINICAL_ADJUDICATION_STATUS_PATH = join(ROOT, 'docs', 'clinical_review_adjudication_status.json');
const OUTPUT_JSON_PATH = join(ROOT, 'docs', 'feedback_traceability_matrix.json');
const OUTPUT_MD_PATH = join(ROOT, 'docs', 'feedback_traceability_matrix.md');

const DOMAIN_CONTRACTS = [
  {
    key: 'esi',
    label: 'Final ESI accuracy',
    scoring_mode: 'numeric',
    feedback_basis: 'source_record_esi_and_resource_signals',
    required_case_evidence: ['reference_esi', 'resource_signals', 'vitals'],
    national_review_need: 'Clinician confirmation that the retained reference ESI and source-derived resource signals remain appropriate for learner scoring.'
  },
  {
    key: 'safety',
    label: 'Objective safety reasoning',
    scoring_mode: 'numeric',
    feedback_basis: 'vital_sign_thresholds_and_objective_cues',
    required_case_evidence: ['vitals'],
    national_review_need: 'Clinician calibration of vital-sign threshold messaging, pain/distress interpretation, and risk escalation language.'
  },
  {
    key: 'interview',
    label: 'Interview coverage',
    scoring_mode: 'numeric',
    feedback_basis: 'case_complaint_history_and_required_question_domains',
    required_case_evidence: ['chief_complaint', 'triage_history'],
    national_review_need: 'Educator review of expected question domains for each complaint and learner level.'
  },
  {
    key: 'focused_exam',
    label: 'Focused exam selection',
    scoring_mode: 'numeric',
    feedback_basis: 'complaint_vitals_and_reviewed_inferred_exam_rules',
    required_case_evidence: ['chief_complaint', 'vitals'],
    national_review_need: 'Case-level exam truth and faculty calibration of expected focused exam systems.'
  },
  {
    key: 'diagnosis',
    label: 'Working diagnosis',
    scoring_mode: 'formative_when_truth_missing',
    feedback_basis: 'source_record_or_clinician_adjudicated_diagnosis',
    required_case_evidence: ['source_record_diagnosis'],
    national_review_need: 'Clinician-adjudicated diagnosis and acceptable differential diagnoses before any numeric diagnosis score.'
  },
  {
    key: 'referral',
    label: 'Consult judgment',
    scoring_mode: 'formative_when_truth_missing',
    feedback_basis: 'clinician_approved_referral_reference',
    required_case_evidence: ['clinician_approved_referral'],
    national_review_need: 'Clinician-approved consult/referral truth and urgency criteria before any numeric consult score.'
  },
  {
    key: 'escalation',
    label: 'Initial management priorities',
    scoring_mode: 'numeric',
    feedback_basis: 'source_record_vitals_interventions_outcomes_and_esi_risk',
    required_case_evidence: ['vitals', 'interventions', 'outcomes', 'reference_esi'],
    national_review_need: 'Emergency clinician review of immediate stabilization priorities, unsafe omissions, and local-practice variation.'
  },
  {
    key: 'reassessment',
    label: 'Reassessment targets',
    scoring_mode: 'formative_when_truth_missing',
    feedback_basis: 'source_record_vitals_disposition_and_escalation_triggers',
    required_case_evidence: ['vitals', 'disposition', 'reassessment_triggers'],
    national_review_need: 'Clinician validation of required reassessment triggers and course-correction thresholds.'
  },
  {
    key: 'soap',
    label: 'SOAP note',
    scoring_mode: 'numeric_structure_score',
    feedback_basis: 'case_grounded_structured_note_rubric',
    required_case_evidence: ['chief_complaint', 'vitals', 'learner_actions'],
    national_review_need: 'Faculty calibration of note-quality anchors, minimum evidence use, and documentation expectations.'
  },
  {
    key: 'sbar',
    label: 'SBAR handoff',
    scoring_mode: 'conditional_numeric_structure_score',
    feedback_basis: 'case_grounded_handoff_rubric',
    required_case_evidence: ['handoff_trigger', 'learner_actions', 'disposition'],
    national_review_need: 'Simulation educator review of handoff triggers, expected receiver, and handoff quality anchors.'
  }
];

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
    || hasAny(caseRecord.augmentation, ['optional_objective_data']);
}

function documentedDomains(caseRecord) {
  return new Set((caseRecord.documented_evidence || []).map((item) => item.domain).filter(Boolean));
}

function fieldPresent(value, key) {
  return Boolean(value && Object.prototype.hasOwnProperty.call(value, key));
}

function anyFieldPresent(value, keys) {
  return keys.some((key) => fieldPresent(value, key));
}

function hasEvidence(caseRecord, evidenceKey) {
  const source = caseRecord.source || {};
  const domains = documentedDomains(caseRecord);
  const resourceSignals = source.resource_signals || {};
  const interventions = source.interventions || caseRecord.interventions || {};
  const outcomes = source.outcomes || {};
  switch (evidenceKey) {
    case 'reference_esi':
      return Boolean(caseRecord.acuity || source.reference_esi || domains.has('reference_esi'));
    case 'resource_signals':
      return Boolean(
        fieldPresent(caseRecord, 'resources_used')
          || anyFieldPresent(resourceSignals, ['resources_used', 'lab_event_count', 'exam_count', 'consults_count', 'procedure_count', 'microbio_event_count'])
          || domains.has('resources')
      );
    case 'vitals':
      return hasAny(caseRecord.vitals, ['hr', 'sbp', 'dbp', 'rr', 'o2', 'temp', 'pain'])
        || hasAny(source.vitals, ['hr', 'sbp', 'dbp', 'rr', 'o2', 'temp', 'pain'])
        || domains.has('vitals');
    case 'chief_complaint':
      return Boolean(cleanText(caseRecord.complaint || source.chief_complaint)) || domains.has('chief_complaint');
    case 'triage_history':
      return Boolean(cleanText(caseRecord.history || source.triage_narrative)) || domains.has('triage_narrative');
    case 'source_record_diagnosis':
      return hasSourceRecordDiagnosis(caseRecord);
    case 'clinician_approved_referral':
      return hasClinicianApprovedReferral(caseRecord);
    case 'interventions':
      return Object.keys(interventions).length > 0 || domains.has('interventions');
    case 'outcomes':
      return Object.values(outcomes).some(Boolean) || domains.has('adjudication') || Boolean(caseRecord.disposition);
    case 'disposition':
      return Boolean(caseRecord.disposition || source.disposition) || domains.has('disposition');
    case 'reassessment_triggers':
      return hasRetrospectiveTruth(caseRecord) || hasOptionalObjectiveData(caseRecord);
    case 'learner_actions':
    case 'handoff_trigger':
      return true;
    default:
      return false;
  }
}

function domainTraceStatus(caseRecord, contract, adjudicationStatus) {
  const missing = contract.required_case_evidence.filter((key) => !hasEvidence(caseRecord, key));
  const caseTruthReady = adjudicationStatus.case_truth?.ready_case_truth_adjudications > 0;
  const hasCaseTruthAdjudicationFile = Boolean(adjudicationStatus.case_truth?.file_present);
  if (contract.scoring_mode === 'formative_when_truth_missing') {
    return {
      missing_required_case_evidence: missing,
      expected_score_behavior: missing.length ? 'formative_only_excluded_from_numeric_score' : 'numeric_allowed_after_review',
      traceability_status: missing.length
        ? 'source_limited_formative_only'
        : caseTruthReady
          ? 'case_truth_adjudicated_numeric_allowed'
          : 'source_record_present_pending_adjudication'
    };
  }
  if (contract.scoring_mode.includes('structure')) {
    return {
      missing_required_case_evidence: missing,
      expected_score_behavior: 'numeric_structure_score_requires_faculty_calibration',
      traceability_status: missing.length
        ? 'rubric_grounded_but_case_evidence_incomplete'
        : 'rubric_grounded_requires_faculty_calibration'
    };
  }
  return {
    missing_required_case_evidence: missing,
    expected_score_behavior: 'numeric_case_grounded_pending_external_validation',
    traceability_status: missing.length
      ? 'numeric_domain_missing_required_case_evidence'
      : hasCaseTruthAdjudicationFile
        ? 'case_grounded_pending_adjudication_completion'
        : 'case_grounded_pending_clinician_adjudication'
  };
}

function caseDomainTrace(caseRecord, contract, adjudicationStatus) {
  const trace = domainTraceStatus(caseRecord, contract, adjudicationStatus);
  return {
    case_id: caseRecord.id,
    domain_key: contract.key,
    label: contract.label,
    scoring_mode: contract.scoring_mode,
    feedback_basis: contract.feedback_basis,
    required_case_evidence: contract.required_case_evidence,
    missing_required_case_evidence: trace.missing_required_case_evidence,
    traceability_status: trace.traceability_status,
    expected_score_behavior: trace.expected_score_behavior,
    national_review_need: contract.national_review_need
  };
}

function summarizeDomain(rows, contract) {
  const domainRows = rows.filter((row) => row.domain_key === contract.key);
  return {
    domain_key: contract.key,
    label: contract.label,
    scoring_mode: contract.scoring_mode,
    feedback_basis: contract.feedback_basis,
    cases: domainRows.length,
    status_counts: countBy(domainRows, (row) => row.traceability_status),
    cases_missing_required_evidence: domainRows.filter((row) => row.missing_required_case_evidence.length).length,
    source_limited_formative_cases: domainRows.filter((row) => row.traceability_status === 'source_limited_formative_only').length,
    numeric_cases_missing_required_evidence: domainRows.filter((row) => (
      row.expected_score_behavior.startsWith('numeric')
        && row.missing_required_case_evidence.length > 0
    )).length,
    national_review_need: contract.national_review_need
  };
}

function markdown(data) {
  const lines = [
    '# Feedback Traceability Matrix',
    '',
    `Generated at: ${data.generated_at}`,
    '',
    `Readiness status: ${data.review_status}`,
    '',
    'This matrix audits whether deterministic learner-facing feedback domains are tied to case source fields, clinician-adjudicated truth, evidence review, or formative-only source-limited logic.',
    '',
    '## Summary',
    '',
    `- Cases: ${data.summary.total_cases}`,
    `- Domain rows: ${data.summary.total_case_domain_rows}`,
    `- Source-limited formative rows: ${data.summary.source_limited_formative_rows}`,
    `- Numeric rows missing required case evidence: ${data.summary.numeric_rows_missing_required_case_evidence}`,
    `- Cases with source-limited diagnosis: ${data.summary.cases_with_source_limited_diagnosis}`,
    `- Cases with source-limited consult/referral: ${data.summary.cases_with_source_limited_referral}`,
    `- Cases with source-limited reassessment: ${data.summary.cases_with_source_limited_reassessment}`,
    `- Case truth adjudications ready: ${data.summary.case_truth_adjudication_ready_cases}`,
    '',
    '## Domain Coverage',
    '',
    '| Domain | Mode | Missing Evidence Cases | Source-Limited Formative Cases | Review Need |',
    '|---|---:|---:|---:|---|'
  ];

  for (const row of data.domain_summary) {
    lines.push(`| ${row.label} | ${row.scoring_mode} | ${row.cases_missing_required_evidence} | ${row.source_limited_formative_cases} | ${row.national_review_need} |`);
  }

  lines.push(
    '',
    '## Required Next Action',
    '',
    'Complete `docs/case_truth_adjudications.json` and `docs/evidence_chunk_adjudications.json` under the clinical review adjudication contract before promoting source-limited domains or generated evidence to national-scale learner-facing scoring.'
  );

  return `${lines.join('\n')}\n`;
}

const cases = readJson(CASES_PATH);
const objectiveMatrix = readJson(OBJECTIVE_MATRIX_PATH);
const adjudicationStatus = readJson(CLINICAL_ADJUDICATION_STATUS_PATH);
const objectiveCaseIds = new Set((objectiveMatrix.cases || []).map((entry) => entry.case_id));
const rows = cases.flatMap((caseRecord) => DOMAIN_CONTRACTS.map((contract) => caseDomainTrace(caseRecord, contract, adjudicationStatus)));
const domainSummary = DOMAIN_CONTRACTS.map((contract) => summarizeDomain(rows, contract));
const sourceLimitedDiagnosisRows = rows.filter((row) => row.domain_key === 'diagnosis' && row.traceability_status === 'source_limited_formative_only');
const sourceLimitedReferralRows = rows.filter((row) => row.domain_key === 'referral' && row.traceability_status === 'source_limited_formative_only');
const sourceLimitedReassessmentRows = rows.filter((row) => row.domain_key === 'reassessment' && row.traceability_status === 'source_limited_formative_only');
const numericRowsMissingEvidence = rows.filter((row) => row.expected_score_behavior.startsWith('numeric') && row.missing_required_case_evidence.length);
const sourceLimitedFormativeRows = rows.filter((row) => row.traceability_status === 'source_limited_formative_only');
const caseTruthReadyCount = adjudicationStatus.case_truth?.ready_case_truth_adjudications || 0;
const readyForNationalFeedbackRelease = sourceLimitedFormativeRows.length === 0
  && numericRowsMissingEvidence.length === 0
  && caseTruthReadyCount >= cases.length
  && cases.every((caseRecord) => objectiveCaseIds.has(caseRecord.id));

const artifact = {
  schema_version: 'feedback_traceability_matrix_v1',
  generated_at: new Date().toISOString(),
  review_status: 'draft_feedback_traceability_requires_clinician_educator_review',
  warning: 'This matrix audits traceability; it does not prove national readiness until source-limited domains are adjudicated and faculty/clinician review is complete.',
  summary: {
    total_cases: cases.length,
    total_case_domain_rows: rows.length,
    domains_tracked: DOMAIN_CONTRACTS.length,
    objective_matrix_cases_mapped: objectiveCaseIds.size,
    cases_missing_objective_mapping: cases.filter((caseRecord) => !objectiveCaseIds.has(caseRecord.id)).map((caseRecord) => caseRecord.id),
    source_limited_formative_rows: sourceLimitedFormativeRows.length,
    cases_with_source_limited_diagnosis: sourceLimitedDiagnosisRows.length,
    cases_with_source_limited_referral: sourceLimitedReferralRows.length,
    cases_with_source_limited_reassessment: sourceLimitedReassessmentRows.length,
    numeric_rows_missing_required_case_evidence: numericRowsMissingEvidence.length,
    case_truth_adjudication_ready_cases: caseTruthReadyCount,
    evidence_adjudication_approved_chunks: adjudicationStatus.evidence?.approved_chunks || 0,
    ready_for_national_feedback_release: readyForNationalFeedbackRelease
  },
  domain_contracts: DOMAIN_CONTRACTS,
  domain_summary: domainSummary,
  case_domain_traceability: rows,
  national_readiness_blockers: [
    'Diagnosis remains formative-only for public cases until source-record or clinician-adjudicated diagnoses are available.',
    'Consult/referral judgment remains formative-only until clinician-approved referral references are available.',
    'Reassessment remains formative-only until clinician-adjudicated triggers or optional objective follow-up data are available.',
    'Numeric case-grounded domains still require clinician or faculty calibration before national summative use.',
    'Generated clinical evidence chunks remain quarantined until source/evidence adjudication is complete.'
  ]
};

writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
writeFileSync(OUTPUT_MD_PATH, markdown(artifact), 'utf8');

console.log(`Wrote feedback traceability matrix for ${cases.length} cases and ${rows.length} domain rows to ${OUTPUT_JSON_PATH}`);
