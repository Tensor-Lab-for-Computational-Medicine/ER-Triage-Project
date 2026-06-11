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
const JSON_OUTPUT_PATH = join(ROOT, 'docs', 'open_evidence_retrieval_runtime_report.json');
const MD_OUTPUT_PATH = join(ROOT, 'docs', 'open_evidence_retrieval_runtime_report.md');

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
    throw new Error('frontend/dist/index.html is missing. Run npm run build before open-evidence retrieval runtime probes.');
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

async function count(locator) {
  return locator.count().catch(() => 0);
}

async function waitVisible(locator, label, timeout = 15_000) {
  if (!(await count(locator))) throw new Error(`Missing locator for ${label}.`);
  await locator.first().waitFor({ state: 'visible', timeout });
}

async function click(locator, label) {
  await waitVisible(locator, label);
  await locator.first().click();
}

async function openDisclosure(disclosure, label) {
  await waitVisible(disclosure, label);
  const isOpen = await disclosure.first().evaluate((node) => node.hasAttribute('open')).catch(() => false);
  if (!isOpen) await click(disclosure.locator('summary'), `${label} summary`);
}

async function collectGroundingRuntimeEvidence(page, baseUrl) {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    Math.random = () => 0.42;
  });
  await page.goto(`${baseUrl}/?legacy=1`, { waitUntil: 'networkidle' });
  await waitVisible(page.getByRole('heading', { name: /Focused triage interview/i }), 'legacy simulator shell');

  await openDisclosure(page.locator('.tools-menu'), 'tools menu');
  await openDisclosure(page.locator('.case-source-banner'), 'case/source tools');

  const lab = page.getByLabel('Clinical grounding test lab');
  await openDisclosure(lab, 'clinical grounding test lab');

  const labTextBefore = await lab.innerText();
  const sourceModeSelect = lab.locator('select').last();
  const sourceModeValue = await sourceModeSelect.inputValue();
  const sourceModeOptions = await sourceModeSelect.locator('option').evaluateAll((nodes) =>
    nodes.map((node) => ({ value: node.value, label: node.textContent?.trim() || '' }))
  );
  const quoteBackedOnlyChecked = await lab
    .locator('label')
    .filter({ hasText: 'Quote-backed only' })
    .locator('input[type="checkbox"]')
    .first()
    .isChecked();

  await click(lab.getByRole('button', { name: 'Chest Pain ACS' }), 'Chest Pain ACS preset');
  const results = page.getByLabel('Clinical retrieval results');
  await waitVisible(results, 'clinical retrieval results');
  const resultsText = await results.innerText();
  const qualityPanel = results.locator('[aria-label="Retrieval quality badge"]');
  await waitVisible(qualityPanel, 'retrieval quality badge');
  const qualityPanelText = await qualityPanel.first().innerText();
  const qualityBadgeCount = await results.locator('.retrieval-quality-badge').count();
  const qualityPanelClassName = await qualityPanel.first().evaluate((node) => node.className || '');
  const thresholdMatch = cleanText(qualityPanelText).match(/top\s+([0-9.]+)\s+\/\s+min\s+([0-9.]+)/i);
  const topBaseScore = thresholdMatch ? Number(thresholdMatch[1]) : 0;
  const minimumBaseScore = thresholdMatch ? Number(thresholdMatch[2]) : 0;
  const thresholdPassedVisible = /threshold passed/i.test(qualityPanelText);
  const bm25FallbackVisible = /BM25 fallback visible|fallback visible/i.test(qualityPanelText);
  const highRiskQualityVisible = /High-risk retrieval quality met/i.test(qualityPanelText);
  const referenceCards = await results.locator('.grounding-reference-card').evaluateAll((nodes) =>
    nodes.map((node) => ({
      text: node.textContent?.replace(/\s+/g, ' ').trim() || '',
      className: node.className || ''
    }))
  );
  const quoteBackedBadgeCount = await results.locator('.evidence-quote_backed').count();
  const generatedNeedsReviewBadgeCount = await results.locator('.evidence-generated_needs_review').count();
  const needsReviewBadgeCount = await results.locator('.source-verification-badge.needs_review').count();
  const humanVerifiedBadgeCount = await results.locator('.source-verification-badge.human_verified').count();

  await click(lab.getByRole('button', { name: 'Run smoke set' }), 'grounding smoke set');
  await page.getByText(/\d+\/\d+ checks passing/).first().waitFor({ state: 'visible', timeout: 20_000 });
  const smokeSummaryText = await page.getByText(/\d+\/\d+ checks passing/).first().innerText();
  const smokeResults = page.getByLabel('Clinical grounding smoke test results');
  await waitVisible(smokeResults, 'clinical grounding smoke test results');
  const smokeResultsText = await smokeResults.innerText();
  const smokeItems = await smokeResults.locator('.grounding-smoke-item').evaluateAll((nodes) =>
    nodes.map((node) => ({
      text: node.textContent?.replace(/\s+/g, ' ').trim() || '',
      className: node.className || ''
    }))
  );
  const smokePassedItems = smokeItems.filter((item) => /\bpass\b/.test(item.className)).length;
  const smokeReviewItems = smokeItems.filter((item) => /\breview\b/.test(item.className)).length;

  const nonclinicalQuery = 'schedule a meeting with faculty about vacation dates and room booking';
  await sourceModeSelect.selectOption('public_only');
  await lab.locator('#grounding-query').fill(nonclinicalQuery);
  await click(lab.getByRole('button', { name: 'Run retrieval' }), 'nonclinical retrieval submit');
  const nonclinicalWarning = lab.getByText(
    /does not appear to ask a clinical education question|learner-facing clinical references were not retrieved/i
  );
  await nonclinicalWarning.first().waitFor({ state: 'visible', timeout: 15_000 });
  const nonclinicalResultsText = await results.innerText();
  const nonclinicalReferenceCardCount = await results.locator('.grounding-reference-card').count();
  const nonclinicalScopeWarningVisible =
    /does not appear to ask a clinical education question/i.test(nonclinicalResultsText)
    && /learner-facing clinical references were not retrieved/i.test(nonclinicalResultsText);
  const nonclinicalScopeGuardrailPass = nonclinicalScopeWarningVisible
    && nonclinicalReferenceCardCount === 0
    && /0 references/i.test(nonclinicalResultsText)
    && /scope_guardrail/i.test(nonclinicalResultsText);

  const retrievalReferencesAllQuoteBacked = referenceCards.length > 0
    && quoteBackedBadgeCount === referenceCards.length
    && generatedNeedsReviewBadgeCount === 0
    && needsReviewBadgeCount === 0;
  const smokeAllPass = smokeItems.length > 0
    && smokePassedItems === smokeItems.length
    && smokeReviewItems === 0
    && !/Needs review/i.test(smokeResultsText);

  const probes = [
    {
      id: 'quote_backed_only_enabled_by_default',
      status: quoteBackedOnlyChecked ? 'pass' : 'fail',
      evidence: { quote_backed_only_checked: quoteBackedOnlyChecked }
    },
    {
      id: 'grounding_lab_exposes_public_source_modes',
      status: sourceModeValue === 'guidelines_first'
        && sourceModeOptions.some((option) => option.value === 'public_only')
        && sourceModeOptions.some((option) => option.value === 'local_textbook_only')
        ? 'pass'
        : 'fail',
      evidence: { source_mode_value: sourceModeValue, source_mode_options: sourceModeOptions }
    },
    {
      id: 'runtime_retrieval_returns_quote_backed_references',
      status: retrievalReferencesAllQuoteBacked ? 'pass' : 'fail',
      evidence: {
        reference_card_count: referenceCards.length,
        quote_backed_badges: quoteBackedBadgeCount,
        generated_needs_review_badges: generatedNeedsReviewBadgeCount,
        needs_review_badges: needsReviewBadgeCount,
        human_verified_badges: humanVerifiedBadgeCount
      }
    },
    {
      id: 'generated_backlog_quarantine_warning_visible',
      status: /Generated-needs-review chunks were quarantined/i.test(resultsText)
        && /Quote-backed-only mode hid generated background chunks/i.test(resultsText)
        ? 'pass'
        : 'fail',
      evidence: {
        retrieval_warning_sample: cleanText(resultsText).slice(0, 500)
      }
    },
    {
      id: 'retrieval_quality_badge_visible',
      status: qualityBadgeCount > 0
        && highRiskQualityVisible
        && /pass/.test(qualityPanelClassName)
        ? 'pass'
        : 'fail',
      evidence: {
        quality_badge_count: qualityBadgeCount,
        high_risk_quality_visible: highRiskQualityVisible,
        quality_panel_class_name: qualityPanelClassName,
        quality_panel_sample: cleanText(qualityPanelText).slice(0, 500)
      }
    },
    {
      id: 'high_risk_retrieval_quality_threshold_visible',
      status: thresholdPassedVisible
        && minimumBaseScore >= 0.08
        && topBaseScore >= minimumBaseScore
        ? 'pass'
        : 'fail',
      evidence: {
        threshold_passed_visible: thresholdPassedVisible,
        top_base_score: topBaseScore,
        minimum_base_score: minimumBaseScore,
        quality_panel_sample: cleanText(qualityPanelText).slice(0, 500)
      }
    },
    {
      id: 'bm25_fallback_badged_when_semantic_not_warmed',
      status: bm25FallbackVisible ? 'pass' : 'fail',
      evidence: {
        bm25_fallback_visible: bm25FallbackVisible,
        quality_panel_sample: cleanText(qualityPanelText).slice(0, 500)
      }
    },
    {
      id: 'high_risk_grounding_smoke_set_all_pass',
      status: smokeAllPass ? 'pass' : 'fail',
      evidence: {
        smoke_summary: smokeSummaryText,
        smoke_item_count: smokeItems.length,
        smoke_passed_items: smokePassedItems,
        smoke_review_items: smokeReviewItems
      }
    },
    {
      id: 'smoke_set_no_generated_or_needs_review_labels',
      status: !/Generated needs review|Needs review/i.test(smokeResultsText) ? 'pass' : 'fail',
      evidence: {
        smoke_results_sample: cleanText(smokeResultsText).slice(0, 500)
      }
    },
    {
      id: 'nonclinical_retrieval_scope_guardrail_blocks_clinical_references',
      status: nonclinicalScopeGuardrailPass ? 'pass' : 'fail',
      evidence: {
        query: nonclinicalQuery,
        source_mode: 'public_only',
        warning_visible: nonclinicalScopeWarningVisible,
        reference_card_count: nonclinicalReferenceCardCount,
        results_sample: cleanText(nonclinicalResultsText).slice(0, 500)
      }
    }
  ];

  return {
    lab_text_sample: cleanText(labTextBefore).slice(0, 500),
    retrieval_text_sample: cleanText(resultsText).slice(0, 800),
    retrieval_quality_text_sample: cleanText(qualityPanelText).slice(0, 800),
    nonclinical_scope_guardrail_text_sample: cleanText(nonclinicalResultsText).slice(0, 800),
    reference_cards: referenceCards.slice(0, 8),
    smoke_items: smokeItems,
    probes
  };
}

function markdown(report) {
  const lines = [
    '# Open Evidence Retrieval Runtime Report',
    '',
    `Generated at: ${report.generated_at}`,
    '',
    report.warning,
    '',
    '## Summary',
    '',
    `- Probes passed: ${report.summary.passed_runtime_probes}/${report.summary.total_runtime_probes}`,
    `- Quote-backed-only default enabled: ${report.summary.quote_backed_only_default_enabled}`,
    `- Runtime retrieval reference cards: ${report.summary.runtime_retrieval_reference_count}`,
    `- Generated-needs-review badges rendered: ${report.summary.generated_needs_review_badges_rendered}`,
    `- Retrieval quality badge visible: ${report.summary.retrieval_quality_badge_visible}`,
    `- High-risk minimum retrieval score: ${report.summary.high_risk_retrieval_quality_minimum_base_score}`,
    `- High-risk retrieval quality threshold passed: ${report.summary.high_risk_retrieval_quality_threshold_passed}`,
    `- BM25 fallback badge visible: ${report.summary.bm25_fallback_badge_visible}`,
    `- Grounding smoke checks: ${report.summary.smoke_passed_items}/${report.summary.smoke_item_count}`,
    `- Nonclinical scope guardrail references: ${report.summary.nonclinical_scope_guardrail_reference_count}`,
    `- Nonclinical scope guardrail warning visible: ${report.summary.nonclinical_scope_guardrail_warning_visible}`,
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
  const evidence = await collectGroundingRuntimeEvidence(page, baseUrl);
  await context.close();

  const failedProbes = evidence.probes.filter((probe) => probe.status !== 'pass');
  const retrievalProbe = evidence.probes.find((probe) => probe.id === 'runtime_retrieval_returns_quote_backed_references');
  const smokeProbe = evidence.probes.find((probe) => probe.id === 'high_risk_grounding_smoke_set_all_pass');
  const qualityBadgeProbe = evidence.probes.find((probe) => probe.id === 'retrieval_quality_badge_visible');
  const thresholdProbe = evidence.probes.find((probe) => probe.id === 'high_risk_retrieval_quality_threshold_visible');
  const fallbackProbe = evidence.probes.find((probe) => probe.id === 'bm25_fallback_badged_when_semantic_not_warmed');
  const nonclinicalScopeProbe = evidence.probes.find((probe) =>
    probe.id === 'nonclinical_retrieval_scope_guardrail_blocks_clinical_references'
  );
  const report = {
    schema_version: 'open_evidence_retrieval_runtime_report_v1',
    generated_at: new Date().toISOString(),
    review_status: failedProbes.length
      ? 'open_evidence_retrieval_runtime_failed'
      : 'open_evidence_retrieval_runtime_passed_manual_review_required',
    warning: 'This runtime report exercises the production build in Chromium. It verifies learner-facing retrieval quarantine behavior, but it does not replace clinician, librarian, or claim-entailment review.',
    route_contract: {
      exercised_route: '/?legacy=1',
      production_build_dist: 'frontend/dist',
      runtime_surface: 'Clinical grounding test lab'
    },
    summary: {
      total_runtime_probes: evidence.probes.length,
      passed_runtime_probes: evidence.probes.length - failedProbes.length,
      failed_runtime_probes: failedProbes.length,
      all_runtime_probes_passed: failedProbes.length === 0,
      quote_backed_only_default_enabled:
        evidence.probes.find((probe) => probe.id === 'quote_backed_only_enabled_by_default')?.status === 'pass',
      runtime_retrieval_reference_count: retrievalProbe?.evidence?.reference_card_count || 0,
      runtime_retrieval_quote_backed_badges: retrievalProbe?.evidence?.quote_backed_badges || 0,
      generated_needs_review_badges_rendered: retrievalProbe?.evidence?.generated_needs_review_badges || 0,
      needs_review_badges_rendered: retrievalProbe?.evidence?.needs_review_badges || 0,
      generated_backlog_quarantine_warning_visible:
        evidence.probes.find((probe) => probe.id === 'generated_backlog_quarantine_warning_visible')?.status === 'pass',
      retrieval_quality_badge_visible: qualityBadgeProbe?.status === 'pass',
      high_risk_retrieval_quality_threshold_passed: thresholdProbe?.status === 'pass',
      high_risk_retrieval_quality_top_base_score: thresholdProbe?.evidence?.top_base_score || 0,
      high_risk_retrieval_quality_minimum_base_score: thresholdProbe?.evidence?.minimum_base_score || 0,
      bm25_fallback_badge_visible: fallbackProbe?.status === 'pass',
      smoke_item_count: smokeProbe?.evidence?.smoke_item_count || 0,
      smoke_passed_items: smokeProbe?.evidence?.smoke_passed_items || 0,
      smoke_review_items: smokeProbe?.evidence?.smoke_review_items || 0,
      nonclinical_scope_guardrail_warning_visible:
        Boolean(nonclinicalScopeProbe?.evidence?.warning_visible),
      nonclinical_scope_guardrail_reference_count:
        nonclinicalScopeProbe?.evidence?.reference_card_count || 0
    },
    probes: evidence.probes,
    rendered_evidence: {
      lab_text_sample: evidence.lab_text_sample,
      retrieval_text_sample: evidence.retrieval_text_sample,
      retrieval_quality_text_sample: evidence.retrieval_quality_text_sample,
      nonclinical_scope_guardrail_text_sample: evidence.nonclinical_scope_guardrail_text_sample,
      reference_card_samples: evidence.reference_cards,
      smoke_items: evidence.smoke_items
    },
    next_actions: [
      'Repeat this runtime probe after any retrieval, grounding lab, knowledge bundle, or source-verification UI change.',
      'Keep generated-needs-review evidence quarantined until librarian/clinician source adjudication is complete.',
      'Keep quote-backed-only retrieval as the learner-facing default for high-risk clinical teaching.'
    ]
  };

  writeFileSync(JSON_OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(MD_OUTPUT_PATH, markdown(report), 'utf8');
  console.log(JSON.stringify({
    review_status: report.review_status,
    probes: `${report.summary.passed_runtime_probes}/${report.summary.total_runtime_probes}`,
    runtime_retrieval_reference_count: report.summary.runtime_retrieval_reference_count,
    generated_needs_review_badges_rendered: report.summary.generated_needs_review_badges_rendered,
    retrieval_quality_badge_visible: report.summary.retrieval_quality_badge_visible,
    high_risk_retrieval_quality_threshold_passed: report.summary.high_risk_retrieval_quality_threshold_passed,
    bm25_fallback_badge_visible: report.summary.bm25_fallback_badge_visible,
    nonclinical_scope_guardrail_reference_count: report.summary.nonclinical_scope_guardrail_reference_count,
    report_path: JSON_OUTPUT_PATH
  }, null, 2));

  if (failedProbes.length) {
    throw new Error(`Open-evidence retrieval runtime probes failed: ${failedProbes.map((probe) => probe.id).join(', ')}`);
  }
} finally {
  if (browser) await browser.close();
  await closeServer(server);
}
