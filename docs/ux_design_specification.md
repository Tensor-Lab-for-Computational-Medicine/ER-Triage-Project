# ED Triage Trainer

## Minimal UX/UI Design Specification for Medical Student Education

---

## Executive Summary

The **ED Triage Trainer** is a browser-based educational simulation designed to help medical students practice emergency department triage, focused clinical interviewing, Emergency Severity Index assignment, care prioritization, reassessment, and SBAR handoff.

The application should feel like a **calm clinical reasoning workspace**, not a busy EHR, chatbot, or exam dashboard. Emergency medicine is chaotic; the learning interface should be the opposite: quiet, structured, and cognitively economical.

Each screen should ask the learner to complete **one authentic clinical task**. The UI should show only the information required for that task, clearly distinguish source data from reviewed teaching inferences, and turn missing or imperfect data into teachable moments rather than hiding it.

The application is grounded in a static case bundle derived from raw triage data and reviewed clinical augmentations. The reviewed augmentation file states that inferred teaching details enrich realism and case review **without overwriting source vitals, ESI, disposition, resource counts, intervention flags, demographics, or triage narrative**.

---

# 1. Core Product Philosophy

## 1.1 Design Goal

The primary goal of the ED Triage Trainer is to teach medical students how to reason through triage decisions using incomplete, time-sensitive, and sometimes messy clinical information.

The interface should help students answer five questions:

1. **What do I know?**
2. **What is missing?**
3. **What could make this patient unsafe?**
4. **What action should happen next?**
5. **How should I communicate this clearly?**

The UI should not overwhelm learners with excessive panels, decorative graphics, or administrative details. Every visible element should support clinical reasoning.

---

## 1.2 Core Design Principles

### Principle 1: Single Clinical Focus

Each step should isolate one clinical task:

```text
Gather → Examine → Decide → Act → Reassess → Handoff → Learn
```

The student should never be asked to interview, assign ESI, place orders, and read debrief feedback on the same screen.

---

### Principle 2: Data-Strict Learning

The system must preserve the difference between:

```text
Source data
Reviewed inference
Student action
Reference answer
```

Source vitals, demographics, disposition, resource counts, and reference ESI should never be overwritten by AI-generated or inferred content.

Reviewed augmentation data may be used to teach physical exam targets, differential considerations, expected actions, reassessment anchors, and practice rules.

---

### Principle 3: Minimal Interface, Maximum Educational Signal

Minimalism does not mean removing educational structure. It means removing everything that does not help the learner reason.

The design should prioritize:

```text
Clear hierarchy
Small number of visible choices
Plain clinical language
Progressive disclosure
No redundant decisions
No decorative clutter
```

---

### Principle 4: Missing Data Is a Teaching Opportunity

Real ED triage data is often incomplete, inconsistent, or poorly documented. The interface should explicitly show missing or non-standard data rather than silently cleaning it.

Examples:

```text
Pain: Unable to assess
Source value: "uta"
Clinical action: reassess when the patient can participate
```

```text
Chief complaint: Source error
Source value: "#NAME?"
Clinical action: use triage narrative to reconstruct presenting concern
```

This teaches students that clinical reasoning often requires managing uncertainty.

---

### Principle 5: Calm Professional Tone

The visual design should resemble the clarity of a modern clinical tool while avoiding the density of a full EHR. The application should feel serious, quiet, and trustworthy.

---

# 2. Educational Objectives

By the end of a case, the learner should be able to:

1. Conduct a focused ED triage interview.
2. Identify missing subjective and objective information.
3. Interpret vital signs in clinical context.
4. Recognize high-risk features and red flags.
5. Assign a defensible ESI level.
6. Connect ESI to anticipated resources and acuity.
7. Select immediate care priorities.
8. Identify what must be reassessed.
9. Produce a concise SBAR handoff.
10. Reflect on mistakes through structured debriefing.

---

# 3. Information Architecture

The application should use a linear, progressive structure.

```text
+--------------------------------------------------------------------------------+
| ED Triage Trainer                                      Coach On     Settings    |
+--------------------------------------------------------------------------------+
| 54 M | Chest pain, dyspnea | Walk-in | Vitals available | ESI pending           |
+--------------------------------------------------------------------------------+
| Gather → Examine → Decide → Act → Reassess → Handoff → Learn                    |
+--------------------------------------------------------------------------------+
|                                                                                |
|                         Active clinical task                                    |
|                                                                                |
+--------------------------------------------------------------------------------+
| Primary action                                                    Secondary     |
+--------------------------------------------------------------------------------+
```

---

## 3.1 Global Topbar

The topbar should contain only global controls.

```text
ED Triage Trainer        Coach On/Off        Settings
```

### Include

* Application name
* Coach mode toggle
* Settings button

### Avoid

* Multiple AI model controls
* Technical cache messages
* API-key status unless needed
* Debug-like system states

Technical details should be hidden unless there is a failure.

Better learner-facing status examples:

```text
Using reviewed case data
Generating patient response
Response unavailable — showing reviewed fallback
```

Avoid:

```text
Checking local semantic cache
Requesting OpenRouter response
Validating provider payload
```

---

## 3.2 Case Anchor Banner

The case banner should orient the learner without giving away the answer.

Before the student assigns ESI:

```text
Age/Sex | Chief Concern | Arrival Mode | Vitals Status | ESI pending
```

After the student assigns ESI:

```text
Age/Sex | Chief Concern | Arrival Mode | Student ESI: 3 | Reference hidden
```

During debrief:

```text
Age/Sex | Chief Concern | Student ESI: 3 | Reference ESI: 2 | Under-triaged
```

### Important Change

Do **not** display “Working ESI” before the learner makes the definitive ESI decision. Showing a provisional ESI risks anchoring the student too early.

---

## 3.3 Clinical Reasoning Spine

Replace the longer workflow strip with a shorter reasoning spine:

```text
Gather → Examine → Decide → Act → Reassess → Handoff → Learn
```

Each step should have:

```text
Completed state
Active state
Locked future state
```

The visual indicator should be simple:

```text
✓ Gather    ● Examine    ○ Decide
```

---

# 4. Data Model and UI Provenance

Every important clinical fact should have a provenance label.

## 4.1 Provenance Labels

| Label              | Meaning                                      |
| ------------------ | -------------------------------------------- |
| Source             | Directly from raw triage data                |
| Reviewed inference | From clinically reviewed augmentation file   |
| Student            | Entered or selected by learner               |
| Reference          | Ground-truth comparison shown during debrief |

Examples:

```text
BP 198/107                         Source
Focused neurovascular exam needed  Reviewed inference
Notify clinician                   Student action
Reference ESI 2                    Reference
```

These labels should be visually subtle. They should not dominate the screen.

Recommended style:

```css
.provenance-pill {
  font-size: 11px;
  font-weight: 700;
  border-radius: 999px;
  padding: 2px 8px;
  background: #eef3f6;
  color: #52616f;
}
```

---

## 4.2 Handling Missing, Dirty, or Ambiguous Data

The raw data includes missing vitals, non-numeric pain values, and source-quality issues. The UI should preserve those values and teach students how to respond clinically.

### Recommended Data States

| Data state          | UI label         | Example                  |
| ------------------- | ---------------- | ------------------------ |
| Present             | Normal value     | `HR 108`                 |
| Missing             | Not documented   | `BP not documented`      |
| Unable to assess    | Unable to assess | `Pain: unable to assess` |
| Critical text value | Critical         | `Pain: Critical`         |
| Out of range        | Needs review     | `Pain: 13`               |
| Source error        | Source error     | `Chief concern: #NAME?`  |

### Example UI

```text
Pain
Unable to assess
Source value: "uta"

Clinical note:
Pain should be reassessed when the patient can participate.
```

This approach improves medical education because it teaches students not to over-trust structured data.

---

# 5. Core Workflow

## Overview

```text
Step 1: Gather
Patient interview and subjective data collection

Step 2: Examine
Vitals, source data, and focused physical exam targets

Step 3: Decide
Definitive ESI selection and rationale

Step 4: Act
Care priorities, orders, escalation, and immediate interventions

Step 5: Reassess
What could worsen, what must be monitored, and why

Step 6: Handoff
Structured SBAR communication

Step 7: Learn
Performance debrief, feedback, and case teaching points
```

---

# 6. Step 1 — Gather

## 6.1 Purpose

The Gather step teaches students to obtain clinically useful subjective information before making an acuity decision.

The screen should feel like a focused triage interview, not an open-ended chatbot.

---

## 6.2 Layout

```text
+--------------------------------------------------------------------------------+
| Gather                                                                         |
| Ask focused questions to clarify acuity, risk, and next actions.                |
+--------------------------------------------------------------------------------+
|                                                                                |
| Conversation                                                                   |
| ------------------------------------------------------------------------------ |
| Student: What brought you in today?                                             |
| Patient: I started having severe pain in my right foot...                       |
|                                                                                |
| [ Ask a focused question...                                      ] [ Ask ]      |
| [ Dictate ]                                                                    |
|                                                                                |
+--------------------------------------------------------------------------------+
| Evidence collected                                                             |
| Chief concern             ✓                                                    |
| Red flags                 1 found                                              |
| PMH                       incomplete                                           |
| Medications/allergies     missing                                              |
| Functional context         not asked                                           |
+--------------------------------------------------------------------------------+
```

---

## 6.3 Evidence Board

The evidence board should summarize interview completeness without becoming a long checklist.

Recommended domains:

```text
Chief concern
Red flags
Relevant PMH
Medications / allergies
Functional context
Mechanism or symptom timeline
```

For some cases, additional domains may appear:

```text
Pregnancy status
Anticoagulation
Immunosuppression
Neurovascular symptoms
Suicidal ideation
Chest pain features
Stroke symptoms
```

Only show case-relevant domains.

---

## 6.4 Coach Mode Behavior

When Coach Mode is on, show one next-best hint.

Example:

```text
Missing: medications and allergies.
Try asking: “What medications do you take, and do you have any allergies?”
```

Do not show five suggested questions at once. That creates clutter and encourages clicking rather than reasoning.

---

## 6.5 Interview Input

Primary input:

```text
Ask a focused question...
```

Optional voice input:

```text
Dictate
```

The voice input should be secondary. It should not visually compete with the main question box.

---

# 7. Step 2 — Examine

## 7.1 Purpose

The Examine step teaches students to synthesize source vitals and identify the focused physical exam needed for safe triage.

This is where the app should make its data-strict design most visible.

---

## 7.2 Layout

```text
+--------------------------------------------------------------------------------+
| Examine                                                                        |
| Review source vitals and identify the focused exam needed for this complaint.   |
+--------------------------------------------------------------------------------+
| Vitals                                                                         |
| HR 108        RR 22        SpO2 97%        BP 198/107        Temp 97.0°F        |
| Source        Source       Source          Source            Source             |
+--------------------------------------------------------------------------------+
| What you must check                                                            |
| Focused exam should assess distal pulses, capillary refill, motor function,     |
| sensation, pain with passive stretch, compartment firmness, wound status, and    |
| deformity.                                                                     |
| Reviewed inference                                                             |
+--------------------------------------------------------------------------------+
| Why it matters                                                                 |
| Open long-bone fracture requires serial neurovascular and compartment checks.   |
+--------------------------------------------------------------------------------+
```

---

## 7.3 Vitals Design

Vitals should be displayed as compact cards.

```text
HR
108
Source
```

If missing:

```text
BP
Not documented
Source
```

If abnormal:

```text
BP
198/107
High
```

Use color sparingly. Do not color every vital sign. Only highlight values that meaningfully affect acuity.

---

## 7.4 Focused Exam Card

Rename:

```text
Focused Physical Exam Requirements
```

to:

```text
What you must check
```

This is clearer and more learner-centered.

The focused exam card should be populated from reviewed `inferred_facts` where:

```text
domain == "physical_exam"
```

For example, the reviewed case augmentation for an open tibia/fibula fracture states that the focused exam should document open wound status, deformity, bleeding, contamination, compartment firmness, pain with passive stretch, distal pulses, capillary refill, motor function, and sensation.

For a wrist pain case, the reviewed augmentation requires assessment of swelling, deformity, focal bony tenderness, range of motion, grip strength, radial pulse, capillary refill, and sensation.

---

## 7.5 Educational Interaction

Do not simply display the exam target. Ask the learner to acknowledge what matters.

Example:

```text
Which findings would change acuity?

[ ] Neurovascular deficit
[ ] Open wound
[ ] Mild pain only
[ ] Deformity
[ ] Inability to bear weight
```

This makes the screen active without adding clutter.

---

# 8. Step 3 — Decide

## 8.1 Purpose

The Decide step teaches the learner to make one definitive ESI decision after reviewing subjective history, vitals, and focused exam needs.

The app should not ask for a provisional ESI earlier. One authoritative ESI decision is cleaner and more clinically authentic.

---

## 8.2 Layout

```text
+--------------------------------------------------------------------------------+
| Decide                                                                         |
| Assign the Emergency Severity Index based on acuity and expected resources.     |
+--------------------------------------------------------------------------------+
| Choose ESI                                                                     |
|                                                                                |
| [ ESI 1 ] Resuscitation                                                        |
| [ ESI 2 ] High risk, confused/lethargic/disoriented, or severe distress         |
| [ ESI 3 ] Multiple resources                                                    |
| [ ESI 4 ] One resource                                                          |
| [ ESI 5 ] No resources                                                          |
|                                                                                |
+--------------------------------------------------------------------------------+
| Decision evidence                                                              |
| ✓ Chief concern reviewed                                                       |
| ✓ Vitals reviewed                                                              |
| ✓ Focused exam target reviewed                                                 |
| ✓ Expected resource burden considered                                          |
+--------------------------------------------------------------------------------+
| Rationale                                                                      |
| [ Explain what supports your ESI level... ]                                    |
+--------------------------------------------------------------------------------+
```

---

## 8.3 ESI Selection Cards

Each ESI choice should be a clean button card.

```text
ESI 2
High risk / severe distress
```

Avoid long explanations inside the cards. Use concise labels.

The detailed ESI reference can be available in a collapsed helper:

```text
View ESI criteria
```

---

## 8.4 Rationale Requirements

The student should be required to enter a rationale before continuing.

The rationale prompt should ask for:

```text
Acuity concern
Key vitals or exam findings
Expected resources
Why not a higher or lower ESI
```

Placeholder:

```text
Example: “I chose ESI 2 because the patient has an open long-bone fracture requiring urgent clinician evaluation, orthopedic involvement, antibiotics/tetanus assessment, imaging, analgesia, and serial neurovascular checks.”
```

---

## 8.5 Feedback Timing

Do not tell the student whether the ESI is correct on this screen.

Immediate correctness feedback can short-circuit the rest of the case. Save correctness for the debrief.

---

# 9. Step 4 — Act

## 9.1 Purpose

The Act step teaches the student to select immediate care priorities and interventions based on the patient’s acuity.

The screen should focus on clinical intent, not a long undifferentiated order list.

---

## 9.2 Layout

```text
+--------------------------------------------------------------------------------+
| Act                                                                            |
| Select the immediate priorities for this patient.                               |
+--------------------------------------------------------------------------------+
| Stabilize                                                                      |
| [ ] Place in monitored care                                                    |
| [ ] Prepare airway support                                                     |
|                                                                                |
| Assess                                                                         |
| [ ] Focused neurovascular exam                                                 |
| [ ] Pain reassessment                                                          |
| [ ] Wound assessment                                                           |
|                                                                                |
| Treat                                                                          |
| [ ] Analgesia                                                                  |
| [ ] Immobilization                                                             |
| [ ] Antibiotics / tetanus assessment                                           |
|                                                                                |
| Escalate                                                                       |
| [ ] Notify clinician                                                           |
| [ ] Orthopedic consult                                                         |
+--------------------------------------------------------------------------------+
```

---

## 9.3 Action Grouping

Recommended groups:

```text
Stabilize
Assess
Treat
Escalate
Prepare disposition
```

This teaches why actions are chosen.

---

## 9.4 Data Mapping

Step 4 should use:

```text
expected_action
action_id
intervention flags
resource counts
case disposition
```

The reviewed augmentation for the open tibia/fibula fracture recommends monitored care, clinician and orthopedic notification, wound protection, tetanus and antibiotic assessment, and repeat neurovascular checks.

Those actions should become selectable learning targets.

---

## 9.5 Coach Mode

Coach hints should be brief and specific.

Example:

```text
You selected analgesia but not neurovascular reassessment.
For extremity trauma, distal pulse, sensation, motor function, and capillary refill are safety checks.
```

---

# 10. Step 5 — Reassess

## 10.1 Purpose

The Reassess step teaches students that triage is not finished after the first ESI decision. Some patients require serial checks, escalation triggers, and ongoing risk monitoring.

This step is especially important because the app uses static case data and should not fabricate repeat vitals.

Instead of inventing serial physiologic changes, the interface should ask:

```text
What could get worse?
What must be checked again?
What finding would trigger escalation?
```

---

## 10.2 Rename the Screen

Current:

```text
Care Response & Reassessment Check
```

Better:

```text
Reassess
```

Main heading:

```text
What could get worse?
```

This is shorter, clearer, and more clinically memorable.

---

## 10.3 Layout

```text
+--------------------------------------------------------------------------------+
| Reassess                                                                       |
| Identify what must be monitored before this patient can safely wait.            |
+--------------------------------------------------------------------------------+
| What could get worse?                                                          |
| Select all that apply.                                                         |
|                                                                                |
| [ ] Distal pulses                                                              |
| [ ] Capillary refill                                                           |
| [ ] Motor function                                                             |
| [ ] Sensation                                                                  |
| [ ] Pain with passive stretch                                                  |
| [ ] Compartment firmness                                                       |
| [ ] Repeat pain score only                                                     |
|                                                                                |
+--------------------------------------------------------------------------------+
| Why?                                                                           |
| [ Explain the reassessment risk... ]                                           |
+--------------------------------------------------------------------------------+
```

---

## 10.4 Data Mapping

Step 5 should use:

```text
ddx.next_discriminator
practice_rule
teaching_points
expected_action
```

For the open tibia/fibula fracture case, the reviewed augmentation teaches that the open fracture and neurovascular exam should anchor acuity, not the current pain score alone.

That practice rule should appear during debrief, not before the student answers.

---

## 10.5 Feedback After Selection

After the learner submits:

```text
Good catch:
Distal pulses, sensation, motor function, capillary refill, pain with passive stretch, and compartment firmness are key reassessment targets.

Needs attention:
Pain score alone is not enough to determine safety in an open long-bone fracture.
```

Keep this feedback short. Save full explanation for debrief.

---

# 11. Step 6 — Handoff

## 11.1 Purpose

The Handoff step teaches students to communicate a triage case clearly using SBAR.

The interface should support structure without writing the answer for the learner.

---

## 11.2 Layout

```text
+--------------------------------------------------------------------------------+
| Handoff                                                                        |
| Create a concise SBAR handoff for the receiving clinician or nurse.             |
+--------------------------------------------------------------------------------+
| Situation                                                                      |
| [ One-sentence reason for handoff ]                                             |
|                                                                                |
| Background                                                                     |
| [ Relevant PMH, arrival mode, mechanism, context ]                              |
|                                                                                |
| Assessment                                                                     |
| [ Vitals, acuity, focused exam concerns, ESI rationale ]                        |
|                                                                                |
| Recommendation                                                                 |
| [ What needs to happen next ]                                                   |
+--------------------------------------------------------------------------------+
| SBAR completeness: 3 / 4                                                        |
| Missing: Recommendation                                                        |
+--------------------------------------------------------------------------------+
```

---

## 11.3 SBAR Completeness Indicator

The completeness indicator should be small and non-punitive.

Examples:

```text
SBAR completeness: 4 / 4
```

```text
Missing: Assessment
```

```text
Consider adding: escalation recommendation
```

---

## 11.4 AI Tutor Support

If AI critique is enabled, the app may suggest improvements after the student submits the SBAR.

If AI is unavailable, use deterministic rubric feedback.

The UI should never show a blank critique panel.

---

# 12. Step 7 — Learn

## 12.1 Purpose

The Learn step provides structured feedback after the encounter. It should help the student understand what they did well, what they missed, and how to improve next time.

The debrief should not feel like a dense score report. It should start with the most important takeaway.

---

## 12.2 Feedback Hierarchy

Use three layers:

```text
Layer 1: Immediate takeaway
Layer 2: Decision drivers
Layer 3: Expandable details
```

---

## 12.3 Layout

```text
+--------------------------------------------------------------------------------+
| Learn                                                                          |
| Review your triage decision, actions, reassessment plan, and handoff.           |
+--------------------------------------------------------------------------------+
| Result                                                                         |
| ESI: Under-triaged                                                             |
| Student ESI: 3                                                                 |
| Reference ESI: 2                                                               |
| Priority issue: Open fracture risk was not escalated enough                    |
+--------------------------------------------------------------------------------+
| Key teaching rule                                                              |
| Open long-bone fracture requires urgent attention and serial neurovascular      |
| assessment, even if the current pain score is low.                              |
+--------------------------------------------------------------------------------+
| Decision drivers                                                               |
| - Open long-bone fracture                                                       |
| - Transfer/admission context                                                    |
| - Orthopedic involvement                                                        |
| - Need for antibiotics/tetanus assessment                                       |
| - Risk of neurovascular compromise                                              |
+--------------------------------------------------------------------------------+
| Expand details                                                                 |
| [ Action ledger ]                                                              |
| [ Rationale feedback ]                                                         |
| [ SBAR feedback ]                                                              |
| [ Case evidence ]                                                              |
| [ Ask tutor ]                                                                  |
+--------------------------------------------------------------------------------+
```

---

## 12.4 Executive Summary

The top of the debrief should answer:

```text
Was the ESI correct?
Was the patient over- or under-triaged?
What was the most important missed risk?
What should the student remember?
```

Keep this section visible and concise.

---

## 12.5 Action Ledger

The action ledger should compare selected actions with expected actions.

```text
Action                         Student       Expected       Feedback
Neurovascular exam             Selected      Expected       Correct
Pain reassessment              Missed        Expected       Reassess severe or evolving pain
Orthopedic notification         Missed        Expected       Needed for open fracture
```

This should be collapsible by default.

---

## 12.6 Rationale Feedback

Rename:

```text
Free-Text Rubric Evaluation
```

to:

```text
Rationale feedback
```

Evaluate whether the rationale mentioned:

```text
Acuity
Vitals
Exam findings
Expected resources
Escalation risk
Why alternatives were less appropriate
```

---

## 12.7 Case Evidence

The case evidence panel should show the data used for grading.

Group it by provenance:

```text
Source data
Reviewed inference
Reference answer
```

This builds learner trust.

---

## 12.8 Interactive Tutor

The AI tutor should be optional and visually secondary.

Place it at the bottom of the debrief.

Prompt:

```text
Ask a follow-up question about this case...
```

Examples:

```text
Why is this ESI 2 instead of ESI 3?
What makes pain score unreliable here?
What should I include in the SBAR?
```

The tutor must remain grounded in the static case data and reviewed augmentations.

---

# 13. Feedback Architecture

## 13.1 Two Feedback Modes

The app should separate feedback into:

```text
In-encounter coaching
Post-encounter debriefing
```

---

## 13.2 In-Encounter Coaching

Coach Mode should be:

```text
Optional
Brief
Non-punitive
Actionable
```

Example:

```text
Missing: medications and allergies.
Ask about current medications before moving on.
```

Avoid:

```text
You are wrong.
You forgot medications.
This will reduce your score.
```

---

## 13.3 Post-Encounter Debriefing

Debriefing should be:

```text
Specific
Evidence-based
Prioritized
Expandable
```

Feedback should focus on the most educationally important issues first.

Example:

```text
Priority feedback:
You correctly recognized the need for imaging, but missed that an open long-bone fracture requires urgent escalation and serial neurovascular checks.
```

---

## 13.4 Deterministic Fallbacks

AI feedback should be optional. The product must work fully without it.

If AI feedback fails:

```text
AI critique unavailable.
Showing rubric-based feedback instead.
```

Never show:

```text
No response
Error: null
Provider failed
```

---

# 14. Visual Design System

## 14.1 Visual Tone

The interface should be:

```text
Calm
Clinical
Minimal
Readable
Structured
```

Avoid:

```text
Decorative gradients
Dense dashboards
Large icon sets
Excessive color
Multiple competing panels
```

---

## 14.2 Color Palette

Use color only for meaning.

| Token      |       Hex | Use                             |
| ---------- | --------: | ------------------------------- |
| Background | `#eef3f6` | Calm page background            |
| Surface    | `#ffffff` | Main cards                      |
| Ink        | `#12212f` | Primary text                    |
| Muted text | `#5f6f7a` | Secondary text                  |
| Border     | `#dbe5ea` | Card and field borders          |
| Navy       | `#183f7a` | Header accents                  |
| Teal       | `#007c89` | Active state and primary action |
| Green      | `#2e7d4f` | Complete/correct                |
| Amber      | `#b76500` | Caution/incomplete              |
| Red        | `#b42318` | Critical/error                  |
| Gray       | `#6b7280` | Missing/not documented          |

---

## 14.3 Color Rules

Use:

```text
Teal for current action
Green for completed or correct
Amber for incomplete or caution
Red for critical risk or unsafe error
Gray for unavailable data
```

Do not use color decoratively.

---

## 14.4 Typography

Recommended:

```text
Font: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
```

Type hierarchy:

```text
Page title: 20–24px, 800
Step title: 22–28px, 800
Section heading: 15–16px, 800
Body text: 15–16px, 400–500
Metadata: 12–13px, 700
Pills: 11–12px, 700
```

Avoid oversized headings. This is a learning tool, not a marketing page.

---

## 14.5 Spacing

Use generous spacing but keep density appropriate for clinical work.

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 24px;
--space-6: 32px;
```

---

## 14.6 Cards

Use one dominant card per step.

Recommended card style:

```css
.step-card {
  background: #ffffff;
  border: 1px solid #dbe5ea;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(18, 33, 47, 0.06);
  padding: 24px;
}
```

Avoid heavy dashboard shadows.

---

## 14.7 Buttons

Primary button:

```text
Continue
Submit ESI
Complete handoff
```

Secondary button:

```text
Back
Review vitals
View criteria
```

Avoid too many buttons in the action bar.

Recommended:

```text
Primary action on the right
Secondary action on the left
```

---

# 15. Component System

## 15.1 Core Components

### `AppShell`

Responsible for:

```text
Topbar
Case anchor
Reasoning spine
Active step layout
Action bar
```

---

### `CaseAnchor`

Displays:

```text
Age
Sex
Chief concern
Arrival mode
Vitals status
ESI state
```

Should not show reference ESI until debrief.

---

### `ReasoningSpine`

Displays:

```text
Gather
Examine
Decide
Act
Reassess
Handoff
Learn
```

States:

```text
complete
active
locked
```

---

### `StepCard`

Reusable wrapper for each task.

Contains:

```text
Eyebrow
Title
Instruction
Main content
Optional support panel
```

---

### `EvidenceBoard`

Used in Step 1.

Displays:

```text
Collected domains
Missing domains
Red flags
Coach hint
```

---

### `VitalsGrid`

Used in Step 2 and debrief.

Displays:

```text
HR
BP
RR
SpO2
Temperature
Pain
```

Includes data-state handling.

---

### `DataStateBadge`

Displays:

```text
Source
Reviewed inference
Student
Reference
Missing
Unable to assess
Source error
```

---

### `ExamTargetCard`

Used in Step 2.

Displays reviewed physical exam targets from `inferred_facts`.

---

### `DecisionCardGroup`

Used in Step 3.

Displays ESI options.

---

### `ActionSelector`

Used in Step 4.

Groups interventions by intent:

```text
Stabilize
Assess
Treat
Escalate
Prepare disposition
```

---

### `ReassessmentChallenge`

Used in Step 5.

Displays reassessment targets and rationale prompt.

---

### `SBARBuilder`

Used in Step 6.

Four structured fields:

```text
Situation
Background
Assessment
Recommendation
```

---

### `DebriefSummary`

Used in Step 7.

Displays:

```text
Correct / over-triaged / under-triaged
Student ESI
Reference ESI
Priority feedback
Key teaching rule
```

---

### `ActionLedger`

Used in Step 7.

Compares:

```text
Student actions
Expected actions
Feedback
```

---

### `TutorPanel`

Optional AI tutor grounded in case data.

Should be collapsed by default.

---

# 16. Responsive Design

## 16.1 Desktop

Use a two-column layout only when helpful.

```text
Main work area: 70%
Support panel: 30%
```

Example:

```text
Conversation thread | Evidence board
Vitals grid         | What you must check
ESI selection       | Decision evidence
```

---

## 16.2 Mobile

Stack all content vertically.

Order:

```text
Step instruction
Main task
Support/evidence
Action button
```

The case banner should become horizontally scrollable or wrap into compact chips.

---

## 16.3 Avoid Mobile Clutter

On small screens:

```text
Hide long explanations behind “Why this matters”
Collapse evidence details
Show only one coach hint
Keep primary action sticky at bottom
```

---

# 17. Microcopy Guidelines

## 17.1 Use Plain Clinical Language

Prefer:

```text
What you must check
What could get worse?
Why did you choose this ESI?
What needs to happen next?
```

Avoid:

```text
Focused Physical Exam Requirements
Clinical Reassessment Anchor
Free-Text Rubric Evaluation
Objective Synthesis Module
```

---

## 17.2 Be Supportive, Not Punitive

Prefer:

```text
Consider reassessing distal neurovascular status before disposition.
```

Avoid:

```text
Incorrect. You failed to assess neurovascular status.
```

---

## 17.3 Make Missing Data Explicit

Prefer:

```text
Temperature not documented
Pain unable to assess
BP source value incomplete
```

Avoid:

```text
N/A
Unknown
—
```

---

# 18. Scoring and Assessment Design

## 18.1 Scoring Categories

Recommended total score components:

```text
Interview completeness
Vitals and source data review
Focused exam recognition
ESI accuracy
ESI rationale
Care priorities
Reassessment plan
SBAR quality
```

---

## 18.2 Do Not Overemphasize Numerical Score

The score should be visible but secondary to learning feedback.

Example:

```text
Overall: 58 / 65
Main learning issue: reassessment plan incomplete
```

---

## 18.3 Prioritize Safety-Critical Errors

Safety-critical misses should be highlighted above minor omissions.

Examples:

```text
Under-triage of high-risk presentation
Failure to escalate respiratory distress
Missing neurovascular checks in open fracture
Ignoring abnormal vitals
Failure to recognize unstable presentation
```

---

# 19. Case Data Mapping

## 19.1 Raw CSV Mapping

| UI element         | Data source | Display behavior                             |
| ------------------ | ----------- | -------------------------------------------- |
| Age                | Raw CSV     | Round or display as years                    |
| Sex                | Raw CSV     | Banner                                       |
| Race               | Raw CSV     | Usually hidden unless educationally relevant |
| Arrival mode       | Raw CSV     | Banner                                       |
| Chief complaint    | Raw CSV     | Banner; flag source errors                   |
| Vitals             | Raw CSV     | Step 2                                       |
| Pain               | Raw CSV     | Preserve original value                      |
| Acuity             | Raw CSV     | Reference ESI; hidden until debrief          |
| Disposition        | Raw CSV     | Debrief and case context                     |
| Resource counts    | Raw CSV     | ESI/resource feedback                        |
| Intervention flags | Raw CSV     | Expected care context                        |
| Expert opinions    | Raw CSV     | Case quality or educator review              |
| Final decision     | Raw CSV     | Filter cases for learner mode                |

---

## 19.2 Reviewed JSON Mapping

| UI element          | JSON field                       | Display behavior         |
| ------------------- | -------------------------------- | ------------------------ |
| Working diagnosis   | `likely_working_diagnosis`       | Debrief or educator mode |
| Differential        | `ddx`                            | Debrief, tutor grounding |
| Reassessment target | `ddx.next_discriminator`         | Step 5                   |
| Teaching pearl      | `teaching_points`                | Debrief                  |
| Focused exam        | `inferred_facts.statement`       | Step 2                   |
| Expected action     | `inferred_facts.expected_action` | Step 4                   |
| Practice rule       | `inferred_facts.practice_rule`   | Step 5 and debrief       |
| Review status       | `review_status`                  | Internal quality check   |

---

# 20. Recommended Default Case Flow

## 20.1 Learner Mode

In learner mode:

```text
Show only retained/reviewed cases
Hide reference ESI until debrief
Hide expert opinions
Hide working diagnosis until debrief
Show source data and reviewed exam targets
```

---

## 20.2 Educator Mode

In educator mode:

```text
Show reference ESI
Show expert opinions
Show case review status
Show raw data fields
Show augmentation provenance
Allow case exclusion or flagging
```

---

## 20.3 Coach Mode

In coach mode:

```text
Show missing domains
Show one next-best action
Warn before unsafe progression
Do not reveal final answer
```

---

## 20.4 Exam Mode

In exam mode:

```text
No hints
No next-best prompts
No immediate feedback
Debrief only after completion
```

---

# 21. Accessibility Requirements

The app should meet basic clinical education accessibility standards.

## 21.1 Visual Accessibility

Requirements:

```text
High contrast text
No color-only meaning
Visible focus states
Readable font sizes
Clear disabled states
```

---

## 21.2 Keyboard Accessibility

All core interactions must be keyboard accessible:

```text
Interview input
ESI selection
Action checkboxes
SBAR fields
Accordion sections
Coach toggle
```

---

## 21.3 Screen Reader Support

Use semantic labels:

```text
aria-label
aria-describedby
fieldset
legend
button
textarea
```

Do not rely on visual cards alone for meaning.

---

# 22. Error and Empty States

## 22.1 AI Response Failure

```text
Patient response unavailable.
Showing reviewed fallback response.
```

---

## 22.2 Missing Vitals

```text
Vitals not fully documented.
Use available data and identify what must be reassessed.
```

---

## 22.3 No Physical Exam Inference

```text
No reviewed focused exam target is available for this case.
Use the chief concern and vitals to identify the focused exam needed.
```

---

## 22.4 Invalid Source Value

```text
This source value appears invalid.
Use the triage narrative and other structured data to reason through the case.
```

---

# 23. Implementation Priorities

## Priority 1: Reduce Anchoring

Remove pre-decision “Working ESI” from the banner.

---

## Priority 2: Add Provenance Labels

Add subtle labels for:

```text
Source
Reviewed inference
Student
Reference
```

---

## Priority 3: Redesign Step 2

Make Step 2 the central bridge between raw data and clinical reasoning:

```text
Vitals
Missing data states
Focused exam target
Why it matters
```

---

## Priority 4: Make Step 5 Interactive

Turn reassessment from a passive card into an active challenge.

---

## Priority 5: Simplify Debrief

Start with:

```text
Result
Priority issue
Key teaching rule
Decision drivers
```

Move detailed scoring into collapsible sections.

---

# 24. Example Final User Flow

```text
1. Student opens case.
2. Banner shows age, sex, chief concern, arrival mode, vitals status, and ESI pending.
3. Student interviews patient.
4. Evidence board tracks missing interview domains.
5. Student reviews vitals and focused exam targets.
6. Student assigns one definitive ESI and enters rationale.
7. Student selects care priorities grouped by clinical intent.
8. Student identifies reassessment targets.
9. Student writes SBAR.
10. Debrief compares student decisions to source data and reviewed case benchmarks.
11. Student reviews priority teaching point and optional detailed feedback.
```

---

# 25. Final Design Thesis

The ED Triage Trainer should not try to simulate a complete emergency department interface. It should simulate the **clinical reasoning path** of a safe triage clinician.

The best version of the product is:

```text
Minimal in layout
Strict in data provenance
Active in learning
Calm in tone
Explicit about uncertainty
Focused on patient safety
```

The interface should teach students that triage is not just picking an ESI number. It is the disciplined process of gathering enough information, recognizing what is dangerous, anticipating resources, acting early, reassessing what could worsen, and communicating clearly.
