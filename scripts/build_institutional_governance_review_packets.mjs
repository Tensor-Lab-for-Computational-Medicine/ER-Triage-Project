import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GOVERNANCE_INVENTORY_PATH = join(ROOT, 'docs', 'governance_data_inventory.json');
const GOVERNANCE_REVIEW_STATUS_PATH = join(ROOT, 'docs', 'institutional_governance_review_status.json');
const SCALE_OPERATIONS_RUNTIME_REPORT_PATH = join(ROOT, 'docs', 'scale_operations_runtime_report.json');
const ACCESSIBILITY_READINESS_REPORT_PATH = join(ROOT, 'docs', 'accessibility_readiness_report.json');
const OUTPUT_JSON_PATH = join(ROOT, 'docs', 'institutional_governance_review_packets.json');
const OUTPUT_MD_PATH = join(ROOT, 'docs', 'institutional_governance_review_packets.md');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function markdownEscape(value) {
  return cleanText(value).replaceAll('|', '\\|');
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function templateByDomain(reviewStatus) {
  return new Map(
    (reviewStatus.review_submission_template?.institutional_reviews || [])
      .map((template) => [template.domain, template])
  );
}

function statusByDomain(reviewStatus) {
  return new Map((reviewStatus.domain_review_status || []).map((row) => [row.domain, row]));
}

function priorityForDomain(domain) {
  if ([
    'privacy_security',
    'hipaa_or_clinical_data',
    'accessibility_wcag',
    'ai_provider_and_dpa',
    'clinical_content_governance',
    'operations_incident_response'
  ].includes(domain)) {
    return 'P0_national_release_blocking_governance_review';
  }
  if (domain === 'educational_research_irb_or_qi') return 'P0_outcomes_and_research_governance_review';
  return 'P1_multi_institution_governance_review';
}

function domainRiskRationale(domain) {
  const rationales = {
    privacy_security:
      'Browser storage, API-key handling, local evidence import, retention, and incident response must be institutionally approved before national learner-facing use.',
    ferpa_student_record:
      'Learner progress, cohort analytics, exports, and educational outcome tracking can become student-record workflows at participating schools.',
    hipaa_or_clinical_data:
      'The public bundle must stay deidentified, restricted clinical-data boundaries must hold, and optional AI must not receive restricted local data without approval.',
    accessibility_wcag:
      'Required curricular use needs manual WCAG, assistive-technology, keyboard, low-vision, and accommodation review beyond static automated checks.',
    ai_provider_and_dpa:
      'Optional AI providers, prompt data boundaries, student-provided keys, and opt-out/no-AI paths require privacy and data-processing review.',
    clinical_content_governance:
      'Unsafe case content, stale sources, retired cases, and clinical incidents need named ownership and a documented escalation path.',
    educational_research_irb_or_qi:
      'Claims about improved clinical judgment and hospital performance require IRB/QI determination, privacy-safe metrics, and learner-safety monitoring.',
    operations_incident_response:
      'Local smoke tests do not prove readiness for multi-school cohorts, production monitoring, rollback, support, or incident drills.',
    multi_institution_release:
      'National use requires participating-site scope, governance board ownership, localization review, support model, and data-sharing/no-collection agreements.'
  };
  return rationales[domain] || 'Institutional governance review is required before national release.';
}

function domainReviewQuestions(policy) {
  return [
    `Does the evidence cover all required scope items for ${policy.domain}: ${policy.required_scope.join(', ')}?`,
    'Are the default static workflow, optional AI pathway, local evidence import pathway, and restricted-data boundary acceptable for this domain?',
    'What restrictions, documentation updates, monitoring requirements, or deployment limitations are required before supervised pilot or national release?',
    'Does the reviewer have sufficient institutional authority for the required role and release decision?'
  ];
}

function domainAcceptanceCriteria(policy) {
  return [
    'A credentialed reviewer with the required institutional role is recorded.',
    'All required scope items and evidence artifacts are reviewed.',
    'National approval includes an expiration or next-review date and a risk-acceptance rationale.',
    'No national approval is allowed while required changes, missing artifacts, or unresolved domain risks remain open.',
    'The completed review is recorded in docs/institutional_governance_reviews.json using schema institutional_governance_reviews_v1.'
  ];
}

function domainPacket(policy, statusRow = {}, template = {}) {
  return {
    id: `institutional_governance_domain_${policy.domain}`,
    packet_type: 'institutional_governance_domain_review',
    domain: policy.domain,
    priority: priorityForDomain(policy.domain),
    review_status: 'pending_institutional_governance_review',
    current_decision: statusRow.decision || 'not_reviewed',
    current_review_valid: Boolean(statusRow.valid),
    current_nationally_approved: Boolean(statusRow.nationally_approved),
    current_supervised_pilot_approved: Boolean(statusRow.supervised_pilot_approved),
    issue_count: statusRow.issue_count ?? 1,
    issues: statusRow.issues || ['No completed institutional governance review submitted.'],
    required_roles: policy.required_roles,
    required_scope: policy.required_scope,
    required_artifacts: policy.required_artifacts,
    risk_rationale: domainRiskRationale(policy.domain),
    reviewer_roles_required: policy.required_roles,
    external_review_required: true,
    review_questions: domainReviewQuestions(policy),
    acceptance_criteria: domainAcceptanceCriteria(policy),
    review_submission_template: template
  };
}

function releaseEvidencePackets({
  governanceInventory,
  governanceReviewStatus,
  scaleOperationsRuntimeReport,
  accessibilityReadinessReport
}) {
  return [
    {
      id: 'institutional_governance_evidence_data_inventory_approval',
      packet_type: 'institutional_governance_release_evidence',
      evidence_domain: 'data_inventory_approval',
      priority: 'P0_privacy_security_release_evidence',
      review_status: 'pending_data_inventory_approval',
      current_ready: governanceInventory.review_status === 'approved',
      current_evidence: {
        governance_inventory_status: governanceInventory.review_status,
        browser_storage_keys: governanceInventory.browser_storage_keys?.length || 0,
        data_categories: governanceInventory.data_categories?.length || 0,
        optional_external_providers: governanceInventory.optional_external_providers?.length || 0,
        default_workflow_network_requests:
          Boolean(governanceInventory.deployment_model?.default_workflow_network_requests)
      },
      reviewer_roles_required: ['privacy_security_officer'],
      required_artifacts: [
        'docs/governance_data_inventory.json',
        'docs/institutional_governance_privacy_plan.md'
      ],
      acceptance_criteria: [
        'Governance data inventory status is approved by institutional privacy/security review.',
        'Browser storage, retention, API-key handling, local evidence import, and optional AI provider handling are reviewed.',
        'Any required changes are cleared before national release.'
      ]
    },
    {
      id: 'institutional_governance_evidence_production_load_test',
      packet_type: 'institutional_governance_release_evidence',
      evidence_domain: 'production_load_test',
      priority: 'P0_scale_release_evidence',
      review_status: 'pending_production_load_test',
      current_ready: Boolean(scaleOperationsRuntimeReport.summary?.production_load_test_completed),
      current_evidence: {
        local_smoke_requests: scaleOperationsRuntimeReport.summary?.concurrent_smoke_requests || 0,
        local_smoke_p95_ms: scaleOperationsRuntimeReport.summary?.concurrent_smoke_p95_ms ?? null,
        production_load_test_completed:
          Boolean(scaleOperationsRuntimeReport.summary?.production_load_test_completed)
      },
      reviewer_roles_required: ['technical_operations_owner'],
      required_artifacts: ['docs/scale_operations_runtime_report.json', 'docs/deployment.md'],
      acceptance_criteria: [
        'A representative production or staging load test is completed on the intended hosting/CDN path.',
        'The test covers expected multi-school cohort concurrency, asset caching, route fallback, and completion workflows.',
        'Results include pass/fail thresholds, p95 response evidence, browser/device notes, and remediation status.'
      ]
    },
    {
      id: 'institutional_governance_evidence_monitoring_dashboard',
      packet_type: 'institutional_governance_release_evidence',
      evidence_domain: 'production_monitoring_dashboard',
      priority: 'P0_operations_release_evidence',
      review_status: 'pending_production_monitoring_dashboard',
      current_ready: Boolean(scaleOperationsRuntimeReport.summary?.production_monitoring_dashboard_operational),
      current_evidence: {
        production_monitoring_dashboard_operational:
          Boolean(scaleOperationsRuntimeReport.summary?.production_monitoring_dashboard_operational),
        monitored_release_blockers: [
          'route availability',
          'completion rate',
          'source-limited feedback exposure',
          'accessibility reports',
          'optional AI failures'
        ]
      },
      reviewer_roles_required: ['technical_operations_owner', 'institutional_sponsor_or_program_owner'],
      required_artifacts: ['docs/scale_operations_runtime_report.json', 'docs/scale_accessibility_monitoring_plan.md'],
      acceptance_criteria: [
        'Production monitoring is operational before cohort use.',
        'Monitoring covers runtime errors, route availability, learner workflow completion, accessibility reports, and optional AI guardrail failures.',
        'A named owner and escalation path are documented.'
      ]
    },
    {
      id: 'institutional_governance_evidence_incident_response_drill',
      packet_type: 'institutional_governance_release_evidence',
      evidence_domain: 'incident_response_drill',
      priority: 'P0_operations_and_patient_safety_release_evidence',
      review_status: 'pending_incident_response_drill',
      current_ready: Boolean(scaleOperationsRuntimeReport.summary?.incident_response_drill_completed),
      current_evidence: {
        incident_response_drill_completed:
          Boolean(scaleOperationsRuntimeReport.summary?.incident_response_drill_completed),
        drill_scenarios_required: [
          'unsafe case content',
          'source-bundle defect',
          'optional AI disablement',
          'accessibility blocker',
          'privacy or restricted-data boundary concern'
        ]
      },
      reviewer_roles_required: ['technical_operations_owner', 'clinical_content_owner', 'privacy_security_officer'],
      required_artifacts: [
        'docs/deployment.md',
        'docs/institutional_governance_privacy_plan.md',
        'docs/learner_safety_review_packets.json'
      ],
      acceptance_criteria: [
        'A rollback and incident drill is completed for clinical content, evidence-source, privacy, accessibility, and optional AI failures.',
        'Response time, owner, communication path, and disablement controls are documented.',
        'Any drill findings are remediated or accepted by governance reviewers.'
      ]
    },
    {
      id: 'institutional_governance_evidence_manual_wcag_audit',
      packet_type: 'institutional_governance_release_evidence',
      evidence_domain: 'manual_wcag_audit',
      priority: 'P0_accessibility_release_evidence',
      review_status: 'pending_manual_wcag_audit',
      current_ready: accessibilityReadinessReport.summary?.manual_wcag_required === false,
      current_evidence: {
        automated_static_accessibility_ready:
          Boolean(accessibilityReadinessReport.summary?.default_route_static_accessibility_ready),
        critical_static_issue_count: accessibilityReadinessReport.summary?.critical_static_issue_count ?? null,
        manual_wcag_required: Boolean(accessibilityReadinessReport.summary?.manual_wcag_required),
        manual_review_required: accessibilityReadinessReport.manual_review_required || []
      },
      reviewer_roles_required: ['accessibility_reviewer'],
      required_artifacts: [
        'docs/accessibility_readiness_report.json',
        'docs/scale_accessibility_monitoring_plan.md'
      ],
      acceptance_criteria: [
        'Manual WCAG 2.2 AA, keyboard, screen-reader, zoom/reflow, color contrast, target size, and accommodation workflows are reviewed.',
        'Default flowboard and any required legacy route are covered.',
        'Open accessibility blockers are remediated or explicitly restricted before required curricular use.'
      ]
    }
  ];
}

function markdown(artifact) {
  const lines = [
    '# Institutional Governance Review Packets',
    '',
    `Generated: ${artifact.generated_at}`,
    '',
    artifact.warning,
    '',
    '## Summary',
    '',
    `- Total review packets: ${artifact.summary.total_review_packets}`,
    `- Domain review packets: ${artifact.summary.domain_review_packets}`,
    `- Release evidence packets: ${artifact.summary.release_evidence_packets}`,
    `- All required domains packeted: ${artifact.summary.all_required_domains_packeted}`,
    `- All release evidence packeted: ${artifact.summary.all_release_evidence_packeted}`,
    `- Pending review packets: ${artifact.summary.pending_review_packets}`,
    `- Ready for national governance release from packets: ${artifact.summary.ready_for_national_governance_release_from_packets}`,
    '',
    '## Domain Review Queue',
    '',
    '| Priority | Domain | Current Decision | Required Roles | Issues |',
    '|---|---|---|---|---:|',
    ...artifact.domain_review_packets.map((packet) =>
      `| ${packet.priority} | ${packet.domain} | ${packet.current_decision} | ${markdownEscape(packet.required_roles.join(', '))} | ${packet.issue_count} |`
    ),
    '',
    '## Release Evidence Queue',
    '',
    '| Priority | Evidence Domain | Current Ready | Required Roles |',
    '|---|---|---:|---|',
    ...artifact.release_evidence_packets.map((packet) =>
      `| ${packet.priority} | ${packet.evidence_domain} | ${packet.current_ready} | ${markdownEscape(packet.reviewer_roles_required.join(', '))} |`
    ),
    '',
    '## Reviewer Output',
    '',
    'Completed institutional approvals should be recorded in `docs/institutional_governance_reviews.json` using schema `institutional_governance_reviews_v1`. Release-evidence packets should be attached to the matching institutional review domain or referenced in the risk-acceptance rationale. These packets organize review work; they do not authorize national deployment.'
  ];
  return `${lines.join('\n')}\n`;
}

const governanceInventory = readJson(GOVERNANCE_INVENTORY_PATH);
const governanceReviewStatus = readJson(GOVERNANCE_REVIEW_STATUS_PATH);
const scaleOperationsRuntimeReport = readJson(SCALE_OPERATIONS_RUNTIME_REPORT_PATH);
const accessibilityReadinessReport = readJson(ACCESSIBILITY_READINESS_REPORT_PATH);

const statusRowsByDomain = statusByDomain(governanceReviewStatus);
const templates = templateByDomain(governanceReviewStatus);
const domainReviewPackets = (governanceReviewStatus.domain_policies || []).map((policy) =>
  domainPacket(policy, statusRowsByDomain.get(policy.domain), templates.get(policy.domain))
);
const releaseEvidenceReviewPackets = releaseEvidencePackets({
  governanceInventory,
  governanceReviewStatus,
  scaleOperationsRuntimeReport,
  accessibilityReadinessReport
});

const pendingDomainPackets = domainReviewPackets.filter((packet) => !packet.current_nationally_approved);
const pendingReleaseEvidencePackets = releaseEvidenceReviewPackets.filter((packet) => !packet.current_ready);
const allRequiredDomainsPacketed =
  domainReviewPackets.length === governanceReviewStatus.summary?.required_domains;
const allReleaseEvidencePacketed = releaseEvidenceReviewPackets.length === 5;
const readyForNationalGovernanceReleaseFromPackets =
  Boolean(governanceReviewStatus.summary?.ready_for_national_institutional_release)
  && pendingDomainPackets.length === 0
  && pendingReleaseEvidencePackets.length === 0;

const artifact = {
  schema_version: 'institutional_governance_review_packets_v1',
  generated_at: new Date().toISOString(),
  review_status: 'institutional_governance_review_packets_open_institutional_review_required',
  warning:
    'These packets operationalize privacy, security, FERPA/HIPAA, accessibility, AI-provider, operations, IRB/QI, and multi-institution governance review work. They do not replace legal advice, institutional approval, manual WCAG review, production load testing, incident drills, or signed agreements.',
  source_contract: {
    governance_data_inventory_schema: governanceInventory.schema_version,
    institutional_governance_review_status_schema: governanceReviewStatus.schema_version,
    scale_operations_runtime_report_schema: scaleOperationsRuntimeReport.schema_version,
    accessibility_readiness_report_schema: accessibilityReadinessReport.schema_version,
    completed_review_file_path: governanceReviewStatus.source_contract?.completed_review_file_path,
    required_completed_review_schema: governanceReviewStatus.source_contract?.required_completed_review_schema
  },
  summary: {
    total_review_packets: domainReviewPackets.length + releaseEvidenceReviewPackets.length,
    domain_review_packets: domainReviewPackets.length,
    release_evidence_packets: releaseEvidenceReviewPackets.length,
    pending_domain_review_packets: pendingDomainPackets.length,
    pending_release_evidence_packets: pendingReleaseEvidencePackets.length,
    pending_review_packets: pendingDomainPackets.length + pendingReleaseEvidencePackets.length,
    all_required_domains_packeted: allRequiredDomainsPacketed,
    all_release_evidence_packeted: allReleaseEvidencePacketed,
    ready_for_national_governance_release_from_packets:
      readyForNationalGovernanceReleaseFromPackets,
    decision_counts: governanceReviewStatus.summary?.decision_counts || {},
    operational_evidence_ready_counts: {
      ready: releaseEvidenceReviewPackets.filter((packet) => packet.current_ready).length,
      pending: pendingReleaseEvidencePackets.length
    }
  },
  domain_review_packets: domainReviewPackets,
  release_evidence_packets: releaseEvidenceReviewPackets,
  release_blockers: [
    {
      id: 'institutional_governance_domain_reviews_pending',
      status: pendingDomainPackets.length > 0 ? 'blocked' : 'cleared',
      count: pendingDomainPackets.length,
      description: 'All required governance domains need completed institutional reviews before national release.'
    },
    {
      id: 'institutional_governance_release_evidence_pending',
      status: pendingReleaseEvidencePackets.length > 0 ? 'blocked' : 'cleared',
      count: pendingReleaseEvidencePackets.length,
      description: 'Data-inventory approval, production load/monitoring, incident drill, and manual WCAG evidence remain required.'
    },
    {
      id: 'institutional_governance_completed_review_file_missing',
      status: governanceReviewStatus.summary?.review_file_present ? 'cleared' : 'blocked',
      count: governanceReviewStatus.summary?.review_file_present ? 0 : 1,
      description: 'No docs/institutional_governance_reviews.json submission is present.'
    }
  ]
};

writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
writeFileSync(OUTPUT_MD_PATH, markdown(artifact), 'utf8');

console.log(JSON.stringify({
  review_status: artifact.review_status,
  total_review_packets: artifact.summary.total_review_packets,
  domain_review_packets: artifact.summary.domain_review_packets,
  release_evidence_packets: artifact.summary.release_evidence_packets,
  pending_review_packets: artifact.summary.pending_review_packets,
  all_required_domains_packeted: artifact.summary.all_required_domains_packeted,
  all_release_evidence_packeted: artifact.summary.all_release_evidence_packeted,
  ready_for_national_governance_release_from_packets:
    artifact.summary.ready_for_national_governance_release_from_packets,
  report_path: OUTPUT_JSON_PATH
}, null, 2));
