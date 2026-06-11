import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_FRESHNESS_REPORT_PATH = join(ROOT, 'docs', 'source_freshness_report.json');
const OUTPUT_JSON_PATH = join(ROOT, 'docs', 'source_freshness_review_packets.json');
const OUTPUT_MD_PATH = join(ROOT, 'docs', 'source_freshness_review_packets.md');

const REVIEW_OUTCOMES = [
  'current_source_confirmed_for_formative_feedback',
  'current_source_confirmed_for_national_feedback',
  'replace_with_newer_public_source',
  'retire_or_quarantine_affected_chunks',
  'revise_claims_or_chunk_topic_mapping',
  'escalate_for_specialty_adjudication'
];

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function markdownEscape(value) {
  return cleanText(value).replaceAll('|', '\\|');
}

function countBy(items, selector) {
  return items.reduce((acc, item) => {
    const key = selector(item) || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function priorityForSource(source) {
  if (source.status === 'stale' && source.high_risk_quote_backed_chunks > 0) {
    return 'P0_stale_high_risk_learner_facing_source';
  }
  if (source.status === 'stale') return 'P1_stale_learner_facing_source';
  if (source.status === 'refresh_due_now') return 'P1_refresh_due_now';
  if (source.release_blocker) return 'P2_local_review_required';
  return 'P3_confirmation_required';
}

function requiredActionsForSource(source) {
  const actions = [
    'Confirm whether this is still the most current public source for the linked clinical claims.',
    'Record reviewer role, institution, review date, affected source id, and exact source version reviewed.',
    'Decide whether each affected learner-facing chunk remains usable, needs revision, should be replaced, or must be retired.'
  ];
  if (source.status === 'stale') {
    actions.unshift('Find and compare the newest guideline, toolkit, or society statement before any national learner-facing use.');
  }
  if (source.issue === 'missing_local_review_date') {
    actions.push('Add a real last_local_reviewed_at value only after medical librarian or clinician review is complete.');
  }
  if (source.high_risk_quote_backed_chunks > 0) {
    actions.push('Emergency clinician review is required because this source supports high-risk learner-facing feedback.');
  }
  return actions;
}

function reviewQuestionsForSource(source) {
  return [
    `Is "${source.title}" the latest appropriate public source for these learner-facing simulation claims as of the review date?`,
    'Do any quoted statements conflict with newer guideline recommendations, local institutional standards, or specialty practice norms?',
    'Are the affected chunks appropriate for medical-student simulation feedback, or do they need clearer limits, scope, or escalation language?',
    'Should this source remain formative-only, be approved for national learner-facing feedback, be replaced, or have affected chunks retired?'
  ];
}

function packetForSource(source) {
  return {
    id: `source_freshness_${source.source_id}`,
    source_id: source.source_id,
    review_status: 'pending_librarian_clinician_source_freshness_review',
    priority: priorityForSource(source),
    title: source.title,
    organization: source.organization || '',
    source_tier: source.source_tier,
    url: source.url,
    publication_date: source.publication_date,
    publication_year: source.publication_year,
    age_years: source.age_years,
    local_review_date: source.local_review_date || '',
    status: source.status,
    issue: source.issue,
    release_blocker: source.release_blocker,
    freshness_policy: source.freshness_policy,
    learner_facing_evidence_scope: {
      quote_backed_chunks: source.quote_backed_chunks,
      high_risk_quote_backed_chunks: source.high_risk_quote_backed_chunks,
      total_source_chunks: source.total_chunks,
      generated_needs_review_chunks: source.generated_needs_review_chunks,
      topic_sample: source.topic_sample || []
    },
    reviewer_roles_required: [
      'medical_librarian_or_evidence_reviewer',
      ...(source.high_risk_quote_backed_chunks > 0 ? ['emergency_clinician'] : []),
      'simulation_educator'
    ],
    review_scope: [
      'source currency and version check',
      'affected learner-facing quote-backed chunks',
      'high-risk topic suitability when applicable',
      'simulation feedback wording and limits',
      'decision on national learner-facing use'
    ],
    required_reviewer_actions: requiredActionsForSource(source),
    review_questions: reviewQuestionsForSource(source),
    acceptable_review_outcomes: REVIEW_OUTCOMES,
    approval_guardrails: [
      'Do not approve national release if a newer guideline supersedes the quoted recommendation and the affected chunks have not been revised.',
      'Do not add last_local_reviewed_at metadata unless a named reviewer, role, institution, and review date are recorded.',
      'Do not approve high-risk feedback from this source without emergency clinician review.',
      'Do not promote generated-needs-review chunks based on this source unless separate evidence chunk adjudication is complete.'
    ],
    review_submission_template: {
      source_id: source.source_id,
      review_outcome: 'pending',
      reviewed_by: [
        {
          name: '',
          role: '',
          institution: '',
          credential_or_position: ''
        }
      ],
      reviewed_at: '',
      source_version_or_access_date_reviewed: '',
      newest_source_confirmed: 'pending',
      replacement_source_id_or_url: '',
      affected_chunk_action: 'keep | revise | replace | retire | escalate',
      learner_facing_use: 'blocked | formative_only | approved_for_national_feedback',
      required_changes: [],
      signature_attestation: ''
    }
  };
}

function packetMarkdown(artifact) {
  const lines = [
    '# Source Freshness Review Packets',
    '',
    `Generated: ${artifact.generated_at}`,
    '',
    artifact.warning,
    '',
    '## Summary',
    '',
    `- Learner-facing sources packeted: ${artifact.summary.total_packets}`,
    `- Release-blocked packets: ${artifact.summary.release_blocked_packets}`,
    `- Stale packets: ${artifact.summary.stale_packets}`,
    `- Refresh due now packets: ${artifact.summary.refresh_due_now_packets}`,
    `- Missing local review-date packets: ${artifact.summary.local_review_date_missing_packets}`,
    `- High-risk learner-facing packets: ${artifact.summary.high_risk_quote_backed_packets}`,
    `- Ready for national release from freshness review: ${artifact.summary.ready_for_national_release_from_freshness_review}`,
    '',
    '## Review Queue',
    '',
    '| Priority | Source | Status | Age | Quote chunks | High-risk chunks | Required action |',
    '|---|---|---|---:|---:|---:|---|',
    ...artifact.source_review_packets.map((packet) =>
      `| ${packet.priority} | ${markdownEscape(packet.title)} | ${packet.status} | ${packet.age_years ?? 'n/a'} | ${packet.learner_facing_evidence_scope.quote_backed_chunks} | ${packet.learner_facing_evidence_scope.high_risk_quote_backed_chunks} | ${markdownEscape(packet.required_reviewer_actions[0])} |`
    ),
    '',
    '## Reviewer Output',
    '',
    'Completed reviews should update source metadata only after the reviewer identity, role, institution, review date, source version/access date, outcome, and affected chunk action are recorded. These packets do not constitute approval by themselves.'
  ];
  return `${lines.join('\n')}\n`;
}

const sourceFreshnessReport = readJson(SOURCE_FRESHNESS_REPORT_PATH);
const sourceRowsById = new Map((sourceFreshnessReport.source_rows || []).map((source) => [source.source_id, source]));
const learnerFacingSources = (sourceFreshnessReport.learner_facing_quote_backed_sources || [])
  .map((source) => ({
    ...sourceRowsById.get(source.source_id),
    ...source
  }))
  .sort((a, b) =>
    priorityForSource(a).localeCompare(priorityForSource(b))
      || Number(b.release_blocker) - Number(a.release_blocker)
      || (b.age_years ?? -1) - (a.age_years ?? -1)
      || a.source_id.localeCompare(b.source_id)
  );

const packets = learnerFacingSources.map(packetForSource);
const releaseBlockedPackets = packets.filter((packet) => packet.release_blocker);
const pendingPackets = packets.filter((packet) => packet.review_status === 'pending_librarian_clinician_source_freshness_review');
const learnerFacingSourceIds = new Set(sourceFreshnessReport.learner_facing_quote_backed_sources.map((source) => source.source_id));
const packetSourceIds = new Set(packets.map((packet) => packet.source_id));
const missingPacketSourceIds = [...learnerFacingSourceIds].filter((sourceId) => !packetSourceIds.has(sourceId));

const artifact = {
  schema_version: 'source_freshness_review_packets_v1',
  generated_at: new Date().toISOString(),
  review_status: releaseBlockedPackets.length > 0
    ? 'source_freshness_review_packets_release_blockers_pending'
    : 'source_freshness_review_packets_confirmation_pending',
  warning: 'These packets organize source-currency review work for learner-facing quote-backed evidence. They do not prove clinical accuracy, source currency, or national-release approval.',
  source_contract: {
    source_freshness_report_schema: sourceFreshnessReport.schema_version,
    source_freshness_report_path: 'docs/source_freshness_report.json',
    learner_facing_quote_backed_sources_in_report: sourceFreshnessReport.summary.learner_facing_quote_backed_sources,
    generated_needs_review_evidence_allowed_for_learner_feedback: false,
    local_review_date_may_be_added_only_after_completed_review: true
  },
  summary: {
    total_packets: packets.length,
    learner_facing_quote_backed_sources: sourceFreshnessReport.summary.learner_facing_quote_backed_sources,
    all_learner_facing_sources_packeted: missingPacketSourceIds.length === 0
      && packets.length === sourceFreshnessReport.summary.learner_facing_quote_backed_sources,
    missing_packet_source_ids: missingPacketSourceIds,
    release_blocked_packets: releaseBlockedPackets.length,
    stale_packets: packets.filter((packet) => packet.status === 'stale').length,
    refresh_due_now_packets: packets.filter((packet) => packet.status === 'refresh_due_now').length,
    local_review_date_missing_packets: packets.filter((packet) => !packet.local_review_date).length,
    high_risk_quote_backed_packets: packets.filter((packet) => packet.learner_facing_evidence_scope.high_risk_quote_backed_chunks > 0).length,
    reviewed_packets: 0,
    pending_review_packets: pendingPackets.length,
    status_counts: countBy(packets, (packet) => packet.status),
    priority_counts: countBy(packets, (packet) => packet.priority),
    source_freshness_report_release_ready:
      Boolean(sourceFreshnessReport.summary.learner_facing_source_freshness_release_ready),
    ready_for_national_release_from_freshness_review: false
  },
  review_submission_template: {
    schema_version: 'source_freshness_reviews_v1',
    source_reviews: [
      packets[0]?.review_submission_template || {
        source_id: '',
        review_outcome: 'pending',
        reviewed_by: [],
        reviewed_at: '',
        source_version_or_access_date_reviewed: '',
        newest_source_confirmed: 'pending',
        replacement_source_id_or_url: '',
        affected_chunk_action: 'keep | revise | replace | retire | escalate',
        learner_facing_use: 'blocked | formative_only | approved_for_national_feedback',
        required_changes: [],
        signature_attestation: ''
      }
    ]
  },
  source_review_packets: packets,
  release_blockers: [
    {
      id: 'learner_facing_source_freshness_release_blocked',
      status: releaseBlockedPackets.length === 0 ? 'cleared' : 'blocked',
      evidence: {
        release_blocked_packets: releaseBlockedPackets.length,
        learner_facing_quote_backed_sources:
          sourceFreshnessReport.summary.learner_facing_quote_backed_sources
      },
      required_to_clear: 'Complete source currency review and resolve stale, refresh-due, or missing local review-date blockers for every learner-facing quote-backed source.'
    },
    {
      id: 'source_reviews_not_completed',
      status: pendingPackets.length === 0 && packets.length > 0 ? 'cleared' : 'blocked',
      evidence: {
        pending_review_packets: pendingPackets.length,
        reviewed_packets: 0
      },
      required_to_clear: 'Record completed librarian, clinician, and simulation educator review outcomes before national release.'
    }
  ]
};

writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
writeFileSync(OUTPUT_MD_PATH, packetMarkdown(artifact), 'utf8');

console.log(JSON.stringify({
  review_status: artifact.review_status,
  total_packets: artifact.summary.total_packets,
  release_blocked_packets: artifact.summary.release_blocked_packets,
  stale_packets: artifact.summary.stale_packets,
  report_path: OUTPUT_JSON_PATH
}, null, 2));
