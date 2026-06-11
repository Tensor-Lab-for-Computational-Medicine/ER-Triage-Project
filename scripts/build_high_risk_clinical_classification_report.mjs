import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CASES_PATH = join(ROOT, 'frontend', 'src', 'data', 'cases.json');
const KNOWLEDGE_BUNDLE_PATH = join(ROOT, 'frontend', 'src', 'data', 'public_clinical_knowledge_bundle.json');
const QUALITY_REPORT_PATH = join(ROOT, 'frontend', 'src', 'data', 'public_clinical_source_quality_report.json');
const TOPIC_ALLOWLIST_PATH = join(ROOT, 'frontend', 'src', 'data', 'clinical_source_topic_allowlist.json');
const RETRIEVAL_MATRIX_PATH = join(ROOT, 'frontend', 'src', 'data', 'clinical_retrieval_matrix.json');
const CLASSIFIER_SERVICE_PATH = join(ROOT, 'frontend', 'src', 'services', 'highRiskClinicalClassificationService.js');
const QUOTE_DEPTH_REPORT_PATH = join(ROOT, 'docs', 'high_risk_quote_coverage_depth_report.json');
const CLAIM_REFERENCE_ALIGNMENT_REPORT_PATH = join(ROOT, 'docs', 'feedback_claim_reference_alignment_report.json');
const JSON_OUTPUT_PATH = join(ROOT, 'docs', 'high_risk_clinical_classification_report.json');
const MD_OUTPUT_PATH = join(ROOT, 'docs', 'high_risk_clinical_classification_report.md');

const CLASSIFIER_VERSION = 'high_risk_clinical_classification_v1';
const CORE_HIGH_RISK_FACETS = [
  'recognition',
  'red_flags',
  'focused_assessment',
  'diagnostic_strategy',
  'initial_management',
  'medication_procedure',
  'disposition_reassessment'
];
const HIGH_RISK_CLAIM_DOMAINS = [
  'esi',
  'safety',
  'diagnosis',
  'referral',
  'escalation',
  'reassessment'
];
const FORMATIVE_REVIEW_CLAIM_DOMAINS = [
  'interview',
  'focused_exam',
  'soap',
  'sbar'
];
const HIGH_RISK_ACTION_SIGNALS = [
  'critical_procedure',
  'tier1_med_usage_1h',
  'transfer_to_icu_in_1h',
  'transfer_to_icu_beyond_1h',
  'transfer2surgeryin1h',
  'transfer_to_surgery_beyond_1h',
  'expired_within_1h',
  'expired_beyond_1h',
  'invasive_ventilation',
  'invasive_ventilation_beyond_1h',
  'intraosseous_line_placed',
  'transfusion_within_1h',
  'red_cell_order_more_than_1'
];
const TOPIC_ALIASES = {
  septic_shock_concern: [
    'sepsis',
    'septic shock',
    'suspected sepsis',
    'infection with hypotension',
    'fever hypotension tachycardia'
  ],
  septic_shock_resuscitation: [
    'sepsis resuscitation',
    'septic shock resuscitation',
    'lactate fluids vasopressors',
    'source control',
    'vasopressor'
  ],
  chest_pain_possible_acs: [
    'chest pain',
    'acute coronary syndrome',
    'acs',
    'cardiac ischemia',
    'cardiac chest pain'
  ],
  high_sensitivity_troponin_pathway: [
    'troponin',
    'high sensitivity troponin',
    'hs troponin',
    'serial troponin'
  ],
  non_st_elevation_acs: [
    'nstemi',
    'nste acs',
    'non st elevation acs',
    'non st elevation myocardial infarction'
  ],
  opioid_overdose: [
    'opioid overdose',
    'respiratory depression',
    'overdose',
    'opioid intoxication'
  ],
  naloxone_response_and_recurrence: [
    'naloxone',
    'opioid recurrence',
    'recurrent respiratory depression',
    'naloxone response'
  ],
  febrile_infant_8_to_21_days: [
    'febrile infant',
    '8 to 21 days',
    'serious bacterial infection',
    'neonate fever'
  ],
  acute_stroke_symptoms: [
    'stroke',
    'acute stroke',
    'facial droop',
    'aphasia',
    'new neurologic deficit'
  ],
  thrombolytic_eligibility_discussion: [
    'thrombolytic',
    'thrombolysis',
    'tpa',
    'alteplase',
    'tenecteplase'
  ],
  ectopic_pregnancy_rupture_concern: [
    'ectopic pregnancy',
    'ruptured ectopic',
    'pregnancy pelvic pain',
    'pregnancy bleeding unstable'
  ],
  minor_head_injury_ct_decision: [
    'head injury',
    'head trauma',
    'minor head injury',
    'ct head',
    'anticoagulated vomiting'
  ],
  use_of_restraints: [
    'restraints',
    'physical restraint',
    'violent agitation',
    'behavioral emergency'
  ],
  severe_agitation_medication_strategy: [
    'severe agitation',
    'chemical sedation',
    'agitation medication',
    'agitated patient'
  ],
  dka_or_hhs: [
    'dka',
    'hhs',
    'diabetic ketoacidosis',
    'hyperosmolar',
    'hyperglycemic crisis'
  ]
};
const SAFETY_FALLBACK_TERMS = [
  'airway',
  'intubation',
  'shock',
  'stemi',
  'cardiac arrest',
  'trauma',
  'hemorrhage',
  'suicide',
  'anaphylaxis',
  'respiratory failure',
  'hypoxia',
  'status epilepticus',
  'meningitis',
  'pulmonary embolism',
  'icu',
  'transfer'
];

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizedText(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function unique(items = []) {
  return [...new Set(items.filter(Boolean))];
}

function markdownEscape(value) {
  return cleanText(value).replaceAll('|', '\\|');
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function topicLabelAlias(topic) {
  return String(topic || '').replaceAll('_', ' ');
}

function textMatchesAlias(normalized, alias) {
  if (!normalized || !alias) return false;
  if (normalized.includes(alias)) return true;
  const tokens = alias.split(' ').filter((token) => token.length > 2);
  return tokens.length > 1 && tokens.every((token) => normalized.includes(token));
}

function caseText(caseRecord = {}) {
  const augmentation = caseRecord.augmentation || {};
  return [
    caseRecord.complaint,
    caseRecord.history,
    caseRecord.outcome,
    caseRecord.source?.chief_complaint,
    caseRecord.source?.triage_narrative,
    augmentation.likely_working_diagnosis,
    ...(augmentation.red_flags || []),
    ...(augmentation.key_teaching_points || []),
    ...(augmentation.ddx || []).flatMap((item) => [
      item.diagnosis,
      item.support,
      item.acuity_implication
    ])
  ].filter(Boolean).join(' ');
}

function actionSignalsForCase(caseRecord = {}) {
  const combined = {
    ...(caseRecord.interventions || {}),
    ...(caseRecord.source?.interventions || {}),
    ...(caseRecord.source?.outcomes || {})
  };
  return HIGH_RISK_ACTION_SIGNALS.filter((key) => Boolean(combined[key] || caseRecord[key]));
}

function isAdministrativeNonclinicalQuery(query) {
  const administrative = /\b(parking|cafeteria|housing|maintenance|room booking|book a room|meeting|vacation|holiday|schedule|calendar|tuition|invoice|payroll|wifi|printer|email|badge|id card)\b/i.test(query);
  const clinical = /\b(patient|triage|diagnos|differential|symptom|vital|exam|history|pain|fever|dyspnea|breath|hypox|shock|sepsis|stroke|chest|abdomen|pregnan|ectopic|bleed|trauma|injur|head|vomit|dizzy|syncope|overdose|opioid|naloxone|agitat|restraint|dka|hhs|diabetes|insulin|potassium|ecg|ekg|troponin|ct\b|imaging|lab|medication|treatment|management|reassess|disposition|handoff|consult|admission|transfer|icu|ed\b|emergency)\b/i.test(query);
  return administrative && !clinical;
}

const cases = readJson(CASES_PATH);
const bundle = readJson(KNOWLEDGE_BUNDLE_PATH);
const qualityReport = readJson(QUALITY_REPORT_PATH);
const topicAllowlist = readJson(TOPIC_ALLOWLIST_PATH);
const retrievalMatrix = readJson(RETRIEVAL_MATRIX_PATH);
const quoteDepthReport = readJson(QUOTE_DEPTH_REPORT_PATH);
const claimReferenceAlignmentReport = readJson(CLAIM_REFERENCE_ALIGNMENT_REPORT_PATH);
const classifierServiceSource = readFileSync(CLASSIFIER_SERVICE_PATH, 'utf8');

const highRiskTopics = qualityReport.high_risk_quote_core_topics || [];
const topicSet = new Set(highRiskTopics);

function retrievalAliasesForTopic(topic) {
  return retrievalMatrix
    .filter((row) => (row.expected_tags || []).includes(topic))
    .flatMap((row) => [row.label, row.query, ...(row.expected_facets || []).map((facet) => facet.replaceAll('_', ' '))]);
}

function aliasesForTopic(topic) {
  return unique([
    topicLabelAlias(topic),
    ...(TOPIC_ALIASES[topic] || []),
    ...retrievalAliasesForTopic(topic)
  ]).map(normalizedText).filter(Boolean);
}

const topicAliasMap = Object.fromEntries(highRiskTopics.map((topic) => [topic, aliasesForTopic(topic)]));

function topicsFromText(value) {
  const normalized = normalizedText(value);
  if (!normalized) return [];
  return highRiskTopics.filter((topic) =>
    (topicAliasMap[topic] || []).some((alias) => textMatchesAlias(normalized, alias))
  );
}

function classifyClinicalRisk({
  queryText = '',
  task = '',
  topicTags = [],
  facetId = '',
  caseRecord = null,
  claimDomain = '',
  referenceChunks = []
} = {}) {
  const explicitTopicTags = unique([
    ...asArray(topicTags),
    ...asArray(referenceChunks).flatMap((chunk) => chunk?.topic_tags || [])
  ]);
  const matchedTopicsFromTags = explicitTopicTags.filter((topic) => topicSet.has(topic));
  const matchedTopicsFromQuery = topicsFromText(queryText);
  const matchedTopicsFromCase = caseRecord ? topicsFromText(caseText(caseRecord)) : [];
  const matchedFacets = CORE_HIGH_RISK_FACETS.includes(facetId) ? [facetId] : [];
  const matchedClaimDomains = HIGH_RISK_CLAIM_DOMAINS.includes(claimDomain) ? [claimDomain] : [];
  const caseAcuity = Number(caseRecord?.acuity || caseRecord?.source?.reference_esi || 0);
  const highRiskActionSignals = caseRecord ? actionSignalsForCase(caseRecord) : [];
  const safetyFallbackMatches = SAFETY_FALLBACK_TERMS.filter((term) =>
    textMatchesAlias(normalizedText(queryText), normalizedText(term))
  );
  const basis = [];
  if (matchedTopicsFromTags.length) basis.push('structured_topic_tag');
  if (matchedTopicsFromQuery.length) basis.push('structured_topic_alias');
  if (matchedTopicsFromCase.length) basis.push('case_text_topic_alias');
  if (matchedFacets.length && (matchedTopicsFromTags.length || matchedTopicsFromQuery.length || matchedTopicsFromCase.length)) {
    basis.push('topic_facet_pair');
  }
  if (caseAcuity > 0 && caseAcuity <= 2) basis.push('case_esi_high_acuity');
  if (highRiskActionSignals.length) basis.push('case_action_signal');
  if (matchedClaimDomains.length) basis.push('claim_domain_policy');
  if (!basis.length && safetyFallbackMatches.length) basis.push('safety_term_fallback');
  const highRisk = basis.length > 0;
  return {
    high_risk: highRisk,
    risk_level: highRisk ? 'high' : 'standard',
    task: cleanText(task),
    facet_id: cleanText(facetId),
    basis,
    matched_topic_tags: unique([
      ...matchedTopicsFromTags,
      ...matchedTopicsFromQuery,
      ...matchedTopicsFromCase
    ]),
    matched_facets: matchedFacets,
    matched_claim_domains: matchedClaimDomains,
    high_risk_case_acuity: caseAcuity > 0 && caseAcuity <= 2,
    high_risk_action_signals: highRiskActionSignals,
    safety_fallback_terms: safetyFallbackMatches,
    requires_quote_backed_references: highRisk,
    generated_needs_review_allowed: false
  };
}

const quoteDepthByTopic = new Map((quoteDepthReport.topic_rows || []).map((row) => [row.topic, row]));
const topicRows = highRiskTopics.map((topic) => {
  const aliases = topicAliasMap[topic] || [];
  const chunks = (bundle.chunks || []).filter((chunk) => (chunk.topic_tags || []).includes(topic));
  const facets = unique(chunks.map((chunk) => chunk.facet_id).filter(Boolean)).sort();
  const coreFacets = facets.filter((facet) => CORE_HIGH_RISK_FACETS.includes(facet));
  const allowlistedSources = topicAllowlist[topic] || [];
  const quoteDepthRow = quoteDepthByTopic.get(topic);
  const classification = classifyClinicalRisk({
    queryText: `${topicLabelAlias(topic)} ${(TOPIC_ALIASES[topic] || []).slice(0, 3).join(' ')}`,
    topicTags: [topic],
    facetId: coreFacets[0] || ''
  });
  return {
    topic,
    alias_count: aliases.length,
    allowlisted_source_count: allowlistedSources.length,
    bundle_chunk_count: chunks.length,
    classified_high_risk: classification.high_risk,
    classification_basis: classification.basis,
    facet_count: facets.length,
    core_high_risk_facets_present: coreFacets,
    quote_depth_row_present: Boolean(quoteDepthRow),
    quote_backed_chunks: quoteDepthRow?.quote_backed_chunks || 0,
    generated_needs_review_chunks: quoteDepthRow?.generated_needs_review_chunks || 0,
    quote_depth_release_ready: Boolean(quoteDepthRow?.release_ready)
  };
});

const topicAliasProbes = highRiskTopics.map((topic) => {
  const query = `${topicLabelAlias(topic)} emergency department ${(TOPIC_ALIASES[topic] || [])[0] || ''}`;
  const classification = classifyClinicalRisk({ queryText: query });
  const fallbackOnly = classification.basis.length === 1 && classification.basis[0] === 'safety_term_fallback';
  return {
    id: `topic_alias_${topic}`,
    topic,
    query,
    status: classification.high_risk && classification.matched_topic_tags.includes(topic) && !fallbackOnly
      ? 'pass'
      : 'fail',
    matched_topic_tags: classification.matched_topic_tags,
    basis: classification.basis,
    fallback_only: fallbackOnly
  };
});

const retrievalMatrixRows = retrievalMatrix.map((row) => {
  const expectedHighRiskTags = (row.expected_tags || []).filter((tag) => topicSet.has(tag));
  const classification = classifyClinicalRisk({
    queryText: row.query,
    task: row.task,
    topicTags: row.expected_tags || [],
    facetId: row.expected_facets?.[0] || ''
  });
  const fallbackOnly = classification.basis.length === 1 && classification.basis[0] === 'safety_term_fallback';
  return {
    label: row.label,
    task: row.task,
    expected_high_risk_topic_tags: expectedHighRiskTags,
    expected_facets: row.expected_facets || [],
    classified_high_risk: classification.high_risk,
    status: expectedHighRiskTags.length > 0
      && classification.high_risk
      && !fallbackOnly
      && expectedHighRiskTags.some((tag) => classification.matched_topic_tags.includes(tag))
      ? 'pass'
      : 'fail',
    classification_basis: classification.basis,
    matched_topic_tags: classification.matched_topic_tags,
    fallback_only: fallbackOnly
  };
});

const caseRows = cases.map((caseRecord) => {
  const classification = classifyClinicalRisk({
    queryText: `${caseRecord.complaint || ''} ${caseRecord.history || ''}`,
    caseRecord
  });
  return {
    case_id: caseRecord.id,
    acuity: Number(caseRecord.acuity || caseRecord.source?.reference_esi || 0),
    complaint: caseRecord.complaint || '',
    risk_level: classification.risk_level,
    classified_high_risk: classification.high_risk,
    classification_basis: classification.basis,
    matched_topic_tags: classification.matched_topic_tags,
    high_risk_case_acuity: classification.high_risk_case_acuity,
    high_risk_action_signals: classification.high_risk_action_signals
  };
});

const claimRows = (claimReferenceAlignmentReport.claim_set_alignment || []).map((row) => {
  const classification = classifyClinicalRisk({
    queryText: `${row.label || ''} ${row.current_release_status || ''}`,
    claimDomain: row.domain_key || ''
  });
  const knownDomain = HIGH_RISK_CLAIM_DOMAINS.includes(row.domain_key)
    || FORMATIVE_REVIEW_CLAIM_DOMAINS.includes(row.domain_key);
  return {
    packet_id: row.packet_id,
    domain_key: row.domain_key,
    label: row.label,
    claim_set_type: row.claim_set_type,
    risk_level: HIGH_RISK_CLAIM_DOMAINS.includes(row.domain_key) ? 'high' : 'clinical_review_required',
    classified_high_risk: classification.high_risk,
    known_domain_policy: knownDomain,
    classification_basis: classification.basis,
    aligned_quote_backed_references: row.aligned_quote_backed_references,
    release_ready: Boolean(row.release_ready)
  };
});

const negativeControlRows = [
  {
    id: 'campus_parking',
    query: 'campus parking permit cafeteria hours student housing maintenance request'
  },
  {
    id: 'faculty_room_booking',
    query: 'schedule a meeting with faculty about vacation dates and room booking'
  }
].map((row) => {
  const classification = classifyClinicalRisk({ queryText: row.query, task: 'tutor' });
  const nonclinicalScope = isAdministrativeNonclinicalQuery(row.query);
  return {
    ...row,
    nonclinical_scope_guardrail_expected: nonclinicalScope,
    classified_high_risk: classification.high_risk,
    status: nonclinicalScope && !classification.high_risk ? 'pass' : 'fail',
    classification_basis: classification.basis
  };
});

const fallbackOnlyTopicProbes = topicAliasProbes.filter((probe) => probe.fallback_only);
const fallbackOnlyMatrixRows = retrievalMatrixRows.filter((row) => row.fallback_only);
const unsupportedClaimDomains = claimRows.filter((row) => !row.known_domain_policy);
const policyReady = highRiskTopics.length > 0
  && topicRows.length === highRiskTopics.length
  && topicRows.every((row) => row.alias_count > 0)
  && topicRows.every((row) => row.allowlisted_source_count > 0)
  && topicRows.every((row) => row.quote_depth_row_present)
  && topicAliasProbes.every((probe) => probe.status === 'pass')
  && retrievalMatrixRows.every((row) => row.status === 'pass')
  && caseRows.length === cases.length
  && claimRows.length === claimReferenceAlignmentReport.summary.total_claim_sets
  && unsupportedClaimDomains.length === 0
  && fallbackOnlyTopicProbes.length === 0
  && fallbackOnlyMatrixRows.length === 0
  && negativeControlRows.every((row) => row.status === 'pass');

const summary = {
  classifier_version: CLASSIFIER_VERSION,
  high_risk_topics_from_quality_report: highRiskTopics.length,
  structured_topic_policy_rows: topicRows.length,
  topics_with_alias_policy: topicRows.filter((row) => row.alias_count > 0).length,
  topics_with_allowlisted_source_policy: topicRows.filter((row) => row.allowlisted_source_count > 0).length,
  topics_with_quote_depth_row: topicRows.filter((row) => row.quote_depth_row_present).length,
  topic_alias_probes: topicAliasProbes.length,
  topic_alias_probes_passed: topicAliasProbes.filter((probe) => probe.status === 'pass').length,
  retrieval_matrix_rows: retrievalMatrixRows.length,
  retrieval_matrix_rows_passed: retrievalMatrixRows.filter((row) => row.status === 'pass').length,
  case_rows_classified: caseRows.length,
  case_rows_high_risk: caseRows.filter((row) => row.classified_high_risk).length,
  case_rows_high_risk_by_acuity: caseRows.filter((row) => row.high_risk_case_acuity).length,
  case_rows_high_risk_by_action_signal: caseRows.filter((row) => row.high_risk_action_signals.length > 0).length,
  claim_sets_classified: claimRows.length,
  high_risk_claim_sets: claimRows.filter((row) => row.classified_high_risk).length,
  formative_review_claim_sets: claimRows.filter((row) => !row.classified_high_risk && row.known_domain_policy).length,
  unsupported_claim_domains: unsupportedClaimDomains.length,
  negative_control_probes: negativeControlRows.length,
  negative_controls_classified_nonclinical: negativeControlRows.filter((row) => row.status === 'pass').length,
  regex_fallback_only_high_risk_probes: fallbackOnlyTopicProbes.length + fallbackOnlyMatrixRows.length,
  generated_needs_review_approved_by_this_report: 0,
  high_risk_classification_policy_ready: policyReady,
  high_risk_classification_release_ready: false
};

const report = {
  schema_version: 'high_risk_clinical_classification_report_v1',
  generated_at: new Date().toISOString(),
  review_status: policyReady
    ? 'high_risk_classification_policy_ready_manual_review_required'
    : 'high_risk_classification_policy_gaps_found',
  warning: 'This report verifies a structured high-risk classifier contract for local fail-closed evidence retrieval. It does not approve clinical accuracy, quote-depth sufficiency, claim entailment, or national release.',
  source_contract: {
    classifier_service_path: 'frontend/src/services/highRiskClinicalClassificationService.js',
    classifier_service_present: classifierServiceSource.includes('classifyClinicalRisk'),
    classifier_service_imports_quality_report:
      classifierServiceSource.includes('public_clinical_source_quality_report.json'),
    classifier_service_imports_retrieval_matrix:
      classifierServiceSource.includes('clinical_retrieval_matrix.json'),
    public_source_quality_report_schema: qualityReport.schema_version,
    public_knowledge_bundle_schema: bundle.schema_version,
    high_risk_topic_source: 'frontend/src/data/public_clinical_source_quality_report.json.high_risk_quote_core_topics',
    topic_allowlist_source: 'frontend/src/data/clinical_source_topic_allowlist.json',
    retrieval_matrix_source: 'frontend/src/data/clinical_retrieval_matrix.json',
    case_source: 'frontend/src/data/cases.json',
    claim_reference_alignment_source: 'docs/feedback_claim_reference_alignment_report.json',
    quote_depth_report_source: 'docs/high_risk_quote_coverage_depth_report.json',
    generated_needs_review_approved_by_this_report: 0
  },
  classification_policy: {
    core_high_risk_facets: CORE_HIGH_RISK_FACETS,
    high_risk_claim_domains: HIGH_RISK_CLAIM_DOMAINS,
    formative_review_claim_domains: FORMATIVE_REVIEW_CLAIM_DOMAINS,
    high_risk_action_signals: HIGH_RISK_ACTION_SIGNALS,
    safety_fallback_terms: SAFETY_FALLBACK_TERMS,
    fail_closed_effect: 'High-risk classifications require quote-backed learner-facing references and disallow generated-needs-review evidence.'
  },
  summary,
  topic_policy_rows: topicRows,
  topic_alias_probes: topicAliasProbes,
  retrieval_matrix_rows: retrievalMatrixRows,
  case_classification_rows: caseRows,
  claim_classification_rows: claimRows,
  negative_control_rows: negativeControlRows,
  next_actions: [
    'Use this classifier contract in runtime retrieval before any learner-facing high-risk recommendation is shown.',
    'Keep high-risk classification separate from release approval; quote-depth, claim-entailment, and clinician review gates still block national rollout.',
    'Add clinician-authored topic tags to future cases and feedback claims so classification does not depend on free-text matching.',
    'Expand retrieval matrix probes as the case bank grows across ESI levels, chief complaints, and common ED safety traps.'
  ]
};

function toMarkdown(data) {
  const lines = [
    '# High-Risk Clinical Classification Report',
    '',
    `Generated: ${data.generated_at}`,
    '',
    data.warning,
    '',
    '## Summary',
    '',
    `- High-risk topics classified: ${data.summary.structured_topic_policy_rows}/${data.summary.high_risk_topics_from_quality_report}`,
    `- Topic alias probes passed: ${data.summary.topic_alias_probes_passed}/${data.summary.topic_alias_probes}`,
    `- Retrieval matrix rows passed: ${data.summary.retrieval_matrix_rows_passed}/${data.summary.retrieval_matrix_rows}`,
    `- Case rows classified: ${data.summary.case_rows_classified}`,
    `- High-risk case rows: ${data.summary.case_rows_high_risk}`,
    `- Claim sets classified: ${data.summary.claim_sets_classified}`,
    `- High-risk claim sets: ${data.summary.high_risk_claim_sets}`,
    `- Negative controls classified nonclinical: ${data.summary.negative_controls_classified_nonclinical}/${data.summary.negative_control_probes}`,
    `- Fallback-only high-risk probes: ${data.summary.regex_fallback_only_high_risk_probes}`,
    `- Classification policy ready: ${data.summary.high_risk_classification_policy_ready}`,
    `- Classification release ready: ${data.summary.high_risk_classification_release_ready}`,
    '',
    '## Topic Policy',
    '',
    '| Topic | Aliases | Sources | Facets | Quote Depth Row | Basis |',
    '|---|---:|---:|---:|---|---|',
    ...data.topic_policy_rows.map((row) =>
      `| ${row.topic} | ${row.alias_count} | ${row.allowlisted_source_count} | ${row.facet_count} | ${row.quote_depth_row_present} | ${markdownEscape(row.classification_basis.join(', '))} |`
    ),
    '',
    '## Claim Domains',
    '',
    '| Domain | Risk Level | Known Policy | Basis | Release Ready |',
    '|---|---|---|---|---|',
    ...data.claim_classification_rows.map((row) =>
      `| ${row.domain_key} | ${row.risk_level} | ${row.known_domain_policy} | ${markdownEscape(row.classification_basis.join(', '))} | ${row.release_ready} |`
    ),
    '',
    '## Next Actions',
    '',
    ...data.next_actions.map((action) => `- ${action}`)
  ];
  return `${lines.join('\n')}\n`;
}

writeFileSync(JSON_OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
writeFileSync(MD_OUTPUT_PATH, toMarkdown(report), 'utf8');

console.log(JSON.stringify({
  review_status: report.review_status,
  high_risk_topics: summary.structured_topic_policy_rows,
  topic_alias_probes: `${summary.topic_alias_probes_passed}/${summary.topic_alias_probes}`,
  retrieval_matrix_rows: `${summary.retrieval_matrix_rows_passed}/${summary.retrieval_matrix_rows}`,
  claim_sets_classified: summary.claim_sets_classified,
  regex_fallback_only_high_risk_probes: summary.regex_fallback_only_high_risk_probes,
  high_risk_classification_policy_ready: summary.high_risk_classification_policy_ready,
  report_path: JSON_OUTPUT_PATH
}, null, 2));

if (!policyReady) {
  throw new Error('High-risk clinical classification policy has unresolved gaps.');
}
