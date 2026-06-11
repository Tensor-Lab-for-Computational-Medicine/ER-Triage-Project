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
const JSON_OUTPUT_PATH = join(ROOT, 'docs', 'route_reachability_report.json');
const MD_OUTPUT_PATH = join(ROOT, 'docs', 'route_reachability_report.md');

const ROUTES = [
  {
    id: 'default_flowboard_route',
    path: '/',
    required_text: ['Fever, Vomiting, Dizziness', 'Arrival + Acuity', 'Stabilize / Activate'],
    forbidden_text: ['Pre-Rounding Checklist Builder', 'Start Rounds Workspace']
  },
  {
    id: 'legacy_path_route',
    path: '/legacy',
    required_text: ['ED Clinical Workflow Simulator', 'Focused triage interview'],
    forbidden_text: ['Pre-Rounding Checklist Builder', 'Start Rounds Workspace']
  },
  {
    id: 'legacy_query_route',
    path: '/?legacy=1',
    required_text: ['ED Clinical Workflow Simulator', 'Focused triage interview'],
    forbidden_text: ['Pre-Rounding Checklist Builder', 'Start Rounds Workspace']
  }
];

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
    throw new Error('frontend/dist/index.html is missing. Run npm run build before route reachability probes.');
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

async function checkRoute(page, baseUrl, route) {
  const url = `${baseUrl}${route.path}`;
  const startedAt = performance.now();
  const errors = [];
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => {
    errors.push(error.message);
  });
  await page.goto(url, { waitUntil: 'networkidle' });
  const bodyText = await page.locator('body').innerText({ timeout: 10_000 }).catch(() => '');
  const normalizedBodyText = bodyText.toLowerCase();
  const durationMs = Number((performance.now() - startedAt).toFixed(2));
  const missingRequiredText = route.required_text.filter((text) => !normalizedBodyText.includes(text.toLowerCase()));
  const forbiddenTextFound = route.forbidden_text.filter((text) => normalizedBodyText.includes(text.toLowerCase()));
  const rootHasContent = await page.locator('#root > *').count().catch(() => 0);
  const passed = rootHasContent > 0
    && missingRequiredText.length === 0
    && forbiddenTextFound.length === 0
    && errors.length === 0;

  return {
    id: route.id,
    path: route.path,
    url,
    status: passed ? 'pass' : 'fail',
    duration_ms: durationMs,
    root_child_count: rootHasContent,
    required_text: route.required_text,
    missing_required_text: missingRequiredText,
    forbidden_text_found: forbiddenTextFound,
    page_errors: errors,
    console_error_count: consoleErrors.length,
    console_error_samples: consoleErrors.slice(0, 5),
    rendered_text_sample: bodyText.replace(/\s+/g, ' ').trim().slice(0, 500)
  };
}

function markdown(report) {
  const lines = [
    '# Route Reachability Report',
    '',
    `Generated at: ${report.generated_at}`,
    '',
    report.warning,
    '',
    '## Summary',
    '',
    `- Probes passed: ${report.summary.passed_route_probes}/${report.summary.total_route_probes}`,
    `- Default flowboard rendered: ${report.summary.default_flowboard_route_rendered}`,
    `- Legacy path route rendered: ${report.summary.legacy_path_route_rendered}`,
    `- Legacy query route rendered: ${report.summary.legacy_query_route_rendered}`,
    `- Wrong app shell findings: ${report.summary.wrong_app_shell_findings}`,
    '',
    '## Routes',
    '',
    '| Route | Status | Missing required text | Wrong shell text |',
    '|---|---|---|---|',
    ...report.routes.map((route) =>
      `| ${route.path} | ${route.status} | ${route.missing_required_text.join(', ') || 'none'} | ${route.forbidden_text_found.join(', ') || 'none'} |`
    )
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
  const context = await browser.newContext();
  const routeResults = [];
  for (const route of ROUTES) {
    const page = await context.newPage();
    routeResults.push(await checkRoute(page, baseUrl, route));
    await page.close();
  }
  await context.close();

  const failedRoutes = routeResults.filter((route) => route.status !== 'pass');
  const report = {
    schema_version: 'route_reachability_report_v1',
    generated_at: new Date().toISOString(),
    review_status: failedRoutes.length
      ? 'route_reachability_failed'
      : 'route_reachability_smoke_passed_manual_browser_qa_required',
    warning: 'This report verifies rendered production-build routes in Chromium. It does not replace full user-flow QA, device/browser matrix testing, uptime monitoring, or accessibility review.',
    route_contract: {
      default_route: 'ClinicalFlowboard',
      legacy_path_route: '/legacy',
      legacy_query_route: '/?legacy=1',
      stale_server_reuse_allowed: false
    },
    summary: {
      total_route_probes: routeResults.length,
      passed_route_probes: routeResults.length - failedRoutes.length,
      failed_route_probes: failedRoutes.length,
      all_route_probes_passed: failedRoutes.length === 0,
      default_flowboard_route_rendered: routeResults.find((route) => route.id === 'default_flowboard_route')?.status === 'pass',
      legacy_path_route_rendered: routeResults.find((route) => route.id === 'legacy_path_route')?.status === 'pass',
      legacy_query_route_rendered: routeResults.find((route) => route.id === 'legacy_query_route')?.status === 'pass',
      wrong_app_shell_findings: routeResults.reduce((sum, route) => sum + route.forbidden_text_found.length, 0)
    },
    routes: routeResults,
    next_actions: [
      'Keep Playwright route tests from reusing stale local servers unless explicitly requested.',
      'Add full browser user-flow QA for the default flowboard and legacy simulator before national cohort release.',
      'Monitor production route availability and render errors after deployment.'
    ]
  };

  writeFileSync(JSON_OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(MD_OUTPUT_PATH, markdown(report), 'utf8');
  console.log(JSON.stringify({
    review_status: report.review_status,
    probes: `${report.summary.passed_route_probes}/${report.summary.total_route_probes}`,
    wrong_app_shell_findings: report.summary.wrong_app_shell_findings,
    report_path: JSON_OUTPUT_PATH
  }, null, 2));

  if (failedRoutes.length) {
    throw new Error(`Route reachability probes failed: ${failedRoutes.map((route) => route.id).join(', ')}`);
  }
} finally {
  if (browser) await browser.close();
  await closeServer(server);
}
