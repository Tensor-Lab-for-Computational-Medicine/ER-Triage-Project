import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FRONTEND_DIR = join(ROOT, 'frontend');
const REPORT_JSON = join(ROOT, 'reports', '100-case-workflow-smoke-2026-06-09.json');
const REPORT_MD = join(ROOT, 'reports', '100-case-workflow-smoke-2026-06-09.md');
const TARGET_CASES = 100;
const PORT = Number(process.env.SMOKE_100_PORT || 9360);
const BASE_URL = `http://127.0.0.1:${PORT}`;

const requireFromFrontend = createRequire(join(FRONTEND_DIR, 'package.json'));
const { chromium } = requireFromFrontend('@playwright/test');

function replaceNonFiniteJsonTokens(text) {
  const source = String(text || '');
  let output = '';
  let inString = false;
  let escaping = false;
  for (let index = 0; index < source.length;) {
    const char = source[index];
    if (inString) {
      output += char;
      if (escaping) escaping = false;
      else if (char === '\\') escaping = true;
      else if (char === '"') inString = false;
      index += 1;
      continue;
    }
    if (char === '"') {
      inString = true;
      output += char;
      index += 1;
      continue;
    }
    const rest = source.slice(index);
    if (rest.startsWith('-Infinity')) {
      output += 'null';
      index += '-Infinity'.length;
      continue;
    }
    if (rest.startsWith('Infinity')) {
      output += 'null';
      index += 'Infinity'.length;
      continue;
    }
    if (rest.startsWith('NaN')) {
      output += 'null';
      index += 'NaN'.length;
      continue;
    }
    output += char;
    index += 1;
  }
  return output;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readRestrictedBundle(relativePath) {
  const path = join(ROOT, relativePath);
  if (!existsSync(path)) throw new Error(`Missing restricted bundle: ${relativePath}`);
  const text = readFileSync(path, 'utf8');
  const parsed = JSON.parse(replaceNonFiniteJsonTokens(text));
  return {
    path: relativePath,
    text,
    count: Array.isArray(parsed) ? parsed.length : parsed.cases?.length || 0
  };
}

function npmExecutable() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function startDevServer() {
  const command = npmExecutable();
  const args = ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'];
  const output = [];
  const child = spawn(command, args, {
    cwd: FRONTEND_DIR,
    env: { ...process.env, BROWSER: 'none' },
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', (chunk) => output.push(String(chunk)));
  child.stderr.on('data', (chunk) => output.push(String(chunk)));
  child.on('exit', (code) => {
    if (code !== null && code !== 0) output.push(`\n[dev-server exited ${code}]\n`);
  });
  return { child, output };
}

async function waitForServer(output) {
  const started = Date.now();
  let lastError = '';
  while (Date.now() - started < 120_000) {
    try {
      const response = await fetch(BASE_URL);
      if (response.ok) return;
    } catch (error) {
      lastError = error.message || String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${BASE_URL}. Last error: ${lastError}\n${output.slice(-20).join('')}`);
}

async function loadCaseSource(page, source) {
  await page.evaluate(({ payload }) => {
    return import('/src/services/staticEngine.js').then((engine) => {
      engine.clearStaticLocalCaseBundle();
      if (payload) engine.loadStaticLocalCaseBundle(payload.text, payload.path);
      window.localStorage.setItem('ed_triage_learner_profile_v1', JSON.stringify({
        version: 'learner_profile_v1',
        cases_completed: 1,
        interview_gaps: {},
        esi_error_direction: { under_triage: 0, over_triage: 0, matched: 1 },
        missed_escalation_categories: {},
        weak_sbar_sections: {},
        updated_at: '2026-06-09T00:00:00.000Z'
      }));
    });
  }, { payload: source.payload || null });
}

async function runCaseAtIndex(page, index, count) {
  return page.evaluate(async ({ index: caseIndex, count: caseCount }) => {
    const engine = await import('/src/services/staticEngine.js');
    window.localStorage.setItem('ed_triage_learner_profile_v1', JSON.stringify({
      version: 'learner_profile_v1',
      cases_completed: 1,
      interview_gaps: {},
      esi_error_direction: { under_triage: 0, over_triage: 0, matched: 1 },
      missed_escalation_categories: {},
      weak_sbar_sections: {},
      updated_at: '2026-06-09T00:00:00.000Z'
    }));
    Math.random = () => (caseIndex + 0.01) / caseCount;
    const started = engine.startStaticSimulation();
    const sessionId = started.session_id;
    await engine.askStaticPatientQuestion(sessionId, 'What brought you to the emergency department today, and when did it start?');
    engine.assignStaticProvisionalTriage(sessionId, 3, 'Initial ESI estimate based on the presenting concern and immediate risk signals.');
    engine.recordStaticVitalsReview(sessionId);
    engine.recordStaticFocusedExam(sessionId, [
      'general_airway',
      'cardiovascular',
      'respiratory',
      'neuro',
      'abdomen_gi',
      'msk_extremity',
      'skin_wound'
    ]);
    engine.assignStaticTriage(sessionId, 3, 'Final ESI selected in this smoke workflow to exercise documented ESI reasoning and feedback generation.');
    const diagnosis = String(started.complaint || '').trim().length >= 3
      ? started.complaint
      : 'Undifferentiated ED concern';
    engine.recordStaticDiagnosis(
      sessionId,
      diagnosis,
      ['Time-sensitive alternative diagnosis', 'Lower-risk alternative diagnosis'],
      'The working diagnosis is grounded in the chief concern, triage history, vital signs, focused exam targets, and available retrospective context.'
    );
    engine.submitStaticReferral(sessionId, {
      needed: false,
      specialty: '',
      rationale: 'No immediate specialty referral is selected in this smoke workflow; reassessment and escalation remain documented.'
    });
    const actions = engine.getStaticEscalationActions(sessionId).slice(0, 4).map((item) => item.id);
    engine.selectStaticEscalationActions(
      sessionId,
      actions,
      'Initial management priorities are selected to exercise stabilization, diagnostics, treatment, and disposition reasoning.',
      {
        diagnostics: 'Review vitals, focused exam, bedside tests, labs, ECG, or imaging as indicated by the case.',
        treatments: 'Match immediate treatment and monitoring to the case risk profile.',
        medications: 'Use symptom-directed medications only when supported by the case.',
        disposition: 'Choose monitored placement, observation, admission, transfer, or discharge planning based on reassessment.'
      }
    );
    engine.submitStaticReassessment(sessionId, ['vital_trend', 'pain_response', 'disposition_safety'], 'Trend vital signs, symptoms, and disposition safety before moving the patient through the ED workflow.');
    engine.submitStaticSoap(sessionId, {
      subjective: `Patient reports ${started.complaint || 'an emergency concern'} with history gathered during focused triage interview.`,
      objective: 'Triage objective data, vital signs, and focused exam targets were reviewed in the simulation workflow.',
      assessment: `Assessment remains ${diagnosis} with ESI reasoning tied to risk and resources.`,
      plan: 'Continue reassessment, match resources to risk, document escalation thresholds, and communicate disposition needs.'
    });
    const feedback = engine.getStaticFeedback(sessionId);
    const completed = engine.getCompletedSession(sessionId);
    const caseData = completed.case;
    return {
      case_id: caseData.id,
      case_source: caseData.case_source,
      acuity: caseData.acuity,
      complaint_present: Boolean(caseData.complaint),
      feedback_present: Boolean(feedback.physician_debrief?.case_summary),
      score_percent: feedback.scorecard?.percentage,
      workflow_sections_present: {
        interview: Boolean(feedback.workflow_analysis?.interview),
        focused_exam: Boolean(feedback.workflow_analysis?.focused_exam),
        escalation: Boolean(feedback.workflow_analysis?.escalation),
        reassessment: Boolean(feedback.workflow_analysis?.reassessment),
        soap: Boolean(feedback.workflow_analysis?.soap)
      }
    };
  }, { index, count });
}

function writeReports(artifact) {
  mkdirSync(dirname(REPORT_JSON), { recursive: true });
  writeFileSync(REPORT_JSON, `${JSON.stringify(artifact, null, 2)}\n`);
  const lines = [
    '# 100 Case Workflow Smoke',
    '',
    `Generated: ${artifact.generated_at}`,
    '',
    '## Requirement Check',
    '',
    `- Target cases: ${artifact.requirements.target_cases}`,
    `- Workflow-smoked cases: ${artifact.requirements.workflow_smoked_cases}`,
    `- Distinct case IDs: ${artifact.requirements.distinct_case_ids}`,
    `- Meets target: ${artifact.requirements.meets_target}`,
    '',
    '## Source Counts',
    '',
    ...artifact.sources.map((source) => `- ${source.source_id}: ${source.case_count} cases.`),
    '',
    '## Per-Case Smoke Ledger',
    '',
    '| # | Case ID | Source | ESI | Workflow |',
    '|---:|---|---|---:|---|',
    ...artifact.results.map((row, index) => `| ${index + 1} | ${row.case_id} | ${row.source_id} | ${row.acuity ?? ''} | ${row.workflow_passed ? 'passed' : 'failed'} |`),
    ''
  ];
  writeFileSync(REPORT_MD, lines.join('\n'));
}

async function main() {
  const publicCaseList = readJson(join(ROOT, 'frontend', 'src', 'data', 'cases.json'));
  const restrictedMainEd = readRestrictedBundle('data/restricted/mietic_mimic_main_ed_enriched_cases.restricted.json');
  const restrictedSupplemental = readRestrictedBundle('data/restricted/mimic_iv_ed_supplemental_cases.restricted.json');
  const sources = [
    { id: 'public_demo', count: publicCaseList.length, payload: null },
    { id: 'restricted_main_ed', count: restrictedMainEd.count, payload: restrictedMainEd },
    { id: 'restricted_ed_supplemental', count: restrictedSupplemental.count, payload: restrictedSupplemental }
  ];
  const sourceTotal = sources.reduce((sum, source) => sum + source.count, 0);
  if (sourceTotal !== TARGET_CASES) {
    throw new Error(`Expected ${TARGET_CASES} cases across smoke sources, found ${sourceTotal}.`);
  }

  const server = startDevServer();
  let browser;
  try {
    await waitForServer(server.output);
    browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(BASE_URL);

    const results = [];
    for (const source of sources) {
      await loadCaseSource(page, source);
      for (let index = 0; index < source.count; index += 1) {
        const result = await runCaseAtIndex(page, index, source.count);
        const workflowPassed = Boolean(
          result.case_id
          && result.complaint_present
          && result.feedback_present
          && Number.isFinite(Number(result.score_percent))
          && Object.values(result.workflow_sections_present || {}).every(Boolean)
        );
        results.push({ source_id: source.id, workflow_passed: workflowPassed, ...result });
      }
    }

    const uniqueIds = new Set(results.map((item) => item.case_id));
    const artifact = {
      schema_version: 'case_workflow_smoke_v1',
      generated_at: new Date().toISOString(),
      requirements: {
        target_cases: TARGET_CASES,
        workflow_smoked_cases: results.length,
        distinct_case_ids: uniqueIds.size,
        meets_target: results.length >= TARGET_CASES && uniqueIds.size >= TARGET_CASES && results.every((item) => item.workflow_passed)
      },
      sources: sources.map((source) => ({ source_id: source.id, case_count: source.count })),
      results
    };
    writeReports(artifact);
    if (!artifact.requirements.meets_target) {
      throw new Error(`100-case workflow smoke failed. See ${REPORT_JSON}`);
    }
    console.log(JSON.stringify({
      report_json: REPORT_JSON,
      report_md: REPORT_MD,
      requirements: artifact.requirements
    }, null, 2));
  } finally {
    if (browser) await browser.close();
    server.child.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
