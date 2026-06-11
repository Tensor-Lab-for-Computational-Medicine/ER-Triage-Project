import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CASES_PATH = join(ROOT, 'frontend', 'src', 'data', 'cases.json');
const OUTPUT_PATH = join(ROOT, 'docs', 'case_objective_matrix.json');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function roundAge(value) {
  const age = Number(value);
  return Number.isFinite(age) ? Math.round(age) : null;
}

function acuityBand(esi) {
  if (esi <= 1) return 'critical_resuscitation';
  if (esi === 2) return 'high_risk_emergent';
  if (esi === 3) return 'resource_intensive_stable';
  if (esi === 4) return 'single_resource_lower_acuity';
  return 'minimal_resource_lower_acuity';
}

function complaintTags(caseRecord) {
  const text = `${caseRecord.complaint || ''} ${caseRecord.history || ''} ${caseRecord.augmentation?.likely_working_diagnosis || ''}`.toLowerCase();
  const tags = [];
  if (/\bchest|dyspnea|shortness|heart|acs|pe|pulmonary embolism|edema\b/.test(text)) tags.push('cardiopulmonary');
  if (/\bfever|sepsis|infection|pneumonia|abscess|gangrene|osteomyelitis\b/.test(text)) tags.push('infection_sepsis');
  if (/\baltered|consciousness|stroke|weakness|flaccid|seizure|encephalopathy|subdural\b/.test(text)) tags.push('neurologic');
  if (/\babd|abdominal|pelvic|vomit|nausea|crohn|rectal|perianal\b/.test(text)) tags.push('abdominal_pelvic');
  if (/\blaceration|suture|wrist|foot|leg|fracture|injury|fall|wound\b/.test(text)) tags.push('injury_wound_musculoskeletal');
  if (/\bmed refill|medication refill\b/.test(text)) tags.push('medication_access');
  if (/\btransfer\b/.test(text) || /\bAMBULANCE\b/i.test(caseRecord.demographics?.transport || '')) tags.push('transfer_or_ambulance_arrival');
  return tags.length ? [...new Set(tags)] : ['undifferentiated_ed_presentation'];
}

function priorityFrame(caseRecord, tags) {
  const esi = Number(caseRecord.acuity || 0);
  if (esi <= 1) return 'immediate stabilization, resuscitation-area placement, and early reassessment';
  if (esi === 2) return 'high-risk recognition, monitored placement, and early clinician evaluation';
  if (tags.includes('injury_wound_musculoskeletal') && esi >= 4) return 'focused injury assessment, procedure/resource prediction, and discharge safety planning';
  if (tags.includes('medication_access')) return 'screening for occult acute illness, medication safety, and outpatient access planning';
  if (esi === 3) return 'resource prediction, diagnostic prioritization, and reassessment before disposition';
  return 'focused assessment, limited resource use, and return-precaution planning';
}

function domainObjectives(caseRecord) {
  const esi = Number(caseRecord.acuity || 0);
  const tags = complaintTags(caseRecord);
  const diagnosis = cleanText(caseRecord.augmentation?.likely_working_diagnosis) || 'provisional ED working diagnosis';
  const resources = Number(caseRecord.resources_used || 0);
  const priority = priorityFrame(caseRecord, tags);
  const age = roundAge(caseRecord.demographics?.age);
  const ageText = age ? `${age}-year-old` : 'adult';
  const complaint = cleanText(caseRecord.complaint);

  return [
    {
      domain: 'noticing',
      construct: 'cue_recognition',
      objective: `Identify triage cues for a ${ageText} patient with ${complaint}, including vital-sign risk, arrival mode, pain/severity, and complaint-specific red flags.`,
      observable_actions: [
        'asks focused history questions across chief concern, timeline, severity, red flags, medications/allergies, and relevant history',
        'reviews objective vitals before committing to acuity',
        'selects focused exam systems aligned with complaint and risk'
      ]
    },
    {
      domain: 'interpreting',
      construct: 'diagnostic_and_acuity_reasoning',
      objective: `Assign ESI ${esi} reasoning and maintain a provisional differential around ${diagnosis} without treating draft teaching inference as source-record diagnostic truth.`,
      observable_actions: [
        'links ESI choice to danger-zone vitals, expected resources, and high-risk features',
        'states a working diagnosis and at least one alternative',
        'documents evidence that supports and limits the working diagnosis'
      ]
    },
    {
      domain: 'responding',
      construct: 'initial_management_and_consult_judgment',
      objective: `Choose initial ED actions for ${priority}; explain whether immediate consult input is needed while recognizing public demo consult truth is source-limited.`,
      observable_actions: [
        'selects placement and escalation actions appropriate to acuity',
        `anticipates approximately ${resources} recorded resource signal${resources === 1 ? '' : 's'} without revealing hidden outcomes during active play`,
        'documents rationale for consult/no-consult and what change would trigger escalation'
      ]
    },
    {
      domain: 'reflecting',
      construct: 'reassessment_and_documentation',
      objective: 'Close the loop with reassessment targets and a SOAP note that distinguishes observed case evidence, formative inference, and uncertainty.',
      observable_actions: [
        'selects reassessment targets connected to case risk',
        'writes SOAP assessment and plan with case-specific evidence',
        'reviews debrief provenance, safety notes, and next-case focus'
      ]
    }
  ];
}

function caseEntry(caseRecord) {
  const tags = complaintTags(caseRecord);
  return {
    case_id: caseRecord.id,
    public_case_uid: caseRecord.source?.public_case_uid || '',
    complaint: cleanText(caseRecord.complaint),
    reference_esi: Number(caseRecord.acuity || 0),
    acuity_band: acuityBand(Number(caseRecord.acuity || 0)),
    tags,
    review_status: 'draft_needs_clinician_educator_review',
    source_basis: {
      case_augmentation_status: caseRecord.augmentation?.review_status || 'unknown',
      diagnosis_truth_status: 'source_record_diagnosis_unavailable_in_public_case',
      consult_truth_status: 'clinician_approved_consult_unavailable_in_public_case',
      objective_data_status: 'optional_objective_data_unavailable_in_public_case'
    },
    objectives: domainObjectives(caseRecord)
  };
}

const cases = readJson(CASES_PATH);
const entries = cases.map(caseEntry);
const objectiveCounts = entries.reduce((acc, entry) => {
  for (const objective of entry.objectives) {
    acc[objective.domain] = (acc[objective.domain] || 0) + 1;
  }
  return acc;
}, {});

const artifact = {
  schema_version: 'case_objective_matrix_v1',
  generated_at: new Date().toISOString(),
  review_status: 'draft_needs_clinician_educator_review',
  warning: 'This matrix is a draft curriculum scaffold generated from public case metadata and reviewed augmentation. It is not clinical educator validation evidence.',
  clinical_reasoning_framework: {
    name: 'Noticing, Interpreting, Responding, Reflecting',
    domains: [
      'noticing',
      'interpreting',
      'responding',
      'reflecting'
    ]
  },
  summary: {
    total_cases: entries.length,
    mapped_cases: entries.length,
    reviewed_objective_cases: 0,
    draft_objective_cases: entries.length,
    objective_counts_by_domain: objectiveCounts,
    acuity_distribution: entries.reduce((acc, entry) => {
      const key = `ESI_${entry.reference_esi}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  },
  cases: entries
};

writeFileSync(OUTPUT_PATH, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
console.log(`Wrote draft case objective matrix for ${entries.length} cases to ${OUTPUT_PATH}`);
