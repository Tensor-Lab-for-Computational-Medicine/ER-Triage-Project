export const EXAM_SYSTEMS = [
  {
    id: 'general_airway',
    name: 'General / Airway',
    shortName: 'General',
    keywords: ['general', 'appearance', 'airway', 'distress', 'voice', 'swallow', 'stridor', 'secretion', 'mental status', 'unresponsive', 'shock']
  },
  {
    id: 'head_neck_ent',
    name: 'Head / Neck / ENT',
    shortName: 'ENT',
    keywords: ['head', 'neck', 'ent', 'throat', 'swallow', 'voice', 'hoarse', 'stridor', 'incision', 'hematoma', 'secretion', 'face']
  },
  {
    id: 'cardiovascular',
    name: 'Cardiovascular / Perfusion',
    shortName: 'CV',
    keywords: ['cardiac', 'heart', 'pulse', 'perfusion', 'capillary', 'refill', 'vascular', 'blood pressure', 'chest', 'syncope', 'edema']
  },
  {
    id: 'respiratory',
    name: 'Respiratory / Chest',
    shortName: 'Resp',
    keywords: ['respiratory', 'breath', 'lungs', 'chest', 'oxygen', 'wheeze', 'crackles', 'cough', 'dyspnea', 'shortness']
  },
  {
    id: 'neuro',
    name: 'Neuro / Mental Status',
    shortName: 'Neuro',
    keywords: ['neuro', 'mental', 'confusion', 'gcs', 'oriented', 'weakness', 'numb', 'speech', 'pupil', 'seizure', 'fall']
  },
  {
    id: 'abdomen_gi',
    name: 'Abdomen / GI',
    shortName: 'Abdomen',
    keywords: ['abdomen', 'abdominal', 'belly', 'stomach', 'guarding', 'rebound', 'distention', 'rectal', 'perianal', 'pelvic', 'vomit']
  },
  {
    id: 'msk_extremity',
    name: 'MSK / Extremity',
    shortName: 'MSK',
    keywords: ['musculoskeletal', 'extremity', 'wrist', 'hand', 'finger', 'leg', 'foot', 'ankle', 'fracture', 'deformity', 'range of motion', 'tendon']
  },
  {
    id: 'skin_wound',
    name: 'Skin / Wound',
    shortName: 'Skin',
    keywords: ['skin', 'wound', 'laceration', 'cut', 'bleeding', 'erythema', 'warmth', 'cellulitis', 'gangrene', 'suture', 'abscess']
  },
  {
    id: 'gu_rectal_pelvic',
    name: 'GU / Rectal / Pelvic',
    shortName: 'GU',
    keywords: ['gu', 'urinary', 'rectal', 'perianal', 'pelvic', 'pregnancy', 'testicular', 'vaginal', 'flank']
  }
];

const SYSTEM_BY_ID = Object.fromEntries(EXAM_SYSTEMS.map((system) => [system.id, system]));

export const EXAM_DISPLAY_FORBIDDEN_PATTERNS = [
  /\bsource context\b/i,
  /\bsource record\b/i,
  /\bsource bundle\b/i,
  /\bsource physical exam context\b/i,
  /\bsource-recorded\b/i,
  /\bdocumented\b/i,
  /\breviewed teaching inference\b/i,
  /\blocal teaching inference\b/i,
  /\bsimulation\b/i,
  /\bsimulated\b/i,
  /\bfocused exam target\b/i,
  /\bfocused exam should\b/i,
  /\bavailable for this exam system\b/i,
  /\bwhen supported by\b/i,
  /\bunless\b/i
];

function normalizeText(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function learnerFacingExamMetaMatches(value) {
  const text = String(value || '');
  return EXAM_DISPLAY_FORBIDDEN_PATTERNS.filter((pattern) => pattern.test(text));
}

export function hasLearnerFacingExamMetaText(value) {
  return learnerFacingExamMetaMatches(value).length > 0;
}

export function assertLearnerFacingExamText(value, label = 'exam finding') {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) throw new Error(`${label} is empty.`);
  const matches = learnerFacingExamMetaMatches(text);
  if (matches.length) {
    throw new Error(`${label} contains internal exam metadata: ${matches[0]}`);
  }
  return text;
}

function uniqueItems(items) {
  return [...new Set((items || []).filter(Boolean))];
}

function sourceText(caseData = {}) {
  return [
    caseData.id,
    caseData.complaint,
    caseData.history,
    caseData.outcome,
    caseData.intake?.triage_narrative,
    caseData.ground_truth?.diagnoses?.primary?.join?.(' '),
    caseData.ground_truth?.diagnoses?.secondary?.join?.(' '),
    caseData.ground_truth?.tests,
    caseData.ground_truth?.medications,
    ...(caseData.documented_evidence || []).map((item) => item.statement)
  ].filter(Boolean).join(' ');
}

function numberFromVital(value) {
  const match = String(value ?? '').match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function vitalsMap(vitals = []) {
  const map = {};
  for (const vital of vitals || []) {
    const name = String(vital.name || '').toLowerCase();
    const value = numberFromVital(vital.value);
    if (name.includes('heart')) map.hr = value;
    if (name.includes('respiratory')) map.rr = value;
    if (name.includes('oxygen')) map.o2 = value;
    if (name.includes('temperature')) map.temp = value;
    if (name.includes('pain')) map.pain = value;
    if (name.includes('blood pressure')) {
      const parts = String(vital.value || '').split('/');
      map.sbp = numberFromVital(parts[0]);
      map.dbp = numberFromVital(parts[1]);
    }
  }
  return {
    hr: map.hr ?? Number(caseVitals(vitals).hr || 80),
    rr: map.rr ?? Number(caseVitals(vitals).rr || 16),
    o2: map.o2 ?? Number(caseVitals(vitals).o2 || 99),
    temp: map.temp ?? Number(caseVitals(vitals).temp || 98.6),
    pain: map.pain ?? Number(caseVitals(vitals).pain || 0),
    sbp: map.sbp ?? Number(caseVitals(vitals).sbp || 120),
    dbp: map.dbp ?? Number(caseVitals(vitals).dbp || 80)
  };
}

function caseVitals(vitals) {
  return Array.isArray(vitals) ? {} : (vitals || {});
}

export function systemIdsFromText(text) {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  return EXAM_SYSTEMS
    .filter((system) => system.keywords.some((keyword) => normalized.includes(keyword)))
    .map((system) => system.id);
}

function addIf(list, condition, ids) {
  if (!condition) return;
  ids.forEach((id) => list.push(id));
}

export function expectedFocusedExamSystems(caseData = {}, examFacts = [], vitals = []) {
  const text = normalizeText(`${sourceText(caseData)} ${(examFacts || []).map((fact) => `${fact.statement || ''} ${fact.rationale || ''}`).join(' ')}`);
  const expected = [];
  const vitalValues = Array.isArray(vitals) ? vitalsMap(vitals) : { ...caseData.vitals };
  const acuity = Number(caseData.acuity || caseData.ground_truth?.esi || 0);
  const pain = Number(vitalValues.pain || 0);
  const rr = Number(vitalValues.rr || 0);
  const o2 = Number(vitalValues.o2 || 100);
  const hr = Number(vitalValues.hr || 0);
  const sbp = Number(vitalValues.sbp || 120);
  const temp = Number(vitalValues.temp || 98.6);

  if (/\b(medication refill|med refill|refill|ran out|out of (my )?medicine)\b/.test(text) &&
    acuity >= 5 &&
    pain < 5 &&
    rr < 22 &&
    o2 >= 94 &&
    hr < 110 &&
    sbp >= 100 &&
    temp < 100.4) {
    return ['general_airway'];
  }

  for (const fact of examFacts || []) {
    const sourceBacked = fact.provenance === 'source_record' || /^source physical exam context/i.test(String(fact.statement || ''));
    if (!sourceBacked) continue;
    expected.push(...systemIdsFromText(`${fact.statement || ''} ${fact.rationale || ''} ${(fact.source_anchors || []).join(' ')}`));
  }

  addIf(expected, acuity <= 2 || pain >= 8 || rr >= 24 || o2 < 94 || hr >= 120 || sbp < 100, ['general_airway']);
  addIf(expected, /\b(swallow|dysphagia|hoarse|voice|stridor|throat|neck|ent|incision|hematoma|secretion)\b/.test(text), ['general_airway', 'head_neck_ent']);
  addIf(expected, /\b(chest pain|pressure|palpitation|syncope|heart|cardiac|atrial|fibrillation|orthopnea|edema)\b/.test(text) || hr >= 110 || sbp >= 180 || sbp < 100, ['cardiovascular']);
  addIf(expected, /\b(shortness of breath|dyspnea|breath|cough|pneumonia|copd|asthma|oxygen|hypox|respiratory|wheeze)\b/.test(text) || rr >= 22 || o2 < 95, ['respiratory']);
  addIf(expected, /\b(altered|confusion|confused|mental|slurred|weakness|numb|facial|stroke|seizure|headache|fall|unresponsive|somnolent)\b/.test(text), ['neuro']);
  addIf(expected, /\b(abd|abdominal|belly|stomach|vomit|nausea|distention|guarding|rebound|rectal|perianal|pelvic)\b/.test(text), ['abdomen_gi']);
  addIf(expected, /\b(fracture|sprain|wrist|ankle|foot|hand|finger|leg|extremity|deformity|tendon|range of motion|bear weight|fall)\b/.test(text), ['msk_extremity']);
  addIf(expected, /\b(wound|laceration|cut|bleeding|suture|cellulitis|gangrene|infection|erythema|warmth|abscess|skin)\b/.test(text) || temp >= 100.4, ['skin_wound']);
  addIf(expected, /\b(rectal|perianal|pelvic|urinary|flank|pregnan|gu)\b/.test(text), ['gu_rectal_pelvic']);

  if (!expected.length) expected.push('general_airway');
  return uniqueItems(expected).filter((id) => SYSTEM_BY_ID[id]);
}

function sourceBackedFactForSystem(systemId, examFacts = []) {
  return (examFacts || []).find((fact) => {
    if (fact.provenance !== 'source_record') return false;
    return systemIdsFromText(`${fact.statement || ''} ${fact.rationale || ''} ${(fact.source_anchors || []).join(' ')}`).includes(systemId);
  });
}

function reviewedTeachingFactForSystem(systemId, examFacts = []) {
  return (examFacts || []).find((fact) =>
    systemIdsFromText(`${fact.statement || ''} ${fact.rationale || ''} ${(fact.source_anchors || []).join(' ')}`).includes(systemId)
  );
}

function learnerFacingSourceFactText(fact) {
  const statement = String(fact?.statement || '')
    .replace(/^source physical exam context:\s*/i, '')
    .replace(/^focused exam finding:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!statement || /^focused exam should\b/i.test(statement)) return '';
  if (hasLearnerFacingExamMetaText(statement)) return '';
  return statement;
}

function evidenceBasisFromFact(fact, caseData = {}) {
  if (fact?.provenance === 'source_record') return 'source_record';
  if (fact?.review_status === 'reviewed') return 'reviewed_teaching_inference';
  if (caseData?.source_restriction === 'credentialed_local_only') return 'local_teaching_inference';
  return 'rule_based_simulation';
}

function findingForSystem(systemId, caseData = {}, vitals = []) {
  const text = normalizeText(sourceText(caseData));
  const v = Array.isArray(vitals) ? vitalsMap(vitals) : { ...caseData.vitals };
  const pain = Number(v.pain || 0);
  const rr = Number(v.rr || 16);
  const o2 = Number(v.o2 || 99);
  const hr = Number(v.hr || 80);
  const sbp = Number(v.sbp || 120);
  const temp = Number(v.temp || 98.6);

  if (systemId === 'general_airway') {
    if (/\b(unresponsive|cardiac arrest|cpr|apneic)\b/.test(text)) return 'Patient is unresponsive or unable to protect the airway; immediate resuscitation is required.';
    if (/\b(altered|confused|somnolent|overdose|seizure)\b/.test(text)) return 'Patient is rousable but confused; airway is patent.';
    if (/\b(swallow|dysphagia|hoarse|stridor|neck|hematoma|throat)\b/.test(text)) return 'Patient is awake and speaking. Airway is patent without stridor at rest.';
    if (rr >= 24 || o2 < 94) return 'Patient is awake with increased work of breathing; airway remains patent.';
    if (pain >= 8 || hr >= 120 || sbp < 100) return 'Patient appears uncomfortable or physiologically stressed but is awake and protecting the airway.';
    return 'Patient is awake, interactive, and protecting the airway without obvious respiratory distress.';
  }

  if (systemId === 'head_neck_ent') {
    if (/\b(swallow|dysphagia|hoarse|neck|incision|hematoma|stridor|secretion)\b/.test(text)) {
      return 'Voice is clear to mildly hoarse; secretions are handled without drooling, and no stridor is heard at rest.';
    }
    if (/\b(headache|fall|head injury)\b/.test(text)) return 'Scalp and face show no visible trauma; pupils are equal, and the neck has no midline tenderness on screening.';
    return 'Head and neck exam shows no visible swelling, drooling, stridor, or focal ENT abnormality.';
  }

  if (systemId === 'cardiovascular') {
    if (/\b(open fracture|tibia|fibula|foot|wrist|ankle|finger|laceration)\b/.test(text)) return 'Distal pulses are palpable with brisk capillary refill at the affected limb.';
    if (/\b(chest|cardiac|heart|syncope|orthopnea|edema)\b/.test(text) || hr >= 110 || sbp >= 180 || sbp < 100) return `Heart rate is ${hr} bpm with warm peripheral perfusion and no mottling.`;
    return 'Peripheral pulses are palpable and perfusion is warm without shock appearance.';
  }

  if (systemId === 'respiratory') {
    if (rr >= 22 || o2 < 95) return `Respirations are ${rr}/min with increased work of breathing; oxygen saturation is ${o2}%.`;
    if (/\b(shortness of breath|dyspnea|pneumonia|cough|copd|asthma|hypox|oxygen)\b/.test(text)) return 'Work of breathing is mildly increased; bilateral breath sounds are present.';
    if (/\b(chest pain|chest pressure)\b/.test(text)) return 'Breathing is unlabored with symmetric chest rise and bilateral breath sounds.';
    return 'Breathing is unlabored with clear bilateral breath sounds.';
  }

  if (systemId === 'neuro') {
    const negatedNeuroSymptom = /\b(no|denies|without)\b(?:\s+\w+){0,35}\s+(headache|weakness|numbness|numb|slurred|facial|seizure|confusion|confused|altered)\b/.test(text);
    if (/\b(altered|confused|somnolent|seizure)\b/.test(text)) return 'Patient is confused but rousable; speech is understandable, and all extremities move spontaneously.';
    if (/\b(flaccid|left sided|left-sided|right sided|right-sided|hemiparesis|arm drift|leg drift)\b/.test(text)) return 'Neurologic screen is abnormal with asymmetric limb weakness; speech, facial symmetry, sensation, and last-known-well need immediate clarification.';
    if (/\b(slurred|aphasia|speech)\b/.test(text)) return 'Speech is abnormal on screening; facial symmetry, limb strength, sensation, and glucose should be checked immediately.';
    if (!negatedNeuroSymptom && /\b(facial|stroke|weakness|numb)\b/.test(text)) return 'Neurologic screen is abnormal or concerning for a focal deficit; document face, arm, leg, speech, sensation, glucose, and timing.';
    if (!negatedNeuroSymptom && /\b(headache|fall|head injury)\b/.test(text)) return 'Patient is alert on screening without obvious focal motor deficit; repeat neurologic checks are still needed if symptoms evolve.';
    if (/\b(fracture|laceration|wound|finger|hand|foot|ankle|leg|wrist)\b/.test(text)) return 'Motor strength and sensation are intact distal to the injury.';
    return 'Mental status is alert and oriented with no focal motor or sensory deficit on screening.';
  }

  if (systemId === 'abdomen_gi') {
    if (/\b(distention|guarding|rebound|rigid)\b/.test(text)) return 'Abdomen is distended and tender, with guarding concerning for peritoneal irritation.';
    if (/\b(abd|abdominal|belly|stomach|vomit|rectal|perianal|pelvic)\b/.test(text)) return 'Abdomen is tender at the reported area of pain without diffuse rigidity on screening.';
    return 'Abdomen is soft, nondistended, and without focal peritoneal tenderness on screening.';
  }

  if (systemId === 'msk_extremity') {
    if (/\b(open fracture|tibia|fibula|fracture|deformity)\b/.test(text)) return 'Affected extremity has traumatic deformity or wound concern with focal tenderness; distal motor function, sensation, and pulses are intact on screening.';
    if (/\b(wrist|foot|ankle|hand|finger|leg|fall|sprain)\b/.test(text)) return 'Affected extremity has focal tenderness and swelling with preserved distal motor function, sensation, and capillary refill.';
    return 'Extremities have no focal deformity, swelling, or point tenderness on screening.';
  }

  if (systemId === 'skin_wound') {
    if (/\b(gangrene|cellulitis|infection|fever)\b/.test(text) || temp >= 100.4) return 'Skin is warm; erythema, wound, drainage, or necrosis is localized to the area of complaint.';
    if (/\b(laceration|wound|cut|bleeding|suture|abscess)\b/.test(text)) return 'Wound has localized tenderness; no uncontrolled bleeding is present on focused inspection.';
    return 'Skin inspection shows no rash, cellulitis, drainage, or open wound on screening.';
  }

  if (systemId === 'gu_rectal_pelvic') {
    if (/\b(rectal|perianal|pelvic)\b/.test(text)) return 'Focused screening localizes tenderness to the pelvic, perianal, or rectal complaint area without gross bleeding on bedside assessment.';
    if (/\b(urinary|flank|pregnan)\b/.test(text)) return 'Suprapubic and costovertebral angle tenderness are not prominent on focused GU screening.';
    return 'No suprapubic tenderness, flank tenderness, gross GU abnormality, rectal concern, or pelvic danger finding is elicited on focused screening.';
  }

  return 'Focused screening exam is reassuring for this system.';
}

function provenanceFromFact(fact, caseData = {}) {
  if (!fact) return 'Case-based formative exam';
  if (fact?.provenance === 'source_record') return 'Source record';
  if (fact?.review_status === 'reviewed') return 'Reviewed teaching inference';
  if (caseData?.source_restriction === 'credentialed_local_only') return 'Local teaching inference';
  return 'Reviewed teaching inference';
}

export function buildFocusedExamSelection(caseData = {}, selectedSystemIds = [], examFacts = [], vitals = []) {
  const selected = uniqueItems(selectedSystemIds).filter((id) => SYSTEM_BY_ID[id]);
  if (!selected.length) throw new Error('Select at least one focused exam system.');
  const expected = expectedFocusedExamSystems(caseData, examFacts, vitals);
  const matched = selected.filter((id) => expected.includes(id));
  const missed = expected.filter((id) => !selected.includes(id));
  const extra = selected.filter((id) => !expected.includes(id));
  const findings = selected.map((systemId) => {
    const system = SYSTEM_BY_ID[systemId];
    const sourceFact = sourceBackedFactForSystem(systemId, examFacts);
    const sourceFinding = learnerFacingSourceFactText(sourceFact);
    const usesSourceFinding = Boolean(sourceFinding);
    const teachingFact = usesSourceFinding ? sourceFact : reviewedTeachingFactForSystem(systemId, examFacts);
    const fallbackFinding = findingForSystem(systemId, caseData, vitals);
    const finding = assertLearnerFacingExamText(
      sourceFinding || fallbackFinding,
      `${system.name} learner-facing finding`
    );
    return {
      system_id: systemId,
      system: system.name,
      finding,
      clinical_status: expected.includes(systemId) ? 'case_relevant' : 'neutral_extra',
      evidence_basis: usesSourceFinding ? evidenceBasisFromFact(sourceFact, caseData) : 'case_based_formative_exam',
      rationale: teachingFact?.rationale || (expected.includes(systemId)
        ? 'This exam system matches the case-specific focused exam priorities.'
        : 'This may be reasonable if clinically prompted, but it is less central than the expected focused exam systems for this case.'),
      provenance: usesSourceFinding ? provenanceFromFact(sourceFact, caseData) : provenanceFromFact(null, caseData),
      source_anchors: teachingFact?.source_anchors || []
    };
  });

  return {
    selected_systems: selected.map((id) => SYSTEM_BY_ID[id]),
    expected_systems: expected.map((id) => SYSTEM_BY_ID[id]),
    matched_systems: matched.map((id) => SYSTEM_BY_ID[id]),
    missed_systems: missed.map((id) => SYSTEM_BY_ID[id]),
    extra_systems: extra.map((id) => SYSTEM_BY_ID[id]),
    findings,
    summary: summarizeExamSelection({ matched, missed, extra }),
    score: scoreFocusedExamSelection({ selected, expected, matched, missed, extra })
  };
}

export function scoreFocusedExamSelection(selection) {
  const selected = selection.selected || selection.selected_systems?.map((item) => item.id) || [];
  const expected = selection.expected || selection.expected_systems?.map((item) => item.id) || [];
  const matched = selection.matched || selection.matched_systems?.map((item) => item.id) || selected.filter((id) => expected.includes(id));
  const missed = selection.missed || selection.missed_systems?.map((item) => item.id) || expected.filter((id) => !selected.includes(id));
  const extra = selection.extra || selection.extra_systems?.map((item) => item.id) || selected.filter((id) => !expected.includes(id));
  if (!expected.length) return selected.length <= 1 ? 8 : Math.max(4, 8 - extra.length);
  const base = Math.round((matched.length / expected.length) * 10);
  return Math.max(0, Math.min(10, base - (extra.length * 1) - (missed.length ? 1 : 0)));
}

function summarizeExamSelection({ matched, missed, extra }) {
  if (missed.length === 0 && extra.length <= 1) return 'Focused exam choices covered the key case-specific systems.';
  if (matched.length && missed.length) return 'Some key focused exam systems were covered, but important systems were missed.';
  if (extra.length && !matched.length) return 'Selected exam systems were broad or off-target for this presentation.';
  return 'Focused exam selection needs tighter alignment with the complaint, vitals, and risk signals.';
}
