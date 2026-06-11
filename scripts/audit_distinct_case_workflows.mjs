import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPORT_JSON = join(ROOT, 'reports', 'distinct-case-workflow-audit-2026-06-09.json');
const REPORT_MD = join(ROOT, 'reports', 'distinct-case-workflow-audit-2026-06-09.md');
const TARGET_DISTINCT_CASES = 100;

const SOURCES = [
  {
    id: 'public_demo',
    label: 'Public demo cases',
    path: join(ROOT, 'frontend', 'src', 'data', 'cases.json'),
    restricted: false
  },
  {
    id: 'restricted_main_ed',
    label: 'Restricted local MIMIC ED-enriched cases',
    path: join(ROOT, 'data', 'restricted', 'mietic_mimic_main_ed_enriched_cases.restricted.json'),
    restricted: true
  },
  {
    id: 'restricted_ed_supplemental',
    label: 'Restricted local MIMIC-IV-ED supplemental cases',
    path: join(ROOT, 'data', 'restricted', 'mimic_iv_ed_supplemental_cases.restricted.json'),
    restricted: true
  },
  {
    id: 'restricted_main_duplicate_check',
    label: 'Restricted local MIMIC main-enriched cases',
    path: join(ROOT, 'data', 'restricted', 'mietic_mimic_main_enriched_cases.restricted.json'),
    restricted: true,
    duplicateCheckOnly: true
  }
];

function replaceNonFiniteJsonTokens(text) {
  const source = String(text || '');
  let output = '';
  let inString = false;
  let escaping = false;
  for (let index = 0; index < source.length;) {
    const char = source[index];
    if (inString) {
      output += char;
      if (escaping) {
        escaping = false;
      } else if (char === '\\') {
        escaping = true;
      } else if (char === '"') {
        inString = false;
      }
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

function readCaseSource(source) {
  if (!existsSync(source.path)) {
    return { ...source, missing: true, cases: [], nonFiniteTokens: 0 };
  }
  const rawText = readFileSync(source.path, 'utf8');
  const nonFiniteTokens = (rawText.match(/\bNaN\b|\b-?Infinity\b/g) || []).length;
  const parsed = JSON.parse(nonFiniteTokens ? replaceNonFiniteJsonTokens(rawText) : rawText);
  const cases = Array.isArray(parsed) ? parsed : parsed.cases || [];
  return { ...source, cases, nonFiniteTokens };
}

function hasMojibake(value) {
  return /æŽ³|Â°|�/.test(String(value || ''));
}

function caseId(caseData) {
  return caseData.id || caseData.case_id || '';
}

function hasPhysicalExamCoverage(caseData) {
  return (caseData.augmentation?.inferred_facts || []).some((fact) =>
    fact?.domain === 'physical_exam' || (fact?.use_in || []).includes('physical_exam')
  );
}

function vitalIssues(caseData) {
  const vitals = caseData.vitals || {};
  return ['temp', 'hr', 'rr', 'o2', 'sbp', 'dbp', 'pain']
    .filter((field) => vitals[field] === null || vitals[field] === undefined || Number.isNaN(Number(vitals[field])));
}

function auditCase(caseData, source, allSourceIds) {
  const issues = [];
  const addressed = [];
  const peculiarities = [];
  const id = caseId(caseData);

  if (!id) issues.push('Case is missing a stable id.');
  if (allSourceIds.length > 1) {
    peculiarities.push(`Duplicate case id appears in ${allSourceIds.length} source bundles.`);
  }
  if (!String(caseData.complaint || '').trim() || /#name\?/i.test(String(caseData.complaint || ''))) {
    issues.push('Learner-facing complaint is missing or invalid.');
    addressed.push('Runtime case normalization now derives a safe display complaint from the triage history when the source complaint is missing or corrupted.');
  }
  if (!String(caseData.history || '').trim()) {
    issues.push('Learner-facing triage history is missing.');
  }
  if (!Number.isFinite(Number(caseData.acuity)) || Number(caseData.acuity) < 1 || Number(caseData.acuity) > 5) {
    issues.push('Reference ESI acuity is missing or outside 1-5.');
  }
  const missingVitals = vitalIssues(caseData);
  if (missingVitals.length) {
    issues.push(`Structured vitals incomplete: ${missingVitals.join(', ')}.`);
    addressed.push('Local loader now converts generated non-finite tokens to null and vital display avoids invented zero values for missing BP components.');
  }
  if (!hasPhysicalExamCoverage(caseData)) {
    issues.push('Focused physical exam teaching coverage is missing.');
  }
  if (hasMojibake(`${caseData.complaint || ''} ${caseData.history || ''} ${caseData.outcome || ''}`)) {
    issues.push('Learner-facing text contains mojibake display artifact.');
    addressed.push('Runtime display normalization now removes known corrupted temperature-unit artifacts.');
  }
  if (source.restricted && !['clinical_case_v2', 'clinical_case_v3'].includes(caseData.schema_version)) {
    issues.push(`Restricted case schema ${caseData.schema_version || 'missing'} is not accepted by local MIMIC mode.`);
  }
  if (source.restricted && caseData.source_restriction !== 'credentialed_local_only') {
    issues.push('Restricted case is missing credentialed_local_only source restriction.');
  }
  if (source.restricted && !caseData.tasks_available?.triage) {
    issues.push('Restricted case does not advertise triage task availability.');
  }
  if (!issues.length) {
    peculiarities.push('No case-specific defect found by automated structural workflow audit.');
  }

  return {
    case_id: id,
    source_id: source.id,
    source_label: source.label,
    restricted: source.restricted,
    acuity: Number.isFinite(Number(caseData.acuity)) ? Number(caseData.acuity) : null,
    disposition: caseData.disposition || caseData.ground_truth?.disposition || '',
    schema_version: caseData.schema_version || '',
    issues,
    peculiarities,
    addressed
  };
}

function markdownTable(rows) {
  const lines = [
    '| # | Case ID | Source | ESI | Issues / Peculiarities | Fix Applied |',
    '|---:|---|---|---:|---|---|'
  ];
  for (const [index, row] of rows.entries()) {
    const notes = [...row.issues, ...row.peculiarities].join('<br>');
    const fixes = row.addressed.length ? row.addressed.join('<br>') : 'None needed or not fixable from available source data.';
    lines.push(`| ${index + 1} | ${row.case_id} | ${row.source_id} | ${row.acuity ?? ''} | ${notes || 'None'} | ${fixes} |`);
  }
  return lines.join('\n');
}

function main() {
  const loadedSources = SOURCES.map(readCaseSource);
  const uniqueCases = new Map();
  const duplicateSourcesById = new Map();
  const sourceSummaries = [];

  for (const source of loadedSources) {
    sourceSummaries.push({
      source_id: source.id,
      label: source.label,
      path: source.path.replace(`${ROOT}\\`, '').replace(`${ROOT}/`, ''),
      restricted: source.restricted,
      duplicate_check_only: Boolean(source.duplicateCheckOnly),
      missing: Boolean(source.missing),
      case_count: source.cases.length,
      non_finite_json_tokens: source.nonFiniteTokens
    });
    for (const caseData of source.cases) {
      const id = caseId(caseData);
      if (!id) continue;
      const sourceIds = duplicateSourcesById.get(id) || [];
      sourceIds.push(source.id);
      duplicateSourcesById.set(id, sourceIds);
      if (!source.duplicateCheckOnly && !uniqueCases.has(id)) {
        uniqueCases.set(id, { caseData, source });
      }
    }
  }

  const auditedRows = [...uniqueCases.values()]
    .slice(0, TARGET_DISTINCT_CASES)
    .map(({ caseData, source }) => auditCase(caseData, source, duplicateSourcesById.get(caseId(caseData)) || [source.id]));

  const duplicateCaseIds = [...duplicateSourcesById.entries()]
    .filter(([, sourceIds]) => sourceIds.length > 1)
    .map(([id, sourceIds]) => ({ case_id: id, source_ids: sourceIds }));

  const requirements = {
    target_distinct_cases: TARGET_DISTINCT_CASES,
    distinct_cases_available_for_audit: uniqueCases.size,
    distinct_cases_audited: auditedRows.length,
    shortfall: Math.max(0, TARGET_DISTINCT_CASES - uniqueCases.size),
    meets_target: uniqueCases.size >= TARGET_DISTINCT_CASES
  };

  const issueCounts = auditedRows.reduce((acc, row) => {
    for (const issue of row.issues) acc[issue] = (acc[issue] || 0) + 1;
    return acc;
  }, {});

  const artifact = {
    schema_version: 'distinct_case_workflow_audit_v1',
    generated_at: new Date().toISOString(),
    requirements,
    source_summaries: sourceSummaries,
    duplicate_case_ids: duplicateCaseIds,
    issue_counts: issueCounts,
    audited_cases: auditedRows,
    completion_status: requirements.meets_target
      ? 'target_met'
      : 'blocked_by_case_inventory_shortfall'
  };

  mkdirSync(dirname(REPORT_JSON), { recursive: true });
  writeFileSync(REPORT_JSON, `${JSON.stringify(artifact, null, 2)}\n`);

  const md = [
    '# Distinct Case Workflow Audit',
    '',
    `Generated: ${artifact.generated_at}`,
    '',
    '## Requirement Check',
    '',
    `- Target distinct cases: ${requirements.target_distinct_cases}`,
    `- Distinct cases available: ${requirements.distinct_cases_available_for_audit}`,
    `- Distinct cases audited: ${requirements.distinct_cases_audited}`,
    `- Shortfall: ${requirements.shortfall}`,
    `- Meets target: ${requirements.meets_target}`,
    '',
    '## Source Findings',
    '',
    ...sourceSummaries.map((source) =>
      `- ${source.source_id}: ${source.case_count} cases, ${source.non_finite_json_tokens} non-finite JSON tokens, duplicate-check-only=${source.duplicate_check_only}.`
    ),
    `- Duplicate case IDs across sources: ${duplicateCaseIds.length}`,
    '',
    '## Fixes Applied From This Audit Pass',
    '',
    '- Local restricted bundle loading now sanitizes generated `NaN`, `Infinity`, and `-Infinity` tokens to `null` before validation.',
    '- Local case bundle upload copy now points to `data/restricted/mietic_mimic_main_ed_enriched_cases.restricted.json`, the bundle actually present in this workspace.',
    '- Local restricted bundle loading now accepts the generated MIMIC-IV-ED supplemental bundle used to complete the 100 distinct case audit.',
    '- Runtime learner-display normalization now removes known corrupted temperature-unit artifacts.',
    '- Runtime case normalization now derives a safe display complaint when a restricted source complaint is missing or corrupted.',
    '- Runtime vital display now shows unavailable BP components instead of inventing zero-like values.',
    '',
    '## Per-Case Ledger',
    '',
    markdownTable(auditedRows),
    '',
    '## Completion Status',
    '',
    requirements.meets_target
      ? 'The repository contains at least 100 distinct auditable cases.'
      : `The repository currently contains ${requirements.distinct_cases_available_for_audit} distinct auditable cases, so the 100-case objective remains ${requirements.shortfall} cases short. Repeating duplicate case IDs was intentionally not counted as satisfying the requirement.`,
    ''
  ].join('\n');
  writeFileSync(REPORT_MD, md);

  console.log(JSON.stringify({
    report_json: REPORT_JSON,
    report_md: REPORT_MD,
    requirements,
    issue_counts: issueCounts,
    duplicate_case_ids: duplicateCaseIds.length
  }, null, 2));
}

main();
