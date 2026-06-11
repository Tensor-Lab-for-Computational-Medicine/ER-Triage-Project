import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APP_PATH = join(ROOT, 'frontend', 'src', 'App.jsx');
const DIST_PATH = join(ROOT, 'frontend', 'dist');
const DIST_ASSETS_PATH = join(DIST_PATH, 'assets');
const DIST_INDEX_PATH = join(DIST_PATH, 'index.html');
const JSON_OUTPUT_PATH = join(ROOT, 'docs', 'scale_bundle_readiness_report.json');
const MD_OUTPUT_PATH = join(ROOT, 'docs', 'scale_bundle_readiness_report.md');

const INITIAL_JS_LIMIT_BYTES = 500 * 1024;
const INITIAL_CSS_LIMIT_BYTES = 200 * 1024;
const OPTIONAL_CHUNK_WARNING_BYTES = 500 * 1024;

function bytesToKb(bytes) {
  return Number((bytes / 1024).toFixed(2));
}

function assetInfo(fileName, initialAssetNames = new Set()) {
  const path = join(DIST_ASSETS_PATH, fileName);
  const content = readFileSync(path);
  const ext = fileName.split('.').pop();
  return {
    file_name: fileName,
    extension: ext,
    bytes: content.length,
    kb: bytesToKb(content.length),
    gzip_bytes: gzipSync(content).length,
    gzip_kb: bytesToKb(gzipSync(content).length),
    initial_route_asset: initialAssetNames.has(fileName),
    optional_or_lazy_asset: !initialAssetNames.has(fileName)
  };
}

function parseInitialAssets(indexHtml) {
  const assets = new Set();
  const assetPattern = /assets\/([^"')\s>]+)/g;
  let match = assetPattern.exec(indexHtml);
  while (match) {
    assets.add(match[1]);
    match = assetPattern.exec(indexHtml);
  }
  return assets;
}

function markdown(report) {
  const lines = [
    '# Scale Bundle Readiness Report',
    '',
    `Generated at: ${report.generated_at}`,
    '',
    `Review status: ${report.review_status}`,
    '',
    '## Default Route Budget',
    '',
    `- Legacy simulator lazy-loaded: ${report.source_contract.legacy_simulator_lazy_loaded}`,
    `- Legacy simulator static import present: ${report.source_contract.legacy_simulator_static_import_present}`,
    `- Dist present: ${report.dist.dist_present}`,
    `- Initial JS: ${report.summary.initial_js_kb} KB`,
    `- Initial CSS: ${report.summary.initial_css_kb} KB`,
    `- Initial budget passed: ${report.summary.default_route_initial_budget_passed}`,
    '',
    '## Optional Heavy Assets',
    '',
    `- Optional assets over ${bytesToKb(OPTIONAL_CHUNK_WARNING_BYTES)} KB: ${report.summary.optional_large_asset_count}`,
    `- Largest optional asset: ${report.summary.largest_optional_asset?.file_name || 'none'} (${report.summary.largest_optional_asset?.kb || 0} KB)`,
    '',
    '## Next Actions',
    '',
    ...report.next_actions.map((item) => `- ${item}`)
  ];
  return `${lines.join('\n')}\n`;
}

const appSource = readFileSync(APP_PATH, 'utf8');
const legacyLazyLoaded = appSource.includes("lazy(() => import('./LegacySimulatorApp'))")
  || appSource.includes('lazy(() => import("./LegacySimulatorApp"))');
const legacyStaticImportPresent = /import\s+LegacySimulatorApp\s+from\s+['"]\.\/LegacySimulatorApp['"]/.test(appSource);

let indexHtml = '';
let initialAssetNames = new Set();
let assets = [];
let distPresent = false;
if (existsSync(DIST_INDEX_PATH) && existsSync(DIST_ASSETS_PATH)) {
  distPresent = true;
  indexHtml = readFileSync(DIST_INDEX_PATH, 'utf8');
  initialAssetNames = parseInitialAssets(indexHtml);
  assets = readdirSync(DIST_ASSETS_PATH)
    .filter((fileName) => statSync(join(DIST_ASSETS_PATH, fileName)).isFile())
    .map((fileName) => assetInfo(fileName, initialAssetNames))
    .sort((left, right) => right.bytes - left.bytes);
}

const initialAssets = assets.filter((asset) => asset.initial_route_asset);
const initialJs = initialAssets.filter((asset) => asset.extension === 'js');
const initialCss = initialAssets.filter((asset) => asset.extension === 'css');
const optionalAssets = assets.filter((asset) => asset.optional_or_lazy_asset);
const optionalLargeAssets = optionalAssets.filter((asset) => asset.bytes > OPTIONAL_CHUNK_WARNING_BYTES);
const initialJsBytes = initialJs.reduce((sum, asset) => sum + asset.bytes, 0);
const initialCssBytes = initialCss.reduce((sum, asset) => sum + asset.bytes, 0);
const defaultRouteInitialBudgetPassed = distPresent
  ? initialJsBytes <= INITIAL_JS_LIMIT_BYTES
    && initialCssBytes <= INITIAL_CSS_LIMIT_BYTES
    && legacyLazyLoaded
    && !legacyStaticImportPresent
  : false;

const report = {
  schema_version: 'scale_bundle_readiness_report_v1',
  generated_at: new Date().toISOString(),
  review_status: distPresent
    ? defaultRouteInitialBudgetPassed
      ? 'default_route_budget_passed_optional_assets_need_monitoring'
      : 'default_route_budget_failed'
    : 'dist_missing_run_build_before_release',
  warning: 'This report checks default-route bundle readiness. It does not replace load testing, device testing, accessibility audits, or CDN/deployment monitoring.',
  source_contract: {
    app_path: 'frontend/src/App.jsx',
    legacy_simulator_lazy_loaded: legacyLazyLoaded,
    legacy_simulator_static_import_present: legacyStaticImportPresent,
    default_route: 'ClinicalFlowboard',
    optional_route: '/legacy or ?legacy=1'
  },
  dist: {
    dist_present: distPresent,
    index_path: 'frontend/dist/index.html',
    initial_asset_names: [...initialAssetNames].sort()
  },
  budget_policy: {
    initial_js_limit_kb: bytesToKb(INITIAL_JS_LIMIT_BYTES),
    initial_css_limit_kb: bytesToKb(INITIAL_CSS_LIMIT_BYTES),
    optional_chunk_warning_kb: bytesToKb(OPTIONAL_CHUNK_WARNING_BYTES),
    rationale: 'The default national cohort route should avoid loading optional legacy simulator, PDF ingestion, local embedding, and patient TTS payloads until explicitly requested.'
  },
  summary: {
    initial_js_bytes: initialJsBytes,
    initial_js_kb: bytesToKb(initialJsBytes),
    initial_css_bytes: initialCssBytes,
    initial_css_kb: bytesToKb(initialCssBytes),
    initial_asset_count: initialAssets.length,
    total_asset_count: assets.length,
    optional_asset_count: optionalAssets.length,
    optional_large_asset_count: optionalLargeAssets.length,
    largest_initial_asset: initialAssets[0] || null,
    largest_optional_asset: optionalAssets[0] || null,
    default_route_initial_budget_passed: defaultRouteInitialBudgetPassed
  },
  initial_assets: initialAssets,
  optional_large_assets: optionalLargeAssets,
  all_assets: assets,
  next_actions: [
    'Keep the default ClinicalFlowboard route free of legacy simulator, local PDF ingestion, embedding model, and patient TTS imports.',
    'Add manualChunks or deeper lazy-loading for legacy-only PDF, transformer, and Kokoro assets if the legacy route becomes part of national deployment.',
    'Run Lighthouse/WebPageTest-style checks on representative campus networks before national launch.',
    'Add load testing and CDN cache validation for multi-school cohorts.'
  ]
};

writeFileSync(JSON_OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
writeFileSync(MD_OUTPUT_PATH, markdown(report), 'utf8');
console.log(JSON.stringify({
  review_status: report.review_status,
  initial_js_kb: report.summary.initial_js_kb,
  initial_css_kb: report.summary.initial_css_kb,
  optional_large_asset_count: report.summary.optional_large_asset_count,
  default_route_initial_budget_passed: report.summary.default_route_initial_budget_passed
}, null, 2));
