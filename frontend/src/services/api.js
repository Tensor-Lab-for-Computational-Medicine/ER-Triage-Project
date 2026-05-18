import {
  askOpenRouterTutor,
  acknowledgeStaticInterviewGaps,
  askStaticInCaseCoach,
  askStaticPatientQuestion,
  assignStaticProvisionalTriage,
  assignStaticTriage,
  clearTutorSettings,
  getStaticEscalationActions,
  getStaticFeedback,
  getStaticDecisionCoach,
  getTutorSettings,
  gradeStaticReasoningReview,
  prewarmStaticSemanticCache,
  recordStaticInterviewSupport,
  recordStaticVitalsReview,
  saveTutorSettings,
  selectStaticEscalationActions,
  startStaticSimulation,
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

export const assignTriage = async (sessionId, level, rationale = '') =>
  asyncReturn(() => assignStaticTriage(sessionId, level, rationale));

export const getEscalationActions = async (sessionId) =>
  asyncReturn(() => getStaticEscalationActions(sessionId));

export const getDecisionCoach = async (sessionId, stage) =>
  asyncReturn(() => getStaticDecisionCoach(sessionId, stage));

export const askInCaseCoach = async (sessionId, stage, learnerContext = '') =>
  askStaticInCaseCoach(sessionId, stage, learnerContext);

export const selectEscalationActions = async (sessionId, actionIds, rationale = '') =>
  asyncReturn(() => selectStaticEscalationActions(sessionId, actionIds, rationale));

export const submitSbar = async (sessionId, handoff) =>
  asyncReturn(() => submitStaticSbar(sessionId, handoff));

export const getFeedback = async (sessionId) =>
  asyncReturn(() => getStaticFeedback(sessionId));

export const askTutorQuestion = async (sessionId, question) =>
  askOpenRouterTutor(sessionId, question);

export const gradeReasoningReview = async (sessionId) =>
  gradeStaticReasoningReview(sessionId);

export const prewarmSemanticCache = async () =>
  prewarmStaticSemanticCache();

export { clearTutorSettings, getTutorSettings, saveTutorSettings };
export { getCoachPreference, saveCoachPreference };

export const healthCheck = async () => ({
  status: 'static',
  active_sessions: null,
  cases_loaded: null,
  completed_sessions: null
});
