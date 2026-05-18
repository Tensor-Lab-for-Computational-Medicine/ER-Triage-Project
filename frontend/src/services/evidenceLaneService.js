function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function evidenceItem(label, value, source = '') {
  const text = cleanText(value);
  if (!text) return null;
  return {
    label,
    value: text,
    source
  };
}

function compact(items = []) {
  const seen = new Set();
  return items
    .filter(Boolean)
    .filter((item) => {
      const key = `${item.label}|${item.value}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function buildEvidenceLanes({ caseData = {}, workflow = {}, caseEvidence = {} }) {
  const intake = caseData.source || {};
  const documented = caseData.documented_evidence || [];
  const availableAtTriage = compact([
    evidenceItem('Chief concern', caseData.complaint, 'triage intake'),
    evidenceItem('Triage narrative', caseData.history, 'triage intake'),
    evidenceItem('Arrival mode', caseData.demographics?.transport, 'triage intake'),
    ...(caseEvidence.vital_flags || []).map((item) =>
      evidenceItem(item.name, `${item.value} (${item.reason})`, 'triage vital signs')
    ),
    ...documented
      .filter((item) => ['demographics', 'chief_complaint', 'history', 'vitals'].includes(item.domain))
      .map((item) => evidenceItem(item.domain, item.statement, 'documented source'))
  ]);

  const expectedResources = compact([
    ...(caseEvidence.resources || []).map((item) =>
      evidenceItem(item.label, item.value, 'expected ED resource signal')
    ),
    ...(workflow.escalation?.expected || []).map((item) =>
      evidenceItem(item.name, (item.evidence || []).join('; '), 'triage priority expectation')
    )
  ]);

  const retrospectiveOutcomes = compact([
    evidenceItem('Disposition', intake.disposition || caseData.disposition, 'retrospective case outcome'),
    ...(caseEvidence.outcomes || []).map((item) =>
      evidenceItem(item.label, item.value, 'retrospective case outcome')
    ),
    ...(caseEvidence.recorded_actions || []).map((item) =>
      evidenceItem(item.name, item.description, 'recorded ED action')
    )
  ]);

  return {
    available_at_triage: availableAtTriage,
    expected_resources: expectedResources,
    retrospective_outcomes: retrospectiveOutcomes
  };
}
