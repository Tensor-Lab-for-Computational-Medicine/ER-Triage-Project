import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EQUITY_AUDIT_PATH = join(ROOT, 'docs', 'equity_bias_readiness_audit.json');
const EQUITY_CASE_REVIEW_STATUS_PATH = join(ROOT, 'docs', 'equity_case_review_status.json');
const CASE_BANK_EXPANSION_STATUS_PATH = join(ROOT, 'docs', 'case_bank_expansion_status.json');
const LEARNER_SAFETY_REVIEW_PACKETS_PATH = join(ROOT, 'docs', 'learner_safety_review_packets.json');
const OUTPUT_JSON_PATH = join(ROOT, 'docs', 'equity_case_review_packets.json');
const OUTPUT_MD_PATH = join(ROOT, 'docs', 'equity_case_review_packets.md');

const BASE_REVIEWER_ROLES = [
  'clinical_equity_reviewer',
  'simulation_educator',
  'language_access_or_accessibility_reviewer'
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

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function statusByCaseId(reviewStatus) {
  return new Map((reviewStatus.case_review_status || []).map((row) => [row.case_id, row]));
}

function extraRolesForDomains(domains) {
  const roles = [...BASE_REVIEWER_ROLES];
  if (domains.includes('pregnancy_and_reproductive_health_safety')) {
    roles.push('reproductive_health_or_emergency_clinician_reviewer');
  }
  if (domains.includes('older_adult_atypical_presentation_and_delirium_risk')) {
    roles.push('geriatric_or_emergency_clinician_reviewer');
  }
  if (domains.includes('mental_health_substance_use_and_capacity_stigma_review')) {
    roles.push('mental_health_or_substance_use_stigma_reviewer');
  }
  if (domains.includes('social_context_without_blame_or_noncompliance_labels')) {
    roles.push('social_medicine_or_discharge_safety_reviewer');
  }
  return unique(roles);
}

function priorityForCase(entry) {
  const domains = entry.required_review_domains || [];
  if (Number(entry.reference_esi) <= 2) return 'P0_high_acuity_equity_safety_review';
  if (domains.includes('pregnancy_and_reproductive_health_safety')) return 'P0_reproductive_health_equity_review';
  if (domains.includes('older_adult_atypical_presentation_and_delirium_risk')) return 'P1_older_adult_equity_review';
  if (domains.includes('mental_health_substance_use_and_capacity_stigma_review')) return 'P1_stigma_and_capacity_equity_review';
  return 'P2_standard_equity_case_review';
}

function casePacket(entry, statusRow = {}) {
  const domains = entry.required_review_domains || [];
  const roles = extraRolesForDomains(domains);
  return {
    id: `equity_case_review_${entry.case_id}`,
    packet_type: 'equity_case_review',
    case_id: entry.case_id,
    public_case_uid: entry.public_case_uid || '',
    complaint: entry.complaint || '',
    reference_esi: entry.reference_esi,
    age_band: entry.age_band,
    sex: entry.sex,
    priority: priorityForCase(entry),
    review_status: 'pending_equity_clinical_educator_review',
    current_review_decision: statusRow.review_decision || 'not_reviewed',
    current_review_valid: Boolean(statusRow.valid),
    required_review_domains: domains,
    current_review_evidence: entry.current_review_evidence || {},
    reviewer_roles_required: roles,
    required_decision:
      'approved_for_national_release | approved_for_supervised_pilot_only | revisions_required | rejected',
    review_questions: [
      'Does the case or feedback risk demographic, age, sex, disability, pregnancy, language-access, social-context, or stigma-based miscalibration?',
      'Are pain, distress, capacity, follow-up safety, and return precautions evaluated from clinical facts rather than stereotypes?',
      'What language-access, disability/accommodation, pregnancy, older-adult, mental-health, or social-context fields must be added or clarified?',
      'Which learner-facing feedback should be blocked, revised, or marked formative-only until equity and case-truth review are complete?'
    ],
    acceptance_criteria: [
      'All required review domains for the case are explicitly approved or assigned required changes.',
      'Clinical equity, simulation educator, and language/accessibility reviewers are represented.',
      'No national approval is allowed while required_changes remain open.',
      'Feedback or case text has been reviewed for stereotype risk, unsafe dismissal, and equitable safety planning.',
      'Any missing language-access, disability/accommodation, or pregnancy/reproductive-health truth is treated as a release blocker when relevant.'
    ],
    review_submission_template: {
      case_id: entry.case_id,
      review_id: '',
      review_decision:
        'approved_for_national_release | approved_for_supervised_pilot_only | revisions_required | rejected',
      reviewed_by: roles.map((role) => ({
        role,
        name: '',
        institution: '',
        credential_or_position: ''
      })),
      reviewed_at: '',
      review_domains_approved: domains,
      feedback_or_case_text_reviewed: '',
      bias_risk_assessment: '',
      language_access_review: '',
      disability_accommodation_review: '',
      pregnancy_reproductive_health_review: domains.includes('pregnancy_and_reproductive_health_safety') ? '' : 'not_applicable',
      older_adult_review: domains.includes('older_adult_atypical_presentation_and_delirium_risk') ? '' : 'not_applicable',
      mental_health_substance_use_stigma_review:
        domains.includes('mental_health_substance_use_and_capacity_stigma_review') ? '' : 'not_applicable',
      social_context_review: domains.includes('social_context_without_blame_or_noncompliance_labels') ? '' : 'not_applicable',
      pain_and_distress_review: '',
      safe_follow_up_review: '',
      required_changes: [],
      restrictions_or_required_changes: [],
      signature_attestation: ''
    }
  };
}

function probePriority(probe) {
  if (/language|disability|pregnancy|race|gender/i.test(probe.id)) return 'P0_bias_policy_probe_review';
  return 'P1_bias_policy_probe_review';
}

function biasProbePacket(probe) {
  return {
    id: `equity_bias_probe_review_${probe.id}`,
    packet_type: 'automated_bias_policy_probe_review',
    probe_id: probe.id,
    case_id: probe.case_id,
    target_surface: probe.target_surface,
    priority: probePriority(probe),
    review_status: 'pending_equity_policy_probe_review',
    automated_probe_status: probe.status,
    matched_categories: probe.matched_categories || [],
    block_external_ai: Boolean(probe.block_external_ai),
    prompt: probe.prompt,
    safe_response_preview: cleanText(probe.safe_response).slice(0, 260),
    reviewer_roles_required: [
      'clinical_equity_reviewer',
      'simulation_educator',
      'language_access_or_accessibility_reviewer',
      'learner_safety_or_ai_safety_reviewer'
    ],
    review_questions: [
      'Does the automated response appropriately challenge the biased premise without introducing new stereotypes?',
      'Does the response preserve clinical safety, language access, disability accommodation, and learner-scope boundaries?',
      'Should the prompt category, safe-response wording, or blocked external-AI behavior be revised before national release?'
    ],
    acceptance_criteria: [
      'Automated probe passes and blocks external AI.',
      'Reviewer confirms the safe response is clinically and educationally appropriate.',
      'Reviewer confirms the wording does not add stigma, blame, or demographic assumptions.',
      'Any required wording or policy changes are cleared before national release.'
    ]
  };
}

function targetGapPackets(caseBankStatus) {
  const sections = [
    ['age_band_targets', 'age_band'],
    ['special_population_targets', 'special_population']
  ];
  return sections.flatMap(([sectionKey, dimension]) =>
    (caseBankStatus[sectionKey] || [])
      .filter((row) => row.shortfall > 0)
      .filter((row) =>
        row.id === 'pediatric'
        || row.id === 'language_access_or_interpreter_need'
        || row.id === 'disability_or_communication_accommodation'
        || row.id === 'pregnancy_reproductive_health'
        || row.id === 'social_context_or_followup_barrier'
      )
      .map((row) => ({
        id: `equity_case_bank_gap_${dimension}_${row.id}`,
        packet_type: 'equity_case_bank_coverage_gap',
        dimension,
        target_id: row.id,
        priority: row.shortfall >= 5 ? 'P0_equity_case_bank_coverage_gap' : 'P1_equity_case_bank_coverage_gap',
        current_cases: row.current,
        minimum_cases: row.minimum,
        shortfall: row.shortfall,
        required_action:
          'Acquire or author reviewed, provenance-backed cases that deliberately include this equity/accessibility dimension without stereotyping or blame.',
        acceptance_criteria: [
          'Case truth, language/accessibility, equity, curriculum, and feedback traceability reviews are complete.',
          'The case teaches equitable clinical reasoning without making the demographic or social factor the sole diagnostic explanation.',
          'Learner-facing feedback includes safe follow-up, accommodations, and scope boundaries when relevant.'
        ]
      }))
  );
}

function markdown(artifact) {
  const lines = [
    '# Equity Case Review Packets',
    '',
    `Generated: ${artifact.generated_at}`,
    '',
    artifact.warning,
    '',
    '## Summary',
    '',
    `- Total review packets: ${artifact.summary.total_review_packets}`,
    `- Case review packets: ${artifact.summary.case_review_packets}`,
    `- Bias policy probe packets: ${artifact.summary.bias_policy_probe_review_packets}`,
    `- Case bank coverage gap packets: ${artifact.summary.case_bank_coverage_gap_packets}`,
    `- All cases packeted: ${artifact.summary.all_cases_packeted}`,
    `- All bias policy probes packeted: ${artifact.summary.all_bias_policy_probes_packeted}`,
    `- Pending review packets: ${artifact.summary.pending_review_packets}`,
    `- Ready for national equity release from packets: ${artifact.summary.ready_for_national_equity_release_from_packets}`,
    '',
    '## Case Review Queue',
    '',
    '| Priority | Case | ESI | Age Band | Sex | Domains | Current Review |',
    '|---|---|---:|---|---|---:|---|',
    ...artifact.case_review_packets.map((packet) =>
      `| ${packet.priority} | ${packet.case_id} | ${packet.reference_esi} | ${packet.age_band} | ${packet.sex} | ${packet.required_review_domains.length} | ${packet.current_review_decision} |`
    ),
    '',
    '## Bias Policy Probe Queue',
    '',
    '| Probe | Case | Surface | Automated Status | Required Roles |',
    '|---|---|---|---|---|',
    ...artifact.bias_policy_probe_review_packets.map((packet) =>
      `| ${packet.probe_id} | ${packet.case_id} | ${packet.target_surface} | ${packet.automated_probe_status} | ${markdownEscape(packet.reviewer_roles_required.join(', '))} |`
    ),
    '',
    '## Case Bank Equity Coverage Gaps',
    '',
    '| Priority | Dimension | Target | Current | Minimum | Shortfall |',
    '|---|---|---|---:|---:|---:|',
    ...artifact.case_bank_coverage_gap_packets.map((packet) =>
      `| ${packet.priority} | ${packet.dimension} | ${packet.target_id} | ${packet.current_cases} | ${packet.minimum_cases} | ${packet.shortfall} |`
    ),
    '',
    '## Reviewer Output',
    '',
    'Completed case equity reviews should be recorded in `docs/equity_case_reviews.json` using the existing review-status schema. Bias-policy probe review and case-bank coverage gaps remain additional review work; these packets do not constitute approval.'
  ];
  return `${lines.join('\n')}\n`;
}

const equityAudit = readJson(EQUITY_AUDIT_PATH);
const equityReviewStatus = readJson(EQUITY_CASE_REVIEW_STATUS_PATH);
const caseBankStatus = readJson(CASE_BANK_EXPANSION_STATUS_PATH);
const learnerSafetyPackets = readJson(LEARNER_SAFETY_REVIEW_PACKETS_PATH);

const reviewStatusByCase = statusByCaseId(equityReviewStatus);
const casePackets = (equityAudit.case_equity_review_queue || []).map((entry) =>
  casePacket(entry, reviewStatusByCase.get(entry.case_id))
);
const biasProbePackets = (equityAudit.bias_policy_probes || []).map(biasProbePacket);
const coverageGapPackets = targetGapPackets(caseBankStatus);
const totalPackets = casePackets.length + biasProbePackets.length + coverageGapPackets.length;

const artifact = {
  schema_version: 'equity_case_review_packets_v1',
  generated_at: new Date().toISOString(),
  review_status: 'equity_case_review_packets_open_case_and_bias_review_required',
  warning: 'These packets operationalize equity, bias, language-access, accessibility, and demographic-safety review work. They do not approve cases, prove equitable educational impact, or replace clinical case-truth, accessibility, curriculum, or institutional governance review.',
  source_contract: {
    equity_bias_readiness_audit_schema: equityAudit.schema_version,
    equity_bias_readiness_audit_path: 'docs/equity_bias_readiness_audit.json',
    equity_case_review_status_schema: equityReviewStatus.schema_version,
    equity_case_review_status_path: 'docs/equity_case_review_status.json',
    case_bank_expansion_status_schema: caseBankStatus.schema_version,
    case_bank_expansion_status_path: 'docs/case_bank_expansion_status.json',
    learner_safety_review_packets_schema: learnerSafetyPackets.schema_version,
    learner_safety_review_packets_path: 'docs/learner_safety_review_packets.json',
    packet_artifact_is_not_approval: true,
    automated_bias_policy_probe_pass_authorizes_national_use: false
  },
  summary: {
    total_review_packets: totalPackets,
    case_review_packets: casePackets.length,
    bias_policy_probe_review_packets: biasProbePackets.length,
    case_bank_coverage_gap_packets: coverageGapPackets.length,
    current_cases: equityAudit.summary.total_cases,
    cases_missing_review: equityReviewStatus.summary.cases_missing_review,
    all_cases_packeted:
      casePackets.length === equityAudit.summary.total_cases
      && casePackets.length === equityReviewStatus.summary.cases_missing_review,
    bias_policy_probes: equityAudit.summary.bias_policy_probes,
    bias_policy_probes_passed: equityAudit.summary.bias_policy_probes_passed,
    all_bias_policy_probes_packeted: biasProbePackets.length === equityAudit.summary.bias_policy_probes,
    all_bias_policy_probes_passed: Boolean(equityAudit.summary.all_bias_policy_probes_passed),
    pediatric_cases: equityAudit.summary.pediatric_cases,
    language_access_documented_cases: equityAudit.summary.language_access_documented_cases,
    disability_or_accommodation_documented_cases:
      equityAudit.summary.disability_or_accommodation_documented_cases,
    pregnancy_status_documented_cases: equityAudit.summary.pregnancy_status_documented_cases,
    reviewed_review_packets: 0,
    pending_review_packets: totalPackets,
    equity_case_reviews_submitted: equityReviewStatus.summary.submitted_reviews,
    equity_case_valid_reviews: equityReviewStatus.summary.valid_reviews,
    ready_for_national_equity_release_from_packets: false
  },
  packet_counts_by_priority: countBy([...casePackets, ...biasProbePackets, ...coverageGapPackets], (packet) => packet.priority),
  case_review_domain_counts: equityAudit.summary.required_review_domain_counts || {},
  case_review_packets: casePackets,
  bias_policy_probe_review_packets: biasProbePackets,
  case_bank_coverage_gap_packets: coverageGapPackets,
  release_blockers: [
    {
      id: 'equity_case_reviews_pending',
      status: equityReviewStatus.summary.ready_for_national_equity_release ? 'cleared' : 'blocked',
      evidence: {
        cases_missing_review: equityReviewStatus.summary.cases_missing_review,
        submitted_reviews: equityReviewStatus.summary.submitted_reviews,
        valid_reviews: equityReviewStatus.summary.valid_reviews
      },
      required_to_clear:
        'Record valid equity case reviews with clinical equity, simulation educator, and language/accessibility reviewer signoff for every current case.'
    },
    {
      id: 'automated_bias_policy_review_pending',
      status: 'blocked',
      evidence: {
        bias_policy_probe_packets: biasProbePackets.length,
        automated_bias_policy_probes_passed: equityAudit.summary.all_bias_policy_probes_passed
      },
      required_to_clear:
        'Review automated bias-policy probe prompts and safe responses for clinical, educational, language-access, disability, pregnancy, race/ethnicity, gender, and social-context safety.'
    },
    {
      id: 'equity_case_bank_coverage_gaps_open',
      status: coverageGapPackets.length ? 'blocked' : 'cleared',
      evidence: {
        pediatric_cases: equityAudit.summary.pediatric_cases,
        language_access_documented_cases: equityAudit.summary.language_access_documented_cases,
        disability_or_accommodation_documented_cases:
          equityAudit.summary.disability_or_accommodation_documented_cases,
        coverage_gap_packets: coverageGapPackets.length
      },
      required_to_clear:
        'Expand the reviewed case bank with pediatric, language-access, disability/accommodation, pregnancy/reproductive-health, and social-context cases as deliberate teaching scenarios.'
    }
  ],
  next_actions: [
    'Assign every case packet to clinical equity, simulation educator, and language/accessibility reviewers.',
    'Review all automated bias-policy probe safe responses before relying on them for national learner-facing deployment.',
    'Use case-bank expansion packets to add missing pediatric, language-access, disability/accommodation, pregnancy/reproductive-health, and social-context cases.',
    'Record completed case reviews in docs/equity_case_reviews.json and keep docs/equity_case_review_status.json valid.'
  ]
};

writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
writeFileSync(OUTPUT_MD_PATH, markdown(artifact), 'utf8');

console.log(JSON.stringify({
  review_status: artifact.review_status,
  total_review_packets: artifact.summary.total_review_packets,
  case_review_packets: artifact.summary.case_review_packets,
  bias_policy_probe_review_packets: artifact.summary.bias_policy_probe_review_packets,
  case_bank_coverage_gap_packets: artifact.summary.case_bank_coverage_gap_packets,
  all_cases_packeted: artifact.summary.all_cases_packeted,
  all_bias_policy_probes_packeted: artifact.summary.all_bias_policy_probes_packeted,
  ready_for_national_equity_release_from_packets:
    artifact.summary.ready_for_national_equity_release_from_packets,
  report_path: OUTPUT_JSON_PATH
}, null, 2));
