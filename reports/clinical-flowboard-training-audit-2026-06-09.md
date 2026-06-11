# Clinical Flowboard Training Audit

Date: 2026-06-09

Scope: live browser at `http://localhost:5174/`, the current `ClinicalFlowboard` implementation, and the existing flowboard QA screenshots. This is an educational simulation audit, not a visual-only QA pass.

Primary finding: the app currently behaves more like an answer-guided checklist board than an emergency department simulation. It frequently shows the learner interpreted cues, likely actions, response expectations, and debrief-like framing before the learner has had to notice, prioritize, choose, or communicate under uncertainty.

## Live Browser Observations

- Arrival + Acuity exposes 37 visible controls, plus chart/results and global controls.
- Stabilize / Activate exposes 48 visible controls.
- Hypothesis + Workup exposes 62 visible controls.
- Reassess + Course Correct exposes 39 visible controls.
- Disposition + Handoff exposes 46 visible controls.
- The chart/results drawer remains visible through the case and can show support information adjacent to active learner decisions.
- The first screen already colors abnormal vitals and exposes a pre-authored red-flag cue list.
- ABCDE is displayed as completed text rather than used as a learner performance task.

## Core Educational Diagnosis

The app asks the learner to select from preinterpreted options. A high-performing ED learner must instead practice:

- noticing danger before the interface labels it,
- deciding what information to gather next,
- managing incomplete information,
- prioritizing interventions under time pressure,
- verbalizing orders clearly,
- reassessing when the patient fails to improve,
- handing off ownership and risk.

The strongest redesign direction is to turn each screen from "select all expected checklist items" into "perform one authentic clinical task, then reveal consequences and feedback."

## Screen 1: Arrival + Acuity - 30 Issues

Source area: `frontend/src/components/ClinicalFlowboard.jsx`, `ArrivalPanel`.

1. The "High Acuity" badge in the top banner gives away the case severity before the learner assigns acuity.
2. Vital sign tiles are color-coded from the start, which pre-labels danger rather than testing whether the learner recognizes it.
3. The red-flag checklist lists the answer candidates directly, including BP, HR, temperature, SpO2, perfusion, symptoms, and mental status.
4. "GCS 15, oriented" appears in the red-flag cue list even though it is a reassuring cue, mixing danger and non-danger without teaching discriminative reasoning.
5. The ABCDE section is passive text; the learner never performs an airway, breathing, circulation, disability, or exposure assessment.
6. The ABCDE labels appear before any learner action, so the app completes the cognitive work for them.
7. The screen asks "What are the immediate priorities?" but then immediately shows structured vitals, ABCDE, red flags, and triage location choices.
8. There is no initial "first look" challenge where the learner must state unstable versus stable before seeing the curated cue list.
9. The chief complaint is already rich and diagnosis-shaped, making "fever, vomiting, dizziness" plus shock vitals point strongly toward sepsis.
10. The arrival metadata does not include missing-data uncertainty beyond weight, so learners are not forced to manage incomplete triage data.
11. "Weight not obtained" is visible but not connected to medication dosing, fluids, antibiotics, or what the learner should do about it.
12. Triage location options include level numbers in parentheses, which can anchor the learner toward an acuity answer without requiring ESI reasoning.
13. "Resuscitation (1)" conflates physical location, ESI level, and resuscitation priority.
14. There is no explicit distinction between ED bed placement, ESI, and immediate resuscitation need.
15. The learner can choose an acuity location after selecting only two red flags, even if they miss the most safety-critical cues.
16. The rationale field accepts any text above a length threshold; it does not evaluate clinical correctness, prioritization, or unsafe reasoning.
17. The confidence slider adds UI effort but does not change coaching, scoring, calibration feedback, or debrief value.
18. There is no penalty or feedback path for choosing inappropriate low-acuity locations before confirmation.
19. The decision readiness checklist teaches what the app wants completed, not what a safe triage clinician must do.
20. The chart drawer duplicates vitals next to the first-look vitals, increasing cognitive load without a new educational task.
21. The chart vitals trend shows "Reassessment pending" on screen one, implying later trajectory before the learner has acted.
22. The "Provide initial verbal orders" control appears before the learner has recognized acuity, which competes with the arrival task.
23. The page gives learners answer-shaped language for the rationale placeholder.
24. There is no forced prioritization of the single most dangerous finding.
25. There is no timed consequence for delayed recognition of shock.
26. The learner does not have to decide what data is missing and what should be repeated immediately.
27. "ABCDE quick assessment" is displayed as a finding list rather than a performance checklist or branching bedside exam.
28. The app does not require learners to identify whether this patient can safely wait in triage.
29. The first screen does not simulate communication with charge nurse, bedside nurse, or senior clinician as an authentic triage action.
30. The screen mostly tests whether learners click recognized labels, not whether they can independently identify and escalate an unstable ED patient.

## Screen 2: Stabilize / Activate - 30 Issues

Source area: `frontend/src/components/ClinicalFlowboard.jsx`, `StabilizePanel`.

1. The screen presents six action groups with expected ED bundles already organized for the learner.
2. Action options are highly leading: "LR 30 mL/kg", "Broad antibiotics", "Norepinephrine if refractory", "High-risk infection alert", and "Pharmacy bedside" are essentially the answer path.
3. The learner does not have to decide what problem they are treating first: shock, hypoxemia, sepsis, volume depletion, or source control.
4. The action list encourages breadth rather than prioritization; selecting many chips can look better than making the first critical move.
5. There is no sequence enforcement despite the screen claiming to teach a first 5-minute sequence.
6. The readiness gate requires only three selected actions, so learners can pass with incomplete stabilization.
7. The coverage summary rewards touching domains rather than choosing safe, timely, patient-specific actions.
8. "Airway" includes "Prepare RSI plan" even though the patient is talking in full sentences, creating potential over-intervention without teaching why it is or is not indicated.
9. Oxygen actions are generic and do not force selection of device, target saturation, or reassessment.
10. Monitoring, ECG, glucose, and repeat vitals are grouped together, obscuring which are immediate safety actions versus diagnostic adjuncts.
11. "IV / fluids / blood / pressors" groups very different escalation levels together without requiring conditional logic.
12. The app includes "Type and screen" but does not ask why blood is or is not a priority in this case.
13. Antibiotics appear as one chip without timing, source considerations, cultures, allergy check, or dosing realism.
14. The learner can select norepinephrine without first explaining response to fluids or persistent shock.
15. The screen does not simulate closed-loop orders to team members unless the separate verbal-order drawer is opened.
16. Selecting chips automatically posts "Action recorded" feedback, which can feel like correctness feedback even when the action might be poorly timed.
17. The selected-action list duplicates selections, adding clutter without deeper reasoning.
18. The "Progressive disclosure: response expectations" details are open by default and reveal expected future course.
19. The response expectations mention lactate trend, source-control decision, and persistent shock before the learner has earned that information.
20. The chart tab changes automatically after selections, which can disorient the learner and expose support content as a side effect of clicking.
21. There is no scenario consequence for omitting fluids, antibiotics, oxygen, or escalation.
22. There is no nursing capacity or resource constraint, so the learner never has to decide what happens first.
23. The app does not ask learners to state contraindications, allergies, pregnancy considerations, or weight-based dosing concerns.
24. "Call senior now" and "Charge RN" are available but not modeled as different escalation pathways.
25. The screen does not teach when to activate ICU versus ED senior versus sepsis pathway versus pharmacy.
26. The written first-pass plan is free text with a length gate, not a clinically assessed order sequence.
27. The reassessment trigger is free text with a length gate, not tied to actual vitals, perfusion, lactate, urine output, or mental status.
28. There is no distinction between "ordered", "performed", "pending", and "resulted".
29. The screen does not require the learner to communicate an action to a specific team member.
30. The stabilization step tests checklist coverage more than high-level ED stabilization under pressure.

## Screen 3: Hypothesis + Workup - 30 Issues

Source area: `frontend/src/components/ClinicalFlowboard.jsx`, `HypothesisPanel`.

1. The screen combines patient interview, history bundles, physical exam, finding interpretation, differential, diagnostics, and treatment strategy all in one workspace.
2. The learner is asked to do too many cognitive tasks before feedback or consequences.
3. Suggested patient questions reveal the exact domains the app expects.
4. The top quick-action row duplicates the suggested patient questions, increasing visual noise.
5. Asking a suggested question produces scripted answers without probing for learner phrasing quality.
6. Custom questions are keyword-matched to canned responses, which can reward keyword guessing rather than communication skill.
7. A vague custom question can still default to an infection-oriented response, narrowing the case for the learner.
8. Selecting a history bundle reveals summarized history without requiring the learner to formulate the component questions.
9. The app has both patient conversation and history bundle mechanisms, creating two competing ways to get the same information.
10. Focused exam bundles reveal findings with one click; the learner does not choose specific exam maneuvers or state what would change management.
11. The GU/pelvic exam result appears as a bundled reveal without a realistic consent/chaperone/indication workflow beyond a text note.
12. Exam bundles are organized as answer categories rather than bedside tasks.
13. The finding interpretation board only appears after revealed findings, but it still uses dropdown labels that constrain reasoning to generic categories.
14. "Supports a diagnosis", "raises priority", and "changes immediate action" are too broad to assess mature clinical reasoning.
15. The app requires at least one interpreted finding, not a minimum safe set of critical findings.
16. The differential builder has three rows but no prioritization logic beyond row order.
17. The placeholder "Most dangerous must-not-miss diagnosis" helps, but there is no explicit test of "most likely" versus "most dangerous".
18. There is no penalty for an unsafe differential that omits septic shock, ectopic pregnancy, meningitis, toxic ingestion, or other high-risk alternatives.
19. Diagnostic orders are a flat chip list with no cost, delay, patient risk, or conditional sequencing.
20. "Source-directed imaging" is too vague to train specific diagnostic strategy.
21. Pregnancy test appears as a chip, but the app does not force learners to connect it to imaging, medication, or differential risk.
22. The app lets learners order tests after seeing many scripted findings, but not in a realistic ED time flow.
23. The diagnostics do not create a queue, delay, pending state, or need to continue resuscitation while waiting.
24. The treatment strategy repeats stabilization work, blurring this screen's purpose.
25. The chart results remain available while the learner builds the workup, increasing risk of premature result-seeking.
26. Results are released after workup commitment, but the screen does not make learners predict how results would change actions before reveal.
27. The readiness checklist can be satisfied with a minimal interview, one exam bundle, one interpreted finding, one differential, and generic strategy text.
28. The screen does not make the learner decide which information is needed before which action.
29. The learner is never asked to state uncertainty or competing explanations in a structured way.
30. The step is cognitively overloaded and does not isolate a single high-value ED reasoning skill.

## Screen 4: Reassess + Course Correct - 30 Issues

Source area: `frontend/src/components/ClinicalFlowboard.jsx`, `ReassessPanel`.

1. The screen labels all reassessment events in advance: new vitals, lab update, nursing update, and ECG.
2. Event previews tell learners exactly what categories of data are coming, reducing uncertainty.
3. The learner clicks "Review vitals update" rather than deciding when and why to reassess vitals.
4. Once reviewed, the event immediately reveals the key abnormal data without requiring interpretation first.
5. The event button changes to the expected action, such as "Escalate support", which gives away the response.
6. The reviewed update response uses a dropdown with answer-like meanings rather than a learner-generated interpretation.
7. "Worsening physiology" and "persistent instability" are available as labels, so the app supplies the clinical language.
8. Only one reviewed update response is required, even though the case provides multiple reassessment signals.
9. The trajectory options are broad and unranked, with no patient consequence for selecting a wrong trajectory.
10. "Persistent shock" is visible as an option before the learner interprets the new BP and perfusion state.
11. The course-change rationale placeholder gives the model answer structure.
12. Course correction options include the expected escalation actions directly.
13. "Start norepinephrine", "Call ICU", "Repeat lactate", and "Broaden antibiotics" are presented as parallel chips without decision hierarchy.
14. The learner can select course corrections without documenting why initial therapy failed.
15. The app does not model whether fluids or antibiotics have actually been completed before reassessment.
16. "Advance 5 minutes" is a simple button; time does not create new deterioration, missed-action consequences, or task pressure.
17. The sim timer can be paused or sped up, but time is not tied to physiology or performance.
18. Vitals update to "SpO2 93% on NRB" even if the learner never selected oxygen.
19. Lab update can show lactate regardless of whether the learner ordered labs in a coherent sequence.
20. The ECG update can be available independent of whether ECG was appropriately ordered or performed.
21. The reassessment does not ask "what did you expect to happen and did it happen?"
22. There is no forced comparison between initial mental status, perfusion, BP, HR, RR, oxygenation, and lactate.
23. The learner does not have to decide whether diagnosis is changing or treatment is failing using a structured evidence table.
24. The course correction list omits ownership: who starts pressor, who calls ICU, who repeats lactate, who reassesses.
25. The screen does not train escalation language, such as "I need ICU now because..."
26. The chart drawer can reveal lab or vitals details adjacent to the reassessment task, reducing staged uncertainty.
27. The app treats "reviewed" as sufficient evidence of learning.
28. The readiness checklist rewards completion of UI steps rather than correct response to a deteriorating patient.
29. There is no scenario branch for unsafe reassurance or delayed escalation.
30. The reassessment screen should be the most dynamic simulation moment, but it is currently a static reveal-and-label exercise.

## Screen 5: Disposition + Handoff - 30 Issues

Source area: `frontend/src/components/ClinicalFlowboard.jsx`, `DispositionPanel`.

1. All dispositions are shown at once, including obviously inappropriate options such as discharge, psych, and AMA.
2. The option details often teach the answer by saying why a destination is or is not appropriate.
3. The learner is not asked to identify disposition constraints before seeing the destination list.
4. ICU includes "vasopressor-capable monitored care", which effectively reveals the expected destination for persistent shock.
5. Disposition safety checks are generated after disposition selection, so the app provides the checklist for that answer.
6. The safety checkpoint requires only two selected checks even though high-risk handoff may require more.
7. The learner can select safety checks by clicking prewritten phrases rather than drafting the safety conditions.
8. The live handoff preview assembles SBAR-like content automatically, so the learner does not practice structuring SBAR from scratch.
9. The handoff fields are "justification, receiving team, return precautions, follow-up" rather than true SBAR fields.
10. "Return precautions" is outpatient language and is awkward for ICU handoff.
11. The app does not force a concise spoken handoff under time or length constraints.
12. Pending items are prelisted, which reduces the learner's need to identify unresolved work.
13. The pending item list includes "ICU bed request" after choosing ICU, but the relationship between disposition and bed logistics is not modeled.
14. Pending ownership requires owner and plan text, but correctness is only length-gated.
15. The learner can name vague owners without feedback about responsibility or escalation chain.
16. Finalize handoff can be enabled with clinically weak text if length requirements are met.
17. The handoff preview can hide errors by making incomplete fragments look formatted and professional.
18. The app does not compare handoff against a reference or expected high-risk communication standard.
19. There is no receiving-team response, pushback, or clarification request.
20. There is no check for whether patient is stable enough to leave ED, move to ICU, wait for bed, or transfer.
21. The app does not require a final reassessment immediately before disposition.
22. Disposition can be chosen even if earlier panels are incomplete because panel navigation is open.
23. The safety rationale asks "what could make this unsafe" but does not require vital sign thresholds or specific triggers.
24. The handoff builder separates pending ownership from handoff text, which can create a polished preview without a realistic verbal sequence.
25. The screen does not force antibiotic timing, lactate repeat time, culture follow-up, pressor status, or source-control plan into the final handoff.
26. The app does not teach what information should not be included in a high-stakes handoff.
27. The learner can finalize before practicing closed-loop confirmation with the receiving team.
28. The screen does not distinguish disposition decision, bed request, consult acceptance, and physical transfer.
29. The final decision confirmation is separate from handoff finalization, creating duplicate completion states.
30. The disposition step is more form assembly than high-risk ED communication simulation.

## Screen 6: Cross-Screen Support, Chart, Modes, Debrief, Mobile - 30 Issues

Source areas: `TopBar`, `LearnerRail`, `DecisionReadiness`, `ChartResultsDrawer`, `NotesTab`, `CoachNote`, `ActivityNotice`.

1. The top banner says "High Acuity" globally, which anchors every screen.
2. Simulation time is visible but does not meaningfully drive physiology, scoring, deterioration, or consequences.
3. Pause and speed controls imply a simulation engine, but the current case behaves mostly as static state.
4. The training mode menu is prominent even though assessment and research modes are locked, adding irrelevant cognitive load.
5. Faculty controls are visible to learners and can distract from learner-mode immersion.
6. Faculty note text can be opened during active play and tells the learner what kind of rationale faculty wants.
7. The learner rail allows jumping ahead to future panels, weakening the staged simulation.
8. Future panels are not locked behind clinically necessary decisions.
9. Curriculum objectives are visible during active play and can prime what the learner should do.
10. "View objectives" reveals observable learner actions, which can function as a checklist answer key.
11. Decision readiness checklists are UI completion checklists rather than clinical performance criteria.
12. "Ask for hint" gives direct next-best framing and may reveal the main teaching point too early.
13. Activity notices use "Action recorded" language that can be mistaken for "correct action".
14. Educational feedback appears immediately after confirming panels, blurring in-encounter coaching and post-case debrief.
15. The chart/results drawer remains persistently adjacent, increasing split attention.
16. The chart tabs sometimes show values that duplicate active task data, rather than supporting a distinct chart-review task.
17. Labs can become available as generic results instead of as consequences of specific orders, timing, and pending states.
18. Imaging teaching comments are embedded next to results, turning chart review into debrief before the case is over.
19. Meds tab records selected actions rather than administered medications, which can mislead learners about order completion.
20. Notes tab includes allergies and past history from the beginning, allowing learners to bypass interview tasks.
21. Notes tab includes provenance, release gates, evidence policy, and governance details during gameplay, which are not learner-facing clinical tasks.
22. Release-gate warnings are important for product governance but should not dominate the simulation workspace.
23. The debrief rubric uses "Ready / Partial" style status rather than specific clinical performance feedback first.
24. The case completion review appears in the chart notes rather than as a dedicated Learn screen.
25. The downloadable packet is faculty-oriented but does not start with the learner's most important clinical miss.
26. Restart confirmation is embedded inside notes, adding administrative workflow into the clinical record area.
27. Verbal orders are optional and separate from stabilization, even though verbal communication is central to ED performance.
28. Verbal-order suggestions give away likely correct orders before the learner has to phrase them.
29. Some accessible names are duplicated or ambiguous, as seen with the Faculty control, which can impair keyboard and screen-reader use.
30. Mobile screenshots show the same dense model compressed vertically; the problem is not only responsiveness but task overload.

## Highest Priority Redesign Moves

1. Remove all pre-decision answer labels: "High Acuity", color-coded abnormality, and answer-shaped red-flag lists.
2. Split Arrival into a true first-look challenge: "stable or unstable, why, what happens in the next 60 seconds?"
3. Convert ABCDE from passive text into an assessment task with learner-selected findings and consequences.
4. Lock future panels until the learner completes clinically meaningful gates, not just text-length gates.
5. Replace checklist chips with short, scenario-specific decision prompts that require prioritization.
6. Move chart/results into phase-gated reveals and make the learner request or justify each result.
7. Separate learner mode from faculty/governance surfaces.
8. Make verbal orders a core assessed behavior, not an optional drawer.
9. Turn reassessment into a dynamic deterioration challenge with consequences for delayed or wrong escalation.
10. Build a dedicated Learn screen that starts with the most important clinical takeaway, then expands into evidence and rubric details.

## Suggested Screen Architecture

1. First Look: learner states stable/unstable, immediate danger, and triage location without colored answer cues.
2. ABCDE: learner performs focused bedside assessment and identifies missing or dangerous findings.
3. Initial Orders: learner gives closed-loop first 5-minute orders in priority sequence.
4. Focused History/Exam: learner asks or selects what they need to discriminate sources and risks.
5. Diagnostic Strategy: learner chooses tests with expected decision impact before results are revealed.
6. Reassessment: patient fails to improve; learner interprets vitals/lactate/nursing update and escalates.
7. Disposition/Handoff: learner gives concise SBAR with ownership, pending items, and deterioration triggers.
8. Debrief: feedback compares learner actions to source data, reviewed inference, and faculty rubric.

## Bottom Line

The current app has many strong ingredients: ED-relevant case content, phase structure, closed-loop plan fields, reassessment events, disposition ownership, and a debrief packet. The central problem is that those ingredients are arranged as visible checklists and answer-shaped prompts. To train medical students and fellows to function at a high level in the ED, the app needs to withhold interpretation, force prioritization, create consequences, and assess communication under uncertainty.
