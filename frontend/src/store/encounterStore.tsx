import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import {
  browserAiConfiguredStatus,
  buildBrowserAiReply,
  type BrowserAiConfig,
  type BrowserAiModelOption,
  type BrowserAiProvider
} from './browserAiClient';
import {
  StaticCaseRuntime,
  loadStaticCaseBundle,
  staticLlmStatus,
  staticNoBundleMessage
} from './staticCaseRuntime';

const AI_CONFIG_STORAGE_KEY = 'ed-simulator.ai-config.v1';
const REALTIME_ADVANCE_INTERVAL_MS = 1000;
const MINUTE_MS = 60_000;

export type AIProviderDraft = BrowserAiProvider;
export type AIModelOption = BrowserAiModelOption;

type SavedAIConfig = BrowserAiConfig & { version: 1 };

function readSavedAIConfig(): SavedAIConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(AI_CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedAIConfig>;
    const provider = parsed.provider;
    if (!['openai_responses', 'deepseek', 'openai_compatible', 'openrouter'].includes(String(provider))) return null;
    const apiKey = String(parsed.apiKey || '').trim();
    if (!apiKey) return null;
    return {
      version: 1,
      provider: provider as AIProviderDraft,
      apiKey,
      baseUrl: String(parsed.baseUrl || ''),
      cheapModel: String(parsed.cheapModel || defaultCheapModel(provider as AIProviderDraft)),
      strongModel: String(parsed.strongModel || defaultStrongModel(provider as AIProviderDraft))
    };
  } catch {
    return null;
  }
}

function saveAIConfig(config: Omit<SavedAIConfig, 'version'>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      AI_CONFIG_STORAGE_KEY,
      JSON.stringify({ version: 1, ...config })
    );
  } catch {
    // If browser storage is unavailable, the simulator still works for the current session.
  }
}

function clearSavedAIConfig() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(AI_CONFIG_STORAGE_KEY);
  } catch {
    // Ignore storage failures; clearing is best effort.
  }
}

export function defaultAIBaseUrl(provider: AIProviderDraft) {
  if (provider === 'deepseek') return 'https://api.deepseek.com/chat/completions';
  if (provider === 'openrouter') return 'https://openrouter.ai/api/v1/chat/completions';
  return '';
}

const OPENAI_MODEL_OPTIONS: AIModelOption[] = [
  { id: 'gpt-5.5', label: 'GPT-5.5' },
  { id: 'gpt-5.4', label: 'GPT-5.4' },
  { id: 'gpt-5.4-mini', label: 'GPT-5.4 mini' },
  { id: 'gpt-4.1', label: 'GPT-4.1' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
  { id: 'gpt-4o', label: 'GPT-4o' },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini' }
];

const DEEPSEEK_MODEL_OPTIONS: AIModelOption[] = [
  { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
  { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
  { id: 'deepseek-chat', label: 'DeepSeek chat legacy alias' },
  { id: 'deepseek-reasoner', label: 'DeepSeek reasoner legacy alias' }
];

const OPENROUTER_FALLBACK_MODEL_OPTIONS: AIModelOption[] = [
  { id: 'openai/gpt-5.5', label: 'OpenAI GPT-5.5' },
  { id: 'openai/gpt-5.4', label: 'OpenAI GPT-5.4' },
  { id: 'openai/gpt-5.4-mini', label: 'OpenAI GPT-5.4 mini' },
  { id: 'anthropic/claude-sonnet-4.5', label: 'Claude Sonnet 4.5' },
  { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B Instruct' },
  { id: 'openai/gpt-4o', label: 'OpenAI GPT-4o' },
  { id: 'openai/gpt-4o-mini', label: 'OpenAI GPT-4o mini' }
];

const OPENAI_COMPATIBLE_MODEL_OPTIONS: AIModelOption[] = [
  { id: 'gpt-5.4-mini', label: 'GPT-5.4 mini' },
  { id: 'gpt-5.4', label: 'GPT-5.4' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
  { id: 'gpt-4.1', label: 'GPT-4.1' },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
  { id: 'gpt-4o', label: 'GPT-4o' },
  { id: 'llama-3.3-70b-instruct', label: 'Llama 3.3 70B Instruct' },
  { id: 'mixtral-8x7b-instruct', label: 'Mixtral 8x7B Instruct' }
];

export function modelOptionsForProvider(provider: AIProviderDraft, openRouterOptions: AIModelOption[] = []) {
  if (provider === 'deepseek') return DEEPSEEK_MODEL_OPTIONS;
  if (provider === 'openrouter') return openRouterOptions.length ? openRouterOptions : OPENROUTER_FALLBACK_MODEL_OPTIONS;
  if (provider === 'openai_compatible') return OPENAI_COMPATIBLE_MODEL_OPTIONS;
  return OPENAI_MODEL_OPTIONS;
}

export function defaultCheapModel(provider: AIProviderDraft) {
  if (provider === 'deepseek') return 'deepseek-v4-flash';
  if (provider === 'openrouter') return 'openai/gpt-5.4-mini';
  return 'gpt-5.4-mini';
}

export function defaultStrongModel(provider: AIProviderDraft) {
  if (provider === 'deepseek') return 'deepseek-v4-pro';
  if (provider === 'openrouter') return 'openai/gpt-5.5';
  return 'gpt-5.5';
}

export type VitalSigns = {
  temp_c: number | null;
  hr: number;
  sbp: number;
  dbp: number;
  rr: number;
  spo2: number;
  pain: number | null;
};

export type ResultValue = {
  name: string;
  value: string;
  unit?: string | null;
  flag?: string | null;
  reference_range?: string | null;
};

export type ResultBundle = {
  order_id: string;
  display_name: string;
  resulted_at_min?: number | null;
  values: ResultValue[];
  narrative?: string | null;
  source?: string | null;
  source_reference?: Record<string, unknown>;
};

export type OrderRecord = {
  order_id: string;
  display_name: string;
  order_type: string;
  status: 'ordered' | 'resulting' | 'resulted' | 'unavailable';
  ordered_at_min: number;
  result_due_at_min: number;
  result?: ResultBundle | null;
  unavailable_reason?: string | null;
};

export type ExamManeuver = {
  id: string;
  region: string;
  maneuver_type: string;
  name: string;
  aliases: string[];
};

export type ExamRecord = {
  maneuver_id: string;
  display_name: string;
  region: string;
  maneuver_type: string;
  finding: string;
  source: string;
  performed_at_min: number;
};

export type InterventionRecord = {
  intervention_id: string;
  display_name: string;
  applied_at_min: number;
  effect_summary: string;
  vitals_after: VitalSigns;
};

export type TranscriptMessage = {
  speaker: string;
  text: string;
  elapsed_minutes: number;
  metadata?: Record<string, unknown>;
};

export type ResultInterpretation = {
  order_id: string;
  display_name: string;
  text: string;
  elapsed_minutes: number;
};

export type TokenUsageRecord = {
  tier: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  estimated_cost_usd: number;
  purpose: string;
};

export type CaseVisual = {
  kind: string;
  src?: string | null;
  alt?: string | null;
  prompt_summary?: string | null;
  clinical_cues?: string[];
  provenance?: string | null;
  review_status?: string | null;
};

export type Snapshot = {
  case_id: string;
  title: string;
  elapsed_minutes: number;
  phase: string;
  current_vitals: VitalSigns;
  visible_start: {
    chief_complaint: string;
    demographics: Record<string, unknown>;
    triage_context: string;
    appearance: string;
    presenting_vitals: VitalSigns;
    visual?: CaseVisual | null;
  };
  appearance: string;
  active_orders: OrderRecord[];
  resulted_orders: ResultBundle[];
  interventions: string[];
  performed_exams: ExamRecord[];
  intervention_events: InterventionRecord[];
  running_summary: string;
};

export type CaseStatus = {
  trajectory_signed_off: boolean;
  grader_feedback_validated: boolean;
  playthrough_signed_off: boolean;
  feedback_locked: boolean;
  feedback_lock_reason: string;
};

export type ApiSession = {
  session_id: string;
  case_status?: CaseStatus;
  snapshot: Snapshot;
  state: {
    esi_history: Array<{ level: number; rationale: string; elapsed_minutes: number }>;
    differential: string[];
    soap: SoapDraft;
    completeness_flags: Record<string, unknown>;
    can_complete: boolean;
    ended: boolean;
    transcript: TranscriptMessage[];
    result_interpretations: Record<string, ResultInterpretation>;
    performed_exams: ExamRecord[];
    intervention_events: InterventionRecord[];
    token_usage: TokenUsageRecord[];
  };
  route?: Record<string, unknown>;
  response?: string;
};

export type CatalogOrder = {
  id: string;
  type: string;
  name: string;
  aliases: string[];
  result_delay_min: number;
};

export type SoapDraft = {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
};

export type GraderFeedback = {
  diagnostic_accuracy?: Record<string, unknown>;
  acuity?: Record<string, unknown>;
  completeness?: { flags?: Record<string, unknown>; omissions?: string[] };
  workup_judgment?: Record<string, unknown>;
  action_feedback?: Record<string, unknown>;
  teaching_points?: Array<{ claim: string; grounded: boolean; evidence_id?: string | null }>;
};

export type LLMStatus = {
  ready: boolean;
  configured: boolean;
  provider: string;
  cheap_model: string;
  strong_model: string;
  base_url?: string;
  missing?: string[];
  message: string;
};

export type GuideStatus = 'done' | 'pending';

export type GuideActionItem = {
  id: string;
  label: string;
  why?: string;
  status: GuideStatus;
  required: boolean;
};

export type GuideHistoryItem = {
  id: string;
  topic: string;
  prompt: string;
  expected_response: string;
  status: GuideStatus;
};

export type GuideResultInterpretation = {
  order_id: string;
  label: string;
  expected_read: string;
  source?: string;
  status: GuideStatus;
  required: boolean;
};

export type GuideSoapTemplate = {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
};

export type GuideAnswerKey = {
  diagnosis: string;
  validated_esi: number;
  disposition: string;
  case_summary: string;
  history: GuideHistoryItem[];
  interventions: GuideActionItem[];
  exams: GuideActionItem[];
  orders: GuideActionItem[];
  avoid: GuideActionItem[];
  differential: string[];
  result_interpretations: GuideResultInterpretation[];
  soap_template: GuideSoapTemplate;
  key_points: string[];
};

export type TutorialStep = {
  id: string;
  title: string;
  instruction: string;
  rationale?: string;
  target_type: string;
  target_ids: string[];
  target_labels: string[];
  status: GuideStatus;
  required: boolean;
};

export type TeachingGuide = {
  case_id: string;
  title: string;
  mode_label: string;
  progress: { completed: number; total: number };
  next_step_id?: string | null;
  answer_key: GuideAnswerKey;
  tutorial_steps: TutorialStep[];
};

type EncounterState = {
  runtimeMode: 'static';
  staticBundleName: string;
  session: ApiSession | null;
  previousSnapshot: Snapshot | null;
  loading: boolean;
  busy: boolean;
  simClockPaused: boolean;
  error: string;
  llmStatus: LLMStatus | null;
  aiConfigSaved: boolean;
  aiProviderDraft: AIProviderDraft;
  aiKeyDraft: string;
  aiBaseUrlDraft: string;
  aiCheapModelDraft: string;
  aiStrongModelDraft: string;
  orderQuery: string;
  orderResults: CatalogOrder[];
  examQuery: string;
  examResults: ExamManeuver[];
  examCatalog: ExamManeuver[];
  chatDraft: string;
  esiDraft: number | '';
  esiRationale: string;
  differentialDraft: string;
  soapDraft: SoapDraft;
  packageRecord: Record<string, unknown> | null;
  feedback: GraderFeedback | null;
  debriefBlockedReason: string;
  teachingGuide: TeachingGuide | null;
  teachingGuideLoading: boolean;
};

type EncounterAction =
  | { type: 'loading' }
  | { type: 'busy'; value: boolean }
  | { type: 'error'; value: string }
  | { type: 'runtime'; mode: 'static'; bundleName?: string }
  | { type: 'session'; value: ApiSession; clearBusy?: boolean }
  | { type: 'simClockPaused'; value: boolean }
  | { type: 'llmStatus'; value: LLMStatus }
  | { type: 'aiConfigSaved'; value: boolean }
  | { type: 'aiProviderDraft'; value: AIProviderDraft }
  | { type: 'aiKeyDraft'; value: string }
  | { type: 'aiBaseUrlDraft'; value: string }
  | { type: 'aiCheapModelDraft'; value: string }
  | { type: 'aiStrongModelDraft'; value: string }
  | { type: 'orders'; query: string; results: CatalogOrder[] }
  | { type: 'exams'; query: string; results: ExamManeuver[] }
  | { type: 'examCatalog'; results: ExamManeuver[] }
  | { type: 'chatDraft'; value: string }
  | { type: 'esiDraft'; level: number | ''; rationale?: string }
  | { type: 'differentialDraft'; value: string }
  | { type: 'soapDraft'; field: keyof SoapDraft; value: string }
  | { type: 'package'; packageRecord: Record<string, unknown>; feedback: GraderFeedback | null }
  | { type: 'debriefBlocked'; reason: string }
  | { type: 'teachingGuideLoading'; value: boolean }
  | { type: 'teachingGuide'; value: TeachingGuide | null };

const savedAIConfig = readSavedAIConfig();

const initialState: EncounterState = {
  runtimeMode: 'static',
  staticBundleName: '',
  session: null,
  previousSnapshot: null,
  loading: true,
  busy: false,
  simClockPaused: false,
  error: '',
  llmStatus: null,
  aiConfigSaved: Boolean(savedAIConfig),
  aiProviderDraft: savedAIConfig?.provider || 'openai_responses',
  aiKeyDraft: savedAIConfig?.apiKey || '',
  aiBaseUrlDraft: savedAIConfig?.baseUrl || '',
  aiCheapModelDraft: savedAIConfig?.cheapModel || defaultCheapModel(savedAIConfig?.provider || 'openai_responses'),
  aiStrongModelDraft: savedAIConfig?.strongModel || defaultStrongModel(savedAIConfig?.provider || 'openai_responses'),
  orderQuery: '',
  orderResults: [],
  examQuery: '',
  examResults: [],
  examCatalog: [],
  chatDraft: '',
  esiDraft: '',
  esiRationale: '',
  differentialDraft: '',
  soapDraft: { subjective: '', objective: '', assessment: '', plan: '' },
  packageRecord: null,
  feedback: null,
  debriefBlockedReason: '',
  teachingGuide: null,
  teachingGuideLoading: false
};

function hasSoapContent(soap?: SoapDraft | null) {
  return Boolean(soap && Object.values(soap).some((value) => value.trim()));
}

function reducer(state: EncounterState, action: EncounterAction): EncounterState {
  if (action.type === 'loading') return { ...state, loading: true, error: '' };
  if (action.type === 'busy') return { ...state, busy: action.value };
  if (action.type === 'error') return { ...state, loading: false, busy: false, error: action.value };
  if (action.type === 'runtime') return { ...state, runtimeMode: action.mode, staticBundleName: action.bundleName ?? state.staticBundleName };
  if (action.type === 'simClockPaused') return { ...state, simClockPaused: action.value };
  if (action.type === 'llmStatus') return { ...state, llmStatus: action.value };
  if (action.type === 'aiConfigSaved') return { ...state, aiConfigSaved: action.value };
  if (action.type === 'aiProviderDraft') return { ...state, aiProviderDraft: action.value };
  if (action.type === 'aiKeyDraft') return { ...state, aiKeyDraft: action.value };
  if (action.type === 'aiBaseUrlDraft') return { ...state, aiBaseUrlDraft: action.value };
  if (action.type === 'aiCheapModelDraft') return { ...state, aiCheapModelDraft: action.value };
  if (action.type === 'aiStrongModelDraft') return { ...state, aiStrongModelDraft: action.value };
  if (action.type === 'session') {
    const newSession = action.value.session_id !== state.session?.session_id;
    const serverSoap = action.value.state.soap || initialState.soapDraft;
    const soapDraft = newSession || hasSoapContent(serverSoap) ? serverSoap : state.soapDraft;
    return {
      ...state,
      loading: false,
      busy: action.clearBusy === false ? state.busy : false,
      simClockPaused: newSession ? false : state.simClockPaused,
      error: '',
      previousSnapshot: newSession ? null : state.session?.snapshot || state.previousSnapshot,
      session: action.value,
      chatDraft: newSession ? '' : state.chatDraft,
      esiDraft: newSession ? '' : state.esiDraft,
      esiRationale: newSession ? '' : state.esiRationale,
      differentialDraft: newSession ? '' : state.differentialDraft,
      soapDraft,
      packageRecord: newSession ? null : state.packageRecord,
      feedback: newSession ? null : state.feedback,
      debriefBlockedReason: newSession ? '' : state.debriefBlockedReason,
      teachingGuide: newSession ? null : state.teachingGuide,
      teachingGuideLoading: newSession ? false : state.teachingGuideLoading
    };
  }
  if (action.type === 'orders') return { ...state, orderQuery: action.query, orderResults: action.results };
  if (action.type === 'exams') return { ...state, examQuery: action.query, examResults: action.results };
  if (action.type === 'examCatalog') return { ...state, examCatalog: action.results, examResults: state.examResults.length ? state.examResults : action.results.slice(0, 12) };
  if (action.type === 'chatDraft') return { ...state, chatDraft: action.value };
  if (action.type === 'esiDraft') return { ...state, esiDraft: action.level, esiRationale: action.rationale ?? state.esiRationale };
  if (action.type === 'differentialDraft') return { ...state, differentialDraft: action.value };
  if (action.type === 'soapDraft') return { ...state, soapDraft: { ...state.soapDraft, [action.field]: action.value } };
  if (action.type === 'package') return { ...state, packageRecord: action.packageRecord, feedback: action.feedback, debriefBlockedReason: '', busy: false };
  if (action.type === 'debriefBlocked') return { ...state, packageRecord: null, feedback: null, debriefBlockedReason: action.reason, busy: false, loading: false, error: action.reason };
  if (action.type === 'teachingGuideLoading') return { ...state, teachingGuideLoading: action.value };
  if (action.type === 'teachingGuide') return { ...state, teachingGuide: action.value, teachingGuideLoading: false };
  return state;
}

type EncounterContextValue = EncounterState & {
  start: () => Promise<void>;
  loadCaseBundle: (files: FileList | File[]) => Promise<void>;
  sendFreeText: () => Promise<void>;
  searchOrders: (query: string) => Promise<void>;
  searchExams: (query: string) => Promise<void>;
  placeOrder: (orderId: string) => Promise<void>;
  performExam: (maneuverId: string) => Promise<void>;
  addNote: (text: string) => Promise<void>;
  recordResultInterpretation: (orderId: string, text: string) => Promise<void>;
  sendQuickText: (text: string) => Promise<void>;
  applyIntervention: (interventionId: string) => Promise<void>;
  advanceTime: (minutes: number) => Promise<void>;
  toggleSimClock: () => void;
  commitEsi: () => Promise<void>;
  commitDifferential: () => Promise<void>;
  updateSoap: (field: keyof SoapDraft, value: string) => void;
  commitSoap: () => Promise<void>;
  completeCase: () => Promise<void>;
  loadTeachingGuide: () => Promise<TeachingGuide | null>;
  configureAi: () => Promise<void>;
  forgetAiConfig: () => void;
  setChatDraft: (value: string) => void;
  setAiProviderDraft: (value: AIProviderDraft) => void;
  setAiKeyDraft: (value: string) => void;
  setAiBaseUrlDraft: (value: string) => void;
  setAiCheapModelDraft: (value: string) => void;
  setAiStrongModelDraft: (value: string) => void;
  setEsiDraft: (level: number | '', rationale?: string) => void;
  setDifferentialDraft: (value: string) => void;
};

const EncounterContext = createContext<EncounterContextValue | null>(null);

export function EncounterProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const staticRuntimeRef = useRef<StaticCaseRuntime | null>(null);
  const actionQueueRef = useRef<Promise<void>>(Promise.resolve());
  const latestSessionIdRef = useRef<string | null>(null);
  const lastAutoAdvanceAtRef = useRef<number | null>(null);

  useEffect(() => {
    latestSessionIdRef.current = state.session?.session_id || null;
  }, [state.session?.session_id]);

  const start = useCallback(async () => {
    dispatch({ type: 'loading' });
    try {
      const localConfig = readSavedAIConfig();
      if (staticRuntimeRef.current) {
        const session = staticRuntimeRef.current.start();
        dispatch({ type: 'runtime', mode: 'static', bundleName: staticRuntimeRef.current.bundleName });
        dispatch({ type: 'llmStatus', value: localConfig ? browserAiConfiguredStatus(localConfig) : staticLlmStatus() });
        dispatch({ type: 'session', value: session });
        dispatch({ type: 'orders', query: '', results: staticRuntimeRef.current.searchOrders('') });
        const exams = staticRuntimeRef.current.examCatalog();
        dispatch({ type: 'examCatalog', results: exams });
        dispatch({ type: 'exams', query: '', results: exams.slice(0, 12) });
        return;
      }
      dispatch({ type: 'runtime', mode: 'static' });
      dispatch({ type: 'llmStatus', value: localConfig ? browserAiConfiguredStatus(localConfig) : staticLlmStatus() });
      dispatch({ type: 'aiConfigSaved', value: Boolean(localConfig) });
      dispatch({ type: 'error', value: staticNoBundleMessage() });
    } catch (error) {
      dispatch({ type: 'error', value: error instanceof Error ? error.message : 'Could not start simulator session.' });
    }
  }, []);

  const loadCaseBundle = useCallback(async (files: FileList | File[]) => {
    dispatch({ type: 'loading' });
    try {
      const loaded = await loadStaticCaseBundle(files);
      const localConfig = readSavedAIConfig();
      staticRuntimeRef.current = loaded.runtime;
      dispatch({ type: 'runtime', mode: 'static', bundleName: loaded.bundleName });
      dispatch({ type: 'llmStatus', value: localConfig ? browserAiConfiguredStatus(localConfig) : staticLlmStatus() });
      dispatch({ type: 'session', value: loaded.session });
      dispatch({ type: 'orders', query: '', results: loaded.orders });
      dispatch({ type: 'examCatalog', results: loaded.exams });
      dispatch({ type: 'exams', query: '', results: loaded.exams.slice(0, 12) });
    } catch (error) {
      dispatch({ type: 'error', value: error instanceof Error ? error.message : 'Could not load case bundle.' });
    }
  }, []);

  useEffect(() => {
    void start();
  }, [start]);

  const activeBrowserAiConfig = useCallback((): BrowserAiConfig | null => {
    const apiKey = state.aiKeyDraft.trim();
    if (state.llmStatus?.configured && apiKey) {
      return {
        provider: state.aiProviderDraft,
        apiKey,
        baseUrl: state.aiProviderDraft === 'openai_responses' ? '' : state.aiBaseUrlDraft.trim(),
        cheapModel: state.aiCheapModelDraft.trim() || defaultCheapModel(state.aiProviderDraft),
        strongModel: state.aiStrongModelDraft.trim() || defaultStrongModel(state.aiProviderDraft)
      };
    }
    const saved = readSavedAIConfig();
    return saved
      ? {
          provider: saved.provider,
          apiKey: saved.apiKey,
          baseUrl: saved.baseUrl,
          cheapModel: saved.cheapModel,
          strongModel: saved.strongModel
        }
      : null;
  }, [
    state.aiBaseUrlDraft,
    state.aiCheapModelDraft,
    state.aiKeyDraft,
    state.aiProviderDraft,
    state.aiStrongModelDraft,
    state.llmStatus?.configured
  ]);

  const withBrowserAiResponse = useCallback(async (payload: Record<string, unknown>) => {
    if (payload.type !== 'free_text' || !staticRuntimeRef.current) return payload;
    const config = activeBrowserAiConfig();
    if (!config) return payload;
    const text = String(payload.text || '').trim();
    if (!text) return payload;
    try {
      const context = staticRuntimeRef.current.browserAiContext(text);
      const reply = await buildBrowserAiReply(config, context);
      return {
        ...payload,
        ai_response: {
          text: reply,
          provider: config.provider,
          model: config.cheapModel
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Direct provider call failed.';
      return { ...payload, browser_ai_error: `Direct AI call failed; local authored response used instead. ${message}` };
    }
  }, [activeBrowserAiConfig]);

  const postAction = useCallback(async (payload: Record<string, unknown>, options: { showBusy?: boolean; silentError?: boolean } = {}) => {
    if (!state.session?.session_id) return null;
    const sessionId = state.session.session_id;
    const showBusy = options.showBusy !== false;
    const runAction = async () => {
      if (showBusy) dispatch({ type: 'busy', value: true });
      try {
        if (!staticRuntimeRef.current) throw new Error(staticNoBundleMessage());
        const actionPayload = await withBrowserAiResponse(payload);
        const session = staticRuntimeRef.current.action(actionPayload);
        if (!latestSessionIdRef.current || latestSessionIdRef.current === sessionId) {
          dispatch({ type: 'session', value: session, clearBusy: showBusy });
          if (!options.silentError && typeof actionPayload.browser_ai_error === 'string') {
            dispatch({ type: 'error', value: actionPayload.browser_ai_error });
          }
        }
        return session;
      } catch (error) {
        if (!options.silentError && (!latestSessionIdRef.current || latestSessionIdRef.current === sessionId)) {
          dispatch({ type: 'error', value: error instanceof Error ? error.message : 'Action failed.' });
        }
        return null;
      }
    };
    const queuedAction = actionQueueRef.current.then(runAction, runAction);
    actionQueueRef.current = queuedAction.then(() => undefined, () => undefined);
    return queuedAction;
  }, [state.session?.session_id, withBrowserAiResponse]);

  useEffect(() => {
    const sessionId = state.session?.session_id;
    const ended = Boolean(state.session?.state.ended);
    if (!sessionId || state.loading || state.busy || state.simClockPaused || ended) {
      lastAutoAdvanceAtRef.current = null;
      return undefined;
    }

    lastAutoAdvanceAtRef.current = Date.now();
    const intervalId = window.setInterval(() => {
      const now = Date.now();
      const previous = lastAutoAdvanceAtRef.current ?? now;
      lastAutoAdvanceAtRef.current = now;
      const dtMinutes = Math.max(0, (now - previous) / MINUTE_MS);
      if (dtMinutes <= 0) return;
      void postAction(
        { type: 'advance_time', dt_minutes: dtMinutes },
        { showBusy: false, silentError: true }
      );
    }, REALTIME_ADVANCE_INTERVAL_MS);
    return () => {
      window.clearInterval(intervalId);
      lastAutoAdvanceAtRef.current = null;
    };
  }, [postAction, state.busy, state.loading, state.session?.session_id, state.session?.state.ended, state.simClockPaused]);

  const sendFreeText = useCallback(async () => {
    const text = state.chatDraft.trim();
    if (!text) return;
    if (!state.llmStatus?.ready) {
      dispatch({ type: 'error', value: state.llmStatus?.message || 'Dialogue is not ready.' });
      return;
    }
    dispatch({ type: 'chatDraft', value: '' });
    await postAction({ type: 'free_text', text, dt_minutes: 1 });
  }, [postAction, state.chatDraft, state.llmStatus]);

  const configureAi = useCallback(async () => {
    const apiKey = state.aiKeyDraft.trim();
    if (!apiKey) {
      dispatch({ type: 'error', value: 'API key is required to enable BYOK AI.' });
      return;
    }
    dispatch({ type: 'busy', value: true });
    try {
      const provider = state.aiProviderDraft;
      const presetBaseUrl = defaultAIBaseUrl(provider);
      const compatibleBaseUrl = presetBaseUrl || state.aiBaseUrlDraft.trim();
      if (provider === 'openai_compatible' && !compatibleBaseUrl) {
        throw new Error('Base URL is required for OpenAI-compatible providers.');
      }
      const config = {
        provider,
        apiKey,
        baseUrl: provider === 'openai_responses' ? '' : compatibleBaseUrl,
        cheapModel: state.aiCheapModelDraft.trim() || defaultCheapModel(provider),
        strongModel: state.aiStrongModelDraft.trim() || defaultStrongModel(provider)
      };
      const status = browserAiConfiguredStatus(config);
      saveAIConfig(config);
      dispatch({ type: 'aiConfigSaved', value: true });
      dispatch({ type: 'llmStatus', value: status });
      dispatch({ type: 'aiBaseUrlDraft', value: config.baseUrl });
      dispatch({ type: 'aiCheapModelDraft', value: config.cheapModel });
      dispatch({ type: 'aiStrongModelDraft', value: config.strongModel });
      dispatch({ type: 'error', value: '' });
    } catch (error) {
      dispatch({ type: 'error', value: error instanceof Error ? error.message : 'BYOK configuration failed.' });
    } finally {
      dispatch({ type: 'busy', value: false });
    }
  }, [state.aiBaseUrlDraft, state.aiCheapModelDraft, state.aiKeyDraft, state.aiProviderDraft, state.aiStrongModelDraft]);

  const forgetAiConfig = useCallback(() => {
    clearSavedAIConfig();
    dispatch({ type: 'aiConfigSaved', value: false });
    dispatch({ type: 'aiKeyDraft', value: '' });
    dispatch({ type: 'llmStatus', value: staticLlmStatus() });
  }, []);

  const searchOrders = useCallback(async (query: string) => {
    dispatch({ type: 'orders', query, results: state.orderResults });
    try {
      const results = staticRuntimeRef.current ? staticRuntimeRef.current.searchOrders(query) : [];
      dispatch({ type: 'orders', query, results });
    } catch (error) {
      dispatch({ type: 'error', value: error instanceof Error ? error.message : 'Order search failed.' });
    }
  }, [state.orderResults]);

  const placeOrder = useCallback(async (orderId: string) => {
    await postAction({ type: 'order', order_id: orderId, dt_minutes: 0 });
  }, [postAction]);

  const searchExams = useCallback(async (query: string) => {
    dispatch({ type: 'exams', query, results: state.examResults });
    try {
      const results = staticRuntimeRef.current ? staticRuntimeRef.current.searchExams(query) : [];
      dispatch({ type: 'exams', query, results });
    } catch (error) {
      dispatch({ type: 'error', value: error instanceof Error ? error.message : 'Exam search failed.' });
    }
  }, [state.examResults]);

  const performExam = useCallback(async (maneuverId: string) => {
    await postAction({ type: 'exam', exam_maneuver_id: maneuverId, dt_minutes: 0 });
  }, [postAction]);

  const addNote = useCallback(async (text: string) => {
    const note = text.trim();
    if (!note) return;
    await postAction({ type: 'add_note', text: note, dt_minutes: 0 });
  }, [postAction]);

  const recordResultInterpretation = useCallback(async (orderId: string, text: string) => {
    const interpretation = text.trim();
    if (!orderId || !interpretation) return;
    await postAction({ type: 'record_result_interpretation', order_id: orderId, text: interpretation, dt_minutes: 0 });
  }, [postAction]);

  const sendQuickText = useCallback(async (text: string) => {
    const turn = text.trim();
    if (!turn) return;
    if (!state.llmStatus?.ready) {
      dispatch({ type: 'error', value: state.llmStatus?.message || 'Dialogue is not ready.' });
      return;
    }
    await postAction({ type: 'free_text', text: turn, dt_minutes: 1 });
  }, [postAction, state.llmStatus]);

  const applyIntervention = useCallback(async (interventionId: string) => {
    await postAction({ type: 'intervention', intervention_id: interventionId, dt_minutes: 0 });
  }, [postAction]);

  const advanceTime = useCallback(async (minutes: number) => {
    await postAction({ type: 'advance_time', dt_minutes: minutes });
  }, [postAction]);

  const toggleSimClock = useCallback(() => {
    dispatch({ type: 'simClockPaused', value: !state.simClockPaused });
  }, [state.simClockPaused]);

  const commitEsi = useCallback(async () => {
    if (!state.esiDraft) return;
    await postAction({ type: 'commit_esi', payload: { level: state.esiDraft, rationale: state.esiRationale }, dt_minutes: 0 });
  }, [postAction, state.esiDraft, state.esiRationale]);

  const commitDifferential = useCallback(async () => {
    const diagnoses = state.differentialDraft.replaceAll(',', '\n').split('\n').map((item) => item.trim()).filter(Boolean);
    if (!diagnoses.length) return;
    await postAction({ type: 'commit_differential', payload: { diagnoses }, dt_minutes: 0 });
  }, [postAction, state.differentialDraft]);

  const updateSoap = useCallback((field: keyof SoapDraft, value: string) => {
    dispatch({ type: 'soapDraft', field, value });
  }, []);

  const commitSoap = useCallback(async () => {
    await postAction({ type: 'commit_soap', payload: state.soapDraft, dt_minutes: 0 });
  }, [postAction, state.soapDraft]);

  const completeCase = useCallback(async () => {
    const session = await postAction({ type: 'complete', dt_minutes: 0 });
    if (!session?.session_id) return;
    try {
      if (!staticRuntimeRef.current) throw new Error(staticNoBundleMessage());
      const feedback = staticRuntimeRef.current.feedback();
      const gradedPackageRecord = staticRuntimeRef.current.completePackage();
      dispatch({ type: 'package', packageRecord: gradedPackageRecord, feedback });
    } catch (error) {
      dispatch({ type: 'debriefBlocked', reason: error instanceof Error ? error.message : 'Debrief failed.' });
    }
  }, [postAction]);

  const loadTeachingGuide = useCallback(async () => {
    const sessionId = state.session?.session_id;
    if (!sessionId) return null;
    dispatch({ type: 'teachingGuideLoading', value: true });
    try {
      if (!staticRuntimeRef.current) throw new Error(staticNoBundleMessage());
      const guide = staticRuntimeRef.current.teachingGuide();
      dispatch({ type: 'teachingGuide', value: guide });
      return guide;
    } catch (error) {
      dispatch({ type: 'teachingGuideLoading', value: false });
      dispatch({ type: 'error', value: error instanceof Error ? error.message : 'Tutorial guide failed to load.' });
      return null;
    }
  }, [state.session?.session_id]);

  const value = useMemo<EncounterContextValue>(() => ({
    ...state,
    start,
    loadCaseBundle,
    sendFreeText,
    searchOrders,
    searchExams,
    placeOrder,
    performExam,
    addNote,
    recordResultInterpretation,
    sendQuickText,
    applyIntervention,
    advanceTime,
    toggleSimClock,
    commitEsi,
    commitDifferential,
    updateSoap,
    commitSoap,
    completeCase,
    loadTeachingGuide,
    configureAi,
    forgetAiConfig,
    setChatDraft: (next) => dispatch({ type: 'chatDraft', value: next }),
    setAiProviderDraft: (next) => dispatch({ type: 'aiProviderDraft', value: next }),
    setAiKeyDraft: (next) => dispatch({ type: 'aiKeyDraft', value: next }),
    setAiBaseUrlDraft: (next) => dispatch({ type: 'aiBaseUrlDraft', value: next }),
    setAiCheapModelDraft: (next) => dispatch({ type: 'aiCheapModelDraft', value: next }),
    setAiStrongModelDraft: (next) => dispatch({ type: 'aiStrongModelDraft', value: next }),
    setEsiDraft: (level, rationale) => dispatch({ type: 'esiDraft', level, rationale }),
    setDifferentialDraft: (next) => dispatch({ type: 'differentialDraft', value: next })
  }), [
    state,
    start,
    loadCaseBundle,
    sendFreeText,
    searchOrders,
    searchExams,
    placeOrder,
    performExam,
    addNote,
    recordResultInterpretation,
    sendQuickText,
    applyIntervention,
    advanceTime,
    toggleSimClock,
    commitEsi,
    commitDifferential,
    updateSoap,
    commitSoap,
    completeCase,
    loadTeachingGuide,
    configureAi,
    forgetAiConfig
  ]);

  return <EncounterContext.Provider value={value}>{children}</EncounterContext.Provider>;
}

export function useEncounter() {
  const context = useContext(EncounterContext);
  if (!context) throw new Error('useEncounter must be used inside EncounterProvider');
  return context;
}
