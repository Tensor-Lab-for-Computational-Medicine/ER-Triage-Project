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
    Math.random = () => value;
  }, randomValueForCase(caseData));
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
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
  expect(chestTimeline).toMatch(/rest|two months|lying flat|started|sudden/i);
  expect(cardiacAnswer).toMatch(/atrial fibrillation|heart|blood pressure|cholesterol/i);
  expect(cardiacAnswer).not.toMatch(/substance use|IVDU|tobacco, alcohol|methadone|HCV|EtOH|IDDM/i);

  const alteredView = buildPatientView(alteredCase);
  const alteredPlan = planPatientAnswer('When did this start and what medical conditions should I know about?', alteredView, []);
  const alteredAnswer = validatePatientSpeech(renderPatientAnswer(alteredPlan, alteredView), alteredPlan, alteredView, []);
  expect(alteredAnswer).toMatch(/not sure|wife|confused|today/i);
  expect(alteredAnswer).toMatch(/cancer|stroke|COPD|chronic pain|depression/i);
  expect(alteredAnswer).not.toMatch(/altered level of consciousness|altered mental status|\bAMS\b|I's|patient's wife/i);
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

async function completeStaticWorkflow(page, options = {}) {
  if (options.randomValue !== undefined) {
    await page.addInitScript((value) => {
      Math.random = () => value;
    }, options.randomValue);
  }

  const sbarHandoff = options.sbarHandoff ||
    'S: ED triage patient with current complaint. B: Adult patient arriving for evaluation. A: ESI 3 with stable appearance and resource needs. R: Continue ED evaluation and monitor for changes.';
  const provisionalEsi = options.provisionalEsi || 3;
  const finalEsi = options.finalEsi || 3;

  await page.goto('/');
  const initialClock = await page.locator('.case-meta strong').innerText();
  await expect
    .poll(async () => page.locator('.case-meta strong').innerText(), { timeout: 2500 })
    .not.toBe(initialClock);

  await expect(page.getByRole('heading', { name: 'Focused triage interview' })).toBeVisible();
  await expect(page.getByText('Step 1 of 7')).toBeVisible();
  await expect(page.getByText('First look', { exact: true })).toHaveCount(0);
  await expect(page.getByText('First placement', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Stable to interview')).toHaveCount(0);
  await expect(page.getByText('Immediate room')).toHaveCount(0);
  await expect(page.getByText('Resuscitation now')).toHaveCount(0);
  await expect(page.getByText('Immediate task')).toHaveCount(0);
  await expect(page.getByText('Airway or breathing threat')).toHaveCount(0);
  await expect(page.getByText('Perfusion, bleeding, or hemodynamic signal documented.')).toHaveCount(0);
  await expect(page.getByText('No circulation warning signal documented.')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Use prompts' })).toBeVisible();
  await expect(page.getByText('Interview coverage')).toBeVisible();
  await expect(page.getByText('Question budget')).toHaveCount(0);
  await expect(page.getByText('questions left')).toHaveCount(0);
  await expect(page.getByText('Practice')).toHaveCount(0);
  await expect(page.getByText('Guided')).toHaveCount(0);
  await expect(page.getByText('+20s')).toHaveCount(0);

  const interviewQuestions = [
    'What brought you to the emergency department today?',
    'When did this start and has it been getting worse?',
    'Are you having trouble breathing, chest pain, fainting, weakness, confusion, bleeding, or severe distress right now?',
    'What medical problems, medicines, allergies, or similar prior episodes should I know about?',
    'How bad is your pain or discomfort right now?'
  ];
  for (const [index, text] of interviewQuestions.entries()) {
    await page.getByLabel('Question to patient').fill(text);
    await page.getByRole('button', { name: 'Ask patient' }).click();
    await expect(page.getByText(`Question ${index + 1}`)).toBeVisible();
  }
  await expect(page.getByText('Question budget used')).toHaveCount(0);
  await expect(page.getByText('Still needed')).toBeVisible();
  await page.getByRole('button', { name: 'Continue to provisional ESI' }).click();

  await expect(page.getByRole('heading', { name: 'Initial ESI decision' })).toBeVisible();
  await page.getByRole('button', { name: new RegExp(`ESI ${provisionalEsi}`) }).click();
  await page.getByLabel('Provisional rationale').fill(`Initial ESI ${provisionalEsi} based on the available triage interview and expected ED resources.`);
  await page.getByRole('button', { name: 'Record provisional ESI' }).click();
  await page.getByRole('button', { name: 'Continue to vital review' }).click();

  await expect(page.getByRole('heading', { name: 'Baseline vital signs' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue to final ESI' }).click();

  await expect(page.getByRole('heading', { name: 'Final ESI decision' })).toBeVisible();
  await page.getByRole('button', { name: new RegExp(`ESI ${finalEsi}`) }).click();
  await page.getByLabel('Final ESI rationale').fill(`Final ESI ${finalEsi} based on vital signs, complaint risk, and expected ED resources.`);
  await page.getByRole('button', { name: 'Lock final ESI' }).click();
  await page.getByRole('button', { name: 'Continue to escalation' }).click();

  await expect(page.getByRole('heading', { name: 'Care priorities', level: 3 })).toBeVisible();
  await page.getByLabel('Escalation rationale').fill('Routine waiting is acceptable while monitoring for worsening symptoms because no immediate instability is apparent.');
  await page.getByRole('button', { name: 'Routine waiting with reassessment' }).click();
  await page.getByRole('button', { name: 'Continue to SBAR handoff' }).click();

  await expect(page.getByRole('heading', { name: 'SBAR handoff' })).toBeVisible();
  await page.getByRole('button', { name: 'Insert SBAR labels' }).click();
  await page.getByLabel('Handoff').fill(sbarHandoff);
  await page.getByRole('button', { name: 'Record SBAR' }).click();
  await page.getByRole('button', { name: 'Continue to debrief' }).click();
  await expect(page.getByText('Step 7 of 7')).toBeVisible();
}

test('completes the static triage workflow and shows local reasoning feedback', async ({ page }) => {
  let openRouterCalls = 0;
  await page.route('https://openrouter.ai/**', (route) => {
    openRouterCalls += 1;
    route.abort();
  });

  await completeStaticWorkflow(page);

  await expect(page.getByRole('heading', { name: 'Physician case review' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Physician assessment and plan' })).toBeVisible();
  const soapNote = page.locator('.soap-note-panel');
  await expect(soapNote).toContainText('Primary Diagnosis:');
  await expect(soapNote).toContainText('DDx:');
  await expect(soapNote).toContainText('Justification:');
  await expect(soapNote).toContainText('Plan');

  const reportText = await page.locator('.feedback-card').textContent();
  expect(reportText.indexOf('Primary Diagnosis:')).toBeGreaterThanOrEqual(0);
  expect(reportText.indexOf('DDx:')).toBeGreaterThan(reportText.indexOf('Primary Diagnosis:'));
  expect(reportText.indexOf('Justification:')).toBeGreaterThan(reportText.indexOf('DDx:'));
  expect(reportText.indexOf('Plan')).toBeGreaterThan(reportText.indexOf('Justification:'));
  expect(reportText.indexOf('Clinical findings and actions')).toBeGreaterThan(reportText.indexOf('Plan'));
  expect(reportText.indexOf('Next case checklist')).toBeGreaterThan(reportText.indexOf('Clinical findings and actions'));
  expect(reportText.indexOf('Score audit')).toBeGreaterThan(reportText.indexOf('Plan'));
  await expect(page.getByRole('heading', { name: 'Score domains' })).toBeHidden();
  const scoreAuditSummary = page.locator('summary').filter({ hasText: 'Score audit' });
  await expect(scoreAuditSummary).toHaveCount(1);
  await expect(scoreAuditSummary).toContainText('/ 100');
  await expect(page.getByText('Simulation realism')).toHaveCount(0);
  await expect(page.getByText('Data-bound grading')).toHaveCount(0);
  await expect(page.getByText('Browser semantic cache')).toHaveCount(0);
  await expect(page.getByText('Interview coverage 1 / 15')).toHaveCount(0);
  await expect(page.getByText('Final ESI accuracy 0 / 30')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Clinical findings and actions' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Next case checklist' })).toBeVisible();
  await scoreAuditSummary.click();
  await expect(page.getByRole('heading', { name: 'Score domains' })).toBeVisible();
  await expect(page.getByText('Objective safety reasoning')).toBeVisible();
  await expect(page.getByText('Arrival safety screen')).toHaveCount(0);
  await expect(page.getByText('First-look disposition')).toHaveCount(0);

  const sbarSummary = page.locator('summary').filter({ hasText: 'Reference SBAR' });
  await expect(sbarSummary).toHaveCount(1);
  await sbarSummary.click();
  await expect(page.getByRole('heading', { name: 'Reference SBAR' })).toBeVisible();
  const referenceSbar = page.locator('.gold-standard-panel');
  await expect(referenceSbar).toContainText('calling report');
  await expect(referenceSbar).toContainText('Recorded triage vital signs');
  await expect(referenceSbar).not.toContainText("I don't");
  await expect(referenceSbar).not.toContainText('lab events');
  const reasoningSummary = page.locator('summary').filter({ hasText: 'Reasoning review' });
  await expect(reasoningSummary).toHaveCount(1);
  await reasoningSummary.click();
  await expect(page.getByText('Clinical critique')).toBeVisible();
  expect(openRouterCalls).toBe(0);
});

test('penalizes meaningless SBAR labels instead of awarding full credit', async ({ page }) => {
  await completeStaticWorkflow(page, {
    sbarHandoff: 'S: asdf qwer zxcv. B: zzzz qqqq yyyy. A: plmn qqqq zzzz. R: xxyy zzqq qwer.'
  });

  await expect(page.getByRole('heading', { name: 'Physician case review' })).toBeVisible();
  const reasoningSummary = page.locator('summary').filter({ hasText: 'Reasoning review' });
  await reasoningSummary.click();
  const sbarReview = page.locator('.feedback-section').filter({ hasText: 'Your SBAR handoff' });
  await expect(sbarReview).toContainText('0 / 20');
  await expect(sbarReview).toContainText('not clinically meaningful');
  await expect(sbarReview).toContainText('Weak or missing elements');
});

test('shows case-specific decision deltas for under-triage', async ({ page }) => {
  await completeStaticWorkflow(page, {
    randomValue: 0,
    provisionalEsi: 5,
    finalEsi: 5,
    sbarHandoff: 'S: ED patient after a fall with head injury concern. B: Arrived by ambulance for evaluation. A: Assigned ESI 5 despite head injury risk. R: Needs clinician evaluation and monitored placement.'
  });

  await expect(page.getByRole('heading', { name: 'Physician case review' })).toBeVisible();
  await expect(page.locator('.result-badge')).toContainText('Under-triaged');
  await expect(page.getByRole('heading', { name: 'Clinical findings and actions' })).toBeVisible();

  const firstDelta = page.locator('.decision-delta-card').first();
  await expect(firstDelta).toContainText('Reference ESI 2');
  await expect(firstDelta).toContainText('Learner gap');
  await expect(firstDelta).toContainText('Expected action');
  await expect(firstDelta).toContainText('Practice rule');
});

test('deduplicates severe pain in the clinical decision review', async ({ page }) => {
  await completeStaticWorkflow(page, {
    randomValue: 12.01 / 22,
    provisionalEsi: 4,
    finalEsi: 4
  });

  await expect(page.getByRole('heading', { name: 'Clinical findings and actions' })).toBeVisible();
  const painFindings = page.locator('.decision-delta-card').filter({ hasText: 'Severe pain 8/10' });
  await expect(painFindings).toHaveCount(1);
  await expect(painFindings.first()).toContainText('Treat severe pain as an ED resource');
});

test('uses reviewed physical exam augmentation in the physician assessment and plan', async ({ page }) => {
  await completeStaticWorkflow(page, {
    randomValue: 13.01 / 22,
    provisionalEsi: 3,
    finalEsi: 3,
    sbarHandoff: 'S: ED patient with right foot swelling and pain. B: Walk-in patient with hypertension history. A: ESI 3 with pain, labs, and exam resource needs. R: Treat pain, assess foot and neurovascular status, and complete ED evaluation.'
  });

  await expect(page.getByRole('heading', { name: 'Physician assessment and plan' })).toBeVisible();
  const soapNote = page.locator('.soap-note-panel');
  await expect(soapNote).toContainText('Right foot swelling and pain requiring evaluation');
  await expect(soapNote).toContainText('Focused exam should document right foot location of swelling');
  await expect(soapNote).toContainText('distinguish injury, infection, crystal arthritis, or vascular compromise');
  await expect(page.getByRole('heading', { name: 'Clinical findings and actions' })).toBeVisible();
  const focusedExamCard = page.locator('.decision-delta-card').filter({
    has: page.locator('strong', { hasText: 'Focused exam should document right foot location of swelling' })
  });
  await expect(focusedExamCard).toHaveCount(1);
});

test('enables mocked patient voice playback controls without loading a model', async ({ page }) => {
  await page.addInitScript(() => {
    window.__ED_TRIAGE_MOCK_PATIENT_VOICE__ = { delayMs: 80 };
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Focused triage interview' })).toBeVisible();
  await page.getByLabel('Patient voice').check();
  await expect(page.getByText('Patient voice ready')).toBeVisible();

  await page.getByLabel('Question to patient').fill('What brought you to the emergency department today?');
  await page.getByRole('button', { name: 'Ask patient' }).click();
  await expect(page.getByText('Question 1')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Replay patient answer 1' })).toBeVisible();
  await page.getByRole('button', { name: 'Replay patient answer 1' }).click();
  await expect(page.getByRole('button', { name: 'Replay patient answer 1' })).toContainText(/Speaking|Listen/);
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
  await page.getByRole('button', { name: 'Start conversation' }).click();
  await expect(page.getByRole('button', { name: 'End conversation' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ask patient' })).toBeDisabled();
  await expect(page.getByText('Question 1')).toBeVisible();
  await expect(page.locator('.learner-turn')).toContainText('What brought you to the emergency department today?');
  await expect(page.locator('.patient-turn')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Replay patient answer 1' })).toBeVisible();
  await page.getByRole('button', { name: 'End conversation' }).click();
  await expect(page.getByRole('button', { name: 'Start conversation' })).toBeVisible();
});

test('keeps coded mental-status labels out of patient speech and answers follow-ups by domain', async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 7.01 / 22;
  });

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
  await page.addInitScript(() => {
    Math.random = () => 7.01 / 22;
    const badCacheKey = 'case_013::patient_response_v5::patient_dialogue_engine_v1::patient_dialogue_prompt_v4::chief_concern::ee6a4077';
    window.localStorage.setItem('ed_triage_patient_response_cache_v5', JSON.stringify({
      [badCacheKey]: {
        cache_version: 'patient_response_v5',
        persona_version: 'patient_dialogue_engine_v1',
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
  });

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
  await page.addInitScript(() => {
    Math.random = () => 2.01 / 22;
  });

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
  expect(timeline).toMatch(/rest|started|two months|breathing|lying flat/i);

  const cardiacHistory = await ask('Do you have a history of heart attacks or any cardiovascular conditions?', 3);
  expect(cardiacHistory).toMatch(/atrial fibrillation|heart|blood thinner/i);
  expect(cardiacHistory).not.toMatch(/IVDU|substance use \(|tobacco, alcohol|methadone|HCV|EtOH|IDDM/i);
});

test('uses local patient speech quickly when OpenRouter is slow or unsafe', async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 7.01 / 22;
    window.localStorage.setItem('ed_triage_openrouter_key', 'test-key');
    window.localStorage.setItem('ed_triage_openrouter_storage', 'local');
    window.localStorage.setItem('ed_triage_openrouter_patient_model', 'openrouter/auto');
  });

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
  expect(Date.now() - startedAt).toBeLessThan(1200);

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

  const tutorSummary = page.locator('summary').filter({ hasText: 'Clinical tutor' });
  await expect(tutorSummary).toHaveCount(1);
  await tutorSummary.click();
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

  const promptSummary = page.locator('summary').filter({ hasText: 'Question prompts' });
  await expect(promptSummary).toHaveCount(1);
  await promptSummary.click();
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
  const firstAnswer = await entries.nth(0).locator('p').innerText();
  const secondAnswer = await entries.nth(1).locator('p').innerText();

  expect(secondAnswer).not.toBe(firstAnswer);
  await expect(entries.nth(1)).not.toContainText('Cached response');
});
