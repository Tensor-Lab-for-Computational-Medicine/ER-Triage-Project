export type BrowserAiProvider = 'openai_responses' | 'deepseek' | 'openai_compatible' | 'openrouter';

export type BrowserAiConfig = {
  provider: BrowserAiProvider;
  apiKey: string;
  baseUrl: string;
  cheapModel: string;
  strongModel: string;
};

export type BrowserAiModelOption = {
  id: string;
  label: string;
  description?: string;
};

export type BrowserAiTurnContext = {
  learner_text: string;
  target_speaker?: string;
  case_title?: string;
  visible_start?: Record<string, unknown>;
  elapsed_minutes?: number;
  phase?: string;
  current_vitals?: Record<string, unknown>;
  appearance?: string;
  running_summary?: string;
  active_orders?: unknown[];
  resulted_orders?: unknown[];
  performed_exams?: unknown[];
  interventions?: unknown[];
  hpi_facts?: unknown[];
  home_medications?: unknown[];
  source_context?: Record<string, unknown>;
  transcript_tail?: unknown[];
};

export function browserAiConfiguredStatus(config: BrowserAiConfig) {
  return {
    ready: true,
    configured: true,
    provider: config.provider,
    cheap_model: config.cheapModel,
    strong_model: config.strongModel,
    base_url: config.provider === 'openai_responses' ? 'https://api.openai.com/v1/responses' : config.baseUrl,
    missing: [],
    message: 'BYOK AI is enabled for dialogue. The key is stored only in this browser.'
  };
}

export async function fetchOpenRouterModelOptions(): Promise<BrowserAiModelOption[]> {
  const response = await fetch('https://openrouter.ai/api/v1/models', {
    headers: { Accept: 'application/json' }
  });
  const body = await parseJsonResponse(response);
  const rows = Array.isArray(body?.data) ? body.data : [];
  return rows
    .filter((row: any) => {
      const id = typeof row?.id === 'string' ? row.id.trim() : '';
      if (!id) return false;
      const outputModalities = row?.architecture?.output_modalities;
      return !Array.isArray(outputModalities) || outputModalities.includes('text');
    })
    .slice(0, 300)
    .map((row: any) => ({
      id: row.id.trim(),
      label: typeof row.name === 'string' && row.name.trim() ? row.name.trim() : row.id.trim(),
      description: typeof row.description === 'string' ? row.description.trim() : ''
    }));
}

export async function buildBrowserAiReply(config: BrowserAiConfig, context: BrowserAiTurnContext): Promise<string> {
  if (!config.apiKey.trim()) throw new Error('API key is required.');
  if (config.provider === 'openai_responses') {
    return createOpenAiResponsesReply(config, context);
  }
  return createChatCompletionsReply(config, context);
}

async function createOpenAiResponsesReply(config: BrowserAiConfig, context: BrowserAiTurnContext) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: config.cheapModel,
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: systemPrompt() }]
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: userPrompt(context) }]
        }
      ],
      max_output_tokens: 260
    })
  });
  const body = await parseJsonResponse(response);
  const outputText = typeof body.output_text === 'string' ? body.output_text.trim() : '';
  if (outputText) return outputText;
  const nested = body.output
    ?.flatMap((item: any) => item.content || [])
    ?.map((item: any) => item.text || item.content || '')
    ?.filter(Boolean)
    ?.join('\n')
    ?.trim();
  if (nested) return nested;
  throw new Error('The provider returned no dialogue text.');
}

async function createChatCompletionsReply(config: BrowserAiConfig, context: BrowserAiTurnContext) {
  const endpoint = chatCompletionsEndpoint(config);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://localhost',
      'X-Title': 'ED Clinical Simulator'
    },
    body: JSON.stringify({
      model: config.cheapModel,
      messages: [
        { role: 'system', content: systemPrompt() },
        { role: 'user', content: userPrompt(context) }
      ],
      temperature: 0.2,
      max_tokens: 260
    })
  });
  const body = await parseJsonResponse(response);
  const text = body.choices?.[0]?.message?.content;
  if (typeof text === 'string' && text.trim()) return text.trim();
  throw new Error('The provider returned no dialogue text.');
}

async function parseJsonResponse(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      body?.error?.message ||
      body?.message ||
      body?.detail ||
      `Provider request failed with HTTP ${response.status}.`;
    throw new Error(String(message));
  }
  return body;
}

function chatCompletionsEndpoint(config: BrowserAiConfig) {
  if (config.provider === 'deepseek') return 'https://api.deepseek.com/chat/completions';
  if (config.provider === 'openrouter') return 'https://openrouter.ai/api/v1/chat/completions';
  return config.baseUrl.trim();
}

function systemPrompt() {
  return [
    'You are the browser-local dialogue layer for an emergency department clinical reasoning simulator.',
    'Answer as the requested role only: patient, nurse, or consultant.',
    'Use only the case context, visible state, transcript, and resulted studies provided.',
    'Do not invent unresulted labs, imaging, procedures, or vital-sign changes.',
    'Do not reveal final diagnosis, disposition, grading, debrief, or answer-key language unless the encounter is already complete.',
    'Keep responses clinically realistic, concise, and usable during an ED simulation.'
  ].join(' ');
}

function userPrompt(context: BrowserAiTurnContext) {
  return [
    `Learner message: ${context.learner_text}`,
    `Target speaker: ${context.target_speaker || 'patient'}`,
    'Current simulator context:',
    JSON.stringify(context, null, 2)
  ].join('\n\n');
}
