# ER Triage UI Concept

This folder contains one single concept design for the ED Clinical Workflow Simulator. It replaces the previous multi-direction package with a unified product UI.

## Files

- `project-panel.html` - the full concept panel and exact UI contract.
- `implementation-goal.md` - the implementation goal for matching the concept in the real app.
- `assets/single-rapid-ed-concept.png` - the single ImageGen visual reference.

## Design Thesis

The app should feel like one rapid clinical reasoning workspace. Every case starts with Safety Gate, then moves through Triage Decision, Initial Actions, Reassess, Disposition, and Debrief. ABCDE is preserved, but it is condensed into the safety gate so stable cases can move quickly and unstable cases branch immediately.
