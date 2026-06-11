import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CASES_PATH = join(ROOT, 'frontend', 'src', 'data', 'cases.json');
const OBJECTIVE_MATRIX_PATH = join(ROOT, 'docs', 'case_objective_matrix.json');
const JSON_OUTPUT_PATH = join(ROOT, 'docs', 'core_epa_curriculum_map.json');
const MD_OUTPUT_PATH = join(ROOT, 'docs', 'core_epa_curriculum_map.md');

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

const CORE_EPAS = [
  {
    id: 'EPA_1',
    title: 'Gather a history and perform a physical examination',
    app_alignment_status: 'draft_direct_alignment',
    national_readiness_status: 'needs_faculty_validation'
  },
  {
    id: 'EPA_2',
    title: 'Prioritize a differential diagnosis following a clinical encounter',
    app_alignment_status: 'draft_direct_alignment',
    national_readiness_status: 'needs_faculty_validation'
  },
  {
    id: 'EPA_3',
    title: 'Recommend and interpret common diagnostic and screening tests',
    app_alignment_status: 'draft_partial_alignment',
    national_readiness_status: 'needs_case_truth_and_objective_data'
  },
  {
    id: 'EPA_4',
    title: 'Enter and discuss orders and prescriptions',
    app_alignment_status: 'draft_partial_alignment',
    national_readiness_status: 'needs_supervision_policy_and_order_scope_review'
  },
  {
    id: 'EPA_5',
    title: 'Document a clinical encounter in the patient record',
    app_alignment_status: 'draft_direct_alignment',
    national_readiness_status: 'needs_faculty_validation'
  },
  {
    id: 'EPA_6',
    title: 'Provide an oral presentation of a clinical encounter',
    app_alignment_status: 'draft_partial_alignment',
    national_readiness_status: 'needs_oral_or_sbar_assessment_review'
  },
  {
    id: 'EPA_7',
    title: 'Form clinical questions and retrieve evidence to advance patient care',
    app_alignment_status: 'draft_partial_alignment',
    national_readiness_status: 'needs_quote_backed_evidence_review'
  },
  {
    id: 'EPA_8',
    title: 'Give or receive a patient handover to transition care responsibility',
    app_alignment_status: 'draft_partial_alignment',
    national_readiness_status: 'needs_handoff_trigger_and_sbar_validation'
  },
  {
    id: 'EPA_9',
    title: 'Collaborate as a member of an interprofessional team',
    app_alignment_status: 'draft_partial_alignment',
    national_readiness_status: 'needs_consult_truth_and_teamwork_assessment'
  },
  {
    id: 'EPA_10',
    title: 'Recognize a patient requiring urgent or emergent care and initiate evaluation and management',
    app_alignment_status: 'draft_direct_alignment',
    national_readiness_status: 'needs_esi_expert_consensus_benchmark'
  },
  {
    id: 'EPA_11',
    title: 'Obtain informed consent for tests and procedures',
    app_alignment_status: 'not_currently_supported',
    national_readiness_status: 'needs_deliberate_feature_or_exclusion_rationale'
  },
  {
    id: 'EPA_12',
    title: 'Perform general procedures of a physician',
    app_alignment_status: 'not_currently_supported',
    national_readiness_status: 'needs_deliberate_feature_or_exclusion_rationale'
  },
  {
    id: 'EPA_13',
    title: 'Identify system failures and contribute to a culture of safety and improvement',
    app_alignment_status: 'draft_partial_alignment',
    national_readiness_status: 'needs_patient_safety_and_qi_review'
  }
];

const WORKFLOW_PHASES = [
  {
    id: 'encounter',
    app_surface: 'Focused interview, vitals review, and focused exam reveal',
    clinical_reasoning_domain: 'noticing',
    mapped_epas: ['EPA_1', 'EPA_10'],
    evidence_in_app: [
      'FocusedInterview component',
      'ObjectiveReview component',
      'interviewEngine coverage evaluation',
      'examEngine focused exam selection'
    ],
    unresolved_validation: [
      'Faculty must verify expected question domains by complaint and learner level.',
      'Clinicians must verify that inferred exam findings stay within source-supported simulation truth.'
    ]
  },
  {
    id: 'impression',
    app_surface: 'ESI assignment, working diagnosis, differential, and diagnosis evidence',
    clinical_reasoning_domain: 'interpreting',
    mapped_epas: ['EPA_2', 'EPA_10'],
    evidence_in_app: [
      'ClinicalImpressionPhase component',
      'staticEngine ESI and diagnosis feedback',
      'case objective matrix interpreting objectives'
    ],
    unresolved_validation: [
      'ESI rationale needs expert consensus review.',
      'Diagnosis and differential scoring must remain formative until case truth records are adjudicated.'
    ]
  },
  {
    id: 'plan',
    app_surface: 'Initial actions, optional objective data, route/priority choices, and consult rationale',
    clinical_reasoning_domain: 'responding',
    mapped_epas: ['EPA_3', 'EPA_4', 'EPA_9', 'EPA_10'],
    evidence_in_app: [
      'InitialPlanPhase component',
      'staticEngine action feedback',
      'case resource signals'
    ],
    unresolved_validation: [
      'Optional objective data are not complete in the public case truth record.',
      'Consult/referral truth is unavailable in all public cases.',
      'Order-like choices need institutional scope and supervision language.'
    ]
  },
  {
    id: 'reassessment',
    app_surface: 'What-if reassessment targets, SOAP note, and optional handoff/SBAR text',
    clinical_reasoning_domain: 'reflecting',
    mapped_epas: ['EPA_5', 'EPA_6', 'EPA_8', 'EPA_10'],
    evidence_in_app: [
      'ReassessmentSoapPhase component',
      'staticEngine reassessment, SOAP, and SBAR scoring'
    ],
    unresolved_validation: [
      'Reassessment triggers need clinician adjudication per case.',
      'SOAP and SBAR scoring needs faculty calibration and example anchors.'
    ]
  },
  {
    id: 'debrief',
    app_surface: 'Deterministic debrief, evidence provenance, optional AI draft, tutor panel, and next practice focus',
    clinical_reasoning_domain: 'reflecting',
    mapped_epas: ['EPA_2', 'EPA_7', 'EPA_13'],
    evidence_in_app: [
      'Feedback component',
      'debriefEngine evidence lanes',
      'clinicalKnowledgeService source retrieval',
      'learnerProfileService next-case recommendation'
    ],
    unresolved_validation: [
      'Generated evidence chunks require review before source-of-truth feedback.',
      'Optional AI tutor/draft outputs need factuality, role consistency, and unsafe-advice red-team checks.',
      'Longitudinal learner remediation workflow needs educator approval.'
    ]
  }
];

function caseEpas(entry) {
  const domains = new Set((entry.objectives || []).map((objective) => objective.domain));
  const epas = new Set();
  if (domains.has('noticing')) ['EPA_1', 'EPA_10'].forEach((id) => epas.add(id));
  if (domains.has('interpreting')) ['EPA_2', 'EPA_10'].forEach((id) => epas.add(id));
  if (domains.has('responding')) ['EPA_3', 'EPA_4', 'EPA_9', 'EPA_10'].forEach((id) => epas.add(id));
  if (domains.has('reflecting')) ['EPA_5', 'EPA_6', 'EPA_7', 'EPA_8', 'EPA_13'].forEach((id) => epas.add(id));
  return [...epas].sort();
}

function caseEntry(caseRecord, objectiveEntry) {
  const mappedEpas = caseEpas(objectiveEntry || { objectives: [] });
  return {
    case_id: caseRecord.id,
    public_case_uid: caseRecord.source?.public_case_uid || '',
    complaint: cleanText(caseRecord.complaint),
    reference_esi: Number(caseRecord.acuity || 0),
    mapped_epas: mappedEpas,
    mapped_epa_count: mappedEpas.length,
    review_status: 'draft_needs_curriculum_committee_review',
    evidence_limits: {
      diagnosis_truth: 'source_record_diagnosis_unavailable_in_public_case',
      consult_truth: 'clinician_approved_consult_unavailable_in_public_case',
      objective_data_truth: 'optional_objective_data_unavailable_in_public_case',
      learner_outcomes: 'not_yet_validated'
    }
  };
}

const cases = readJson(CASES_PATH);
const objectiveMatrix = readJson(OBJECTIVE_MATRIX_PATH);
const objectiveByCaseId = new Map((objectiveMatrix.cases || []).map((entry) => [entry.case_id, entry]));
const caseMappings = cases.map((caseRecord) => caseEntry(caseRecord, objectiveByCaseId.get(caseRecord.id)));
const mappedEpas = new Set(WORKFLOW_PHASES.flatMap((phase) => phase.mapped_epas));
const unsupportedEpas = CORE_EPAS.filter((epa) => epa.app_alignment_status === 'not_currently_supported').map((epa) => epa.id);
const partialEpas = CORE_EPAS.filter((epa) => epa.app_alignment_status.includes('partial')).map((epa) => epa.id);
const directEpas = CORE_EPAS.filter((epa) => epa.app_alignment_status.includes('direct')).map((epa) => epa.id);

const artifact = {
  schema_version: 'core_epa_curriculum_map_v1',
  generated_at: new Date().toISOString(),
  review_status: 'draft_needs_curriculum_committee_review',
  warning: 'This map aligns the current simulator workflow to AAMC Core EPA categories for curriculum planning. It is not an entrustment decision, clinical educator approval, or evidence of national readiness.',
  source_references: [
    {
      id: 'aamc_core_epas',
      title: 'AAMC Core Entrustable Professional Activities for Entering Residency',
      url: 'https://www.aamc.org/about-us/mission-areas/medical-education/cbme/core-epas'
    },
    {
      id: 'aamc_epa_guiding_principles',
      title: 'AAMC Core EPAs Guiding Principles',
      url: 'https://www.aamc.org/what-we-do/mission-areas/medical-education/cbme/core-epas/guiding-principles'
    }
  ],
  summary: {
    total_core_epas: CORE_EPAS.length,
    workflow_mapped_epas: mappedEpas.size,
    direct_alignment_epas: directEpas.length,
    partial_alignment_epas: partialEpas.length,
    unsupported_epas: unsupportedEpas.length,
    unsupported_epa_ids: unsupportedEpas,
    cases_mapped: caseMappings.length,
    reviewed_case_epa_mappings: 0,
    draft_case_epa_mappings: caseMappings.length,
    epa_frequency_by_case: countBy(caseMappings.flatMap((entry) => entry.mapped_epas), (id) => id)
  },
  core_epas: CORE_EPAS,
  workflow_phase_map: WORKFLOW_PHASES,
  case_epa_map: caseMappings,
  faculty_review_required: [
    'Confirm which Core EPAs the simulator is intended to teach versus only incidentally touch.',
    'Approve learner level, supervision assumptions, and assessment use for each mapped EPA.',
    'Decide whether unsupported EPAs 11 and 12 are out of scope or need new modules.',
    'Calibrate SOAP, SBAR, ESI, differential, and consult scoring examples before assessment use.',
    'Link the map to clerkship, simulation lab, OSCE, or pre-clerkship clinical reasoning curriculum requirements.'
  ]
};

function toMarkdown(data) {
  const lines = [
    '# Core EPA Curriculum Map',
    '',
    `Generated: ${data.generated_at}`,
    '',
    data.warning,
    '',
    '## Summary',
    '',
    `- Core EPAs listed: ${data.summary.total_core_epas}`,
    `- Workflow-mapped EPAs: ${data.summary.workflow_mapped_epas}`,
    `- Direct alignment EPAs: ${data.summary.direct_alignment_epas}`,
    `- Partial alignment EPAs: ${data.summary.partial_alignment_epas}`,
    `- Unsupported EPAs: ${data.summary.unsupported_epas} (${data.summary.unsupported_epa_ids.join(', ')})`,
    `- Case mappings: ${data.summary.cases_mapped} draft, ${data.summary.reviewed_case_epa_mappings} reviewed`,
    '',
    '## Workflow Phase Map',
    '',
    '| Phase | Domain | Core EPAs | Current App Surface | Main Validation Gap |',
    '|---|---|---|---|---|',
    ...data.workflow_phase_map.map((phase) => `| ${phase.id} | ${phase.clinical_reasoning_domain} | ${phase.mapped_epas.join(', ')} | ${phase.app_surface} | ${phase.unresolved_validation.join(' ')} |`),
    '',
    '## Unsupported Or Weakly Supported EPAs',
    '',
    ...data.core_epas
      .filter((epa) => epa.app_alignment_status !== 'draft_direct_alignment')
      .map((epa) => `- ${epa.id}: ${epa.title} - ${epa.app_alignment_status}; ${epa.national_readiness_status}`),
    '',
    '## Faculty Review Required',
    '',
    ...data.faculty_review_required.map((item) => `- ${item}`)
  ];
  return `${lines.join('\n')}\n`;
}

writeFileSync(JSON_OUTPUT_PATH, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
writeFileSync(MD_OUTPUT_PATH, toMarkdown(artifact), 'utf8');

console.log(`Wrote Core EPA curriculum map for ${caseMappings.length} cases to ${JSON_OUTPUT_PATH}`);
