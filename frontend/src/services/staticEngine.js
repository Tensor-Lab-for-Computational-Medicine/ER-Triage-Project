import cases from '../data/cases.json';
import { findSemanticMatch, prewarmSemanticEmbeddings, semanticEmbeddingMetadata } from './embeddingService';

const sessions = new Map();
const completedSessions = new Map();

export const DEFAULT_TUTOR_MODEL = 'openrouter/free';
const TUTOR_SESSION_KEY = 'ed_triage_openrouter_key';
const TUTOR_LOCAL_KEY = 'ed_triage_openrouter_key';
const TUTOR_MODEL_KEY = 'ed_triage_openrouter_model';
const TUTOR_STORAGE_KEY = 'ed_triage_openrouter_storage';
const PATIENT_RESPONSE_CACHE_KEY = 'ed_triage_patient_response_cache_v1';
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
      { label: 'Early acuity estimate', points: 4, description: 'Uses the first-look and interview evidence available before vital review.' },
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

const FIRST_LOOK_OPTIONS = [
  {
    id: 'stable_to_interview',
    label: 'Stable to interview',
    description: 'Begin focused triage questions while monitoring for new danger signs.'
  },
  {
    id: 'immediate_room',
    label: 'Immediate room',
    description: 'Move the patient out of the waiting flow and notify the care team.'
  },
  {
    id: 'resuscitation_now',
    label: 'Resuscitation now',
    description: 'Treat as an immediate threat to airway, breathing, circulation, or neurologic safety.'
  }
];

const QUESTION_CATALOG = [
  { id: 'general_status', label: 'General status', cost_seconds: 15 },
  { id: 'chief_concern', label: 'Chief concern', cost_seconds: 30 },
  { id: 'timeline', label: 'Onset and timeline', cost_seconds: 35 },
  { id: 'severity', label: 'Severity and current distress', cost_seconds: 30 },
  { id: 'red_flags', label: 'Red flags', cost_seconds: 45 },
  { id: 'medical_history', label: 'Medical history', cost_seconds: 35 },
  { id: 'medications', label: 'Medications and blood thinners', cost_seconds: 35 },
  { id: 'prior_episode', label: 'Prior episodes', cost_seconds: 35 },
  { id: 'pregnancy', label: 'Pregnancy status', cost_seconds: 25 },
  { id: 'allergies', label: 'Allergies', cost_seconds: 25 }
];

const CATEGORY_LABELS = Object.fromEntries(QUESTION_CATALOG.map((item) => [item.id, item.label]));

const QUESTION_DOMAIN_CHECKS = [
  ['timeline', ['when', 'start', 'began', 'long', 'sudden', 'gradual', 'changed', 'worse']],
  ['red_flags', ['breath', 'chest pain', 'faint', 'passed out', 'weak', 'numb', 'bleed', 'vomit', 'fever', 'confus']],
  ['severity', ['bad', 'severe', 'pain', 'scale', 'distress', 'right now']],
  ['medical_history', ['medical', 'history', 'problems', 'conditions', 'disease', 'diabetes', 'heart']],
  ['medications', ['med', 'medicine', 'blood thinner', 'anticoagul', 'daily', 'take']],
  ['prior_episode', ['before', 'again', 'previous', 'prior', 'ever had', 'like this']],
  ['pregnancy', ['pregnan', 'period', 'lmp']],
  ['allergies', ['allerg']]
];

const INTERVIEW_MODES = [
  {
    id: 'assessment',
    label: 'Assessment',
    description: 'Free-text or dictated questions only; concept coverage appears after the case.',
    supports_enabled: false,
    support_cost_seconds: 0
  },
  {
    id: 'intermediate',
    label: 'Practice',
    description: 'Editable question frames are available and add simulated time when opened.',
    supports_enabled: true,
    support_cost_seconds: 20
  },
  {
    id: 'beginner',
    label: 'Guided',
    description: 'Editable question frames are available for early practice without clock cost.',
    supports_enabled: true,
    support_cost_seconds: 0
  }
];

const INTERVIEW_SUPPORTS = [
  {
    id: 'symptom_course',
    label: 'Clarify symptom course',
    cue: 'Frame a question about onset, progression, duration, or what changed.',
    intent: 'Establish whether the problem is new, worsening, sudden, or persistent.',
    question_stem: 'When did this start, and has it been getting better, worse, or changing?'
  },
  {
    id: 'immediate_risk',
    label: 'Screen for immediate risk',
    cue: 'Look for threats to breathing, circulation, neurologic safety, bleeding, or severe distress.',
    intent: 'Find symptoms that would make routine waiting unsafe.',
    question_stem: 'Are you having trouble breathing, chest pain, fainting, weakness, confusion, heavy bleeding, or severe distress right now?'
  },
  {
    id: 'relevant_background',
    label: 'Assess relevant background',
    cue: 'Connect medical history, medications, allergies, or prior episodes to the current concern.',
    intent: 'Identify history, medication, allergy, or prior-episode details that change triage risk.',
    question_stem: 'What medical problems, medicines, allergies, or similar prior episodes should I know about?'
  },
  {
    id: 'special_population',
    label: 'Check special population risks',
    cue: 'Consider age, pregnancy, anticoagulation, immunocompromise, or other context that changes risk.',
    intent: 'Check context that can make a presentation higher risk even when the complaint sounds common.',
    question_stem: 'Is there anything like pregnancy, blood thinners, immune problems, frailty, or another risk factor that could make this more serious?'
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
    evidence_type: 'MIETIC record or ESI/vitals'
  },
  {
    id: 'vascular_access',
    name: 'Prioritize vascular access and bloodwork',
    category: 'Access and circulation',
    description: 'Supported by IV access, IV fluids, parenteral medications, labs, transfusion, or resource counts.',
    evidence_type: 'MIETIC record'
  },
  {
    id: 'medication_route_priority',
    name: 'Anticipate medication route needs',
    category: 'Medications',
    description: 'Supported by recorded IV, IM, nebulized, psychotropic, or medication-tier fields.',
    evidence_type: 'MIETIC record'
  },
  {
    id: 'bleeding_transfusion_readiness',
    name: 'Escalate bleeding or transfusion readiness',
    category: 'Access and circulation',
    description: 'Supported by transfusion, red-cell order, shock-like vitals, or bleeding language in the case.',
    evidence_type: 'MIETIC record or ESI/vitals'
  },
  {
    id: 'critical_procedure_team',
    name: 'Prepare for critical procedure support',
    category: 'Critical procedures',
    description: 'Supported by recorded critical procedure, emergency medication, or immediate stabilization signals.',
    evidence_type: 'MIETIC record'
  },
  {
    id: 'behavioral_safety',
    name: 'Begin behavioral safety precautions',
    category: 'Safety',
    description: 'Supported by psychotropic medication use or behavioral health risk language in the case.',
    evidence_type: 'MIETIC record or case text'
  },
  {
    id: 'pain_reassessment',
    name: 'Flag severe pain for reassessment',
    category: 'Safety',
    description: 'Supported by the structured triage pain score.',
    evidence_type: 'MIETIC vitals'
  }
];

const TRIAGE_ACTION_ORDER = TRIAGE_ACTIONS.map((item) => item.id);
const actionLookup = Object.fromEntries(TRIAGE_ACTIONS.map((item) => [item.id, item]));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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

function vitalFlags(caseData) {
  const { vitals } = caseData;
  const flags = [];
  if (vitals.hr !== null && vitals.hr !== undefined) {
    if (vitals.hr >= 130 || vitals.hr < 50) flags.push({ name: 'Heart Rate', value: `${vitals.hr} bpm`, severity: 'critical', reason: 'danger-zone heart rate' });
    else if (vitals.hr >= 110 || vitals.hr < 60) flags.push({ name: 'Heart Rate', value: `${vitals.hr} bpm`, severity: 'watch', reason: 'abnormal heart rate' });
  }
  if (vitals.sbp !== null && vitals.sbp !== undefined) {
    const bp = `${Math.round(vitals.sbp)}/${Math.round(vitals.dbp)} mmHg`;
    if (vitals.sbp < 90 || vitals.sbp >= 180) flags.push({ name: 'Blood Pressure', value: bp, severity: 'critical', reason: 'danger-zone blood pressure' });
    else if (vitals.sbp < 100 || vitals.sbp >= 160) flags.push({ name: 'Blood Pressure', value: bp, severity: 'watch', reason: 'abnormal blood pressure' });
  }
  if (vitals.rr !== null && vitals.rr !== undefined) {
    if (vitals.rr >= 30 || vitals.rr < 8) flags.push({ name: 'Respiratory Rate', value: `${vitals.rr} breaths/min`, severity: 'critical', reason: 'danger-zone respiratory rate' });
    else if (vitals.rr >= 22 || vitals.rr < 12) flags.push({ name: 'Respiratory Rate', value: `${vitals.rr} breaths/min`, severity: 'watch', reason: 'abnormal respiratory rate' });
  }
  if (vitals.o2 !== null && vitals.o2 !== undefined) {
    if (vitals.o2 < 90) flags.push({ name: 'Oxygen Saturation', value: `${vitals.o2}%`, severity: 'critical', reason: 'hypoxemia' });
    else if (vitals.o2 < 94) flags.push({ name: 'Oxygen Saturation', value: `${vitals.o2}%`, severity: 'watch', reason: 'borderline oxygenation' });
  }
  if (vitals.temp !== null && vitals.temp !== undefined) {
    if (vitals.temp >= 103 || vitals.temp < 95) flags.push({ name: 'Temperature', value: `${vitals.temp} F`, severity: 'critical', reason: 'danger-zone temperature' });
    else if (vitals.temp >= 100.4 || vitals.temp < 96.8) flags.push({ name: 'Temperature', value: `${vitals.temp} F`, severity: 'watch', reason: 'abnormal temperature' });
  }
  if (vitals.pain !== null && vitals.pain !== undefined) {
    if (vitals.pain >= 8) flags.push({ name: 'Pain Level', value: `${vitals.pain}/10`, severity: 'critical', reason: 'severe pain or distress' });
    else if (vitals.pain >= 5) flags.push({ name: 'Pain Level', value: `${vitals.pain}/10`, severity: 'watch', reason: 'moderate pain' });
  }
  return flags;
}

function firstLook(caseData) {
  const flags = vitalFlags(caseData);
  const text = complaintText(caseData);
  const interventions = caseData.interventions;
  const cues = [];

  if (caseData.demographics.transport && caseData.demographics.transport.toLowerCase() !== 'unknown') {
    cues.push({ label: 'Arrival', value: caseData.demographics.transport });
  }
  if (hasAny(text, ['shortness', 'sob', 'dyspnea', 'breath', 'respiratory']) || flags.some((item) => ['Oxygen Saturation', 'Respiratory Rate'].includes(item.name))) {
    cues.push({ label: 'Breathing', value: 'Respiratory symptom or respiratory vital abnormality documented.' });
  } else {
    cues.push({ label: 'Breathing', value: 'No respiratory warning signal documented.' });
  }
  if (flags.some((item) => ['Blood Pressure', 'Heart Rate'].includes(item.name)) || caseData.transfusion_within_1h || caseData.red_cell_order_more_than_1) {
    cues.push({ label: 'Circulation', value: 'Perfusion, bleeding, or hemodynamic signal documented.' });
  } else {
    cues.push({ label: 'Circulation', value: 'No circulation warning signal documented.' });
  }
  if (hasAny(text, ['altered', 'confus', 'letharg', 'syncope', 'seizure', 'stroke', 'weakness', 'speech'])) {
    cues.push({ label: 'Neurologic safety', value: 'Neurologic or mental-status concern documented.' });
  }
  if (caseData.vitals.pain >= 8) {
    cues.push({ label: 'Distress', value: 'Severe pain or distress documented.' });
  }

  const criticalVital = flags.some((item) => item.severity === 'critical');
  const immediateRecord = interventions.invasive_ventilation || interventions.critical_procedure || caseData.expired_within_1h;
  let recommended = 'stable_to_interview';
  if (caseData.acuity === 1 || criticalVital || immediateRecord) {
    recommended = 'resuscitation_now';
  } else if (caseData.acuity === 2 || flags.length || caseData.transfer_to_icu_in_1h || caseData.transfer2surgeryin1h || interventions.tier1_med_usage_1h) {
    recommended = 'immediate_room';
  }

  return { cues, recommended_disposition: recommended, options: clone(FIRST_LOOK_OPTIONS) };
}

function advanceTime(session, seconds, eventName) {
  session.elapsed_seconds += seconds;
  if (eventName) session.timing_events[eventName] = session.elapsed_seconds;
}

function clock(session) {
  return {
    elapsed_seconds: session.elapsed_seconds,
    timing_events: clone(session.timing_events)
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
  if (!domains.length || ['what brought', 'what happened', 'why', 'main', 'concern', 'happening', 'going on'].some((term) => q.includes(term))) {
    domains.unshift('chief_concern');
  }
  return [...new Set(domains)];
}

function classifyQuestion(question) {
  return classifyQuestionDomains(question)[0];
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

  const domains = [...new Set(coveredCategories.length ? coveredCategories : [category])].sort();
  const symptoms = symptomIntentKeys(q);
  if (domains.includes('red_flags')) {
    const redFlagSymptoms = symptoms.filter((symptom) => symptom !== 'pain' || symptoms.length === 1);
    return `red_flags:${redFlagSymptoms.length ? redFlagSymptoms.join(',') : 'broad'}`;
  }
  if (domains.includes('medications')) return 'medications';
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

function primarySymptom(caseData) {
  const complaint = plainComplaint(caseData.complaint).toLowerCase();
  const text = complaintText(caseData);
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
    .filter(Boolean)
    .slice(0, maxItems)
    .join(', ');
}

function medicalHistoryAnswer(caseData) {
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
    /allerg(?:y|ies)\s*(?:to|include|includes)?\s+([^.;]+)/i
  ]);
  if (allergy) return `I'm allergic to ${compactList(allergy, 3)}.`;
  return "I don't know of any medication allergies.";
}

function timelineAnswer(caseData) {
  const history = String(caseData.history || '');
  const timeMatch = history.match(/\b(\d+\s*(?:minutes?|mins?|hours?|hrs?|days?|weeks?|months?)\s*(?:ago|before|prior|earlier)?)\b/i);
  if (timeMatch) return `It started about ${timeMatch[1].toLowerCase()}.`;

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

function isAnswerKeyQuestion(question) {
  const q = String(question || '').toLowerCase();
  if (/\b(esi|triage level|acuity|disposition|final decision|expert opinion|expert answer)\b/.test(q)) return true;
  if (/\b(what|which|why)\b.*\b(resource|resources|intervention|interventions|test|tests|procedure|procedures|treatment|treatments)\b/.test(q)) return true;
  if (/\b(what did|what does|what will|what would)\b.*\b(ed|doctor|nurse|clinician|team)\b.*\b(do|did|give|order|place|perform)\b/.test(q)) return true;
  if (/\b(will|would|should|going to)\b.*\b(admit|admitted|admission|icu|discharge|transfer|intubat|iv)\b/.test(q)) return true;
  if (/\b(did|does|do)\b.*\b(ed|doctor|nurse|clinician|team)\b.*\b(admit|intubat|place an iv|start an iv|transfer)\b/.test(q)) return true;
  return false;
}

function categoryResponse(caseData, category, question = '') {
  if (isAnswerKeyQuestion(question)) {
    return "I don't know that as the patient. I can tell you what I'm feeling, what happened, and what medical history I know.";
  }

  const responses = {
    general_status: generalStatusAnswer(caseData),
    chief_concern: chiefConcernAnswer(caseData),
    timeline: timelineAnswer(caseData),
    severity: severityAnswer(caseData),
    red_flags: redFlagAnswer(caseData, question),
    medical_history: medicalHistoryAnswer(caseData),
    medications: medicationAnswer(caseData),
    prior_episode: priorEpisodeAnswer(caseData),
    pregnancy: pregnancyAnswer(caseData),
    allergies: allergyAnswer(caseData)
  };
  return responses[category] || responses.chief_concern;
}

function patientNarrativeForModel(caseData) {
  const blocked = [
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
  return {
    age: Math.round(Number(caseData.demographics.age || 0)),
    sex: caseData.demographics.sex,
    arrival_transport: caseData.demographics.transport,
    chief_complaint: plainComplaint(caseData.complaint),
    patient_story: patientNarrativeForModel(caseData),
    pain_score_if_asked: caseData.vitals?.pain ?? null,
    likely_patient_phrasing: {
      general_status: generalStatusAnswer(caseData),
      chief_concern: chiefConcernAnswer(caseData),
      medical_history: medicalHistoryAnswer(caseData),
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
  return `${caseData.id || 'case'}::${intentKey}`;
}

function readPersistentPatientCache(caseData, intentKey) {
  const store = patientCacheStore();
  return store[patientCacheId(caseData, intentKey)] || null;
}

function writePersistentPatientCache(caseData, intentKey, payload) {
  try {
    const store = patientCacheStore();
    const key = patientCacheId(caseData, intentKey);
    store[key] = {
      question: payload.question,
      answer: cleanPatientResponse(payload.answer),
      source: payload.source,
      used_ai: Boolean(payload.used_ai),
      intent_key: intentKey,
      category: payload.category,
      category_label: payload.category_label,
      covered_categories: payload.covered_categories || [],
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

function readClinicalSemanticPatientCache(caseData, question) {
  const casePrefix = `${caseData.id || 'case'}::`;
  const candidates = Object.entries(patientCacheStore())
    .filter(([key, payload]) => key.startsWith(casePrefix) && payload?.question && payload?.answer && payload.intent_key !== 'answer_key')
    .map(([key, payload]) => ({
      key,
      payload,
      score: clinicalSemanticSimilarity(question, payload.question)
    }))
    .sort((a, b) => b.score - a.score);

  const best = candidates[0];
  if (!best || best.score < 0.82) return null;
  return {
    ...best.payload,
    semantic_score: Number(best.score.toFixed(3)),
    semantic_match_id: best.key
  };
}

async function readSemanticPatientCache(caseData, question, category, coveredCategories = []) {
  const clinicalMatch = readClinicalSemanticPatientCache(caseData, question);
  if (clinicalMatch) return clinicalMatch;

  const casePrefix = `${caseData.id || 'case'}::`;
  const candidates = Object.entries(patientCacheStore())
    .filter(([key, payload]) => {
      if (!key.startsWith(casePrefix) || !payload?.question || !payload?.answer) return false;
      return payload.intent_key !== 'answer_key';
    })
    .sort((a, b) => String(b[1]?.updated_at || '').localeCompare(String(a[1]?.updated_at || '')))
    .map(([key, payload]) => ({ id: key, payload }));

  try {
    const match = await findSemanticMatch({
      namespace: `patient_response:${caseData.id || 'case'}`,
      queryText: patientSemanticText({
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
    return {
      ...match.candidate.payload,
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

async function callOpenRouter(messages, { model, key, maxTokens = 220, temperature = 0.25 }) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'ED Triage Trainer'
    },
    body: JSON.stringify({
      model: model || DEFAULT_TUTOR_MODEL,
      messages,
      temperature,
      max_tokens: maxTokens
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `OpenRouter request failed with status ${response.status}`);
  }

  const json = await response.json();
  const message = json?.choices?.[0]?.message || {};
  const content = extractOpenRouterMessageContent(message);
  if (!content) throw new Error('OpenRouter returned no response content.');
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

async function askOpenRouterPatient(session, question, category, intentKey) {
  const settings = getTutorSettings();
  if (!settings.key) return null;

  const localFallback = categoryResponse(session.case, category, question);
  const answer = await callOpenRouter(
    [
      {
        role: 'system',
        content: [
          'You are portraying a patient during emergency department triage.',
          'Answer in first person as the patient, using plain layperson language.',
          'Answer only the question asked in one or two short sentences.',
          'Do not mention MIETIC, datasets, records, ESI, acuity, disposition, admission, ICU transfer, expert opinions, resource use, or ED interventions.',
          'Do not reveal vital signs except the pain score if the learner asks about pain.',
          'If asked for diagnosis, triage level, admission status, treatments, test results, or what clinicians did, say you do not know that as the patient.',
          'Stay consistent with the supplied patient facts. Do not invent unrelated symptoms.'
        ].join(' ')
      },
      {
        role: 'user',
        content: JSON.stringify({
          learner_question: question,
          response_intent: intentKey,
          local_safe_answer: localFallback,
          patient_facts: patientFactsForModel(session.case)
        })
      }
    ],
    {
      key: settings.key,
      model: settings.model || DEFAULT_TUTOR_MODEL,
      maxTokens: 320,
      temperature: 0.35
    }
  );

  return cleanPatientResponse(answer, localFallback);
}

function interviewRequirements(caseData) {
  const required = new Set(['chief_concern', 'timeline', 'severity']);
  const text = complaintText(caseData);
  if (caseData.acuity <= 2 || vitalFlags(caseData).length) required.add('red_flags');
  if (caseData.history) required.add('medical_history');
  if (hasAny(text, ['blood thinner', 'anticoagul', 'warfarin', 'xarelto', 'eliquis', 'plavix', 'aspirin'])) required.add('medications');
  const age = Number(caseData.demographics.age || 0);
  if (String(caseData.demographics.sex || '').toUpperCase().startsWith('F') && age >= 12 && age <= 55) required.add('pregnancy');
  return required;
}

function evaluateInterview(caseData, interviewLog, supportUses = [], mode = 'assessment') {
  const asked = [];
  (interviewLog || []).forEach((item) => {
    const concepts = item.covered_categories || [];
    if (concepts.length) asked.push(...concepts);
    else if (item.category) asked.push(item.category);
  });
  const askedSet = new Set(asked);
  const required = interviewRequirements(caseData);
  const covered = [...required].filter((item) => askedSet.has(item)).sort();
  const missed = [...required].filter((item) => !askedSet.has(item)).sort();
  const duplicateCount = Math.max(0, asked.length - askedSet.size);
  const lowYield = (interviewLog || []).filter((item) => {
    const concepts = new Set(item.covered_categories || (item.category ? [item.category] : []));
    return concepts.size && ![...concepts].some((concept) => required.has(concept)) && !concepts.has('chief_concern');
  });
  const supportPenalty = mode === 'intermediate' ? Math.min(supportUses.length, 3) : 0;
  const modeMeta = INTERVIEW_MODES.find((item) => item.id === mode) || INTERVIEW_MODES[0];
  return {
    questions_used: interviewLog?.length || 0,
    required_categories: [...required].sort(),
    required_domains: [...required].sort().map((item) => CATEGORY_LABELS[item] || item),
    covered_categories: covered,
    covered_domains: covered.map((item) => CATEGORY_LABELS[item] || item),
    missed_categories: missed,
    missed_domains: missed.map((item) => CATEGORY_LABELS[item] || item),
    duplicate_count: duplicateCount,
    low_yield_count: lowYield.length,
    support_count: supportUses.length,
    support_penalty: supportPenalty,
    supports_used: clone(supportUses),
    mode,
    mode_label: modeMeta.label,
    message: missed.length ? 'Focused question set missed one or more triage domains.' : 'Focused question set covered the major triage domains.'
  };
}

function expectedEscalationActions(caseData) {
  const expected = {};
  const add = (id, evidence) => {
    if (!expected[id]) expected[id] = [];
    if (evidence && !expected[id].includes(evidence)) expected[id].push(evidence);
  };
  const text = complaintText(caseData);
  const flags = vitalFlags(caseData);
  const interventions = caseData.interventions;

  if (caseData.acuity <= 2 || flags.length) {
    add('immediate_bedside_evaluation', caseData.acuity <= 2 ? `reference ESI ${caseData.acuity}` : 'abnormal triage vital signs');
    add('monitored_bed', caseData.acuity <= 2 ? `reference ESI ${caseData.acuity}` : 'abnormal triage vital signs');
  }
  if (caseData.transfer_to_icu_in_1h || caseData.transfer_to_icu_beyond_1h) add('monitored_bed', 'recorded ICU transfer signal');
  if (caseData.acuity === 1 || flags.some((item) => item.severity === 'critical') || interventions.invasive_ventilation || interventions.critical_procedure || caseData.expired_within_1h) {
    add('resuscitation_bay', caseData.acuity === 1 ? `reference ESI ${caseData.acuity}` : 'critical case signal');
  }
  if (
    hasAny(text, ['shortness', 'sob', 'dyspnea', 'breath', 'wheez']) ||
    flags.some((item) => ['Oxygen Saturation', 'Respiratory Rate'].includes(item.name)) ||
    interventions.nebulized_medications ||
    interventions.invasive_ventilation ||
    caseData.non_invasive_ventilation
  ) {
    add('airway_oxygenation_support', 'respiratory complaint, vital sign, or treatment field');
  }
  if (
    interventions.intravenous ||
    interventions.intravenous_fluids ||
    interventions.tier1_med_usage_1h ||
    interventions.tier2_med_usage ||
    caseData.tier1_med_usage_beyond_1h ||
    caseData.transfusion_within_1h ||
    caseData.transfusion_beyond_1h ||
    caseData.red_cell_order_more_than_1 ||
    caseData.lab_event_count > 0
  ) {
    add('vascular_access', 'recorded IV, lab, medication, or transfusion resource');
  }
  if (
    interventions.intravenous_fluids ||
    interventions.intramuscular ||
    interventions.nebulized_medications ||
    interventions.psychotropic_med_within_120min ||
    interventions.tier1_med_usage_1h ||
    interventions.tier2_med_usage ||
    interventions.tier3_med_usage ||
    interventions.tier4_med_usage ||
    caseData.tier1_med_usage_beyond_1h
  ) {
    add('medication_route_priority', 'recorded medication route or medication-tier field');
  }
  if (caseData.red_cell_order_more_than_1 || caseData.transfusion_within_1h || caseData.transfusion_beyond_1h || hasAny(text, ['bleed', 'hematemesis', 'melena', 'rectal bleeding'])) {
    add('bleeding_transfusion_readiness', 'recorded transfusion signal or bleeding language');
    add('vascular_access', 'recorded transfusion or bleeding signal');
  }
  if (interventions.critical_procedure || interventions.tier1_med_usage_1h) add('critical_procedure_team', 'recorded critical procedure or emergency medication field');
  if (interventions.psychotropic_med_within_120min || hasAny(text, ['suicid', 'agitat', 'psych', 'violent', 'hallucinat'])) add('behavioral_safety', 'psychotropic medication field or behavioral-health language');
  if (caseData.vitals.pain >= 8) add('pain_reassessment', `pain score ${caseData.vitals.pain}/10`);

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
    evidence: ['No supporting MIETIC or ESI/vital signal was identified for this case.']
  }));
  return {
    expected,
    matched,
    missed,
    extra,
    score: matched.length,
    possible: expected.length,
    message: missed.length ? 'One or more expected escalation actions were not selected.' : 'Escalation choices matched the main triage needs.',
    grounding: 'Scored actions use MIETIC-recorded fields or ESI/vital-derived priorities. Protocol-specific actions without dataset support are excluded.'
  };
}

function scoreSbar(text, caseData, finalEsi) {
  const lower = ` ${String(text || '').replace(/\s+/g, ' ').toLowerCase()} `;
  const missing = [];
  let score = 0;
  const complaintTokens = String(caseData.complaint || '').toLowerCase().replace('/', ' ').split(/\s+/).slice(0, 5).filter(Boolean);
  if (lower.includes('situation:') || lower.includes(' s:') || complaintTokens.some((token) => lower.includes(token))) score += 1;
  else missing.push('situation');

  const sex = String(caseData.demographics.sex || '').toLowerCase();
  const transport = String(caseData.demographics.transport || '').toLowerCase();
  const hasBackground = lower.includes(String(Math.round(caseData.demographics.age))) ||
    (sex.startsWith('m') && (lower.includes(' male ') || lower.includes(' man '))) ||
    (sex.startsWith('f') && (lower.includes(' female ') || lower.includes(' woman '))) ||
    (transport && transport !== 'unknown' && lower.includes(transport));
  if (lower.includes('background:') || lower.includes(' b:') || hasBackground) score += 1;
  else missing.push('background');

  if (lower.includes('assessment:') || lower.includes(' a:') || lower.includes(`esi ${finalEsi}`) || ['vital', 'bp', 'oxygen', 'pain', 'risk', 'unstable'].some((term) => lower.includes(term))) score += 1;
  else missing.push('assessment');

  if (lower.includes('recommendation:') || lower.includes(' r:') || ['room', 'monitor', 'notify', 'evaluate', 'bed', 'ecg', 'oxygen', 'iv', 'resus', 'charge'].some((term) => lower.includes(term))) score += 1;
  else missing.push('recommendation');

  return {
    score,
    possible: 4,
    missing,
    message: score === 4 ? 'SBAR handoff included the key triage communication elements.' : 'SBAR handoff missed one or more communication elements.'
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

function firstLookScoreDetails(workflow) {
  const rank = { stable_to_interview: 0, immediate_room: 1, resuscitation_now: 2 };
  const learnerRank = rank[workflow.first_look.learner] ?? -1;
  const referenceRank = rank[workflow.first_look.reference] ?? -1;
  let score = 14;
  let message = 'First-look disposition matched the reference safety screen.';
  let action = 'The first placement choice was consistent with the available arrival cues.';
  if (learnerRank > referenceRank) {
    score = 8;
    message = 'First-look disposition was more cautious than the reference safety screen.';
    action = 'More cautious placement earns partial credit for safety but loses points when the data do not support that intensity.';
  } else if (learnerRank < referenceRank) {
    score = 0;
    message = 'First-look disposition missed a higher-acuity safety signal.';
    action = 'Escalate earlier when arrival cues suggest airway, breathing, circulation, neurologic risk, severe distress, or ESI 1-2 risk.';
  }
  return {
    score,
    possible: 14,
    message,
    action
  };
}

function vitalRationaleScoreDetails(session, caseData) {
  const rationale = String(session.triage_rationale || '').toLowerCase();
  const abnormal = vitalFlags(caseData);
  const namesVitals = ['vital', 'heart', 'hr', 'bp', 'oxygen', 'sat', 'spo2', 'resp', 'temperature', 'temp', 'pain'].some((term) => rationale.includes(term));
  const score = !abnormal.length || namesVitals ? 6 : 0;
  const evidence = abnormal.length
    ? abnormal.map((item) => `${item.name}: ${item.value} (${item.reason})`)
    : ['No danger-zone vital signs were flagged by the app thresholds.'];
  return {
    score,
    possible: 6,
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
  const interviewPenalty = Math.min(interview.low_yield_count * 2, 5) + Math.min(interview.duplicate_count * 2, 4) + interview.support_penalty;
  const interviewScore = Math.max(0, Math.round((interview.covered_categories.length / requiredCount) * 15) - interviewPenalty);
  return {
    score: interviewScore,
    possible: 15,
    penalty: interviewPenalty,
    message: interview.message,
    action: interview.missed_domains.length
      ? 'Use the limited question budget for domains that change acuity, safety, or resources.'
      : 'The focused interview covered the required triage domains for this case.'
  };
}

function escalationScoreDetails(workflow) {
  const escalation = workflow.escalation;
  const extraCount = escalation.extra.length;
  let escalationScore = 15;
  if (escalation.expected.length) {
    escalationScore = Math.max(0, Math.round((escalation.matched.length / escalation.expected.length) * 15) - Math.min(extraCount * 2, 5));
  } else if (extraCount) {
    escalationScore = 10;
  }
  return {
    score: escalationScore,
    possible: 15,
    extra_penalty: escalation.expected.length ? Math.min(extraCount * 2, 5) : extraCount ? 5 : 0,
    message: escalation.message,
    action: escalation.missed.length
      ? 'Select escalation actions that match MIETIC-recorded interventions, ESI 1-2 risk, vital-sign danger, or outcome signals.'
      : escalation.extra.length
        ? 'Avoid extra escalation actions when no dataset, vital, or ESI signal supports them.'
        : 'Escalation choices matched the main data-grounded priorities.'
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

  return [
    {
      id: 'first_look',
      label: 'Arrival safety screen',
      learner: workflow.first_look.learner_label,
      reference: workflow.first_look.reference_label,
      score: `${details.first_look.score} / ${details.first_look.possible}`,
      feedback: details.first_look.message,
      action: details.first_look.action,
      evidence: workflow.first_look.cues.map((cue) => `${cue.label}: ${cue.value}`)
    },
    {
      id: 'provisional_esi',
      label: 'Provisional ESI',
      learner: session.provisional_triage_level ? `ESI ${session.provisional_triage_level}` : 'Not recorded',
      reference: `Reference ESI ${caseData.acuity}`,
      score: `${details.provisional_esi.score} / ${details.provisional_esi.possible}`,
      feedback: details.provisional_esi.message,
      action: details.provisional_esi.action,
      evidence: ['Early acuity is scored separately because it occurs before full vital-sign and resource review.']
    },
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
      id: 'escalation',
      label: 'Escalation and placement',
      learner: selectedEscalation.length ? selectedEscalation.map((item) => item.name).join(', ') : 'No immediate escalation',
      reference: workflow.escalation.expected.length ? workflow.escalation.expected.map((item) => item.name).join(', ') : 'No required escalation action from available fields',
      score: `${details.escalation.score} / ${details.escalation.possible}`,
      feedback: details.escalation.message,
      action: details.escalation.action,
      evidence: escalationEvidence.length ? escalationEvidence : ['No MIETIC, vital, or ESI signal required escalation.']
    },
    {
      id: 'sbar',
      label: 'SBAR handoff',
      learner: session.sbar_handoff || 'No handoff recorded',
      reference: 'Situation, background, assessment, recommendation',
      score: `${details.sbar.score} / ${details.sbar.possible}`,
      feedback: workflow.sbar.message,
      action: workflow.sbar.missing.length
        ? `Add the missing SBAR element${workflow.sbar.missing.length > 1 ? 's' : ''}: ${workflow.sbar.missing.join(', ')}.`
        : 'The handoff included the expected SBAR structure.',
      evidence: [`Missing: ${workflow.sbar.missing.join(', ') || 'None'}`]
    }
  ].map((item) => ({ ...item, evidence: evidenceText(item.evidence) }));
}

function simulationStrategy() {
  const embeddingMeta = semanticEmbeddingMetadata();
  return [
    {
      title: 'Data-bound grading',
      text: 'Scores use only the static case bundle, ESI reference level, vital-sign thresholds, recorded resource fields, recorded ED intervention categories, and learner actions.'
    },
    {
      title: 'Browser semantic cache',
      text: `Local embeddings use ${embeddingMeta.model} with ${embeddingMeta.storage} storage to match paraphrased questions and similar reasoning submissions before any OpenRouter request.`
    },
    {
      title: 'AI for realism, not hidden grading',
      text: 'OpenRouter can make patient answers and debrief tutoring more natural, but deterministic rules still decide the score so the app does not grade on invented facts.'
    },
    {
      title: 'Cost control',
      text: 'Patient replies are cached by case and question intent, repeated paraphrases reuse prior answers, and local responses remain available when no key is saved.'
    }
  ];
}

function generateScorecard(session, caseData, workflow) {
  const finalEsi = esiAccuracyScore(session.triage_level, caseData.acuity, 30, 'Final ESI');
  const provisionalEsi = esiAccuracyScore(session.provisional_triage_level, caseData.acuity, 10, 'Provisional ESI');
  const firstLook = firstLookScoreDetails(workflow);
  const vitalRationale = vitalRationaleScoreDetails(session, caseData);
  const safetyScore = firstLook.score + vitalRationale.score;
  const interview = interviewScoreDetails(workflow);
  const escalation = escalationScoreDetails(workflow);
  const sbarScore = Math.round((workflow.sbar.score / Math.max(workflow.sbar.possible, 1)) * 10);
  const sbar = {
    score: sbarScore,
    possible: 10,
    message: workflow.sbar.message
  };

  const domains = [
    domain('esi', 'Final ESI accuracy', finalEsi.score, 30, finalEsi.message),
    domain('provisional_esi', 'Early acuity estimate', provisionalEsi.score, 10, provisionalEsi.message),
    domain('safety', 'Safety recognition', safetyScore, 20, vitalRationale.score ? firstLook.message : vitalRationale.message),
    domain('interview', 'Interview coverage', interview.score, 15, interview.message),
    domain('escalation', 'Escalation priorities', escalation.score, 15, escalation.message),
    domain('sbar', 'SBAR handoff', sbarScore, 10, workflow.sbar.message)
  ];
  const total = domains.reduce((sum, item) => sum + item.score, 0);
  const possible = domains.reduce((sum, item) => sum + item.possible, 0);
  const details = {
    final_esi: finalEsi,
    provisional_esi: provisionalEsi,
    first_look: firstLook,
    vital_rationale: vitalRationale,
    interview,
    escalation,
    sbar
  };
  return {
    total,
    possible,
    percentage: Math.round((total / possible) * 100),
    domains,
    details,
    method: 'Deterministic score from MIETIC fields, ESI-derived priorities, vital-sign thresholds, resource fields, and structured learner actions.'
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
    outcomes
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
    if (criterionLabel === 'Action-evidence match') {
      return hasAny(lower, ['because', 'due to', 'vital', 'esi', 'risk', 'pain', 'resource', 'history', 'symptom']) ||
        workflow.escalation?.matched?.length > 0;
    }
    if (criterionLabel === 'Immediate safety needs') {
      return hasAny(lower, ['room', 'bed', 'monitor', 'airway', 'oxygen', 'iv', 'clinician', 'evaluate', 'pain', 'safety', 'resus']);
    }
    if (criterionLabel === 'Avoids unsupported escalation') {
      return (workflow.escalation?.extra || []).length === 0;
    }
    if (criterionLabel === 'Operational clarity') {
      return hasAny(lower, ['place', 'notify', 'monitor', 'start', 'prepare', 'request', 'evaluate', 'reassess', 'routine']);
    }
  }

  if (rubricId === 'sbar_handoff') {
    const missing = workflow.sbar?.missing || [];
    if (criterionLabel === 'Situation') return !missing.includes('situation');
    if (criterionLabel === 'Background') return !missing.includes('background');
    if (criterionLabel === 'Assessment') return !missing.includes('assessment');
    if (criterionLabel === 'Recommendation') return !missing.includes('recommendation');
    if (criterionLabel === 'Concise handoff structure') return lower.length >= 45 && lower.length <= 900 && missing.length <= 1;
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
    evidence.push(`SBAR rule score ${sbar.score || 0} / ${sbar.possible || 4}`);
    if (sbar.missing?.length) evidence.push(`Missing: ${sbar.missing.join(', ')}`);
  }

  return evidence.filter(Boolean).slice(0, 4);
}

function localSectionFeedback(rubric, matched, unmatched, text) {
  if (!String(text || '').trim()) return `${rubric.label} was not submitted.`;
  if (!unmatched.length) return `${rubric.label} addressed the rubric elements with enough case-specific detail for deterministic credit.`;
  if (matched.length) return `${rubric.label} included ${matched.slice(0, 2).join(', ')}; add ${unmatched.slice(0, 2).join(', ')} for a stronger explanation.`;
  return `${rubric.label} needs more explicit case evidence and a clearer link to the triage decision.`;
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
      feedback: localSectionFeedback(rubric, matched, unmatched, text),
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
      action: 'Match triage actions to MIETIC-recorded interventions and ESI/vital safety signals.'
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

function generateFeedback(session) {
  const caseData = session.case;
  const first = firstLook(caseData);
  const optionLabels = Object.fromEntries(first.options.map((item) => [item.id, item.label]));
  const selectedActionIds = (session.escalation_actions || []).map((item) => item.id);
  const workflow = {
    first_look: {
      learner: session.first_look_decision,
      learner_label: optionLabels[session.first_look_decision] || 'Not recorded',
      reference: first.recommended_disposition,
      reference_label: optionLabels[first.recommended_disposition] || 'Not recorded',
      matched: session.first_look_decision === first.recommended_disposition,
      cues: first.cues
    },
    timing: {
      elapsed_seconds: session.elapsed_seconds,
      final_esi_time_seconds: session.timing_events.final_esi || session.elapsed_seconds,
      status: 'Recorded',
      events: clone(session.timing_events),
      message: 'Case clock summarizes simulated workflow pace. Scoring is based on case evidence and clinical reasoning.'
    },
    interview: evaluateInterview(caseData, session.interview_log, session.support_uses, session.interview_mode),
    escalation: evaluateEscalation(caseData, selectedActionIds),
    sbar: scoreSbar(session.sbar_handoff, caseData, session.triage_level)
  };
  const comparison = session.triage_level < caseData.acuity ? 'Over-triaged' : session.triage_level > caseData.acuity ? 'Under-triaged' : 'Correct triage';
  const recordedActions = clinicalFeedback(caseData);
  const scorecard = generateScorecard(session, caseData, workflow);
  const feedback = {
    session_summary: {
      arrival_method: caseData.demographics.transport,
      chief_complaint: caseData.complaint,
      chief_complaint_question: session.chief_complaint_question,
      medical_history_question: session.medical_history_question,
      triage_rationale: session.triage_rationale,
      first_look_decision: session.first_look_decision,
      provisional_triage_level: session.provisional_triage_level,
      provisional_triage_rationale: session.provisional_triage_rationale,
      elapsed_seconds: session.elapsed_seconds,
      vitals_checked: session.checked_vitals,
      interview_log: clone(session.interview_log),
      interview_mode: session.interview_mode,
      support_uses: clone(session.support_uses),
      escalation_actions: clone(session.escalation_actions),
      escalation_rationale: session.escalation_rationale,
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
    action_feedback: generateActionFeedback(session, caseData, workflow, scorecard.details),
    simulation_strategy: simulationStrategy(),
    priority_feedback: priorityFeedback(session, caseData, workflow, scorecard),
    case_evidence: caseEvidence(caseData, recordedActions),
    reasoning_rubrics: reasoningRubrics(),
    feedback_sources: [
      {
        label: 'Static MIETIC case bundle',
        type: 'Browser data',
        items: 'demographics, chief complaint, vital signs, reference ESI, disposition, outcome signals, recorded ED intervention categories'
      },
      {
        label: 'Scoring',
        type: 'Deterministic browser rules',
        items: 'final ESI comparison, provisional ESI comparison, first-look placement match, interview concept coverage, support use, escalation match, SBAR structure, abnormal vital flags'
      },
      {
        label: 'AI tutor',
        type: 'Optional user key',
        items: 'OpenRouter calls occur only when an optional browser-stored API key is available; patient responses and reasoning reviews are cached by case and input'
      },
      {
        label: 'Semantic cache',
        type: 'Browser-local embeddings',
        items: `${semanticEmbeddingMetadata().model} embeddings are stored in IndexedDB and used to match paraphrased patient questions and similar reasoning reviews`
      }
    ]
  };
  feedback.local_reasoning_review = buildLocalReasoningReview({ case: caseData, feedback });
  return feedback;
}

function getSession(id) {
  const session = sessions.get(id);
  if (!session) throw new Error('Session not found.');
  return session;
}

export function startStaticSimulation() {
  if (!cases.length) throw new Error('No cases available.');
  const caseData = clone(cases[Math.floor(Math.random() * cases.length)]);
  const id = sessionId();
  const session = {
    id,
    case: caseData,
    checked_vitals: [],
    chief_complaint_question: '',
    chief_complaint_response: '',
    medical_history_question: '',
    medical_history_response: '',
    first_look_decision: '',
    provisional_triage_level: null,
    provisional_triage_rationale: '',
    triage_level: null,
    triage_rationale: '',
    interventions: [],
    escalation_actions: [],
    escalation_rationale: '',
    sbar_handoff: '',
    elapsed_seconds: 0,
    timing_events: {},
    interview_log: [],
    interview_mode: 'assessment',
    support_uses: [],
    response_cache: {},
    max_questions: 4
  };
  sessions.set(id, session);
  const firstLookPublic = firstLook(caseData);
  return {
    session_id: id,
    age: Math.round(caseData.demographics.age),
    sex: caseData.demographics.sex,
    transport: caseData.demographics.transport,
    complaint: caseData.complaint,
    first_look: {
      cues: firstLookPublic.cues,
      options: firstLookPublic.options
    },
    interview_modes: clone(INTERVIEW_MODES),
    interview_supports: clone(INTERVIEW_SUPPORTS),
    interview_mode: session.interview_mode,
    max_questions: session.max_questions,
    clock: clock(session)
  };
}

export function submitStaticFirstLook(id, decision) {
  const session = getSession(id);
  const allowed = new Set(firstLook(session.case).options.map((item) => item.id));
  if (!allowed.has(decision)) throw new Error('Invalid first-look decision.');
  session.first_look_decision = decision;
  advanceTime(session, 15, 'first_look');
  return { success: true, decision, clock: clock(session) };
}

export function setStaticInterviewMode(id, mode) {
  const session = getSession(id);
  const modeMeta = INTERVIEW_MODES.find((item) => item.id === mode);
  if (!modeMeta) throw new Error('Invalid interview mode.');
  session.interview_mode = mode;
  if (mode === 'assessment') session.support_uses = [];
  return { mode: clone(modeMeta), support_uses: clone(session.support_uses), clock: clock(session) };
}

export function recordStaticInterviewSupport(id, supportId) {
  const session = getSession(id);
  const modeMeta = INTERVIEW_MODES.find((item) => item.id === session.interview_mode) || INTERVIEW_MODES[0];
  if (!modeMeta.supports_enabled) throw new Error('Interview supports are not available in assessment mode.');
  const support = INTERVIEW_SUPPORTS.find((item) => item.id === supportId);
  if (!support) throw new Error('Invalid interview support.');
  let record = session.support_uses.find((item) => item.id === supportId);
  if (!record) {
    const cost = modeMeta.support_cost_seconds || 0;
    record = { ...support, mode: session.interview_mode, cost_seconds: cost };
    session.support_uses.push(record);
    if (cost) advanceTime(session, cost, `interview_support_${supportId}`);
  }
  return { support: clone(record), support_uses: clone(session.support_uses), clock: clock(session) };
}

export async function askStaticPatientQuestion(id, question) {
  const session = getSession(id);
  if (session.interview_log.length >= session.max_questions) throw new Error('Question budget used.');
  const text = String(question || '').trim();
  if (!text) throw new Error('Question is required.');
  const category = classifyQuestion(text);
  const coveredCategories = classifyQuestionDomains(text);
  const metadata = questionMetadata(category);
  const intentKey = questionIntentKey(text, category, coveredCategories);
  const cacheKey = intentKey;
  let answerPayload = session.response_cache[cacheKey];

  if (answerPayload) {
    answerPayload = {
      ...clone(answerPayload),
      question: text,
      source: 'Cached patient response',
      cached: true
    };
  } else {
    const persistentCached = readPersistentPatientCache(session.case, intentKey);
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
    } else if (getTutorSettings().hasKey) {
      const semanticCached = await readSemanticPatientCache(session.case, text, category, coveredCategories);
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
    const fallbackAnswer = cleanPatientResponse(categoryResponse(session.case, category, text));
    let answer = fallbackAnswer;
    let source = 'Local patient response';
    let usedAi = false;
    let aiError = '';

    try {
      const aiAnswer = await askOpenRouterPatient(session, text, category, intentKey);
      if (aiAnswer) {
        answer = cleanPatientResponse(aiAnswer, fallbackAnswer);
        source = 'OpenRouter patient response';
        usedAi = true;
      }
    } catch (error) {
      aiError = error.message || 'OpenRouter patient response failed.';
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
      ai_error: aiError,
      time_cost_seconds: metadata.cost_seconds
    };
    session.response_cache[cacheKey] = clone(answerPayload);
    writePersistentPatientCache(session.case, intentKey, answerPayload);
  }
  const logItem = { ...clone(answerPayload), question: text, answer: cleanPatientResponse(answerPayload.answer) };
  session.interview_log.push(logItem);
  if (logItem.category === 'chief_concern' && !session.chief_complaint_question) {
    session.chief_complaint_question = text;
    session.chief_complaint_response = logItem.answer;
  }
  if (['medical_history', 'medications', 'prior_episode'].includes(logItem.category)) {
    session.medical_history_question = text;
    session.medical_history_response = logItem.answer;
  }
  advanceTime(session, logItem.time_cost_seconds);
  return {
    response: logItem,
    questions_used: session.interview_log.length,
    questions_remaining: session.max_questions - session.interview_log.length,
    clock: clock(session)
  };
}

export function assignStaticProvisionalTriage(id, level, rationale = '') {
  const session = getSession(id);
  if (![1, 2, 3, 4, 5].includes(level)) throw new Error('Invalid triage level.');
  session.provisional_triage_level = level;
  session.provisional_triage_rationale = rationale;
  advanceTime(session, 20, 'provisional_esi');
  return { success: true, level, rationale, clock: clock(session) };
}

export function recordStaticVitalsReview(id) {
  const session = getSession(id);
  const vitals = formatVitals(session.case);
  session.checked_vitals = vitals;
  advanceTime(session, 60, 'vitals_review');
  return { vitals, clock: clock(session) };
}

export function assignStaticTriage(id, level, rationale = '') {
  const session = getSession(id);
  if (![1, 2, 3, 4, 5].includes(level)) throw new Error('Invalid triage level.');
  session.triage_level = level;
  session.triage_rationale = rationale;
  advanceTime(session, 20, 'final_esi');
  return { success: true, level, rationale, clock: clock(session) };
}

export function getStaticEscalationActions(id) {
  getSession(id);
  return clone(TRIAGE_ACTIONS);
}

export function selectStaticEscalationActions(id, actionIds = [], rationale = '') {
  const session = getSession(id);
  const trimmedRationale = String(rationale || '').trim();
  if (trimmedRationale.length < 20) throw new Error('Escalation rationale is too short.');
  const selected = actionIds.filter((actionId) => actionLookup[actionId]).map((actionId) => clone(actionLookup[actionId]));
  session.escalation_actions = selected;
  session.interventions = selected;
  session.escalation_rationale = trimmedRationale;
  advanceTime(session, 30 + selected.length * 10, 'escalation');
  return { actions_performed: clone(selected), rationale: session.escalation_rationale, clock: clock(session) };
}

export function submitStaticSbar(id, handoff) {
  const session = getSession(id);
  const text = String(handoff || '').trim();
  if (text.length < 20) throw new Error('Handoff is too short.');
  session.sbar_handoff = text;
  advanceTime(session, 45, 'sbar');
  return { success: true, handoff: text, clock: clock(session) };
}

export function getStaticFeedback(id) {
  const session = getSession(id);
  if (!session.triage_level) throw new Error('Triage level not assigned.');
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
  return {
    hasKey: Boolean(key),
    key,
    storage,
    model: localStorage.getItem(TUTOR_MODEL_KEY) || DEFAULT_TUTOR_MODEL
  };
}

export function saveTutorSettings({ key, model = DEFAULT_TUTOR_MODEL }) {
  const trimmedKey = String(key || '').trim();
  if (!trimmedKey) throw new Error('OpenRouter API key is required.');
  sessionStorage.removeItem(TUTOR_SESSION_KEY);
  localStorage.removeItem(TUTOR_LOCAL_KEY);
  localStorage.setItem(TUTOR_LOCAL_KEY, trimmedKey);
  localStorage.setItem(TUTOR_STORAGE_KEY, 'local');
  localStorage.setItem(TUTOR_MODEL_KEY, String(model || DEFAULT_TUTOR_MODEL).trim() || DEFAULT_TUTOR_MODEL);
  return getTutorSettings();
}

export function clearTutorSettings() {
  sessionStorage.removeItem(TUTOR_SESSION_KEY);
  localStorage.removeItem(TUTOR_LOCAL_KEY);
  localStorage.removeItem(TUTOR_STORAGE_KEY);
  return getTutorSettings();
}

export async function askOpenRouterTutor(sessionIdValue, question) {
  const completed = getCompletedSession(sessionIdValue);
  if (!completed) throw new Error('Complete the case before asking the AI tutor.');
  const settings = getTutorSettings();
  if (!settings.key) throw new Error('Use AI settings in the header to enable the clinical tutor.');

  const messages = [
    {
      role: 'system',
      content: [
        'You are a clinical educator for an emergency department triage training app.',
        'Use only the supplied case data and debrief data.',
        'Keep answers concise and educational.',
        'Do not invent diagnoses, tests, or procedures not documented in the case data.'
      ].join(' ')
    },
    {
      role: 'user',
      content: JSON.stringify({
        learner_question: question,
        case: completed.case,
        feedback: completed.feedback
      })
    }
  ];

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'ED Triage Trainer'
    },
    body: JSON.stringify({
      model: settings.model || DEFAULT_TUTOR_MODEL,
      messages,
      temperature: 0.2,
      max_tokens: 500
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `OpenRouter request failed with status ${response.status}.`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || 'The AI tutor returned an empty response.';
}
