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

function normalizeText(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
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
    if (/\b(altered|confused|somnolent|overdose|seizure)\b/.test(text)) return 'Patient is rousable but confused; airway is currently patent and needs continuous monitoring.';
    if (/\b(swallow|dysphagia|hoarse|stridor|neck|hematoma|throat)\b/.test(text)) return 'Patient is awake and speaking; airway is patent now. Voice or swallowing symptoms make airway reassessment a high-priority repeat exam.';
    if (rr >= 24 || o2 < 94) return `Patient is awake with increased work of breathing. Airway is patent; oxygenation and respiratory effort need close monitoring.`;
    if (pain >= 8 || hr >= 120 || sbp < 100) return 'Patient appears uncomfortable or physiologically stressed but is awake and protecting the airway.';
    return 'Patient is awake, interactive, and protecting the airway without obvious respiratory distress.';
  }

  if (systemId === 'head_neck_ent') {
    if (/\b(swallow|dysphagia|hoarse|neck|incision|hematoma|stridor|secretion)\b/.test(text)) {
      return 'Simulated ENT exam: voice or swallowing symptoms are present by history; no stridor is documented in the source context; neck swelling, incision status, and secretion handling remain high-risk reassessment findings.';
    }
    if (/\b(headache|fall|head injury)\b/.test(text)) return 'Simulated head/neck exam reviews head trauma signs, pupils, neck tenderness, and airway symptoms; no source-recorded completed exam finding is available.';
    return 'No obvious head, neck, or ENT danger finding is documented in the source context.';
  }

  if (systemId === 'cardiovascular') {
    if (/\b(open fracture|tibia|fibula|foot|wrist|ankle|finger|laceration)\b/.test(text)) return 'Distal perfusion exam at the affected limb finds palpable distal pulses; capillary refill becomes a repeat-check target if pain or swelling changes.';
    if (/\b(chest|cardiac|heart|syncope|orthopnea|edema)\b/.test(text) || hr >= 110 || sbp >= 180 || sbp < 100) return `Cardiovascular exam is anchored by HR ${hr} bpm and systolic BP ${sbp || 'not recorded'}; simulated review pairs perfusion with chest symptoms and vital-sign risk.`;
    return 'Heart rhythm and peripheral perfusion are not flagged by the source context; no shock finding is documented.';
  }

  if (systemId === 'respiratory') {
    if (/\b(shortness of breath|dyspnea|pneumonia|cough|copd|asthma|hypox|oxygen)\b/.test(text) || rr >= 22 || o2 < 95) return `Respiratory review shows RR ${rr} and SpO2 ${o2}%; simulated lung exam documents work of breathing, breath sounds, and oxygen need.`;
    if (/\b(chest pain|chest pressure)\b/.test(text)) return 'Respiratory exam documents breath sounds and work of breathing because chest symptoms can reflect pulmonary or cardiac disease; no source-recorded focal lung finding is available.';
    return 'No respiratory distress or abnormal breath-sound finding is documented in the source context.';
  }

  if (systemId === 'neuro') {
    if (/\b(altered|confused|somnolent|seizure|stroke|slurred|weakness|numb|facial|headache)\b/.test(text)) return 'Mental status or neurologic symptoms are present by history; simulated neuro exam documents orientation, speech, cranial nerve screen, strength, sensation, and glucose when appropriate.';
    if (/\b(fracture|laceration|wound|finger|hand|foot|ankle|leg|wrist)\b/.test(text)) return 'Distal motor and sensory exam around the injury is intact in the simulation unless worsening pain, numbness, or weakness appears.';
    return 'No focal neurologic deficit is documented in the source context.';
  }

  if (systemId === 'abdomen_gi') {
    if (/\b(abd|abdominal|belly|stomach|distention|vomit|rectal|perianal|pelvic)\b/.test(text)) return 'Abdominal or pelvic symptoms are present; simulated exam documents tenderness location, distention, guarding, rebound, and rectal or pelvic findings when indicated.';
    return 'No abdominal danger finding is documented in the source context.';
  }

  if (systemId === 'msk_extremity') {
    if (/\b(open fracture|tibia|fibula|fracture|deformity)\b/.test(text)) return 'Affected extremity has traumatic injury concern; simulated exam documents deformity, tenderness, range of motion, compartment firmness, and distal function.';
    if (/\b(wrist|foot|ankle|hand|finger|leg|fall|sprain)\b/.test(text)) return 'Focused extremity exam documents point tenderness, swelling, range of motion, weight-bearing or tendon function, and distal neurovascular status.';
    return 'No focal musculoskeletal abnormality is documented in the source context.';
  }

  if (systemId === 'skin_wound') {
    if (/\b(gangrene|cellulitis|infection|fever)\b/.test(text) || temp >= 100.4) return 'Skin/source exam looks for erythema, warmth, drainage, necrosis, wounds, lines, and other infection sources.';
    if (/\b(laceration|wound|cut|bleeding|suture|abscess)\b/.test(text)) return 'Wound exam documents active bleeding, contamination, depth, tendon exposure, foreign body concern, erythema, drainage, and need for repair or removal.';
    return 'No wound, rash, or cellulitis finding is documented in the source context.';
  }

  if (systemId === 'gu_rectal_pelvic') {
    if (/\b(rectal|perianal|pelvic)\b/.test(text)) return 'Rectal, perianal, or pelvic symptoms are present; simulated exam documents local tenderness, swelling, drainage, pregnancy-relevant screening, and procedural need.';
    if (/\b(urinary|flank|pregnan)\b/.test(text)) return 'GU review documents urinary symptoms, flank tenderness, and pregnancy-related risk when relevant.';
    return 'No GU, rectal, or pelvic danger finding is documented in the source context.';
  }

  return 'No focused finding is available for this exam system.';
}

function provenanceFromFact(fact, caseData = {}) {
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
    const teachingFact = sourceFact || reviewedTeachingFactForSystem(systemId, examFacts);
    return {
      system_id: systemId,
      system: system.name,
      finding: sourceFact?.statement || findingForSystem(systemId, caseData, vitals),
      rationale: teachingFact?.rationale || (expected.includes(systemId)
        ? 'This exam system matches the case-specific focused exam priorities.'
        : 'This may be reasonable if clinically prompted, but it is less central than the expected focused exam systems for this case.'),
      provenance: provenanceFromFact(teachingFact, caseData),
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
