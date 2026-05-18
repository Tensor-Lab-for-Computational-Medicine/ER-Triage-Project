export const LEARNER_PROFILE_VERSION = 'learner_profile_v1';

const PROFILE_KEY = 'ed_triage_learner_profile_v1';

const EMPTY_PROFILE = {
  version: LEARNER_PROFILE_VERSION,
  cases_completed: 0,
  interview_gaps: {},
  esi_error_direction: {
    under_triage: 0,
    over_triage: 0,
    matched: 0
  },
  missed_escalation_categories: {},
  weak_sbar_sections: {},
  updated_at: ''
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function safeStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function incrementCount(target, key, amount = 1) {
  if (!key) return;
  target[key] = (Number(target[key]) || 0) + amount;
}

function normalizeProfile(profile = {}) {
  return {
    ...clone(EMPTY_PROFILE),
    ...profile,
    esi_error_direction: {
      ...EMPTY_PROFILE.esi_error_direction,
      ...(profile.esi_error_direction || {})
    },
    interview_gaps: { ...(profile.interview_gaps || {}) },
    missed_escalation_categories: { ...(profile.missed_escalation_categories || {}) },
    weak_sbar_sections: { ...(profile.weak_sbar_sections || {}) }
  };
}

export function readLearnerProfile() {
  const storage = safeStorage();
  if (!storage) return clone(EMPTY_PROFILE);
  try {
    const parsed = JSON.parse(storage.getItem(PROFILE_KEY) || '{}');
    return normalizeProfile(parsed);
  } catch {
    return clone(EMPTY_PROFILE);
  }
}

export function writeLearnerProfile(profile) {
  const next = normalizeProfile(profile);
  const storage = safeStorage();
  if (!storage) return next;
  try {
    storage.setItem(PROFILE_KEY, JSON.stringify(next));
  } catch {
    // Learner profile is formative only; the simulation remains usable.
  }
  return next;
}

export function updateLearnerProfileFromFeedback(feedback = {}) {
  const previous = readLearnerProfile();
  const next = normalizeProfile(previous);
  const workflow = feedback.workflow_analysis || {};
  const summary = feedback.session_summary || {};
  const triage = feedback.triage_analysis || {};
  const delta = {
    interview_gaps: [],
    esi_error_direction: '',
    missed_escalation_categories: [],
    weak_sbar_sections: []
  };

  next.cases_completed += 1;

  (workflow.interview?.missed_domains || []).forEach((domain) => {
    incrementCount(next.interview_gaps, domain);
    delta.interview_gaps.push(domain);
  });

  const comparison = String(triage.comparison || '').toLowerCase();
  if (comparison.includes('under')) {
    next.esi_error_direction.under_triage += 1;
    delta.esi_error_direction = 'under_triage';
  } else if (comparison.includes('over')) {
    next.esi_error_direction.over_triage += 1;
    delta.esi_error_direction = 'over_triage';
  } else if (summary.triage_level_assigned) {
    next.esi_error_direction.matched += 1;
    delta.esi_error_direction = 'matched';
  }

  (workflow.escalation?.missed || []).forEach((action) => {
    const category = action.category || 'Escalation';
    incrementCount(next.missed_escalation_categories, category);
    delta.missed_escalation_categories.push(category);
  });

  (workflow.sbar?.missing || []).forEach((section) => {
    incrementCount(next.weak_sbar_sections, section);
    delta.weak_sbar_sections.push(section);
  });

  next.updated_at = new Date().toISOString();
  writeLearnerProfile(next);

  return {
    profile: next,
    delta: {
      ...delta,
      interview_gaps: [...new Set(delta.interview_gaps)],
      missed_escalation_categories: [...new Set(delta.missed_escalation_categories)],
      weak_sbar_sections: [...new Set(delta.weak_sbar_sections)]
    }
  };
}

function topEntry(counts = {}) {
  return Object.entries(counts)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .find(([, value]) => Number(value) > 0);
}

export function learnerProfileFocus(profile = readLearnerProfile()) {
  const normalized = normalizeProfile(profile);
  const esi = normalized.esi_error_direction || {};
  const topInterview = topEntry(normalized.interview_gaps);
  const topEscalation = topEntry(normalized.missed_escalation_categories);
  const topSbar = topEntry(normalized.weak_sbar_sections);

  if ((esi.under_triage || 0) > Math.max(esi.over_triage || 0, esi.matched || 0)) {
    return {
      id: 'under_triage',
      label: 'Under-triage prevention',
      rationale: 'Practice cases with high-risk features, abnormal physiology, or escalation needs.'
    };
  }
  if (topInterview) {
    return {
      id: 'interview_gap',
      label: topInterview[0],
      rationale: `Practice focused questions for ${topInterview[0].toLowerCase()}.`
    };
  }
  if (topEscalation) {
    return {
      id: 'escalation_gap',
      label: topEscalation[0],
      rationale: `Practice matching ${topEscalation[0].toLowerCase()} actions to case evidence.`
    };
  }
  if (topSbar) {
    return {
      id: 'sbar_gap',
      label: topSbar[0],
      rationale: `Practice concise SBAR ${topSbar[0].toLowerCase()} statements.`
    };
  }
  if ((esi.over_triage || 0) > Math.max(esi.under_triage || 0, esi.matched || 0)) {
    return {
      id: 'over_triage',
      label: 'Resource calibration',
      rationale: 'Practice stable lower-acuity cases that separate ESI 4 from ESI 5.'
    };
  }
  return {
    id: 'balanced',
    label: 'Balanced triage practice',
    rationale: 'Continue rotating through acuity, interview, escalation, and handoff skills.'
  };
}

export function buildNextCaseRecommendation(profile = readLearnerProfile()) {
  const focus = learnerProfileFocus(profile);
  return {
    focus: focus.label,
    rationale: focus.rationale,
    selector: focus.id,
    cases_completed: normalizeProfile(profile).cases_completed
  };
}
