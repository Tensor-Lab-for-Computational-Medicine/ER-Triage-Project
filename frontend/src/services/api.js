import {
  askOpenRouterDebrief,
  askOpenRouterTutor,
  acknowledgeStaticInterviewGaps,
  askStaticInCaseCoach,
  askStaticPatientQuestion,
  assignStaticProvisionalTriage,
  assignStaticTriage,
  clearStaticLocalCaseBundle,
  clearStaticLocalClinicalKnowledgeBundle,
  clearTutorSettings,
  detectProvider,
  formatAiErrorForLearner,
  getStaticClinicalKnowledgeState,
  getStaticCaseSourceState,
  getStaticFlowboardCaseOptions,
  generateStaticFlowboardArtifact,
  getStaticEscalationActions,
  getStaticFeedback,
  getStaticDecisionCoach,
  getStaticReferralOptions,
  getTutorSettings,
  gradeStaticReasoningReview,
  loadStaticLocalClinicalKnowledgeBundle,
  loadStaticLocalCaseBundle,
  prewarmStaticSemanticCache,
  queryStaticClinicalReferences,
  restoreStaticLocalClinicalKnowledgeBundle,
  recordStaticDiagnosis,
  recordStaticFlowboardEvent,
  recordStaticFocusedExam,
  recordStaticInterviewSupport,
  recordStaticVitalsReview,
  getStaticOptionalObjectiveData,
  requestStaticOptionalObjectiveData,
  saveTutorSettings,
  selectStaticEscalationActions,
  submitStaticReferral,
  startStaticSimulation,
  getStaticReassessmentScenario,
  testTutorConnection as testStaticTutorConnection,
  submitStaticReassessment,
  submitStaticSoap
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

export const startSimulation = async (options = {}) => asyncReturn(() => startStaticSimulation(options));

export const getFlowboardCaseOptions = () =>
  getStaticFlowboardCaseOptions();

export const recordFlowboardEvent = async (sessionId, event) =>
  asyncReturn(() => recordStaticFlowboardEvent(sessionId, event));

export const generateFlowboardArtifact = async (sessionId, kind, context = {}) =>
  generateStaticFlowboardArtifact(sessionId, kind, context);

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

export const getOptionalObjectiveData = async (sessionId, phase = 'encounter') =>
  asyncReturn(() => getStaticOptionalObjectiveData(sessionId, phase));

export const requestOptionalObjectiveData = async (sessionId, dataId, phase = 'encounter', context = {}) =>
  asyncReturn(() => requestStaticOptionalObjectiveData(sessionId, dataId, phase, context));

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

export const getReassessmentScenario = async (sessionId) =>
  asyncReturn(() => getStaticReassessmentScenario(sessionId));

export const submitReassessment = async (sessionId, selectedRisks, rationale = '') =>
  asyncReturn(() => submitStaticReassessment(sessionId, selectedRisks, rationale));

export const submitSoap = async (sessionId, soapNote, handoffNote = '') =>
  asyncReturn(() => submitStaticSoap(sessionId, soapNote, handoffNote));

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

export const queryClinicalReferences = async (options = {}) =>
  queryStaticClinicalReferences(options);

export const loadLocalCaseBundle = async (payload, fileName = '') =>
  asyncReturn(() => loadStaticLocalCaseBundle(payload, fileName));

export const clearLocalCaseBundle = async () =>
  asyncReturn(clearStaticLocalCaseBundle);

export const loadLocalClinicalKnowledgeBundle = async (payload, fileName = '') =>
  asyncReturn(() => loadStaticLocalClinicalKnowledgeBundle(payload, fileName));

export const clearLocalClinicalKnowledgeBundle = async () =>
  asyncReturn(clearStaticLocalClinicalKnowledgeBundle);

export const restoreLocalClinicalKnowledgeBundle = async () =>
  restoreStaticLocalClinicalKnowledgeBundle();

export const getCaseSourceState = () =>
  getStaticCaseSourceState();

export const getClinicalKnowledgeState = () =>
  getStaticClinicalKnowledgeState();

export const testTutorConnection = async (settings) =>
  testStaticTutorConnection(settings);

export { clearTutorSettings, detectProvider, formatAiErrorForLearner, getTutorSettings, saveTutorSettings };
export { getCoachPreference, saveCoachPreference };

export const healthCheck = async () => ({
  status: 'static',
  active_sessions: null,
  cases_loaded: null,
  completed_sessions: null
});
