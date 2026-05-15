import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
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
    randomValue: 13.01 / 30,
    provisionalEsi: 3,
    finalEsi: 3
  });

  await expect(page.getByRole('heading', { name: 'Clinical findings and actions' })).toBeVisible();
  const painFindings = page.locator('.decision-delta-card').filter({ hasText: 'Severe pain 10/10' });
  await expect(painFindings).toHaveCount(1);
  await expect(painFindings.first()).toContainText('Treat severe pain as an ED resource');
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
