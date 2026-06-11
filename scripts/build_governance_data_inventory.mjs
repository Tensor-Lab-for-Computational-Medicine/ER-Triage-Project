import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_PATH = join(ROOT, 'docs', 'governance_data_inventory.json');
const CASES_PATH = join(ROOT, 'frontend', 'src', 'data', 'cases.json');
const SOURCE_FILES = [
  join(ROOT, 'frontend', 'src', 'App.jsx'),
  join(ROOT, 'frontend', 'src', 'services', 'staticEngine.js'),
  join(ROOT, 'frontend', 'src', 'services', 'clinicalKnowledgeService.js'),
  join(ROOT, 'frontend', 'src', 'services', 'learnerProfileService.js'),
  join(ROOT, 'frontend', 'src', 'services', 'uiPreferenceService.js'),
  join(ROOT, 'frontend', 'src', 'services', 'patientVoiceService.js')
];

function readText(path) {
  return readFileSync(path, 'utf8');
}

function readJson(path) {
  return JSON.parse(readText(path));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function extractStorageKeys(sourceText) {
  return unique([...sourceText.matchAll(/['"](ed_triage_[a-zA-Z0-9_:-]+)['"]/g)].map((match) => match[1]));
}

function classifyStorageKey(key) {
  if (/openrouter|api|key|model/i.test(key)) return 'optional_ai_settings';
  if (/cache|response|review/i.test(key)) return 'local_cache';
  if (/clinical_knowledge/i.test(key)) return 'local_knowledge_bundle_state';
  if (/learner_profile/i.test(key)) return 'learner_progress_profile';
  if (/coach|voice/i.test(key)) return 'ui_preference';
  if (/restricted/i.test(key)) return 'restricted_mode_control';
  return 'browser_state';
}

function storageMediumForKey(key) {
  if (/clinical_knowledge_v1$/.test(key)) return 'indexedDB';
  if (/openrouter_key|restricted_ai_enabled|external_ai_enabled|local_clinical_knowledge_state/.test(key)) return 'sessionStorage_or_localStorage';
  return 'localStorage';
}

const sourceBundle = SOURCE_FILES.map((path) => readText(path)).join('\n');
const cases = readJson(CASES_PATH);
const storageKeys = extractStorageKeys(sourceBundle);
const externalEndpoints = unique([...sourceBundle.matchAll(/https:\/\/(?:openrouter\.ai|api\.openai\.com|api\.anthropic\.com)[^'")\s]*/g)].map((match) => match[0]));

const inventory = {
  schema_version: 'governance_data_inventory_v1',
  generated_at: new Date().toISOString(),
  review_status: 'draft_needs_institutional_privacy_security_review',
  warning: 'This is an engineering data-flow inventory. It is not FERPA, HIPAA, IRB, security, accessibility, or institutional deployment approval.',
  deployment_model: {
    default_public_app: 'static_browser_only',
    backend_server_required: false,
    default_workflow_network_requests: false,
    optional_external_ai_requests: true,
    public_case_count: cases.length
  },
  browser_storage_keys: storageKeys.map((key) => ({
    key,
    category: classifyStorageKey(key),
    medium: storageMediumForKey(key),
    contains_direct_identifier_by_design: false,
    notes: /openrouter_key/.test(key)
      ? 'Stores a learner-provided AI key when optional AI is enabled. Session storage is the safer default; local persistence is user-selected.'
      : /clinical_knowledge/.test(key)
        ? 'Stores local clinical knowledge state or locally imported evidence bundle data on the learner device.'
        : /learner_profile/.test(key)
          ? 'Stores aggregate learner practice profile and recurring gap counts on the learner device.'
          : /cache|response|review/.test(key)
            ? 'Stores browser-local generated educational cache entries to avoid repeated optional AI/model work.'
            : 'Stores browser-local UI or workflow state.'
  })),
  data_categories: [
    {
      id: 'public_case_bundle',
      description: 'Sanitized public MIETIC validation cases bundled in frontend/src/data/cases.json.',
      storage: 'static_app_bundle',
      external_transmission_default: false,
      restricted_or_identifiable_data_allowed: false,
      current_control: 'validate_static_bundle.py rejects restricted identifiers and forbidden public fields.'
    },
    {
      id: 'learner_workflow_session',
      description: 'Learner questions, ESI selections, diagnosis text, plan rationale, reassessment targets, SOAP text, and deterministic scores during active practice.',
      storage: 'browser_memory_and_optional_local_profile',
      external_transmission_default: false,
      restricted_or_identifiable_data_allowed: false,
      current_control: 'No backend is required for the default workflow; data remains in the browser unless optional AI is requested.'
    },
    {
      id: 'optional_ai_requests',
      description: 'Case summary, learner reasoning, grounding context, and learner question sent to the selected AI provider only after user key/settings enable optional AI.',
      storage: 'external_provider_request_when_enabled',
      external_transmission_default: false,
      restricted_or_identifiable_data_allowed: false,
      current_control: 'User-provided key required; deterministic scoring and feedback remain available without AI.'
    },
    {
      id: 'local_restricted_case_bundle',
      description: 'Credentialed local MIMIC-derived case bundles loaded for research demos.',
      storage: 'browser_memory',
      external_transmission_default: false,
      restricted_or_identifiable_data_allowed: true,
      current_control: 'Restricted bundles are ignored by git and must stay local; public deployment must not import them.'
    },
    {
      id: 'local_clinical_knowledge_bundle',
      description: 'Local textbook or institution-specific evidence imported by the learner or educator.',
      storage: 'browser_memory_indexedDB_and_session_state',
      external_transmission_default: false,
      restricted_or_identifiable_data_allowed: 'institution_dependent',
      current_control: 'External AI use for local knowledge requires an explicit setting and institutional/source rights review.'
    }
  ],
  optional_external_providers: externalEndpoints.map((endpoint) => ({
    endpoint,
    enabled_by_default: false,
    approval_required_before_institutional_use: true
  })),
  required_institutional_reviews: [
    'FERPA or student-record review for cohort analytics and learner progress data.',
    'HIPAA/privacy review before any restricted clinical data or local case bundle is used with students.',
    'Security review for browser storage, API key handling, and optional external AI providers.',
    'IRB or education research determination before outcome studies.',
    'Accessibility review before required curricular use.',
    'Clinical content governance review before national deployment.'
  ],
  unresolved_controls: [
    'No approved institutional privacy/security SOP is present.',
    'No production monitoring or incident-response drill is complete.',
    'No completed WCAG audit is present.',
    'No load-test report for multi-school cohorts is present.',
    'No signed institutional review or data-processing agreement is present.'
  ]
};

writeFileSync(OUTPUT_PATH, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');
console.log(`Wrote governance data inventory with ${storageKeys.length} browser storage keys to ${OUTPUT_PATH}`);
