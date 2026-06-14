import { expect, test } from '@playwright/test';

test('backend simulator runs a structured ED encounter to debrief', async ({ page }) => {
  const consoleProblems = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleProblems.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    consoleProblems.push(error.message);
  });

  await page.goto('/ai-simulator');

  await expect(page).toHaveTitle(/ED Clinical Workflow Simulator/);
  await expect(page.getByRole('heading', { name: 'Vitals' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible();
  await expect(page.getByText('Backend unavailable')).toHaveCount(0);
  await expect(page.locator('aside').first()).toContainText('SpO2');
  await expect(page.locator('aside').first()).toContainText('90');
  await expect(page.getByTestId('complete-case')).toBeDisabled();

  await page.getByTestId('chat-input').fill('Order CBC and troponin');
  await page.getByTestId('chat-send').click();
  await expect(page.getByText(/Use the order panel/)).toBeVisible();

  await page.getByTestId('quick-oxygen').click();
  await expect(page.locator('aside').first()).toContainText('94');
  await expect(page.getByText('Applied intervention: oxygen.')).toBeVisible();

  await page.getByRole('button', { name: /D-dimer/ }).click();
  await expect(page.getByTestId('active-orders')).toContainText('D-dimer');
  for (let index = 0; index < 3; index += 1) {
    await expect(page.getByTestId('advance-15')).toBeEnabled();
    await page.getByTestId('advance-15').click();
  }
  await expect(page.getByText(/D-dimer resulted/)).toBeVisible();
  await expect(page.getByTestId('active-orders')).toContainText('2.8');

  await page.getByTestId('esi-level-3').click();
  await page.getByTestId('commit-esi').click();
  await expect(page.getByTestId('commit-esi')).toHaveText('Revise ESI 3');
  await page.getByTestId('esi-level-2').click();
  await page.getByTestId('commit-esi').click();
  await expect(page.getByTestId('commit-esi')).toHaveText('Revise ESI 2');

  await page.getByTestId('differential-input').fill('pulmonary embolism\npneumonia');
  await page.getByTestId('commit-differential').click();
  await expect(page.getByText(/Committed differential/)).toBeVisible();

  await page.getByTestId('soap-assessment').fill('Pulmonary embolism is the leading concern.');
  await page.getByTestId('soap-plan').fill('Continue oxygen, admit to monitored bed, and treat PE per protocol.');
  await expect(page.getByTestId('commit-soap')).toBeEnabled();
  await page.getByTestId('commit-soap').click();
  await expect(page.getByTestId('complete-case')).toBeEnabled();
  await page.getByTestId('complete-case').click();

  await expect(page.getByRole('heading', { name: 'Debrief' })).toBeVisible();
  await expect(page.getByText('Ground Truth')).toBeVisible();
  await expect(page.locator('dl')).toContainText('pulmonary embolism');
  await expect(page.getByTestId('completeness-gaps')).toContainText('No omissions recorded.');
  await expect(page.getByTestId('usage-log')).toContainText('grader_feedback');
  await expect(page.getByTestId('usage-log')).toContainText('strong');
  expect(consoleProblems).toEqual([]);
});

test('backend simulator debrief surfaces omitted ESI and stabilization gaps', async ({ page }) => {
  await page.goto('/ai-simulator');

  await expect(page.getByRole('heading', { name: 'Vitals' })).toBeVisible();
  await page.getByTestId('soap-assessment').fill('High-risk cardiopulmonary process.');
  await page.getByTestId('soap-plan').fill('Disposition decision documented without stabilization.');
  await expect(page.getByTestId('commit-soap')).toBeEnabled();
  await page.getByTestId('commit-soap').click();
  await expect(page.getByTestId('complete-case')).toBeEnabled();
  await page.getByTestId('complete-case').click();

  await expect(page.getByRole('heading', { name: 'Debrief' })).toBeVisible();
  await expect(page.getByTestId('completeness-gaps')).toContainText('ESI was never committed.');
  await expect(page.getByTestId('completeness-gaps')).toContainText('ABCDE stabilization was incomplete before disposition.');
});
