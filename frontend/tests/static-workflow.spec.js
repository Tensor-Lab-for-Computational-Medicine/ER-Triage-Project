import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
});

async function completeStaticWorkflow(page) {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Arrival brief' })).toBeVisible();
  await page.getByRole('button', { name: /Stable to interview/ }).click();
  await page.getByRole('button', { name: 'Start focused interview' }).click();

  await expect(page.getByRole('heading', { name: 'Focused triage interview' })).toBeVisible();
  await page.getByLabel('Question to patient').fill('What brought you to the emergency department today?');
  await page.getByRole('button', { name: 'Ask patient' }).click();
  await expect(page.getByText('Question 1')).toBeVisible();

  await page.getByLabel('Question to patient').fill('When did this start and has it been getting worse?');
  await page.getByRole('button', { name: 'Ask patient' }).click();
  await expect(page.getByText('Question 2')).toBeVisible();
  await page.getByRole('button', { name: 'Continue to provisional ESI' }).click();

  await expect(page.getByRole('heading', { name: 'Assign provisional ESI' })).toBeVisible();
  await page.getByRole('button', { name: /ESI 3/ }).click();
  await page.getByLabel('Provisional rationale').fill('Initial ESI 3 because the patient appears stable but likely needs ED resources after the interview.');
  await page.getByRole('button', { name: 'Record provisional ESI' }).click();
  await page.getByRole('button', { name: 'Continue to vital review' }).click();

  await expect(page.getByRole('heading', { name: 'Baseline vital signs' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue to final ESI' }).click();

  await expect(page.getByRole('heading', { name: 'Assign final ESI' })).toBeVisible();
  await page.getByRole('button', { name: /ESI 3/ }).click();
  await page.getByLabel('Final ESI rationale').fill('Final ESI 3 because the vital signs and complaint suggest a stable patient who still needs multiple ED resources and monitoring.');
  await page.getByRole('button', { name: 'Lock final ESI' }).click();
  await page.getByRole('button', { name: 'Continue to escalation' }).click();

  await expect(page.getByRole('heading', { name: 'Triage actions' })).toBeVisible();
  await page.getByLabel('Escalation rationale').fill('Routine waiting is acceptable while monitoring for worsening symptoms because no immediate instability is apparent.');
  await page.getByRole('button', { name: 'No immediate escalation' }).click();
  await page.getByRole('button', { name: 'Continue to SBAR handoff' }).click();

  await expect(page.getByRole('heading', { name: 'SBAR handoff' })).toBeVisible();
  await page.getByRole('button', { name: 'Insert SBAR labels' }).click();
  await page.getByLabel('Handoff').fill('S: ED triage patient with current complaint. B: Adult patient arriving for evaluation. A: ESI 3 with stable appearance and resource needs. R: Continue ED evaluation and monitor for changes.');
  await page.getByRole('button', { name: 'Record SBAR' }).click();
  await page.getByRole('button', { name: 'Continue to debrief' }).click();
}

test('completes the static triage workflow and shows local reasoning feedback', async ({ page }) => {
  let openRouterCalls = 0;
  await page.route('https://openrouter.ai/**', (route) => {
    openRouterCalls += 1;
    route.abort();
  });

  await completeStaticWorkflow(page);

  await expect(page.getByRole('heading', { name: 'Expert comparison' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Case summary' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Reference SBAR' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What to improve' })).toBeVisible();
  const reasoningSummary = page.locator('summary').filter({ hasText: 'Reasoning review' });
  await expect(reasoningSummary).toHaveCount(1);
  await reasoningSummary.click();
  await expect(page.getByText('Local rubric review')).toBeVisible();
  await expect(page.getByText('Clinical critique')).toBeVisible();
  expect(openRouterCalls).toBe(0);
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
                '| **First-look safety screen** | Under-triaged | Escalate earlier |'
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
  await page.getByLabel('Model').fill('test-model');
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

  await page.getByRole('button', { name: /Stable to interview/ }).click();
  await page.getByRole('button', { name: 'Start focused interview' }).click();

  await page.getByRole('button', { name: /Guided/ }).click();
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
