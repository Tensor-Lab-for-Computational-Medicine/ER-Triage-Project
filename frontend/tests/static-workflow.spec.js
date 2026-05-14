import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
});

test('completes the static triage workflow and shows local reasoning feedback', async ({ page }) => {
  let openRouterCalls = 0;
  await page.route('https://openrouter.ai/**', (route) => {
    openRouterCalls += 1;
    route.abort();
  });

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Arrival brief' })).toBeVisible();
  await page.getByRole('button', { name: /Stable to interview/ }).click();
  await page.getByRole('button', { name: 'Start focused interview' }).click();

  await expect(page.getByRole('heading', { name: 'Focused triage interview' })).toBeVisible();
  await page.getByLabel('Focused triage question').fill('What brought you to the emergency department today?');
  await page.getByRole('button', { name: 'Ask patient' }).click();
  await expect(page.getByText('Question 1')).toBeVisible();

  await page.getByLabel('Focused triage question').fill('When did this start and has it been getting worse?');
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

  await expect(page.getByRole('heading', { name: 'Expert comparison' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Priority feedback' })).toBeVisible();
  const reasoningSummary = page.locator('summary').filter({ hasText: 'Reasoning rubrics' });
  await expect(reasoningSummary).toHaveCount(1);
  await reasoningSummary.click();
  await expect(page.getByText('Local rubric review')).toBeVisible();
  await expect(page.getByText('Clinical critique')).toBeVisible();
  expect(openRouterCalls).toBe(0);
});

test('closes the global AI settings panel on outside click', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: /AI settings/ }).click();
  await expect(page.getByRole('heading', { name: 'AI settings' })).toBeVisible();

  await page.getByRole('heading', { name: 'ED Triage Trainer' }).click();
  await expect(page.getByRole('heading', { name: 'AI settings' })).toBeHidden();
});
