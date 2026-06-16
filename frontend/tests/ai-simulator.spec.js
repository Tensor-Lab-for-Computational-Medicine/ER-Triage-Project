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

test('sim clock advances in real time and can be paused', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });

  await page.goto('/ai-simulator');

  await expect(page.getByRole('heading', { name: 'Vitals' })).toBeVisible();
  await expect(page.getByTestId('sim-clock-display')).toHaveText('00:00:00');

  await page.clock.fastForward(5000);
  await expect(page.getByTestId('sim-clock-display')).toHaveText('00:00:05');

  await page.getByTestId('sim-clock-toggle').click();
  await expect(page.getByTestId('sim-clock-toggle')).toHaveAttribute('aria-pressed', 'true');
  await page.clock.fastForward(10000);
  await expect(page.getByTestId('sim-clock-display')).toHaveText('00:00:05');

  await page.getByTestId('sim-clock-toggle').click();
  await expect(page.getByTestId('sim-clock-toggle')).toHaveAttribute('aria-pressed', 'false');
  await page.clock.fastForward(5000);
  await expect(page.getByTestId('sim-clock-display')).toHaveText('00:00:10');
});

test('patient visual panel uses metadata and falls back when an image is missing', async ({ page }) => {
  await page.route('**/api/sessions', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.snapshot.visible_start.visual = {
      kind: 'synthetic_image',
      src: '/patient-media/missing-test-image.webp',
      alt: 'Synthetic patient visual for fallback test.',
      prompt_summary: 'Visible-start-only fallback test prompt.',
      clinical_cues: ['middle-aged', 'female-presenting', 'increased work of breathing'],
      provenance: 'Generated from deidentified learner-visible triage fields only.',
      review_status: 'local_privacy_self_check_passed'
    };
    await route.fulfill({ response, json: body });
  });

  await page.goto('/ai-simulator');

  await expect(page.getByTestId('patient-visual-panel')).toBeVisible();
  await expect(page.getByTestId('patient-visual-fallback')).toBeVisible();
  await expect(page.getByTestId('patient-visual-panel')).not.toContainText('Fallback');
  await expect(page.getByTestId('patient-visual-panel')).not.toContainText('increased work of breathing');
  await expect(page.getByTestId('patient-visual-panel')).not.toContainText('Synthetic');
});

test('patient visual is a static image without visible metadata tags', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/sessions', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.snapshot.visible_start.visual = {
      kind: 'synthetic_image',
      src: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
      alt: 'Synthetic patient visual for reduced motion test.',
      prompt_summary: 'Visible-start-only reduced motion test prompt.',
      clinical_cues: ['middle-aged', 'female-presenting', 'increased work of breathing'],
      provenance: 'Generated from deidentified learner-visible triage fields only.',
      review_status: 'local_privacy_self_check_passed'
    };
    await route.fulfill({ response, json: body });
  });

  await page.goto('/ai-simulator');
  await expect(page.getByTestId('patient-visual-image')).toBeVisible();
  await expect(page.getByTestId('patient-visual-panel')).not.toContainText('Synthetic');
  await expect(page.getByTestId('patient-visual-panel')).not.toContainText('increased work of breathing');
  await expect(page.getByTestId('patient-visual-panel')).not.toContainText('Reviewed');
  const visualStyles = await page.getByTestId('patient-visual-frame').evaluate((element) => {
    const image = element.querySelector('[data-testid="patient-visual-image"]');
    return {
      image: image ? window.getComputedStyle(image).animationName : '',
      transform: image ? window.getComputedStyle(image).transform : '',
      frameText: element.textContent
    };
  });

  expect(visualStyles).toEqual({ image: 'none', transform: 'none', frameText: '' });
});

test('AI simulator layout stays within common viewport widths', async ({ page }) => {
  const viewports = [
    { width: 390, height: 844 },
    { width: 768, height: 900 },
    { width: 1068, height: 807 },
    { width: 1440, height: 900 },
    { width: 1600, height: 900 }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto(`/ai-simulator?responsive=${viewport.width}`);

    await expect(page.getByRole('heading', { name: 'Vitals' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Conversation' })).toBeVisible();
    await page.getByTestId('open-vitals-monitor').click();
    await expect(page.getByTestId('vitals-monitor')).toBeVisible();

    const metrics = await page.evaluate(() => {
      const viewportWidth = document.documentElement.clientWidth;
      const bodyScrollWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
      const monitor = document.querySelector('[data-testid="vitals-monitor"]');
      const monitorRect = monitor?.getBoundingClientRect();
      const trackedElements = Array.from(document.querySelectorAll('main, header, aside, section, form, [data-testid="vitals-monitor"], [data-testid="result-detail"]'));
      const offscreenElements = trackedElements
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            tag: element.tagName.toLowerCase(),
            testId: element.getAttribute('data-testid') || '',
            left: Math.floor(rect.left),
            right: Math.ceil(rect.right),
            width: Math.ceil(rect.width)
          };
        })
        .filter((item) => item.width > 0 && (item.left < -1 || item.right > viewportWidth + 1));

      return {
        viewportWidth,
        bodyScrollWidth,
        monitorLeft: monitorRect ? Math.floor(monitorRect.left) : null,
        monitorRight: monitorRect ? Math.ceil(monitorRect.right) : null,
        offscreenElements
      };
    });

    expect(metrics.bodyScrollWidth, `document overflow at ${viewport.width}px`).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.monitorLeft, `monitor left edge at ${viewport.width}px`).toBeGreaterThanOrEqual(0);
    expect(metrics.monitorRight, `monitor right edge at ${viewport.width}px`).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.offscreenElements, `offscreen elements at ${viewport.width}px`).toEqual([]);
  }
});

test('exam workspace and conversation toolbar controls are interactive', async ({ page }) => {
  await page.goto('/ai-simulator');

  await expect(page.getByRole('heading', { name: 'Conversation' })).toBeVisible();
  await page.getByTestId('structured-tab-exam').click();
  await expect(page.getByRole('heading', { name: 'Physical Exam' })).toBeVisible();
  await expect(page.getByTestId('exam-findings-list')).toContainText('Choose a physical exam maneuver');

  await page.getByTestId('exam-search').fill('abdomen');
  await page.getByTestId('exam-search-results').getByRole('button', { name: /Abdominal distention inspection/ }).click();
  await expect(page.getByTestId('exam-findings-list')).toContainText('Abdominal distention inspection');
  await page.getByTestId('exam-search').fill('murphy');
  await page.getByTestId('exam-search-results').getByRole('button', { name: 'Murphy sign' }).click();
  await expect(page.getByTestId('exam-findings-list')).toContainText('Murphy sign assessed with right upper quadrant palpation during inspiration');
  await expect(page.getByTestId('exam-findings-list')).not.toContainText('source record');
  await expect(page.getByTestId('exam-findings-list')).not.toContainText('source-recorded');
  await page.getByTestId('exam-search').fill('skin temperature');
  await page.getByTestId('exam-search-results').getByRole('button', { name: 'Skin temperature' }).click();
  await expect(page.getByTestId('exam-findings-list')).toContainText('Skin palpated over forehead and distal extremities');
  await expect(page.getByTestId('exam-findings-list')).not.toContainText('Not assessed / no abnormality documented');

  await page.getByTestId('add-note-action').click();
  await expect(page.getByTestId('note-composer')).toBeVisible();
  await page.getByTestId('note-composer').locator('textarea').fill('Objective note: abdomen examined.');
  await page.getByRole('button', { name: 'Save Note' }).click();
  await expect(page.getByText('Objective note: abdomen examined.')).toBeVisible();

  await page.getByTestId('call-consult-action').click();
  await expect(page.getByTestId('consult-menu')).toBeVisible();
  await page.getByTestId('consult-menu').getByRole('button', { name: 'surgery' }).click();
  await expect(page.getByText('Call surgery consult.')).toBeVisible();

  await page.getByTestId('more-actions').click();
  await expect(page.getByTestId('more-actions-menu')).toBeVisible();
  await page.getByRole('button', { name: 'Nurse status' }).click();
  await expect(page.getByText('Nurse, please reassess the patient')).toBeVisible();
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
