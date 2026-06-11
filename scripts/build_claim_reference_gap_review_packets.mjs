import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KNOWLEDGE_BUNDLE_PATH = join(ROOT, 'frontend', 'src', 'data', 'public_clinical_knowledge_bundle.json');
const CLAIM_REFERENCE_ALIGNMENT_REPORT_PATH = join(ROOT, 'docs', 'feedback_claim_reference_alignment_report.json');
const CLAIM_REVIEW_PACKETS_PATH = join(ROOT, 'docs', 'feedback_claim_entailment_review_packets.json');
const JSON_OUTPUT_PATH = join(ROOT, 'docs', 'claim_reference_gap_review_packets.json');
const MD_OUTPUT_PATH = join(ROOT, 'docs', 'claim_reference_gap_review_packets.md');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function markdownEscape(value) {
  return cleanText(value).replaceAll('|', '\\|');
}

function unique(items = []) {
  return [...new Set(items.filter(Boolean))];
}

function countBy(items, selector) {
  return items.reduce((acc, item) => {
    const key = selector(item) || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function sourceSummary(source = {}) {
  return {
    source_id: source.id || '',
    title: source.title || '',
    organization: source.organization || source.publisher || '',
    publication_date: source.publication_date || '',
    url: source.url || '',
    source_tier: source.source_tier || '',
    license_scope: source.license_scope || '',
    review_status: source.review_status || ''
  };
}

function chunkSummary(chunk) {
  return {
    chunk_id: chunk.id,
    source_id: chunk.source_id || '',
    source_title: chunk.source_title || '',
    evidence_status: chunk.evidence_status || '',
    facet_id: chunk.facet_id || '',
    topic_tags: chunk.topic_tags || [],
    task_tags: chunk.task_tags || [],
    text_preview: cleanText(chunk.text).slice(0, 240),
    locator: {
      url: chunk.locator?.url || chunk.source_url || '',
      section_heading: chunk.locator?.section_heading || chunk.section || '',
      locator_quality: chunk.locator?.locator_quality || '',
      verification_status: chunk.locator?.verification_status || ''
    }
  };
}

function relevantGeneratedChunks(chunks, policy) {
  const expectedTopics = policy.expected_topic_tags || [];
  const expectedSources = policy.expected_source_ids || [];
  return chunks
    .filter((chunk) => chunk.active !== false && !chunk.superseded_by)
    .filter((chunk) => chunk.review_status === 'reviewed')
    .filter((chunk) => chunk.evidence_status === 'generated_needs_review')
    .filter((chunk) => {
      const topicMatch = expectedTopics.length
        ? (chunk.topic_tags || []).some((tag) => expectedTopics.includes(tag))
        : false;
      const sourceMatch = expectedSources.length
        ? expectedSources.includes(chunk.source_id)
        : false;
      return topicMatch || sourceMatch;
    })
    .sort((left, right) =>
      (left.source_id || '').localeCompare(right.source_id || '')
        || (left.facet_id || '').localeCompare(right.facet_id || '')
        || left.id.localeCompare(right.id)
    );
}

function generatedSourceRows(generatedChunks, sourceById) {
  const bySource = new Map();
  for (const chunk of generatedChunks) {
    if (!bySource.has(chunk.source_id)) {
      bySource.set(chunk.source_id, {
        ...sourceSummary(sourceById.get(chunk.source_id)),
        generated_needs_review_chunks: 0,
        facets: new Set(),
        topic_tags: new Set()
      });
    }
    const row = bySource.get(chunk.source_id);
    row.generated_needs_review_chunks += 1;
    if (chunk.facet_id) row.facets.add(chunk.facet_id);
    for (const tag of chunk.topic_tags || []) row.topic_tags.add(tag);
  }
  return [...bySource.values()].map((row) => ({
    ...row,
    facets: [...row.facets].sort(),
    topic_tags: [...row.topic_tags].sort()
  }));
}

function packetForGap(row, claimPacket, policy, knowledgeBundle, sourceById) {
  const generatedChunks = relevantGeneratedChunks(knowledgeBundle.chunks || [], policy);
  const generatedSources = generatedSourceRows(generatedChunks, sourceById);
  const insufficientBroadReferences = (row.references || [])
    .filter((reference) => reference.role_match && !reference.domain_specific_match)
    .slice(0, 8);
  const expectedSourceSummaries = (policy.expected_source_ids || [])
    .map((sourceId) => sourceSummary(sourceById.get(sourceId) || { id: sourceId }));
  const expectedTopics = policy.expected_topic_tags || [];
  const expectedFacets = policy.expected_facets || [];
  const generatedFacetCounts = countBy(generatedChunks, (chunk) => chunk.facet_id);
  const generatedTopicCounts = countBy(
    generatedChunks.flatMap((chunk) => chunk.topic_tags || []),
    (tag) => tag
  );

  return {
    id: `claim_reference_gap_${row.packet_id}`,
    claim_packet_id: row.packet_id,
    domain_key: row.domain_key,
    label: row.label,
    priority: 'P0_named_standard_feedback_support_gap',
    review_status: 'pending_clinical_evidence_acquisition_or_local_standard_review',
    current_alignment_status: row.local_alignment_status,
    release_ready: false,
    blocker_summary: {
      blockers: row.blockers || [],
      candidate_quote_backed_references: row.candidate_quote_backed_references,
      aligned_quote_backed_references: row.aligned_quote_backed_references,
      required_aligned_quote_backed_references: row.min_quote_backed_references_required,
      domain_specific_quote_backed_references: row.domain_specific_quote_backed_references,
      required_domain_specific_quote_backed_references:
        row.domain_specific_min_quote_backed_references_required,
      domain_specific_quote_support_met: row.domain_specific_quote_support_met,
      generated_needs_review_references_returned_to_learner_pipeline:
        row.generated_needs_review_references_returned
    },
    affected_claim_review_packet: {
      claim_set_type: claimPacket?.claim_set_type || row.claim_set_type,
      current_release_status: claimPacket?.current_release_status || row.current_release_status,
      feedback_basis: claimPacket?.feedback_basis || '',
      scoring_mode: claimPacket?.scoring_mode || '',
      required_entailment_evidence: claimPacket?.required_entailment_evidence || [],
      review_questions: claimPacket?.review_questions || []
    },
    standard_support_requirement: {
      support_type: 'domain_specific_quote_backed_public_evidence_or_clinician_approved_local_standard',
      required_quote_backed_reference_count:
        row.domain_specific_min_quote_backed_references_required,
      expected_topic_tags: expectedTopics,
      expected_facets: expectedFacets,
      expected_task_tags: policy.expected_task_tags || [],
      expected_source_ids: policy.expected_source_ids || [],
      expected_sources: expectedSourceSummaries,
      required_review_basis: row.required_review_basis || []
    },
    current_evidence_state: {
      quote_backed_domain_specific_chunks_available: row.domain_specific_quote_backed_references,
      generated_needs_review_domain_specific_chunks_available: generatedChunks.length,
      generated_needs_review_chunks_must_remain_quarantined: true,
      generated_needs_review_chunks_by_source: countBy(generatedChunks, (chunk) => chunk.source_id),
      generated_needs_review_chunks_by_facet: generatedFacetCounts,
      generated_needs_review_topic_counts: generatedTopicCounts,
      generated_source_rows: generatedSources,
      representative_generated_needs_review_chunks:
        generatedChunks.slice(0, 20).map(chunkSummary),
      insufficient_broad_quote_backed_candidates: insufficientBroadReferences
    },
    required_reviewer_actions: [
      'Find quote-backed public ESI or ED-triage-standard evidence that directly supports the feedback claim set, or document a clinician-approved local triage standard.',
      'Replace generated-needs-review ESI summaries with extracted, source-linked quote-backed chunks before any learner-facing national use.',
      'Verify that references support ESI acuity assignment, high-risk/danger-zone decision points, and resource-prediction language rather than only generic ED safety or diagnosis.',
      'Record clinician and simulation-educator claim-entailment review after the evidence acquisition is complete.',
      'Keep this claim set blocked for national learner-facing feedback until the alignment report shows the domain-specific threshold is met.'
    ],
    acceptance_criteria: [
      {
        criterion: 'At least two reviewed, active, quote-backed references match the ESI/triage-standard topic or source policy.',
        current_status: 'fail'
      },
      {
        criterion: 'No generated-needs-review chunk is counted as learner-facing support.',
        current_status: 'pass'
      },
      {
        criterion: 'Broad quote-backed references from unrelated topics are retained only as reviewer context, not as proof of ESI support.',
        current_status: 'pass'
      },
      {
        criterion: 'A clinician-approved local standard is named and versioned if public quote-backed evidence is unavailable or insufficient.',
        current_status: 'pending'
      },
      {
        criterion: 'Feedback claim-entailment review confirms the final wording is supported by case truth, ESI/triage evidence, and educational scope.',
        current_status: 'pending'
      }
    ],
    review_submission_template: {
      gap_packet_id: `claim_reference_gap_${row.packet_id}`,
      claim_packet_id: row.packet_id,
      domain_key: row.domain_key,
      reviewer_roles: [
        {
          role: 'emergency_clinician_or_triage_expert',
          name: '',
          institution: '',
          credential_or_position: ''
        },
        {
          role: 'medical_librarian_or_evidence_reviewer',
          name: '',
          institution: '',
          credential_or_position: ''
        },
        {
          role: 'simulation_educator',
          name: '',
          institution: '',
          credential_or_position: ''
        }
      ],
      reviewed_at: '',
      evidence_resolution:
        'add_quote_backed_public_evidence | approve_local_standard | retire_or_reword_claim_set | keep_blocked',
      added_or_approved_source_ids: [],
      local_standard_name_and_version: '',
      generated_chunks_replaced_or_retired: [],
      claim_entailment_ready_for_review: false,
      national_feedback_release_decision: 'blocked',
      reviewer_attestation: ''
    }
  };
}

function markdown(artifact) {
  const lines = [
    '# Claim Reference Gap Review Packets',
    '',
    `Generated: ${artifact.generated_at}`,
    '',
    artifact.warning,
    '',
    '## Summary',
    '',
    `- Gap packets: ${artifact.summary.total_gap_packets}`,
    `- Domain-specific support gap packets: ${artifact.summary.domain_specific_gap_packets}`,
    `- Claim sets missing domain-specific quote support: ${artifact.summary.claim_sets_missing_domain_specific_quote_support}`,
    `- Generated-needs-review candidate chunks packeted: ${artifact.summary.generated_needs_review_candidate_chunks_packeted}`,
    `- Ready for national feedback release from gap review: ${artifact.summary.ready_for_national_feedback_release_from_gap_review}`,
    '',
    '## Gap Queue',
    '',
    '| Priority | Claim Packet | Domain | Status | Domain-Specific Refs | Generated Candidates | Required Action |',
    '|---|---|---|---|---:|---:|---|',
    ...artifact.claim_reference_gap_packets.map((packet) =>
      `| ${packet.priority} | ${packet.claim_packet_id} | ${packet.domain_key} | ${packet.current_alignment_status} | ${packet.blocker_summary.domain_specific_quote_backed_references}/${packet.blocker_summary.required_domain_specific_quote_backed_references} | ${packet.current_evidence_state.generated_needs_review_domain_specific_chunks_available} | ${markdownEscape(packet.required_reviewer_actions[0])} |`
    ),
    '',
    '## Packet Details',
    '',
    ...artifact.claim_reference_gap_packets.flatMap((packet) => [
      `### ${packet.id}`,
      '',
      `- Label: ${packet.label}`,
      `- Required domain-specific quote-backed references: ${packet.blocker_summary.required_domain_specific_quote_backed_references}`,
      `- Current domain-specific quote-backed references: ${packet.blocker_summary.domain_specific_quote_backed_references}`,
      `- Quarantined generated-needs-review candidates: ${packet.current_evidence_state.generated_needs_review_domain_specific_chunks_available}`,
      `- Expected sources: ${packet.standard_support_requirement.expected_source_ids.join(', ')}`,
      `- Expected topics: ${packet.standard_support_requirement.expected_topic_tags.join(', ')}`,
      '',
      '| Candidate Source | Generated Chunks | Facets | URL |',
      '|---|---:|---|---|',
      ...packet.current_evidence_state.generated_source_rows.map((source) =>
        `| ${markdownEscape(source.title || source.source_id)} | ${source.generated_needs_review_chunks} | ${markdownEscape(source.facets.join(', '))} | ${markdownEscape(source.url)} |`
      ),
      ''
    ]),
    '## Reviewer Output',
    '',
    'Completed reviews should be recorded in a separate adjudication file before generated chunks are promoted, local standards are accepted, or learner-facing feedback is unblocked. These packets do not constitute approval.'
  ];
  return `${lines.join('\n')}\n`;
}

const knowledgeBundle = readJson(KNOWLEDGE_BUNDLE_PATH);
const alignmentReport = readJson(CLAIM_REFERENCE_ALIGNMENT_REPORT_PATH);
const claimReviewPackets = readJson(CLAIM_REVIEW_PACKETS_PATH);
const sourceById = new Map((knowledgeBundle.sources || []).map((source) => [source.id, source]));
const claimPacketById = new Map((claimReviewPackets.claim_review_packets || [])
  .map((packet) => [packet.id, packet]));
const policies = alignmentReport.alignment_policy?.domain_policies || {};
const gapRows = (alignmentReport.claim_set_alignment || [])
  .filter((row) => row.domain_specific_quote_support_required)
  .filter((row) => !row.domain_specific_quote_support_met);
const gapPackets = gapRows.map((row) =>
  packetForGap(row, claimPacketById.get(row.packet_id), policies[row.domain_key] || {}, knowledgeBundle, sourceById)
);
const generatedPacketed = gapPackets.reduce(
  (sum, packet) => sum + packet.current_evidence_state.generated_needs_review_domain_specific_chunks_available,
  0
);

const artifact = {
  schema_version: 'claim_reference_gap_review_packets_v1',
  generated_at: new Date().toISOString(),
  review_status: gapPackets.length
    ? 'domain_specific_claim_reference_gaps_packeted_manual_review_required'
    : 'no_domain_specific_claim_reference_gaps_detected_review_required',
  warning: 'These packets convert claim-reference alignment gaps into evidence acquisition and clinician-review work. They do not approve generated evidence, local standards, claim entailment, or national learner-facing feedback.',
  source_contract: {
    feedback_claim_reference_alignment_report_schema: alignmentReport.schema_version,
    feedback_claim_reference_alignment_report_path: 'docs/feedback_claim_reference_alignment_report.json',
    feedback_claim_entailment_review_packets_schema: claimReviewPackets.schema_version,
    feedback_claim_entailment_review_packets_path: 'docs/feedback_claim_entailment_review_packets.json',
    public_knowledge_bundle_schema: knowledgeBundle.schema_version,
    generated_needs_review_evidence_allowed_for_learner_feedback: false,
    gap_packets_are_reviewer_workflow_only: true
  },
  summary: {
    total_gap_packets: gapPackets.length,
    domain_specific_gap_packets: gapPackets.filter((packet) =>
      packet.blocker_summary.blockers.includes('domain_specific_quote_support_gap')
    ).length,
    claim_sets_missing_domain_specific_quote_support:
      alignmentReport.summary?.claim_sets_missing_domain_specific_quote_support || 0,
    all_domain_specific_gaps_packeted:
      gapPackets.length === (alignmentReport.summary?.claim_sets_missing_domain_specific_quote_support || 0),
    generated_needs_review_candidate_chunks_packeted: generatedPacketed,
    gap_packets_with_generated_candidates:
      gapPackets.filter((packet) => packet.current_evidence_state.generated_needs_review_domain_specific_chunks_available > 0).length,
    gap_packets_with_zero_quote_backed_domain_specific_refs:
      gapPackets.filter((packet) => packet.blocker_summary.domain_specific_quote_backed_references === 0).length,
    reviewed_gap_packets: 0,
    pending_gap_packets: gapPackets.length,
    ready_for_national_feedback_release_from_gap_review: false
  },
  claim_reference_gap_packets: gapPackets,
  release_blockers: [
    {
      id: 'domain_specific_claim_reference_gaps_unresolved',
      status: gapPackets.length === 0 ? 'cleared' : 'blocked',
      evidence: {
        gap_packets: gapPackets.length,
        claim_sets_missing_domain_specific_quote_support:
          alignmentReport.summary?.claim_sets_missing_domain_specific_quote_support || 0
      },
      required_to_clear: 'Add quote-backed domain-specific evidence or document a clinician-approved local standard, then rerun claim-reference alignment until every named-standard claim set meets threshold.'
    },
    {
      id: 'generated_domain_specific_candidates_quarantined',
      status: generatedPacketed === 0 ? 'cleared' : 'blocked',
      evidence: {
        generated_needs_review_candidate_chunks_packeted: generatedPacketed
      },
      required_to_clear: 'Replace, remove, or formally adjudicate generated-needs-review domain-specific chunks before they can support learner-facing feedback.'
    }
  ],
  next_actions: [
    'Assign each gap packet to an emergency clinician or triage expert, medical librarian/evidence reviewer, and simulation educator.',
    'Replace generated ESI/triage summaries with quote-backed public evidence or a named clinician-approved local standard.',
    'Rerun scripts/build_feedback_claim_reference_alignment_report.mjs after evidence updates to verify the domain-specific threshold.',
    'Only then complete claim-entailment review in docs/learner_facing_claim_entailment_reviews.json.'
  ]
};

writeFileSync(JSON_OUTPUT_PATH, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
writeFileSync(MD_OUTPUT_PATH, markdown(artifact), 'utf8');

console.log(JSON.stringify({
  review_status: artifact.review_status,
  total_gap_packets: artifact.summary.total_gap_packets,
  generated_needs_review_candidate_chunks_packeted:
    artifact.summary.generated_needs_review_candidate_chunks_packeted,
  all_domain_specific_gaps_packeted: artifact.summary.all_domain_specific_gaps_packeted,
  report_path: JSON_OUTPUT_PATH
}, null, 2));
