import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CASE_BANK_EXPANSION_STATUS_PATH = join(ROOT, 'docs', 'case_bank_expansion_status.json');
const CASE_GENERATION_QUALITY_REPORT_PATH = join(ROOT, 'docs', 'case_generation_quality_report.json');
const EQUITY_BIAS_AUDIT_PATH = join(ROOT, 'docs', 'equity_bias_readiness_audit.json');
const OUTPUT_JSON_PATH = join(ROOT, 'docs', 'case_bank_expansion_packets.json');
const OUTPUT_MD_PATH = join(ROOT, 'docs', 'case_bank_expansion_packets.md');

const TARGET_SECTIONS = [
  { key: 'acuity_targets', dimension: 'acuity', label: 'ESI acuity' },
  { key: 'age_band_targets', dimension: 'age_band', label: 'Age band' },
  { key: 'special_population_targets', dimension: 'special_population', label: 'Special population' },
  { key: 'presentation_targets', dimension: 'presentation', label: 'Presentation family' }
];

const REVIEW_ROLES = [
  'emergency_clinician_case_truth_reviewer',
  'simulation_educator',
  'medical_librarian_or_evidence_reviewer',
  'equity_and_accessibility_reviewer',
  'curriculum_or_core_epa_reviewer'
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

function expandedDeficitList(rows) {
  return rows.flatMap((row) => Array.from({ length: row.shortfall }, () => row.id));
}

function priorityForGap(dimension, shortfall) {
  if (dimension === 'acuity' && shortfall >= 10) return 'P0_acuity_distribution_gap';
  if (dimension === 'age_band' && shortfall >= 10) return 'P0_age_distribution_gap';
  if (dimension === 'special_population' && shortfall >= 8) return 'P0_equity_population_gap';
  if (shortfall >= 5) return 'P1_coverage_gap';
  return 'P2_target_gap';
}

function targetGapPackets(status) {
  return TARGET_SECTIONS.flatMap((section) =>
    (status[section.key] || [])
      .filter((row) => row.shortfall > 0)
      .map((row) => ({
        id: `case_bank_gap_${section.dimension}_${row.id}`,
        dimension: section.dimension,
        label: section.label,
        target_id: row.id,
        priority: priorityForGap(section.dimension, row.shortfall),
        current_cases: row.current,
        minimum_cases: row.minimum,
        shortfall: row.shortfall,
        review_status: 'case_acquisition_and_review_required',
        required_actions: [
          `Acquire or author source-grounded cases that count toward ${row.id}.`,
          'Require deidentified source provenance, explicit case truth fields, simulation reveal scaffolds, and review signatures before counting toward national release.',
          'Prefer cases that also close other open acuity, age, equity, or presentation gaps.'
        ],
        must_not_count_until: [
          'case truth adjudication is complete',
          'source/evidence review is complete',
          'equity and accessibility review is complete',
          'curriculum/Core EPA mapping review is complete',
          'learner-facing feedback claim support is reviewed'
        ]
      }))
  );
}

function buildBlueprintSlots(status) {
  const gapRows = Object.fromEntries(
    TARGET_SECTIONS.map((section) => [
      section.dimension,
      (status[section.key] || []).filter((row) => row.shortfall > 0)
    ])
  );
  const expanded = Object.fromEntries(
    Object.entries(gapRows).map(([dimension, rows]) => [dimension, expandedDeficitList(rows)])
  );
  const slotCount = status.summary.recommended_minimum_new_cases || status.summary.case_count_shortfall || 0;
  const slots = [];
  for (let index = 0; index < slotCount; index += 1) {
    const acuity = expanded.acuity[index % Math.max(expanded.acuity.length, 1)] || 'any_unfilled_acuity';
    const ageBand = expanded.age_band[index % Math.max(expanded.age_band.length, 1)] || 'any_age_band';
    const specialPopulation = expanded.special_population[index % Math.max(expanded.special_population.length, 1)] || 'none_required';
    const presentation = expanded.presentation[index % Math.max(expanded.presentation.length, 1)] || 'any_presentation';
    slots.push({
      id: `case_bank_blueprint_${String(index + 1).padStart(3, '0')}`,
      sequence: index + 1,
      review_status: 'draft_case_acquisition_blueprint_review_required',
      target_profile: {
        acuity,
        age_band: ageBand,
        special_population: specialPopulation,
        presentation
      },
      case_source_requirements: [
        'Use deidentified real-world source records, published open cases, or institutionally approved teaching cases with documented provenance.',
        'Do not use generated patient facts as release-counting case truth.',
        'Record source-record diagnosis, referral/consult truth, disposition/outcome, objective data, and missing-data limitations.',
        'Attach quote-backed open evidence or clinician-approved local standards for feedback claims that go beyond case facts.'
      ],
      required_reviews_before_counting: REVIEW_ROLES,
      required_case_truth_fields: [
        'source_record_diagnosis',
        'clinician_approved_referral_or_consult_truth',
        'retrospective_ground_truth_or_disposition_outcome',
        'optional_objective_data_truth',
        'unsafe_omission_or_escalation_triggers',
        'source_limitations_and_simulation_reveal_notes'
      ],
      release_counting_rule:
        'This blueprint can count toward the national case-bank target only after source scaffolding, case truth adjudication, equity review, curriculum mapping, and feedback traceability review are complete.'
    });
  }
  return slots;
}

function coverageForSlots(slots, targetGapRows) {
  const counts = {
    acuity: countBy(slots, (slot) => slot.target_profile.acuity),
    age_band: countBy(slots, (slot) => slot.target_profile.age_band),
    special_population: countBy(slots, (slot) => slot.target_profile.special_population),
    presentation: countBy(slots, (slot) => slot.target_profile.presentation)
  };
  const rows = targetGapRows.map((gap) => {
    const assignedBlueprints = counts[gap.dimension]?.[gap.target_id] || 0;
    return {
      dimension: gap.dimension,
      target_id: gap.target_id,
      shortfall: gap.shortfall,
      assigned_blueprints: assignedBlueprints,
      blueprint_coverage_met: assignedBlueprints >= gap.shortfall
    };
  });
  return {
    rows,
    all_target_shortfalls_have_blueprint_coverage: rows.every((row) => row.blueprint_coverage_met)
  };
}

function markdown(artifact) {
  const lines = [
    '# Case Bank Expansion Packets',
    '',
    `Generated: ${artifact.generated_at}`,
    '',
    artifact.warning,
    '',
    '## Summary',
    '',
    `- Target gap packets: ${artifact.summary.target_gap_packets}`,
    `- Blueprint slots: ${artifact.summary.blueprint_slots}`,
    `- Recommended minimum new cases: ${artifact.summary.recommended_minimum_new_cases}`,
    `- All target shortfalls have blueprint coverage: ${artifact.summary.all_target_shortfalls_have_blueprint_coverage}`,
    `- Ready for national case-bank release from expansion packets: ${artifact.summary.ready_for_national_case_bank_release_from_expansion_packets}`,
    '',
    '## Target Gap Packets',
    '',
    '| Priority | Dimension | Target | Current | Minimum | Shortfall |',
    '|---|---|---|---:|---:|---:|',
    ...artifact.target_gap_packets.map((packet) =>
      `| ${packet.priority} | ${packet.dimension} | ${markdownEscape(packet.target_id)} | ${packet.current_cases} | ${packet.minimum_cases} | ${packet.shortfall} |`
    ),
    '',
    '## Blueprint Slots',
    '',
    '| Slot | Acuity | Age Band | Special Population | Presentation |',
    '|---|---|---|---|---|',
    ...artifact.case_blueprint_slots.slice(0, 30).map((slot) =>
      `| ${slot.id} | ${markdownEscape(slot.target_profile.acuity)} | ${markdownEscape(slot.target_profile.age_band)} | ${markdownEscape(slot.target_profile.special_population)} | ${markdownEscape(slot.target_profile.presentation)} |`
    ),
    artifact.case_blueprint_slots.length > 30
      ? `| ... | ${artifact.case_blueprint_slots.length - 30} additional blueprint slots omitted from Markdown preview |  |  |  |`
      : '',
    '',
    '## Reviewer Output',
    '',
    'Blueprints are acquisition and review targets, not case approvals. Completed cases should be added only after case truth adjudication, evidence review, equity review, and curriculum mapping are recorded in the corresponding readiness artifacts.'
  ].filter((line) => line !== null);
  return `${lines.join('\n')}\n`;
}

const caseBankStatus = readJson(CASE_BANK_EXPANSION_STATUS_PATH);
const qualityReport = readJson(CASE_GENERATION_QUALITY_REPORT_PATH);
const equityAudit = readJson(EQUITY_BIAS_AUDIT_PATH);
const targetPackets = targetGapPackets(caseBankStatus);
const blueprintSlots = buildBlueprintSlots(caseBankStatus);
const blueprintCoverage = coverageForSlots(blueprintSlots, targetPackets);

const artifact = {
  schema_version: 'case_bank_expansion_packets_v1',
  generated_at: new Date().toISOString(),
  review_status: targetPackets.length
    ? 'case_bank_expansion_packets_open_acquisition_and_review_required'
    : 'case_bank_expansion_packets_no_target_gaps_detected_review_required',
  warning: 'These packets operationalize national case-bank expansion targets. They do not create cases, approve generated cases, or replace source, clinician, equity, curriculum, or outcomes review.',
  source_contract: {
    case_bank_expansion_status_schema: caseBankStatus.schema_version,
    case_bank_expansion_status_path: 'docs/case_bank_expansion_status.json',
    case_generation_quality_report_schema: qualityReport.schema_version,
    equity_bias_readiness_audit_schema: equityAudit.schema_version,
    generated_or_synthetic_cases_count_for_national_release_without_review: false,
    blueprint_slots_are_not_case_approvals: true
  },
  summary: {
    current_cases: caseBankStatus.summary.current_cases,
    national_case_count_minimum: caseBankStatus.summary.national_case_count_minimum,
    case_count_shortfall: caseBankStatus.summary.case_count_shortfall,
    target_gap_packets: targetPackets.length,
    recommended_minimum_new_cases: caseBankStatus.summary.recommended_minimum_new_cases,
    blueprint_slots: blueprintSlots.length,
    blueprint_slots_match_recommended_minimum_new_cases:
      blueprintSlots.length === caseBankStatus.summary.recommended_minimum_new_cases,
    all_target_shortfalls_have_blueprint_coverage:
      blueprintCoverage.all_target_shortfalls_have_blueprint_coverage,
    reviewed_blueprint_slots: 0,
    pending_blueprint_slots: blueprintSlots.length,
    national_release_eligible_cases: caseBankStatus.summary.national_release_eligible_cases,
    ready_for_national_case_bank_release_from_expansion_packets: false
  },
  target_gap_packets: targetPackets,
  blueprint_gap_coverage: blueprintCoverage.rows,
  case_blueprint_slots: blueprintSlots,
  review_submission_template: {
    schema_version: 'case_bank_expansion_reviews_v1',
    blueprint_reviews: [
      {
        blueprint_id: blueprintSlots[0]?.id || '',
        created_case_id: '',
        target_profile_confirmed: blueprintSlots[0]?.target_profile || {
          acuity: '',
          age_band: '',
          special_population: '',
          presentation: ''
        },
        reviewed_by: REVIEW_ROLES.map((role) => ({
          role,
          name: '',
          institution: '',
          credential_or_position: ''
        })),
        reviewed_at: '',
        source_record_or_teaching_case_provenance: '',
        source_deidentification_attestation: '',
        case_truth_adjudication_id: '',
        equity_review_id: '',
        curriculum_mapping_review_id: '',
        feedback_traceability_review_id: '',
        national_case_bank_counting_decision: 'approved_to_count_toward_national_case_bank | approved_for_supervised_pilot_only | source_or_truth_revisions_required | equity_or_curriculum_revisions_required | rejected | blocked',
        required_changes: [],
        reviewer_attestation: ''
      }
    ]
  },
  release_blockers: [
    {
      id: 'case_bank_expansion_target_gaps_open',
      status: targetPackets.length === 0 ? 'cleared' : 'blocked',
      evidence: {
        target_gap_packets: targetPackets.length,
        case_count_shortfall: caseBankStatus.summary.case_count_shortfall
      },
      required_to_clear: 'Add reviewed cases until every acuity, age, special-population, and presentation target is met.'
    },
    {
      id: 'case_bank_blueprint_reviews_pending',
      status: blueprintSlots.length === 0 ? 'cleared' : 'blocked',
      evidence: {
        blueprint_slots: blueprintSlots.length,
        reviewed_blueprint_slots: 0
      },
      required_to_clear: 'Record completed source, clinician, equity, curriculum, and feedback reviews before blueprint cases count toward national release.'
    }
  ],
  next_actions: [
    'Use the blueprint slots to source a balanced batch of deidentified, provenance-backed ED cases.',
    'Assign each blueprint to emergency clinician, simulation educator, medical librarian/evidence reviewer, equity/accessibility, and curriculum reviewers.',
    'Do not count generated or draft cases toward national release until all required reviews are complete.',
    'Regenerate case bank status and readiness artifacts after approved cases are added.'
  ]
};

writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
writeFileSync(OUTPUT_MD_PATH, markdown(artifact), 'utf8');

console.log(JSON.stringify({
  review_status: artifact.review_status,
  target_gap_packets: artifact.summary.target_gap_packets,
  blueprint_slots: artifact.summary.blueprint_slots,
  recommended_minimum_new_cases: artifact.summary.recommended_minimum_new_cases,
  all_target_shortfalls_have_blueprint_coverage:
    artifact.summary.all_target_shortfalls_have_blueprint_coverage,
  report_path: OUTPUT_JSON_PATH
}, null, 2));
