import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evidenceEligibilityForLearnerFacingUse
} from '../frontend/src/services/openEvidencePolicyService.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KNOWLEDGE_BUNDLE_PATH = join(ROOT, 'frontend', 'src', 'data', 'public_clinical_knowledge_bundle.json');
const CLAIM_PACKETS_PATH = join(ROOT, 'docs', 'feedback_claim_entailment_review_packets.json');
const FEEDBACK_TRACEABILITY_MATRIX_PATH = join(ROOT, 'docs', 'feedback_traceability_matrix.json');
const JSON_OUTPUT_PATH = join(ROOT, 'docs', 'feedback_claim_reference_alignment_report.json');
const MD_OUTPUT_PATH = join(ROOT, 'docs', 'feedback_claim_reference_alignment_report.md');

const MIN_SCORE = 0.015;

const DOMAIN_POLICIES = {
  esi: {
    min_quote_backed_references: 2,
    domain_specific_min_quote_backed_references: 2,
    require_domain_specific_quote_support: true,
    required_review_basis: ['case_truth_adjudication', 'triage_standard'],
    expected_facets: ['recognition', 'focused_assessment', 'diagnostic_strategy'],
    expected_task_tags: ['triage'],
    expected_topic_tags: ['esi'],
    expected_source_ids: ['ena_esi_handbook_5e', 'ena_triage_curriculum', 'acep_ena_triage_policy_2025'],
    query_expansion: 'emergency severity index triage acuity vital signs danger zone resource prediction high risk'
  },
  safety: {
    min_quote_backed_references: 2,
    required_review_basis: ['case_truth_adjudication', 'safety_standard'],
    expected_facets: ['recognition', 'red_flags', 'focused_assessment', 'initial_management'],
    expected_task_tags: ['triage', 'management', 'reassessment'],
    query_expansion: 'abnormal vital signs shock hypoxia sepsis stroke overdose ectopic agitation dka unsafe omission escalation'
  },
  interview: {
    min_quote_backed_references: 1,
    required_review_basis: ['case_truth_adjudication', 'educator_review'],
    expected_facets: ['recognition', 'focused_assessment'],
    expected_task_tags: ['triage', 'diagnosis', 'tutor'],
    query_expansion: 'focused history chief complaint symptoms risk factors clinical reasoning emergency department'
  },
  focused_exam: {
    min_quote_backed_references: 1,
    required_review_basis: ['case_truth_adjudication', 'educator_review'],
    expected_facets: ['focused_assessment', 'recognition'],
    expected_task_tags: ['diagnosis', 'triage'],
    query_expansion: 'focused assessment physical exam vital signs emergency differential diagnosis'
  },
  diagnosis: {
    min_quote_backed_references: 2,
    required_review_basis: ['case_truth_adjudication', 'clinician_review'],
    expected_facets: ['recognition', 'diagnostic_strategy', 'focused_assessment'],
    expected_task_tags: ['diagnosis'],
    source_limited_blocks_release: true,
    query_expansion: 'working diagnosis differential diagnosis diagnostic strategy chest pain stroke sepsis ectopic dka overdose'
  },
  referral: {
    min_quote_backed_references: 2,
    required_review_basis: ['case_truth_adjudication', 'clinician_review'],
    expected_facets: ['initial_management', 'disposition_reassessment', 'teaching_handoff'],
    expected_task_tags: ['management', 'reassessment', 'sbar'],
    source_limited_blocks_release: true,
    query_expansion: 'consult referral escalation disposition transfer admission emergency department handoff'
  },
  escalation: {
    min_quote_backed_references: 2,
    required_review_basis: ['case_truth_adjudication', 'clinician_review'],
    expected_facets: ['initial_management', 'medication_procedure', 'disposition_reassessment'],
    expected_task_tags: ['management', 'reassessment'],
    query_expansion: 'initial management stabilization resuscitation antibiotics naloxone thrombolysis surgery vasopressor reassessment'
  },
  reassessment: {
    min_quote_backed_references: 2,
    required_review_basis: ['case_truth_adjudication', 'clinician_review'],
    expected_facets: ['disposition_reassessment', 'focused_assessment', 'initial_management'],
    expected_task_tags: ['reassessment', 'management'],
    source_limited_blocks_release: true,
    query_expansion: 'reassessment escalation triggers disposition monitoring response recurrence deterioration'
  },
  soap: {
    min_quote_backed_references: 1,
    required_review_basis: ['educator_review', 'case_truth_adjudication'],
    expected_facets: ['teaching_handoff', 'focused_assessment', 'diagnostic_strategy'],
    expected_task_tags: ['tutor', 'debrief', 'diagnosis'],
    query_expansion: 'documentation clinical reasoning subjective objective assessment plan evidence use emergency medicine'
  },
  sbar: {
    min_quote_backed_references: 1,
    required_review_basis: ['educator_review', 'case_truth_adjudication'],
    expected_facets: ['teaching_handoff', 'disposition_reassessment', 'initial_management'],
    expected_task_tags: ['sbar', 'reassessment', 'management'],
    query_expansion: 'handoff transfer sbar situation background assessment recommendation escalation disposition'
  }
};

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeText(value = '') {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value = '') {
  return normalizeText(value)
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function unique(items = []) {
  return [...new Set(items.filter(Boolean))];
}

function markdownEscape(value) {
  return cleanText(value).replaceAll('|', '\\|');
}

function chunkSearchText(chunk) {
  return [
    chunk.id,
    chunk.source_title,
    chunk.section,
    chunk.facet_id,
    ...(chunk.topic_tags || []),
    ...(chunk.task_tags || []),
    chunk.clinical_rule,
    chunk.text,
    ...(chunk.supporting_quotes || []).map((quote) => quote.text)
  ].filter(Boolean).join(' ');
}

function buildCorpusStats(corpus) {
  const documents = corpus.map((chunk) => {
    const tokens = tokenize(chunkSearchText(chunk));
    const counts = tokens.reduce((acc, token) => {
      acc[token] = (acc[token] || 0) + 1;
      return acc;
    }, {});
    return {
      id: chunk.id,
      length: tokens.length,
      counts,
      uniqueTerms: new Set(tokens)
    };
  });
  const documentFrequency = new Map();
  for (const document of documents) {
    for (const term of document.uniqueTerms) {
      documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1);
    }
  }
  return {
    documentCount: documents.length,
    averageLength: documents.reduce((sum, document) => sum + document.length, 0) / Math.max(documents.length, 1),
    documentFrequency,
    documentsById: new Map(documents.map((document) => [document.id, document]))
  };
}

function bm25Score(query, chunk, corpusStats) {
  const queryTerms = unique(tokenize(query));
  if (!queryTerms.length) return 0;
  const document = corpusStats.documentsById.get(chunk.id);
  if (!document?.length) return 0;
  const k1 = 1.2;
  const b = 0.75;
  return queryTerms.reduce((score, term) => {
    const frequency = document.counts[term] || 0;
    if (!frequency) return score;
    const documentFrequency = corpusStats.documentFrequency.get(term) || 0;
    const idf = Math.log(1 + ((corpusStats.documentCount - documentFrequency + 0.5) / (documentFrequency + 0.5)));
    const denominator = frequency + k1 * (1 - b + b * (document.length / Math.max(1, corpusStats.averageLength)));
    return score + idf * ((frequency * (k1 + 1)) / denominator);
  }, 0) / (queryTerms.length + 1);
}

function packetText(packet, policy) {
  return cleanText([
    packet.label,
    packet.domain_key,
    packet.claim_set_type,
    packet.scoring_mode,
    packet.feedback_basis,
    packet.current_release_status,
    packet.traceability?.required_case_evidence?.join(' '),
    packet.required_entailment_evidence?.join(' '),
    packet.review_questions?.join(' '),
    (packet.acceptance_criteria || []).map((criterion) => criterion.criterion).join(' '),
    packet.traceability?.representative_rows?.map((row) => row.traceability_status).join(' '),
    policy.query_expansion
  ].filter(Boolean).join(' '));
}

function referenceMatchesPolicy(reference, policy) {
  const facetMatch = !policy.expected_facets?.length || policy.expected_facets.includes(reference.facet_id);
  const taskMatch = !policy.expected_task_tags?.length
    || (reference.task_tags || []).some((tag) => policy.expected_task_tags.includes(tag));
  const topicMatch = !policy.expected_topic_tags?.length
    || (reference.topic_tags || []).some((tag) => policy.expected_topic_tags.includes(tag));
  const sourceMatch = !policy.expected_source_ids?.length
    || policy.expected_source_ids.includes(reference.source_id);
  const roleMatch = facetMatch || taskMatch;
  const domainSpecificSupportRequired = Boolean(policy.require_domain_specific_quote_support);
  const domainSpecificMatch = topicMatch || sourceMatch;
  return {
    facet_match: facetMatch,
    task_match: taskMatch,
    topic_match: topicMatch,
    source_match: sourceMatch,
    role_match: roleMatch,
    domain_specific_match: domainSpecificMatch,
    policy_match: domainSpecificSupportRequired ? roleMatch && domainSpecificMatch : roleMatch
  };
}

function alignPacket(packet, corpus, corpusStats) {
  const policy = DOMAIN_POLICIES[packet.domain_key] || {
    min_quote_backed_references: 1,
    required_review_basis: ['educator_review'],
    expected_facets: [],
    expected_task_tags: [],
    query_expansion: packet.label
  };
  const query = packetText(packet, policy);
  const ranked = corpus
    .map((chunk) => ({ chunk, score: bm25Score(query, chunk, corpusStats) }))
    .filter((item) => item.score >= MIN_SCORE)
    .sort((left, right) => right.score - left.score)
    .slice(0, 12)
    .map((item) => {
      const policyMatches = referenceMatchesPolicy({
        source_id: item.chunk.source_id || '',
        facet_id: item.chunk.facet_id || '',
        topic_tags: item.chunk.topic_tags || [],
        task_tags: item.chunk.task_tags || []
  }, policy);
      return {
        reference_chunk_id: item.chunk.id,
        score: Number(item.score.toFixed(4)),
        source_id: item.chunk.source_id || '',
        citation_label: item.chunk.citation_label || '',
        source_title: item.chunk.source_title || '',
        facet_id: item.chunk.facet_id || '',
        topic_tags: item.chunk.topic_tags || [],
        task_tags: item.chunk.task_tags || [],
        evidence_status: item.chunk.evidence_status || '',
        quote_backed: true,
        ...policyMatches
      };
    });
  const alignedReferences = ranked.filter((reference) => reference.policy_match);
  const generatedReturned = ranked.filter((reference) => reference.evidence_status === 'generated_needs_review').length;
  const sourceLimited = Boolean(packet.claim_set_type === 'source_limited_formative_claim_set'
    || packet.current_release_status === 'blocked_truth_unavailable_formative_only'
    || policy.source_limited_blocks_release);
  const domainSpecificSupportRequired = Boolean(policy.require_domain_specific_quote_support);
  const domainSpecificReferences = domainSpecificSupportRequired
    ? ranked.filter((reference) => reference.domain_specific_match)
    : [];
  const domainSpecificMinimum = policy.domain_specific_min_quote_backed_references
    || policy.min_quote_backed_references
    || 1;
  const domainSpecificSupportMet = !domainSpecificSupportRequired
    || domainSpecificReferences.length >= domainSpecificMinimum;
  const minimumMet = alignedReferences.length >= policy.min_quote_backed_references;
  const blockers = [];
  if (!minimumMet) blockers.push('minimum_aligned_quote_backed_references_not_met');
  if (!domainSpecificSupportMet) blockers.push('domain_specific_quote_support_gap');
  if (sourceLimited) blockers.push('source_limited_truth_gap_blocks_release');
  if (generatedReturned > 0) blockers.push('generated_needs_review_reference_returned');
  blockers.push('clinician_educator_claim_entailment_review_missing');

  return {
    packet_id: packet.id,
    domain_key: packet.domain_key,
    label: packet.label,
    claim_set_type: packet.claim_set_type,
    current_release_status: packet.current_release_status,
    source_limited_truth_gap: sourceLimited,
    min_quote_backed_references_required: policy.min_quote_backed_references,
    candidate_quote_backed_references: ranked.length,
    aligned_quote_backed_references: alignedReferences.length,
    domain_specific_quote_support_required: domainSpecificSupportRequired,
    domain_specific_min_quote_backed_references_required: domainSpecificSupportRequired
      ? domainSpecificMinimum
      : 0,
    domain_specific_quote_backed_references: domainSpecificReferences.length,
    domain_specific_quote_support_met: domainSpecificSupportMet,
    generated_needs_review_references_returned: generatedReturned,
    minimum_reference_threshold_met: minimumMet,
    local_alignment_status: !domainSpecificSupportMet
      ? 'domain_specific_quote_support_gap_review_required'
      : minimumMet
      ? 'candidate_quote_alignment_available_review_required'
      : 'candidate_quote_alignment_gap_review_required',
    release_ready: false,
    blockers,
    required_review_basis: policy.required_review_basis,
    query,
    references: ranked.slice(0, 8),
    domain_specific_references: domainSpecificReferences.slice(0, 8),
    aligned_references: alignedReferences.slice(0, 8)
  };
}

function markdown(report) {
  const lines = [
    '# Feedback Claim Reference Alignment Report',
    '',
    `Generated at: ${report.generated_at}`,
    '',
    report.warning,
    '',
    '## Summary',
    '',
    `- Claim sets: ${report.summary.total_claim_sets}`,
    `- Claim sets with aligned quote-backed references: ${report.summary.claim_sets_with_aligned_quote_backed_references}`,
    `- Claim sets meeting minimum reference threshold: ${report.summary.claim_sets_meeting_minimum_reference_threshold}`,
    `- Claim sets requiring domain-specific quote support: ${report.summary.claim_sets_requiring_domain_specific_quote_support}`,
    `- Claim sets missing domain-specific quote support: ${report.summary.claim_sets_missing_domain_specific_quote_support}`,
    `- Source-limited claim sets blocked: ${report.summary.source_limited_claim_sets_blocked}`,
    `- Generated-needs-review references returned: ${report.summary.generated_needs_review_references_returned}`,
    `- Claim reference alignment release ready: ${report.summary.claim_reference_alignment_release_ready}`,
    '',
    '## Claim Set Alignment',
    '',
    '| Packet | Domain | Status | Aligned refs | Domain-specific refs | Minimum met | Source-limited | Blockers |',
    '|---|---|---|---:|---:|---|---|---|',
    ...report.claim_set_alignment.map((row) =>
      `| ${row.packet_id} | ${row.domain_key} | ${row.local_alignment_status} | ${row.aligned_quote_backed_references}/${row.min_quote_backed_references_required} | ${row.domain_specific_quote_backed_references}/${row.domain_specific_min_quote_backed_references_required} | ${row.minimum_reference_threshold_met} | ${row.source_limited_truth_gap} | ${markdownEscape(row.blockers.join(', '))} |`
    ),
    '',
    '## Next Actions',
    '',
    ...report.next_actions.map((action) => `- ${action}`)
  ];
  return `${lines.join('\n')}\n`;
}

const knowledgeBundle = readJson(KNOWLEDGE_BUNDLE_PATH);
const claimPackets = readJson(CLAIM_PACKETS_PATH);
const traceabilityMatrix = readJson(FEEDBACK_TRACEABILITY_MATRIX_PATH);
const packets = claimPackets.claim_review_packets || [];
const corpus = (knowledgeBundle.chunks || [])
  .filter((chunk) => chunk.active !== false)
  .filter((chunk) => chunk.review_status === 'reviewed')
  .filter((chunk) => !chunk.superseded_by)
  .filter((chunk) => evidenceEligibilityForLearnerFacingUse(chunk, {
    requireQuoteBacked: true,
    allowGeneratedNeedsReview: false
  }));
const corpusStats = buildCorpusStats(corpus);
const claimSetAlignment = packets.map((packet) => alignPacket(packet, corpus, corpusStats));

const summary = {
  total_claim_sets: claimSetAlignment.length,
  traceability_domain_count: traceabilityMatrix.summary?.domains_tracked || 0,
  quote_backed_corpus_chunks: corpus.length,
  claim_sets_with_candidate_quote_backed_references:
    claimSetAlignment.filter((row) => row.candidate_quote_backed_references > 0).length,
  claim_sets_with_aligned_quote_backed_references:
    claimSetAlignment.filter((row) => row.aligned_quote_backed_references > 0).length,
  claim_sets_meeting_minimum_reference_threshold:
    claimSetAlignment.filter((row) => row.minimum_reference_threshold_met).length,
  claim_sets_below_minimum_reference_threshold:
    claimSetAlignment.filter((row) => !row.minimum_reference_threshold_met).length,
  claim_sets_requiring_domain_specific_quote_support:
    claimSetAlignment.filter((row) => row.domain_specific_quote_support_required).length,
  claim_sets_with_domain_specific_quote_support:
    claimSetAlignment.filter((row) => row.domain_specific_quote_support_required
      && row.domain_specific_quote_support_met).length,
  claim_sets_missing_domain_specific_quote_support:
    claimSetAlignment.filter((row) => row.domain_specific_quote_support_required
      && !row.domain_specific_quote_support_met).length,
  domain_specific_quote_support_release_ready:
    claimSetAlignment.every((row) => row.domain_specific_quote_support_met),
  source_limited_claim_sets_blocked:
    claimSetAlignment.filter((row) => row.source_limited_truth_gap).length,
  generated_needs_review_references_returned:
    claimSetAlignment.reduce((sum, row) => sum + row.generated_needs_review_references_returned, 0),
  clinician_educator_claim_reviews_missing:
    claimSetAlignment.length,
  claim_reference_alignment_release_ready: false
};

const report = {
  schema_version: 'feedback_claim_reference_alignment_report_v1',
  generated_at: new Date().toISOString(),
  review_status: 'claim_reference_alignment_gaps_found_manual_review_required',
  warning: 'This report supplies deterministic quote-backed retrieval candidates for domain-level feedback claim sets. It does not prove claim entailment, clinical accuracy, faculty acceptance, or national release readiness.',
  source_contract: {
    feedback_claim_entailment_review_packets_schema: claimPackets.schema_version,
    feedback_traceability_matrix_schema: traceabilityMatrix.schema_version,
    public_knowledge_bundle_schema: knowledgeBundle.schema_version,
    quote_backed_only: true,
    allow_generated_needs_review: false,
    generated_needs_review_approved_by_this_report: 0
  },
  alignment_policy: {
    minimum_bm25_score: MIN_SCORE,
    domain_policies: DOMAIN_POLICIES,
    release_ready_requires: [
      'minimum aligned quote-backed references for every claim set that goes beyond case facts',
      'domain-specific quote-backed support or a clinician-approved local standard for named clinical standards such as ESI',
      'case-truth adjudication for source-limited domains',
      'valid clinician and educator claim-entailment reviews',
      'zero generated-needs-review references'
    ]
  },
  summary,
  claim_set_alignment: claimSetAlignment,
  next_actions: [
    'Use aligned references as reviewer starting points, not as automatic proof of entailment.',
    'Replace generated-needs-review ESI summaries with quote-backed ESI/triage-standard evidence or record a clinician-approved local standard before ESI feedback is learner-facing at national scale.',
    'Add sentence-level feedback claims to the packet format so future checks can move from domain-level retrieval alignment to exact claim-level support.',
    'Complete clinician and educator reviews in docs/learner_facing_claim_entailment_reviews.json before national learner feedback release.',
    'Keep source-limited diagnosis, referral, and reassessment feedback formative-only until case truth adjudication is complete.'
  ]
};

writeFileSync(JSON_OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
writeFileSync(MD_OUTPUT_PATH, markdown(report), 'utf8');
console.log(JSON.stringify({
  review_status: report.review_status,
  claim_sets: summary.total_claim_sets,
  claim_sets_meeting_minimum_reference_threshold: summary.claim_sets_meeting_minimum_reference_threshold,
  claim_sets_missing_domain_specific_quote_support: summary.claim_sets_missing_domain_specific_quote_support,
  source_limited_claim_sets_blocked: summary.source_limited_claim_sets_blocked,
  generated_needs_review_references_returned: summary.generated_needs_review_references_returned,
  report_path: JSON_OUTPUT_PATH
}, null, 2));
