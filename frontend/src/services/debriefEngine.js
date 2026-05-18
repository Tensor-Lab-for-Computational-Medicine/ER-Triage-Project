import { buildEvidenceLanes } from './evidenceLaneService';
import {
  buildNextCaseRecommendation,
  updateLearnerProfileFromFeedback
} from './learnerProfileService';

export function buildFeedbackEvidenceLanes({ caseData, workflow, caseEvidence }) {
  return buildEvidenceLanes({ caseData, workflow, caseEvidence });
}

export function buildLearnerProfileFeedback(feedback) {
  const learnerProfile = updateLearnerProfileFromFeedback(feedback);
  return {
    learner_profile_delta: learnerProfile.delta,
    next_case_recommendation: buildNextCaseRecommendation(learnerProfile.profile)
  };
}
