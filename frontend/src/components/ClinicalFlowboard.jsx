import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle,
  ClipboardText,
  Copy,
  ListChecks,
  Lock,
  MagnifyingGlass,
  NotePencil,
  Pulse,
  Repeat,
  UserSound
} from '@phosphor-icons/react';
import {
  askPatientQuestion,
  assignProvisionalTriage,
  assignTriage,
  clearTutorSettings,
  formatAiErrorForLearner,
  generateFlowboardArtifact,
  getFeedback,
  getFlowboardCaseOptions,
  getReassessmentScenario,
  getTutorSettings,
  isAiAuthError,
  recordDiagnosis,
  recordFlowboardEvent,
  recordFocusedExam,
  saveTutorSettings,
  selectEscalationActions,
  startSimulation,
  submitReassessment,
  submitSoap,
  testTutorConnection
} from '../services/api';
import { EXAM_SYSTEMS } from '../services/examEngine';
import '../styles/Flowboard.css';

const ARRIVAL_CHECKS = [
  { id: 'airway_voice', label: 'Airway, voice, and secretions' },
  { id: 'breathing', label: 'Work of breathing and oxygenation' },
  { id: 'circulation', label: 'Pulses, skin, bleeding, and perfusion' },
  { id: 'mental_status', label: 'Mental status and focal deficit screen' }
];

const PLACEMENT_OPTIONS = [
  { value: 'waiting', label: 'Waiting area' },
  { value: 'vertical', label: 'Vertical care' },
  { value: 'acute', label: 'Acute bed' },
  { value: 'monitored', label: 'Monitored bed' },
  { value: 'resus', label: 'Resuscitation bay' }
];

const ACUITY_OPTIONS = [1, 2, 3, 4, 5].map((level) => ({ value: String(level), label: `ESI ${level}` }));

const ARRIVAL_ACTIONS = [
  { id: 'airway_oxygenation_support', domain: 'B', label: 'Oxygen or bronchodilator if indicated', cue: 'Work of breathing, hypoxemia, wheeze, poor speech.' },
  { id: 'monitored_bed', domain: 'C', label: 'Cardiac monitor + repeat vitals', cue: 'Chest pain, abnormal vitals, arrhythmia, unstable trajectory.' },
  { id: 'vascular_access', domain: 'C', label: 'IV access + urgent bloodwork', cue: 'Likely admission, contrast study, medications, sepsis, bleeding.' },
  { id: 'ecg', domain: 'C', label: 'Immediate ECG', cue: 'Chest pain, dyspnea, syncope, palpitations, high-risk weakness.' },
  { id: 'poc_glucose', domain: 'D', label: 'Bedside glucose', cue: 'Altered mental status, seizure, diabetes, unexplained weakness.' },
  { id: 'pain_reassessment', domain: 'E', label: 'Analgesia + reassessment timer', cue: 'Severe pain that could mask deterioration or change disposition.' }
];

const ARRIVAL_ACTION_BY_ID = Object.fromEntries(ARRIVAL_ACTIONS.map((action) => [action.id, action]));

const ORDER_ACTIONS = [
  { id: 'bloodwork_labs', label: 'CBC/CMP and priority labs' },
  { id: 'poc_glucose', label: 'Point-of-care glucose' },
  { id: 'ecg', label: 'ECG' },
  { id: 'chest_xray', label: 'Chest X-ray' },
  { id: 'ct_with_contrast', label: 'CT with contrast' },
  { id: 'ct_without_contrast', label: 'CT without contrast' },
  { id: 'cultures', label: 'Blood or source cultures' },
  { id: 'iv_fluids', label: 'IV fluids' },
  { id: 'analgesia', label: 'Analgesia' },
  { id: 'antiemetics', label: 'Antiemetic' },
  { id: 'bronchodilators', label: 'Bronchodilator treatment' },
  { id: 'antibiotics', label: 'Empiric antibiotics' },
  { id: 'consult_surgery', label: 'Surgery consult' },
  { id: 'consult_neurology', label: 'Neurology or stroke team' },
  { id: 'consult_orthopedics', label: 'Orthopedics consult' },
  { id: 'consult_critical_care', label: 'Critical care consult' }
];

const OPEN_EVIDENCE_URL = 'https://www.openevidence.com/';
const ACTION_LABELS = Object.fromEntries(
  [...ARRIVAL_ACTIONS, ...ORDER_ACTIONS].map((action) => [action.id, action.label])
);

const STAGES = [
  {
    id: 'arrival',
    title: 'Arrival Decision',
    short: 'Arrival',
    icon: Pulse,
    task: 'Complete bedside checks, choose placement, and act on risk.'
  },
  {
    id: 'history-exam',
    title: 'Focused History + Exam',
    short: 'History/exam',
    icon: MagnifyingGlass,
    task: 'Question the patient and choose up to three focused exams.'
  },
  {
    id: 'orders',
    title: 'Orders + Results',
    short: 'Orders',
    icon: UserSound,
    task: 'Order consequence-bearing tests or treatments and release results.'
  },
  {
    id: 'workup',
    title: 'Differential Strategy',
    short: 'Differential',
    icon: ListChecks,
    task: 'Rank diagnoses and justify why each is likely or less likely.'
  },
  {
    id: 'reassess',
    title: 'Reassessment',
    short: 'Reassess',
    icon: Repeat,
    task: 'Request the nursing update and decide what changes management.'
  },
  {
    id: 'soap',
    title: 'SOAP Note',
    short: 'SOAP',
    icon: NotePencil,
    task: 'Write the clinical story, problem list, and plan.'
  },
  {
    id: 'learn',
    title: 'Learn',
    short: 'Learn',
    icon: ClipboardText,
    task: 'Review scoring and copy a concise OpenEvidence question.'
  }
];

const INITIAL_INPUTS = {
  arrivalChecks: [],
  location: '',
  acuity: '',
  arrivalActions: [],
  patientQuestion: '',
  orderActions: [],
  resultReleaseReason: '',
  trajectory: '',
  managementChange: '',
  soapOneLiner: '',
  soapHpi: '',
  soapObjective: '',
  soapAssessment: '',
  soapPlan: ''
};

function hasEntry(value) {
  return String(value || '').trim().length > 0;
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function actionLabel(actionId) {
  return ACTION_LABELS[actionId] || String(actionId || '').replaceAll('_', ' ');
}

function actionResultKey(stage, actionId) {
  return `${stage}:${actionId}`;
}

function asNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatVitalValue(value, fallback = 'Not listed') {
  return value === null || value === undefined || value === '' ? fallback : String(value);
}

function vitalRows(caseRecord) {
  const vitals = caseRecord?.vitals || {};
  return [
    ['T', formatVitalValue(vitals.temp), 'F'],
    ['HR', formatVitalValue(vitals.hr), 'bpm'],
    ['BP', `${formatVitalValue(vitals.sbp)}/${formatVitalValue(vitals.dbp)}`, 'mmHg'],
    ['RR', formatVitalValue(vitals.rr), '/min'],
    ['O2', formatVitalValue(vitals.o2), '%'],
    ['Pain', formatVitalValue(vitals.pain), '/10']
  ];
}

function vitalsLine(caseRecord) {
  return vitalRows(caseRecord)
    .map(([label, value, unit]) => `${label} ${value}${unit ? ` ${unit}` : ''}`)
    .join(', ');
}

function activeInterventionLabels(caseRecord) {
  return Object.entries(caseRecord?.interventions || {})
    .filter(([, value]) => value)
    .map(([key]) => key.replaceAll('_', ' '));
}

function caseText(caseRecord) {
  return normalizeText([
    caseRecord?.complaint,
    caseRecord?.title,
    caseRecord?.history,
    caseRecord?.intake_note,
    caseRecord?.likely_working_diagnosis,
    ...(caseRecord?.ddx || []).map((item) => item.diagnosis)
  ].filter(Boolean).join(' '));
}

function caseRawText(caseRecord) {
  return [
    caseRecord?.complaint,
    caseRecord?.title,
    caseRecord?.history,
    caseRecord?.intake_note,
    caseRecord?.likely_working_diagnosis,
    ...(caseRecord?.ddx || []).map((item) => item.diagnosis)
  ].filter(Boolean).join(' ');
}

function negatesNearby(rawText, terms) {
  const termPattern = terms.join('|');
  const pattern = new RegExp(`\\b(no|denies|without|no symptoms of)\\b[\\s\\S]{0,180}\\b(${termPattern})\\b`, 'i');
  return pattern.test(String(rawText || ''));
}

function hasPositiveNeuroSignal(caseRecord) {
  const raw = caseRawText(caseRecord);
  const text = normalizeText(raw);
  if (/\b(altered mental status|altered level of consciousness|unresponsive|somnolent|confus|seizure|stroke|facial droop|slurred|aphasia|flaccid|focal deficit)\b/.test(text)) return true;
  if (/\b(weakness|numbness|numb|headache|fall|syncope)\b/.test(text)) {
    return !negatesNearby(raw, ['weakness', 'numbness', 'numb', 'headache', 'fall', 'syncope']);
  }
  return false;
}

function respiratoryCaseDetail(caseRecord) {
  const raw = caseRawText(caseRecord);
  const vitals = caseRecord?.vitals || {};
  const pieces = [];
  if (/\bproductive cough\b/i.test(raw)) pieces.push('productive cough');
  if (/\b(yellow|green|sputum|phlegm)\b/i.test(raw)) pieces.push('sputum');
  if (/\bwheez/i.test(raw)) pieces.push('wheezing');
  if (/\bCOPD\b/i.test(raw)) pieces.push('COPD history');
  if (/\bdyspnea on exertion\b/i.test(raw)) pieces.push('dyspnea on exertion');
  if (/\bno dyspnea at rest\b/i.test(raw)) pieces.push('no dyspnea at rest documented');
  const symptomText = pieces.length ? pieces.join(', ') : 'respiratory symptoms';
  return `${symptomText}; RR ${formatVitalValue(vitals.rr)}/min and SpO2 ${formatVitalValue(vitals.o2)}%.`;
}

function dangerSignals(caseRecord) {
  const vitals = caseRecord?.vitals || {};
  const text = caseText(caseRecord);
  const neuro = hasPositiveNeuroSignal(caseRecord);
  return {
    hypotension: Number(vitals.sbp) > 0 && Number(vitals.sbp) < 90,
    tachycardia: Number(vitals.hr) >= 120,
    hypoxemia: Number(vitals.o2) > 0 && Number(vitals.o2) < 94,
    tachypnea: Number(vitals.rr) >= 24,
    severePain: Number(vitals.pain) >= 8,
    respiratory: /\b(dyspnea|shortness|wheez|copd|asthma|pneumonia|hypox|oxygen)\b/.test(text),
    chestPain: /\b(chest|pressure|palpitation|syncope)\b/.test(text),
    infection: /\b(fever|sepsis|infection|cellulitis|abscess|pneumonia|gangrene|osteomyelitis)\b/.test(text),
    neuro,
    traumaOrWound: /\b(fracture|laceration|wound|injury|trauma|bleed|swelling)\b/.test(text),
    abdomen: /\b(abd|abdominal|pelvic|vomit|nausea|distention|rectal|perianal)\b/.test(text)
  };
}

function expectedActionIds(caseRecord) {
  const signals = dangerSignals(caseRecord);
  const interventions = caseRecord?.interventions || {};
  const highAcuity = Number(caseRecord?.reference_esi) <= 2;
  return unique([
    highAcuity || signals.tachycardia || signals.tachypnea ? 'monitored_bed' : '',
    signals.respiratory || signals.hypoxemia || interventions.nebulized_medications || interventions.invasive_ventilation ? 'airway_oxygenation_support' : '',
    caseRecord?.lab_event_count || interventions.intravenous || interventions.intravenous_fluids ? 'vascular_access' : '',
    signals.chestPain || signals.respiratory || highAcuity ? 'ecg' : '',
    signals.severePain ? 'pain_reassessment' : '',
    signals.infection || caseRecord?.microbio_event_count ? 'cultures' : '',
    signals.infection ? 'antibiotics' : '',
    signals.abdomen || caseRecord?.procedure_count ? 'ct_with_contrast' : '',
    signals.traumaOrWound ? 'consult_orthopedics' : '',
    signals.neuro ? 'poc_glucose' : ''
  ]);
}

function scoreSelectedActions(caseRecord, selectedActionIds) {
  const expected = expectedActionIds(caseRecord);
  const selected = unique(selectedActionIds);
  const matched = expected.filter((id) => selected.includes(id));
  const missed = expected.filter((id) => !selected.includes(id));
  const extra = selected.filter((id) => !expected.includes(id));
  return {
    expected,
    matched,
    missed,
    extra,
    score: matched.length,
    possible: expected.length || 1
  };
}

function placementScore(caseRecord, location) {
  const reference = Number(caseRecord?.reference_esi || 0);
  const targets = reference <= 1
    ? ['resus']
    : reference === 2
      ? ['monitored', 'resus']
      : reference === 3
        ? ['acute', 'monitored']
        : ['waiting', 'vertical', 'acute'];
  return {
    targets,
    score: targets.includes(location) ? 2 : 0,
    possible: 2
  };
}

function acuityScore(caseRecord, acuity) {
  const reference = asNumber(caseRecord?.reference_esi);
  const learner = asNumber(acuity);
  if (!reference || !learner) return { score: 0, possible: 2, reference, learner };
  return {
    score: learner === reference ? 2 : Math.abs(learner - reference) === 1 ? 1 : 0,
    possible: 2,
    reference,
    learner
  };
}

function scoreDifferential(caseRecord, differentials) {
  const referenceDdx = caseRecord?.ddx || [];
  const referenceTerms = referenceDdx.map((item) => normalizeText(item.diagnosis));
  const likely = normalizeText(caseRecord?.likely_working_diagnosis || referenceDdx[0]?.diagnosis || '');
  const rows = differentials.map((item, index) => {
    const text = normalizeText(item.diagnosis);
    const matchedIndex = referenceTerms.findIndex((term) => term && (term.includes(text) || text.includes(term.split(' ')[0])));
    const likelyMatch = likely && (likely.includes(text) || text.split(' ').some((term) => likely.includes(term) && term.length > 4));
    return {
      ...item,
      rank: index + 1,
      matched: matchedIndex >= 0 || likelyMatch,
      reference: matchedIndex >= 0 ? referenceDdx[matchedIndex]?.diagnosis : likelyMatch ? caseRecord?.likely_working_diagnosis : ''
    };
  });
  const matched = rows.filter((item) => item.matched);
  const topMatched = Boolean(rows[0]?.matched);
  return {
    rows,
    score: matched.length + (topMatched ? 1 : 0),
    possible: Math.max(2, Math.min(4, referenceDdx.length + 1)),
    matched,
    referenceDdx
  };
}

function arrivalFinding(checkId, caseRecord) {
  const vitals = caseRecord?.vitals || {};
  const text = caseText(caseRecord);
  const raw = caseRawText(caseRecord);
  if (checkId === 'airway_voice') {
    if (/\b(intubat|ventilat|unresponsive|airway protection)\b/.test(text)) return 'Airway is not independently protected; definitive airway or ventilatory support is already part of the case context.';
    if (/\b(dysphagia|hoarse|swallow|neck swelling|stridor)\b/.test(text)) return 'Voice, secretion handling, stridor, and neck swelling require immediate bedside attention.';
    return 'Patient can speak enough to answer focused questions; no immediate airway obstruction is visible at the bedside.';
  }
  if (checkId === 'breathing') {
    if (Number(vitals.o2) > 0 && Number(vitals.o2) < 94) return `Oxygen saturation is ${vitals.o2}% with respiratory risk that needs active monitoring.`;
    if (Number(vitals.rr) >= 22 || /\b(dyspnea|shortness|wheez|copd|pneumonia)\b/.test(text)) return `Breathing concern is case-specific: ${respiratoryCaseDetail(caseRecord)}`;
    return 'Breathing is not the dominant arrival threat from the available source data.';
  }
  if (checkId === 'circulation') {
    if (Number(vitals.sbp) > 0 && Number(vitals.sbp) < 100) return `Blood pressure is ${formatVitalValue(vitals.sbp)}/${formatVitalValue(vitals.dbp)} with perfusion risk.`;
    if (Number(vitals.hr) >= 120) return `Heart rate is ${vitals.hr}, so perfusion, rhythm, and shock physiology need reassessment.`;
    if (/\b(chest pain|dyspnea|pe|pulmonary embol|acs|ischemi)\b/.test(text)) {
      return `Perfusion is stable at BP ${formatVitalValue(vitals.sbp)}/${formatVitalValue(vitals.dbp)} and HR ${formatVitalValue(vitals.hr)}, but chest pain with dyspnea still needs rhythm and ischemia screening.`;
    }
    return `Perfusion screen starts from BP ${formatVitalValue(vitals.sbp)}/${formatVitalValue(vitals.dbp)} and HR ${formatVitalValue(vitals.hr)}.`;
  }
  if (checkId === 'mental_status') {
    if (hasPositiveNeuroSignal(caseRecord)) return 'Mental status or neurologic risk is part of this presentation and needs focused reassessment.';
    if (/\b(no symptoms of\b[\s\S]{0,180}\b(headache|weakness|numb|confus|seizure)\b)/i.test(raw)) {
      return 'Patient is awake and participating; source history does not document headache, weakness, seizure, or confusion as part of this arrival problem.';
    }
    return 'Patient appears able to participate in focused history from the arrival data available.';
  }
  return '';
}

function arrivalInterventionsForCheck(checkId, caseRecord) {
  const vitals = caseRecord?.vitals || {};
  const text = caseText(caseRecord);
  const ids = [];

  if (checkId === 'airway_voice') {
    if (/\b(intubat|ventilat|unresponsive|airway protection|dysphagia|hoarse|swallow|neck swelling|stridor)\b/.test(text)) {
      ids.push('airway_oxygenation_support');
    }
  }

  if (checkId === 'breathing') {
    if (Number(vitals.o2) < 95 || Number(vitals.rr) >= 22 || /\b(dyspnea|shortness|wheez|copd|pneumonia|respiratory distress)\b/.test(text)) {
      ids.push('airway_oxygenation_support');
    }
  }

  if (checkId === 'circulation') {
    if (/\b(chest pain|dyspnea|syncope|palpitation|cardiac|pe|pulmonary embol|acs|ischemi)\b/.test(text) || Number(vitals.hr) >= 110 || Number(vitals.sbp) < 100) {
      ids.push('monitored_bed', 'ecg');
    }
    if (Number(vitals.sbp) < 100 || Number(vitals.hr) >= 110 || Number(vitals.pain) >= 8 || /\b(admit|sepsis|bleed|contrast|ct|intravenous|iv fluids|lab)\b/.test(text)) {
      ids.push('vascular_access');
    }
  }

  if (checkId === 'mental_status') {
    if (hasPositiveNeuroSignal(caseRecord)) {
      ids.push('poc_glucose');
    }
  }

  return unique(ids).map((id) => ARRIVAL_ACTION_BY_ID[id]).filter(Boolean);
}

function appendText(current, text) {
  const addition = String(text || '').trim();
  if (!addition) return current;
  const prior = String(current || '').trim();
  return prior ? `${prior}\n${addition}` : addition;
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function upsertSoapBlock(current, label, text) {
  const body = String(text || '').trim();
  if (!body) return current;
  const heading = `${label}:`;
  const block = `${heading}\n${body}`;
  const source = String(current || '').trim();
  if (!source) return block;
  const pattern = new RegExp(`(^|\\n\\n)${escapeRegExp(heading)}\\n[\\s\\S]*?(?=\\n\\n[A-Z][A-Za-z /()]+:\\n|$)`);
  if (pattern.test(source)) {
    return source.replace(pattern, (match, prefix = '') => `${prefix}${block}`);
  }
  return `${source}\n\n${block}`;
}

function sourceLimitItems(caseRecord) {
  const missing = (caseRecord?.missing_evidence || [])
    .map((item) => item.reason || item.domain)
    .filter(Boolean);
  if (caseRecord?.source_restriction === 'public_demo') {
    missing.push('Public cases may include resource counts without raw lab values or repeat vital-sign rows.');
  }
  return unique(missing).slice(0, 5);
}

function buildOpenEvidenceQuestion({ caseRecord, scoring }) {
  const complaint = caseRecord?.complaint || 'this ED presentation';
  const ddx = (caseRecord?.ddx || [])
    .slice(0, 3)
    .map((item) => item.diagnosis)
    .filter(Boolean);
  const weakDomains = [...(scoring?.domains || [])]
    .filter((domain) => domain.possible && domain.score < domain.possible)
    .sort((a, b) => (a.score / a.possible) - (b.score / b.possible))
    .slice(0, 3)
    .map((domain) => domain.label.toLowerCase());
  const focus = weakDomains.length
    ? `with emphasis on ${weakDomains.join(', ')}`
    : 'with emphasis on safe reassessment and disposition';
  const differentialText = ddx.length
    ? `distinguish ${ddx.join(', ')}`
    : 'separate dangerous from lower-risk causes';
  return `In an emergency department patient with ${complaint.toLowerCase()}, what evidence-based approach helps a learner ${differentialText}, choose appropriate tests and treatments, and identify reassessment findings that should change level of care, ${focus}?`;
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder, rows = 3 }) {
  return (
    <Field label={label}>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
      />
    </Field>
  );
}

function RadioGroup({ label, value, onChange, options }) {
  return (
    <fieldset className="choice-group">
      <legend>{label}</legend>
      <div>
        {options.map((option) => (
          <button
            type="button"
            key={option.value}
            className={value === option.value ? 'selected' : ''}
            onClick={() => onChange(option.value, option.label)}
            aria-pressed={value === option.value}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function CheckGroup({ label, values, onToggle, options, maxSelected = Infinity, hint = '', className = '' }) {
  const maxReached = Number.isFinite(maxSelected) && values.length >= maxSelected;
  return (
    <fieldset className={`choice-group ${className}`}>
      <legend>{label}</legend>
      {hint ? <p className="choice-hint">{hint}</p> : null}
      <div>
        {options.map((option) => {
          const selected = values.includes(option.id);
          const disabled = maxReached && !selected;
          return (
            <button
              type="button"
              key={option.id}
              className={selected ? 'selected' : ''}
              onClick={() => onToggle(option)}
              aria-pressed={selected}
              disabled={disabled}
            >
              {option.domain ? <span className="choice-domain">{option.domain}</span> : null}
              <span className="choice-main">{option.label}</span>
              {option.cue ? <span className="choice-cue">{option.cue}</span> : null}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function SourceVitals({ caseRecord }) {
  return (
    <div className="source-vitals" aria-label="Source vitals">
      {vitalRows(caseRecord).map(([label, value, unit]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
          {unit ? <span>{unit}</span> : null}
        </div>
      ))}
    </div>
  );
}

function AiGate({ draftKey, error, saving, onDraftKey, onSave }) {
  return (
    <main className="flowboard-app ai-gate-screen">
      <section className="ai-gate-card" aria-label="Flowboard AI key required">
        <h1>AI key required for Flowboard</h1>
        <p>
          Flowboard uses AI to portray the patient, generate formative ECG/lab/imaging results when source values are absent, and create nursing updates.
        </p>
        <Field label="API key">
          <input
            type="password"
            value={draftKey}
            onChange={(event) => onDraftKey(event.target.value)}
            placeholder="Paste an OpenRouter, OpenAI, or Anthropic key"
            autoComplete="off"
          />
        </Field>
        <button type="button" className="primary-action" onClick={onSave} disabled={saving}>
          {saving ? 'Testing AI connection...' : 'Save key and start Flowboard'}
        </button>
        {error ? <p className="error-copy" role="alert">{error}</p> : null}
      </section>
    </main>
  );
}

function AiStatusControl({ settings, onClear }) {
  const statusText = settings?.hasKey
    ? `AI on: ${settings.providerLabel || settings.provider || 'AI'} / ${settings.patientModel || settings.model}`
    : 'AI off';
  return (
    <div className="ai-status-control" aria-label="AI status">
      <span>{statusText}</span>
      <button type="button" className="secondary-action" onClick={onClear} disabled={!settings?.hasKey}>
        Clear key
      </button>
    </div>
  );
}

function TopBar({ caseRecord, clock, sourceState, aiSettings, onClearAi, onRestart, onNextCase }) {
  return (
    <header className="flow-topbar">
      <div className="case-title-block">
        <strong>{caseRecord?.case_id || 'Loading'}</strong>
        <span>{caseRecord?.title || caseRecord?.complaint || 'Starting case'}</span>
      </div>
      <div className="patient-strip">
        <span>Patient</span>
        <strong>{caseRecord?.patient || 'Loading'}</strong>
      </div>
      <div className="sim-control-strip" aria-label="Simulation status">
        <span>{caseRecord?.rotation_label || sourceState?.label || 'Active case source'}</span>
        <strong>{Math.max(0, Math.floor((clock?.elapsed_seconds || 0) / 60))} min</strong>
      </div>
      <AiStatusControl settings={aiSettings} onClear={onClearAi} />
      <button type="button" className="secondary-action" onClick={onRestart}>
        Restart case
      </button>
      <button type="button" className="primary-action" onClick={onNextCase}>
        Next case
      </button>
    </header>
  );
}

function StageRail({ activeStage, completedStages, maxUnlockedIndex, onStageChange }) {
  return (
    <nav className="learner-rail" aria-label="Simulation stages">
      {STAGES.map((stage, index) => {
        const Icon = stage.icon;
        const active = activeStage === stage.id;
        const complete = completedStages.has(stage.id);
        const locked = index > maxUnlockedIndex;
        return (
          <button
            type="button"
            key={stage.id}
            className={`rail-step ${active ? 'active' : ''} ${complete ? 'complete' : ''}`}
            onClick={() => onStageChange(stage.id)}
            disabled={locked}
            aria-current={active ? 'step' : undefined}
          >
            <span className="rail-step-number">{complete ? <CheckCircle size={16} weight="fill" /> : locked ? <Lock size={15} /> : index + 1}</span>
            <span className="rail-step-icon"><Icon size={18} weight="regular" /></span>
            <span className="rail-step-copy">
              <strong>{stage.short}</strong>
              <span>{locked ? 'Locked' : stage.task}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}

function CheckpointStatus({ ready }) {
  return (
    <section className={`checkpoint-status ${ready ? 'ready' : ''}`} aria-label="Checkpoint status">
      <strong>{ready ? 'Ready to continue' : 'Finish this screen to continue'}</strong>
    </section>
  );
}

function resultSourceLabel(result) {
  const source = String(result?.source || '').toLowerCase();
  const basis = String(result?.source_basis || '').toLowerCase();
  if (basis.includes('source_record') || basis.includes('source record')) return 'Source-record result';
  if (source.includes('active case')) return 'Active case source';
  if (source.includes('ai')) return 'AI-generated formative result';
  return 'Case-based formative result';
}

function ActionResultCards({ results, loadingLabels = [], error = '', emptyText = 'Select an action to generate a consequence.' }) {
  return (
    <section className="action-results" aria-label="Action result cards">
      {loadingLabels.map((label) => (
        <article key={`loading-${label}`} className="action-result-card loading-card">
          <h3>{label}</h3>
          <p>Generating clinical consequence...</p>
        </article>
      ))}
      {results.map((result) => (
        <article key={result.id || `${result.stage}-${result.action_id}`} className="action-result-card">
          <div className="result-card-header">
            <h3>{result.title || result.action_label || 'Action result'}</h3>
            <small>{resultSourceLabel(result)}</small>
          </div>
          <p>{result.summary}</p>
          {result.items?.length ? (
            <ul>{result.items.map((item) => <li key={item}>{item}</li>)}</ul>
          ) : null}
          {result.management_implication ? <p className="management-implication">{result.management_implication}</p> : null}
          {result.ai_error ? <p className="error-copy">Using case-based fallback because AI was unavailable: {result.ai_error}</p> : null}
        </article>
      ))}
      {!results.length && !loadingLabels.length ? <p className="pending-copy">{emptyText}</p> : null}
      {error ? <p className="error-copy" role="alert">{error}</p> : null}
    </section>
  );
}

function StageShell({ stage, children }) {
  const Icon = stage.icon;
  return (
    <>
      <header className="panel-header">
        <div className="panel-title-row">
          <Icon size={24} weight="regular" />
          <div>
            <h1>{stage.title}</h1>
            <p>{stage.task}</p>
          </div>
        </div>
      </header>
      <div className="panel-scroll-region">{children}</div>
    </>
  );
}

function BedsideInterventions({ interventions, selectedActionIds, results, loadingLabels, onToggleAction }) {
  if (!interventions.length) return null;
  const resultActionIds = new Set(interventions.map((item) => item.id));
  const relevantResults = results.filter((result) => resultActionIds.has(result.action_id));
  const relevantLoadingLabels = loadingLabels.filter((label) => interventions.some((item) => item.label === label));
  return (
    <div className="bedside-interventions" aria-label="Bedside interventions">
      <div className="bedside-intervention-buttons">
        {interventions.map((item) => {
          const selected = selectedActionIds.includes(item.id);
          return (
            <button
              type="button"
              key={item.id}
              className={selected ? 'selected' : ''}
              aria-pressed={selected}
              onClick={() => onToggleAction(item)}
            >
              <span>{item.domain}</span>
              {item.label}
            </button>
          );
        })}
      </div>
      {relevantLoadingLabels.map((label) => (
        <p className="inline-action-result" key={`loading-${label}`}>{label}: generating response...</p>
      ))}
      {relevantResults.map((result) => (
        <div className="inline-action-result" key={result.id || result.action_id}>
          <strong>{result.title || result.action_label}</strong>
          <p>{result.summary}</p>
        </div>
      ))}
    </div>
  );
}

function ArrivalStage({ caseRecord, inputs, actionResults, loadingActions, actionError, onCheck, onToggleAction, onRadio }) {
  const nextCheckIndex = inputs.arrivalChecks.length;
  return (
    <div className="panel-content arrival-panel">
      <section className="task-card chief-card">
        <h2>Arrival source data</h2>
        <div className="chief-concern-block">
          <h3>Chief concern</h3>
          <p className="patient-quote">"{caseRecord.complaint}"</p>
        </div>
        <dl className="compact-facts">
          <div><dt>Arrival</dt><dd>{caseRecord.transport || 'Not listed'}</dd></div>
          <div><dt>Patient</dt><dd>{caseRecord.patient}</dd></div>
          <div><dt>Source</dt><dd>{caseRecord.source_dataset || 'Active case source'}</dd></div>
          <div><dt>Record</dt><dd>{caseRecord.case_id}</dd></div>
        </dl>
      </section>

      <section className="task-card">
        <h2>Source vitals</h2>
        <SourceVitals caseRecord={caseRecord} />
      </section>

      <section className="task-card wide">
        <h2>Immediate bedside checks</h2>
        <div className="assessment-grid sequential-checks">
          {ARRIVAL_CHECKS.map((check, index) => {
            const revealed = inputs.arrivalChecks.includes(check.id);
            const available = revealed || index === nextCheckIndex;
            const interventions = revealed ? arrivalInterventionsForCheck(check.id, caseRecord) : [];
            return (
              <article key={check.id} className={revealed ? 'revealed' : ''}>
                <button
                  type="button"
                  onClick={() => onCheck(check)}
                  disabled={!available || revealed}
                >
                  {check.label}
                </button>
                <p>{revealed ? arrivalFinding(check.id, caseRecord) : available ? 'Click to assess.' : 'Complete the prior bedside check first.'}</p>
                {revealed ? (
                  <BedsideInterventions
                    interventions={interventions}
                    selectedActionIds={inputs.arrivalActions}
                    results={actionResults}
                    loadingLabels={loadingActions}
                    onToggleAction={onToggleAction}
                  />
                ) : null}
              </article>
            );
          })}
        </div>
        {actionError ? <p className="error-copy" role="alert">{actionError}</p> : null}
      </section>

      <section className="task-card">
        <h2>Placement decision</h2>
        <RadioGroup
          label="Where should the patient go now?"
          value={inputs.location}
          onChange={(value, label) => onRadio('location', value, label)}
          options={PLACEMENT_OPTIONS}
        />
        <RadioGroup
          label="Initial ESI estimate"
          value={inputs.acuity}
          onChange={(value, label) => onRadio('acuity', value, label)}
          options={ACUITY_OPTIONS}
        />
      </section>
    </div>
  );
}

function PatientChat({ sessionId, messages, question, loading, error, updateInput, onAsk }) {
  const submit = (event) => {
    event.preventDefault();
    void onAsk();
  };
  return (
    <section className="task-card chat-card">
      <h2>Focused history chat</h2>
      <div className="chat-log" aria-label="Patient chat log">
        {messages.length ? messages.map((turn, index) => {
          const fallbackNote = !turn.used_ai && (turn.ai_error || turn.fallback_reason)
            ? `Case-based response: ${turn.fallback_reason || 'AI was unavailable for this turn.'}`
            : '';
          return (
            <article key={`${turn.question}-${index}`}>
              <p><strong>You:</strong> {turn.question}</p>
              <p><strong>Patient:</strong> {turn.answer}</p>
              {fallbackNote ? <small className="chat-fallback-label">{fallbackNote}</small> : null}
            </article>
          );
        }) : <p className="pending-copy">Ask a focused question. The patient answers from the active case context.</p>}
      </div>
      <form className="chat-composer" onSubmit={submit}>
        <Field label="Ask the patient">
          <input
            value={question}
            onChange={(event) => updateInput('patientQuestion', event.target.value)}
            placeholder="Example: When did the symptoms start?"
            disabled={loading || !sessionId}
          />
        </Field>
        <button type="submit" className="primary-action" disabled={loading || !hasEntry(question)}>
          {loading ? 'Asking...' : 'Ask patient'}
        </button>
      </form>
      {error ? <p className="error-copy" role="alert">{error}</p> : null}
    </section>
  );
}

function FocusedExamPicker({ selectedExamIds, examFindings, loading, error, onExam }) {
  return (
    <section className="task-card exam-card">
      <h2>Focused exam</h2>
      <p className="pending-copy">Choose up to 3 exam systems. Each exam reveals findings immediately.</p>
      <div className="exam-system-grid" role="group" aria-label="Focused exam systems">
        {EXAM_SYSTEMS.map((system) => {
          const selected = selectedExamIds.includes(system.id);
          const disabled = loading || selected || (!selected && selectedExamIds.length >= 3);
          return (
            <button
              key={system.id}
              type="button"
              className={selected ? 'selected' : ''}
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onExam(system)}
            >
              {system.name}
            </button>
          );
        })}
      </div>
      <div className="result-stack" aria-label="Focused exam findings">
        {examFindings.length ? examFindings.map((finding) => (
          <article key={finding.system_id}>
            <h3>{finding.system}</h3>
            <p>{finding.finding}</p>
            <small>{finding.provenance || finding.evidence_basis || 'Formative finding'}</small>
          </article>
        )) : <p>No focused exam has been performed yet.</p>}
      </div>
      {error ? <p className="error-copy" role="alert">{error}</p> : null}
    </section>
  );
}

function HistoryExamStage({
  sessionId,
  messages,
  question,
  chatLoading,
  chatError,
  updateInput,
  onAsk,
  selectedExamIds,
  examFindings,
  examLoading,
  examError,
  onExam
}) {
  return (
    <div className="panel-content history-exam-panel">
      <PatientChat
        sessionId={sessionId}
        messages={messages}
        question={question}
        loading={chatLoading}
        error={chatError}
        updateInput={updateInput}
        onAsk={onAsk}
      />
      <FocusedExamPicker
        selectedExamIds={selectedExamIds}
        examFindings={examFindings}
        loading={examLoading}
        error={examError}
        onExam={onExam}
      />
    </div>
  );
}

function OrdersStage({ inputs, orderResults, loadingActions, actionError, onToggleOrder, updateInput }) {
  return (
    <div className="panel-content orders-panel">
      <section className="task-card wide">
        <h2>Orders and treatments</h2>
        <CheckGroup
          label="Select orders or actions; each selection returns a result"
          values={inputs.orderActions}
          onToggle={onToggleOrder}
          options={ORDER_ACTIONS}
        />
        <TextArea
          label="Which result would change level of care?"
          value={inputs.resultReleaseReason}
          onChange={(value) => updateInput('resultReleaseReason', value)}
          placeholder="Name the result and how it would change monitoring, consults, or disposition."
          rows={2}
        />
      </section>

      <section className="task-card wide">
        <h2>Ordered result data</h2>
        <ActionResultCards
          results={orderResults}
          loadingLabels={loadingActions}
          error={actionError}
          emptyText="Results appear immediately after you choose an order or treatment."
        />
      </section>
    </div>
  );
}

function DifferentialStage({
  caseRecord,
  differentials,
  newDx,
  setNewDx,
  updateDifferential,
  addDifferential,
  moveDifferential,
  onDragStart,
  onDrop,
  committed,
  committing,
  commitError,
  onCommit
}) {
  const comparison = scoreDifferential(caseRecord, differentials);
  return (
    <div className="panel-content workup-panel">
      <section className="task-card wide">
        <h2>Ranked differential</h2>
        <form className="inline-add-form" onSubmit={(event) => {
          event.preventDefault();
          addDifferential();
        }}>
          <Field label="Add diagnosis">
            <input
              value={newDx}
              onChange={(event) => setNewDx(event.target.value)}
              placeholder="Example: acute coronary syndrome"
            />
          </Field>
          <button type="submit" className="primary-action" disabled={!hasEntry(newDx)}>
            Add
          </button>
        </form>
        <div className="differential-list" aria-label="Ranked differential list">
          {differentials.length ? differentials.map((item, index) => (
            <article
              key={item.id}
              draggable
              onDragStart={() => onDragStart(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => onDrop(index)}
            >
              <div className="differential-header">
                <strong>{index + 1}. {item.diagnosis}</strong>
                <div>
                  <button type="button" className="secondary-action" onClick={() => moveDifferential(index, -1)} disabled={index === 0}>Move up</button>
                  <button type="button" className="secondary-action" onClick={() => moveDifferential(index, 1)} disabled={index === differentials.length - 1}>Move down</button>
                </div>
              </div>
              <TextArea
                label="Why this belongs here / what would move it up or down?"
                value={item.rationale}
                onChange={(value) => updateDifferential(item.id, 'rationale', value)}
                placeholder="Tie this diagnosis to case findings, counterevidence, and the discriminator."
                rows={3}
              />
            </article>
          )) : <p className="pending-copy">Add diagnoses, then rank them from most likely to least likely.</p>}
        </div>
        <button
          type="button"
          className="primary-action"
          onClick={onCommit}
          disabled={!differentials.length || committing}
        >
          {committing ? 'Committing...' : 'Commit differential and compare to case DDx'}
        </button>
        {commitError ? <p className="error-copy" role="alert">{commitError}</p> : null}
      </section>

      {committed ? (
        <section className="task-card wide">
          <h2>Case DDx comparison</h2>
          <div className="score-grid" aria-label="Differential scoring">
            <article><strong>{comparison.score}/{comparison.possible}</strong><span>Differential match</span></article>
            <article><strong>{comparison.matched.length}</strong><span>Case-aligned items</span></article>
            <article><strong>{comparison.rows[0]?.matched ? 'Yes' : 'No'}</strong><span>Top-rank alignment</span></article>
          </div>
          <ul>
            {(caseRecord.ddx || []).slice(0, 4).map((item) => (
              <li key={item.diagnosis}>{item.diagnosis}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function ReassessStage({ inputs, updateInput, nursingUpdate, scenario, loading, error, onRequestUpdate }) {
  return (
    <div className="panel-content reassess-panel">
      <section className="task-card wide">
        <h2>Nursing update</h2>
        <button type="button" className="primary-action" onClick={onRequestUpdate} disabled={loading}>
          {loading ? 'Requesting...' : 'Request nursing update'}
        </button>
        {nursingUpdate ? (
          <section className="released-results" aria-label="Nursing update">
            <h3>{nursingUpdate.title}</h3>
            <p>{nursingUpdate.summary}</p>
            <ul>{(nursingUpdate.items || []).map((item) => <li key={item}>{item}</li>)}</ul>
            {nursingUpdate.management_implication ? <p className="management-implication">{nursingUpdate.management_implication}</p> : null}
            <small>{resultSourceLabel(nursingUpdate)}</small>
            {nursingUpdate.ai_error ? <p className="error-copy">Using case-based nursing update because AI was unavailable: {nursingUpdate.ai_error}</p> : null}
          </section>
        ) : <p className="pending-copy">No reassessment data has been requested.</p>}
        {scenario ? <p className="pending-copy">{scenario.prompt}</p> : null}
        {error ? <p className="error-copy" role="alert">{error}</p> : null}
      </section>

      <section className="task-card wide">
        <h2>Management change</h2>
        <RadioGroup
          label="Which level-of-care decision is needed now?"
          value={inputs.trajectory}
          onChange={(value) => updateInput('trajectory', value)}
          options={[
            { value: 'same_path', label: 'Stay on current path with timed reassessment' },
            { value: 'monitor_more', label: 'Increase monitoring or bed acuity' },
            { value: 'consult_now', label: 'Call a specific consult now' },
            { value: 'resus_now', label: 'Move to resuscitation-level care' }
          ]}
        />
        <TextArea
          label="What management changes if this update is concerning?"
          value={inputs.managementChange}
          onChange={(value) => updateInput('managementChange', value)}
          placeholder="Name the trigger, action, and owner."
          rows={3}
        />
      </section>
    </div>
  );
}

function SoapStage({
  caseRecord,
  inputs,
  updateInput,
  examFindings,
  orderedResults,
  nursingUpdate,
  actionResults,
  soapSubmitting,
  soapError,
  soapSubmitted,
  onInsert,
  onSubmitSoap
}) {
  return (
    <div className="panel-content soap-panel">
      <section className="task-card wide">
        <h2>Insert source data</h2>
        <div className="insert-toolbar" aria-label="SOAP insert tools">
          <button type="button" className="secondary-action" onClick={() => onInsert('objective', 'Vitals', vitalsLine(caseRecord))}>Insert vitals</button>
          <button type="button" className="secondary-action" onClick={() => onInsert('objective', 'Focused exam', examFindings.map((finding) => `${finding.system}: ${finding.finding}`).join('\n'))} disabled={!examFindings.length}>Insert exam findings</button>
          <button type="button" className="secondary-action" onClick={() => onInsert('hpi', 'History context', caseRecord.history)}>Insert PMH/meds/allergies context</button>
          <button type="button" className="secondary-action" onClick={() => onInsert('objective', 'Results', actionResults.map((result) => {
            const implication = result.stage === 'arrival' ? '' : result.management_implication;
            return `${result.action_label || result.title}: ${result.summary}${implication ? ` ${implication}` : ''}`;
          }).join('\n'))} disabled={!actionResults.length}>Insert results</button>
          <button type="button" className="secondary-action" onClick={() => onInsert('plan', 'Selected treatments', [...inputs.arrivalActions, ...inputs.orderActions].map(actionLabel).join(', '))}>Insert selected treatments</button>
          <button type="button" className="secondary-action" onClick={() => onInsert('assessment', 'Problem context', `Problem list: ${caseRecord.likely_working_diagnosis || caseRecord.complaint}. Disposition context: ${caseRecord.disposition || 'not final'}.`)}>Insert problem context</button>
          <button type="button" className="secondary-action" onClick={() => onInsert('plan', 'Nursing update', [nursingUpdate?.summary, ...(nursingUpdate?.items || []), nursingUpdate?.management_implication].filter(Boolean).join('\n'))} disabled={!nursingUpdate}>Insert nursing update</button>
        </div>
      </section>

      <section className="task-card wide">
        <h2>SOAP note</h2>
        <TextArea
          label="One-liner"
          value={inputs.soapOneLiner}
          onChange={(value) => updateInput('soapOneLiner', value)}
          placeholder="Age, key history, presentation, and risk in one sentence."
          rows={2}
        />
        <TextArea
          label="HPI story"
          value={inputs.soapHpi}
          onChange={(value) => updateInput('soapHpi', value)}
          placeholder="Tell the visit story in a clinically useful sequence."
          rows={4}
        />
        <TextArea
          label="Objective findings"
          value={inputs.soapObjective}
          onChange={(value) => updateInput('soapObjective', value)}
          placeholder="Vitals, exam findings, ordered results, and treatment response."
          rows={4}
        />
        <TextArea
          label="Assessment and problem list"
          value={inputs.soapAssessment}
          onChange={(value) => updateInput('soapAssessment', value)}
          placeholder="Ranked problem list with why each matters now."
          rows={5}
        />
        <TextArea
          label="Plan by problem"
          value={inputs.soapPlan}
          onChange={(value) => updateInput('soapPlan', value)}
          placeholder="Problem: actions, monitoring, consults, reassessment, and disposition."
          rows={5}
        />
        <TextArea
          label="Reassessment rationale"
          value={inputs.managementChange}
          onChange={(value) => updateInput('managementChange', value)}
          placeholder="What changed, what you are watching, and what would escalate care."
          rows={3}
        />
        <button type="button" className="primary-action" onClick={onSubmitSoap} disabled={soapSubmitting || soapSubmitted}>
          {soapSubmitted ? 'SOAP finalized' : soapSubmitting ? 'Finalizing...' : 'Finalize SOAP note'}
        </button>
        {soapError ? <p className="error-copy" role="alert">{soapError}</p> : null}
      </section>
    </div>
  );
}

function ScoreCards({ scoring }) {
  return (
    <div className="score-grid" aria-label="Deterministic scoring">
      <article><strong>{scoring.totalScore}/{scoring.totalPossible}</strong><span>Deterministic score</span></article>
      <article><strong>{scoring.actionScore.score}/{scoring.actionScore.possible}</strong><span>Action match</span></article>
      <article><strong>{scoring.differential.score}/{scoring.differential.possible}</strong><span>Differential match</span></article>
    </div>
  );
}

function LearnStage({ caseRecord, inputs, events, patientMessages, examFindings, orderedResults, nursingUpdate, differentials, soap, scoring, feedback, prompt, copied, onCopyPrompt, onOpenEvidence, onRestart, onNextCase }) {
  return (
    <div className="panel-content learn-panel">
      <section className="task-card debrief-summary wide" aria-label="Case debrief summary">
        <h2>Debrief summary</h2>
        <ScoreCards scoring={scoring} />
      </section>

      <section className="task-card wide">
        <h2>Domain scoring</h2>
        <table className="action-ledger">
          <thead>
            <tr><th>Domain</th><th>Score</th><th>Evidence</th></tr>
          </thead>
          <tbody>
            {scoring.domains.map((domain) => (
              <tr key={domain.label}>
                <td>{domain.label}</td>
                <td>{domain.score}/{domain.possible}</td>
                <td>{domain.evidence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="task-card wide">
        <h2>Action ledger</h2>
        <table className="action-ledger">
          <tbody>
            {events.map((event) => (
              <tr key={event.id || `${event.type}-${event.elapsed_at_seconds}-${event.label}`}>
                <td>{event.stage || event.type}</td>
                <td>{event.label}</td>
                <td>{typeof event.value === 'string' ? event.value : JSON.stringify(event.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="task-card wide">
        <h2>Source limits</h2>
        <ul>
          {(sourceLimitItems(caseRecord).length ? sourceLimitItems(caseRecord) : ['No source limitation was flagged for this case.']).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      {feedback?.scorecard?.domains?.length ? (
        <section className="task-card wide">
          <h2>Session engine scoring</h2>
          <div className="evidence-groups">
            {feedback.scorecard.domains.map((domain) => (
              <article key={domain.key || domain.label}>
                <h3>{domain.label}</h3>
                <p>{domain.score}/{domain.possible}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="task-card wide">
        <h2>OpenEvidence question</h2>
        <textarea className="prompt-preview compact-prompt" readOnly value={prompt} aria-label="OpenEvidence question" />
        <div className="debrief-actions">
          <button type="button" className="primary-action" onClick={onCopyPrompt}>
            <Copy size={18} weight="bold" />
            {copied ? 'Copied question' : 'Copy OpenEvidence question'}
          </button>
          <button type="button" className="secondary-action" onClick={onOpenEvidence}>Open OpenEvidence</button>
          <button type="button" className="secondary-action" onClick={onRestart}>Restart case</button>
          <button type="button" className="secondary-action" onClick={onNextCase}>Next case</button>
        </div>
      </section>
    </div>
  );
}

export default function ClinicalFlowboard() {
  const [caseOptionsState, setCaseOptionsState] = useState(() => {
    try {
      return getFlowboardCaseOptions();
    } catch {
      return { source_state: null, cases: [] };
    }
  });
  const [caseIndex, setCaseIndex] = useState(0);
  const [session, setSession] = useState(null);
  const [caseRecord, setCaseRecord] = useState(null);
  const [activeStage, setActiveStage] = useState('arrival');
  const [completedStages, setCompletedStages] = useState(() => new Set());
  const [inputs, setInputs] = useState(INITIAL_INPUTS);
  const [events, setEvents] = useState([]);
  const [engineEvents, setEngineEvents] = useState([]);
  const [clock, setClock] = useState(null);
  const [loadingCase, setLoadingCase] = useState(true);
  const [notice, setNotice] = useState('');
  const [aiSettings, setAiSettings] = useState(() => getTutorSettings());
  const [aiKeyDraft, setAiKeyDraft] = useState('');
  const [aiSettingsError, setAiSettingsError] = useState('');
  const [aiSettingsSaving, setAiSettingsSaving] = useState(false);
  const [patientMessages, setPatientMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const [selectedExamIds, setSelectedExamIds] = useState([]);
  const [examFindings, setExamFindings] = useState([]);
  const [examLoading, setExamLoading] = useState(false);
  const [examError, setExamError] = useState('');
  const [actionResults, setActionResults] = useState([]);
  const [actionResultLoading, setActionResultLoading] = useState({});
  const [actionResultError, setActionResultError] = useState('');
  const [differentials, setDifferentials] = useState([]);
  const [newDx, setNewDx] = useState('');
  const [dragIndex, setDragIndex] = useState(null);
  const [differentialCommitted, setDifferentialCommitted] = useState(false);
  const [differentialCommitting, setDifferentialCommitting] = useState(false);
  const [differentialError, setDifferentialError] = useState('');
  const [nursingUpdate, setNursingUpdate] = useState(null);
  const [reassessmentScenario, setReassessmentScenario] = useState(null);
  const [reassessmentLoading, setReassessmentLoading] = useState(false);
  const [reassessmentError, setReassessmentError] = useState('');
  const [soapSubmitting, setSoapSubmitting] = useState(false);
  const [soapSubmitted, setSoapSubmitted] = useState(false);
  const [soapError, setSoapError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const startTokenRef = useRef(0);

  const caseOptions = caseOptionsState.cases || [];
  const sourceState = caseOptionsState.source_state || {};
  const orderedResults = useMemo(() => actionResults.filter((result) => result.stage === 'orders'), [actionResults]);
  const arrivalResults = useMemo(() => actionResults.filter((result) => result.stage === 'arrival'), [actionResults]);

  const resetLearnerState = () => {
    setActiveStage('arrival');
    setCompletedStages(new Set());
    setInputs(INITIAL_INPUTS);
    setEvents([]);
    setEngineEvents([]);
    setNotice('');
    setPatientMessages([]);
    setChatLoading(false);
    setChatError('');
    setSelectedExamIds([]);
    setExamFindings([]);
    setExamLoading(false);
    setExamError('');
    setActionResults([]);
    setActionResultLoading({});
    setActionResultError('');
    setDifferentials([]);
    setNewDx('');
    setDifferentialCommitted(false);
    setDifferentialCommitting(false);
    setDifferentialError('');
    setNursingUpdate(null);
    setReassessmentScenario(null);
    setReassessmentLoading(false);
    setReassessmentError('');
    setSoapSubmitting(false);
    setSoapSubmitted(false);
    setSoapError('');
    setFeedback(null);
    setCopiedPrompt(false);
  };

  const startCase = async (index) => {
    const options = getFlowboardCaseOptions();
    setCaseOptionsState(options);
    const cases = options.cases || [];
    const nextIndex = cases.length ? ((index % cases.length) + cases.length) % cases.length : 0;
    const targetCase = cases[nextIndex];
    const token = startTokenRef.current + 1;
    startTokenRef.current = token;
    setLoadingCase(true);
    resetLearnerState();
    try {
      const data = await startSimulation(targetCase?.case_id ? { caseId: targetCase.case_id } : {});
      if (startTokenRef.current !== token) return;
      setCaseIndex(nextIndex);
      setSession(data);
      setCaseRecord(data.flowboard_case);
      setClock(data.clock);
    } catch (error) {
      if (startTokenRef.current !== token) return;
      setNotice(error.message || 'Flowboard case could not be started.');
    } finally {
      if (startTokenRef.current === token) setLoadingCase(false);
    }
  };

  useEffect(() => {
    void startCase(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logEvent = (event) => {
    const record = {
      id: `local_${events.length + 1}_${Date.now()}`,
      elapsed_at_seconds: clock?.elapsed_seconds || 0,
      ...event
    };
    setEvents((current) => [...current, record]);
    if (session?.session_id) {
      void recordFlowboardEvent(session.session_id, event)
        .then((data) => {
          if (data.events) setEngineEvents(data.events);
          if (data.clock) setClock(data.clock);
        })
        .catch(() => {});
    }
  };

  const updateInput = (field, value) => {
    setInputs((current) => ({ ...current, [field]: value }));
  };

  const onRadio = (field, value, label) => {
    updateInput(field, value);
    logEvent({ type: 'decision', stage: 'arrival', label: label || field, value });
  };

  const saveAiKey = async () => {
    setAiSettingsError('');
    const key = aiKeyDraft.trim();
    if (!key) {
      setAiSettingsError('AI API key is required.');
      return;
    }
    setAiSettingsSaving(true);
    try {
      await testTutorConnection({ key });
      const next = saveTutorSettings({ key });
      setAiSettings(next);
      setAiKeyDraft('');
    } catch (error) {
      setAiSettingsError(formatAiErrorForLearner(error));
    } finally {
      setAiSettingsSaving(false);
    }
  };

  const clearAiKey = () => {
    const next = clearTutorSettings();
    setAiSettings(next);
    setAiKeyDraft('');
    setAiSettingsError('');
    setAiSettingsSaving(false);
  };

  const handleAiAuthFailure = (error) => {
    const message = formatAiErrorForLearner(error);
    const next = clearTutorSettings();
    setAiSettings(next);
    setAiKeyDraft('');
    setAiSettingsError(`${message} The saved key was cleared. Paste a working key to continue.`);
    setAiSettingsSaving(false);
  };

  const generateActionResult = async (item, stage, nextSelectedIds = []) => {
    if (!session?.session_id) return;
    const key = actionResultKey(stage, item.id);
    setActionResultLoading((current) => ({ ...current, [key]: item.label }));
    setActionResultError('');
    try {
      const selectedActionIds = unique([...inputs.arrivalActions, ...inputs.orderActions, ...nextSelectedIds]);
      const artifact = await generateFlowboardArtifact(session.session_id, 'action_result', {
        actionId: item.id,
        actionLabel: item.label,
        stage,
        selectedActionIds,
        learnerQuestion: inputs.resultReleaseReason,
        localOnly: stage === 'arrival'
      });
      const resultCard = {
        ...artifact,
        id: key,
        stage,
        action_id: artifact.action_id || item.id,
        action_label: artifact.action_label || item.label
      };
      setActionResults((current) => [
        ...current.filter((result) => result.id !== key),
        resultCard
      ]);
      logEvent({ type: 'action_result', stage, label: item.label, value: artifact.summary, payload: resultCard });
    } catch (error) {
      if (isAiAuthError(error)) {
        handleAiAuthFailure(error);
      } else {
        setActionResultError(error.message || 'Action result could not be generated.');
      }
    } finally {
      setActionResultLoading((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
  };

  const toggleActionWithResult = (field, item, stage) => {
    const wasSelected = inputs[field].includes(item.id);
    const nextValues = wasSelected
      ? inputs[field].filter((id) => id !== item.id)
      : [...inputs[field], item.id];
    setInputs((current) => {
      return { ...current, [field]: nextValues };
    });
    if (wasSelected) {
      const key = actionResultKey(stage, item.id);
      setActionResults((current) => current.filter((result) => result.id !== key));
      logEvent({ type: 'action_removed', stage, label: item.label, value: item.id });
      return;
    }
    logEvent({ type: 'action', stage, label: item.label, value: item.id });
    void generateActionResult(item, stage, nextValues);
  };

  const completeArrivalCheck = (check) => {
    if (inputs.arrivalChecks.includes(check.id)) return;
    const next = [...inputs.arrivalChecks, check.id];
    updateInput('arrivalChecks', next);
    logEvent({
      type: 'bedside_check',
      stage: 'arrival',
      label: check.label,
      value: arrivalFinding(check.id, caseRecord)
    });
  };

  const askFocusedQuestion = async () => {
    const question = inputs.patientQuestion.trim();
    if (!question || !session?.session_id) return;
    setChatLoading(true);
    setChatError('');
    try {
      const data = await askPatientQuestion(session.session_id, question);
      const response = data.response || {};
      setPatientMessages((current) => [...current, response]);
      updateInput('patientQuestion', '');
      if (data.clock) setClock(data.clock);
      logEvent({ type: 'patient_question', stage: 'history-exam', label: question, value: response.answer || '' });
    } catch (error) {
      if (isAiAuthError(error)) {
        handleAiAuthFailure(error);
      } else {
        setChatError(error.message || 'Patient answer could not be generated.');
      }
    } finally {
      setChatLoading(false);
    }
  };

  const selectExam = async (system) => {
    if (!session?.session_id || selectedExamIds.includes(system.id) || selectedExamIds.length >= 3) return;
    const nextIds = [...selectedExamIds, system.id];
    setExamLoading(true);
    setExamError('');
    try {
      const result = await recordFocusedExam(session.session_id, nextIds);
      setSelectedExamIds(nextIds);
      setExamFindings(result.findings || []);
      if (result.clock) setClock(result.clock);
      logEvent({ type: 'focused_exam', stage: 'history-exam', label: system.name, value: system.id });
    } catch (error) {
      if (isAiAuthError(error)) {
        handleAiAuthFailure(error);
      } else {
        setExamError(error.message || 'Focused exam could not be performed.');
      }
    } finally {
      setExamLoading(false);
    }
  };

  const addDifferential = () => {
    const diagnosis = newDx.trim();
    if (!diagnosis) return;
    const item = { id: `dx_${Date.now()}`, diagnosis, rationale: '' };
    setDifferentials((current) => [...current, item]);
    setNewDx('');
    setDifferentialCommitted(false);
    logEvent({ type: 'differential_add', stage: 'workup', label: diagnosis, value: diagnosis });
  };

  const updateDifferential = (id, field, value) => {
    setDifferentials((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item));
    setDifferentialCommitted(false);
  };

  const moveDifferential = (index, delta) => {
    setDifferentials((current) => {
      const nextIndex = index + delta;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
    setDifferentialCommitted(false);
    logEvent({ type: 'differential_rank', stage: 'workup', label: 'Reordered differential', value: delta < 0 ? 'up' : 'down' });
  };

  const dropDifferential = (dropIndex) => {
    if (dragIndex === null || dragIndex === dropIndex) return;
    setDifferentials((current) => {
      const next = [...current];
      const [item] = next.splice(dragIndex, 1);
      next.splice(dropIndex, 0, item);
      return next;
    });
    setDragIndex(null);
    setDifferentialCommitted(false);
    logEvent({ type: 'differential_rank', stage: 'workup', label: 'Dragged differential', value: `${dragIndex + 1} to ${dropIndex + 1}` });
  };

  const commitDifferential = async () => {
    if (!session?.session_id || !differentials.length) return;
    setDifferentialCommitting(true);
    setDifferentialError('');
    try {
      const evidence = differentials
        .map((item, index) => `${index + 1}. ${item.diagnosis}: ${item.rationale || 'rationale not documented'}`)
        .join('\n');
      await recordDiagnosis(
        session.session_id,
        differentials[0].diagnosis,
        differentials.map((item) => item.diagnosis),
        evidence.length >= 20 ? evidence : 'Ranked differential documented from Flowboard case data.'
      );
      setDifferentialCommitted(true);
      logEvent({ type: 'differential_commit', stage: 'workup', label: 'Committed differential', value: differentials.map((item) => item.diagnosis).join('; ') });
    } catch (error) {
      setDifferentialError(error.message || 'Differential could not be recorded.');
    } finally {
      setDifferentialCommitting(false);
    }
  };

  const requestNursingUpdate = async () => {
    if (!session?.session_id) return;
    setReassessmentLoading(true);
    setReassessmentError('');
    try {
      const [artifact, scenarioData] = await Promise.all([
        generateFlowboardArtifact(session.session_id, 'nursing_update', {
          selectedActionIds: unique([...inputs.arrivalActions, ...inputs.orderActions]),
          actionResults: actionResults.map((result) => ({
            action: result.action_label || result.title,
            summary: result.summary,
            implication: result.management_implication
          })),
          trajectory: inputs.trajectory,
          managementChange: inputs.managementChange
        }),
        getReassessmentScenario(session.session_id)
      ]);
      setNursingUpdate(artifact);
      setReassessmentScenario(scenarioData.scenario || null);
      if (scenarioData.clock) setClock(scenarioData.clock);
      logEvent({ type: 'nursing_update', stage: 'reassess', label: 'Requested nursing update', value: artifact.summary, payload: artifact });
    } catch (error) {
      if (isAiAuthError(error)) {
        handleAiAuthFailure(error);
      } else {
        setReassessmentError(error.message || 'Nursing update could not be generated.');
      }
    } finally {
      setReassessmentLoading(false);
    }
  };

  const insertSoapText = (target, label, text) => {
    const field = target === 'hpi'
      ? 'soapHpi'
      : target === 'assessment'
        ? 'soapAssessment'
        : target === 'plan'
          ? 'soapPlan'
          : 'soapObjective';
    setInputs((current) => ({ ...current, [field]: upsertSoapBlock(current[field], label, text) }));
    logEvent({ type: 'soap_insert', stage: 'soap', label: `Inserted ${label}`, value: String(text || '').slice(0, 160) });
  };

  const finalizeSoap = async () => {
    if (!session?.session_id) return;
    setSoapSubmitting(true);
    setSoapError('');
    try {
      const reassessmentTargets = reassessmentScenario?.suggested_targets?.length
        ? reassessmentScenario.suggested_targets
        : ['vital_trend', 'disposition_safety'];
      await submitReassessment(session.session_id, reassessmentTargets, inputs.managementChange || 'Reassessment plan documented in SOAP workflow.');
      const soapNote = {
        subjective: `${inputs.soapOneLiner}\nHPI: ${inputs.soapHpi}`,
        objective: inputs.soapObjective,
        assessment: inputs.soapAssessment,
        plan: inputs.soapPlan
      };
      const soapResult = await submitSoap(session.session_id, soapNote, '');
      const nextFeedback = await getFeedback(session.session_id);
      setFeedback(nextFeedback);
      if (soapResult.clock) setClock(soapResult.clock);
      setSoapSubmitted(true);
      logEvent({ type: 'soap_finalize', stage: 'soap', label: 'Finalized SOAP note', value: inputs.soapOneLiner });
    } catch (error) {
      if (isAiAuthError(error)) {
        handleAiAuthFailure(error);
      } else {
        setSoapError(error.message || 'SOAP note could not be finalized.');
      }
    } finally {
      setSoapSubmitting(false);
    }
  };

  const activeIndex = STAGES.findIndex((stage) => stage.id === activeStage);
  const activeStageRecord = STAGES[activeIndex] || STAGES[0];
  const maxUnlockedIndex = Math.min(
    STAGES.length - 1,
    Math.max(0, completedStages.size ? Math.max(...[...completedStages].map((id) => STAGES.findIndex((stage) => stage.id === id))) + 1 : 0)
  );

  const allSelectedActionIds = unique([...inputs.arrivalActions, ...inputs.orderActions]);
  const actionScore = useMemo(() => caseRecord ? scoreSelectedActions(caseRecord, allSelectedActionIds) : { score: 0, possible: 1, missed: [] }, [caseRecord, allSelectedActionIds]);
  const differentialScore = useMemo(() => caseRecord ? scoreDifferential(caseRecord, differentials) : { score: 0, possible: 2, rows: [], matched: [] }, [caseRecord, differentials]);
  const scoring = useMemo(() => {
    if (!caseRecord) {
      return { totalScore: 0, totalPossible: 1, actionScore, differential: differentialScore, domains: [] };
    }
    const acuity = acuityScore(caseRecord, inputs.acuity);
    const placement = placementScore(caseRecord, inputs.location);
    const bedside = { score: inputs.arrivalChecks.length, possible: ARRIVAL_CHECKS.length };
    const interview = { score: Math.min(2, patientMessages.length), possible: 2 };
    const exam = { score: Math.min(3, examFindings.length), possible: 3 };
    const orders = { score: orderedResults.length ? 2 : inputs.orderActions.length ? 1 : 0, possible: 2 };
    const reassess = { score: nursingUpdate && inputs.managementChange ? 2 : nursingUpdate ? 1 : 0, possible: 2 };
    const soap = { score: soapSubmitted ? 2 : 0, possible: 2 };
    const domains = [
      { label: 'Acuity', ...acuity, evidence: `Reference ESI ${caseRecord.reference_esi || 'unknown'}; learner chose ${inputs.acuity || 'none'}.` },
      { label: 'Placement', ...placement, evidence: `Expected placement family: ${placement.targets.join(', ')}.` },
      { label: 'Bedside checks', ...bedside, evidence: `${inputs.arrivalChecks.length}/${ARRIVAL_CHECKS.length} sequential checks completed.` },
      { label: 'Actions', score: actionScore.score, possible: actionScore.possible, evidence: actionScore.missed.length ? `Missed: ${actionScore.missed.join(', ')}.` : 'Selected actions cover expected signals.' },
      { label: 'Patient chat', ...interview, evidence: `${patientMessages.length} patient question(s) answered.` },
      { label: 'Focused exam', ...exam, evidence: `${examFindings.length} exam finding(s) revealed; max 3 systems allowed.` },
      { label: 'Orders/results', ...orders, evidence: orderedResults.length ? `${orderedResults.length} action result card(s) generated.` : 'No ordered results generated.' },
      { label: 'Differential', score: differentialScore.score, possible: differentialScore.possible, evidence: `${differentialScore.matched.length} ranked item(s) aligned with case DDx.` },
      { label: 'Reassessment', ...reassess, evidence: nursingUpdate ? 'Nursing update interpreted.' : 'Nursing update not requested.' },
      { label: 'SOAP', ...soap, evidence: soapSubmitted ? 'SOAP note finalized.' : 'SOAP note not finalized.' }
    ];
    const totalScore = domains.reduce((sum, domain) => sum + domain.score, 0);
    const totalPossible = domains.reduce((sum, domain) => sum + domain.possible, 0);
    return { totalScore, totalPossible, actionScore, differential: differentialScore, domains };
  }, [actionScore, caseRecord, differentialScore, examFindings.length, inputs, nursingUpdate, orderedResults.length, patientMessages.length, soapSubmitted]);

  const completionChecks = useMemo(() => ({
    arrival: inputs.arrivalChecks.length === ARRIVAL_CHECKS.length
      && hasEntry(inputs.location)
      && hasEntry(inputs.acuity),
    'history-exam': patientMessages.length > 0 && examFindings.length > 0,
    orders: inputs.orderActions.length > 0 && orderedResults.length > 0,
    workup: differentials.length > 0 && differentialCommitted,
    reassess: Boolean(nursingUpdate) && hasEntry(inputs.trajectory) && hasEntry(inputs.managementChange),
    soap: soapSubmitted,
    learn: true
  }), [differentialCommitted, differentials.length, examFindings.length, inputs, nursingUpdate, orderedResults.length, patientMessages.length, soapSubmitted]);

  const canAdvance = Boolean(completionChecks[activeStage]);
  const nextStage = STAGES[activeIndex + 1];
  const continueLabel = nextStage ? `Continue to ${nextStage.short}` : 'Continue';

  const soapForPrompt = useMemo(() => ({
    one_liner: inputs.soapOneLiner,
    hpi: inputs.soapHpi,
    objective: inputs.soapObjective,
    assessment_problem_list: inputs.soapAssessment,
    plan_by_problem: inputs.soapPlan
  }), [inputs.soapAssessment, inputs.soapHpi, inputs.soapObjective, inputs.soapOneLiner, inputs.soapPlan]);
  const openEvidencePrompt = useMemo(() => buildOpenEvidenceQuestion({
    caseRecord,
    scoring
  }), [caseRecord, scoring]);

  const continueStage = async () => {
    if (!canAdvance) {
      setNotice('Finish the visible work on this screen before continuing.');
      return;
    }
    if (activeStage === 'arrival' && session?.session_id) {
      await Promise.allSettled([
        assignProvisionalTriage(session.session_id, Number(inputs.acuity), `Placement: ${inputs.location}; actions: ${inputs.arrivalActions.map(actionLabel).join(', ')}`),
        assignTriage(session.session_id, Number(inputs.acuity), `Placement: ${inputs.location}; actions: ${inputs.arrivalActions.map(actionLabel).join(', ')}`)
      ]);
    }
    if (activeStage === 'orders' && session?.session_id) {
      const selectedActionIds = unique([...inputs.arrivalActions, ...inputs.orderActions]);
      await Promise.allSettled([
        selectEscalationActions(session.session_id, selectedActionIds, inputs.resultReleaseReason || 'Selected Flowboard actions generated results.', {
          selected_actions: selectedActionIds.map((id) => ({ action_id: id })),
          diagnostics: inputs.orderActions.map(actionLabel).join(', '),
          treatments: inputs.arrivalActions.map(actionLabel).join(', '),
          disposition: inputs.location,
          priority_notes: inputs.resultReleaseReason,
          action_results: actionResults.map((result) => ({
            action_id: result.action_id,
            action_label: result.action_label,
            summary: result.summary,
            management_implication: result.management_implication
          }))
        })
      ]);
    }
    setCompletedStages((current) => new Set(current).add(activeStage));
    logEvent({ type: 'stage_complete', stage: activeStage, label: `${activeStageRecord.title} complete`, value: 'complete' });
    setNotice('Progress saved.');
    if (activeIndex < STAGES.length - 1) {
      setActiveStage(STAGES[activeIndex + 1].id);
    }
  };

  const copyOpenEvidencePrompt = async () => {
    try {
      await navigator.clipboard.writeText(openEvidencePrompt);
      setCopiedPrompt(true);
    } catch {
      setCopiedPrompt(false);
      setNotice('Prompt is ready, but clipboard access was blocked by the browser.');
    }
  };

  const openOpenEvidence = () => {
    window.open(OPEN_EVIDENCE_URL, '_blank', 'noopener,noreferrer');
  };

  const restartCase = () => {
    void startCase(caseIndex);
  };

  const nextCase = () => {
    const nextIndex = caseOptions.length ? (caseIndex + 1) % caseOptions.length : 0;
    void startCase(nextIndex);
  };

  if (loadingCase || !caseRecord) {
    return (
      <div className="flowboard-app">
        <section className="flowboard-loading">
          <strong>Starting Flowboard case...</strong>
        </section>
      </div>
    );
  }

  if (!aiSettings.hasKey) {
    return (
      <AiGate
        draftKey={aiKeyDraft}
        error={aiSettingsError}
        saving={aiSettingsSaving}
        onDraftKey={setAiKeyDraft}
        onSave={saveAiKey}
      />
    );
  }

  return (
    <div className="flowboard-app">
      <TopBar
        caseRecord={caseRecord}
        clock={clock}
        sourceState={sourceState}
        aiSettings={aiSettings}
        onClearAi={clearAiKey}
        onRestart={restartCase}
        onNextCase={nextCase}
      />

      <div className="flowboard-shell">
        <StageRail
          activeStage={activeStage}
          completedStages={completedStages}
          maxUnlockedIndex={maxUnlockedIndex}
          onStageChange={(stageId) => {
            const stageIndex = STAGES.findIndex((stage) => stage.id === stageId);
            if (stageIndex <= maxUnlockedIndex) setActiveStage(stageId);
          }}
        />

        <main className="learner-workspace" aria-label="Learner decision workspace">
          <StageShell stage={activeStageRecord}>
            {activeStage === 'arrival' ? (
              <ArrivalStage
                caseRecord={caseRecord}
                inputs={inputs}
                actionResults={arrivalResults}
                loadingActions={inputs.arrivalActions
                  .filter((id) => actionResultLoading[actionResultKey('arrival', id)])
                  .map(actionLabel)}
                actionError={actionResultError}
                onCheck={completeArrivalCheck}
                onToggleAction={(item) => toggleActionWithResult('arrivalActions', item, 'arrival')}
                onRadio={onRadio}
              />
            ) : null}
            {activeStage === 'history-exam' ? (
              <HistoryExamStage
                sessionId={session?.session_id}
                messages={patientMessages}
                question={inputs.patientQuestion}
                chatLoading={chatLoading}
                chatError={chatError}
                updateInput={updateInput}
                onAsk={askFocusedQuestion}
                selectedExamIds={selectedExamIds}
                examFindings={examFindings}
                onExam={selectExam}
                examLoading={examLoading}
                examError={examError}
              />
            ) : null}
            {activeStage === 'orders' ? (
              <OrdersStage
                inputs={inputs}
                updateInput={updateInput}
                orderResults={orderedResults}
                loadingActions={inputs.orderActions
                  .filter((id) => actionResultLoading[actionResultKey('orders', id)])
                  .map(actionLabel)}
                actionError={actionResultError}
                onToggleOrder={(item) => toggleActionWithResult('orderActions', item, 'orders')}
              />
            ) : null}
            {activeStage === 'workup' ? (
              <DifferentialStage
                caseRecord={caseRecord}
                differentials={differentials}
                newDx={newDx}
                setNewDx={setNewDx}
                updateDifferential={updateDifferential}
                addDifferential={addDifferential}
                moveDifferential={moveDifferential}
                onDragStart={setDragIndex}
                onDrop={dropDifferential}
                committed={differentialCommitted}
                committing={differentialCommitting}
                commitError={differentialError}
                onCommit={commitDifferential}
              />
            ) : null}
            {activeStage === 'reassess' ? (
              <ReassessStage
                inputs={inputs}
                updateInput={updateInput}
                nursingUpdate={nursingUpdate}
                scenario={reassessmentScenario}
                loading={reassessmentLoading}
                error={reassessmentError}
                onRequestUpdate={requestNursingUpdate}
              />
            ) : null}
            {activeStage === 'soap' ? (
              <SoapStage
                caseRecord={caseRecord}
                inputs={inputs}
                updateInput={updateInput}
                examFindings={examFindings}
                orderedResults={orderedResults}
                nursingUpdate={nursingUpdate}
                actionResults={actionResults}
                soapSubmitting={soapSubmitting}
                soapError={soapError}
                soapSubmitted={soapSubmitted}
                onInsert={insertSoapText}
                onSubmitSoap={finalizeSoap}
              />
            ) : null}
            {activeStage === 'learn' ? (
              <LearnStage
                caseRecord={caseRecord}
                inputs={inputs}
                events={engineEvents.length ? engineEvents : events}
                patientMessages={patientMessages}
                examFindings={examFindings}
                orderedResults={orderedResults}
                nursingUpdate={nursingUpdate}
                differentials={differentials}
                soap={soapForPrompt}
                scoring={scoring}
                feedback={feedback}
                prompt={openEvidencePrompt}
                copied={copiedPrompt}
                onCopyPrompt={copyOpenEvidencePrompt}
                onOpenEvidence={openOpenEvidence}
                onRestart={restartCase}
                onNextCase={nextCase}
              />
            ) : null}
          </StageShell>

          {notice ? (
            <section className="activity-notice" aria-label="Checkpoint notice">
              <CheckCircle size={18} weight="fill" aria-hidden="true" />
              <span>{notice}</span>
              <button type="button" onClick={() => setNotice('')} aria-label="Dismiss checkpoint notice">Dismiss</button>
            </section>
          ) : null}

          <div className="decision-dock" aria-label="Decision controls">
            <CheckpointStatus ready={canAdvance} />
            <div className="panel-footer">
              {activeStage !== 'arrival' ? (
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => setActiveStage(STAGES[Math.max(0, activeIndex - 1)].id)}
                >
                  Back
                </button>
              ) : null}
              {activeStage !== 'learn' ? (
                <button type="button" className="primary-action" onClick={continueStage} disabled={!canAdvance}>
                  {continueLabel} <ArrowRight size={18} weight="bold" />
                </button>
              ) : (
                <button type="button" className="primary-action" onClick={copyOpenEvidencePrompt}>
                  Copy OpenEvidence question
                </button>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
