import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildPatientView,
  planPatientAnswer,
  renderPatientAnswer,
  validatePatientSpeech
} from '../src/services/patientDialogueEngine.js';
import { buildEvidenceLanes } from '../src/services/evidenceLaneService.js';
import {
  buildNextCaseRecommendation,
  updateLearnerProfileFromFeedback
} from '../src/services/learnerProfileService.js';
import { evaluateInterview } from '../src/services/interviewEngine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const staticCases = JSON.parse(readFileSync(resolve(__dirname, '../src/data/cases.json'), 'utf8'))
  .filter((item) => item.complaint && !String(item.complaint).includes('#NAME?'));

function caseBy(predicate, label) {
  const match = staticCases.find(predicate);
  if (!match) throw new Error(`Missing static case fixture: ${label}`);
  return match;
}

function randomValueForCase(caseData) {
  const index = staticCases.findIndex((item) => item.id === caseData.id);
  if (index < 0) throw new Error(`Case ${caseData.id} is not playable.`);
  return (index + 0.01) / staticCases.length;
}

async function pinStaticCase(page, caseData) {
  await page.addInitScript((value) => {
    window.localStorage.setItem('ed_triage_learner_profile_v1', JSON.stringify({
      version: 'learner_profile_v1',
      cases_completed: 1,
      interview_gaps: {},
      esi_error_direction: { under_triage: 0, over_triage: 0, matched: 0 },
      missed_escalation_categories: {},
      weak_sbar_sections: {},
      updated_at: '2026-05-19T00:00:00.000Z'
    }));
    Math.random = () => value;
  }, randomValueForCase(caseData));
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
});

test('evidence lane builder separates triage facts, resource expectations, and outcomes', () => {
  const lanes = buildEvidenceLanes({
    caseData: {
      complaint: 'Chest pain',
      history: 'Sharp chest pain with cough and dyspnea.',
      demographics: { transport: 'Walk-in' },
      source: { disposition: 'Admitted to cardiology' },
      documented_evidence: [
        { domain: 'vitals', statement: 'BP 119/71, P 91, RR 22, SpO2 97%.' }
      ]
    },
    workflow: {
      escalation: {
        expected: [
          { name: 'Monitored bed', evidence: ['reference ESI 2'] }
        ]
      }
    },
    caseEvidence: {
      vital_flags: [
        { name: 'Pain Level', value: '8', reason: 'severe pain' }
      ],
      resources: [
        { label: 'Imaging or diagnostic testing', value: 'ECG and serial troponins' }
      ],
      outcomes: [
        { label: 'Clinical outcome', value: 'Observed after initial ED workup' }
      ],
      recorded_actions: [
        { name: 'Troponin', description: 'Drawn after physician evaluation' }
      ]
    }
  });

  const triageText = lanes.available_at_triage.map((item) => item.value).join(' ');
  const resourceText = lanes.expected_resources.map((item) => item.value).join(' ');
  const outcomeText = lanes.retrospective_outcomes.map((item) => item.value).join(' ');

  expect(triageText).toContain('Chest pain');
  expect(triageText).not.toContain('Admitted to cardiology');
  expect(resourceText).toContain('ECG and serial troponins');
  expect(outcomeText).toContain('Admitted to cardiology');
  expect(outcomeText).toContain('Drawn after physician evaluation');
});

test('learner profile update records recurring gaps and recommends the next case focus', () => {
  const { profile, delta } = updateLearnerProfileFromFeedback({
    workflow_analysis: {
      interview: { missed_domains: ['Red flags', 'Medications'] },
      escalation: { missed: [{ category: 'Monitored bed' }] },
      sbar: { missing: ['Assessment'] }
    },
    session_summary: { triage_level_assigned: 5 },
    triage_analysis: { comparison: 'Under-triaged' }
  });

  expect(profile.cases_completed).toBe(1);
  expect(profile.interview_gaps['Red flags']).toBe(1);
  expect(profile.esi_error_direction.under_triage).toBe(1);
  expect(profile.missed_escalation_categories['Monitored bed']).toBe(1);
  expect(profile.weak_sbar_sections.Assessment).toBe(1);
  expect(delta.interview_gaps).toEqual(['Red flags', 'Medications']);
  expect(buildNextCaseRecommendation(profile)).toMatchObject({
    selector: 'under_triage',
    focus: 'Under-triage prevention'
  });
});

test('interview engine requires domain coverage before normal continuation', () => {
  const caseData = {
    acuity: 2,
    complaint: 'Chest pain',
    history: 'Chest pain with shortness of breath and daily aspirin use.',
    demographics: { age: 48, sex: 'M' },
    vitals: { hr: 118, sbp: 132, dbp: 78, rr: 24, o2: 95, temp: 98.6, pain: 8 }
  };

  const partialLog = [
    { covered_categories: ['chief_concern'] },
    { covered_categories: ['timeline'] }
  ];
  const incomplete = evaluateInterview(caseData, partialLog);
  expect(incomplete.complete).toBe(false);
  expect(incomplete.can_continue).toBe(false);
  expect(incomplete.continue_requires_acknowledgement).toBe(true);
  expect(incomplete.missed_categories).toEqual(expect.arrayContaining(['medical_history', 'medications', 'red_flags', 'severity']));

  const acknowledged = evaluateInterview(caseData, partialLog, [], 'assessment', true);
  expect(acknowledged.can_continue).toBe(true);
  expect(acknowledged.gaps_acknowledged).toBe(true);

  const complete = evaluateInterview(caseData, [
    { covered_categories: ['chief_concern'] },
    { covered_categories: ['timeline', 'red_flags'] },
    { covered_categories: ['medical_history', 'medications'] },
    { covered_categories: ['severity'] }
  ]);
  expect(complete.complete).toBe(true);
  expect(complete.can_continue).toBe(true);
  expect(complete.next_best_questions).toEqual([]);
});

test('does not load voice or embedding bundles before optional feature paths are enabled', async ({ page }) => {
  const optionalRequests = [];
  page.on('request', (request) => {
    const url = request.url();
    if (/kokoro|transformers\.web|ort-wasm/i.test(url)) optionalRequests.push(url);
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Focused triage interview' })).toBeVisible();
  await page.getByLabel('Question to patient').fill('What brought you to the emergency department today?');
  await page.getByRole('button', { name: 'Ask patient' }).click();
  await expect(page.getByText('Question 1')).toBeVisible();

  expect(optionalRequests).toEqual([]);
});

test('patient dialogue engine keeps every static case in patient language', () => {
  const prompts = [
    'Can you tell me why you came to the hospital today?',
    'How long has this been going on for?',
    'How bad is the pain or discomfort right now?',
    'Are you having chest pain, trouble breathing, weakness, confusion, bleeding, fever, or vomiting?',
    'What medical problems, medicines, allergies, or similar prior episodes should I know about?',
    'What is SDH or AMS?'
  ];
  const forbidden = /altered level of consciousness|altered mental status|\bAMS\b|\bSDH\b|subdural|I's|my's|patient's wife|patient's husband|presents to the ED|chief complaint|IVDU|EtOH|HCV|IDDM|DM2|pedal edema|dyspnea|emergency department with/i;

  for (const caseData of staticCases) {
    const patientView = buildPatientView(caseData);
    const turns = [];
    for (const prompt of prompts) {
      const plan = planPatientAnswer(prompt, patientView, turns);
      const answer = validatePatientSpeech(renderPatientAnswer(plan, patientView), plan, patientView, turns);
      expect(answer, `${caseData.id} ${caseData.complaint} -> ${prompt}`).toBeTruthy();
      expect(answer).not.toMatch(forbidden);
      turns.push({ question: prompt, patient: answer, intent: plan.signature });
    }
  }
});

test('patient dialogue engine handles natural dialogue regressions', () => {
  const chestPainCase = caseBy(
    (item) => /chest pain/i.test(item.complaint) && /atrial fibrillation|orthopnea/i.test(item.history),
    'rest chest pain with cardiac history'
  );
  const alteredCase = caseBy(
    (item) => /altered/i.test(item.complaint) && /wife|confused|not oriented/i.test(item.history),
    'collateral altered-consciousness case'
  );

  const chestView = buildPatientView(chestPainCase);
  const chestTurns = [];
  const chestChiefPlan = planPatientAnswer("Can you tell me what's going on today?", chestView, chestTurns);
  const chestChief = validatePatientSpeech(renderPatientAnswer(chestChiefPlan, chestView), chestChiefPlan, chestView, chestTurns);
  chestTurns.push({ patient: chestChief, intent: chestChiefPlan.signature });
  const chestTimelinePlan = planPatientAnswer('How long has this been going on for?', chestView, chestTurns);
  const chestTimeline = validatePatientSpeech(renderPatientAnswer(chestTimelinePlan, chestView), chestTimelinePlan, chestView, chestTurns);
  const cardiacPlan = planPatientAnswer('Do you have a history of heart attacks or any cardiovascular conditions?', chestView, chestTurns);
  const cardiacAnswer = validatePatientSpeech(renderPatientAnswer(cardiacPlan, chestView), cardiacPlan, chestView, chestTurns);
  expect(chestTimeline).not.toMatch(/^I have chest pain\./i);
  expect(chestTimeline).toMatch(/rest|two months|lying flat|started|sudden|3 days|three days/i);
  expect(cardiacAnswer).toMatch(/atrial fibrillation|heart|blood pressure|cholesterol/i);
  expect(cardiacAnswer).not.toMatch(/substance use|IVDU|tobacco, alcohol|methadone|HCV|EtOH|IDDM/i);

  const alteredView = buildPatientView(alteredCase);
  const alteredPlan = planPatientAnswer('When did this start and what medical conditions should I know about?', alteredView, []);
  const alteredAnswer = validatePatientSpeech(renderPatientAnswer(alteredPlan, alteredView), alteredPlan, alteredView, []);
  expect(alteredAnswer).toMatch(/not sure|wife|confused|today/i);
  expect(alteredAnswer).toMatch(/cancer|stroke|COPD|chronic pain|depression/i);
  expect(alteredAnswer).not.toMatch(/altered level of consciousness|altered mental status|\bAMS\b|I's|patient's wife/i);

  const fallBleedingCase = {
    id: 'synthetic_fall_bleeding',
    demographics: { age: 47, sex: 'F', transport: 'AMBULANCE' },
    complaint: 'Fall and bleeding',
    history: 'Patient came by ambulance after a fall with active bleeding from the arm.',
    vitals: { temp: 98.4, hr: 92, rr: 18, o2: 99, sbp: 132, dbp: 78, pain: 4 }
  };
  const fallView = buildPatientView(fallBleedingCase);
  const fallPlan = planPatientAnswer('What is the main reason you came to the emergency department today?', fallView, []);
  const fallAnswer = validatePatientSpeech(renderPatientAnswer(fallPlan, fallView), fallPlan, fallView, []);
  expect(fallAnswer).toMatch(/I fell and I'm bleeding\./);
  expect(fallAnswer).not.toMatch(/I have fall|I have bleeding/i);
});

test('static case bundle excludes non-retained validation rows and preserves provenance', () => {
  expect(staticCases.find((item) => item.id === 'case_026')).toBeFalsy();
  for (const caseData of staticCases) {
    expect(caseData.schema_version).toBe('clinical_case_v1');
    expect(caseData.source?.adjudication?.final_decision).toBe('RETAIN');
    expect(caseData.documented_evidence?.length).toBeGreaterThan(0);
    expect(caseData.augmentation?.review_status).not.toMatch(/draft|rejected/);
  }
});

test('reviewed augmentation facts are explicit and cannot silently become grading truth', () => {
  const footSwelling = staticCases.find((item) => item.id === 'case_021');
  expect(footSwelling).toBeTruthy();
  expect(footSwelling.augmentation.review_status).toBe('reviewed');
  const examFact = footSwelling.augmentation.inferred_facts.find((item) => item.domain === 'physical_exam');
  expect(examFact).toBeTruthy();
  expect(examFact.statement).toMatch(/dorsalis pedis pulse|capillary refill|sensation/i);
  expect(examFact.source_anchors).toEqual(expect.arrayContaining(['R Foot swelling', 'reference ESI 3']));
  expect(examFact.use_in).toEqual(expect.arrayContaining(['physical_exam', 'soap', 'decision_review', 'grading_reference']));

  for (const caseData of staticCases) {
    for (const fact of caseData.augmentation.inferred_facts || []) {
      if (fact.use_in.includes('grading_reference')) {
        expect(caseData.augmentation.review_status).toBe('reviewed');
        expect(fact.review_status).toBe('reviewed');
      }
    }
  }
});

async function expectDecisionHintState(page, enabled) {
  if (enabled) {
    await expect(page.getByLabel('Decision hint')).toBeVisible();
  } else {
    await expect(page.getByLabel('Decision hint')).toHaveCount(0);
  }
  await expect(page.locator('.decision-coach')).toHaveCount(0);
}

function coachSwitch(page) {
  return page.getByRole('switch', { name: 'Coach' });
}

async function setCoachEnabled(page, enabled) {
  const control = coachSwitch(page);
  await expect(control).toHaveCount(1);
  const current = await control.isChecked();
  if (current !== enabled) {
    await page.locator('.coach-toggle').click();
  }
  if (enabled) await expect(control).toBeChecked();
  else await expect(control).not.toBeChecked();
}

async function completeStaticWorkflow(page, options = {}) {
  if (options.randomValue !== undefined) {
    await page.addInitScript((value) => {
      window.localStorage.setItem('ed_triage_learner_profile_v1', JSON.stringify({
        version: 'learner_profile_v1',
        cases_completed: 1,
        interview_gaps: {},
        esi_error_direction: { under_triage: 0, over_triage: 0, matched: 0 },
        missed_escalation_categories: {},
        weak_sbar_sections: {},
        updated_at: '2026-05-19T00:00:00.000Z'
      }));
      Math.random = () => value;
    }, options.randomValue);
  }

  const sbarHandoff = options.sbarHandoff ||
    'S: ED triage patient with current complaint. B: Adult patient arriving for evaluation. A: ESI 3 with stable appearance and resource needs. R: Continue ED evaluation and monitor for changes.';
  const finalEsi = options.finalEsi || 3;
  const finalRationale = options.finalRationale ?? `Final ESI ${finalEsi} based on vital signs, complaint risk, and expected ED resources.`;
  const actionIds = options.actionIds || [];

  await page.goto('/');
  const initialClock = await page.locator('.case-summary-clock').innerText();
  await expect
    .poll(async () => page.locator('.case-summary-clock').innerText(), { timeout: 2500 })
    .not.toBe(initialClock);

  await expect(page.getByRole('heading', { name: 'Focused triage interview' })).toBeVisible();
  await expect(page.getByLabel('Case summary')).toBeVisible();
  await setCoachEnabled(page, Boolean(options.enableCoach));
  await expect(page.locator('.case-chart')).toHaveCount(0);
  await expect(page.getByText('First look', { exact: true })).toHaveCount(0);
  await expect(page.getByText('First placement', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Stable to interview')).toHaveCount(0);
  await expect(page.getByText('Immediate room')).toHaveCount(0);
  await expect(page.getByText('Resuscitation now')).toHaveCount(0);
  await expect(page.getByText('Immediate task')).toHaveCount(0);
  await expect(page.getByText('Airway or breathing threat')).toHaveCount(0);
  await expect(page.getByText('Perfusion, bleeding, or hemodynamic signal documented.')).toHaveCount(0);
  await expect(page.getByText('No circulation warning signal documented.')).toHaveCount(0);
  await expect(page.getByText('INTERVIEW GOALS')).toBeVisible();
  await expect(page.getByText('Question budget')).toHaveCount(0);
  await expect(page.getByText('questions left')).toHaveCount(0);
  await expect(page.getByText('Practice')).toHaveCount(0);
  await expect(page.getByText('Guided')).toHaveCount(0);
  await expect(page.getByText('+20s')).toHaveCount(0);

  const interviewQuestions = [
    'What brought you to the emergency department today?',
    'When did this start and has it been getting worse?',
    'Are you having trouble breathing, chest pain, fainting, weakness, confusion, bleeding, or severe distress right now?',
    'What medical problems, medicines, allergies, pregnancy status, or similar prior episodes should I know about?',
    'What medicines or blood thinners do you take every day?',
    'How bad is your pain or discomfort right now?'
  ];
  for (const [index, text] of interviewQuestions.entries()) {
    await page.getByLabel('Question to patient').fill(text);
    await page.getByRole('button', { name: 'Ask patient' }).click();
    await expect(page.getByText(`Question ${index + 1}`)).toBeVisible();
  }
  await expect(page.getByText('Question budget used')).toHaveCount(0);
  await expect(page.getByText('INTERVIEW GOALS')).toBeVisible();
  await page.getByRole('button', { name: 'Continue to provisional ESI' }).click();

  await expect(page.getByRole('heading', { name: 'Examine & Vitals Review' })).toBeVisible();
  await expectDecisionHintState(page, Boolean(options.enableCoach));
  await page.getByRole('button', { name: 'Conduct Complete Exam' }).click();
  await page.getByRole('button', { name: 'Proceed to Definitive ESI Decision' }).click();

  await expect(page.getByRole('heading', { name: 'Definitive ESI Acuity Assignment' })).toBeVisible();
  await expectDecisionHintState(page, Boolean(options.enableCoach));
  await page.getByRole('button', { name: new RegExp(`ESI ${finalEsi}`) }).click();
  await page.getByLabel('Clinical Rationale for ESI Selection').fill(finalRationale);
  await page.getByRole('button', { name: 'Lock Definitive ESI & Proceed to Care Priorities' }).click();

  await expect(page.getByRole('heading', { name: 'Care Priorities & Orders' })).toBeVisible();
  await expectDecisionHintState(page, Boolean(options.enableCoach));
  if (actionIds.length) {
    for (const label of actionIds) {
      await page.getByLabel(label).check();
    }
    await page.getByRole('button', { name: 'Lock Care Priorities & Proceed to SBAR Handoff' }).click();
  } else {
    await page.getByRole('button', { name: 'Routine Waiting (Zero Immediate Actions)' }).click();
  }
  const proceedToSbar = page.getByRole('button', { name: 'Proceed to SBAR Handoff' });
  await proceedToSbar.click();

  await expect(page.getByRole('heading', { name: 'SBAR Handoff' })).toBeVisible();
  await expectDecisionHintState(page, Boolean(options.enableCoach));
  await page.getByRole('button', { name: 'Insert SBAR labels' }).click();
  await page.getByLabel('Handoff Summary (SBAR Format)').fill(sbarHandoff);
  await page.getByRole('button', { name: 'Record SBAR' }).click();
  await page.getByRole('button', { name: 'Continue to debrief' }).click();
  await expect(page.getByText('Step 6 of 6')).toBeVisible();
}

test('requires interview coverage before normal progression and supports acknowledged gaps', async ({ page }) => {
  let openRouterCalls = 0;
  await page.route('https://openrouter.ai/**', (route) => {
    openRouterCalls += 1;
    route.abort();
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Focused triage interview' })).toBeVisible();

  await page.getByLabel('Question to patient').fill('What brought you to the emergency department today?');
  await page.getByRole('button', { name: 'Ask patient' }).click();
  await expect(page.getByText('Question 1')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue to provisional ESI' })).toBeDisabled();

  await page.getByLabel('Question to patient').fill('How bad is your pain or distress right now?');
  await page.getByRole('button', { name: 'Ask patient' }).click();
  await expect(page.getByText('Question 2')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue to provisional ESI' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Continue with gaps' })).toBeVisible();
  await expect(page.getByText('Required domains remain open')).toBeVisible();
  await page.getByRole('button', { name: 'Continue with gaps' }).click();
  await expect(page.getByRole('heading', { name: 'Examine & Vitals Review' })).toBeVisible();
  await expectDecisionHintState(page, false);
  expect(openRouterCalls).toBe(0);
});

test('coach toggle is off by default, shows local hints when enabled, and persists', async ({ page, context }) => {
  let openRouterCalls = 0;
  await context.route('https://openrouter.ai/**', (route) => {
    openRouterCalls += 1;
    route.abort();
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Focused triage interview' })).toBeVisible();
  const coach = coachSwitch(page);
  await expect(coach).toHaveCount(1);
  await expect(coach).not.toBeChecked();

  await page.getByLabel('Question to patient').fill('What brought you to the emergency department today?');
  await page.getByRole('button', { name: 'Ask patient' }).click();
  await expect(page.getByText('Question 1')).toBeVisible();
  await page.getByLabel('Question to patient').fill('How bad is your pain or distress right now?');
  await page.getByRole('button', { name: 'Ask patient' }).click();
  await expect(page.getByText('Question 2')).toBeVisible();
  await page.getByRole('button', { name: 'Continue with gaps' }).click();

  await expect(page.getByRole('heading', { name: 'Examine & Vitals Review' })).toBeVisible();
  await expectDecisionHintState(page, false);

  await setCoachEnabled(page, true);
  await expect(page.getByLabel('Decision hint')).toBeVisible();
  await expect(page.locator('.decision-coach')).toHaveCount(0);

  await setCoachEnabled(page, false);
  await expectDecisionHintState(page, false);

  await setCoachEnabled(page, true);
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('ed_triage_coach_enabled')))
    .toBe('true');

  const persistedPage = await context.newPage();
  await persistedPage.goto('/');
  await expect(persistedPage.getByRole('heading', { name: 'Focused triage interview' })).toBeVisible();
  await expect(coachSwitch(persistedPage)).toBeChecked();
  await persistedPage.close();
  expect(openRouterCalls).toBe(0);
});

test('credits multi-intent interview questions and renders turn-level coaching', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Focused triage interview' })).toBeVisible();

  await page.getByLabel('Question to patient').fill('When did this start, how bad is it, and are you having chest pain, trouble breathing, weakness, confusion, bleeding, fever, or vomiting?');
  await page.getByRole('button', { name: 'Ask patient' }).click();
  await expect(page.getByText('Question 1')).toBeVisible();
  await expect(page.locator('.interview-progress-bar-container')).toContainText('COVERED');
  await expect(page.locator('.interview-progress-bar-container')).not.toContainText('0 / 6 COVERED');
});

test('completes the static triage workflow and shows local reasoning feedback', async ({ page }) => {
  let openRouterCalls = 0;
  await page.route('https://openrouter.ai/**', (route) => {
    openRouterCalls += 1;
    route.abort();
  });

  await completeStaticWorkflow(page);

  await expect(page.getByRole('heading', { name: 'Clinical Judgment Debrief & SOAP Breakdown' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Physician SOAP Assessment & Plan' })).toBeVisible();
  const soapNote = page.locator('.expert-soap-breakdown');
  await expect(soapNote).toContainText('Primary Working Diagnosis:');
  await expect(soapNote).toContainText('Differential Diagnosis Considerations:');
  await expect(soapNote).toContainText('Clinical Rationale:');
  await expect(soapNote).toContainText('Initial ED Care Plan');

  const reportText = await page.locator('.debrief-card').textContent();
  expect(reportText.indexOf('Primary Working Diagnosis:')).toBeGreaterThanOrEqual(0);
  expect(reportText.indexOf('Differential Diagnosis Considerations:')).toBeGreaterThan(reportText.indexOf('Primary Working Diagnosis:'));
  expect(reportText.indexOf('Clinical Rationale:')).toBeGreaterThan(reportText.indexOf('Differential Diagnosis Considerations:'));
  expect(reportText.indexOf('Initial ED Care Plan')).toBeGreaterThan(reportText.indexOf('Clinical Rationale:'));
  expect(reportText.indexOf('Acuity Delta')).toBeGreaterThan(reportText.indexOf('Initial ED Care Plan'));
  await expect(page.getByText('Simulation realism')).toHaveCount(0);
  await expect(page.getByText('Data-bound grading')).toHaveCount(0);
  await expect(page.getByText('Browser semantic cache')).toHaveCount(0);
  await expect(page.getByText('Interview coverage 1 / 15')).toHaveCount(0);
  await expect(page.getByText('Final ESI accuracy 0 / 30')).toHaveCount(0);
  await page.getByRole('button', { name: 'Clinical Tips & Tutor' }).click();
  await expect(page.locator('.learner-profile-panel')).toBeVisible();
  await expect(page.getByText('Next case focus', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Triage Rationale' }).click();
  const scoreAuditSummary = page.locator('summary').filter({ hasText: 'Complete Clinical Domain Scoring Ledger' });
  await expect(scoreAuditSummary).toHaveCount(1);
  await scoreAuditSummary.click();
  await expect(page.getByRole('heading', { name: 'Score Domains' })).toBeVisible();
  await expect(page.getByText('Objective safety reasoning')).toBeVisible();
  await expect(page.getByText('Arrival safety screen')).toHaveCount(0);
  await expect(page.getByText('First-look disposition')).toHaveCount(0);

  await expect(page.getByRole('heading', { name: 'Communication & SBAR Handoff' })).toBeVisible();
  const referenceSbar = page.locator('.gold-standard-sbar');
  await expect(referenceSbar).toContainText('calling report');
  await expect(referenceSbar).toContainText('Recorded triage vital signs');
  await expect(referenceSbar).not.toContainText("I don't");
  await expect(referenceSbar).not.toContainText('lab events');
  expect(openRouterCalls).toBe(0);
});

test('penalizes meaningless SBAR labels instead of awarding full credit', async ({ page }) => {
  await completeStaticWorkflow(page, {
    sbarHandoff: 'S: asdf qwer zxcv. B: zzzz qqqq yyyy. A: plmn qqqq zzzz. R: xxyy zzqq qwer.'
  });

  await expect(page.getByRole('heading', { name: 'Clinical Judgment Debrief & SOAP Breakdown' })).toBeVisible();
  await page.getByRole('button', { name: 'Triage Rationale' }).click();
  const sbarReview = page.locator('.sbar-critique-section');
  await expect(sbarReview).toContainText('Your SBAR Handoff');
  await expect(sbarReview).toContainText('Rubric Score');
  await expect(sbarReview).toContainText(/0 \/ 20|not clinically meaningful|Weak or missing/i);
});

test('shows case-specific decision deltas for under-triage', async ({ page }) => {
  await completeStaticWorkflow(page, {
    randomValue: 0,
    provisionalEsi: 5,
    finalEsi: 5,
    sbarHandoff: 'S: ED patient after a fall with head injury concern. B: Arrived by ambulance for evaluation. A: Assigned ESI 5 despite head injury risk. R: Needs clinician evaluation and monitored placement.'
  });

  await expect(page.getByRole('heading', { name: 'Clinical Judgment Debrief & SOAP Breakdown' })).toBeVisible();
  await expect(page.locator('.result-badge')).toContainText('Under-triaged');
  await expect(page.locator('.takeaway-banner')).toContainText('Student ESI 5 vs Reference ESI 2');
  await expect(page.locator('.takeaway-banner')).toContainText('Clinical Takeaway');
});

test('explains ESI 4 versus ESI 5 for a source-limited finger laceration without false escalation', async ({ page }) => {
  const lacerationCase = caseBy((item) => item.id === 'case_018', 'source-limited finger laceration');

  await completeStaticWorkflow(page, {
    randomValue: randomValueForCase(lacerationCase),
    provisionalEsi: 4,
    finalEsi: 5,
    sbarHandoff: 'S: Stable 26-year-old male with a finger laceration. B: Walk-in patient with pain 3 out of 10 and no major history documented. A: Low acuity ESI 5 with stable vitals. R: Address bleeding and discharge.'
  });

  await expect(page.getByRole('heading', { name: 'Clinical Judgment Debrief & SOAP Breakdown' })).toBeVisible();
  const feedback = page.locator('.debrief-card');
  await expect(feedback).toContainText('Under-triaged: Student ESI 5 vs Reference ESI 4');
  await expect(feedback).not.toContainText('Escalate airway or oxygenation support');
  await expect(feedback).not.toContainText('Anticipate medication route needs');

  const soapNote = page.locator('.expert-soap-breakdown');
  await expect(soapNote).toContainText('Finger laceration requiring closure');
  await expect(soapNote).toContainText('tendon and neurovascular function');
  await expect(soapNote).toContainText('tetanus immunization status');
  await expect(soapNote).not.toContainText('Assess airway, breathing, oxygenation');

  await page.getByRole('button', { name: 'Triage Rationale' }).click();
  await page.locator('summary').filter({ hasText: 'Complete Clinical Domain Scoring Ledger' }).click();
  await expect(page.getByRole('heading', { name: 'Score Domains' })).toBeVisible();
});

test('does not turn normal or negated breathing text into airway escalation', async ({ page }) => {
  const lacerationCase = caseBy((item) => item.id === 'case_018', 'finger laceration with normal breaths per minute text');
  await completeStaticWorkflow(page, {
    randomValue: randomValueForCase(lacerationCase),
    provisionalEsi: 4,
    finalEsi: 4,
    sbarHandoff: 'S: Stable 26-year-old male with a finger laceration. B: Walk-in patient with pain 3 out of 10. A: ESI 4 with stable vital signs and one wound-care resource expected. R: Complete wound exam, bleeding control, tetanus check, repair or dressing, and discharge precautions.'
  });
  await expect(page.locator('.debrief-card')).not.toContainText('Escalate airway or oxygenation support');

  const swallowingCase = caseBy(
    (item) => item.id === 'case_004' && /no stridor or breathing difficulties/i.test(item.history),
    'negated breathing symptoms'
  );
  await page.reload();
  await completeStaticWorkflow(page, {
    randomValue: randomValueForCase(swallowingCase),
    provisionalEsi: 2,
    finalEsi: 2,
    sbarHandoff: 'S: ESI 2 patient with postoperative neck swelling and difficulty swallowing. B: Arrived by ambulance after recent neck surgery and cannot swallow liquids. A: High-risk airway-adjacent complaint with severe blood pressure elevation but no breathing difficulty reported. R: Prompt clinician evaluation and monitored treatment area.'
  });
  await expect(page.locator('.debrief-card')).not.toContainText('Escalate airway or oxygenation support');
});

test('credits a concise low-acuity laceration SBAR against wound-care expectations', async ({ page }) => {
  const lacerationCase = caseBy((item) => item.id === 'case_018', 'source-limited finger laceration');
  await completeStaticWorkflow(page, {
    randomValue: randomValueForCase(lacerationCase),
    provisionalEsi: 4,
    finalEsi: 4,
    sbarHandoff: 'S: Stable 26-year-old male with a finger laceration. B: Walk-in patient with pain 3 out of 10 and no major history documented. A: Low acuity ESI 4 with stable vitals and a likely wound-care resource. R: Address bleeding, complete wound exam, check tetanus, repair or dress the wound, and discharge with return precautions.'
  });

  await page.getByRole('button', { name: 'Triage Rationale' }).click();
  const sbarReview = page.locator('.sbar-critique-section');
  await expect(sbarReview).toContainText('Rubric Score');
  await expect(sbarReview).toContainText(/8 \/ 20|9 \/ 20|10 \/ 20|1[1-9] \/ 20|20 \/ 20/);
  const referenceSbar = page.locator('.gold-standard-sbar');
  await expect(referenceSbar).toContainText('fast-track or minor-care workflow');
  await expect(referenceSbar).toContainText('wound exam, bleeding control, tetanus assessment');
  await expect(referenceSbar).not.toContainText('airway or oxygenation');
});

test('teaches matched ESI 5 medication-refill cases without failure-style feedback', async ({ page }) => {
  const medRefillCase = caseBy((item) => item.id === 'case_027', 'matched medication refill ESI 5');
  await completeStaticWorkflow(page, {
    randomValue: randomValueForCase(medRefillCase),
    provisionalEsi: 5,
    finalEsi: 5,
    finalRationale: 'No chief complaint and vitals stable',
    escalationRationale: 'None needed. Patient totally stable.',
    sbarHandoff: 'S: Patient needs medication refill. B: 41 YO F with PMH not documented and medication details not documented. A: Stable ESI 5 with normal vitals and no pain. R: Refill or bridge medication if safe and arrange pharmacy or primary care follow-up.'
  });

  await expect(page.getByRole('heading', { name: 'Clinical Judgment Debrief & SOAP Breakdown' })).toBeVisible();
  const feedback = page.locator('.debrief-card');
  await expect(feedback).toContainText('Matched Reference Acuity: ESI 5');
  await expect(feedback).toContainText('No danger-zone vital signs were present at triage');
  await expect(feedback).not.toContainText('missing reviewed focused exam details');

  const soapNote = page.locator('.expert-soap-breakdown');
  await expect(soapNote).toContainText('Routine medication refill request');
  await expect(soapNote).toContainText('Verify the medication name, dose, last dose taken');
  await expect(soapNote).toContainText('Screen for symptoms from missed therapy');
  await expect(soapNote).not.toContainText('Reference disposition is home');

  await page.getByRole('button', { name: 'Clinical Tips & Tutor' }).click();
  const checklist = page.locator('.next-case-checklist');
  await expect(checklist).toContainText('Ask for the medication name, dose, last dose');
  await expect(checklist).toContainText('Close the plan with refill safety, outpatient access, and return precautions');
  await expect(checklist).not.toContainText('Reference disposition is home');

  await page.getByRole('button', { name: 'Triage Rationale' }).click();
  await expect(page.getByRole('heading', { name: 'Communication & SBAR Handoff' })).toBeVisible();
  await expect(page.locator('.sbar-critique-section')).toContainText('Rubric Score');
  await expect(page.locator('.gold-standard-sbar')).toContainText('No danger-zone vital signs were present at triage');

  const scoreAuditSummary = page.locator('summary').filter({ hasText: 'Complete Clinical Domain Scoring Ledger' });
  await scoreAuditSummary.click();
  await expect(page.locator('.score-domain').filter({ hasText: 'SBAR handoff' })).toContainText(/8 \/ 20|9 \/ 20|1[0-9] \/ 20|20 \/ 20/);
});

test('deduplicates severe pain in the clinical decision review', async ({ page }) => {
  const wristPainCase = caseBy((item) => item.id === 'case_020', 'severe wrist pain');
  await completeStaticWorkflow(page, {
    randomValue: randomValueForCase(wristPainCase),
    finalEsi: 4
  });

  await expect(page.getByRole('heading', { name: 'Clinical Judgment Debrief & SOAP Breakdown' })).toBeVisible();
  const debriefText = await page.locator('.debrief-card').textContent();
  const severePainMentions = (debriefText.match(/severe pain|pain rated 8\/10|pain level 8\/10/gi) || []).length;
  expect(severePainMentions).toBeGreaterThanOrEqual(1);
  expect(severePainMentions).toBeLessThanOrEqual(3);
});

test('uses reviewed physical exam augmentation in the physician assessment and plan', async ({ page }) => {
  const footSwellingCase = caseBy((item) => item.id === 'case_021', 'right foot swelling with reviewed exam augmentation');
  await completeStaticWorkflow(page, {
    randomValue: randomValueForCase(footSwellingCase),
    finalEsi: 3,
    sbarHandoff: 'S: ED patient with right foot swelling and pain. B: Walk-in patient with hypertension history. A: ESI 3 with pain, labs, and exam resource needs. R: Treat pain, assess foot and neurovascular status, and complete ED evaluation.'
  });

  await expect(page.getByRole('heading', { name: 'Physician SOAP Assessment & Plan' })).toBeVisible();
  const soapNote = page.locator('.expert-soap-breakdown');
  await expect(soapNote).toContainText('Right foot swelling and pain requiring evaluation');
  await expect(soapNote).toContainText('focused foot exam');
  await expect(soapNote).toContainText('infection or crystal arthritis');
  await expect(soapNote).not.toContainText('should document');
});

test('writes clinician-style SOAP assessment for open fracture cases', async ({ page }) => {
  const openFractureCase = caseBy((item) => item.id === 'case_029', 'open tibia/fibula fracture');

  await pinStaticCase(page, openFractureCase);
  await page.goto('/');
  await expect(page.getByLabel('Case summary')).toContainText(/left leg|L Leg/i);

  const interviewQuestions = [
    'What brought you to the emergency department today?',
    'When did this start and what happened?',
    'Are you having bleeding, numbness, weakness, severe pain, or trouble breathing right now?',
    'What medical problems, medicines, allergies, pregnancy status, or similar prior episodes should I know about?',
    'What medicines or blood thinners do you take every day?',
    'How bad is your pain or discomfort right now?'
  ];
  for (const text of interviewQuestions) {
    await page.getByLabel('Question to patient').fill(text);
    await page.getByRole('button', { name: 'Ask patient' }).click();
  }

  await page.getByRole('button', { name: 'Continue to provisional ESI' }).click();
  await expect(page.getByRole('heading', { name: 'Examine & Vitals Review' })).toBeVisible();
  await page.getByRole('button', { name: 'Conduct Complete Exam' }).click();
  await page.getByRole('button', { name: 'Proceed to Definitive ESI Decision' }).click();

  await expect(page.getByRole('heading', { name: /Definitive ESI|Final ESI|ESI decision/i })).toBeVisible();
  await page.getByRole('button', { name: /ESI 2/ }).click();
  await page.getByLabel(/rationale/i).fill('Open long-bone fracture requires urgent wound, neurovascular, and orthopedic management.');
  await page.getByRole('button', { name: /Lock|Record.*ESI/i }).click();

  await expect(page.getByRole('heading', { name: /Care priorities/i })).toBeVisible();
  await page.getByLabel('Place in monitored care area').check();
  await page.getByLabel('Request immediate clinician evaluation').check();
  const proceedToSbar = page.getByRole('button', { name: /Proceed to SBAR Handoff/i });
  await proceedToSbar.click();
  if (await proceedToSbar.isVisible().catch(() => false)) {
    await proceedToSbar.click();
  }

  await expect(page.getByRole('heading', { name: /SBAR/i })).toBeVisible();
  await page.getByRole('button', { name: 'Insert SBAR labels' }).click();
  await page.getByLabel('Handoff').fill('S: Transfer patient after fall with open left tibia/fibula fracture. B: Adult female with controlled bleeding and associated ankle and foot fractures. A: High-risk open long-bone fracture requiring monitored care and serial neurovascular checks. R: Place in monitored care, protect the wound, start antibiotics and tetanus assessment, and notify orthopedics.');
  await page.getByRole('button', { name: 'Record SBAR' }).click();
  await page.getByRole('button', { name: 'Continue to debrief' }).click();

  await expect(page.getByRole('heading', { name: 'Physician SOAP Assessment & Plan' })).toBeVisible();
  const assessment = page.locator('.soap-box.highlighted');
  await expect(assessment).toContainText('Open left tibia/fibula fracture with associated ankle and foot fractures after fall');
  await expect(assessment).toContainText('open left lower-extremity fracture after a fall');
  await expect(assessment).toContainText('serial distal neurovascular and compartment exams');
  await expect(assessment).toContainText('Palpable distal pulses, preserved toe movement and sensation');
  await expect(assessment).not.toContainText('Past medical history is notable');
  await expect(assessment).not.toContainText('depression');
  await expect(assessment).not.toContainText('Matches this patient');
  await expect(assessment).not.toContainText('Matches less well');
  await expect(assessment).not.toContainText('Best discriminator');
  await expect(assessment).not.toContainText('Acuity implication');
  await expect(assessment).not.toContainText('Reference ESI');
  await expect(assessment).not.toContainText('source bundle');
  await expect(assessment).not.toContainText('triage history does not show');
  await expect(assessment).not.toContainText('resource use');
});

test('enables mocked patient voice playback controls without loading a model', async ({ page }) => {
  await page.addInitScript(() => {
    window.__ED_TRIAGE_MOCK_PATIENT_VOICE__ = { delayMs: 80 };
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Focused triage interview' })).toBeVisible();
  await page.getByLabel('Enable patient voice audio (TTS)').check();
  await expect(page.getByLabel('Enable patient voice audio (TTS)')).toBeChecked();

  await page.getByLabel('Question to patient').fill('What brought you to the emergency department today?');
  await page.getByRole('button', { name: 'Ask patient' }).click();
  await expect(page.getByText('Question 1')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Replay patient answer 1' })).toBeVisible();
  await page.getByRole('button', { name: 'Replay patient answer 1' }).click();
  await expect(page.getByRole('button', { name: 'Replay patient answer 1' })).toBeVisible();
});

test('supports a hands-free voice conversation loop', async ({ page }) => {
  await page.addInitScript(() => {
    window.__ED_TRIAGE_MOCK_PATIENT_VOICE__ = { delayMs: 20 };
    window.__mockSpeechStarts = 0;
    class MockSpeechRecognition {
      constructor() {
        this.lang = 'en-US';
        this.continuous = false;
        this.interimResults = false;
        this.maxAlternatives = 1;
      }

      start() {
        window.__mockSpeechStarts += 1;
        setTimeout(() => {
          this.onstart?.();
          if (window.__mockSpeechStarts > 1) return;
          setTimeout(() => {
            const result = [{ transcript: 'What brought you to the emergency department today?' }];
            result.isFinal = true;
            this.onresult?.({ results: [result] });
            setTimeout(() => this.onend?.(), 0);
          }, 20);
        }, 0);
      }

      stop() {
        setTimeout(() => this.onend?.(), 0);
      }

      abort() {
        setTimeout(() => this.onend?.(), 0);
      }
    }
    window.SpeechRecognition = MockSpeechRecognition;
    window.webkitSpeechRecognition = MockSpeechRecognition;
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Focused triage interview' })).toBeVisible();
  await page.getByRole('button', { name: 'Start Continuous Voice Mode' }).click();
  await expect(page.getByRole('button', { name: 'Continuous Voice Active' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ask patient' })).toBeDisabled();
  await expect(page.getByText('Question 1')).toBeVisible();
  await expect(page.locator('.learner-turn')).toContainText('What brought you to the emergency department today?');
  await expect(page.locator('.patient-turn')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Replay patient answer 1' })).toBeVisible();
  await page.getByRole('button', { name: 'Continuous Voice Active' }).click();
  await expect(page.getByRole('button', { name: 'Start Continuous Voice Mode' })).toBeVisible();
});

test('keeps coded mental-status labels out of patient speech and answers follow-ups by domain', async ({ page }) => {
  const alteredCase = caseBy(
    (item) => /altered/i.test(item.complaint) && /wife|confused|not oriented/i.test(item.history),
    'collateral altered-consciousness case'
  );
  await pinStaticCase(page, alteredCase);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Focused triage interview' })).toBeVisible();

  async function ask(text, questionNumber) {
    await page.getByLabel('Question to patient').fill(text);
    await page.getByRole('button', { name: 'Ask patient' }).click();
    await expect(page.getByText(`Question ${questionNumber}`)).toBeVisible();
    return page.locator('.interview-entry').nth(questionNumber - 1).locator('.patient-turn p').innerText();
  }

  const chiefConcern = await ask('Hi, can you tell me why you came in today?', 1);
  expect(chiefConcern).not.toMatch(/altered level of consciousness|altered mental status|\bAMS\b/i);
  expect(chiefConcern).toMatch(/not really sure|wife|confused|not making sense|fallen|acting/i);

  const termClarification = await ask('What is AMS, is that a medical condition that you have?', 2);
  expect(termClarification).not.toMatch(/altered level of consciousness|altered mental status|\bAMS\b/i);
  expect(termClarification).toMatch(/not sure|do not know|don't know/i);
  expect(termClarification).toMatch(/wife|confused|not making sense|fallen|acting/i);

  const timeline = await ask('How long has this been going on for?', 3);
  expect(timeline).not.toMatch(/altered level of consciousness|altered mental status|\bAMS\b/i);
  expect(timeline).not.toBe(chiefConcern);
  expect(timeline).toMatch(/started|exact|today|time|found|wife/i);

  const repeatedTimeline = await ask('How long has this been going on for?', 4);
  expect(repeatedTimeline).not.toMatch(/altered level of consciousness|altered mental status|\bAMS\b/i);
  expect(repeatedTimeline).not.toBe(timeline);
});

test('uses natural collateral speech for altered-consciousness cases', async ({ page }) => {
  const alteredCase = caseBy(
    (item) => /altered/i.test(item.complaint) && /wife|confused|not oriented/i.test(item.history),
    'collateral altered-consciousness case'
  );
  await page.addInitScript(({ randomValue }) => {
    window.localStorage.setItem('ed_triage_learner_profile_v1', JSON.stringify({
      version: 'learner_profile_v1',
      cases_completed: 1,
      interview_gaps: {},
      esi_error_direction: { under_triage: 0, over_triage: 0, matched: 0 },
      missed_escalation_categories: {},
      weak_sbar_sections: {},
      updated_at: '2026-05-19T00:00:00.000Z'
    }));
    Math.random = () => randomValue;
    const badCacheKey = 'case_013::patient_response_v6::patient_dialogue_engine_v2::patient_dialogue_prompt_v4::chief_concern::ee6a4077';
    window.localStorage.setItem('ed_triage_patient_response_cache_v6', JSON.stringify({
      [badCacheKey]: {
        cache_version: 'patient_response_v6',
        persona_version: 'patient_dialogue_engine_v2',
        prompt_version: 'patient_dialogue_prompt_v4',
        question: 'Why did you come in?',
        answer: "I'm here for altered level of consciousness.",
        source: 'Cached patient response',
        intent_key: 'chief_concern::ee6a4077',
        category: 'chief_concern',
        covered_categories: ['chief_concern'],
        updated_at: new Date().toISOString()
      }
    }));
  }, { randomValue: randomValueForCase(alteredCase) });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Focused triage interview' })).toBeVisible();

  async function ask(text, questionNumber) {
    await page.getByLabel('Question to patient').fill(text);
    await page.getByRole('button', { name: 'Ask patient' }).click();
    await expect(page.getByText(`Question ${questionNumber}`)).toBeVisible();
    return page.locator('.interview-entry').nth(questionNumber - 1).locator('.patient-turn p').innerText();
  }

  const chiefConcern = await ask('Can you let me know why you came to the hospital today?', 1);
  expect(chiefConcern).not.toMatch(/altered level of consciousness|altered mental status|\bAMS\b|ESI|admitted|resources/i);
  expect(chiefConcern).not.toMatch(/I's|my's|patient's wife|patient's husband|presents to the ED|\d+\s*year[- ]old\s+white\s+male/i);
  expect(chiefConcern).toMatch(/not really sure|wife|confused|not making sense|fallen|acting/i);

  const compoundAnswer = await ask('When did this start and what medical conditions should I know about?', 2);
  expect(compoundAnswer).not.toMatch(/altered level of consciousness|altered mental status|\bAMS\b|I's|my's|patient's wife|presents to the ED/i);
  expect(compoundAnswer).toMatch(/not sure|started|today|found|wife/i);
  expect(compoundAnswer).toMatch(/history|cancer|stroke|COPD|chronic pain|depression/i);

  const clarification = await ask('What is AMS?', 3);
  expect(clarification).not.toMatch(/altered level of consciousness|altered mental status|\bAMS\b|I's|patient's wife/i);
  expect(clarification).toMatch(/not sure|do not know|don't know/i);
  expect(clarification).toMatch(/wife|confused|not making sense/i);
});

test('answers chest-pain timeline and cardiovascular history naturally', async ({ page }) => {
  const chestPainCase = caseBy(
    (item) => /chest pain/i.test(item.complaint) && /atrial fibrillation|orthopnea/i.test(item.history),
    'rest chest pain with cardiac history'
  );
  await pinStaticCase(page, chestPainCase);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Focused triage interview' })).toBeVisible();

  async function ask(text, questionNumber) {
    await page.getByLabel('Question to patient').fill(text);
    await page.getByRole('button', { name: 'Ask patient' }).click();
    await expect(page.getByText(`Question ${questionNumber}`)).toBeVisible();
    return page.locator('.interview-entry').nth(questionNumber - 1).locator('.patient-turn p').innerText();
  }

  const chiefConcern = await ask("Can you tell me what's going on today?", 1);
  expect(chiefConcern).toMatch(/chest pain/i);

  const timeline = await ask('How long has this been going on for?', 2);
  expect(timeline).not.toMatch(/^I have chest pain\./i);
  expect(timeline).toMatch(/rest|started|two months|breathing|lying flat|3 days|three days/i);

  const cardiacHistory = await ask('Do you have a history of heart attacks or any cardiovascular conditions?', 3);
  expect(cardiacHistory).toMatch(/atrial fibrillation|heart|blood thinner/i);
  expect(cardiacHistory).not.toMatch(/IVDU|substance use \(|tobacco, alcohol|methadone|HCV|EtOH|IDDM/i);
});

test('uses local patient speech quickly when OpenRouter is slow or unsafe', async ({ page }) => {
  const alteredCase = caseBy(
    (item) => /altered/i.test(item.complaint) && /wife|confused|not oriented/i.test(item.history),
    'collateral altered-consciousness case'
  );
  await page.addInitScript(({ randomValue }) => {
    window.localStorage.setItem('ed_triage_learner_profile_v1', JSON.stringify({
      version: 'learner_profile_v1',
      cases_completed: 1,
      interview_gaps: {},
      esi_error_direction: { under_triage: 0, over_triage: 0, matched: 0 },
      missed_escalation_categories: {},
      weak_sbar_sections: {},
      updated_at: '2026-05-19T00:00:00.000Z'
    }));
    Math.random = () => randomValue;
    window.localStorage.setItem('ed_triage_openrouter_key', 'test-key');
    window.localStorage.setItem('ed_triage_openrouter_storage', 'local');
    window.localStorage.setItem('ed_triage_openrouter_patient_model', 'openrouter/auto');
  }, { randomValue: randomValueForCase(alteredCase) });

  let openRouterCalls = 0;
  await page.route('https://openrouter.ai/**', async (route) => {
    openRouterCalls += 1;
    await new Promise((resolve) => setTimeout(resolve, 900));
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({ answer: "I'm here for SDH and ESI 2." })
            }
          }
        ]
      })
    });
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Focused triage interview' })).toBeVisible();

  const startedAt = Date.now();
  await page.getByLabel('Question to patient').fill('Why did you come in today?');
  await page.getByRole('button', { name: 'Ask patient' }).click();
  await expect(page.getByText('Question 1')).toBeVisible();
  expect(Date.now() - startedAt).toBeLessThan(3000);

  const answer = await page.locator('.interview-entry').first().locator('.patient-turn p').innerText();
  expect(answer).not.toMatch(/altered level of consciousness|altered mental status|\bAMS\b|ESI/i);
  expect(answer).toMatch(/wife|confused|not making sense|fallen|acting|not really sure/i);
  expect(openRouterCalls).toBeGreaterThanOrEqual(1);
});

test('renders raw AI tutor markdown as structured guidance', async ({ page }) => {
  await page.route('https://openrouter.ai/**', (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        choices: [
          {
            message: {
              content: [
                '**Key take-aways for your next triage**',
                '',
                '| Domain | What was missed | How to improve |',
                '|--------|-----------------|----------------|',
                '| **Acuity decision** | Under-triaged | Escalate earlier |'
              ].join('\n')
            }
          }
        ]
      })
    });
  });

  await completeStaticWorkflow(page);

  await page.getByRole('button', { name: /AI settings/ }).click();
  await page.getByLabel('API key').fill('test-key');
  await page.getByRole('button', { name: 'Save' }).click();

  await page.getByRole('button', { name: 'Clinical Tips & Tutor' }).click();
  await page.getByRole('button', { name: 'What should I improve next time?' }).click();

  const tutorThread = page.locator('.tutor-thread');
  await expect(page.getByRole('heading', { name: 'Case guidance' })).toBeVisible();
  await expect(tutorThread).toContainText('Teaching point');
  await expect(tutorThread).not.toContainText('| Domain |');
  await expect(tutorThread).not.toContainText('**Key take-aways');
});

test('closes the global AI settings panel on outside click', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: /AI settings/ }).click();
  await expect(page.getByRole('heading', { name: 'AI settings' })).toBeVisible();

  await page.getByRole('heading', { name: 'ED Triage Trainer' }).click();
  await expect(page.getByRole('heading', { name: 'AI settings' })).toBeHidden();
});

test('does not reuse a special-risk answer for a broad background question', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Focused triage interview' })).toBeVisible();

  await page.getByRole('button', { name: /Check special population risks/ }).click();
  await page.getByRole('button', { name: 'Ask patient' }).click();
  await expect(page.getByText('Question 1')).toBeVisible();

  await page
    .getByLabel('Question to patient')
    .fill('What medical problems, medicines, allergies, or similar prior episodes should I know about?');
  await page.getByRole('button', { name: 'Ask patient' }).click();
  await expect(page.getByText('Question 2')).toBeVisible();

  const entries = page.locator('.interview-entry');
  await expect(entries).toHaveCount(2);
  const firstAnswer = await entries.nth(0).locator('.patient-answer-row p').innerText();
  const secondAnswer = await entries.nth(1).locator('.patient-answer-row p').innerText();

  expect(secondAnswer).not.toBe(firstAnswer);
  await expect(entries.nth(1)).not.toContainText('Cached response');
});
