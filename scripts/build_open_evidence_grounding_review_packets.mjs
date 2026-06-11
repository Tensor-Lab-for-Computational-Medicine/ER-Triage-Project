import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EVIDENCE_BACKLOG_PATH = join(ROOT, 'docs', 'evidence_review_backlog.json');
const EVIDENCE_DASHBOARD_PATH = join(ROOT, 'docs', 'evidence_quality_dashboard.json');
const SOURCE_FRESHNESS_REVIEW_PACKETS_PATH = join(ROOT, 'docs', 'source_freshness_review_packets.json');
const CLAIM_REFERENCE_GAP_REVIEW_PACKETS_PATH = join(ROOT, 'docs', 'claim_reference_gap_review_packets.json');
const SOURCE_LINK_QUOTE_VERIFICATION_REPORT_PATH = join(ROOT, 'docs', 'source_link_quote_verification_report.json');
const HIGH_RISK_QUOTE_COVERAGE_DEPTH_REPORT_PATH = join(ROOT, 'docs', 'high_risk_quote_coverage_depth_report.json');
const OUTPUT_JSON_PATH = join(ROOT, 'docs', 'open_evidence_grounding_review_packets.json');
const OUTPUT_MD_PATH = join(ROOT, 'docs', 'open_evidence_grounding_review_packets.md');

const PRIORITY_RANK = {
  P1_high_risk_clinical_safety: 1,
  P2_management_or_disposition_safety: 2,
  P3_guideline_source_grounding: 3,
  P4_background_reference_review: 4
};

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

function roleForBlockerOwner(owner = '') {
  const roles = [];
  if (/clinician|clinical/i.test(owner)) roles.push('emergency_medicine_clinician');
  if (/librarian|evidence/i.test(owner)) roles.push('medical_librarian_or_evidence_reviewer');
  if (/educator|simulation/i.test(owner)) roles.push('simulation_educator');
  if (!roles.length) roles.push('open_evidence_review_owner');
  return [...new Set(roles)];
}

function batchReviewStatus(batch) {
  if (batch.priority === 'P1_high_risk_clinical_safety') {
    return 'pending_high_risk_clinician_librarian_grounding_review';
  }
  if (batch.priority === 'P2_management_or_disposition_safety') {
    return 'pending_management_disposition_grounding_review';
  }
  return 'pending_open_evidence_locator_and_claim_review';
}

function batchPacket(batch, reviewerRoles) {
  return {
    id: `open_evidence_batch_${batch.batch_id}`,
    packet_type: 'generated_backlog_batch_grounding_review',
    batch_id: batch.batch_id,
    priority: batch.priority,
    review_status: batchReviewStatus(batch),
    current_release_use: 'quarantined_not_learner_facing',
    source_id: batch.source_id,
    source_title: batch.source_title,
    source_tier: batch.source_tier,
    facet_id: batch.facet_id,
    pending_chunk_count: batch.pending_chunk_count,
    topic_tags: batch.topic_tags || [],
    generated_needs_review_chunks_allowed_for_learner_feedback: false,
    reviewer_roles_required: reviewerRoles,
    review_scope: [
      'source locator verification',
      'claim-to-source entailment',
      'clinical accuracy and contraindications',
      'medical-student simulation wording',
      'learner-facing release decision'
    ],
    required_reviewer_actions: [
      'Replace generated public-safe summaries with quote-backed excerpts or clinician-approved paraphrases tied to a stable locator.',
      'Confirm whether the source actually supports each chunk claim at the stated emergency-care scope.',
      'Record section, page, DOI/PMID, stable URL, quote hash, or manual verification evidence where available.',
      'Decide whether each chunk can support deterministic feedback, should remain formative background only, or must be retired.'
    ],
    acceptance_criteria: [
      'No generated-needs-review chunk is promoted without reviewer identity, role, institution, review date, and locator evidence.',
      'High-risk clinical safety packets require emergency clinician and source/library review.',
      'Management, medication, procedure, disposition, and reassessment claims require explicit contraindication and scope review.',
      'Any local-practice variation, pediatric, pregnancy, geriatric, disability, or language-access limitation is documented before learner-facing use.',
      'The packet remains blocked until all included chunks are replaced, retired, or formally adjudicated.'
    ],
    representative_chunks: batch.representative_chunks || [],
    review_submission_template: {
      batch_id: batch.batch_id,
      review_decision:
        'replace_with_quote_backed_chunks | approve_with_clinician_adjudication | background_only | retire_or_quarantine',
      reviewed_by: reviewerRoles.map((role) => ({
        role,
        name: '',
        institution: '',
        credential_or_position: ''
      })),
      reviewed_at: '',
      source_version_or_access_date_reviewed: '',
      locator_evidence_added: [],
      chunk_ids_approved_for_learner_feedback: [],
      chunk_ids_background_only: [],
      chunk_ids_retired_or_quarantined: [],
      clinical_scope_limits: '',
      required_changes: [],
      signature_attestation: ''
    }
  };
}

function releaseBlockerPacket(blocker) {
  const currentReady = blocker.status === 'cleared';
  return {
    id: `open_evidence_release_blocker_${blocker.id}`,
    packet_type: 'open_evidence_release_blocker_review',
    blocker_id: blocker.id,
    priority: currentReady ? 'P4_evidence_release_check_cleared' : 'P0_open_evidence_release_blocker',
    review_status: currentReady ? 'cleared_by_current_artifact' : 'pending_open_evidence_release_blocker_review',
    current_ready: currentReady,
    current_value: blocker.current_value,
    required_value: blocker.required_value,
    owner: blocker.owner,
    reviewer_roles_required: roleForBlockerOwner(blocker.owner),
    action: blocker.action,
    acceptance_criteria: [
      'The blocker is cleared in the authoritative source artifact.',
      'The clearing evidence does not rely on generated-needs-review chunks as learner-facing support.',
      'Any clinical, librarian/source, simulation educator, or institutional review evidence required by the blocker is present and valid.'
    ]
  };
}

function markdown(artifact) {
  const topPackets = artifact.generated_backlog_review_packets
    .slice()
    .sort((a, b) => {
      const priorityDelta = (PRIORITY_RANK[a.priority] || 9) - (PRIORITY_RANK[b.priority] || 9);
      if (priorityDelta !== 0) return priorityDelta;
      return b.pending_chunk_count - a.pending_chunk_count;
    })
    .slice(0, 40);

  const lines = [
    '# Open Evidence Grounding Review Packets',
    '',
    `Generated: ${artifact.generated_at}`,
    '',
    artifact.warning,
    '',
    '## Summary',
    '',
    `- Total review packets: ${artifact.summary.total_review_packets}`,
    `- Generated backlog batch packets: ${artifact.summary.generated_backlog_review_packets}`,
    `- Release blocker packets: ${artifact.summary.release_blocker_packets}`,
    `- Generated-needs-review chunks packeted: ${artifact.summary.generated_needs_review_chunks_packeted}`,
    `- All backlog batches packeted: ${artifact.summary.all_review_batches_packeted}`,
    `- Pending review packets: ${artifact.summary.pending_review_packets}`,
    `- Generated-needs-review evidence allowed for learner feedback: ${artifact.summary.generated_needs_review_evidence_allowed_for_learner_feedback}`,
    `- Ready for national open-evidence release from packets: ${artifact.summary.ready_for_national_open_evidence_release_from_packets}`,
    '',
    '## Release Blockers',
    '',
    '| Blocker | Status | Current | Required | Owner |',
    '|---|---|---:|---:|---|',
    ...artifact.release_blocker_packets.map((packet) =>
      `| ${packet.blocker_id} | ${packet.review_status} | ${packet.current_value} | ${packet.required_value} | ${markdownEscape(packet.owner)} |`
    ),
    '',
    '## Top Backlog Packets',
    '',
    '| Priority | Batch | Source | Facet | Chunks | Topics |',
    '|---|---|---|---|---:|---|',
    ...topPackets.map((packet) =>
      `| ${packet.priority} | ${packet.batch_id} | ${markdownEscape(packet.source_title || packet.source_id)} | ${packet.facet_id} | ${packet.pending_chunk_count} | ${markdownEscape((packet.topic_tags || []).slice(0, 5).join(', '))} |`
    ),
    '',
    '## Reviewer Output',
    '',
    'Completed evidence reviews should be recorded through the existing evidence adjudication workflow and source-specific review files. These packets organize replacement and review work; they do not promote generated evidence or approve national learner-facing use.'
  ];
  return `${lines.join('\n')}\n`;
}

const evidenceBacklog = readJson(EVIDENCE_BACKLOG_PATH);
const evidenceDashboard = readJson(EVIDENCE_DASHBOARD_PATH);
const sourceFreshnessReviewPackets = readJson(SOURCE_FRESHNESS_REVIEW_PACKETS_PATH);
const claimReferenceGapReviewPackets = readJson(CLAIM_REFERENCE_GAP_REVIEW_PACKETS_PATH);
const sourceLinkQuoteVerificationReport = readJson(SOURCE_LINK_QUOTE_VERIFICATION_REPORT_PATH);
const highRiskQuoteCoverageDepthReport = readJson(HIGH_RISK_QUOTE_COVERAGE_DEPTH_REPORT_PATH);

const reviewerRoles = evidenceBacklog.review_policy?.required_reviewer_roles || [
  'emergency_medicine_clinician',
  'medical_educator',
  'source_or_library_reviewer_for_locator_quality'
];
const generatedBacklogReviewPackets = (evidenceBacklog.review_batches || []).map((batch) =>
  batchPacket(batch, reviewerRoles)
);
const releaseBlockerPackets = (evidenceDashboard.release_blockers || []).map(releaseBlockerPacket);
const pendingReleaseBlockers = releaseBlockerPackets.filter((packet) => !packet.current_ready);
const generatedNeedsReviewChunksPacketed = generatedBacklogReviewPackets.reduce(
  (sum, packet) => sum + packet.pending_chunk_count,
  0
);
const allReviewBatchesPacketed =
  generatedBacklogReviewPackets.length === evidenceBacklog.summary?.pending_review_batch_count
  && generatedNeedsReviewChunksPacketed === evidenceBacklog.summary?.pending_generated_or_unverified_chunks;
const readyForNationalOpenEvidenceRelease =
  Boolean(evidenceDashboard.summary?.dashboard_release_ready)
  && generatedBacklogReviewPackets.length === 0
  && pendingReleaseBlockers.length === 0;

const artifact = {
  schema_version: 'open_evidence_grounding_review_packets_v1',
  generated_at: new Date().toISOString(),
  review_status: 'open_evidence_grounding_packets_open_source_review_required',
  warning:
    'These packets organize open-evidence replacement, source-locator, clinician, and librarian review work. They do not approve generated-needs-review chunks, prove medical accuracy, or authorize national learner-facing feedback.',
  source_contract: {
    evidence_review_backlog_schema: evidenceBacklog.schema_version,
    evidence_quality_dashboard_schema: evidenceDashboard.schema_version,
    source_freshness_review_packets_schema: sourceFreshnessReviewPackets.schema_version,
    claim_reference_gap_review_packets_schema: claimReferenceGapReviewPackets.schema_version,
    source_link_quote_verification_schema: sourceLinkQuoteVerificationReport.schema_version,
    high_risk_quote_coverage_depth_schema: highRiskQuoteCoverageDepthReport.schema_version,
    generated_needs_review_evidence_allowed_for_learner_feedback: false
  },
  summary: {
    total_review_packets: generatedBacklogReviewPackets.length + releaseBlockerPackets.length,
    generated_backlog_review_packets: generatedBacklogReviewPackets.length,
    release_blocker_packets: releaseBlockerPackets.length,
    pending_generated_backlog_review_packets: generatedBacklogReviewPackets.length,
    pending_release_blocker_packets: pendingReleaseBlockers.length,
    pending_review_packets: generatedBacklogReviewPackets.length + pendingReleaseBlockers.length,
    generated_needs_review_chunks_packeted: generatedNeedsReviewChunksPacketed,
    pending_review_batches_in_backlog: evidenceBacklog.summary?.pending_review_batch_count || 0,
    all_review_batches_packeted: allReviewBatchesPacketed,
    generated_needs_review_evidence_allowed_for_learner_feedback: false,
    high_risk_clinical_safety_packets:
      generatedBacklogReviewPackets.filter((packet) => packet.priority === 'P1_high_risk_clinical_safety').length,
    management_or_disposition_safety_packets:
      generatedBacklogReviewPackets.filter((packet) => packet.priority === 'P2_management_or_disposition_safety').length,
    guideline_source_grounding_packets:
      generatedBacklogReviewPackets.filter((packet) => packet.priority === 'P3_guideline_source_grounding').length,
    priority_counts: countBy(generatedBacklogReviewPackets, (packet) => packet.priority),
    facet_counts: countBy(generatedBacklogReviewPackets, (packet) => packet.facet_id),
    release_blocker_status_counts: countBy(releaseBlockerPackets, (packet) => packet.review_status),
    ready_for_national_open_evidence_release_from_packets: readyForNationalOpenEvidenceRelease
  },
  generated_backlog_review_packets: generatedBacklogReviewPackets,
  release_blocker_packets: releaseBlockerPackets,
  release_blockers: [
    {
      id: 'generated_backlog_batches_pending_review',
      status: generatedBacklogReviewPackets.length > 0 ? 'blocked' : 'cleared',
      count: generatedBacklogReviewPackets.length,
      description: 'Generated-needs-review backlog batches require source replacement, retirement, or formal evidence adjudication.'
    },
    {
      id: 'open_evidence_release_blockers_pending',
      status: pendingReleaseBlockers.length > 0 ? 'blocked' : 'cleared',
      count: pendingReleaseBlockers.length,
      description: 'Evidence dashboard release blockers must be cleared before national learner-facing evidence release.'
    }
  ]
};

writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
writeFileSync(OUTPUT_MD_PATH, markdown(artifact), 'utf8');

console.log(JSON.stringify({
  review_status: artifact.review_status,
  total_review_packets: artifact.summary.total_review_packets,
  generated_backlog_review_packets: artifact.summary.generated_backlog_review_packets,
  release_blocker_packets: artifact.summary.release_blocker_packets,
  generated_needs_review_chunks_packeted: artifact.summary.generated_needs_review_chunks_packeted,
  all_review_batches_packeted: artifact.summary.all_review_batches_packeted,
  ready_for_national_open_evidence_release_from_packets:
    artifact.summary.ready_for_national_open_evidence_release_from_packets,
  report_path: OUTPUT_JSON_PATH
}, null, 2));
