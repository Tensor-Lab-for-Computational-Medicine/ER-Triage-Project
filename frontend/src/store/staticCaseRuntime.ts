import JSZip from 'jszip';
import type {
  ApiSession,
  CatalogOrder,
  ExamManeuver,
  GraderFeedback,
  LLMStatus,
  ResultBundle,
  SoapDraft,
  TeachingGuide,
  VitalSigns
} from './encounterStore';

type PreparedCase = Record<string, any>;
type StaticBundle = {
  case: PreparedCase;
  orders: CatalogOrder[];
  exams: ExamManeuver[];
  bundleName: string;
  objectUrls: string[];
};

type StaticState = {
  session_id: string;
  case_id: string;
  current_vitals: VitalSigns;
  previous_vitals: VitalSigns;
  elapsed_minutes: number;
  phase: string;
  active_orders: Record<string, any>;
  interventions: string[];
  performed_exams: any[];
  intervention_events: any[];
  esi_history: any[];
  differential: string[];
  soap: SoapDraft;
  completeness_flags: Record<string, any>;
  running_summary: string;
  transcript: any[];
  result_interpretations: Record<string, any>;
  ended: boolean;
  token_usage: any[];
};

const IMMEDIATE_ORDER_TYPES = new Set(['intervention', 'medication', 'procedure']);

export function staticLlmStatus(): LLMStatus {
  return {
    ready: true,
    configured: false,
    provider: 'local_static',
    cheap_model: 'authored/mock responses',
    strong_model: 'local debrief',
    base_url: '',
    missing: [],
    message: 'Local authored responses are active. Add a BYOK key in Settings to try direct AI dialogue.'
  };
}

export function staticNoBundleMessage() {
  return 'Load a case bundle zip to start the static simulator.';
}

export async function loadStaticCaseBundle(files: FileList | File[]): Promise<{
  runtime: StaticCaseRuntime;
  session: ApiSession;
  orders: CatalogOrder[];
  exams: ExamManeuver[];
  bundleName: string;
}> {
  const bundle = await readBundle(files);
  const runtime = new StaticCaseRuntime(bundle);
  return {
    runtime,
    session: runtime.start(),
    orders: bundle.orders,
    exams: bundle.exams,
    bundleName: bundle.bundleName
  };
}

async function readBundle(filesLike: FileList | File[]): Promise<StaticBundle> {
  const files = Array.from(filesLike || []);
  if (!files.length) {
    throw new Error('Choose a case bundle zip or prepared_case.json file.');
  }

  const zipFile = files.find((file) => file.name.toLowerCase().endsWith('.zip'));
  if (zipFile) return readZipBundle(zipFile);
  return readLooseFiles(files, files[0]?.name || 'local files');
}

async function readZipBundle(file: File): Promise<StaticBundle> {
  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  const readText = async (matcher: (path: string) => boolean) => {
    const entry = entries.find((item) => matcher(normalizePath(item.name)));
    return entry ? entry.async('text') : null;
  };
  const preparedText = await readText((path) => path.endsWith('/prepared_case.json') || path === 'prepared_case.json');
  if (!preparedText) throw new Error('Bundle is missing prepared_case.json.');
  const caseJson = JSON.parse(preparedText);
  const orderText = await readText((path) => path.endsWith('/order_catalog.json') || path === 'order_catalog.json');
  const examText = await readText((path) => path.endsWith('/exam_catalog.json') || path === 'exam_catalog.json');
  const objectUrls: string[] = [];

  await patchCaseMedia(caseJson, {
    objectUrls,
    findBlob: async (wantedPath, wantedName) => {
      const match = entries.find((entry) => {
        const path = normalizePath(entry.name);
        return path.endsWith(wantedPath) || basename(path) === wantedName;
      });
      return match ? match.async('blob') : null;
    }
  });

  await patchEcgSvgArtifacts(caseJson, {
    objectUrls,
    findBlob: async (orderId) => {
      const match = entries.find((entry) => {
        const path = normalizePath(entry.name);
        return path.endsWith(`/ecg/${orderId}.svg`) || path.endsWith(`/${orderId}.svg`) || basename(path) === `${orderId}.svg`;
      });
      return match ? match.async('blob') : null;
    }
  });

  return {
    case: caseJson,
    orders: parseCatalog(orderText, 'order_catalog.json', () => buildOrderCatalog(caseJson)),
    exams: parseCatalog(examText, 'exam_catalog.json', () => buildExamCatalog(caseJson)),
    bundleName: file.name,
    objectUrls
  };
}

async function readLooseFiles(files: File[], bundleName: string): Promise<StaticBundle> {
  const findByName = (name: string) => files.find((file) => normalizePath((file as any).webkitRelativePath || file.name).endsWith(name));
  const preparedFile = findByName('prepared_case.json') || files.find((file) => file.name === 'prepared_case.json') || files.find((file) => file.name.endsWith('.json'));
  if (!preparedFile) throw new Error('Choose prepared_case.json or a case bundle zip.');
  const caseJson = JSON.parse(await preparedFile.text());
  const objectUrls: string[] = [];

  await patchCaseMedia(caseJson, {
    objectUrls,
    findBlob: async (wantedPath, wantedName) => {
      const match = files.find((file) => {
        const path = normalizePath((file as any).webkitRelativePath || file.name);
        return path.endsWith(wantedPath) || file.name === wantedName;
      });
      return match || null;
    }
  });

  await patchEcgSvgArtifacts(caseJson, {
    objectUrls,
    findBlob: async (orderId) => {
      const match = files.find((file) => {
        const path = normalizePath((file as any).webkitRelativePath || file.name);
        return path.endsWith(`/ecg/${orderId}.svg`) || path.endsWith(`/${orderId}.svg`) || file.name === `${orderId}.svg`;
      });
      return match || null;
    }
  });

  return {
    case: caseJson,
    orders: parseCatalog(findByName('order_catalog.json') ? await findByName('order_catalog.json')!.text() : null, 'order_catalog.json', () => buildOrderCatalog(caseJson)),
    exams: parseCatalog(findByName('exam_catalog.json') ? await findByName('exam_catalog.json')!.text() : null, 'exam_catalog.json', () => buildExamCatalog(caseJson)),
    bundleName,
    objectUrls
  };
}

function parseCatalog<T>(text: string | null, label: string, fallback: () => T[]): T[] {
  if (!text) return fallback();
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error(`${label} must be a JSON array.`);
  return parsed;
}

const CORE_ORDERS: CatalogOrder[] = [
  { id: 'cardiac_monitor', type: 'procedure', name: 'Cardiac monitoring', aliases: ['monitor', 'telemetry', 'cardiac monitor'], result_delay_min: 0 },
  { id: 'oxygen', type: 'intervention', name: 'Supplemental oxygen', aliases: ['o2', 'oxygen', 'nasal cannula'], result_delay_min: 0 },
  { id: 'continuous_pulse_ox', type: 'procedure', name: 'Continuous pulse oximetry', aliases: ['pulse ox', 'pulse oximetry', 'continuous pulse ox'], result_delay_min: 0 },
  { id: 'iv_access', type: 'procedure', name: 'IV access', aliases: ['iv', 'intravenous access', 'large bore iv'], result_delay_min: 0 },
  { id: 'iv_fluids', type: 'medication', name: 'IV crystalloid bolus', aliases: ['fluids', 'iv fluids', 'bolus', 'normal saline', 'lactated ringer'], result_delay_min: 0 },
  { id: 'analgesia', type: 'medication', name: 'Analgesia', aliases: ['pain medicine', 'pain medication', 'pain control', 'opioid'], result_delay_min: 0 }
];

const CORE_EXAMS: ExamManeuver[] = [
  { id: 'general_inspection_appearance', region: 'general', maneuver_type: 'inspection', name: 'General appearance', aliases: ['appearance', 'general inspection', 'distress'] },
  { id: 'respiratory_auscultation_breath_sounds', region: 'respiratory', maneuver_type: 'auscultation', name: 'Breath sounds', aliases: ['lungs', 'auscultate lungs', 'breath sounds'] },
  { id: 'cardiovascular_auscultation_heart_sounds', region: 'cardiovascular', maneuver_type: 'auscultation', name: 'Heart sounds', aliases: ['heart', 'cardiac auscultation', 'murmur'] },
  { id: 'abdomen_inspection_distention', region: 'abdomen', maneuver_type: 'inspection', name: 'Abdominal distention inspection', aliases: ['inspect abdomen', 'distended abdomen', 'bloating'] },
  { id: 'abdomen_auscultation_bowel_sounds', region: 'abdomen', maneuver_type: 'auscultation', name: 'Bowel sounds', aliases: ['auscultate abdomen', 'listen abdomen', 'bowel sounds'] },
  { id: 'abdomen_percussion_tympany', region: 'abdomen', maneuver_type: 'percussion', name: 'Percussion for tympany', aliases: ['percuss abdomen', 'tympany', 'dullness abdomen'] },
  { id: 'abdomen_palpation_light', region: 'abdomen', maneuver_type: 'palpation', name: 'Light abdominal palpation', aliases: ['palpate abdomen', 'light palpation', 'abdominal tenderness'] },
  { id: 'abdomen_palpation_guarding', region: 'abdomen', maneuver_type: 'palpation', name: 'Guarding', aliases: ['guarding', 'peritoneal signs'] },
  { id: 'abdomen_palpation_rebound', region: 'abdomen', maneuver_type: 'palpation', name: 'Rebound tenderness', aliases: ['rebound', 'peritonitis'] },
  { id: 'abdomen_special_murphy', region: 'abdomen', maneuver_type: 'special tests', name: 'Murphy sign', aliases: ['murphy', 'ruq pain'] }
];

function buildOrderCatalog(caseJson: PreparedCase): CatalogOrder[] {
  const catalog = new Map<string, CatalogOrder>();
  const addOrder = (order: CatalogOrder) => {
    if (!order.id) return;
    const existing = catalog.get(order.id);
    if (!existing) {
      catalog.set(order.id, { ...order, aliases: unique(order.aliases || []) });
      return;
    }
    catalog.set(order.id, {
      ...existing,
      name: existing.name === humanizeId(existing.id) ? order.name : existing.name,
      type: existing.type || order.type,
      aliases: unique([...(existing.aliases || []), ...(order.aliases || [])]),
      result_delay_min: existing.result_delay_min || order.result_delay_min
    });
  };

  CORE_ORDERS.forEach(addOrder);

  const rubric = caseJson.rubric || {};
  [...asArray(rubric.indicated_interventions), ...asArray(rubric.excessive_interventions), ...asArray(rubric.critical_actions)]
    .forEach((action) => {
      const id = normalizedId(actionId(action));
      if (!id) return;
      const name = actionLabel(action) || humanizeId(id);
      addOrder({
        id,
        type: inferImmediateOrderType(id, name),
        name,
        aliases: aliasesFor(id, name),
        result_delay_min: 0
      });
    });

  objectEntries(caseJson.result_bundles).forEach(([key, bundle]) => {
    const id = normalizedId(bundle?.order_id || key);
    if (!id) return;
    const name = String(bundle?.display_name || humanizeId(id));
    const type = inferOrderType(id, name, bundle);
    addOrder({
      id,
      type,
      name,
      aliases: aliasesFor(id, name),
      result_delay_min: explicitDelay(bundle?.resulted_at_min) ?? defaultDelayFor(type, id, name)
    });
  });

  asArray(rubric.expected_orders).forEach((orderId) => {
    const id = normalizedId(orderId);
    if (!id) return;
    const existingBundle = caseJson.result_bundles?.[id];
    const name = String(existingBundle?.display_name || humanizeId(id));
    const type = inferOrderType(id, name, existingBundle || {});
    addOrder({
      id,
      type,
      name,
      aliases: aliasesFor(id, name),
      result_delay_min: defaultDelayFor(type, id, name)
    });
  });

  return Array.from(catalog.values());
}

function buildExamCatalog(caseJson: PreparedCase): ExamManeuver[] {
  const catalog = new Map<string, ExamManeuver>();
  const addExam = (exam: ExamManeuver) => {
    if (!exam.id) return;
    const existing = catalog.get(exam.id);
    if (!existing) {
      catalog.set(exam.id, { ...exam, aliases: unique(exam.aliases || []) });
      return;
    }
    catalog.set(exam.id, {
      ...existing,
      name: existing.name === humanizeId(existing.id) ? exam.name : existing.name,
      aliases: unique([...(existing.aliases || []), ...(exam.aliases || [])])
    });
  };

  CORE_EXAMS.forEach(addExam);
  asArray(caseJson.rubric?.indicated_exams).forEach((action) => {
    const id = normalizedId(actionId(action));
    if (!id) return;
    const name = actionLabel(action) || humanizeId(id);
    addExam({
      id,
      region: inferExamRegion(id, name),
      maneuver_type: inferExamType(id, name),
      name,
      aliases: aliasesFor(id, name)
    });
  });
  asArray(caseJson.exam_facts).forEach((fact) => {
    const id = normalizedId(fact?.maneuver_id || fact?.id);
    if (!id) return;
    const name = String(fact?.label || fact?.name || humanizeId(id));
    addExam({
      id,
      region: inferExamRegion(id, name),
      maneuver_type: inferExamType(id, name),
      name,
      aliases: aliasesFor(id, name)
    });
  });

  return Array.from(catalog.values());
}

function asArray(value: any) {
  return Array.isArray(value) ? value : [];
}

function objectEntries(value: any): Array<[string, any]> {
  return value && typeof value === 'object' && !Array.isArray(value) ? Object.entries(value) : [];
}

function actionId(action: any) {
  return typeof action === 'string' ? action : action?.id || action?.order_id || action?.maneuver_id || action?.label || action?.name || '';
}

function actionLabel(action: any) {
  return typeof action === 'string' ? '' : String(action?.label || action?.name || '').trim();
}

function normalizedId(value: any) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function humanizeId(id: string) {
  return id
    .split('_')
    .filter(Boolean)
    .map((part) => {
      if (['iv', 'ecg', 'ekg', 'ct', 'cbc', 'bmp', 'cmp', 'lft', 'mri', 'cva'].includes(part)) return part.toUpperCase();
      if (part === 'xray') return 'X-ray';
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(' ');
}

function aliasesFor(id: string, name: string) {
  return unique([id.replace(/_/g, ' '), name]);
}

function explicitDelay(value: any) {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return null;
}

function inferImmediateOrderType(id: string, name: string) {
  const text = normalizeText(`${id} ${name}`);
  if (text.includes('analgesia') || text.includes('fluid') || text.includes('bolus') || text.includes('medication')) return 'medication';
  if (text.includes('monitor') || text.includes('iv access') || text.includes('pulse ox')) return 'procedure';
  return 'intervention';
}

function inferOrderType(id: string, name: string, bundle: any) {
  const text = normalizeText(`${id} ${name} ${bundle?.source || ''}`);
  if (text.includes('ecg') || text.includes('ekg') || text.includes('electrocardiogram')) return 'study';
  if (text.includes('ct') || text.includes('x ray') || text.includes('xray') || text.includes('radiograph') || text.includes('ultrasound') || text.includes('mri') || text.includes('imaging') || text.includes('radiology')) return 'imaging';
  if (text.includes('oxygen')) return 'intervention';
  if (text.includes('analgesia') || text.includes('fluid') || text.includes('bolus') || text.includes('antibiotic') || text.includes('antiemetic') || text.includes('medication')) return 'medication';
  if (text.includes('monitor') || text.includes('iv access') || text.includes('procedure')) return 'procedure';
  if (Array.isArray(bundle?.values) && bundle.values.length) return 'lab';
  if (/(cbc|bmp|cmp|panel|glucose|lactate|lipase|troponin|dimer|culture|blood gas|urinalysis|magnesium|coagulation)/.test(text)) return 'lab';
  return 'lab';
}

function defaultDelayFor(type: string, id: string, name: string) {
  const text = normalizeText(`${id} ${name}`);
  if (IMMEDIATE_ORDER_TYPES.has(type)) return 0;
  if (type === 'study') return 5;
  if (type === 'imaging') return text.includes('ct') || text.includes('mri') ? 45 : 25;
  if (type === 'lab') return 30;
  return 15;
}

function inferExamRegion(id: string, name: string) {
  const text = normalizeText(`${id} ${name}`);
  if (text.includes('abdomen') || text.includes('abdominal') || text.includes('cva') || text.includes('murphy')) return 'abdomen';
  if (text.includes('respiratory') || text.includes('lung') || text.includes('breath')) return 'respiratory';
  if (text.includes('cardiovascular') || text.includes('cardiac') || text.includes('heart') || text.includes('pulse')) return 'cardiovascular';
  if (text.includes('neuro') || text.includes('mental')) return 'neurologic';
  if (text.includes('skin')) return 'skin';
  if (text.includes('extremity') || text.includes('leg') || text.includes('arm')) return 'extremities';
  if (text.includes('pelvic')) return 'pelvic';
  return 'general';
}

function inferExamType(id: string, name: string) {
  const text = normalizeText(`${id} ${name}`);
  if (text.includes('auscultation') || text.includes('sounds') || text.includes('listen')) return 'auscultation';
  if (text.includes('palpation') || text.includes('guarding') || text.includes('rebound') || text.includes('tender')) return 'palpation';
  if (text.includes('percussion') || text.includes('tympany')) return 'percussion';
  if (text.includes('special') || text.includes('murphy') || text.includes('mental')) return 'special tests';
  return 'inspection';
}

async function patchCaseMedia(
  caseJson: PreparedCase,
  helpers: { objectUrls: string[]; findBlob: (wantedPath: string, wantedName: string) => Promise<Blob | null> }
) {
  const visual = caseJson?.visible_start?.visual;
  const src = typeof visual?.src === 'string' ? visual.src : '';
  if (!src || src.startsWith('data:') || src.startsWith('blob:') || /^https?:\/\//i.test(src)) return;
  const wantedPath = normalizePath(src).replace(/^\/+/, '');
  const wantedName = basename(wantedPath);
  const blob = await helpers.findBlob(wantedPath, wantedName);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  helpers.objectUrls.push(url);
  visual.src = url;
}

async function patchEcgSvgArtifacts(
  caseJson: PreparedCase,
  helpers: { objectUrls: string[]; findBlob: (orderId: string) => Promise<Blob | null> }
) {
  const resultBundles = caseJson?.result_bundles || {};
  for (const [orderId, result] of Object.entries(resultBundles)) {
    if (!isEcgOrder(orderId, (result as any)?.display_name)) continue;
    const blob = await helpers.findBlob(orderId);
    if (!blob) continue;
    const svgBlob = blob.type === 'image/svg+xml' ? blob : new Blob([blob], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(svgBlob);
    helpers.objectUrls.push(url);
    const sourceReference = ((result as any).source_reference ||= {});
    sourceReference.static_ecg_svg_url = url;
  }
}

function normalizePath(value: string) {
  return value.replace(/\\/g, '/').replace(/^\.\/+/, '');
}

function basename(value: string) {
  return normalizePath(value).split('/').pop() || value;
}

export class StaticCaseRuntime {
  private case: PreparedCase;
  private orders: CatalogOrder[];
  private exams: ExamManeuver[];
  private state: StaticState;
  readonly bundleName: string;

  constructor(bundle: StaticBundle) {
    this.case = bundle.case;
    this.orders = bundle.orders;
    this.exams = bundle.exams;
    this.bundleName = bundle.bundleName;
    this.state = this.newState();
  }

  start() {
    this.state = this.newState();
    return this.session();
  }

  searchOrders(query: string) {
    return searchCatalog(this.orders, query, 100);
  }

  searchExams(query: string) {
    return searchExamCatalog(this.exams, query, query.trim() ? 12 : 100);
  }

  examCatalog() {
    return this.exams;
  }

  action(payload: Record<string, any>) {
    if (this.state.ended) throw new Error('Encounter has ended; no further in-encounter actions are accepted.');
    const type = String(payload.type || '');
    const dt = Math.max(0, Number(payload.dt_minutes ?? 1) || 0);
    this.advanceState(dt);

    if (type === 'advance_time') return this.session();
    if (type === 'order') return this.applyOrder(String(payload.order_id || ''));
    if (type === 'exam') return this.performExam(String(payload.exam_maneuver_id || ''));
    if (type === 'intervention') return this.applyIntervention(String(payload.intervention_id || ''));
    if (type === 'add_note') return this.addNote(String(payload.text || ''));
    if (type === 'free_text') return this.freeText(String(payload.text || ''), payload.ai_response || null);
    if (type === 'commit_esi') return this.commitEsi(payload.payload || {});
    if (type === 'commit_differential') return this.commitDifferential(payload.payload || {});
    if (type === 'commit_soap') return this.commitSoap(payload.payload || {});
    if (type === 'record_result_interpretation') return this.recordResultInterpretation(String(payload.order_id || ''), String(payload.text || ''));
    if (type === 'complete') return this.complete();
    throw new Error('unsupported action');
  }

  teachingGuide(): TeachingGuide {
    const answerKey = this.answerKey();
    const steps = tutorialSteps(this.case, this.state, answerKey, this.orders, this.exams);
    const required = steps.filter((step) => step.required);
    const completed = required.filter((step) => step.status === 'done').length;
    const nextStep = required.find((step) => step.status !== 'done');
    return {
      case_id: this.case.case_id,
      title: this.case.title,
      mode_label: 'Static reviewer tutorial',
      progress: { completed, total: required.length },
      next_step_id: nextStep?.id || null,
      answer_key: answerKey,
      tutorial_steps: steps
    };
  }

  browserAiContext(text: string) {
    const routed = deterministicResponse(this.case, this.state, text);
    return {
      learner_text: text,
      target_speaker: routed.metadata?.route?.persona || routed.speaker || 'patient',
      case_title: this.case.title,
      visible_start: this.case.visible_start || {},
      elapsed_minutes: this.state.elapsed_minutes,
      phase: this.state.phase,
      current_vitals: cloneVitals(this.state.current_vitals),
      appearance: this.appearance(),
      running_summary: this.state.running_summary,
      active_orders: Object.values(this.state.active_orders).map((order: any) => ({
        order_id: order.order_id,
        display_name: order.display_name,
        status: order.status,
        ordered_at_min: order.ordered_at_min,
        result_due_at_min: order.result_due_at_min
      })),
      resulted_orders: Object.values(this.state.active_orders)
        .filter((order: any) => order.status === 'resulted' && order.result)
        .map((order: any) => order.result),
      performed_exams: this.state.performed_exams,
      interventions: this.state.intervention_events,
      hpi_facts: [...(this.case.hpi_facts || []), ...(this.case.source_enrichment?.safe_hpi_facts || [])],
      home_medications: this.case.source_enrichment?.home_medications || [],
      source_context: {
        ed_medications: this.case.source_enrichment?.ed_medications || [],
        source_vitals: this.case.source_enrichment?.source_vitals || []
      },
      transcript_tail: this.state.transcript.slice(-8)
    };
  }

  completePackage() {
    if (!this.state.ended) throw new Error('CasePackage can only be assembled after end_encounter.');
    const orderedIds = new Set(Object.keys(this.state.active_orders));
    const unorderedResults: Record<string, any> = {};
    Object.entries(this.case.result_bundles || {}).forEach(([orderId, bundle]) => {
      if (!orderedIds.has(orderId)) unorderedResults[orderId] = bundle;
    });
    return {
      session_id: this.state.session_id,
      case_id: this.state.case_id,
      transcript: this.state.transcript,
      orders: Object.values(this.state.active_orders),
      result_interpretations: this.state.result_interpretations,
      exams: this.state.performed_exams,
      interventions: this.state.intervention_events,
      unordered_results: unorderedResults,
      esi_history: this.state.esi_history,
      differential: this.state.differential,
      soap: this.state.soap,
      completeness_flags: this.state.completeness_flags,
      hidden_truth: this.case.hidden_truth,
      real_timeline: this.case.real_timeline || [],
      source_enrichment: debriefSourceEnrichment(this.case),
      rubric: this.case.rubric || {},
      evidence_corpus: this.case.evidence_corpus || [],
      token_usage: this.state.token_usage
    };
  }

  feedback(): GraderFeedback {
    const rubric = this.case.rubric || {};
    const truth = this.case.hidden_truth || {};
    const diagnosisText = normalizeText([...this.state.differential, this.state.soap.assessment].join(' '));
    const expectedDiagnoses = unique([...(rubric.expected_diagnoses || []), truth.final_diagnosis].filter(Boolean));
    const matchedDiagnoses = expectedDiagnoses.filter((diagnosis) => {
      const normalized = normalizeText(diagnosis);
      return normalized && (diagnosisText.includes(normalized) || normalized.includes(diagnosisText));
    });
    const lastEsi = this.state.esi_history.at(-1)?.level ?? null;
    const validatedEsi = Number(truth.validated_esi || 0);
    const esiTolerance = Number(rubric.esi_tolerance ?? 0);
    const expectedOrders = rubric.expected_orders || [];
    const expectedExams = rubric.indicated_exams || [];
    const expectedInterventions = rubric.indicated_interventions || [];
    const excessiveInterventions = rubric.excessive_interventions || [];
    const ordered = new Set(Object.keys(this.state.active_orders));
    const performedExams = new Set(this.state.performed_exams.map((item) => item.maneuver_id));
    const interventions = new Set(this.state.intervention_events.map((item) => item.intervention_id));

    return {
      diagnostic_accuracy: {
        expected: expectedDiagnoses,
        matched: matchedDiagnoses.length > 0,
        matched_terms: matchedDiagnoses
      },
      acuity: {
        validated_esi: validatedEsi || null,
        last_committed_esi: lastEsi,
        defensible: Boolean(lastEsi && validatedEsi && Math.abs(lastEsi - validatedEsi) <= esiTolerance),
        revision_count: Math.max(0, this.state.esi_history.length - 1)
      },
      completeness: {
        flags: this.state.completeness_flags,
        omissions: this.state.completeness_flags.omissions || [],
        exams: {
          expected: expectedExams.map((item: any) => item.id),
          performed: Array.from(performedExams),
          missed: expectedExams.filter((item: any) => !performedExams.has(item.id)).map((item: any) => item.id)
        },
        interventions: {
          expected: expectedInterventions.map((item: any) => item.id),
          performed: Array.from(interventions),
          missed: expectedInterventions.filter((item: any) => !interventions.has(item.id)).map((item: any) => item.id)
        }
      },
      workup_judgment: {
        expected_orders: expectedOrders,
        ordered: Array.from(ordered),
        missed: expectedOrders.filter((orderId: string) => !ordered.has(orderId)),
        items: expectedOrders.map((orderId: string) => ({
          order_id: orderId,
          ordered: ordered.has(orderId),
          resulted: this.state.active_orders[orderId]?.status === 'resulted',
          result_summary: this.state.active_orders[orderId]?.result?.narrative || ''
        }))
      },
      action_feedback: {
        omissions_that_mattered: [
          ...expectedExams.filter((item: any) => !performedExams.has(item.id)).map((item: any) => actionItem(item, 'Expected exam was not performed.')),
          ...expectedOrders.filter((orderId: string) => !ordered.has(orderId)).map((orderId: string) => actionItem({ id: orderId, label: labelForOrder(this.orders, orderId) }, 'Expected source-backed workup was not ordered.'))
        ],
        timing_sequence: [
          ...timingItems(expectedExams, this.state.performed_exams, 'maneuver_id'),
          ...timingItems(expectedInterventions, this.state.intervention_events, 'intervention_id')
        ],
        interventions: {
          appropriate: expectedInterventions.filter((item: any) => interventions.has(item.id)).map((item: any) => actionItem(item, 'Appropriate intervention completed.')),
          missed: expectedInterventions.filter((item: any) => !interventions.has(item.id)).map((item: any) => actionItem(item, 'Expected intervention was not completed.')),
          excessive: excessiveInterventions.filter((item: any) => interventions.has(item.id)).map((item: any) => actionItem(item, 'This intervention was listed as excessive for this case.'))
        },
        positive_reinforcement: [
          ...expectedExams.filter((item: any) => performedExams.has(item.id)).slice(0, 3).map((item: any) => actionItem(item, 'Good targeted exam behavior.')),
          ...expectedOrders.filter((orderId: string) => ordered.has(orderId)).slice(0, 3).map((orderId: string) => actionItem({ id: orderId, label: labelForOrder(this.orders, orderId) }, 'Good source-backed workup choice.'))
        ]
      },
      teaching_points: (truth.clinician_key_points || []).slice(0, 5).map((claim: string) => ({
        claim,
        grounded: true,
        evidence_id: 'case-answer-key'
      }))
    };
  }

  private newState(): StaticState {
    const vitals = cloneVitals(this.case.trajectory?.starting_vitals || this.case.visible_start?.presenting_vitals);
    return {
      session_id: `static-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      case_id: this.case.case_id,
      current_vitals: cloneVitals(vitals),
      previous_vitals: cloneVitals(vitals),
      elapsed_minutes: 0,
      phase: 'triage',
      active_orders: {},
      interventions: [],
      performed_exams: [],
      intervention_events: [],
      esi_history: [],
      differential: [],
      soap: { subjective: '', objective: '', assessment: '', plan: '' },
      completeness_flags: {
        abcde_addressed: false,
        esi_committed: false,
        assessment_committed: false,
        plan_committed: false,
        end_encounter: false,
        omissions: []
      },
      running_summary: this.case.visible_start?.triage_context || '',
      transcript: [],
      result_interpretations: {},
      ended: false,
      token_usage: []
    };
  }

  private session(extra: Record<string, any> = {}): ApiSession {
    return {
      session_id: this.state.session_id,
      case_status: {
        trajectory_signed_off: Boolean(this.case.review_status?.trajectory_clinician_signed_off),
        grader_feedback_validated: true,
        playthrough_signed_off: Boolean(this.case.review_status?.playthrough_clinician_signed_off),
        feedback_locked: false,
        feedback_lock_reason: ''
      },
      snapshot: {
        case_id: this.case.case_id,
        title: this.case.title,
        elapsed_minutes: this.state.elapsed_minutes,
        phase: this.state.phase,
        current_vitals: cloneVitals(this.state.current_vitals),
        visible_start: this.case.visible_start,
        appearance: this.appearance(),
        active_orders: Object.values(this.state.active_orders),
        resulted_orders: Object.values(this.state.active_orders).filter((record: any) => record.status === 'resulted' && record.result).map((record: any) => record.result),
        interventions: [...this.state.interventions],
        performed_exams: [...this.state.performed_exams],
        intervention_events: [...this.state.intervention_events],
        running_summary: this.state.running_summary
      },
      state: {
        esi_history: this.state.esi_history,
        differential: this.state.differential,
        soap: this.state.soap,
        completeness_flags: this.state.completeness_flags,
        can_complete: this.canComplete(),
        ended: this.state.ended,
        transcript: this.state.transcript,
        result_interpretations: this.state.result_interpretations,
        performed_exams: this.state.performed_exams,
        intervention_events: this.state.intervention_events,
        token_usage: this.state.token_usage
      },
      ...extra
    };
  }

  private advanceState(dt: number) {
    if (dt <= 0) {
      this.releaseDueOrders();
      this.refreshFlags();
      this.refreshPhase();
      return;
    }
    this.state.previous_vitals = cloneVitals(this.state.current_vitals);
    this.state.elapsed_minutes = roundMinutes(this.state.elapsed_minutes + dt);
    this.applyTrajectory(dt);
    this.releaseDueOrders();
    this.refreshFlags();
    this.refreshPhase();
  }

  private applyOrder(orderId: string) {
    const order = findOrder(this.orders, orderId);
    if (!order) throw new Error(`unknown order: ${orderId}`);
    if (!this.state.active_orders[order.id]) {
      const immediate = IMMEDIATE_ORDER_TYPES.has(order.type);
      this.state.active_orders[order.id] = {
        order_id: order.id,
        display_name: order.name,
        order_type: order.type,
        status: immediate ? 'resulted' : 'ordered',
        ordered_at_min: this.state.elapsed_minutes,
        result_due_at_min: immediate ? this.state.elapsed_minutes : this.state.elapsed_minutes + order.result_delay_min,
        result: immediate ? structuredActionResult(order, this.state.elapsed_minutes) : null
      };
      if (immediate) this.recordIntervention(order, false);
      this.append('student', `Ordered ${order.name}.`, { type: 'order', order_id: order.id });
    }
    this.releaseDueOrders();
    this.refreshFlags();
    this.refreshPhase();
    return this.session({ order: this.state.active_orders[order.id] });
  }

  private performExam(maneuverId: string) {
    const maneuver = findExam(this.exams, maneuverId);
    if (!maneuver) throw new Error(`unknown exam maneuver: ${maneuverId}`);
    const [finding, source] = this.examFinding(maneuver);
    const record = {
      maneuver_id: maneuver.id,
      display_name: maneuver.name,
      region: maneuver.region,
      maneuver_type: maneuver.maneuver_type,
      finding,
      source,
      performed_at_min: this.state.elapsed_minutes
    };
    this.state.performed_exams.push(record);
    this.append('exam', `${maneuver.name}: ${finding}`, {
      type: 'exam_result',
      exam_maneuver_id: maneuver.id,
      region: maneuver.region,
      maneuver_type: maneuver.maneuver_type,
      source
    });
    this.refreshFlags();
    return this.session({ exam: record });
  }

  private applyIntervention(interventionId: string) {
    const canonical = interventionId.trim().toLowerCase().replace(/\s+/g, '_');
    const order = findOrder(this.orders, canonical);
    if (!order) throw new Error(`unknown structured intervention: ${canonical}`);
    if (!IMMEDIATE_ORDER_TYPES.has(order.type)) throw new Error(`${canonical} is not a structured intervention, medication, or procedure.`);
    if (!this.state.active_orders[order.id]) {
      this.state.active_orders[order.id] = {
        order_id: order.id,
        display_name: order.name,
        order_type: order.type,
        status: 'resulted',
        ordered_at_min: this.state.elapsed_minutes,
        result_due_at_min: this.state.elapsed_minutes,
        result: structuredActionResult(order, this.state.elapsed_minutes)
      };
    }
    const record = this.recordIntervention(order, true);
    return this.session({ intervention: record, order: this.state.active_orders[order.id] });
  }

  private addNote(text: string) {
    const note = text.trim();
    if (!note) throw new Error('add_note actions require non-empty text');
    this.state.transcript.push({
      speaker: 'student',
      text: note,
      elapsed_minutes: this.state.elapsed_minutes,
      metadata: { type: 'clinical_note' }
    });
    return this.session();
  }

  private freeText(text: string, aiResponse: any = null) {
    const turn = text.trim();
    if (!turn) throw new Error('free_text actions require non-empty text');
    this.append('student', turn, { type: 'free_text' });
    const fallback = deterministicResponse(this.case, this.state, turn);
    const responseText = typeof aiResponse?.text === 'string' ? aiResponse.text.trim() : '';
    const routed = responseText
      ? {
          ...fallback,
          text: responseText,
          metadata: {
            ...fallback.metadata,
            type: 'browser_ai_response',
            provider: aiResponse.provider || 'browser_ai',
            model: aiResponse.model || null,
            fallback_type: fallback.metadata?.type || null
          }
        }
      : fallback;
    this.append(routed.speaker, routed.text, routed.metadata);
    return this.session({ response: routed.text, route: routed.metadata?.route || {} });
  }

  private commitEsi(payload: Record<string, any>) {
    const level = Number(payload.level);
    if (!Number.isInteger(level) || level < 1 || level > 5) throw new Error('ESI level must be an integer from 1 to 5');
    const commitment = {
      level,
      rationale: String(payload.rationale || '').trim(),
      elapsed_minutes: this.state.elapsed_minutes
    };
    this.state.esi_history.push(commitment);
    this.append('student', `Committed ESI ${level}. ${commitment.rationale}`.trim(), { type: 'esi_commit' });
    this.refreshFlags();
    return this.session({ esi_commitment: commitment });
  }

  private commitDifferential(payload: Record<string, any>) {
    const diagnoses = Array.isArray(payload.diagnoses) ? payload.diagnoses.map((item) => String(item).trim()).filter(Boolean) : [];
    if (!diagnoses.length) throw new Error('At least one differential diagnosis is required');
    this.state.differential = diagnoses;
    this.append('student', `Committed differential: ${diagnoses.join('; ')}`, { type: 'differential_commit' });
    this.refreshPhase();
    return this.session({ differential: diagnoses });
  }

  private commitSoap(payload: Record<string, any>) {
    const soap = {
      subjective: String(payload.subjective || '').trim(),
      objective: String(payload.objective || '').trim(),
      assessment: String(payload.assessment || '').trim(),
      plan: String(payload.plan || '').trim()
    };
    if (!soap.assessment || !soap.plan) throw new Error('SOAP Assessment and Plan are required');
    this.state.soap = soap;
    this.append('student', 'Committed SOAP note.', { type: 'soap_commit', soap });
    this.refreshFlags();
    this.refreshPhase();
    return this.session();
  }

  private recordResultInterpretation(orderId: string, text: string) {
    const record = this.state.active_orders[orderId];
    if (!record) throw new Error(`order has not been placed: ${orderId}`);
    if (record.status !== 'resulted' || !record.result) throw new Error(`result is not available for interpretation: ${orderId}`);
    const interpretationText = text.trim();
    if (!interpretationText) throw new Error('Result interpretation cannot be empty.');
    const interpretation = {
      order_id: record.order_id,
      display_name: record.display_name,
      text: interpretationText,
      elapsed_minutes: this.state.elapsed_minutes
    };
    this.state.result_interpretations[record.order_id] = interpretation;
    this.append('student', `Recorded interpretation for ${record.display_name}: ${interpretationText}`, {
      type: 'result_interpretation',
      order_id: record.order_id
    });
    return this.session({ result_interpretation: interpretation });
  }

  private complete() {
    if (!this.canComplete()) throw new Error('Assessment and Plan are required before completing the case.');
    this.refreshFlags();
    const omissions: string[] = [];
    if (!this.state.completeness_flags.esi_committed) omissions.push('ESI was never committed.');
    if (!this.state.completeness_flags.abcde_addressed) omissions.push('ABCDE stabilization was incomplete before disposition.');
    this.state.completeness_flags.end_encounter = true;
    this.state.completeness_flags.omissions = omissions;
    this.state.ended = true;
    this.state.phase = 'complete';
    this.append('system', 'Encounter completed.', { type: 'complete' });
    return this.session({ package_available: true });
  }

  private canComplete() {
    return Boolean(this.state.soap.assessment.trim() && this.state.soap.plan.trim());
  }

  private releaseDueOrders() {
    Object.values(this.state.active_orders).forEach((record: any) => {
      if (record.status === 'resulted' || record.status === 'unavailable') return;
      if (this.state.elapsed_minutes < record.result_due_at_min) {
        if (this.state.elapsed_minutes > record.ordered_at_min) record.status = 'resulting';
        return;
      }
      const result = this.resolveOrder(record.order_id);
      if (result) {
        record.status = 'resulted';
        record.result = { ...result, resulted_at_min: Math.round(this.state.elapsed_minutes) };
        this.append('results', formatResult(record), { type: 'result', order_id: record.order_id });
      } else {
        record.status = 'unavailable';
        record.unavailable_reason = 'No source-recorded result is available for this order; no value was fabricated.';
        this.append('results', `${record.display_name}: ${record.unavailable_reason}`, { type: 'result_unavailable', order_id: record.order_id });
      }
    });
  }

  private resolveOrder(orderId: string): ResultBundle {
    const bundle = this.case.result_bundles?.[orderId];
    if (bundle) return cloneResult(bundle);
    const order = findOrder(this.orders, orderId);
    if (!order) {
      return {
        order_id: orderId,
        display_name: orderId.replace(/_/g, ' '),
        values: [],
        narrative: 'No source-recorded result is available for this order; no value was fabricated.',
        source: 'simulator-default',
        source_reference: { case_id: this.case.case_id, order_id: orderId, fallback_reason: 'no_encounter_linked_source_result' }
      };
    }
    return defaultResult(order, this.case.case_id);
  }

  private recordIntervention(order: CatalogOrder, appendTranscript: boolean) {
    const alreadyActive = this.state.interventions.includes(order.id);
    const effectSummary = this.applyInterventionEffect(order.id, alreadyActive);
    const record = {
      intervention_id: order.id,
      display_name: order.name,
      applied_at_min: this.state.elapsed_minutes,
      effect_summary: effectSummary,
      vitals_after: cloneVitals(this.state.current_vitals)
    };
    this.state.intervention_events.push(record);
    if (appendTranscript) this.append('nurse', interventionConfirmation(order.id, order.name, alreadyActive), { type: 'intervention', intervention_id: order.id });
    this.refreshFlags();
    this.refreshPhase();
    return record;
  }

  private applyInterventionEffect(orderId: string, alreadyActive: boolean) {
    if (orderId && !alreadyActive) this.state.interventions.push(orderId);
    if (alreadyActive) return `${orderId.replace(/_/g, ' ')} was already active; no additional vital-sign change applied.`;
    if (orderId === 'oxygen' && this.state.current_vitals.spo2 < 94) {
      this.state.current_vitals.spo2 = 94;
      return 'SpO2 increased immediately toward the authored oxygen recovery trajectory.';
    }
    if (orderId === 'analgesia' && this.state.current_vitals.pain !== null) {
      this.state.current_vitals.pain = Math.max(0, this.state.current_vitals.pain - 1);
      return 'Pain score decreased immediately and will continue along the authored analgesia response.';
    }
    if (orderId === 'iv_fluids' && this.state.current_vitals.sbp < 110) {
      this.state.current_vitals.sbp = Math.min(115, this.state.current_vitals.sbp + 5);
      return 'Systolic blood pressure increased immediately toward the authored fluid response.';
    }
    if (orderId === 'cardiac_monitor') return 'Continuous monitoring is active; diagnostic results are not generated by this intervention.';
    if (orderId === 'continuous_pulse_ox') return 'Continuous pulse oximetry is active; oxygenation remains governed by the trajectory.';
    if (orderId === 'iv_access') return 'IV access is established for medications, fluids, and contrast if ordered.';
    return `${orderId.replace(/_/g, ' ')} recorded; deterministic state updated without a source-result reveal.`;
  }

  private applyTrajectory(dt: number) {
    const rules = this.case.trajectory?.rules || [];
    const active = new Set(this.state.interventions);
    rules.forEach((rule: any) => {
      const vital = rule.vital as keyof VitalSigns;
      const current = this.state.current_vitals[vital];
      if (current === null || current === undefined) return;
      const condition = rule.condition || {};
      if (condition.below !== undefined && !(Number(current) < Number(condition.below))) return;
      if (condition.above !== undefined && !(Number(current) > Number(condition.above))) return;
      if (condition.absent_intervention && active.has(condition.absent_intervention)) return;
      if (condition.present_intervention && !active.has(condition.present_intervention)) return;
      let next = Number(current) + Number(rule.delta_per_minute || 0) * dt;
      if (rule.floor !== undefined && rule.floor !== null) next = Math.max(Number(rule.floor), next);
      if (rule.ceiling !== undefined && rule.ceiling !== null) next = Math.min(Number(rule.ceiling), next);
      (this.state.current_vitals as any)[vital] = ['hr', 'sbp', 'dbp', 'rr', 'spo2', 'pain'].includes(String(vital)) ? Math.round(next) : next;
    });
  }

  private examFinding(maneuver: ExamManeuver): [string, string] {
    if (maneuver.id === 'general_inspection_appearance') return [this.appearance(), 'live-state'];
    const fact = (this.case.exam_facts || []).find((item: any) => (item.maneuver_id || item.id) === maneuver.id && !isGenericFinding(item.finding));
    if (fact) return [fact.finding, fact.source || 'source-record'];
    return [defaultExamFinding(this.case, this.state, maneuver), 'simulator-default-exam'];
  }

  private appearance() {
    if (this.state.current_vitals.spo2 < 90) return 'Worsening dyspnea with visible respiratory distress.';
    if (this.state.interventions.includes('oxygen') && this.state.current_vitals.spo2 >= 94) return 'Breathing more comfortably on oxygen.';
    if (this.state.interventions.includes('analgesia') && this.state.current_vitals.pain !== null && this.state.current_vitals.pain <= 4) {
      return 'More comfortable after analgesia, still requiring focused reassessment.';
    }
    return this.case.visible_start?.appearance || '';
  }

  private refreshFlags() {
    this.state.completeness_flags.esi_committed = this.state.esi_history.length > 0;
    this.state.completeness_flags.assessment_committed = Boolean(this.state.soap.assessment.trim());
    this.state.completeness_flags.plan_committed = Boolean(this.state.soap.plan.trim());
    this.state.completeness_flags.abcde_addressed = this.abcdeAddressed();
  }

  private abcdeAddressed() {
    const required = ['oxygen', 'cardiac_monitor', 'iv_access'];
    return required.every((item) => this.state.interventions.includes(item)) || this.state.current_vitals.spo2 >= 94;
  }

  private refreshPhase() {
    if (this.state.ended) this.state.phase = 'complete';
    else if (this.state.soap.assessment.trim() || this.state.soap.plan.trim()) this.state.phase = 'disposition';
    else if (Object.keys(this.state.active_orders).length || this.state.differential.length || this.state.elapsed_minutes >= 5) this.state.phase = 'workup';
    else this.state.phase = 'triage';
  }

  private append(speaker: string, text: string, metadata: Record<string, any> = {}) {
    const cleaned = text.trim();
    this.state.transcript.push({ speaker, text: cleaned, elapsed_minutes: this.state.elapsed_minutes, metadata });
    if (['student', 'patient', 'nurse', 'consultant'].includes(speaker) && cleaned) {
      this.state.running_summary = compactSummary(this.state.running_summary, cleaned);
    }
  }

  private answerKey(): any {
    const truth = this.case.hidden_truth || {};
    return {
      diagnosis: truth.final_diagnosis || '',
      validated_esi: truth.validated_esi || 0,
      disposition: truth.actual_disposition || '',
      case_summary: caseSummary(this.case),
      history: (this.case.hpi_facts || []).map((fact: any) => ({
        id: fact.id,
        topic: fact.topic,
        prompt: historyPrompt(fact.topic),
        expected_response: fact.lay_response,
        status: historyFactCompleted(fact.triggers || [], this.state) ? 'done' : 'pending'
      })),
      interventions: rubricItems(this.case.rubric?.indicated_interventions || [], this.state, this.orders, this.exams, 'intervention'),
      exams: rubricItems(this.case.rubric?.indicated_exams || [], this.state, this.orders, this.exams, 'exam'),
      orders: (this.case.rubric?.expected_orders || []).map((orderId: string) => ({
        id: orderId,
        label: labelForOrder(this.orders, orderId),
        why: '',
        status: this.state.active_orders[orderId] ? 'done' : 'pending',
        required: true
      })),
      avoid: rubricItems(this.case.rubric?.excessive_interventions || [], this.state, this.orders, this.exams, 'intervention', false),
      differential: differentialKey(this.case),
      result_interpretations: resultInterpretations(this.case, this.state),
      soap_template: soapTemplate(this.case),
      key_points: truth.clinician_key_points || []
    };
  }
}

function searchCatalog(items: CatalogOrder[], query: string, limit: number) {
  const needle = normalizeText(query);
  if (!needle) return items.slice(0, limit);
  return scoredSearch(items, needle, (item) => [item.name, item.id.replace(/_/g, ' '), ...(item.aliases || [])], limit);
}

function searchExamCatalog(items: ExamManeuver[], query: string, limit: number) {
  const needle = normalizeText(query);
  if (!needle) return items.slice(0, limit);
  return scoredSearch(items, needle, (item) => [item.name, item.id.replace(/_/g, ' '), item.region, item.maneuver_type, ...(item.aliases || [])], limit);
}

function scoredSearch<T>(items: T[], needle: string, haystacks: (item: T) => string[], limit: number) {
  return items
    .map((item) => {
      const score = haystacks(item).reduce((best, raw) => {
        const text = normalizeText(raw);
        if (text === needle) return Math.max(best, 100);
        if (text.startsWith(needle)) return Math.max(best, 85);
        if (text.includes(needle)) return Math.max(best, 70);
        if (needle.split(' ').every((part) => text.includes(part))) return Math.max(best, 50);
        return best;
      }, 0);
      return { item, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.item);
}

function findOrder(orders: CatalogOrder[], orderId: string) {
  const normalized = orderId.trim().toLowerCase().replace(/\s+/g, '_');
  return orders.find((item) => item.id === normalized) || null;
}

function findExam(exams: ExamManeuver[], maneuverId: string) {
  const normalized = maneuverId.trim().toLowerCase().replace(/\s+/g, '_');
  return exams.find((item) => item.id === normalized) || null;
}

function cloneVitals(vitals: any): VitalSigns {
  return {
    temp_c: vitals?.temp_c ?? null,
    hr: Number(vitals?.hr ?? 0),
    sbp: Number(vitals?.sbp ?? 0),
    dbp: Number(vitals?.dbp ?? 0),
    rr: Number(vitals?.rr ?? 0),
    spo2: Number(vitals?.spo2 ?? 0),
    pain: vitals?.pain === undefined || vitals?.pain === null ? null : Number(vitals.pain)
  };
}

function cloneResult(result: any): ResultBundle {
  return JSON.parse(JSON.stringify(result));
}

function structuredActionResult(order: CatalogOrder, elapsed: number): ResultBundle {
  return {
    order_id: order.id,
    display_name: order.name,
    resulted_at_min: Math.round(elapsed),
    values: [],
    narrative: `${order.name} recorded as a structured ${order.type}; no diagnostic value is expected.`,
    source: 'simulator'
  };
}

function defaultResult(order: CatalogOrder, caseId: string): ResultBundle {
  return {
    order_id: order.id,
    display_name: order.name,
    values: [],
    narrative: 'No encounter-linked source result is available for this order; no value was fabricated. SIMULATOR DEFAULT.',
    source: 'simulator-default',
    source_reference: {
      case_id: caseId,
      order_id: order.id,
      order_type: order.type,
      fallback_reason: 'no_encounter_linked_source_result'
    }
  };
}

function formatResult(record: any) {
  const result = record.result;
  if (!result) return `${record.display_name}: resulted.`;
  if (isEcgOrder(record.order_id, record.display_name)) return `${record.display_name} resulted. ECG tracing is available in the result viewer.`;
  const lines = [`${record.display_name} resulted.`];
  if (Array.isArray(result.values) && result.values.length) {
    lines.push(result.values.map((item: any) => `${item.name}: ${item.value}${item.unit ? ` ${item.unit}` : ''}${item.flag ? ` (${item.flag})` : ''}`).join('; '));
  }
  if (result.narrative) lines.push(result.narrative);
  return lines.join(' ');
}

function interventionConfirmation(orderId: string, displayName: string, alreadyActive: boolean) {
  if (alreadyActive) return `${displayName} already active.`;
  if (orderId === 'oxygen') return 'O2 started, 2 L nasal cannula.';
  if (orderId === 'cardiac_monitor') return 'Cardiac monitor started.';
  if (orderId === 'continuous_pulse_ox') return 'Continuous pulse oximetry started.';
  if (orderId === 'iv_access') return 'IV access established.';
  if (orderId === 'iv_fluids') return 'IV crystalloid bolus started.';
  if (orderId === 'analgesia') return 'Analgesia given.';
  return `${displayName} completed.`;
}

function deterministicResponse(caseJson: PreparedCase, state: StaticState, text: string) {
  const normalized = normalizeText(text);
  if (normalized.includes('nurse') || normalized.includes('reassess') || normalized.includes('status')) {
    return {
      speaker: 'nurse',
      text: nurseResponse(caseJson, state),
      metadata: { type: 'static_nurse_response', route: { handler: 'persona', persona: 'nurse' } }
    };
  }
  if (normalized.includes('consult') || normalized.includes('surgery') || normalized.includes('gastroenterology') || normalized.includes(' gi ')) {
    const specialty = normalized.includes('gastro') || normalized.includes(' gi ') ? 'gastroenterology' : normalized.includes('surgery') ? 'surgery' : 'consultant';
    return {
      speaker: 'consultant',
      text: `${titleCase(specialty)} consult acknowledges the call and recommends source-backed workup review, resuscitation, and disposition planning based on the decisive findings.`,
      metadata: { type: 'static_consult_response', route: { handler: 'persona', persona: 'consultant', specialty } }
    };
  }
  const facts = [...(caseJson.hpi_facts || []), ...(caseJson.source_enrichment?.safe_hpi_facts || [])];
  const matched = facts.filter((fact: any) => (fact.triggers || []).some((trigger: string) => normalized.includes(normalizeText(trigger))));
  const answer = matched.length
    ? matched.slice(0, 3).map((fact: any) => fact.lay_response).join(' ')
    : 'The patient answers in short phrases and confirms the main symptoms described at triage.';
  return {
    speaker: 'patient',
    text: answer,
    metadata: { type: 'static_patient_response', matched_fact_ids: matched.map((fact: any) => fact.id), route: { handler: 'persona', persona: 'patient' } }
  };
}

function nurseResponse(caseJson: PreparedCase, state: StaticState) {
  const vitals = state.current_vitals;
  const pieces = [`Current vitals: HR ${vitals.hr}, BP ${vitals.sbp}/${vitals.dbp}, RR ${vitals.rr}, SpO2 ${vitals.spo2}%`];
  if (vitals.pain !== null) pieces.push(`pain ${vitals.pain}/10`);
  const releasedMeds = (caseJson.source_enrichment?.ed_medications || [])
    .filter((item: any) => typeof item.elapsed_min !== 'number' || item.elapsed_min <= state.elapsed_minutes)
    .slice(0, 3)
    .map((item: any) => item.name)
    .filter(Boolean);
  if (releasedMeds.length) pieces.push(`documented ED meds include ${unique(releasedMeds).join(', ')}`);
  if (state.interventions.length) pieces.push(`active interventions: ${state.interventions.map((item) => item.replace(/_/g, ' ')).join(', ')}`);
  return `${pieces.join('; ')}.`;
}

function defaultExamFinding(caseJson: PreparedCase, state: StaticState, maneuver: ExamManeuver) {
  const text = normalizeText(`${caseJson.visible_start?.chief_complaint || ''} ${caseJson.visible_start?.triage_context || ''} ${caseJson.visible_start?.appearance || ''}`);
  const abdominal = ['abd', 'belly', 'distention', 'distended', 'bowel', 'vomit'].some((term) => text.includes(term));
  if (maneuver.id === 'abdomen_inspection_distention') return abdominal ? 'Abdomen inspected from bedside: visibly distended.' : 'Abdomen inspected from bedside: flat to mildly rounded, without visible distention.';
  if (maneuver.id === 'abdomen_palpation_light') return abdominal ? 'Light palpation performed in all quadrants: diffuse tenderness over the distended abdomen, greatest in the lower abdomen; no involuntary guarding on light touch.' : 'Light palpation performed in all quadrants: abdomen soft and non-tender, without guarding.';
  if (maneuver.id === 'abdomen_palpation_guarding') return 'Guarding assessed with gentle palpation: no involuntary guarding or board-like rigidity appreciated.';
  if (maneuver.id === 'abdomen_palpation_rebound') return 'Rebound tenderness checked gently: no clear rebound pain elicited.';
  if (maneuver.id === 'abdomen_special_murphy') return 'Murphy sign assessed with right upper quadrant palpation during inspiration: negative, without inspiratory arrest.';
  if (maneuver.id === 'respiratory_auscultation_breath_sounds') return 'Auscultated anterior and posterior lung fields: breath sounds present bilaterally, without focal wheeze or crackles.';
  if (maneuver.id === 'cardiovascular_auscultation_heart_sounds') return `Heart auscultated at standard listening posts: ${state.current_vitals.hr >= 100 ? 'tachycardic' : 'regular rate'} with regular rhythm; no obvious murmur, rub, or gallop heard.`;
  return `${maneuver.name} performed: no acute abnormality appreciated on this focused bedside assessment.`;
}

function isGenericFinding(finding: string) {
  const text = normalizeText(finding || '');
  return !text || ['not assessed', 'no abnormality documented', 'source record', 'source recorded', 'does not include', 'not documented', 'no documentation'].some((term) => text.includes(term));
}

function debriefSourceEnrichment(caseJson: PreparedCase) {
  const enrichment = JSON.parse(JSON.stringify(caseJson.source_enrichment || {}));
  ['home_medications', 'ed_medications', 'source_vitals', 'debrief_timeline', 'note_digests', 'historical_references'].forEach((key) => {
    if (Array.isArray(enrichment[key])) {
      enrichment[key] = enrichment[key].filter((item: any) => item?.visibility !== 'authoring_only_hidden');
    }
  });
  enrichment.safe_hpi_facts = [];
  return enrichment;
}

function actionItem(action: any, message: string) {
  return {
    action_id: action.id || null,
    label: action.label || String(action.id || '').replace(/_/g, ' '),
    message: `${message}${action.why ? ` ${action.why}` : ''}`.trim(),
    grounded: true,
    evidence_id: 'case-rubric',
    evidence_note: action.why || 'Source-backed case rubric.',
    elapsed_minutes: null
  };
}

function timingItems(actions: any[], records: any[], idKey: string) {
  return actions
    .map((action) => {
      const record = records.find((item) => item[idKey] === action.id);
      if (!record || typeof action.early_minutes !== 'number') return null;
      const elapsed = Number(record.performed_at_min ?? record.applied_at_min ?? 0);
      if (elapsed <= action.early_minutes) return null;
      return {
        ...actionItem(action, `${action.label || action.id} was completed after the suggested early window.`),
        elapsed_minutes: elapsed
      };
    })
    .filter(Boolean);
}

function rubricItems(actions: any[], state: StaticState, orders: CatalogOrder[], exams: ExamManeuver[], targetType: string, required = true) {
  return actions.map((action) => ({
    id: action.id,
    label: action.label || (targetType === 'exam' ? labelForExam(exams, action.id) : labelForOrder(orders, action.id)),
    why: action.why || '',
    status: targetDone(targetType, action.id, state) ? 'done' : 'pending',
    required
  }));
}

function tutorialSteps(caseJson: PreparedCase, state: StaticState, answerKey: any, orders: CatalogOrder[], exams: ExamManeuver[]) {
  const truth = caseJson.hidden_truth || {};
  const critical = unique(caseJson.rubric?.critical_actions || (caseJson.rubric?.indicated_interventions || []).map((item: any) => item.id));
  const expectedOrders = unique(caseJson.rubric?.expected_orders || []);
  const requiredResults = (answerKey.result_interpretations || []).filter((item: any) => item.required).map((item: any) => item.order_id);
  const steps: any[] = [
    {
      id: 'acuity',
      title: 'Commit the acuity',
      instruction: `Set ESI to ${truth.validated_esi} and document the high-risk rationale.`,
      rationale: 'This patient should be treated as high risk early, not after the complete workup.',
      target_type: 'esi',
      target_ids: [String(truth.validated_esi || '')],
      target_labels: [`ESI ${truth.validated_esi || ''}`],
      status: targetDone('esi', String(truth.validated_esi || ''), state) ? 'done' : 'pending',
      required: true
    },
    {
      id: 'stabilization',
      title: 'Start stabilization',
      instruction: 'Apply the required bedside interventions before waiting for diagnostics.',
      rationale: 'These are the case-critical actions for monitoring, access, symptom control, and escalation.',
      target_type: 'intervention',
      target_ids: critical,
      target_labels: critical.map((id) => labelForOrder(orders, id)),
      status: critical.length && critical.every((id) => targetDone('intervention', id, state)) ? 'done' : 'pending',
      required: true
    },
    {
      id: 'history',
      title: 'Elicit the focused history',
      instruction: 'Ask the patient about the listed HPI topics before closing the case.',
      rationale: 'The tutorial key expects source-authored history gathering.',
      target_type: 'history',
      target_ids: answerKey.history.map((item: any) => item.id),
      target_labels: answerKey.history.map((item: any) => item.topic),
      status: answerKey.history.length && answerKey.history.every((item: any) => item.status === 'done') ? 'done' : 'pending',
      required: true
    },
    {
      id: 'exam',
      title: 'Perform the focused exam',
      instruction: 'Use the Physical Exam panel for the indicated maneuvers.',
      rationale: 'The exam should localize severity before disposition.',
      target_type: 'exam',
      target_ids: answerKey.exams.map((item: any) => item.id),
      target_labels: answerKey.exams.map((item: any) => item.label || labelForExam(exams, item.id)),
      status: answerKey.exams.length && answerKey.exams.every((item: any) => item.status === 'done') ? 'done' : 'pending',
      required: true
    },
    {
      id: 'orders',
      title: 'Order the diagnostic workup',
      instruction: 'Place the required labs and definitive imaging from the Orders panel.',
      rationale: 'The perfect response uses the source-backed workup.',
      target_type: 'order',
      target_ids: expectedOrders,
      target_labels: expectedOrders.map((id) => labelForOrder(orders, id)),
      status: expectedOrders.length && expectedOrders.every((id) => targetDone('order', id, state)) ? 'done' : 'pending',
      required: true
    },
    {
      id: 'result_review',
      title: 'Review and interpret results',
      instruction: 'Advance time until ordered studies result, then state the key interpretation.',
      rationale: 'The decisive source result should drive disposition.',
      target_type: 'result_review',
      target_ids: requiredResults,
      target_labels: requiredResults.map((id) => labelForOrder(orders, id)),
      status: requiredResults.length && requiredResults.every((id: string) => resultReviewDone(id, state)) ? 'done' : 'pending',
      required: true
    },
    {
      id: 'diagnosis',
      title: 'Commit the differential',
      instruction: `Commit a differential that includes ${truth.final_diagnosis || 'the final diagnosis'}.`,
      rationale: 'The final assessment should not remain generic.',
      target_type: 'differential',
      target_ids: caseJson.rubric?.expected_diagnoses || [truth.final_diagnosis || ''],
      target_labels: caseJson.rubric?.expected_diagnoses || [truth.final_diagnosis || ''],
      status: targetDone('differential', truth.final_diagnosis || '', state) ? 'done' : 'pending',
      required: true
    },
    {
      id: 'disposition',
      title: 'Commit SOAP and disposition',
      instruction: `Write the assessment and plan for ${truth.actual_disposition || 'the actual disposition'}.`,
      rationale: 'The case can only be completed after assessment and plan are structurally committed.',
      target_type: 'soap',
      target_ids: ['assessment', 'plan'],
      target_labels: ['Assessment', 'Plan'],
      status: targetDone('soap', '', state) ? 'done' : 'pending',
      required: true
    },
    {
      id: 'complete',
      title: 'Complete the case',
      instruction: 'End the case only after acuity, stabilization, differential, and disposition plan are committed.',
      target_type: 'complete',
      target_ids: ['complete'],
      target_labels: ['Complete case'],
      status: targetDone('complete', '', state) ? 'done' : 'pending',
      required: true
    }
  ];
  if (caseJson.result_bundles?.ecg_12_lead) {
    steps.splice(6, 0, {
      id: 'ecg_read',
      title: 'Read the ECG yourself',
      instruction: 'Order the 12-lead ECG, open the tracing, and save your own interpretation.',
      rationale: 'This preserves the learner task before comparing against the dataset read.',
      target_type: 'ecg_interpretation',
      target_ids: ['ecg_12_lead'],
      target_labels: ['12-lead ECG interpretation'],
      status: targetDone('ecg_interpretation', 'ecg_12_lead', state) ? 'done' : 'pending',
      required: false
    });
  }
  return steps;
}

function targetDone(targetType: string, targetId: string, state: StaticState) {
  if (targetType === 'intervention') return state.interventions.includes(targetId);
  if (targetType === 'exam') return state.performed_exams.some((item) => item.maneuver_id === targetId);
  if (targetType === 'order') return Boolean(state.active_orders[targetId]);
  if (targetType === 'result_review') return resultReviewDone(targetId, state);
  if (targetType === 'esi') return state.esi_history.some((item) => String(item.level) === String(targetId));
  if (targetType === 'differential') {
    const expected = normalizeText(targetId);
    return state.differential.some((item) => normalizeText(item).includes(expected) || expected.includes(normalizeText(item)));
  }
  if (targetType === 'ecg_interpretation') return Boolean(state.result_interpretations[targetId]);
  if (targetType === 'soap') return Boolean(state.soap.assessment.trim() && state.soap.plan.trim());
  if (targetType === 'complete') return state.ended;
  return false;
}

function resultReviewDone(orderId: string, state: StaticState) {
  const record = state.active_orders[orderId];
  if (!record || record.status !== 'resulted') return false;
  if (orderId === 'ecg_12_lead') return Boolean(state.result_interpretations[orderId]);
  return true;
}

function historyFactCompleted(triggers: string[], state: StaticState) {
  const terms = triggers.map(normalizeText).filter(Boolean);
  return state.transcript.some((message) => message.speaker === 'student' && terms.some((term) => normalizeText(message.text).includes(term)));
}

function resultInterpretations(caseJson: PreparedCase, state: StaticState) {
  const orderIds = unique([...(caseJson.rubric?.expected_orders || []), 'ecg_12_lead']);
  return orderIds
    .map((orderId) => {
      const bundle = caseJson.result_bundles?.[orderId];
      if (!bundle) return null;
      const expectedRead = bundle.narrative || abnormalValueSummary(bundle) || `${bundle.display_name}: review the source-recorded result.`;
      return {
        order_id: orderId,
        label: bundle.display_name,
        expected_read: expectedRead,
        source: bundle.source || '',
        status: resultReviewDone(orderId, state) ? 'done' : 'pending',
        required: (caseJson.rubric?.expected_orders || []).includes(orderId)
      };
    })
    .filter(Boolean);
}

function abnormalValueSummary(bundle: any) {
  const abnormal = (bundle.values || []).filter((value: any) => value.flag && value.flag !== 'normal');
  return abnormal.length ? `${bundle.display_name}: ${abnormal.map((value: any) => `${value.name} ${value.value}${value.unit ? ` ${value.unit}` : ''}`).join('; ')}.` : '';
}

function caseSummary(caseJson: PreparedCase) {
  const vitals = caseJson.visible_start?.presenting_vitals || {};
  return [
    `${caseJson.visible_start?.demographics?.age || ''}${caseJson.visible_start?.demographics?.sex || ''}`.trim(),
    caseJson.visible_start?.chief_complaint,
    vitals.hr ? `HR ${vitals.hr}` : '',
    vitals.sbp ? `BP ${vitals.sbp}/${vitals.dbp}` : '',
    vitals.rr ? `RR ${vitals.rr}` : '',
    vitals.spo2 ? `SpO2 ${vitals.spo2}%` : '',
    vitals.pain !== undefined && vitals.pain !== null ? `pain ${vitals.pain}/10` : ''
  ].filter(Boolean).join('; ');
}

function historyPrompt(topic: string) {
  const text = normalizeText(topic);
  if (text.includes('pain')) return 'Ask the patient to rate and characterize the pain.';
  if (text.includes('allerg')) return 'Ask about allergies before medications or contrast-related planning.';
  if (text.includes('history') || text.includes('medication')) return 'Ask about medical history, medications, anticoagulation, and prior abdominal surgery.';
  return `Ask about ${topic}.`;
}

function differentialKey(caseJson: PreparedCase) {
  const diagnosis = caseJson.hidden_truth?.final_diagnosis || '';
  const text = normalizeText(`${caseJson.title} ${caseJson.visible_start?.chief_complaint} ${diagnosis}`);
  if (text.includes('volvulus') || text.includes('abdominal')) {
    return [diagnosis, 'large bowel obstruction', 'bowel ischemia or perforation if peritoneal signs emerge', 'small bowel obstruction or ileus'].filter(Boolean);
  }
  return [diagnosis, 'high-risk cardiopulmonary process'].filter(Boolean);
}

function soapTemplate(caseJson: PreparedCase) {
  const diagnosis = caseJson.hidden_truth?.final_diagnosis || 'the final diagnosis';
  const disposition = caseJson.hidden_truth?.actual_disposition || 'appropriate disposition';
  const text = normalizeText(`${caseJson.title} ${caseJson.visible_start?.chief_complaint} ${diagnosis}`);
  if (text.includes('volvulus') || text.includes('abdominal')) {
    return {
      subjective: 'Severe abdominal pain with distention; include allergies and anticoagulation when elicited.',
      objective: 'High acuity; abnormal pain/vitals; distended/tender abdomen; source-backed diagnostic results reviewed.',
      assessment: `${diagnosis}, high-risk acute abdomen.`,
      plan: `NPO, monitor, IV access, analgesia, serial exams, urgent specialty consultation, and ${disposition}.`
    };
  }
  return {
    subjective: `${caseJson.visible_start?.chief_complaint || 'Chief complaint'}; include onset, risk factors, and associated symptoms.`,
    objective: 'Summarize abnormal vitals, key exam findings, and source-backed diagnostic results.',
    assessment: `${diagnosis} with high-risk acuity.`,
    plan: `Continue indicated stabilization, complete source-backed workup, consult as needed, and disposition: ${disposition}.`
  };
}

function labelForOrder(orders: CatalogOrder[], orderId: string) {
  return findOrder(orders, orderId)?.name || orderId.replace(/_/g, ' ');
}

function labelForExam(exams: ExamManeuver[], maneuverId: string) {
  return findExam(exams, maneuverId)?.name || maneuverId.replace(/_/g, ' ');
}

function compactSummary(current: string, addition: string, maxChars = 700) {
  const merged = [current, addition].filter(Boolean).join(' ');
  return merged.length > maxChars ? merged.slice(merged.length - maxChars) : merged;
}

function normalizeText(value: string) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function roundMinutes(value: number) {
  return Math.round(value * 1000) / 1000;
}

function isEcgOrder(orderId: string, displayName: string) {
  return /ecg|ekg|12-lead|12 lead/i.test(`${orderId} ${displayName}`);
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
