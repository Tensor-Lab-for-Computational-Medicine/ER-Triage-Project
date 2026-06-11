# High-Risk Clinical Classification Report

Generated: 2026-06-09T22:33:53.988Z

This report verifies a structured high-risk classifier contract for local fail-closed evidence retrieval. It does not approve clinical accuracy, quote-depth sufficiency, claim entailment, or national release.

## Summary

- High-risk topics classified: 15/15
- Topic alias probes passed: 15/15
- Retrieval matrix rows passed: 9/9
- Case rows classified: 23
- High-risk case rows: 15
- Claim sets classified: 10
- High-risk claim sets: 6
- Negative controls classified nonclinical: 2/2
- Fallback-only high-risk probes: 0
- Classification policy ready: true
- Classification release ready: false

## Topic Policy

| Topic | Aliases | Sources | Facets | Quote Depth Row | Basis |
|---|---:|---:|---:|---|---|
| septic_shock_concern | 11 | 2 | 8 | true | structured_topic_tag, structured_topic_alias, topic_facet_pair |
| septic_shock_resuscitation | 10 | 3 | 8 | true | structured_topic_tag, structured_topic_alias, topic_facet_pair |
| chest_pain_possible_acs | 11 | 5 | 8 | true | structured_topic_tag, structured_topic_alias, topic_facet_pair |
| high_sensitivity_troponin_pathway | 10 | 4 | 8 | true | structured_topic_tag, structured_topic_alias, topic_facet_pair |
| non_st_elevation_acs | 9 | 3 | 8 | true | structured_topic_tag, structured_topic_alias, topic_facet_pair |
| opioid_overdose | 9 | 4 | 8 | true | structured_topic_tag, structured_topic_alias, topic_facet_pair |
| naloxone_response_and_recurrence | 10 | 4 | 8 | true | structured_topic_tag, structured_topic_alias, topic_facet_pair |
| febrile_infant_8_to_21_days | 10 | 1 | 8 | true | structured_topic_tag, structured_topic_alias, topic_facet_pair |
| acute_stroke_symptoms | 6 | 5 | 8 | true | structured_topic_tag, structured_topic_alias, topic_facet_pair |
| thrombolytic_eligibility_discussion | 11 | 4 | 8 | true | structured_topic_tag, structured_topic_alias, topic_facet_pair |
| ectopic_pregnancy_rupture_concern | 10 | 2 | 8 | true | structured_topic_tag, structured_topic_alias, topic_facet_pair |
| minor_head_injury_ct_decision | 11 | 4 | 8 | true | structured_topic_tag, structured_topic_alias, topic_facet_pair |
| use_of_restraints | 10 | 3 | 8 | true | structured_topic_tag, structured_topic_alias, topic_facet_pair |
| severe_agitation_medication_strategy | 10 | 2 | 8 | true | structured_topic_tag, structured_topic_alias, topic_facet_pair |
| dka_or_hhs | 11 | 2 | 8 | true | structured_topic_tag, structured_topic_alias, topic_facet_pair |

## Claim Domains

| Domain | Risk Level | Known Policy | Basis | Release Ready |
|---|---|---|---|---|
| esi | high | true | claim_domain_policy | false |
| safety | high | true | claim_domain_policy | false |
| interview | clinical_review_required | true |  | false |
| focused_exam | clinical_review_required | true |  | false |
| diagnosis | high | true | claim_domain_policy | false |
| referral | high | true | claim_domain_policy | false |
| escalation | high | true | structured_topic_alias, claim_domain_policy | false |
| reassessment | high | true | claim_domain_policy | false |
| soap | clinical_review_required | true |  | false |
| sbar | clinical_review_required | true |  | false |

## Next Actions

- Use this classifier contract in runtime retrieval before any learner-facing high-risk recommendation is shown.
- Keep high-risk classification separate from release approval; quote-depth, claim-entailment, and clinician review gates still block national rollout.
- Add clinician-authored topic tags to future cases and feedback claims so classification does not depend on free-text matching.
- Expand retrieval matrix probes as the case bank grows across ESI levels, chief complaints, and common ED safety traps.
