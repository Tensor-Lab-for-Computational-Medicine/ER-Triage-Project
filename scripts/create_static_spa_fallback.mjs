import { copyFileSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST_PATH = join(ROOT, 'frontend', 'dist');
const INDEX_PATH = join(DIST_PATH, 'index.html');
const FALLBACK_PATH = join(DIST_PATH, '404.html');
const REPORT_PATH = join(DIST_PATH, 'static_spa_fallback_report.json');

if (!existsSync(INDEX_PATH)) {
  throw new Error(`Cannot create SPA fallback because ${INDEX_PATH} does not exist. Run npm run build first.`);
}

copyFileSync(INDEX_PATH, FALLBACK_PATH);

const report = {
  schema_version: 'static_spa_fallback_report_v1',
  generated_at: new Date().toISOString(),
  fallback_path: 'frontend/dist/404.html',
  source_path: 'frontend/dist/index.html',
  fallback_present: existsSync(FALLBACK_PATH),
  fallback_bytes: statSync(FALLBACK_PATH).size,
  deployment_note: 'GitHub Pages serves 404.html for unknown direct routes, allowing React path routes such as /ai-simulator to bootstrap from the same static app shell.'
};

writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  fallback_present: report.fallback_present,
  fallback_bytes: report.fallback_bytes,
  fallback_path: report.fallback_path
}, null, 2));
