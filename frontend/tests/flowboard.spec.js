import { expect, test } from '@playwright/test';

const OPEN_EVIDENCE_URL = 'https://www.openevidence.com/';

async function expectNoPageLevelHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => {
    const root = document.querySelector('.flowboard-app');
    return Math.max(0, (root?.scrollWidth || document.documentElement.scrollWidth) - window.innerWidth);
  });
  expect(overflow).toBeLessThanOrEqual(1);
}

async function currentCaseTitle(page) {
  return page.locator('.case-title-block span').textContent();
}

function parseRequestPayload(request) {
  const body = request.postDataJSON();
  const userMessage = body?.messages?.find((message) => message.role === 'user');
  const responseInput = Array.isArray(body?.input)
    ? body.input.find((message) => message.role === 'user')
    : null;
  const responseContent = Array.isArray(responseInput?.content)
    ? responseInput.content.find((part) => part?.type === 'input_text')?.text
    : responseInput?.content;
  const userContent = userMessage?.content || responseContent || '{}';
  try {
    return JSON.parse(userContent);
  } catch {
    return {};
  }
}

function mockedActionArtifact(payload) {
  const actionId = payload?.learner_context?.actionId || '';
  const actionLabel = payload?.learner_context?.actionLabel || 'Selected action';
  const common = {
    action_id: actionId,
    action_label: actionLabel,
    source_basis: 'AI-generated formative simulation'
  };

  if (actionId === 'ecg') {
    return {
      ...common,
      title: 'ECG interpretation',
      summary: 'ECG shows sinus rhythm without STEMI; nonspecific ST-T changes keep ACS on the table.',
      items: ['Rate about 90, regular rhythm.', 'No diagnostic ST-elevation pattern.', 'Repeat ECG if pain changes.'],
      management_implication: 'Keep telemetry and serial troponin/ECG reassessment active.'
    };
  }
  if (actionId === 'bloodwork_labs' || actionId === 'vascular_access') {
    return {
      ...common,
      title: 'CBC/CMP and priority labs',
      summary: 'Initial labs are pending, with CBC/CMP and cardiac markers prioritized for anemia, electrolyte, renal, and ACS risk.',
      items: ['CBC/CMP are ordered with stat processing.', 'Troponin trend will matter more than a single early value.'],
      management_implication: 'Critical anemia, renal failure, potassium abnormality, or troponin elevation should change level of care.'
    };
  }
  if (actionId === 'ct_with_contrast') {
    return {
      ...common,
      title: 'CT with contrast',
      summary: 'CT protocol is selected to evaluate high-risk chest or abdominal pathology when bedside risk justifies contrast imaging.',
      items: ['Confirm renal risk and contrast allergy before transport.', 'Do not let CT delay stabilization or ECG/lab review.'],
      management_implication: 'A positive study should trigger targeted consult and higher-acuity monitoring.'
    };
  }
  if (actionId === 'analgesia' || actionId === 'pain_reassessment') {
    return {
      ...common,
      title: 'Analgesia response',
      summary: 'Analgesia is started and pain is reassessed without masking the need to monitor respiratory and perfusion status.',
      items: ['Pain reassessment is scheduled.', 'Persistent severe pain remains a risk signal.'],
      management_implication: 'Escalate if pain remains severe, changes character, or new instability appears.'
    };
  }
  if (actionId === 'consult_surgery') {
    return {
      ...common,
      title: 'Surgery consult callback',
      summary: 'Surgery asks for the focused exam, imaging/lab trigger, NPO status, and whether the patient is becoming unstable.',
      items: ['They will see the patient urgently if imaging or exam supports a surgical source.', 'They recommend reassessment after critical results return.'],
      management_implication: 'Use the consult to clarify urgency, not as a substitute for ED stabilization.'
    };
  }
  if (actionId === 'airway_oxygenation_support') {
    return {
      ...common,
      title: 'Respiratory support response',
      summary: 'Respiratory support improves comfort while the team watches work of breathing and oxygenation trend.',
      items: ['Positioning and supplemental oxygen are adjusted to symptoms.', 'Escalate if work of breathing increases.'],
      management_implication: 'Failure to improve should move the patient toward higher acuity care.'
    };
  }
  if (actionId === 'monitored_bed') {
    return {
      ...common,
      title: 'Continuous monitoring',
      summary: 'The patient is placed on cardiac and pulse-ox monitoring with repeat vitals queued.',
      items: ['Nursing can trend pain, respiratory effort, and perfusion.', 'Telemetry helps catch rhythm changes during workup.'],
      management_implication: 'Monitoring is appropriate while ruling out time-sensitive cardiopulmonary causes.'
    };
  }

  return {
    ...common,
    title: actionLabel,
    summary: `${actionLabel} is completed and creates a visible consequence for the case clock and debrief.`,
    items: ['The action is recorded in the learner log.', 'The result should be integrated into the next decision.'],
    management_implication: 'Use this response to decide whether the current level of care remains safe.'
  };
}

async function installMockAi(page, options = {}) {
  const mockHandler = async (route, request) => {
    if (options.requests) {
      options.requests.push({ url: request.url(), body: request.postDataJSON() });
    }
    const payload = parseRequestPayload(request);
    let content;

    if (payload?.kind === 'connection_test') {
      if (options.authConnection) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'Incorrect API key provided.', code: 401 } })
        });
        return;
      }
      content = { ok: true };
    } else if (payload?.learner_question) {
      if (options.authPatient) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'User not found.', code: 401 } })
        });
        return;
      }
      if (options.failPatient) {
        await route.fulfill({
          status: 500,
          contentType: 'text/plain',
          body: 'mock patient AI failure'
        });
        return;
      }
      const question = String(payload.learner_question || '').toLowerCase();
      content = question.includes('how are you answering')
        ? {
            answer: "I'm sitting here trying to answer what I can, but I feel unwell and a little short of breath.",
            addressed_intents: ['irrelevant'],
            used_fields: ['patient_view'],
            uncertainty_used: false
          }
        : {
            answer: 'The chest discomfort and breathing trouble started about three days ago and feel worse when I move around.',
            addressed_intents: ['timeline', 'chief_concern'],
            used_fields: ['patient_view'],
            uncertainty_used: false
          };
    } else if (payload?.kind === 'nursing_update') {
      content = {
        title: 'Nursing update',
        summary: 'Vitals trend is similar but pain remains significant; treatment response is partial and the patient still needs close reassessment.',
        items: [
          'Vitals trend: heart rate and respiratory rate need another timed check.',
          'Treatment response: comfort improved a little after analgesia, but symptoms are not resolved.',
          'Pending/critical results: ECG/labs and any CT result should be reviewed before lowering acuity.',
          'Bedside concern: persistent chest or breathing symptoms could require escalation.'
        ],
        management_implication: 'Reassess within 15 minutes or sooner if pain, oxygenation, perfusion, or mental status worsens.',
        source_basis: 'AI-generated formative simulation'
      };
    } else if (payload?.kind === 'action_result') {
      if (options.failActions) {
        await route.fulfill({
          status: 500,
          contentType: 'text/plain',
          body: 'mock action AI failure'
        });
        return;
      }
      content = mockedActionArtifact(payload);
    } else {
      content = {
        title: 'Flowboard artifact',
        summary: 'Mocked formative simulation response.',
        items: ['Mocked response for test.'],
        source_basis: 'AI-generated formative simulation'
      };
    }

    const responseBody = request.url().includes('api.openai.com/v1/responses')
      ? {
          id: 'resp_flowboard_mock',
          object: 'response',
          output_text: JSON.stringify(content),
          output: [
            {
              type: 'message',
              role: 'assistant',
              content: [{ type: 'output_text', text: JSON.stringify(content) }]
            }
          ]
        }
      : { choices: [{ message: { content: JSON.stringify(content) } }] };

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(responseBody)
    });
  };
  await page.route('https://openrouter.ai/**', mockHandler);
  await page.route('https://api.openai.com/**', mockHandler);
}

async function startLockedFlowboard(page) {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto('/');
}

async function startUnlockedFlowboard(page, options = {}) {
  await installMockAi(page, options);
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.addInitScript(({ provider }) => {
    const openAi = provider === 'openai';
    localStorage.setItem('ed_triage_openrouter_key', openAi ? 'sk-proj-flowboard-openai-test' : 'sk-or-v1-flowboard-test');
    localStorage.setItem('ed_triage_openrouter_model', openAi ? 'openrouter/free' : 'openrouter/free');
    localStorage.setItem('ed_triage_openrouter_patient_model', 'openrouter/auto');
  }, { provider: options.provider || 'openrouter' });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Arrival Decision' })).toBeVisible();
}

async function completeArrival(page, { imperfect = false } = {}) {
  for (const name of [
    'Airway, voice, and secretions',
    'Work of breathing and oxygenation',
    'Pulses, skin, bleeding, and perfusion',
    'Mental status and focal deficit screen'
  ]) {
    await page.getByRole('button', { name }).click();
  }

  await page.getByRole('button', { name: imperfect ? 'Waiting area' : 'Monitored bed', exact: true }).click();
  await page.getByRole('button', { name: imperfect ? 'ESI 5' : 'ESI 2' }).click();
  await page.getByRole('button', { name: 'Cardiac monitor + repeat vitals' }).click();
  await page.getByRole('button', { name: 'Immediate ECG' }).click();
  await expect(page.getByText('Cardiac monitor and pulse oximeter applied')).toBeVisible();
  await expect(page.getByText('Sinus rhythm around')).toBeVisible();
  await expect(page.getByText('ST elevation')).toHaveCount(0);
  await expect(page.getByText('should increase acuity')).toHaveCount(0);
  await expect(page.getByText('trigger urgent clinician review')).toHaveCount(0);
  await expect(page.getByText('escalate', { exact: false })).toHaveCount(0);
  await expect(page.getByText('AI failed')).toHaveCount(0);
  await expect(page.getByLabel('Checkpoint status')).toContainText('Ready to continue');
  await page.getByRole('button', { name: 'Continue to History/exam' }).click();
}

async function completeHistoryExam(page) {
  await page.getByLabel('Ask the patient').fill('When did the symptoms start and what makes them worse?');
  await page.getByRole('button', { name: 'Ask patient' }).click();
  await expect(page.getByLabel('Patient chat log')).toContainText('three days ago');
  await page.getByRole('button', { name: 'Respiratory / Chest' }).click();
  await expect(page.getByLabel('Focused exam findings')).toContainText('Respiratory / Chest');
  await page.getByRole('button', { name: 'Continue to Orders' }).click();
}

async function completeOrders(page) {
  await page.getByRole('button', { name: 'CBC/CMP and priority labs' }).click();
  await page.getByRole('button', { name: 'ECG' }).click();
  await page.getByRole('button', { name: 'CT with contrast' }).click();
  await page.getByRole('button', { name: 'Analgesia' }).click();
  await page.getByRole('button', { name: 'Surgery consult' }).click();
  await page.getByLabel('Which result would change level of care?').fill('A STEMI, rising troponin, major CT finding, respiratory decline, or uncontrolled pain would move the patient to higher acuity and trigger targeted consult action.');

  const cards = page.getByLabel('Action result cards');
  await expect(cards).toContainText('CBC/CMP and priority labs');
  await expect(cards).toContainText('ECG interpretation');
  await expect(cards).toContainText('CT with contrast');
  await expect(cards).toContainText('Analgesia response');
  await expect(cards).toContainText('Surgery consult callback');
  await expect(cards).toContainText('should change level of care');
  await expect(cards).not.toContainText('source lab event');
  await expect(cards).not.toContainText('procedure event');
  await page.getByRole('button', { name: 'Continue to Differential' }).click();
}

async function addDifferential(page, diagnosis, rationale) {
  await page.getByLabel('Add diagnosis').fill(diagnosis);
  await page.getByRole('button', { name: 'Add' }).click();
  const row = page.getByLabel('Ranked differential list').locator('article').last();
  await row.getByLabel('Why this belongs here / what would move it up or down?').fill(rationale);
}

async function completeDifferential(page) {
  await addDifferential(page, 'Acute coronary syndrome', 'Chest pain and risk factors make this dangerous; normal or nonspecific early data would move it down.');
  await addDifferential(page, 'Pneumonia or COPD exacerbation', 'Dyspnea, cough, and respiratory symptoms fit; normal oxygenation or clear cardiac evidence would move it down.');
  await page.getByRole('button', { name: 'Move up' }).last().click();
  await page.getByRole('button', { name: 'Commit differential and compare to case DDx' }).click();
  await expect(page.getByRole('heading', { name: 'Case DDx comparison' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue to Reassess' }).click();
}

async function completeReassessment(page) {
  await page.getByRole('button', { name: 'Request nursing update' }).click();
  const update = page.getByLabel('Nursing update');
  await expect(update).toContainText('Vitals trend');
  await expect(update).toContainText('Treatment response');
  await expect(update).toContainText('Pending/critical results');
  await expect(update).toContainText('Bedside concern');
  await page.getByRole('button', { name: 'Increase monitoring or bed acuity' }).click();
  await page.getByLabel('What management changes if this update is concerning?').fill('Move to a monitored bed, repeat vitals on a timer, and notify the clinician if respiratory or perfusion status worsens.');
  await page.getByRole('button', { name: 'Continue to SOAP' }).click();
}

async function completeSoap(page) {
  await page.getByRole('button', { name: 'Insert vitals' }).click();
  await page.getByRole('button', { name: 'Insert exam findings' }).click();
  await page.getByRole('button', { name: 'Insert results' }).click();
  await page.getByRole('button', { name: 'Insert results' }).click();

  await page.getByLabel('One-liner').fill('Adult ED patient with chest pain and dyspnea requiring monitored evaluation.');
  await page.getByLabel('HPI story').fill('Symptoms evolved over several days with respiratory and chest-pain features that need ED rule-out.');
  await page.getByRole('button', { name: 'Insert PMH/meds/allergies context' }).click();
  await expect(page.getByLabel('Objective findings')).toContainText('Vitals:');
  await page.getByLabel('Assessment and problem list').fill('Problem list: chest pain, dyspnea, possible pulmonary or cardiac cause, and need for monitored reassessment.');
  await page.getByRole('button', { name: 'Insert problem context' }).click();
  await page.getByLabel('Plan by problem').fill('Chest pain: ECG and labs. Dyspnea: focused respiratory treatment and reassessment. Disposition: monitor until unsafe causes are addressed.');
  await page.getByRole('button', { name: 'Insert selected treatments' }).click();
  await page.getByRole('button', { name: 'Insert selected treatments' }).click();
  await page.getByRole('button', { name: 'Insert nursing update' }).click();
  await page.getByRole('button', { name: 'Insert nursing update' }).click();
  await expect(page.getByLabel('Reassessment rationale')).toContainText('Move to a monitored bed');

  const objective = await page.getByLabel('Objective findings').inputValue();
  const hpi = await page.getByLabel('HPI story').inputValue();
  const assessment = await page.getByLabel('Assessment and problem list').inputValue();
  const plan = await page.getByLabel('Plan by problem').inputValue();
  expect((objective.match(/Results:/g) || []).length).toBe(1);
  expect((plan.match(/Selected treatments:/g) || []).length).toBe(1);
  expect((plan.match(/Nursing update:/g) || []).length).toBe(1);
  expect(plan).toContain('Cardiac monitor + repeat vitals');
  expect(plan).toContain('Chest pain: ECG and labs');
  expect(plan).not.toContain('monitored_bed');
  expect(hpi).toContain('Symptoms evolved over several days');
  expect((assessment.match(/Problem context:/g) || []).length).toBe(1);

  await page.getByRole('button', { name: 'Finalize SOAP note' }).click();
  await expect(page.getByRole('button', { name: 'SOAP finalized' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue to Learn' }).click();
}

test('no API key shows the Flowboard AI gate and blocks play', async ({ page }) => {
  await startLockedFlowboard(page);

  await expect(page.getByRole('heading', { name: 'AI key required for Flowboard' })).toBeVisible();
  await expect(page.getByLabel('Flowboard AI key required')).toContainText('portray the patient');
  await expect(page.getByRole('button', { name: 'Save key and start Flowboard' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Arrival Decision' })).toHaveCount(0);
});

test('saving an API key unlocks Flowboard', async ({ page }) => {
  await installMockAi(page);
  await startLockedFlowboard(page);

  await page.getByLabel('API key').fill('sk-or-v1-flowboard-test');
  await page.getByRole('button', { name: 'Save key and start Flowboard' }).click();
  await expect(page.getByRole('heading', { name: 'Arrival Decision' })).toBeVisible();
  await expect(page.getByLabel('AI status')).toContainText('AI on');
});

test('saving a rejected OpenAI key stays gated with provider-specific feedback', async ({ page }) => {
  await installMockAi(page, { authConnection: true });
  await startLockedFlowboard(page);

  await page.getByLabel('API key').fill('sk-proj-flowboard-openai-test');
  await page.getByRole('button', { name: 'Save key and start Flowboard' }).click();
  await expect(page.getByRole('alert')).toContainText('OpenAI rejected the saved API key (401)');
  await expect(page.getByRole('heading', { name: 'Arrival Decision' })).toHaveCount(0);
});

test('loads sequential arrival training without old answer leakage', async ({ page }) => {
  await startUnlockedFlowboard(page);
  await page.setViewportSize({ width: 1440, height: 1024 });

  await expect(page.getByRole('heading', { name: 'Arrival source data' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Immediate bedside checks' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Airway, voice, and secretions' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Work of breathing and oxygenation' })).toBeDisabled();
  await expect(page.getByText('Visible bedside scan')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'ABCDE response' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'First-minute priorities' })).toHaveCount(0);
  await expect(page.getByText('This is a priority decision, not a checklist.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Oxygen or bronchodilator if indicated' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Cardiac monitor + repeat vitals' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Airway, voice, and secretions' }).click();
  await page.getByRole('button', { name: 'Work of breathing and oxygenation' }).click();
  await page.getByRole('button', { name: 'Pulses, skin, bleeding, and perfusion' }).click();
  await expect(page.getByRole('button', { name: 'Oxygen or bronchodilator if indicated' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cardiac monitor + repeat vitals' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Immediate ECG' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bedside glucose' })).toHaveCount(0);
  await expect(page.getByText('based on the bedside scan')).toHaveCount(0);
  await expect(page.getByText('Ask attending for bedside evaluation')).toHaveCount(0);
  await expect(page.getByText('Expose enough to identify source or injury')).toHaveCount(0);
  await expect(page.getByText('Expose the chest')).toHaveCount(0);
  await expect(page.getByText('Clinical record')).toHaveCount(0);
  await expect(page.getByText('Call senior help')).toHaveCount(0);
  await expect(page.getByText('Team ownership')).toHaveCount(0);
  await expect(page.getByText('Escalation trigger')).toHaveCount(0);
  await expect(page.getByText('What changed your risk estimate?')).toHaveCount(0);
  await expect(page.getByText('Result that changes action')).toHaveCount(0);
  await expect(page.getByText('Focused exam should')).toHaveCount(0);
  await expect(page.getByLabel('Checkpoint status')).toContainText('Finish this screen to continue');
  await expectNoPageLevelHorizontalOverflow(page);
});

test('arrival can continue without a detached action section', async ({ page }) => {
  await startUnlockedFlowboard(page);
  await page.setViewportSize({ width: 1440, height: 1024 });

  for (const name of [
    'Airway, voice, and secretions',
    'Work of breathing and oxygenation',
    'Pulses, skin, bleeding, and perfusion',
    'Mental status and focal deficit screen'
  ]) {
    await page.getByRole('button', { name }).click();
  }
  await expect(page.getByRole('heading', { name: 'First-minute priorities' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Monitored bed', exact: true }).click();
  await page.getByRole('button', { name: 'ESI 2' }).click();
  await expect(page.getByLabel('Checkpoint status')).toContainText('Ready to continue');
  await page.getByRole('button', { name: 'Continue to History/exam' }).click();
  await expect(page.getByRole('heading', { name: 'Focused History + Exam' })).toBeVisible();
});

test('next case starts a different session and clears learner state', async ({ page }) => {
  await startUnlockedFlowboard(page);
  await page.setViewportSize({ width: 1440, height: 1024 });
  const firstTitle = await currentCaseTitle(page);

  await page.getByRole('button', { name: 'Airway, voice, and secretions' }).click();
  await page.getByRole('button', { name: 'Monitored bed', exact: true }).click();
  await page.getByRole('button', { name: 'Next case' }).click();

  await expect.poll(async () => currentCaseTitle(page)).not.toBe(firstTitle);
  await expect(page.getByRole('button', { name: 'Airway, voice, and secretions' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Continue to History/exam' })).toBeDisabled();
});

test('restart case clears state but keeps the same case', async ({ page }) => {
  await startUnlockedFlowboard(page);
  await page.setViewportSize({ width: 1440, height: 1024 });
  const title = await currentCaseTitle(page);

  await page.getByRole('button', { name: 'Airway, voice, and secretions' }).click();
  await page.getByRole('button', { name: 'Monitored bed', exact: true }).click();
  await page.getByRole('button', { name: 'Restart case' }).click();

  await expect.poll(async () => currentCaseTitle(page)).toBe(title);
  await expect(page.getByRole('button', { name: 'Airway, voice, and secretions' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Continue to History/exam' })).toBeDisabled();
});

test('arrival advances after visible controls even when action AI is unavailable', async ({ page }) => {
  await startUnlockedFlowboard(page, { failActions: true });
  await page.setViewportSize({ width: 1440, height: 1024 });

  await completeArrival(page, { imperfect: true });
  await expect(page.getByRole('heading', { name: 'Focused History + Exam' })).toBeVisible();
});

test('patient chat uses mocked AI and handles meta questions without repeating generic symptoms', async ({ page }) => {
  await startUnlockedFlowboard(page);
  await page.setViewportSize({ width: 1440, height: 1024 });

  await completeArrival(page);
  await page.getByLabel('Ask the patient').fill('How are you answering my questions right now?');
  await page.getByRole('button', { name: 'Ask patient' }).click();
  const chat = page.getByLabel('Patient chat log');
  await expect(chat).toContainText("I'm sitting here trying to answer");
  await expect(chat).not.toContainText('COPD, diabetes, cirrhosis');
});

test('patient chat uses OpenAI Responses API and current mini model when an OpenAI key is saved', async ({ page }) => {
  const requests = [];
  await startUnlockedFlowboard(page, { provider: 'openai', requests });
  await page.setViewportSize({ width: 1440, height: 1024 });

  await completeArrival(page);
  await page.getByLabel('Ask the patient').fill('Hello?');
  await page.getByRole('button', { name: 'Ask patient' }).click();
  await expect(page.getByLabel('Patient chat log')).toContainText('The chest discomfort');

  const patientRequest = requests.find((entry) =>
    entry.url.includes('api.openai.com/v1/responses') &&
    entry.body?.input?.some((message) => {
      const content = Array.isArray(message.content)
        ? message.content.map((part) => part?.text || '').join('\n')
        : String(message.content || '');
      return content.includes('learner_question');
    })
  );
  expect(patientRequest).toBeTruthy();
  expect(patientRequest.body.model).toBe('gpt-5.4-mini');
  expect(patientRequest.body.text.format.type).toBe('json_object');
  expect(patientRequest.body.model).not.toBe('openrouter/auto');
  expect(patientRequest.body.model).not.toBe('gpt-4o-mini');
});

test('patient chat labels deterministic fallback only after saved-key AI failure', async ({ page }) => {
  await startUnlockedFlowboard(page, { failPatient: true });
  await page.setViewportSize({ width: 1440, height: 1024 });

  await completeArrival(page);
  await page.getByLabel('Ask the patient').fill('When did the symptoms start?');
  await page.getByRole('button', { name: 'Ask patient' }).click();
  const chat = page.getByLabel('Patient chat log');
  await expect(chat).toContainText('Patient:');
  await expect(chat).toContainText('Case-based response');
  await expect(chat).not.toContainText('mock patient AI failure');
  await expect(chat).not.toContainText('{"error"');
});

test('patient chat blocks rejected API keys without raw provider JSON', async ({ page }) => {
  await startUnlockedFlowboard(page, { authPatient: true });
  await page.setViewportSize({ width: 1440, height: 1024 });

  await completeArrival(page);
  await page.getByLabel('Ask the patient').fill('When did the symptoms start?');
  await page.getByRole('button', { name: 'Ask patient' }).click();
  await expect(page.getByRole('alert')).toContainText('rejected the saved API key');
  await expect(page.getByLabel('Patient chat log')).not.toContainText('Fallback response');
  await expect(page.getByLabel('Patient chat log')).not.toContainText('User not found');
  await expect(page.getByRole('alert')).not.toContainText('User not found');
});

test('focused exam reveals findings and allows at most three systems', async ({ page }) => {
  await startUnlockedFlowboard(page);
  await page.setViewportSize({ width: 1440, height: 1024 });

  await completeArrival(page);
  await page.getByRole('button', { name: 'General / Airway' }).click();
  await page.getByRole('button', { name: 'Respiratory / Chest' }).click();
  await page.getByRole('button', { name: 'Neuro / Mental Status' }).click();
  await expect(page.getByLabel('Focused exam findings')).toContainText('Respiratory / Chest');
  await expect(page.getByLabel('Focused exam findings')).toContainText('Neuro / Mental Status');
  await expect(page.getByLabel('Focused exam findings')).toContainText('focal motor deficit');
  await expect(page.getByLabel('Focused exam findings')).not.toContainText('Focused neurologic screen shows');
  await expect(page.getByLabel('Focused exam findings')).not.toContainText('Reviewed teaching inference');
  await expect(page.getByRole('button', { name: 'Cardiovascular / Perfusion' })).toBeDisabled();
  await expect(page.getByText('Focused exam should')).toHaveCount(0);
});

test('full redesigned flow reaches Learn with concise OpenEvidence question', async ({ page }) => {
  await startUnlockedFlowboard(page);
  await page.setViewportSize({ width: 1440, height: 1024 });

  await completeArrival(page);
  await completeHistoryExam(page);
  await completeOrders(page);
  await completeDifferential(page);
  await completeReassessment(page);
  await completeSoap(page);

  await expect(page.getByRole('heading', { name: 'Learn' })).toBeVisible();
  await expect(page.getByLabel('Deterministic scoring')).toContainText('Deterministic score');
  await expect(page.getByLabel('OpenEvidence question')).toContainText('evidence-based approach');
  await expect(page.getByLabel('OpenEvidence question')).not.toContainText('learner_actions');
  await expect(page.getByLabel('OpenEvidence question')).not.toContainText('case_truth');
  await expect(page.getByLabel('OpenEvidence question')).not.toContainText('ranked_differential');
  await expect(page.getByLabel('OpenEvidence question')).not.toContainText('{');
  await expect(page.locator('.debrief-actions').getByRole('button', { name: 'Copy OpenEvidence question' })).toBeVisible();
  await expect(page.locator('.debrief-actions').getByRole('button', { name: 'Open OpenEvidence' })).toBeVisible();
  await expect(page.locator('.debrief-actions a[href="' + OPEN_EVIDENCE_URL + '"]')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'ABCDE response' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'First-minute priorities' })).toHaveCount(0);
});

test('keeps the redesigned flow readable on mobile', async ({ page }) => {
  await startUnlockedFlowboard(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await expect(page.getByRole('heading', { name: 'Arrival Decision' })).toBeVisible();
  await expect(page.getByLabel('Simulation stages')).toBeVisible();
  await expect(page.getByText('Clinical record')).toHaveCount(0);
  await expectNoPageLevelHorizontalOverflow(page);
});
