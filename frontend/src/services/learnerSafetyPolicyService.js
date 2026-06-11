export const LEARNER_SAFETY_POLICY_VERSION = 'learner_safety_policy_v1';

const SAFETY_RULES = [
  {
    category: 'ai_scope_confusion_or_real_patient_advice',
    severity: 'block',
    patterns: [
      /\breal (patient|person|case|hospital|clinical)\b/i,
      /\bactual (patient|case|hospital|clinical)\b/i,
      /\b(use|apply|follow) (this|the) app\b.{0,80}\b(real|actual|hospital|clinic|patient)\b/i,
      /\bshould i\b.{0,80}\b(real|actual|patient|hospital|clinic|right now)\b/i,
      /\bclinical decision\b.{0,80}\bright now\b/i
    ],
    safeResponse: 'This simulator is for medical education only, not real-time clinical decision support. For real patient care, use local supervision, institutional protocols, and licensed clinical judgment.'
  },
  {
    category: 'privacy_or_restricted_data_leakage',
    severity: 'block',
    patterns: [
      /\b(mimic|restricted|raw chart|raw record|identifier|mrn|medical record number|patient id)\b/i,
      /\b(expose|show|reveal|give me|dump)\b.{0,80}\b(date|dob|identifier|record|restricted|raw)\b/i,
      /\blocal restricted\b/i
    ],
    safeResponse: 'I cannot expose restricted case data, identifiers, raw chart text, or local-only source details. Use only the public-safe case facts shown in the simulator.'
  },
  {
    category: 'unsupported_medication_or_procedure',
    severity: 'block',
    patterns: [
      /\b(specific|exact)?\s*(dose|dosage|mg\/kg|milligrams|units\/kg|order set|orderset|prescription)\b/i,
      /\b(how much|what dose|which dose)\b/i,
      /\b(procedure instructions|step by step|walk me through)\b/i,
      /\b(intubate|sedate|thrombolyse|thrombolyze|defibrillate|cardiovert)\b.{0,80}\b(how|dose|exact|step|protocol)\b/i
    ],
    safeResponse: 'I cannot provide patient-specific dosing, order sets, or procedure instructions from this simulation. Keep the discussion educational and defer real dosing or procedures to local protocols and supervision.'
  },
  {
    category: 'hallucinated_case_fact_or_objective_data',
    severity: 'block',
    patterns: [
      /\b(reveal|show|tell me|give me)\b.{0,80}\b(ct|cat scan|ecg|ekg|troponin|lab|labs|pregnancy test|x[- ]?ray|imaging|result|results)\b/i,
      /\b(what (did|do) the|what are the)\b.{0,80}\b(ct|ecg|ekg|troponin|lab|labs|imaging|x[- ]?ray|result|results)\b/i,
      /\b(hidden|unavailable|not requested)\b.{0,80}\b(test|data|result|results)\b/i
    ],
    safeResponse: 'Objective data cannot be invented or revealed unless it is available in the case and requested through the simulator workflow. Treat unavailable tests as missing, not normal or abnormal.'
  },
  {
    category: 'role_consistency_or_patient_state_drift',
    severity: 'block',
    patterns: [
      /\b(final diagnosis|correct diagnosis|answer key|correct answer|reference esi|true esi|source esi|final outcome)\b/i,
      /\b(admission status|were you admitted|did they admit|what did clinicians do|specialist plan)\b/i,
      /\b(as a clinician|doctor explanation|explain the diagnosis)\b/i
    ],
    safeResponse: 'The patient voice should stay in patient-observable symptoms and history. It should not reveal hidden clinical answers, scoring keys, outcomes, or clinician-only plans.'
  },
  {
    category: 'unsafe_discharge_or_false_reassurance',
    severity: 'block',
    patterns: [
      /\b(justify|support|recommend|argue for)\b.{0,80}\b(discharge|send home|waiting room|can wait)\b/i,
      /\b(crowded|busy|full)\b.{0,80}\b(discharge|send home|waiting room|can wait)\b/i,
      /\b(probably|just)\s+(anxious|anxiety|benign|nothing serious)\b/i
    ],
    safeResponse: 'Do not use crowding, anxiety labels, or convenience to justify unsafe disposition. High-risk or source-limited cases need monitored evaluation, reassessment, and local clinician review.'
  },
  {
    category: 'undertriage_or_delayed_escalation',
    severity: 'block',
    patterns: [
      /\b(esi\s*[45]|low acuity|can wait|routine wait|not urgent)\b/i,
      /\b(first vitals look manageable|looks manageable|stable enough to wait)\b/i,
      /\bdelay\b.{0,80}\b(escalation|clinician|evaluation|monitoring)\b/i
    ],
    safeResponse: 'If the case has high-risk acuity, abnormal signals, or uncertain danger features, do not minimize the presentation. Reconcile acuity, vitals, and risk before accepting delayed evaluation.'
  },
  {
    category: 'bias_or_equity_failure',
    severity: 'block',
    patterns: [
      /\b(minimize|dismiss|ignore|downgrade|lower acuity|less urgent)\b.{0,100}\b(old|older|elderly|homeless|unhoused|social risk|poor historian|communicates poorly|language barrier|limited english|non[- ]?english|interpreter|disab|deaf|blind|pain|psychiatric|substance|drug use|drug seeking|pregnan|female|woman|transgender|race|ethnic|immigrant|insurance|medicaid|uninsured)\b/i,
      /\b(old|older|elderly|homeless|unhoused|social risk|poor historian|communicates poorly|language barrier|limited english|non[- ]?english|interpreter|disab|deaf|blind|pain|psychiatric|substance|drug use|drug seeking|pregnan|female|woman|transgender|race|ethnic|immigrant|insurance|medicaid|uninsured)\b.{0,100}\b(minimize|dismiss|ignore|downgrade|lower acuity|less urgent|less urgent|treat .*less urgent)\b/i,
      /\b(unlikely to follow up|noncompliant|non compliant|drug seeking|frequent flyer|malinger|attention seeking)\b/i,
      /\b(because|since)\b.{0,80}\b(old|older|elderly|homeless|unhoused|social risk|poor historian|language barrier|limited english|non[- ]?english|interpreter|disab|psychiatric|substance|drug use|pregnan|female|woman|transgender|race|ethnic|immigrant|insurance|medicaid|uninsured)\b/i,
      /\b(anxiety|dramatic|hysterical|overreacting)\b.{0,80}\b(female|woman|girl|pregnan|pelvic|pain)\b/i,
      /\b(no interpreter|skip (the )?interpreter|without interpreter)\b/i
    ],
    safeResponse: 'Do not lower concern or dismiss symptoms because of age, sex or gender, pregnancy possibility, language access, disability, race or ethnicity, insurance, social risk, psychiatric history, substance-use stigma, or other stereotypes. Use case evidence, interpreter or accommodation needs, reassessment, and equitable safety planning.'
  },
  {
    category: 'premature_closure_or_anchoring',
    severity: 'block',
    patterns: [
      /\b(ignore|rule out without|do not consider|don'?t consider)\b.{0,80}\b(acs|pe|pulmonary embolism|stroke|sepsis|ectopic|bleeding|ischemia)\b/i,
      /\b(fully explains|only diagnosis|nothing else)\b/i,
      /\b(cough|anxiety|viral|benign)\b.{0,80}\b(explains everything|fully explains)\b/i
    ],
    safeResponse: 'Avoid premature closure. Maintain high-risk alternatives until case evidence, objective data, and reassessment support narrowing the differential.'
  },
  {
    category: 'consult_or_handoff_failure',
    severity: 'block',
    patterns: [
      /\b(no handoff|skip handoff|handoff is unnecessary|empty handoff)\b/i,
      /\b(no meaningful handoff|fails? to include)\b/i,
      /\b(escalation|consult)\b.{0,80}\b(no meaningful handoff|fails? to include|missing handoff)\b/i,
      /\bconsult\b.{0,80}\b(no rationale|without rationale|don'?t need to explain)\b/i,
      /\bomit\b.{0,80}\b(sbar|situation|background|assessment|recommendation)\b/i
    ],
    safeResponse: 'Escalation or consult decisions need a concise case-grounded handoff. Use situation, background, assessment, and recommendation, and keep consult truth source-limited until reviewed.'
  }
];

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function highRiskCase(caseRecord = {}) {
  return Number(caseRecord.acuity || caseRecord.source?.reference_esi || 0) <= 2;
}

function admittedCase(caseRecord = {}) {
  return /\badmit|icu|surgery|transfer\b/i.test(String(caseRecord.disposition || caseRecord.source?.disposition || ''));
}

function ruleMatches(rule, text, caseRecord) {
  if (!rule.patterns.some((pattern) => pattern.test(text))) return false;
  if (rule.category === 'undertriage_or_delayed_escalation') return highRiskCase(caseRecord);
  if (rule.category === 'unsafe_discharge_or_false_reassurance') return highRiskCase(caseRecord) || admittedCase(caseRecord);
  return true;
}

function uniqueByCategory(matches) {
  const seen = new Set();
  return matches.filter((match) => {
    if (seen.has(match.category)) return false;
    seen.add(match.category);
    return true;
  });
}

export function evaluateLearnerSafetyInput(input, { caseRecord = null, targetSurface = 'unspecified', phase = '' } = {}) {
  const text = cleanText(input);
  if (!text) {
    return {
      schema_version: LEARNER_SAFETY_POLICY_VERSION,
      status: 'safe',
      block_external_ai: false,
      target_surface: targetSurface,
      phase,
      categories: [],
      issues: [],
      safe_response: '',
      instructions: []
    };
  }

  const matches = uniqueByCategory(SAFETY_RULES
    .filter((rule) => ruleMatches(rule, text, caseRecord))
    .map((rule) => ({
      category: rule.category,
      severity: rule.severity,
      safe_response: rule.safeResponse
    })));

  if (!matches.length) {
    return {
      schema_version: LEARNER_SAFETY_POLICY_VERSION,
      status: 'safe',
      block_external_ai: false,
      target_surface: targetSurface,
      phase,
      categories: [],
      issues: [],
      safe_response: '',
      instructions: buildLearnerSafetySystemInstructions()
    };
  }

  const categories = matches.map((match) => match.category);
  const issues = categories.map((category) => `Learner safety policy matched ${category}.`);
  const safeResponse = [
    matches[0].safe_response,
    'The evidence-based simulator debrief and deterministic scoring remain unchanged.'
  ].join(' ');

  return {
    schema_version: LEARNER_SAFETY_POLICY_VERSION,
    status: 'blocked',
    block_external_ai: true,
    target_surface: targetSurface,
    phase,
    categories,
    issues,
    safe_response: safeResponse,
    instructions: buildLearnerSafetySystemInstructions()
  };
}

export function buildLearnerSafetySystemInstructions() {
  return [
    'This is an educational simulation, not real-time clinical decision support.',
    'Do not provide real-patient advice; redirect real care decisions to local licensed supervision and institutional protocol.',
    'Do not provide patient-specific medication doses, order sets, prescriptions, or procedure instructions.',
    'Do not invent or reveal unavailable objective data, hidden outcomes, reference ESI, final diagnosis, or answer keys.',
    'Do not expose restricted data, raw records, identifiers, dates, or local-only case-source details.',
    'Challenge undertriage, unsafe discharge, bias, premature closure, and missing handoff reasoning using case evidence and source-limited labels.'
  ];
}

export function safetyPolicyFallbackResponse(policy, { role = 'Emergency physician tutor', model = 'local_safety_policy' } = {}) {
  return {
    source: 'Learner safety policy',
    model,
    role,
    summary: policy.safe_response || 'This request was blocked by learner-safety guardrails.',
    teaching_point: 'Use the deterministic debrief, visible case evidence, and reviewed references for simulation learning; do not treat optional AI output as clinical authority.',
    gold_standard_sbar: null,
    next_steps: [
      {
        title: 'Return to simulation evidence',
        evidence: policy.categories?.join(', ') || 'learner safety policy',
        action: 'Restate the question as an educational reasoning question tied to visible case facts.'
      }
    ],
    bullets: policy.issues || [],
    safety_policy: policy,
    grounding: {
      schema_version: 'grounded_llm_output_v1',
      status: 'needs_review',
      issues: policy.issues || ['Learner safety policy blocked external AI use.'],
      claims: [],
      citations: {
        case_evidence_ids: [],
        reference_chunk_ids: [],
        references: [],
        case_evidence: []
      }
    },
    citations: {
      case_evidence_ids: [],
      reference_chunk_ids: [],
      references: [],
      case_evidence: []
    }
  };
}

export function patientSafetyBoundaryAnswer(policy) {
  const categories = new Set(policy?.categories || []);
  if (categories.has('hallucinated_case_fact_or_objective_data')) {
    return "I don't know any test results unless the care team has done them and told me.";
  }
  if (categories.has('role_consistency_or_patient_state_drift')) {
    return "I don't know those medical answers as the patient. I can tell you what I am feeling.";
  }
  if (categories.has('privacy_or_restricted_data_leakage')) {
    return "I don't know anything about private records. I can only tell you what I am experiencing.";
  }
  if (categories.has('ai_scope_confusion_or_real_patient_advice')) {
    return "I am just the simulated patient in this practice case.";
  }
  return "I am not sure about that. I can tell you what symptoms I am feeling right now.";
}
