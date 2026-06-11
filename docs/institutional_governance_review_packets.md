# Institutional Governance Review Packets

Generated: 2026-06-09T22:33:31.004Z

These packets operationalize privacy, security, FERPA/HIPAA, accessibility, AI-provider, operations, IRB/QI, and multi-institution governance review work. They do not replace legal advice, institutional approval, manual WCAG review, production load testing, incident drills, or signed agreements.

## Summary

- Total review packets: 14
- Domain review packets: 9
- Release evidence packets: 5
- All required domains packeted: true
- All release evidence packeted: true
- Pending review packets: 14
- Ready for national governance release from packets: false

## Domain Review Queue

| Priority | Domain | Current Decision | Required Roles | Issues |
|---|---|---|---|---:|
| P0_national_release_blocking_governance_review | privacy_security | not_reviewed | privacy_security_officer | 1 |
| P1_multi_institution_governance_review | ferpa_student_record | not_reviewed | education_privacy_or_registrar_reviewer | 1 |
| P0_national_release_blocking_governance_review | hipaa_or_clinical_data | not_reviewed | clinical_privacy_or_compliance_reviewer | 1 |
| P0_national_release_blocking_governance_review | accessibility_wcag | not_reviewed | accessibility_reviewer | 1 |
| P0_national_release_blocking_governance_review | ai_provider_and_dpa | not_reviewed | privacy_security_officer | 1 |
| P0_national_release_blocking_governance_review | clinical_content_governance | not_reviewed | clinical_content_owner | 1 |
| P0_outcomes_and_research_governance_review | educational_research_irb_or_qi | not_reviewed | medical_education_or_irb_reviewer | 1 |
| P0_national_release_blocking_governance_review | operations_incident_response | not_reviewed | technical_operations_owner | 1 |
| P1_multi_institution_governance_review | multi_institution_release | not_reviewed | institutional_sponsor_or_program_owner | 1 |

## Release Evidence Queue

| Priority | Evidence Domain | Current Ready | Required Roles |
|---|---|---:|---|
| P0_privacy_security_release_evidence | data_inventory_approval | false | privacy_security_officer |
| P0_scale_release_evidence | production_load_test | false | technical_operations_owner |
| P0_operations_release_evidence | production_monitoring_dashboard | false | technical_operations_owner, institutional_sponsor_or_program_owner |
| P0_operations_and_patient_safety_release_evidence | incident_response_drill | false | technical_operations_owner, clinical_content_owner, privacy_security_officer |
| P0_accessibility_release_evidence | manual_wcag_audit | false | accessibility_reviewer |

## Reviewer Output

Completed institutional approvals should be recorded in `docs/institutional_governance_reviews.json` using schema `institutional_governance_reviews_v1`. Release-evidence packets should be attached to the matching institutional review domain or referenced in the risk-acceptance rationale. These packets organize review work; they do not authorize national deployment.
