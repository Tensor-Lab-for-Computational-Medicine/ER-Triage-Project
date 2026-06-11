import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CASES_PATH = join(ROOT, 'frontend', 'src', 'data', 'cases.json');
const SUITE_PATH = join(ROOT, 'docs', 'learner_safety_red_team_suite.json');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(existsSync(SUITE_PATH), `Learner safety red-team suite missing: ${SUITE_PATH}`);

const cases = readJson(CASES_PATH);
const caseIds = new Set(cases.map((caseRecord) => caseRecord.id));
const suite = readJson(SUITE_PATH);

assert(suite.schema_version === 'learner_safety_red_team_suite_v1', 'Unexpected learner safety red-team suite schema');
assert(suite.review_status === 'draft_needs_clinician_educator_safety_review', 'Safety red-team suite must remain draft until clinician/educator review');
assert(Array.isArray(suite.required_categories) && suite.required_categories.length >= 10, 'Safety suite must declare at least 10 required categories');
assert(Array.isArray(suite.tests) && suite.tests.length >= suite.required_categories.length, 'Safety suite must define at least one test per required category');

const categories = new Set(suite.tests.map((test) => test.category));
for (const category of suite.required_categories) {
  assert(categories.has(category), `Missing required safety red-team category: ${category}`);
}

for (const test of suite.tests) {
  assert(test.id && /^safety_\d+_/.test(test.id), `Safety test has malformed id: ${test.id}`);
  assert(caseIds.has(test.case_id), `Safety test ${test.id} references unknown case ${test.case_id}`);
  assert(test.target_surface, `Safety test ${test.id} missing target surface`);
  assert(test.learner_or_prompt, `Safety test ${test.id} missing learner/prompt`);
  assert(test.expected_safe_behavior, `Safety test ${test.id} missing expected safe behavior`);
  assert(test.prohibited_behavior, `Safety test ${test.id} missing prohibited behavior`);
  assert(test.required_evidence_basis, `Safety test ${test.id} missing required evidence basis`);
  assert(test.automated_check_status === 'fixture_defined_needs_runtime_probe', `Safety test ${test.id} should not claim runtime pass before probes run`);
}

assert(suite.summary.runtime_passed_tests === 0, 'Draft safety suite must not claim runtime-passed tests');
assert(suite.summary.clinician_reviewed_tests === 0, 'Draft safety suite must not claim clinician-reviewed tests');

console.log(JSON.stringify({
  schema_version: suite.schema_version,
  total_tests: suite.tests.length,
  required_categories: suite.required_categories.length,
  covered_categories: categories.size,
  runtime_passed_tests: suite.summary.runtime_passed_tests,
  clinician_reviewed_tests: suite.summary.clinician_reviewed_tests
}, null, 2));
