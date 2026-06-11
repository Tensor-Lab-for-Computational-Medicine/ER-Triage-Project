import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CASES_PATH = join(ROOT, 'frontend', 'src', 'data', 'cases.json');
const CASE_GENERATION_QUALITY_REPORT_PATH = join(ROOT, 'docs', 'case_generation_quality_report.json');
const EQUITY_BIAS_AUDIT_PATH = join(ROOT, 'docs', 'equity_bias_readiness_audit.json');
const OUTPUT_JSON_PATH = join(ROOT, 'docs', 'case_bank_expansion_status.json');
const OUTPUT_MD_PATH = join(ROOT, 'docs', 'case_bank_expansion_status.md');

const NATIONAL_CASE_COUNT_MINIMUM = 100;

const ACUITY_TARGETS = {
  ESI_1: 10,
  ESI_2: 25,
  ESI_3: 25,
  ESI_4: 20,
  ESI_5: 10
};

const AGE_BAND_TARGETS = {
  pediatric: 10,
  adult_18_39: 20,
  adult_40_64: 25,
  older_adult_65_plus: 20
};

const SPECIAL_POPULATION_TARGETS = {
  language_access_or_interpreter_need: 10,
  disability_or_communication_accommodation: 10,
  pregnancy_or_reproductive_health: 10,
  mental_health_substance_use_or_capacity: 10,
  social_context_or_access_to_care: 10
};

const PRESENTATION_TARGETS = {
  chest_pain_or_cardiopulmonary: 12,
  abdominal_gi_or_pelvic: 12,
  infection_sepsis_or_fever: 10,
  neurologic_or_altered_mental_status: 8,
  trauma_wound_or_msk: 12,
  dyspnea_or_respiratory: 8,
  procedure_followup_or_low_acuity: 8,
  airway_ent_or_transfer: 6
};

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

function ageBand(caseRecord) {
  const age = Number(caseRecord.demographics?.age ?? caseRecord.source?.age);
  if (!Number.isFinite(age)) return 'unknown';
  if (age < 18) return 'pediatric';
  if (age < 40) return 'adult_18_39';
  if (age < 65) return 'adult_40_64';
  return 'older_adult_65_plus';
}

function caseText(caseRecord) {
  return [
    caseRecord.complaint,
    caseRecord.history,
    caseRecord.disposition,
    ...(caseRecord.augmentation?.ddx || []).map((item) => item.diagnosis),
    ...(caseRecord.augmentation?.teaching_points || [])
  ].map(cleanText).join(' ').toLowerCase();
}

function hasText(caseRecord, patterns) {
  const text = caseText(caseRecord);
  return patterns.some((pattern) => pattern.test(text));
}

function isFemaleReproductiveAge(caseRecord) {
  const age = Number(caseRecord.demographics?.age ?? caseRecord.source?.age);
  const sex = String(caseRecord.demographics?.sex || caseRecord.source?.sex || '').toUpperCase();
  return sex.startsWith('F') && Number.isFinite(age) && age >= 12 && age <= 55;
}

function specialPopulationTags(caseRecord) {
  const tags = [];
  if (hasText(caseRecord, [/\binterpreter\b/, /\blanguage\b/, /\blimited english\b/, /\bnon[- ]?english\b/])) {
    tags.push('language_access_or_interpreter_need');
  }
  if (hasText(caseRecord, [/\bdisab/, /\bdeaf\b/, /\bblind\b/, /\bwheelchair\b/, /\baccommodation\b/, /\bcognitive impairment\b/])) {
    tags.push('disability_or_communication_accommodation');
  }
  if (isFemaleReproductiveAge(caseRecord) || hasText(caseRecord, [/\bpregnan/, /\bectopic\b/, /\bpelvic\b/, /\bovarian\b/, /\bvaginal\b/])) {
    tags.push('pregnancy_or_reproductive_health');
  }
  if (hasText(caseRecord, [/\baltered\b/, /\bconfus/, /\bpsychiatric\b/, /\boverdose\b/, /\bsubstance\b/, /\bagitation\b/, /\bcapacity\b/])) {
    tags.push('mental_health_substance_use_or_capacity');
  }
  if (hasText(caseRecord, [/\brefill\b/, /\bfollow[- ]?up\b/, /\buninsured\b/, /\binsurance\b/, /\bsocial work\b/, /\boutpatient\b/, /\baccess\b/])) {
    tags.push('social_context_or_access_to_care');
  }
  return tags;
}

function presentationTags(caseRecord) {
  const tags = [];
  const text = caseText(caseRecord);
  if (/\b(chest pain|cardiac|cardio|mi\b|acs\b|heart|pedal edema)\b/.test(text)) tags.push('chest_pain_or_cardiopulmonary');
  if (/\b(abd|abdominal|vomit|nausea|gi\b|pelvic|rectal|bowel)\b/.test(text)) tags.push('abdominal_gi_or_pelvic');
  if (/\b(fever|infection|sepsis|pneumonia|abscess|cellulitis)\b/.test(text)) tags.push('infection_sepsis_or_fever');
  if (/\b(altered|consciousness|neuro|weakness|seizure|confus|delirium)\b/.test(text)) tags.push('neurologic_or_altered_mental_status');
  if (/\b(injury|laceration|wound|fracture|pain|swelling|wrist|foot|leg|suture)\b/.test(text)) tags.push('trauma_wound_or_msk');
  if (/\b(dyspnea|shortness of breath|respiratory|pneumonia)\b/.test(text)) tags.push('dyspnea_or_respiratory');
  if (/\b(refill|suture removal|follow[- ]?up|low acuity)\b/.test(text)) tags.push('procedure_followup_or_low_acuity');
  if (/\b(difficulty swallowing|dysphag|airway|ent\b|transfer)\b/.test(text)) tags.push('airway_ent_or_transfer');
  return [...new Set(tags)];
}

function targetRows(targets, currentCounts) {
  return Object.entries(targets).map(([id, minimum]) => {
    const current = currentCounts[id] || 0;
    return {
      id,
      current,
      minimum,
      shortfall: Math.max(0, minimum - current),
      status: current >= minimum ? 'met' : 'gap'
    };
  });
}

function maxShortfall(rows) {
  return rows.reduce((max, row) => Math.max(max, row.shortfall), 0);
}

function sumShortfall(rows) {
  return rows.reduce((sum, row) => sum + row.shortfall, 0);
}

function markdownEscape(value) {
  return cleanText(value).replaceAll('|', '\\|');
}

function markdown(report) {
  const section = (title, rows) => [
    `## ${title}`,
    '',
    '| Target | Current | Minimum | Shortfall | Status |',
    '|---|---:|---:|---:|---|',
    ...rows.map((row) => `| ${markdownEscape(row.id)} | ${row.current} | ${row.minimum} | ${row.shortfall} | ${row.status} |`),
    ''
  ];

  const lines = [
    '# Case Bank Expansion Status',
    '',
    `Generated: ${report.generated_at}`,
    '',
    report.warning,
    '',
    '## Summary',
    '',
    `- Current cases: ${report.summary.current_cases}`,
    `- National minimum cases: ${report.summary.national_case_count_minimum}`,
    `- Case count shortfall: ${report.summary.case_count_shortfall}`,
    `- National-release eligible cases: ${report.summary.national_release_eligible_cases}`,
    `- Recommended minimum new cases: ${report.summary.recommended_minimum_new_cases}`,
    `- Ready for national case-bank release: ${report.summary.ready_for_national_case_bank_release}`,
    '',
    ...section('Acuity Targets', report.acuity_targets),
    ...section('Age Targets', report.age_band_targets),
    ...section('Special Population Targets', report.special_population_targets),
    ...section('Presentation Targets', report.presentation_targets),
    '## Next Actions',
    '',
    ...report.next_actions.map((item) => `- ${item}`)
  ];
  return `${lines.join('\n')}\n`;
}

const cases = readJson(CASES_PATH);
const qualityReport = readJson(CASE_GENERATION_QUALITY_REPORT_PATH);
const equityAudit = readJson(EQUITY_BIAS_AUDIT_PATH);

const acuityCounts = countBy(cases, (caseRecord) => `ESI_${caseRecord.acuity}`);
const ageBandCounts = countBy(cases, ageBand);
const specialCounts = {};
const presentationCounts = {};
for (const caseRecord of cases) {
  for (const tag of specialPopulationTags(caseRecord)) {
    specialCounts[tag] = (specialCounts[tag] || 0) + 1;
  }
  for (const tag of presentationTags(caseRecord)) {
    presentationCounts[tag] = (presentationCounts[tag] || 0) + 1;
  }
}

const acuityTargets = targetRows(ACUITY_TARGETS, acuityCounts);
const ageBandTargets = targetRows(AGE_BAND_TARGETS, ageBandCounts);
const specialPopulationTargets = targetRows(SPECIAL_POPULATION_TARGETS, specialCounts);
const presentationTargets = targetRows(PRESENTATION_TARGETS, presentationCounts);
const allTargetRows = [
  ...acuityTargets,
  ...ageBandTargets,
  ...specialPopulationTargets,
  ...presentationTargets
];

const caseCountShortfall = Math.max(0, NATIONAL_CASE_COUNT_MINIMUM - cases.length);
const recommendedMinimumNewCases = Math.max(
  caseCountShortfall,
  maxShortfall(acuityTargets),
  maxShortfall(ageBandTargets),
  maxShortfall(specialPopulationTargets),
  maxShortfall(presentationTargets)
);
const targetGapCount = allTargetRows.filter((row) => row.shortfall > 0).length;
const readyForNationalCaseBankRelease = cases.length >= NATIONAL_CASE_COUNT_MINIMUM
  && targetGapCount === 0
  && qualityReport.summary?.national_release_eligible_cases >= cases.length
  && qualityReport.summary?.case_truth_adjudication_ready_cases >= cases.length;

const artifact = {
  schema_version: 'case_bank_expansion_status_v1',
  generated_at: new Date().toISOString(),
  review_status: readyForNationalCaseBankRelease
    ? 'case_bank_coverage_ready_for_national_release'
    : 'case_bank_coverage_gaps_require_expansion_and_review',
  warning: 'This artifact defines a coverage target matrix for national case-bank expansion. It does not generate cases and does not replace emergency clinician truth adjudication, curriculum committee review, equity review, or learner outcome validation.',
  source_contract: {
    cases_schema_source: 'frontend/src/data/cases.json',
    case_generation_quality_report_schema: qualityReport.schema_version,
    equity_bias_readiness_audit_schema: equityAudit.schema_version,
    all_targets_are_minimums: true,
    generated_cases_allowed_to_count_without_review: false
  },
  summary: {
    current_cases: cases.length,
    national_case_count_minimum: NATIONAL_CASE_COUNT_MINIMUM,
    case_count_shortfall: caseCountShortfall,
    national_release_eligible_cases: qualityReport.summary?.national_release_eligible_cases || 0,
    case_truth_adjudication_ready_cases: qualityReport.summary?.case_truth_adjudication_ready_cases || 0,
    target_gap_count: targetGapCount,
    acuity_target_gaps: acuityTargets.filter((row) => row.shortfall > 0).length,
    age_band_target_gaps: ageBandTargets.filter((row) => row.shortfall > 0).length,
    special_population_target_gaps: specialPopulationTargets.filter((row) => row.shortfall > 0).length,
    presentation_target_gaps: presentationTargets.filter((row) => row.shortfall > 0).length,
    aggregate_target_shortfall: sumShortfall(allTargetRows),
    recommended_minimum_new_cases: recommendedMinimumNewCases,
    ready_for_national_case_bank_release: readyForNationalCaseBankRelease
  },
  target_policy: {
    national_case_count_minimum: NATIONAL_CASE_COUNT_MINIMUM,
    acuity_targets: ACUITY_TARGETS,
    age_band_targets: AGE_BAND_TARGETS,
    special_population_targets: SPECIAL_POPULATION_TARGETS,
    presentation_targets: PRESENTATION_TARGETS
  },
  current_distribution: {
    acuity: acuityCounts,
    age_bands: ageBandCounts,
    special_populations: specialCounts,
    presentations: presentationCounts
  },
  acuity_targets: acuityTargets,
  age_band_targets: ageBandTargets,
  special_population_targets: specialPopulationTargets,
  presentation_targets: presentationTargets,
  next_actions: [
    `Add at least ${recommendedMinimumNewCases} clinically reviewed public cases before considering national release.`,
    'Prioritize pediatric, language-access, disability/accommodation, social-context, mental-health/substance-use, and ESI 1/4/5 coverage gaps.',
    'Require every added case to pass source scaffolding, clinician case-truth adjudication, equity review, and curriculum mapping before it can count toward national-release coverage.',
    'Keep generated or synthetic case drafts out of national-release counts until clinician review and source/evidence grounding are complete.'
  ]
};

writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
writeFileSync(OUTPUT_MD_PATH, markdown(artifact), 'utf8');

console.log(JSON.stringify({
  review_status: artifact.review_status,
  current_cases: artifact.summary.current_cases,
  national_case_count_minimum: artifact.summary.national_case_count_minimum,
  case_count_shortfall: artifact.summary.case_count_shortfall,
  target_gap_count: artifact.summary.target_gap_count,
  recommended_minimum_new_cases: artifact.summary.recommended_minimum_new_cases,
  ready_for_national_case_bank_release: artifact.summary.ready_for_national_case_bank_release,
  status_path: OUTPUT_JSON_PATH
}, null, 2));
