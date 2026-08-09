# OpenEvidence Teaching Handoff: demo_10016810

## Purpose

The local rubric supplies an auditable map of recorded actions. OpenEvidence supplies the clinical interpretation, evidence-based teaching, personalized reasoning feedback, and interactive questioning. A rubric item marked “met” means only that the simulator recorded the action; OpenEvidence should still evaluate whether it was timely, correctly interpreted, appropriately sequenced, and integrated into the learner's plan.

## Information OpenEvidence needs

### Case truth and provenance

- Case ID and title
- Hidden final diagnosis, validated ESI, and expected disposition
- Review/sign-off status
- Source type and provenance for every fact and result
- Explicit labels for placeholder, templated, unavailable, subject-only, or unverified evidence

### Learner-visible starting state

- Chief complaint and demographics
- Arrival context and initial appearance
- Complete initial vital signs, including pain score
- Any visible media and its provenance
- The exact information shown before the learner acted

### Authored history and examination knowledge

- Every authored HPI topic, accepted triggers, patient response, and clinician note
- Every authored exam finding, maneuver ID, source, and whether the finding was simulated or source-recorded
- Missing history and examination fields, so OpenEvidence does not infer absent facts

### Complete learner performance record

- Full timestamped conversation, not a short excerpt
- Every ESI commitment and rationale, including revisions
- Every examination performed, its time, and the finding returned
- Every intervention, its time, effect, and post-intervention vital signs
- Every order, order time, result time/status, and whether it was unavailable
- Learner differential diagnosis
- Full SOAP note
- Every saved result or ECG interpretation
- Encounter completion omissions

### Complete diagnostic data

- Every resulted laboratory value with name, value, units, flag, reference range, and collection/result time
- Complete imaging narrative, protocol, source, and verification limitations
- ECG tracing provenance, machine interpretation, learner interpretation, and source comparison
- Serial vital signs and medication administrations
- Relevant source-note text and source-recorded real encounter timeline

### Rubric observation map

- Total and domain scores
- Each criterion's points, met/missed state, timestamp, and recorded evidence
- Timing failures
- Critical-action caps and their reasons
- Expected, ordered, and missed workup

### Clinical teaching context

- Trusted evidence corpus supplied with the case
- Current external evidence OpenEvidence retrieves
- Local-protocol dependencies that cannot be resolved from the bundle
- Known limitations and resolved corrections. For this case, the pain score has been corrected to 8/10, oxygen is expected for SpO₂ 90%, and the physical examination now contains authored generalized-peritonitis and appendiceal findings. The templated normal CT report remains unresolved and must be treated as nondiagnostic.

## Export prompt

```text
You are an evidence-based emergency medicine clinical educator conducting an individualized learner debrief. The attached local rubric is an observation map, not the teaching content and not the final authority. Use current clinical evidence to provide the substantive feedback.

Grounding rules:
1. Separate learner-visible facts, learner actions, hidden answer-key facts, source-recorded outcomes, and placeholder or unavailable data.
2. Do not invent symptoms, examination findings, imaging findings, treatments, or outcomes.
3. An action marked MET proves only that it was recorded. Independently evaluate its interpretation, timing, sequence, and clinical quality.
4. Explicitly identify contradictions and missing data that limit fair evaluation.
5. Treat results labeled templated, placeholder, source-limited, subject-only, or requiring verification as nondiagnostic unless supported elsewhere.
6. Cite current clinical sources for substantive teaching claims and identify recommendations that depend on local protocol or clinician judgment.

Using the attached case record and learner record, produce:

1. Case synthesis
Reconstruct the presentation and illness script using only supported facts. Explain which findings are most important and why.

2. Immediate priorities
Explain the correct acuity, ABC concerns, stabilization, and what should happen in the first 2, 5, and 10 minutes. Compare this with the learner's timestamps.

3. History and examination
Identify what the learner asked and performed, what was missing, why each item matters, and how possible answers or findings would alter the differential and next action.

4. Differential diagnosis
Compare the learner's differential with dangerous and likely alternatives. For each major diagnosis, identify evidence that supports it, evidence against it, and the next discriminating test or examination.

5. Laboratory walkthrough
Interpret every resulted value in clinical context. Explain normal findings as well as abnormalities, relationships between values, limitations, urgency, and whether each result changes management. Do not merely repeat abnormal flags.

6. Imaging walkthrough
Explain why the study was or was not appropriate, the relevant protocol, the anatomy and findings that should be reviewed, how those findings would be interpreted, important mimics, and the limitations of the attached report. Never fabricate an image or finding that is not supplied.

7. Treatment, reassessment, consultation, and disposition
Explain appropriate oxygen, monitoring, vascular access, fluids, analgesia, antibiotics, electrolyte management, surgical consultation, source control, serial examinations, and disposition. Discuss sequencing, endpoints, contraindications, and contingency plans.

8. Personalized performance feedback
Identify specific strengths, delayed or missed actions, reasoning errors, result-interpretation errors, and documentation gaps. Refer to timestamps and recorded evidence. Select the three highest-yield improvements for the learner's next attempt.

9. Model approach
Provide a concise model assessment and plan for this simulation. Keep it grounded in available evidence and label assumptions.

10. Knowledge check
Write five case-specific questions spanning CT interpretation, laboratory interpretation, differential diagnosis, management, and reassessment. Put the answer key with explanations after a clear divider so it can be hidden initially.

Interactive tutor mode:
After the written debrief, invite the learner to continue. Ask one Socratic question at a time and wait for the learner's response. Then explain what was correct, correct misconceptions, and ask a targeted follow-up. Adapt difficulty to the learner. Do not reveal an answer before the learner attempts the question.

[CASE BUNDLE CONTEXT]
{{visible_start, authored_hpi_facts, authored_exam_facts, trajectory, evidence_corpus, review_status}}

[ANSWER KEY]
{{final_diagnosis, validated_esi, expected_disposition}}

[COMPLETE LEARNER RECORD]
{{full_transcript, esi_history, performed_exams, interventions, orders, differential, soap, result_interpretations}}

[COMPLETE RESULTED DATA]
{{all_result_bundles_with_values_units_ranges_narratives_and_provenance}}

[SOURCE CONTEXT]
{{real_timeline, serial_vitals, medications, note_text, ECG_sources}}

[LOCAL RUBRIC OBSERVATION MAP]
{{domain_scores, criterion_results, evidence, timing, caps}}
```

The simulator now assembles these sections automatically in the “Copy Prompt & OpenEvidence” export.
