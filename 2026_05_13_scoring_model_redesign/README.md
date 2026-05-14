# Scoring Model Redesign Plan

## Research Question

How should the ED Triage Trainer score learner performance and present feedback when the available case source is the 50-case MIETIC validation sample?

## Brief Methods

The scoring model treats MIETIC as the source of truth for reference ESI, vital signs, resource counts, disposition, outcome signals, and recorded ED intervention categories. A field audit was generated from `data/raw/mietic_validate_samples.csv` and saved to `data/scoring_signal_audit.csv`. Literature was used only to define the educational structure around those fields: ESI decision points, resource prediction, vital-sign reassessment, and debriefing design. AI output is excluded from scoring; model-generated text may answer patient or tutor questions, but learner scores come from deterministic rules.

## Key Findings

The dataset contains direct support for reference acuity, complete triage vital signs, `resources_used`, lab/microbiology/imaging/procedure counts, IV access, IV fluids, medication routes and tiers, invasive ventilation, critical procedures, psychotropic medications, transfusion signals, disposition, and ICU transfer fields. It does not contain direct fields for ECG completion, stroke activation, sepsis screening, charge nurse notification, resuscitation bay placement, or monitored bed assignment. Those concepts can be used only when framed as ESI-derived triage priorities, not as recorded ED actions.

Within the 50 MIETIC rows, direct ED-action frequencies were: IV access 31/50, oral medication 18/50, IV fluids 5/50, intramuscular medication 4/50, nebulized medication 2/50, invasive ventilation 1/50, critical procedure 5/50, psychotropic medication 1/50, transfusion within 1 hour 1/50, and ICU transfer after 1 hour 13/50. The sample is weighted toward high-acuity cases: ESI 1 = 22, ESI 2 = 14, ESI 3 = 7, ESI 4 = 5, and ESI 5 = 2.

## Literature Anchors

- Emergency Severity Index, fifth edition: ESI is a five-level acuity scale that stratifies physiologic stability, risk for deterioration, and expected ED resources for stable, lower-risk patients. The handbook defines four decision points: immediate lifesaving intervention, high-risk presentation, number of different resource types, and high-risk vital signs requiring acuity reassessment. It also states that ESI does not define expected time intervals to physician evaluation and is not a comprehensive triage curriculum by itself. Source: Emergency Nurses Association, *Emergency Severity Index Handbook, Fifth Edition*, 2023.
- ESI resource scoring: resources are counted by type, not by individual tests. Labs count as one resource even when multiple lab tests are ordered; oral medications, saline locks, and simple wound care are not ESI resources. Source: ENA ESI Handbook, Appendix B.
- Triage error risk: under-triage is associated with higher admission and critical outcome rates. Advanced age, abnormal vital signs, neurologic complaints, chest pain, and shortness of breath are notable under-triage predictors. Source: Hinson et al., 2018.
- ESI training need: nurses in one multicenter scenario study assigned ESI correctly in 59.6% of cases, with under-triage in 26.8% and over-triage in 13.6%. Source: Jordi et al., 2015.
- Debriefing design: simulation-based education should include a planned debriefing process, and debriefing should help learners identify gaps, understand reasoning, and transfer lessons to future performance. Effective debriefing uses a concise structure: event review, analysis, and application. Sources: INACSL Healthcare Simulation Standards and Abulebda et al., 2022.

## Scoring Method

### 1. ESI Concordance, 40 Points

Reference acuity is the primary outcome because ESI assignment is the core triage task.

- 40 points: exact ESI match
- 24 points: adjacent over-triage
- 16 points: adjacent under-triage
- 8 points: severe over-triage
- 0 points: severe under-triage

Under-triage is weighted more heavily than over-triage because retrospective cohort data associate under-triage with increased admission and critical outcomes.

### 2. Safety Recognition, 20 Points

This domain scores the first-look disposition against structured case signals: reference ESI, danger-zone vital signs, invasive ventilation, critical procedure, transfusion signal, death, and ICU transfer. The score is deterministic and does not use free-text model judgment.

### 3. Interview Coverage, 15 Points

The interview score evaluates whether the learner covered case-relevant concepts rather than exact scripted questions. During the case, the learner writes free-text questions or uses dictation if supported by the browser. The app classifies each question behind the scenes and shows coverage only after the case. Required categories are selected from structured features:

- Chief concern, timeline, and severity for all cases
- Red flags when ESI is high acuity or abnormal vitals are present
- Medical history when the case narrative includes history
- Medication or anticoagulation questions only when suggested by the case text
- Pregnancy status only when demographically relevant

Duplicate and low-yield questions reduce the formative score but do not override ESI concordance.

The interview interface uses three modes:

- Assessment: free-text questions only; interview supports remain closed until the debrief.
- Practice: broad supports are available, and each opened support adds simulated time.
- Guided: broad supports are available without clock cost for early learners.

Supports use broad clinical prompts such as symptom course, immediate risk, relevant background, and special population risk. They do not prefill exact questions and do not pass a hidden scoring category to the backend.

### 4. Data-Grounded Escalation, 15 Points

The action score uses only two evidence classes:

- MIETIC-recorded ED actions: IV access, IV fluids, parenteral or nebulized medication, medication tiers, invasive ventilation, critical procedure, psychotropic medication, transfusion, ICU transfer, resource counts
- ESI/vital-derived triage priorities: immediate clinician evaluation, monitored placement, resuscitation readiness, oxygenation support, severe pain reassessment

Protocol-specific options without direct MIETIC support are removed from scoring. ECG, stroke activation, and sepsis screening may be clinically appropriate in real care, but this dataset does not record them as discrete actions.

### 5. SBAR Handoff, 10 Points

The SBAR score remains a simple structural rubric: situation, background, assessment, and recommendation. It is scored from learner text with deterministic keyword checks tied to case demographics, complaint, ESI, vital signs, and escalation language.

## Debrief Design

The debrief should be compact enough to use immediately after a case. It should show:

1. ESI comparison and score
2. Three priority feedback items
3. Data anchors: vital-sign flags, resource/intervention evidence, and outcome signals
4. Workflow scores for first look, interview, escalation, and SBAR
5. Clinical tutor entry point for follow-up questions

Long source maps, repeated case record sections, and exhaustive intervention explanations should be removed from the default debrief. Detailed explanations remain available through the tutor and through structured data returned by the API.

## Implementation Decisions

- Add `scorecard` and `priority_feedback` to the feedback API.
- Add `resources_used`, lab/microbiology/imaging/procedure counts, ICU transfer, transfusion, and ED intervention evidence to the case-grounded feedback object.
- Replace unsupported protocol options with broader triage priorities that can be justified from MIETIC fields or ESI/vital logic.
- Replace exact question-category buttons with mode-aware interview supports and hidden concept scoring.
- Preserve the case clock as workflow context, but keep it outside the numerical score because ESI does not define physician-evaluation time intervals.
- Use compact debrief UI cards and reserve the clinical tutor for explanatory depth.

## File Inventory

- `README.md`: scoring plan, literature basis, and implementation rules
- `data/scoring_signal_audit.csv`: field-level audit of MIETIC signals used by scoring
- `code/audit_scoring_signals.py`: reproducible audit script

## Reproducibility

Executed on 2026-05-13 with Python 3.10 and pandas from the project environment. The audit can be regenerated with:

```powershell
python 2026_05_13_scoring_model_redesign\code\audit_scoring_signals.py
```

## References

- Emergency Nurses Association. *Emergency Severity Index Handbook, Fifth Edition*. 2023. https://media.emscimprovement.center/documents/Emergency_Severity_Index_Handbook.pdf
- Hinson JS, Martinez DA, Schmitz PSK, et al. Accuracy of emergency department triage using the Emergency Severity Index and independent predictors of under-triage and over-triage in Brazil: a retrospective cohort analysis. *International Journal of Emergency Medicine*. 2018;11:3. https://doi.org/10.1186/s12245-017-0161-8
- Jordi K, Grossmann F, Gaddis GM, et al. Nurses' accuracy and self-perceived ability using the Emergency Severity Index triage tool: a cross-sectional study in four Swiss hospitals. *Scandinavian Journal of Trauma, Resuscitation and Emergency Medicine*. 2015;23:62. https://doi.org/10.1186/s13049-015-0142-y
- INACSL. Healthcare Simulation Standards of Best Practice. https://www.inacsl.org/healthcare-simulation-standards
- Abulebda K, Auerbach M, Limaiem F. Debriefing Techniques Utilized in Medical Simulation. *StatPearls*. Updated 2022. https://www.ncbi.nlm.nih.gov/books/NBK546660/
