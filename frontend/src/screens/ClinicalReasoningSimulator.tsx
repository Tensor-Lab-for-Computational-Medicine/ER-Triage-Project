import React from 'react';
import {
  ArrowClockwise,
  ArrowsOut,
  CaretUp,
  ChatCircleText,
  CheckCircle,
  ClipboardText,
  Clock,
  DotsThreeVertical,
  DownloadSimple,
  FirstAidKit,
  Flask,
  GearSix,
  MagnifyingGlass,
  NotePencil,
  Pause,
  Play,
  Plus,
  Pulse,
  SignOut,
  Stethoscope,
  UserCircle,
  Warning
} from '@phosphor-icons/react';
import { CaseStatus, EncounterProvider, ExamManeuver, ExamRecord, OrderRecord, ResultBundle, Snapshot, TokenUsageRecord, TranscriptMessage, VitalSigns, useEncounter } from '../store/encounterStore';
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
        <div className="mx-auto grid max-w-2xl gap-3 rounded-lg border border-[#d7dfdf] bg-white p-5">
          <strong>Backend unavailable</strong>
          <p className="m-0 text-sm text-[#607078]">{error || 'Start the FastAPI server and reload this route.'}</p>
          <button type="button" className="inline-flex h-10 w-fit items-center gap-2 rounded-md border border-[#cdd8d8] px-3 text-sm font-semibold" onClick={encounter.start}>
            <ArrowClockwise size={17} /> Retry
          </button>
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
      <Header snapshot={session.snapshot} caseStatus={session.case_status} />
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

function Header({ snapshot, caseStatus }: { snapshot: Snapshot; caseStatus?: CaseStatus }) {
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
        <button type="button" className="grid h-9 w-9 place-items-center rounded-md border border-[#cdd8d8] bg-white text-[#17232b]" title="Settings">
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

  if (connected) {
    return (
      <section className="rounded-lg border border-[#d7dfdf] bg-white px-3 py-2" data-testid="ai-status-panel">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <ChatCircleText size={16} weight="bold" />
          <p className="m-0 min-w-0 flex-1 truncate text-xs font-semibold text-[#31534f]" data-testid="ai-status-message">
            Connected: {status?.provider} / {status?.cheap_model}
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
        {status?.message || 'AI provider is not configured.'}
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
      <form
        className="mt-3 grid gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void encounter.configureAi();
        }}
      >
        <select
          data-testid="ai-provider"
          value={encounter.aiProviderDraft}
          onChange={(event) => {
            const next = event.target.value as 'openai_responses' | 'openai_compatible' | 'openrouter';
            encounter.setAiProviderDraft(next);
            if (next === 'openrouter') {
              encounter.setAiBaseUrlDraft('https://openrouter.ai/api/v1/chat/completions');
              encounter.setAiCheapModelDraft('openai/gpt-4o-mini');
              encounter.setAiStrongModelDraft('openai/gpt-4o');
            }
            if (next === 'openai_responses') {
              encounter.setAiBaseUrlDraft('');
              encounter.setAiCheapModelDraft('gpt-5.4-mini');
              encounter.setAiStrongModelDraft('gpt-5.5');
            }
          }}
          className="h-10 rounded-md border border-[#e8b5b5] bg-white px-3 text-sm outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/20"
        >
          <option value="openai_responses">OpenAI</option>
          <option value="openrouter">OpenRouter</option>
          <option value="openai_compatible">OpenAI-compatible</option>
        </select>
        <input
          data-testid="ai-api-key"
          type="password"
          value={encounter.aiKeyDraft}
          onChange={(event) => encounter.setAiKeyDraft(event.target.value)}
          placeholder="OpenAI API key"
          className="h-10 rounded-md border border-[#e8b5b5] bg-white px-3 text-sm outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/20"
        />
        <input
          data-testid="ai-base-url"
          value={encounter.aiBaseUrlDraft}
          onChange={(event) => encounter.setAiBaseUrlDraft(event.target.value)}
          disabled={encounter.aiProviderDraft === 'openai_responses' || encounter.aiProviderDraft === 'openrouter'}
          placeholder={encounter.aiProviderDraft === 'openai_responses' ? 'OpenAI Responses API' : 'Compatible base URL'}
          className="h-10 rounded-md border border-[#e8b5b5] bg-white px-3 text-sm outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/20"
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            data-testid="ai-cheap-model"
            value={encounter.aiCheapModelDraft}
            onChange={(event) => encounter.setAiCheapModelDraft(event.target.value)}
            placeholder="Dialogue model"
            className="h-10 min-w-0 rounded-md border border-[#e8b5b5] bg-white px-3 text-sm outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/20"
          />
          <input
            data-testid="ai-strong-model"
            value={encounter.aiStrongModelDraft}
            onChange={(event) => encounter.setAiStrongModelDraft(event.target.value)}
            placeholder="Strong model"
            className="h-10 min-w-0 rounded-md border border-[#e8b5b5] bg-white px-3 text-sm outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/20"
          />
        </div>
        <button data-testid="ai-connect" type="submit" disabled={encounter.busy} className="h-10 rounded-md bg-[#0f766e] text-sm font-extrabold text-white disabled:bg-[#dce4e4] disabled:text-[#738088]">
          {encounter.busy ? 'Checking...' : 'Connect AI'}
        </button>
      </form>
    </section>
  );
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
    <section className="grid min-h-0 min-w-0 grid-rows-[auto_auto_minmax(0,1fr)_auto] rounded-lg border border-[#d7dfdf] bg-white">
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
      <div className="min-h-0 overflow-auto p-4">
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
      {order.result?.values.length && !isDefaultEcg ? <ResultValueSummary result={order.result} /> : null}
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
  const showArtifactPreview = Boolean(primary && artifactKind && hasSourceBackedResult && !isDefaultEcg);
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
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-md px-2 py-1 text-xs font-extrabold ${statusClass(item.status)}`}>{titleCase(item.status)}</span>
          {primary ? <span className="text-xs font-bold text-[#607078]">{formatMinuteStamp(item.result_due_at_min ?? item.ordered_at_min ?? 0)}</span> : null}
        </div>
      </div>
      <div className={`grid gap-3 p-3 ${showArtifactPreview ? 'sm:grid-cols-[170px_minmax(0,1fr)]' : ''}`}>
        {isDefaultEcg && result ? (
          <DefaultEcgTracing compact={!primary} />
        ) : showArtifactPreview && artifactKind && result ? (
          <ResultArtifactPreview kind={artifactKind} result={result} />
        ) : null}
        {!isDefaultEcg ? <div className="min-w-0">
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

function ResultArtifactPreview({ kind, result }: { kind: 'imaging' | 'ecg'; result: ResultBundle }) {
  const reference = result.source_reference || {};
  const label = kind === 'ecg' ? 'ECG report' : 'Imaging report';
  const charttime = typeof reference.charttime === 'string' ? reference.charttime : null;
  const studyId = typeof reference.study_id === 'string' || typeof reference.study_id === 'number' ? String(reference.study_id) : null;
  const noteId = typeof reference.note_id === 'string' || typeof reference.note_id === 'number' ? String(reference.note_id) : null;

  return (
    <div className="grid content-start gap-2 rounded-md border border-[#dfe7e7] bg-[#fbfcfc] p-3 text-xs text-[#52636b]">
      <strong className="text-sm text-[#17232b]">{label}</strong>
      <span>{sourceLabel(result)}</span>
      {charttime ? <span>Charted {formatSourceTimestamp(charttime)}</span> : null}
      {studyId || noteId ? <span>{studyId ? `Study ${studyId}` : `Note ${noteId}`}</span> : null}
      {kind === 'ecg' ? (
        <span className="rounded-md border border-dashed border-[#cdd8d8] bg-white p-2 font-semibold">
          ECG waveform/image viewer appears only when a source ECG artifact is attached.
        </span>
      ) : null}
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
          </div>
          <button type="button" className="rounded-md border border-[#cdd8d8] px-3 py-2 text-sm font-bold" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="min-h-0 overflow-auto p-4">
          {isDefaultEcg ? (
            <DefaultEcgTracing expanded />
          ) : isEcg ? (
            <div className="mb-3 rounded-md border border-dashed border-[#cdd8d8] bg-[#fbfcfc] p-3 text-sm font-semibold leading-6 text-[#52636b]">
              No source waveform image is attached to this prepared case. The viewer is showing the encounter-linked ECG report metadata only.
            </div>
          ) : null}
          {result.values.length && !isDefaultEcg ? <ResultTable result={result} /> : null}
          {result.narrative && !isDefaultEcg ? (
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

function resultDisplayLabel(displayName: string, result?: ResultBundle | null) {
  if (isDefaultEcgResult(displayName, result)) return 'ECG tracing';
  return sourceLabel(result);
}

function sourceLabel(result?: ResultBundle | null) {
  if (isSimulatorDefaultResult(result)) return 'Result available';
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
  const values = result.values.length && !isDefaultEcg
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
  const provenance = result.source_reference && !isDefaultEcg
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
    isDefaultEcg ? 'ECG tracing available in the simulation viewer.' : '',
    ...values,
    ...(result.narrative && !isDefaultEcg ? ['', 'Report', ...formatReportForDownload(result.narrative)] : []),
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
  const transcript = (packageRecord?.transcript || []) as TranscriptMessage[];
  const realTimeline = (packageRecord?.real_timeline || []) as Array<{ elapsed_min: number; label: string; detail: string }>;
  const hiddenTruth = (packageRecord?.hidden_truth || {}) as Record<string, unknown>;
  const completenessFlags = ((feedback?.completeness?.flags || packageRecord?.completeness_flags || {}) as Record<string, unknown>);
  const omissions = ((feedback?.completeness?.omissions || completenessFlags.omissions || []) as string[]);
  const actionFeedback = normalizeActionFeedback(feedback?.action_feedback);
  const examLog = (packageRecord?.exams || []) as Array<{ maneuver_id: string; display_name: string; performed_at_min: number; finding: string }>;
  const interventionLog = (packageRecord?.interventions || []) as Array<{ intervention_id: string; display_name: string; applied_at_min: number; effect_summary: string }>;
  const usageRows = ((packageRecord?.token_usage || session?.state.token_usage || []) as TokenUsageRecord[]);
  const usageTotals = usageRows.reduce(
    (totals, row) => ({
      tokens: totals.tokens + row.prompt_tokens + row.completion_tokens,
      cost: totals.cost + row.estimated_cost_usd
    }),
    { tokens: 0, cost: 0 }
  );

  return (
    <main className="ed-sim-font min-h-screen bg-[#f4f7f8] p-4 text-[#17232b]">
      <div className="mx-auto grid max-w-7xl gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#d7dfdf] bg-white p-4">
          <div>
            <h1 className="m-0 text-xl font-extrabold">Debrief</h1>
            <p className="m-0 mt-1 text-sm text-[#607078]">{session?.snapshot.title}</p>
          </div>
          <button type="button" className="inline-flex h-10 items-center gap-2 rounded-md border border-[#cdd8d8] px-3 text-sm font-bold" onClick={() => void start()}>
            <ArrowClockwise size={17} /> New run
          </button>
        </header>

        <section className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
          <div className="grid content-start gap-4">
            <article className="rounded-lg border border-[#d7dfdf] bg-white p-4">
              <h2 className="m-0 mb-3 text-base font-extrabold">Ground Truth</h2>
              <dl className="grid gap-2 text-sm">
                <DebriefFact label="Diagnosis" value={String(hiddenTruth.final_diagnosis || '')} />
                <DebriefFact label="ESI" value={String(hiddenTruth.validated_esi || '')} />
                <DebriefFact label="Disposition" value={String(hiddenTruth.actual_disposition || '')} />
              </dl>
            </article>
            <article className="rounded-lg border border-[#d7dfdf] bg-white p-4">
              <h2 className="m-0 mb-3 text-base font-extrabold">Feedback</h2>
              {feedback ? (
                <div className="grid gap-3 text-sm">
                  <FeedbackRow label="Diagnostic match" value={String(feedback.diagnostic_accuracy?.matched ?? false)} />
                  <FeedbackRow label="ESI defensible" value={String(feedback.acuity?.defensible ?? false)} />
                  <FeedbackRow label="Missed workup" value={JSON.stringify(feedback.workup_judgment?.missed || [])} />
                </div>
              ) : (
                <div className="rounded-md border border-[#e8b5b5] bg-[#fff7f7] p-3 text-sm font-semibold leading-6 text-[#7f1d1d]" data-testid="feedback-validation-gate">
                  {error || 'Grader feedback is unavailable until this case has passed clinician validation.'}
                </div>
              )}
            </article>
            <article className="rounded-lg border border-[#d7dfdf] bg-white p-4" data-testid="action-feedback">
              <h2 className="m-0 mb-3 text-base font-extrabold">Action Review</h2>
              <div className="grid gap-3 text-sm">
                <ActionFeedbackSection title="Omissions" items={actionFeedback.omissions_that_mattered} empty="No exam omissions scored." testId="feedback-omissions" />
                <ActionFeedbackSection title="Timing" items={actionFeedback.timing_sequence} empty="No timing issues scored." testId="feedback-timing" />
                <ActionFeedbackSection
                  title="Interventions"
                  items={[...actionFeedback.interventions.appropriate, ...actionFeedback.interventions.missed, ...actionFeedback.interventions.excessive]}
                  empty="No intervention judgments scored."
                  testId="feedback-interventions"
                />
                <ActionFeedbackSection title="Positives" items={actionFeedback.positive_reinforcement} empty="No positive exam feedback scored." testId="feedback-positives" />
              </div>
            </article>
            <article className="rounded-lg border border-[#d7dfdf] bg-white p-4">
              <h2 className="m-0 mb-3 text-base font-extrabold">Completeness</h2>
              <div className="mb-3 grid gap-2 text-sm">
                <FeedbackRow label="ABCDE" value={flagLabel(completenessFlags.abcde_addressed)} />
                <FeedbackRow label="ESI" value={flagLabel(completenessFlags.esi_committed)} />
                <FeedbackRow label="Assessment" value={flagLabel(completenessFlags.assessment_committed)} />
                <FeedbackRow label="Plan" value={flagLabel(completenessFlags.plan_committed)} />
              </div>
              <div className="grid gap-2 text-sm" data-testid="completeness-gaps">
                {omissions.length ? omissions.map((omission) => (
                  <div key={omission} className="rounded-md border border-[#e8b5b5] bg-[#fff7f7] p-3 font-semibold text-[#7f1d1d]">{omission}</div>
                )) : (
                  <div className="rounded-md border border-[#dfe7e7] bg-[#fbfcfc] p-3 font-semibold text-[#31534f]">No omissions recorded.</div>
                )}
              </div>
            </article>
            <article className="rounded-lg border border-[#d7dfdf] bg-white p-4">
              <h2 className="m-0 mb-3 text-base font-extrabold">Action Log</h2>
              <div className="grid gap-3 text-sm" data-testid="timed-action-log">
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
            </article>
            <article className="rounded-lg border border-[#d7dfdf] bg-white p-4">
              <h2 className="m-0 mb-3 text-base font-extrabold">Teaching Points</h2>
              <ul className="m-0 grid gap-2 p-0 text-sm">
                {(feedback?.teaching_points || []).map((point, index) => (
                  <li key={index} className="list-none rounded-md border border-[#dfe7e7] bg-[#fbfcfc] p-3">
                    {point.grounded ? <CheckCircle size={16} className="mr-2 inline text-[#0f766e]" weight="fill" /> : null}
                    {point.claim}
                  </li>
                ))}
              </ul>
            </article>
            <article className="rounded-lg border border-[#d7dfdf] bg-white p-4">
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
            </article>
          </div>

          <article className="rounded-lg border border-[#d7dfdf] bg-white p-4">
            <h2 className="m-0 mb-3 text-base font-extrabold">Replay</h2>
            <div className="grid gap-3 lg:grid-cols-2">
              <TimelineColumn title="Student" items={transcript.map((item) => ({ elapsed_min: item.elapsed_minutes, label: labelForMessage(item), detail: item.text }))} />
              <TimelineColumn title="Real Encounter" items={realTimeline} />
            </div>
          </article>
        </section>
      </div>
    </main>
  );
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
    <div className="flex justify-between gap-3 rounded-md border border-[#dfe7e7] bg-[#fbfcfc] p-3">
      <span className="font-bold text-[#607078]">{label}</span>
      <strong>{value}</strong>
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
  return value ? 'done' : 'missing';
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
