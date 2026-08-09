# Automatically Scored Rubric: demo_10022281

## Case

- **Learner-facing presentation:** 84-year-old man with lower-extremity pain, pain score 8/10, blood pressure 177/76 mm Hg, and visible discomfort
- **Answer-key diagnosis:** Abdominal aortic dissection
- **Maximum score:** 100 points
- **Scoring method:** Binary, additive criteria with critical-action score caps
- **Machine-readable specification:** `demo_10022281_auto_scoring.json`

Every scored criterion below is verified from the simulation's structured event record. No points depend on faculty inference, hidden patient facts, or an external language model.

## 1. Initial triage and threat recognition — 10 points

| Criterion | Points | Recorded evidence |
|---|---:|---|
| Commit ESI 2 by simulation minute 5 | 6 | Latest structured ESI commitment has level `2` and `elapsed_minutes <= 5` |
| Assess general appearance by minute 2 | 4 | Exam event `general_inspection_appearance` with `performed_at_min <= 2` |

## 2. Available focused history — 6 points

| Criterion | Points | Recorded evidence |
|---|---:|---|
| Ask the authored chief-concern question | 3 | Student free-text question matches an authored `chief_concern` trigger |
| Ask about pain severity | 3 | Student free-text question matches an authored `pain_severity` trigger |

The current case bundle authors only these two history topics. Additional vascular-history questions are clinically useful but cannot receive points until corresponding facts and triggers are added to the bundle.

## 3. Focused examination — 20 points

| Criterion | Points | Recorded evidence |
|---|---:|---|
| Assess peripheral pulses by minute 8 | 7 | Exam event `cardiovascular_palpation_pulses` |
| Assess heart sounds by minute 8 | 3 | Exam event `cardiovascular_auscultation_heart_sounds` |
| Inspect the abdomen by minute 8 | 3 | Exam event `abdomen_inspection_distention` |
| Perform light abdominal palpation by minute 8 | 4 | Exam event `abdomen_palpation_light` |
| Assess mental status by minute 8 | 3 | Exam event `general_special_mental_status` |

## 4. Immediate stabilization and symptom control — 20 points

| Criterion | Points | Recorded evidence |
|---|---:|---|
| Apply cardiac monitoring by minute 5 | 6 | Intervention event `cardiac_monitor` |
| Establish IV access by minute 5 | 6 | Intervention event `iv_access` |
| Provide analgesia by minute 8 | 6 | Intervention event `analgesia` |
| Avoid non-indicated supplemental oxygen | 2 | No intervention event `oxygen` |

## 5. Diagnostic strategy and orders — 25 points

All orders must be placed by simulation minute 10.

| Criterion | Points | Recorded evidence |
|---|---:|---|
| Order CBC | 3 | Order `cbc` |
| Order metabolic panel | 3 | Order `bmp` |
| Order coagulation studies | 4 | Order `coagulation_panel` |
| Order type and screen | 4 | Order `type_and_screen` |
| Order 12-lead ECG | 3 | Order `ecg_12_lead` |
| Order available contrast CT abdomen/pelvis | 8 | Order `ct_abdomen_pelvis_with_contrast` |

The catalog does not currently offer a dedicated CTA-aorta protocol. The available contrast CT is therefore the scored imaging action. A future case revision should add a CTA of the aorta through the iliofemoral vessels and replace this criterion.

## 6. Clinical reasoning and disposition plan — 12 points

| Criterion | Points | Recorded evidence |
|---|---:|---|
| Include an acute aortic or limb-ischemia diagnosis | 8 | Differential or SOAP assessment contains: aortic dissection, acute aortic syndrome, aortic aneurysm, acute limb ischemia, arterial occlusion, or arterial thrombosis |
| Document a safe disposition or escalation plan | 4 | SOAP text contains: admit/admission, vascular surgery/consult, surgical consult, transfer, critical care, or ICU |

## 7. Recorded result interpretation — 7 points

| Criterion | Points | Recorded evidence |
|---|---:|---|
| Record an interpretation of the CT result | 4 | Saved interpretation for `ct_abdomen_pelvis_with_contrast` contains: placeholder, normal, no acute, nondiagnostic, dissection, or aortic |
| Recognize renal indices in the metabolic panel | 3 | Saved interpretation for `bmp` contains: creatinine, renal, BUN, urea nitrogen, or kidney |

## Critical-action score caps

Caps are applied after the raw score is calculated. When multiple caps apply, the lowest cap controls.

| Missed criterion | Maximum final score |
|---|---:|
| Available contrast CT not ordered | 59 |
| Peripheral pulses not assessed | 69 |
| No admission, urgent consultation, or transfer plan documented | 69 |

## End-of-case breakdown

The debrief screen displays:

- Final points, maximum points, and percentage
- Earned and possible points for every domain
- Pass/miss state for every criterion
- The exact recorded evidence used for each decision
- Any critical-action cap applied and its reason

## Known case limitations

The source bundle's answer key lists ESI 3, while its tutorial describes the patient as high risk. This rubric uses ESI 2. The source CT narrative is explicitly a templated normal placeholder. These inconsistencies should be corrected before the case is used for high-stakes summative assessment.

Clinical content is aligned with the 2022 ACC/AHA Guideline for the Diagnosis and Management of Aortic Disease and the Emergency Severity Index implementation handbook. The automated criteria intentionally remain narrower than the complete ideal clinical approach because only recorded, reproducible actions can be scored.
