import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';

const API_BASE = (import.meta as any).env?.VITE_ED_SIM_API || 'http://localhost:8000';

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
  values: ResultValue[];
  narrative?: string | null;
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
  running_summary: string;
};

export type ApiSession = {
  session_id: string;
  snapshot: Snapshot;
  state: {
    esi_history: Array<{ level: number; rationale: string; elapsed_minutes: number }>;
    differential: string[];
    soap: SoapDraft;
    completeness_flags: Record<string, unknown>;
    can_complete: boolean;
    ended: boolean;
    transcript: TranscriptMessage[];
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
  teaching_points?: Array<{ claim: string; grounded: boolean; evidence_id?: string | null }>;
};

type EncounterState = {
  session: ApiSession | null;
  previousSnapshot: Snapshot | null;
  loading: boolean;
  busy: boolean;
  error: string;
  orderQuery: string;
  orderResults: CatalogOrder[];
  chatDraft: string;
  esiDraft: number | '';
  esiRationale: string;
  differentialDraft: string;
  soapDraft: SoapDraft;
  packageRecord: Record<string, unknown> | null;
  feedback: GraderFeedback | null;
};

type EncounterAction =
  | { type: 'loading' }
  | { type: 'busy'; value: boolean }
  | { type: 'error'; value: string }
  | { type: 'session'; value: ApiSession }
  | { type: 'orders'; query: string; results: CatalogOrder[] }
  | { type: 'chatDraft'; value: string }
  | { type: 'esiDraft'; level: number | ''; rationale?: string }
  | { type: 'differentialDraft'; value: string }
  | { type: 'soapDraft'; field: keyof SoapDraft; value: string }
  | { type: 'package'; packageRecord: Record<string, unknown>; feedback: GraderFeedback };

const initialState: EncounterState = {
  session: null,
  previousSnapshot: null,
  loading: true,
  busy: false,
  error: '',
  orderQuery: '',
  orderResults: [],
  chatDraft: '',
  esiDraft: '',
  esiRationale: '',
  differentialDraft: '',
  soapDraft: { subjective: '', objective: '', assessment: '', plan: '' },
  packageRecord: null,
  feedback: null
};

function hasSoapContent(soap?: SoapDraft | null) {
  return Boolean(soap && Object.values(soap).some((value) => value.trim()));
}

function reducer(state: EncounterState, action: EncounterAction): EncounterState {
  if (action.type === 'loading') return { ...state, loading: true, error: '' };
  if (action.type === 'busy') return { ...state, busy: action.value };
  if (action.type === 'error') return { ...state, loading: false, busy: false, error: action.value };
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
      feedback: newSession ? null : state.feedback
    };
  }
  if (action.type === 'orders') return { ...state, orderQuery: action.query, orderResults: action.results };
  if (action.type === 'chatDraft') return { ...state, chatDraft: action.value };
  if (action.type === 'esiDraft') return { ...state, esiDraft: action.level, esiRationale: action.rationale ?? state.esiRationale };
  if (action.type === 'differentialDraft') return { ...state, differentialDraft: action.value };
  if (action.type === 'soapDraft') return { ...state, soapDraft: { ...state.soapDraft, [action.field]: action.value } };
  if (action.type === 'package') return { ...state, packageRecord: action.packageRecord, feedback: action.feedback, busy: false };
  return state;
}

type EncounterContextValue = EncounterState & {
  start: () => Promise<void>;
  sendFreeText: () => Promise<void>;
  searchOrders: (query: string) => Promise<void>;
  placeOrder: (orderId: string) => Promise<void>;
  applyIntervention: (interventionId: string) => Promise<void>;
  advanceTime: (minutes: number) => Promise<void>;
  commitEsi: () => Promise<void>;
  commitDifferential: () => Promise<void>;
  updateSoap: (field: keyof SoapDraft, value: string) => void;
  commitSoap: () => Promise<void>;
  completeCase: () => Promise<void>;
  setChatDraft: (value: string) => void;
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
      throw new Error(detail.detail || `Request failed: ${response.status}`);
    }
    return response.json();
  }, []);

  const start = useCallback(async () => {
    dispatch({ type: 'loading' });
    try {
      const session = await request<ApiSession>('/api/sessions', { method: 'POST', body: JSON.stringify({}) });
      dispatch({ type: 'session', value: session });
      const orders = await request<CatalogOrder[]>('/api/orders/search?q=');
      dispatch({ type: 'orders', query: '', results: orders });
    } catch (error) {
      dispatch({ type: 'error', value: error instanceof Error ? error.message : 'Could not start simulator session.' });
    }
  }, [request]);

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
    dispatch({ type: 'chatDraft', value: '' });
    await postAction({ type: 'free_text', text, dt_minutes: 1 });
  }, [postAction, state.chatDraft]);

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
        body: JSON.stringify({
          rubric: { expected_orders: ['d_dimer', 'ct_pulmonary_angiography'], esi_tolerance: 0 },
          evidence_passages: []
        })
      });
      const packageRecord = await request<Record<string, unknown>>(`/api/sessions/${session.session_id}/package`);
      dispatch({ type: 'package', packageRecord, feedback });
    } catch (error) {
      dispatch({ type: 'error', value: error instanceof Error ? error.message : 'Debrief failed.' });
    }
  }, [postAction, request]);

  const value = useMemo<EncounterContextValue>(() => ({
    ...state,
    start,
    sendFreeText,
    searchOrders,
    placeOrder,
    applyIntervention,
    advanceTime,
    commitEsi,
    commitDifferential,
    updateSoap,
    commitSoap,
    completeCase,
    setChatDraft: (next) => dispatch({ type: 'chatDraft', value: next }),
    setEsiDraft: (level, rationale) => dispatch({ type: 'esiDraft', level, rationale }),
    setDifferentialDraft: (next) => dispatch({ type: 'differentialDraft', value: next })
  }), [
    state,
    start,
    sendFreeText,
    searchOrders,
    placeOrder,
    applyIntervention,
    advanceTime,
    commitEsi,
    commitDifferential,
    updateSoap,
    commitSoap,
    completeCase
  ]);

  return <EncounterContext.Provider value={value}>{children}</EncounterContext.Provider>;
}

export function useEncounter() {
  const context = useContext(EncounterContext);
  if (!context) throw new Error('useEncounter must be used inside EncounterProvider');
  return context;
}
