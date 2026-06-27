import { expect, test } from '@playwright/test';
import JSZip from 'jszip';

async function makeCaseBundleFile() {
  const zip = new JSZip();
  zip.file('prepared_case.json', JSON.stringify(sampleCase()));
  zip.file('order_catalog.json', JSON.stringify(orderCatalog()));
  zip.file('exam_catalog.json', JSON.stringify(examCatalog()));
  const buffer = Buffer.from(await zip.generateAsync({ type: 'uint8array' }));
  return { name: 'sample-abdomen.case-bundle.zip', mimeType: 'application/zip', buffer };
}

async function makeCaseBundleWithoutCatalogs() {
  const zip = new JSZip();
  zip.file('prepared_case.json', JSON.stringify(sampleCase()));
  const buffer = Buffer.from(await zip.generateAsync({ type: 'uint8array' }));
  return { name: 'sample-abdomen-minimal.case-bundle.zip', mimeType: 'application/zip', buffer };
}

async function loadBundle(page) {
  await page.goto('/ai-simulator');
  await expect(page.getByText('Load a case bundle', { exact: true })).toBeVisible();
  await page.getByTestId('case-bundle-file').setInputFiles([await makeCaseBundleFile()]);
  await expect(page.getByRole('heading', { name: 'Vitals' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible();
  await expect(page.getByText('79M severe abdominal pain')).toBeVisible();
}

test('static app starts at the bundle loader without a backend', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/ai-simulator$/);
  await expect(page.getByText('Load a case bundle', { exact: true })).toBeVisible();
  await expect(page.getByTestId('case-bundle-status')).toHaveText('No bundle loaded');
  await expect(page.getByText('Backend unavailable')).toHaveCount(0);
});

test('case bundle loads when catalog files are omitted', async ({ page }) => {
  await page.goto('/ai-simulator');
  await expect(page.getByText('Load a case bundle', { exact: true })).toBeVisible();
  await page.getByTestId('case-bundle-file').setInputFiles([await makeCaseBundleWithoutCatalogs()]);
  await expect(page.getByRole('heading', { name: 'Vitals' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible();

  await page.getByTestId('quick-iv_access').click();
  await expect(page.getByText('IV access established.')).toBeVisible();

  await page.getByTestId('structured-tab-exam').click();
  await page.getByTestId('exam-search').fill('distention');
  await page.getByText('Abdominal distention inspection').click();
  await expect(page.getByTestId('exam-findings-list')).toContainText('visibly distended');

  await page.getByTestId('structured-tab-orders').click();
  await page.getByTestId('order-search').fill('ct abdomen');
  await page.getByText('CT abdomen/pelvis with contrast').click();
  await page.getByTestId('advance-15').click();
  await page.getByTestId('advance-15').click();
  await page.getByTestId('advance-15').click();
  await expect(page.getByTestId('resulted-orders')).toContainText('sigmoid volvulus');
});

test('case bundle runs locally from triage to debrief', async ({ page }) => {
  const consoleProblems = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleProblems.push(message.text());
  });
  page.on('pageerror', (error) => consoleProblems.push(error.message));

  await loadBundle(page);

  await expect(page.getByTestId('ai-status-message')).toContainText('Local authored responses active');
  await page.getByTestId('chat-input').fill('When did the pain start?');
  await page.getByTestId('chat-send').click();
  await expect(page.getByText('It started this morning')).toBeVisible();
  await page.getByTestId('chat-input').fill('What happened?');
  await page.getByTestId('chat-send').click();
  await expect(page.getByText('getting worse in waves')).toBeVisible();
  await expect(page.getByTestId('chat-input')).toBeVisible();
  const composerBox = await page.getByTestId('chat-composer').boundingBox();
  expect(composerBox?.height).toBeLessThan(90);

  await page.getByTestId('quick-cardiac_monitor').click();
  await page.getByTestId('quick-iv_access').click();
  await page.getByTestId('quick-analgesia').click();

  await page.getByTestId('structured-tab-exam').click();
  await page.getByTestId('exam-search').fill('distention');
  await page.getByText('Abdominal distention inspection').click();
  await expect(page.getByTestId('exam-findings-list')).toContainText('visibly distended');

  await page.getByTestId('structured-tab-orders').click();
  await page.getByTestId('order-search').fill('ct abdomen');
  await page.getByText('CT abdomen/pelvis with contrast').click();
  await page.getByTestId('advance-15').click();
  await expect(page.getByTestId('resulted-orders')).toContainText('sigmoid volvulus');

  await page.getByTestId('esi-level-2').click();
  await page.getByTestId('commit-esi').click();
  await page.getByTestId('differential-input').fill('sigmoid volvulus\nlarge bowel obstruction');
  await page.getByTestId('commit-differential').click();
  await page.getByTestId('soap-assessment').fill('Sigmoid volvulus causing large bowel obstruction.');
  await page.getByTestId('soap-plan').fill('NPO, IV access, analgesia, surgery/GI consult, urgent decompression, admit.');
  await page.getByTestId('commit-soap').click();
  await expect(page.getByTestId('complete-case')).toBeEnabled();
  await page.getByTestId('complete-case').click();

  await expect(page.getByRole('heading', { name: 'Debrief' })).toBeVisible();
  await expect(page.getByTestId('debrief-summary-band')).toContainText('sigmoid volvulus');
  await expect(page.getByText('["')).toHaveCount(0);
  await expect(page.getByTestId('copy-open-evidence-prompt')).toBeVisible();
  await page.getByTestId('debrief-tab-missed').click();
  await expect(page.getByTestId('review-group-reinforce')).toContainText('Reinforced strengths');
  await page.getByTestId('debrief-tab-prompt').click();
  await expect(page.getByTestId('evidence-prompt-preview')).toContainText('Source note digest');
  await expect(page.getByTestId('open-evidence-prompt')).toContainText('sigmoid volvulus');
  await expect(page.getByTestId('open-evidence-prompt')).toContainText('Missed workup: none');
  await expect(page.getByTestId('open-evidence-prompt')).toContainText('Physician discharge-summary digest');
  await page.getByTestId('debrief-tab-source').click();
  await expect(page.getByTestId('source-enrichment-debrief')).toContainText('Physician discharge summary');
  await expect(page.getByTestId('source-enrichment-debrief')).toContainText('Home medications');
  expect(consoleProblems).toEqual([]);
});

test('BYOK mode sends dialogue directly from the browser and keeps local fallback available', async ({ page }) => {
  const providerRequests = [];
  await page.route('https://api.openai.com/v1/responses', async (route) => {
    providerRequests.push({
      authorization: route.request().headers().authorization,
      body: route.request().postDataJSON()
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ output_text: 'The pain started this morning and comes in waves.' })
    });
  });

  await loadBundle(page);
  await page.getByTestId('settings-button').click();
  await expect(page.getByTestId('settings-ai-cheap-model')).toHaveValue('gpt-5.4-mini');
  await expect(page.getByTestId('settings-ai-strong-model')).toHaveValue('gpt-5.5');
  await page.getByTestId('settings-ai-api-key').fill('local-test-key');
  await page.getByTestId('settings-ai-connect').click();
  await expect(page.getByTestId('settings-ai-status-message')).toContainText('OpenAI');
  await page.getByTestId('settings-close').click();
  await expect(page.getByTestId('ai-status-message')).toContainText('BYOK: OpenAI');

  await page.getByTestId('chat-input').fill('When did the pain start?');
  await page.getByTestId('chat-send').click();
  await expect(page.getByText('comes in waves')).toBeVisible();
  expect(providerRequests).toHaveLength(1);
  expect(providerRequests[0].authorization).toBe('Bearer local-test-key');
  expect(providerRequests[0].body.model).toBe('gpt-5.4-mini');
});

test('BYOK settings expose provider-specific model dropdowns', async ({ page }) => {
  await page.route('https://openrouter.ai/api/v1/models', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'anthropic/claude-test',
            name: 'Claude Test',
            architecture: { output_modalities: ['text'] }
          },
          {
            id: 'image-only/model',
            name: 'Image Only Model',
            architecture: { output_modalities: ['image'] }
          },
          {
            id: 'openai/gpt-5.5',
            name: 'OpenAI: GPT-5.5',
            architecture: { output_modalities: ['text'] }
          }
        ]
      })
    });
  });

  await loadBundle(page);
  await page.getByTestId('settings-button').click();

  const dialogueModel = page.getByTestId('settings-ai-cheap-model');
  const strongModel = page.getByTestId('settings-ai-strong-model');
  await expect(dialogueModel).toHaveValue('gpt-5.4-mini');
  await expect(strongModel).toHaveValue('gpt-5.5');
  await dialogueModel.selectOption('gpt-5.4');
  await expect(dialogueModel).toHaveValue('gpt-5.4');

  await page.getByTestId('settings-ai-provider').selectOption('deepseek');
  await expect(dialogueModel).toHaveValue('deepseek-v4-flash');
  await expect(strongModel).toHaveValue('deepseek-v4-pro');
  await expect(dialogueModel.locator('option[value="deepseek-v4-pro"]')).toHaveText('DeepSeek V4 Pro (deepseek-v4-pro)');

  await page.getByTestId('settings-ai-provider').selectOption('openrouter');
  await expect(page.getByTestId('settings-ai-model-status')).toContainText('OpenRouter');
  await expect(dialogueModel).toHaveValue('openai/gpt-5.4-mini');
  await expect(dialogueModel.locator('option[value="anthropic/claude-test"]')).toHaveText('Claude Test (anthropic/claude-test)');
  await expect(dialogueModel.locator('option[value="image-only/model"]')).toHaveCount(0);
  await dialogueModel.selectOption('anthropic/claude-test');
  await expect(dialogueModel).toHaveValue('anthropic/claude-test');
});

function sampleCase() {
  return {
    case_id: 'sample_static_abdomen_001',
    title: '79M severe abdominal pain',
    visible_start: {
      chief_complaint: 'Abdominal pain and distention',
      demographics: { age: 79, sex: 'M' },
      triage_context: 'Older adult with severe crampy abdominal pain, distention, nausea, and inability to pass stool.',
      appearance: 'Uncomfortable, clutching abdomen, visibly distended.',
      presenting_vitals: { temp_c: 36.8, hr: 104, sbp: 138, dbp: 82, rr: 20, spo2: 98, pain: 10 }
    },
    trajectory: {
      starting_vitals: { temp_c: 36.8, hr: 104, sbp: 138, dbp: 82, rr: 20, spo2: 98, pain: 10 },
      rules: [
        { vital: 'pain', condition: { present_intervention: 'analgesia', above: 4 }, delta_per_minute: -0.3, floor: 4 },
        { vital: 'hr', condition: { absent_intervention: 'analgesia', below: 125 }, delta_per_minute: 0.05, ceiling: 125 }
      ]
    },
    hpi_facts: [
      {
        id: 'pain_onset',
        topic: 'Pain onset',
        triggers: ['when', 'start', 'onset', 'pain'],
        lay_response: 'It started this morning and has been getting worse in waves.'
      },
      {
        id: 'anticoagulation',
        topic: 'Medication history',
        triggers: ['blood thinner', 'medication', 'eliquis'],
        lay_response: 'I take Eliquis for atrial fibrillation.'
      }
    ],
    exam_facts: [
      {
        maneuver_id: 'abdomen_inspection_distention',
        finding: 'Abdomen inspected from bedside: visibly distended and tympanitic.',
        source: 'authored-test-case'
      }
    ],
    result_bundles: {
      ct_abdomen_pelvis_contrast: {
        order_id: 'ct_abdomen_pelvis_contrast',
        display_name: 'CT abdomen/pelvis with contrast',
        resulted_at_min: 15,
        values: [],
        narrative: 'CT shows sigmoid volvulus with large bowel obstruction and no free air.',
        source: 'authored-test-case',
        source_reference: { modality: 'CT' }
      },
      cbc: {
        order_id: 'cbc',
        display_name: 'CBC',
        resulted_at_min: 10,
        values: [{ name: 'WBC', value: '12.4', unit: 'K/uL', flag: 'high', reference_range: '4.0-10.0' }],
        narrative: 'Mild leukocytosis.',
        source: 'authored-test-case'
      }
    },
    rubric: {
      expected_diagnoses: ['sigmoid volvulus', 'large bowel obstruction'],
      expected_orders: ['ct_abdomen_pelvis_contrast'],
      indicated_exams: [{ id: 'abdomen_inspection_distention', label: 'Abdominal distention inspection', why: 'Distention is a key source-backed finding.' }],
      indicated_interventions: [
        { id: 'cardiac_monitor', label: 'Cardiac monitoring' },
        { id: 'iv_access', label: 'IV access' },
        { id: 'analgesia', label: 'Analgesia' }
      ],
      critical_actions: ['cardiac_monitor', 'iv_access', 'analgesia'],
      excessive_interventions: [],
      esi_tolerance: 0
    },
    hidden_truth: {
      final_diagnosis: 'sigmoid volvulus',
      validated_esi: 2,
      actual_disposition: 'admission for urgent decompression and surgical/GI management',
      clinician_key_points: ['Recognize high-risk acute abdomen.', 'Order definitive abdominal imaging early.']
    },
    review_status: {
      trajectory_clinician_signed_off: true,
      playthrough_clinician_signed_off: true
    },
    source_enrichment: {
      home_medications: [
        { name: 'Eliquis', dose: '5 mg', route: 'PO', frequency: 'twice daily', visibility: 'debrief' }
      ],
      ed_medications: [
        { name: 'Hydromorphone', elapsed_min: 5, visibility: 'debrief' }
      ],
      source_vitals: [],
      note_digests: [
        { note_type: 'Discharge summary', summary: 'Hospital course included decompression and discharge planning.', visibility: 'debrief' }
      ]
    }
  };
}

function orderCatalog() {
  return [
    { id: 'cardiac_monitor', type: 'procedure', name: 'Cardiac monitoring', aliases: ['monitor'], result_delay_min: 0 },
    { id: 'oxygen', type: 'intervention', name: 'Supplemental oxygen', aliases: ['o2'], result_delay_min: 0 },
    { id: 'iv_access', type: 'procedure', name: 'IV access', aliases: ['intravenous'], result_delay_min: 0 },
    { id: 'iv_fluids', type: 'medication', name: 'IV crystalloid bolus', aliases: ['fluids'], result_delay_min: 0 },
    { id: 'analgesia', type: 'medication', name: 'Analgesia', aliases: ['pain medicine'], result_delay_min: 0 },
    { id: 'cbc', type: 'lab', name: 'CBC', aliases: ['complete blood count'], result_delay_min: 10 },
    { id: 'ct_abdomen_pelvis_contrast', type: 'imaging', name: 'CT abdomen/pelvis with contrast', aliases: ['ct abdomen', 'ct a/p'], result_delay_min: 15 }
  ];
}

function examCatalog() {
  return [
    {
      id: 'abdomen_inspection_distention',
      region: 'abdomen',
      maneuver_type: 'inspection',
      name: 'Abdominal distention inspection',
      aliases: ['distention', 'distended abdomen']
    },
    {
      id: 'abdomen_palpation_light',
      region: 'abdomen',
      maneuver_type: 'palpation',
      name: 'Light abdominal palpation',
      aliases: ['tenderness']
    }
  ];
}
