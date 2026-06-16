import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';

const previewApiBase =
  typeof window !== 'undefined' && window.location.port === '4173'
    ? 'http://127.0.0.1:18000'
    : 'http://localhost:8000';
const API_BASE = (import.meta as any).env?.VITE_ED_SIM_API || previewApiBase;
const AI_CONFIG_STORAGE_KEY = 'ed-simulator.ai-config.v1';

type AIProviderDraft = 'openai_responses' | 'openai_compatible' | 'openrouter';

type SavedAIConfig = {
  version: 1;
  provider: AIProviderDraft;
  apiKey: string;
  baseUrl: string;
  cheapModel: string;
  strongModel: string;
};

function readSavedAIConfig(): SavedAIConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(AI_CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedAIConfig>;
    const provider = parsed.provider;
    if (!['openai_responses', 'openai_compatible', 'openrouter'].includes(String(provider))) return null;
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

function defaultCheapModel(provider: AIProviderDraft) {
  return provider === 'openrouter' ? 'openai/gpt-4o-mini' : 'gpt-5.4-mini';
}

function defaultStrongModel(provider: AIProviderDraft) {
  return provider === 'openrouter' ? 'openai/gpt-4o' : 'gpt-5.5';
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

type ExamCatalogPayload = {
  items: ExamManeuver[];
  tree?: Record<string, Record<string, ExamManeuver[]>>;
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

export type TokenUsageRecord = {
  tier: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  estimated_cost_usd: number;
  purpose: string;
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

type EncounterState = {
  session: ApiSession | null;
  previousSnapshot: Snapshot | null;
  loading: boolean;
  busy: boolean;
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
};

type EncounterAction =
  | { type: 'loading' }
  | { type: 'busy'; value: boolean }
  | { type: 'error'; value: string }
  | { type: 'session'; value: ApiSession }
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
  | { type: 'debriefBlocked'; reason: string };

const savedAIConfig = readSavedAIConfig();

const initialState: EncounterState = {
  session: null,
  previousSnapshot: null,
  loading: true,
  busy: false,
  error: '',
  llmStatus: null,
  aiConfigSaved: Boolean(savedAIConfig),
  aiProviderDraft: savedAIConfig?.provider || 'openai_responses',
  aiKeyDraft: savedAIConfig?.apiKey || '',
  aiBaseUrlDraft: savedAIConfig?.baseUrl || '',
  aiCheapModelDraft: savedAIConfig?.cheapModel || 'gpt-5.4-mini',
  aiStrongModelDraft: savedAIConfig?.strongModel || 'gpt-5.5',
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
  debriefBlockedReason: ''
};

function hasSoapContent(soap?: SoapDraft | null) {
  return Boolean(soap && Object.values(soap).some((value) => value.trim()));
}

function caseIdFromUrl() {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('case_id')?.trim() || '';
}

function reducer(state: EncounterState, action: EncounterAction): EncounterState {
  if (action.type === 'loading') return { ...state, loading: true, error: '' };
  if (action.type === 'busy') return { ...state, busy: action.value };
  if (action.type === 'error') return { ...state, loading: false, busy: false, error: action.value };
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
      busy: false,
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
      debriefBlockedReason: newSession ? '' : state.debriefBlockedReason
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
  return state;
}

type EncounterContextValue = EncounterState & {
  start: () => Promise<void>;
  sendFreeText: () => Promise<void>;
  searchOrders: (query: string) => Promise<void>;
  searchExams: (query: string) => Promise<void>;
  placeOrder: (orderId: string) => Promise<void>;
  performExam: (maneuverId: string) => Promise<void>;
  applyIntervention: (interventionId: string) => Promise<void>;
  advanceTime: (minutes: number) => Promise<void>;
  commitEsi: () => Promise<void>;
  commitDifferential: () => Promise<void>;
  updateSoap: (field: keyof SoapDraft, value: string) => void;
  commitSoap: () => Promise<void>;
  completeCase: () => Promise<void>;
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

  const request = useCallback(async <T,>(path: string, options?: RequestInit): Promise<T> => {
    const headers = options?.body
      ? { 'Content-Type': 'application/json', ...(options?.headers || {}) }
      : options?.headers;
    const response = await fetch(`${API_BASE}${path}`, {
      headers,
      ...options
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      const message =
        typeof detail.detail === 'string'
          ? detail.detail
          : typeof detail.detail?.message === 'string'
            ? detail.detail.message
            : `Request failed: ${response.status}`;
      throw new Error(message);
    }
    return response.json();
  }, []);

  const requestAiConfiguration = useCallback(async (config: Omit<SavedAIConfig, 'version'>) => {
    return request<LLMStatus>('/api/llm/config', {
      method: 'POST',
      body: JSON.stringify({
        provider: config.provider,
        api_key: config.apiKey,
        base_url: config.provider === 'openai_responses' ? undefined : config.baseUrl || undefined,
        cheap_model: config.cheapModel || undefined,
        strong_model: config.strongModel || undefined
      })
    });
  }, [request]);

  const start = useCallback(async () => {
    dispatch({ type: 'loading' });
    let startupWarning = '';
    try {
      let llmStatus = await request<LLMStatus>('/api/llm/status');
      const localConfig = readSavedAIConfig();
      if (!llmStatus.ready && localConfig) {
        try {
          llmStatus = await requestAiConfiguration({
            provider: localConfig.provider,
            apiKey: localConfig.apiKey,
            baseUrl: localConfig.baseUrl,
            cheapModel: localConfig.cheapModel,
            strongModel: localConfig.strongModel
          });
          dispatch({ type: 'aiConfigSaved', value: true });
        } catch (error) {
          startupWarning = error instanceof Error ? `Saved AI configuration failed: ${error.message}` : 'Saved AI configuration failed.';
        }
      }
      dispatch({ type: 'llmStatus', value: llmStatus });
      const caseId = caseIdFromUrl();
      const session = await request<ApiSession>('/api/sessions', {
        method: 'POST',
        body: JSON.stringify(caseId ? { case_id: caseId } : {})
      });
      dispatch({ type: 'session', value: session });
      const orders = await request<CatalogOrder[]>('/api/orders/search?q=');
      dispatch({ type: 'orders', query: '', results: orders });
      const examCatalog = await request<ExamCatalogPayload>('/api/exams/catalog');
      const exams = examCatalog.items || [];
      dispatch({ type: 'examCatalog', results: exams });
      dispatch({ type: 'exams', query: '', results: exams.slice(0, 12) });
      if (startupWarning) dispatch({ type: 'error', value: startupWarning });
    } catch (error) {
      dispatch({ type: 'error', value: error instanceof Error ? error.message : 'Could not start simulator session.' });
    }
  }, [request, requestAiConfiguration]);

  useEffect(() => {
    void start();
  }, [start]);

  const postAction = useCallback(async (payload: Record<string, unknown>) => {
    if (!state.session?.session_id) return null;
    dispatch({ type: 'busy', value: true });
    try {
      const session = await request<ApiSession>(`/api/sessions/${state.session.session_id}/actions`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      dispatch({ type: 'session', value: session });
      return session;
    } catch (error) {
      dispatch({ type: 'error', value: error instanceof Error ? error.message : 'Action failed.' });
      return null;
    }
  }, [request, state.session?.session_id]);

  const sendFreeText = useCallback(async () => {
    const text = state.chatDraft.trim();
    if (!text) return;
    if (!state.llmStatus?.ready) {
      dispatch({ type: 'error', value: state.llmStatus?.message || 'AI provider is not configured.' });
      return;
    }
    dispatch({ type: 'chatDraft', value: '' });
    await postAction({ type: 'free_text', text, dt_minutes: 1 });
  }, [postAction, state.chatDraft, state.llmStatus]);

  const configureAi = useCallback(async () => {
    const apiKey = state.aiKeyDraft.trim();
    if (!apiKey) {
      dispatch({ type: 'error', value: 'API key is required to enable AI conversation.' });
      return;
    }
    dispatch({ type: 'busy', value: true });
    try {
      const provider = state.aiProviderDraft;
      const compatibleBaseUrl = provider === 'openrouter'
        ? 'https://openrouter.ai/api/v1/chat/completions'
        : state.aiBaseUrlDraft.trim();
      const config = {
        provider,
        apiKey,
        baseUrl: provider === 'openai_responses' ? '' : compatibleBaseUrl,
        cheapModel: state.aiCheapModelDraft.trim() || defaultCheapModel(provider),
        strongModel: state.aiStrongModelDraft.trim() || defaultStrongModel(provider)
      };
      const status = await requestAiConfiguration(config);
      if (status.ready) {
        saveAIConfig(config);
        dispatch({ type: 'aiConfigSaved', value: true });
      }
      dispatch({ type: 'llmStatus', value: status });
      dispatch({ type: 'aiBaseUrlDraft', value: config.baseUrl });
      dispatch({ type: 'aiCheapModelDraft', value: config.cheapModel });
      dispatch({ type: 'aiStrongModelDraft', value: config.strongModel });
      dispatch({ type: 'error', value: status.ready ? '' : status.message });
    } catch (error) {
      dispatch({ type: 'error', value: error instanceof Error ? error.message : 'AI configuration failed.' });
    } finally {
      dispatch({ type: 'busy', value: false });
    }
  }, [
    requestAiConfiguration,
    state.aiBaseUrlDraft,
    state.aiCheapModelDraft,
    state.aiKeyDraft,
    state.aiProviderDraft,
    state.aiStrongModelDraft
  ]);

  const forgetAiConfig = useCallback(() => {
    clearSavedAIConfig();
    dispatch({ type: 'aiConfigSaved', value: false });
    dispatch({ type: 'aiKeyDraft', value: '' });
  }, []);

  const searchOrders = useCallback(async (query: string) => {
    dispatch({ type: 'orders', query, results: state.orderResults });
    try {
      const results = await request<CatalogOrder[]>(`/api/orders/search?q=${encodeURIComponent(query)}`);
      dispatch({ type: 'orders', query, results });
    } catch (error) {
      dispatch({ type: 'error', value: error instanceof Error ? error.message : 'Order search failed.' });
    }
  }, [request, state.orderResults]);

  const placeOrder = useCallback(async (orderId: string) => {
    await postAction({ type: 'order', order_id: orderId, dt_minutes: 0 });
  }, [postAction]);

  const searchExams = useCallback(async (query: string) => {
    dispatch({ type: 'exams', query, results: state.examResults });
    try {
      const results = await request<ExamManeuver[]>(`/api/exams/search?q=${encodeURIComponent(query)}`);
      dispatch({ type: 'exams', query, results });
    } catch (error) {
      dispatch({ type: 'error', value: error instanceof Error ? error.message : 'Exam search failed.' });
    }
  }, [request, state.examResults]);

  const performExam = useCallback(async (maneuverId: string) => {
    await postAction({ type: 'exam', exam_maneuver_id: maneuverId, dt_minutes: 0 });
  }, [postAction]);

  const applyIntervention = useCallback(async (interventionId: string) => {
    await postAction({ type: 'intervention', intervention_id: interventionId, dt_minutes: 0 });
  }, [postAction]);

  const advanceTime = useCallback(async (minutes: number) => {
    await postAction({ type: 'advance_time', dt_minutes: minutes });
  }, [postAction]);

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
      const feedback = await request<GraderFeedback>(`/api/sessions/${session.session_id}/grade`, {
        method: 'POST',
        body: JSON.stringify({})
      });
      const gradedPackageRecord = await request<Record<string, unknown>>(`/api/sessions/${session.session_id}/package`);
      dispatch({ type: 'package', packageRecord: gradedPackageRecord, feedback });
    } catch (error) {
      dispatch({ type: 'debriefBlocked', reason: error instanceof Error ? error.message : 'Debrief failed.' });
    }
  }, [postAction, request]);

  const value = useMemo<EncounterContextValue>(() => ({
    ...state,
    start,
    sendFreeText,
    searchOrders,
    searchExams,
    placeOrder,
    performExam,
    applyIntervention,
    advanceTime,
    commitEsi,
    commitDifferential,
    updateSoap,
    commitSoap,
    completeCase,
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
    sendFreeText,
    searchOrders,
    searchExams,
    placeOrder,
    performExam,
    applyIntervention,
    advanceTime,
    commitEsi,
    commitDifferential,
    updateSoap,
    commitSoap,
    completeCase,
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
