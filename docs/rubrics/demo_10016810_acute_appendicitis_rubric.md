# Automatically Scored Rubric: demo_10016810

## Case

- **Learner-facing presentation:** 66-year-old woman with abdominal pain, blood pressure 98/48 mm Hg, oxygen saturation 90%, abdominal distention, and visible discomfort
- **Answer-key diagnosis:** Acute appendicitis with generalized peritonitis
- **Expected disposition:** Admission with urgent surgical evaluation
- **Maximum score:** 100 points
- **Scoring method:** Binary, additive criteria with critical-action score caps
- **Machine-readable specification:** `demo_10016810_auto_scoring.json`

Every point is tied to a structured event or saved learner entry. This rubric is an observation map for OpenEvidence, not the primary source of teaching feedback. Its score identifies topics that OpenEvidence should explore using the complete case record, learner transcript, current evidence, and interactive questions.

## Scoring summary

| Domain | Points | Verifiable actions |
|---|---:|---|
| Initial triage and physiologic threat recognition | 12 | ESI 2 by minute 5; general appearance by minute 2; work of breathing by minute 5 |
| Available focused history | 6 | Authored chief-concern and pain-severity questions |
| Focused abdominal and respiratory examination | 18 | Abdominal inspection, light palpation, guarding, rebound, bowel sounds, and breath sounds |
| Immediate stabilization | 20 | Cardiac monitoring, continuous pulse oximetry, supplemental oxygen, IV access, and crystalloid |
| Diagnostic strategy and orders | 25 | CBC, BMP, LFT, lipase, lactate, coagulation studies, type and screen, and contrast CT abdomen/pelvis |
| Clinical reasoning and disposition | 12 | Appendicitis/complicated acute-abdomen differential and admission/urgent surgery plan |
| Result interpretation | 7 | Saved CT, CBC, and BMP interpretations |
| **Total** | **100** | |

## Timing and point details

### Triage — 12 points

- ESI 2 by minute 5: 6 points
- General appearance by minute 2: 3 points
- Work of breathing by minute 5: 3 points

### Available history — 6 points

- Ask the authored chief-concern question: 3 points
- Ask about pain severity: 3 points

Only these history topics are authored in the current bundle. Other useful appendicitis questions cannot be scored reliably until their responses and triggers are added.

### Focused examination — 18 points

- Abdominal inspection by minute 5: 4 points
- Light abdominal palpation by minute 6: 4 points
- Guarding assessment by minute 8: 3 points
- Rebound assessment by minute 8: 3 points
- Bowel-sound assessment: 2 points
- Breath-sound assessment: 2 points

### Stabilization — 20 points

- Cardiac monitoring by minute 3: 4 points
- Continuous pulse oximetry by minute 3: 2 points
- Supplemental oxygen for SpO₂ 90% by minute 3: 6 points
- IV access by minute 5: 5 points
- IV crystalloid for hypotension by minute 8: 3 points

Analgesia is clinically reasonable if the learner confirms meaningful pain, but it is not scored because the bundle simultaneously reports severe abdominal discomfort and pain 0/10.

### Diagnostic orders — 25 points

All scored diagnostic orders must be placed by minute 10.

- CBC: 3 points
- BMP: 3 points
- Hepatic function panel: 2 points
- Lipase: 2 points
- Lactate: 3 points
- Coagulation studies: 2 points
- Type and screen: 2 points
- Contrast CT abdomen/pelvis: 8 points

### Reasoning and disposition — 12 points

- Differential or assessment includes appendicitis, peritonitis, perforated viscus/bowel, intra-abdominal infection, or acute abdomen: 8 points
- SOAP note documents admission and urgent surgery/critical-care escalation: 4 points

### Result interpretation — 7 points

- Save an interpretation of the CT result: 3 points
- Recognize WBC 18.5 K/µL/leukocytosis: 2 points
- Recognize potassium 3.0 mEq/L/hypokalemia: 2 points

## Critical-action score caps

| Missed criterion | Maximum final score |
|---|---:|
| Contrast CT abdomen/pelvis not ordered | 59 |
| IV access not established | 69 |
| No admission or urgent surgical-evaluation plan documented | 59 |

Caps are applied after raw points are totaled. The lowest applicable cap controls.

## Case limitations

- The record says the abdomen “hurts badly” and describes severe discomfort, while its structured pain score is 0/10.
- SpO₂ is 90%, contradicting the source rubric's statement that oxygenation is normal and oxygen is excessive.
- The CT result is explicitly a templated normal placeholder despite the hidden appendicitis diagnosis.
- The history lacks onset, migration, associated gastrointestinal symptoms, prior surgery, medications, allergies, and other essential topics.
- The catalog does not provide structured antibiotics or an explicit surgical-consult action, so these are teaching expectations rather than separately scored actions; escalation is verified through the SOAP plan.

The clinical framing follows the WSES Jerusalem guidelines for acute appendicitis and contemporary emergency stabilization principles. The automated criteria are intentionally limited to actions the simulator can reproduce and audit.
