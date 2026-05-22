import {
  askOpenRouterDebrief,
  askOpenRouterTutor,
  acknowledgeStaticInterviewGaps,
  askStaticInCaseCoach,
  askStaticPatientQuestion,
  assignStaticProvisionalTriage,
  assignStaticTriage,
  clearStaticLocalCaseBundle,
  clearTutorSettings,
  detectProvider,
  getStaticCaseSourceState,
  getStaticEscalationActions,
  getStaticFeedback,
  getStaticDecisionCoach,
  getStaticReferralOptions,
  getTutorSettings,
  gradeStaticReasoningReview,
  loadStaticLocalCaseBundle,
  prewarmStaticSemanticCache,
  recordStaticDiagnosis,
  recordStaticFocusedExam,
  recordStaticInterviewSupport,
  recordStaticVitalsReview,
  saveTutorSettings,
  selectStaticEscalationActions,
  submitStaticReferral,
  startStaticSimulation,
  submitStaticReassessment,
  submitStaticSbar
} from './staticEngine';
import { getCoachPreference, saveCoachPreference } from './uiPreferenceService';

const asyncReturn = (factory) =>
  new Promise((resolve, reject) => {
    try {
      resolve(factory());
    } catch (error) {
      reject(error);
    }
  });

export const startSimulation = async () => asyncReturn(startStaticSimulation);

export const recordInterviewSupport = async (sessionId, supportId) =>
  asyncReturn(() => recordStaticInterviewSupport(sessionId, supportId));

export const acknowledgeInterviewGaps = async (sessionId) =>
  asyncReturn(() => acknowledgeStaticInterviewGaps(sessionId));

export const askPatientQuestion = async (sessionId, question) =>
  asyncReturn(() => askStaticPatientQuestion(sessionId, question));

export const assignProvisionalTriage = async (sessionId, level, rationale = '') =>
  asyncReturn(() => assignStaticProvisionalTriage(sessionId, level, rationale));

export const recordVitalsReview = async (sessionId) =>
  asyncReturn(() => recordStaticVitalsReview(sessionId));

export const recordFocusedExam = async (sessionId, selectedSystemIds) =>
  asyncReturn(() => recordStaticFocusedExam(sessionId, selectedSystemIds));

export const assignTriage = async (sessionId, level, rationale = '') =>
  asyncReturn(() => assignStaticTriage(sessionId, level, rationale));

export const recordDiagnosis = async (sessionId, diagnosis, differential = [], evidence = '') =>
  asyncReturn(() => recordStaticDiagnosis(sessionId, diagnosis, differential, evidence));

export const getReferralOptions = async (sessionId) =>
  asyncReturn(() => getStaticReferralOptions(sessionId));

export const submitReferral = async (sessionId, decision) =>
  asyncReturn(() => submitStaticReferral(sessionId, decision));

export const getEscalationActions = async (sessionId) =>
  asyncReturn(() => getStaticEscalationActions(sessionId));

export const getDecisionCoach = async (sessionId, stage) =>
  asyncReturn(() => getStaticDecisionCoach(sessionId, stage));

export const askInCaseCoach = async (sessionId, stage, learnerContext = '') =>
  askStaticInCaseCoach(sessionId, stage, learnerContext);

export const selectEscalationActions = async (sessionId, actionIds, rationale = '', planDetails = {}) =>
  asyncReturn(() => selectStaticEscalationActions(sessionId, actionIds, rationale, planDetails));

export const submitReassessment = async (sessionId, selectedRisks, rationale = '') =>
  asyncReturn(() => submitStaticReassessment(sessionId, selectedRisks, rationale));

export const submitSbar = async (sessionId, handoff) =>
  asyncReturn(() => submitStaticSbar(sessionId, handoff));

export const getFeedback = async (sessionId) =>
  asyncReturn(() => getStaticFeedback(sessionId));

export const getAiDebrief = async (sessionId) =>
  askOpenRouterDebrief(sessionId);

export const askTutorQuestion = async (sessionId, question) =>
  askOpenRouterTutor(sessionId, question);

export const gradeReasoningReview = async (sessionId) =>
  gradeStaticReasoningReview(sessionId);

export const prewarmSemanticCache = async () =>
  prewarmStaticSemanticCache();

export const loadLocalCaseBundle = async (payload, fileName = '') =>
  asyncReturn(() => loadStaticLocalCaseBundle(payload, fileName));

export const clearLocalCaseBundle = async () =>
  asyncReturn(clearStaticLocalCaseBundle);

export const getCaseSourceState = () =>
  getStaticCaseSourceState();

export { clearTutorSettings, detectProvider, getTutorSettings, saveTutorSettings };
export { getCoachPreference, saveCoachPreference };

export const healthCheck = async () => ({
  status: 'static',
  active_sessions: null,
  cases_loaded: null,
  completed_sessions: null
});
