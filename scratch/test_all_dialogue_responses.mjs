import { planPatientAnswer, buildPatientView, renderPatientAnswer } from '../frontend/src/services/patientDialogueEngine.js';
import fs from 'fs';

const cases = JSON.parse(fs.readFileSync('./frontend/src/data/cases.json', 'utf8'));

cases.forEach((caseData, idx) => {
  const patientView = buildPatientView(caseData);
  const q = "When did this start, and has it been getting better, worse, or changing?";
  const plan = planPatientAnswer(q, patientView, []);
  const answer = renderPatientAnswer(plan, patientView);

  // Check if answer contains details not related to timeline or progression, e.g., "at rest", "radiat", specific pain descriptions, etc.
  console.log(`Case ${idx} (${caseData.case_id || 'unknown'}): ${answer}`);
});
