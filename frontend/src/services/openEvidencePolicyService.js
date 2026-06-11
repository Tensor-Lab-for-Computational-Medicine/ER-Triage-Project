export const LEARNER_FACING_OPEN_EVIDENCE_POLICY_VERSION = 'learner_facing_open_evidence_policy_v1';

export function isQuoteBackedReferenceChunk(chunk) {
  const verificationStatus = chunk?.verification_status || chunk?.locator?.verification_status || '';
  return Boolean(
    chunk?.evidence_status === 'quote_backed' &&
    chunk?.supporting_quotes?.length &&
    (chunk?.quote_backed !== false) &&
    ['human_verified', 'local_extracted'].includes(verificationStatus)
  );
}

export function isGeneratedNeedsReviewReferenceChunk(chunk) {
  return chunk?.evidence_status === 'generated_needs_review';
}

export function evidenceEligibilityForLearnerFacingUse(chunk, {
  requireQuoteBacked = false,
  allowGeneratedNeedsReview = false
} = {}) {
  if (requireQuoteBacked) return isQuoteBackedReferenceChunk(chunk);
  if (!allowGeneratedNeedsReview && isGeneratedNeedsReviewReferenceChunk(chunk)) return false;
  return true;
}
