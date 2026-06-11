import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LEARNER_FACING_OPEN_EVIDENCE_POLICY_VERSION,
  evidenceEligibilityForLearnerFacingUse,
  isGeneratedNeedsReviewReferenceChunk,
  isQuoteBackedReferenceChunk
} from '../frontend/src/services/openEvidencePolicyService.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RETRIEVAL_MATRIX_PATH = join(ROOT, 'frontend', 'src', 'data', 'clinical_retrieval_matrix.json');
const KNOWLEDGE_BUNDLE_PATH = join(ROOT, 'frontend', 'src', 'data', 'public_clinical_knowledge_bundle.json');
const JSON_OUTPUT_PATH = join(ROOT, 'docs', 'open_evidence_runtime_policy_report.json');
const MD_OUTPUT_PATH = join(ROOT, 'docs', 'open_evidence_runtime_policy_report.md');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function statusText(value) {
  return value ? 'pass' : 'fail';
}

const retrievalMatrix = readJson(RETRIEVAL_MATRIX_PATH);
const knowledgeBundle = readJson(KNOWLEDGE_BUNDLE_PATH);
const generatedNeedsReviewChunks = knowledgeBundle.chunks.filter((chunk) => chunk.evidence_status === 'generated_needs_review').length;
const quoteBackedChunks = knowledgeBundle.chunks.filter((chunk) => chunk.evidence_status === 'quote_backed' && chunk.supporting_quotes?.length).length;
const publicCandidateChunks = knowledgeBundle.chunks
  .filter((chunk) => chunk.active !== false)
  .filter((chunk) => chunk.review_status === 'reviewed')
  .filter((chunk) => !chunk.superseded_by);

function expectedTopicChunks(probe) {
  const expectedTags = probe.expected_tags || [];
  if (!expectedTags.length) return publicCandidateChunks;
  return publicCandidateChunks.filter((chunk) =>
    expectedTags.some((tag) => (chunk.topic_tags || []).includes(tag))
  );
}

function runProbe(probe) {
  const topicChunks = expectedTopicChunks(probe);
  const eligibleChunks = topicChunks.filter((chunk) =>
    evidenceEligibilityForLearnerFacingUse(chunk, {
      requireQuoteBacked: true,
      allowGeneratedNeedsReview: false
    })
  );
  const references = eligibleChunks.slice(0, 5);
  const generatedReferenceCount = references.filter(isGeneratedNeedsReviewReferenceChunk).length;
  const quoteBackedReferenceCount = references.filter(isQuoteBackedReferenceChunk).length;
  const expectedTags = probe.expected_tags || [];
  const expectedTopicMatched = !expectedTags.length || references.some((reference) =>
    expectedTags.some((tag) => (reference.topic_tags || []).includes(tag))
  );
  const generatedTopicChunks = topicChunks.filter(isGeneratedNeedsReviewReferenceChunk).length;
  const passed = references.length > 0 &&
    generatedReferenceCount === 0 &&
    quoteBackedReferenceCount === references.length &&
    expectedTopicMatched &&
    generatedTopicChunks > 0;

  return {
    id: probe.id || probe.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''),
    label: probe.label,
    task: probe.task,
    query: probe.query,
    status: statusText(passed),
    expected_tags: expectedTags,
    expected_topic_matched: expectedTopicMatched,
    references_returned: references.length,
    quote_backed_references: quoteBackedReferenceCount,
    generated_needs_review_references: generatedReferenceCount,
    generated_candidates_quarantined: generatedTopicChunks,
    fail_closed: false,
    warnings: generatedTopicChunks
      ? ['Generated-needs-review chunks were quarantined and not used for learner-facing retrieval.']
      : []
  };
}

const probes = [];
for (const item of retrievalMatrix) {
  probes.push(runProbe(item));
}

const defaultEligibleChunks = publicCandidateChunks.filter((chunk) =>
  evidenceEligibilityForLearnerFacingUse(chunk, {
    requireQuoteBacked: false,
    allowGeneratedNeedsReview: false
  })
);
const exploratoryReferences = defaultEligibleChunks.slice(0, 5);
const exploratoryGeneratedReferences = exploratoryReferences.filter(isGeneratedNeedsReviewReferenceChunk).length;
const exploratoryPass = exploratoryGeneratedReferences === 0 &&
  generatedNeedsReviewChunks > 0;

probes.push({
  id: 'default_generated_backlog_quarantine',
  label: 'Default generated backlog quarantine',
  task: 'diagnosis',
  query: 'default learner-facing retrieval policy',
  status: statusText(exploratoryPass),
  expected_tags: [],
  expected_topic_matched: true,
  references_returned: exploratoryReferences.length,
  quote_backed_references: exploratoryReferences.filter(isQuoteBackedReferenceChunk).length,
  generated_needs_review_references: exploratoryGeneratedReferences,
  generated_candidates_quarantined: generatedNeedsReviewChunks,
  fail_closed: false,
  warnings: ['Generated-needs-review chunks were quarantined and not used for learner-facing retrieval.']
});

const failed = probes.filter((probe) => probe.status !== 'pass');
const report = {
  schema_version: 'open_evidence_runtime_policy_report_v1',
  generated_at: new Date().toISOString(),
  review_status: 'runtime_policy_probe_complete_needs_source_review',
  evidence_policy_version: LEARNER_FACING_OPEN_EVIDENCE_POLICY_VERSION,
  warning: 'Runtime retrieval policy probes prove generated-needs-review chunks are quarantined by default. They do not replace clinician/librarian review of the evidence backlog or claim-level source entailment.',
  summary: {
    total_probes: probes.length,
    passed_policy_probes: probes.length - failed.length,
    failed_policy_probes: failed.length,
    all_policy_probes_passed: failed.length === 0,
    public_bundle_chunks: knowledgeBundle.chunks.length,
    quote_backed_chunks: quoteBackedChunks,
    generated_needs_review_chunks: generatedNeedsReviewChunks,
    generated_chunks_quarantined_by_default: exploratoryPass,
    generated_references_returned: probes.reduce((sum, probe) => sum + probe.generated_needs_review_references, 0),
    clinician_librarian_reviewed_generated_chunks: 0
  },
  probes
};

function toMarkdown(data) {
  const lines = [
    '# Open Evidence Runtime Policy Report',
    '',
    `Generated: ${data.generated_at}`,
    '',
    data.warning,
    '',
    '## Summary',
    '',
    `- Policy version: ${data.evidence_policy_version}`,
    `- Probes: ${data.summary.passed_policy_probes}/${data.summary.total_probes} passed`,
    `- Quote-backed chunks: ${data.summary.quote_backed_chunks}`,
    `- Generated-needs-review chunks: ${data.summary.generated_needs_review_chunks}`,
    `- Generated references returned: ${data.summary.generated_references_returned}`,
    `- Clinician/librarian reviewed generated chunks: ${data.summary.clinician_librarian_reviewed_generated_chunks}`,
    '',
    '## Probes',
    '',
    '| Probe | Status | References | Quote-backed | Generated returned | Quarantined candidates |',
    '|---|---|---:|---:|---:|---:|',
    ...data.probes.map((probe) => `| ${probe.label} | ${probe.status} | ${probe.references_returned} | ${probe.quote_backed_references} | ${probe.generated_needs_review_references} | ${probe.generated_candidates_quarantined} |`)
  ];
  return `${lines.join('\n')}\n`;
}

writeFileSync(JSON_OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
writeFileSync(MD_OUTPUT_PATH, toMarkdown(report), 'utf8');

console.log(`Open evidence policy probes: ${report.summary.passed_policy_probes}/${report.summary.total_probes} passed.`);
console.log(`Runtime report written to ${JSON_OUTPUT_PATH}`);
if (failed.length) {
  throw new Error(`Open evidence policy probes failed: ${failed.map((probe) => probe.id).join(', ')}`);
}
