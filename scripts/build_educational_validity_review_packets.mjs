import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CORE_EPA_CURRICULUM_MAP_PATH = join(ROOT, 'docs', 'core_epa_curriculum_map.json');
const CURRICULUM_MAPPING_REVIEW_STATUS_PATH = join(ROOT, 'docs', 'curriculum_mapping_review_status.json');
const EDUCATIONAL_OUTCOMES_FRAMEWORK_PATH = join(ROOT, 'docs', 'educational_outcomes_measurement_framework.json');
const EDUCATIONAL_OUTCOMES_VALIDATION_STATUS_PATH = join(ROOT, 'docs', 'educational_outcomes_validation_status.json');
const EDUCATIONAL_OUTCOMES_RUNTIME_REPORT_PATH = join(ROOT, 'docs', 'educational_outcomes_runtime_report.json');
const EDUCATIONAL_OUTCOMES_PROTOCOL_PATH = join(ROOT, 'docs', 'educational_outcomes_protocol.md');
const JSON_OUTPUT_PATH = join(ROOT, 'docs', 'educational_validity_review_packets.json');
const MD_OUTPUT_PATH = join(ROOT, 'docs', 'educational_validity_review_packets.md');

const CASE_CURRICULUM_REVIEW_ROLES = [
  'clinical_educator',
  'simulation_educator',
  'curriculum_or_clerkship_director'
];

const WORKFLOW_REVIEW_ROLES = [
  'clinical_educator',
  'assessment_or_curriculum_reviewer',
  'simulation_educator'
];

const OUTCOME_REVIEW_ROLES = [
  'clinical_educator',
  'assessment_or_curriculum_reviewer',
  'measurement_or_biostatistics_reviewer'
];

const STUDY_REVIEW_ROLES = [
  'clinical_educator',
  'measurement_or_biostatistics_reviewer',
  'privacy_or_irb_governance_reviewer',
  'simulation_or_clerkship_director'
];

const REQUIRED_STUDY_PACKETS = [
  {
    id: 'response_process_usability',
    acceptable_phases: ['response_process_usability'],
    minimum_sample_size: 10,
    evidence_target:
      'Medical students and faculty observers understand task intent, source-limited labels, feedback categories, and safe formative-use boundaries.',
    required_before: 'single_site_pilot_claims'
  },
  {
    id: 'single_site_pre_post_pilot',
    acceptable_phases: ['single_site_pilot'],
    minimum_sample_size: 40,
    evidence_target:
      'Pre/post held-out case performance shows interpretable ESI accuracy, undertriage, escalation, and rationale-quality effects without unsafe confidence.',
    required_before: 'local_effectiveness_claims'
  },
  {
    id: 'multi_site_effectiveness_study',
    acceptable_phases: ['multi_site_controlled', 'multi_site_stepped_wedge'],
    minimum_sample_size: 120,
    evidence_target:
      'Multi-school or multi-program evaluation compares usual curriculum against simulator-supported practice with predefined safety outcomes.',
    required_before: 'national_effectiveness_claims'
  },
  {
    id: 'external_transfer_validation',
    acceptable_phases: ['external_transfer_validation'],
    minimum_sample_size: 40,
    evidence_target:
      'Validated linkage to OSCE, simulation lab, clerkship, or supervised clinical performance measures supports transfer beyond simulator scores.',
    required_before: 'hospital_performance_or_transfer_claims'
  }
];

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
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

function casePriority(caseMapping) {
  if (Number(caseMapping.reference_esi) <= 2) return 'P0_high_acuity_curriculum_mapping_review';
  if ((caseMapping.mapped_epas || []).includes('EPA_10')) return 'P1_urgent_care_epa_mapping_review';
  return 'P2_curriculum_mapping_review';
}

function metricPriority(metric) {
  if (metric.id === 'high_risk_undertriage') return 'P0_patient_safety_outcome_metric';
  if (metric.status === 'source_limited') return 'P0_source_limited_metric_review';
  if (metric.status === 'requires_external_validation') return 'P1_external_validation_required';
  if (/undertriage|unsafe|escalation|disposition/i.test(`${metric.id} ${metric.construct}`)) {
    return 'P1_safety_or_transfer_metric_review';
  }
  return 'P2_metric_calibration_review';
}

function caseCurriculumPacket(caseMapping, statusRow = {}) {
  return {
    id: `curriculum_case_mapping_${caseMapping.case_id}`,
    packet_type: 'case_curriculum_mapping_review',
    case_id: caseMapping.case_id,
    public_case_uid: caseMapping.public_case_uid || '',
    complaint: caseMapping.complaint || '',
    reference_esi: caseMapping.reference_esi,
    priority: casePriority(caseMapping),
    review_status: 'pending_curriculum_committee_review',
    current_review_decision: statusRow.review_decision || 'not_reviewed',
    mapped_epas: caseMapping.mapped_epas || [],
    evidence_limits: caseMapping.evidence_limits || {},
    reviewer_roles_required: CASE_CURRICULUM_REVIEW_ROLES,
    required_decision:
      'approved_for_national_release | approved_for_supervised_pilot_only | revisions_required | rejected',
    review_questions: [
      'Are the mapped Core EPAs deliberate learning targets for this case, or only incidental workflow touchpoints?',
      'Are the noticing, interpreting, responding, and reflecting objectives appropriate for the intended learner level and supervision context?',
      'Which mapped EPA claims must remain pilot-only or formative-only until case truth and scoring anchors are adjudicated?',
      'Do the source limitations require rewording objectives, feedback, or assessment-use language before national release?'
    ],
    acceptance_criteria: [
      'At least two credentialed reviewers cover clinical education, simulation education, and curriculum or clerkship leadership roles.',
      'Every mapped EPA and all four clinical reasoning domains are reviewed.',
      'Learner level, supervision assumptions, assessment use, and restrictions are recorded.',
      'Required changes are resolved before any national-release approval.'
    ],
    review_submission_template: {
      case_id: caseMapping.case_id,
      review_id: '',
      review_decision: 'not_reviewed',
      reviewed_at: '',
      reviewed_by: CASE_CURRICULUM_REVIEW_ROLES.map((role) => ({
        role,
        name: '',
        institution: '',
        credential_or_position: ''
      })),
      objective_domains_reviewed: ['noticing', 'interpreting', 'responding', 'reflecting'],
      epas_reviewed: caseMapping.mapped_epas || [],
      learner_level_and_supervision_rationale: '',
      assessment_use: '',
      objective_alignment_rationale: '',
      case_truth_limitations_reviewed: '',
      restrictions_or_required_changes: [],
      signature_attestation: ''
    }
  };
}

function workflowPhasePacket(phase, statusRow = {}) {
  return {
    id: `curriculum_workflow_phase_${phase.id}`,
    packet_type: 'workflow_phase_curriculum_review',
    workflow_phase_id: phase.id,
    priority: phase.mapped_epas?.includes('EPA_10')
      ? 'P0_urgent_care_workflow_scope_review'
      : 'P1_workflow_scope_review',
    review_status: 'pending_workflow_phase_review',
    current_review_decision: statusRow.review_decision || 'not_reviewed',
    clinical_reasoning_domain: phase.clinical_reasoning_domain,
    app_surface: phase.app_surface,
    mapped_epas: phase.mapped_epas || [],
    evidence_in_app: phase.evidence_in_app || [],
    unresolved_validation: phase.unresolved_validation || [],
    reviewer_roles_required: WORKFLOW_REVIEW_ROLES,
    required_decision:
      'approved_for_national_release | approved_for_supervised_pilot_only | revisions_required | rejected',
    review_questions: [
      'Does this workflow phase teach the mapped EPA scope at the intended learner level?',
      'Does the app surface make supervision and formative-use boundaries clear enough for national cohorts?',
      'Which scoring anchors, examples, or workflow guardrails are missing before assessment use?',
      'Which mapped EPA claims should be narrowed, excluded, or moved to supervised pilot only?'
    ],
    acceptance_criteria: [
      'Every EPA mapped to the phase is explicitly reviewed.',
      'Assessment boundary and supervision notes are documented.',
      'Required changes are cleared before national-release approval.',
      'Any pilot-only or rejected decision includes restrictions and remediation work.'
    ],
    review_submission_template: {
      workflow_phase_id: phase.id,
      review_id: '',
      review_decision: 'not_reviewed',
      reviewed_at: '',
      reviewed_by: WORKFLOW_REVIEW_ROLES.map((role) => ({
        role,
        name: '',
        institution: '',
        credential_or_position: ''
      })),
      epas_reviewed: phase.mapped_epas || [],
      workflow_alignment_rationale: '',
      assessment_boundary: '',
      supervision_or_scope_notes: '',
      restrictions_or_required_changes: [],
      signature_attestation: ''
    }
  };
}

function unsupportedEpaPacket(epa, statusRow = {}) {
  return {
    id: `unsupported_epa_scope_${epa.id}`,
    packet_type: 'unsupported_epa_scope_decision',
    epa_id: epa.id,
    title: epa.title,
    priority: 'P1_scope_or_feature_decision_required',
    review_status: 'pending_unsupported_epa_scope_decision',
    current_decision: statusRow.decision || 'not_reviewed',
    app_alignment_status: epa.app_alignment_status,
    national_readiness_status: epa.national_readiness_status,
    reviewer_roles_required: WORKFLOW_REVIEW_ROLES,
    acceptable_decisions: [
      'approved_out_of_scope',
      'feature_required_before_release',
      'pilot_only_exclusion',
      'rejected'
    ],
    review_questions: [
      'Should this EPA be explicitly excluded from the simulator scope for national release?',
      'Would learners reasonably infer that this app assesses the EPA despite lacking a deliberate feature?',
      'If the EPA remains out of scope, what wording or UI boundary should prevent overclaiming?',
      'If feature work is required, what module, review evidence, and learner-safety checks are needed?'
    ],
    acceptance_criteria: [
      'Decision is recorded by curriculum and assessment reviewers.',
      'Exclusion or feature rationale is versioned and auditable.',
      'Any required feature work is blocked from national claims until implemented and reviewed.',
      'Unsupported EPA claims are absent from learner-facing efficacy or assessment language.'
    ],
    review_submission_template: {
      epa_id: epa.id,
      review_id: '',
      decision: 'not_reviewed',
      reviewed_at: '',
      reviewed_by: WORKFLOW_REVIEW_ROLES.map((role) => ({
        role,
        name: '',
        institution: '',
        credential_or_position: ''
      })),
      exclusion_or_feature_rationale: '',
      restrictions_or_required_changes: [],
      signature_attestation: ''
    }
  };
}

function caseOutcomePacket(caseMeasurement) {
  return {
    id: `outcome_case_measurement_${caseMeasurement.case_id}`,
    packet_type: 'case_outcome_measurement_review',
    case_id: caseMeasurement.case_id,
    public_case_uid: caseMeasurement.public_case_uid || '',
    complaint: caseMeasurement.complaint || '',
    reference_esi: caseMeasurement.reference_esi,
    priority: Number(caseMeasurement.reference_esi) <= 2
      ? 'P0_high_acuity_outcome_measurement_review'
      : 'P1_case_outcome_measurement_review',
    review_status: 'pending_case_outcome_measurement_review',
    current_measurement_status: caseMeasurement.measurement_status,
    constructs_mapped: caseMeasurement.constructs_mapped || [],
    mapped_epas: caseMeasurement.mapped_epas || [],
    evidence_limits: caseMeasurement.evidence_limits || {},
    reviewer_roles_required: OUTCOME_REVIEW_ROLES,
    review_questions: [
      'Do the deterministic app signals validly represent this case clinical-reasoning construct?',
      'Which source-limited domains must be excluded from numeric learner outcome claims until case truth is adjudicated?',
      'Are high-risk undertriage, escalation, reassessment, and rationale-quality outcomes appropriately captured for this case?',
      'What faculty scoring anchors or example responses are required before pilot use?'
    ],
    acceptance_criteria: [
      'Case truth limitations are acknowledged in outcome interpretation.',
      'Source-limited metrics are flagged formative-only until adjudicated.',
      'High-risk safety outcomes are reviewed for ESI 1 and ESI 2 cases.',
      'Case outcome mapping is approved before inclusion in pilot or multi-site claims.'
    ]
  };
}

function metricValidationPacket(metric) {
  return {
    id: `outcome_metric_${metric.id}`,
    packet_type: 'educational_outcome_metric_review',
    metric_id: metric.id,
    construct: metric.construct,
    metric_status: metric.status,
    priority: metricPriority(metric),
    review_status: 'pending_metric_validity_and_calibration_review',
    app_signal: metric.app_signal,
    validation_need: metric.validation_need,
    reviewer_roles_required: OUTCOME_REVIEW_ROLES,
    claim_boundary: metric.status === 'requires_external_validation'
      ? 'May not support effectiveness, transfer, or hospital-performance claims until external validation is complete.'
      : 'May support formative instrumentation only until clinician-educator and measurement review is complete.',
    review_questions: [
      'Is this metric construct-relevant for medical-student emergency clinical reasoning?',
      'Is the app signal deterministic, reproducible, and privacy-safe enough for cohort export?',
      'What external benchmark, faculty rubric, or reliability evidence is required?',
      'How should this metric be interpreted when source-limited feedback or case-truth limitations are present?'
    ],
    acceptance_criteria: [
      'Metric definition, denominator, exclusions, and source-limited behavior are documented.',
      'Reviewers approve whether the metric is formative-only, pilot-ready, or externally validated.',
      'No metric is used for national efficacy claims until the relevant study packet is completed.',
      'Privacy review confirms the metric export omits direct identifiers and raw learner free text unless approved.'
    ]
  };
}

function studyPacket(studyPacketDefinition, validationStatus, runtimeReport) {
  const completedRows = (validationStatus.study_status || [])
    .filter((row) => studyPacketDefinition.acceptable_phases.includes(row.phase))
    .filter((row) => row.valid && row.supports_national_readiness_claim);
  return {
    id: `outcome_study_${studyPacketDefinition.id}`,
    packet_type: 'educational_outcome_study_evidence_packet',
    priority: studyPacketDefinition.id === 'multi_site_effectiveness_study'
      ? 'P0_national_effectiveness_evidence_required'
      : 'P1_outcome_study_required',
    review_status: completedRows.length
      ? 'study_evidence_submitted_needs_readiness_review'
      : 'pending_study_design_execution_and_review',
    acceptable_phases: studyPacketDefinition.acceptable_phases,
    minimum_sample_size: studyPacketDefinition.minimum_sample_size,
    required_before: studyPacketDefinition.required_before,
    evidence_target: studyPacketDefinition.evidence_target,
    current_valid_supporting_studies: completedRows.length,
    runtime_instrumentation_ready:
      Boolean(runtimeReport.summary?.all_probes_passed)
      && runtimeReport.summary?.privacy_disallowed_key_count === 0
      && runtimeReport.summary?.direct_identifier_value_count === 0,
    required_primary_outcomes: [
      'esi_accuracy',
      'undertriage_rate',
      'rationale_quality'
    ],
    required_safety_outcomes: [
      'dangerous_undertriage',
      'unsafe_disposition_reasoning',
      'unsupported_diagnostic_certainty'
    ],
    reviewer_roles_required: STUDY_REVIEW_ROLES,
    review_questions: [
      'Does the study design answer an educational-validity question that the app is allowed to claim?',
      'Are primary, safety, and transfer outcomes predefined and measured with privacy-safe exports?',
      'Are case-bundle version, source-bundle version, learner level, and source-limited feedback exposure tracked?',
      'Do the results support only formative, local pilot, national efficacy, or transfer claims?'
    ],
    acceptance_criteria: [
      'IRB, QI, privacy, or institutional governance status is recorded before data collection.',
      'Study rows include at least two credentialed reviewers including clinical education and measurement expertise.',
      'Completed studies include results, limitations, effect interpretation, and safety interpretation.',
      'No improved clinical-judgment, national-readiness, or hospital-performance claim is made without the matching valid study evidence.'
    ],
    study_submission_template: {
      study_id: '',
      phase: studyPacketDefinition.acceptable_phases[0],
      status: 'planned',
      title: '',
      institution_or_sites: [],
      design: '',
      sample_size: studyPacketDefinition.minimum_sample_size,
      primary_outcomes: [
        'esi_accuracy',
        'undertriage_rate',
        'rationale_quality'
      ],
      safety_outcomes: [
        'dangerous_undertriage',
        'unsafe_disposition_reasoning',
        'unsupported_diagnostic_certainty'
      ],
      analysis_plan: '',
      governance_approval: '',
      privacy_review: '',
      irb_or_qi_status: '',
      reviewed_by: STUDY_REVIEW_ROLES.map((role) => ({
        role,
        name: '',
        institution: '',
        credential_or_position: ''
      })),
      limitations: '',
      effect_interpretation: '',
      safety_interpretation: ''
    }
  };
}

function markdown(artifact) {
  const lines = [
    '# Educational Validity Review Packets',
    '',
    `Generated: ${artifact.generated_at}`,
    '',
    artifact.warning,
    '',
    '## Summary',
    '',
    `- Total review packets: ${artifact.summary.total_review_packets}`,
    `- Case curriculum mapping packets: ${artifact.summary.case_curriculum_mapping_packets}`,
    `- Workflow phase packets: ${artifact.summary.workflow_phase_review_packets}`,
    `- Unsupported EPA decision packets: ${artifact.summary.unsupported_epa_decision_packets}`,
    `- Case outcome measurement packets: ${artifact.summary.case_outcome_measurement_packets}`,
    `- Outcome metric packets: ${artifact.summary.outcome_metric_review_packets}`,
    `- Outcome study packets: ${artifact.summary.outcome_study_packets}`,
    `- All curriculum and outcome gaps packeted: ${artifact.summary.all_curriculum_outcome_gaps_packeted}`,
    `- Ready for national educational release from packets: ${artifact.summary.ready_for_national_educational_release_from_packets}`,
    '',
    '## Curriculum Case Queue',
    '',
    '| Priority | Case | ESI | EPAs | Review Decision |',
    '|---|---|---:|---:|---|',
    ...artifact.case_curriculum_mapping_packets.map((packet) =>
      `| ${packet.priority} | ${packet.case_id} | ${packet.reference_esi} | ${packet.mapped_epas.length} | ${packet.current_review_decision} |`
    ),
    '',
    '## Workflow And EPA Scope Queue',
    '',
    '| Packet | Type | Priority | Current Status | Required Roles |',
    '|---|---|---|---|---|',
    ...[
      ...artifact.workflow_phase_review_packets,
      ...artifact.unsupported_epa_decision_packets
    ].map((packet) =>
      `| ${packet.id} | ${packet.packet_type} | ${packet.priority} | ${packet.current_review_decision || packet.current_decision} | ${markdownEscape(packet.reviewer_roles_required.join(', '))} |`
    ),
    '',
    '## Outcome Measurement Queue',
    '',
    '| Packet | Type | Priority | Status | Validation Need |',
    '|---|---|---|---|---|',
    ...artifact.outcome_metric_review_packets.map((packet) =>
      `| ${packet.metric_id} | metric | ${packet.priority} | ${packet.metric_status} | ${markdownEscape(packet.validation_need)} |`
    ),
    '',
    '## Study Evidence Queue',
    '',
    '| Packet | Acceptable Phases | Minimum N | Required Before | Current Valid Studies |',
    '|---|---|---:|---|---:|',
    ...artifact.outcome_study_packets.map((packet) =>
      `| ${packet.id} | ${markdownEscape(packet.acceptable_phases.join(', '))} | ${packet.minimum_sample_size} | ${packet.required_before} | ${packet.current_valid_supporting_studies} |`
    ),
    '',
    '## Reviewer Output',
    '',
    'Completed reviews should be recorded in `docs/curriculum_mapping_reviews.json` and `docs/educational_outcome_studies.json` using the status artifacts templates. These packets are work assignments and do not constitute curriculum approval, educational effectiveness evidence, or national-readiness approval.'
  ];
  return `${lines.join('\n')}\n`;
}

const coreEpaCurriculumMap = readJson(CORE_EPA_CURRICULUM_MAP_PATH);
const curriculumReviewStatus = readJson(CURRICULUM_MAPPING_REVIEW_STATUS_PATH);
const outcomesFramework = readJson(EDUCATIONAL_OUTCOMES_FRAMEWORK_PATH);
const outcomesValidationStatus = readJson(EDUCATIONAL_OUTCOMES_VALIDATION_STATUS_PATH);
const outcomesRuntimeReport = readJson(EDUCATIONAL_OUTCOMES_RUNTIME_REPORT_PATH);

const curriculumStatusByCase = new Map(
  (curriculumReviewStatus.case_mapping_review_status || []).map((row) => [row.case_id, row])
);
const workflowStatusByPhase = new Map(
  (curriculumReviewStatus.workflow_phase_review_status || []).map((row) => [row.workflow_phase_id, row])
);
const unsupportedStatusByEpa = new Map(
  (curriculumReviewStatus.unsupported_epa_decision_status || []).map((row) => [row.epa_id, row])
);

const unsupportedEpas = (coreEpaCurriculumMap.core_epas || [])
  .filter((epa) => epa.app_alignment_status === 'not_currently_supported');

const caseCurriculumPackets = (coreEpaCurriculumMap.case_epa_map || [])
  .map((caseMapping) => caseCurriculumPacket(caseMapping, curriculumStatusByCase.get(caseMapping.case_id)));
const workflowPackets = (coreEpaCurriculumMap.workflow_phase_map || [])
  .map((phase) => workflowPhasePacket(phase, workflowStatusByPhase.get(phase.id)));
const unsupportedEpaPackets = unsupportedEpas
  .map((epa) => unsupportedEpaPacket(epa, unsupportedStatusByEpa.get(epa.id)));
const caseOutcomePackets = (outcomesFramework.case_measurement_map || []).map(caseOutcomePacket);
const metricPackets = (outcomesFramework.metric_definitions || []).map(metricValidationPacket);
const studyPackets = REQUIRED_STUDY_PACKETS.map((packet) =>
  studyPacket(packet, outcomesValidationStatus, outcomesRuntimeReport)
);

const totalReviewPackets = caseCurriculumPackets.length
  + workflowPackets.length
  + unsupportedEpaPackets.length
  + caseOutcomePackets.length
  + metricPackets.length
  + studyPackets.length;

const allCurriculumOutcomeGapsPacketed =
  caseCurriculumPackets.length === curriculumReviewStatus.summary.case_mappings_missing_review
  && workflowPackets.length === curriculumReviewStatus.summary.workflow_phases_missing_review
  && unsupportedEpaPackets.length === curriculumReviewStatus.summary.unsupported_epa_decisions_missing
  && caseOutcomePackets.length === outcomesFramework.summary.cases_mapped
  && metricPackets.length === outcomesFramework.summary.total_metrics
  && studyPackets.length === REQUIRED_STUDY_PACKETS.length;

const artifact = {
  schema_version: 'educational_validity_review_packets_v1',
  generated_at: new Date().toISOString(),
  review_status: 'educational_validity_review_packets_open_curriculum_and_outcome_review_required',
  warning: 'These packets operationalize curriculum, Core EPA, measurement, and outcomes-validation review work. They do not prove educational effectiveness, approve national curriculum use, or support claims that the simulator improves clinical judgment or hospital performance.',
  source_contract: {
    core_epa_curriculum_map_schema: coreEpaCurriculumMap.schema_version,
    core_epa_curriculum_map_path: 'docs/core_epa_curriculum_map.json',
    curriculum_mapping_review_status_schema: curriculumReviewStatus.schema_version,
    curriculum_mapping_review_status_path: 'docs/curriculum_mapping_review_status.json',
    educational_outcomes_framework_schema: outcomesFramework.schema_version,
    educational_outcomes_framework_path: 'docs/educational_outcomes_measurement_framework.json',
    educational_outcomes_validation_status_schema: outcomesValidationStatus.schema_version,
    educational_outcomes_validation_status_path: 'docs/educational_outcomes_validation_status.json',
    educational_outcomes_runtime_report_schema: outcomesRuntimeReport.schema_version,
    educational_outcomes_protocol_present: existsSync(EDUCATIONAL_OUTCOMES_PROTOCOL_PATH),
    packet_artifact_is_not_approval: true,
    improved_clinical_judgment_claim_allowed_without_studies: false
  },
  summary: {
    total_review_packets: totalReviewPackets,
    case_curriculum_mapping_packets: caseCurriculumPackets.length,
    workflow_phase_review_packets: workflowPackets.length,
    unsupported_epa_decision_packets: unsupportedEpaPackets.length,
    case_outcome_measurement_packets: caseOutcomePackets.length,
    outcome_metric_review_packets: metricPackets.length,
    outcome_study_packets: studyPackets.length,
    source_limited_metric_packets:
      metricPackets.filter((packet) => packet.metric_status === 'source_limited').length,
    external_validation_metric_packets:
      metricPackets.filter((packet) => packet.metric_status === 'requires_external_validation').length,
    pending_review_packets: totalReviewPackets,
    reviewed_review_packets: 0,
    curriculum_case_mappings_missing_review:
      curriculumReviewStatus.summary.case_mappings_missing_review,
    workflow_phases_missing_review:
      curriculumReviewStatus.summary.workflow_phases_missing_review,
    unsupported_epa_decisions_missing:
      curriculumReviewStatus.summary.unsupported_epa_decisions_missing,
    outcome_studies_submitted:
      outcomesValidationStatus.summary.submitted_studies,
    valid_outcome_studies:
      outcomesValidationStatus.summary.valid_studies,
    runtime_outcome_probes_passed:
      Boolean(outcomesRuntimeReport.summary?.all_probes_passed),
    runtime_privacy_export_clean:
      outcomesRuntimeReport.summary?.privacy_disallowed_key_count === 0
      && outcomesRuntimeReport.summary?.direct_identifier_value_count === 0,
    all_curriculum_outcome_gaps_packeted: allCurriculumOutcomeGapsPacketed,
    ready_for_national_educational_release_from_packets: false
  },
  packet_counts_by_type: countBy([
    ...caseCurriculumPackets,
    ...workflowPackets,
    ...unsupportedEpaPackets,
    ...caseOutcomePackets,
    ...metricPackets,
    ...studyPackets
  ], (packet) => packet.packet_type),
  packet_counts_by_priority: countBy([
    ...caseCurriculumPackets,
    ...workflowPackets,
    ...unsupportedEpaPackets,
    ...caseOutcomePackets,
    ...metricPackets,
    ...studyPackets
  ], (packet) => packet.priority),
  case_curriculum_mapping_packets: caseCurriculumPackets,
  workflow_phase_review_packets: workflowPackets,
  unsupported_epa_decision_packets: unsupportedEpaPackets,
  case_outcome_measurement_packets: caseOutcomePackets,
  outcome_metric_review_packets: metricPackets,
  outcome_study_packets: studyPackets,
  release_blockers: [
    {
      id: 'curriculum_mapping_reviews_pending',
      status: curriculumReviewStatus.summary.ready_for_national_curriculum_release ? 'cleared' : 'blocked',
      evidence: {
        case_mappings_missing_review:
          curriculumReviewStatus.summary.case_mappings_missing_review,
        workflow_phases_missing_review:
          curriculumReviewStatus.summary.workflow_phases_missing_review,
        unsupported_epa_decisions_missing:
          curriculumReviewStatus.summary.unsupported_epa_decisions_missing
      },
      required_to_clear:
        'Record valid curriculum case-mapping reviews, workflow-phase reviews, and unsupported-EPA scope decisions before Core EPA or national curriculum claims.'
    },
    {
      id: 'educational_outcome_studies_missing',
      status: outcomesValidationStatus.summary.ready_for_educational_validity_claims ? 'cleared' : 'blocked',
      evidence: {
        submitted_studies: outcomesValidationStatus.summary.submitted_studies,
        valid_studies: outcomesValidationStatus.summary.valid_studies,
        required_study_packets: studyPackets.length
      },
      required_to_clear:
        'Complete response-process, pilot, multi-site or stepped-wedge, and transfer validation evidence before improved-judgment or hospital-performance claims.'
    },
    {
      id: 'metric_and_case_outcome_review_pending',
      status: 'blocked',
      evidence: {
        case_outcome_measurement_packets: caseOutcomePackets.length,
        outcome_metric_review_packets: metricPackets.length,
        source_limited_metric_packets:
          metricPackets.filter((packet) => packet.metric_status === 'source_limited').length
      },
      required_to_clear:
        'Review every case outcome mapping and metric definition for construct validity, scoring anchors, source-limited behavior, and privacy-safe export.'
    }
  ],
  next_actions: [
    'Assign curriculum packets to clinical educator, simulation educator, and curriculum or clerkship director reviewers.',
    'Resolve unsupported EPA 11 and EPA 12 as explicit out-of-scope decisions or deliberate feature requirements.',
    'Review each outcome metric and case measurement map before using simulator data in pilot analyses.',
    'Record response-process, pilot, multi-site, and transfer studies in docs/educational_outcome_studies.json before making educational-efficacy claims.',
    'Keep the app framed as formative and developing until curriculum reviews and outcome-study evidence are valid.'
  ]
};

writeFileSync(JSON_OUTPUT_PATH, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
writeFileSync(MD_OUTPUT_PATH, markdown(artifact), 'utf8');

console.log(JSON.stringify({
  review_status: artifact.review_status,
  total_review_packets: artifact.summary.total_review_packets,
  case_curriculum_mapping_packets: artifact.summary.case_curriculum_mapping_packets,
  workflow_phase_review_packets: artifact.summary.workflow_phase_review_packets,
  unsupported_epa_decision_packets: artifact.summary.unsupported_epa_decision_packets,
  case_outcome_measurement_packets: artifact.summary.case_outcome_measurement_packets,
  outcome_metric_review_packets: artifact.summary.outcome_metric_review_packets,
  outcome_study_packets: artifact.summary.outcome_study_packets,
  all_curriculum_outcome_gaps_packeted: artifact.summary.all_curriculum_outcome_gaps_packeted,
  report_path: JSON_OUTPUT_PATH
}, null, 2));
