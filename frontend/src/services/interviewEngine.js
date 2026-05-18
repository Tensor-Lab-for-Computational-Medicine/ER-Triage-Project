export const MINIMUM_INTERVIEW_QUESTIONS = 2;

export const QUESTION_CATALOG = [
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

export const CATEGORY_LABELS = Object.fromEntries(QUESTION_CATALOG.map((item) => [item.id, item.label]));

export const QUESTION_DOMAIN_CHECKS = [
  ['timeline', ['when', 'start', 'began', 'long', 'sudden', 'gradual', 'changed', 'worse']],
  ['red_flags', ['breath', 'chest pain', 'faint', 'passed out', 'weak', 'numb', 'bleed', 'vomit', 'fever', 'confus']],
  ['severity', ['bad', 'severe', 'pain', 'scale', 'distress', 'right now']],
  ['medical_history', ['medical', 'history', 'problems', 'conditions', 'disease', 'diabetes', 'heart']],
  ['medications', ['med', 'medicine', 'blood thinner', 'anticoagul', 'daily', 'take']],
  ['prior_episode', ['before', 'again', 'previous', 'prior', 'ever had', 'like this']],
  ['pregnancy', ['pregnan', 'period', 'lmp']],
  ['allergies', ['allerg']]
];

export const QUESTION_DOMAIN_ORDER = QUESTION_CATALOG.map((item) => item.id);
export const BACKGROUND_DOMAINS = ['medical_history', 'medications', 'allergies', 'prior_episode', 'pregnancy'];

export const INTERVIEW_MODES = [
  {
    id: 'assessment',
    label: 'Focused interview',
    description: 'Ask free-text triage questions with optional editable prompts.',
    supports_enabled: true
  }
];

export const INTERVIEW_SUPPORTS = [
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

const INTERVIEW_DOMAIN_PROMPTS = {
  chief_concern: "Ask what brought the patient in today, using the patient's words.",
  timeline: 'Ask when the problem started and whether it is improving, worsening, or changing.',
  severity: 'Ask how severe the symptom is now and whether the patient appears distressed.',
  red_flags: 'Screen for breathing, chest pain, fainting, neurologic symptoms, bleeding, fever, vomiting, confusion, or severe distress.',
  medical_history: 'Ask for medical problems that change risk for this complaint.',
  medications: 'Ask about daily medicines, blood thinners, and recent medication changes.',
  allergies: 'Ask about medication allergies before anticipating treatment needs.',
  prior_episode: 'Ask whether this has happened before and what was needed then.',
  pregnancy: 'Ask pregnancy status when age and sex make it clinically relevant.',
  general_status: 'Open with a brief status check, then move to risk-changing questions.'
};

function hasAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function complaintText(caseData = {}) {
  return `${caseData.complaint || ''} ${caseData.history || ''}`.toLowerCase();
}

function interviewVitalFlags(caseData = {}) {
  const vitals = caseData.vitals || {};
  const flags = [];
  if (vitals.hr !== null && vitals.hr !== undefined && (vitals.hr >= 110 || vitals.hr < 60)) flags.push('heart_rate');
  if (vitals.sbp !== null && vitals.sbp !== undefined && (vitals.sbp < 100 || vitals.sbp >= 160)) flags.push('blood_pressure');
  if (vitals.rr !== null && vitals.rr !== undefined && (vitals.rr >= 22 || vitals.rr < 12)) flags.push('respiratory_rate');
  if (vitals.o2 !== null && vitals.o2 !== undefined && vitals.o2 < 94) flags.push('oxygenation');
  if (vitals.temp !== null && vitals.temp !== undefined && (vitals.temp >= 100.4 || vitals.temp < 96.8)) flags.push('temperature');
  if (vitals.pain !== null && vitals.pain !== undefined && vitals.pain >= 5) flags.push('pain');
  return flags;
}

export function categoryLabel(category) {
  return CATEGORY_LABELS[category] || category;
}

export function categoryLabels(categories = []) {
  return categories.map(categoryLabel);
}

export function interviewRequirements(caseData = {}) {
  const required = new Set(['chief_concern', 'timeline', 'severity']);
  const text = complaintText(caseData);
  if (caseData.acuity <= 2 || interviewVitalFlags(caseData).length) required.add('red_flags');
  if (caseData.history) required.add('medical_history');
  if (hasAny(text, ['blood thinner', 'anticoagul', 'warfarin', 'xarelto', 'eliquis', 'plavix', 'aspirin'])) required.add('medications');
  const age = Number(caseData.demographics?.age || 0);
  if (String(caseData.demographics?.sex || '').toUpperCase().startsWith('F') && age >= 12 && age <= 55) required.add('pregnancy');
  return required;
}

export function nextBestInterviewQuestions(missed = []) {
  return missed.slice(0, 3).map((category) => ({
    category,
    label: categoryLabel(category),
    question: INTERVIEW_DOMAIN_PROMPTS[category] || 'Ask the next question that changes acuity, risk, or immediate action.'
  }));
}

export function interviewTurnTeachingNote(categories = [], missedAfter = []) {
  const labels = categoryLabels(categories);
  if (!labels.length) return 'This question was recorded, but it did not map to a required triage domain.';
  if (!missedAfter.length) {
    return `This question addressed ${labels.join(', ')}. Required interview domains are complete.`;
  }
  return `This question addressed ${labels.join(', ')}. Next, cover ${categoryLabels(missedAfter).slice(0, 3).join(', ')}.`;
}

export function lastTurnFeedback(interviewLog = [], missedAfter = []) {
  const last = interviewLog[interviewLog.length - 1];
  if (!last) return null;
  const categories = last.covered_categories?.length ? last.covered_categories : (last.category ? [last.category] : []);
  return {
    covered_categories: categories,
    covered_domains: categoryLabels(categories),
    confidence: last.coverage_confidence || 'estimated',
    teaching_note: last.teaching_note || interviewTurnTeachingNote(categories, missedAfter),
    next_best_questions: nextBestInterviewQuestions(missedAfter)
  };
}

export function evaluateInterview(caseData, interviewLog, supportUses = [], mode = 'assessment', gapsAcknowledged = false) {
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
  const optional = QUESTION_DOMAIN_ORDER.filter((item) => !required.has(item));
  const optionalCovered = optional.filter((item) => askedSet.has(item));
  const optionalOpen = optional.filter((item) => !askedSet.has(item));
  const duplicateCount = Math.max(0, asked.length - askedSet.size);
  const lowYield = (interviewLog || []).filter((item) => {
    const concepts = new Set(item.covered_categories || (item.category ? [item.category] : []));
    return concepts.size && ![...concepts].some((concept) => required.has(concept)) && !concepts.has('chief_concern');
  });
  const modeMeta = INTERVIEW_MODES.find((item) => item.id === mode) || INTERVIEW_MODES[0];
  const questionsUsed = interviewLog?.length || 0;
  const complete = missed.length === 0;
  const minimumMet = questionsUsed >= MINIMUM_INTERVIEW_QUESTIONS;
  const continueRequiresAcknowledgement = !complete && minimumMet;
  const canContinue = complete || (continueRequiresAcknowledgement && gapsAcknowledged);
  return {
    questions_used: questionsUsed,
    minimum_questions: MINIMUM_INTERVIEW_QUESTIONS,
    required_categories: [...required].sort(),
    required_domains: [...required].sort().map(categoryLabel),
    covered_categories: covered,
    covered_domains: covered.map(categoryLabel),
    missed_categories: missed,
    missed_domains: missed.map(categoryLabel),
    optional_categories: optionalOpen,
    optional_domains: optionalOpen.map(categoryLabel),
    optional_covered_categories: optionalCovered,
    optional_covered_domains: optionalCovered.map(categoryLabel),
    duplicate_count: duplicateCount,
    low_yield_count: lowYield.length,
    support_count: supportUses.length,
    supports_used: JSON.parse(JSON.stringify(supportUses || [])),
    mode,
    mode_label: modeMeta.label,
    complete,
    minimum_met: minimumMet,
    can_continue: canContinue,
    gaps_acknowledged: Boolean(gapsAcknowledged),
    continue_requires_acknowledgement: continueRequiresAcknowledgement && !gapsAcknowledged,
    next_best_questions: nextBestInterviewQuestions(missed),
    last_turn_feedback: lastTurnFeedback(interviewLog || [], missed),
    message: missed.length ? 'Focused question set missed one or more triage domains.' : 'Focused question set covered the major triage domains.'
  };
}
