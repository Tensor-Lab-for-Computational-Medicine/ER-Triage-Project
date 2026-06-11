import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST_PATH = join(ROOT, 'frontend', 'dist');
const DIST_INDEX_PATH = join(DIST_PATH, 'index.html');
const DIST_FALLBACK_PATH = join(DIST_PATH, '404.html');
const FRONTEND_PACKAGE_PATH = join(ROOT, 'frontend', 'package.json');
const JSON_OUTPUT_PATH = join(ROOT, 'docs', 'feedback_integrity_runtime_report.json');
const MD_OUTPUT_PATH = join(ROOT, 'docs', 'feedback_integrity_runtime_report.md');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg'
};

function assertDistReady() {
  if (!existsSync(DIST_INDEX_PATH)) {
    throw new Error('frontend/dist/index.html is missing. Run npm run build before feedback integrity runtime probes.');
  }
  if (!existsSync(DIST_FALLBACK_PATH)) {
    throw new Error('frontend/dist/404.html is missing. Run npm run build to create the SPA fallback.');
  }
}

function resolveStaticFile(requestUrl) {
  const url = new URL(requestUrl, 'http://127.0.0.1');
  const pathname = decodeURIComponent(url.pathname);
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const candidate = normalize(join(DIST_PATH, relativePath));
  if (candidate.startsWith(DIST_PATH) && existsSync(candidate) && statSync(candidate).isFile()) {
    return { path: candidate, status: 200 };
  }
  return { path: DIST_INDEX_PATH, status: 200 };
}

function serveDist(request, response) {
  const result = resolveStaticFile(request.url || '/');
  const ext = extname(result.path).toLowerCase();
  response.writeHead(result.status, {
    'Content-Type': CONTENT_TYPES[ext] || 'application/octet-stream',
    'Cache-Control': 'no-store'
  });
  response.end(readFileSync(result.path));
}

function listen(server) {
  return new Promise((resolveListen, rejectListen) => {
    server.on('error', rejectListen);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolveListen(`http://127.0.0.1:${address.port}`);
    });
  });
}

function closeServer(server) {
  return new Promise((resolveClose) => server.close(resolveClose));
}

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeText(value = '') {
  return cleanText(value).toLowerCase();
}

async function count(locator) {
  return locator.count().catch(() => 0);
}

async function waitVisible(locator, label, timeout = 10_000) {
  if (!(await count(locator))) throw new Error(`Missing locator for ${label}.`);
  await locator.first().waitFor({ state: 'visible', timeout });
}

async function click(locator, label) {
  await waitVisible(locator, label);
  await locator.first().click();
}

async function fill(locator, value, label) {
  await waitVisible(locator, label);
  await locator.first().fill(value);
}

async function clickIfVisible(locator, label) {
  if (await count(locator)) {
    await locator.first().click().catch((error) => {
      throw new Error(`Could not click ${label}: ${error.message}`);
    });
    return true;
  }
  return false;
}

async function setCoachDisabled(page) {
  const tools = page.locator('.tools-menu');
  if (await count(tools)) {
    const isOpen = await tools.first().evaluate((node) => node.hasAttribute('open')).catch(() => false);
    if (!isOpen) await click(page.locator('.tools-menu > summary'), 'tools menu');
    const coach = page.getByRole('switch', { name: 'Coach' });
    if ((await count(coach)) && await coach.first().isChecked()) {
      await click(page.locator('.coach-toggle'), 'coach toggle');
    }
    const openNow = await tools.first().evaluate((node) => node.hasAttribute('open')).catch(() => false);
    if (openNow) await click(page.locator('.tools-menu > summary'), 'close tools menu');
  }
}

async function conductObjectiveReview(page) {
  await click(page.getByRole('tab', { name: /Examine data/ }), 'examine data tab');
  await waitVisible(page.locator('.objective-review-panel'), 'objective review panel');
  await waitVisible(page.getByLabel('Choose focused exams'), 'focused exam chooser');
  await click(page.getByRole('button', { name: 'General / Airway' }), 'general airway exam');
  const caseSummary = normalizeText(await page.getByLabel('Case summary').innerText().catch(() => ''));
  const extraSystems = [];
  if (/chest|cardiac|syncope|blood pressure/.test(caseSummary)) extraSystems.push('Cardiovascular / Perfusion');
  if (/shortness|breath|cough|oxygen|pneumonia/.test(caseSummary)) extraSystems.push('Respiratory / Chest');
  if (/altered|confusion|seizure|stroke|headache|weakness|numb/.test(caseSummary)) extraSystems.push('Neuro / Mental Status');
  if (/abd|belly|stomach|rectal|pelvic/.test(caseSummary)) extraSystems.push('Abdomen / GI');
  if (/fracture|wrist|foot|ankle|leg|finger|fall/.test(caseSummary)) extraSystems.push('MSK / Extremity');
  if (/laceration|wound|suture|infection|fever|gangrene|cellulitis/.test(caseSummary)) extraSystems.push('Skin / Wound');
  for (const system of extraSystems.slice(0, 2)) {
    await clickIfVisible(page.getByRole('button', { name: system }), `optional ${system} exam`);
  }
  await click(page.getByRole('button', { name: 'Conduct selected exam' }), 'conduct selected exam');
  await waitVisible(page.getByLabel('Focused exam findings'), 'focused exam findings');
}

async function completeLegacyWorkflow(page, baseUrl) {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('ed_triage_learner_profile_v1', JSON.stringify({
      version: 'learner_profile_v1',
      cases_completed: 1,
      interview_gaps: {},
      esi_error_direction: { under_triage: 0, over_triage: 0, matched: 0 },
      missed_escalation_categories: {},
      weak_sbar_sections: {},
      updated_at: '2026-06-09T00:00:00.000Z'
    }));
    Math.random = () => 0.42;
  });
  await page.goto(`${baseUrl}/?legacy=1`, { waitUntil: 'networkidle' });
  await waitVisible(page.getByRole('heading', { name: 'Focused triage interview' }), 'focused triage interview');
  await setCoachDisabled(page);

  const questions = [
    'What brought you to the emergency department today?',
    'When did this start and has it been getting worse?',
    'Are you having trouble breathing, chest pain, fainting, weakness, confusion, bleeding, or severe distress right now?',
    'What medical problems, medicines, allergies, pregnancy status, or similar prior episodes should I know about?',
    'What medicines or blood thinners do you take every day?',
    'How bad is your pain or discomfort right now?'
  ];
  for (const [index, question] of questions.entries()) {
    await fill(page.getByLabel('Question to patient'), question, `interview question ${index + 1}`);
    await click(page.getByRole('button', { name: 'Ask patient' }), `ask patient ${index + 1}`);
    await waitVisible(page.getByText(`Question ${index + 1}`), `question ${index + 1} log`);
  }

  await conductObjectiveReview(page);
  await click(page.getByRole('button', { name: 'Continue to impression' }), 'continue to impression');
  await waitVisible(page.getByRole('heading', { name: 'Acuity and Diagnosis' }), 'acuity and diagnosis');
  await click(page.getByRole('button', { name: /ESI 3/ }), 'ESI 3');
  await fill(page.getByLabel('ESI Rationale'), 'Final ESI 3 based on vital signs, complaint risk, and expected ED resources.', 'ESI rationale');
  await fill(page.getByLabel('Working Diagnosis'), 'Undifferentiated ED presentation', 'working diagnosis');
  await fill(page.getByLabel('Differential'), 'Serious time-sensitive diagnosis\nBenign self-limited cause', 'differential');
  await fill(page.getByLabel('Diagnosis Evidence'), 'The working diagnosis is based on the presenting complaint, vital signs, focused history, and exam findings.', 'diagnosis evidence');
  await click(page.getByRole('button', { name: 'Continue to plan' }), 'continue to plan');

  await waitVisible(page.getByRole('heading', { name: 'Priority Actions and Consults' }), 'priority actions');
  await fill(page.getByLabel('Management Rationale'), 'Initial priorities are based on acuity, vital signs, and immediate safety needs.', 'management rationale');
  await fill(page.getByLabel('Diagnostic Tests'), 'Order case-directed diagnostic testing based on the working diagnosis and ESI level.', 'diagnostic tests');
  await fill(page.getByLabel('Immediate Treatments'), 'Treat immediate symptoms, monitor for deterioration, and escalate if reassessment changes.', 'treatments');
  await fill(page.getByLabel('Medication Considerations'), 'Review allergies, contraindications, and medication route needs before treatment.', 'medications');
  await fill(page.getByLabel('Disposition Intent'), 'Disposition depends on reassessment, test results, and clinical stability.', 'disposition');
  await fill(page.getByLabel('Priority Sequence'), 'Immediate stabilization comes before diagnostics that can wait.', 'priority sequence');
  await fill(page.locator('#plan-other'), 'No other case-specific action.', 'other plan');
  await click(page.getByRole('button', { name: 'No immediate consult' }), 'no immediate consult');
  await fill(page.getByLabel('Consult Rationale'), 'No immediate specialty input is needed unless the patient worsens or initial evaluation identifies a procedural need.', 'consult rationale');
  await click(page.getByRole('button', { name: 'Continue to reassessment' }), 'continue to reassessment');

  await waitVisible(page.getByRole('heading', { name: 'What-if Reassessment and Note' }), 'reassessment and note');
  await fill(page.getByLabel('Reassessment Rationale'), 'I would recheck vital signs and symptoms before routine waiting or disposition.', 'reassessment rationale');
  await click(page.getByLabel('Repeat abnormal vital signs'), 'repeat abnormal vital signs');
  await fill(page.locator('#soap-subjective'), 'Patient reports the presenting complaint with relevant associated symptoms and timing.', 'SOAP subjective');
  await fill(page.locator('#soap-objective'), 'Initial vitals, focused exam findings, and optional objective data requests are reviewed.', 'SOAP objective');
  await fill(page.locator('#soap-assessment'), 'Undifferentiated ED presentation with differential diagnoses based on history, vitals, and focused exam.', 'SOAP assessment');
  await fill(page.locator('#soap-plan'), 'Prioritize immediate safety actions, diagnostics, symptom treatment, reassessment, consults if needed, and disposition planning.', 'SOAP plan');
  await click(page.getByRole('button', { name: 'Continue to debrief' }), 'continue to debrief');
  await waitVisible(page.getByRole('heading', { name: 'Clinical Judgment Debrief' }), 'clinical judgment debrief');
}

async function collectRuntimeEvidence(page, openRouterCalls) {
  await clickIfVisible(page.locator('summary').filter({ hasText: 'Clinical Review' }), 'clinical review details');
  await clickIfVisible(page.locator('summary').filter({ hasText: 'Scoring & Validation' }), 'scoring validation details');
  await clickIfVisible(page.locator('summary').filter({ hasText: 'Complete Clinical Domain Scoring Ledger' }), 'score ledger details');

  const bodyText = await page.locator('body').innerText({ timeout: 10_000 });
  const diagnosisReview = await page.locator('.decision-review-card').filter({ hasText: 'Working Diagnosis Review' }).innerText().catch(() => '');
  const consultReview = await page.locator('.decision-review-card').filter({ hasText: 'Consult Judgment Review' }).innerText().catch(() => '');
  const scoreDomains = await page.locator('.score-domain').evaluateAll((nodes) => nodes.map((node) => node.innerText));
  const joinedScores = normalizeText(scoreDomains.join(' | '));

  const probes = [
    {
      id: 'no_ai_debrief_auto_request',
      status: openRouterCalls === 0 ? 'pass' : 'fail',
      evidence: { openrouter_calls_before_optional_ai: openRouterCalls }
    },
    {
      id: 'source_limited_diagnosis_runtime_label',
      status: /source-record diagnosis unavailable; formative reasoning review/i.test(diagnosisReview)
        && /formative reasoning structure review; excluded from numeric score/i.test(diagnosisReview)
        ? 'pass'
        : 'fail',
      evidence: { diagnosis_review: cleanText(diagnosisReview).slice(0, 300) }
    },
    {
      id: 'source_limited_consult_runtime_label',
      status: /clinician-approved consult reference unavailable; formative consult review/i.test(consultReview)
        && /unscored formative consult reasoning/i.test(consultReview)
        ? 'pass'
        : 'fail',
      evidence: { consult_review: cleanText(consultReview).slice(0, 300) }
    },
    {
      id: 'source_limited_domains_marked_formative',
      status: /formative only; excluded from numeric score until case truth is reviewed/i.test(bodyText)
        && /formative \d+ \/ \d+/.test(joinedScores)
        ? 'pass'
        : 'fail',
      evidence: {
        formative_label_present: /formative only; excluded from numeric score until case truth is reviewed/i.test(bodyText),
        formative_score_rows: scoreDomains.filter((row) => /formative \d+ \/ \d+/i.test(row)).slice(0, 5)
      }
    },
    {
      id: 'deterministic_score_ledger_present',
      status: /complete clinical domain scoring ledger/i.test(bodyText)
        && /objective safety reasoning/i.test(bodyText)
        && /reassessment targets/i.test(bodyText)
        ? 'pass'
        : 'fail',
      evidence: {
        score_domain_count: scoreDomains.length,
        score_domain_sample: scoreDomains.slice(0, 6)
      }
    },
    {
      id: 'optional_ai_draft_separate_surface',
      status: /ai debrief draft/i.test(bodyText)
        && /ai draft text is not used for scoring/i.test(bodyText)
        && !/ai-only draft/i.test(bodyText)
        ? 'pass'
        : 'fail',
      evidence: {
        ai_debrief_draft_label_present: /ai debrief draft/i.test(bodyText),
        ai_scoring_separation_label_present: /ai draft text is not used for scoring/i.test(bodyText),
        ai_only_draft_absent_before_optional_request: !/ai-only draft/i.test(bodyText)
      }
    },
    {
      id: 'source_limited_reassessment_runtime_label',
      status: /reassessment review/i.test(bodyText)
        && /reassessment/i.test(bodyText)
        && /formative only; excluded from numeric score until case truth is reviewed/i.test(bodyText)
        ? 'pass'
        : 'fail',
      evidence: {
        reassessment_review_present: /reassessment review/i.test(bodyText),
        source_limited_formative_label_present: /formative only; excluded from numeric score until case truth is reviewed/i.test(bodyText)
      }
    }
  ];

  return {
    body_text_sample: cleanText(bodyText).slice(0, 800),
    score_domains: scoreDomains,
    probes
  };
}

function markdown(report) {
  const lines = [
    '# Feedback Integrity Runtime Report',
    '',
    `Generated at: ${report.generated_at}`,
    '',
    report.warning,
    '',
    '## Summary',
    '',
    `- Probes passed: ${report.summary.passed_runtime_probes}/${report.summary.total_runtime_probes}`,
    `- OpenRouter calls before optional AI request: ${report.summary.openrouter_calls_before_optional_ai}`,
    `- Source-limited domains rendered formative-only: ${report.summary.source_limited_domains_rendered_formative_only}`,
    `- Optional AI draft kept separate: ${report.summary.optional_ai_draft_separate_surface}`,
    '',
    '## Probes',
    '',
    '| Probe | Status |',
    '|---|---|',
    ...report.probes.map((probe) => `| ${probe.id} | ${probe.status} |`)
  ];
  return `${lines.join('\n')}\n`;
}

assertDistReady();

const requireFromFrontend = createRequire(FRONTEND_PACKAGE_PATH);
const { chromium } = requireFromFrontend('@playwright/test');
const server = createServer(serveDist);
const baseUrl = await listen(server);
let browser;

try {
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  let openRouterCalls = 0;
  await page.route('https://openrouter.ai/**', (route) => {
    openRouterCalls += 1;
    route.abort();
  });
  await completeLegacyWorkflow(page, baseUrl);
  const evidence = await collectRuntimeEvidence(page, openRouterCalls);
  await context.close();

  const failedProbes = evidence.probes.filter((probe) => probe.status !== 'pass');
  const report = {
    schema_version: 'feedback_integrity_runtime_report_v1',
    generated_at: new Date().toISOString(),
    review_status: failedProbes.length
      ? 'feedback_integrity_runtime_failed'
      : 'feedback_integrity_runtime_passed_manual_review_required',
    warning: 'This runtime report exercises the production build in Chromium. It verifies deterministic feedback isolation and source-limited labels, but it does not replace clinician review of the feedback content.',
    route_contract: {
      exercised_route: '/?legacy=1',
      production_build_dist: 'frontend/dist',
      optional_ai_external_request_expected_before_button_click: false
    },
    summary: {
      total_runtime_probes: evidence.probes.length,
      passed_runtime_probes: evidence.probes.length - failedProbes.length,
      failed_runtime_probes: failedProbes.length,
      all_runtime_probes_passed: failedProbes.length === 0,
      openrouter_calls_before_optional_ai: openRouterCalls,
      source_limited_diagnosis_label_present:
        evidence.probes.find((probe) => probe.id === 'source_limited_diagnosis_runtime_label')?.status === 'pass',
      source_limited_consult_label_present:
        evidence.probes.find((probe) => probe.id === 'source_limited_consult_runtime_label')?.status === 'pass',
      source_limited_domains_rendered_formative_only:
        evidence.probes.find((probe) => probe.id === 'source_limited_domains_marked_formative')?.status === 'pass',
      deterministic_score_ledger_present:
        evidence.probes.find((probe) => probe.id === 'deterministic_score_ledger_present')?.status === 'pass',
      optional_ai_draft_separate_surface:
        evidence.probes.find((probe) => probe.id === 'optional_ai_draft_separate_surface')?.status === 'pass'
    },
    probes: evidence.probes,
    rendered_evidence: {
      body_text_sample: evidence.body_text_sample,
      score_domain_count: evidence.score_domains.length,
      score_domain_samples: evidence.score_domains.slice(0, 8)
    },
    next_actions: [
      'Keep optional AI debrief requests user-triggered and separate from deterministic scoring.',
      'Keep source-limited diagnosis, consult, and reassessment labels visible until case truth adjudication is complete.',
      'Repeat this runtime probe after any feedback UI, scoring, or AI draft workflow change.'
    ]
  };

  writeFileSync(JSON_OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(MD_OUTPUT_PATH, markdown(report), 'utf8');
  console.log(JSON.stringify({
    review_status: report.review_status,
    probes: `${report.summary.passed_runtime_probes}/${report.summary.total_runtime_probes}`,
    openrouter_calls_before_optional_ai: openRouterCalls,
    report_path: JSON_OUTPUT_PATH
  }, null, 2));

  if (failedProbes.length) {
    throw new Error(`Feedback integrity runtime probes failed: ${failedProbes.map((probe) => probe.id).join(', ')}`);
  }
} finally {
  if (browser) await browser.close();
  await closeServer(server);
}
