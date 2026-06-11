import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CASES_PATH = join(ROOT, 'frontend', 'src', 'data', 'cases.json');
const OUTPUT_PATH = join(ROOT, 'docs', 'case_truth_review_packets.json');
const OUTPUT_MD_PATH = join(ROOT, 'docs', 'case_truth_review_packets.md');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function roundAge(value) {
  const age = Number(value);
  return Number.isFinite(age) ? Math.round(age) : null;
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
  ]);
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
  ]);
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

function triageRiskPriority(caseRecord) {
  const acuity = Number(caseRecord.acuity);
  const outcomes = caseRecord.source?.outcomes || {};
  const interventions = caseRecord.source?.interventions || caseRecord.interventions || {};
  const criticalOutcome = Object.entries(outcomes).some(([key, value]) => value === true && /(icu|surgery|expired|transfusion|ventilation)/i.test(key));
  const criticalIntervention = Boolean(
    interventions.critical_procedure
      || interventions.tier1_med_usage_1h
      || caseRecord.non_invasive_ventilation
      || caseRecord.invasive_ventilation_beyond_1h
      || caseRecord.intraosseous_line_placed
  );
  if (acuity <= 1 || criticalOutcome || criticalIntervention) return 'P1_resuscitation_or_time_critical_truth_review';
  if (acuity === 2) return 'P2_high_risk_truth_review';
  if (acuity === 3) return 'P3_resource_prediction_truth_review';
  return 'P4_lower_acuity_truth_review';
}

function missingTruthFields(caseRecord) {
  const missing = [];
  if (!hasSourceRecordDiagnosis(caseRecord)) missing.push('source_record_diagnosis');
  if (!hasClinicianApprovedReferral(caseRecord)) missing.push('clinician_approved_referral_or_consult_truth');
  if (!hasRetrospectiveTruth(caseRecord)) missing.push('retrospective_ground_truth');
  if (!hasOptionalObjectiveData(caseRecord)) missing.push('optional_objective_data_truth');
  return missing;
}

function compactEvidence(caseRecord, domains) {
  return (caseRecord.documented_evidence || [])
    .filter((item) => domains.includes(item.domain))
    .map((item) => ({
      domain: item.domain,
      statement: cleanText(item.statement),
      source_field: item.source_field,
      confidence: item.confidence
    }));
}

function simulationRevealScaffolds(caseRecord) {
  return (caseRecord.simulation_reveal_data || []).map((item) => ({
    id: item.id || '',
    domain: item.domain || '',
    covers_domains: item.covers_domains || [],
    label: cleanText(item.label),
    availability: item.availability || '',
    value: cleanText(item.value),
    source_basis: item.source_basis || '',
    display_policy: item.display_policy || '',
    review_status: item.review_status || 'missing',
    limitation: cleanText(item.limitation)
  }));
}

function sourceLimitationsToAdjudicate(caseRecord) {
  const scaffolds = simulationRevealScaffolds(caseRecord);
  return (caseRecord.missing_evidence || []).map((item) => {
    const matchingScaffolds = scaffolds.filter((scaffold) =>
      scaffold.domain === item.domain || scaffold.covers_domains.includes(item.domain)
    );
    return {
      domain: item.domain || '',
      needed_for: cleanText(item.needed_for),
      reason: cleanText(item.reason),
      simulation_scaffold_available: matchingScaffolds.length > 0,
      simulation_scaffold_ids: matchingScaffolds.map((scaffold) => scaffold.id).filter(Boolean),
      required_review_decision: 'confirm_source_truth | approve_scaffold_for_formative_use | revise_scaffold | retire_scaffold'
    };
  });
}

function narrativeAgeSignals(caseRecord) {
  const sourceAge = roundAge(caseRecord.demographics?.age ?? caseRecord.source?.age);
  const narrative = `${caseRecord.history || ''} ${caseRecord.source?.triage_narrative || ''}`;
  const ages = [...new Set([...narrative.matchAll(/\b(\d{1,3})\s*[- ]year[- ]old\b/gi)]
    .map((match) => Number(match[1]))
    .filter((age) => Number.isFinite(age) && age > 0 && age < 120))];
  const mismatch = sourceAge !== null && ages.some((age) => Math.abs(age - sourceAge) > 1);
  return {
    source_age: sourceAge,
    narrative_age_mentions: ages,
    source_narrative_age_mismatch: mismatch
  };
}

function riskReviewFlags(caseRecord) {
  const flags = [];
  const source = caseRecord.source || {};
  const acuity = Number(caseRecord.acuity ?? source.reference_esi);
  const resourceSignals = source.resource_signals || {};
  const outcomes = source.outcomes || {};
  const interventions = source.interventions || caseRecord.interventions || {};
  const ageSignals = narrativeAgeSignals(caseRecord);

  if (acuity <= 2) {
    flags.push({
      id: 'high_acuity_case',
      value: `ESI ${acuity}`,
      reviewer_prompt: 'Confirm stabilization priorities, unsafe delays, and whether the ESI label remains appropriate for the public scenario.'
    });
  }
  if (caseRecord.disposition === 'ADMITTED' || source.disposition === 'ADMITTED') {
    flags.push({
      id: 'admitted_disposition',
      value: 'ADMITTED',
      reviewer_prompt: 'Confirm disposition truth and the minimum learner handoff elements for admission.'
    });
  }
  if (Number(resourceSignals.resources_used ?? caseRecord.resources_used) >= 4) {
    flags.push({
      id: 'high_resource_utilization',
      value: String(resourceSignals.resources_used ?? caseRecord.resources_used),
      reviewer_prompt: 'Confirm expected resource profile and whether resource prediction feedback should be case-specific or range-based.'
    });
  }
  if (source.adjudication?.primary_reviewer_disagreement) {
    flags.push({
      id: 'source_esi_reviewer_disagreement',
      value: source.adjudication.rule || 'primary reviewer disagreement',
      reviewer_prompt: 'Review ESI rationale carefully because the source adjudication required disagreement resolution.'
    });
  }
  if (Object.entries(outcomes).some(([, value]) => value === true)) {
    flags.push({
      id: 'positive_outcome_flag',
      value: Object.entries(outcomes).filter(([, value]) => value === true).map(([key]) => key).join(', '),
      reviewer_prompt: 'Confirm outcome timing and whether it should shape reassessment or disposition teaching.'
    });
  }
  if (Object.entries(interventions).some(([, value]) => value === true)) {
    flags.push({
      id: 'documented_intervention_flags',
      value: Object.entries(interventions).filter(([, value]) => value === true).map(([key]) => key).join(', '),
      reviewer_prompt: 'Confirm which interventions are expected learner actions versus observed historical utilization.'
    });
  }
  if (ageSignals.source_narrative_age_mismatch) {
    flags.push({
      id: 'source_narrative_age_mismatch',
      value: `source age ${ageSignals.source_age}; narrative mentions ${ageSignals.narrative_age_mentions.join(', ')}`,
      reviewer_prompt: 'Resolve age mismatch before national release or explain which age should be displayed.'
    });
  }
  return flags;
}

function truthDecisionPrompts(missingFields) {
  const promptByField = {
    source_record_diagnosis: 'Record the best adjudicated diagnosis and acceptable differential diagnoses; keep draft working diagnoses out of summative scoring until approved.',
    clinician_approved_referral_or_consult_truth: 'Decide whether consultation, admission service, transfer, or discharge follow-up should be considered correct for this case.',
    retrospective_ground_truth: 'Confirm source-record outcome truth, timing, disposition rationale, and any critical escalation triggers.',
    optional_objective_data_truth: 'Specify objective data that may be revealed on learner request, including normal/negative findings that are safe to disclose.'
  };
  return missingFields.map((field) => ({
    field,
    reviewer_prompt: promptByField[field] || 'Complete clinician adjudication before national release.'
  }));
}

function reviewPacket(caseRecord) {
  const source = caseRecord.source || {};
  const resourceSignals = source.resource_signals || {};
  const outcomes = source.outcomes || {};
  const interventions = source.interventions || caseRecord.interventions || {};
  const missingFields = missingTruthFields(caseRecord);
  const sourceLimitations = sourceLimitationsToAdjudicate(caseRecord);
  const revealScaffolds = simulationRevealScaffolds(caseRecord);
  const reviewFlags = riskReviewFlags(caseRecord);

  return {
    case_id: caseRecord.id,
    public_case_uid: source.public_case_uid || '',
    review_status: 'draft_review_queue_needs_clinician_adjudication',
    priority: triageRiskPriority(caseRecord),
    missing_truth_fields: missingFields,
    case_snapshot: {
      age: roundAge(caseRecord.demographics?.age ?? source.age),
      sex: caseRecord.demographics?.sex || source.sex || '',
      arrival_transport: caseRecord.demographics?.transport || source.arrival_transport || '',
      complaint: cleanText(caseRecord.complaint || source.chief_complaint),
      triage_narrative: cleanText(caseRecord.history || source.triage_narrative),
      vitals: caseRecord.vitals || source.vitals || {},
      disposition: caseRecord.disposition || source.disposition || '',
      reference_esi_from_source: Number(caseRecord.acuity || source.reference_esi || 0)
    },
    source_basis_to_preserve: {
      dataset: source.dataset || '',
      documented_evidence: compactEvidence(caseRecord, [
        'demographics',
        'chief_complaint',
        'triage_narrative',
        'vitals',
        'reference_esi',
        'disposition',
        'resources',
        'interventions',
        'adjudication'
      ]),
      resource_signals: {
        lab_event_count: resourceSignals.lab_event_count ?? caseRecord.lab_event_count ?? null,
        microbio_event_count: resourceSignals.microbio_event_count ?? caseRecord.microbio_event_count ?? null,
        exam_count: resourceSignals.exam_count ?? caseRecord.exam_count ?? null,
        consults_count: resourceSignals.consults_count ?? caseRecord.consults_count ?? null,
        procedure_count: resourceSignals.procedure_count ?? caseRecord.procedure_count ?? null,
        resources_used: resourceSignals.resources_used ?? caseRecord.resources_used ?? null
      },
      interventions,
      outcomes,
      esi_adjudication: source.adjudication || null
    },
    source_limitations_to_adjudicate: sourceLimitations,
    simulation_reveal_scaffolds_to_review: revealScaffolds,
    review_risk_flags: reviewFlags,
    truth_decision_prompts: truthDecisionPrompts(missingFields),
    age_consistency_check: narrativeAgeSignals(caseRecord),
    draft_augmentation_to_review_not_treat_as_truth: {
      review_status: caseRecord.augmentation?.review_status || 'missing',
      likely_working_diagnosis: cleanText(caseRecord.augmentation?.likely_working_diagnosis || ''),
      ddx: (caseRecord.augmentation?.ddx || []).map((item) => ({
        diagnosis: cleanText(item.diagnosis),
        support: cleanText(item.support),
        against_or_missing: cleanText(item.against_or_missing),
        next_discriminator: cleanText(item.next_discriminator)
      })),
      teaching_points: (caseRecord.augmentation?.teaching_points || []).map(cleanText)
    },
    clinician_adjudication_required: {
      reference_esi_confirmation: 'pending',
      source_record_or_best_adjudicated_diagnosis: 'pending',
      acceptable_differential_diagnoses: 'pending',
      consult_or_referral_truth: 'pending',
      immediate_stabilization_priorities: 'pending',
      expected_resource_profile: 'pending',
      objective_data_to_reveal_if_requested: 'pending',
      reassessment_and_escalation_triggers: 'pending',
      disposition_truth_and_rationale: 'pending',
      unsafe_or_misleading_feedback_to_block: 'pending',
      equity_bias_and_language_notes: 'pending'
    },
    educator_validation_required: {
      intended_learner_level: 'pending',
      clinical_reasoning_objectives_supported: 'pending',
      common_error_patterns_to_teach: 'pending',
      debrief_feedback_points: 'pending',
      assessment_rubric_alignment: 'pending'
    }
  };
}

function markdownEscape(value) {
  return cleanText(value).replaceAll('|', '\\|');
}

function packetMarkdown(artifact) {
  const lines = [
    '# Case Truth Review Packets',
    '',
    `Generated: ${artifact.generated_at}`,
    '',
    artifact.warning,
    '',
    '## Summary',
    '',
    `- Total packets: ${artifact.summary.total_packets}`,
    `- Pending case truth packets: ${artifact.summary.pending_case_truth_packets}`,
    `- Source limitations packeted: ${artifact.summary.source_limitations_packeted}`,
    `- Simulation reveal scaffolds packeted: ${artifact.summary.simulation_reveal_scaffolds_packeted}`,
    `- Packets with all source limitations scaffolded: ${artifact.summary.packets_with_all_source_limitations_scaffolded}`,
    `- Packets with unscaffolded source limitations: ${artifact.summary.packets_with_unscaffolded_source_limitations}`,
    `- Packets with source/narrative age mismatch: ${artifact.summary.packets_with_source_narrative_age_mismatch}`,
    `- Packets with source ESI reviewer disagreement: ${artifact.summary.packets_with_source_esi_reviewer_disagreement}`,
    '',
    '## Review Queue',
    '',
    '| Priority | Case | Complaint | Missing truth fields | Source limitations | Reveal scaffolds | Risk flags |',
    '|---|---|---|---:|---:|---:|---:|',
    ...artifact.case_review_packets.map((packet) =>
      `| ${packet.priority} | ${packet.case_id} | ${markdownEscape(packet.case_snapshot.complaint)} | ${packet.missing_truth_fields.length} | ${packet.source_limitations_to_adjudicate.length} | ${packet.simulation_reveal_scaffolds_to_review.length} | ${packet.review_risk_flags.length} |`
    ),
    '',
    '## Guardrail',
    '',
    'These packets are reviewer inputs only. Source limitations and simulation reveal scaffolds must not be treated as diagnosis, consult, objective-data, or disposition truth until completed clinician and educator adjudications are recorded.'
  ];
  return `${lines.join('\n')}\n`;
}

const cases = readJson(CASES_PATH);
const packets = cases.map(reviewPacket);
const missingCounts = packets.reduce((acc, packet) => {
  for (const field of packet.missing_truth_fields) {
    acc[field] = (acc[field] || 0) + 1;
  }
  return acc;
}, {});
const priorityCounts = packets.reduce((acc, packet) => {
  acc[packet.priority] = (acc[packet.priority] || 0) + 1;
  return acc;
}, {});
const sourceLimitationsPacketed = packets.reduce((sum, packet) => sum + packet.source_limitations_to_adjudicate.length, 0);
const revealScaffoldsPacketed = packets.reduce((sum, packet) => sum + packet.simulation_reveal_scaffolds_to_review.length, 0);
const packetsWithAllSourceLimitationsScaffolded = packets.filter((packet) =>
  packet.source_limitations_to_adjudicate.length > 0
    && packet.source_limitations_to_adjudicate.every((item) => item.simulation_scaffold_available)
).length;
const packetsWithUnscaffoldedSourceLimitations = packets.filter((packet) =>
  packet.source_limitations_to_adjudicate.some((item) => !item.simulation_scaffold_available)
).length;
const packetsWithAgeMismatch = packets.filter((packet) => packet.age_consistency_check.source_narrative_age_mismatch).length;
const packetsWithReviewerDisagreement = packets.filter((packet) =>
  packet.review_risk_flags.some((flag) => flag.id === 'source_esi_reviewer_disagreement')
).length;
const packetsWithHighAcuityOrCriticalOutcome = packets.filter((packet) =>
  packet.review_risk_flags.some((flag) => ['high_acuity_case', 'positive_outcome_flag'].includes(flag.id))
).length;
const decisionPromptCount = packets.reduce((sum, packet) => sum + packet.truth_decision_prompts.length, 0);

const artifact = {
  schema_version: 'case_truth_review_packets_v1',
  generated_at: new Date().toISOString(),
  review_status: 'draft_review_queue_needs_clinician_adjudication',
  warning: 'These packets organize public case evidence for clinician and educator review. Pending fields must not be treated as medical truth or national-scale readiness evidence.',
  review_template: {
    minimum_reviewers_per_case: 2,
    adjudication_required_when_disagreement: true,
    required_clinician_fields: [
      'reference_esi_confirmation',
      'source_record_or_best_adjudicated_diagnosis',
      'acceptable_differential_diagnoses',
      'consult_or_referral_truth',
      'immediate_stabilization_priorities',
      'expected_resource_profile',
      'objective_data_to_reveal_if_requested',
      'reassessment_and_escalation_triggers',
      'disposition_truth_and_rationale',
      'unsafe_or_misleading_feedback_to_block',
      'equity_bias_and_language_notes'
    ],
    required_educator_fields: [
      'intended_learner_level',
      'clinical_reasoning_objectives_supported',
      'common_error_patterns_to_teach',
      'debrief_feedback_points',
      'assessment_rubric_alignment'
    ]
  },
  summary: {
    total_packets: packets.length,
    reviewed_case_truth_packets: 0,
    pending_case_truth_packets: packets.length,
    missing_truth_field_counts: missingCounts,
    priority_counts: priorityCounts,
    source_limitations_packeted: sourceLimitationsPacketed,
    simulation_reveal_scaffolds_packeted: revealScaffoldsPacketed,
    packets_with_all_source_limitations_scaffolded: packetsWithAllSourceLimitationsScaffolded,
    packets_with_unscaffolded_source_limitations: packetsWithUnscaffoldedSourceLimitations,
    packets_with_source_narrative_age_mismatch: packetsWithAgeMismatch,
    packets_with_source_esi_reviewer_disagreement: packetsWithReviewerDisagreement,
    packets_with_high_acuity_or_critical_outcome: packetsWithHighAcuityOrCriticalOutcome,
    truth_decision_prompt_count: decisionPromptCount,
    review_packet_scaffold_completeness_ready:
      packets.length > 0
        && sourceLimitationsPacketed > 0
        && packetsWithUnscaffoldedSourceLimitations === 0
        && decisionPromptCount >= packets.length
  },
  case_review_packets: packets
};

writeFileSync(OUTPUT_PATH, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
writeFileSync(OUTPUT_MD_PATH, packetMarkdown(artifact), 'utf8');
console.log(`Wrote ${packets.length} draft case truth review packets to ${OUTPUT_PATH}`);
