import cases from '../data/cases.json';
import reviewedAugmentations from '../data/case_augmentations.review.json';
import { findSemanticMatch, prewarmSemanticEmbeddings } from './embeddingService';
import {
  PATIENT_DIALOGUE_CACHE_VERSION,
  PATIENT_DIALOGUE_ENGINE_VERSION,
  PATIENT_DIALOGUE_PROMPT_VERSION,
  buildPatientView,
  patientViewForModel,
  planPatientAnswer,
  renderPatientAnswer,
  validatePatientSpeech
} from './patientDialogueEngine';
import {
  buildFeedbackEvidenceLanes,
  buildLearnerProfileFeedback
} from './debriefEngine';
import {
  BACKGROUND_DOMAINS,
  CATEGORY_LABELS,
  INTERVIEW_MODES,
  INTERVIEW_SUPPORTS,
  QUESTION_CATALOG,
  QUESTION_DOMAIN_CHECKS,
  QUESTION_DOMAIN_ORDER,
  categoryLabels,
  evaluateInterview,
  interviewRequirements,
  interviewTurnTeachingNote
} from './interviewEngine';
import {
  learnerProfileFocus,
  readLearnerProfile
} from './learnerProfileService';
import {
  buildFocusedExamSelection,
  scoreFocusedExamSelection
} from './examEngine';

const sessions = new Map();
const completedSessions = new Map();
let localResearchCaseBundle = null;

export const DEFAULT_TUTOR_MODEL = 'openrouter/free';
export const DEFAULT_PATIENT_DIALOGUE_MODEL = 'openrouter/auto';
const TUTOR_SESSION_KEY = 'ed_triage_openrouter_key';
const TUTOR_LOCAL_KEY = 'ed_triage_openrouter_key';
const TUTOR_MODEL_KEY = 'ed_triage_openrouter_model';
const PATIENT_DIALOGUE_MODEL_KEY = 'ed_triage_openrouter_patient_model';
const RESTRICTED_AI_SESSION_KEY = 'ed_triage_restricted_ai_enabled';
const TUTOR_STORAGE_KEY = 'ed_triage_openrouter_storage';
const PATIENT_RESPONSE_CACHE_VERSION = PATIENT_DIALOGUE_CACHE_VERSION;
const PATIENT_PERSONA_VERSION = PATIENT_DIALOGUE_ENGINE_VERSION;
const PATIENT_PROMPT_VERSION = PATIENT_DIALOGUE_PROMPT_VERSION;
const PATIENT_AI_FAST_TIMEOUT_MS = 6000;
const PATIENT_AI_BACKGROUND_TIMEOUT_MS = 8000;
const PATIENT_RESPONSE_CACHE_KEY = 'ed_triage_patient_response_cache_v7';
const PATIENT_RESPONSE_CACHE_LIMIT = 250;
const REASONING_REVIEW_CACHE_KEY = 'ed_triage_reasoning_review_cache_v1';
const REASONING_REVIEW_CACHE_LIMIT = 60;
const REASONING_REVIEW_VERSION = 'reasoning_review_v1';

const REASONING_RUBRICS = [
  {
    id: 'provisional_esi_rationale',
    label: 'Provisional ESI rationale',
    possible: 10,
    criteria: [
      { label: 'Early acuity estimate', points: 4, description: 'Uses the intake and interview evidence available before vital review.' },
      { label: 'Risk framing', points: 3, description: 'Names immediate safety concerns, red flags, or reasons the patient can safely wait.' },
      { label: 'Reassessment plan', points: 3, description: 'Identifies the objective data or change in status that should update the early estimate.' }
    ]
  },
  {
    id: 'final_esi_rationale',
    label: 'Final ESI rationale',
    possible: 20,
    criteria: [
      { label: 'ESI logic', points: 5, description: 'Connects the selected ESI level to acuity, high-risk features, and expected ED flow.' },
      { label: 'Objective signals', points: 5, description: 'Uses vital signs, pain, distress, and other objective triage findings accurately.' },
      { label: 'Resource reasoning', points: 4, description: 'Links expected labs, imaging, medications, procedures, monitoring, or consultation to the ESI decision.' },
      { label: 'Safety prioritization', points: 4, description: 'Identifies why immediate rooming, monitoring, or routine waiting is appropriate.' },
      { label: 'Concise synthesis', points: 2, description: 'Presents the reasoning in a focused statement without unsupported diagnosis claims.' }
    ]
  },
  {
    id: 'escalation_rationale',
    label: 'Escalation rationale',
    possible: 15,
    criteria: [
      { label: 'Action-evidence match', points: 5, description: 'Ties selected or deferred actions to documented case signals.' },
      { label: 'Immediate safety needs', points: 4, description: 'Addresses placement, monitoring, airway, circulation, pain, behavioral safety, or clinician notification when indicated.' },
      { label: 'Avoids unsupported escalation', points: 3, description: 'Avoids adding actions that are not supported by the case data.' },
      { label: 'Operational clarity', points: 3, description: 'States a clear triage plan the receiving team can act on.' }
    ]
  },
  {
    id: 'sbar_handoff',
    label: 'SBAR handoff',
    possible: 20,
    criteria: [
      { label: 'Situation', points: 4, description: 'States the current problem, arrival context, and immediate concern.' },
      { label: 'Background', points: 4, description: 'Includes relevant age, transport, history, medications, allergies, or risk context.' },
      { label: 'Assessment', points: 5, description: 'Summarizes acuity, vital-sign interpretation, risk, and likely resource needs.' },
      { label: 'Recommendation', points: 5, description: 'Gives a clear next step for placement, monitoring, clinician evaluation, or immediate action.' },
      { label: 'Concise handoff structure', points: 2, description: 'Uses a compact SBAR format without unnecessary narrative detail.' }
    ]
  }
];

const TRIAGE_ACTIONS = [
  {
    id: 'immediate_bedside_evaluation',
    name: 'Request immediate clinician evaluation',
    category: 'Escalation',
    description: 'Use when reference acuity, danger-zone vitals, or critical outcome signals indicate high risk.',
    evidence_type: 'ESI/vitals'
  },
  {
    id: 'resuscitation_bay',
    name: 'Prepare resuscitation placement',
    category: 'Placement',
    description: 'Use when airway, breathing, circulation, or neurologic safety may require immediate intervention.',
    evidence_type: 'ESI/vitals'
  },
  {
    id: 'monitored_bed',
    name: 'Place in monitored care area',
    category: 'Placement',
    description: 'Use when ESI level, vital signs, or outcome signals support close observation.',
    evidence_type: 'ESI/vitals'
  },
  {
    id: 'airway_oxygenation_support',
    name: 'Escalate airway or oxygenation support',
    category: 'Airway and breathing',
    description: 'Supported by abnormal oxygenation, respiratory distress, nebulized treatment, or ventilation fields.',
    evidence_type: 'Source record or ESI/vitals'
  },
  {
    id: 'vascular_access',
    name: 'Prioritize vascular access and bloodwork',
    category: 'Access and circulation',
    description: 'Supported by IV access, IV fluids, parenteral medications, labs, transfusion, or resource counts.',
    evidence_type: 'Source record'
  },
  {
    id: 'medication_route_priority',
    name: 'Anticipate medication route needs',
    category: 'Medications',
    description: 'Supported by recorded IV, IM, nebulized, psychotropic, or medication-tier fields.',
    evidence_type: 'Source record'
  },
  {
    id: 'bleeding_transfusion_readiness',
    name: 'Escalate bleeding or transfusion readiness',
    category: 'Access and circulation',
    description: 'Supported by transfusion, red-cell order, shock-like vitals, or bleeding language in the case.',
    evidence_type: 'Source record or ESI/vitals'
  },
  {
    id: 'critical_procedure_team',
    name: 'Prepare for critical procedure support',
    category: 'Critical procedures',
    description: 'Supported by recorded critical procedure, emergency medication, or immediate stabilization signals.',
    evidence_type: 'Source record'
  },
  {
    id: 'behavioral_safety',
    name: 'Begin behavioral safety precautions',
    category: 'Safety',
    description: 'Supported by psychotropic medication use or behavioral health risk language in the case.',
    evidence_type: 'Source record or case text'
  },
  {
    id: 'pain_reassessment',
    name: 'Flag severe pain for reassessment',
    category: 'Safety',
    description: 'Supported by the structured triage pain score.',
    evidence_type: 'Source vitals'
  }
];

const TRIAGE_ACTION_ORDER = TRIAGE_ACTIONS.map((item) => item.id);
const actionLookup = Object.fromEntries(TRIAGE_ACTIONS.map((item) => [item.id, item]));

const REASSESSMENT_TARGETS = [
  {
    id: 'vital_trend',
    label: 'Repeat abnormal vital signs',
    category: 'Objective trend',
    description: 'Track heart rate, blood pressure, respiratory rate, oxygen saturation, temperature, or pain after initial actions.'
  },
  {
    id: 'pain_response',
    label: 'Reassess pain and distress',
    category: 'Symptoms',
    description: 'Confirm whether pain, distress, nausea, or discomfort improves or worsens after initial treatment.'
  },
  {
    id: 'airway_breathing',
    label: 'Recheck airway and breathing',
    category: 'Airway and breathing',
    description: 'Watch work of breathing, oxygenation, speech, wheezing, and need for oxygen or ventilatory support.'
  },
  {
    id: 'circulation_bleeding',
    label: 'Recheck perfusion or bleeding risk',
    category: 'Circulation',
    description: 'Reassess blood pressure, perfusion, bleeding, IV access needs, and response to fluids or blood product readiness.'
  },
  {
    id: 'neuro_mental_status',
    label: 'Reassess neurologic or mental status',
    category: 'Neurologic safety',
    description: 'Trend confusion, focal deficits, seizure risk, headache red flags, behavioral safety, or level of consciousness.'
  },
  {
    id: 'infection_fever',
    label: 'Reassess fever or infection trajectory',
    category: 'Infection risk',
    description: 'Watch fever curve, systemic symptoms, suspected source, sepsis risk, and response to early treatment.'
  },
  {
    id: 'distal_neurovascular',
    label: 'Repeat distal neurovascular checks',
    category: 'Extremity injury',
    description: 'Trend pulses, sensation, motor function, capillary refill, swelling, and compartment-type pain.'
  },
  {
    id: 'disposition_safety',
    label: 'Confirm disposition safety',
    category: 'Flow and handoff',
    description: 'Confirm whether the patient is safe for routine wait, monitored placement, admission, transfer, or discharge planning.'
  }
];

const reassessmentTargetLookup = Object.fromEntries(REASSESSMENT_TARGETS.map((item) => [item.id, item]));

const COMMON_SPECIALTY_OPTIONS = [
  'Emergency medicine attending',
  'Cardiology',
  'Neurology',
  'General surgery',
  'Orthopedics',
  'Pulmonology',
  'Critical care',
  'Obstetrics and gynecology',
  'Psychiatry',
  'Social work or case management'
];

const DEFAULT_INTERVENTION_FLAGS = {
  invasive_ventilation: false,
  intravenous: false,
  intravenous_fluids: false,
  intramuscular: false,
  oral_medications: false,
  nebulized_medications: false,
  tier1_med_usage_1h: false,
  tier2_med_usage: false,
  tier3_med_usage: false,
  tier4_med_usage: false,
  critical_procedure: false,
  psychotropic_med_within_120min: false
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function listFromValue(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  if (value === null || value === undefined) return [];
  const text = String(value).trim();
  if (!text) return [];
  return text
    .replace(/^\[|\]$/g, '')
    .split(/;|,\s*(?=[A-Z][A-Za-z/ -]{2,})/)
    .map((item) => item.replace(/^['"]|['"]$/g, '').trim())
    .filter(Boolean);
}

function normalizeClinicalCase(rawCaseData, sourceMode = 'public_demo') {
  const caseData = clone(rawCaseData);
  const isMimicV2 = caseData.schema_version === 'clinical_case_v2' ||
    caseData.source_restriction === 'credentialed_local_only';
  const sourceDataset = caseData.source?.dataset || (isMimicV2 ? 'MIMIC-IV-Ext-CDS' : 'MIETIC validation sample');
  const sourceRestriction = caseData.source_restriction || caseData.source?.restriction || (isMimicV2 ? 'credentialed_local_only' : 'public_demo');
  const diagnoses = caseData.ground_truth?.diagnoses || {};
  const referral = caseData.ground_truth?.referral || {
    clinician_approved_specialty: caseData.ground_truth?.clinician_approved_specialty || []
  };

  return {
    ...caseData,
    case_source: isMimicV2 ? 'mimic_restricted_local' : 'mietic_public_demo',
    source_restriction: sourceRestriction,
    source_mode: sourceMode,
    outcome: caseData.outcome || caseData.history || '',
    disposition: caseData.disposition || caseData.ground_truth?.disposition || '',
    interventions: {
      ...DEFAULT_INTERVENTION_FLAGS,
      ...(caseData.interventions || {})
    },
    transfer_to_icu_in_1h: Boolean(caseData.transfer_to_icu_in_1h),
    transfer_to_icu_beyond_1h: Boolean(caseData.transfer_to_icu_beyond_1h),
    transfer_within_1h: Boolean(caseData.transfer_within_1h),
    transfer_beyond_1h: Boolean(caseData.transfer_beyond_1h),
    expired_within_1h: Boolean(caseData.expired_within_1h),
    expired_beyond_1h: Boolean(caseData.expired_beyond_1h),
    red_cell_order_more_than_1: Boolean(caseData.red_cell_order_more_than_1),
    transfusion_within_1h: Boolean(caseData.transfusion_within_1h),
    transfusion_beyond_1h: Boolean(caseData.transfusion_beyond_1h),
    non_invasive_ventilation: Boolean(caseData.non_invasive_ventilation),
    lab_event_count: Number(caseData.lab_event_count || 0),
    microbio_event_count: Number(caseData.microbio_event_count || 0),
    exam_count: Number(caseData.exam_count || 0),
    consults_count: Number(caseData.consults_count || 0),
    procedure_count: Number(caseData.procedure_count || 0),
    resources_used: Number(caseData.resources_used || 0),
    tasks_available: {
      triage: true,
      diagnosis: true,
      referral: isMimicV2,
      management: true,
      reassessment: true,
      sbar: true,
      ...(caseData.tasks_available || {})
    },
    ground_truth: {
      ...(caseData.ground_truth || {}),
      diagnoses: {
        primary: listFromValue(diagnoses.primary),
        secondary: listFromValue(diagnoses.secondary),
        icd: diagnoses.icd || {},
        raw_diagnosis_text: diagnoses.raw_diagnosis_text || ''
      },
      referral: {
        clinician_approved_specialty: listFromValue(referral.clinician_approved_specialty)
      },
      disposition: caseData.ground_truth?.disposition || caseData.disposition || '',
      tests: caseData.ground_truth?.tests || '',
      medications: caseData.ground_truth?.medications || caseData.ground_truth?.past_medication || '',
      reference_esi: caseData.ground_truth?.reference_esi || caseData.acuity
    },
    source: {
      ...(caseData.source || {}),
      dataset: sourceDataset,
      restriction: sourceRestriction,
      display_name: isMimicV2 ? 'Restricted local MIMIC-IV-Ext-CDS mode' : 'Public demo mode'
    },
    documented_evidence: (caseData.documented_evidence || []).map((item) => ({
      provenance: item.provenance || 'source_record',
      source_restriction: item.source_restriction || sourceRestriction,
      ...item
    }))
  };
}

function publicCaseSourceState() {
  return {
    mode: 'public_demo',
    label: 'Public demo mode',
    dataset: 'Nonrestricted demo bundle',
    restriction: 'public_demo',
    case_count: cases.length,
    validation_note: 'Public deployment does not expose credentialed MIMIC data.'
  };
}

function activeCaseSourceState() {
  if (!localResearchCaseBundle) return publicCaseSourceState();
  return {
    mode: 'mimic_restricted_local',
    label: 'Restricted local MIMIC mode',
    dataset: localResearchCaseBundle.source_dataset || 'MIMIC-IV-Ext-CDS',
    restriction: localResearchCaseBundle.source_restriction || 'credentialed_local_only',
    case_count: localResearchCaseBundle.cases.length,
    file_name: localResearchCaseBundle.file_name || '',
    validation_note: 'Credentialed cases are loaded only into browser memory for local validation.'
  };
}

function validateLocalResearchBundle(payload) {
  const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
  const caseList = Array.isArray(parsed) ? parsed : parsed?.cases;
  if (!Array.isArray(caseList) || !caseList.length) {
    throw new Error('Local case bundle must contain a non-empty cases array.');
  }
  const invalid = caseList.find((item) =>
    item.schema_version !== 'clinical_case_v2' ||
    item.source_restriction !== 'credentialed_local_only' ||
    item.source?.dataset !== 'MIMIC-IV-Ext-CDS'
  );
  if (invalid) {
    throw new Error('Local MIMIC mode accepts only clinical_case_v2 cases marked credentialed_local_only.');
  }
  const missingExam = caseList.find((item) => !(item.augmentation?.inferred_facts || []).some((fact) =>
    (fact.domain === 'physical_exam' || (fact.use_in || []).includes('physical_exam')) &&
    ['local_teaching_draft', 'reviewed'].includes(fact.review_status) &&
    ['source_record', 'local_teaching_inference'].includes(fact.provenance)
  ));
  if (missingExam) {
    throw new Error(`Local MIMIC case ${missingExam.id || 'unknown'} is missing focused exam coverage. Regenerate the restricted case bundle before learner use.`);
  }
  return {
    source_dataset: parsed.source_dataset || 'MIMIC-IV-Ext-CDS',
    source_version: parsed.source_version || '',
    source_restriction: parsed.source_restriction || 'credentialed_local_only',
    cases: caseList
  };
}

export function loadStaticLocalCaseBundle(payload, fileName = '') {
  localResearchCaseBundle = {
    ...validateLocalResearchBundle(payload),
    file_name: fileName
  };
  sessions.clear();
  completedSessions.clear();
  return activeCaseSourceState();
}

export function clearStaticLocalCaseBundle() {
  localResearchCaseBundle = null;
  sessions.clear();
  completedSessions.clear();
  return activeCaseSourceState();
}

export function getStaticCaseSourceState() {
  return activeCaseSourceState();
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hashText(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function truncateText(text, maxLength = 1400) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  return value.length > maxLength ? `${value.slice(0, maxLength).trim()}...` : value;
}

function sessionId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `session_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function hasAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function complaintText(caseData) {
  return `${caseData.complaint || ''} ${caseData.history || ''}`.toLowerCase();
}

function formatVitals(caseData) {
  const { vitals } = caseData;
  const values = [];
  if (vitals.hr !== null && vitals.hr !== undefined) values.push({ name: 'Heart Rate', value: `${vitals.hr} bpm` });
  if (vitals.sbp !== null || vitals.dbp !== null) values.push({ name: 'Blood Pressure', value: `${Math.round(vitals.sbp)}/${Math.round(vitals.dbp)} mmHg` });
  if (vitals.rr !== null && vitals.rr !== undefined) values.push({ name: 'Respiratory Rate', value: `${vitals.rr} breaths/min` });
  if (vitals.o2 !== null && vitals.o2 !== undefined) values.push({ name: 'Oxygen Saturation', value: `${vitals.o2}%` });
  if (vitals.temp !== null && vitals.temp !== undefined) values.push({ name: 'Temperature', value: `${vitals.temp} F` });
  if (vitals.pain !== null && vitals.pain !== undefined) values.push({ name: 'Pain Level', value: `${vitals.pain}/10` });
  return values;
}

function formatVitalNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1);
}

function formattedVitalSigns(caseData) {
  const vitals = caseData.vitals || {};
  const values = [];
  if (vitals.temp !== null && vitals.temp !== undefined) values.push(`temperature ${formatVitalNumber(vitals.temp)} F`);
  if (vitals.hr !== null && vitals.hr !== undefined) values.push(`heart rate ${formatVitalNumber(vitals.hr)}`);
  if (vitals.rr !== null && vitals.rr !== undefined) values.push(`respiratory rate ${formatVitalNumber(vitals.rr)}`);
  if (vitals.sbp !== null && vitals.sbp !== undefined && vitals.dbp !== null && vitals.dbp !== undefined) {
    values.push(`blood pressure ${Math.round(vitals.sbp)}/${Math.round(vitals.dbp)}`);
  }
  if (vitals.o2 !== null && vitals.o2 !== undefined) values.push(`oxygen saturation ${formatVitalNumber(vitals.o2)}%`);
  if (vitals.pain !== null && vitals.pain !== undefined) values.push(`pain ${formatVitalNumber(vitals.pain)}/10`);
  return values.length ? values.join(', ') : 'no recorded triage vital signs';
}

function vitalFlags(caseData) {
  const { vitals } = caseData;
  const flags = [];
  if (vitals.hr !== null && vitals.hr !== undefined) {
    if (vitals.hr >= 130 || vitals.hr < 50) flags.push({ name: 'Heart Rate', value: `${vitals.hr} bpm`, severity: 'critical', reason: vitals.hr >= 130 ? 'critical tachycardia' : 'critical bradycardia' });
    else if (vitals.hr >= 110 || vitals.hr < 60) flags.push({ name: 'Heart Rate', value: `${vitals.hr} bpm`, severity: 'watch', reason: 'abnormal heart rate' });
  }
  if (vitals.sbp !== null && vitals.sbp !== undefined) {
    const bp = `${Math.round(vitals.sbp)}/${Math.round(vitals.dbp)} mmHg`;
    if (vitals.sbp < 90 || vitals.sbp >= 180) flags.push({ name: 'Blood Pressure', value: bp, severity: 'critical', reason: vitals.sbp >= 180 ? 'critical hypertension' : 'critical hypotension' });
    else if (vitals.sbp < 100 || vitals.sbp >= 160) flags.push({ name: 'Blood Pressure', value: bp, severity: 'watch', reason: 'abnormal blood pressure' });
  }
  if (vitals.rr !== null && vitals.rr !== undefined) {
    if (vitals.rr >= 30 || vitals.rr < 8) flags.push({ name: 'Respiratory Rate', value: `${vitals.rr} breaths/min`, severity: 'critical', reason: vitals.rr >= 30 ? 'critical tachypnea' : 'critical bradypnea' });
    else if (vitals.rr >= 22 || vitals.rr < 12) flags.push({ name: 'Respiratory Rate', value: `${vitals.rr} breaths/min`, severity: 'watch', reason: 'abnormal respiratory rate' });
  }
  if (vitals.o2 !== null && vitals.o2 !== undefined) {
    if (vitals.o2 < 90) flags.push({ name: 'Oxygen Saturation', value: `${vitals.o2}%`, severity: 'critical', reason: 'hypoxemia' });
    else if (vitals.o2 < 94) flags.push({ name: 'Oxygen Saturation', value: `${vitals.o2}%`, severity: 'watch', reason: 'borderline oxygenation' });
  }
  if (vitals.temp !== null && vitals.temp !== undefined) {
    if (vitals.temp >= 103 || vitals.temp < 95) flags.push({ name: 'Temperature', value: `${vitals.temp} F`, severity: 'critical', reason: vitals.temp >= 103 ? 'critical hyperthermia' : 'critical hypothermia' });
    else if (vitals.temp >= 100.4 || vitals.temp < 96.8) flags.push({ name: 'Temperature', value: `${vitals.temp} F`, severity: 'watch', reason: 'abnormal temperature' });
  }
  if (vitals.pain !== null && vitals.pain !== undefined) {
    if (vitals.pain >= 8) flags.push({ name: 'Pain Level', value: `${vitals.pain}/10`, severity: 'critical', reason: 'severe pain or distress' });
    else if (vitals.pain >= 5) flags.push({ name: 'Pain Level', value: `${vitals.pain}/10`, severity: 'watch', reason: 'moderate pain' });
  }
  return flags;
}

function isNegatedClinicalPhrase(sentence, termPattern) {
  const lower = String(sentence || '').toLowerCase();
  const match = lower.match(termPattern);
  if (!match || match.index === undefined) return false;
  const windowText = lower.slice(Math.max(0, match.index - 34), match.index);
  return /\b(no|not|denies|denied|without|negative for|free of)\b/.test(windowText);
}

function sentenceHasPositiveClinicalPhrase(text, positivePatterns = []) {
  return sentenceSplit(text).some((sentence) =>
    positivePatterns.some((pattern) => pattern.test(sentence) && !isNegatedClinicalPhrase(sentence, pattern))
  );
}

function hasPositiveRespiratoryEvidence(caseData) {
  const complaint = plainComplaint(caseData.complaint).toLowerCase();
  const history = String(caseData.history || '');
  const respiratoryPatterns = [
    /\bshort(?:ness)? of breath\b/i,
    /\btrouble breathing\b/i,
    /\bdifficulty breathing\b/i,
    /\bdyspnea\b/i,
    /\bsob\b/i,
    /\bwheez(?:e|ing)\b/i,
    /\brespiratory distress\b/i,
    /\bhypox(?:ia|emic|emia)\b/i,
    /\bstridor\b/i
  ];
  const reviewedRespiratory = reviewedInferredFacts(caseData).some((fact) => {
    const isExamTarget = fact.domain === 'physical_exam' || (fact.use_in || []).includes('physical_exam');
    const isSourceFact = fact.provenance === 'source_record' || (fact.use_in || []).includes('grading_reference');
    if (isExamTarget && !isSourceFact) return false;
    return /respiratory|dyspnea|shortness of breath|oxygen|wheeze|hypox/i.test(`${fact.domain || ''} ${fact.statement || ''}`);
  });
  return respiratoryPatterns.some((pattern) => pattern.test(complaint)) ||
    sentenceHasPositiveClinicalPhrase(history, respiratoryPatterns) ||
    reviewedRespiratory;
}

function hasObjectiveRespiratorySupport(caseData, flags = vitalFlags(caseData)) {
  const interventions = caseData.interventions || {};
  return flags.some((item) => ['Oxygen Saturation', 'Respiratory Rate'].includes(item.name)) ||
    interventions.nebulized_medications ||
    interventions.invasive_ventilation ||
    caseData.non_invasive_ventilation;
}

function isLacerationCase(caseData) {
  return /\b(laceration|cut|lac|wound|suture)\b/i.test(`${caseData.complaint || ''} ${caseData.history || ''}`);
}

function isMedicationRefillCase(caseData) {
  return /\b(med refill|medication refill|refill)\b/i.test(`${caseData.complaint || ''} ${caseData.history || ''}`);
}

function lacerationDataLimitations(caseData) {
  if (!isLacerationCase(caseData)) return [];
  const missing = new Set((caseData.missing_evidence || []).map((item) => item.domain));
  const sourceOnly = caseData?.augmentation?.review_status !== 'reviewed';
  if (!sourceOnly && !missing.size) return [];
  return [
    'The source record does not specify wound depth, contamination, bleeding control, tendon function, sensation, capillary refill, range of motion, tetanus status, repair need, or imaging result.'
  ];
}

function medicationRefillDataLimitations(caseData) {
  if (!isMedicationRefillCase(caseData)) return [];
  const sourceOnly = caseData?.augmentation?.review_status !== 'reviewed';
  if (!sourceOnly && !(caseData.missing_evidence || []).length) return [];
  return [
    'The source record does not document medication name, dose, last dose, reason the refill is needed, missed doses, withdrawal or disease-risk symptoms, refill safety, or outpatient access plan.'
  ];
}

function sourceDataLimitations(caseData) {
  const limitations = [
    ...lacerationDataLimitations(caseData),
    ...medicationRefillDataLimitations(caseData)
  ];
  if (!limitations.length && caseData?.augmentation?.review_status !== 'reviewed' && (caseData.missing_evidence || []).length) {
    limitations.push('The source record is missing reviewed focused exam details, so the debrief should treat exam-dependent conclusions as provisional.');
  }
  return limitations;
}

function lowAcuityTeachingProfile(caseData) {
  if (isMedicationRefillCase(caseData)) {
    return {
      id: 'medication_refill',
      problem: 'medication refill request',
      routine_care_reason: 'Stable vital signs, no pain, no documented danger signal, and no counted ED resources support routine low-acuity care.',
      verification_focus: 'Verify medication name, dose, last dose, refill reason, missed doses, symptoms from missed therapy, refill safety, and outpatient access.',
      plan_items: [
        'Verify the medication name, dose, last dose taken, and reason the refill is needed.',
        'Screen for symptoms from missed therapy, withdrawal risk, disease worsening, pregnancy-related medication risk when relevant, and medication contraindications.',
        'Confirm refill safety, provide a bridge refill only when clinically appropriate, and arrange primary care, pharmacy, or specialty follow-up access.',
        'Give return precautions for new symptoms, worsening disease control, medication reaction, or inability to obtain essential medication.'
      ],
      ddx: [
        { diagnosis: 'Medication access issue', rationale: 'Most consistent with a stable refill request when no acute symptoms, pain, unstable vital signs, or counted ED resources are documented.' },
        { diagnosis: 'Disease control risk from missed medication', rationale: 'Consider when missed doses could worsen hypertension, diabetes, seizures, anticoagulation, psychiatric disease, withdrawal risk, or another chronic condition.' },
        { diagnosis: 'Occult acute complaint', rationale: 'Screen for new symptoms or medication-related adverse effects before treating the visit as a simple refill.' }
      ],
      checklist: [
        'Ask for the medication name, dose, last dose, refill reason, and missed doses.',
        'Screen for withdrawal symptoms, disease worsening, contraindications, pregnancy-related medication risk when relevant, and adverse effects.',
        'Document why ESI 5 fits: stable vitals, no danger signal, no pain or distress, and no counted ED resources expected.',
        'Close the plan with refill safety, outpatient access, and return precautions.'
      ]
    };
  }
  return null;
}

function reviewedInferredFacts(caseData, useIn = '') {
  const augmentation = caseData?.augmentation || {};
  if (augmentation.review_status !== 'reviewed') return [];
  return (augmentation.inferred_facts || []).filter((fact) => {
    if (fact.review_status !== 'reviewed') return false;
    if (!useIn) return true;
    return (fact.use_in || []).includes(useIn);
  });
}

function reviewedFactStatements(caseData, useIn = '') {
  return reviewedInferredFacts(caseData, useIn)
    .map((fact) => fact.statement)
    .filter(Boolean);
}

function reviewedPhysicalExamFacts(caseData) {
  const reviewedFacts = reviewedInferredFacts(caseData, 'physical_exam')
    .filter((fact) => fact.domain === 'physical_exam' || (fact.use_in || []).includes('physical_exam'));
  if (reviewedFacts.length) return reviewedFacts;

  if (caseData?.source_restriction !== 'credentialed_local_only') return [];
  return (caseData?.augmentation?.inferred_facts || [])
    .filter((fact) => fact.domain === 'physical_exam' || (fact.use_in || []).includes('physical_exam'))
    .filter((fact) => ['local_teaching_draft', 'reviewed'].includes(fact.review_status))
    .filter((fact) => ['source_record', 'local_teaching_inference'].includes(fact.provenance));
}

function reviewedGradingFacts(caseData) {
  return reviewedInferredFacts(caseData)
    .filter((fact) => (fact.use_in || []).includes('grading_reference'));
}

function reviewedAugmentationDiagnosis(caseData) {
  const value = caseData?.augmentation?.review_status === 'reviewed'
    ? caseData.augmentation.likely_working_diagnosis
    : '';
  return String(value || '').trim();
}

function reviewedAugmentationDdx(caseData) {
  if (caseData?.augmentation?.review_status !== 'reviewed') return [];
  return (caseData.augmentation.ddx || []).filter((item) => item?.diagnosis);
}

function augmentationSourceSummary(caseData) {
  const facts = reviewedInferredFacts(caseData);
  if (!facts.length) return '';
  const domains = uniqueSentences(facts.map((fact) => fact.domain).filter(Boolean));
  return `Reviewed inferred teaching details are available for ${joinClinicalList(domains)}.`;
}

function clinicalEvidenceText(caseData, useIn = '') {
  const documented = (caseData?.documented_evidence || [])
    .map((item) => item.statement)
    .filter(Boolean);
  const inferred = reviewedFactStatements(caseData, useIn);
  return [...documented, ...inferred].join(' ');
}

function intakeReportSource(caseData) {
  const transport = String(caseData.demographics.transport || '').toLowerCase();
  const text = complaintText(caseData);
  if (/\btransfer(?:red)?\b/.test(text)) return 'Transfer or referral note';
  if (/ambulance|ems|als|bls/.test(transport)) return 'EMS arrival report';
  if (/walk\s*in/.test(transport)) return 'Patient-stated intake concern';
  return 'Intake desk report';
}

function intakeHistoryNote(caseData) {
  const sentences = sentenceSplit(caseData.history)
    .filter((sentence) => !/\b(initial )?vital signs\b/i.test(sentence))
    .filter((sentence) => !/\bwalked into the ED with vital signs\b/i.test(sentence))
    .map(cleanClinicalHistorySentence)
    .map((sentence) => sentence
      .replace(/,\s*indicating stable condition upon arrival/gi, '')
      .replace(/\s*indicating stable condition upon arrival\.?/gi, '.')
      .replace(/\s*The patient walked into the ED\.?/gi, ''))
    .filter(Boolean);
  const note = sentences.slice(0, 2).join(' ');
  return truncateText(note || `Reported concern: ${presentingProblemText(caseData)}.`, 360);
}

function buildIntakeReport(caseData) {
  const concern = capitalizeSentence(presentingProblemText(caseData));
  return {
    patient: `${Math.round(Number(caseData.demographics.age || 0))}-year-old ${caseData.demographics.sex}`,
    arrival_method: caseData.demographics.transport || 'Not specified',
    source: intakeReportSource(caseData),
    reported_concern: concern,
    confirmation_status: 'Working triage label, not a confirmed diagnosis.',
    intake_note: intakeHistoryNote(caseData)
  };
}

function currentElapsedSeconds(session) {
  if (!session.started_at_ms) return session.elapsed_seconds || 0;
  const end = session.completed_at_ms || Date.now();
  return Math.max(0, Math.floor((end - session.started_at_ms) / 1000));
}

function recordElapsed(session, eventName) {
  session.elapsed_seconds = currentElapsedSeconds(session);
  if (eventName) session.timing_events[eventName] = session.elapsed_seconds;
  return session.elapsed_seconds;
}

function clock(session) {
  session.elapsed_seconds = currentElapsedSeconds(session);
  return {
    elapsed_seconds: session.elapsed_seconds,
    timing_events: clone(session.timing_events),
    started_at_ms: session.started_at_ms || null,
    completed_at_ms: session.completed_at_ms || null
  };
}

function questionMetadata(category) {
  return QUESTION_CATALOG.find((item) => item.id === category) || QUESTION_CATALOG[0];
}

function isGeneralStatusQuestion(question) {
  const q = String(question || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (['hi', 'hello', 'hey'].includes(q)) return true;
  const general =
    /\bhow are you\b/.test(q) ||
    /\bhow are you doing\b/.test(q) ||
    /\bhow'?s it going\b/.test(q) ||
    /\bare you okay\b/.test(q) ||
    /\bhow (are|do) you feel/.test(q) ||
    /\bhow are you feeling\b/.test(q);
  const specific =
    /\bpain\b/.test(q) ||
    /\bbreath/.test(q) ||
    /\bchest\b/.test(q) ||
    /\bweak/.test(q) ||
    /\bnumb/.test(q) ||
    /\bbleed/.test(q) ||
    /\bwhen\b/.test(q) ||
    /\bstart/.test(q) ||
    /\bmedical\b/.test(q) ||
    /\bmedicine\b/.test(q) ||
    /\ballerg/.test(q) ||
    /\bpregnan/.test(q);
  return general && !specific;
}

function classifyQuestionDomains(question) {
  const q = ` ${String(question || '').toLowerCase()} `;
  if (isGeneralStatusQuestion(question)) return ['general_status'];

  const domains = [];
  QUESTION_DOMAIN_CHECKS.forEach(([domain, terms]) => {
    if (terms.some((term) => q.includes(term))) domains.push(domain);
  });
  if (!domains.length) {
    domains.unshift('chief_concern');
  }
  return [...new Set(domains)];
}

function classifyQuestion(question) {
  return classifyQuestionDomains(question)[0];
}

function orderedQuestionDomains(domains = []) {
  const set = new Set(domains.filter(Boolean));
  return QUESTION_DOMAIN_ORDER.filter((domain) => set.has(domain));
}

function domainSignature(domains = []) {
  return orderedQuestionDomains(domains).join('+') || 'general';
}

function isSpecialRiskQuestion(question, domains = []) {
  const q = String(question || '').toLowerCase();
  const domainSet = new Set(domains);
  const asksRiskContext = /\b(risk|blood thinner|blood thinners|anticoagul|pregnan|immune|immuno|frail|frailty|elder|chemo|cancer|transplant|steroid)\b/.test(q);
  return asksRiskContext && ['medications', 'pregnancy', 'medical_history'].some((domain) => domainSet.has(domain));
}

function isBroadBackgroundQuestion(question, domains = []) {
  const q = String(question || '').toLowerCase();
  const background = orderedQuestionDomains(domains).filter((domain) => BACKGROUND_DOMAINS.includes(domain));
  const asksMultipleBackgroundItems =
    /\b(medical problems?|medical history|medicines?|medications?|meds|allerg(?:y|ies)|prior episodes?|similar prior|blood thinners?)\b/.test(q) &&
    background.length >= 2;
  return background.length >= 3 || asksMultipleBackgroundItems;
}

function symptomIntentKeys(question) {
  const q = String(question || '').toLowerCase();
  const symptomIntents = [
    ['chest_pain', ['chest pain', 'chest pressure', 'pressure in your chest', 'chest tight']],
    ['dyspnea', ['shortness of breath', 'trouble breathing', 'hard to breathe', 'difficulty breathing', 'sob', 'dyspnea']],
    ['syncope', ['faint', 'passed out', 'pass out', 'syncope', 'near-syncope', 'nearly faint']],
    ['neuro_weakness', ['weakness', 'weak', 'numb', 'numbness', 'facial droop', 'slurred', 'speech']],
    ['confusion', ['confused', 'confusion', 'disoriented', 'mental status', 'acting normal']],
    ['bleeding', ['bleeding', 'bleed', 'blood', 'vomiting blood', 'black stool', 'melena']],
    ['nausea_vomiting', ['nausea', 'nauseated', 'vomiting', 'throwing up', 'emesis']],
    ['fever_chills', ['fever', 'chills', 'sweats']],
    ['pain', ['pain', 'hurt', 'ache', 'sore']],
    ['allergy', ['allergy', 'allergies', 'allergic']],
    ['medication', ['medicine', 'medication', 'meds', 'blood thinner', 'anticoagulant', 'daily pills']],
    ['pregnancy', ['pregnant', 'pregnancy', 'last period', 'lmp']]
  ];
  return symptomIntents
    .filter(([, terms]) => terms.some((term) => q.includes(term)))
    .map(([key]) => key)
    .sort();
}

function questionIntentKey(question, category, coveredCategories = []) {
  const q = String(question || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (isAnswerKeyQuestion(q)) return 'answer_key';
  if (isGeneralStatusQuestion(q)) return 'general_status';
  if (isMedicalTermClarification(q)) {
    const term = q.match(/\b(sdh|ams|diagnosis|condition|term)\b/)?.[1] || 'clinical_term';
    return `term_clarification:${term}`;
  }

  const domains = orderedQuestionDomains(coveredCategories.length ? coveredCategories : [category]);
  const backgroundDomains = domains.filter((domain) => BACKGROUND_DOMAINS.includes(domain));
  if (isSpecialRiskQuestion(q, domains)) {
    return `risk_context:${domainSignature(backgroundDomains.length ? backgroundDomains : domains)}`;
  }
  if (isBroadBackgroundQuestion(q, domains)) {
    return `background:${domainSignature(backgroundDomains)}`;
  }
  const nonChiefDomains = orderedQuestionDomains(domains).filter((domain) => domain !== 'chief_concern');
  if (nonChiefDomains.length > 1) {
    return `compound:${nonChiefDomains.join('+')}`;
  }
  const symptoms = symptomIntentKeys(q);
  if (domains.includes('red_flags')) {
    const redFlagSymptoms = symptoms.filter((symptom) => symptom !== 'pain' || symptoms.length === 1);
    return `red_flags:${redFlagSymptoms.length ? redFlagSymptoms.join(',') : 'broad'}`;
  }
  if (domains.includes('medications')) {
    if (/\b(blood thinner|blood thinners|anticoagul\w*|warfarin|xarelto|eliquis|plavix|aspirin)\b/.test(q)) {
      return 'medications:blood_thinners';
    }
    return 'medications:current';
  }
  if (domains.includes('allergies')) return 'allergies';
  if (domains.includes('pregnancy')) return 'pregnancy';
  if (domains.includes('medical_history')) return 'medical_history';
  if (domains.includes('prior_episode')) return 'prior_episode';
  if (domains.includes('timeline')) return 'timeline';
  if (domains.includes('severity')) return symptoms.includes('pain') ? 'severity:pain' : 'severity:distress';
  if (domains.includes('chief_concern')) return 'chief_concern';
  return domains.join('|') || 'chief_concern';
}

function plainComplaint(complaint) {
  return String(complaint || 'this problem')
    .replace(/\bsdh\b/gi, 'headache and falls')
    .replace(/\bs\/p\b/gi, 'after')
    .replace(/\bl\s+/gi, 'left ')
    .replace(/\br\s+/gi, 'right ')
    .replace(/\blac\b/gi, 'cut')
    .replace(/\bsob\b/gi, 'shortness of breath')
    .replace(/\bdyspnea\b/gi, 'shortness of breath')
    .replace(/\bn\/v\b/gi, 'nausea and vomiting')
    .replace(/\babd\b/gi, 'abdominal')
    .replace(/\bcp\b/gi, 'chest pain')
    .replace(/\bams\b/gi, 'confusion')
    .replace(/\bmvc\b/gi, 'motor vehicle crash')
    .replace(/,\s*transfer\b/gi, '')
    .replace(/\btransfer,\s*/gi, '')
    .replace(/\btransfer\b/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*$/g, '')
    .trim();
}

function sentenceSplit(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanPatientPhrase(text) {
  return String(text || '')
    .replace(/\b\d+\s*[- ]?year[- ]old\b/gi, '')
    .replace(/\b(white|black|asian|hispanic|male|female|man|woman)\b/gi, '')
    .replace(/^\s*a\s+/i, '')
    .replace(/^\s*an\s+/i, '')
    .replace(/\b(the )?patient\b/gi, 'I')
    .replace(/\bshe\b/gi, 'I')
    .replace(/\bhe\b/gi, 'I')
    .replace(/\bher\b/gi, 'my')
    .replace(/\bhis\b/gi, 'my')
    .replace(/\bhim\b/gi, 'me')
    .replace(/\bherself\b/gi, 'myself')
    .replace(/\bhimself\b/gi, 'myself')
    .replace(/\bpresents? to the ED\b/gi, 'came in')
    .replace(/\bpresented to the ED\b/gi, 'came in')
    .replace(/\bI reports\b/gi, 'I report')
    .replace(/\bI reported\b/gi, 'I reported')
    .replace(/\bI has\b/gi, 'I have')
    .replace(/\bI is\b/gi, 'I am')
    .replace(/\bI was\b/gi, 'I was')
    .replace(/\bI were\b/gi, 'I was')
    .replace(/\bwas found\b/gi, 'was found')
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .trim();
}

function shortEventFromHistory(caseData) {
  const history = String(caseData.history || '').replace(/\s+/g, ' ');
  if (/porch railing gave way/i.test(history)) {
    return 'I fell after the porch railing gave way and landed on my left leg';
  }
  if (/falling from a porch/i.test(history)) {
    return 'I fell from a porch';
  }
  if (/motor vehicle collision|MVC/i.test(history)) {
    return 'I was in a motor vehicle crash';
  }
  const afterMatch = history.match(/\bafter\s+([^.;]{8,100}?)(?:\.|, with|, and| and | but |$)/i);
  if (afterMatch?.[1]) return cleanPatientPhrase(afterMatch[1]);

  const withComplaint = history.match(/\b(?:chief complaint of|complaint of|with)\s+([^.;]{8,100}?)(?:\.|, with|, and| but |$)/i);
  if (withComplaint?.[1] && /\b(fall|fell|collision|crash|hit|injur|seizure|found|woke|started)\b/i.test(withComplaint[1])) {
    return cleanPatientPhrase(withComplaint[1]);
  }
  return '';
}

function capitalizeSentence(text) {
  const value = String(text || '').trim();
  if (!value) return value;
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function hasSubduralChartLanguage(caseData) {
  return /\b(sdh|subdural)\b/i.test(`${caseData?.complaint || ''} ${caseData?.history || ''}`);
}

function hasAlteredConsciousnessLanguage(caseData) {
  return /\b(altered level of consciousness|altered mental status|ams|not oriented|bizarre conversation|encephalopathy)\b/i
    .test(`${caseData?.complaint || ''} ${caseData?.history || ''}`);
}

function patientCollateralSource(caseData) {
  const text = `${caseData?.history || ''} ${caseData?.outcome || ''}`.toLowerCase();
  if (/\bwife\b/.test(text)) return 'wife';
  if (/\bhusband\b/.test(text)) return 'husband';
  if (/\bmother\b/.test(text)) return 'mother';
  if (/\bfather\b/.test(text)) return 'father';
  if (/\bfamily\b/.test(text)) return 'family';
  if (/\bems\b|\bambulance\b/.test(text)) return 'EMS';
  return '';
}

function patientForbiddenTerms(caseData) {
  const terms = [
    'altered level of consciousness',
    'altered mental status',
    'ams',
    'mietic',
    'mimic',
    'dataset',
    'recorded ed',
    'esi',
    'acuity',
    'reference',
    'disposition',
    'resource use',
    'resources',
    'admitted',
    'admission',
    'icu',
    'triage level',
    'expert opinion',
    'score',
    'ivdu',
    'etoh',
    'hcv',
    'iddm',
    'presents to the ed',
    "patient's wife",
    "patient's husband",
    "i's",
    "my's",
    "he's wife",
    "she's husband"
  ];
  if (hasSubduralChartLanguage(caseData)) {
    terms.push('sdh', 'subdural', 'subdural hematoma', 'intracranial hemorrhage');
  }
  return terms;
}

function containsForbiddenPatientTerm(caseData, answer) {
  const normalized = normalizedAnswerText(answer);
  return patientForbiddenTerms(caseData).some((term) => {
    const cleaned = normalizedAnswerText(term);
    return cleaned && new RegExp(`\\b${cleaned.replace(/\s+/g, '\\s+')}\\b`, 'i').test(normalized);
  });
}

function isMedicalTermClarification(question) {
  const q = String(question || '').toLowerCase();
  return /\b(what is|what does|what do you mean|what does that mean|is that|is this)\b/.test(q) &&
    /\b(sdh|ams|diagnosis|condition|medical condition|term|mean)\b/.test(q);
}

function subduralPatientSymptom(caseData) {
  const history = String(caseData?.history || '').toLowerCase();
  if (/\bheadache\b/.test(history) && /\b(falls?|fell|falling|unsteady|unsteadiness|dizz\w*)\b/.test(history)) {
    return 'I have a headache, and I have been unsteady and falling more';
  }
  if (/\bheadache\b/.test(history)) return 'I have a headache';
  if (/\b(falls?|fell|falling|unsteady|unsteadiness|dizz\w*)\b/.test(history)) return 'I have been unsteady and falling more';
  return 'I have a headache and feel unsteady';
}

function naturalConditionName(condition) {
  return String(condition || '')
    .replace(/\bstatus post[-\s]*esophagectomy\b/gi, '')
    .replace(/\bright[-\s]*sided\s+CVA\b/gi, 'stroke')
    .replace(/\bHCV\b/gi, 'hepatitis C')
    .replace(/\bEtOH\b/gi, 'alcohol')
    .replace(/\bIDDM\b/gi, 'insulin-dependent diabetes')
    .replace(/\bDM2\b/gi, 'type 2 diabetes')
    .replace(/\bCAD\b/gi, 'coronary artery disease')
    .replace(/\bCKD\b/gi, 'kidney disease')
    .replace(/\bDVT\/PE\b/gi, 'blood clots in the leg and lung')
    .replace(/\bDVT\b/gi, 'blood clot')
    .replace(/\bPE\b/g, 'pulmonary embolism')
    .replace(/\bIVDU\b/gi, 'injection drug use')
    .replace(/\bCVA\b/gi, 'stroke')
    .replace(/\bTIAs?\b/gi, 'mini-strokes')
    .replace(/\bHTN\b/gi, 'high blood pressure')
    .replace(/\bHLD\b/gi, 'high cholesterol')
    .replace(/\bGERD\b/gi, 'reflux')
    .replace(/\bCOPD\b/g, 'COPD')
    .replace(/\bG6PD deficiency\b/gi, 'G6PD deficiency')
    .replace(/\bchronic pain syndrome on chronic opioids\b/gi, 'chronic pain')
    .replace(/\bsubstance use\s*\([^)]*\)/gi, 'substance use')
    .replace(/\bon chronic opioids\b/gi, '')
    .replace(/\bwith associated complications\b/gi, '')
    .replace(/\bcurrently not on anticoagulation\b/gi, 'not taking blood thinners')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const CONDITION_PATTERNS = [
  ['atrial fibrillation', /\b(atrial fibrillation|a[-\s]?fib|afib)\b/i],
  ['heart failure', /\bheart failure\b/i],
  ['aortic stenosis', /\baortic stenosis\b/i],
  ['coronary artery disease', /\bcoronary artery disease|\bCAD\b/i],
  ['prior heart attack', /\b(myocardial infarction|heart attack)\b/i],
  ['cardiac stent', /\bcardiac stent|coronary stent\b/i],
  ['COPD', /\bCOPD\b/i],
  ['diabetes', /\bdiabetes|IDDM|DM2\b/i],
  ['high blood pressure', /\bhypertension|HTN\b/i],
  ['high cholesterol', /\bhyperlipidemia|hypercholesterolemia|HLD\b/i],
  ['stroke', /\bstroke|CVA|basal ganglia infarct\b/i],
  ['mini-strokes', /\bTIA\b|\bTIAs\b/i],
  ['kidney disease', /\bCKD|renal insufficiency|chronic kidney disease\b/i],
  ['cirrhosis', /\bcirrhosis\b/i],
  ['hepatitis C', /\bHCV|hepatitis C\b/i],
  ['chronic pain', /\bchronic pain\b/i],
  ['depression', /\bdepression\b/i],
  ['anxiety', /\banxiety\b/i],
  ['cancer', /\bcancer|lymphoma|carcinoma\b/i],
  ['reflux', /\bGERD|reflux\b/i],
  ['blood clots', /\bDVT|PE|pulmonary embol/i],
  ['gout', /\bgout\b/i],
  ['arthritis', /\barthritis\b/i],
  ['cervical cord compression', /\bcervical cord compression\b/i],
  ['substance use', /\bsubstance use\b/i],
  ['methadone treatment', /\bmethadone\b/i]
];

const CARDIOVASCULAR_CONDITION_PATTERNS = [
  ['atrial fibrillation', /\b(atrial fibrillation|a[-\s]?fib|afib)\b/i],
  ['heart failure', /\bheart failure\b/i],
  ['aortic stenosis', /\baortic stenosis\b/i],
  ['coronary artery disease', /\bcoronary artery disease|\bCAD\b/i],
  ['prior heart attack', /\b(myocardial infarction|heart attack)\b/i],
  ['cardiac stent', /\bcardiac stent|coronary stent\b/i],
  ['high blood pressure', /\bhypertension|HTN\b/i],
  ['high cholesterol', /\bhyperlipidemia|hypercholesterolemia|HLD\b/i],
  ['blood clots', /\bDVT|PE|pulmonary embol/i]
];

function matchedConditionLabels(caseData, patterns = CONDITION_PATTERNS) {
  const source = `${caseData?.history || ''} ${caseData?.outcome || ''}`;
  return patterns
    .filter(([, pattern]) => pattern.test(source))
    .map(([label]) => label);
}

function patientConditionList(caseData) {
  const extracted = extractListAfter(caseData.history, [
    /(?:history of|a history of)\s+([^.;]+)/i,
    /past medical history includes\s+([^.;]+)/i,
    /past medical history significant for\s+([^.;]+)/i
  ]);
  const rawList = compactList(extracted.replace(/\([^)]*\)/g, ''), 6);
  const extractedItems = rawList
    .split(',')
    .map(naturalConditionName)
    .filter(Boolean)
    .filter((item) => !/\b(altered|vital|chief complaint|arrived|presented|presents|associated complications)\b/i.test(item));
  return uniqueSentences([...matchedConditionLabels(caseData), ...extractedItems]);
}

function alteredConsciousnessPersona(caseData) {
  const history = String(caseData?.history || '');
  const lower = history.toLowerCase();
  const source = patientCollateralSource(caseData);
  const sourcePrefix = source && source !== 'EMS' ? `My ${source}` : source || 'They';
  const concerns = [];
  if (/\bbizarre conversation|not oriented|confus/.test(lower)) concerns.push('I was confused and not making sense');
  if (/\bfall|fell|fallen/.test(lower)) concerns.push('I had fallen');
  if (/\bslurred speech\b/.test(lower)) concerns.push('my speech was slurred');
  if (/\bpinpoint pupils|pill bottle|extra dose|overdose|oxycontin|opioid|narcotic/.test(lower)) {
    concerns.push('there was concern I may have taken too much pain medicine');
  }
  if (/\bthirst\b/.test(lower)) concerns.push('I feel very thirsty');

  const collateralConcern = concerns.length
    ? `${sourcePrefix} said ${concerns.slice(0, 3).join(', and ')}.`
    : `${sourcePrefix} said I was not acting like myself.`;

  return {
    reliability: 'impaired',
    collateral_source: source,
    chief_concern: `I'm not really sure. ${collateralConcern}`,
    symptom_summary: collateralConcern,
    timeline: "I'm not sure exactly when it started.",
    red_flags: collateralConcern,
    severity: lower.includes('thirst') ? "I'm not having pain, but I feel very thirsty." : severityAnswer(caseData),
    conditions: patientConditionList(caseData),
    unknown_phrase: "I'm not really sure."
  };
}

function buildPatientPersona(caseData) {
  if (hasAlteredConsciousnessLanguage(caseData)) {
    return alteredConsciousnessPersona(caseData);
  }
  return {
    reliability: 'reliable',
    collateral_source: patientCollateralSource(caseData),
    chief_concern: chiefConcernAnswer(caseData),
    symptom_summary: primarySymptom(caseData),
    timeline: timelineAnswer(caseData),
    red_flags: redFlagAnswer(caseData, ''),
    severity: severityAnswer(caseData),
    conditions: patientConditionList(caseData),
    unknown_phrase: "I'm not sure."
  };
}

function primarySymptom(caseData) {
  const complaint = plainComplaint(caseData.complaint).toLowerCase();
  const text = complaintText(caseData);
  if (hasSubduralChartLanguage(caseData)) return subduralPatientSymptom(caseData);
  if (hasAlteredConsciousnessLanguage(caseData)) {
    const source = patientCollateralSource(caseData);
    if (source && source !== 'EMS') return `my ${source} said I was confused and not making sense`;
    return 'I was confused and not acting like myself';
  }
  if (/fever/.test(complaint) && /pneumonia/.test(`${complaint} ${text}`)) {
    return 'I have a fever and they were worried about pneumonia';
  }
  if (/pneumonia/.test(complaint)) return 'I may have pneumonia';
  if (/fever/.test(complaint)) return 'I have a fever';
  if (/left leg|leg/.test(complaint) && /(injury|pain|fracture|hurt)/.test(`${complaint} ${text}`)) {
    return 'my left leg hurts';
  }
  if (/right leg/.test(complaint)) return 'my right leg hurts';
  if (/left foot/.test(complaint) && /swelling|swollen/.test(`${complaint} ${text}`)) return 'my left foot is swollen';
  if (/right foot/.test(complaint) && /swelling|swollen/.test(`${complaint} ${text}`)) return 'my right foot is swollen';
  if (/foot/.test(complaint) && /swelling|swollen/.test(`${complaint} ${text}`)) return 'my foot is swollen';
  if (/abdominal|abdomen|stomach/.test(complaint)) return 'my stomach hurts';
  if (/chest pain|chest pressure/.test(complaint)) return 'I have chest pain';
  if (/shortness of breath|dyspnea/.test(complaint)) return "I'm short of breath";
  if (/weakness/.test(complaint)) return "I'm feeling weak";
  if (/head/.test(complaint) && /(injury|cut|lac|pain|ache)/.test(complaint)) return 'my head hurts';
  if (/seizure/.test(complaint)) return 'I had a seizure';
  if (complaint) return `I'm here for ${complaint}`;
  return "I'm not feeling well";
}

function chiefConcernAnswer(caseData) {
  const symptom = primarySymptom(caseData);
  const event = shortEventFromHistory(caseData);
  if (event && !event.toLowerCase().includes('history of')) {
    return `${capitalizeSentence(symptom)}. ${capitalizeSentence(event)}.`;
  }
  return `${capitalizeSentence(symptom)}.`;
}

function extractListAfter(text, patterns) {
  const source = String(text || '').replace(/\s+/g, ' ');
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.[1]) {
      return match[1]
        .replace(/\b(presented|presents|came|arrived|with chief complaint).*$/i, '')
        .replace(/\b(vital signs|initial vital).*$/i, '')
        .replace(/\.$/, '')
        .trim();
    }
  }
  return '';
}

function compactList(text, maxItems = 4) {
  return String(text || '')
    .split(/,|;|\band\b/i)
    .map((item) => item.replace(/\b(history of|past medical history includes|a history of)\b/gi, '').trim())
    .map((item) => item.replace(/\b(allergic to|allergies include|allergy to|was transferred|transferred|presented|presents|arrived|came in|with chief complaint).*$/i, '').trim())
    .filter(Boolean)
    .filter((item) => !/\b(vital signs|initial vital|chief complaint|allerg|transferred|arrived|presented|presents)\b/i.test(item))
    .slice(0, maxItems)
    .join(', ');
}

function medicalHistoryAnswer(caseData, question = '') {
  const questionText = String(question || '').toLowerCase();
  if (/\b(heart attack|cardiovascular|cardiac|heart condition|heart conditions|heart disease|afib|atrial fibrillation)\b/.test(questionText)) {
    const cardiacConditions = uniqueSentences(matchedConditionLabels(caseData, CARDIOVASCULAR_CONDITION_PATTERNS));
    const hasPriorHeartAttack = cardiacConditions.some((item) => /heart attack|cardiac stent|coronary artery disease/.test(item));
    if (cardiacConditions.length) {
      const prefix = `I have ${cardiacConditions.slice(0, 4).join(', ')}.`;
      if (/\bheart attack\b/.test(questionText) && !hasPriorHeartAttack) {
        return `${prefix} I don't know of a prior heart attack.`;
      }
      return prefix;
    }
    return "I don't know of a prior heart attack or heart condition.";
  }

  const conditions = patientConditionList(caseData);
  if (conditions.length) return `I have ${conditions.slice(0, 5).join(', ')}.`;

  const extracted = extractListAfter(caseData.history, [
    /(?:history of|a history of)\s+([^.;]+)/i,
    /past medical history includes\s+([^.;]+)/i,
    /past medical history significant for\s+([^.;]+)/i
  ]);
  const list = compactList(extracted);
  if (list) return `I have ${list}.`;
  return "I don't think I have major medical problems that I know of.";
}

function medicationAnswer(caseData) {
  const text = complaintText(caseData);
  if (hasAny(text, ['not currently on any antiepileptic', 'not currently on any aed'])) {
    return "I'm not currently taking seizure medicine.";
  }

  const medicationTerms = [
    'warfarin',
    'xarelto',
    'eliquis',
    'plavix',
    'aspirin',
    'metformin',
    'insulin',
    'lisinopril',
    'antibiotic',
    'blood thinner',
    'anticoagulant',
    'antiepileptic'
  ];
  const mentioned = medicationTerms.filter((term) => text.includes(term));
  if (mentioned.length) {
    return `I take ${mentioned.slice(0, 3).join(', ')}${mentioned.length > 3 ? ', and a few others' : ''}.`;
  }
  return "I don't remember any important regular medicines right now.";
}

function allergyAnswer(caseData) {
  const text = complaintText(caseData);
  if (hasAny(text, ['no known allergies', 'no known drug allergies', 'nkda'])) {
    return 'I do not have any known medication allergies.';
  }
  const allergy = extractListAfter(caseData.history, [
    /allergic\s+to\s+([^.;]+)/i,
    /allerg(?:y|ies)\s*(?:to|include|includes)?\s+([^.;]+)/i
  ]);
  if (allergy) return `I'm allergic to ${compactList(allergy, 3)}.`;
  return "I don't know of any medication allergies.";
}

function timelineAnswer(caseData) {
  if (hasSubduralChartLanguage(caseData)) {
    const history = String(caseData.history || '');
    const timeMatch = history.match(/\b(\d+\s*(?:minutes?|mins?|hours?|hrs?|days?|weeks?|months?)\s*(?:ago|before|prior|earlier)?)\b/i);
    if (timeMatch) return `It started about ${timeMatch[1].toLowerCase()}.`;
    if (/\b(chronic|weeks?|months?|gradual|progressive|worsening)\b/i.test(history)) {
      return "I'm not sure of the exact day, but the headache and unsteadiness have been getting worse over time.";
    }
    return "I'm not sure of the exact time, but the headache and unsteadiness were going on before I came in.";
  }

  const history = String(caseData.history || '');
  const timeMatch = history.match(/\b((?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*[- ]?\s*(?:minutes?|mins?|hours?|hrs?|days?|weeks?|months?)\s*(?:ago|before|prior|earlier)?)\b/i);
  if (timeMatch) {
    const timePhrase = timeMatch[1].toLowerCase().replace(/\s*-\s*/g, ' ');
    if (/\bchest pain\b/i.test(history) && /\b(rest|radiat|diaphoresis|shortness of breath|palpitations|orthopnea)\b/i.test(history)) {
      if (/orthopnea|two months/i.test(history)) {
        return `The chest pain is happening at rest, and my breathing lying flat has been worse for about ${timePhrase}.`;
      }
    }
    return `It started about ${timePhrase}.`;
  }

  if (/\bchest pain\b/i.test(history) && /\b(rest|radiat|diaphoresis|shortness of breath|palpitations)\b/i.test(history)) {
    return "The chest pain is happening at rest. I'm not sure exactly when it first started.";
  }

  const event = shortEventFromHistory(caseData);
  if (event) return `It happened after ${event}.`;

  const startedSentence = sentenceSplit(history).find((sentence) =>
    /\b(started|began|came on|woke up|found|after|since|today|yesterday)\b/i.test(sentence)
  );
  if (startedSentence) return cleanPatientPhrase(startedSentence);

  return "I'm not exactly sure when it started, but it was before I came in.";
}

function severityAnswer(caseData) {
  const pain = caseData.vitals?.pain;
  if (pain !== null && pain !== undefined) {
    if (Number(pain) === 0) return "I'm not having pain right now.";
    return `My pain is about ${pain} out of 10.`;
  }
  return "It felt serious enough that I came to the emergency department.";
}

function generalStatusAnswer(caseData) {
  const symptom = primarySymptom(caseData);
  const pain = caseData.vitals?.pain;
  const normalizedSymptom = capitalizeSentence(symptom);
  const complaint = plainComplaint(caseData.complaint).toLowerCase();
  if (hasSubduralChartLanguage(caseData)) {
    return `I'm worried. ${normalizedSymptom}.`;
  }
  if (/\b(fever|pneumonia|shortness of breath|dyspnea|weakness|confusion|chest pain)\b/.test(complaint)) {
    return `I'm not feeling well. ${normalizedSymptom}.`;
  }
  if (pain !== null && pain !== undefined) {
    const numericPain = Number(pain);
    if (numericPain === 0) {
      return `I'm okay right now, but I'm worried. ${normalizedSymptom}.`;
    }
    if (numericPain <= 3) {
      return `I'm uncomfortable and worried. ${normalizedSymptom}, but the pain is mild right now.`;
    }
    if (numericPain >= 7) {
      return `I'm not doing well. ${normalizedSymptom}, and the pain is severe.`;
    }
  }
  return `I'm not feeling well. ${normalizedSymptom}.`;
}

function symptomMatches(caseData) {
  const text = complaintText(caseData);
  const symptoms = [
    ['chest pain', ['chest pain', 'chest pressure', 'cp']],
    ['shortness of breath', ['shortness', 'sob', 'dyspnea', 'breath']],
    ['fainting or nearly fainting', ['syncope', 'faint', 'passed out', 'near-syncope']],
    ['weakness or numbness', ['weak', 'numb', 'stroke', 'facial droop']],
    ['confusion', ['confus', 'disorient', 'altered mental', 'ams']],
    ['nausea or vomiting', ['nausea', 'vomit', 'emesis']],
    ['bleeding', ['bleed', 'hematemesis', 'melena', 'rectal bleeding']],
    ['fever or chills', ['fever', 'chills']],
    ['head injury or headache', ['head injury', 'headache', 'head lac']]
  ];
  return symptoms
    .filter(([, terms]) => terms.some((term) => text.includes(term)))
    .map(([label]) => label);
}

function redFlagAnswer(caseData, question) {
  const questionText = String(question || '').toLowerCase();
  const matches = symptomMatches(caseData);
  const askedSymptoms = [
    ['chest pain', ['chest', 'pressure']],
    ['shortness of breath', ['breath', 'sob', 'dyspnea']],
    ['fainting or nearly fainting', ['faint', 'passed out', 'syncope']],
    ['weakness or numbness', ['weak', 'numb']],
    ['confusion', ['confus', 'disorient', 'mental']],
    ['nausea or vomiting', ['nausea', 'vomit']],
    ['bleeding', ['bleed', 'blood']],
    ['fever or chills', ['fever', 'chill']]
  ].filter(([, terms]) => terms.some((term) => questionText.includes(term))).map(([label]) => label);

  if (askedSymptoms.length) {
    const present = askedSymptoms.filter((symptom) => matches.includes(symptom));
    if (present.length) return `Yes, I've had ${present.join(' and ')}.`;
    return "No, not that I can tell.";
  }

  if (matches.length) return `Yes, mainly ${matches.slice(0, 3).join(', ')}.`;
  return "No, I don't have another scary symptom that I can tell you about.";
}

function priorEpisodeAnswer(caseData) {
  const text = complaintText(caseData);
  if (hasAny(text, ['recurrent', 'again', 'previous', 'prior', 'history of', 'per month'])) {
    if (hasAny(text, ['seizure'])) return "Yes, I've had seizures before.";
    return "Yes, I've had something like this before.";
  }
  return "No, this does not feel like something that happens to me regularly.";
}

function pregnancyAnswer(caseData) {
  const age = Number(caseData.demographics.age || 0);
  const sex = String(caseData.demographics.sex || '').toUpperCase();
  if (!sex.startsWith('F') || age < 12 || age > 55) return 'No.';
  return "I'm not sure; you would need to check.";
}

function uniqueSentences(items = []) {
  const seen = new Set();
  const values = Array.isArray(items) ? items : [items];
  return values
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function broadBackgroundAnswer(caseData, domains = []) {
  const domainSet = new Set(domains);
  const parts = [];
  if (domainSet.has('medical_history')) parts.push(medicalHistoryAnswer(caseData));
  if (domainSet.has('medications')) parts.push(medicationAnswer(caseData));
  if (domainSet.has('allergies')) parts.push(allergyAnswer(caseData));
  if (domainSet.has('prior_episode')) parts.push(priorEpisodeAnswer(caseData));
  if (domainSet.has('pregnancy')) parts.push(pregnancyAnswer(caseData));
  return uniqueSentences(parts).join(' ') || medicalHistoryAnswer(caseData);
}

function specialRiskAnswer(caseData, domains = [], question = '') {
  const domainSet = new Set(domains);
  const text = complaintText(caseData);
  const questionText = String(question || '').toLowerCase();
  const parts = [];

  if (domainSet.has('pregnancy') || /\bpregnan/.test(questionText)) {
    const pregnancy = pregnancyAnswer(caseData);
    parts.push(pregnancy === 'No.' ? 'No pregnancy concern that I know of.' : pregnancy);
  }

  if (domainSet.has('medications') || /\b(warfarin|xarelto|eliquis|plavix|aspirin|blood thinner|anticoagul)/i.test(`${text} ${questionText}`)) {
    const medication = medicationAnswer(caseData);
    if (/\b(warfarin|xarelto|eliquis|plavix|aspirin|blood thinner|anticoagul)/i.test(medication)) {
      parts.push(medication);
    } else {
      parts.push("I don't think I'm on blood thinners.");
    }
  }

  if (domainSet.has('medical_history') || /\b(immune|immuno|frail|frailty|risk)\b/i.test(questionText)) {
    const history = medicalHistoryAnswer(caseData);
    if (/\b(diabetes|cancer|transplant|immune|immuno|steroid|hiv|chemo|cirrhosis|kidney|heart|copd|frail)\b/i.test(history)) {
      parts.push(history);
    } else {
      parts.push("I don't know of immune problems or frailty concerns.");
    }
  }

  return uniqueSentences(parts).join(' ') || "I don't know of special risk factors like that.";
}

function isAnswerKeyQuestion(question) {
  const q = String(question || '').toLowerCase();
  if (/\b(esi|triage level|acuity|disposition|final decision|expert opinion|expert answer)\b/.test(q)) return true;
  if (/\b(what|which|why)\b.*\b(resource|resources|intervention|interventions|test|tests|procedure|procedures|treatment|treatments)\b/.test(q)) return true;
  if (/\b(what did|what does|what will|what would)\b.*\b(ed|doctor|nurse|clinician|team)\b.*\b(do|did|give|order|place|perform)\b/.test(q)) return true;
  if (/\b(will|would|should|going to)\b.*\b(admit|admitted|admission|icu|discharge|transfer|intubat|iv)\b/.test(q)) return true;
  if (/\b(did|does|do)\b.*\b(ed|doctor|nurse|clinician|team)\b.*\b(admit|intubat|place an iv|start an iv|transfer)\b/.test(q)) return true;
  return false;
}

function domainPatientResponse(caseData, domain, question = '', persona = buildPatientPersona(caseData)) {
  if (hasAlteredConsciousnessLanguage(caseData)) {
    if (domain === 'chief_concern' || domain === 'general_status') return persona.chief_concern;
    if (domain === 'timeline') {
      const source = persona.collateral_source && persona.collateral_source !== 'EMS' ? `My ${persona.collateral_source}` : 'They';
      return `${persona.timeline} ${source} found me confused today.`;
    }
    if (domain === 'medical_history') {
      if (persona.conditions?.length) {
        return `I have a history of ${persona.conditions.slice(0, 5).join(', ')}.`;
      }
      return "I have some medical problems, but I don't remember all of them clearly right now.";
    }
    if (domain === 'medications') return medicationAnswer(caseData);
    if (domain === 'allergies') return allergyAnswer(caseData);
    if (domain === 'severity') return persona.severity;
    if (domain === 'red_flags') return persona.red_flags;
    if (domain === 'prior_episode') return priorEpisodeAnswer(caseData);
    if (domain === 'pregnancy') return pregnancyAnswer(caseData);
  }

  const responses = {
    general_status: generalStatusAnswer(caseData),
    chief_concern: chiefConcernAnswer(caseData),
    timeline: timelineAnswer(caseData),
    severity: severityAnswer(caseData),
    red_flags: redFlagAnswer(caseData, question),
    medical_history: medicalHistoryAnswer(caseData, question),
    medications: medicationAnswer(caseData),
    prior_episode: priorEpisodeAnswer(caseData),
    pregnancy: pregnancyAnswer(caseData),
    allergies: allergyAnswer(caseData)
  };
  return responses[domain] || responses.chief_concern;
}

function categoryResponse(caseData, category, question = '') {
  if (isAnswerKeyQuestion(question)) {
    return "I don't know that as the patient. I can tell you what I'm feeling, what happened, and what medical history I know.";
  }

  if (isMedicalTermClarification(question)) {
    if (hasAlteredConsciousnessLanguage(caseData)) {
      const persona = buildPatientPersona(caseData);
      return `I'm not sure what that term means. ${persona.symptom_summary}`;
    }
    if (hasSubduralChartLanguage(caseData)) {
      return "I'm not sure what that term means. I came in because of the headache and the falls.";
    }
    return "I'm not sure what that term means. I can tell you what I am feeling.";
  }

  const domains = classifyQuestionDomains(question);
  if (isSpecialRiskQuestion(question, domains)) {
    return specialRiskAnswer(caseData, domains, question);
  }
  if (isBroadBackgroundQuestion(question, domains)) {
    return broadBackgroundAnswer(caseData, domains);
  }

  const persona = buildPatientPersona(caseData);
  const responseDomains = domains.filter((domain) => domain !== 'chief_concern');
  if (domains.includes('chief_concern') || !responseDomains.length) {
    responseDomains.unshift('chief_concern');
  }
  const answers = uniqueSentences(
    responseDomains
      .slice(0, 3)
      .map((domain) => domainPatientResponse(caseData, domain, question, persona))
  );
  return answers.join(' ') || domainPatientResponse(caseData, category, question, persona);
}

function patientNarrativeForModel(caseData) {
  const blocked = [
    'sdh',
    'subdural',
    'vital signs',
    'heart rate',
    'blood pressure',
    'spo2',
    'oxygen saturation',
    'respiratory rate',
    'temperature',
    'in the ed',
    'under surgical care',
    'admitted',
    'icu',
    'esi',
    'triage',
    'procedure',
    'intubation was performed'
  ];
  return sentenceSplit(caseData.history)
    .filter((sentence) => {
      const lower = sentence.toLowerCase();
      return !blocked.some((term) => lower.includes(term));
    })
    .slice(0, 7)
    .join(' ');
}

function patientFactsForModel(caseData) {
  const persona = buildPatientPersona(caseData);
  return {
    age: Math.round(Number(caseData.demographics.age || 0)),
    sex: caseData.demographics.sex,
    arrival_transport: caseData.demographics.transport,
    chief_complaint: persona.chief_concern,
    reliability: persona.reliability,
    collateral_source: persona.collateral_source,
    known_conditions: persona.conditions || [],
    patient_story: patientNarrativeForModel(caseData),
    pain_score_if_asked: caseData.vitals?.pain ?? null,
    forbidden_terms: patientForbiddenTerms(caseData),
    likely_patient_phrasing: {
      general_status: domainPatientResponse(caseData, 'general_status', '', persona),
      chief_concern: domainPatientResponse(caseData, 'chief_concern', '', persona),
      timeline: domainPatientResponse(caseData, 'timeline', '', persona),
      severity: domainPatientResponse(caseData, 'severity', '', persona),
      medical_history: domainPatientResponse(caseData, 'medical_history', '', persona),
      medications: medicationAnswer(caseData),
      allergies: allergyAnswer(caseData)
    }
  };
}

function patientCacheStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PATIENT_RESPONSE_CACHE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function patientCacheId(caseData, intentKey) {
  return `${caseData.id || 'case'}::${PATIENT_RESPONSE_CACHE_VERSION}::${PATIENT_PERSONA_VERSION}::${PATIENT_PROMPT_VERSION}::${intentKey}`;
}

function patientCaseCachePrefix(caseData) {
  return `${caseData.id || 'case'}::${PATIENT_RESPONSE_CACHE_VERSION}::${PATIENT_PERSONA_VERSION}::${PATIENT_PROMPT_VERSION}::`;
}

function patientCachePayloadIsCurrent(payload, intentKey) {
  return Boolean(
    payload?.answer &&
    payload.intent_key === intentKey &&
    payload.cache_version === PATIENT_RESPONSE_CACHE_VERSION &&
    payload.persona_version === PATIENT_PERSONA_VERSION &&
    payload.prompt_version === PATIENT_PROMPT_VERSION
  );
}

function answerAddressesIntent(caseData, answer, intentKey, category, question = '') {
  const normalized = normalizedAnswerText(answer);
  if (!normalized) return false;
  if (containsForbiddenPatientTerm(caseData, answer)) return false;
  if (/\b(i s|my s|he s wife|she s husband|patient s wife|patient s husband|presents to the ed)\b/i.test(normalized)) return false;
  if (/\b\d+\s+year\s+old\s+(white|black|asian|hispanic)?\s*(male|female|man|woman)\b/i.test(String(answer || ''))) return false;

  if (String(intentKey || '').startsWith('compound:')) {
    const requiredDomains = String(intentKey).replace(/^compound:/, '').split('+').filter(Boolean);
    return requiredDomains.every((domain) => answerAddressesIntent(caseData, answer, domain, domain, question));
  }

  if (String(intentKey || '').startsWith('timeline')) {
    if (/\b(start|started|began|begin|ago|after|before|since|when|time|day|days|week|weeks|month|months|worse|worsening|exact|ongoing)\b/.test(normalized)) {
      return true;
    }
    if (/\bnot sure\b/.test(normalized) && /\b(headache|unsteady|falls?|dizz\w*)\b/.test(normalized)) return true;
    return false;
  }

  if (String(intentKey || '').startsWith('severity')) {
    return /\b(pain|hurt|sore|bad|severe|mild|distress|right now|comfortable|uncomfortable|well|okay)\b/.test(normalized);
  }

  if (String(intentKey || '').startsWith('term_clarification')) {
    return /\b(not sure|do not know|don't know|means|term|came in|feeling)\b/.test(normalized);
  }

  if (category === 'red_flags' && /\b(chest|breath|faint|weak|numb|confus|vomit|bleed|fever)\b/i.test(question)) {
    return /\b(yes|no|not|mainly|have|had|tell)\b/.test(normalized);
  }

  return true;
}

function validatePatientAnswer({ caseData, answer, intentKey, category, question, session, answerPlan = null, patientView = null, usedAi = false }) {
  if (answerPlan && patientView) {
    return validatePatientSpeech(answer, answerPlan, patientView, session ? recentPatientTurns(session, 6) : []);
  }
  const cleaned = cleanPatientResponse(answer);
  if (!cleaned) return null;
  if (!usedAi && !answerAddressesIntent(caseData, cleaned, intentKey, category, question)) return null;
  if (session && repeatedAnswerFromDifferentIntent(session, cleaned, intentKey)) return null;
  return cleaned;
}

function readPersistentPatientCache(caseData, intentKey, validationContext = {}) {
  const store = patientCacheStore();
  const payload = store[patientCacheId(caseData, intentKey)] || null;
  if (!patientCachePayloadIsCurrent(payload, intentKey)) return null;
  const answer = validatePatientAnswer({
    caseData,
    answer: payload.answer,
    intentKey,
    category: validationContext.category || payload.category,
    question: validationContext.question || payload.question,
    session: validationContext.session,
    answerPlan: validationContext.answerPlan,
    patientView: validationContext.patientView
  });
  return answer ? { ...payload, answer } : null;
}

function writePersistentPatientCache(caseData, intentKey, payload) {
  try {
    const store = patientCacheStore();
    const key = patientCacheId(caseData, intentKey);
    store[key] = {
      cache_version: PATIENT_RESPONSE_CACHE_VERSION,
      persona_version: PATIENT_PERSONA_VERSION,
      prompt_version: PATIENT_PROMPT_VERSION,
      question: payload.question,
      answer: cleanPatientResponse(payload.answer),
      source: payload.source,
      used_ai: Boolean(payload.used_ai),
      intent_key: intentKey,
      category: payload.category,
      category_label: payload.category_label,
      covered_categories: payload.covered_categories || [],
      validated: payload.validated !== false,
      fallback_reason: payload.fallback_reason || '',
      addressed_intents: payload.addressed_intents || [],
      used_fields: payload.used_fields || [],
      uncertainty_used: Boolean(payload.uncertainty_used),
      time_cost_seconds: payload.time_cost_seconds,
      updated_at: new Date().toISOString()
    };

    const entries = Object.entries(store)
      .sort((a, b) => String(b[1]?.updated_at || '').localeCompare(String(a[1]?.updated_at || '')))
      .slice(0, PATIENT_RESPONSE_CACHE_LIMIT);
    localStorage.setItem(PATIENT_RESPONSE_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Cache writes are best-effort. The interview should never fail because storage is blocked.
  }
}

function patientSemanticText(payload) {
  return [
    `intent ${payload.intent_key || ''}`,
    `category ${payload.category || ''}`,
    `domains ${(payload.covered_categories || []).join(' ')}`,
    `question ${payload.question || ''}`
  ].join(' ');
}

const CLINICAL_SEMANTIC_GROUPS = [
  ['dyspnea', ['trouble breathing', 'short of breath', 'shortness of breath', 'short of air', 'hard to breathe', 'difficulty breathing', 'breathless', 'winded']],
  ['chest_symptom', ['chest pain', 'chest pressure', 'chest discomfort', 'chest tightness', 'pressure in chest']],
  ['syncope', ['faint', 'fainted', 'passed out', 'black out', 'blacked out', 'near syncope', 'nearly fainted']],
  ['neurologic_deficit', ['weakness', 'numbness', 'facial droop', 'slurred speech', 'confused', 'confusion']],
  ['bleeding', ['bleeding', 'vomiting blood', 'blood in stool', 'black stool', 'melena', 'heavy bleeding']],
  ['fever', ['fever', 'chills', 'sweats', 'temperature']],
  ['pain', ['pain', 'hurt', 'ache', 'sore', 'severe discomfort']],
  ['medication', ['medicine', 'medication', 'meds', 'blood thinner', 'anticoagulant']],
  ['pregnancy', ['pregnant', 'pregnancy', 'last period', 'lmp']]
];

const SEMANTIC_STOP_WORDS = new Set([
  'a', 'an', 'and', 'any', 'are', 'at', 'be', 'did', 'do', 'does', 'for', 'have', 'having', 'how',
  'i', 'in', 'is', 'it', 'now', 'of', 'or', 'right', 'the', 'this', 'to', 'today', 'you', 'your'
]);

function clinicalSemanticTokens(text) {
  const lower = String(text || '').toLowerCase();
  const tokens = new Set();

  CLINICAL_SEMANTIC_GROUPS.forEach(([concept, phrases]) => {
    if (phrases.some((phrase) => lower.includes(phrase))) tokens.add(concept);
  });

  lower
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token && token.length > 2 && !SEMANTIC_STOP_WORDS.has(token))
    .forEach((token) => tokens.add(token));

  return tokens;
}

function clinicalSemanticSimilarity(left, right) {
  const a = clinicalSemanticTokens(left);
  const b = clinicalSemanticTokens(right);
  if (!a.size || !b.size) return 0;

  const overlap = [...a].filter((token) => b.has(token));
  const conceptOverlap = overlap.filter((token) => CLINICAL_SEMANTIC_GROUPS.some(([concept]) => concept === token));
  if (conceptOverlap.length) return Math.min(0.96, 0.88 + conceptOverlap.length * 0.04);

  return (2 * overlap.length) / (a.size + b.size);
}

function patientCacheIntentMatches(intentKey, payload) {
  return Boolean(intentKey && patientCachePayloadIsCurrent(payload, intentKey));
}

function readClinicalSemanticPatientCache(caseData, question, intentKey, validationContext = {}) {
  const casePrefix = patientCaseCachePrefix(caseData);
  const candidates = Object.entries(patientCacheStore())
    .filter(([key, payload]) =>
      key.startsWith(casePrefix) &&
      payload?.question &&
      payload?.answer &&
      payload.intent_key !== 'answer_key' &&
      patientCacheIntentMatches(intentKey, payload)
    )
    .map(([key, payload]) => ({
      key,
      payload,
      score: clinicalSemanticSimilarity(question, payload.question)
    }))
    .sort((a, b) => b.score - a.score);

  const best = candidates[0];
  if (!best || best.score < 0.82) return null;
  const answer = validatePatientAnswer({
    caseData,
    answer: best.payload.answer,
    intentKey,
    category: validationContext.category || best.payload.category,
    question,
    session: validationContext.session,
    answerPlan: validationContext.answerPlan,
    patientView: validationContext.patientView
  });
  if (!answer) return null;
  return {
    ...best.payload,
    answer,
    semantic_score: Number(best.score.toFixed(3)),
    semantic_match_id: best.key
  };
}

async function readSemanticPatientCache(caseData, question, category, coveredCategories = [], intentKey = '', validationContext = {}) {
  const clinicalMatch = readClinicalSemanticPatientCache(caseData, question, intentKey, {
    ...validationContext,
    category
  });
  if (clinicalMatch) return clinicalMatch;

  const casePrefix = patientCaseCachePrefix(caseData);
  const candidates = Object.entries(patientCacheStore())
    .filter(([key, payload]) => {
      if (!key.startsWith(casePrefix) || !payload?.question || !payload?.answer) return false;
      return payload.intent_key !== 'answer_key' && patientCacheIntentMatches(intentKey, payload);
    })
    .sort((a, b) => String(b[1]?.updated_at || '').localeCompare(String(a[1]?.updated_at || '')))
    .map(([key, payload]) => ({ id: key, payload }));

  try {
    const match = await findSemanticMatch({
      namespace: `patient_response:${caseData.id || 'case'}`,
      queryText: patientSemanticText({
        intent_key: intentKey,
        question,
        category,
        covered_categories: coveredCategories.length ? coveredCategories : [category]
      }),
      candidates,
      threshold: 0.78,
      candidateText: (item) => patientSemanticText(item.payload),
      candidateId: (item) => item.id
    });

    if (!match) return null;
    const answer = validatePatientAnswer({
      caseData,
      answer: match.candidate.payload.answer,
      intentKey,
      category,
      question,
      session: validationContext.session,
      answerPlan: validationContext.answerPlan,
      patientView: validationContext.patientView
    });
    if (!answer) return null;
    return {
      ...match.candidate.payload,
      answer,
      semantic_score: Number(match.score.toFixed(3)),
      semantic_match_id: match.candidate.id
    };
  } catch {
    return null;
  }
}

function reasoningReviewCacheStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(REASONING_REVIEW_CACHE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function reasoningReviewCacheId(completed, model) {
  const summary = completed.feedback?.session_summary || {};
  const payload = {
    version: REASONING_REVIEW_VERSION,
    model: model || DEFAULT_TUTOR_MODEL,
    case_id: completed.case?.id,
    provisional_esi: summary.provisional_triage_level,
    provisional_rationale: summary.provisional_triage_rationale,
    final_esi: summary.triage_level_assigned,
    final_rationale: summary.triage_rationale,
    escalation_actions: (summary.escalation_actions || []).map((item) => item.id).sort(),
    escalation_rationale: summary.escalation_rationale,
    sbar: summary.sbar_handoff
  };
  return `${completed.case?.id || 'case'}::${hashText(stableStringify(payload))}`;
}

function reasoningReviewSemanticText(completed) {
  const summary = completed.feedback?.session_summary || {};
  return [
    `case ${completed.case?.id || ''}`,
    `reference esi ${completed.case?.acuity || ''}`,
    `provisional esi ${summary.provisional_triage_level || ''}`,
    `provisional rationale ${summary.provisional_triage_rationale || ''}`,
    `final esi ${summary.triage_level_assigned || ''}`,
    `final rationale ${summary.triage_rationale || ''}`,
    `escalation actions ${(summary.escalation_actions || []).map((item) => item.name).join(' ')}`,
    `escalation rationale ${summary.escalation_rationale || ''}`,
    `sbar ${summary.sbar_handoff || ''}`
  ].join('\n');
}

function readReasoningReviewCache(completed, model) {
  const store = reasoningReviewCacheStore();
  return store[reasoningReviewCacheId(completed, model)] || null;
}

async function readSemanticReasoningReviewCache(completed, model) {
  const targetModel = model || DEFAULT_TUTOR_MODEL;
  const queryText = reasoningReviewSemanticText(completed);
  const candidates = Object.entries(reasoningReviewCacheStore())
    .filter(([, payload]) =>
      payload?.case_id === completed.case?.id &&
      payload?.model === targetModel &&
      payload?.rubric_version === REASONING_REVIEW_VERSION &&
      payload?.signature_text
    )
    .sort((a, b) => String(b[1]?.updated_at || '').localeCompare(String(a[1]?.updated_at || '')))
    .map(([key, payload]) => ({ id: key, payload }));

  try {
    const match = await findSemanticMatch({
      namespace: `reasoning_review:${completed.case?.id || 'case'}:${targetModel}`,
      queryText,
      candidates,
      threshold: 0.94,
      candidateText: (item) => item.payload.signature_text,
      candidateId: (item) => item.id
    });

    if (!match) return null;
    return {
      ...match.candidate.payload,
      cached: true,
      source: 'OpenRouter semantic cache',
      semantic_score: Number(match.score.toFixed(3)),
      semantic_match_id: match.candidate.id
    };
  } catch {
    return null;
  }
}

function writeReasoningReviewCache(completed, model, review) {
  try {
    const store = reasoningReviewCacheStore();
    const key = reasoningReviewCacheId(completed, model);
    store[key] = {
      ...review,
      case_id: completed.case?.id,
      model: model || DEFAULT_TUTOR_MODEL,
      rubric_version: REASONING_REVIEW_VERSION,
      signature_text: reasoningReviewSemanticText(completed),
      cached: false,
      updated_at: new Date().toISOString()
    };
    const entries = Object.entries(store)
      .sort((a, b) => String(b[1]?.updated_at || '').localeCompare(String(a[1]?.updated_at || '')))
      .slice(0, REASONING_REVIEW_CACHE_LIMIT);
    localStorage.setItem(REASONING_REVIEW_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // The deterministic debrief remains available when browser storage is unavailable.
  }
}

export function detectProvider(key = '') {
  if (key.startsWith('sk-ant-')) return 'anthropic';
  if (key.startsWith('sk-') && !key.startsWith('sk-or-') && !key.startsWith('sk-ant-')) return 'openai';
  return 'openrouter'; // sk-or-... or anything else
}

function getProviderEndpoint(provider) {
  switch (provider) {
    case 'anthropic': return 'https://api.anthropic.com/v1/messages';
    case 'openai': return 'https://api.openai.com/v1/chat/completions';
    default: return 'https://openrouter.ai/api/v1/chat/completions';
  }
}

function getDefaultModelForProvider(provider) {
  switch (provider) {
    case 'anthropic': return 'claude-3-haiku-20240307';
    case 'openai': return 'gpt-4o-mini';
    default: return DEFAULT_TUTOR_MODEL;
  }
}

async function callOpenRouter(messages, { model, key, maxTokens = 220, temperature = 0.25, responseFormat = null, timeoutMs = 30000 }) {
  const provider = detectProvider(key);
  const endpoint = getProviderEndpoint(provider);
  let resolvedModel = model || getDefaultModelForProvider(provider);
  if (provider !== 'openrouter' && /^openrouter\//i.test(resolvedModel)) {
    resolvedModel = getDefaultModelForProvider(provider);
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  let response;

  try {
    let body;
    let headers = { 'Content-Type': 'application/json' };

    if (provider === 'anthropic') {
      // Anthropic uses a different API shape
      headers['x-api-key'] = key;
      headers['anthropic-version'] = '2023-06-01';
      // Extract system from messages
      const systemMsg = messages.find(m => m.role === 'system');
      const userMsgs = messages.filter(m => m.role !== 'system');
      body = JSON.stringify({
        model: resolvedModel,
        max_tokens: maxTokens,
        temperature,
        ...(systemMsg ? { system: systemMsg.content } : {}),
        messages: userMsgs
      });
    } else {
      // OpenAI-compatible (OpenAI and OpenRouter both use this shape)
      headers['Authorization'] = `Bearer ${key}`;
      if (provider === 'openrouter') {
        headers['HTTP-Referer'] = window.location.origin;
        headers['X-Title'] = 'ED Clinical Workflow Simulator';
      }
      body = JSON.stringify({
        model: resolvedModel,
        messages,
        temperature,
        max_tokens: maxTokens,
        ...(responseFormat ? { response_format: responseFormat } : {})
      });
    }

    response = await fetch(endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers,
      body
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('AI request timed out. Try a shorter question or a faster model.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `AI request failed with status ${response.status}`);
  }

  const json = await response.json();

  // Anthropic returns content differently
  if (provider === 'anthropic') {
    const content = json?.content?.[0]?.text;
    if (!content) throw new Error('Anthropic returned no response content.');
    return content.trim();
  }

  const message = json?.choices?.[0]?.message || {};
  const content = extractOpenRouterMessageContent(message);
  if (!content) throw new Error('AI returned no response content.');
  return content.trim();
}

function extractOpenRouterMessageContent(message) {
  const content = message?.content;
  if (typeof content === 'string' && content.trim()) return content;
  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (typeof part?.text === 'string') return part.text;
        if (typeof part?.content === 'string') return part.content;
        return '';
      })
      .join('\n')
      .trim();
    if (text) return text;
  }
  const reasoning = message?.reasoning || message?.reasoning_content;
  if (typeof reasoning === 'string' && reasoning.trim().startsWith('{')) return reasoning;
  return '';
}

function cleanPatientResponse(value, fallback = '') {
  const source = String(value || fallback || '').trim();
  if (!source) return '';

  return source
    .replace(/^patient\s*:\s*/i, '')
    .replace(/^[`"'“”]+|[`"'“”]+$/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,.;:!?])(?=[^\s\d])/g, '$1 ')
    .replace(/\bNo,I\b/g, 'No, I')
    .replace(/\bYes,I\b/g, 'Yes, I')
    .replace(/\btroublebreathing\b/gi, 'trouble breathing')
    .replace(/\bshortofbreath\b/gi, 'short of breath')
    .replace(/\bchestpain\b/gi, 'chest pain')
    .replace(/\brightnow\b/gi, 'right now')
    .trim();
}

function normalizedAnswerText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function repeatedAnswerFromDifferentIntent(session, answer, intentKey) {
  const normalized = normalizedAnswerText(answer);
  if (normalized.length < 48) return false;

  return (session.interview_log || []).some((item) => {
    if (!item?.answer || item.intent_key === intentKey) return false;
    const prior = normalizedAnswerText(item.answer);
    if (prior.length < 48) return false;
    if (prior === normalized) return true;
    return clinicalSemanticSimilarity(prior, normalized) >= 0.9;
  });
}

function recentPatientTurns(session, limit = 3) {
  return (session.interview_log || [])
    .slice(-limit)
    .map((item) => ({
      learner: item.question,
      patient: item.answer,
      intent: item.intent_key || item.category
    }));
}

function promiseWithTimeout(promise, timeoutMs) {
  let timeoutId;
  const timeout = new Promise((resolve) => {
    timeoutId = setTimeout(() => resolve(null), timeoutMs);
  });
  return Promise.race([
    promise.then((value) => {
      clearTimeout(timeoutId);
      return value;
    }).catch(() => {
      clearTimeout(timeoutId);
      return null;
    }),
    timeout
  ]);
}

function normalizePatientAiObject(content) {
  const parsed = extractJsonObject(content);
  if (parsed && typeof parsed === 'object') {
    return {
      answer: parsed.answer || parsed.patient_answer || parsed.response || '',
      addressed_domains: parsed.addressed_domains || parsed.domains || [],
      addressed_intents: parsed.addressed_intents || parsed.intents || [],
      used_fields: parsed.used_fields || parsed.fields || [],
      uncertainty_used: Boolean(parsed.uncertainty_used),
      confidence: parsed.confidence || ''
    };
  }
  return { answer: content };
}

async function askOpenRouterPatient(session, question, answerPlan, patientView, localFallback) {
  const settings = getTutorSettings();
  if (!settings.key) return null;

  const messages = [
      {
        role: 'system',
        content: [
          'You are portraying a patient during emergency department triage.',
          'Answer the learner\'s question in the first person using plain, natural patient language, using the supplied patient view and the local safe answer as your source of truth.',
          'If the learner\'s question is a specific inquiry about a condition, medication, allergy, or symptom (whether you have it or not), focus your answer only on the item asked. Do not list other unrelated conditions, symptoms, or medications from your history even if they are present in your patient view or local safe answer. If you do not have it, reply naturally in the negative.',
          'Keep your response strictly focused on the requested topic. Do not include details about other symptoms, triggers, conditions, or timeline information if they are not explicitly asked by the learner.',
          'NEVER volunteer your quantitative pain score (e.g., 8 out of 10) or severity unless the learner explicitly asks you to rate your pain or asks "how bad is the pain". If they just ask if you have pain, say yes or no without the score.',
          'Do not invent or add new positive symptoms, diagnoses, history, medications, test results, or vital signs that are not in the patient view.',
          'Answer only the question asked in one or two short sentences.',
          'Do not mention raw chart abbreviations, MIETIC, datasets, records, ESI, acuity, disposition, admission, ICU transfer, expert opinions, resource use, or ED interventions.',
          'If asked for diagnosis, triage level, admission status, treatments, test results, or what clinicians did, say you do not know that as the patient.',
          'Stay consistent with the supplied patient view. Do not invent unrelated positive symptoms.',
          'If the learner asks what a chart abbreviation means, do not define it. Say you are not sure and describe the symptoms that brought you in.',
          'Return only JSON with this shape: {"answer":"short patient answer","addressed_intents":["intent"],"used_fields":["patient_view_field"],"uncertainty_used":false}.'
        ].join(' ')
      },
      {
        role: 'user',
        content: JSON.stringify({
          learner_question: question,
          response_intent: answerPlan.signature,
          requested_intents: answerPlan.intents,
          requested_domains: answerPlan.covered_categories,
          local_safe_answer: localFallback,
          recent_turns: recentPatientTurns(session),
          patient_view: patientViewForModel(patientView),
          forbidden_terms: patientView.forbidden_terms
        })
      }
    ];

  const requestOptions = {
      key: settings.key,
      model: settings.patientModel || DEFAULT_PATIENT_DIALOGUE_MODEL,
      maxTokens: 180,
      temperature: 0.2,
      timeoutMs: PATIENT_AI_BACKGROUND_TIMEOUT_MS,
      responseFormat: { type: 'json_object' }
    };

  let content;
  try {
    content = await callOpenRouter(messages, requestOptions);
  } catch (error) {
    if (!/response[_\s-]?format|json/i.test(error.message || '')) throw error;
    content = await callOpenRouter(messages, { ...requestOptions, responseFormat: null });
  }

  const parsed = normalizePatientAiObject(content);
  const candidate = validatePatientAnswer({
    caseData: session.case,
    answer: parsed.answer,
    intentKey: answerPlan.signature,
    category: answerPlan.primary_category,
    question,
    session,
    answerPlan,
    patientView
  });
  if (!candidate) return null;
  return {
    answer: candidate,
    addressed_intents: parsed.addressed_intents || answerPlan.intents || [],
    used_fields: parsed.used_fields || [],
    uncertainty_used: Boolean(parsed.uncertainty_used)
  };
}

function answerUsedInSession(session, answer, intentKey = '') {
  const normalized = normalizedAnswerText(answer);
  if (!normalized) return false;
  return (session.interview_log || []).some((item) => {
    if (item.intent_key !== intentKey) return false;
    return normalizedAnswerText(item.answer) === normalized;
  });
}

function varyRepeatedPatientAnswer(session, answer, category, question, intentKey) {
  if (!answerUsedInSession(session, answer, intentKey)) return answer;
  if (String(intentKey || '').startsWith('timeline') || category === 'timeline') {
    if (hasSubduralChartLanguage(session.case)) {
      return "I do not know the exact day. The headache and unsteadiness had been getting worse before I came in.";
    }
    return "I do not know the exact time, but it was already going on before I came in.";
  }
  if (String(intentKey || '').startsWith('term_clarification')) {
    return "I do not know what that term means. I can only tell you about the headache, dizziness, and falls.";
  }
  if (category === 'chief_concern') {
    return `${chiefConcernAnswer(session.case)} That's the main reason I came in.`;
  }
  if (category === 'severity') {
    return severityAnswer(session.case);
  }
  if (category === 'red_flags') {
    return redFlagAnswer(session.case, question);
  }
  return answer;
}

function storePatientAnswer(session, cacheKey, payload) {
  const stored = {
    cache_version: PATIENT_RESPONSE_CACHE_VERSION,
    persona_version: PATIENT_PERSONA_VERSION,
    prompt_version: PATIENT_PROMPT_VERSION,
    ...clone(payload)
  };
  session.response_cache[cacheKey] = clone(stored);
  writePersistentPatientCache(session.case, payload.intent_key, stored);
  return stored;
}

function expectedEscalationActions(caseData) {
  const expected = {};
  const add = (id, evidence) => {
    if (!expected[id]) expected[id] = [];
    if (evidence && !expected[id].includes(evidence)) expected[id].push(evidence);
  };
  const text = complaintText(caseData);
  const flags = vitalFlags(caseData);
  const physiologicVitalFlags = flags.filter((item) => item.name !== 'Pain Level');
  const interventions = caseData.interventions;

  if (caseData.acuity <= 2 || physiologicVitalFlags.length) {
    add('immediate_bedside_evaluation', caseData.acuity <= 2 ? `reference ESI ${caseData.acuity}` : 'abnormal triage vital signs');
    add('monitored_bed', caseData.acuity <= 2 ? `reference ESI ${caseData.acuity}` : 'abnormal triage vital signs');
  }
  if (caseData.transfer_to_icu_in_1h || caseData.transfer_to_icu_beyond_1h) add('monitored_bed', 'recorded ICU transfer signal');
  const resuscitationVitalFlags = physiologicVitalFlags;
  if (caseData.acuity === 1 || resuscitationVitalFlags.some((item) => item.severity === 'critical') || interventions.invasive_ventilation || interventions.critical_procedure || caseData.expired_within_1h) {
    add('resuscitation_bay', caseData.acuity === 1 ? `reference ESI ${caseData.acuity}` : 'critical case signal');
  }
  if (hasPositiveRespiratoryEvidence(caseData) || hasObjectiveRespiratorySupport(caseData, flags)) {
    add('airway_oxygenation_support', 'respiratory complaint, vital sign, or treatment field');
  }
  if (caseData.red_cell_order_more_than_1 || caseData.transfusion_within_1h || caseData.transfusion_beyond_1h || hasAny(text, ['bleed', 'hematemesis', 'melena', 'rectal bleeding'])) {
    add('bleeding_transfusion_readiness', 'recorded transfusion signal or bleeding language');
  }
  if (interventions.critical_procedure || interventions.tier1_med_usage_1h) add('critical_procedure_team', 'recorded critical procedure or emergency medication field');
  if (interventions.psychotropic_med_within_120min || hasAny(text, ['suicid', 'agitat', 'psych', 'violent', 'hallucinat'])) add('behavioral_safety', 'psychotropic medication field or behavioral-health language');
  if (caseData.vitals.pain >= 8) add('pain_reassessment', `pain score ${caseData.vitals.pain}/10`);
  reviewedGradingFacts(caseData).forEach((fact) => {
    if (fact.action_id && actionLookup[fact.action_id]) {
      add(fact.action_id, `reviewed inferred finding: ${fact.statement}`);
    }
  });

  return TRIAGE_ACTION_ORDER
    .filter((id) => expected[id])
    .map((id) => ({ ...actionLookup[id], evidence: expected[id] }));
}

function evaluateEscalation(caseData, selectedActionIds) {
  const selected = new Set(selectedActionIds || []);
  const expected = expectedEscalationActions(caseData);
  const expectedIds = new Set(expected.map((item) => item.id));
  const expectedById = Object.fromEntries(expected.map((item) => [item.id, item]));
  const matched = TRIAGE_ACTION_ORDER.filter((id) => selected.has(id) && expectedIds.has(id)).map((id) => expectedById[id]);
  const missed = TRIAGE_ACTION_ORDER.filter((id) => expectedIds.has(id) && !selected.has(id)).map((id) => expectedById[id]);
  const extra = TRIAGE_ACTION_ORDER.filter((id) => selected.has(id) && !expectedIds.has(id)).map((id) => ({
    ...actionLookup[id],
    evidence: ['No supporting source-record or ESI/vital signal was identified for this case.']
  }));
  return {
    expected,
    matched,
    missed,
    extra,
    score: matched.length,
    possible: expected.length,
    message: missed.length
      ? 'One or more immediate safety or placement priorities were not selected.'
      : expected.length
        ? 'Escalation choices matched the main safety priorities.'
        : 'No immediate escalation priority was required by the available case fields.',
    grounding: 'Scored escalation actions use ESI 1-2 risk, danger-zone vitals, critical outcomes, respiratory support, bleeding risk, behavioral safety, severe pain, or reviewed grading references. Routine resource signals are handled in the ESI rationale.'
  };
}

const SBAR_SECTION_LABELS = {
  s: 'situation',
  situation: 'situation',
  b: 'background',
  background: 'background',
  a: 'assessment',
  assessment: 'assessment',
  r: 'recommendation',
  recommendation: 'recommendation'
};

const SBAR_CASE_STOP_WORDS = new Set([
  'with',
  'from',
  'this',
  'that',
  'have',
  'has',
  'had',
  'the',
  'and',
  'for',
  'after',
  'before',
  'into',
  'were',
  'was',
  'patient',
  'chief',
  'complaint',
  'presented',
  'presents',
  'arrival',
  'arrived',
  'history',
  'vital',
  'signs'
]);

const SBAR_CLINICAL_TERMS = new Set([
  'acuity',
  'adult',
  'airway',
  'allergy',
  'assessment',
  'bed',
  'bleeding',
  'blood',
  'breathing',
  'circulation',
  'clinician',
  'concern',
  'confusion',
  'current',
  'distress',
  'ed',
  'esi',
  'evaluate',
  'evaluation',
  'female',
  'high',
  'history',
  'immediate',
  'male',
  'medication',
  'monitor',
  'monitoring',
  'pain',
  'patient',
  'placement',
  'problem',
  'reassess',
  'resource',
  'risk',
  'room',
  'severe',
  'stable',
  'triage',
  'urgent',
  'unstable',
  'vital'
]);

function tokenizeForScoring(text) {
  return String(text || '').toLowerCase().match(/[a-z0-9]+/g) || [];
}

function caseKeywordSet(caseData) {
  const source = `${plainComplaint(caseData.complaint)} ${caseData.history || ''}`;
  return new Set(
    tokenizeForScoring(source)
      .filter((token) => token.length >= 4)
      .filter((token) => !SBAR_CASE_STOP_WORDS.has(token))
      .slice(0, 80)
  );
}

function textHasAnyToken(text, tokens) {
  const tokenSet = new Set(tokenizeForScoring(text));
  return tokens.some((token) => tokenSet.has(token));
}

function textHasAnyPhrase(text, phrases) {
  const lower = String(text || '').toLowerCase();
  return phrases.some((phrase) => lower.includes(phrase));
}

function textHasCaseKeyword(text, caseData) {
  const keywords = caseKeywordSet(caseData);
  const tokens = tokenizeForScoring(text);
  return tokens.some((token) => keywords.has(token));
}

function recognizedClinicalTokenCount(text, caseData) {
  const keywords = caseKeywordSet(caseData);
  return tokenizeForScoring(text).filter((token) => SBAR_CLINICAL_TERMS.has(token) || keywords.has(token)).length;
}

function isClinicallyMeaningfulSbarText(text, caseData) {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  const tokens = tokenizeForScoring(cleaned);
  if (cleaned.length < 8 || tokens.length < 2) return false;
  if (/(.)\1{4,}/.test(cleaned)) return false;
  return recognizedClinicalTokenCount(cleaned, caseData) > 0;
}

function extractSbarSections(text) {
  const source = String(text || '');
  const matches = [];
  const pattern = /\b(situation|background|assessment|recommendation|s|b|a|r)\s*:/gi;
  let match = pattern.exec(source);
  while (match) {
    const key = SBAR_SECTION_LABELS[match[1].toLowerCase()];
    if (key) {
      matches.push({
        key,
        index: match.index,
        contentStart: pattern.lastIndex
      });
    }
    match = pattern.exec(source);
  }

  const sections = {
    situation: { text: '', labelled: false },
    background: { text: '', labelled: false },
    assessment: { text: '', labelled: false },
    recommendation: { text: '', labelled: false }
  };

  matches.forEach((item, index) => {
    const end = matches[index + 1]?.index ?? source.length;
    const content = source.slice(item.contentStart, end).replace(/\s+/g, ' ').trim();
    sections[item.key].text = [sections[item.key].text, content].filter(Boolean).join(' ');
    sections[item.key].labelled = true;
  });

  return sections;
}

function demographicSignalText(caseData) {
  const age = Math.round(Number(caseData.demographics.age || 0));
  const sex = String(caseData.demographics.sex || '').toLowerCase();
  const transport = String(caseData.demographics.transport || '').toLowerCase();
  return `${age} ${sex} ${transport}`.replace(/\s+/g, ' ');
}

function hasDemographicSignal(text, caseData) {
  const lower = String(text || '').toLowerCase();
  const age = Math.round(Number(caseData.demographics.age || 0));
  const sex = String(caseData.demographics.sex || '').toLowerCase();
  const transport = String(caseData.demographics.transport || '').toLowerCase();
  return (age > 0 && lower.includes(String(age))) ||
    (sex.startsWith('m') && textHasAnyToken(lower, ['m', 'male', 'man'])) ||
    (sex.startsWith('f') && textHasAnyToken(lower, ['f', 'female', 'woman'])) ||
    (transport && transport !== 'unknown' && lower.includes(transport));
}

function hasVitalSignal(text, caseData) {
  const lower = String(text || '').toLowerCase();
  const vitalTerms = ['vital', 'heart', 'hr', 'bp', 'blood pressure', 'oxygen', 'spo2', 'sat', 'respiratory', 'rr', 'temperature', 'temp', 'pain'];
  const vitalValues = Object.values(caseData.vitals || {})
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(Math.round(Number(value))));
  return textHasAnyPhrase(lower, vitalTerms) || vitalValues.some((value) => value && lower.includes(value));
}

function caseCarePriorityTerms(caseData) {
  const text = complaintText(caseData);
  if (isLacerationCase(caseData)) {
    return ['wound', 'laceration', 'cut', 'bleeding', 'hemostasis', 'irrigation', 'wash', 'repair', 'suture', 'tetanus', 'dressing', 'discharge', 'return', 'follow'];
  }
  if (isMedicationRefillCase(caseData)) {
    return ['medication', 'medications', 'refill', 'dose', 'last dose', 'missed', 'bridge', 'pharmacy', 'primary care', 'follow', 'return', 'access'];
  }
  if (/\bfracture|injury|wrist|foot|leg|ankle|fall\b/.test(text)) {
    return ['exam', 'neurovascular', 'splint', 'xray', 'radiograph', 'imaging', 'pain', 'reassess', 'orthopedic', 'follow'];
  }
  if (/\babdominal|abd pain|pelvic|vomiting|nausea|rectal abscess|perianal\b/.test(text)) {
    return ['abdominal', 'pelvic', 'perianal', 'pain', 'fluids', 'labs', 'imaging', 'surgery', 'reassess'];
  }
  return ['evaluate', 'reassess', 'monitor'];
}

function expectedRecommendationTerms(caseData) {
  const expected = expectedEscalationActions(caseData).map((item) => item.id);
  const terms = ['evaluate', 'reassess', 'monitor', ...caseCarePriorityTerms(caseData)];
  if (expected.includes('immediate_bedside_evaluation')) terms.push('clinician', 'immediate', 'bedside', 'notify');
  if (expected.includes('resuscitation_bay')) terms.push('resuscitation', 'resus');
  if (expected.includes('monitored_bed')) terms.push('monitored', 'monitor');
  if (expected.includes('airway_oxygenation_support')) terms.push('airway', 'oxygen', 'breathing');
  if (expected.includes('vascular_access')) terms.push('iv', 'access', 'bloodwork', 'blood');
  if (expected.includes('medication_route_priority')) terms.push('medication', 'meds');
  if (expected.includes('bleeding_transfusion_readiness')) terms.push('bleeding', 'transfusion', 'blood');
  if (expected.includes('critical_procedure_team')) terms.push('procedure', 'team');
  if (expected.includes('behavioral_safety')) terms.push('behavioral', 'safety');
  if (expected.includes('pain_reassessment')) terms.push('pain', 'analgesia');
  return terms;
}

function addSbarCriterion(result, passed, points, label) {
  if (passed) {
    result.score += points;
    result.met.push(label);
  } else {
    result.gaps.push(label);
  }
}

function scoreSbarSituation(section, caseData, finalEsi) {
  const text = section.text;
  const result = { score: 0, possible: 5, met: [], gaps: [] };
  const meaningful = isClinicallyMeaningfulSbarText(text, caseData);
  const lowAcuityFraming = Number(finalEsi) >= 4 && textHasAnyPhrase(text, ['stable', 'low acuity', 'minor', 'fast track', 'routine']);
  const conciseLowAcuity = Number(finalEsi) >= 4 && meaningful && textHasCaseKeyword(text, caseData) && tokenizeForScoring(text).length >= 3;
  addSbarCriterion(result, section.labelled && meaningful, 1, 'Situation: use the S label with meaningful clinical content');
  addSbarCriterion(result, textHasCaseKeyword(text, caseData), 1, 'Situation: state the actual presenting problem');
  addSbarCriterion(result, hasDemographicSignal(text, caseData) || textHasAnyToken(text, ['patient', 'adult']), 1, 'Situation: identify the patient or arrival context');
  addSbarCriterion(result, textHasAnyPhrase(text, [`esi ${finalEsi}`, 'acuity', 'emergent', 'urgent', 'immediate', 'high risk', 'severe']) || lowAcuityFraming, 1, 'Situation: state acuity, stability, or immediate concern');
  addSbarCriterion(result, conciseLowAcuity || (meaningful && tokenizeForScoring(text).length >= 5), 1, 'Situation: provide a concise sentence, not filler');
  return result;
}

function scoreSbarBackground(section, caseData) {
  const text = section.text;
  const result = { score: 0, possible: 5, met: [], gaps: [] };
  const meaningful = isClinicallyMeaningfulSbarText(text, caseData);
  const backgroundTerms = ['history', 'hx', 'pmh', 'medical', 'medication', 'medications', 'meds', 'allergy', 'allergies', 'risk', 'anticoag', 'pregnant', 'prior'];
  const contextTerms = ['started', 'onset', 'fall', 'trauma', 'transfer', 'ambulance', 'walk', 'worse', 'days', 'hours', 'pain', 'fever', 'vomiting', 'refill', 'dose', 'pharmacy'];
  addSbarCriterion(result, section.labelled && meaningful, 1, 'Background: use the B label with meaningful clinical content');
  addSbarCriterion(result, hasDemographicSignal(text, caseData), 1, 'Background: include age, sex, or arrival mode');
  addSbarCriterion(result, textHasAnyPhrase(text, backgroundTerms), 1, 'Background: include relevant history, medications, allergies, or risk context');
  addSbarCriterion(result, textHasAnyPhrase(text, contextTerms) || textHasCaseKeyword(text, caseData), 1, 'Background: include symptom course or case context');
  addSbarCriterion(result, textHasCaseKeyword(text, caseData), 1, 'Background: ground the background in this case');
  return result;
}

function scoreSbarAssessment(section, caseData, finalEsi) {
  const text = section.text;
  const result = { score: 0, possible: 5, met: [], gaps: [] };
  const meaningful = isClinicallyMeaningfulSbarText(text, caseData);
  addSbarCriterion(result, section.labelled && meaningful, 1, 'Assessment: use the A label with meaningful clinical content');
  addSbarCriterion(result, textHasAnyPhrase(text, [`esi ${finalEsi}`, 'acuity', 'level']), 1, 'Assessment: state the ESI or acuity interpretation');
  addSbarCriterion(result, hasVitalSignal(text, caseData), 1, 'Assessment: include vital signs or objective findings');
  addSbarCriterion(result, textHasAnyPhrase(text, ['risk', 'resource', 'stable', 'unstable', 'distress', 'monitor', 'high risk', 'severe']), 1, 'Assessment: interpret risk, stability, distress, or resources');
  addSbarCriterion(result, textHasCaseKeyword(text, caseData) || vitalFlags(caseData).some((item) => text.toLowerCase().includes(String(item.name).toLowerCase().split(' ')[0])), 1, 'Assessment: tie the assessment to this patient');
  return result;
}

function scoreSbarRecommendation(section, caseData) {
  const text = section.text;
  const result = { score: 0, possible: 5, met: [], gaps: [] };
  const meaningful = isClinicallyMeaningfulSbarText(text, caseData);
  const actionTerms = ['notify', 'evaluate', 'evaluation', 'place', 'move', 'continue', 'start', 'prepare', 'obtain', 'treat', 'consult', 'address', 'clean', 'irrigate', 'repair', 'refill', 'bridge', 'follow'];
  const placementTerms = ['room', 'bed', 'monitor', 'monitored', 'resus', 'resuscitation', 'reassess', 'observation'];
  const dispositionTerms = ['admit', 'admission', 'discharge', 'transfer', 'follow', 'return', 'next', 'after ed'];
  const expectedEscalation = expectedEscalationActions(caseData);
  const lowAcuityCareTerms = Number(caseData.acuity) >= 4 && textHasAnyPhrase(text, caseCarePriorityTerms(caseData));
  addSbarCriterion(result, section.labelled && meaningful, 1, 'Recommendation: use the R label with meaningful clinical content');
  addSbarCriterion(result, textHasAnyPhrase(text, actionTerms), 1, 'Recommendation: include a clear next action');
  addSbarCriterion(result, textHasAnyPhrase(text, placementTerms) || (!expectedEscalation.length && lowAcuityCareTerms), 1, 'Recommendation: include placement, monitoring, reassessment, or care priority');
  addSbarCriterion(result, textHasAnyPhrase(text, expectedRecommendationTerms(caseData)), 1, 'Recommendation: match the plan to expected case needs');
  addSbarCriterion(result, textHasAnyPhrase(text, dispositionTerms) || tokenizeForScoring(text).length >= 8, 1, 'Recommendation: close the handoff with disposition or follow-through');
  return result;
}

function scoreSbar(text, caseData, finalEsi) {
  const sections = extractSbarSections(text);
  const sectionScores = {
    situation: scoreSbarSituation(sections.situation, caseData, finalEsi),
    background: scoreSbarBackground(sections.background, caseData),
    assessment: scoreSbarAssessment(sections.assessment, caseData, finalEsi),
    recommendation: scoreSbarRecommendation(sections.recommendation, caseData)
  };
  const score = Object.values(sectionScores).reduce((sum, section) => sum + section.score, 0);
  const possible = Object.values(sectionScores).reduce((sum, section) => sum + section.possible, 0);
  const missing = Object.entries(sectionScores)
    .filter(([, section]) => section.score < 3)
    .map(([key]) => key);
  const gaps = Object.values(sectionScores).flatMap((section) => section.gaps).slice(0, 10);
  const met = Object.values(sectionScores).flatMap((section) => section.met);
  const meaningless = score === 0 && String(text || '').trim().length > 0;

  return {
    score,
    possible,
    missing,
    gaps,
    met,
    section_scores: sectionScores,
    message: score === possible
      ? 'SBAR handoff included a complete, case-grounded situation, background, assessment, and recommendation.'
      : meaningless
        ? 'SBAR handoff text was not clinically meaningful enough to score.'
        : `SBAR handoff scored ${score} / ${possible}; add case-specific content to the weak sections.`
  };
}

function clinicalFeedback(caseData) {
  const names = {
    invasive_ventilation: ['Endotracheal intubation performed', 'Airway protection or ventilatory failure was serious enough to require definitive airway management.'],
    intravenous: ['IV access established', 'IV access supports blood draws, medication delivery, fluids, contrast imaging, and rapid escalation if the patient worsens.'],
    intravenous_fluids: ['IV fluids administered', 'Fluids are commonly used when dehydration, poor perfusion, sepsis, bleeding, or hypotension is part of the early ED concern.'],
    intramuscular: ['IM medication administered', 'IM medication suggests a need for treatment when oral or IV delivery was not the best immediate route.'],
    oral_medications: ['Oral medication administered', 'Oral medication suggests the patient was stable enough for non-parenteral symptom treatment or routine therapy.'],
    nebulized_medications: ['Nebulized treatment administered', 'Nebulized therapy is most often tied to wheezing, bronchospasm, or respiratory symptoms needing inhaled treatment.'],
    tier1_med_usage_1h: ['Emergency medications (Tier 1) administered', 'A time-sensitive medication was given early, which is a strong signal that the ED team treated this as potentially high acuity.'],
    tier2_med_usage: ['Urgent medications (Tier 2) administered', 'Urgent medication use suggests active treatment needs beyond a low-resource visit.'],
    tier3_med_usage: ['Stabilizing medications (Tier 3) administered', 'Stabilizing medication use supports an ESI resource need even when the patient is not crashing.'],
    tier4_med_usage: ['Routine medications (Tier 4) administered', 'Routine medication use may reflect lower acuity treatment, but it still helps estimate resource needs.'],
    critical_procedure: ['Critical procedure performed', 'A critical procedure is a major escalation signal and should push the learner to revisit acuity and immediate safety risks.'],
    psychotropic_med_within_120min: ['Psychotropic medication administered', 'Psychotropic medication can indicate agitation, severe distress, or behavioral health needs requiring monitored ED care.']
  };
  return Object.entries(names)
    .filter(([key]) => caseData.interventions[key])
    .map(([value, [name, explanation]]) => ({ value, name, explanation }));
}

function domain(key, label, score, possible, message) {
  return {
    key,
    label,
    score,
    possible,
    percentage: possible ? Math.round((score / possible) * 100) : 0,
    message
  };
}

function esiAccuracyScore(learnerLevel, referenceLevel, possible, label) {
  if (!learnerLevel) {
    return {
      learner: 'Not recorded',
      reference: referenceLevel,
      score: 0,
      possible,
      message: `${label} was not recorded.`,
      action: 'Record an ESI level so the acuity decision can be evaluated.'
    };
  }
  const diff = Number(learnerLevel) - Number(referenceLevel);
  let score = possible;
  let message = `${label} matched the reference acuity.`;
  let action = 'Keep connecting risk, vital signs, and expected resources before assigning ESI.';
  if (diff < 0) {
    score = Math.abs(diff) === 1 ? Math.round(possible * 0.6) : Math.round(possible * 0.2);
    message = `${label} was higher acuity than the reference level.`;
    action = 'Identify which immediate danger signals or resource needs were absent before choosing a higher-acuity level.';
  } else if (diff > 0) {
    score = Math.abs(diff) === 1 ? Math.round(possible * 0.4) : 0;
    message = `${label} was lower acuity than the reference level.`;
    action = 'Recheck high-risk symptoms, danger-zone vital signs, and likely resource needs before lowering acuity.';
  }
  return {
    learner: learnerLevel || 'Not recorded',
    reference: referenceLevel,
    score,
    possible,
    message,
    action
  };
}

function esiResourceRule(referenceLevel) {
  const level = Number(referenceLevel);
  if (level === 1) return 'ESI 1 is reserved for patients needing immediate life-saving intervention.';
  if (level === 2) return 'ESI 2 is driven by high-risk presentation, severe new pain or distress, or danger-zone vital signs rather than resource counting.';
  if (level === 3) return 'ESI 3 is appropriate when the patient is hemodynamically stable but requires two or more distinct ED resource categories (e.g., laboratory tests, radiographic imaging, IV medications, or specialized consultations).';
  if (level === 4) return 'ESI 4 is appropriate for stable presentations requiring precisely one distinct ED resource category (e.g., simple plain radiograph or suturing) beyond history and physical examination.';
  if (level === 5) return 'ESI 5 is appropriate for stable routine presentations requiring zero counted ED resource categories (e.g., verbal prescription refill or wound check) beyond history and physical examination.';
  return 'ESI assignment should connect acuity risk, vital signs, and expected ED resource categories.';
}

function esiResourceEvidence(caseData) {
  const signals = [];
  if (caseData.resources_used) signals.push(`Recorded resource count: ${caseData.resources_used}`);
  if (caseData.lab_event_count > 0) signals.push(`Laboratory events: ${caseData.lab_event_count}`);
  if (caseData.microbio_event_count > 0) signals.push(`Microbiology events: ${caseData.microbio_event_count}`);
  if (caseData.exam_count > 0) signals.push(`Imaging or examination signal: ${caseData.exam_count}`);
  if (caseData.procedure_count > 0) signals.push(`Procedure signal: ${caseData.procedure_count}`);
  if (caseData.consults_count > 0) signals.push(`Consult signal: ${caseData.consults_count}`);
  if (caseData.interventions?.intramuscular) signals.push('IM medication recorded');
  if (caseData.interventions?.intravenous) signals.push('IV access recorded');
  if (caseData.interventions?.intravenous_fluids) signals.push('IV fluids recorded');
  if (caseData.interventions?.oral_medications) signals.push('Medication administration recorded');
  return signals.length ? uniqueSentences(signals) : ['No counted ED resource signal was recorded.'];
}

function stripTerminalPunctuation(text) {
  return String(text || '').replace(/[.!?]+$/g, '').trim();
}

function likelyEsiFourResourceExamples(caseData) {
  if (isLacerationCase(caseData)) return 'laceration repair, radiograph, tetanus update, or IM medication';
  const text = complaintText(caseData);
  if (/\b(wrist|foot|leg|ankle|fracture|injury|fall)\b/.test(text)) return 'radiograph, splinting, analgesia, or focused procedure support';
  if (/\bmedication refill|med refill\b/.test(text)) return 'prescription review or medication administration if recorded';
  return 'imaging, medication administration, procedure support, or other counted ED resource';
}

function buildEsiExplanation(session, caseData) {
  const learnerEsi = session.triage_level || null;
  const referenceEsi = caseData.acuity;
  const diff = learnerEsi ? Number(learnerEsi) - Number(referenceEsi) : null;
  const resources = esiResourceEvidence(caseData);
  const limitations = sourceDataLimitations(caseData);
  const examples = likelyEsiFourResourceExamples(caseData);
  const referenceRule = esiResourceRule(referenceEsi);
  const learnerRule = learnerEsi ? esiResourceRule(learnerEsi) : 'No learner ESI was recorded.';
  const matched = diff === 0;
  const ruleLines = matched || !learnerEsi || Number(learnerEsi) === Number(referenceEsi)
    ? [referenceRule]
    : uniqueSentences([learnerRule, referenceRule]);
  const resourceBasis = resources.map(stripTerminalPunctuation);
  const stableNoResource = Number(referenceEsi) === 5 && resourceBasis.some((item) => /no counted ed resource/i.test(item));

  let whyLearnerWrong = learnerEsi
    ? `ESI ${learnerEsi} was compared with reference ESI ${referenceEsi}.`
    : 'No final ESI was recorded, so the acuity decision could not be compared with the reference.';
  let whyReferenceRight = `Reference ESI ${referenceEsi} is supported by the source record when the ESI rule is applied to the documented risk and resource signals.`;
  let summary = whyReferenceRight;

  if (diff > 0 && Number(learnerEsi) === 5 && Number(referenceEsi) === 4) {
    whyLearnerWrong = `ESI 5 is lower acuity than the reference because ESI 5 is for cases expected to need no counted ED resources beyond history, examination, and simple bedside care. This source records resource signals beyond a no-resource visit.`;
    whyReferenceRight = `Reference ESI 4 is defensible if one ED resource is expected, such as ${examples}. The source records at least one resource signal, but it does not specify the exact wound intervention.`;
    summary = whyReferenceRight;
  } else if (diff > 0) {
    whyLearnerWrong = `ESI ${learnerEsi} placed the patient below the reference acuity. Reconcile resource needs, abnormal objective findings, severe pain, high-risk symptoms, and reviewed grading references before lowering acuity.`;
    whyReferenceRight = `${referenceRule} The source record includes: ${resourceBasis.slice(0, 3).join('; ')}.`;
    summary = whyReferenceRight;
  } else if (diff < 0) {
    whyLearnerWrong = `ESI ${learnerEsi} placed the patient above the reference acuity. Identify which immediate danger signals, high-risk features, or resource needs are absent before assigning a higher-acuity level.`;
    whyReferenceRight = `${referenceRule} The available source record supports this lower reference level without an ESI ${learnerEsi} trigger.`;
    summary = whyReferenceRight;
  } else if (diff === 0) {
    whyLearnerWrong = `Learner ESI ${learnerEsi} matched the reference level.`;
    whyReferenceRight = stableNoResource
      ? `Reference ESI ${referenceEsi} fits because the record shows stable vital signs, no documented danger signal, and no counted ED resources.`
      : `${referenceRule} The source record includes: ${resourceBasis.slice(0, 3).join('; ')}.`;
    summary = whyReferenceRight;
  }

  return {
    mode: matched ? 'matched' : learnerEsi ? 'mismatch' : 'not_recorded',
    title: matched ? `Why ESI ${referenceEsi} fits` : 'Why the acuity differs',
    summary,
    rule_lines: ruleLines,
    resource_basis: resourceBasis,
    limitations,
    learner_esi: learnerEsi,
    reference_esi: referenceEsi,
    resource_rule: ruleLines.join(' '),
    case_resources: resourceBasis,
    why_learner_wrong: whyLearnerWrong,
    why_reference_right: whyReferenceRight,
    data_limitations: limitations
  };
}

function vitalRationaleScoreDetails(session, caseData, possible = 15) {
  const rationale = String(session.triage_rationale || '').toLowerCase();
  const abnormal = vitalFlags(caseData);
  const namesVitals = ['vital', 'heart', 'hr', 'bp', 'oxygen', 'sat', 'spo2', 'resp', 'temperature', 'temp', 'pain'].some((term) => rationale.includes(term));
  const score = !abnormal.length || namesVitals ? possible : 0;
  const evidence = abnormal.length
    ? abnormal.map((item) => `${item.name}: ${item.value} (${item.reason})`)
    : ['No danger-zone vital signs were documented.'];
  return {
    score,
    possible,
    evidence,
    message: score
      ? 'Final rationale incorporated the vital-sign review or no danger-zone vital signs were present.'
      : 'Abnormal vital signs were present but not clearly named in the final ESI rationale.',
    action: score
      ? 'Continue making objective vitals explicit in acuity reasoning.'
      : 'Name the abnormal vital signs in the ESI rationale and explain how they change risk.'
  };
}

function interviewScoreDetails(workflow) {
  const interview = workflow.interview;
  const requiredCount = Math.max(interview.required_categories.length, 1);
  const interviewPenalty = Math.min(interview.low_yield_count * 2, 5) + Math.min(interview.duplicate_count * 2, 4);
  const interviewScore = Math.max(0, Math.round((interview.covered_categories.length / requiredCount) * 15) - interviewPenalty);
  return {
    score: interviewScore,
    possible: 15,
    penalty: interviewPenalty,
    message: interview.message,
    action: interview.missed_domains.length
      ? 'Prioritize domains that change acuity, safety, or resources before assigning final ESI.'
      : 'The focused interview covered the required triage domains for this case.'
  };
}

function escalationScoreDetails(workflow, possible = 20) {
  const escalation = workflow.escalation;
  const extraCount = escalation.extra.length;
  let escalationScore = possible;
  if (escalation.expected.length) {
    escalationScore = Math.max(0, Math.round((escalation.matched.length / escalation.expected.length) * possible) - Math.min(extraCount * 2, 5));
  } else if (extraCount) {
    escalationScore = Math.round(possible * 0.67);
  }
  return {
    score: escalationScore,
    possible,
    extra_penalty: escalation.expected.length ? Math.min(extraCount * 2, 5) : extraCount ? 5 : 0,
    message: escalation.message,
    action: escalation.missed.length
      ? 'Select escalation actions that match immediate safety, ESI 1-2 risk, danger-zone vitals, critical outcomes, bleeding, respiratory support, behavioral safety, or severe pain.'
      : escalation.extra.length
        ? 'Avoid extra escalation actions when no dataset, vital, or ESI signal supports them.'
        : 'Escalation choices matched the main data-grounded priorities.'
  };
}

function expectedReassessmentTargets(caseData, workflow = {}) {
  const expected = {};
  const add = (id, evidence) => {
    if (!reassessmentTargetLookup[id]) return;
    if (!expected[id]) expected[id] = [];
    if (evidence && !expected[id].includes(evidence)) expected[id].push(evidence);
  };
  const text = complaintText(caseData);
  const flags = vitalFlags(caseData);
  const expectedEscalationIds = new Set((workflow.escalation?.expected || []).map((item) => item.id));

  if (flags.length) {
    add('vital_trend', flags.slice(0, 3).map((item) => `${item.name} ${item.value}`).join('; '));
  }
  if (Number(caseData.vitals?.pain) >= 6 || expectedEscalationIds.has('pain_reassessment')) {
    add('pain_response', `pain score ${formatVitalNumber(caseData.vitals?.pain)}/10`);
  }
  if (expectedEscalationIds.has('airway_oxygenation_support') || caseData.vitals?.o2 < 94 || caseData.vitals?.rr >= 24 || /\b(shortness of breath|dyspnea|sob|wheez|hypoxi|respiratory)\b/i.test(text)) {
    add('airway_breathing', 'respiratory complaint, oxygenation, or airway-support signal');
  }
  if (expectedEscalationIds.has('bleeding_transfusion_readiness') || caseData.vitals?.sbp < 100 || caseData.vitals?.hr >= 120 || /\b(bleed|melena|hematemesis|hypotension|tachycardia|syncope)\b/i.test(text)) {
    add('circulation_bleeding', 'perfusion, bleeding, or hemodynamic signal');
  }
  if (expectedEscalationIds.has('behavioral_safety') || /\b(confus|altered|seizure|stroke|weakness|numbness|head injury|suicid|agitat)\b/i.test(text)) {
    add('neuro_mental_status', 'neurologic, mental-status, or behavioral safety language');
  }
  if (caseData.vitals?.temp >= 100.4 || /\b(fever|infection|abscess|cellulitis|pneumonia|sepsis|purulent|chills)\b/i.test(text)) {
    add('infection_fever', 'fever or infection language');
  }
  if (/\b(foot|leg|wrist|hand|ankle|fracture|injury|fall|swelling|laceration|open fracture)\b/i.test(text)) {
    add('distal_neurovascular', 'extremity injury or wound language');
  }
  if (caseData.acuity <= 3 || String(caseData.disposition || '').trim()) {
    add('disposition_safety', caseData.disposition ? `reference disposition ${caseData.disposition}` : `reference ESI ${caseData.acuity}`);
  }

  reviewedInferredFacts(caseData).forEach((fact) => {
    const textValue = `${fact.statement || ''} ${fact.rationale || ''} ${fact.practice_rule || ''}`.toLowerCase();
    if (/\bpulse|sensation|motor|capillary|neurovascular|compartment\b/.test(textValue)) {
      add('distal_neurovascular', `reviewed inferred finding: ${fact.statement}`);
    }
    if (/\bpain|analgesia|reassess\b/.test(textValue)) {
      add('pain_response', `reviewed inferred finding: ${fact.statement}`);
    }
  });

  return REASSESSMENT_TARGETS
    .filter((item) => expected[item.id])
    .map((item) => ({ ...item, evidence: expected[item.id] }));
}

function evaluateReassessment(session, caseData, workflow = {}) {
  const plan = session.reassessment_plan || [];
  const rationale = session.reassessment_rationale || '';
  const selected = new Set(plan);
  const expected = expectedReassessmentTargets(caseData, workflow);
  const expectedIds = new Set(expected.map((item) => item.id));
  const expectedById = Object.fromEntries(expected.map((item) => [item.id, item]));
  const matched = REASSESSMENT_TARGETS
    .filter((item) => selected.has(item.id) && expectedIds.has(item.id))
    .map((item) => expectedById[item.id]);
  const missed = expected.filter((item) => !selected.has(item.id));
  const extra = REASSESSMENT_TARGETS
    .filter((item) => selected.has(item.id) && !expectedIds.has(item.id));
  const selectedTargets = REASSESSMENT_TARGETS
    .filter((item) => selected.has(item.id));
  const ddx = reviewedAugmentationDdx(caseData);
  const facts = reviewedInferredFacts(caseData);
  const targets = [...ddx.map((d) => d.next_discriminator), ...facts.map((f) => f.practice_rule)].filter(Boolean);
  return {
    plan,
    selected_targets: selectedTargets,
    rationale,
    expected,
    matched,
    missed,
    extra,
    score: matched.length,
    possible: expected.length,
    message: missed.length
      ? 'One or more reassessment targets tied to case risk were not selected.'
      : expected.length
        ? 'Reassessment plan covered the main case-specific monitoring targets.'
        : plan.length
          ? 'Reassessment targets were recorded; no required target was derived from available fields.'
          : 'No active reassessment target was required by the available case fields.',
    targets
  };
}

function reassessmentScoreDetails(workflow, possible = 10) {
  const reassessment = workflow.reassessment || {};
  const expected = reassessment.expected || [];
  const matched = reassessment.matched || [];
  const extra = reassessment.extra || [];
  let score = possible;
  if (expected.length) {
    score = Math.max(0, Math.round((matched.length / expected.length) * possible) - Math.min(extra.length, 3));
  } else if (extra.length) {
    score = Math.round(possible * 0.8);
  }
  return {
    score,
    possible,
    message: reassessment.message || 'Reassessment plan was evaluated from case-specific monitoring targets.',
    action: (reassessment.missed || []).length
      ? `Add reassessment targets for ${reassessment.missed.slice(0, 3).map((item) => item.label).join(', ')}.`
      : 'Use reassessment to close the loop after initial management priorities.'
  };
}

function referenceDiagnosisList(caseData) {
  const sourcePrimary = caseData.ground_truth?.diagnoses?.primary || [];
  const sourceSecondary = caseData.ground_truth?.diagnoses?.secondary || [];
  const sourceIcd = caseData.ground_truth?.diagnoses?.icd?.title;
  const reviewed = reviewedAugmentationDiagnosis(caseData);
  const reference = uniqueSentences([
    ...sourcePrimary,
    sourceIcd,
    reviewed
  ].filter(Boolean));
  const alternatives = uniqueSentences([
    ...sourceSecondary,
    ...(reviewedAugmentationDdx(caseData).map((item) => item.diagnosis))
  ].filter(Boolean));
  return {
    primary: reference.length ? reference : [soapPrimaryDiagnosis(caseData)],
    alternatives,
    source_status: caseData.case_source === 'mimic_restricted_local'
      ? 'source_record'
      : reviewed
        ? 'reviewed_teaching_inference'
        : 'llm_draft'
  };
}

function clinicalTokenSet(value) {
  return new Set(tokenizeForScoring(String(value || ''))
    .filter((token) => token.length >= 4)
    .filter((token) => !['diagnosis', 'patient', 'acute', 'possible', 'working'].includes(token)));
}

function bestReferenceOverlap(learnerText, references = []) {
  const learner = clinicalTokenSet(learnerText);
  if (!learner.size) return 0;
  return references.reduce((best, reference) => {
    const referenceTokens = clinicalTokenSet(reference);
    if (!referenceTokens.size) return best;
    const overlap = [...learner].filter((token) => referenceTokens.has(token)).length;
    return Math.max(best, overlap / Math.max(referenceTokens.size, 1));
  }, 0);
}

function evaluateDiagnosis(session, caseData) {
  const reference = referenceDiagnosisList(caseData);
  const learnerText = [
    session.working_diagnosis,
    ...(session.differential || []),
    session.diagnosis_evidence
  ].filter(Boolean).join(' ');
  const overlap = bestReferenceOverlap(learnerText, [...reference.primary, ...reference.alternatives]);
  const evidenceText = String(session.diagnosis_evidence || '').toLowerCase();
  const evidenceMentionsVitals = hasAny(evidenceText, ['vital', 'heart', 'blood pressure', 'oxygen', 'respiratory', 'pain', 'fever', 'tachy', 'hypotens']);
  const evidenceMentionsHistory = hasAny(evidenceText, ['history', 'onset', 'started', 'duration', 'risk', 'complaint', 'symptom', 'exam']);
  const sourceRecord = reference.source_status === 'source_record';
  const possible = sourceRecord ? 15 : 10;
  let score = 0;
  if (session.working_diagnosis) score += sourceRecord ? 4 : 3;
  if ((session.differential || []).length) score += sourceRecord ? 2 : 2;
  if (session.diagnosis_evidence?.length >= 20) score += sourceRecord ? 3 : 3;
  if (evidenceMentionsVitals || evidenceMentionsHistory) score += sourceRecord ? 2 : 2;
  if (sourceRecord) score += Math.round(overlap * 4);
  score = Math.max(0, Math.min(score, possible));

  return {
    learner: {
      working_diagnosis: session.working_diagnosis || '',
      differential: clone(session.differential || []),
      evidence: session.diagnosis_evidence || ''
    },
    reference,
    overlap_score: Number(overlap.toFixed(2)),
    score,
    possible,
    message: sourceRecord
      ? (overlap >= 0.5
        ? 'Working diagnosis aligned with the source-record diagnosis context.'
        : 'Working diagnosis was compared with source-record diagnosis context; strengthen the evidence link.')
      : 'Diagnosis reasoning was scored for structure and evidence use because public demo cases do not contain a source-record diagnosis.',
    action: session.diagnosis_evidence
      ? 'Keep tying the working diagnosis to specific history, vitals, exam, and risk signals.'
      : 'Add evidence that supports and limits the working diagnosis.'
  };
}

function evaluateReferral(session, caseData) {
  const approved = caseData.ground_truth?.referral?.clinician_approved_specialty || [];
  const learnerSpecialty = session.referral_specialty || '';
  const learnerNeeded = Boolean(session.referral_needed);
  const hasReference = approved.length > 0;
  const specialtyOverlap = bestReferenceOverlap(learnerSpecialty, approved);
  const score = hasReference
    ? (learnerNeeded ? 4 : 0) + (specialtyOverlap >= 0.45 ? 6 : 0)
    : 0;
  return {
    learner: {
      needed: session.referral_needed,
      specialty: learnerSpecialty,
      rationale: session.referral_rationale || ''
    },
    reference: {
      clinician_approved_specialty: approved,
      source_status: hasReference ? 'source_record' : 'source_limited_unscored'
    },
    score,
    possible: hasReference ? 10 : 0,
    scored: hasReference,
    message: hasReference
      ? (score >= 8
        ? 'Referral decision matched the clinician-approved specialty reference.'
        : 'Referral decision did not fully match the clinician-approved specialty reference.')
      : 'Referral judgment is recorded but unscored because this case has no clinician-approved specialty reference.',
    action: hasReference
      ? 'Name why that service changes immediate ED workup, stabilization, or disposition.'
      : 'Document whether specialty input is needed now and what clinical change would trigger escalation.'
  };
}

function diagnosisScoreDetails(workflow) {
  const diagnosis = workflow.diagnosis || {};
  return {
    score: diagnosis.score || 0,
    possible: diagnosis.possible || 0,
    message: diagnosis.message || 'Diagnosis reasoning was not evaluated.',
    action: diagnosis.action || 'Submit a working diagnosis with case evidence.'
  };
}

function referralScoreDetails(workflow) {
  const referral = workflow.referral || {};
  return {
    score: referral.score || 0,
    possible: referral.possible || 0,
    message: referral.message || 'Referral judgment was not evaluated.',
    action: referral.action || 'Submit a referral decision with rationale.'
  };
}

function evaluateFocusedExam(session, caseData) {
  const result = session.focused_exam_results || null;
  if (!result) {
    const expected = buildFocusedExamSelection(
      caseData,
      ['general_airway'],
      reviewedPhysicalExamFacts(caseData),
      session.checked_vitals?.length ? session.checked_vitals : formatVitals(caseData)
    );
    return {
      selected_systems: [],
      expected_systems: expected.expected_systems || [],
      matched_systems: [],
      missed_systems: expected.expected_systems || [],
      extra_systems: [],
      findings: [],
      score: 0,
      possible: 10,
      message: 'No focused exam systems were conducted before clinical impression.',
      action: 'Select focused exam systems that fit the complaint, vitals, and immediate threats before committing to the impression.'
    };
  }
  const score = result.score ?? scoreFocusedExamSelection(result);
  const missedCount = result.missed_systems?.length || 0;
  const extraCount = result.extra_systems?.length || 0;
  return {
    ...clone(result),
    score,
    possible: 10,
    message: missedCount
      ? 'Focused exam covered some priorities but missed case-specific systems.'
      : extraCount > 1
        ? 'Focused exam found the core systems but included broad extra systems that should be justified.'
        : 'Focused exam choices matched the key case-specific systems.',
    action: missedCount
      ? `Add ${result.missed_systems.map((item) => item.name).join(', ')} when the complaint or vitals point there.`
      : 'Keep pairing each selected exam system with a specific clinical reason.'
  };
}

function focusedExamScoreDetails(workflow) {
  const focusedExam = workflow.focused_exam || {};
  return {
    score: focusedExam.score || 0,
    possible: focusedExam.possible || 10,
    message: focusedExam.message || 'Focused exam selection was not evaluated.',
    action: focusedExam.action || 'Select and conduct focused exams before moving to the clinical impression.'
  };
}

function generateActionFeedback(session, caseData, workflow, details) {
  const evidenceText = (items) => items.map((item) => typeof item === 'string' ? item : `${item.label}: ${item.value || item.reason || ''}`);
  const selectedEscalation = session.escalation_actions || [];
  const escalationEvidence = [
    session.escalation_rationale ? `Rationale: ${session.escalation_rationale}` : 'No escalation rationale recorded.',
    workflow.escalation.matched.length ? `Matched: ${workflow.escalation.matched.map((item) => item.name).join(', ')}` : '',
    workflow.escalation.missed.length ? `Missed: ${workflow.escalation.missed.map((item) => item.name).join(', ')}` : '',
    workflow.escalation.extra.length ? `Extra: ${workflow.escalation.extra.map((item) => item.name).join(', ')}` : '',
    !selectedEscalation.length ? 'Learner selected no immediate escalation actions.' : ''
  ].filter(Boolean);
  const reassessmentEvidence = [
    session.reassessment_rationale ? `Rationale: ${session.reassessment_rationale}` : 'No reassessment rationale recorded.',
    workflow.reassessment?.matched?.length ? `Matched: ${workflow.reassessment.matched.map((item) => item.label).join(', ')}` : '',
    workflow.reassessment?.missed?.length ? `Missed: ${workflow.reassessment.missed.map((item) => item.label).join(', ')}` : '',
    workflow.reassessment?.extra?.length ? `Extra: ${workflow.reassessment.extra.map((item) => item.label).join(', ')}` : ''
  ].filter(Boolean);

  return [
    {
      id: 'interview',
      label: 'Focused interview',
      learner: `${workflow.interview.questions_used} questions used`,
      reference: workflow.interview.required_domains.join(', '),
      score: `${details.interview.score} / ${details.interview.possible}`,
      feedback: details.interview.message,
      action: details.interview.action,
      evidence: [
        `Covered: ${workflow.interview.covered_domains.join(', ') || 'None'}`,
        `Missed: ${workflow.interview.missed_domains.join(', ') || 'None'}`,
        `Efficiency penalties: ${details.interview.penalty}`
      ]
    },
    {
      id: 'vital_reasoning',
      label: 'Vital-sign reasoning',
      learner: session.triage_rationale || 'No final rationale text',
      reference: 'Final ESI rationale should name abnormal objective signals when present.',
      score: `${details.vital_rationale.score} / ${details.vital_rationale.possible}`,
      feedback: details.vital_rationale.message,
      action: details.vital_rationale.action,
      evidence: details.vital_rationale.evidence
    },
    {
      id: 'focused_exam',
      label: 'Focused exam selection',
      learner: workflow.focused_exam?.selected_systems?.length
        ? workflow.focused_exam.selected_systems.map((item) => item.name).join(', ')
        : 'No focused exam recorded',
      reference: workflow.focused_exam?.expected_systems?.length
        ? workflow.focused_exam.expected_systems.map((item) => item.name).join(', ')
        : 'General complaint-directed exam',
      score: `${details.focused_exam.score} / ${details.focused_exam.possible}`,
      feedback: details.focused_exam.message,
      action: details.focused_exam.action,
      evidence: [
        workflow.focused_exam?.matched_systems?.length ? `Matched: ${workflow.focused_exam.matched_systems.map((item) => item.name).join(', ')}` : 'Matched: None',
        workflow.focused_exam?.missed_systems?.length ? `Missed: ${workflow.focused_exam.missed_systems.map((item) => item.name).join(', ')}` : 'Missed: None',
        workflow.focused_exam?.extra_systems?.length ? `Extra: ${workflow.focused_exam.extra_systems.map((item) => item.name).join(', ')}` : 'Extra: None'
      ]
    },
    {
      id: 'final_esi',
      label: 'Final ESI',
      learner: session.triage_level ? `ESI ${session.triage_level}` : 'Not recorded',
      reference: `Reference ESI ${caseData.acuity}`,
      score: `${details.final_esi.score} / ${details.final_esi.possible}`,
      feedback: details.final_esi.message,
      action: details.final_esi.action,
      evidence: [
        `Resources used: ${caseData.resources_used}`,
        `Labs: ${caseData.lab_event_count}`,
        `Imaging/exam count: ${caseData.exam_count}`,
        `Procedure count: ${caseData.procedure_count}`
      ]
    },
    {
      id: 'diagnosis',
      label: 'Working diagnosis',
      learner: session.working_diagnosis || 'No working diagnosis recorded',
      reference: workflow.diagnosis?.reference?.primary?.join(', ') || 'Simulation diagnosis reference unavailable',
      score: `${details.diagnosis.score} / ${details.diagnosis.possible}`,
      feedback: details.diagnosis.message,
      action: details.diagnosis.action,
      evidence: [
        `Differential: ${(session.differential || []).join(', ') || 'None recorded'}`,
        `Evidence: ${session.diagnosis_evidence || 'No diagnosis evidence recorded'}`,
        `Reference status: ${workflow.diagnosis?.reference?.source_status || 'unknown'}`
      ]
    },
    {
      id: 'referral',
      label: 'Referral judgment',
      learner: session.referral_needed === null
        ? 'No referral decision recorded'
        : session.referral_needed
          ? `Referral requested: ${session.referral_specialty}`
          : 'No immediate specialty referral',
      reference: workflow.referral?.reference?.clinician_approved_specialty?.length
        ? workflow.referral.reference.clinician_approved_specialty.join(', ')
        : 'No clinician-approved specialty reference for this case',
      score: workflow.referral?.scored ? `${details.referral.score} / ${details.referral.possible}` : 'Unscored',
      feedback: details.referral.message,
      action: details.referral.action,
      evidence: [
        `Rationale: ${session.referral_rationale || 'No referral rationale recorded'}`,
        `Reference status: ${workflow.referral?.reference?.source_status || 'source_limited_unscored'}`
      ]
    },
    {
      id: 'escalation',
      label: 'Initial management priorities',
      learner: selectedEscalation.length ? selectedEscalation.map((item) => item.name).join(', ') : 'No immediate escalation',
      reference: workflow.escalation.expected.length ? workflow.escalation.expected.map((item) => item.name).join(', ') : 'No required escalation action from available fields',
      score: `${details.escalation.score} / ${details.escalation.possible}`,
      feedback: details.escalation.message,
      action: details.escalation.action,
      evidence: [
        ...escalationEvidence,
        session.initial_plan?.diagnostics ? `Diagnostics: ${session.initial_plan.diagnostics}` : '',
        session.initial_plan?.treatments ? `Treatments: ${session.initial_plan.treatments}` : '',
        session.initial_plan?.medications ? `Medications: ${session.initial_plan.medications}` : '',
        session.initial_plan?.disposition ? `Disposition intent: ${session.initial_plan.disposition}` : '',
        !escalationEvidence.length ? 'No immediate source-record, vital, or ESI signal required escalation.' : ''
      ].filter(Boolean)
    },
    {
      id: 'reassessment',
      label: 'Reassessment plan',
      learner: (session.reassessment_plan || []).length
        ? session.reassessment_plan.map((id) => reassessmentTargetLookup[id]?.label || id).join(', ')
        : 'No reassessment targets recorded',
      reference: workflow.reassessment?.expected?.length
        ? workflow.reassessment.expected.map((item) => item.label).join(', ')
        : 'No required reassessment target from available fields',
      score: `${details.reassessment.score} / ${details.reassessment.possible}`,
      feedback: details.reassessment.message,
      action: details.reassessment.action,
      evidence: reassessmentEvidence
    },
    {
      id: 'sbar',
      label: 'SBAR handoff',
      learner: session.sbar_handoff || 'No handoff recorded',
      reference: 'Case-grounded situation, background, assessment, recommendation',
      score: `${details.sbar.score} / ${details.sbar.possible}`,
      feedback: workflow.sbar.message,
      action: workflow.sbar.gaps?.length
        ? `Strengthen SBAR content: ${workflow.sbar.gaps.slice(0, 3).join('; ')}.`
        : workflow.sbar.missing.length
          ? `Add the missing SBAR element${workflow.sbar.missing.length > 1 ? 's' : ''}: ${workflow.sbar.missing.join(', ')}.`
        : 'The handoff included the expected SBAR structure.',
      evidence: [
        `Weak sections: ${workflow.sbar.missing.join(', ') || 'None'}`,
        `Rubric gaps: ${workflow.sbar.gaps?.slice(0, 4).join('; ') || 'None'}`
      ]
    }
  ].map((item) => ({ ...item, evidence: evidenceText(item.evidence) }));
}

function generateScorecard(session, caseData, workflow) {
  const finalEsi = esiAccuracyScore(session.triage_level, caseData.acuity, 30, 'Final ESI');
  const vitalRationale = vitalRationaleScoreDetails(session, caseData);
  const interview = interviewScoreDetails(workflow);
  const focusedExam = focusedExamScoreDetails(workflow);
  const diagnosis = diagnosisScoreDetails(workflow);
  const referral = referralScoreDetails(workflow);
  const escalation = escalationScoreDetails(workflow);
  const reassessment = reassessmentScoreDetails(workflow);
  const sbarScore = Math.round((workflow.sbar.score / Math.max(workflow.sbar.possible, 1)) * 10);
  const sbar = {
    score: sbarScore,
    possible: 10,
    message: workflow.sbar.message
  };

  const domains = [
    domain('esi', 'Final ESI accuracy', finalEsi.score, 30, finalEsi.message),
    domain('safety', 'Objective safety reasoning', vitalRationale.score, 15, vitalRationale.message),
    domain('interview', 'Interview coverage', interview.score, 15, interview.message),
    domain('focused_exam', 'Focused exam selection', focusedExam.score, focusedExam.possible, focusedExam.message),
    domain('diagnosis', 'Working diagnosis', diagnosis.score, diagnosis.possible, diagnosis.message),
    ...(referral.possible > 0 ? [domain('referral', 'Referral judgment', referral.score, referral.possible, referral.message)] : []),
    domain('escalation', 'Initial management priorities', escalation.score, 20, escalation.message),
    domain('reassessment', 'Reassessment targets', reassessment.score, 10, reassessment.message),
    domain('sbar', 'SBAR handoff', sbarScore, 10, workflow.sbar.message)
  ];
  const total = domains.reduce((sum, item) => sum + item.score, 0);
  const possible = domains.reduce((sum, item) => sum + item.possible, 0);
  const details = {
    final_esi: finalEsi,
    vital_rationale: vitalRationale,
    interview,
    focused_exam: focusedExam,
    diagnosis,
    referral,
    escalation,
    reassessment,
    sbar
  };
  return {
    total,
    possible,
    percentage: Math.round((total / possible) * 100),
    domains,
    details,
    method: 'Deterministic score from source fields, ESI-derived priorities, vital-sign thresholds, selected focused exam systems, diagnosis/referral references when available, reassessment targets, and structured learner actions.'
  };
}

function caseEvidence(caseData, actions) {
  const resources = [
    ['Resources used', caseData.resources_used],
    ['Lab events', caseData.lab_event_count],
    ['Microbiology events', caseData.microbio_event_count],
    ['Imaging or exam count', caseData.exam_count],
    ['Procedure count', caseData.procedure_count],
    ['Consult count', caseData.consults_count]
  ].filter(([, value]) => value).map(([label, value]) => ({ label, value }));
  const outcomes = [];
  if (caseData.disposition && caseData.disposition !== 'Unknown') outcomes.push({ label: 'Disposition', value: caseData.disposition });
  if (caseData.transfer_to_icu_in_1h) outcomes.push({ label: 'ICU transfer', value: 'Within 1 hour' });
  else if (caseData.transfer_to_icu_beyond_1h) outcomes.push({ label: 'ICU transfer', value: 'After 1 hour' });
  if (caseData.transfusion_within_1h) outcomes.push({ label: 'Transfusion', value: 'Within 1 hour' });
  else if (caseData.transfusion_beyond_1h) outcomes.push({ label: 'Transfusion', value: 'After 1 hour' });
  if (caseData.red_cell_order_more_than_1) outcomes.push({ label: 'Blood product order', value: 'More than 1 red-cell unit' });
  return {
    vital_flags: vitalFlags(caseData),
    resources,
    recorded_actions: actions,
    outcomes,
    documented_evidence: (caseData.documented_evidence || []).map((item) => ({
      label: item.domain,
      value: item.statement
    })),
    inferred_evidence: reviewedInferredFacts(caseData).map((fact) => ({
      label: fact.domain,
      value: fact.statement,
      rationale: fact.rationale,
      use_in: fact.use_in || []
    }))
  };
}

function reasoningRubrics() {
  return clone(REASONING_RUBRICS);
}

function rubricPossible(id) {
  return REASONING_RUBRICS.find((item) => item.id === id)?.possible || 0;
}

function learnerReasoningSubmissions(completed) {
  const summary = completed.feedback?.session_summary || {};
  return {
    provisional_esi_rationale: {
      selected_esi: summary.provisional_triage_level,
      text: summary.provisional_triage_rationale || ''
    },
    final_esi_rationale: {
      selected_esi: summary.triage_level_assigned,
      text: summary.triage_rationale || ''
    },
    escalation_rationale: {
      selected_actions: (summary.escalation_actions || []).map((item) => item.name),
      text: summary.escalation_rationale || ''
    },
    sbar_handoff: {
      text: summary.sbar_handoff || ''
    }
  };
}

function conciseCaseForReasoningReview(completed) {
  const caseData = completed.case;
  const feedback = completed.feedback;
  return {
    case_id: caseData.id,
    demographics: {
      age: Math.round(caseData.demographics.age),
      sex: caseData.demographics.sex,
      transport: caseData.demographics.transport
    },
    chief_complaint: caseData.complaint,
    history: truncateText(caseData.history, 1200),
    reference_esi: caseData.acuity,
    vitals: formatVitals(caseData),
    abnormal_vitals: vitalFlags(caseData),
    resources: feedback.case_evidence?.resources || [],
    recorded_interventions: (feedback.case_evidence?.recorded_actions || []).map((item) => item.name),
    outcome_signals: feedback.case_evidence?.outcomes || [],
    deterministic_scores: (feedback.scorecard?.domains || []).map((item) => ({
      label: item.label,
      score: item.score,
      possible: item.possible,
      message: item.message
    })),
    escalation_reference: {
      expected: feedback.workflow_analysis?.escalation?.expected?.map((item) => ({
        name: item.name,
        evidence: item.evidence
      })) || [],
      matched: feedback.workflow_analysis?.escalation?.matched?.map((item) => item.name) || [],
      missed: feedback.workflow_analysis?.escalation?.missed?.map((item) => item.name) || [],
      extra: feedback.workflow_analysis?.escalation?.extra?.map((item) => item.name) || []
    },
    interview_reference: {
      covered: feedback.workflow_analysis?.interview?.covered_domains || [],
      missed: feedback.workflow_analysis?.interview?.missed_domains || []
    },
    sbar_rule_check: feedback.workflow_analysis?.sbar || null
  };
}

function extractJsonObject(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('Reasoning review returned an empty response.');
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const objectText = firstBalancedJsonObject(candidate);
    if (objectText) return JSON.parse(objectText);
    throw new Error('Reasoning review could not be parsed.');
  }
}

function firstBalancedJsonObject(text) {
  const start = text.indexOf('{');
  if (start < 0) return '';

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;

    if (depth === 0) return text.slice(start, index + 1);
  }

  return '';
}

function cleanText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function cleanTextList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 4);
}

function normalizeReasoningReview(raw, model) {
  const sectionsInput = Array.isArray(raw.sections) ? raw.sections : [];
  const sectionsById = Object.fromEntries(sectionsInput.map((item) => [item.id, item]));
  const sections = REASONING_RUBRICS.map((rubric) => {
    const input = sectionsById[rubric.id] || {};
    const possible = rubric.possible;
    const score = Math.max(0, Math.min(possible, parseFloat(input.score) || 0));
    const percentage = possible ? Math.round((score / possible) * 100) : 0;
    return {
      id: rubric.id,
      label: rubric.label,
      score,
      possible,
      percentage,
      level: cleanText(input.level, percentage >= 85 ? 'strong' : percentage >= 65 ? 'developing' : 'needs review'),
      feedback: cleanText(input.feedback, 'No narrative feedback returned.'),
      strengths: cleanTextList(input.strengths),
      improvements: cleanTextList(input.improvements),
      evidence: cleanTextList(input.evidence)
    };
  });
  const total = sections.reduce((sum, item) => sum + item.score, 0);
  const possible = sections.reduce((sum, item) => sum + item.possible, 0);
  return {
    source: 'OpenRouter',
    model,
    cached: false,
    rubric_version: REASONING_REVIEW_VERSION,
    overall: {
      score: total,
      possible,
      percentage: possible ? Math.round((total / possible) * 100) : 0,
      summary: cleanText(raw.overall?.summary, 'Reasoning review completed.'),
      priority: cleanText(raw.overall?.priority, 'Use case evidence explicitly in each free-text response.')
    },
    sections,
    clinical_reasoning_feedback: cleanTextList(raw.clinical_reasoning_feedback),
    safety_flags: cleanTextList(raw.safety_flags)
  };
}

function localCriterionMatched(rubricId, criterionLabel, text, completed) {
  const lower = String(text || '').toLowerCase();
  const feedback = completed.feedback || {};
  const workflow = feedback.workflow_analysis || {};

  if (!lower.trim()) return false;

  if (rubricId === 'provisional_esi_rationale') {
    if (criterionLabel === 'Early acuity estimate') {
      return hasAny(lower, ['esi', 'acuity', 'level', 'stable', 'urgent', 'emergent', 'resuscitation', 'room']);
    }
    if (criterionLabel === 'Risk framing') {
      return hasAny(lower, ['risk', 'red flag', 'distress', 'unstable', 'stable', 'breath', 'chest', 'bleed', 'weak', 'confus', 'severe']);
    }
    if (criterionLabel === 'Reassessment plan') {
      return hasAny(lower, ['vital', 'reassess', 'monitor', 'review', 'change', 'worse', 'objective', 'update']);
    }
  }

  if (rubricId === 'final_esi_rationale') {
    if (criterionLabel === 'ESI logic') {
      return hasAny(lower, ['esi', 'acuity', 'high risk', 'emergent', 'urgent', 'resource', 'stable', 'unstable']);
    }
    if (criterionLabel === 'Objective signals') {
      return hasAny(lower, ['vital', 'heart', 'hr', 'bp', 'oxygen', 'spo2', 'sat', 'respiratory', 'temp', 'pain', 'distress']);
    }
    if (criterionLabel === 'Resource reasoning') {
      return hasAny(lower, ['resource', 'lab', 'imaging', 'xray', 'ct', 'iv', 'med', 'procedure', 'monitor', 'consult']);
    }
    if (criterionLabel === 'Safety prioritization') {
      return hasAny(lower, ['safety', 'room', 'monitor', 'immediate', 'resus', 'wait', 'notify', 'risk']);
    }
    if (criterionLabel === 'Concise synthesis') {
      return lower.length >= 35 && lower.length <= 700;
    }
  }

  if (rubricId === 'escalation_rationale') {
    const noEscalationExpected = !(workflow.escalation?.expected || []).length;
    const noEscalationLanguage = hasAny(lower, ['none needed', 'no escalation', 'no immediate', 'routine', 'stable', 'no action', 'not needed']);
    if (criterionLabel === 'Action-evidence match') {
      if (noEscalationExpected && noEscalationLanguage) return true;
      return hasAny(lower, ['because', 'due to', 'vital', 'esi', 'risk', 'pain', 'resource', 'history', 'symptom']) ||
        workflow.escalation?.matched?.length > 0;
    }
    if (criterionLabel === 'Immediate safety needs') {
      if (noEscalationExpected && noEscalationLanguage) return true;
      return hasAny(lower, ['room', 'bed', 'monitor', 'airway', 'oxygen', 'iv', 'clinician', 'evaluate', 'pain', 'safety', 'resus']);
    }
    if (criterionLabel === 'Avoids unsupported escalation') {
      return (workflow.escalation?.extra || []).length === 0;
    }
    if (criterionLabel === 'Operational clarity') {
      if (noEscalationExpected && noEscalationLanguage) return true;
      return hasAny(lower, ['place', 'notify', 'monitor', 'start', 'prepare', 'request', 'evaluate', 'reassess', 'routine']);
    }
  }

  if (rubricId === 'sbar_handoff') {
    const sbar = workflow.sbar || {};
    const sectionScore = (key) => sbar.section_scores?.[key]?.score || 0;
    if (criterionLabel === 'Situation') return sectionScore('situation') >= 3;
    if (criterionLabel === 'Background') return sectionScore('background') >= 3;
    if (criterionLabel === 'Assessment') return sectionScore('assessment') >= 3;
    if (criterionLabel === 'Recommendation') return sectionScore('recommendation') >= 3;
    if (criterionLabel === 'Concise handoff structure') return lower.length >= 45 && lower.length <= 900 && (sbar.missing || []).length <= 1 && (sbar.score || 0) >= 14;
  }

  return false;
}

function localReasoningEvidence(completed, rubricId) {
  const feedback = completed.feedback || {};
  const caseData = completed.case || {};
  const evidence = [];

  if (rubricId.includes('esi')) {
    evidence.push(`Reference ESI ${caseData.acuity}`);
    const vitals = feedback.case_evidence?.vital_flags || [];
    if (vitals.length) evidence.push(vitals.slice(0, 2).map((item) => `${item.name}: ${item.value}`).join('; '));
    const resources = feedback.case_evidence?.resources || [];
    if (resources.length) evidence.push(resources.slice(0, 2).map((item) => `${item.label}: ${item.value}`).join('; '));
  }

  if (rubricId === 'escalation_rationale') {
    const escalation = feedback.workflow_analysis?.escalation || {};
    if (escalation.expected?.length) evidence.push(`Expected: ${escalation.expected.slice(0, 2).map((item) => item.name).join(', ')}`);
    if (escalation.missed?.length) evidence.push(`Missed: ${escalation.missed.slice(0, 2).map((item) => item.name).join(', ')}`);
    if (escalation.extra?.length) evidence.push(`Unsupported: ${escalation.extra.slice(0, 2).map((item) => item.name).join(', ')}`);
  }

  if (rubricId === 'sbar_handoff') {
    const sbar = feedback.workflow_analysis?.sbar || {};
    evidence.push(`SBAR rule score ${sbar.score || 0} / ${sbar.possible || 20}`);
    if (sbar.missing?.length) evidence.push(`Missing: ${sbar.missing.join(', ')}`);
    if (sbar.gaps?.length) evidence.push(`Gaps: ${sbar.gaps.slice(0, 2).join('; ')}`);
  }

  return evidence.filter(Boolean).slice(0, 4);
}

function escapeRegExp(text) {
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function rationaleContradictsComplaint(text, caseData) {
  const lower = String(text || '').toLowerCase();
  const complaint = plainComplaint(caseData?.complaint || '');
  if (!complaint.trim()) return false;
  const deniesComplaint = /\b(no|none|without)\s+(chief\s+)?(complaint|presenting\s+complaint|concern|symptom|symptoms)\b/.test(lower);
  return deniesComplaint && !new RegExp(escapeRegExp(complaint.toLowerCase()), 'i').test(lower);
}

function localSectionFeedback(rubric, matched, unmatched, text) {
  if (!String(text || '').trim()) return `${rubric.label} was not submitted.`;
  if (!unmatched.length) return `${rubric.label} addressed the rubric elements with enough case-specific detail for deterministic credit.`;
  if (matched.length) return `${rubric.label} included ${matched.slice(0, 2).join(', ')}; add ${unmatched.slice(0, 2).join(', ')} for a stronger explanation.`;
  return `${rubric.label} needs more explicit case evidence and a clearer link to the triage decision.`;
}

function writtenRationaleFeedback(rubric, matched, unmatched, text, completed) {
  const baseFeedback = localSectionFeedback(rubric, matched, unmatched, text);
  if (rubric.id === 'provisional_esi_rationale' && !String(text || '').trim()) {
    const selected = completed?.feedback?.session_summary?.provisional_triage_level ||
      completed?.feedback?.workflow_analysis?.provisional_esi?.selected;
    if (selected) {
      return `Provisional ESI selection was recorded as ESI ${selected}; written provisional rationale was not submitted.`;
    }
  }
  if (rubric.id === 'final_esi_rationale' && rationaleContradictsComplaint(text, completed?.case)) {
    return `${baseFeedback} The rationale contradicts the documented complaint. State the actual complaint, objective stability, and expected resources.`;
  }
  return baseFeedback;
}

function buildLocalReasoningReview(completed) {
  const submissions = learnerReasoningSubmissions(completed);
  const sections = REASONING_RUBRICS.map((rubric) => {
    const text = submissions[rubric.id]?.text || '';
    const matched = [];
    const unmatched = [];
    let score = 0;

    rubric.criteria.forEach((criterion) => {
      if (localCriterionMatched(rubric.id, criterion.label, text, completed)) {
        score += criterion.points;
        matched.push(criterion.label);
      } else {
        unmatched.push(criterion.label);
      }
    });

    const percentage = rubric.possible ? Math.round((score / rubric.possible) * 100) : 0;
    return {
      id: rubric.id,
      label: rubric.label,
      score,
      possible: rubric.possible,
      percentage,
      level: percentage >= 85 ? 'strong' : percentage >= 65 ? 'developing' : 'needs review',
      feedback: writtenRationaleFeedback(rubric, matched, unmatched, text, completed),
      strengths: matched.length ? matched.slice(0, 3).map((item) => `Addresses ${item.toLowerCase()}.`) : [],
      improvements: unmatched.length ? unmatched.slice(0, 3).map((item) => `Add ${item.toLowerCase()} with case-specific evidence.`) : [],
      evidence: localReasoningEvidence(completed, rubric.id)
    };
  });

  const total = sections.reduce((sum, item) => sum + item.score, 0);
  const possible = sections.reduce((sum, item) => sum + item.possible, 0);
  const lowSections = sections.filter((item) => item.percentage < 65);
  const priority = lowSections[0]
    ? `Strengthen ${lowSections[0].label.toLowerCase()} with explicit case evidence.`
    : 'Maintain the same evidence-to-action structure across future cases.';
  const safetyFlags = [];
  const comparison = completed.feedback?.triage_analysis?.comparison;
  if (comparison === 'Under-triaged') safetyFlags.push('Final ESI was lower acuity than the reference level.');
  if (completed.feedback?.workflow_analysis?.escalation?.missed?.length) safetyFlags.push('One or more expected escalation actions were missed.');

  return {
    source: 'Local rubric review',
    model: 'deterministic browser rules',
    cached: false,
    rubric_version: REASONING_REVIEW_VERSION,
    overall: {
      score: total,
      possible,
      percentage: possible ? Math.round((total / possible) * 100) : 0,
      summary: lowSections.length
        ? 'Local rubric scoring found reasoning elements that need more case-specific support.'
        : 'Local rubric scoring found the major reasoning elements present.',
      priority
    },
    sections,
    clinical_reasoning_feedback: (completed.feedback?.priority_feedback || [])
      .slice(0, 3)
      .map((item) => `${item.title}: ${item.action}`),
    safety_flags: safetyFlags
  };
}

function buildReasoningReviewMessages(completed) {
  return buildReasoningReviewMessagesWithCoverage(completed, []);
}

function buildReasoningReviewMessagesWithCoverage(completed, localCoverage = []) {
  return [
    {
      role: 'system',
      content: [
        'You are an emergency medicine educator grading an ED triage simulation.',
        'Grade only the learner free-text reasoning against the supplied rubric and case evidence.',
        'Use only supplied case facts, deterministic debrief fields, and rubric criteria.',
        'Do not invent diagnoses, tests, procedures, protocols, or hidden chart details.',
        'Return strict JSON only. No Markdown, no preface, no prose outside JSON.',
        'Feedback should be concise, clinically specific, and suitable for a medical student.'
      ].join(' ')
    },
    {
      role: 'user',
      content: JSON.stringify({
        expected_json_schema: {
          overall: {
            summary: 'one sentence',
            priority: 'one high-yield next step'
          },
          sections: [
            {
              id: 'one of provisional_esi_rationale, final_esi_rationale, escalation_rationale, sbar_handoff',
              score: 'number, clamped to section possible points',
              level: 'strong, developing, or needs review',
              feedback: 'one to two sentences',
              strengths: ['short bullet'],
              improvements: ['short bullet'],
              evidence: ['case evidence phrase used to support the critique']
            }
          ],
          clinical_reasoning_feedback: ['two or three global bullets'],
          safety_flags: ['major safety concerns if present, otherwise empty array']
        },
        rubrics: reasoningRubrics(),
        section_possible_points: Object.fromEntries(REASONING_RUBRICS.map((item) => [item.id, rubricPossible(item.id)])),
        local_embedding_rubric_matches: localCoverage,
        case_evidence: conciseCaseForReasoningReview(completed),
        learner_submissions: learnerReasoningSubmissions(completed)
      })
    }
  ];
}

async function localRubricConceptMatches(completed) {
  const submissions = learnerReasoningSubmissions(completed);
  const results = [];

  for (const rubric of REASONING_RUBRICS) {
    const submissionText = submissions[rubric.id]?.text || '';
    if (!submissionText.trim()) {
      results.push({
        section_id: rubric.id,
        section_label: rubric.label,
        matched_criteria: [],
        unmatched_criteria: rubric.criteria.map((criterion) => criterion.label)
      });
      continue;
    }

    const matched = [];
    const unmatched = [];

    for (const criterion of rubric.criteria) {
      try {
        const match = await findSemanticMatch({
          namespace: `rubric_concept:${rubric.id}`,
          queryText: `${criterion.label}. ${criterion.description}`,
          candidates: [{ id: rubric.id, text: submissionText }],
          threshold: 0.28,
          candidateText: (item) => item.text,
          candidateId: (item) => item.id
        });

        if (match) {
          matched.push({
            criterion: criterion.label,
            points: criterion.points,
            semantic_score: Number(match.score.toFixed(3))
          });
        } else {
          unmatched.push(criterion.label);
        }
      } catch {
        unmatched.push(criterion.label);
      }
    }

    results.push({
      section_id: rubric.id,
      section_label: rubric.label,
      matched_criteria: matched,
      unmatched_criteria: unmatched
    });
  }

  return results;
}

function rationaleFeedback(session, caseData) {
  const rationale = String(session.triage_rationale || '').trim();
  if (!rationale) return 'Document a one- to two-sentence ESI rationale so clinical reasoning can be evaluated.';
  if (rationaleContradictsComplaint(rationale, caseData)) {
    return `The rationale contradicts the documented complaint: ${presentingProblemText(caseData).toLowerCase()}. State the actual complaint, objective stability, and expected ED resources.`;
  }
  const lower = rationale.toLowerCase();
  const signals = [];
  if (String(caseData.acuity).includes(lower) || lower.includes('esi')) signals.push('acuity level');
  if (['vital', 'bp', 'heart', 'oxygen', 'sat', 'pain', 'temperature', 'respiratory'].some((term) => lower.includes(term))) signals.push('vital signs');
  if (['resource', 'lab', 'imaging', 'iv', 'med', 'procedure'].some((term) => lower.includes(term))) signals.push('resource needs');
  if (['risk', 'danger', 'unstable', 'distress', 'severe'].some((term) => lower.includes(term))) signals.push('risk language');
  if (signals.length >= 2) return `Your rationale included ${signals.join(', ')}. Strong ESI rationales connect complaint risk, vital signs, and expected resources.`;
  return 'The rationale should more clearly connect the complaint, vital signs, and expected ED resources.';
}

function priorityFeedback(session, caseData, workflow, scorecard) {
  const items = [];
  if (session.triage_level > caseData.acuity) {
    items.push({
      title: 'Acuity was lower than the reference level',
      evidence: `Assigned ESI ${session.triage_level}; reference ESI ${caseData.acuity}.`,
      action: 'Reconcile high-risk symptoms, abnormal vitals, and expected resources before final ESI.'
    });
  } else if (session.triage_level < caseData.acuity) {
    items.push({
      title: 'Acuity was higher than the reference level',
      evidence: `Assigned ESI ${session.triage_level}; reference ESI ${caseData.acuity}.`,
      action: 'Identify which immediate danger signals or resource needs were absent.'
    });
  } else {
    items.push({
      title: 'Acuity matched the reference level',
      evidence: `Assigned ESI ${session.triage_level}; reference ESI ${caseData.acuity}.`,
      action: 'Use the same structure on the next case: risk, vitals, and resources.'
    });
  }
  if (workflow.escalation.missed.length) {
    items.push({
      title: 'Escalation priority gap',
      evidence: workflow.escalation.missed.slice(0, 2).map((item) => item.name).join(', '),
      action: 'Match escalation actions to immediate safety, placement, bleeding, respiratory, behavioral, or severe-pain signals.'
    });
  }
  if (workflow.interview.missed_domains.length) {
    items.push({
      title: 'Focused interview gap',
      evidence: workflow.interview.missed_domains.join(', '),
      action: 'Ask questions that change acuity, risk, or immediate escalation decisions.'
    });
  }
  if (items.length < 3 && workflow.sbar.missing.length) {
    items.push({
      title: 'Handoff structure gap',
      evidence: workflow.sbar.missing.join(', '),
      action: 'State situation, background, assessment, and recommendation in one concise handoff.'
    });
  }
  if (items.length < 3) {
    const strongest = [...scorecard.domains].sort((a, b) => b.percentage - a.percentage)[0];
    if (strongest) {
      items.push({
        title: 'Strongest domain',
        evidence: `${strongest.label}: ${strongest.score} / ${strongest.possible}`,
        action: strongest.message
      });
    }
  }
  return items.slice(0, 3);
}

function learnerAcuityAction(session, caseData) {
  if (!session.triage_level) return 'Final ESI was not recorded.';
  if (session.triage_level > caseData.acuity) {
    return `Assigned ESI ${session.triage_level}, which placed the patient below the reference acuity.`;
  }
  if (session.triage_level < caseData.acuity) {
    return `Assigned ESI ${session.triage_level}, which placed the patient above the reference acuity.`;
  }
  return `Assigned ESI ${session.triage_level}, matching the reference acuity.`;
}

function expectedActionNames(workflow, limit = 3) {
  return uniqueSentences((workflow?.escalation?.expected || [])
    .map((item) => item.name)
    .filter(Boolean))
    .slice(0, limit);
}

function selectedActionNames(session, limit = 3) {
  return uniqueSentences((session.escalation_actions || [])
    .map((item) => item.name || actionLookup[item.id]?.name)
    .filter(Boolean))
    .slice(0, limit);
}

function referenceActionText(caseData, workflow) {
  const actionNames = expectedActionNames(workflow);
  if (actionNames.length) return `${joinClinicalList(actionNames)}.`;
  if (caseData.acuity <= 2) return 'Assign ESI 2 or higher acuity placement with immediate clinician evaluation.';
  if (caseData.acuity === 3) return 'Assign ESI 3 and anticipate multiple ED resources.';
  if (caseData.acuity === 4) return 'Assign ESI 4 when one counted ED resource is expected beyond history, examination, and simple bedside care.';
  if (caseData.acuity === 5) return 'Assign ESI 5 only when no counted ED resources are expected beyond history, examination, and simple bedside care.';
  return `Assign ESI ${caseData.acuity} with focused evaluation and reassessment if symptoms change.`;
}

function actionBehavior(action, caseData) {
  const problem = presentingProblemText(caseData);
  switch (action?.id) {
    case 'immediate_bedside_evaluation':
      return `Escalate ${problem} for immediate clinician evaluation before routine waiting.`;
    case 'resuscitation_bay':
      return `Move ${problem} with airway, breathing, circulation, or neurologic risk to resuscitation placement.`;
    case 'monitored_bed':
      return `Place ${problem} in monitored care when ESI, vitals, or outcome signals require close observation.`;
    case 'airway_oxygenation_support':
      return `Assess airway, work of breathing, oxygenation, and respiratory support needs in ${problem}.`;
    case 'vascular_access':
      return `Prioritize IV access and bloodwork when ${problem} is paired with resource or circulation risk.`;
    case 'medication_route_priority':
      return `Choose medication route based on acuity, vomiting, respiratory symptoms, pain, or expected ED treatment.`;
    case 'bleeding_transfusion_readiness':
      return `Screen for bleeding, shock, transfusion need, and vascular access when circulation risk is present.`;
    case 'critical_procedure_team':
      return `Prepare the procedural or specialty team when the case signals immediate stabilization needs.`;
    case 'behavioral_safety':
      return `Start behavioral safety precautions when mental status, agitation, or self-harm risk is documented.`;
    case 'pain_reassessment':
      return `Treat severe pain as an ED resource and reassess response after intervention.`;
    default:
      return `Match the next action to the documented findings in ${problem}.`;
  }
}

function painFindingLabel(caseData) {
  const pain = Number(caseData.vitals?.pain);
  if (!Number.isFinite(pain)) return 'Pain level';
  if (pain >= 8) return `Severe pain ${formatVitalNumber(pain)}/10`;
  if (pain >= 5) return `Moderate pain ${formatVitalNumber(pain)}/10`;
  return `Pain ${formatVitalNumber(pain)}/10`;
}

function clinicalReviewKey({ key, actionId, finding, findingType }) {
  if (key) return key;
  if (actionId === 'pain_reassessment') return 'pain_reassessment';
  const source = lowerClinicalText(`${findingType || ''} ${finding || ''}`);
  if (/\bpain\b/.test(source)) return 'pain_reassessment';
  if (/\boxygen|breath|respiratory|dyspnea|shortness\b/.test(source)) return actionId || 'airway_breathing';
  if (/\bblood pressure|heart rate|bleed|transfusion|shock|circulation\b/.test(source)) return actionId || 'circulation';
  if (/\bmental|confus|neurolog|weak|numb|head injury\b/.test(source)) return actionId || 'neurologic';
  if (/\btemperature|fever\b/.test(source)) return actionId || 'temperature';
  if (actionId) return actionId;
  return source.replace(/\d+(\.\d+)?/g, '').slice(0, 90);
}

function priorityForClinicalFinding({ key, actionId, findingType, finding_type, session, caseData, flag }) {
  const type = findingType || finding_type;
  if (key === 'esi_decision' && session.triage_level !== caseData.acuity) return 100;
  if (['resuscitation_bay', 'immediate_bedside_evaluation'].includes(actionId)) return 90;
  if (['airway_oxygenation_support', 'bleeding_transfusion_readiness', 'behavioral_safety'].includes(actionId)) return 84;
  if (['monitored_bed', 'critical_procedure_team'].includes(actionId)) return 78;
  if (flag?.severity === 'critical') return flag.name === 'Pain Level' ? 66 : 74;
  if (key === 'pain_reassessment' || actionId === 'pain_reassessment') return 62;
  if (['vascular_access', 'medication_route_priority'].includes(actionId)) return 58;
  if (type === 'Interview gap') return 44;
  return 50;
}

function actionFindingLabel(action, caseData, evidence) {
  if (action?.id === 'pain_reassessment') return painFindingLabel(caseData);
  if (action?.id === 'airway_oxygenation_support') return `Breathing concern: ${capitalizeSentence(presentingProblemText(caseData))}`;
  if (action?.id === 'bleeding_transfusion_readiness') return `Bleeding or transfusion risk: ${capitalizeSentence(presentingProblemText(caseData))}`;
  if (action?.id === 'monitored_bed' && /reference esi/i.test(evidence || '')) return `${capitalizeSentence(presentingProblemText(caseData))}: reference ESI ${caseData.acuity}`;
  return capitalizeSentence(evidence || action?.name || presentingProblemText(caseData));
}

function mergeClinicalText(current, next) {
  const parts = [];
  for (const value of [current, next]) {
    const cleaned = String(value || '').replace(/\s+/g, ' ').trim();
    if (cleaned && !parts.some((item) => lowerClinicalText(item) === lowerClinicalText(cleaned))) {
      parts.push(cleaned);
    }
  }
  return parts.join(' ');
}

function buildClinicalDecisionReview(session, caseData, workflow, soapNote, esiExplanation = null) {
  const entries = new Map();
  const problem = capitalizeSentence(presentingProblemText(caseData));
  const referenceAction = referenceActionText(caseData, workflow);
  const learnerAction = learnerAcuityAction(session, caseData);
  const selectedNames = selectedActionNames(session);
  const expectedNames = expectedActionNames(workflow);
  const vitalFlagsList = vitalFlags(caseData);
  const resourceText = resourceSummaryText(caseData);
  const lowAcuityProfile = lowAcuityTeachingProfile(caseData);

  const upsert = (item) => {
    const key = clinicalReviewKey(item);
    const priority = item.priority ?? priorityForClinicalFinding({ ...item, key, session, caseData });
    const existing = entries.get(key);
    const normalized = {
      finding: item.finding,
      finding_type: item.finding_type || 'Clinical signal',
      why_it_matters: item.why_it_matters,
      expected_action: item.expected_action,
      learner_gap: item.learner_gap,
      practice_rule: item.practice_rule,
      priority,
      sort_priority: priority
    };
    if (!existing) {
      entries.set(key, normalized);
      return;
    }
    entries.set(key, {
      ...existing,
      finding: existing.finding || normalized.finding,
      finding_type: existing.finding_type || normalized.finding_type,
      why_it_matters: mergeClinicalText(existing.why_it_matters, normalized.why_it_matters),
      expected_action: mergeClinicalText(existing.expected_action, normalized.expected_action),
      learner_gap: mergeClinicalText(existing.learner_gap, normalized.learner_gap),
      practice_rule: mergeClinicalText(existing.practice_rule, normalized.practice_rule),
      priority: Math.max(existing.priority || 0, normalized.priority || 0),
      sort_priority: Math.max(existing.sort_priority || 0, normalized.sort_priority || 0)
    });
  };

  upsert({
    key: 'esi_decision',
    finding_type: 'Acuity anchor',
    finding: `${problem}: ESI ${session.triage_level || 'not recorded'} compared with Reference ESI ${caseData.acuity}`,
    why_it_matters: session.triage_level !== caseData.acuity
      ? (esiExplanation?.why_reference_right || `Reference ESI ${caseData.acuity} reflects the documented complaint, ${vitalSummaryText(caseData).toLowerCase()}, and ${resourceText.toLowerCase()}.`)
      : (esiExplanation?.summary || `Reference ESI ${caseData.acuity} is supported by the complaint, vital signs, and expected ED resources.`),
    learner_gap: lowAcuityProfile && session.triage_level === caseData.acuity
      ? 'Learner ESI matched the reference level; the written rationale should identify what makes routine care safe.'
      : esiExplanation?.why_learner_wrong || learnerAction,
    expected_action: lowAcuityProfile && session.triage_level === caseData.acuity
      ? lowAcuityProfile.verification_focus
      : esiExplanation?.rule_lines?.join(' ') || esiExplanation?.resource_rule || referenceAction,
    practice_rule: session.triage_level !== caseData.acuity
      ? (caseData.acuity <= 2
        ? `Escalate ESI ${caseData.acuity} presentations before final disposition decisions.`
        : `Use expected ED resources to separate ESI 5 from ESI 4 and ESI 3.`)
      : lowAcuityProfile
        ? `Document why ESI ${caseData.acuity} fits: stable vitals, no danger signal, no pain or distress, and no counted ED resources expected.`
        : `State why ${problem.toLowerCase()} fits ESI ${caseData.acuity} using risk, vitals, and resources.`
  });

  if (lowAcuityProfile) {
    upsert({
      key: `${lowAcuityProfile.id}_verification`,
      finding_type: 'Low-acuity verification',
      finding: `Routine care is appropriate after ${lowAcuityProfile.problem} screening`,
      why_it_matters: lowAcuityProfile.routine_care_reason,
      learner_gap: 'Correct ESI selection still needs a short explanation of what was ruled out and what needs verification.',
      expected_action: lowAcuityProfile.verification_focus,
      practice_rule: lowAcuityProfile.checklist[0],
      priority: 72
    });
  }

  for (const fact of reviewedInferredFacts(caseData, 'decision_review').slice(0, 4)) {
    upsert({
      key: fact.action_id || fact.id,
      actionId: fact.action_id,
      finding_type: fact.domain === 'physical_exam' ? 'Focused exam' : 'Reviewed inference',
      finding: fact.statement,
      why_it_matters: fact.rationale,
      learner_gap: fact.expected_action
        ? `The learner should explicitly connect this finding to: ${fact.expected_action}`
        : 'The learner did not explicitly connect this reviewed finding to the triage decision.',
      expected_action: fact.expected_action || referenceAction,
      practice_rule: fact.practice_rule || `Use the reviewed ${String(fact.domain || 'case')} finding to decide acuity, resources, and reassessment.`,
      priority: (fact.use_in || []).includes('grading_reference') ? 82 : 64
    });
  }

  for (const action of (workflow?.escalation?.missed || []).slice(0, 5)) {
    const evidence = action.evidence?.length
      ? joinClinicalList(action.evidence.slice(0, 3))
      : action.description || resourceText;
    upsert({
      actionId: action.id,
      finding_type: action.category || 'Escalation priority',
      finding: actionFindingLabel(action, caseData, evidence),
      why_it_matters: `${action.name} is expected because the case contains ${String(evidence).toLowerCase()}.`,
      learner_gap: selectedNames.length
        ? `Selected ${joinClinicalList(selectedNames)}; did not select ${action.name}.`
        : `No matching escalation action was selected for ${action.name}.`,
      expected_action: action.name,
      practice_rule: actionBehavior(action, caseData)
    });
  }

  for (const flag of vitalFlagsList.slice(0, 4)) {
    upsert({
      finding_type: flag.name === 'Pain Level' ? 'Pain and distress' : 'Vital sign',
      finding: flag.name === 'Pain Level' ? painFindingLabel(caseData) : `${flag.name} ${flag.value}`,
      why_it_matters: `${flag.reason} changes the safety screen for ${presentingProblemText(caseData)}.`,
      learner_gap: selectedNames.length ? `Selected ${joinClinicalList(selectedNames)}.` : learnerAction,
      expected_action: expectedNames.length ? joinClinicalList(expectedNames) : `Reference ESI ${caseData.acuity}`,
      practice_rule: flag.name === 'Pain Level'
        ? `Treat severe pain as an ED resource and reassess response after intervention.`
        : `Name abnormal ${flag.name.toLowerCase()} and connect it to placement, monitoring, or clinician notification.`,
      flag
    });
  }

  if (workflow?.interview?.missed_domains?.length) {
    const missedDomains = workflow.interview.missed_domains.slice(0, 3);
    upsert({
      key: 'interview_gap',
      finding_type: 'Interview gap',
      finding: `Missing history: ${joinClinicalList(missedDomains)}`,
      why_it_matters: `These questions clarify risk, resource needs, and immediate safety for ${presentingProblemText(caseData)}.`,
      learner_gap: `${workflow.interview.questions_used || 0} focused question${workflow.interview.questions_used === 1 ? '' : 's'} recorded.`,
      expected_action: `Ask about ${joinClinicalList(missedDomains)} before final ESI.`,
      practice_rule: `Ask about ${joinClinicalList(missedDomains)} in ${presentingProblemText(caseData)} before assigning final acuity.`
    });
  }

  const findings = [...entries.values()]
    .sort((a, b) => b.sort_priority - a.sort_priority)
    .slice(0, 6)
    .map(({ sort_priority: _sortPriority, ...item }) => item);

  return {
    title: 'Clinical findings and actions',
    summary: findings.length
      ? (lowAcuityProfile
        ? `For ${presentingProblemText(caseData)}, explain why routine care is safe and verify the refill details that could change risk.`
        : `For ${presentingProblemText(caseData)}, connect each finding to ESI, monitoring, escalation, or reassessment.`)
      : 'No priority findings were generated for this case.',
    findings
  };
}

function legacyDecisionDeltas(clinicalDecisionReview) {
  return (clinicalDecisionReview?.findings || []).map((item) => ({
    finding: item.finding,
    clinical_significance: item.why_it_matters,
    learner_action: item.learner_gap,
    reference_action: item.expected_action,
    recommended_next_step: item.practice_rule,
    finding_type: item.finding_type,
    priority: item.priority
  }));
}

function buildNextCaseChecklist(findings, soapNote, workflow, caseData) {
  const lowAcuityProfile = lowAcuityTeachingProfile(caseData);
  if (lowAcuityProfile) {
    return uniqueSentences(lowAcuityProfile.checklist).slice(0, 5);
  }

  const items = [];
  for (const finding of findings || []) {
    if (finding.practice_rule) items.push(finding.practice_rule);
    else if (finding.recommended_next_step) items.push(finding.recommended_next_step);
  }

  if (workflow?.interview?.missed_domains?.length) {
    items.push(`Ask about ${joinClinicalList(workflow.interview.missed_domains.slice(0, 3))} in ${presentingProblemText(caseData)}.`);
  }

  for (const planItem of (soapNote?.plan || []).slice(0, 4)) {
    if (planItem && typeof planItem === 'object') {
      items.push(planItem.plan || planItem.problem || '');
    } else {
      items.push(planItem);
    }
  }

  return uniqueSentences(items)
    .map((item) => String(item).replace(/\s+/g, ' ').trim())
    .filter((item) => !/^reference disposition\b/i.test(item))
    .filter(Boolean)
    .slice(0, 5);
}

function finalStatusText(session, caseData) {
  if (!session.triage_level) return 'Final ESI not recorded';
  if (session.triage_level > caseData.acuity) return 'Under-triaged';
  if (session.triage_level < caseData.acuity) return 'Over-triaged';
  return 'Matched reference acuity';
}

function readableDisposition(value) {
  const text = String(value || '').trim();
  if (!text) return 'Not recorded';
  return text
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildPhysicianCaseReview(session, caseData, physicianDebrief, clinicalDecisionReview, nextCaseChecklist, esiExplanation) {
  return {
    case_summary: physicianDebrief.case_summary,
    physician_read: physicianDebrief.physician_read,
    reference_esi: caseData.acuity,
    learner_esi: session.triage_level || null,
    disposition: readableDisposition(caseData.disposition),
    final_status: finalStatusText(session, caseData),
    esi_explanation: esiExplanation,
    soap_note: physicianDebrief.soap_note,
    gold_standard_sbar: physicianDebrief.gold_standard_sbar,
    clinical_decision_review: clinicalDecisionReview,
    decision_deltas: legacyDecisionDeltas(clinicalDecisionReview),
    next_case_checklist: nextCaseChecklist
  };
}

function sexLabel(value) {
  const sex = String(value || '').toUpperCase();
  if (sex.startsWith('F')) return 'female patient';
  if (sex.startsWith('M')) return 'male patient';
  return 'patient';
}

function sexNoun(value) {
  const sex = String(value || '').toUpperCase();
  if (sex.startsWith('F')) return 'female';
  if (sex.startsWith('M')) return 'male';
  return 'patient';
}

function patientDescription(caseData) {
  const age = Math.round(Number(caseData.demographics.age || 0));
  const sex = sexNoun(caseData.demographics.sex);
  if (age > 0 && sex !== 'patient') return `${age}-year-old ${sex}`;
  if (age > 0) return `${age}-year-old patient`;
  return sex === 'patient' ? 'patient' : `${sex} patient`;
}

function lowerClinicalText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function arrivalModeText(value) {
  const transport = String(value || '').trim();
  if (!transport || transport.toUpperCase() === 'UNKNOWN') return 'to the ED';
  if (/walk\s*in/i.test(transport)) return 'as a walk-in';
  if (/ambulance|ems|als|bls/i.test(transport)) return 'by ambulance';
  return `by ${transport.toLowerCase()}`;
}

function presentingProblemText(caseData) {
  const complaint = lowerClinicalText(plainComplaint(caseData.complaint)) || 'an emergency concern';
  const history = String(caseData.history || '').replace(/\s+/g, ' ');
  const detailMatch = history.match(/\bpresent(?:ed|s)? to the ED with (?:a chief complaint of |chief complaint of )?([^.;]{3,120})/i) ||
    history.match(/\bchief complaint of\s+([^.;]{3,120})/i);
  const detail = lowerClinicalText(detailMatch?.[1] || '').replace(/^a chief complaint of\s+/i, '');
  const normalizedComplaint = complaint.replace(/\bmeds?\b/g, 'medication');
  const normalizedDetail = detail.replace(/\bmeds?\b/g, 'medication');
  if (!detail || /history of/.test(detail)) return complaint;
  if (
    complaint.includes(detail) ||
    detail.includes(complaint) ||
    normalizedComplaint.includes(normalizedDetail) ||
    normalizedDetail.includes(normalizedComplaint)
  ) {
    return detail;
  }
  return `${complaint} with ${detail}`;
}

function vitalSummaryText(caseData) {
  const flags = vitalFlags(caseData);
  if (flags.length) {
    return flags.slice(0, 3).map((item) => `${item.name} ${item.value}`).join('; ');
  }
  return 'No danger-zone vital signs were present at triage.';
}

function resourceSummaryText(caseData) {
  const resources = [];
  if (caseData.resources_used) resources.push(`${caseData.resources_used} ED resource categor${caseData.resources_used === 1 ? 'y' : 'ies'}`);
  if (caseData.lab_event_count) resources.push('laboratory testing');
  if (caseData.exam_count) resources.push('imaging or examination');
  if (caseData.procedure_count) resources.push('procedure support');
  return resources.length ? joinClinicalList(resources.slice(0, 3)) : 'No counted ED resources were recorded';
}

function documentedMedicalHistoryText(caseData) {
  const extracted = extractListAfter(caseData.history, [
    /(?:history of|a history of)\s+([^.;]+)/i,
    /past medical history includes\s+([^.;]+)/i,
    /past medical history significant for\s+([^.;]+)/i
  ]);
  const list = compactList(extracted, 5);
  return list ? `History includes ${list}.` : '';
}

function documentedMedicationText(caseData) {
  const text = complaintText(caseData);
  if (hasAny(text, ['not currently on any antiepileptic', 'not currently on any aed'])) {
    return 'The record notes no current antiseizure medication.';
  }
  if (/not (?:currently )?on anticoagulation|not taking (?:a )?blood thinner/i.test(caseData.history || '')) {
    return 'The record notes the patient is not on anticoagulation.';
  }

  const medicationTerms = [
    'warfarin',
    'xarelto',
    'eliquis',
    'plavix',
    'metformin',
    'insulin',
    'lisinopril',
    'methadone',
    'blood thinner',
    'anticoagulant',
    'antiepileptic'
  ];
  const mentioned = medicationTerms.filter((term) => text.includes(term));
  if (mentioned.length) {
    return `Medication context includes ${joinClinicalList(mentioned.slice(0, 4))}.`;
  }
  return '';
}

function documentedAllergyText(caseData) {
  const text = complaintText(caseData);
  if (hasAny(text, ['no known allergies', 'no known drug allergies', 'nkda'])) {
    return 'No known drug allergies.';
  }
  const allergy = extractListAfter(caseData.history, [
    /allergic\s+to\s+([^.;]+)/i,
    /allerg(?:y|ies)\s*(?:to|include|includes)?\s+([^.;]+)/i
  ]);
  const list = compactList(allergy, 4);
  return list ? `Allergies include ${list}.` : '';
}

function cleanClinicalHistorySentence(sentence) {
  return String(sentence || '')
    .replace(/^A\s+\d+(?:\.\d+)?[- ]year[- ]old\s+(?:[A-Za-z/ -]+\s+)?(?:male|female)\s+/i, 'The patient ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clinicalHistoryDetails(caseData) {
  const sentences = sentenceSplit(caseData.history)
    .filter((sentence) => !/\b(initial )?vital signs\b/i.test(sentence))
    .filter((sentence) => !/\barrived by\b/i.test(sentence))
    .filter((sentence) => !/\bwalked into the ED\b/i.test(sentence))
    .map(cleanClinicalHistorySentence)
    .filter(Boolean);
  const detailSentences = sentences.slice(1);
  return (detailSentences.length ? detailSentences : sentences).slice(0, 2).join(' ');
}

function joinClinicalList(items = []) {
  const values = uniqueSentences(items).filter(Boolean);
  if (values.length <= 1) return values.join('');
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`;
}

function resourceSignalText(caseData) {
  const signals = [];
  if (caseData.resources_used) signals.push(`${caseData.resources_used} ED resource categor${caseData.resources_used === 1 ? 'y' : 'ies'}`);
  if (caseData.lab_event_count > 0) signals.push('laboratory testing');
  if (caseData.microbio_event_count > 0) signals.push('microbiology testing');
  if (caseData.exam_count > 0) signals.push('imaging or examination');
  if (caseData.procedure_count > 0) signals.push('procedure support');
  if (caseData.interventions?.intravenous) signals.push('IV access');
  if (caseData.interventions?.intravenous_fluids) signals.push('IV fluids');
  if (caseData.interventions?.intramuscular) signals.push('IM medication');
  if (caseData.interventions?.oral_medications) signals.push('oral medication');
  if (caseData.interventions?.nebulized_medications) signals.push('nebulized medication');
  if (caseData.transfusion_within_1h || caseData.transfusion_beyond_1h || caseData.red_cell_order_more_than_1) signals.push('transfusion readiness');
  if (!signals.length) return 'No counted ED resource signal was recorded.';
  return `Recorded ED resource signals include ${joinClinicalList(signals)}.`;
}

function assessmentReportText(caseData) {
  const flags = vitalFlags(caseData);
  const flagText = flags.length
    ? `Key triage concerns include ${joinClinicalList(flags.slice(0, 4).map((item) => `${item.name.toLowerCase()} ${item.value}`))}.`
    : 'No danger-zone vital signs were present at triage.';
  return `Recorded triage vital signs were ${formattedVitalSigns(caseData)}. ${flagText} ${resourceSignalText(caseData)}`;
}

function dispositionSentence(caseData) {
  const disposition = String(caseData.disposition || '').trim();
  const normalized = disposition.toUpperCase();
  if (!disposition) return 'Reference disposition was not recorded.';
  if (normalized.includes('ADMIT')) return 'Anticipate admission after ED evaluation.';
  if (normalized.includes('DISCH')) return 'Anticipate discharge if reassessment remains reassuring.';
  if (normalized.includes('TRANSFER')) return 'Anticipate transfer after ED stabilization.';
  return `Reference disposition is ${disposition.toLowerCase()}.`;
}

function recommendationReportText(caseData, workflow) {
  const expectedIds = new Set((workflow?.escalation?.expected || []).map((item) => item.id));
  const placement = expectedIds.has('resuscitation_bay')
    ? 'Move the patient to a resuscitation bay'
    : expectedIds.has('monitored_bed')
      ? 'Move the patient to a monitored ED treatment area'
      : Number(caseData.acuity) >= 4
        ? 'Use fast-track or minor-care workflow when available'
        : 'Place the patient in the appropriate ED care area';
  const primaryActions = [placement];
  if (expectedIds.has('immediate_bedside_evaluation')) primaryActions.push('notify the clinician for immediate bedside evaluation');

  const nextActions = [];
  if (isLacerationCase(caseData)) nextActions.push('perform wound exam, bleeding control, tetanus assessment, and repair or dressing decision');
  if (expectedIds.has('airway_oxygenation_support')) nextActions.push('escalate airway or oxygenation support');
  if (expectedIds.has('vascular_access')) nextActions.push('prioritize IV access and bloodwork');
  if (expectedIds.has('medication_route_priority')) nextActions.push('anticipate medication route needs');
  if (expectedIds.has('bleeding_transfusion_readiness')) nextActions.push('assess for bleeding or transfusion needs');
  if (expectedIds.has('critical_procedure_team')) nextActions.push('prepare critical procedure support');
  if (expectedIds.has('behavioral_safety')) nextActions.push('begin behavioral safety precautions');
  if (expectedIds.has('pain_reassessment')) nextActions.push('treat severe pain and reassess response');

  const secondary = nextActions.length ? `${capitalizeSentence(joinClinicalList(nextActions))}. ` : '';
  return `${capitalizeSentence(joinClinicalList(primaryActions))}. ${secondary}${dispositionSentence(caseData)}`;
}

function buildGoldStandardSbar(caseData, workflow) {
  const patient = patientDescription(caseData);
  const problem = presentingProblemText(caseData);
  const arrival = arrivalModeText(caseData.demographics.transport);
  const backgroundParts = uniqueSentences([
    `Arrived ${arrival}.`,
    documentedMedicalHistoryText(caseData),
    clinicalHistoryDetails(caseData),
    documentedMedicationText(caseData),
    documentedAllergyText(caseData)
  ]);

  return {
    situation: `Hi, this is triage calling report on a ${patient} who arrived ${arrival} for ${problem}. Reference acuity is ESI ${caseData.acuity}${caseData.acuity <= 2 ? ', so the patient needs immediate clinician evaluation.' : '.'}`,
    background: backgroundParts.join(' '),
    assessment: assessmentReportText(caseData),
    recommendation: recommendationReportText(caseData, workflow)
  };
}

function soapClinicalText(caseData) {
  return `${plainComplaint(caseData.complaint)} ${caseData.history || ''} ${clinicalEvidenceText(caseData, 'soap')}`.toLowerCase();
}

function firstDiagnosisClause(value = '') {
  return String(value || '')
    .split(/\s+vs\.?\s+|\s+versus\s+|,\s*or\s+|\s+or\s+/i)[0]
    .replace(/\s*,\s*$/, '')
    .trim();
}

function hasSepsisPrimaryEvidence(caseData) {
  const text = soapClinicalText(caseData);
  const temp = Number(caseData?.vitals?.temp ?? 98.6);
  const hr = Number(caseData?.vitals?.hr ?? 0);
  const sbp = Number(caseData?.vitals?.sbp ?? 120);
  const infectionEvidence = /\b(sepsis|septic|infection|infectious|fever|chills|rigors|hypothermia|pneumonia|abscess|cellulitis|gangrene|osteomyelitis|purulent|pyelonephritis|urinary tract infection|uti|cholangitis|peritonitis)\b/.test(text)
    || temp >= 100.4
    || temp < 96;
  const systemicEvidence = /\b(hypotension|tachycardia|shock|hemodynamic|organ dysfunction|altered mental status|confusion|agitation)\b/.test(text)
    || hr >= 100
    || sbp < 100;
  return infectionEvidence && systemicEvidence;
}

function hasCriticalAbdominalVascularConcern(caseData) {
  const text = soapClinicalText(caseData);
  const pain = Number(caseData?.vitals?.pain ?? 0);
  const abdominalConcern = /\b(abdominal pain|abd pain|acute abdomen|belly pain|stomach pain|abdominal distention)\b/.test(text);
  const instabilityOrMentalStatus = /\b(altered mental status|altered level of consciousness|confusion|somnolent|lethargic|hemodynamically unstable|hemodynamic instability|shock)\b/.test(text);
  return abdominalConcern && instabilityOrMentalStatus && pain >= 7;
}

function criticalAbdominalVascularDiagnosis(caseData) {
  if (hasCriticalAbdominalVascularConcern(caseData)) {
    return 'Critical abdominal pain with altered mental status concerning for abdominal vascular catastrophe';
  }
  return '';
}

function singleWorkingDiagnosis(value, caseData) {
  const diagnosis = String(value || '').trim();
  const diagnosisText = diagnosis.toLowerCase();
  const clinicalText = soapClinicalText(caseData);
  const text = `${diagnosisText} ${clinicalText}`;

  const abdominalVascularDiagnosis = criticalAbdominalVascularDiagnosis(caseData);
  if (abdominalVascularDiagnosis && /\b(sepsis|septic|ruptur|aortic|aneurysm|aaa|mesenteric|ischemi|vascular|abdominal)\b/i.test(diagnosisText)) {
    return abdominalVascularDiagnosis;
  }

  if (/\bstroke|tia|intracranial hemorrhage|hemorrhagic stroke|ischemic stroke|gaze deviation|left-sided weakness|facial droop|flaccid\b/i.test(text)) {
    return 'Acute focal neurologic deficit concerning for stroke';
  }
  if (/\bpost-surgical neck|neck hematoma|neck swelling|difficulty swallowing|dysphagia\b/i.test(text)) {
    return 'Postoperative dysphagia with neck swelling';
  }
  if (/\bpneumonia\b/i.test(text) && /\bcopd\b/i.test(text)) {
    return 'Pneumonia with COPD exacerbation';
  }
  if (/\bacute coronary syndrome|chest pain|chest pressure\b/i.test(text)) {
    return 'Acute chest pain concerning for acute coronary syndrome';
  }
  if (/\bheart failure|aortic stenosis|pedal edema|orthopnea\b/i.test(text)) {
    return 'Dyspnea with cardiopulmonary risk factors';
  }
  if (/\bseptic shock|sepsis\b/i.test(diagnosisText) && hasSepsisPrimaryEvidence(caseData)) {
    return 'Sepsis in a medically complex patient';
  }
  if (/\bpelvic inflammatory disease|tubo-ovarian|ovarian torsion|appendicitis|acute pelvic pain\b/i.test(text)) {
    return 'Acute pelvic pain requiring ED evaluation';
  }
  if (/\bmesenteric ischemia\b/i.test(text)) {
    return 'Acute abdominal pain concerning for mesenteric ischemia';
  }
  if (/\bpulmonary embolism|hypoxia|dyspnea\b/i.test(text) && /\bcancer|metastatic|pe\b/i.test(text)) {
    return 'Dyspnea and chest pain with thromboembolic risk';
  }

  const firstClause = firstDiagnosisClause(diagnosis);
  return firstClause || diagnosis;
}

function soapPrimaryDiagnosis(caseData) {
  const reviewedDiagnosis = reviewedAugmentationDiagnosis(caseData);
  if (reviewedDiagnosis) return singleWorkingDiagnosis(reviewedDiagnosis, caseData);
  const text = soapClinicalText(caseData);
  if (/\b(sdh|subdural)\b/.test(text)) return 'Subdural hematoma with headache and falls';
  if (/\b(open left tibia|tibia\/fibula|fibula fracture|malleolar fracture)\b/.test(text)) return 'Open left lower-extremity fracture after fall';
  const abdominalVascularDiagnosis = criticalAbdominalVascularDiagnosis(caseData);
  if (abdominalVascularDiagnosis) return abdominalVascularDiagnosis;
  if (/\bsepsis|hypotension and tachycardia|wet gangrene|osteomyelitis\b/.test(text) && hasSepsisPrimaryEvidence(caseData)) return 'Sepsis in a medically complex patient';
  if (/\bseizure\b/.test(text) && /\b(fall|laceration|head lac|forehead)\b/.test(text)) return 'Breakthrough seizure with fall and forehead laceration';
  if (/\b(slurred speech|facial droop|left-sided weakness|flaccid|gaze deviation|stroke|cva|sensory changes)\b/.test(text)) return 'Acute focal neurologic deficit concerning for stroke';
  if (/\baltered mental status|altered level of consciousness|not oriented|bizarre conversation|encephalopathy\b/.test(text)) return 'Acute altered mental status';
  if (/\b(post-esophagectomy|c5 corpectomy|acdf|difficulty swallowing|unable to swallow|hoarseness|neck swelling)\b/.test(text)) return 'Postoperative dysphagia with neck swelling';
  if (/\bpneumonia\b/.test(text) && /\bfever\b/.test(text)) return 'Pneumonia with fever';
  if (/\bdyspnea|shortness of breath\b/.test(text) && /\b(edema|heart failure|aortic stenosis|pleural|pleurx)\b/.test(text)) return 'Dyspnea with cardiopulmonary risk factors';
  if (/\bchest pain|chest pressure\b/.test(text)) return 'Acute chest pain requiring ED evaluation';
  if (/\brectal abscess|perianal abscess|anal pain|crohn|fistulizing\b/.test(text)) return 'Perianal pain concerning for anorectal abscess';
  if (/\bpelvic pain\b/.test(text)) return 'Acute pelvic pain requiring ED evaluation';
  if (/\babdominal|abd pain|stomach|vomiting|nausea\b/.test(text)) return 'Acute abdominal pain requiring ED evaluation';
  if (/\bfinger laceration\b/.test(text)) return 'Finger laceration';
  if (/\bsuture removal\b/.test(text)) return 'Suture removal encounter';
  if (/\bmed refill|medication refill\b/.test(text)) return 'Medication refill request without acute instability';
  if (/\b(wrist|foot|leg|ankle)\b/.test(text) && /\b(pain|swelling|injury)\b/.test(text)) return 'Acute extremity injury';
  if (/\bheadache|head pain\b/.test(text)) return 'Acute headache without danger-zone vital signs';
  if (/\bneck pain\b/.test(text)) return 'Acute neck pain without danger-zone vital signs';
  return `${capitalizeSentence(presentingProblemText(caseData))}, undifferentiated ED presentation`;
}

function isOpenLowerExtremityFractureCase(caseData) {
  return /\b(open left tibia|open tibia|tibia\/fibula|fibula fracture|open fracture|malleolar fracture|metatarsal fracture)\b/
    .test(soapClinicalText(caseData));
}

function hasMissingEvidenceLanguage(value = '') {
  return /\b(source bundle|source record|current source|does not provide|does not document|not documented|none documented|missing|unavailable|undocumented)\b/i
    .test(String(value || ''));
}

function lowerFirst(value = '') {
  const text = String(value || '').trim();
  if (!text) return text;
  return `${text.charAt(0).toLowerCase()}${text.slice(1)}`;
}

function cleanDifferentialClinicalText(value = '') {
  return String(value || '')
    .replace(/\bagainst_or_missing\b/gi, '')
    .replace(/\bWalk-in presentation,\s*/gi, '')
    .replace(/\bTransfer note documents\s+/gi, '')
    .replace(/\bthe source records?\s+/gi, '')
    .replace(/\bsource bundle\b/gi, 'record')
    .replace(/\bsource record\b/gi, 'record')
    .replace(/,\s*and home disposition\b/gi, '')
    .replace(/\bhome disposition\b/gi, '')
    .replace(/\badmission\b/gi, 'need for inpatient care')
    .replace(/\bhigh resource use\b/gi, 'urgent orthopedic care needs')
    .replace(/\blower-acuity musculoskeletal injury\b/gi, 'stable musculoskeletal injury')
    .replace(/\bstable but resource-requiring extremity presentation\b/gi, 'stable extremity presentation requiring focused evaluation')
    .replace(/\brecorded exam or imaging resource\b/gi, 'need for focused exam or imaging')
    .replace(/\bexam or imaging resource\b/gi, 'need for focused exam or imaging')
    .replace(/\blaboratory testing is recorded\b/gi, 'laboratory testing may be needed')
    .replace(/\bmultiple resources\b/gi, 'diagnostic evaluation, treatment, and reassessment')
    .replace(/\bReference ESI\s*\d+\s+is\s+(?:supported by|consistent with)\s*/gi, '')
    .replace(/\bESI\s*\d+\s+is\s+(?:supported by|consistent with)\s*/gi, '')
    .replace(/\bwhen no neurovascular compromise is present\b/gi, 'when neurovascular status remains intact')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',')
    .replace(/\s+/g, ' ')
    .replace(/\s+\./g, '.')
    .trim();
}

function cleanDifferentialCounterpoint(value = '') {
  if (hasMissingEvidenceLanguage(value)) return '';
  return cleanDifferentialClinicalText(value)
    .replace(/^No documented\b/gi, 'No')
    .replace(/\bnot present in the triage history\b/gi, 'absent')
    .trim();
}

function cleanDifferentialAcuity(value = '') {
  const text = String(value || '').trim();
  if (!text || /\bESI\b|\breference\b|\bresource\b|\bdisposition\b/i.test(text)) return '';
  const cleaned = cleanDifferentialClinicalText(text);
  if (!cleaned) return '';
  if (/^Escalates if\b/i.test(cleaned)) {
    return cleaned.replace(/^Escalates if\b/i, 'Escalate urgently if');
  }
  return cleaned;
}

function differentialRationale({ support = '', against = '', discriminator = '', acuity = '' }) {
  const parts = [];
  const supportText = cleanDifferentialClinicalText(support);
  if (supportText) parts.push(`${supportText.replace(/\.$/, '')}.`);
  const counter = cleanDifferentialCounterpoint(against);
  if (counter) parts.push(`${capitalizeSentence(counter).replace(/\.$/, '')}.`);
  const discriminatorText = cleanDifferentialClinicalText(discriminator);
  if (discriminatorText) parts.push(`Clarify with ${lowerFirst(discriminatorText).replace(/\.$/, '')}.`);
  const acuityText = cleanDifferentialAcuity(acuity);
  if (acuityText) parts.push(`${capitalizeSentence(acuityText).replace(/\.$/, '')}.`);
  return parts.join(' ');
}

function openFractureDifferential() {
  return [
    {
      diagnosis: 'Open tibia/fibula fracture with associated ankle and foot fractures',
      rationale: 'The presentation is defined by a fall with an open left tibia/fibula fracture and associated medial malleolar and metatarsal fractures. A low pain score after transfer treatment does not lower concern because open long-bone fractures require urgent wound protection, antibiotics, tetanus assessment, immobilization, serial neurovascular and compartment exams, and orthopedic management.'
    },
    {
      diagnosis: 'Neurovascular compromise or evolving compartment syndrome',
      rationale: 'This remains the critical complication to monitor because vascular injury or compartment syndrome can evolve after an open long-bone fracture. Palpable distal pulses, preserved toe movement and sensation, compressible compartments, and no pain out of proportion make established neurovascular compromise less likely at the time of exam; any change requires immediate clinician notification.'
    }
  ];
}

function criticalAbdominalVascularDifferential(caseData) {
  const temp = Number(caseData?.vitals?.temp ?? 98.6);
  const hr = Number(caseData?.vitals?.hr ?? 0);
  const sbp = Number(caseData?.vitals?.sbp ?? 0);
  const dbp = Number(caseData?.vitals?.dbp ?? 0);
  const pain = Number(caseData?.vitals?.pain ?? 0);
  const pressure = sbp && dbp ? `${Math.round(sbp)}/${Math.round(dbp)}` : 'not hypotensive';
  return [
    {
      diagnosis: 'Ruptured abdominal aortic aneurysm or intra-abdominal hemorrhage',
      rationale: `Severe abdominal pain (${pain}/10), altered mental status, ambulance transfer, tachycardia (HR ${hr}), and reported hemodynamic instability fit an abdominal vascular or bleeding emergency. Triage blood pressure is ${pressure} mmHg rather than frankly hypotensive, so bedside aortic ultrasound, type and screen, and CT angiography abdomen/pelvis if stable enough for CT are needed to confirm or exclude it.`
    },
    {
      diagnosis: 'Mesenteric ischemia or other bowel catastrophe',
      rationale: `Pain out of proportion (${pain}/10), altered mental status, abdominal distention, and tachycardia fit bowel ischemia or another surgical abdominal emergency. Temperature is ${temp} F, so the presentation is not defined by fever; serum lactate, acid-base status, serial abdominal exam, and CT angiography help separate ischemia from inflammatory or obstructive causes.`
    },
    {
      diagnosis: 'Intra-abdominal infection or sepsis',
      rationale: `Abdominal pain and altered mental status can occur with infection, but temperature ${temp} F, preserved oxygenation, and no localizing infectious source in the triage evidence make sepsis less supported as the primary diagnosis. CBC, lactate, cultures when infection remains plausible, and CT abdomen/pelvis can evaluate for occult intra-abdominal infection while vascular and bleeding emergencies are addressed.`
    }
  ];
}

function soapDifferential(caseData) {
  const reviewedDdx = reviewedAugmentationDdx(caseData);
  if (reviewedDdx.length && isOpenLowerExtremityFractureCase(caseData)) {
    return openFractureDifferential();
  }

  if (hasCriticalAbdominalVascularConcern(caseData)) {
    return criticalAbdominalVascularDifferential(caseData);
  }

  if (reviewedDdx.length) {
    return reviewedDdx.slice(0, 4).map((item) => ({
      diagnosis: item.diagnosis,
      rationale: differentialRationale({
        support: item.support,
        against: item.against_or_missing,
        discriminator: item.next_discriminator,
        acuity: item.acuity_implication
      })
    }));
  }

  const text = soapClinicalText(caseData);
  const lowAcuityProfile = lowAcuityTeachingProfile(caseData);

  if (lowAcuityProfile?.ddx?.length) {
    return lowAcuityProfile.ddx.map((item) => ({
      ...item,
      rationale: differentialRationale({ support: item.rationale })
    }));
  }

  if (/\bchest pain|chest pressure|dyspnea|shortness of breath\b/.test(text)) {
    return [
      { diagnosis: 'Acute coronary syndrome', rationale: differentialRationale({ support: 'Chest pain or dyspnea can represent myocardial ischemia, especially in older patients or patients with cardiac risk factors', against: 'Respiratory or infectious symptoms may point away from a primary coronary process when they dominate the presentation', discriminator: 'ECG, serial troponins, pain character, and response to therapy' }) },
      { diagnosis: 'Pulmonary embolism', rationale: differentialRationale({ support: 'Dyspnea, pleuritic pain, malignancy, thrombosis history, calf symptoms, hypoxemia, or anticoagulation context would support PE', against: 'Normal oxygenation and absence of pleuritic pain or unilateral leg symptoms lower the probability', discriminator: 'Risk stratification, D-dimer when appropriate, and CT pulmonary angiography when indicated' }) },
      { diagnosis: 'Pneumonia, COPD exacerbation, or heart failure', rationale: differentialRationale({ support: 'Cough, wheeze, edema, fever, COPD, pleural disease, or heart failure history would support a pulmonary or volume-overload cause', against: 'A purely exertional pressure-like chest pain pattern would make this less likely', discriminator: 'Chest radiograph, lung exam, BNP, viral testing, and response to bronchodilator or diuresis' }) }
    ];
  }

  if (/\b(slurred speech|facial droop|left-sided weakness|flaccid|gaze deviation|stroke|cva|sensory changes|altered mental status|altered level of consciousness|seizure|subdural|sdh)\b/.test(text)) {
    return [
      { diagnosis: 'Ischemic stroke or TIA', rationale: differentialRationale({ support: 'Focal weakness, speech change, facial droop, sensory change, or gaze deviation are stroke-pattern findings', against: 'A fully resolved deficit with normal exam would fit TIA more than completed stroke', discriminator: 'Last-known-well time, NIHSS, non-contrast head CT, CTA, and glucose' }) },
      { diagnosis: 'Intracranial hemorrhage or subdural hematoma', rationale: differentialRationale({ support: 'Headache, falls, anticoagulation, trauma, severe hypertension, or known subdural hemorrhage increases concern for bleeding', against: 'Absence of trauma or headache lowers but does not eliminate concern when focal deficits are present', discriminator: 'Non-contrast head CT' }) },
      { diagnosis: 'Seizure, toxic-metabolic encephalopathy, or infection', rationale: differentialRationale({ support: 'Altered mental status, seizure activity, medication exposure, fever, renal disease, or systemic illness can mimic stroke', against: 'Clear unilateral focal deficits and gaze deviation favor stroke until proven otherwise', discriminator: 'Glucose, metabolic panel, medication/toxin history, temperature, infectious evaluation, and neurologic imaging' }) }
    ];
  }

  if (/\b(abdominal|abd pain|stomach|pelvic|vomiting|nausea|rectal abscess|perianal abscess|anal pain|crohn|fistulizing)\b/.test(text)) {
    return [
      { diagnosis: 'Intra-abdominal inflammatory or infectious process', rationale: differentialRationale({ support: 'Abdominal pain, distention, vomiting, fever, or systemic symptoms fit an inflammatory or infectious process', against: 'Stable vital signs and mild pain lower immediate shock risk but do not exclude surgical disease', discriminator: 'Serial abdominal exam, CBC, CMP, lipase, lactate, urinalysis, and CT or ultrasound based on location' }) },
      { diagnosis: 'Obstruction, perforation, abscess, or Crohn disease complication', rationale: differentialRationale({ support: 'Distention, severe pain, weight loss, fistulizing disease, purulent drainage, or prior surgery increases concern for mechanical or abscess complication', against: 'Soft abdomen and absence of peritoneal signs would make perforation less likely', discriminator: 'CT abdomen/pelvis and surgical consultation when peritonitis or obstruction is suspected' }) },
      { diagnosis: 'Genitourinary or gynecologic source', rationale: differentialRationale({ support: 'Lower abdominal or pelvic pain, urinary symptoms, pregnancy possibility, or pelvic symptoms can indicate a GU or gynecologic source', against: 'Older age or upper abdominal localization may make gynecologic disease less likely', discriminator: 'Urinalysis, pregnancy testing when applicable, pelvic exam, and pelvic ultrasound' }) }
    ];
  }

  if (/\bfever|pneumonia|sepsis|gangrene|osteomyelitis\b/.test(text)) {
    return [
      { diagnosis: 'Sepsis or systemic infection', rationale: differentialRationale({ support: 'Fever, hypothermia, hypotension, tachycardia, gangrene, osteomyelitis, or systemic illness supports sepsis risk', against: 'Normal perfusion and stable pressure reduce immediate shock concern but do not remove sepsis risk', discriminator: 'Lactate, cultures, source exam, CBC, CMP, and response to fluids and antibiotics' }) },
      { diagnosis: 'Pneumonia or respiratory infection', rationale: differentialRationale({ support: 'Fever, productive cough, dyspnea, wheezing, hypoxemia, or pneumonia history supports a respiratory source', against: 'Absence of cough or hypoxemia makes pneumonia a less direct fit', discriminator: 'Lung exam, chest radiograph, oxygen trend, and viral or sputum testing when indicated' }) },
      { diagnosis: 'Soft tissue, urinary, line-related, or abdominal infection', rationale: differentialRationale({ support: 'Medical complexity, wounds, dialysis access, urinary symptoms, abdominal symptoms, or recent hospitalization can identify another source', against: 'No localizing source on triage history makes this a broader search rather than the primary fit', discriminator: 'Focused skin/access exam, urinalysis, abdominal exam, cultures, and source-directed imaging' }) }
    ];
  }

  if (/\bfinger laceration\b|\blaceration\b|\bcut\b|\bwound\b|\bsuture\b/.test(text)) {
    return [
      { diagnosis: 'Finger laceration requiring wound assessment', rationale: differentialRationale({ support: 'The chief concern is a finger laceration; wound depth, contamination, bleeding control, repair need, and neurovascular status determine treatment', against: 'Stable vitals and low pain support local wound care rather than systemic illness', discriminator: 'Direct wound exam, tendon testing, sensation, capillary refill, and need for repair' }) },
      { diagnosis: 'Tendon, nerve, or vascular injury', rationale: differentialRationale({ support: 'Digital lacerations can injure tendon, nerve, or vessel depending on depth and location', against: 'Normal range of motion, strength, sensation, capillary refill, and bleeding control would make this less likely', discriminator: 'Isolated tendon function, two-point discrimination, capillary refill, and active bleeding assessment' }) },
      { diagnosis: 'Retained foreign body or fracture', rationale: differentialRationale({ support: 'Mechanism, wound depth, focal bony tenderness, foreign body sensation, or exam findings would support imaging', against: 'Superficial clean wounds without bony tenderness or foreign body sensation are less consistent', discriminator: 'Wound exploration and radiograph when mechanism or exam supports it' }) },
      { diagnosis: 'Early wound infection risk', rationale: differentialRationale({ support: 'Wound age, contamination, immunocompromise, drainage, spreading erythema, fever, or delayed presentation increases infection risk', against: 'Fresh clean wounds without erythema or systemic symptoms are less consistent', discriminator: 'Skin exam, fever trend, drainage, and risk-factor review' }) }
    ];
  }

  if (/\b(wrist|foot|leg|ankle|fracture|injury|fall)\b/.test(text)) {
    return [
      { diagnosis: 'Fracture, dislocation, or soft tissue injury', rationale: differentialRationale({ support: 'Extremity pain, swelling, fall mechanism, inability to bear weight, deformity, or transfer for known injury supports this category', against: 'Normal function, mild pain, and no focal tenderness would make major fracture less likely', discriminator: 'Focused musculoskeletal exam, neurovascular exam, weight-bearing status, and radiographs' }) },
      { diagnosis: 'Laceration or wound complication', rationale: differentialRationale({ support: 'A cut, open fracture, sutures, drainage, or wound reassessment makes wound complication clinically relevant', against: 'Intact skin and absence of erythema, drainage, or bleeding lower this concern', discriminator: 'Skin inspection, wound depth, contamination, drainage, and tetanus status' }) },
      { diagnosis: 'Neurovascular compromise or infection', rationale: differentialRationale({ support: 'Severe pain, swelling, open wound, delayed capillary refill, pulse change, sensory change, motor deficit, warmth, or fever increases risk', against: 'Palpable pulses, intact sensation, preserved motor function, and compressible compartments lower immediate neurovascular concern', discriminator: 'Serial distal pulse, motor, sensory, capillary refill, compartment, and skin exams' }) }
    ];
  }

  if (/\bmed refill|medication refill\b/.test(text)) {
    return [
      { diagnosis: 'Medication access issue', rationale: differentialRationale({ support: 'The visit is for a refill and vital signs do not show an immediate danger signal', against: 'New symptoms, withdrawal risk, or unstable disease control would shift the visit away from simple access', discriminator: 'Medication name, dose, last dose, missed doses, indication, contraindications, and outpatient access plan' }) },
      { diagnosis: 'Uncontrolled chronic disease', rationale: differentialRationale({ support: 'Risk rises when the medication treats hypertension, diabetes, seizures, anticoagulation, psychiatric disease, or withdrawal prevention', against: 'Stable symptoms and a low-risk medication make this less likely', discriminator: 'Disease-specific symptom screen and medication safety review' }) },
      { diagnosis: 'Occult acute complaint', rationale: differentialRationale({ support: 'A refill request can mask new symptoms or medication adverse effects', against: 'A focused screen without new symptoms supports routine outpatient-oriented care', discriminator: 'Review of new symptoms, adverse effects, pregnancy status when relevant, and return precautions' }) }
    ];
  }

  return [
    { diagnosis: 'Primary presenting complaint', rationale: differentialRationale({ support: 'This is the best fit for the stated chief concern and triage history', against: 'Atypical vitals, high-risk history, or discordant symptoms should broaden the workup', discriminator: 'Focused history, exam, vital-sign trend, and expected ED resources' }) },
    { diagnosis: 'High-risk secondary cause', rationale: differentialRationale({ support: 'Abnormal vital signs, severe pain, age, comorbid disease, or transfer status raises concern for a higher-risk cause', against: 'Stable vitals and reassuring focused exam lower immediate risk', discriminator: 'Targeted red-flag questions and objective reassessment' }) },
    { diagnosis: 'Lower-acuity benign process', rationale: differentialRationale({ support: 'Stable presentation and absence of danger-zone symptoms can fit a benign cause', against: 'This should not be assumed when high-risk symptoms, abnormal vitals, or multiple resource needs are present', discriminator: 'Reassessment after focused exam and initial diagnostics' }) }
  ];
}

function relevantPmhForAssessment(caseData, patientView = {}) {
  const text = `${soapClinicalText(caseData)} ${soapPrimaryDiagnosis(caseData)}`.toLowerCase();
  const pmh = [...(patientView.medical_history || []), ...(patientView.cardiac_history || [])];
  if (!pmh.length) return [];

  const contextRules = [
    {
      context: /\b(chest pain|chest pressure|dyspnea|shortness of breath|heart failure|orthopnea|edema|syncope)\b/,
      condition: /\b(coronary|myocardial infarction|heart attack|heart failure|chf|aortic stenosis|atrial fibrillation|arrhythmia|hypertension|hyperlipidemia|diabetes|copd|asthma|pulmonary|tobacco|renal|dialysis|ckd)\b/i
    },
    {
      context: /\b(stroke|tia|focal neurologic|weakness|facial droop|gaze deviation|altered mental|confusion|seizure|subdural|headache)\b/,
      condition: /\b(stroke|tia|seizure|epilepsy|hypertension|diabetes|atrial fibrillation|anticoag|cancer|renal|dialysis|ckd|adrenal|immunocompromised|hiv|copd)\b/i
    },
    {
      context: /\b(fever|sepsis|infection|pneumonia|abscess|cellulitis|gangrene|osteomyelitis)\b/,
      condition: /\b(diabetes|renal|dialysis|ckd|cancer|malignancy|transplant|hiv|immunocompromised|steroid|copd|asthma)\b/i
    },
    {
      context: /\b(abdominal|pelvic|vomiting|nausea|crohn|fistula|dysphagia|difficulty swallowing)\b/,
      condition: /\b(crohn|ulcerative|abdominal surgery|esophagectomy|acdf|diabetes|renal|dialysis|ckd|adrenal|pregnan|cancer|immunocompromised)\b/i
    },
    {
      context: /\b(abdominal vascular|vascular catastrophe|mesenteric|ischemi|aortic|aneurysm|hemorrhage)\b/,
      condition: /\b(hypertension|high blood pressure|hyperlipidemia|high cholesterol|atrial fibrillation|anticoag|coronary|vascular|atherosclero|stroke|smoking|tobacco)\b/i
    },
    {
      context: /\b(fracture|fall|injury|trauma|laceration|wound|bleeding)\b/,
      condition: /\b(anticoag|bleeding disorder|hemophilia|diabetes|osteoporosis|renal|dialysis|ckd|immunocompromised|steroid|pregnan)\b/i
    }
  ];

  return pmh.filter((item) => {
    const value = String(item || '').trim();
    if (!value) return false;
    return contextRules.some((rule) => rule.context.test(text) && rule.condition.test(value));
  });
}

function soapJustification(caseData) {
  const primary = soapPrimaryDiagnosis(caseData);
  const text = soapClinicalText(caseData);
  const flags = vitalFlags(caseData);
  const age = Math.round(Number(caseData.demographics?.age || 0));
  const sex = sexLabel(caseData.demographics?.sex);
  const pain = Number(caseData.vitals?.pain ?? 0);
  const hr = Number(caseData.vitals?.hr ?? 0);
  const sbp = Number(caseData.vitals?.sbp ?? 0);
  const temp = Number(caseData.vitals?.temp ?? 0);
  const acuity = caseData.acuity;
  const lowAcuityProfile = lowAcuityTeachingProfile(caseData);
  const patientView = buildPatientView(caseData) || {};

  if (lowAcuityProfile) {
    return [
      `This ${age}-year-old ${sex} presents with ${lowAcuityProfile.problem} and no danger-zone vital signs.`,
      pain > 0 ? `Pain is rated ${pain}/10.` : '',
      'Plan is focused on problem-specific exam, symptom control, reassessment, and discharge safety if the clinical exam remains reassuring.'
    ].filter(Boolean).join(' ');
  }

  if (isOpenLowerExtremityFractureCase(caseData)) {
    return [
      `This ${age}-year-old ${sex} has an open left lower-extremity fracture after a fall, with associated ankle and foot fractures.`,
      hr >= 100 ? `Tachycardia (HR ${hr}) may reflect pain, blood loss, or stress response.` : '',
      'This is a high-risk orthopedic injury requiring urgent wound protection, early antibiotics, tetanus assessment, immobilization, serial distal neurovascular and compartment exams, analgesia, and orthopedic evaluation.'
    ].filter(Boolean).join(' ');
  }

  if (hasCriticalAbdominalVascularConcern(caseData)) {
    return [
      `This ${age}-year-old ${sex} presents with critical abdominal pain and altered mental status.`,
      `Triage data show pain ${pain}/10, heart rate ${hr} bpm, blood pressure ${sbp}/${Number(caseData.vitals?.dbp ?? 0)} mmHg, temperature ${temp} F, and oxygen saturation ${Number(caseData.vitals?.o2 ?? 0)}%.`,
      'The combination of severe abdominal pain, altered mentation, tachycardia, and reported hemodynamic instability is most concerning for an abdominal vascular, bleeding, or surgical catastrophe.',
      hasSepsisPrimaryEvidence(caseData)
        ? 'Infection remains clinically relevant because infectious evidence is present in the case data.'
        : 'Sepsis remains a differential consideration, but the available triage evidence does not show fever or a localizing infectious source, so it should not be the primary working diagnosis.',
      'The patient needs immediate resuscitation-area evaluation, analgesia, serial abdominal exams, lactate and type-and-screen testing, emergent abdominal vascular imaging if stable enough, and early surgical or vascular consultation.'
    ].filter(Boolean).join(' ');
  }

  // Build evidence sentences specific to the case
  const evidence = [];

  // Demographics and presentation
  evidence.push(`This is a ${age}-year-old ${sex} presenting with ${presentingProblemText(caseData)}.`);

  // PMH as risk modifier
  const pmh = relevantPmhForAssessment(caseData, patientView);
  if (pmh.length) {
    evidence.push(`Relevant medical history includes ${joinClinicalList(pmh.slice(0, 3))}.`);
  }

  // Key positive symptoms supporting the primary dx
  const positives = (patientView.present_symptoms || []).slice(0, 4);
  if (positives.length) {
    evidence.push(`Key associated symptoms include ${joinClinicalList(positives)}.`);
  }

  // Key negatives that help narrow the differential
  const negatives = Array.isArray(patientView.relevant_negatives)
    ? patientView.relevant_negatives.slice(0, 3)
    : patientView.relevant_negatives ? [patientView.relevant_negatives] : [];
  if (negatives.length) {
    evidence.push(`Pertinent negatives include ${joinClinicalList(negatives)}.`);
  }

  // Vital sign interpretation
  if (flags.length) {
    const flagDescriptions = flags.slice(0, 3).map((f) => `${f.name.toLowerCase()} of ${f.value}`);
    evidence.push(`Triage vital signs are significant for ${joinClinicalList(flagDescriptions)}.`);
  } else if (temp >= 100.4) {
    evidence.push(`Fever of ${temp}°F at triage raises concern for an infectious or inflammatory process.`);
  } else if (hr >= 100) {
    evidence.push(`Tachycardia (HR ${hr}) at triage may reflect pain, volume depletion, or systemic response.`);
  } else {
    evidence.push(`Vital signs at triage are within acceptable limits.`);
  }

  // Pain context
  if (pain >= 7) {
    evidence.push(`Severe pain rated ${pain}/10 is consistent with the acuity of this presentation and warrants urgent assessment and analgesia.`);
  } else if (pain >= 4) {
    evidence.push(`Moderate pain rated ${pain}/10 supports the need for evaluation and symptom management.`);
  }

  // Clinical priority conclusion
  const priorityRationale = acuity <= 2
    ? 'The presentation requires immediate clinician evaluation and close monitoring.'
    : acuity === 3
    ? 'The presentation requires prompt ED evaluation, diagnostic workup, treatment, and reassessment.'
    : 'The presentation is appropriate for focused evaluation with reassessment for symptom progression or vital-sign change.';
  evidence.push(priorityRationale);

  return evidence.filter(Boolean).join(' ');
}

function soapPlan(caseData, workflow) {
  const expectedIds = new Set((workflow?.escalation?.expected || []).map((item) => item.id));
  const text = soapClinicalText(caseData);
  const acuity = caseData.acuity;
  const pain = Number(caseData.vitals?.pain ?? 0);
  const hr = Number(caseData.vitals?.hr ?? 0);
  const sbp = Number(caseData.vitals?.sbp ?? 0);
  const temp = Number(caseData.vitals?.temp ?? 0);
  const spO2 = Number(caseData.vitals?.o2 ?? 100);
  const rr = Number(caseData.vitals?.rr ?? 16);
  const lowAcuityProfile = lowAcuityTeachingProfile(caseData);
  const patientView = buildPatientView(caseData) || {};

  // Low-acuity cases get a simple flat list
  if (lowAcuityProfile) {
    return uniqueSentences(lowAcuityProfile.plan_items).slice(0, 6).map((item) => ({
      problem: 'Primary visit concern',
      plan: item
    }));
  }

  const problems = [];

  // Problem 1: Primary presenting problem
  let primaryPlan = 'Continue focused ED evaluation with reassessment for worsening symptoms or vital-sign change.';
  if (expectedIds.has('resuscitation_bay')) {
    primaryPlan = 'Activate resuscitation bay; notify attending for immediate bedside evaluation. Initiate ACLS monitoring and prepare for emergent intervention.';
  } else if (expectedIds.has('monitored_bed') || acuity <= 2) {
    primaryPlan = 'Place in a monitored ED treatment area. Assign prompt clinician evaluation and initiate continuous cardiac and pulse oximetry monitoring.';
  }

  if (/\b(chest pain|chest pressure|dyspnea|shortness of breath)\b/.test(text)) {
    problems.push({ problem: 'Undifferentiated chest pain / dyspnea', plan: `${primaryPlan} Obtain 12-lead ECG within 10 minutes of arrival, serial troponins, CXR, and BNP. Rule out ACS, PE, and decompensated heart failure before disposition.` });
  } else if (/\b(slurred speech|facial droop|left-sided weakness|right-sided weakness|stroke|cva|gaze deviation|flaccid)\b/.test(text)) {
    problems.push({ problem: 'Acute focal neurologic deficit — stroke/TIA until proven otherwise', plan: `${primaryPlan} Activate stroke protocol. Obtain non-contrast CT head immediately. Document NIHSS. Neurology consult. Assess for tPA eligibility if within window.` });
  } else if (hasCriticalAbdominalVascularConcern(caseData)) {
    problems.push({ problem: 'Critical abdominal pain with altered mental status', plan: `${primaryPlan} Keep NPO. Check point-of-care glucose because mental status is abnormal. Establish two large-bore IVs if possible. Obtain CBC, CMP, venous or arterial lactate, coagulation studies, type and screen/crossmatch, and urinalysis. Perform serial abdominal exams. Obtain emergent CT angiography abdomen/pelvis if stable enough for CT; use bedside aortic ultrasound if unstable. Consult general surgery and vascular surgery early.` });
  } else if (/\b(seizure|post-ictal|altered mental status|altered level of consciousness|encephalopathy)\b/.test(text)) {
    problems.push({ problem: 'Altered mental status', plan: `${primaryPlan} Immediate point-of-care glucose. Obtain full metabolic panel and targeted toxic-metabolic testing based on history. Serial neurologic checks. Protect airway and obtain brain imaging when trauma, focal deficit, anticoagulation, or persistent unexplained altered mental status is present.` });
  } else if (/\b(open left tibia|open tibia|tibia\/fibula|open fracture)\b/.test(text)) {
    problems.push({ problem: 'Open lower-extremity fracture', plan: `${primaryPlan} Maintain sterile dressing and immobilization. Perform serial distal pulse, motor, sensory, capillary refill, and compartment checks. Give IV analgesia, early IV antibiotics, and tetanus prophylaxis as indicated. Obtain or review extremity radiographs and consult orthopedics urgently.` });
  } else if (/\b(rectal abscess|perianal abscess|anal pain|crohn|fistulizing|perianal)\b/.test(text)) {
    problems.push({ problem: 'Perianal or anorectal pain — abscess vs. fistula', plan: `${primaryPlan} Focused perianal and digital rectal exam under adequate analgesia. Order pelvic CT or MRI perianal protocol. Surgical or colorectal surgery consult for drainage decision.` });
  } else if (/\b(abdominal|pelvic pain|nausea|vomiting|abd pain|stomach)\b/.test(text)) {
    problems.push({ problem: 'Acute abdominal or pelvic pain', plan: `${primaryPlan} Serial abdominal exams. Obtain CBC, CMP, lipase, urinalysis, and urine HCG (if applicable). Pelvic ultrasound or CT abdomen/pelvis based on clinical suspicion. NPO pending surgical evaluation.` });
  } else if (/\b(sepsis|gangrene|osteomyelitis|hypotension and tachycardia)\b/.test(text) && hasSepsisPrimaryEvidence(caseData)) {
    problems.push({ problem: 'Sepsis / systemic infection', plan: `${primaryPlan} Initiate sepsis bundle: blood cultures × 2, serum lactate, broad-spectrum antibiotics within 1 hour, and 30 mL/kg IV crystalloid bolus for hypotension or lactate ≥4 mmol/L.` });
  } else if (isLacerationCase(caseData)) {
    problems.push({ problem: 'Soft tissue wound', plan: 'Focused wound exam: depth, contamination, active bleeding, tendon and neurovascular function. Irrigate, debride, and repair per wound type. Assess tetanus immunization status.' });
  } else if (/\b(wrist|foot|ankle|leg|fracture|fall|injury)\b/.test(text)) {
    problems.push({ problem: 'Extremity injury', plan: 'Focused musculoskeletal exam with neurovascular assessment distally. Obtain plain radiographs. Immobilize, apply splint if indicated. Orthopedic consult for displaced or open fractures.' });
  } else {
    problems.push({ problem: 'Primary presenting complaint', plan: primaryPlan });
  }

  // Problem 2: Pain management
  if (pain >= 6) {
    problems.push({
      problem: `Pain management (${pain}/10)`,
      plan: pain >= 8
        ? 'Initiate multimodal analgesia: IV opioid or IV ketorolac titrated to effect, plus non-pharmacologic measures. Reassess pain score at 30 minutes and after each intervention. Document response.'
        : 'Initiate analgesia per ED protocol (PO/IV NSAIDs, acetaminophen, or opioid based on severity and contraindications). Reassess pain within 60 minutes.'
    });
  }

  // Problem 3: Hemodynamic / respiratory instability
  if (sbp < 90 || hr >= 120 || spO2 < 94 || rr >= 24) {
    const hemoParts = [];
    if (sbp < 90) hemoParts.push(`hypotension (SBP ${sbp} mmHg) — initiate IV fluid resuscitation and reassess for vasopressor need`);
    if (hr >= 120) hemoParts.push(`tachycardia (HR ${hr}) — identify and treat underlying cause (pain, volume, infection, arrhythmia)`);
    if (spO2 < 94) hemoParts.push(`hypoxemia (SpO₂ ${spO2}%) — apply supplemental oxygen, escalate to CPAP/BiPAP or intubation if not responsive`);
    if (rr >= 24) hemoParts.push(`tachypnea (RR ${rr}) — assess work of breathing and oxygenation`);
    problems.push({ problem: 'Hemodynamic or respiratory instability', plan: `Address: ${joinClinicalList(hemoParts)}. Continuous monitoring with reassessment every 15 minutes.` });
  }

  // Problem 4: Infection / fever risk
  if (temp >= 100.4 || (/\b(fever|chills|rigors|sepsis|infection|abscess|cellulitis|pneumonia)\b/.test(text) && hasSepsisPrimaryEvidence(caseData))) {
    const onAbx = (patientView.medications || []).some((m) => /antibiotic|cipro|amoxicillin|ceftriaxone|vancomycin|metronidazole|bactrim/i.test(m));
    problems.push({
      problem: `Fever / infectious process${temp >= 100.4 ? ` (T ${temp}°F)` : ''}`,
      plan: onAbx
        ? 'Patient reports current antibiotic use — assess compliance and adequacy of coverage. Obtain cultures before dose change. Evaluate for treatment failure or resistant organism.'
        : 'Obtain blood cultures and relevant source-directed cultures before initiating antibiotics. Select empiric antibiotic coverage based on presumed source, severity, and immunocompromise status.'
    });
  }

  // Problem 5: Immunocompromise modifier
  if (/\b(hiv|immunocompromised|transplant|on steroids|on chemotherapy|neutropenic|aids)\b/.test(text)) {
    problems.push({
      problem: 'Immunocompromise — elevated infectious risk',
      plan: 'Lower threshold for cultures, imaging, and empiric antimicrobials. Atypical organisms are more likely. Infectious disease consult if fever source is unclear or patient is critically ill.'
    });
  }

  // Problem 6: Airway
  if (expectedIds.has('airway_oxygenation_support') || spO2 < 94 || rr >= 24) {
    const already = problems.some((p) => /respiratory|airway/i.test(p.problem));
    if (!already) {
      problems.push({ problem: 'Airway and oxygenation', plan: 'Assess airway patency, work of breathing, and oxygenation. Apply supplemental oxygen. Prepare for escalation to non-invasive or invasive ventilation if saturations do not improve.' });
    }
  }

  // Problem 7: Vascular access / labs
  if (expectedIds.has('vascular_access') || acuity <= 3) {
    problems.push({ problem: 'Vascular access and diagnostic workup', plan: 'Establish IV or IO access. Draw appropriate labs based on presentation. Order imaging per clinical decision-making. Volume resuscitate as indicated.' });
  }

  return problems.slice(0, 6);
}

function generateObjectiveExam(caseData) {
  const complaint = String(caseData.complaint || '').toLowerCase();
  const history = String(caseData.history || '').toLowerCase();
  const fullText = `${complaint} ${history}`;
  
  const temp = caseData.vitals?.temp || 98.6;
  const hr = caseData.vitals?.hr || 80;
  const rr = caseData.vitals?.rr || 16;
  const sbp = caseData.vitals?.sbp || 120;
  const spO2 = caseData.vitals?.o2 || 100;
  const pain = caseData.vitals?.pain || 0;

  const findings = [];
  const airwayThreat = sentenceHasPositiveClinicalPhrase(fullText, [
    /\banaphylaxis\b/i,
    /\bstridor\b/i,
    /\bchoking\b/i,
    /\bthroat closing\b/i,
    /\bangioedema\b/i
  ]);
  const respiratoryConcern = sentenceHasPositiveClinicalPhrase(fullText, [
    /\bshort(?:ness)? of breath\b/i,
    /\bdyspnea\b/i,
    /\btrouble breathing\b/i,
    /\bdifficulty breathing\b/i,
    /\bbreathing difficult(?:y|ies)?\b/i,
    /\blabored breathing\b/i,
    /\brespiratory distress\b/i,
    /\bcopd\b/i,
    /\basthma\b/i,
    /\bchf\b/i,
    /\bpneumonia\b/i
  ]);

  if (/\b(open left tibia|open tibia|tibia\/fibula|open fracture)\b/.test(fullText)) {
    return [
      'Focused exam target: assess airway and distress, open wound status, bleeding control, deformity, distal pulses, capillary refill, motor function, sensation, compartment firmness, and pain with passive stretch.'
    ];
  }

  if (fullText.includes('unresponsive') || fullText.includes('cardiac arrest') || fullText.includes('cpr')) {
    findings.push("Unresponsive. Apneic. No palpable central pulses.");
  } else if (fullText.includes('altered') || fullText.includes('lethargic') || fullText.includes('somnolent') || fullText.includes('confused') || fullText.includes('overdose') || fullText.includes('intoxicat') || fullText.includes('seizure')) {
    findings.push("Somnolent/lethargic; cooperates minimally.");
  } else if (airwayThreat) {
    findings.push("Severe respiratory distress; anxious, stridorous.");
  } else if (respiratoryConcern || rr >= 26 || spO2 <= 91) {
    findings.push("Respiratory distress with increased effort/accessory muscle use.");
  } else if (rr >= 22 || spO2 < 95) {
    findings.push("Borderline respiratory vital sign; assess work of breathing and oxygenation.");
  } else if (pain >= 8 || sbp >= 180 || hr >= 120 || sbp < 90) {
    findings.push("Appears in moderate to severe distress.");
  } else if (pain >= 5 || temp >= 101) {
    findings.push("Appears mildly ill and uncomfortable.");
  }

  if (fullText.includes('wheez') || fullText.includes('asthma') || fullText.includes('copd')) {
    findings.push("Expiratory wheezing present.");
  } else if (fullText.includes('cough') || fullText.includes('sputum') || fullText.includes('pneumonia') || fullText.includes('fever') || temp >= 100.4) {
    findings.push("Coarse rhonchi/crackles noted.");
  } else if (fullText.includes('chf') || fullText.includes('edema') || fullText.includes('orthopnea')) {
    findings.push("Bibasilar crackles present.");
  }

  if (fullText.includes('afib') || fullText.includes('arrhythmia') || fullText.includes('irregular')) {
    findings.push("Irregularly irregular heart rhythm.");
  }

  if (fullText.includes('abdominal pain') || fullText.includes('stomach pain') || fullText.includes('nausea') || fullText.includes('vomiting') || fullText.includes('pelvic pain') || fullText.includes('crohn') || fullText.includes('abscess')) {
    if (pain >= 7) {
      findings.push("Abdomen moderately distended; severe tenderness with guarding.");
    } else {
      findings.push("Abdomen soft with mild to moderate tenderness; no rebound.");
    }
  }

  if (fullText.includes('slurred') || fullText.includes('droop') || fullText.includes('weakness') || fullText.includes('numbness') || fullText.includes('stroke') || fullText.includes('ams')) {
    if (fullText.includes('left-sided weakness') || fullText.includes('left sided weakness')) findings.push("Left-sided hemiparesis and facial droop.");
    else if (fullText.includes('right-sided weakness') || fullText.includes('right sided weakness')) findings.push("Right-sided hemiparesis and facial droop.");
    else findings.push("Focal neurologic asymmetry noted.");
  } else if (fullText.includes('dizzy') || fullText.includes('unsteady') || fullText.includes('gait instability')) {
    findings.push("Unsteady gait; subjective dizziness.");
  }

  if (findings.length === 0) {
    return ["Focused exam target: assess general appearance, mental status, airway and breathing, perfusion, pain or distress, and complaint-directed findings."];
  }

  return [`Focused exam target: ${findings.join(' ')}`];
}

function objectiveExamLines(caseData) {
  const physicalExamFacts = reviewedPhysicalExamFacts(caseData);
  if (!physicalExamFacts.length) return generateObjectiveExam(caseData);
  return physicalExamFacts.map((fact) => {
    const statement = cleanText(fact.statement || fact.rationale || '', '');
    if (!statement) return '';
    if (/^focused exam/i.test(statement)) return statement;
    const prefix = fact.provenance === 'source_record' ? 'Focused exam finding' : 'Focused exam target';
    return `${prefix}: ${statement}`;
  }).filter(Boolean);
}

const SOAP_NOTE_OMIT_PATTERNS = [
  /\bmissing\b/i,
  /\bnot documented\b/i,
  /\bnone documented\b/i,
  /\bnot specified\b/i,
  /\bnot recorded\b/i,
  /\bdoes not document\b/i,
  /\bdoes not provide\b/i,
  /\btriage history does not show\b/i,
  /\bcurrent source\b/i,
  /\bsource record\b/i,
  /\bsource bundle\b/i,
  /\bdata limitation\b/i,
  /\blimiting evidence\b/i,
  /\brequires? verification\b/i,
  /\bneed(?:s)? verification\b/i,
  /\bunavailable\b/i
];

function hasSoapOmittedLanguage(value) {
  const text = String(value || '');
  return SOAP_NOTE_OMIT_PATTERNS.some((pattern) => pattern.test(text));
}

function cleanSoapNarrative(value, fallback = '') {
  const text = stripMarkdown(value).replace(/\s+/g, ' ').trim();
  if (!text) return fallback;
  if (!hasSoapOmittedLanguage(text)) return text;
  const sentences = sentenceSplit(text).filter((sentence) => !hasSoapOmittedLanguage(sentence));
  return sentences.join(' ').trim() || fallback;
}

function cleanSoapList(items = []) {
  return uniqueSentences(items.map((item) => cleanSoapNarrative(item)).filter(Boolean));
}

function evidenceBoundSoapPrimaryDiagnosis(value, caseData) {
  const diagnosis = cleanSoapNarrative(value, 'Undifferentiated ED presentation');
  if (!caseData) return diagnosis;
  if (/\bsepsis|septic shock|septic\b/i.test(diagnosis) && !hasSepsisPrimaryEvidence(caseData)) {
    return soapPrimaryDiagnosis(caseData);
  }
  if (/\bseizure\b/i.test(diagnosis) && !/\bseizure|post-ictal|convulsion|epilep/i.test(soapClinicalText(caseData))) {
    return soapPrimaryDiagnosis(caseData);
  }
  return singleWorkingDiagnosis(diagnosis, caseData);
}

function sanitizeSoapNote(note = {}, caseData = null) {
  const subjective = note.subjective || {};
  const assessment = note.assessment || {};
  const ddx = Array.isArray(assessment.ddx) ? assessment.ddx : [];
  const plan = Array.isArray(note.plan) ? note.plan : [];

  return {
    subjective: {
      chief_concern: cleanSoapNarrative(subjective.chief_concern),
      history: cleanSoapNarrative(subjective.history),
      hpi: cleanSoapNarrative(subjective.hpi),
      pmh: cleanSoapNarrative(subjective.pmh),
      meds: cleanSoapNarrative(subjective.meds),
      allergies: cleanSoapNarrative(subjective.allergies)
    },
    objective: cleanSoapList(note.objective || []),
    assessment: {
      primary_diagnosis: evidenceBoundSoapPrimaryDiagnosis(assessment.primary_diagnosis, caseData),
      ddx: ddx.map((item) => ({
        diagnosis: cleanSoapNarrative(item?.diagnosis),
        rationale: cleanSoapNarrative(item?.rationale)
      })).filter((item) => item.diagnosis),
      justification: cleanSoapNarrative(assessment.justification)
    },
    plan: plan.map((item) => {
      if (item && typeof item === 'object') {
        return {
          problem: cleanSoapNarrative(item.problem, 'Care plan'),
          plan: cleanSoapNarrative(item.plan)
        };
      }
      return {
        problem: 'Care plan',
        plan: cleanSoapNarrative(item)
      };
    }).filter((item) => item.plan)
  };
}

function buildSoapNote(caseData, workflow) {
  const lowAcuityProfile = lowAcuityTeachingProfile(caseData);
  const patientView = buildPatientView(caseData) || {};

  const pmhList = [...(patientView.medical_history || []), ...(patientView.cardiac_history || [])];
  const medicationList = [...(patientView.medications || []), ...(patientView.negative_medications || [])];
  const pmh = pmhList.length ? joinClinicalList(pmhList) : '';
  const meds = medicationList.length ? joinClinicalList(medicationList) : '';
  const allergies = patientView.no_known_allergies ? 'No known drug allergies' : (patientView.allergies || []).length ? joinClinicalList(patientView.allergies) : '';

  const historyText = lowAcuityProfile
    ? `${capitalizeSentence(lowAcuityProfile.problem)} with stable triage vital signs and no danger-zone findings.`
    : clinicalHistoryDetails(caseData) || documentedMedicalHistoryText(caseData) || capitalizeSentence(patientView.presenting_concern || '');

  return sanitizeSoapNote({
    subjective: {
      chief_concern: capitalizeSentence(presentingProblemText(caseData)),
      history: '',
      hpi: capitalizeSentence(historyText),
      pmh: capitalizeSentence(pmh),
      meds: capitalizeSentence(meds),
      allergies: capitalizeSentence(allergies)
    },
    objective: [
      `Vitals: ${formattedVitalSigns(caseData)}.`,
      ...objectiveExamLines(caseData)
    ].filter(Boolean),
    assessment: {
      primary_diagnosis: soapPrimaryDiagnosis(caseData),
      ddx: soapDifferential(caseData),
      justification: soapJustification(caseData)
    },
    plan: soapPlan(caseData, workflow)
  }, caseData);
}

function buildPhysicianDebrief(session, caseData, workflow, scorecard, priorityItems = []) {
  const age = Math.round(Number(caseData.demographics.age || 0));
  const complaint = plainComplaint(caseData.complaint);
  const comparison = session.triage_level < caseData.acuity
    ? 'higher acuity than the reference'
    : session.triage_level > caseData.acuity
      ? 'lower acuity than the reference'
      : 'aligned with the reference acuity';
  const topPriorities = (priorityItems || []).slice(0, 3).map((item) => ({
    title: item.title,
    evidence: item.evidence,
    action: item.action
  }));

  return {
    case_summary: `${age}-year-old ${sexLabel(caseData.demographics.sex)} with ${complaint}. The reference acuity is ESI ${caseData.acuity}; the learner assigned ESI ${session.triage_level || 'not recorded'}, which was ${comparison}.`,
    physician_read: `${vitalSummaryText(caseData)} Expected resource signal: ${resourceSummaryText(caseData)}.`,
    gold_standard_sbar: buildGoldStandardSbar(caseData, workflow),
    soap_note: buildSoapNote(caseData, workflow),
    next_steps: topPriorities,
    score_percent: scorecard?.percentage || 0
  };
}

function generateFeedback(session) {
  const caseData = session.case;
  const selectedActionIds = (session.escalation_actions || []).map((item) => item.id);
  const workflow = {
    timing: {
      elapsed_seconds: session.elapsed_seconds,
      final_esi_time_seconds: session.timing_events.final_esi || session.elapsed_seconds,
      status: 'Recorded',
      events: clone(session.timing_events),
      message: 'Case clock records real elapsed time during the active case. Scoring is based on case evidence and clinical reasoning.'
    },
    interview: evaluateInterview(caseData, session.interview_log, session.support_uses, session.interview_mode, session.interview_gaps_acknowledged),
    focused_exam: evaluateFocusedExam(session, caseData),
    diagnosis: evaluateDiagnosis(session, caseData),
    referral: evaluateReferral(session, caseData),
    escalation: evaluateEscalation(caseData, selectedActionIds),
    reassessment: null,
    sbar: scoreSbar(session.sbar_handoff, caseData, session.triage_level)
  };
  workflow.reassessment = evaluateReassessment(session, caseData, workflow);
  const comparison = session.triage_level < caseData.acuity ? 'Over-triaged' : session.triage_level > caseData.acuity ? 'Under-triaged' : 'Correct triage';
  const recordedActions = clinicalFeedback(caseData);
  const scorecard = generateScorecard(session, caseData, workflow);
  const esiExplanation = buildEsiExplanation(session, caseData);
  const priorityItems = priorityFeedback(session, caseData, workflow, scorecard);
  const physicianDebrief = buildPhysicianDebrief(session, caseData, workflow, scorecard, priorityItems);
  const clinicalDecisionReview = buildClinicalDecisionReview(session, caseData, workflow, physicianDebrief.soap_note, esiExplanation);
  const decisionDeltas = legacyDecisionDeltas(clinicalDecisionReview);
  const nextCaseChecklist = buildNextCaseChecklist(clinicalDecisionReview.findings, physicianDebrief.soap_note, workflow, caseData);
  const physicianCaseReview = buildPhysicianCaseReview(
    session,
    caseData,
    physicianDebrief,
    clinicalDecisionReview,
    nextCaseChecklist,
    esiExplanation
  );
  const evidence = caseEvidence(caseData, recordedActions);
  const evidenceLanes = buildFeedbackEvidenceLanes({ caseData, workflow, caseEvidence: evidence });
  const feedback = {
    session_summary: {
      arrival_method: caseData.demographics.transport,
      chief_complaint: caseData.complaint,
      chief_complaint_question: session.chief_complaint_question,
      medical_history_question: session.medical_history_question,
      triage_rationale: session.triage_rationale,
      provisional_triage_level: session.provisional_triage_level,
      provisional_triage_rationale: session.provisional_triage_rationale,
      elapsed_seconds: session.elapsed_seconds,
      vitals_checked: session.checked_vitals,
      focused_exam: clone(session.focused_exam_results),
      interview_log: clone(session.interview_log),
      interview_mode: session.interview_mode,
      support_uses: clone(session.support_uses),
      working_diagnosis: session.working_diagnosis || '',
      differential: clone(session.differential || []),
      diagnosis_evidence: session.diagnosis_evidence || '',
      referral_needed: session.referral_needed,
      referral_specialty: session.referral_specialty || '',
      referral_rationale: session.referral_rationale || '',
      escalation_actions: clone(session.escalation_actions),
      escalation_rationale: session.escalation_rationale,
      initial_plan: clone(session.initial_plan || {}),
      reassessment_plan: clone(session.reassessment_plan || []),
      reassessment_rationale: session.reassessment_rationale || '',
      sbar_handoff: session.sbar_handoff,
      triage_level_assigned: session.triage_level
    },
    triage_analysis: {
      user_level: session.triage_level,
      expert_level: caseData.acuity,
      comparison,
      all_vitals: formatVitals(caseData),
      abnormal_vitals: vitalFlags(caseData),
      missing_vitals: [],
      reference_reasoning: [],
      missed_assessment: [],
      rationale_feedback: rationaleFeedback(session, caseData),
      final_esi_time_seconds: session.timing_events.final_esi || session.elapsed_seconds
    },
    clinical_feedback: recordedActions,
    workflow_analysis: workflow,
    scorecard,
    esi_explanation: esiExplanation,
    action_feedback: generateActionFeedback(session, caseData, workflow, scorecard.details),
    priority_feedback: priorityItems,
    physician_debrief: {
      ...physicianDebrief,
      next_case_checklist: nextCaseChecklist
    },
    physician_case_review: physicianCaseReview,
    clinical_decision_review: clinicalDecisionReview,
    decision_deltas: decisionDeltas,
    next_case_checklist: nextCaseChecklist,
    case_evidence: evidence,
    evidence_lanes: evidenceLanes,
    reasoning_rubrics: reasoningRubrics()
  };
  Object.assign(feedback, buildLearnerProfileFeedback(feedback));
  feedback.local_reasoning_review = buildLocalReasoningReview({ case: caseData, feedback });
  return feedback;
}

function getSession(id) {
  const session = sessions.get(id);
  if (!session) throw new Error('Session not found.');
  return session;
}

function adaptiveCasePool(playableCases) {
  const profile = readLearnerProfile();
  if (!profile.cases_completed) {
    const reviewedIds = new Set(['case_020', 'case_021', 'case_029', 'case_030', 'case_005']);
    const reviewedPool = playableCases.filter((c) => reviewedIds.has(c.id));
    return reviewedPool.length ? reviewedPool : playableCases;
  }
  const focus = learnerProfileFocus(profile);
  const selected = playableCases.filter((caseData) => {
    if (focus.id === 'under_triage') return caseData.acuity <= 2 || vitalFlags(caseData).length > 0 || expectedEscalationActions(caseData).length > 0;
    if (focus.id === 'over_triage') return caseData.acuity >= 4;
    if (focus.id === 'escalation_gap') return expectedEscalationActions(caseData).some((action) => action.category === focus.label);
    if (focus.id === 'interview_gap') {
      const required = interviewRequirements(caseData);
      const category = Object.entries(CATEGORY_LABELS).find(([, label]) => label === focus.label)?.[0];
      return category ? required.has(category) : true;
    }
    return true;
  });
  return selected.length ? selected : playableCases;
}

function visibleDecisionEvidence(session, stage = '') {
  const caseData = session.case;
  const progress = evaluateInterview(caseData, session.interview_log, session.support_uses, session.interview_mode, session.interview_gaps_acknowledged);
  const gathered = [
    `Presenting concern: ${capitalizeSentence(presentingProblemText(caseData))}`,
    progress.covered_domains.length ? `Interview domains covered: ${progress.covered_domains.join(', ')}` : '',
    session.provisional_triage_level ? `Working acuity: ESI ${session.provisional_triage_level}` : '',
    session.checked_vitals.length ? `Reviewed vitals: ${formattedVitalSigns(caseData)}` : '',
    session.triage_level ? `Final acuity selected: ESI ${session.triage_level}` : '',
    session.working_diagnosis ? `Working diagnosis: ${session.working_diagnosis}` : '',
    session.referral_needed !== null
      ? (session.referral_needed ? `Referral plan: ${session.referral_specialty}` : 'Referral plan: no immediate specialty input')
      : '',
    session.escalation_actions.length ? `Initial priorities selected: ${session.escalation_actions.map((item) => item.name).join(', ')}` : '',
    session.reassessment_plan.length ? `Reassessment targets selected: ${session.reassessment_plan.map((id) => reassessmentTargetLookup[id]?.label || id).join(', ')}` : ''
  ].filter(Boolean);
  const missing = [
    ...progress.missed_domains.map((domain) => `Interview: ${domain}`),
    !session.checked_vitals.length && ['final', 'diagnosis', 'referral', 'escalation', 'reassessment', 'sbar'].includes(stage) ? 'Objective vitals review' : '',
    !session.triage_rationale && ['final', 'diagnosis', 'referral', 'escalation', 'reassessment', 'sbar'].includes(stage) ? 'Final ESI rationale' : '',
    !session.working_diagnosis && ['referral', 'escalation', 'reassessment', 'sbar'].includes(stage) ? 'Working diagnosis' : '',
    session.referral_needed === null && ['escalation', 'reassessment', 'sbar'].includes(stage) ? 'Referral judgment' : '',
    !session.escalation_rationale && ['reassessment', 'sbar'].includes(stage) ? 'Initial management rationale' : '',
    !session.reassessment_rationale && ['sbar'].includes(stage) ? 'Reassessment rationale' : ''
  ].filter(Boolean);
  return { gathered, missing, progress };
}

function buildDecisionCoach(session, stage = 'interview') {
  const caseData = session.case;
  const { gathered, missing, progress } = visibleDecisionEvidence(session, stage);
  const flags = session.checked_vitals.length ? vitalFlags(caseData) : [];
  const expectedActions = expectedEscalationActions(caseData);
  const nextQuestion = progress.next_best_questions?.[0]?.question;
  const stageCopy = {
    interview: {
      title: 'Interview coach',
      esi_implication: progress.complete
        ? 'The focused interview has enough domain coverage to support an early acuity estimate.'
        : 'Missing interview domains can change risk, expected resources, and the first ESI estimate.',
      next_best_action: nextQuestion || 'Ask the next question that changes acuity, risk, or immediate action.',
      reasoning_frame: 'Use patient language to establish concern, time course, severity, red flags, and risk-changing background.'
    },
    provisional: {
      title: 'Initial ESI coach',
      esi_implication: 'Treat this as a working acuity call from the conversation. Vitals can still move the final decision.',
      next_best_action: missing.length ? `Reconcile ${missing.slice(0, 2).join(' and ')} before relying on the first ESI.` : 'State the strongest risk signal and what objective data could change the decision.',
      reasoning_frame: 'Name stability, high-risk features, and expected resources without overusing hindsight.'
    },
    final: {
      title: 'Final ESI coach',
      esi_implication: flags.length
        ? `Abnormal objective signals require reassessment: ${flags.slice(0, 2).map((item) => `${item.name} ${item.value}`).join('; ')}.`
        : 'When danger-zone vitals are absent, expected resources and risk features usually drive the ESI distinction.',
      next_best_action: 'Connect the selected ESI to stability, risk, vitals, and resource expectation in one concise rationale.',
      reasoning_frame: 'Separate immediate danger from resource prediction before choosing ESI 3, 4, or 5.'
    },
    diagnosis: {
      title: 'Diagnosis coach',
      esi_implication: 'The working diagnosis should stay provisional while still explaining the most likely threat.',
      next_best_action: 'State one working diagnosis, two alternatives, and the evidence that supports or argues against each.',
      reasoning_frame: 'Use history, vitals, exam targets, and acuity to explain uncertainty without pretending the diagnosis is final.'
    },
    referral: {
      title: 'Referral coach',
      esi_implication: 'Specialty input should be tied to a decision it changes: stabilization, diagnostic pathway, procedure, or disposition.',
      next_best_action: missing.length ? `Resolve ${missing.slice(0, 2).join(' and ')} before deciding referral.` : 'Choose whether specialty help is needed now and name the service if it is.',
      reasoning_frame: 'Referral judgment is about timing and clinical consequence, not naming every possible consult.'
    },
    escalation: {
      title: 'Initial management coach',
      esi_implication: expectedActions.length
        ? 'Escalation choices should match immediate safety, placement, monitoring, bleeding, respiratory, behavioral, or pain signals.'
        : 'No immediate escalation signal is obvious from the structured triage evidence.',
      next_best_action: expectedActions.length
        ? `Consider whether ${expectedActions.slice(0, 2).map((item) => item.name).join(' and ')} is supported by the case evidence.`
        : 'Document why routine waiting with reassessment is appropriate.',
      reasoning_frame: 'Choose actions that a triage nurse can initiate or escalate before routine queue placement.'
    },
    reassessment: {
      title: 'Reassessment coach',
      esi_implication: 'Reassessment closes the loop between initial priorities and safe handoff.',
      next_best_action: 'Select the specific changes you would recheck before handing off or moving the patient in the queue.',
      reasoning_frame: 'Tie each reassessment target to a threat that could worsen: vitals, pain, breathing, circulation, neurologic status, infection, or disposition safety.'
    },
    sbar: {
      title: 'SBAR coach',
      esi_implication: 'The handoff should make the acuity and next action clear enough for the receiving team to act.',
      next_best_action: 'Use one concise sentence each for situation, background, assessment, and recommendation.',
      reasoning_frame: 'SBAR should carry the case signal, not repeat every detail.'
    }
  };
  const copy = stageCopy[stage] || stageCopy.interview;
  return {
    stage,
    source: 'Local decision coach',
    title: copy.title,
    gathered_evidence: gathered.slice(0, 5),
    still_missing: missing.slice(0, 5),
    esi_implication: copy.esi_implication,
    next_best_action: copy.next_best_action,
    reasoning_frame: copy.reasoning_frame,
    next_best_questions: progress.next_best_questions || []
  };
}

export function getStaticDecisionCoach(id, stage = 'interview') {
  const session = getSession(id);
  return buildDecisionCoach(session, stage);
}

export async function askStaticInCaseCoach(id, stage = 'interview', learnerContext = '') {
  const session = getSession(id);
  const settings = getTutorSettings();
  if (!settings.key) throw new Error('Use AI settings in the header to enable the clinical coach.');
  const localCoach = buildDecisionCoach(session, stage);
  const content = await callOpenRouter([
    {
      role: 'system',
      content: [
        'You are an emergency physician coaching a triage learner during a simulation.',
        'Use only the supplied in-case coaching context.',
        'Do not reveal the reference ESI, disposition, outcome, or hidden scoring answer.',
        'Return strict JSON with summary, teaching_point, and next_best_action.'
      ].join(' ')
    },
    {
      role: 'user',
      content: JSON.stringify({
        stage,
        learner_context: learnerContext,
        local_coach: localCoach
      })
    }
  ], {
    key: settings.key,
    model: settings.model || DEFAULT_TUTOR_MODEL,
    maxTokens: 260,
    temperature: 0.15,
    responseFormat: { type: 'json_object' },
    timeoutMs: 12000
  });
  const parsed = extractJsonObject(content);
  return {
    source: 'OpenRouter',
    model: settings.model || DEFAULT_TUTOR_MODEL,
    summary: cleanText(stripMarkdown(parsed.summary), localCoach.esi_implication),
    teaching_point: cleanText(stripMarkdown(parsed.teaching_point), localCoach.reasoning_frame),
    next_best_action: cleanText(stripMarkdown(parsed.next_best_action), localCoach.next_best_action)
  };
}

export function startStaticSimulation() {
  const sourceState = activeCaseSourceState();
  const sourceCases = localResearchCaseBundle?.cases?.length ? localResearchCaseBundle.cases : cases;
  if (!sourceCases.length) throw new Error('No cases available.');
  const playableCases = sourceCases.filter((item) => {
    const complaint = String(item.complaint || '').trim();
    return Boolean(complaint) && !/#name\?/i.test(complaint);
  });
  const casePool = localResearchCaseBundle
    ? (playableCases.length ? playableCases : sourceCases)
    : (playableCases.length ? adaptiveCasePool(playableCases) : cases);
  const rawCaseData = clone(casePool[Math.floor(Math.random() * casePool.length)]);
  let caseData = { ...rawCaseData };
  const reviewedAug = reviewedAugmentations.cases[caseData.id];
  if (reviewedAug && reviewedAug.review_status === 'reviewed') {
    caseData.augmentation = clone(reviewedAug);
  }
  caseData = normalizeClinicalCase(caseData, sourceState.mode);
  const patientView = buildPatientView(caseData);
  const id = sessionId();
  const session = {
    id,
    case: caseData,
    patient_view: patientView,
    checked_vitals: [],
    chief_complaint_question: '',
    chief_complaint_response: '',
    medical_history_question: '',
    medical_history_response: '',
    provisional_triage_level: null,
    provisional_triage_rationale: '',
    triage_level: null,
    triage_rationale: '',
    working_diagnosis: '',
    differential: [],
    diagnosis_evidence: '',
    referral_needed: null,
    referral_specialty: '',
    referral_rationale: '',
    initial_plan: {
      diagnostics: '',
      treatments: '',
      medications: '',
      disposition: ''
    },
    interventions: [],
    escalation_actions: [],
    escalation_rationale: '',
    reassessment_plan: [],
    reassessment_rationale: '',
    sbar_handoff: '',
    elapsed_seconds: 0,
    started_at_ms: Date.now(),
    completed_at_ms: null,
    timing_events: {},
    interview_log: [],
    interview_mode: 'assessment',
    interview_gaps_acknowledged: false,
    support_uses: [],
    focused_exam_selection: [],
    focused_exam_results: null,
    response_cache: {}
  };
  sessions.set(id, session);
  const intake = buildIntakeReport(caseData);
  const interviewProgress = evaluateInterview(caseData, session.interview_log, session.support_uses, session.interview_mode, session.interview_gaps_acknowledged);
  return {
    session_id: id,
    age: Math.round(caseData.demographics.age),
    sex: caseData.demographics.sex,
    transport: caseData.demographics.transport,
    complaint: caseData.complaint,
    case_source: caseData.case_source,
    source_restriction: caseData.source_restriction,
    tasks_available: clone(caseData.tasks_available || {}),
    source_state: sourceState,
    intake,
    interview_modes: clone(INTERVIEW_MODES),
    interview_supports: clone(INTERVIEW_SUPPORTS),
    interview_mode: session.interview_mode,
    interview_progress: interviewProgress,
    clock: clock(session)
  };
}

export function recordStaticInterviewSupport(id, supportId) {
  const session = getSession(id);
  const modeMeta = INTERVIEW_MODES.find((item) => item.id === session.interview_mode) || INTERVIEW_MODES[0];
  if (!modeMeta.supports_enabled) throw new Error('Interview supports are not available in assessment mode.');
  const support = INTERVIEW_SUPPORTS.find((item) => item.id === supportId);
  if (!support) throw new Error('Invalid interview support.');
  let record = session.support_uses.find((item) => item.id === supportId);
  if (!record) {
    record = { ...support, mode: session.interview_mode, cost_seconds: 0, opened_at_seconds: recordElapsed(session, `interview_support_${supportId}`) };
    session.support_uses.push(record);
  }
  return { support: clone(record), support_uses: clone(session.support_uses), clock: clock(session) };
}

export function acknowledgeStaticInterviewGaps(id) {
  const session = getSession(id);
  const progress = evaluateInterview(session.case, session.interview_log, session.support_uses, session.interview_mode, false);
  if (!progress.minimum_met) throw new Error('Ask at least two focused questions before continuing with gaps.');
  if (progress.complete) {
    session.interview_gaps_acknowledged = false;
  } else {
    session.interview_gaps_acknowledged = true;
    recordElapsed(session, 'interview_gaps_acknowledged');
  }
  return {
    interview_progress: evaluateInterview(session.case, session.interview_log, session.support_uses, session.interview_mode, session.interview_gaps_acknowledged),
    clock: clock(session)
  };
}

export async function askStaticPatientQuestion(id, question) {
  const session = getSession(id);
  const text = String(question || '').trim();
  if (!text) throw new Error('Question is required.');
  if (!session.patient_view) session.patient_view = buildPatientView(session.case);
  const patientView = session.patient_view;
  const answerPlan = planPatientAnswer(text, patientView, recentPatientTurns(session, 8));
  const category = answerPlan.primary_category || classifyQuestion(text);
  const coveredCategories = answerPlan.covered_categories?.length ? answerPlan.covered_categories : classifyQuestionDomains(text);
  const metadata = questionMetadata(category);
  const intentKey = answerPlan.signature || questionIntentKey(text, category, coveredCategories);
  const cacheKey = intentKey;
  const fallbackAnswer = validatePatientAnswer({
    caseData: session.case,
    answer: renderPatientAnswer(answerPlan, patientView),
    intentKey,
    category,
    question: text,
    session: null,
    answerPlan,
    patientView
  }) || "I'm not sure how to answer that, but I can tell you what I am feeling.";

  let answerPayload = session.response_cache[cacheKey];

  if (answerPayload) {
    const cachedAnswer = validatePatientAnswer({
      caseData: session.case,
      answer: answerPayload.answer,
      intentKey,
      category,
      question: text,
      session,
      answerPlan,
      patientView
    });
    if (cachedAnswer) {
      answerPayload = {
        ...clone(answerPayload),
        question: text,
        answer: cachedAnswer,
        source: 'Cached patient response',
        cached: true
      };
    } else {
      delete session.response_cache[cacheKey];
      answerPayload = null;
    }
  } else {
    const persistentCached = readPersistentPatientCache(session.case, intentKey, {
      category,
      question: text,
      session,
      answerPlan,
      patientView
    });
    if (persistentCached) {
      answerPayload = {
        question: text,
        category,
        category_label: metadata.label,
        covered_categories: coveredCategories,
        answer: cleanPatientResponse(persistentCached.answer),
        source: 'Cached patient response',
        used_ai: Boolean(persistentCached.used_ai),
        cached: true,
        intent_key: intentKey,
        time_cost_seconds: metadata.cost_seconds
      };
      session.response_cache[cacheKey] = clone(answerPayload);
    } else if (!getTutorSettings().hasKey) {
      const semanticCached = await readSemanticPatientCache(session.case, text, category, coveredCategories, intentKey, {
        session,
        answerPlan,
        patientView
      });
      if (semanticCached) {
        answerPayload = {
          question: text,
          category,
          category_label: metadata.label,
          covered_categories: coveredCategories,
          answer: cleanPatientResponse(semanticCached.answer),
          source: 'Semantic patient response cache',
          used_ai: Boolean(semanticCached.used_ai),
          cached: true,
          semantic_score: semanticCached.semantic_score,
          semantic_match_id: semanticCached.semantic_match_id,
          intent_key: intentKey,
          matched_intent_key: semanticCached.intent_key,
          time_cost_seconds: metadata.cost_seconds
        };
        session.response_cache[cacheKey] = clone(answerPayload);
      }
    }
  }

  if (!answerPayload) {
    let answer = fallbackAnswer;
    let source = 'Local patient response';
    let usedAi = false;
    let aiError = '';
    let fallbackReason = '';
    let addressedIntents = answerPlan.intents || [];
    let usedFields = [];
    let uncertaintyUsed = /\b(not sure|don't know|do not know|not really sure)\b/i.test(fallbackAnswer);

    const settings = getTutorSettings();
    const restrictedCase = session.case?.source_restriction === 'credentialed_local_only';
    const aiAllowed = settings.hasKey && (!restrictedCase || settings.restrictedAiEnabled);
    if (settings.hasKey && !aiAllowed) {
      fallbackReason = 'Restricted local MIMIC AI calls require session opt-in.';
    }
    if (aiAllowed) {
      const aiPromise = askOpenRouterPatient(session, text, answerPlan, patientView, fallbackAnswer)
        .then((aiResult) => {
          const cleanedAiAnswer = validatePatientAnswer({
            caseData: session.case,
            answer: aiResult?.answer,
            intentKey,
            category,
            question: text,
            session,
            answerPlan,
            patientView,
            usedAi: true
          });
          if (!cleanedAiAnswer || normalizedAnswerText(cleanedAiAnswer) === normalizedAnswerText(fallbackAnswer)) {
            return null;
          }
          return { ...aiResult, answer: cleanedAiAnswer };
        })
        .catch((error) => {
          aiError = error.message || 'OpenRouter patient response failed.';
          return null;
        });

      const fastAiResult = await promiseWithTimeout(aiPromise, PATIENT_AI_FAST_TIMEOUT_MS);
      if (fastAiResult?.answer) {
        answer = fastAiResult.answer;
        source = 'OpenRouter patient response';
        usedAi = true;
        addressedIntents = fastAiResult.addressed_intents || addressedIntents;
        usedFields = fastAiResult.used_fields || [];
        uncertaintyUsed = Boolean(fastAiResult.uncertainty_used);
      } else {
        if (!aiError) fallbackReason = 'AI response timed out or failed validation.';
        aiPromise.then((backgroundResult) => {
          if (!backgroundResult?.answer) return;
          storePatientAnswer(session, cacheKey, {
            question: text,
            category,
            category_label: metadata.label,
            covered_categories: coveredCategories,
            answer: backgroundResult.answer,
            source: 'OpenRouter patient response',
            used_ai: true,
            cached: false,
            intent_key: intentKey,
            validated: true,
            fallback_reason: '',
            addressed_intents: backgroundResult.addressed_intents || answerPlan.intents || [],
            used_fields: backgroundResult.used_fields || [],
            uncertainty_used: Boolean(backgroundResult.uncertainty_used),
            ai_error: '',
            time_cost_seconds: metadata.cost_seconds
          });
        });
      }
    }

    answerPayload = {
      question: text,
      category,
      category_label: metadata.label,
      covered_categories: coveredCategories,
      answer,
      source,
      used_ai: usedAi,
      cached: false,
      intent_key: intentKey,
      validated: true,
      fallback_reason: usedAi ? '' : fallbackReason,
      addressed_intents: addressedIntents,
      used_fields: usedFields,
      uncertainty_used: uncertaintyUsed,
      ai_error: aiError,
      time_cost_seconds: metadata.cost_seconds
    };
    answerPayload = storePatientAnswer(session, cacheKey, answerPayload);
  }
  const displayedAnswer = validatePatientAnswer({
    caseData: session.case,
    answer: answerPayload.answer,
    intentKey,
    category,
    question: text,
    session: null,
    answerPlan,
    patientView
  }) || fallbackAnswer;
  const progressAfterTurn = evaluateInterview(
    session.case,
    [
      ...session.interview_log,
      {
        category,
        covered_categories: coveredCategories
      }
    ],
    session.support_uses,
    session.interview_mode,
    session.interview_gaps_acknowledged
  );
  const coverageConfidence = answerPlan.covered_categories?.length ? 'high' : 'estimated';
  const logItem = {
    ...clone(answerPayload),
    question: text,
    answer: displayedAnswer,
    category,
    category_label: metadata.label,
    covered_categories: coveredCategories,
    covered_domains: categoryLabels(coveredCategories),
    validated: answerPayload.validated !== false,
    fallback_reason: answerPayload.fallback_reason || '',
    addressed_intents: answerPayload.addressed_intents || answerPlan.intents || [],
    coverage_confidence: coverageConfidence,
    teaching_note: interviewTurnTeachingNote(coveredCategories, progressAfterTurn.missed_categories),
    elapsed_at_seconds: recordElapsed(session, `interview_question_${session.interview_log.length + 1}`)
  };
  session.interview_log.push(logItem);
  if (logItem.category === 'chief_concern' && !session.chief_complaint_question) {
    session.chief_complaint_question = text;
    session.chief_complaint_response = logItem.answer;
  }
  if (['medical_history', 'medications', 'prior_episode'].some((item) =>
    logItem.category === item || (logItem.covered_categories || []).includes(item)
  )) {
    session.medical_history_question = text;
    session.medical_history_response = logItem.answer;
  }
  return {
    response: logItem,
    questions_used: session.interview_log.length,
    interview_progress: evaluateInterview(session.case, session.interview_log, session.support_uses, session.interview_mode, session.interview_gaps_acknowledged),
    clock: clock(session)
  };
}

export function assignStaticProvisionalTriage(id, level, rationale = '') {
  const session = getSession(id);
  if (![1, 2, 3, 4, 5].includes(level)) throw new Error('Invalid triage level.');
  session.provisional_triage_level = level;
  session.provisional_triage_rationale = rationale;
  recordElapsed(session, 'provisional_esi');
  return { success: true, level, rationale, clock: clock(session) };
}

export function recordStaticVitalsReview(id) {
  const session = getSession(id);
  const vitals = formatVitals(session.case);
  session.checked_vitals = vitals;
  const physical_exam = reviewedPhysicalExamFacts(session.case);
  const missing_evidence = session.case.missing_evidence || [];
  recordElapsed(session, 'vitals_review');
  return { vitals, physical_exam, missing_evidence, clock: clock(session) };
}

export function recordStaticFocusedExam(id, selectedSystemIds = []) {
  const session = getSession(id);
  const vitals = session.checked_vitals?.length ? session.checked_vitals : formatVitals(session.case);
  if (!session.checked_vitals?.length) session.checked_vitals = vitals;
  const physicalExamFacts = reviewedPhysicalExamFacts(session.case);
  const result = buildFocusedExamSelection(session.case, selectedSystemIds, physicalExamFacts, vitals);
  session.focused_exam_selection = clone(result.selected_systems || []);
  session.focused_exam_results = clone(result);
  recordElapsed(session, 'focused_exam');
  return {
    ...clone(result),
    vitals,
    physical_exam: physicalExamFacts,
    clock: clock(session)
  };
}

export function assignStaticTriage(id, level, rationale = '') {
  const session = getSession(id);
  if (![1, 2, 3, 4, 5].includes(level)) throw new Error('Invalid triage level.');
  session.triage_level = level;
  session.triage_rationale = rationale;
  recordElapsed(session, 'final_esi');
  return { success: true, level, rationale, clock: clock(session) };
}

export function recordStaticDiagnosis(id, diagnosis = '', differential = [], evidence = '') {
  const session = getSession(id);
  const trimmedDiagnosis = String(diagnosis || '').trim();
  const trimmedEvidence = String(evidence || '').trim();
  const differentialItems = listFromValue(differential).slice(0, 5);
  if (trimmedDiagnosis.length < 3) throw new Error('Working diagnosis is required.');
  if (trimmedEvidence.length < 20) throw new Error('Diagnosis evidence is too short.');
  session.working_diagnosis = trimmedDiagnosis;
  session.differential = differentialItems;
  session.diagnosis_evidence = trimmedEvidence;
  recordElapsed(session, 'working_diagnosis');
  return {
    success: true,
    working_diagnosis: session.working_diagnosis,
    differential: clone(session.differential),
    evidence: session.diagnosis_evidence,
    clock: clock(session)
  };
}

export function getStaticReferralOptions(id) {
  const session = getSession(id);
  const approved = session.case.ground_truth?.referral?.clinician_approved_specialty || [];
  return uniqueSentences([...approved, ...COMMON_SPECIALTY_OPTIONS]).slice(0, 14);
}

export function submitStaticReferral(id, decision = {}) {
  const session = getSession(id);
  const needed = Boolean(decision.needed);
  const specialty = String(decision.specialty || '').trim();
  const rationale = String(decision.rationale || '').trim();
  if (needed && !specialty) throw new Error('Select a specialty when referral is needed.');
  if (rationale.length < 15) throw new Error('Referral rationale is too short.');
  session.referral_needed = needed;
  session.referral_specialty = needed ? specialty : '';
  session.referral_rationale = rationale;
  recordElapsed(session, 'referral');
  return {
    success: true,
    referral_needed: session.referral_needed,
    referral_specialty: session.referral_specialty,
    rationale: session.referral_rationale,
    clock: clock(session)
  };
}

export function getStaticEscalationActions(id) {
  getSession(id);
  return clone(TRIAGE_ACTIONS);
}

export function selectStaticEscalationActions(id, actionIds = [], rationale = '', planDetails = {}) {
  const session = getSession(id);
  const trimmedRationale = String(rationale || '').trim() || 'Selected standard clinical interventions based on presentation.';
  const selected = actionIds.filter((actionId) => actionLookup[actionId]).map((actionId) => clone(actionLookup[actionId]));
  session.initial_plan = {
    diagnostics: String(planDetails.diagnostics || '').trim(),
    treatments: String(planDetails.treatments || '').trim(),
    medications: String(planDetails.medications || '').trim(),
    disposition: String(planDetails.disposition || '').trim()
  };
  session.escalation_actions = selected;
  session.interventions = selected;
  session.escalation_rationale = trimmedRationale;
  recordElapsed(session, 'escalation');
  return {
    actions_performed: clone(selected),
    rationale: session.escalation_rationale,
    initial_plan: clone(session.initial_plan),
    clock: clock(session)
  };
}

export function submitStaticReassessment(id, selectedRisks = [], rationale = '') {
  const session = getSession(id);
  const trimmedRationale = String(rationale || '').trim();
  if (trimmedRationale.length < 15) throw new Error('Reassessment rationale is too short.');
  session.reassessment_plan = selectedRisks;
  session.reassessment_rationale = trimmedRationale;
  recordElapsed(session, 'reassessment');
  return { success: true, reassessment_plan: selectedRisks, rationale: trimmedRationale, clock: clock(session) };
}

export function submitStaticSbar(id, handoff) {
  const session = getSession(id);
  const text = String(handoff || '').trim();
  if (text.length < 20) throw new Error('Handoff is too short.');
  session.sbar_handoff = text;
  session.completed_at_ms = Date.now();
  recordElapsed(session, 'sbar');
  return { success: true, handoff: text, clock: clock(session) };
}

export function getStaticFeedback(id) {
  if (completedSessions.has(id)) {
    return completedSessions.get(id).feedback;
  }
  const session = getSession(id);
  if (!session.triage_level) {
    session.triage_level = session.provisional_triage_level || 3;
    session.triage_rationale = session.provisional_triage_rationale || 'Clinical rationale recorded.';
  }
  if (!session.completed_at_ms) recordElapsed(session, 'feedback');
  const feedback = generateFeedback(session);
  completedSessions.set(id, {
    case: session.case,
    feedback,
    triage_rationale: session.triage_rationale
  });
  sessions.delete(id);
  return feedback;
}

export function getCompletedSession(id) {
  return completedSessions.get(id);
}

export async function gradeStaticReasoningReview(id) {
  const completed = getCompletedSession(id);
  if (!completed) throw new Error('Complete the case before requesting an AI reasoning review.');
  const settings = getTutorSettings();
  if (!settings.key) throw new Error('Use AI settings in the header to enable the reasoning review.');

  const cached = readReasoningReviewCache(completed, settings.model);
  if (cached) {
    return {
      ...cached,
      cached: true,
      source: 'OpenRouter cache'
    };
  }

  const semanticCached = await readSemanticReasoningReviewCache(completed, settings.model);
  if (semanticCached) return semanticCached;

  const localCoverage = await localRubricConceptMatches(completed);
  const content = await callOpenRouter(buildReasoningReviewMessagesWithCoverage(completed, localCoverage), {
    key: settings.key,
    model: settings.model || DEFAULT_TUTOR_MODEL,
    maxTokens: 1600,
    temperature: 0.1
  });
  const review = normalizeReasoningReview(extractJsonObject(content), settings.model || DEFAULT_TUTOR_MODEL);
  writeReasoningReviewCache(completed, settings.model, review);
  return review;
}

export async function prewarmStaticSemanticCache() {
  return prewarmSemanticEmbeddings();
}

export function getTutorSettings() {
  const localKey = localStorage.getItem(TUTOR_LOCAL_KEY);
  const sessionKey = sessionStorage.getItem(TUTOR_SESSION_KEY);
  const key = localKey || sessionKey || '';
  const storage = localKey ? 'local' : sessionKey ? 'session' : 'local';
  const tutorModel = localStorage.getItem(TUTOR_MODEL_KEY) || DEFAULT_TUTOR_MODEL;
  const patientModel = localStorage.getItem(PATIENT_DIALOGUE_MODEL_KEY) || DEFAULT_PATIENT_DIALOGUE_MODEL;
  const restrictedAiEnabled = sessionStorage.getItem(RESTRICTED_AI_SESSION_KEY) === 'true';
  return {
    hasKey: Boolean(key),
    key,
    storage,
    model: tutorModel,
    tutorModel,
    patientModel,
    restrictedAiEnabled
  };
}

export function saveTutorSettings({ key, model = DEFAULT_TUTOR_MODEL, patientModel = DEFAULT_PATIENT_DIALOGUE_MODEL, restrictedAiEnabled = null }) {
  if (restrictedAiEnabled !== null && restrictedAiEnabled !== undefined) {
    sessionStorage.setItem(RESTRICTED_AI_SESSION_KEY, restrictedAiEnabled ? 'true' : 'false');
  }
  const trimmedKey = String(key || '').trim();
  if (!trimmedKey && restrictedAiEnabled !== null && restrictedAiEnabled !== undefined) return getTutorSettings();
  if (!trimmedKey) throw new Error('OpenRouter API key is required.');
  const provider = detectProvider(trimmedKey);
  const requestedModel = String(model || '').trim();
  const resolvedModel = provider === 'openrouter'
    ? (requestedModel || DEFAULT_TUTOR_MODEL)
    : (!requestedModel || /^openrouter\//i.test(requestedModel) ? getDefaultModelForProvider(provider) : requestedModel);
  sessionStorage.removeItem(TUTOR_SESSION_KEY);
  localStorage.removeItem(TUTOR_LOCAL_KEY);
  localStorage.setItem(TUTOR_LOCAL_KEY, trimmedKey);
  localStorage.setItem(TUTOR_STORAGE_KEY, 'local');
  localStorage.setItem(TUTOR_MODEL_KEY, resolvedModel);
  localStorage.setItem(PATIENT_DIALOGUE_MODEL_KEY, String(patientModel || DEFAULT_PATIENT_DIALOGUE_MODEL).trim() || DEFAULT_PATIENT_DIALOGUE_MODEL);
  return getTutorSettings();
}

export function clearTutorSettings() {
  sessionStorage.removeItem(TUTOR_SESSION_KEY);
  localStorage.removeItem(TUTOR_LOCAL_KEY);
  localStorage.removeItem(TUTOR_STORAGE_KEY);
  sessionStorage.removeItem(RESTRICTED_AI_SESSION_KEY);
  return getTutorSettings();
}

function conciseTutorContext(completed) {
  const feedback = completed.feedback || {};
  const summary = feedback.session_summary || {};
  const triage = feedback.triage_analysis || {};
  const workflow = feedback.workflow_analysis || {};
  const debrief = feedback.physician_debrief || {};
  return {
    patient: {
      age: Math.round(Number(completed.case?.demographics?.age || 0)),
      sex: completed.case?.demographics?.sex || '',
      arrival_method: completed.case?.demographics?.transport || '',
      chief_complaint: plainComplaint(completed.case?.complaint),
      reference_esi: completed.case?.acuity,
      learner_esi: triage.user_level,
      comparison: triage.comparison
    },
    physician_debrief: {
      case_summary: debrief.case_summary,
      physician_read: debrief.physician_read,
      gold_standard_sbar: debrief.gold_standard_sbar,
      soap_assessment: debrief.soap_note?.assessment || null,
      soap_plan_summary: (debrief.soap_note?.plan || []).slice(0, 3).map((p) =>
        typeof p === 'string' ? p : `${p.problem}: ${p.plan}`
      ),
      next_steps: (debrief.next_steps || []).slice(0, 3)
    },
    learner_decisions: {
      final_esi: summary.triage_level_assigned,
      escalation_actions: (summary.escalation_actions || []).map((item) => item.name),
      sbar_handoff: summary.sbar_handoff
    },
    interview: {
      questions: (summary.interview_log || []).slice(0, 8).map((item) => ({
        question: item.question,
        category: item.category_label || item.category
      })),
      covered: workflow.interview?.covered_domains || [],
      missed: workflow.interview?.missed_domains || []
    },
    escalation: {
      matched: workflow.escalation?.matched?.map((item) => item.name) || [],
      missed: workflow.escalation?.missed?.map((item) => item.name) || []
    },
    priority_feedback: feedback.priority_feedback || [],
    score_domains: (feedback.scorecard?.domains || []).map((item) => ({
      label: item.label,
      score: item.score,
      possible: item.possible,
      message: item.message
    }))
  };
}

function stripMarkdown(value) {
  return String(value || '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\|[-:\s|]+\|/g, '')
    .replace(/^\s*\|/gm, '')
    .replace(/\*\*/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\s+\n/g, '\n')
    .trim();
}

function normalizeTutorResponse(raw, model, fallbackContext = {}, source = 'OpenRouter') {
  const data = raw && typeof raw === 'object' ? raw : { summary: raw };
  const nextSteps = Array.isArray(data.next_steps)
    ? data.next_steps.slice(0, 4).map((item) => ({
        title: cleanText(stripMarkdown(item.title), 'Next step'),
        evidence: cleanText(stripMarkdown(item.evidence), ''),
        action: cleanText(stripMarkdown(item.action), '')
      }))
    : [];
  const hasSbar = Boolean(data.gold_standard_sbar || data.sbar);
  const sbar = data.gold_standard_sbar || data.sbar || {};
  return {
    source,
    model,
    role: 'Emergency physician tutor',
    summary: cleanText(stripMarkdown(data.summary), fallbackContext?.physician_debrief?.case_summary || 'Case review completed.'),
    teaching_point: cleanText(stripMarkdown(data.teaching_point), stripMarkdown(data.key_takeaway)),
    gold_standard_sbar: hasSbar ? {
      situation: cleanText(stripMarkdown(sbar.situation), ''),
      background: cleanText(stripMarkdown(sbar.background), ''),
      assessment: cleanText(stripMarkdown(sbar.assessment), ''),
      recommendation: cleanText(stripMarkdown(sbar.recommendation), '')
    } : null,
    next_steps: nextSteps,
    bullets: cleanTextList(data.bullets || data.high_yield_points).map(stripMarkdown).filter(Boolean)
  };
}

export async function askOpenRouterTutor(sessionIdValue, question) {
  const completed = getCompletedSession(sessionIdValue);
  if (!completed) throw new Error('Complete the case before asking the AI tutor.');
  const settings = getTutorSettings();
  if (!settings.key) throw new Error('Add an API key in AI Settings to use the clinical tutor.');

  const context = conciseTutorContext(completed);

  const messages = [
    {
      role: 'system',
      content: [
        'You are an experienced emergency room physician teaching a triage learner after a simulation.',
        'Use only the supplied case summary, scoring fields, and deterministic debrief evidence.',
        'Answer the learner question directly before giving case-specific teaching.',
        'If the learner asks a general medical term question, define the term clearly and then tie it to this case when relevant.',
        'Only include gold_standard_sbar when the learner explicitly asks for SBAR, handoff, or report; otherwise set gold_standard_sbar to null.',
        'Do not merely repeat the SBAR or resource counts unless the question asks for them.',
        'The teaching_point must explain a clinical reasoning principle, not repeat vital signs or resource totals.',
        'Return strict JSON only. No Markdown, tables, HTML, preface, or prose outside JSON.',
        'Keep the response concise: one direct answer, one teaching point, and at most three next steps when useful.',
        'Do not invent diagnoses, tests, procedures, protocols, or hidden chart details.'
      ].join(' ')
    },
    {
      role: 'user',
      content: JSON.stringify({
        learner_question: question,
        expected_json_schema: {
          summary: 'direct answer to the learner question in one concise paragraph',
          teaching_point: 'one case-specific clinical reasoning sentence',
          gold_standard_sbar: 'object only if the learner asks for SBAR/handoff/report; otherwise null',
          sbar_shape_if_needed: {
            situation: 'one sentence',
            background: 'one sentence',
            assessment: 'one sentence',
            recommendation: 'one sentence'
          },
          next_steps: [
            {
              title: 'short label',
              evidence: 'case evidence phrase',
              action: 'specific action for next case'
            }
          ],
          bullets: ['optional short point']
        },
        case_context: context
      })
    }
  ];

  let content;
  const requestOptions = {
    key: settings.key,
    model: settings.model || DEFAULT_TUTOR_MODEL,
    maxTokens: 520,
    temperature: 0.15,
    timeoutMs: 15000
  };

  try {
    content = await callOpenRouter(messages, {
      ...requestOptions,
      responseFormat: { type: 'json_object' }
    });
  } catch (err) {
    if (!/response[_\s-]?format|json_object/i.test(err.message || '')) throw err;
    content = await callOpenRouter(messages, requestOptions);
  }

  try {
    return normalizeTutorResponse(extractJsonObject(content), settings.model || DEFAULT_TUTOR_MODEL, context);
  } catch {
    return normalizeTutorResponse({
      summary: stripMarkdown(content),
      teaching_point: 'Connect the answer back to the case evidence before changing acuity or escalation decisions.',
      next_steps: []
    }, settings.model || DEFAULT_TUTOR_MODEL, context);
  }
}

function debriefContext(completed) {
  const context = conciseTutorContext(completed);
  // Override with full interview log for deep debrief analysis
  if (completed.feedback?.session_summary?.interview_log) {
    context.interview.questions = completed.feedback.session_summary.interview_log.map(item => ({
      question: item.question,
      category: item.category_label || item.category,
      answer: item.answer
    }));
  }
  return context;
}

export async function askOpenRouterDebrief(sessionIdValue) {
  const completed = getCompletedSession(sessionIdValue);
  if (!completed) throw new Error('Complete the case before asking the AI for debrief.');
  const settings = getTutorSettings();
  if (!settings.key) throw new Error('Use AI settings in the header to enable the AI debrief.');

  const context = debriefContext(completed);
  const messages = [
    {
      role: 'system',
      content: [
        'You are an experienced, board-certified emergency room physician.',
        'Your task is to generate a realistic, highly clinical Expert SOAP Note and personalized clinical tips for the triage learner based on their performance.',
        'The SOAP note must demonstrate clinical reasoning and thought, explicitly tailored to the acute diagnosis of the patient. Keep the subjective and objective sections extremely concise, focusing heavily on a comprehensive Assessment and Plan.',
        'The primary diagnosis must be one clinically coherent working diagnosis supported by the provided evidence. Do not make sepsis, seizure, stroke, or another named diagnosis primary unless the case data includes findings that support it.',
        'For sepsis, require infection evidence such as fever or hypothermia plus a plausible infectious source, explicit sepsis language, pneumonia, abscess, cellulitis, gangrene, osteomyelitis, purulence, urinary infection, or peritonitis. Tachycardia, severe pain, or altered mental status alone are not enough.',
        'For severe abdominal pain with altered mental status and no infection evidence, prioritize vascular, bleeding, ischemic, obstructive, or surgical abdominal emergencies over sepsis.',
        'Do not describe missing, unavailable, undocumented, or source-limited data in the SOAP assessment or plan. Omit unknown PMH, medication, allergy, exam, and diagnostic details instead of documenting them as absent.',
        'In the Assessment, include past medical history only when it changes the acute differential, risk, monitoring, or treatment plan. Do not mention irrelevant chronic diagnoses.',
        'Write differential rationales as physician documentation: state why the diagnosis fits the presentation and which present findings make it less likely. Do not use labels such as "matches this patient", "best discriminator", "acuity implication", "reference ESI", "resource use", or "source record".',
        'The clinical tips MUST follow this strict structure: "Key red flags you caught / missed", "Interview quality", "What to do differently next time". Provide concrete, specific feedback based on the exact case data and learner log.',
        'Return strict JSON only. No Markdown outside the JSON.'
      ].join(' ')
    },
    {
      role: 'user',
      content: JSON.stringify({
        expected_json_schema: {
          expert_soap_note: {
            subjective: { chief_concern: 'string', hpi: 'string', pmh: 'string', meds: 'string', allergies: 'string' },
            objective: ['string array of findings'],
            assessment: {
              primary_diagnosis: 'string',
              justification: 'detailed clinical rationale paragraph',
              ddx: [
                { diagnosis: 'string', rationale: 'string' }
              ]
            },
            plan: [
              { problem: 'string', plan: 'string' }
            ]
          },
          clinical_tips: {
            red_flags: ['bullet list of red flags caught or missed'],
            interview_quality: ['bullet list highlighting important questions asked or omitted'],
            what_to_do_differently: ['one or two concrete behavior changes']
          }
        },
        case_context: context
      })
    }
  ];

  let content;
  const requestOptions = {
    key: settings.key,
    model: settings.model || DEFAULT_TUTOR_MODEL,
    maxTokens: 1000,
    temperature: 0.2,
    timeoutMs: 25000
  };

  try {
    content = await callOpenRouter(messages, {
      ...requestOptions,
      responseFormat: { type: 'json_object' }
    });
  } catch (err) {
    if (!/response[_\s-]?format|json_object/i.test(err.message || '')) throw err;
    content = await callOpenRouter(messages, requestOptions);
  }

  try {
    const parsed = extractJsonObject(content);
    if (parsed?.expert_soap_note) {
      parsed.expert_soap_note = sanitizeSoapNote(parsed.expert_soap_note, completed.case);
    }
    return parsed;
  } catch {
    return null; // Fallback if parse fails
  }
}
