import clinicalSourceQualityReport from '../data/public_clinical_source_quality_report.json';
import clinicalRetrievalMatrix from '../data/clinical_retrieval_matrix.json';

export const HIGH_RISK_CLINICAL_CLASSIFICATION_VERSION = 'high_risk_clinical_classification_v1';

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

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function topicLabelAlias(topic) {
  return String(topic || '').replaceAll('_', ' ');
}

function retrievalAliasesForTopic(topic) {
  return clinicalRetrievalMatrix
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

const HIGH_RISK_TOPIC_TAGS = clinicalSourceQualityReport.high_risk_quote_core_topics || [];
const HIGH_RISK_TOPIC_ALIAS_MAP = Object.fromEntries(
  HIGH_RISK_TOPIC_TAGS.map((topic) => [topic, aliasesForTopic(topic)])
);

function textMatchesAlias(normalized, alias) {
  if (!normalized || !alias) return false;
  if (normalized.includes(alias)) return true;
  const tokens = alias.split(' ').filter((token) => token.length > 2);
  return tokens.length > 1 && tokens.every((token) => normalized.includes(token));
}

function topicsFromText(value) {
  const normalized = normalizedText(value);
  if (!normalized) return [];
  return HIGH_RISK_TOPIC_TAGS.filter((topic) =>
    (HIGH_RISK_TOPIC_ALIAS_MAP[topic] || []).some((alias) => textMatchesAlias(normalized, alias))
  );
}

function actionSignalsForCase(caseRecord = {}) {
  const combined = {
    ...(caseRecord.interventions || {}),
    ...(caseRecord.source?.interventions || {}),
    ...(caseRecord.source?.outcomes || {})
  };
  return HIGH_RISK_ACTION_SIGNALS.filter((key) => Boolean(combined[key] || caseRecord[key]));
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

export function highRiskClassificationPolicySummary() {
  return {
    classifier_version: HIGH_RISK_CLINICAL_CLASSIFICATION_VERSION,
    high_risk_topic_count: HIGH_RISK_TOPIC_TAGS.length,
    high_risk_topic_tags: HIGH_RISK_TOPIC_TAGS,
    core_high_risk_facets: CORE_HIGH_RISK_FACETS,
    high_risk_claim_domains: HIGH_RISK_CLAIM_DOMAINS,
    high_risk_action_signals: HIGH_RISK_ACTION_SIGNALS,
    safety_fallback_terms: SAFETY_FALLBACK_TERMS,
    topic_alias_counts: Object.fromEntries(
      HIGH_RISK_TOPIC_TAGS.map((topic) => [topic, HIGH_RISK_TOPIC_ALIAS_MAP[topic]?.length || 0])
    )
  };
}

export function classifyClinicalRisk({
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
  const matchedTopicsFromTags = explicitTopicTags.filter((topic) => HIGH_RISK_TOPIC_TAGS.includes(topic));
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
    schema_version: 'clinical_risk_classification_v1',
    classifier_version: HIGH_RISK_CLINICAL_CLASSIFICATION_VERSION,
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

export function isHighRiskClinicalQuery(queryText, context = {}) {
  return classifyClinicalRisk({ ...context, queryText }).high_risk;
}
