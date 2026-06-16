import { expect, test } from '@playwright/test';

const AI_CONFIG_STORAGE_KEY = 'ed-simulator.ai-config.v1';

test('root route lands on the AI simulator', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/ai-simulator$/);
  await expect(page.getByRole('heading', { name: 'Vitals' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible();
  await expect(page.getByTestId('case-release-status')).toHaveText('Feedback locked');
  await expect(page.getByTestId('ai-status-message')).toContainText('Connected: mock');
});

test('case_id query starts the requested backend case', async ({ page }) => {
  const sessionStarts = [];
  await page.route('**/api/sessions', async (route) => {
    if (route.request().method() === 'POST') {
      sessionStarts.push(route.request().postDataJSON());
    }
    await route.continue();
  });

  await page.goto('/ai-simulator?case_id=sample_pe_001');

  await expect(page.getByRole('heading', { name: 'Vitals' })).toBeVisible();
  await expect(page.getByText('46F dyspnea with pleuritic chest pain')).toBeVisible();
  await expect(page.getByTestId('case-release-status')).toHaveText('Feedback locked');
  expect(sessionStarts[0]).toEqual({ case_id: 'sample_pe_001' });
});

test('saved local AI config auto-connects without re-entering the key', async ({ page }) => {
  const configRequests = [];
  await page.addInitScript(([storageKey, savedConfig]) => {
    window.localStorage.setItem(storageKey, JSON.stringify(savedConfig));
  }, [
    AI_CONFIG_STORAGE_KEY,
    {
      version: 1,
      provider: 'openai_responses',
      apiKey: 'sk-local-restore-test',
      baseUrl: '',
      cheapModel: 'restore-dialogue-model',
      strongModel: 'restore-strong-model'
    }
  ]);
  await page.route('**/api/llm/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        configured: false,
        provider: 'unconfigured',
        cheap_model: 'gpt-5.4-mini',
        strong_model: 'gpt-5.5',
        base_url: '',
        missing: ['provider'],
        ready: false,
        mock_allowed: false,
        message: 'AI provider is not configured.'
      })
    });
  });
  await page.route('**/api/llm/config', async (route) => {
    configRequests.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        configured: true,
        provider: 'openai_responses',
        cheap_model: 'restore-dialogue-model',
        strong_model: 'restore-strong-model',
        base_url: 'https://api.openai.com/v1/responses',
        missing: [],
        ready: true,
        mock_allowed: false,
        message: 'AI connected.'
      })
    });
  });

  await page.goto('/ai-simulator');

  await expect(page.getByRole('heading', { name: 'Vitals' })).toBeVisible();
  await expect(page.getByTestId('ai-status-message')).toContainText('Connected: openai_responses / restore-dialogue-model');
  await expect(page.getByTestId('ai-local-key-status')).toContainText('API key saved locally');
  await expect(page.getByTestId('chat-input')).toBeEnabled();
  expect(configRequests).toEqual([
    {
      provider: 'openai_responses',
      api_key: 'sk-local-restore-test',
      cheap_model: 'restore-dialogue-model',
      strong_model: 'restore-strong-model'
    }
  ]);
});

test('successful AI connection saves provider settings locally', async ({ page }) => {
  await page.route('**/api/llm/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        configured: false,
        provider: 'unconfigured',
        cheap_model: 'gpt-5.4-mini',
        strong_model: 'gpt-5.5',
        base_url: '',
        missing: ['provider'],
        ready: false,
        mock_allowed: false,
        message: 'AI provider is not configured.'
      })
    });
  });
  await page.route('**/api/llm/config', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        configured: true,
        provider: 'openai_responses',
        cheap_model: 'manual-dialogue-model',
        strong_model: 'manual-strong-model',
        base_url: 'https://api.openai.com/v1/responses',
        missing: [],
        ready: true,
        mock_allowed: false,
        message: 'AI connected.'
      })
    });
  });

  await page.goto('/ai-simulator');
  await expect(page.getByRole('heading', { name: 'Vitals' })).toBeVisible();
  await page.getByTestId('ai-api-key').fill('sk-local-save-test');
  await page.getByTestId('ai-cheap-model').fill('manual-dialogue-model');
  await page.getByTestId('ai-strong-model').fill('manual-strong-model');
  await page.getByTestId('ai-connect').click();

  await expect(page.getByTestId('ai-status-message')).toContainText('Connected: openai_responses / manual-dialogue-model');
  await expect(page.getByTestId('ai-local-key-status')).toContainText('API key saved locally');
  const saved = await page.evaluate((storageKey) => JSON.parse(window.localStorage.getItem(storageKey) || '{}'), AI_CONFIG_STORAGE_KEY);
  expect(saved).toMatchObject({
    version: 1,
    provider: 'openai_responses',
    apiKey: 'sk-local-save-test',
    baseUrl: '',
    cheapModel: 'manual-dialogue-model',
    strongModel: 'manual-strong-model'
  });
});

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
  await expect(page.getByTestId('case-release-status')).toHaveText('Feedback locked');
  await expect(page.getByTestId('ai-status-message')).toContainText('Connected: mock');
  await expect(page.getByText('Backend unavailable')).toHaveCount(0);
  await expect(page.getByTestId('vitals-monitor-closed')).toBeVisible();
  await expect(page.getByTestId('vitals-monitor')).toHaveCount(0);
  await page.getByTestId('open-vitals-monitor').click();
  await expect(page.locator('aside').first()).toContainText('SpO2');
  await expect(page.locator('aside').first()).toContainText('90');
  await expect(page.getByTestId('vitals-monitor')).toContainText('Hypoxia present');
  await expect(page.getByTestId('vitals-monitor')).toContainText('measured');
  const firstEcgTrace = await page.getByTestId('waveform-hr').getAttribute('points');
  const firstSpo2Trace = await page.getByTestId('waveform-spo2').getAttribute('points');
  const firstHrValue = await page.getByTestId('monitor-value-hr').textContent();
  await page.waitForTimeout(500);
  await expect(page.getByTestId('waveform-hr')).not.toHaveAttribute('points', firstEcgTrace || '');
  await expect(page.getByTestId('waveform-spo2')).not.toHaveAttribute('points', firstSpo2Trace || '');
  await page.waitForTimeout(1600);
  await expect(page.getByTestId('monitor-value-hr')).not.toHaveText(firstHrValue || '');
  await page.getByTestId('collapse-vitals-monitor').click();
  await expect(page.getByTestId('vitals-monitor')).toHaveCount(0);
  await page.getByTestId('open-vitals-monitor').click();
  await expect(page.getByTestId('complete-case')).toBeDisabled();

  await page.getByTestId('chat-input').fill('Order CBC and troponin');
  await page.getByTestId('chat-send').click();
  await expect(page.getByText(/Use the order panel/)).toBeVisible();

  await page.getByTestId('quick-oxygen').click();
  await expect(page.locator('aside').first()).toContainText('94');
  await expect(page.getByTestId('vitals-monitor')).toContainText('SpO2 90 -> 94');
  await expect(page.getByText(/O2 started/)).toBeVisible();
  await page.getByTestId('quick-iv_fluids').click();
  await expect(page.getByText(/IV crystalloid bolus started/)).toBeVisible();

  await page.getByRole('button', { name: /D-dimer/ }).click();
  await expect(page.getByTestId('active-orders')).toContainText('D-dimer');
  for (let index = 0; index < 3; index += 1) {
    await expect(page.getByTestId('advance-15')).toBeEnabled();
    await page.getByTestId('advance-15').click();
  }
  await expect(page.getByText(/D-dimer resulted/)).toBeVisible();
  await expect(page.getByTestId('active-orders')).toContainText('2.8');
  await expect(page.getByTestId('result-detail')).toContainText('D-dimer');
  await expect(page.getByTestId('resulted-orders')).toContainText('2.8');

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
  await expect(page.getByTestId('action-feedback')).toContainText('Action Review');
  await expect(page.getByTestId('feedback-omissions')).toBeVisible();
  await expect(page.getByTestId('feedback-timing')).toBeVisible();
  await expect(page.getByTestId('feedback-interventions')).toBeVisible();
  await expect(page.getByTestId('feedback-positives')).toBeVisible();
  await expect(page.getByTestId('timed-action-log')).toContainText('Supplemental oxygen');
  await expect(page.getByTestId('completeness-gaps')).toContainText('No omissions recorded.');
  await expect(page.getByTestId('usage-log')).toContainText('grader_feedback');
  await expect(page.getByTestId('usage-log')).toContainText('strong');
  expect(consoleProblems).toEqual([]);
});

test('restricted abdominal case keeps CT ECG and lab results visible in the result viewer', async ({ page }) => {
  test.skip(process.env.ED_SIM_CASE_DIR !== 'data/cases', 'requires local prepared restricted cases');

  await page.goto('/ai-simulator?case_id=restricted_mietic_validate_public_039');

  await expect(page.getByText('79M abdominal pain, abdominal distention')).toBeVisible();
  await expect(page.getByTestId('result-detail')).toContainText('Order a lab, ECG, or imaging study');

  await page.getByRole('button', { name: 'Imaging' }).click();
  await expect(page.getByTestId('order-search-results')).toContainText('CT abdomen/pelvis with contrast');
  await page.getByRole('button', { name: 'Medications' }).click();
  await expect(page.getByTestId('order-search-results')).toContainText('Broad-spectrum antibiotics');
  await page.getByRole('button', { name: 'All', exact: true }).click();

  await page.getByTestId('order-search').fill('ct abdomen');
  await page.getByTestId('order-search-results').getByRole('button', { name: /CT abdomen\/pelvis with contrast/ }).click();
  await expect(page.getByTestId('result-detail')).toContainText('CT abdomen/pelvis with contrast');
  await expect(page.getByTestId('result-detail')).toContainText('Result pending');
  await page.getByTestId('order-search').fill('ecg');
  await page.getByTestId('order-search-results').getByRole('button', { name: /12-lead ECG/ }).click();
  await expect(page.getByTestId('result-detail')).toContainText('12-lead ECG');
  await expect(page.getByTestId('result-detail')).toContainText('Result pending');
  await expect(page.getByTestId('open-result-viewer')).toHaveCount(0);
  await page.getByTestId('order-search').fill('lipase');
  await page.getByTestId('order-search-results').getByRole('button', { name: /Lipase/ }).click();
  await page.getByTestId('order-search').fill('chest x');
  await page.getByTestId('order-search-results').getByRole('button', { name: /Chest X-ray/ }).click();

  for (let index = 0; index < 5; index += 1) {
    await page.getByTestId('advance-15').click();
  }

  await expect(page.getByTestId('active-orders')).toContainText('CT abdomen/pelvis with contrast');
  await expect(page.getByTestId('active-orders')).toContainText('12-lead ECG');
  await expect(page.getByTestId('active-orders')).toContainText('Lipase');
  await expect(page.getByTestId('active-orders')).toContainText('Chest X-ray');
  await expect(page.getByTestId('active-orders')).toContainText('ECG tracing');
  await expect(page.getByTestId('active-orders')).not.toContainText('Simulator default result');
  await expect(page.getByTestId('active-orders')).toContainText('34 IU/L');

  await page.getByTestId('active-orders').getByRole('button', { name: /CT abdomen\/pelvis with contrast/ }).click();
  await expect(page.getByTestId('result-detail')).toContainText('sigmoid volvulus');
  await expect(page.getByTestId('resulted-orders')).toContainText('large bowel obstruction');
  await page.getByTestId('open-result-viewer').click();
  await expect(page.getByTestId('result-viewer-modal')).toContainText('Source Provenance');
  await expect(page.getByTestId('result-viewer-modal')).toContainText('13987701-RR-69');
  await page.getByRole('button', { name: 'Done' }).click();

  await page.getByTestId('active-orders').getByRole('button', { name: /12-lead ECG/ }).click();
  await expect(page.getByTestId('result-detail')).toContainText('ECG tracing');
  await expect(page.getByTestId('default-ecg-tracing')).toBeVisible();
  await expect(page.getByTestId('result-detail')).not.toContainText('Default ECG');
  await expect(page.getByTestId('result-detail')).not.toContainText('Normal sinus rhythm');
  await expect(page.getByTestId('result-detail')).not.toContainText('ST-segment changes');
  await expect(page.getByTestId('result-detail')).not.toContainText('Simulator default result');
  await page.getByTestId('open-result-viewer').click();
  await expect(page.getByTestId('result-viewer-modal')).toContainText('ECG tracing');
  await expect(page.getByTestId('result-viewer-modal').getByTestId('default-ecg-tracing')).toBeVisible();
  await expect(page.getByTestId('result-viewer-modal')).not.toContainText('Normal sinus rhythm');
  await page.getByRole('button', { name: 'Done' }).click();

  await page.getByTestId('active-orders').getByRole('button', { name: /Chest X-ray/ }).click();
  const chestReport = page.getByTestId('primary-result-card').getByTestId('result-report');
  await expect(chestReport).toContainText('Examination');
  await expect(chestReport).toContainText('Indication');
  await expect(chestReport).toContainText('Findings');
  await expect(chestReport).toContainText('Impression');
  await expect(chestReport).not.toContainText('EXAMINATION: CHEST (PA AND LAT) INDICATION:');
  await page.getByTestId('open-result-viewer').click();
  await expect(page.getByTestId('result-viewer-modal').getByTestId('result-report')).toContainText('Findings');
  await expect(page.getByTestId('result-viewer-modal').getByTestId('result-report')).toContainText('Impression');
  await page.getByRole('button', { name: 'Done' }).click();

  await page.getByTestId('active-orders').getByRole('button', { name: /Lipase/ }).click();
  await expect(page.getByTestId('result-detail')).toContainText('34');
  await expect(page.getByTestId('result-detail')).toContainText('IU/L');
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

test('blocked grader validation does not fetch or show hidden package truth', async ({ page }) => {
  let packageRequests = 0;
  await page.route('**/api/sessions/*/package', async (route) => {
    packageRequests += 1;
    await route.continue();
  });
  await page.route('**/api/sessions/*/grade', async (route) => {
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({
        detail: 'Grader feedback is unavailable because this case has not passed clinician validation.'
      })
    });
  });

  await page.goto('/ai-simulator');

  await expect(page.getByRole('heading', { name: 'Vitals' })).toBeVisible();
  await page.getByTestId('soap-assessment').fill('High-risk cardiopulmonary process.');
  await page.getByTestId('soap-plan').fill('Disposition decision documented without validated feedback.');
  await page.getByTestId('commit-soap').click();
  await expect(page.getByTestId('complete-case')).toBeEnabled();
  await page.getByTestId('complete-case').click();

  await expect(page.getByRole('heading', { name: 'Debrief Locked' })).toBeVisible();
  await expect(page.getByTestId('debrief-validation-locked')).toContainText('has not passed clinician validation');
  await expect(page.getByText('Ground Truth')).toHaveCount(0);
  await expect(page.getByText('pulmonary embolism')).toHaveCount(0);
  await page.waitForTimeout(250);
  expect(packageRequests).toBe(0);
});
