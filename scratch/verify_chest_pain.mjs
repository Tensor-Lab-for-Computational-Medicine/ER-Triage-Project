import { planPatientAnswer, buildPatientView, renderPatientAnswer } from '../frontend/src/services/patientDialogueEngine.js';
import fs from 'fs';

const cases = JSON.parse(fs.readFileSync('./frontend/src/data/cases.json', 'utf8'));

// Find cases with chest pain
cases.forEach((caseData, idx) => {
  const patientView = buildPatientView(caseData);
  if (caseData.presenting_symptoms?.includes('chest_pain') || (caseData.complaint && caseData.complaint.toLowerCase().includes('chest pain'))) {
    console.log(`\n--- Case ${idx} Details ---`);
    console.log("Complaint:", caseData.complaint);
    console.log("Presenting Concern:", patientView.presenting_concern);
    console.log("Timeline:", patientView.timeline);
    console.log("Progression:", patientView.progression);

    // Ask about symptom course
    const q = "When did this start, and has it been getting better, worse, or changing?";
    const plan = planPatientAnswer(q, patientView, []);
    const answer = renderPatientAnswer(plan, patientView);
    console.log("Learner Question:", q);
    console.log("Resolved Signature:", plan.signature);
    console.log("Resolved Answer:", answer);
  }
});
