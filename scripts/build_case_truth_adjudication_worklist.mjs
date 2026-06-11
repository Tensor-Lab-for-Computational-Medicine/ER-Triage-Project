import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CASES_PATH = join(ROOT, 'frontend', 'src', 'data', 'cases.json');
const CASE_TRUTH_PACKETS_PATH = join(ROOT, 'docs', 'case_truth_review_packets.json');
const CLINICAL_ADJUDICATION_STATUS_PATH = join(ROOT, 'docs', 'clinical_review_adjudication_status.json');
const CASE_TRUTH_ADJUDICATIONS_PATH = join(ROOT, 'docs', 'case_truth_adjudications.json');
const OUTPUT_JSON_PATH = join(ROOT, 'docs', 'case_truth_adjudication_worklist.json');
const OUTPUT_MD_PATH = join(ROOT, 'docs', 'case_truth_adjudication_worklist.md');

const READY_STATUS = 'adjudicated_ready_for_case_truth';
const PENDING_STATUS = 'pending_clinician_educator_adjudication';
const PRIORITY_ORDER = new Map([
  ['P1_resuscitation_or_time_critical_truth_review', 1],
  ['P2_high_risk_truth_review', 2],
  ['P3_resource_prediction_truth_review', 3],
  ['P4_lower_acuity_truth_review', 4]
]);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readOptionalJson(path) {
  return existsSync(path) ? readJson(path) : null;
}

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function markdownEscape(value) {
  return cleanText(value).replaceAll('|', '\\|');
}

function countBy(items, selector) {
  return items.reduce((acc, item) => {
    const key = selector(item) || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function reviewerTemplate(caseId) {
  return [
    {
      reviewer_id: '',
      roles: ['emergency_medicine_clinician'],
      attested_at: '',
      scope: {
        case_id: caseId,
        review_scope: 'ESI truth, diagnosis/referral truth, stabilization priorities, objective-data reveal safety, disposition, and unsafe feedback blockers'
      }
    },
    {
      reviewer_id: '',
      roles: ['medical_educator'],
      attested_at: '',
      scope: {
        case_id: caseId,
        review_scope: 'learner level, clinical reasoning objectives, error patterns, debrief quality, and assessment-rubric alignment'
      }
    }
  ];
}

function clinicianPlaceholder(field) {
  switch (field) {
    case 'reference_esi_confirmation':
      return {
        confirmed_reference_esi: '',
        rationale: '',
        acceptable_alternates: []
      };
    case 'source_record_or_best_adjudicated_diagnosis':
      return {
        diagnosis: '',
        basis: ''
      };
    case 'acceptable_differential_diagnoses':
      return [];
    case 'consult_or_referral_truth':
      return {
        expected_consult_or_referral: '',
        acceptable_variants: []
      };
    case 'expected_resource_profile':
      return {
        expected_resources: [],
        rationale: ''
      };
    case 'objective_data_to_reveal_if_requested':
      return [];
    case 'unsafe_or_misleading_feedback_to_block':
      return [];
    default:
      return '';
  }
}

function educatorPlaceholder(field) {
  switch (field) {
    case 'clinical_reasoning_objectives_supported':
    case 'common_error_patterns_to_teach':
    case 'debrief_feedback_points':
    case 'assessment_rubric_alignment':
      return [];
    default:
      return '';
  }
}

function compactRiskFlags(flags = []) {
  return flags.map((flag) => ({
    id: flag.id || '',
    value: cleanText(flag.value),
    reviewer_prompt: cleanText(flag.reviewer_prompt)
  }));
}

function compactTruthPrompts(prompts = []) {
  return prompts.map((prompt) => ({
    field: prompt.field || prompt.missing_truth_field || '',
    prompt: cleanText(prompt.prompt || prompt.reviewer_prompt),
    required_review_decision: cleanText(prompt.required_review_decision)
  }));
}

function worklistSort(a, b) {
  const priorityDelta = (PRIORITY_ORDER.get(a.priority) || 99) - (PRIORITY_ORDER.get(b.priority) || 99);
  return priorityDelta || a.case_id.localeCompare(b.case_id);
}

function releaseBlockers(packet, adjudication, ready) {
  const blockers = [];
  if (!adjudication) {
    blockers.push({
      id: 'case_truth_adjudication_missing',
      status: 'blocked',
      description: 'No completed case_truth_adjudications.json entry exists for this public case.'
    });
  }
  if (!ready) {
    blockers.push({
      id: 'case_not_adjudicated_ready_for_case_truth',
      status: 'blocked',
      description: 'The case cannot be counted as national-release case truth until status is adjudicated_ready_for_case_truth.'
    });
  }
  for (const field of packet.missing_truth_fields || []) {
    blockers.push({
      id: `missing_${field}`,
      status: 'blocked',
      description: `Reviewer must adjudicate ${field} before national release.`
    });
  }
  if ((packet.review_risk_flags || []).some((flag) => flag.id === 'source_narrative_age_mismatch')) {
    blockers.push({
      id: 'source_narrative_age_mismatch_requires_resolution',
      status: 'blocked',
      description: 'Reviewer must resolve the source/narrative age mismatch before learner-facing national release.'
    });
  }
  if ((packet.review_risk_flags || []).some((flag) => flag.id === 'source_esi_reviewer_disagreement')) {
    blockers.push({
      id: 'source_esi_reviewer_disagreement_requires_resolution',
      status: 'blocked',
      description: 'Reviewer must resolve or document the ESI disagreement before summative scoring release.'
    });
  }
  return blockers;
}

function buildStarterAdjudication(packet, requiredClinicianFields, requiredEducatorFields) {
  return {
    case_id: packet.case_id,
    status: PENDING_STATUS,
    reviewers: reviewerTemplate(packet.case_id),
    clinician_adjudication: Object.fromEntries(
      requiredClinicianFields.map((field) => [field, clinicianPlaceholder(field)])
    ),
    educator_validation: Object.fromEntries(
      requiredEducatorFields.map((field) => [field, educatorPlaceholder(field)])
    ),
    disagreement_resolution: {
      disagreement_present: false,
      resolution_summary: ''
    },
    release_attestation: {
      no_restricted_source_identifiers_included: false,
      safe_for_public_medical_student_simulation: false,
      deterministic_scoring_truth_approved: false,
      completed_at: ''
    }
  };
}

const cases = readJson(CASES_PATH);
const packets = readJson(CASE_TRUTH_PACKETS_PATH);
const clinicalStatus = readJson(CLINICAL_ADJUDICATION_STATUS_PATH);
const caseTruthAdjudications = readOptionalJson(CASE_TRUTH_ADJUDICATIONS_PATH);
const adjudicationsByCaseId = new Map((caseTruthAdjudications?.adjudications || []).map((item) => [item.case_id, item]));
const requiredClinicianFields = packets.review_template?.required_clinician_fields || clinicalStatus.case_truth?.required_clinician_fields || [];
const requiredEducatorFields = packets.review_template?.required_educator_fields || clinicalStatus.case_truth?.required_educator_fields || [];
const caseIds = new Set(cases.map((caseRecord) => caseRecord.id));

const workItems = (packets.case_review_packets || [])
  .filter((packet) => caseIds.has(packet.case_id))
  .map((packet) => {
    const adjudication = adjudicationsByCaseId.get(packet.case_id);
    const ready = adjudication?.status === READY_STATUS;
    const blockers = releaseBlockers(packet, adjudication, ready);
    return {
      case_id: packet.case_id,
      public_case_uid: packet.public_case_uid || '',
      priority: packet.priority,
      review_state: ready ? READY_STATUS : adjudication ? 'adjudication_submitted_not_ready' : PENDING_STATUS,
      complaint: packet.case_snapshot?.complaint || '',
      reference_esi_from_source: packet.case_snapshot?.reference_esi_from_source ?? '',
      disposition: packet.case_snapshot?.disposition || '',
      missing_truth_fields: packet.missing_truth_fields || [],
      source_limitation_count: packet.source_limitations_to_adjudicate?.length || 0,
      simulation_reveal_scaffold_count: packet.simulation_reveal_scaffolds_to_review?.length || 0,
      risk_flags: compactRiskFlags(packet.review_risk_flags || []),
      truth_decision_prompts: compactTruthPrompts(packet.truth_decision_prompts || []),
      required_reviewers: ['emergency_medicine_clinician', 'medical_educator'],
      required_clinician_fields: requiredClinicianFields,
      required_educator_fields: requiredEducatorFields,
      release_blockers: blockers,
      starter_adjudication: buildStarterAdjudication(packet, requiredClinicianFields, requiredEducatorFields)
    };
  })
  .sort(worklistSort);

const readyItems = workItems.filter((item) => item.review_state === READY_STATUS);
const highPriorityItems = workItems.filter((item) =>
  ['P1_resuscitation_or_time_critical_truth_review', 'P2_high_risk_truth_review'].includes(item.priority)
);
const releaseBlockerCount = workItems.reduce((total, item) => total + item.release_blockers.length, 0);
const sourceNarrativeAgeMismatchItems = workItems.filter((item) =>
  item.risk_flags.some((flag) => flag.id === 'source_narrative_age_mismatch')
);
const sourceEsiDisagreementItems = workItems.filter((item) =>
  item.risk_flags.some((flag) => flag.id === 'source_esi_reviewer_disagreement')
);

const artifact = {
  schema_version: 'case_truth_adjudication_worklist_v1',
  generated_at: new Date().toISOString(),
  review_status: readyItems.length === workItems.length && clinicalStatus.readiness_effect?.invalid_review_input_count === 0
    ? 'case_truth_adjudication_worklist_complete_ready_for_external_audit'
    : 'case_truth_adjudication_worklist_open_review_required',
  warning: 'This worklist creates reviewer starter objects only. It does not approve cases, change scoring truth, or replace emergency clinician and medical educator adjudication.',
  source_contract: {
    case_truth_review_packets_schema: packets.schema_version,
    clinical_review_adjudication_status_schema: clinicalStatus.schema_version,
    completed_adjudication_file_present: Boolean(caseTruthAdjudications),
    required_completed_adjudication_schema: 'case_truth_adjudications_v1',
    current_public_cases: cases.length
  },
  summary: {
    total_work_items: workItems.length,
    current_public_cases: cases.length,
    ready_case_truth_adjudications: readyItems.length,
    pending_case_truth_adjudications: workItems.length - readyItems.length,
    high_priority_work_items: highPriorityItems.length,
    p1_resuscitation_or_time_critical_work_items: workItems.filter((item) => item.priority === 'P1_resuscitation_or_time_critical_truth_review').length,
    p2_high_risk_work_items: workItems.filter((item) => item.priority === 'P2_high_risk_truth_review').length,
    source_narrative_age_mismatch_work_items: sourceNarrativeAgeMismatchItems.length,
    source_esi_reviewer_disagreement_work_items: sourceEsiDisagreementItems.length,
    total_release_blockers: releaseBlockerCount,
    required_clinician_fields: requiredClinicianFields.length,
    required_educator_fields: requiredEducatorFields.length,
    all_current_cases_have_work_item: workItems.length === cases.length,
    all_work_items_include_starter_adjudication: workItems.every((item) => item.starter_adjudication?.case_id === item.case_id),
    ready_for_national_case_truth_release_from_worklist:
      readyItems.length === cases.length && clinicalStatus.readiness_effect?.invalid_review_input_count === 0
  },
  priority_counts: countBy(workItems, (item) => item.priority),
  work_items: workItems
};

const mdRows = workItems.map((item) => [
  item.priority,
  item.case_id,
  item.complaint,
  item.reference_esi_from_source,
  item.review_state,
  item.missing_truth_fields.length,
  item.source_limitation_count,
  item.simulation_reveal_scaffold_count,
  item.risk_flags.length,
  item.release_blockers.length
]);

const md = [
  '# Case Truth Adjudication Worklist',
  '',
  `Generated: ${artifact.generated_at}`,
  '',
  artifact.warning,
  '',
  '## Summary',
  '',
  `- Work items: ${artifact.summary.total_work_items}`,
  `- Current public cases: ${artifact.summary.current_public_cases}`,
  `- Ready case-truth adjudications: ${artifact.summary.ready_case_truth_adjudications}`,
  `- Pending case-truth adjudications: ${artifact.summary.pending_case_truth_adjudications}`,
  `- High-priority P1/P2 work items: ${artifact.summary.high_priority_work_items}`,
  `- Source/narrative age mismatch work items: ${artifact.summary.source_narrative_age_mismatch_work_items}`,
  `- Source ESI reviewer disagreement work items: ${artifact.summary.source_esi_reviewer_disagreement_work_items}`,
  `- Total release blockers: ${artifact.summary.total_release_blockers}`,
  `- All current cases have a work item: ${artifact.summary.all_current_cases_have_work_item}`,
  `- Starter adjudications included in JSON: ${artifact.summary.all_work_items_include_starter_adjudication}`,
  `- Ready for national case-truth release from worklist: ${artifact.summary.ready_for_national_case_truth_release_from_worklist}`,
  '',
  '## Review Worklist',
  '',
  '| Priority | Case | Complaint | ESI | Review state | Missing truth fields | Source limits | Reveal scaffolds | Risk flags | Blockers |',
  '|---|---|---|---:|---|---:|---:|---:|---:|---:|',
  ...mdRows.map((row) => `| ${row.map(markdownEscape).join(' | ')} |`),
  '',
  '## Reviewer Use',
  '',
  '- Copy each `starter_adjudication` object from the JSON into `docs/case_truth_adjudications.json` only after reviewers replace placeholders with completed review findings.',
  '- Keep status as `pending_clinician_educator_adjudication` until all required clinician and educator fields are completed.',
  '- Change status to `adjudicated_ready_for_case_truth` only after both reviewer attestations, disagreement resolution when applicable, and release attestation are complete.',
  '- Do not include restricted source identifiers in completed adjudications.',
  ''
].join('\n');

writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
writeFileSync(OUTPUT_MD_PATH, md, 'utf8');

console.log(JSON.stringify({
  review_status: artifact.review_status,
  work_items: artifact.summary.total_work_items,
  pending_case_truth_adjudications: artifact.summary.pending_case_truth_adjudications,
  high_priority_work_items: artifact.summary.high_priority_work_items,
  total_release_blockers: artifact.summary.total_release_blockers,
  ready_for_national_case_truth_release_from_worklist:
    artifact.summary.ready_for_national_case_truth_release_from_worklist
}, null, 2));
