import React from 'react';
import {
  ArrowClockwise,
  ChatCircleText,
  CheckCircle,
  ClipboardText,
  Clock,
  FirstAidKit,
  Flask,
  MagnifyingGlass,
  NotePencil,
  Plus,
  Pulse,
  Stethoscope,
  Warning
} from '@phosphor-icons/react';
import { EncounterProvider, OrderRecord, ResultBundle, Snapshot, TokenUsageRecord, TranscriptMessage, useEncounter } from '../store/encounterStore';
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
  const { session, loading, error, feedback } = encounter;

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

  if (feedback) {
    return <DebriefScreen />;
  }

  return (
    <main className="ed-sim-font min-h-screen bg-[#f4f7f8] text-[#17232b]">
      <Header snapshot={session.snapshot} />
      {error ? (
        <div className="border-b border-[#e6dddd] bg-[#fff7f7] px-4 py-2 text-sm font-semibold text-[#7f1d1d]">{error}</div>
      ) : null}
      <div className="grid min-h-[calc(100vh-58px)] grid-cols-1 gap-3 p-3 xl:grid-cols-[300px_minmax(520px,1fr)_360px]">
        <VitalsRail />
        <section className="grid min-h-[740px] grid-rows-[minmax(360px,1fr)_minmax(260px,0.72fr)] gap-3">
          <ConversationPanel />
          <OrderPanel />
        </section>
        <CommitRail />
      </div>
    </main>
  );
}

function Header({ snapshot }: { snapshot: Snapshot }) {
  const demographics = snapshot.visible_start.demographics;
  return (
    <header className="grid min-h-[58px] grid-cols-1 items-center border-b border-[#d7dfdf] bg-white px-4 md:grid-cols-[minmax(260px,1fr)_auto_auto]">
      <div className="min-w-0">
        <strong className="block truncate text-[15px] font-extrabold text-[#17232b]">{snapshot.title}</strong>
        <span className="text-sm text-[#607078]">
          {String(demographics.age || '')}{demographics.age ? 'y' : ''} {String(demographics.sex || '')} - {snapshot.visible_start.chief_complaint}
        </span>
      </div>
      <div className="flex h-[58px] items-center gap-2 border-t border-[#eef2f2] text-sm font-semibold md:border-l md:border-t-0 md:px-4">
        <Clock size={18} /> {formatClock(snapshot.elapsed_minutes)}
      </div>
      <div className="flex h-[58px] items-center gap-2 border-t border-[#eef2f2] text-sm font-semibold md:border-l md:border-t-0 md:px-4">
        <Pulse size={18} /> {snapshot.phase}
      </div>
    </header>
  );
}

function VitalsRail() {
  const { session, previousSnapshot } = useEncounter();
  if (!session) return null;
  const current = session.snapshot.current_vitals;
  const previous = previousSnapshot?.current_vitals;
  const rows = [
    ['HR', current.hr, 'bpm', trendClass('hr', current.hr, previous?.hr)],
    ['BP', `${current.sbp}/${current.dbp}`, 'mmHg', ''],
    ['RR', current.rr, '/min', trendClass('rr', current.rr, previous?.rr)],
    ['SpO2', current.spo2, '%', trendClass('spo2', current.spo2, previous?.spo2)],
    ['Pain', current.pain ?? 'n/a', '/10', trendClass('pain', current.pain, previous?.pain)],
    ['Temp', current.temp_c ?? 'n/a', 'C', '']
  ];

  return (
    <aside className="grid content-start gap-3">
      <section className="rounded-lg border border-[#d7dfdf] bg-white">
        <div className="flex items-center gap-2 border-b border-[#e4e9e9] px-4 py-3">
          <Pulse size={19} weight="bold" />
          <h2 className="m-0 text-base font-extrabold">Vitals</h2>
        </div>
        <div className="grid grid-cols-2 gap-2 p-3">
          {rows.map(([label, value, unit, tone]) => (
            <div key={label} className={`min-h-[82px] rounded-md border border-[#dfe7e7] bg-[#fbfcfc] p-3 ${tone}`}>
              <span className="block text-xs font-bold text-[#65747c]">{label}</span>
              <strong className="mt-1 block text-2xl font-extrabold leading-none">{value}</strong>
              <span className="mt-1 block text-xs text-[#65747c]">{unit}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-[#d7dfdf] bg-white p-4">
        <div className="mb-2 flex items-center gap-2">
          <Stethoscope size={18} weight="bold" />
          <h2 className="m-0 text-base font-extrabold">Appearance</h2>
        </div>
        <p className="m-0 text-sm leading-6 text-[#394951]">{session.snapshot.appearance}</p>
      </section>

      <section className="rounded-lg border border-[#c8e3dd] bg-[#f7fbfa] p-4">
        <div className="mb-2 flex items-center gap-2">
          <FirstAidKit size={18} weight="bold" />
          <h2 className="m-0 text-base font-extrabold">Nurse</h2>
        </div>
        <p className="m-0 text-sm leading-6 text-[#31534f]">Repeat vitals, monitoring, oxygen, IV access, and ordered results are available on request.</p>
      </section>
    </aside>
  );
}

function ConversationPanel() {
  const encounter = useEncounter();
  const messages = encounter.session?.state.transcript || [];

  return (
    <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] rounded-lg border border-[#d7dfdf] bg-white">
      <div className="flex items-center justify-between border-b border-[#e4e9e9] px-4 py-3">
        <div className="flex items-center gap-2">
          <ChatCircleText size={19} weight="bold" />
          <h2 className="m-0 text-base font-extrabold">Encounter</h2>
        </div>
        <button
          type="button"
          data-testid="advance-15"
          className="inline-flex h-8 items-center gap-2 rounded-md border border-[#cdd8d8] px-2 text-xs font-bold text-[#26323a] disabled:text-[#87949b]"
          onClick={() => encounter.advanceTime(15)}
          disabled={encounter.busy}
        >
          <Clock size={15} /> 15 min
        </button>
      </div>
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
          placeholder="Ask, examine, or call a consult..."
          className="h-11 min-w-0 rounded-md border border-[#cdd8d8] px-3 text-sm outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/20"
        />
        <button data-testid="chat-send" type="submit" className="inline-flex h-11 items-center rounded-md bg-[#0f766e] px-4 text-sm font-extrabold text-white disabled:bg-[#dce4e4]" disabled={encounter.busy}>
          Send
        </button>
      </form>
    </section>
  );
}

function MessageBubble({ message }: { message: TranscriptMessage }) {
  const isStudent = message.speaker === 'student';
  const isResult = message.speaker === 'results';
  const tone = isStudent
    ? 'border-[#cdd8d8] bg-[#fbfcfc]'
    : isResult
      ? 'border-[#c8e3dd] bg-[#f2faf7]'
      : 'border-[#dfe7e7] bg-white';
  return (
    <article className={`grid gap-1 rounded-md border p-3 ${tone}`}>
      <div className="flex items-center justify-between gap-3 text-xs font-bold text-[#607078]">
        <span>{labelForSpeaker(message.speaker)}</span>
        <span>{formatClock(message.elapsed_minutes)}</span>
      </div>
      <p className="m-0 whitespace-pre-wrap text-sm leading-6 text-[#27313a]">{message.text}</p>
    </article>
  );
}

function OrderPanel() {
  const encounter = useEncounter();
  const orders = encounter.session?.snapshot.active_orders || [];

  return (
    <section className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] rounded-lg border border-[#d7dfdf] bg-white">
      <div className="flex items-center gap-2 border-b border-[#e4e9e9] px-4 py-3">
        <Flask size={19} weight="bold" />
        <h2 className="m-0 text-base font-extrabold">Orders</h2>
      </div>
      <div className="grid gap-3 border-b border-[#e4e9e9] p-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
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
          <button type="button" className="h-10 rounded-md border border-[#cdd8d8] px-3 text-sm font-bold disabled:text-[#87949b]" onClick={() => void encounter.searchOrders('')} disabled={encounter.busy}>
            Clear
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            ['oxygen', 'O2'],
            ['cardiac_monitor', 'Monitor'],
            ['iv_access', 'IV'],
            ['analgesia', 'Analgesia']
          ].map(([id, label]) => (
            <button key={id} data-testid={`quick-${id}`} type="button" onClick={() => void encounter.applyIntervention(id)} disabled={encounter.busy} className="inline-flex h-9 items-center gap-2 rounded-md border border-[#cdd8d8] px-3 text-sm font-bold disabled:text-[#87949b]">
              <Plus size={15} /> {label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid min-h-0 grid-cols-1 gap-3 overflow-auto p-3 lg:grid-cols-[minmax(220px,0.88fr)_minmax(260px,1fr)]">
        <div className="grid content-start gap-2">
          {encounter.orderResults.slice(0, 8).map((order) => (
            <button
              type="button"
              key={order.id}
              onClick={() => void encounter.placeOrder(order.id)}
              disabled={encounter.busy}
              className="grid min-h-[54px] gap-1 rounded-md border border-[#dfe7e7] bg-[#fbfcfc] p-3 text-left hover:border-[#0f766e] disabled:text-[#87949b]"
            >
              <strong className="text-sm text-[#17232b]">{order.name}</strong>
              <span className="text-xs text-[#607078]">{order.type} - {order.result_delay_min} min</span>
            </button>
          ))}
        </div>
        <div className="grid content-start gap-2" data-testid="active-orders">
          {orders.length ? orders.map((order) => <OrderRow key={order.order_id} order={order} />) : (
            <div className="rounded-md border border-dashed border-[#cdd8d8] bg-[#fbfcfc] p-4 text-sm font-semibold text-[#607078]">No active orders.</div>
          )}
        </div>
      </div>
    </section>
  );
}

function OrderRow({ order }: { order: OrderRecord }) {
  return (
    <article className="grid gap-2 rounded-md border border-[#dfe7e7] bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <strong className="text-sm">{order.display_name}</strong>
        <span className={`rounded-md px-2 py-1 text-xs font-extrabold ${statusClass(order.status)}`}>{order.status}</span>
      </div>
      {order.result ? <ResultBlock result={order.result} /> : null}
      {order.unavailable_reason ? <p className="m-0 text-xs leading-5 text-[#7f1d1d]">{order.unavailable_reason}</p> : null}
    </article>
  );
}

function ResultBlock({ result }: { result: ResultBundle }) {
  return (
    <div className="grid gap-1 rounded-md border border-[#c8e3dd] bg-[#f7fbfa] p-2 text-xs text-[#31534f]">
      {result.values.map((value) => (
        <div key={value.name} className="flex justify-between gap-3">
          <span>{value.name}</span>
          <strong>{value.value}{value.unit ? ` ${value.unit}` : ''}</strong>
        </div>
      ))}
      {result.narrative ? <p className="m-0 leading-5">{result.narrative}</p> : null}
    </div>
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
    <aside className="grid content-start gap-3">
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
  const { session, packageRecord, feedback, start } = useEncounter();
  const transcript = (packageRecord?.transcript || []) as TranscriptMessage[];
  const realTimeline = (packageRecord?.real_timeline || []) as Array<{ elapsed_min: number; label: string; detail: string }>;
  const hiddenTruth = (packageRecord?.hidden_truth || {}) as Record<string, unknown>;
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
              <div className="grid gap-3 text-sm">
                <FeedbackRow label="Diagnostic match" value={String(feedback?.diagnostic_accuracy?.matched ?? false)} />
                <FeedbackRow label="ESI defensible" value={String(feedback?.acuity?.defensible ?? false)} />
                <FeedbackRow label="Missed workup" value={JSON.stringify(feedback?.workup_judgment?.missed || [])} />
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
              <TimelineColumn title="Student" items={transcript.map((item) => ({ elapsed_min: item.elapsed_minutes, label: labelForSpeaker(item.speaker), detail: item.text }))} />
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

function formatCost(cost: number) {
  return `$${cost.toFixed(4)}`;
}

function labelForSpeaker(speaker: string) {
  if (speaker === 'student') return 'Student';
  if (speaker === 'patient') return 'Patient';
  if (speaker === 'nurse') return 'Nurse';
  if (speaker === 'consultant') return 'Consultant';
  if (speaker === 'results') return 'Results';
  return 'System';
}

function trendClass(vital: string, current: number | null, previous?: number | null) {
  if (current === null || current === undefined || previous === null || previous === undefined) return '';
  if (current === previous) return '';
  const improving = vital === 'spo2' ? current > previous : current < previous;
  return improving ? 'border-[#9bd5c7] bg-[#f2faf7] text-[#0f5f58]' : 'border-[#e8b5b5] bg-[#fff7f7] text-[#7f1d1d]';
}

function statusClass(status: OrderRecord['status']) {
  if (status === 'resulted') return 'bg-[#eaf6f3] text-[#0f5f58]';
  if (status === 'unavailable') return 'bg-[#fff1f1] text-[#7f1d1d]';
  if (status === 'resulting') return 'bg-[#fffaf0] text-[#7a5514]';
  return 'bg-[#eef2f2] text-[#52636b]';
}

export default ClinicalReasoningSimulator;
