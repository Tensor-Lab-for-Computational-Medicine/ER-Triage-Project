import { createReadStream, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST_PATH = join(ROOT, 'frontend', 'dist');
const DIST_INDEX_PATH = join(DIST_PATH, 'index.html');
const DIST_FALLBACK_PATH = join(DIST_PATH, '404.html');
const JSON_OUTPUT_PATH = join(ROOT, 'docs', 'scale_operations_runtime_report.json');
const MD_OUTPUT_PATH = join(ROOT, 'docs', 'scale_operations_runtime_report.md');

const CONCURRENT_SMOKE_REQUESTS = 40;
const RESPONSE_TIME_BUDGET_MS = 1200;
const REQUIRED_ROUTES = ['/', '/index.html', '/legacy', '/index.html?legacy=1'];

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm'
};

function assertDistReady() {
  if (!existsSync(DIST_INDEX_PATH)) {
    throw new Error(`Missing ${DIST_INDEX_PATH}. Run npm run build first.`);
  }
}

function parseInitialAssetPaths(indexHtml) {
  const assets = new Set();
  const assetPattern = /(?:src|href)=["']([^"']*assets\/[^"']+)["']/g;
  let match = assetPattern.exec(indexHtml);
  while (match) {
    assets.add(match[1].replace(/^\.\//, '/'));
    match = assetPattern.exec(indexHtml);
  }
  return [...assets].sort();
}

function safeDistPath(requestPath) {
  const url = new URL(requestPath, 'http://127.0.0.1');
  const pathname = decodeURIComponent(url.pathname);
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const target = normalize(join(DIST_PATH, relative));
  if (!target.startsWith(DIST_PATH)) return null;
  return target;
}

function serveDist(req, res) {
  const target = safeDistPath(req.url || '/');
  const filePath = target && existsSync(target) && statSync(target).isFile()
    ? target
    : existsSync(DIST_FALLBACK_PATH)
      ? DIST_FALLBACK_PATH
      : DIST_INDEX_PATH;
  const statusCode = target && existsSync(target) && statSync(target).isFile() ? 200 : existsSync(DIST_FALLBACK_PATH) ? 404 : 200;
  const ext = extname(filePath);
  res.statusCode = statusCode;
  res.setHeader('content-type', MIME_TYPES[ext] || 'application/octet-stream');
  res.setHeader('cache-control', ext === '.html' ? 'no-store' : 'public, max-age=31536000, immutable');
  createReadStream(filePath).pipe(res);
}

function listen(server) {
  return new Promise((resolveListen) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolveListen(`http://127.0.0.1:${address.port}`);
    });
  });
}

function close(server) {
  return new Promise((resolveClose) => server.close(resolveClose));
}

async function timedFetch(url) {
  const started = performance.now();
  const response = await fetch(url);
  const body = await response.text();
  const durationMs = Number((performance.now() - started).toFixed(2));
  return {
    url,
    status: response.status,
    ok: response.ok || response.status === 404,
    content_type: response.headers.get('content-type') || '',
    bytes: Buffer.byteLength(body, 'utf8'),
    duration_ms: durationMs,
    body_preview: body.slice(0, 120)
  };
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

function probe(id, passed, evidence, failure = '') {
  return {
    id,
    passed: Boolean(passed),
    failure: passed ? '' : failure,
    evidence
  };
}

function markdown(report) {
  const lines = [
    '# Scale Operations Runtime Report',
    '',
    `Generated at: ${report.generated_at}`,
    '',
    `Review status: ${report.review_status}`,
    '',
    'This report serves the production build locally and runs static-route, fallback, asset, and bounded concurrency smoke probes. It is not a completed production load test, CDN validation, uptime commitment, memory profile, or monitoring dashboard.',
    '',
    '## Summary',
    '',
    `- Probes passed: ${report.summary.passed_probes}/${report.summary.total_probes}`,
    `- Initial assets fetched: ${report.summary.initial_assets_fetched}`,
    `- Concurrent smoke requests: ${report.summary.concurrent_smoke_requests}`,
    `- p95 smoke response: ${report.summary.concurrent_smoke_p95_ms} ms`,
    `- SPA fallback present: ${report.summary.spa_fallback_present}`,
    `- Direct legacy route bootstraps app shell: ${report.summary.legacy_route_bootstrap_ok}`,
    '',
    '## Probe Results',
    '',
    '| Probe | Passed |',
    '|---|---:|',
    ...report.probes.map((item) => `| ${item.id} | ${item.passed} |`),
    '',
    '## Remaining National-Scale Evidence',
    '',
    ...report.remaining_evidence_needed.map((item) => `- ${item}`)
  ];
  return `${lines.join('\n')}\n`;
}

assertDistReady();

const indexHtml = readFileSync(DIST_INDEX_PATH, 'utf8');
const fallbackHtml = existsSync(DIST_FALLBACK_PATH) ? readFileSync(DIST_FALLBACK_PATH, 'utf8') : '';
const initialAssetPaths = parseInitialAssetPaths(indexHtml);
const server = createServer(serveDist);
const baseUrl = await listen(server);

try {
  const routeResults = await Promise.all(REQUIRED_ROUTES.map((route) => timedFetch(`${baseUrl}${route}`)));
  const assetResults = await Promise.all(initialAssetPaths.map((assetPath) => timedFetch(`${baseUrl}${assetPath.startsWith('/') ? assetPath : `/${assetPath}`}`)));
  const concurrentResults = await Promise.all(
    Array.from({ length: CONCURRENT_SMOKE_REQUESTS }, (_, index) => {
      const route = index % 3 === 0 ? '/' : index % 3 === 1 ? '/index.html?legacy=1' : '/legacy';
      return timedFetch(`${baseUrl}${route}`);
    })
  );
  const durations = concurrentResults.map((item) => item.duration_ms);
  const legacyRoute = routeResults.find((item) => item.url.endsWith('/legacy'));
  const defaultRoute = routeResults.find((item) => item.url.endsWith('/'));
  const htmlShellPattern = /<div\s+id=["']root["']><\/div>/;
  const fallbackPresent = existsSync(DIST_FALLBACK_PATH)
    && fallbackHtml.includes('<div id="root"></div>')
    && fallbackHtml === indexHtml;
  const legacyRouteBootstrapOk = Boolean(
    legacyRoute
      && legacyRoute.status === 404
      && htmlShellPattern.test(legacyRoute.body_preview + fallbackHtml)
  );

  const probes = [
    probe(
      'dist_index_present',
      existsSync(DIST_INDEX_PATH) && indexHtml.includes('<div id="root"></div>'),
      { index_path: 'frontend/dist/index.html', bytes: statSync(DIST_INDEX_PATH).size },
      'Production build index.html is missing or does not contain the React root.'
    ),
    probe(
      'github_pages_spa_fallback_present',
      fallbackPresent,
      { fallback_path: 'frontend/dist/404.html', fallback_bytes: existsSync(DIST_FALLBACK_PATH) ? statSync(DIST_FALLBACK_PATH).size : 0 },
      'GitHub Pages SPA fallback 404.html is missing or does not match index.html.'
    ),
    probe(
      'default_route_bootstraps_app_shell',
      Boolean(defaultRoute && defaultRoute.status === 200 && defaultRoute.body_preview.includes('<!doctype html>')),
      defaultRoute,
      'Default route did not return the app shell.'
    ),
    probe(
      'legacy_direct_route_uses_spa_fallback',
      legacyRouteBootstrapOk,
      legacyRoute,
      'Direct /legacy route did not use the SPA fallback app shell.'
    ),
    probe(
      'initial_assets_fetch_successfully',
      assetResults.length > 0 && assetResults.every((item) => item.status === 200 && item.bytes > 0),
      { assets: assetResults.map((item) => ({ url: item.url, status: item.status, bytes: item.bytes, duration_ms: item.duration_ms })) },
      'One or more initial route assets failed to fetch.'
    ),
    probe(
      'concurrent_static_smoke_under_budget',
      concurrentResults.every((item) => item.ok && item.bytes > 0)
        && percentile(durations, 95) <= RESPONSE_TIME_BUDGET_MS,
      {
        requests: concurrentResults.length,
        p50_ms: percentile(durations, 50),
        p95_ms: percentile(durations, 95),
        max_ms: Math.max(...durations),
        response_time_budget_ms: RESPONSE_TIME_BUDGET_MS
      },
      'Concurrent static smoke responses failed or exceeded the bounded local response budget.'
    )
  ];
  const failedProbes = probes.filter((item) => !item.passed);
  const report = {
    schema_version: 'scale_operations_runtime_report_v1',
    generated_at: new Date().toISOString(),
    review_status: failedProbes.length
      ? 'runtime_scale_smoke_failed'
      : 'runtime_scale_smoke_passed_load_monitoring_required',
    warning: 'This is a bounded local static-serving smoke test. It does not replace a 300-concurrent-user load test, browser memory profile, CDN validation, production monitoring, incident drill, or institutional security review.',
    static_server_model: {
      deployment_target: 'GitHub Pages static app',
      backend_required_for_default_workflow: false,
      local_probe_server: baseUrl,
      concurrent_smoke_request_target: CONCURRENT_SMOKE_REQUESTS,
      response_time_budget_ms: RESPONSE_TIME_BUDGET_MS
    },
    summary: {
      total_probes: probes.length,
      passed_probes: probes.length - failedProbes.length,
      failed_probes: failedProbes.length,
      all_probes_passed: failedProbes.length === 0,
      initial_assets_fetched: assetResults.length,
      concurrent_smoke_requests: concurrentResults.length,
      concurrent_smoke_p50_ms: percentile(durations, 50),
      concurrent_smoke_p95_ms: percentile(durations, 95),
      concurrent_smoke_max_ms: Math.max(...durations),
      spa_fallback_present: fallbackPresent,
      legacy_route_bootstrap_ok: legacyRouteBootstrapOk,
      production_load_test_completed: false,
      production_monitoring_dashboard_operational: false,
      incident_response_drill_completed: false
    },
    routes: routeResults.map((item) => ({
      path: new URL(item.url).pathname + new URL(item.url).search,
      status: item.status,
      content_type: item.content_type,
      bytes: item.bytes,
      duration_ms: item.duration_ms
    })),
    initial_assets: assetResults.map((item) => ({
      path: new URL(item.url).pathname,
      status: item.status,
      content_type: item.content_type,
      bytes: item.bytes,
      duration_ms: item.duration_ms
    })),
    probes,
    remaining_evidence_needed: [
      'Run a representative 300-concurrent-learner browser load test on the intended hosting/CDN path.',
      'Complete a browser memory profile for a full case, debrief, repeated-case session, and optional legacy route.',
      'Operate a production monitoring dashboard for errors, route availability, completion rate, source-limited feedback exposure, accessibility reports, and optional AI failures.',
      'Complete an incident-response and rollback drill for unsafe case content, source-bundle defects, and optional AI disablement.',
      'Complete institutional security review for the static deployment, browser storage, optional AI provider policy, and data-retention plan.'
    ]
  };

  writeFileSync(JSON_OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(MD_OUTPUT_PATH, markdown(report), 'utf8');

  console.log(JSON.stringify({
    review_status: report.review_status,
    probes: `${report.summary.passed_probes}/${report.summary.total_probes}`,
    initial_assets_fetched: report.summary.initial_assets_fetched,
    concurrent_smoke_requests: report.summary.concurrent_smoke_requests,
    concurrent_smoke_p95_ms: report.summary.concurrent_smoke_p95_ms,
    spa_fallback_present: report.summary.spa_fallback_present,
    legacy_route_bootstrap_ok: report.summary.legacy_route_bootstrap_ok
  }, null, 2));
} finally {
  await close(server);
}
