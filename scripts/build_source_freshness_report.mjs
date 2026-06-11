import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLE_PATH = join(ROOT, 'frontend', 'src', 'data', 'public_clinical_knowledge_bundle.json');
const QUALITY_REPORT_PATH = join(ROOT, 'frontend', 'src', 'data', 'public_clinical_source_quality_report.json');
const JSON_OUTPUT_PATH = join(ROOT, 'docs', 'source_freshness_report.json');
const MD_OUTPUT_PATH = join(ROOT, 'docs', 'source_freshness_report.md');

const DEFAULT_POLICY = {
  ed_specific_guideline: { max_age_years: 5, warning_age_years: 4, local_review_interval_months: 12 },
  society_guideline: { max_age_years: 5, warning_age_years: 4, local_review_interval_months: 12 },
  systematic_review: { max_age_years: 5, warning_age_years: 4, local_review_interval_months: 18 },
  primary_study: { max_age_years: 7, warning_age_years: 6, local_review_interval_months: 24 },
  textbook: { max_age_years: 5, warning_age_years: 4, local_review_interval_months: 12 },
  local_teaching_note: { max_age_years: 1, warning_age_years: 1, local_review_interval_months: 6 },
  unknown: { max_age_years: 5, warning_age_years: 4, local_review_interval_months: 12 }
};

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function markdownEscape(value) {
  return String(value ?? '').replaceAll('|', '\\|').replace(/\s+/g, ' ').trim();
}

function parsePublicationYear(value) {
  const match = String(value || '').match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

function countBy(items, selector) {
  return items.reduce((acc, item) => {
    const key = selector(item) || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function monthsSince(dateText, asOfDate) {
  if (!dateText) return null;
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return null;
  return ((asOfDate.getFullYear() - date.getFullYear()) * 12) + (asOfDate.getMonth() - date.getMonth());
}

function sourcePolicy(source) {
  return DEFAULT_POLICY[source.source_tier] || DEFAULT_POLICY.unknown;
}

function statusForSource(source, asOfYear, asOfDate) {
  const policy = sourcePolicy(source);
  const publicationYear = parsePublicationYear(source.publication_date);
  const ageYears = publicationYear === null ? null : asOfYear - publicationYear;
  const localReviewMonths = monthsSince(source.last_local_reviewed_at || source.last_reviewed_at || '', asOfDate);
  const missingLocalReviewDate = localReviewMonths === null;

  if (publicationYear === null) {
    return {
      publication_year: null,
      age_years: null,
      local_review_months: localReviewMonths,
      status: 'metadata_gap',
      release_blocker: true,
      issue: 'missing_publication_year'
    };
  }
  if (publicationYear > asOfYear) {
    return {
      publication_year: publicationYear,
      age_years: ageYears,
      local_review_months: localReviewMonths,
      status: 'future_metadata',
      release_blocker: true,
      issue: 'publication_year_after_as_of_year'
    };
  }
  if (ageYears > policy.max_age_years) {
    return {
      publication_year: publicationYear,
      age_years: ageYears,
      local_review_months: localReviewMonths,
      status: 'stale',
      release_blocker: true,
      issue: 'publication_age_exceeds_policy'
    };
  }
  if (missingLocalReviewDate) {
    return {
      publication_year: publicationYear,
      age_years: ageYears,
      local_review_months: localReviewMonths,
      status: ageYears >= policy.warning_age_years ? 'refresh_due_now' : 'local_review_date_missing',
      release_blocker: true,
      issue: 'missing_local_review_date'
    };
  }
  if (localReviewMonths > policy.local_review_interval_months) {
    return {
      publication_year: publicationYear,
      age_years: ageYears,
      local_review_months: localReviewMonths,
      status: 'local_review_overdue',
      release_blocker: true,
      issue: 'local_review_interval_exceeded'
    };
  }
  if (ageYears >= policy.warning_age_years) {
    return {
      publication_year: publicationYear,
      age_years: ageYears,
      local_review_months: localReviewMonths,
      status: 'refresh_due_soon',
      release_blocker: false,
      issue: 'publication_age_near_policy_limit'
    };
  }
  return {
    publication_year: publicationYear,
    age_years: ageYears,
    local_review_months: localReviewMonths,
    status: 'current',
    release_blocker: false,
    issue: ''
  };
}

function sourceChunkCounts(chunks) {
  const counts = {};
  for (const chunk of chunks) {
    const id = chunk.source_id || 'unknown';
    counts[id] ||= {
      total_chunks: 0,
      quote_backed_chunks: 0,
      generated_needs_review_chunks: 0,
      high_risk_quote_backed_chunks: 0,
      topics: new Set()
    };
    counts[id].total_chunks += 1;
    if (chunk.evidence_status === 'quote_backed' || chunk.quote_backed) counts[id].quote_backed_chunks += 1;
    if (chunk.evidence_status === 'generated_needs_review') counts[id].generated_needs_review_chunks += 1;
    for (const tag of chunk.topic_tags || []) counts[id].topics.add(tag);
  }
  return counts;
}

function buildReport() {
  const bundle = readJson(BUNDLE_PATH);
  const qualityReport = readJson(QUALITY_REPORT_PATH);
  const asOfDate = new Date(`${process.env.SOURCE_FRESHNESS_AS_OF_DATE || new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const asOfYear = asOfDate.getUTCFullYear();
  const highRiskTopics = new Set(qualityReport.high_risk_quote_core_topics || []);
  const chunkCounts = sourceChunkCounts(bundle.chunks || []);

  const learnerFacingQuoteBackedSourceIds = new Set(
    (bundle.chunks || [])
      .filter((chunk) => chunk.evidence_status === 'quote_backed' || chunk.quote_backed)
      .map((chunk) => chunk.source_id)
      .filter(Boolean)
  );

  for (const chunk of bundle.chunks || []) {
    if (!(chunk.evidence_status === 'quote_backed' || chunk.quote_backed)) continue;
    if (!(chunk.topic_tags || []).some((tag) => highRiskTopics.has(tag))) continue;
    const counts = chunkCounts[chunk.source_id];
    if (counts) counts.high_risk_quote_backed_chunks += 1;
  }

  const sources = (bundle.sources || []).map((source) => {
    const policy = sourcePolicy(source);
    const status = statusForSource(source, asOfYear, asOfDate);
    const counts = chunkCounts[source.id] || {
      total_chunks: 0,
      quote_backed_chunks: 0,
      generated_needs_review_chunks: 0,
      high_risk_quote_backed_chunks: 0,
      topics: new Set()
    };
    return {
      source_id: source.id,
      title: source.title,
      organization: source.organization,
      source_tier: source.source_tier || 'unknown',
      publication_date: source.publication_date || '',
      publication_year: status.publication_year,
      age_years: status.age_years,
      local_review_date: source.last_local_reviewed_at || source.last_reviewed_at || '',
      local_review_months: status.local_review_months,
      url: source.url || '',
      status: status.status,
      issue: status.issue,
      release_blocker: status.release_blocker,
      freshness_policy: policy,
      total_chunks: counts.total_chunks,
      quote_backed_chunks: counts.quote_backed_chunks,
      generated_needs_review_chunks: counts.generated_needs_review_chunks,
      high_risk_quote_backed_chunks: counts.high_risk_quote_backed_chunks,
      learner_facing_quote_backed_source: learnerFacingQuoteBackedSourceIds.has(source.id),
      topic_sample: [...counts.topics].sort().slice(0, 8)
    };
  });

  const learnerFacingSources = sources.filter((source) => source.learner_facing_quote_backed_source);
  const staleOrBlockedLearnerFacingSources = learnerFacingSources.filter((source) => source.release_blocker);
  const staleLearnerFacingSources = learnerFacingSources.filter((source) => source.status === 'stale');
  const missingLocalReviewDateSources = sources.filter((source) => !source.local_review_date);
  const missingUrlSources = sources.filter((source) => !source.url);
  const metadataGapSources = sources.filter((source) => source.status === 'metadata_gap' || source.status === 'future_metadata');

  const summary = {
    total_sources: sources.length,
    total_chunks: bundle.chunks?.length || 0,
    as_of_date: asOfDate.toISOString().slice(0, 10),
    policy_tiers: Object.keys(DEFAULT_POLICY).length,
    status_counts: countBy(sources, (source) => source.status),
    source_tier_counts: countBy(sources, (source) => source.source_tier),
    sources_with_publication_year: sources.filter((source) => source.publication_year !== null).length,
    missing_publication_year_sources: sources.filter((source) => source.publication_year === null).length,
    future_publication_year_sources: sources.filter((source) => source.status === 'future_metadata').length,
    stale_sources: sources.filter((source) => source.status === 'stale').length,
    refresh_due_now_sources: sources.filter((source) => source.status === 'refresh_due_now').length,
    refresh_due_soon_sources: sources.filter((source) => source.status === 'refresh_due_soon').length,
    missing_local_review_date_sources: missingLocalReviewDateSources.length,
    missing_url_sources: missingUrlSources.length,
    learner_facing_quote_backed_sources: learnerFacingSources.length,
    learner_facing_quote_backed_sources_release_blocked: staleOrBlockedLearnerFacingSources.length,
    stale_learner_facing_quote_backed_sources: staleLearnerFacingSources.length,
    high_risk_quote_backed_sources: learnerFacingSources.filter((source) => source.high_risk_quote_backed_chunks > 0).length,
    high_risk_quote_backed_sources_release_blocked: staleOrBlockedLearnerFacingSources.filter((source) => source.high_risk_quote_backed_chunks > 0).length,
    learner_facing_source_freshness_release_ready:
      learnerFacingSources.length > 0
      && staleOrBlockedLearnerFacingSources.length === 0
      && metadataGapSources.length === 0
      && missingUrlSources.length === 0
  };

  const report = {
    schema_version: 'source_freshness_report_v1',
    generated_at: new Date().toISOString(),
    review_status: summary.learner_facing_source_freshness_release_ready
      ? 'source_freshness_policy_passed_manual_review_required'
      : 'source_freshness_policy_gaps_found_manual_review_required',
    warning: 'This report checks source metadata age, local review-date presence, and refresh policy conformance. It does not prove that a source is the latest guideline or that the quoted claim is clinically correct.',
    source_contract: {
      public_knowledge_bundle_schema: bundle.schema_version,
      public_source_quality_report_schema: qualityReport.schema_version,
      source_metadata_fields_checked: [
        'publication_date',
        'source_tier',
        'url',
        'last_local_reviewed_at_or_last_reviewed_at'
      ],
      learner_facing_scope: 'quote_backed_sources_with_high_risk_topic_accounting'
    },
    freshness_policy: DEFAULT_POLICY,
    summary,
    learner_facing_quote_backed_sources: learnerFacingSources
      .sort((a, b) => Number(b.release_blocker) - Number(a.release_blocker) || b.age_years - a.age_years)
      .map((source) => ({
        source_id: source.source_id,
        title: source.title,
        source_tier: source.source_tier,
        publication_date: source.publication_date,
        publication_year: source.publication_year,
        age_years: source.age_years,
        status: source.status,
        issue: source.issue,
        release_blocker: source.release_blocker,
        quote_backed_chunks: source.quote_backed_chunks,
        high_risk_quote_backed_chunks: source.high_risk_quote_backed_chunks,
        local_review_date: source.local_review_date,
        url: source.url
      })),
    source_rows: sources.sort((a, b) => Number(b.release_blocker) - Number(a.release_blocker) || (b.age_years ?? -1) - (a.age_years ?? -1)),
    next_actions: [
      'Add last_local_reviewed_at after clinician/librarian review of each source used for learner-facing feedback.',
      'Replace or re-review stale learner-facing sources before national release.',
      'Verify whether broad source indexes still point to the newest guideline version before using them for summative learner feedback.',
      'Keep this report in the readiness chain so source-age regressions are visible before deployment.'
    ]
  };

  writeFileSync(JSON_OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(MD_OUTPUT_PATH, markdown(report), 'utf8');
  return report;
}

function markdown(report) {
  const lines = [
    '# Source Freshness Report',
    '',
    `Generated at: ${report.generated_at}`,
    `As of: ${report.summary.as_of_date}`,
    '',
    report.warning,
    '',
    '## Summary',
    '',
    `- Sources: ${report.summary.total_sources}`,
    `- Sources with publication year: ${report.summary.sources_with_publication_year}`,
    `- Missing publication year sources: ${report.summary.missing_publication_year_sources}`,
    `- Stale sources: ${report.summary.stale_sources}`,
    `- Refresh due now sources: ${report.summary.refresh_due_now_sources}`,
    `- Missing local review-date sources: ${report.summary.missing_local_review_date_sources}`,
    `- Learner-facing quote-backed sources: ${report.summary.learner_facing_quote_backed_sources}`,
    `- Learner-facing quote-backed sources release-blocked: ${report.summary.learner_facing_quote_backed_sources_release_blocked}`,
    `- Stale learner-facing quote-backed sources: ${report.summary.stale_learner_facing_quote_backed_sources}`,
    `- Learner-facing source freshness release ready: ${report.summary.learner_facing_source_freshness_release_ready}`,
    '',
    '## Policy',
    '',
    '| Source tier | Max age years | Warning age years | Local review interval months |',
    '|---|---:|---:|---:|',
    ...Object.entries(report.freshness_policy).map(([tier, policy]) =>
      `| ${tier} | ${policy.max_age_years} | ${policy.warning_age_years} | ${policy.local_review_interval_months} |`
    ),
    '',
    '## Learner-Facing Quote-Backed Sources',
    '',
    '| Source | Status | Age | Quote-backed chunks | High-risk quote-backed chunks | Issue |',
    '|---|---|---:|---:|---:|---|',
    ...report.learner_facing_quote_backed_sources.map((source) =>
      `| ${markdownEscape(source.title)} | ${source.status} | ${source.age_years ?? 'n/a'} | ${source.quote_backed_chunks} | ${source.high_risk_quote_backed_chunks} | ${markdownEscape(source.issue)} |`
    ),
    '',
    '## Next Actions',
    '',
    ...report.next_actions.map((action) => `- ${action}`)
  ];
  return `${lines.join('\n')}\n`;
}

const report = buildReport();
console.log(JSON.stringify({
  review_status: report.review_status,
  total_sources: report.summary.total_sources,
  stale_sources: report.summary.stale_sources,
  learner_facing_quote_backed_sources: report.summary.learner_facing_quote_backed_sources,
  learner_facing_quote_backed_sources_release_blocked:
    report.summary.learner_facing_quote_backed_sources_release_blocked,
  report_path: JSON_OUTPUT_PATH
}, null, 2));
