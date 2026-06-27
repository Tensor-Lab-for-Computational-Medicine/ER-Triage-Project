import React from 'react';
import {
  ArrowClockwise,
  ArrowCircleUp,
  ArrowsOut,
  Buildings,
  CaretRight,
  CaretUp,
  ChartDonut,
  ChatCircleText,
  CheckCircle,
  ClipboardText,
  Clock,
  DotsThreeVertical,
  DownloadSimple,
  Flag,
  FirstAidKit,
  Flask,
  GearSix,
  ListBullets,
  MagnifyingGlass,
  NotePencil,
  Pause,
  Play,
  Plus,
  Pulse,
  SignOut,
  Stethoscope,
  UploadSimple,
  User,
  UserCircle,
  Warning,
  WarningCircle,
  X
} from '@phosphor-icons/react';
import { AIModelOption, AIProviderDraft, CaseStatus, EncounterProvider, ExamManeuver, ExamRecord, GuideActionItem, GuideHistoryItem, GuideResultInterpretation, OrderRecord, ResultBundle, Snapshot, TeachingGuide, TokenUsageRecord, TranscriptMessage, TutorialStep, VitalSigns, defaultAIBaseUrl, defaultCheapModel, defaultStrongModel, modelOptionsForProvider, useEncounter } from '../store/encounterStore';
import { fetchOpenRouterModelOptions } from '../store/browserAiClient';
import '../styles/encounter-tailwind.css';

function ClinicalReasoningSimulator() {
  return (
    <EncounterProvider>
      <SimulatorScreen />
    </EncounterProvider>
  );
}

function SimulatorScreen() {
  const encounter = useEncounter();
  const { session, loading, error, packageRecord, debriefBlockedReason } = encounter;
  const [guideOpen, setGuideOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f4f7f8] text-[#17232b]">
        <div className="grid min-h-screen place-items-center">
          <div className="rounded-lg border border-[#d7dfdf] bg-white px-5 py-4 text-sm font-semibold">Starting encounter...</div>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-[#f4f7f8] p-4 text-[#17232b]">
        <div className="mx-auto grid max-w-2xl gap-4 rounded-lg border border-[#d7dfdf] bg-white p-5">
          <div className="grid gap-1">
            <strong>Load a case bundle</strong>
            <p className="m-0 text-sm leading-6 text-[#607078]">{error || 'Choose a case bundle zip to start. Everything runs locally in this browser.'}</p>
          </div>
          <CaseBundlePanel />
        </div>
      </main>
    );
  }

  if (packageRecord) {
    return <DebriefScreen />;
  }

  if (session.state.ended && debriefBlockedReason) {
    return <DebriefLockedScreen />;
  }

  return (
    <main className="ed-sim-font min-h-screen bg-[#f4f7f8] text-[#17232b]">
      <Header
        snapshot={session.snapshot}
        caseStatus={session.case_status}
        guideOpen={guideOpen}
        onToggleGuide={() => setGuideOpen((current) => !current)}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      {error ? (
        <div className="border-b border-[#e6dddd] bg-[#fff7f7] px-4 py-2 text-sm font-semibold text-[#7f1d1d]">{error}</div>
      ) : null}
      <div className="grid min-h-[calc(100vh-66px)] grid-cols-1 items-start gap-3 overflow-x-clip p-3 lg:grid-cols-[minmax(260px,300px)_minmax(0,1fr)] min-[1500px]:h-[calc(100vh-66px)] min-[1500px]:min-h-0 min-[1500px]:grid-cols-[minmax(270px,300px)_minmax(0,1fr)_minmax(300px,340px)] min-[1500px]:items-stretch min-[1500px]:overflow-hidden">
        <VitalsRail />
        <section className="grid min-h-[720px] min-w-0 grid-rows-[minmax(260px,0.66fr)_minmax(360px,1fr)] gap-3 overflow-visible lg:min-h-[760px] min-[1500px]:h-full min-[1500px]:min-h-0 min-[1500px]:overflow-hidden">
          <ConversationPanel />
          <StructuredActionsPanel />
        </section>
        <CommitRail />
      </div>
      {guideOpen ? <TeachingGuideDrawer onClose={() => setGuideOpen(false)} /> : null}
      {settingsOpen ? <SettingsDrawer onClose={() => setSettingsOpen(false)} /> : null}
    </main>
  );
}

function DebriefLockedScreen() {
  const { session, debriefBlockedReason, start } = useEncounter();

  return (
    <main className="ed-sim-font min-h-screen bg-[#f4f7f8] p-4 text-[#17232b]">
      <div className="mx-auto grid max-w-3xl gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#d7dfdf] bg-white p-4">
          <div>
            <h1 className="m-0 text-xl font-extrabold">Debrief Locked</h1>
            <p className="m-0 mt-1 text-sm text-[#607078]">{session?.snapshot.title}</p>
          </div>
          <button type="button" className="inline-flex h-10 items-center gap-2 rounded-md border border-[#cdd8d8] px-3 text-sm font-bold" onClick={() => void start()}>
            <ArrowClockwise size={17} /> New run
          </button>
        </header>
        <section className="rounded-lg border border-[#e8b5b5] bg-[#fff7f7] p-4 text-[#7f1d1d]" data-testid="debrief-validation-locked">
          <div className="mb-2 flex items-center gap-2">
            <Warning size={19} weight="bold" />
            <h2 className="m-0 text-base font-extrabold">Feedback pending validation</h2>
          </div>
          <p className="m-0 text-sm font-semibold leading-6">{debriefBlockedReason || 'Grader feedback is unavailable until this case has passed clinician validation.'}</p>
        </section>
      </div>
    </main>
  );
}

function CaseBundlePanel() {
  const encounter = useEncounter();
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const loadFiles = (files: FileList | null) => {
    if (!files || !files.length) return;
    void encounter.loadCaseBundle(files);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <section className="grid gap-3 rounded-md border border-[#dfe7e7] bg-[#fbfcfc] p-3" data-testid="case-bundle-panel">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <strong className="block text-sm">Case Bundle</strong>
          <span className="block truncate text-xs font-semibold text-[#607078]" data-testid="case-bundle-status">
            {encounter.staticBundleName || 'No bundle loaded'}
          </span>
        </div>
        <input
          ref={inputRef}
          data-testid="case-bundle-file"
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed,.json"
          className="hidden"
          onChange={(event) => loadFiles(event.currentTarget.files)}
        />
        <button
          type="button"
          data-testid="case-bundle-open"
          className="inline-flex h-10 flex-none items-center gap-2 rounded-md border border-[#cdd8d8] bg-white px-3 text-sm font-extrabold text-[#17232b] disabled:text-[#87949b]"
          disabled={encounter.loading || encounter.busy}
          onClick={() => inputRef.current?.click()}
        >
          <UploadSimple size={16} weight="bold" /> Load
        </button>
      </div>
    </section>
  );
}

function Header({
  snapshot,
  caseStatus,
  guideOpen,
  onToggleGuide,
  onOpenSettings
}: {
  snapshot: Snapshot;
  caseStatus?: CaseStatus;
  guideOpen: boolean;
  onToggleGuide: () => void;
  onOpenSettings: () => void;
}) {
  const encounter = useEncounter();
  const demographics = snapshot.visible_start.demographics;
  const clockPaused = encounter.simClockPaused;
  return (
    <header className="flex min-h-[66px] flex-wrap items-stretch border-b border-[#d7dfdf] bg-white px-3 text-[#17232b]">
      <div className="flex min-h-[56px] min-w-0 flex-[1_1_230px] items-center gap-3 border-b border-[#eef2f2] py-3 lg:max-w-[260px] xl:border-b-0 xl:border-r xl:pr-4">
        <div className="grid h-9 w-9 place-items-center rounded-md bg-[#1264e0] text-white">
          <FirstAidKit size={22} weight="bold" />
        </div>
        <strong className="text-[15px] font-extrabold text-[#1061d5]">ED Clinical Simulator</strong>
      </div>
      <div className="min-w-0 flex-[999_1_320px] border-b border-[#eef2f2] py-3 lg:px-4 xl:border-b-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <strong className="block truncate text-[15px] font-extrabold text-[#17232b]">{snapshot.title}</strong>
          {caseStatus ? <CaseStatusBadge status={caseStatus} /> : null}
        </div>
        <span className="block truncate text-sm text-[#607078]">
          {String(demographics.age || '')}{demographics.age ? 'y' : ''} {String(demographics.sex || '')} - {snapshot.visible_start.chief_complaint} - Case ID: {snapshot.case_id}
        </span>
      </div>
      <div className="flex min-h-[48px] flex-none items-center border-b border-[#eef2f2] py-2 sm:px-3 xl:border-b-0 xl:border-l">
        <span className="rounded-md bg-[#11191f] px-3 py-2 text-xs font-extrabold capitalize text-white">Phase: {snapshot.phase}</span>
      </div>
      <div className="flex min-h-[48px] flex-none items-center gap-2 border-b border-[#eef2f2] py-2 text-sm sm:px-3 xl:border-b-0 xl:border-l">
        <Clock size={17} />
        <div className="grid">
          <span className="text-xs font-bold text-[#607078]">Sim Time</span>
          <strong className="font-extrabold" data-testid="sim-clock-display">{formatDigitalClock(snapshot.elapsed_minutes)}</strong>
        </div>
      </div>
      <div className="flex min-h-[48px] flex-none items-center gap-2 border-b border-[#eef2f2] py-2 sm:px-3 xl:border-b-0 xl:border-l">
        <button
          type="button"
          data-testid="sim-clock-toggle"
          className={`grid h-9 w-9 place-items-center rounded-md border border-[#cdd8d8] text-[#17232b] ${clockPaused ? 'bg-[#eef8f5]' : 'bg-white'}`}
          title={clockPaused ? 'Resume simulator' : 'Pause simulator'}
          aria-label={clockPaused ? 'Resume simulator clock' : 'Pause simulator clock'}
          aria-pressed={clockPaused}
          onClick={encounter.toggleSimClock}
        >
          {clockPaused ? <Play size={16} weight="bold" /> : <Pause size={16} weight="bold" />}
        </button>
        <button type="button" className="h-9 rounded-md border border-[#cdd8d8] bg-white px-3 text-sm font-extrabold" onClick={() => void encounter.advanceTime(5)} disabled={encounter.busy}>
          +5 min
        </button>
      </div>
      <div className="flex min-h-[48px] flex-none items-center gap-2 border-b border-[#eef2f2] py-2 text-sm font-extrabold capitalize sm:px-3 xl:border-b-0 xl:border-l">
        <Pulse size={18} /> Triage
      </div>
      <div className="flex min-h-[48px] flex-none items-center gap-2 py-2 sm:px-3 xl:border-l">
        <button
          type="button"
          data-testid="tutorial-mode-toggle"
          className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-extrabold ${guideOpen ? 'border-[#0f766e] bg-[#eef8f5] text-[#0f5f58]' : 'border-[#cdd8d8] bg-white text-[#17232b]'}`}
          aria-pressed={guideOpen}
          onClick={onToggleGuide}
        >
          <ClipboardText size={16} /> Tutorial
        </button>
        <button
          type="button"
          data-testid="settings-button"
          className="grid h-9 w-9 place-items-center rounded-md border border-[#cdd8d8] bg-white text-[#17232b]"
          title="Settings"
          aria-label="Open settings"
          onClick={onOpenSettings}
        >
          <GearSix size={17} />
        </button>
        <button type="button" className="inline-flex h-9 items-center gap-2 rounded-md border border-[#f0c2c2] bg-white px-3 text-sm font-extrabold text-[#c22929]" disabled={!encounter.session?.state.can_complete || encounter.busy} onClick={() => void encounter.completeCase()}>
          <SignOut size={16} /> End Case
        </button>
      </div>
    </header>
  );
}

function CaseStatusBadge({ status }: { status: CaseStatus }) {
  const locked = status.feedback_locked;
  return (
    <span
      className={`inline-flex h-6 items-center rounded-md border px-2 text-[11px] font-extrabold ${locked ? 'border-[#e6c6a0] bg-[#fff8e8] text-[#7c4a00]' : 'border-[#bcd9c1] bg-[#edf8ef] text-[#1d6b34]'}`}
      title={locked ? status.feedback_lock_reason : 'Feedback validated'}
      data-testid="case-release-status"
    >
      {locked ? 'Feedback locked' : 'Feedback ready'}
    </span>
  );
}

function TeachingGuideDrawer({ onClose }: { onClose: () => void }) {
  const encounter = useEncounter();
  const guide = encounter.teachingGuide;
  const session = encounter.session;
  const [tab, setTab] = React.useState<'tutorial' | 'answer'>('tutorial');
  const refreshKey = React.useMemo(() => teachingGuideRefreshKey(session), [session]);

  React.useEffect(() => {
    void encounter.loadTeachingGuide();
  }, [encounter.loadTeachingGuide, refreshKey]);

  return (
    <div className="fixed inset-0 z-40 bg-black/30" data-testid="teaching-guide-overlay">
      <aside className="ml-auto grid h-full w-full max-w-[460px] grid-rows-[auto_auto_minmax(0,1fr)] border-l border-[#cdd8d8] bg-white text-[#17232b] shadow-lg" data-testid="teaching-guide-drawer">
        <header className="flex items-start justify-between gap-3 border-b border-[#e4e9e9] px-4 py-3">
          <div className="min-w-0">
            <h2 className="m-0 text-base font-extrabold">Tutorial Mode</h2>
            <p className="m-0 mt-1 truncate text-sm font-semibold text-[#607078]">{guide?.title || session?.snapshot.title}</p>
          </div>
          <button type="button" className="rounded-md border border-[#cdd8d8] px-3 py-2 text-sm font-bold" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="flex gap-5 border-b border-[#e4e9e9] px-4 text-sm font-bold">
          {([
            ['tutorial', 'Steps'],
            ['answer', 'Answer Key']
          ] as Array<['tutorial' | 'answer', string]>).map(([id, label]) => (
            <button
              key={id}
              type="button"
              data-testid={`teaching-guide-tab-${id}`}
              className={`border-x-0 border-t-0 border-b-2 bg-transparent px-0 pb-3 pt-3 ${tab === id ? 'border-[#0f766e] text-[#0f5f58]' : 'border-transparent text-[#26323a]'}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="min-h-0 overflow-auto p-4">
          {encounter.teachingGuideLoading && !guide ? (
            <div className="rounded-md border border-dashed border-[#cdd8d8] bg-[#fbfcfc] p-4 text-sm font-semibold text-[#607078]">Loading tutorial...</div>
          ) : guide ? (
            tab === 'tutorial' ? <TutorialSteps guide={guide} /> : <AnswerKeyView guide={guide} />
          ) : (
            <div className="rounded-md border border-[#e8b5b5] bg-[#fff7f7] p-4 text-sm font-semibold text-[#7f1d1d]">Tutorial guide is unavailable.</div>
          )}
        </div>
      </aside>
    </div>
  );
}

function TutorialSteps({ guide }: { guide: TeachingGuide }) {
  const currentStep = guide.tutorial_steps.find((step) => step.id === guide.next_step_id);
  return (
    <div className="grid gap-4" data-testid="tutorial-steps-view">
      <section className="rounded-md border border-[#cdd8d8] bg-[#fbfcfc] p-3">
        <div className="flex items-center justify-between gap-3">
          <strong className="text-sm">Progress</strong>
          <span className="text-xs font-extrabold text-[#607078]">{guide.progress.completed}/{guide.progress.total}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-sm bg-[#e4e9e9]">
          <div className="h-full bg-[#0f766e]" style={{ width: guide.progress.total ? `${Math.round((guide.progress.completed / guide.progress.total) * 100)}%` : '0%' }} />
        </div>
      </section>
      <section className="rounded-md border border-[#0f766e] bg-[#f2faf7] p-3" data-testid="tutorial-next-step">
        <span className="text-xs font-extrabold text-[#0f5f58]">Next</span>
        <h3 className="m-0 mt-1 text-base font-extrabold">{currentStep?.title || 'All required steps complete'}</h3>
        <p className="m-0 mt-2 text-sm font-semibold leading-6 text-[#27313a]">
          {currentStep?.instruction || 'Review the answer key, then complete the case when you are ready.'}
        </p>
        {currentStep?.target_labels.length ? <p className="m-0 mt-2 text-xs font-bold leading-5 text-[#607078]">{currentStep.target_labels.join(', ')}</p> : null}
      </section>
      <section className="grid gap-2">
        {guide.tutorial_steps.map((step) => (
          <TutorialStepCard key={step.id} step={step} />
        ))}
      </section>
    </div>
  );
}

function TutorialStepCard({ step }: { step: TutorialStep }) {
  const done = step.status === 'done';
  return (
    <article className={`rounded-md border p-3 ${done ? 'border-[#c8e3dd] bg-[#f7fcfa]' : step.required ? 'border-[#dfe7e7] bg-white' : 'border-[#e7dcc8] bg-[#fffaf0]'}`} data-testid={`tutorial-step-${step.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <strong className="block text-sm">{step.title}</strong>
          <span className="text-xs font-semibold text-[#607078]">{step.required ? 'Required' : 'Optional'}</span>
        </div>
        <GuideStatusPill status={step.status} />
      </div>
      <p className="m-0 mt-2 text-sm leading-6 text-[#27313a]">{step.instruction}</p>
      {step.rationale ? <p className="m-0 mt-2 text-xs font-semibold leading-5 text-[#607078]">{step.rationale}</p> : null}
      {step.target_labels.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {step.target_labels.map((label) => (
            <span key={label} className="rounded-md border border-[#dfe7e7] bg-[#fbfcfc] px-2 py-1 text-xs font-bold text-[#52636b]">{label}</span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function AnswerKeyView({ guide }: { guide: TeachingGuide }) {
  const key = guide.answer_key;
  return (
    <div className="grid gap-4" data-testid="answer-key-view">
      <section className="rounded-md border border-[#cdd8d8] bg-[#fbfcfc] p-3">
        <dl className="grid gap-2 text-sm">
          <GuideFact label="Diagnosis" value={key.diagnosis} />
          <GuideFact label="ESI" value={String(key.validated_esi)} />
          <GuideFact label="Disposition" value={key.disposition} />
          <GuideFact label="Case" value={key.case_summary} />
        </dl>
      </section>
      <GuideListSection title="History" items={key.history} renderItem={(item) => <HistoryGuideItem item={item} />} />
      <GuideListSection title="Interventions" items={key.interventions} renderItem={(item) => <ActionGuideItem item={item} />} />
      <GuideListSection title="Exams" items={key.exams} renderItem={(item) => <ActionGuideItem item={item} />} />
      <GuideListSection title="Orders" items={key.orders} renderItem={(item) => <ActionGuideItem item={item} />} />
      <GuideListSection title="Result Reads" items={key.result_interpretations} renderItem={(item) => <ResultGuideItem item={item} />} />
      <section className="rounded-md border border-[#dfe7e7] bg-white p-3">
        <h3 className="m-0 mb-2 text-sm font-extrabold">Differential</h3>
        <ul className="m-0 grid gap-1 p-0 text-sm">
          {key.differential.map((item) => <li key={item} className="list-none leading-6 text-[#27313a]">{item}</li>)}
        </ul>
      </section>
      <section className="rounded-md border border-[#dfe7e7] bg-white p-3">
        <h3 className="m-0 mb-2 text-sm font-extrabold">SOAP Template</h3>
        <div className="grid gap-2 text-sm">
          <GuideFact label="Subjective" value={key.soap_template.subjective} />
          <GuideFact label="Objective" value={key.soap_template.objective} />
          <GuideFact label="Assessment" value={key.soap_template.assessment} />
          <GuideFact label="Plan" value={key.soap_template.plan} />
        </div>
      </section>
      {key.avoid.length ? <GuideListSection title="Avoid" items={key.avoid} renderItem={(item) => <ActionGuideItem item={item} />} /> : null}
      {key.key_points.length ? (
        <section className="rounded-md border border-[#dfe7e7] bg-white p-3">
          <h3 className="m-0 mb-2 text-sm font-extrabold">Key Points</h3>
          <ul className="m-0 grid gap-1 p-0 text-sm">
            {key.key_points.map((item) => <li key={item} className="list-none leading-6 text-[#27313a]">{item}</li>)}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function GuideListSection<T>({ title, items, renderItem }: { title: string; items: T[]; renderItem: (item: T) => React.ReactNode }) {
  return (
    <section className="rounded-md border border-[#dfe7e7] bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="m-0 text-sm font-extrabold">{title}</h3>
        <span className="text-xs font-bold text-[#607078]">{items.length}</span>
      </div>
      {items.length ? <div className="grid gap-2">{items.map((item, index) => <React.Fragment key={guideItemKey(item, index)}>{renderItem(item)}</React.Fragment>)}</div> : <p className="m-0 text-sm font-semibold text-[#607078]">No items.</p>}
    </section>
  );
}

function HistoryGuideItem({ item }: { item: GuideHistoryItem }) {
  return (
    <article className="rounded-md border border-[#eef2f2] bg-[#fbfcfc] p-2.5">
      <div className="flex items-start justify-between gap-3">
        <strong className="text-sm capitalize">{item.topic}</strong>
        <GuideStatusPill status={item.status} />
      </div>
      <p className="m-0 mt-1 text-sm leading-6 text-[#27313a]">{item.prompt}</p>
      <p className="m-0 mt-1 text-xs font-semibold leading-5 text-[#607078]">{item.expected_response}</p>
    </article>
  );
}

function ActionGuideItem({ item }: { item: GuideActionItem }) {
  return (
    <article className="rounded-md border border-[#eef2f2] bg-[#fbfcfc] p-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <strong className="block text-sm">{item.label}</strong>
          <span className="text-xs font-semibold text-[#607078]">{item.required ? 'Required' : 'Optional'}</span>
        </div>
        <GuideStatusPill status={item.status} />
      </div>
      {item.why ? <p className="m-0 mt-1 text-xs font-semibold leading-5 text-[#607078]">{item.why}</p> : null}
    </article>
  );
}

function ResultGuideItem({ item }: { item: GuideResultInterpretation }) {
  return (
    <article className="rounded-md border border-[#eef2f2] bg-[#fbfcfc] p-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <strong className="block text-sm">{item.label}</strong>
          {item.source ? <span className="text-xs font-semibold text-[#607078]">{item.source}</span> : null}
        </div>
        <GuideStatusPill status={item.status} />
      </div>
      <p className="m-0 mt-1 text-sm leading-6 text-[#27313a]">{item.expected_read}</p>
    </article>
  );
}

function GuideFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs font-extrabold text-[#607078]">{label}</span>
      <p className="m-0 text-sm font-semibold leading-6 text-[#27313a]">{value}</p>
    </div>
  );
}

function GuideStatusPill({ status }: { status: 'done' | 'pending' }) {
  return (
    <span className={`rounded-md border px-2 py-1 text-xs font-extrabold ${status === 'done' ? 'border-[#bcd9c1] bg-[#edf8ef] text-[#1d6b34]' : 'border-[#e6c6a0] bg-[#fff8e8] text-[#7c4a00]'}`}>
      {status === 'done' ? 'Done' : 'Pending'}
    </span>
  );
}

function teachingGuideRefreshKey(session: ReturnType<typeof useEncounter>['session']) {
  if (!session) return '';
  const orders = session.snapshot.active_orders.map((order) => `${order.order_id}:${order.status}`).join('|');
  const exams = session.snapshot.performed_exams.map((exam) => exam.maneuver_id).join('|');
  const interventions = session.snapshot.interventions.join('|');
  const esi = session.state.esi_history.map((item) => item.level).join('|');
  const interpretations = Object.keys(session.state.result_interpretations || {}).join('|');
  return [
    session.session_id,
    orders,
    exams,
    interventions,
    esi,
    session.state.differential.join('|'),
    session.state.soap.assessment,
    session.state.soap.plan,
    interpretations,
    String(session.state.ended)
  ].join('::');
}

function guideItemKey(item: unknown, index: number) {
  if (item && typeof item === 'object') {
    const maybeItem = item as { id?: unknown; order_id?: unknown; label?: unknown; topic?: unknown };
    return String(maybeItem.id || maybeItem.order_id || maybeItem.label || maybeItem.topic || index);
  }
  return String(index);
}

function VitalsRail() {
  const { session, previousSnapshot } = useEncounter();
  if (!session) return null;
  const tick = useMonitorTick();
  const [monitorOpen, setMonitorOpen] = React.useState(false);
  const current = session.snapshot.current_vitals;
  const liveVitals = React.useMemo(() => simulatedMonitorVitals(current, session.snapshot.elapsed_minutes, tick), [current, session.snapshot.elapsed_minutes, tick]);
  const previous = previousSnapshot?.current_vitals;
  const oxygenEvents = session.snapshot.intervention_events.filter((event) => event.intervention_id === 'oxygen');
  const lastOxygen = oxygenEvents.at(-1);
  const spo2Response =
    previous && previous.spo2 !== current.spo2
      ? `SpO2 ${previous.spo2} -> ${current.spo2}`
      : lastOxygen
        ? `O2 applied; SpO2 ${current.spo2}`
        : current.spo2 < 94
          ? 'Hypoxia present'
          : 'Oxygen not applied';
  const monitoredRows = [
    { label: 'HR', value: liveVitals.hr, unit: 'bpm', key: 'hr', kind: 'ecg', color: '#69d34d', limits: '150 / 50' },
    { label: 'SpO2', value: liveVitals.spo2, unit: '%', key: 'spo2', kind: 'pleth', color: '#43d9e8', limits: '100 / 80' },
    { label: 'RR', value: liveVitals.rr, unit: '/min', key: 'rr', kind: 'resp', color: '#4ea1ff', limits: '40 / 8' },
    { label: 'BP', value: `${liveVitals.sbp}/${liveVitals.dbp}`, unit: 'mmHg', key: 'bp', kind: 'bp', color: '#ff4d3f', limits: '180 / 80' }
  ] as const;
  const spotMeasuredAt = formatClock(Math.max(0, Math.floor(session.snapshot.elapsed_minutes / 15) * 15));
  const spotRows = [
    { label: 'Temp', value: current.temp_c ?? 'n/a', unit: 'C', color: '#f4d000', measuredAt: spotMeasuredAt },
    { label: 'Pain', value: current.pain ?? 'n/a', unit: '/10', color: '#9d7cf4', measuredAt: spotMeasuredAt }
  ];
  const trendPoints = React.useMemo(() => monitorTrendPoints(session.snapshot, liveVitals, tick), [session.snapshot, liveVitals, tick]);

  return (
    <aside className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-3 overflow-hidden min-[1500px]:h-full">
      <PatientVisualPanel snapshot={session.snapshot} />
      {!monitorOpen ? (
        <MonitorClosedPanel snapshot={session.snapshot} onOpen={() => setMonitorOpen(true)} />
      ) : (
      <section className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-[#202b32] bg-[#11191f]" data-testid="vitals-monitor">
        <div className="flex items-center justify-between gap-3 border-b border-[#26343c] px-4 py-3 text-white">
          <div className="flex items-center gap-2">
            <Pulse size={19} weight="bold" />
            <h2 className="m-0 text-base font-extrabold" aria-label="Vitals">Live Monitor</h2>
          </div>
          <button
            type="button"
            data-testid="collapse-vitals-monitor"
            className="inline-flex items-center gap-2 rounded-md border border-[#34444d] px-2 py-1 text-xs font-bold text-[#c8d4d8]"
            title="Collapse monitor"
            onClick={() => setMonitorOpen(false)}
          >
            <CaretUp size={13} /> Collapse
          </button>
        </div>
        <div className="min-h-0 overflow-auto p-3 text-white">
          <div className="mb-2 flex min-w-0 flex-wrap items-center gap-2 border-b border-[#26343c] pb-3 text-sm font-bold">
            <span>O2 Therapy</span>
            <span className={`h-2.5 w-2.5 rounded-full ${lastOxygen ? 'bg-[#62d96b]' : current.spo2 < 94 ? 'bg-[#ff4d3f]' : 'bg-[#2f444d]'}`} />
            <span className="text-[#c8d4d8]">{lastOxygen ? 'O2 Applied' : 'Not applied'}</span>
            <span className="rounded-md bg-[#2a316b] px-2 py-1 text-xs text-white sm:ml-auto">{spo2Response}</span>
          </div>
          <div className="grid gap-0 divide-y divide-[#26343c]">
            {monitoredRows.map((row) => (
              <MonitorWaveRow key={row.label} row={row} current={liveVitals} previous={previous} tick={tick} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {spotRows.map((row) => (
              <SpotVital key={row.label} row={row} />
            ))}
          </div>
          <MonitorTrendChart points={trendPoints} />

          <div className="mt-3 grid gap-3 border-t border-[#26343c] pt-3">
            <div>
              <div className="mb-1 flex items-center gap-2 text-sm font-extrabold text-white">
                <Stethoscope size={17} weight="bold" />
                <span>Patient Appearance</span>
              </div>
              <p className="m-0 text-sm leading-5 text-[#d3dee2]">{session.snapshot.appearance}</p>
            </div>
            <div>
              <strong className="text-sm">Mental Status</strong>
              <p className="m-0 mt-1 text-sm leading-5 text-[#b9cbd1]">Not formally assessed.</p>
            </div>
          </div>
        </div>
      </section>
      )}

      <AiConnectionPanel />
    </aside>
  );
}

function PatientVisualPanel({ snapshot }: { snapshot: Snapshot }) {
  const visual = snapshot.visible_start.visual;
  const [imageFailed, setImageFailed] = React.useState(false);
  const source = visual?.src?.trim() || '';
  const hasImage = Boolean(source && !imageFailed);

  React.useEffect(() => {
    setImageFailed(false);
  }, [source]);

  return (
    <section className="grid min-w-0 rounded-lg border border-[#d7dfdf] bg-white p-2" data-testid="patient-visual-panel" aria-label="Patient visual">
      <div className="patient-visual-frame" data-testid="patient-visual-frame">
        {hasImage ? (
          <img
            data-testid="patient-visual-image"
            src={source}
            alt={visual?.alt || patientVisualAlt(snapshot)}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <PatientVisualFallback snapshot={snapshot} />
        )}
      </div>
    </section>
  );
}

function PatientVisualFallback({ snapshot }: { snapshot: Snapshot }) {
  const tone = fallbackAvatarTone(snapshot.case_id);
  const style = {
    '--patient-avatar-bg': tone.bg,
    '--patient-avatar-fg': tone.fg
  } as React.CSSProperties;

  return (
    <div className="patient-visual-fallback" style={style} role="img" aria-label={patientVisualAlt(snapshot)} data-testid="patient-visual-fallback">
      <UserCircle size={72} weight="duotone" />
    </div>
  );
}

function MonitorClosedPanel({ snapshot, onOpen }: { snapshot: Snapshot; onOpen: () => void }) {
  return (
    <section className="grid min-w-0 content-start gap-3 rounded-lg border border-[#d7dfdf] bg-white p-4" data-testid="vitals-monitor-closed">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Pulse size={19} weight="bold" />
          <h2 className="m-0 text-base font-extrabold" aria-label="Vitals">Vitals Monitor</h2>
        </div>
        <span className="rounded-md bg-[#eef2f2] px-2 py-1 text-xs font-extrabold text-[#52636b]">Closed</span>
      </div>
      <p className="m-0 text-sm leading-6 text-[#52636b]">Continuous HR, SpO2, RR, BP, ECG, pleth, and trend traces are hidden.</p>
      <button
        type="button"
        data-testid="open-vitals-monitor"
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#11191f] px-3 text-sm font-extrabold text-white"
        onClick={onOpen}
      >
        <Pulse size={17} weight="bold" /> Open live monitor
      </button>
      <div className="rounded-md border border-[#dfe7e7] bg-[#fbfcfc] p-3 text-sm">
        <strong className="block text-[#17232b]">Last triage set</strong>
        <span className="mt-1 block break-words text-[#607078]">
          HR {snapshot.current_vitals.hr}, SpO2 {snapshot.current_vitals.spo2}%, RR {snapshot.current_vitals.rr}, BP {snapshot.current_vitals.sbp}/{snapshot.current_vitals.dbp}
        </span>
      </div>
    </section>
  );
}

function useMonitorTick() {
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const id = window.setInterval(() => setTick((value) => (value + 1) % 100000), 180);
    return () => window.clearInterval(id);
  }, []);
  return tick;
}

function MonitorWaveRow({
  row,
  current,
  previous,
  tick
}: {
  row: { label: string; value: number | string; unit: string; key: string; kind: string; color: string; limits: string };
  current: VitalSigns;
  previous?: VitalSigns;
  tick: number;
}) {
  const rawCurrent = numericVital(row.key, current);
  const rawPrevious = previous ? numericVital(row.key, previous) : null;
  const delta = rawCurrent !== null && rawPrevious !== null ? rawCurrent - rawPrevious : 0;
  const points = buildWavePoints(row.kind, rawCurrent ?? 0, tick);
  const valueTone = row.key === 'spo2' && Number(rawCurrent) < 94 ? '#ff6b6b' : row.color;
  const valueSize = row.key === 'bp' ? 'text-[21px]' : 'text-[25px]';

  return (
    <div className="grid min-h-[58px] min-w-0 grid-cols-[5px_minmax(84px,96px)_minmax(0,1fr)_34px] items-center gap-2 py-1.5">
      <div className="h-full rounded-sm" style={{ backgroundColor: valueTone }} />
      <div className="min-w-0">
        <div className="text-xs font-extrabold" style={{ color: valueTone }}>{row.label}</div>
        <div className="mt-1 flex items-end gap-1">
          <strong data-testid={`monitor-value-${row.key}`} className={`${valueSize} font-extrabold leading-none`} style={{ color: valueTone }}>{row.value}</strong>
          <span className="pb-1 text-xs text-[#d3dee2]">{row.unit}</span>
        </div>
        {delta ? <span className="text-xs font-extrabold" style={{ color: valueTone }}>{formatDelta(delta)}</span> : null}
      </div>
      <svg className="h-9 min-w-0 w-full overflow-visible" viewBox="0 0 180 44" aria-hidden="true">
        <line x1="0" x2="180" y1="22" y2="22" stroke="#293a43" strokeDasharray="4 6" strokeWidth="1" />
        <polyline data-testid={`waveform-${row.key}`} points={points} fill="none" stroke={valueTone} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="grid gap-1 text-right text-xs font-bold text-[#a8bbc2]">
        {row.limits.split(' / ').map((limit) => <span key={limit}>{limit}</span>)}
      </div>
    </div>
  );
}

function SpotVital({ row }: { row: { label: string; value: number | string; unit: string; color: string; measuredAt: string } }) {
  return (
    <div className="rounded-md border border-[#26343c] bg-[#0b1115] p-2.5">
      <div className="text-xs font-extrabold" style={{ color: row.color }}>{row.label}</div>
      <div className="mt-1 flex items-end gap-1">
        <strong className="text-xl font-extrabold leading-none" style={{ color: row.color }}>{row.value}</strong>
        <span className="pb-1 text-xs text-[#d3dee2]">{row.unit}</span>
      </div>
      <span className="mt-0.5 block text-xs font-semibold text-[#8fa3ab]">measured {row.measuredAt}</span>
    </div>
  );
}

function MonitorTrendChart({ points }: { points: Array<{ elapsed: number; vitals: VitalSigns }> }) {
  const hr = buildTrendPolyline(points, 'hr', 42, 150, 86, 42);
  const spo2 = buildTrendPolyline(points, 'spo2', 80, 100, 86, 42);
  const rr = buildTrendPolyline(points, 'rr', 8, 40, 86, 42);
  return (
    <div className="mt-2 rounded-md border border-[#26343c] bg-[#0b1115] p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <strong className="text-sm">Trends</strong>
        <span className="text-xs font-semibold text-[#8fa3ab]">case timeline</span>
      </div>
      <svg viewBox="0 0 100 52" className="h-[104px] w-full" aria-label="Monitor trend chart">
        {[0, 1, 2, 3].map((line) => (
          <line key={line} x1="5" x2="95" y1={8 + line * 10} y2={8 + line * 10} stroke="#24343d" strokeWidth="0.6" />
        ))}
        <polyline points={hr} fill="none" stroke="#69d34d" strokeWidth="1.6" strokeLinecap="round" />
        <polyline points={spo2} fill="none" stroke="#43d9e8" strokeWidth="1.6" strokeLinecap="round" />
        <polyline points={rr} fill="none" stroke="#4ea1ff" strokeWidth="1.6" strokeLinecap="round" />
        <text x="5" y="50" fill="#8fa3ab" fontSize="5">start</text>
        <text x="85" y="50" fill="#8fa3ab" fontSize="5">now</text>
      </svg>
      <div className="mt-2 flex flex-wrap gap-3 text-xs font-bold">
        <span className="text-[#69d34d]">HR</span>
        <span className="text-[#43d9e8]">SpO2</span>
        <span className="text-[#4ea1ff]">RR</span>
      </div>
    </div>
  );
}

function AiConnectionPanel() {
  const encounter = useEncounter();
  const status = encounter.llmStatus;
  const connected = Boolean(status?.ready);
  const byok = Boolean(status?.configured);

  if (connected) {
    return (
      <section className="rounded-lg border border-[#d7dfdf] bg-white px-3 py-2" data-testid="ai-status-panel">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <ChatCircleText size={16} weight="bold" />
          <p className="m-0 min-w-0 flex-1 truncate text-xs font-semibold text-[#31534f]" data-testid="ai-status-message">
            {byok ? `BYOK: ${providerLabel(status?.provider || '')} / ${status?.cheap_model}` : 'Local authored responses active'}
          </p>
          {encounter.aiConfigSaved ? (
            <div className="flex items-center gap-2 text-xs font-semibold text-[#52636b]" data-testid="ai-local-key-status">
              <span>API key saved locally</span>
              <button
                type="button"
                className="rounded-md border border-[#cdd8d8] px-2 py-1 text-xs font-extrabold text-[#27313a]"
                onClick={encounter.forgetAiConfig}
              >
                Forget
              </button>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-[#e8b5b5] bg-[#fff7f7] p-4" data-testid="ai-status-panel">
      <div className="mb-2 flex items-center gap-2">
        <ChatCircleText size={18} weight="bold" />
        <h2 className="m-0 text-base font-extrabold">AI</h2>
      </div>
      <p className="m-0 text-sm font-semibold leading-6 text-[#7f1d1d]" data-testid="ai-status-message">
        {status?.message || 'Local authored responses are active.'}
      </p>
      {encounter.aiConfigSaved ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#d7dfdf] bg-white px-3 py-2 text-xs font-semibold text-[#52636b]" data-testid="ai-local-key-status">
          <span>API key saved locally</span>
          <button
            type="button"
            className="rounded-md border border-[#cdd8d8] px-2 py-1 text-xs font-extrabold text-[#27313a]"
            onClick={encounter.forgetAiConfig}
          >
            Forget
          </button>
        </div>
      ) : null}
      <AiSettingsForm testIdPrefix="ai" />
    </section>
  );
}

function SettingsDrawer({ onClose }: { onClose: () => void }) {
  const encounter = useEncounter();
  const connected = Boolean(encounter.llmStatus?.ready);
  const byok = Boolean(encounter.llmStatus?.configured);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30"
      data-testid="settings-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="ml-auto grid h-full w-full max-w-[460px] grid-rows-[auto_minmax(0,1fr)] border-l border-[#cdd8d8] bg-white text-[#17232b] shadow-lg"
        data-testid="settings-drawer"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[#e4e9e9] px-4 py-3">
          <div className="min-w-0">
            <h2 id="settings-title" className="m-0 text-base font-extrabold">Settings</h2>
            <p className="m-0 mt-1 text-sm font-semibold text-[#607078]">Case bundle and AI connection</p>
          </div>
          <button
            type="button"
            data-testid="settings-close"
            className="grid h-9 w-9 place-items-center rounded-md border border-[#cdd8d8] text-[#17232b]"
            aria-label="Close settings"
            title="Close settings"
            onClick={onClose}
          >
            <X size={17} weight="bold" />
          </button>
        </header>
        <div className="min-h-0 overflow-auto p-4">
          <CaseBundlePanel />
          <section className={`mb-3 rounded-md border p-3 ${connected ? 'border-[#c8e3dd] bg-[#f7fcfa]' : 'border-[#e8b5b5] bg-[#fff7f7]'}`}>
            <div className="mb-1 flex items-center gap-2">
              <ChatCircleText size={17} weight="bold" />
              <strong className="text-sm">{byok ? 'BYOK enabled' : connected ? 'Local responses' : 'Not ready'}</strong>
            </div>
            <p className={`m-0 text-sm font-semibold leading-6 ${connected ? 'text-[#31534f]' : 'text-[#7f1d1d]'}`} data-testid="settings-ai-status-message">
              {byok
                ? `${providerLabel(encounter.llmStatus?.provider || '')} / ${encounter.llmStatus?.cheap_model || 'model'}`
                : encounter.llmStatus?.message || 'Local authored responses are active.'}
            </p>
            {encounter.aiConfigSaved ? (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-[#52636b]" data-testid="settings-ai-local-key-status">
                <span>API key saved locally</span>
                <button
                  type="button"
                  className="rounded-md border border-[#cdd8d8] bg-white px-2 py-1 text-xs font-extrabold text-[#27313a]"
                  onClick={encounter.forgetAiConfig}
                >
                  Forget
                </button>
              </div>
            ) : null}
          </section>
          <AiSettingsForm testIdPrefix="settings-ai" />
        </div>
      </aside>
    </div>
  );
}

function AiSettingsForm({ testIdPrefix }: { testIdPrefix: 'ai' | 'settings-ai' }) {
  const encounter = useEncounter();
  const [openRouterOptions, setOpenRouterOptions] = React.useState<AIModelOption[]>([]);
  const [openRouterLoading, setOpenRouterLoading] = React.useState(false);
  const [openRouterRefreshTried, setOpenRouterRefreshTried] = React.useState(false);
  const [modelStatus, setModelStatus] = React.useState('');
  const lockedBaseUrl = encounter.aiProviderDraft !== 'openai_compatible';
  const visibleBaseUrl = lockedBaseUrl
    ? defaultAIBaseUrl(encounter.aiProviderDraft)
    : encounter.aiBaseUrlDraft;
  const inputClass = 'h-10 rounded-md border border-[#cdd8d8] bg-white px-3 text-sm outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/20 disabled:bg-[#f5f7f7] disabled:text-[#607078]';
  const baseModelOptions = modelOptionsForProvider(encounter.aiProviderDraft, openRouterOptions);
  const dialogueModelOptions = modelOptionsWithCurrent(baseModelOptions, encounter.aiCheapModelDraft);
  const strongModelOptions = modelOptionsWithCurrent(baseModelOptions, encounter.aiStrongModelDraft);
  const showOpenRouterRefresh = encounter.aiProviderDraft === 'openrouter';

  const refreshOpenRouterModels = React.useCallback(async () => {
    setOpenRouterLoading(true);
    setOpenRouterRefreshTried(true);
    setModelStatus('Refreshing OpenRouter models...');
    try {
      const options = await fetchOpenRouterModelOptions();
      setOpenRouterOptions(options);
      setModelStatus(options.length ? `${options.length} OpenRouter models loaded` : 'OpenRouter returned no text models; showing curated defaults.');
    } catch {
      setModelStatus('OpenRouter catalog unavailable; showing curated defaults.');
    } finally {
      setOpenRouterLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (encounter.aiProviderDraft === 'openrouter' && !openRouterOptions.length && !openRouterRefreshTried && !openRouterLoading) {
      void refreshOpenRouterModels();
    }
  }, [encounter.aiProviderDraft, openRouterLoading, openRouterOptions.length, openRouterRefreshTried, refreshOpenRouterModels]);

  const handleProviderChange = (next: AIProviderDraft) => {
    encounter.setAiProviderDraft(next);
    encounter.setAiBaseUrlDraft(defaultAIBaseUrl(next));
    encounter.setAiCheapModelDraft(defaultCheapModel(next));
    encounter.setAiStrongModelDraft(defaultStrongModel(next));
    if (next !== 'openrouter') setModelStatus('');
  };

  return (
    <form
      className="mt-3 grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void encounter.configureAi();
      }}
    >
      <label className="grid gap-1 text-xs font-bold text-[#52636b]">
        Provider
        <select
          data-testid={`${testIdPrefix}-provider`}
          value={encounter.aiProviderDraft}
          onChange={(event) => {
            const next = event.target.value as AIProviderDraft;
            handleProviderChange(next);
          }}
          className={inputClass}
        >
          <option value="openai_responses">OpenAI</option>
          <option value="deepseek">DeepSeek</option>
          <option value="openrouter">OpenRouter</option>
          <option value="openai_compatible">OpenAI-compatible</option>
        </select>
      </label>
      <label className="grid gap-1 text-xs font-bold text-[#52636b]">
        API key
        <input
          data-testid={`${testIdPrefix}-api-key`}
          type="password"
          value={encounter.aiKeyDraft}
          onChange={(event) => encounter.setAiKeyDraft(event.target.value)}
          placeholder={`${providerLabel(encounter.aiProviderDraft)} API key`}
          className={inputClass}
        />
      </label>
      <label className="grid gap-1 text-xs font-bold text-[#52636b]">
        Base URL
        <input
          data-testid={`${testIdPrefix}-base-url`}
          value={visibleBaseUrl}
          onChange={(event) => encounter.setAiBaseUrlDraft(event.target.value)}
          disabled={lockedBaseUrl}
          placeholder={encounter.aiProviderDraft === 'openai_responses' ? 'OpenAI Responses API' : 'Compatible chat-completions endpoint'}
          className={inputClass}
        />
      </label>
      {showOpenRouterRefresh ? (
        <div className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-[#d7dfdf] bg-[#f8fbfb] px-3 py-2">
          <span className="min-w-0 truncate text-xs font-bold text-[#52636b]" data-testid={`${testIdPrefix}-model-status`}>
            {modelStatus || 'OpenRouter curated models shown'}
          </span>
          <button
            type="button"
            data-testid={`${testIdPrefix}-refresh-models`}
            title="Refresh OpenRouter models"
            disabled={openRouterLoading}
            onClick={() => void refreshOpenRouterModels()}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[#cdd8d8] bg-white text-[#27313a] disabled:bg-[#eef3f3] disabled:text-[#8b989e]"
          >
            <ArrowClockwise size={16} weight="bold" />
          </button>
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-bold text-[#52636b]">
          Dialogue model
          <select
            data-testid={`${testIdPrefix}-cheap-model`}
            value={encounter.aiCheapModelDraft}
            onChange={(event) => encounter.setAiCheapModelDraft(event.target.value)}
            className={`${inputClass} min-w-0`}
          >
            {dialogueModelOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {modelOptionText(option)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold text-[#52636b]">
          Strong model
          <select
            data-testid={`${testIdPrefix}-strong-model`}
            value={encounter.aiStrongModelDraft}
            onChange={(event) => encounter.setAiStrongModelDraft(event.target.value)}
            className={`${inputClass} min-w-0`}
          >
            {strongModelOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {modelOptionText(option)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button data-testid={`${testIdPrefix}-connect`} type="submit" disabled={encounter.busy} className="h-10 rounded-md bg-[#0f766e] text-sm font-extrabold text-white disabled:bg-[#dce4e4] disabled:text-[#738088]">
        {encounter.busy ? 'Saving...' : 'Enable BYOK'}
      </button>
    </form>
  );
}

function modelOptionsWithCurrent(options: AIModelOption[], current: string) {
  const trimmed = current.trim();
  if (!trimmed || options.some((option) => option.id === trimmed)) return options;
  return [{ id: trimmed, label: `${trimmed} saved` }, ...options];
}

function modelOptionText(option: AIModelOption) {
  return option.label === option.id ? option.id : `${option.label} (${option.id})`;
}

function providerLabel(provider: string) {
  if (provider === 'openai_responses' || provider === 'openai' || provider === 'responses') return 'OpenAI';
  if (provider === 'deepseek') return 'DeepSeek';
  if (provider === 'openrouter') return 'OpenRouter';
  if (provider === 'openai_compatible' || provider === 'chat_completions') return 'OpenAI-compatible';
  return provider || 'AI';
}

function ConversationPanel() {
  const encounter = useEncounter();
  const messages = encounter.session?.state.transcript || [];
  const aiReady = Boolean(encounter.llmStatus?.ready);
  const [activeTool, setActiveTool] = React.useState<'note' | 'consult' | 'more' | null>(null);
  const [noteDraft, setNoteDraft] = React.useState('');
  const consultSpecialties = ['surgery', 'medicine', 'gastroenterology', 'cardiology', 'pulmonology', 'radiology'];

  const toggleTool = (tool: 'note' | 'consult' | 'more') => {
    setActiveTool((current) => (current === tool ? null : tool));
  };

  const submitNote = async (event: React.FormEvent) => {
    event.preventDefault();
    const note = noteDraft.trim();
    if (!note) return;
    await encounter.addNote(note);
    setNoteDraft('');
    setActiveTool(null);
  };

  const sendQuickTurn = async (text: string) => {
    await encounter.sendQuickText(text);
    setActiveTool(null);
  };

  return (
    <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-[#d7dfdf] bg-white" data-testid="conversation-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e4e9e9] px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <ChatCircleText size={19} weight="bold" />
          <h2 className="m-0 text-base font-extrabold">Conversation</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            data-testid="add-note-action"
            type="button"
            className={`inline-flex h-8 items-center gap-2 rounded-md border px-2 text-xs font-bold disabled:text-[#87949b] ${activeTool === 'note' ? 'border-[#0f766e] bg-[#eef8f5] text-[#0f5f58]' : 'border-[#cdd8d8] text-[#26323a]'}`}
            onClick={() => toggleTool('note')}
            disabled={encounter.busy}
          >
            <NotePencil size={15} /> Add Note
          </button>
          <button
            data-testid="call-consult-action"
            type="button"
            className={`inline-flex h-8 items-center gap-2 rounded-md border px-2 text-xs font-bold disabled:text-[#87949b] ${activeTool === 'consult' ? 'border-[#0f766e] bg-[#eef8f5] text-[#0f5f58]' : 'border-[#cdd8d8] text-[#26323a]'}`}
            onClick={() => toggleTool('consult')}
            disabled={encounter.busy}
          >
            <MagnifyingGlass size={15} /> Call Consult
          </button>
          <button
            type="button"
            data-testid="advance-15"
            className="inline-flex h-8 items-center gap-2 rounded-md border border-[#cdd8d8] px-2 text-xs font-bold text-[#26323a] disabled:text-[#87949b]"
            onClick={() => encounter.advanceTime(15)}
            disabled={encounter.busy}
          >
            <Clock size={15} /> 15 min
          </button>
          <button
            type="button"
            data-testid="more-actions"
            className={`grid h-8 w-8 place-items-center rounded-md border ${activeTool === 'more' ? 'border-[#0f766e] bg-[#eef8f5] text-[#0f5f58]' : 'border-[#cdd8d8] text-[#26323a]'}`}
            title="More conversation actions"
            onClick={() => toggleTool('more')}
          >
            <DotsThreeVertical size={16} weight="bold" />
          </button>
        </div>
      </div>
      {activeTool ? (
        <div className="border-b border-[#e4e9e9] bg-[#fbfcfc] px-4 py-3">
          {activeTool === 'note' ? (
            <form data-testid="note-composer" className="grid gap-2" onSubmit={(event) => void submitNote(event)}>
              <textarea
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                className="min-h-[72px] resize-y rounded-md border border-[#cdd8d8] bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/20"
                placeholder="Clinical note"
              />
              <div className="flex justify-end gap-2">
                <button type="button" className="h-8 rounded-md border border-[#cdd8d8] px-3 text-xs font-bold" onClick={() => setActiveTool(null)}>
                  Cancel
                </button>
                <button type="submit" className="h-8 rounded-md bg-[#11191f] px-3 text-xs font-bold text-white" disabled={!noteDraft.trim() || encounter.busy}>
                  Save Note
                </button>
              </div>
            </form>
          ) : null}
          {activeTool === 'consult' ? (
            <div data-testid="consult-menu" className="flex flex-wrap gap-2">
              {consultSpecialties.map((specialty) => (
                <button
                  key={specialty}
                  type="button"
                  className="h-8 rounded-md border border-[#cdd8d8] bg-white px-3 text-xs font-bold capitalize disabled:text-[#87949b]"
                  disabled={!aiReady || encounter.busy}
                  onClick={() => void sendQuickTurn(`Call ${specialty} consult. Please review the patient and give recommendations based on the current ED presentation, vitals, and resulted studies.`)}
                >
                  {specialty}
                </button>
              ))}
              {!aiReady ? <span className="self-center text-xs font-semibold text-[#7f1d1d]">Connect AI to call a consultant.</span> : null}
            </div>
          ) : null}
          {activeTool === 'more' ? (
            <div data-testid="more-actions-menu" className="flex flex-wrap gap-2">
              <button type="button" className="h-8 rounded-md border border-[#cdd8d8] bg-white px-3 text-xs font-bold disabled:text-[#87949b]" disabled={!aiReady || encounter.busy} onClick={() => void sendQuickTurn('Nurse, please reassess the patient and report current status.')}>
                Nurse status
              </button>
              <button type="button" className="h-8 rounded-md border border-[#cdd8d8] bg-white px-3 text-xs font-bold disabled:text-[#87949b]" disabled={!aiReady || encounter.busy} onClick={() => void sendQuickTurn('How is your pain right now?')}>
                Pain update
              </button>
              <button type="button" className="h-8 rounded-md border border-[#cdd8d8] bg-white px-3 text-xs font-bold" onClick={() => { encounter.setChatDraft(''); setActiveTool(null); }}>
                Clear draft
              </button>
              {!aiReady ? <span className="self-center text-xs font-semibold text-[#7f1d1d]">Connect AI for dialogue actions.</span> : null}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {messages.length ? (
          <div className="grid gap-3">
            {messages.map((message, index) => (
              <MessageBubble key={`${message.elapsed_minutes}-${index}`} message={message} />
            ))}
          </div>
        ) : (
          <div className="grid h-full place-items-center rounded-md border border-dashed border-[#cdd8d8] bg-[#fbfcfc] text-sm font-semibold text-[#607078]">
            No conversation yet.
          </div>
        )}
      </div>
      <form
        data-testid="chat-composer"
        className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-t border-[#e4e9e9] p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void encounter.sendFreeText();
        }}
      >
        <input
          data-testid="chat-input"
          value={encounter.chatDraft}
          onChange={(event) => encounter.setChatDraft(event.target.value)}
          placeholder={aiReady ? 'Ask, examine, or call a consult...' : 'Connect AI to start the conversation...'}
          disabled={!aiReady || encounter.busy}
          className="h-11 min-w-0 rounded-md border border-[#cdd8d8] px-3 text-sm outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/20"
        />
        <button data-testid="chat-send" type="submit" className="inline-flex h-11 items-center rounded-md bg-[#0f766e] px-4 text-sm font-extrabold text-white disabled:bg-[#dce4e4]" disabled={!aiReady || encounter.busy}>
          Send
        </button>
      </form>
    </section>
  );
}

function MessageBubble({ message }: { message: TranscriptMessage }) {
  const isStudent = message.speaker === 'student';
  const isResult = message.speaker === 'results';
  const isNote = message.metadata?.type === 'clinical_note';
  const tone = isStudent
    ? isNote ? 'border-[#d7dfdf] bg-[#fbfcfc]' : 'border-[#cdd8d8] bg-[#fbfcfc]'
    : isResult
      ? 'border-[#c8e3dd] bg-[#f2faf7]'
      : 'border-[#dfe7e7] bg-white';
  return (
    <article className={`grid gap-1 rounded-md border p-3 ${tone}`}>
      <div className="flex items-center justify-between gap-3 text-xs font-bold text-[#607078]">
        <span>{labelForMessage(message)}</span>
        <span>{formatClock(message.elapsed_minutes)}</span>
      </div>
      <p className="m-0 whitespace-pre-wrap text-sm leading-6 text-[#27313a]">{message.text}</p>
    </article>
  );
}

function StructuredActionsPanel() {
  const [activeTab, setActiveTab] = React.useState<'orders' | 'exam'>('orders');

  return (
    <section className="grid min-h-0 min-w-0 grid-rows-[auto_auto_minmax(0,1fr)] rounded-lg border border-[#d7dfdf] bg-white">
      <InterventionChips />
      <div className="flex flex-wrap gap-5 border-b border-[#e4e9e9] px-4 text-sm font-bold">
        {([
          ['orders', 'Orders & Results'],
          ['exam', 'Physical Exam']
        ] as Array<['orders' | 'exam', string]>).map(([id, label]) => (
          <button
            key={id}
            type="button"
            data-testid={`structured-tab-${id}`}
            onClick={() => setActiveTab(id)}
            className={`border-x-0 border-t-0 border-b-2 bg-transparent px-0 pb-3 pt-3 outline-none focus-visible:ring-2 focus-visible:ring-[#0f766e]/20 ${activeTab === id ? 'border-[#0f766e] text-[#0f5f58]' : 'border-transparent text-[#26323a]'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid min-h-0 min-w-0 overflow-hidden p-3">
        {activeTab === 'orders' ? <OrderPanel /> : <ExamPanel />}
      </div>
    </section>
  );
}

function ExamPanel() {
  const encounter = useEncounter();
  const snapshot = encounter.session?.snapshot;
  const [regionFilter, setRegionFilter] = React.useState('all');
  const [typeFilter, setTypeFilter] = React.useState('all');
  const performed = (snapshot?.performed_exams || encounter.session?.state.performed_exams || []) as ExamRecord[];
  const regions = React.useMemo(() => uniqueSorted(encounter.examCatalog.map((item) => item.region)), [encounter.examCatalog]);
  const maneuverTypes = React.useMemo(() => uniqueSorted(encounter.examCatalog.map((item) => item.maneuver_type)), [encounter.examCatalog]);
  const visibleExams = encounter.examResults
    .filter((item) => regionFilter === 'all' || item.region === regionFilter)
    .filter((item) => typeFilter === 'all' || item.maneuver_type === typeFilter)
    .slice(0, 14);
  const latestFindings = [...performed].reverse();

  return (
    <section className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-[#d7dfdf] bg-white" data-testid="exam-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4e9e9] px-4 py-3">
        <div className="flex items-center gap-2">
          <Stethoscope size={19} weight="bold" />
          <h2 className="m-0 text-base font-extrabold">Physical Exam</h2>
        </div>
        <span className="rounded-md bg-[#eef2f2] px-2 py-1 text-xs font-extrabold text-[#52636b]">{performed.length} findings</span>
      </div>
      <div className="grid min-h-0 min-w-0 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(240px,290px)_minmax(0,1fr)]">
        <aside className="min-h-0 min-w-0 overflow-auto border-r border-[#e4e9e9]">
          <div className="grid gap-3 border-b border-[#e4e9e9] p-3">
            <strong className="text-sm">Exam Search</strong>
            <label className="relative block">
              <MagnifyingGlass size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#607078]" />
              <input
                data-testid="exam-search"
                value={encounter.examQuery}
                onChange={(event) => void encounter.searchExams(event.target.value)}
                placeholder="Search abdomen, lungs, pulses..."
                disabled={encounter.busy}
                className="h-10 w-full rounded-md border border-[#cdd8d8] pl-9 pr-3 text-sm outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/20"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {['all', ...regions].map((region) => (
                <button
                  key={region}
                  type="button"
                  className={`rounded-md border px-2 py-1 text-xs font-bold capitalize ${regionFilter === region ? 'border-[#0f766e] bg-[#eef8f5] text-[#0f5f58]' : 'border-[#cdd8d8] bg-white text-[#26323a]'}`}
                  onClick={() => setRegionFilter(region)}
                >
                  {region === 'all' ? 'All' : regionLabel(region)}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {['all', ...maneuverTypes].map((maneuverType) => (
                <button
                  key={maneuverType}
                  type="button"
                  className={`rounded-md border px-2 py-1 text-xs font-bold capitalize ${typeFilter === maneuverType ? 'border-[#0f766e] bg-[#eef8f5] text-[#0f5f58]' : 'border-[#cdd8d8] bg-white text-[#26323a]'}`}
                  onClick={() => setTypeFilter(maneuverType)}
                >
                  {maneuverType}
                </button>
              ))}
            </div>
          </div>
          <div className="grid content-start gap-1.5 p-3" data-testid="exam-search-results">
            {visibleExams.length ? visibleExams.map((exam) => (
              <ExamManeuverButton key={exam.id} exam={exam} disabled={encounter.busy} onClick={() => void encounter.performExam(exam.id)} />
            )) : (
              <div className="rounded-md border border-dashed border-[#cdd8d8] bg-[#fbfcfc] p-3 text-sm font-semibold text-[#607078]">No exam maneuvers match.</div>
            )}
          </div>
        </aside>
        <section className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-[#fbfcfc]">
          <div className="flex items-center justify-between gap-3 border-b border-[#e4e9e9] bg-white px-4 py-3">
            <strong className="text-sm">Findings</strong>
            <span className="text-xs font-bold text-[#607078]">{latestFindings.length} recorded</span>
          </div>
          <div className="min-h-0 overflow-auto p-3" data-testid="exam-findings-list">
            {latestFindings.length ? (
              <div className="grid gap-2">
                {latestFindings.map((record, index) => (
                  <article key={`${record.maneuver_id}-${record.performed_at_min}-${index}`} className="rounded-md border border-[#dfe7e7] bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <strong className="block text-sm">{record.display_name}</strong>
                        <span className="text-xs font-semibold capitalize text-[#607078]">{regionLabel(record.region)} - {record.maneuver_type}</span>
                      </div>
                      <span className="text-xs font-bold text-[#607078]">{formatClock(record.performed_at_min)}</span>
                    </div>
                    <p className="m-0 mt-2 whitespace-pre-wrap text-sm leading-6 text-[#27313a]">{record.finding}</p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="grid h-full min-h-[220px] place-items-center rounded-md border border-dashed border-[#cdd8d8] bg-white p-4 text-center text-sm font-semibold text-[#607078]">
                Choose a physical exam maneuver to record source-scoped findings.
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

function ExamManeuverButton({ exam, disabled, onClick }: { exam: ExamManeuver; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="grid min-h-[48px] gap-0.5 rounded-md border border-[#dfe7e7] bg-white px-3 py-2 text-left hover:border-[#0f766e] disabled:text-[#87949b]"
    >
      <strong className="text-sm text-[#17232b]">{exam.name}</strong>
      <span className="text-xs capitalize text-[#607078]">{regionLabel(exam.region)} - {exam.maneuver_type}</span>
    </button>
  );
}

function InterventionChips() {
  const encounter = useEncounter();
  const interventions = [
    ['cardiac_monitor', 'Monitor'],
    ['oxygen', 'O2'],
    ['iv_access', 'IV access'],
    ['iv_fluids', 'Fluids'],
    ['analgesia', 'Analgesia']
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[#e4e9e9] px-4 py-3">
      <div className="mr-1 flex items-center gap-2 text-sm font-extrabold">
        <FirstAidKit size={18} weight="bold" />
        Interventions
      </div>
      {interventions.map(([id, label]) => (
        <button
          key={id}
          data-testid={`quick-${id}`}
          type="button"
          onClick={() => void encounter.applyIntervention(id)}
          disabled={encounter.busy}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-[#cdd8d8] px-3 text-sm font-bold disabled:text-[#87949b]"
        >
          <Plus size={15} /> {label}
        </button>
      ))}
    </div>
  );
}

type OrderResultItem = {
  order_id: string;
  display_name: string;
  order_type: string;
  status: OrderRecord['status'];
  ordered_at_min?: number;
  result_due_at_min?: number;
  result?: ResultBundle | null;
  unavailable_reason?: string | null;
};

type OrderTypeFilter = 'all' | 'lab' | 'imaging' | 'study' | 'medication';

function OrderPanel() {
  const encounter = useEncounter();
  const snapshot = encounter.session?.snapshot;
  const [orderFilter, setOrderFilter] = React.useState<OrderTypeFilter>('all');
  const activeOrders = snapshot?.active_orders || [];
  const archivedResults = snapshot?.resulted_orders || [];
  const orderItems = React.useMemo<OrderResultItem[]>(() => {
    const activeIds = new Set(activeOrders.map((order) => order.order_id));
    const archived = archivedResults
      .filter((result) => !activeIds.has(result.order_id))
      .map((result) => ({
        order_id: result.order_id,
        display_name: result.display_name,
        order_type: 'result',
        status: 'resulted' as const,
        result
      }));
    return [...activeOrders, ...archived];
  }, [activeOrders, archivedResults]);
  const visibleOrderItems = React.useMemo(() => orderItems.filter(isDiagnosticOrderItem), [orderItems]);
  const visibleOrderKey = visibleOrderItems.map((item) => `${item.order_id}:${item.status}`).join('|');
  const [selectedResultId, setSelectedResultId] = React.useState('');

  React.useEffect(() => {
    if (!visibleOrderItems.length) {
      if (selectedResultId) setSelectedResultId('');
      return;
    }
    const latest = visibleOrderItems[visibleOrderItems.length - 1];
    if (latest && latest.order_id !== selectedResultId) {
      setSelectedResultId(latest.order_id);
    }
  }, [visibleOrderKey]);

  const selectedResult = visibleOrderItems.find((item) => item.order_id === selectedResultId) || visibleOrderItems[0];
  const pendingCount = visibleOrderItems.filter((item) => item.status === 'ordered' || item.status === 'resulting').length;
  const resultedCount = visibleOrderItems.filter((item) => item.status === 'resulted').length;
  const unavailableCount = visibleOrderItems.filter((item) => item.status === 'unavailable').length;
  const pendingOrders = visibleOrderItems.filter((item) => item.status === 'ordered' || item.status === 'resulting');
  const completedOrders = visibleOrderItems.filter((item) => item.status === 'resulted' || item.status === 'unavailable');
  const hasOrderSearchQuery = Boolean(encounter.orderQuery.trim());
  const filteredCatalog = encounter.orderResults
    .filter((order) => hasOrderSearchQuery || orderFilter === 'all' || order.type === orderFilter)
    .slice(0, 7);

  return (
    <section className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-[#d7dfdf] bg-white">
      <div className="grid border-b border-[#e4e9e9]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <Flask size={19} weight="bold" />
            <h2 className="m-0 text-base font-extrabold" aria-label="Orders">Orders & Results</h2>
          </div>
          <div className="flex items-center gap-2 text-xs font-extrabold">
            <span className="rounded-md bg-[#eef2f2] px-2 py-1 text-[#52636b]">{pendingCount} pending</span>
            <span className="rounded-md bg-[#eaf6f3] px-2 py-1 text-[#0f5f58]">{resultedCount} resulted</span>
            <span className="rounded-md bg-[#fff1f1] px-2 py-1 text-[#7f1d1d]">{unavailableCount} unavailable</span>
          </div>
        </div>
      </div>
      <div className="grid min-h-0 min-w-0 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(240px,290px)_minmax(0,1fr)]">
        <aside className="min-h-0 min-w-0 overflow-auto border-r border-[#e4e9e9]">
          <div className="grid gap-3 border-b border-[#e4e9e9] p-3">
            <strong className="text-sm">Order Search</strong>
            <label className="relative block">
              <MagnifyingGlass size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#607078]" />
              <input
                data-testid="order-search"
                value={encounter.orderQuery}
                onChange={(event) => void encounter.searchOrders(event.target.value)}
                placeholder="Search labs, imaging, ECG, meds..."
                disabled={encounter.busy}
                className="h-10 w-full rounded-md border border-[#cdd8d8] pl-9 pr-3 text-sm outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/20"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {([
                ['all', 'All'],
                ['lab', 'Labs'],
                ['imaging', 'Imaging'],
                ['study', 'Cardiac'],
                ['medication', 'Medications']
              ] as Array<[OrderTypeFilter, string]>).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`rounded-md border px-2 py-1 text-xs font-bold ${orderFilter === id ? 'border-[#2563eb] bg-[#edf4ff] text-[#1555c0]' : 'border-[#cdd8d8] bg-white text-[#26323a]'}`}
                  onClick={() => setOrderFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid content-start gap-1.5 p-3" data-testid="order-search-results">
            {filteredCatalog.map((order) => (
              <button
                type="button"
                key={order.id}
                onClick={() => void encounter.placeOrder(order.id)}
                disabled={encounter.busy}
                className="grid min-h-[44px] gap-0.5 rounded-md border border-[#dfe7e7] bg-white px-3 py-2 text-left hover:border-[#0f766e] disabled:text-[#87949b]"
              >
                <strong className="text-sm text-[#17232b]">{order.name}</strong>
                <span className="text-xs text-[#607078]">{order.type} - {order.result_delay_min} min</span>
              </button>
            ))}
          </div>
          <div className="grid gap-2 border-t border-[#e4e9e9] p-3" data-testid="active-orders">
            <OrderListSection title="Active Orders" orders={pendingOrders} selectedId={selectedResult?.order_id} onSelect={setSelectedResultId} empty="No active orders." />
            <details className="rounded-md border border-[#dfe7e7] bg-white" open>
              <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm font-extrabold">
                Completed / Old Orders
                <span className="rounded-md bg-[#eef2f2] px-2 py-1 text-xs text-[#52636b]">{completedOrders.length}</span>
              </summary>
              <div className="grid max-h-[100px] content-start gap-2 overflow-auto p-2 pt-0">
                {completedOrders.length ? completedOrders.map((order) => (
                  <OrderQueueItem key={order.order_id} order={order} selected={selectedResult?.order_id === order.order_id} onSelect={() => setSelectedResultId(order.order_id)} />
                )) : (
                  <div className="rounded-md border border-dashed border-[#cdd8d8] bg-[#fbfcfc] p-3 text-sm font-semibold text-[#607078]">No completed orders.</div>
                )}
              </div>
            </details>
          </div>
        </aside>
        <ResultsWorkspace
          items={visibleOrderItems}
          selectedItem={selectedResult}
          onSelect={setSelectedResultId}
        />
      </div>
    </section>
  );
}

function OrderQueueItem({ order, selected, onSelect }: { order: OrderResultItem; selected: boolean; onSelect: () => void }) {
  const canOpen = true;
  const isDefaultEcg = isDefaultEcgResult(order.display_name, order.result);
  const isEcg = isEcgDisplayName(order.display_name);
  return (
    <button
      type="button"
      onClick={canOpen ? onSelect : undefined}
      disabled={!canOpen}
      className={`grid gap-2 rounded-md border p-3 text-left disabled:cursor-default ${selected ? 'border-[#0f766e] bg-[#f3faf8]' : 'border-[#dfe7e7] bg-white'} ${canOpen ? 'hover:border-[#0f766e]' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <strong className="text-sm">{order.display_name}</strong>
        <span className={`rounded-md px-2 py-1 text-xs font-extrabold ${statusClass(order.status)}`}>{order.status}</span>
      </div>
      <p className="m-0 text-xs leading-5 text-[#607078]">{orderStatusSummary(order)}</p>
      {order.result ? <p className="m-0 text-xs font-bold leading-5 text-[#52636b]">{resultDisplayLabel(order.display_name, order.result)}</p> : null}
      {order.result ? <ResultQualityMarkers result={order.result} compact /> : null}
      {order.result?.values.length && !isDefaultEcg && !isEcg ? <ResultValueSummary result={order.result} /> : null}
      {order.unavailable_reason ? <p className="m-0 text-xs leading-5 text-[#7f1d1d]">{order.unavailable_reason}</p> : null}
    </button>
  );
}

function OrderListSection({
  title,
  orders,
  selectedId,
  onSelect,
  empty
}: {
  title: string;
  orders: OrderResultItem[];
  selectedId?: string;
  onSelect: (orderId: string) => void;
  empty: string;
}) {
  return (
    <section className="grid min-h-0 gap-2 overflow-hidden">
      <strong className="text-sm">{title}</strong>
      <div className="grid min-h-0 content-start gap-2 overflow-auto">
        {orders.length ? orders.map((order) => (
          <OrderQueueItem key={order.order_id} order={order} selected={selectedId === order.order_id} onSelect={() => onSelect(order.order_id)} />
        )) : (
          <div className="rounded-md border border-dashed border-[#cdd8d8] bg-[#fbfcfc] p-3 text-sm font-semibold text-[#607078]">{empty}</div>
        )}
      </div>
    </section>
  );
}

function ResultValueSummary({ result }: { result: ResultBundle }) {
  return (
    <div className="grid gap-1 text-xs text-[#31534f]">
      {result.values.slice(0, 3).map((value) => (
        <div key={value.name} className="flex justify-between gap-3">
          <span>{value.name}</span>
          <strong>{value.value}{value.unit ? ` ${value.unit}` : ''}</strong>
        </div>
      ))}
    </div>
  );
}

function ResultsWorkspace({
  items,
  selectedItem,
  onSelect
}: {
  items: OrderResultItem[];
  selectedItem?: OrderResultItem;
  onSelect: (orderId: string) => void;
}) {
  const [viewerItem, setViewerItem] = React.useState<OrderResultItem | null>(null);
  const visibleItems = items;
  const selected = selectedItem && visibleItems.some((item) => item.order_id === selectedItem.order_id)
    ? selectedItem
    : visibleItems[0];

  return (
    <>
      <section className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-[#fbfcfc]" data-testid="result-detail">
        <div className="flex items-center justify-between gap-3 border-b border-[#e4e9e9] bg-white px-4 py-3">
          <strong className="text-sm">Results</strong>
          <span className="text-xs font-bold text-[#607078]">{visibleItems.length} available</span>
        </div>
        <div className="min-h-0 overflow-auto p-3" data-testid="resulted-orders">
          {selected ? (
            <div className="grid gap-3">
              <ResultReportCard item={selected} primary onOpenViewer={setViewerItem} />
              {visibleItems.filter((item) => item.order_id !== selected.order_id).map((item) => (
                <button key={item.order_id} type="button" onClick={() => onSelect(item.order_id)} className="text-left">
                  <ResultReportCard item={item} />
                </button>
              ))}
            </div>
          ) : (
            <div className="grid h-full min-h-[240px] place-items-center rounded-md border border-dashed border-[#cdd8d8] bg-white p-4 text-center text-sm font-semibold text-[#607078]">
              Order a lab, ECG, or imaging study to populate this result viewer.
            </div>
          )}
        </div>
      </section>
      {viewerItem ? (
        <ResultViewerModal item={viewerItem} onClose={() => setViewerItem(null)} />
      ) : null}
    </>
  );
}

function ResultReportCard({
  item,
  primary = false,
  onOpenViewer
}: {
  item: OrderResultItem;
  primary?: boolean;
  onOpenViewer?: (item: OrderResultItem) => void;
}) {
  const isImaging = item.order_type === 'imaging' || /ct|x-ray|xray|ultrasound|mri/i.test(item.display_name);
  const isEcg = isEcgDisplayName(item.display_name);
  const artifactKind: 'ecg' | 'imaging' | null = isEcg ? 'ecg' : isImaging ? 'imaging' : null;
  const result = item.result;
  const hasSourceBackedResult = item.status === 'resulted' && Boolean(result);
  const isDefaultEcg = isDefaultEcgResult(item.display_name, result);
  const showSourceEcgTracing = Boolean(primary && isEcg && hasSourceBackedResult && !isDefaultEcg);
  const showImagingPreview = Boolean(primary && artifactKind === 'imaging' && hasSourceBackedResult);
  const canOpenArtifact = Boolean(artifactKind && hasSourceBackedResult && onOpenViewer);
  const pendingDue = item.result_due_at_min !== undefined ? ` Due at ${formatClock(item.result_due_at_min)}.` : '';

  return (
    <article data-testid={primary ? 'primary-result-card' : 'secondary-result-card'} className={`overflow-hidden rounded-md border bg-white ${primary ? 'border-[#cdd8d8]' : 'border-[#dfe7e7]'}`}>
      <div className="flex items-center justify-between gap-3 border-b border-[#eef2f2] px-3 py-2">
        <div className="min-w-0">
          <strong className="block truncate text-sm">{item.display_name}</strong>
          <span className="text-xs font-semibold text-[#607078]">
            {hasSourceBackedResult ? resultDisplayLabel(item.display_name, result) : item.status === 'unavailable' ? 'source result unavailable' : 'awaiting result'}
          </span>
          {hasSourceBackedResult && result ? <ResultQualityMarkers result={result} /> : null}
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-md px-2 py-1 text-xs font-extrabold ${statusClass(item.status)}`}>{titleCase(item.status)}</span>
          {primary ? <span className="text-xs font-bold text-[#607078]">{formatMinuteStamp(item.result_due_at_min ?? item.ordered_at_min ?? 0)}</span> : null}
        </div>
      </div>
      <div className={`grid gap-3 p-3 ${showImagingPreview ? 'sm:grid-cols-[170px_minmax(0,1fr)]' : ''}`}>
        {isDefaultEcg && result ? (
          <DefaultEcgTracing compact={!primary} />
        ) : showSourceEcgTracing ? (
          <SourceEcgTracing orderId={item.order_id} compact={!primary} />
        ) : showImagingPreview && result ? (
          <ResultArtifactPreview kind="imaging" result={result} />
        ) : null}
        {!isDefaultEcg && !isEcg ? <div className="min-w-0">
          {item.status === 'unavailable' ? (
            <div className="rounded-md border border-[#f0c2c2] bg-[#fff7f7] p-3 text-sm font-semibold leading-6 text-[#7f1d1d]">
              {item.unavailable_reason || 'No source-recorded result is available for this order; no value was fabricated.'}
            </div>
          ) : result?.values.length ? (
            <ResultTable result={result} />
          ) : null}
          {result?.narrative ? (
            <ResultNarrative narrative={result.narrative} compact={!primary} className="mt-2" />
          ) : null}
          {!result && item.status !== 'unavailable' ? (
            <div className="rounded-md border border-dashed border-[#cdd8d8] bg-[#fbfcfc] p-3 text-sm font-semibold leading-6 text-[#607078]">
              Result pending.{pendingDue} The result will release when the delay elapses.
            </div>
          ) : null}
        </div> : null}
        {isEcg && !result && item.status !== 'unavailable' ? (
          <div className="rounded-md border border-dashed border-[#cdd8d8] bg-[#fbfcfc] p-3 text-sm font-semibold leading-6 text-[#607078]">
            Result pending.{pendingDue} The tracing will release when the delay elapses.
          </div>
        ) : null}
        {isEcg && item.status === 'unavailable' ? (
          <div className="rounded-md border border-[#f0c2c2] bg-[#fff7f7] p-3 text-sm font-semibold leading-6 text-[#7f1d1d]">
            {item.unavailable_reason || 'ECG tracing is unavailable.'}
          </div>
        ) : null}
      </div>
      {primary ? (
        <div className="flex items-center gap-2 border-t border-[#eef2f2] px-3 py-2">
          {result ? (
            <button
              type="button"
              className="inline-flex h-8 items-center gap-2 rounded-md border border-[#cdd8d8] px-2 text-xs font-bold"
              onClick={() => saveResultReport(item)}
            >
              <DownloadSimple size={14} /> Save
            </button>
          ) : null}
          {canOpenArtifact ? (
            <button
              type="button"
              data-testid="open-result-viewer"
              className="ml-auto inline-flex h-8 items-center gap-2 rounded-md border border-[#cdd8d8] px-2 text-xs font-bold"
              title={artifactKind === 'ecg' ? 'Open ECG viewer' : 'Open full report'}
              onClick={() => onOpenViewer?.(item)}
            >
              <ArrowsOut size={14} /> {artifactKind === 'ecg' ? 'Open ECG Viewer' : 'Open Full Report'}
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function ResultArtifactPreview({ kind, result }: { kind: 'imaging'; result: ResultBundle }) {
  const reference = result.source_reference || {};
  const label = 'Imaging report';
  const charttime = typeof reference.charttime === 'string' ? reference.charttime : null;
  const studyId = typeof reference.study_id === 'string' || typeof reference.study_id === 'number' ? String(reference.study_id) : null;
  const noteId = typeof reference.note_id === 'string' || typeof reference.note_id === 'number' ? String(reference.note_id) : null;

  return (
    <div className="grid content-start gap-2 rounded-md border border-[#dfe7e7] bg-[#fbfcfc] p-3 text-xs text-[#52636b]">
      <strong className="text-sm text-[#17232b]">{label}</strong>
      <span>{sourceLabel(result)}</span>
      {charttime ? <span>Charted {formatSourceTimestamp(charttime)}</span> : null}
      {studyId || noteId ? <span>{studyId ? `Study ${studyId}` : `Note ${noteId}`}</span> : null}
    </div>
  );
}

function DefaultEcgTracing({ compact = false, expanded = false }: { compact?: boolean; expanded?: boolean }) {
  const gridId = React.useId().replace(/:/g, '');
  const smallGridId = `ecg-small-grid-${gridId}`;
  const largeGridId = `ecg-large-grid-${gridId}`;
  const leads = [
    ['I', 'aVR', 'V1', 'V4'],
    ['II', 'aVL', 'V2', 'V5'],
    ['III', 'aVF', 'V3', 'V6'],
    ['II', '', '', '']
  ];
  const rowHeight = compact ? 58 : expanded ? 96 : 74;
  const width = 960;
  const visibleRowCount = compact ? 2 : leads.length;
  const height = visibleRowCount * rowHeight;
  const cellWidth = width / 4;

  return (
    <figure
      data-testid="default-ecg-tracing"
      className={`m-0 overflow-hidden rounded-md border border-[#ef9b9b] bg-[#fffafa] ${expanded ? 'min-h-[420px]' : compact ? 'min-h-[120px]' : 'min-h-[260px]'}`}
    >
      <svg viewBox={`0 0 ${width} ${height}`} className={`block w-full ${expanded ? 'h-[420px]' : compact ? 'h-[128px]' : 'h-[280px]'}`} role="img" aria-label="12-lead ECG tracing">
        <defs>
          <pattern id={smallGridId} width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M 8 0 L 0 0 0 8" fill="none" stroke="#f5b4b4" strokeWidth="0.8" />
          </pattern>
          <pattern id={largeGridId} width="40" height="40" patternUnits="userSpaceOnUse">
            <rect width="40" height="40" fill={`url(#${smallGridId})`} />
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e97878" strokeWidth="1.4" />
          </pattern>
        </defs>
        <rect width={width} height={height} fill={`url(#${largeGridId})`} />
        {leads.map((row, rowIndex) => row.map((lead, colIndex) => {
          if (compact && rowIndex > 1) return null;
          if (rowIndex === 3 && colIndex > 0) return null;
          if (!lead && rowIndex !== 3) return null;
          const x = rowIndex === 3 ? 0 : colIndex * cellWidth;
          const y = rowIndex * rowHeight;
          const traceWidth = rowIndex === 3 ? width : cellWidth;
          const points = buildDefaultEcgPoints(traceWidth, rowHeight, rowIndex * 4 + colIndex);
          return (
            <g key={`${rowIndex}-${colIndex}`} transform={`translate(${x} ${y})`}>
              {lead ? <text x="18" y={rowHeight * 0.43} fill="#4f2323" fontSize={compact ? 16 : 19} fontWeight="700">{lead}</text> : null}
              <polyline points={points} fill="none" stroke="#34444f" strokeWidth={compact ? 1.4 : 1.7} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          );
        }))}
      </svg>
    </figure>
  );
}

function SourceEcgTracing({ orderId, compact = false, expanded = false }: { orderId: string; compact?: boolean; expanded?: boolean }) {
  const encounter = useEncounter();
  const { session } = encounter;
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    setFailed(false);
  }, [session?.session_id, orderId]);
  const result = session?.snapshot.active_orders.find((order) => order.order_id === orderId)?.result
    || session?.snapshot.resulted_orders.find((item) => item.order_id === orderId)
    || null;
  const staticSvgUrl = typeof result?.source_reference?.static_ecg_svg_url === 'string' ? result.source_reference.static_ecg_svg_url : '';
  if (!staticSvgUrl) return <DefaultEcgTracing compact={compact} expanded={expanded} />;
  const src = staticSvgUrl;
  if (!src || failed) {
    return (
      <div
        data-testid="source-ecg-unavailable"
        className="grid min-h-[220px] place-items-center rounded-md border border-dashed border-[#cdd8d8] bg-[#fbfcfc] p-4 text-center text-sm font-semibold text-[#607078]"
      >
        ECG tracing unavailable.
      </div>
    );
  }
  return (
    <figure
      data-testid="source-ecg-tracing"
      className={`m-0 overflow-auto rounded-md border border-[#d7dfdf] bg-white ${expanded ? 'min-h-[520px]' : compact ? 'min-h-[150px]' : 'min-h-[300px]'}`}
    >
      <img
        src={src}
        alt="12-lead ECG tracing"
        className={`block min-w-[920px] w-full ${expanded ? 'h-auto' : compact ? 'max-h-[190px] object-cover object-top' : 'h-auto'}`}
        onError={() => setFailed(true)}
      />
    </figure>
  );
}

function ResultViewerModal({ item, onClose }: { item: OrderResultItem; onClose: () => void }) {
  const result = item.result;
  if (!result) return null;
  const isEcg = isEcgDisplayName(item.display_name);
  const isDefaultEcg = isDefaultEcgResult(item.display_name, result);
  const reference = result.source_reference || {};
  const referenceEntries = isDefaultEcg ? [] : sourceReferenceDisplayEntries(reference);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" data-testid="result-viewer-modal" role="dialog" aria-modal="true" aria-label={`${item.display_name} viewer`}>
      <section className="grid max-h-[92vh] w-full max-w-5xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border border-[#cdd8d8] bg-white text-[#17232b] shadow-lg">
        <header className="flex items-start justify-between gap-3 border-b border-[#e4e9e9] px-4 py-3">
          <div className="min-w-0">
            <h2 className="m-0 truncate text-base font-extrabold">{item.display_name}</h2>
            <p className="m-0 mt-1 text-sm font-semibold text-[#607078]">{resultDisplayLabel(item.display_name, result)}</p>
            <ResultQualityMarkers result={result} />
          </div>
          <button type="button" className="rounded-md border border-[#cdd8d8] px-3 py-2 text-sm font-bold" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="min-h-0 overflow-auto p-4">
          {isDefaultEcg ? (
            <DefaultEcgTracing expanded />
          ) : isEcg ? (
            <SourceEcgTracing orderId={item.order_id} expanded />
          ) : null}
          {isEcg ? <EcgInterpretationEditor orderId={item.order_id} displayName={item.display_name} /> : null}
          {result.values.length && !isDefaultEcg && !isEcg ? <ResultTable result={result} /> : null}
          {result.narrative && !isDefaultEcg && !isEcg ? (
            <section className="mt-3">
              <h3 className="m-0 mb-2 text-sm font-extrabold">Report</h3>
              <ResultNarrative narrative={result.narrative} constrain={false} />
            </section>
          ) : null}
          {referenceEntries.length ? (
            <section className="mt-3 rounded-md border border-[#dfe7e7] bg-white p-3">
              <h3 className="m-0 mb-2 text-sm font-extrabold">Source Provenance</h3>
              <dl className="grid gap-2 text-sm sm:grid-cols-[170px_minmax(0,1fr)]">
                {referenceEntries.map(([key, value]) => (
                  <React.Fragment key={key}>
                    <dt className="font-bold text-[#52636b]">{humanizeKey(key)}</dt>
                    <dd className="m-0 min-w-0 break-words text-[#17232b]">{value}</dd>
                  </React.Fragment>
                ))}
              </dl>
            </section>
          ) : null}
        </div>
        <footer className="flex justify-end border-t border-[#e4e9e9] px-4 py-3">
          <button type="button" className="rounded-md bg-[#11191f] px-3 py-2 text-sm font-bold text-white" onClick={onClose}>
            Done
          </button>
        </footer>
      </section>
    </div>
  );
}

function EcgInterpretationEditor({ orderId, displayName }: { orderId: string; displayName: string }) {
  const encounter = useEncounter();
  const saved = encounter.session?.state.result_interpretations?.[orderId]?.text || '';
  const [draft, setDraft] = React.useState(saved);
  React.useEffect(() => {
    setDraft(saved);
  }, [saved, orderId]);
  const canSave = Boolean(draft.trim()) && draft.trim() !== saved.trim() && !encounter.busy;

  return (
    <section className="mt-3 grid gap-2 rounded-md border border-[#dfe7e7] bg-[#fbfcfc] p-3" data-testid="ecg-interpretation-editor">
      <label className="grid gap-2 text-sm font-extrabold text-[#26323a]">
        Your ECG interpretation
        <textarea
          data-testid="ecg-interpretation-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={4}
          placeholder="Rate, rhythm, axis, intervals, ST/T changes..."
          className="min-h-[104px] resize-y rounded-md border border-[#cdd8d8] bg-white p-3 text-sm font-normal leading-6 outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/20"
        />
      </label>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-[#607078]">{saved ? `${displayName} interpretation saved.` : ''}</span>
        <button
          type="button"
          data-testid="save-ecg-interpretation"
          className="h-9 rounded-md bg-[#0f766e] px-3 text-sm font-extrabold text-white disabled:bg-[#dce4e4] disabled:text-[#738088]"
          disabled={!canSave}
          onClick={() => void encounter.recordResultInterpretation(orderId, draft)}
        >
          Save interpretation
        </button>
      </div>
    </section>
  );
}

function resultDisplayLabel(displayName: string, result?: ResultBundle | null) {
  if (isEcgDisplayName(displayName)) {
    if (isSubjectLevelReference(result)) return 'ECG tracing (historical subject-level reference)';
    return 'ECG tracing';
  }
  return sourceLabel(result);
}

function sourceLabel(result?: ResultBundle | null) {
  if (isSimulatorDefaultResult(result)) return 'Result available';
  if (result?.source_reference?.encounter_link_status === 'subject_only') {
    return result?.source ? `Source: ${result.source} (subject-level reference)` : 'Subject-level source result';
  }
  return result?.source ? `Source: ${result.source}` : 'Source-recorded result';
}

function isDefaultEcgResult(displayName: string, result?: ResultBundle | null) {
  return isEcgDisplayName(displayName) && isSimulatorDefaultResult(result);
}

function isEcgDisplayName(displayName: string) {
  return /ecg|ekg|12-lead/i.test(displayName);
}

function isSimulatorDefaultResult(result?: ResultBundle | null) {
  return result?.source === 'simulator-default';
}

function isSubjectLevelReference(result?: ResultBundle | null) {
  const reference = result?.source_reference || {};
  return reference.encounter_link_status === 'subject_only' || reference.requires_manual_verification === true;
}

function ResultQualityMarkers({ result, compact = false }: { result: ResultBundle; compact?: boolean }) {
  const markers = resultQualityMarkers(result);
  if (!markers.length) return null;
  return (
    <div className={`flex flex-wrap gap-1 ${compact ? '' : 'mt-1'}`} data-testid="result-quality-markers">
      {markers.map((marker) => (
        <span
          key={marker.id}
          className={`rounded-sm border px-1.5 font-extrabold ${compact ? 'text-[10px] leading-4' : 'text-[11px] leading-5'} ${marker.className}`}
          title={marker.title}
          data-testid={`result-marker-${marker.id}`}
        >
          {marker.label}
        </span>
      ))}
    </div>
  );
}

function resultQualityMarkers(result: ResultBundle) {
  const markers: Array<{ id: string; label: string; title: string; className: string }> = [];
  if (isSimulatorDefaultResult(result)) {
    markers.push({
      id: 'default',
      label: 'Default',
      title: 'SIMULATOR DEFAULT.',
      className: 'border-[#e6c6a0] bg-[#fff8e8] text-[#7c4a00]'
    });
  }
  if (isSubjectLevelReference(result)) {
    markers.push({
      id: 'historical-reference',
      label: 'Historical',
      title: 'This source is linked at the subject level and is not verified as a same-encounter ED result.',
      className: 'border-[#e6c6a0] bg-[#fff8e8] text-[#7c4a00]'
    });
  }
  if (isAllNegativeResult(result)) {
    markers.push({
      id: 'all-negative',
      label: 'All negative',
      title: 'All structured values are normal/negative, or the narrative reads as no acute abnormality.',
      className: 'border-[#bcd9c1] bg-[#edf8ef] text-[#1d6b34]'
    });
  }
  return markers;
}

function isAllNegativeResult(result: ResultBundle) {
  const values = result.values || [];
  if (values.length) return values.every(isNegativeOrNormalValue);
  const narrative = normalizeMarkerText(result.narrative || '');
  if (!narrative) return false;
  return NEGATIVE_RESULT_PATTERN.test(narrative) && !POSITIVE_RESULT_PATTERN.test(narrative);
}

function isNegativeOrNormalValue(value: ResultBundle['values'][number]) {
  const flag = String(value.flag || '').toLowerCase();
  if (flag && flag !== 'normal') return false;
  if (flag === 'normal') return true;
  return NEGATIVE_RESULT_PATTERN.test(normalizeMarkerText(`${value.name} ${value.value} ${value.reference_range || ''}`));
}

const NEGATIVE_RESULT_PATTERN = /\b(negative|absent|none|no acute|no evidence|no growth|not elevated|not detected|not identified|not visualized|within reference range|within normal|grossly normal|normal sinus rhythm)\b/;
const POSITIVE_RESULT_PATTERN = /\b(abnormal|critical|positive|elevated|high|low|ischemia|infarct|filling defect|wall thickening|obstruction|volvulus|effusion|fracture|hemorrhage)\b/;

function normalizeMarkerText(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function formatSourceTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function humanizeKey(key: string) {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const LOCAL_PATH_PROVENANCE_KEYS = new Set([
  'source_file',
  'metadata_file',
  'dictionary_file',
  'path',
  'path_hint',
  'source_root',
  'mimic_hosp_dir',
  'mimic_note_dir',
  'mimic_cxr_dir',
  'mimic_ecg_dir',
  'record_list_file',
  'waveform_base_path',
  'waveform_header_file',
  'waveform_data_file',
  'command',
  'sql'
]);

function sourceReferenceDisplayEntries(reference: Record<string, unknown>) {
  const entries: Array<[string, string]> = [];
  const append = (key: string, value: unknown) => {
    if (entries.length >= 12 || !isDisplayableSourceReferenceValue(key, value)) return;
    entries.push([key, String(value).trim()]);
  };

  Object.entries(reference).forEach(([key, value]) => {
    if (key === 'rows' && Array.isArray(value)) {
      value.slice(0, 3).forEach((row, index) => {
        if (!isPlainRecord(row)) return;
        Object.entries(row).forEach(([rowKey, rowValue]) => append(`row ${index + 1} ${rowKey}`, rowValue));
      });
      return;
    }
    if (isPlainRecord(value)) {
      Object.entries(value).forEach(([childKey, childValue]) => append(`${key} ${childKey}`, childValue));
      return;
    }
    append(key, value);
  });

  return entries;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isDisplayableSourceReferenceValue(key: string, value: unknown) {
  if (value === null || value === undefined || typeof value === 'object') return false;
  const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  if (
    LOCAL_PATH_PROVENANCE_KEYS.has(normalizedKey)
    || Array.from(LOCAL_PATH_PROVENANCE_KEYS).some((pathKey) => normalizedKey.endsWith(`_${pathKey}`))
  ) return false;
  const rendered = String(value).trim();
  return rendered !== '' && !looksLikeLocalPath(rendered);
}

function looksLikeLocalPath(value: string) {
  return /^[A-Za-z]:[\\/]/.test(value)
    || /^\\\\/.test(value)
    || /^\/(?:Users|home|mnt|var|tmp|opt)\//.test(value)
    || value.includes("read_csv_auto('")
    || value.includes('read_csv_auto("');
}

const REPORT_SECTION_PATTERN = /\b(FINAL REPORT|CLINICAL HISTORY|REASON FOR EXAM|EXAMINATION|INDICATION|COMPARISON|TECHNIQUE|FINDINGS|IMPRESSION|CONCLUSION|HISTORY|PROCEDURE|REPORT|EXAM)\s*:/gi;

function parseReportSections(narrative: string) {
  const text = normalizeReportText(narrative);
  if (!text) {
    return [{ heading: 'Report', paragraphs: ['No narrative result text available.'] }];
  }

  const matches = [...text.matchAll(REPORT_SECTION_PATTERN)];
  if (!matches.length) {
    return [{ heading: 'Report', paragraphs: splitReportParagraphs(text) }];
  }

  const sections: Array<{ heading: string; paragraphs: string[] }> = [];
  const preface = text.slice(0, matches[0].index || 0).trim();
  if (preface) {
    sections.push({ heading: 'Report', paragraphs: splitReportParagraphs(preface) });
  }

  matches.forEach((match, index) => {
    const heading = reportHeadingLabel(match[1] || 'Report');
    const bodyStart = (match.index || 0) + match[0].length;
    const bodyEnd = matches[index + 1]?.index ?? text.length;
    const body = text.slice(bodyStart, bodyEnd).trim();
    if (body) {
      sections.push({ heading, paragraphs: splitReportParagraphs(body) });
    }
  });

  return sections.length ? sections : [{ heading: 'Report', paragraphs: splitReportParagraphs(text) }];
}

function normalizeReportText(narrative: string) {
  return narrative
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitReportParagraphs(text: string) {
  const explicitParagraphs = text.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  if (explicitParagraphs.length > 1) return explicitParagraphs;

  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 260) return [normalized];

  const sentences = normalized.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g)?.map((sentence) => sentence.trim()).filter(Boolean);
  return sentences && sentences.length > 1 ? sentences : [normalized];
}

function reportHeadingLabel(value: string) {
  const normalized = value.toUpperCase();
  const labels: Record<string, string> = {
    'FINAL REPORT': 'Final Report',
    'CLINICAL HISTORY': 'Clinical History',
    'REASON FOR EXAM': 'Reason For Exam',
    EXAMINATION: 'Examination',
    INDICATION: 'Indication',
    COMPARISON: 'Comparison',
    TECHNIQUE: 'Technique',
    FINDINGS: 'Findings',
    IMPRESSION: 'Impression',
    CONCLUSION: 'Conclusion',
    HISTORY: 'History',
    PROCEDURE: 'Procedure',
    REPORT: 'Report',
    EXAM: 'Exam'
  };
  return labels[normalized] || humanizeKey(normalized.toLowerCase());
}

function saveResultReport(item: OrderResultItem) {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !item.result) return;
  const result = item.result;
  const isDefaultEcg = isDefaultEcgResult(item.display_name, result);
  const isEcg = isEcgDisplayName(item.display_name);
  const values = result.values.length && !isDefaultEcg && !isEcg
    ? [
        '',
        'Values',
        ...result.values.map((value) => {
          const unit = value.unit ? ` ${value.unit}` : '';
          const flag = value.flag ? ` (${value.flag})` : '';
          const reference = value.reference_range ? ` [ref ${value.reference_range}]` : '';
          return `${value.name}: ${value.value}${unit}${flag}${reference}`;
        })
      ]
    : [];
  const provenance = result.source_reference && !isDefaultEcg && !isEcg
    ? [
        '',
        'Source Provenance',
        ...sourceReferenceDisplayEntries(result.source_reference).map(([key, value]) => `${humanizeKey(key)}: ${value}`)
      ]
    : [];
  const text = [
    item.display_name,
    resultDisplayLabel(item.display_name, result),
    result.resulted_at_min !== undefined && result.resulted_at_min !== null ? `Released at: ${formatClock(result.resulted_at_min)}` : '',
    isEcg ? 'ECG tracing available in the simulation viewer.' : '',
    ...values,
    ...(result.narrative && !isDefaultEcg && !isEcg ? ['', 'Report', ...formatReportForDownload(result.narrative)] : []),
    ...provenance
  ].filter(Boolean).join('\n');
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${item.order_id}-result.txt`;
  link.click();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
}

function formatReportForDownload(narrative: string) {
  return parseReportSections(narrative).flatMap((section) => [
    '',
    section.heading,
    ...section.paragraphs
  ]);
}

function ResultNarrative({ narrative, compact = false, className = '', constrain = true }: { narrative: string; compact?: boolean; className?: string; constrain?: boolean }) {
  const sections = React.useMemo(() => parseReportSections(narrative), [narrative]);
  const scrollClass = constrain ? `${compact ? 'max-h-[140px]' : 'max-h-[360px]'} overflow-auto` : '';

  return (
    <div
      data-testid="result-report"
      className={`${className} ${scrollClass} rounded-md border border-[#dfe7e7] bg-white text-sm text-[#27313a]`}
    >
      <div className="divide-y divide-[#eef2f2]">
        {sections.map((section, index) => (
          <section key={`${section.heading || 'report'}-${index}`} className="grid gap-1 px-3 py-2.5 sm:grid-cols-[132px_minmax(0,1fr)]">
            <h4 className="m-0 text-xs font-extrabold leading-6 text-[#52636b]">{section.heading || 'Report'}</h4>
            <div className="grid gap-2 leading-6 text-[#27313a]">
              {section.paragraphs.map((paragraph, paragraphIndex) => (
                <p key={paragraphIndex} className="m-0 whitespace-pre-wrap">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function ResultTable({ result }: { result: ResultBundle }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-[#e4e9e9] text-left text-xs text-[#607078]">
          <th className="py-2 font-extrabold">Test</th>
          <th className="py-2 font-extrabold">Result</th>
          <th className="py-2 font-extrabold">Units</th>
          <th className="py-2 font-extrabold">Ref Range</th>
        </tr>
      </thead>
      <tbody>
        {result.values.map((value) => (
          <tr key={value.name} className="border-b border-[#eef2f2] last:border-b-0">
            <td className="py-2 font-semibold">{value.name}</td>
            <td className={`py-2 font-extrabold ${value.flag ? 'text-[#c22929]' : 'text-[#17232b]'}`}>{value.value}</td>
            <td className="py-2 text-[#52636b]">{value.unit || ''}</td>
            <td className="py-2 text-[#52636b]">{value.reference_range || ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CommitRail() {
  const encounter = useEncounter();
  const session = encounter.session;
  if (!session) return null;
  const soap = encounter.soapDraft;
  const canCommitSoap = Boolean(soap.assessment.trim() && soap.plan.trim());
  const lastEsi = session.state.esi_history.at(-1);

  return (
    <aside className="grid min-h-0 min-w-0 content-start gap-3 overflow-auto lg:col-span-2 min-[1500px]:col-span-1">
      <section className="rounded-lg border border-[#d7dfdf] bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <Warning size={18} weight="bold" />
          <h2 className="m-0 text-base font-extrabold">ESI</h2>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((level) => (
            <button
              key={level}
              data-testid={`esi-level-${level}`}
              type="button"
              className={`h-10 rounded-md border text-sm font-extrabold ${encounter.esiDraft === level ? 'border-[#0f766e] bg-[#0f766e] text-white' : 'border-[#cdd8d8] bg-white text-[#26323a]'}`}
              onClick={() => encounter.setEsiDraft(level)}
            >
              {level}
            </button>
          ))}
        </div>
        <textarea
          value={encounter.esiRationale}
          onChange={(event) => encounter.setEsiDraft(encounter.esiDraft, event.target.value)}
          rows={2}
          placeholder="Rationale"
          className="mt-3 w-full resize-none rounded-md border border-[#cdd8d8] p-3 text-sm outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/20"
        />
        <button data-testid="commit-esi" type="button" onClick={() => void encounter.commitEsi()} disabled={!encounter.esiDraft || encounter.busy} className="mt-3 h-10 w-full rounded-md bg-[#0f766e] text-sm font-extrabold text-white disabled:bg-[#dce4e4] disabled:text-[#738088]">
          {lastEsi ? `Revise ESI ${lastEsi.level}` : 'Commit ESI'}
        </button>
      </section>

      <section className="rounded-lg border border-[#d7dfdf] bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <ClipboardText size={18} weight="bold" />
          <h2 className="m-0 text-base font-extrabold">Differential</h2>
        </div>
        <textarea
          data-testid="differential-input"
          value={encounter.differentialDraft}
          onChange={(event) => encounter.setDifferentialDraft(event.target.value)}
          rows={4}
          placeholder="One diagnosis per line"
          className="w-full resize-none rounded-md border border-[#cdd8d8] p-3 text-sm outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/20"
        />
        <button data-testid="commit-differential" type="button" onClick={() => void encounter.commitDifferential()} disabled={!encounter.differentialDraft.trim() || encounter.busy} className="mt-3 h-10 w-full rounded-md border border-[#cdd8d8] text-sm font-extrabold disabled:text-[#87949b]">
          Commit Differential
        </button>
      </section>

      <section className="rounded-lg border border-[#d7dfdf] bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <NotePencil size={18} weight="bold" />
          <h2 className="m-0 text-base font-extrabold">SOAP</h2>
        </div>
        {(['subjective', 'objective', 'assessment', 'plan'] as const).map((field) => (
          <label key={field} className="mb-3 grid gap-1 text-sm font-bold capitalize text-[#394951]">
            {field}
            <textarea
              data-testid={`soap-${field}`}
              value={soap[field]}
              onChange={(event) => encounter.updateSoap(field, event.target.value)}
              rows={field === 'assessment' || field === 'plan' ? 3 : 2}
              className="resize-none rounded-md border border-[#cdd8d8] p-3 text-sm font-normal outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/20"
            />
          </label>
        ))}
        <button data-testid="commit-soap" type="button" onClick={() => void encounter.commitSoap()} disabled={!canCommitSoap || encounter.busy} className="h-10 w-full rounded-md border border-[#cdd8d8] text-sm font-extrabold disabled:text-[#87949b]">
          Commit SOAP
        </button>
        <button data-testid="complete-case" type="button" onClick={() => void encounter.completeCase()} disabled={!session.state.can_complete || encounter.busy} className="mt-2 h-11 w-full rounded-md bg-[#7f1d1d] text-sm font-extrabold text-white disabled:bg-[#dce4e4] disabled:text-[#738088]">
          Complete case
        </button>
      </section>
    </aside>
  );
}

function DebriefScreen() {
  const { session, packageRecord, feedback, error, start } = useEncounter();
  const [activeTab, setActiveTab] = React.useState<DebriefTab>('replay');
  const [promptStatus, setPromptStatus] = React.useState('');
  const transcript = (packageRecord?.transcript || []) as TranscriptMessage[];
  const realTimeline = (packageRecord?.real_timeline || []) as Array<{ elapsed_min: number; label: string; detail: string }>;
  const hiddenTruth = (packageRecord?.hidden_truth || {}) as Record<string, unknown>;
  const packageOrders = (packageRecord?.orders || []) as OrderResultItem[];
  const differential = stringList(packageRecord?.differential);
  const soap = (isPlainRecord(packageRecord?.soap) ? packageRecord?.soap : {}) as Record<string, unknown>;
  const esiHistory = (Array.isArray(packageRecord?.esi_history) ? packageRecord?.esi_history : []) as Array<{ level?: number; elapsed_minutes?: number }>;
  const resultInterpretations = (packageRecord?.result_interpretations || {}) as Record<string, { text?: string; elapsed_minutes?: number }>;
  const completenessFlags = ((feedback?.completeness?.flags || packageRecord?.completeness_flags || {}) as Record<string, unknown>);
  const omissions = ((feedback?.completeness?.omissions || completenessFlags.omissions || []) as string[]);
  const actionFeedback = normalizeActionFeedback(feedback?.action_feedback);
  const reviewItems = buildDebriefReviewItems(actionFeedback, feedback, packageOrders, omissions);
  const missedWorkupLabels = stringList(feedback?.workup_judgment?.missed).map((id) => labelForDebriefOrder(packageOrders, id));
  const expectedWorkupLabels = stringList(feedback?.workup_judgment?.expected_orders).map((id) => labelForDebriefOrder(packageOrders, id));
  const orderedWorkupLabels = stringList(feedback?.workup_judgment?.ordered).map((id) => labelForDebriefOrder(packageOrders, id));
  const examLog = (packageRecord?.exams || []) as Array<{ maneuver_id: string; display_name: string; performed_at_min: number; finding: string }>;
  const interventionLog = (packageRecord?.interventions || []) as Array<{ intervention_id: string; display_name: string; applied_at_min: number; effect_summary: string }>;
  const usageRows = ((packageRecord?.token_usage || session?.state.token_usage || []) as TokenUsageRecord[]);
  const sourceEnrichment = normalizeSourceEnrichment(packageRecord?.source_enrichment);
  const ecgInterpretationReviews = buildEcgInterpretationReviews(packageOrders, resultInterpretations, sourceEnrichment);
  const replayRows = buildDebriefReplayRows(transcript, realTimeline);
  const truth = {
    diagnosis: readableValue(hiddenTruth.final_diagnosis),
    esi: readableValue(hiddenTruth.validated_esi),
    disposition: readableValue(hiddenTruth.actual_disposition)
  };
  const diagnosticMatched = Boolean(feedback?.diagnostic_accuracy?.matched);
  const esiDefensible = Boolean(feedback?.acuity?.defensible);
  const lastEsi = esiHistory.at(-1)?.level ?? null;
  const summary = debriefPerformanceSummary({
    diagnosticMatched,
    esiDefensible,
    missedWorkupCount: missedWorkupLabels.length,
    reviewItemCount: reviewItems.filter((item) => item.severity !== 'positive').length
  });
  const highPriorityCount = reviewItems.filter((item) => item.severity === 'high').length;
  const mediumPriorityCount = reviewItems.filter((item) => item.severity === 'medium').length;
  const positiveCount = reviewItems.filter((item) => item.severity === 'positive').length;
  const missedEssentials = reviewItems.filter((item) => item.severity !== 'positive');
  const groupedReviewItems = groupDebriefReviewItems(reviewItems);
  const missedPreview = (missedEssentials.length ? missedEssentials : reviewItems).slice(0, 3);
  const openEvidencePrompt = buildOpenEvidencePrompt({
    caseTitle: session?.snapshot.title || '',
    truth,
    feedback,
    missedWorkupLabels,
    expectedWorkupLabels,
    orderedWorkupLabels,
    reviewItems,
    transcript,
    realTimeline,
    packageOrders,
    differential,
    soap,
    lastEsi,
    sourceEnrichment,
    ecgInterpretationReviews
  });
  const usageTotals = usageRows.reduce(
    (totals, row) => ({
      tokens: totals.tokens + row.prompt_tokens + row.completion_tokens,
      cost: totals.cost + row.estimated_cost_usd
    }),
    { tokens: 0, cost: 0 }
  );

  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, []);

  const copyPrompt = async (openEvidence = false) => {
    try {
      await copyTextToClipboard(openEvidencePrompt);
      setPromptStatus(openEvidence ? 'Prompt copied. OpenEvidence opened in a new tab.' : 'Prompt copied.');
    } catch {
      setPromptStatus('Could not copy automatically. Select the prompt text below.');
    }
    if (openEvidence) window.open('https://www.openevidence.com/', '_blank', 'noopener,noreferrer');
  };

  return (
    <main className="ed-sim-font min-h-screen bg-[#f5f7f7] text-[#17232b]">
      <header className="border-b border-[#dbe3e3] bg-white">
        <div className="mx-auto flex max-w-[1560px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <div className="flex items-center gap-2">
              <FirstAidKit size={24} weight="bold" className="text-[#27313a]" />
              <h1 className="m-0 text-xl font-extrabold">Debrief</h1>
            </div>
            <p className="m-0 mt-1 text-sm text-[#607078]">{session?.snapshot.title}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="copy-open-evidence-prompt"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-[#0f766e] px-3 text-sm font-extrabold text-white"
              onClick={() => void copyPrompt(true)}
            >
              <ClipboardText size={17} weight="bold" /> Copy Prompt & OpenEvidence
            </button>
            <button type="button" className="inline-flex h-10 items-center gap-2 rounded-md border border-[#cdd8d8] px-3 text-sm font-bold" onClick={() => void start()}>
              <ArrowClockwise size={17} /> New run
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1560px] gap-2 p-3 sm:gap-3 sm:p-4">
        {promptStatus ? (
          <div className="rounded-md border border-[#c8e3dd] bg-[#f2faf7] px-3 py-2 text-sm font-bold text-[#0f5f58]" data-testid="open-evidence-copy-status">
            {promptStatus}
          </div>
        ) : null}

        <section className="grid gap-2 md:grid-cols-2 md:gap-3 xl:grid-cols-[1.35fr_1fr_1.1fr_1fr_1fr_1fr]" data-testid="debrief-summary-band">
          <DebriefSummaryCard icon={<ChartDonut size={19} weight="bold" />} title="Performance" value={summary.label} detail={summary.message} />
          <DebriefSummaryCard icon={<Stethoscope size={19} weight="bold" />} title="Diagnosis" value={truth.diagnosis} status={diagnosticMatched ? 'Correct' : 'Needs review'} tone={diagnosticMatched ? 'good' : 'danger'} />
          <DebriefSummaryCard icon={<User size={19} weight="bold" />} title="ESI" value={lastEsi ? `${lastEsi} submitted; key ${truth.esi}` : `Not submitted; key ${truth.esi}`} status={esiDefensible ? 'Defensible' : 'Needs review'} tone={esiDefensible ? 'good' : 'danger'} />
          <DebriefSummaryCard icon={<Buildings size={19} weight="bold" />} title="Disposition" value={truth.disposition} status="Answer key" tone="neutral" />
          <DebriefSummaryCard icon={<Flag size={19} weight="fill" />} title="High-priority gaps" value={String(highPriorityCount)} detail="Items to review" tone={highPriorityCount ? 'danger' : 'good'} />
          <DebriefSummaryCard icon={<ListBullets size={19} weight="bold" />} title="Missed workup" value={missedWorkupLabels.length ? `${missedWorkupLabels.length} items` : 'None'} detail={missedWorkupLabels.length ? 'Source-backed workup not ordered' : 'Expected workup covered'} tone={missedWorkupLabels.length ? 'danger' : 'good'} />
        </section>

        <section className="grid gap-3 xl:h-[calc(100vh-250px)] xl:min-h-[620px] xl:grid-cols-[minmax(360px,5fr)_minmax(0,12fr)]">
          <aside className="grid min-h-0 gap-3 xl:grid-rows-[auto_minmax(0,1fr)]">
            <article className="rounded-lg border border-[#d7dfdf] bg-white p-4" data-testid="action-feedback">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="m-0 text-base font-extrabold">Action Review</h2>
                <button type="button" className="text-sm font-extrabold text-[#0f5f58]" onClick={() => setActiveTab('missed')}>
                  View all
                </button>
              </div>
              <div className="overflow-hidden rounded-md border border-[#dfe7e7] text-sm">
                <PriorityCountRow icon={<Flag size={17} weight="fill" />} label="High priority" count={highPriorityCount} tone="danger" />
                <PriorityCountRow icon={<WarningCircle size={17} weight="fill" />} label="Needs attention" count={mediumPriorityCount} tone="warning" />
                <PriorityCountRow icon={<ArrowCircleUp size={17} weight="fill" />} label="Reinforce" count={positiveCount} tone="good" />
              </div>
              <ol className="m-0 mt-3 grid gap-2 p-0 text-sm">
                <NextActionRow index={1} text={highPriorityCount ? 'Review missed high-priority items.' : 'Review timing and sequence.'} onClick={() => setActiveTab(highPriorityCount ? 'missed' : 'replay')} />
                {ecgInterpretationReviews.length ? (
                  <NextActionRow index={2} text="Compare ECG read with source interpretations." onClick={() => setActiveTab('missed')} />
                ) : null}
                <NextActionRow index={ecgInterpretationReviews.length ? 3 : 2} text="Copy evidence prompt for outside review." onClick={() => setActiveTab('prompt')} />
              </ol>
            </article>

            <article className="min-w-0 rounded-lg border border-[#d7dfdf] bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-[#e4e9e9] p-4">
                <div>
                  <h2 className="m-0 text-base font-extrabold">Missed workup</h2>
                  <p className="m-0 mt-1 text-sm font-semibold text-[#607078]">
                    {missedWorkupLabels.length ? `${missedWorkupLabels.length} source-backed gaps` : 'No expected workup missed'}
                  </p>
                </div>
                <button type="button" className="text-sm font-extrabold text-[#0f5f58]" onClick={() => setActiveTab('missed')}>
                  Details
                </button>
              </div>
              <div className="p-4" data-testid="feedback-omissions">
                <div className="grid gap-2">
                  {missedPreview.length ? missedPreview.map((item, index) => (
                    <DebriefReviewItem key={`${item.label}-${index}`} item={item} compact />
                  )) : (
                    <div className="rounded-md border border-dashed border-[#cdd8d8] bg-[#fbfcfc] p-3 text-sm font-semibold text-[#607078]">No action gaps recorded.</div>
                  )}
                  {missedEssentials.length > missedPreview.length ? (
                    <button type="button" className="rounded-md border border-[#dfe7e7] bg-white px-3 py-2 text-left text-sm font-extrabold text-[#0f5f58]" onClick={() => setActiveTab('missed')}>
                      View {missedEssentials.length - missedPreview.length} more items
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          </aside>

          <article className="flex min-h-[620px] min-w-0 flex-col rounded-lg border border-[#d7dfdf] bg-white xl:min-h-0">
            <div className="border-b border-[#e4e9e9] px-4 pt-3">
              <div className="flex flex-wrap gap-5">
                {([
                  ['replay', 'Replay'],
                  ['missed', 'Missed essentials'],
                  ['prompt', 'Evidence prompt'],
                  ['source', 'Source context']
                ] as Array<[DebriefTab, string]>).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    data-testid={`debrief-tab-${id}`}
                    className={`border-x-0 border-t-0 border-b-2 bg-transparent px-0 pb-3 text-sm font-extrabold ${activeTab === id ? 'border-[#0f766e] text-[#0f5f58]' : 'border-transparent text-[#394951]'}`}
                    onClick={() => setActiveTab(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden p-4">
              {activeTab === 'replay' ? (
                <DebriefReplayTable rows={replayRows} />
              ) : null}
              {activeTab === 'missed' ? (
                <div className="h-full overflow-auto pr-1">
                <div className="grid gap-4">
                  <section className="grid gap-3 lg:grid-cols-2">
                    <CompletenessPanel flags={completenessFlags} omissions={omissions} />
                    <WorkupPanel expected={expectedWorkupLabels} ordered={orderedWorkupLabels} missed={missedWorkupLabels} />
                  </section>
                  <section className="grid gap-3 text-sm">
                    <h2 className="m-0 text-base font-extrabold">Action review</h2>
                    <div className="grid gap-3" data-testid="feedback-interventions">
                      {groupedReviewItems.length ? groupedReviewItems.map((group) => (
                        <DebriefReviewGroup key={group.id} group={group} />
                      )) : (
                        <div className="rounded-md border border-dashed border-[#cdd8d8] bg-[#fbfcfc] p-3 font-semibold text-[#607078]">No scored action review items.</div>
                      )}
                    </div>
                  </section>
                  <section className="grid gap-3 text-sm" data-testid="timed-action-log">
                    <h2 className="m-0 text-base font-extrabold">Performed actions</h2>
                    <div className="grid gap-3 lg:grid-cols-2">
                      <TimedActionList
                        title="Exams"
                        rows={examLog.map((item) => ({ id: item.maneuver_id, label: item.display_name, elapsed: item.performed_at_min, detail: item.finding }))}
                        empty="No exams performed."
                      />
                      <TimedActionList
                        title="Interventions"
                        rows={interventionLog.map((item) => ({ id: item.intervention_id, label: item.display_name, elapsed: item.applied_at_min, detail: item.effect_summary }))}
                        empty="No interventions applied."
                      />
                    </div>
                  </section>
                  {ecgInterpretationReviews.length ? (
                    <EcgInterpretationReviewPanel reviews={ecgInterpretationReviews} />
                  ) : null}
                  <section className="grid gap-3 text-sm">
                    <h2 className="m-0 text-base font-extrabold">Teaching points</h2>
                    <ul className="m-0 grid gap-2 p-0">
                      {(feedback?.teaching_points || []).map((point, index) => (
                        <li key={index} className="list-none rounded-md border border-[#dfe7e7] bg-[#fbfcfc] p-3">
                          {point.grounded ? <CheckCircle size={16} className="mr-2 inline text-[#0f766e]" weight="fill" /> : null}
                          {point.claim}
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>
                </div>
              ) : null}
              {activeTab === 'prompt' ? (
                <div className="h-full overflow-auto pr-1">
                <div className="grid gap-4">
                  <EvidencePromptPreview
                    truth={truth}
                    feedback={feedback}
                    missedWorkupLabels={missedWorkupLabels}
                    reviewItems={reviewItems}
                    realTimeline={realTimeline}
                    sourceEnrichment={sourceEnrichment}
                    ecgInterpretationReviews={ecgInterpretationReviews}
                    lastEsi={lastEsi}
                  />
                  <section className="rounded-md border border-[#d7dfdf] bg-[#fbfcfc] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="m-0 text-base font-extrabold">OpenEvidence handoff</h2>
                        <p className="m-0 mt-1 text-sm font-semibold leading-6 text-[#52636b]">Concise case details and student performance, ready to paste for external evidence feedback.</p>
                      </div>
                      <button
                        type="button"
                        data-testid="copy-evidence-prompt-only"
                        className="inline-flex h-10 items-center gap-2 rounded-md border border-[#cdd8d8] bg-white px-3 text-sm font-extrabold"
                        onClick={() => void copyPrompt(false)}
                      >
                        <ClipboardText size={16} weight="bold" /> Copy Prompt
                      </button>
                    </div>
                    <textarea
                      data-testid="open-evidence-prompt"
                      readOnly
                      value={openEvidencePrompt}
                      className="mt-3 min-h-[380px] w-full resize-y rounded-md border border-[#cdd8d8] bg-white p-3 font-mono text-xs leading-5 text-[#27313a] outline-none"
                    />
                  </section>
                  <section className="rounded-lg border border-[#d7dfdf] bg-white p-4">
                    <h2 className="m-0 mb-3 text-base font-extrabold">Usage</h2>
                    <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
                      <FeedbackRow label="Tokens" value={String(usageTotals.tokens)} />
                      <FeedbackRow label="Cost" value={formatCost(usageTotals.cost)} />
                    </div>
                    <div className="grid gap-2 text-xs" data-testid="usage-log">
                      {usageRows.length ? usageRows.map((row, index) => (
                        <div key={`${row.purpose}-${index}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-md border border-[#dfe7e7] bg-[#fbfcfc] p-2">
                          <span className="font-bold text-[#394951]">{row.purpose}</span>
                          <span className="font-semibold text-[#607078]">{row.tier} - {row.prompt_tokens + row.completion_tokens} tokens - {formatCost(row.estimated_cost_usd)}</span>
                        </div>
                      )) : (
                        <div className="rounded-md border border-dashed border-[#cdd8d8] bg-[#fbfcfc] p-3 font-semibold text-[#607078]">No model usage recorded.</div>
                      )}
                    </div>
                  </section>
                </div>
                </div>
              ) : null}
              {activeTab === 'source' ? (
                <div className="h-full overflow-auto pr-1">
                  <SourceCaseContext enrichment={sourceEnrichment} />
                </div>
              ) : null}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}

type DebriefTab = 'replay' | 'missed' | 'prompt' | 'source';

type DebriefReviewItemModel = {
  label: string;
  message: string;
  detail: string;
  severity: 'high' | 'medium' | 'positive';
  group: 'exam' | 'workup' | 'reassessment' | 'reinforce';
  elapsed_minutes?: number | null;
};

type EcgSourceInterpretationEntry = {
  id: string;
  title: string;
  interpretation: string;
  meta: string;
  caveat: string;
};

type EcgInterpretationReview = {
  orderId: string;
  displayName: string;
  studentText: string;
  elapsedMinutes?: number;
  sourceSummary: string;
  sourceEntries: EcgSourceInterpretationEntry[];
  sourceCaveat: string;
};

function DebriefSummaryCard({
  icon,
  title,
  value,
  detail,
  status,
  tone = 'neutral'
}: {
  icon?: React.ReactNode;
  title: string;
  value: string;
  detail?: string;
  status?: string;
  tone?: 'good' | 'danger' | 'neutral';
}) {
  const toneClass = tone === 'good'
    ? 'border-[#bcd9c1] bg-[#edf8ef] text-[#1d6b34]'
    : tone === 'danger'
      ? 'border-[#f0c2c2] bg-[#fff7f7] text-[#7f1d1d]'
      : 'border-[#dfe7e7] bg-[#fbfcfc] text-[#394951]';

  return (
    <article className="grid min-h-[96px] content-start gap-2 rounded-lg border border-[#d7dfdf] bg-white p-3 md:min-h-[118px] md:p-4">
      <div className={`flex items-center gap-2 text-sm font-extrabold ${tone === 'danger' ? 'text-[#9f1d1d]' : tone === 'good' ? 'text-[#0f5f58]' : 'text-[#27313a]'}`}>
        {icon ? <span className="grid h-5 w-5 place-items-center">{icon}</span> : null}
        <h2 className="m-0 text-sm font-extrabold">{title}</h2>
      </div>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <strong className="min-w-0 text-base leading-6 text-[#17232b]">{value}</strong>
        {status ? <span className={`rounded-md border px-2 py-1 text-xs font-extrabold ${toneClass}`}>{status}</span> : null}
      </div>
      {detail ? <p className="m-0 text-sm font-semibold leading-5 text-[#52636b]">{detail}</p> : null}
    </article>
  );
}

function DebriefVerdictRow({ label, value, status, tone }: { label: string; value: string; status: string; tone: 'good' | 'danger' | 'neutral' }) {
  const toneClass = tone === 'good'
    ? 'border-[#bcd9c1] bg-[#edf8ef] text-[#1d6b34]'
    : tone === 'danger'
      ? 'border-[#f0c2c2] bg-[#fff7f7] text-[#7f1d1d]'
      : 'border-[#dfe7e7] bg-[#fbfcfc] text-[#394951]';
  return (
    <div className="grid gap-2 px-4 py-3">
      <dt className="text-sm font-extrabold">{label}</dt>
      <dd className="m-0 flex min-w-0 flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 text-sm font-semibold leading-6 text-[#27313a]">{value}</span>
        <span className={`rounded-md border px-2 py-1 text-xs font-extrabold ${toneClass}`}>{status}</span>
      </dd>
    </div>
  );
}

function PriorityCountRow({ icon, label, count, tone = 'neutral' }: { icon: React.ReactNode; label: string; count: number; tone?: 'danger' | 'warning' | 'good' | 'neutral' }) {
  const iconClass = tone === 'danger'
    ? 'text-[#c22929]'
    : tone === 'warning'
      ? 'text-[#d97706]'
      : tone === 'good'
        ? 'text-[#0f766e]'
        : 'text-[#607078]';
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#e4e9e9] bg-[#fbfcfc] px-3 py-2 last:border-b-0">
      <span className="inline-flex min-w-0 items-center gap-2 font-semibold text-[#27313a]">
        <span className={`grid h-5 w-5 place-items-center ${iconClass}`}>{icon}</span>
        {label}
      </span>
      <strong className="text-[#17232b]">{count}</strong>
    </div>
  );
}

function NextActionRow({ index, text, onClick }: { index: number; text: string; onClick: () => void }) {
  return (
    <li className="list-none">
      <button type="button" className="grid w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-[#dfe7e7] bg-white px-3 py-2 text-left hover:border-[#0f766e]" onClick={onClick}>
        <span className="grid h-7 w-7 place-items-center rounded-md bg-[#eef2f2] text-xs font-extrabold text-[#52636b]">{index}</span>
        <span className="text-sm font-semibold leading-5 text-[#27313a]">{text}</span>
        <CaretRight size={15} className="text-[#607078]" weight="bold" />
      </button>
    </li>
  );
}

function CompletenessPanel({ flags, omissions }: { flags: Record<string, unknown>; omissions: string[] }) {
  return (
    <section className="rounded-lg border border-[#d7dfdf] bg-white p-4">
      <h2 className="m-0 mb-3 text-base font-extrabold">Completeness</h2>
      <div className="grid gap-2 text-sm">
        <FeedbackRow label="ABCDE" value={flagLabel(flags.abcde_addressed)} />
        <FeedbackRow label="ESI" value={flagLabel(flags.esi_committed)} />
        <FeedbackRow label="Assessment" value={flagLabel(flags.assessment_committed)} />
        <FeedbackRow label="Plan" value={flagLabel(flags.plan_committed)} />
      </div>
      <div className="mt-3 grid gap-2 text-sm" data-testid="completeness-gaps">
        {omissions.length ? omissions.map((omission) => (
          <div key={omission} className="rounded-md border border-[#e8b5b5] bg-[#fff7f7] p-3 font-semibold text-[#7f1d1d]">{omission}</div>
        )) : (
          <div className="rounded-md border border-[#dfe7e7] bg-[#fbfcfc] p-3 font-semibold text-[#31534f]">No omissions recorded.</div>
        )}
      </div>
    </section>
  );
}

function WorkupPanel({ expected, ordered, missed }: { expected: string[]; ordered: string[]; missed: string[] }) {
  return (
    <section className="rounded-lg border border-[#d7dfdf] bg-white p-4">
      <h2 className="m-0 mb-3 text-base font-extrabold">Workup</h2>
      <div className="grid gap-3 text-sm">
        <ReadableList label="Expected" items={expected} empty="No expected workup listed." />
        <ReadableList label="Ordered" items={ordered} empty="No orders placed." />
        <ReadableList label="Missed" items={missed} empty="No expected workup missed." danger={missed.length > 0} />
      </div>
    </section>
  );
}

function ReadableList({ label, items, empty, danger = false }: { label: string; items: string[]; empty: string; danger?: boolean }) {
  return (
    <div className="grid gap-1">
      <strong className="text-sm">{label}</strong>
      {items.length ? (
        <ul className="m-0 grid gap-1 p-0">
          {items.map((item) => (
            <li key={item} className={`list-none rounded-md border px-3 py-2 font-semibold ${danger ? 'border-[#f0c2c2] bg-[#fff7f7] text-[#7f1d1d]' : 'border-[#dfe7e7] bg-[#fbfcfc] text-[#27313a]'}`}>
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-md border border-dashed border-[#cdd8d8] bg-[#fbfcfc] px-3 py-2 font-semibold text-[#607078]">{empty}</div>
      )}
    </div>
  );
}

function DebriefReviewItem({ item, compact = false }: { item: DebriefReviewItemModel; compact?: boolean }) {
  const toneClass = item.severity === 'high'
    ? 'border-[#efcaca] bg-[#fffafa]'
    : item.severity === 'positive'
      ? 'border-[#c8e3dd] bg-[#f2faf7]'
      : 'border-[#ead6b9] bg-[#fffaf0]';
  const severityLabel = item.severity === 'high' ? 'High impact' : item.severity === 'medium' ? 'Needs attention' : 'Reinforce';
  const severityIcon = item.severity === 'high'
    ? <Flag size={16} weight="fill" />
    : item.severity === 'medium'
      ? <WarningCircle size={16} weight="fill" />
      : <ArrowCircleUp size={16} weight="fill" />;
  const severityIconClass = item.severity === 'high' ? 'text-[#c22929]' : item.severity === 'medium' ? 'text-[#d97706]' : 'text-[#0f766e]';
  return (
    <article className={`rounded-md border px-3 py-2.5 ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <strong className="inline-flex min-w-0 items-center gap-2 text-sm text-[#27313a]">
          <span className={`grid h-5 w-5 flex-none place-items-center ${severityIconClass}`}>{severityIcon}</span>
          <span className="min-w-0">{item.label}</span>
        </strong>
        {typeof item.elapsed_minutes === 'number' ? <span className="text-xs font-bold text-[#607078]">{formatClock(item.elapsed_minutes)}</span> : null}
      </div>
      <p className={`m-0 mt-1 text-sm font-semibold text-[#27313a] ${compact ? 'leading-5' : 'leading-6'}`}>{item.message}</p>
      {compact ? (
        <p className={`m-0 mt-2 text-xs font-extrabold ${item.severity === 'high' ? 'text-[#9f1d1d]' : item.severity === 'positive' ? 'text-[#0f5f58]' : 'text-[#607078]'}`}>{severityLabel}</p>
      ) : item.detail ? (
        <p className="m-0 mt-1 text-xs font-bold leading-5 text-[#607078]">{item.detail}</p>
      ) : null}
    </article>
  );
}

type DebriefReviewGroupModel = {
  id: DebriefReviewItemModel['group'];
  title: string;
  description: string;
  items: DebriefReviewItemModel[];
  defaultOpen: boolean;
};

function DebriefReviewGroup({ group }: { group: DebriefReviewGroupModel }) {
  const visibleItems = group.items.slice(0, 5);
  const hiddenItems = group.items.slice(5);
  return (
    <details className="rounded-md border border-[#d7dfdf] bg-white" open={group.defaultOpen} data-testid={`review-group-${group.id}`}>
      <summary className="grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-2.5">
        <span>
          <strong className="block text-sm text-[#17232b]">{group.title}</strong>
          <span className="mt-1 block text-xs font-semibold leading-5 text-[#607078]">{group.description}</span>
        </span>
        <span className="text-sm font-extrabold text-[#52636b]">{group.items.length}</span>
      </summary>
      <div className="grid gap-2 border-t border-[#e4e9e9] bg-[#fbfcfc] p-3">
        {visibleItems.map((item, index) => (
          <DebriefReviewItem key={`${item.label}-${index}`} item={item} />
        ))}
        {hiddenItems.length ? (
          <details className="rounded-md border border-[#dfe7e7] bg-white">
            <summary className="cursor-pointer px-3 py-2 text-sm font-extrabold text-[#0f5f58]">
              Show {hiddenItems.length} more
            </summary>
            <div className="grid gap-2 border-t border-[#e4e9e9] p-3">
              {hiddenItems.map((item, index) => (
                <DebriefReviewItem key={`${item.label}-hidden-${index}`} item={item} />
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </details>
  );
}

function ReplayActorIcon({ who, source }: { who: string; source: 'student' | 'real' | 'result' }) {
  if (source === 'real') return <Buildings size={16} weight="bold" className="text-[#52636b]" />;
  if (source === 'result') return <Pulse size={16} weight="bold" className="text-[#0f766e]" />;
  if (who === 'System') return <FirstAidKit size={16} weight="bold" className="text-[#607078]" />;
  return <User size={16} weight={who === 'Patient' ? 'fill' : 'bold'} className={who === 'Patient' ? 'text-[#0f766e]' : 'text-[#607078]'} />;
}

function DebriefReplayTable({ rows }: { rows: Array<{ elapsed_min: number; who: string; event: string; detail: string; source: 'student' | 'real' | 'result' }> }) {
  return (
    <div className="flex h-full min-h-[460px] min-w-0 flex-col overflow-hidden rounded-md border border-[#d7dfdf]" data-testid="debrief-replay-table">
      <div className="min-w-0 overflow-x-auto">
        <div className="grid min-w-[820px] grid-cols-[74px_150px_minmax(160px,0.8fr)_minmax(220px,1fr)] border-b border-[#d7dfdf] bg-[#fbfcfc] px-3 py-2 text-xs font-extrabold text-[#52636b]">
          <span>Time</span>
          <span>Who</span>
          <span>Event</span>
          <span>Details</span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="min-w-[820px]">
          {rows.length ? rows.map((row, index) => (
            <div key={`${row.elapsed_min}-${row.who}-${index}`} className="grid grid-cols-[74px_150px_minmax(160px,0.8fr)_minmax(220px,1fr)] gap-3 border-b border-[#eef2f2] px-3 py-2 text-sm last:border-b-0">
              <span className="font-semibold text-[#52636b]">{formatMinuteStamp(row.elapsed_min)}</span>
              <span className={`inline-flex min-w-0 items-center gap-2 font-bold ${row.source === 'student' ? 'text-[#394951]' : row.source === 'result' ? 'text-[#0f5f58]' : 'text-[#52636b]'}`}>
                <ReplayActorIcon who={row.who} source={row.source} />
                <span className="min-w-0 truncate">{row.who}</span>
              </span>
              <span className="font-semibold text-[#27313a]">{row.event}</span>
              <span className="leading-6 text-[#27313a]">{row.detail || '-'}</span>
            </div>
          )) : (
            <div className="p-4 text-sm font-semibold text-[#607078]">No replay events recorded.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function buildDebriefReplayRows(transcript: TranscriptMessage[], realTimeline: Array<{ elapsed_min: number; label: string; detail: string }>) {
  const studentRows = transcript.map((message) => ({
    elapsed_min: message.elapsed_minutes,
    who: labelForMessage(message),
    event: message.speaker === 'student' ? message.text : replayEventLabel(message),
    detail: message.speaker === 'student' ? '' : message.text,
    source: message.speaker === 'results' ? 'result' as const : 'student' as const
  }));
  const realRows = realTimeline.map((item) => ({
    elapsed_min: item.elapsed_min,
    who: 'Real encounter',
    event: item.label,
    detail: item.detail,
    source: 'real' as const
  }));
  return [...studentRows, ...realRows].sort((a, b) => a.elapsed_min - b.elapsed_min || sourceSort(a.source) - sourceSort(b.source));
}

function replayEventLabel(message: TranscriptMessage) {
  if (message.speaker === 'results') return 'Result released';
  if (message.speaker === 'system') return 'System event';
  if (message.speaker === 'exam') return 'Exam finding';
  return `${labelForMessage(message)} response`;
}

function sourceSort(source: 'student' | 'real' | 'result') {
  if (source === 'real') return 0;
  if (source === 'student') return 1;
  return 2;
}

function buildDebriefReviewItems(
  actionFeedback: ReturnType<typeof normalizeActionFeedback>,
  feedback: GraderFeedback | null,
  packageOrders: OrderResultItem[],
  omissions: string[]
): DebriefReviewItemModel[] {
  const missedOrders = stringList(feedback?.workup_judgment?.missed).map((id) => ({
    label: labelForDebriefOrder(packageOrders, id),
    message: 'Expected source-backed workup was not ordered.',
    detail: 'Case rubric',
    severity: 'high' as const,
    group: 'workup' as const
  }));
  const completeness = omissions.map((omission) => ({
    label: 'Completeness',
    message: omission,
    detail: 'Completion gate',
    severity: 'high' as const,
    group: 'reassessment' as const
  }));
  const omissionsThatMattered = actionFeedback.omissions_that_mattered.map((item) => fromActionFeedback(item, 'high' as const));
  const missedInterventions = actionFeedback.interventions.missed.map((item) => fromActionFeedback(item, 'high' as const, 'reassessment'));
  const timing = actionFeedback.timing_sequence.map((item) => fromActionFeedback(item, 'medium' as const, 'reassessment'));
  const excessive = actionFeedback.interventions.excessive.map((item) => fromActionFeedback(item, 'medium' as const, 'reassessment'));
  const positives = [...actionFeedback.interventions.appropriate, ...actionFeedback.positive_reinforcement].map((item) => fromActionFeedback(item, 'positive' as const, 'reinforce'));
  return uniqueReviewItems([...missedOrders, ...completeness, ...omissionsThatMattered, ...missedInterventions, ...timing, ...excessive, ...positives]);
}

function fromActionFeedback(item: ActionFeedbackItem, severity: DebriefReviewItemModel['severity'], group?: DebriefReviewItemModel['group']): DebriefReviewItemModel {
  return {
    label: item.label || humanizeId(item.action_id || 'Action'),
    message: item.message,
    detail: item.grounded ? sourceEvidenceLabel(item.evidence_id || item.evidence_note || 'case-rubric') : sourceEvidenceLabel(item.evidence_note),
    severity,
    group: group || inferReviewGroup(item, severity),
    elapsed_minutes: item.elapsed_minutes
  };
}

function uniqueReviewItems(items: DebriefReviewItemModel[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.severity}:${item.label}:${item.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function inferReviewGroup(item: ActionFeedbackItem, severity: DebriefReviewItemModel['severity']): DebriefReviewItemModel['group'] {
  if (severity === 'positive') return 'reinforce';
  const text = `${item.action_id || ''} ${item.label || ''} ${item.message || ''}`.toLowerCase();
  if (/\b(lft|lipase|ct|cbc|bmp|cmp|lab|imaging|x-ray|workup|order)\b/.test(text)) return 'workup';
  if (/\b(abdomen|abdominal|guarding|rebound|bowel|percussion|palpation|inspection|exam|appearance|tenderness)\b/.test(text)) return 'exam';
  return 'reassessment';
}

function groupDebriefReviewItems(items: DebriefReviewItemModel[]): DebriefReviewGroupModel[] {
  const groupMeta: Array<Omit<DebriefReviewGroupModel, 'items'> & { id: DebriefReviewItemModel['group'] }> = [
    { id: 'exam', title: 'Abdominal exam omissions', description: 'Physical exam findings that would sharpen the acute-abdomen branch point.', defaultOpen: true },
    { id: 'workup', title: 'Missed workup', description: 'Source-backed labs or imaging expected for this presentation.', defaultOpen: true },
    { id: 'reassessment', title: 'Reassessment and escalation', description: 'Acuity, timing, intervention, and disposition behaviors to tighten.', defaultOpen: false },
    { id: 'reinforce', title: 'Reinforced strengths', description: 'Actions worth repeating in the next run.', defaultOpen: false }
  ];
  return groupMeta
    .map((group) => ({ ...group, items: items.filter((item) => item.group === group.id) }))
    .filter((group) => group.items.length > 0);
}

function sourceEvidenceLabel(value: string | null | undefined) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const normalized = raw.toLowerCase();
  const map: Record<string, string> = {
    'case-rubric': 'Case rubric',
    'case rubric': 'Case rubric',
    'case-answer-key': 'Case answer key',
    'completion gate finding.': 'Completion gate',
    'completion gate finding': 'Completion gate',
    'workup item from the case rubric.': 'Case rubric'
  };
  if (map[normalized]) return map[normalized];
  if (normalized.includes('mimic-iv-note') || normalized.includes('discharge')) return 'MIMIC-IV discharge summary';
  if (normalized.includes('vitals')) return 'MIMIC-IV ED vitals';
  if (normalized.includes('medication') || normalized.includes('medrecon') || normalized.includes('emar') || normalized.includes('pyxis')) return 'MIMIC-IV medication record';
  return humanizeId(raw);
}

function debriefPerformanceSummary({
  diagnosticMatched,
  esiDefensible,
  missedWorkupCount,
  reviewItemCount
}: {
  diagnosticMatched: boolean;
  esiDefensible: boolean;
  missedWorkupCount: number;
  reviewItemCount: number;
}) {
  if (diagnosticMatched && esiDefensible && missedWorkupCount === 0 && reviewItemCount <= 1) {
    return { label: 'Strong performance', message: 'Core diagnosis, acuity, and source-backed workup were aligned.' };
  }
  if (diagnosticMatched || esiDefensible) {
    return { label: 'Partial performance', message: 'Some key reasoning was present. Address the missed essentials before repeating the case.' };
  }
  return { label: 'Needs focused review', message: 'High-impact gaps affected diagnosis, acuity, or essential workup.' };
}

function buildOpenEvidencePrompt({
  caseTitle,
  truth,
  feedback,
  missedWorkupLabels,
  expectedWorkupLabels,
  orderedWorkupLabels,
  reviewItems,
  transcript,
  realTimeline,
  packageOrders,
  differential,
  soap,
  lastEsi,
  sourceEnrichment,
  ecgInterpretationReviews
}: {
  caseTitle: string;
  truth: { diagnosis: string; esi: string; disposition: string };
  feedback: GraderFeedback | null;
  missedWorkupLabels: string[];
  expectedWorkupLabels: string[];
  orderedWorkupLabels: string[];
  reviewItems: DebriefReviewItemModel[];
  transcript: TranscriptMessage[];
  realTimeline: Array<{ elapsed_min: number; label: string; detail: string }>;
  packageOrders: OrderResultItem[];
  differential: string[];
  soap: Record<string, unknown>;
  lastEsi: number | null;
  sourceEnrichment: SourceEnrichment;
  ecgInterpretationReviews: EcgInterpretationReview[];
}) {
  const resultSummaries = packageOrders
    .filter((order) => order.result)
    .slice(0, 8)
    .map((order) => `${order.display_name}: ${resultBrief(order.result)}`);
  const transcriptExcerpt = transcript
    .slice(0, 12)
    .map((message) => `${formatClock(message.elapsed_minutes)} ${labelForMessage(message)}: ${message.text}`);
  const realEvents = realTimeline
    .slice(0, 8)
    .map((item) => `${formatClock(item.elapsed_min)} ${item.label}: ${item.detail}`);
  const highPriority = reviewItems
    .filter((item) => item.severity === 'high')
    .slice(0, 8)
    .map((item) => `${item.label}: ${item.message}`);
  const noteDigest = prioritizedNoteDigests(sourceEnrichment.noteDigests)
    .map((item) => `${recordString(item, 'section') || 'Source note'}: ${stripLeadingSectionLabel(recordString(item, 'summary'), recordString(item, 'section'))}`);
  const noteDocuments = prioritizedNoteDocuments(sourceEnrichment.noteDocuments)
    .map((item) => noteDocumentTextForPrompt(item))
    .filter(Boolean);
  const sourceVitals = sourceEnrichment.sourceVitals
    .slice(0, 5)
    .map((item) => `${formatClock(recordNumber(item, 'elapsed_min'))}: ${formatSourceVitals(item)}`);
  const edMedications = sourceEnrichment.edMedications
    .slice(0, 6)
    .map((item) => `${formatClock(recordNumber(item, 'elapsed_min'))}: ${medicationLine(item)}${recordString(item, 'event') ? ` (${recordString(item, 'event')})` : ''}`);
  const ecgComparisons = ecgInterpretationReviews.map((review) => ecgComparisonTextForPrompt(review));
  return [
    'You are reviewing an emergency medicine simulation performance. Provide concise, evidence-based feedback for the instructor to use during debrief. Do not invent missing case facts.',
    '',
    `Case: ${caseTitle || 'ED abdominal pain simulation'}`,
    `Answer key: diagnosis ${truth.diagnosis}; ESI ${truth.esi}; disposition ${truth.disposition}.`,
    `Student ESI: ${lastEsi ?? 'not submitted'}. Diagnosis matched expected diagnosis: ${feedback?.diagnostic_accuracy?.matched ? 'yes' : 'no'}. ESI defensible: ${feedback?.acuity?.defensible ? 'yes' : 'no'}.`,
    '',
    `Student differential: ${differential.length ? differential.join('; ') : 'not committed'}.`,
    `Student assessment: ${readableValue(soap.assessment, 'not documented')}.`,
    `Student plan: ${readableValue(soap.plan, 'not documented')}.`,
    '',
    `Expected workup: ${expectedWorkupLabels.length ? expectedWorkupLabels.join('; ') : 'not specified'}.`,
    `Ordered workup: ${orderedWorkupLabels.length ? orderedWorkupLabels.join('; ') : 'none'}.`,
    `Missed workup: ${missedWorkupLabels.length ? missedWorkupLabels.join('; ') : 'none'}.`,
    '',
    'High-priority feedback:',
    ...(highPriority.length ? highPriority.map((item) => `- ${item}`) : ['- No high-priority gaps recorded.']),
    '',
    'Key resulted studies:',
    ...(resultSummaries.length ? resultSummaries.map((item) => `- ${item}`) : ['- No resulted studies recorded.']),
    '',
    'ECG interpretation comparison:',
    ...(ecgComparisons.length ? ecgComparisons.map((item) => `- ${item}`) : ['- No saved ECG interpretation/source comparison attached.']),
    '',
    'Student transcript excerpt:',
    ...(transcriptExcerpt.length ? transcriptExcerpt.map((item) => `- ${item}`) : ['- No transcript recorded.']),
    '',
    'Source-recorded real encounter anchors:',
    ...(realEvents.length ? realEvents.map((item) => `- ${item}`) : ['- No real encounter timeline attached.']),
    '',
    'Physician discharge-summary digest:',
    ...(noteDigest.length ? noteDigest.map((item) => `- ${item}`) : ['- No discharge-summary digest attached.']),
    '',
    'Original physician note text:',
    ...(noteDocuments.length ? noteDocuments : ['No original physician note text attached.']),
    '',
    'Source-recorded ED reassessment anchors:',
    ...(sourceVitals.length ? sourceVitals.map((item) => `- ${item}`) : ['- No repeat ED vitals attached.']),
    ...(edMedications.length ? edMedications.map((item) => `- ${item}`) : ['- No source-recorded ED medications attached.']),
    '',
    'Please return: 1. the highest-yield teaching point, 2. what the learner should have done next in the ED, 3. any evidence-based management nuance for this diagnosis, and 4. a one-paragraph debrief script.'
  ].join('\n');
}

function EvidencePromptPreview({
  truth,
  feedback,
  missedWorkupLabels,
  reviewItems,
  realTimeline,
  sourceEnrichment,
  ecgInterpretationReviews,
  lastEsi
}: {
  truth: { diagnosis: string; esi: string; disposition: string };
  feedback: GraderFeedback | null;
  missedWorkupLabels: string[];
  reviewItems: DebriefReviewItemModel[];
  realTimeline: Array<{ elapsed_min: number; label: string; detail: string }>;
  sourceEnrichment: SourceEnrichment;
  ecgInterpretationReviews: EcgInterpretationReview[];
  lastEsi: number | null;
}) {
  const sourceNotes = prioritizedNoteDigests(sourceEnrichment.noteDigests).slice(0, 5);
  const noteDocument = prioritizedNoteDocuments(sourceEnrichment.noteDocuments)[0];
  const highPriority = reviewItems.filter((item) => item.severity === 'high').slice(0, 3);
  const realOutcome = realTimeline.slice(-3).map((item) => `${formatClock(item.elapsed_min)} ${item.label}`).join('; ') || 'No real encounter timeline attached.';
  return (
    <section className="grid gap-2 rounded-md border border-[#d7dfdf] bg-white p-4" data-testid="evidence-prompt-preview">
      <h2 className="m-0 text-base font-extrabold">Prompt preview</h2>
      <div className="grid gap-2 text-sm lg:grid-cols-2">
        <PromptPreviewRow label="Case summary" value={`Diagnosis ${truth.diagnosis}; ESI key ${truth.esi}; disposition ${truth.disposition}.`} />
        <PromptPreviewRow label="Student performance" value={`ESI ${lastEsi ?? 'not submitted'}; diagnosis match ${feedback?.diagnostic_accuracy?.matched ? 'yes' : 'no'}; acuity defensible ${feedback?.acuity?.defensible ? 'yes' : 'no'}.`} />
        <PromptPreviewRow label="Missed essentials" value={missedWorkupLabels.length ? missedWorkupLabels.join(', ') : highPriority.map((item) => item.label).join(', ') || 'No high-priority gaps recorded.'} />
        <PromptPreviewRow label="Real encounter outcome" value={realOutcome} />
        <PromptPreviewRow
          label="Source note digest"
          value={sourceNotes.length ? sourceNotes.map((item) => `${recordString(item, 'section')}: ${stripLeadingSectionLabel(recordString(item, 'summary'), recordString(item, 'section'))}`).join(' ') : 'No physician note digest attached.'}
          wide
        />
        <PromptPreviewRow
          label="Original note included"
          value={noteDocument ? `${noteDocumentTitle(noteDocument)} (${recordLongText(noteDocument).length.toLocaleString()} characters copied into the prompt).` : 'No original note document attached.'}
          wide
        />
        <PromptPreviewRow
          label="ECG comparison"
          value={ecgInterpretationReviews.length ? `${ecgInterpretationReviews.length} learner-vs-source ECG comparison${ecgInterpretationReviews.length === 1 ? '' : 's'} included.` : 'No ECG interpretation comparison attached.'}
          wide
        />
      </div>
    </section>
  );
}

function PromptPreviewRow({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-md border border-[#dfe7e7] bg-[#fbfcfc] px-3 py-2 ${wide ? 'lg:col-span-2' : ''}`}>
      <strong className="block text-xs text-[#607078]">{label}</strong>
      <span className="mt-1 block text-sm font-semibold leading-6 text-[#27313a]">{value}</span>
    </div>
  );
}

function resultBrief(result: ResultBundle | null | undefined) {
  if (!result) return 'No result.';
  if (result.narrative) return result.narrative;
  if (result.values.length) {
    return result.values.slice(0, 5).map((value) => `${value.name} ${value.value}${value.unit ? ` ${value.unit}` : ''}${value.flag ? ` (${value.flag})` : ''}`).join('; ');
  }
  return 'Result available without structured values.';
}

function labelForDebriefOrder(orders: OrderResultItem[], id: string) {
  const order = orders.find((item) => item.order_id === id);
  return order?.display_name || humanizeId(id);
}

function humanizeId(value: string) {
  const map: Record<string, string> = {
    lft: 'Liver function tests',
    lipase: 'Lipase',
    ct_abdomen_pelvis_with_contrast: 'CT abdomen/pelvis with contrast',
    ct_abdomen_pelvis_contrast: 'CT abdomen/pelvis with contrast',
    cbc: 'CBC',
    bmp: 'Basic metabolic panel',
    cmp: 'Comprehensive metabolic panel',
    cardiac_monitor: 'Cardiac monitoring',
    iv_access: 'IV access',
    iv_fluids: 'IV crystalloid bolus',
    analgesia: 'Analgesia'
  };
  if (map[value]) return map[value];
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.length <= 3 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function readableValue(value: unknown, fallback = 'Not recorded') {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.map((item) => readableValue(item, '')).filter(Boolean).join(', ') : fallback;
  if (typeof value === 'object') return fallback;
  const text = String(value).trim();
  return text || fallback;
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!copied) throw new Error('Clipboard copy failed.');
}

type SourceEnrichment = {
  homeMedications: Record<string, unknown>[];
  edMedications: Record<string, unknown>[];
  sourceVitals: Record<string, unknown>[];
  debriefTimeline: Record<string, unknown>[];
  noteDigests: Record<string, unknown>[];
  noteDocuments: Record<string, unknown>[];
  ecgInterpretations: Record<string, unknown>[];
  historicalReferences: Record<string, unknown>[];
  provenanceNotes: string[];
};

function normalizeSourceEnrichment(value: unknown): SourceEnrichment {
  const record = isPlainRecord(value) ? value : {};
  return {
    homeMedications: recordArray(record.home_medications),
    edMedications: recordArray(record.ed_medications),
    sourceVitals: recordArray(record.source_vitals),
    debriefTimeline: recordArray(record.debrief_timeline),
    noteDigests: recordArray(record.note_digests),
    noteDocuments: recordArray(record.note_documents),
    ecgInterpretations: recordArray(record.ecg_interpretations),
    historicalReferences: recordArray(record.historical_references),
    provenanceNotes: Array.isArray(record.provenance_notes) ? record.provenance_notes.map((item) => String(item)).filter(Boolean) : []
  };
}

function recordArray(value: unknown) {
  return Array.isArray(value) ? value.filter(isPlainRecord) : [];
}

function SourceCaseContext({ enrichment }: { enrichment: SourceEnrichment }) {
  const timelineItems = prioritizedTimelineItems(enrichment.debriefTimeline);
  const noteItems = prioritizedNoteDigests(enrichment.noteDigests);
  const noteDocuments = prioritizedNoteDocuments(enrichment.noteDocuments);
  const ecgItems = prioritizedEcgInterpretations(enrichment.ecgInterpretations);
  const physicianNoteItems = noteItems.filter((item) => recordString(item, 'source_table') === 'note.discharge' || recordString(item, 'note_type').toLowerCase().includes('discharge') || recordString(item, 'section'));
  const hasContent = [
    enrichment.homeMedications,
    enrichment.edMedications,
    enrichment.sourceVitals,
    enrichment.debriefTimeline,
    enrichment.noteDigests,
    enrichment.noteDocuments,
    enrichment.ecgInterpretations,
    enrichment.historicalReferences
  ].some((items) => items.length) || enrichment.provenanceNotes.length > 0;
  if (!hasContent) return null;

  return (
    <article className="rounded-lg border border-[#d7dfdf] bg-white p-4" data-testid="source-enrichment-debrief">
      <div className="mb-3 flex items-center gap-2">
        <ClipboardText size={18} weight="bold" />
        <h2 className="m-0 text-base font-extrabold">Source context</h2>
      </div>
      <div className="grid gap-4 text-sm">
        <SourceContextSection title="Original physician note" items={noteDocuments} empty="No original physician note text attached." defaultOpen>
          {(item, index) => (
            <SourceNoteDocumentRow key={`${noteDocumentTitle(item)}-${index}`} item={item} />
          )}
        </SourceContextSection>

        <SourceContextSection title="Physician discharge summary sections" items={physicianNoteItems} empty="No physician note digest attached." defaultOpen>
          {(item) => (
            <SourceContextRow
              key={`${recordString(item, 'section')}-${recordString(item, 'summary').slice(0, 20)}`}
              title={recordString(item, 'section') || 'Note section'}
              detail={stripLeadingSectionLabel(recordString(item, 'summary'), recordString(item, 'section'))}
              meta={sourceTableLabel(item)}
            />
          )}
        </SourceContextSection>

        <SourceContextSection title="ECG interpretations" items={ecgItems} empty="No source ECG interpretation rows attached." defaultOpen>
          {(item, index) => (
            <SourceContextRow
              key={`${recordString(item, 'study_id')}-${recordString(item, 'ecg_time')}-${index}`}
              title={ecgSourceTitle(item, index)}
              detail={extractEcgReportText(item)}
              meta={[ecgSourceMeta(item), sourceTableLabel(item)].filter(Boolean).join(' - ')}
              tone={ecgSourceCaveat(item) ? 'warning' : 'default'}
            />
          )}
        </SourceContextSection>

        <SourceContextSection title="ED medications" items={enrichment.edMedications.slice(0, 8)} empty="No ED medication rows attached." defaultOpen>
          {(item) => (
            <SourceContextRow
              key={`${recordString(item, 'name')}-${recordString(item, 'charttime')}-${recordString(item, 'source_table')}`}
              title={medicationLine(item)}
              meta={[recordString(item, 'event'), formatClock(recordNumber(item, 'elapsed_min')), sourceTableLabel(item)].filter(Boolean).join(' - ')}
            />
          )}
        </SourceContextSection>

        <SourceContextSection title="Repeat vitals" items={enrichment.sourceVitals.slice(0, 6)} empty="No repeat ED vitals attached." defaultOpen>
          {(item) => (
            <SourceContextRow
              key={`${recordString(item, 'charttime')}-${recordString(item, 'elapsed_min')}`}
              title={formatSourceVitals(item)}
              meta={[formatClock(recordNumber(item, 'elapsed_min')), sourceTableLabel(item)].filter(Boolean).join(' - ')}
            />
          )}
        </SourceContextSection>

        <SourceContextSection title="Home medications" items={enrichment.homeMedications.slice(0, 8)} empty="No ED medrec rows attached.">
          {(item) => (
            <SourceContextRow
              key={`${recordString(item, 'name')}-${recordString(item, 'charttime')}`}
              title={recordString(item, 'name') || 'Medication'}
              meta={[recordString(item, 'medication_class'), sourceTableLabel(item)].filter(Boolean).join(' - ')}
            />
          )}
        </SourceContextSection>

        <SourceContextSection title="Source caveats" items={enrichment.historicalReferences.slice(0, 5)} empty="No historical source caveats attached.">
          {(item) => (
            <SourceContextRow
              key={`${recordString(item, 'kind')}-${recordString(item, 'label')}`}
              title={recordString(item, 'label') || 'Historical reference'}
              detail={recordString(item, 'summary')}
              meta={[recordString(item, 'encounter_link_status'), sourceTableLabel(item)].filter(Boolean).join(' - ')}
              tone="warning"
            />
          )}
        </SourceContextSection>

        <SourceContextSection title="Real encounter timeline" items={timelineItems.slice(0, 24)} empty="No post-ED course rows attached.">
          {(item, index) => (
            <SourceContextRow
              key={`${recordString(item, 'label')}-${recordString(item, 'elapsed_min')}-${index}`}
              title={`${formatClock(recordNumber(item, 'elapsed_min'))} ${recordString(item, 'label') || 'Source event'}`}
              detail={recordString(item, 'detail')}
              meta={[recordString(item, 'category'), sourceTableLabel(item)].filter(Boolean).join(' - ')}
            />
          )}
        </SourceContextSection>

        {enrichment.provenanceNotes.length ? (
          <div className="grid gap-2">
            <strong className="text-sm">Provenance Notes</strong>
            <ul className="m-0 grid gap-2 p-0">
              {enrichment.provenanceNotes.slice(0, 4).map((note, index) => (
                <li key={`${note}-${index}`} className="list-none rounded-md border border-[#dfe7e7] bg-[#fbfcfc] p-3 font-semibold leading-6 text-[#394951]">
                  {note}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function prioritizedTimelineItems(items: Record<string, unknown>[]) {
  const priority = items.filter((item) => {
    const label = recordString(item, 'label').toLowerCase();
    const category = recordString(item, 'category').toLowerCase();
    return label.includes('physician discharge summary')
      || category === 'procedure'
      || category === 'disposition'
      || category === 'diagnosis';
  });
  return uniqueRecords([...items.slice(0, 10), ...priority])
    .sort((a, b) => recordNumber(a, 'elapsed_min') - recordNumber(b, 'elapsed_min'));
}

function prioritizedNoteDigests(items: Record<string, unknown>[]) {
  const priority = [
    'Brief Hospital Course',
    'Discharge Disposition',
    'Discharge Diagnosis',
    'Major Surgical or Invasive Procedure',
    'History of Present Illness',
    'Physical Exam',
    'Imaging Studies',
    'Discharge Instructions'
  ];
  return [...items].sort((a, b) => {
    const aIndex = priority.indexOf(recordString(a, 'section'));
    const bIndex = priority.indexOf(recordString(b, 'section'));
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  });
}

function prioritizedNoteDocuments(items: Record<string, unknown>[]) {
  return [...items].sort((a, b) => {
    const aType = `${recordString(a, 'note_type')} ${recordString(a, 'source_table')} ${recordString(a, 'title')}`.toLowerCase();
    const bType = `${recordString(b, 'note_type')} ${recordString(b, 'source_table')} ${recordString(b, 'title')}`.toLowerCase();
    const aPriority = aType.includes('discharge') || aType.includes(' ds') ? 0 : 1;
    const bPriority = bType.includes('discharge') || bType.includes(' ds') ? 0 : 1;
    return aPriority - bPriority || noteDocumentTitle(a).localeCompare(noteDocumentTitle(b));
  });
}

function prioritizedEcgInterpretations(items: Record<string, unknown>[]) {
  return [...items]
    .filter((item) => extractEcgReportText(item))
    .sort((a, b) => {
      const aDistance = ecgMatchDistance(a);
      const bDistance = ecgMatchDistance(b);
      return aDistance - bDistance || recordString(a, 'ecg_time').localeCompare(recordString(b, 'ecg_time'));
    });
}

function buildEcgInterpretationReviews(
  packageOrders: OrderResultItem[],
  resultInterpretations: Record<string, { text?: string; elapsed_minutes?: number }>,
  sourceEnrichment: SourceEnrichment
): EcgInterpretationReview[] {
  return packageOrders
    .filter((order) => isEcgOrderForReview(order))
    .map((order) => {
      const interpretation = resultInterpretations[order.order_id];
      const sourceEntries = uniqueEcgSourceEntries([
        ...ecgSourceEntriesForOrder(order, sourceEnrichment.ecgInterpretations),
        ...ecgSourceEntriesFromResult(order.result, order.order_id)
      ]);
      const sourceSummary = ecgResultNarrativeSummary(order.result);
      const sourceCaveat = ecgReviewCaveat(order.result, sourceEntries, sourceSummary);
      return {
        orderId: order.order_id,
        displayName: order.display_name,
        studentText: String(interpretation?.text || '').trim(),
        elapsedMinutes: typeof interpretation?.elapsed_minutes === 'number' ? interpretation.elapsed_minutes : undefined,
        sourceSummary,
        sourceEntries,
        sourceCaveat
      };
    })
    .filter((review) => review.studentText || review.sourceSummary || review.sourceEntries.length);
}

function isEcgOrderForReview(order: OrderResultItem) {
  return isEcgDisplayName(order.display_name) || /ecg|ekg|electrocardiogram|12_lead|12-lead/i.test(order.order_id);
}

function ecgSourceEntriesForOrder(order: OrderResultItem, items: Record<string, unknown>[]) {
  const orderId = order.order_id.toLowerCase();
  return prioritizedEcgInterpretations(items)
    .filter((item) => {
      const itemOrderId = recordString(item, 'order_id').toLowerCase();
      const itemLabel = `${recordString(item, 'display_name')} ${recordString(item, 'label')} ${recordString(item, 'title')}`.toLowerCase();
      return !itemOrderId || itemOrderId === orderId || itemLabel.includes('ecg') || itemLabel.includes('ekg') || itemLabel.includes('12-lead');
    })
    .map((item, index) => ecgSourceEntryFromRecord(item, index))
    .filter((entry): entry is EcgSourceInterpretationEntry => Boolean(entry));
}

function ecgSourceEntriesFromResult(result: ResultBundle | null | undefined, orderId: string) {
  if (!result?.source_reference || isSimulatorDefaultResult(result)) return [];
  const reference = result.source_reference;
  const records = [
    ...recordArray(reference.rows),
    ...recordArray(reference.nearest_subject_ecgs),
    ...recordArray(reference.candidates),
    ...(extractEcgReportText(reference) ? [reference] : [])
  ];
  return records
    .map((item, index) => ecgSourceEntryFromRecord({ ...item, order_id: recordString(item, 'order_id') || orderId }, index))
    .filter((entry): entry is EcgSourceInterpretationEntry => Boolean(entry));
}

function ecgSourceEntryFromRecord(item: Record<string, unknown>, index: number): EcgSourceInterpretationEntry | null {
  const interpretation = extractEcgReportText(item);
  if (!interpretation) return null;
  return {
    id: `${recordString(item, 'order_id') || 'ecg'}-${recordString(item, 'study_id') || index}-${recordString(item, 'ecg_time') || index}`,
    title: ecgSourceTitle(item, index),
    interpretation,
    meta: ecgSourceMeta(item),
    caveat: ecgSourceCaveat(item)
  };
}

function uniqueEcgSourceEntries(entries: EcgSourceInterpretationEntry[]) {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = `${entry.title}|${entry.interpretation}|${entry.meta}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function ecgResultNarrativeSummary(result: ResultBundle | null | undefined) {
  if (!result || isSimulatorDefaultResult(result)) return '';
  const narrative = String(result.narrative || '').trim();
  return narrative;
}

function ecgReviewCaveat(result: ResultBundle | null | undefined, entries: EcgSourceInterpretationEntry[], sourceSummary: string) {
  const subjectLevel = isSubjectLevelReference(result)
    || entries.some((entry) => entry.caveat)
    || /subject-level|subject only|no same-encounter/i.test(sourceSummary);
  if (!subjectLevel) return '';
  return 'MIMIC-IV-ECG did not provide a same-encounter ED ECG machine interpretation for this stay; compare against these subject-level source references with that caveat.';
}

function ecgComparisonTextForPrompt(review: EcgInterpretationReview) {
  const sourceEntries = review.sourceEntries.slice(0, 4).map((entry) => `${entry.title}: ${entry.interpretation}`);
  const sourceText = sourceEntries.length
    ? sourceEntries.join(' | ')
    : review.sourceSummary || 'No source ECG interpretation attached.';
  const extraCount = review.sourceEntries.length > sourceEntries.length ? ` ${review.sourceEntries.length - sourceEntries.length} additional source interpretation(s) available in source context.` : '';
  return [
    `${review.displayName}: learner read: ${review.studentText || 'not saved'}`,
    `source read(s): ${sourceText}${extraCount}`,
    review.sourceCaveat ? `caveat: ${review.sourceCaveat}` : ''
  ].filter(Boolean).join('; ');
}

function extractEcgReportText(record: Record<string, unknown>) {
  const directKeys = [
    'interpretation',
    'machine_interpretation',
    'machine_report',
    'report',
    'report_text',
    'diagnosis',
    'statement',
    'narrative'
  ];
  const direct = directKeys.map((key) => compactWhitespace(recordString(record, key))).filter(Boolean);
  const reportParts = Object.keys(record)
    .filter((key) => /^report_\d+$/i.test(key))
    .sort((a, b) => Number(a.replace(/\D/g, '')) - Number(b.replace(/\D/g, '')))
    .map((key) => compactWhitespace(recordString(record, key)))
    .filter(Boolean);
  return uniqueStrings([...direct, ...reportParts]).join(' ').trim();
}

function ecgSourceTitle(record: Record<string, unknown>, index: number) {
  const title = recordString(record, 'title') || recordString(record, 'label');
  if (title) return title;
  const studyId = recordString(record, 'study_id');
  return studyId ? `MIMIC ECG study ${studyId}` : `MIMIC ECG interpretation ${index + 1}`;
}

function ecgSourceMeta(record: Record<string, unknown>) {
  const studyId = recordString(record, 'study_id');
  const ecgTime = recordString(record, 'ecg_time');
  const rrInterval = recordString(record, 'rr_interval') || recordString(record, 'rr');
  const pieces = [
    ecgTime ? `ECG ${formatSourceTimestamp(ecgTime)}` : '',
    studyId ? `Study ${studyId}` : '',
    rrInterval ? `RR ${rrInterval} ms` : '',
    recordString(record, 'match_basis')
  ];
  return pieces.filter(Boolean).join(' - ');
}

function ecgSourceCaveat(record: Record<string, unknown>) {
  const status = `${recordString(record, 'encounter_link_status')} ${recordString(record, 'match_basis')}`.toLowerCase();
  if (record.requires_manual_verification === true || status.includes('subject_only') || status.includes('subject only') || status.includes('outside')) return 'Historical';
  return '';
}

function ecgMatchDistance(record: Record<string, unknown>) {
  const value = recordNumber(record, 'match_distance_seconds');
  return value > 0 ? value : Number.MAX_SAFE_INTEGER;
}

function SourceNoteDocumentRow({ item }: { item: Record<string, unknown> }) {
  const text = recordLongText(item);
  return (
    <article className="rounded-md border border-[#dfe7e7] bg-[#fbfcfc]">
      <div className="border-b border-[#e4e9e9] px-3 py-2">
        <strong className="block text-[#27313a]">{noteDocumentTitle(item)}</strong>
        <span className="mt-1 block text-xs font-bold text-[#607078]">
          {[noteDocumentMetadata(item), text ? `${text.length.toLocaleString()} characters` : 'No note text'].filter(Boolean).join(' - ')}
        </span>
      </div>
      {text ? (
        <pre className="m-0 max-h-[520px] overflow-auto whitespace-pre-wrap break-words px-3 py-3 font-mono text-xs leading-5 text-[#27313a]" data-testid="source-original-note">
          {text}
        </pre>
      ) : (
        <p className="m-0 px-3 py-3 font-semibold text-[#607078]">No note text attached.</p>
      )}
    </article>
  );
}

function noteDocumentTitle(record: Record<string, unknown>) {
  return recordString(record, 'title')
    || recordString(record, 'section')
    || (recordString(record, 'note_type') === 'DS' ? 'Discharge summary note' : recordString(record, 'note_type'))
    || 'Source note document';
}

function noteDocumentMetadata(record: Record<string, unknown>) {
  const reference = isPlainRecord(record.source_reference) ? record.source_reference : {};
  return [
    sourceTableLabel(record),
    recordString(record, 'note_id') || recordString(reference, 'note_id'),
    recordString(record, 'charttime') || recordString(reference, 'charttime')
  ].filter(Boolean).join(' - ');
}

function noteDocumentTextForPrompt(record: Record<string, unknown>) {
  const text = recordLongText(record);
  if (!text) return '';
  return [
    `--- ${noteDocumentTitle(record)} ---`,
    noteDocumentMetadata(record),
    text
  ].filter(Boolean).join('\n');
}

function uniqueRecords(items: Record<string, unknown>[]) {
  const seen = new Set<string>();
  const output: Record<string, unknown>[] = [];
  items.forEach((item) => {
    const key = JSON.stringify(item);
    if (seen.has(key)) return;
    seen.add(key);
    output.push(item);
  });
  return output;
}

function SourceContextSection({
  title,
  items,
  empty,
  children,
  defaultOpen = false
}: {
  title: string;
  items: Record<string, unknown>[];
  empty: string;
  children: (item: Record<string, unknown>, index: number) => React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="rounded-md border border-[#d7dfdf] bg-white" open={defaultOpen}>
      <summary className="cursor-pointer px-3 py-2 text-sm font-extrabold text-[#17232b]">
        {title}
      </summary>
      <div className="grid gap-2 border-t border-[#e4e9e9] bg-[#fbfcfc] p-3">
        {items.length ? items.map((item, index) => children(item, index)) : (
          <div className="rounded-md border border-dashed border-[#cdd8d8] bg-white p-3 font-semibold text-[#607078]">{empty}</div>
        )}
      </div>
    </details>
  );
}

function SourceContextRow({
  title,
  detail = '',
  meta = '',
  tone = 'default'
}: {
  title: string;
  detail?: string;
  meta?: string;
  tone?: 'default' | 'warning';
}) {
  const toneClass = tone === 'warning' ? 'border-[#e6c6a0] bg-[#fff8e8]' : 'border-[#dfe7e7] bg-[#fbfcfc]';
  return (
    <div className={`rounded-md border px-3 py-2.5 ${toneClass}`}>
      <div className="font-extrabold text-[#27313a]">{title}</div>
      {detail ? <p className="m-0 mt-1 leading-6 text-[#394951]">{detail}</p> : null}
      {meta ? <div className="mt-1 text-xs font-bold text-[#607078]">{meta}</div> : null}
    </div>
  );
}

function recordString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (value === null || value === undefined || typeof value === 'object') return '';
  return String(value);
}

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = value.toLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function recordLongText(record: Record<string, unknown>) {
  return [
    'text',
    'full_text',
    'note_text',
    'raw_text',
    'original_text',
    'document_text'
  ].map((key) => recordString(record, key)).find((value) => value.trim()) || '';
}

function recordNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sourceTableLabel(record: Record<string, unknown>) {
  const module = recordString(record, 'source_module');
  const table = recordString(record, 'source_table');
  const normalized = `${module} ${table}`.toLowerCase();
  if (normalized.includes('note.discharge')) return 'MIMIC-IV discharge summary';
  if (normalized.includes('ed.medrecon')) return 'MIMIC-IV ED medication reconciliation';
  if (normalized.includes('ed.vitalsign')) return 'MIMIC-IV ED vitals';
  if (normalized.includes('ed.pyxis')) return 'MIMIC-IV ED medication pull';
  if (normalized.includes('emar')) return 'MIMIC-IV hospital medication record';
  if (normalized.includes('diagnoses_icd')) return 'MIMIC-IV hospital diagnoses';
  if (normalized.includes('procedures_icd')) return 'MIMIC-IV hospital procedures';
  if (normalized.includes('transfers')) return 'MIMIC-IV hospital transfers';
  if (normalized.includes('services')) return 'MIMIC-IV hospital service';
  if (normalized.includes('mimic-iv-ecg')) return 'MIMIC-IV ECG';
  if (!module && recordString(record, 'note_type').toLowerCase().includes('discharge')) return 'MIMIC-IV discharge summary';
  return [module, table].filter(Boolean).join(' ');
}

function stripLeadingSectionLabel(summary: string, section: string) {
  const text = summary.trim();
  const label = section.trim();
  if (!text || !label) return text;
  const prefix = `${label}:`;
  return text.toLowerCase().startsWith(prefix.toLowerCase()) ? text.slice(prefix.length).trim() : text;
}

function medicationLine(record: Record<string, unknown>) {
  const pieces = [recordString(record, 'name'), recordString(record, 'dose'), recordString(record, 'route') ? `via ${recordString(record, 'route')}` : ''];
  return pieces.filter(Boolean).join(' ');
}

function formatSourceVitals(record: Record<string, unknown>) {
  const vitals = isPlainRecord(record.vitals) ? record.vitals : {};
  const bp = recordString(vitals, 'sbp') && recordString(vitals, 'dbp') ? `${recordString(vitals, 'sbp')}/${recordString(vitals, 'dbp')}` : '';
  const pieces = [
    recordString(vitals, 'temp_f') ? `T ${recordString(vitals, 'temp_f')} F` : recordString(vitals, 'temp_c') ? `T ${recordString(vitals, 'temp_c')} C` : '',
    recordString(vitals, 'hr') ? `HR ${recordString(vitals, 'hr')}` : '',
    bp ? `BP ${bp}` : '',
    recordString(vitals, 'rr') ? `RR ${recordString(vitals, 'rr')}` : '',
    recordString(vitals, 'spo2') ? `SpO2 ${recordString(vitals, 'spo2')}%` : '',
    recordString(vitals, 'pain') ? `Pain ${recordString(vitals, 'pain')}/10` : ''
  ];
  return pieces.filter(Boolean).join(', ') || 'Vital signs row';
}

function TimelineColumn({ title, items }: { title: string; items: Array<{ elapsed_min: number; label: string; detail: string }> }) {
  return (
    <div className="grid content-start gap-2">
      <strong className="text-sm">{title}</strong>
      {items.slice(0, 18).map((item, index) => (
        <article key={`${item.elapsed_min}-${index}`} className="rounded-md border border-[#dfe7e7] bg-[#fbfcfc] p-3">
          <div className="flex justify-between gap-3 text-xs font-bold text-[#607078]">
            <span>{item.label}</span>
            <span>{formatClock(item.elapsed_min)}</span>
          </div>
          <p className="m-0 mt-1 text-sm leading-6">{item.detail}</p>
        </article>
      ))}
    </div>
  );
}

type ActionFeedbackItem = {
  action_id?: string | null;
  label: string;
  message: string;
  grounded: boolean;
  evidence_id?: string | null;
  evidence_note: string;
  elapsed_minutes?: number | null;
};

function ActionFeedbackSection({ title, items, empty, testId }: { title: string; items: ActionFeedbackItem[]; empty: string; testId: string }) {
  return (
    <section className="grid gap-2" data-testid={testId}>
      <strong className="text-sm">{title}</strong>
      {items.length ? items.map((item, index) => (
        <article key={`${item.action_id || item.label}-${index}`} className="rounded-md border border-[#dfe7e7] bg-[#fbfcfc] p-3">
          <div className="mb-1 flex items-center justify-between gap-3">
            <span className="font-bold text-[#394951]">{item.label}</span>
            {typeof item.elapsed_minutes === 'number' ? <span className="text-xs font-bold text-[#607078]">{formatClock(item.elapsed_minutes)}</span> : null}
          </div>
          <p className="m-0 leading-6 text-[#27313a]">{item.message}</p>
          <p className={`m-0 mt-2 text-xs font-bold ${item.grounded ? 'text-[#0f5f58]' : 'text-[#7f1d1d]'}`}>
            {item.grounded ? `Grounded: ${item.evidence_id || item.evidence_note}` : item.evidence_note}
          </p>
        </article>
      )) : (
        <div className="rounded-md border border-dashed border-[#cdd8d8] bg-[#fbfcfc] p-3 font-semibold text-[#607078]">{empty}</div>
      )}
    </section>
  );
}

function TimedActionList({ title, rows, empty }: { title: string; rows: Array<{ id: string; label: string; elapsed: number; detail: string }>; empty: string }) {
  return (
    <section className="grid gap-2">
      <strong className="text-sm">{title}</strong>
      {rows.length ? rows.map((row) => (
        <article key={`${row.id}-${row.elapsed}`} className="rounded-md border border-[#dfe7e7] bg-[#fbfcfc] p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="font-bold text-[#394951]">{row.label}</span>
            <span className="text-xs font-bold text-[#607078]">{formatClock(row.elapsed)}</span>
          </div>
          <p className="m-0 mt-1 leading-6 text-[#27313a]">{row.detail}</p>
        </article>
      )) : (
        <div className="rounded-md border border-dashed border-[#cdd8d8] bg-[#fbfcfc] p-3 font-semibold text-[#607078]">{empty}</div>
      )}
    </section>
  );
}

function EcgInterpretationReviewPanel({ reviews }: { reviews: EcgInterpretationReview[] }) {
  return (
    <article className="rounded-lg border border-[#d7dfdf] bg-white p-4" data-testid="ecg-interpretation-review">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-base font-extrabold">ECG Interpretation Comparison</h2>
          <p className="m-0 mt-1 text-sm font-semibold leading-6 text-[#52636b]">Learner-read ECG text is shown beside source-recorded MIMIC ECG interpretation text after completion.</p>
        </div>
        <span className="rounded-md border border-[#dfe7e7] bg-[#fbfcfc] px-2 py-1 text-xs font-extrabold text-[#394951]">{reviews.length} comparison{reviews.length === 1 ? '' : 's'}</span>
      </div>
      <div className="grid gap-3 text-sm">
        {reviews.map((review) => {
          const hasStudent = Boolean(review.studentText.trim());
          const hasSource = Boolean(review.sourceSummary.trim() || review.sourceEntries.length);
          return (
            <section key={review.orderId} className="grid gap-3 rounded-md border border-[#dfe7e7] bg-[#fbfcfc] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-[#17232b]">{review.displayName}</strong>
                <div className="flex flex-wrap items-center gap-2">
                  {typeof review.elapsedMinutes === 'number' ? <span className="text-xs font-bold text-[#607078]">{formatClock(review.elapsedMinutes)}</span> : null}
                  <span className={`rounded-md border px-2 py-1 text-xs font-extrabold ${hasStudent && hasSource ? 'border-[#bcd9c1] bg-[#edf8ef] text-[#1d6b34]' : 'border-[#e6c6a0] bg-[#fff8e8] text-[#7c4a00]'}`}>
                    {hasStudent && hasSource ? 'Ready to compare' : hasStudent ? 'Missing source read' : 'No saved learner read'}
                  </span>
                </div>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <section className="rounded-md border border-[#dfe7e7] bg-white p-3" data-testid="ecg-learner-read">
                  <strong className="block text-xs uppercase text-[#607078]">Learner ECG interpretation</strong>
                  <p className="m-0 mt-2 whitespace-pre-wrap break-words text-sm font-semibold leading-6 text-[#27313a]">
                    {hasStudent ? review.studentText : 'No ECG interpretation was saved before completion.'}
                  </p>
                </section>
                <section className="rounded-md border border-[#dfe7e7] bg-white p-3">
                  <strong className="block text-xs uppercase text-[#607078]">Source ECG summary</strong>
                  <p className="m-0 mt-2 whitespace-pre-wrap break-words text-sm font-semibold leading-6 text-[#27313a]">
                    {review.sourceSummary || (review.sourceEntries.length ? `${review.sourceEntries.length} source ECG interpretation rows are attached below.` : 'No source ECG interpretation text is attached to this bundle.')}
                  </p>
                </section>
              </div>
              {review.sourceEntries.length ? (
                <section className="rounded-md border border-[#dfe7e7] bg-white p-3" data-testid="ecg-source-read">
                  <strong className="block text-xs uppercase text-[#607078]">Source ECG interpretation rows</strong>
                  <div className="mt-3 grid gap-2 xl:grid-cols-2">
                    {review.sourceEntries.map((entry) => (
                      <article key={entry.id} className="rounded-md border border-[#dfe7e7] bg-[#fbfcfc] p-2" data-testid="ecg-source-entry">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <strong className="text-[#27313a]">{entry.title}</strong>
                          {entry.caveat ? <span className="rounded-sm bg-[#fff3d7] px-1.5 py-0.5 text-[11px] font-extrabold text-[#7c4a00]">{entry.caveat}</span> : null}
                        </div>
                        <p className="m-0 mt-1 whitespace-pre-wrap break-words font-semibold leading-6 text-[#27313a]">{entry.interpretation}</p>
                        {entry.meta ? <div className="mt-1 text-xs font-bold text-[#607078]">{entry.meta}</div> : null}
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}
              {!hasSource ? (
                <div className="rounded-md border border-dashed border-[#cdd8d8] bg-white p-3 font-semibold text-[#607078]">No source ECG interpretation text is attached to this bundle.</div>
              ) : null}
              {review.sourceCaveat ? (
                <div className="rounded-md border border-[#e6c6a0] bg-[#fff8e8] px-3 py-2 text-sm font-semibold leading-6 text-[#7c4a00]">
                  {review.sourceCaveat}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </article>
  );
}

function DebriefFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3">
      <dt className="font-bold text-[#607078]">{label}</dt>
      <dd className="m-0 font-semibold">{value}</dd>
    </div>
  );
}

function FeedbackRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-md border border-[#dfe7e7] bg-[#fbfcfc] p-3 sm:grid-cols-[140px_minmax(0,1fr)]">
      <span className="font-bold text-[#607078]">{label}</span>
      <strong className="min-w-0 whitespace-pre-wrap break-words">{value}</strong>
    </div>
  );
}

function formatClock(minutes: number) {
  const whole = Math.max(0, Math.round(minutes));
  const hrs = Math.floor(whole / 60);
  const mins = whole % 60;
  return hrs ? `${hrs}h ${mins}m` : `${mins}m`;
}

function formatDigitalClock(minutes: number) {
  const totalSeconds = Math.max(0, Math.round(minutes * 60));
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatMinuteStamp(minutes: number) {
  const whole = Math.max(0, Math.round(minutes));
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
}

function formatCost(cost: number) {
  return `$${cost.toFixed(4)}`;
}

function flagLabel(value: unknown) {
  return value ? 'Complete' : 'Missing';
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function normalizeActionFeedback(raw: unknown): {
  omissions_that_mattered: ActionFeedbackItem[];
  timing_sequence: ActionFeedbackItem[];
  interventions: { appropriate: ActionFeedbackItem[]; missed: ActionFeedbackItem[]; excessive: ActionFeedbackItem[] };
  positive_reinforcement: ActionFeedbackItem[];
} {
  const source = (raw || {}) as Record<string, unknown>;
  const interventions = (source.interventions || {}) as Record<string, unknown>;
  return {
    omissions_that_mattered: asActionFeedbackItems(source.omissions_that_mattered),
    timing_sequence: asActionFeedbackItems(source.timing_sequence),
    interventions: {
      appropriate: asActionFeedbackItems(interventions.appropriate),
      missed: asActionFeedbackItems(interventions.missed),
      excessive: asActionFeedbackItems(interventions.excessive)
    },
    positive_reinforcement: asActionFeedbackItems(source.positive_reinforcement)
  };
}

function asActionFeedbackItems(raw: unknown): ActionFeedbackItem[] {
  return Array.isArray(raw) ? raw.filter((item): item is ActionFeedbackItem => Boolean(item && typeof item === 'object' && 'message' in item)) : [];
}

function regionLabel(region: string) {
  if (region === 'cardiovascular') return 'CV';
  return region;
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((first, second) => first.localeCompare(second));
}

function labelForSpeaker(speaker: string) {
  if (speaker === 'student') return 'Student';
  if (speaker === 'patient') return 'Patient';
  if (speaker === 'nurse') return 'Nurse';
  if (speaker === 'consultant') return 'Consultant';
  if (speaker === 'exam') return 'Exam';
  if (speaker === 'results') return 'Results';
  return 'System';
}

function labelForMessage(message: TranscriptMessage) {
  if (message.metadata?.type === 'clinical_note') return 'Note';
  if (message.speaker === 'exam') {
    const region = String(message.metadata?.region || '').trim();
    return region ? `Exam - ${regionLabel(region)}` : 'Exam';
  }
  return labelForSpeaker(message.speaker);
}

function numericVital(vital: string, values: VitalSigns): number | null {
  if (vital === 'hr') return values.hr;
  if (vital === 'spo2') return values.spo2;
  if (vital === 'rr') return values.rr;
  if (vital === 'bp') return values.sbp;
  if (vital === 'pain') return values.pain;
  if (vital === 'temp') return values.temp_c;
  return null;
}

function formatDelta(delta: number) {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

function orderStatusSummary(order: OrderResultItem) {
  if (order.status === 'resulted') return 'Result ready. Opened in the result viewer.';
  if (order.status === 'unavailable') return 'No source-recorded result is available.';
  if (order.status === 'resulting') return `Result due at ${formatClock(order.result_due_at_min || 0)}.`;
  if (order.result_due_at_min !== undefined) return `Ordered at ${formatClock(order.ordered_at_min || 0)}; due at ${formatClock(order.result_due_at_min)}.`;
  return 'Ordered.';
}

function isDiagnosticOrderItem(order: OrderResultItem) {
  return ['lab', 'imaging', 'study', 'result'].includes(order.order_type);
}

function patientVisualAlt(snapshot: Snapshot) {
  const demographics = snapshot.visible_start.demographics;
  const sex = String(demographics.sex || '').trim();
  const ageBucket = ageBucketLabel(demographics.age);
  return `${[ageBucket, sex, 'patient'].filter(Boolean).join(' ')} visual for ${snapshot.visible_start.chief_complaint}.`;
}

function ageBucketLabel(age: unknown) {
  const value = Number(age);
  if (!Number.isFinite(value) || value <= 0) return '';
  if (value >= 70) return 'older adult';
  if (value >= 45) return 'middle-aged';
  if (value >= 18) return 'adult';
  return 'pediatric';
}

function fallbackAvatarTone(caseId: string) {
  const tones = [
    { bg: '#eef2f2', fg: '#26323a' },
    { bg: '#e9f4f1', fg: '#0f5f58' },
    { bg: '#f6efe6', fg: '#6b4a1d' },
    { bg: '#edf1f7', fg: '#34445c' }
  ];
  const hash = Array.from(caseId).reduce((total, char) => total + char.charCodeAt(0), 0);
  return tones[hash % tones.length];
}

function simulatedMonitorVitals(base: VitalSigns, elapsedMinutes: number, tick: number): VitalSigns {
  const seconds = elapsedMinutes * 60 + tick * 0.18;
  return {
    ...base,
    hr: clampInt(base.hr + Math.round(Math.sin(seconds * 0.42) * 2 + Math.sin(seconds * 0.11) * 1), 25, 240),
    spo2: clampInt(base.spo2 + Math.round(Math.sin(seconds * 0.16) * 0.8 + Math.sin(seconds * 0.49) * 0.4), 60, 100),
    rr: clampInt(base.rr + Math.round(Math.sin(seconds * 0.2) * 1.2), 4, 60),
    sbp: clampInt(base.sbp + Math.round(Math.sin(seconds * 0.13) * 3 + Math.sin(seconds * 0.31) * 1), 50, 260),
    dbp: clampInt(base.dbp + Math.round(Math.sin(seconds * 0.12) * 2 + Math.sin(seconds * 0.29) * 1), 30, 160)
  };
}

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function buildWavePoints(kind: string, vitalValue: number, tick: number) {
  const points: string[] = [];
  const width = 180;
  const height = 44;
  const seconds = tick * 0.18;
  const sweepSeconds = kind === 'resp' ? 11 : 3.8;
  const ratePerMinute = kind === 'resp' ? Math.max(6, vitalValue) : Math.max(35, vitalValue || 82);
  for (let x = 0; x <= width; x += 2) {
    const phase = ((x / width) * sweepSeconds * (ratePerMinute / 60) + seconds * (ratePerMinute / 60)) % 1;
    const y = waveformY(kind, phase, x, tick, height);
    points.push(`${x},${y.toFixed(2)}`);
  }
  return points.join(' ');
}

function buildDefaultEcgPoints(width: number, height: number, variant: number) {
  const points: string[] = [];
  const polarityByLead = [1, -0.7, -0.45, 0.95, 1.12, -0.55, 1.18, 1.02, 0.82, 0.76, 1.08, 1.0, 1.15];
  const polarity = polarityByLead[variant % polarityByLead.length] || 1;
  const baseline = height * (variant % 4 === 1 ? 0.5 : 0.56);
  const beatCount = Math.max(3, Math.floor(width / 82));
  const phaseOffset = (variant % 3) * 0.035;

  for (let x = 0; x <= width; x += 2) {
    const phase = (((x / width) * beatCount) + phaseOffset) % 1;
    const drift = Math.sin(x * 0.03 + variant * 0.7) * 0.75;
    const wave =
      -gaussian(phase, 0.18, 0.035) * 0.04
      + gaussian(phase, 0.275, 0.012) * 0.1
      - gaussian(phase, 0.305, 0.0065) * 0.34
      + gaussian(phase, 0.335, 0.013) * 0.18
      - gaussian(phase, 0.58, 0.075) * 0.13;
    const y = baseline + drift + wave * polarity * height;
    points.push(`${x},${y.toFixed(2)}`);
  }

  return points.join(' ');
}

function waveformY(kind: string, phase: number, x: number, tick: number, height: number) {
  const baseline = height / 2;
  const drift = Math.sin((x + tick) * 0.12) * 0.9;
  if (kind === 'ecg') {
    return baseline + drift
      - gaussian(phase, 0.16, 0.035) * 2.8
      + gaussian(phase, 0.255, 0.012) * 5
      - gaussian(phase, 0.285, 0.008) * 19
      + gaussian(phase, 0.315, 0.014) * 8
      - gaussian(phase, 0.55, 0.075) * 5.2;
  }
  if (kind === 'pleth') {
    const upstroke = phase < 0.22 ? -14 * Math.sin((phase / 0.22) * Math.PI * 0.5) : 0;
    const decay = phase >= 0.22 ? -14 * Math.exp(-(phase - 0.22) * 4.2) : 0;
    const notch = phase > 0.47 && phase < 0.57 ? 2.8 * Math.sin(((phase - 0.47) / 0.1) * Math.PI) : 0;
    return baseline + upstroke + decay + notch + drift;
  }
  if (kind === 'resp') {
    return baseline - Math.sin(phase * Math.PI * 2) * 8 + drift * 0.4;
  }
  if (kind === 'bp') {
    const systolic = phase < 0.16 ? -15 * Math.sin((phase / 0.16) * Math.PI * 0.5) : 0;
    const runoff = phase >= 0.16 ? -15 * Math.exp(-(phase - 0.16) * 3.5) : 0;
    const dicrotic = phase > 0.37 && phase < 0.45 ? 3.5 * Math.sin(((phase - 0.37) / 0.08) * Math.PI) : 0;
    return baseline + systolic + runoff + dicrotic + drift;
  }
  return baseline + drift;
}

function gaussian(value: number, center: number, width: number) {
  const distance = value - center;
  return Math.exp(-(distance * distance) / (2 * width * width));
}

function monitorTrendPoints(snapshot: Snapshot, liveVitals?: VitalSigns, tick = 0) {
  const anchors = [
    { elapsed: 0, vitals: snapshot.visible_start.presenting_vitals },
    ...snapshot.intervention_events.map((event) => ({ elapsed: event.applied_at_min, vitals: event.vitals_after })),
    { elapsed: snapshot.elapsed_minutes, vitals: liveVitals || snapshot.current_vitals }
  ].sort((left, right) => left.elapsed - right.elapsed);
  const start = snapshot.elapsed_minutes - 30;
  const sampleCount = 13;
  return Array.from({ length: sampleCount }, (_, index) => {
    const elapsed = start + (index / (sampleCount - 1)) * 30;
    const base = [...anchors].reverse().find((point) => point.elapsed <= elapsed) || anchors[0];
    return {
      elapsed,
      vitals: simulatedMonitorVitals(base.vitals, elapsed, tick + index * 5)
    };
  });
}

function buildTrendPolyline(points: Array<{ elapsed: number; vitals: VitalSigns }>, vital: string, min: number, max: number, width: number, height: number) {
  if (!points.length) return '';
  const first = points[0]?.elapsed || 0;
  const last = Math.max(points.at(-1)?.elapsed || 0, first + 1);
  return points.map((point) => {
    const value = numericVital(vital, point.vitals) ?? min;
    const x = 7 + ((point.elapsed - first) / (last - first)) * width;
    const clamped = Math.max(min, Math.min(max, value));
    const y = 6 + (1 - (clamped - min) / (max - min)) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

function statusClass(status: OrderRecord['status']) {
  if (status === 'resulted') return 'bg-[#eaf6f3] text-[#0f5f58]';
  if (status === 'unavailable') return 'bg-[#fff1f1] text-[#7f1d1d]';
  if (status === 'resulting') return 'bg-[#fffaf0] text-[#7a5514]';
  return 'bg-[#eef2f2] text-[#52636b]';
}

export default ClinicalReasoningSimulator;
