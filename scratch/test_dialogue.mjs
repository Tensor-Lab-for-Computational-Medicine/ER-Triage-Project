import { planPatientAnswer, buildPatientView, renderPatientAnswer, validatePatientSpeech } from '../frontend/src/services/patientDialogueEngine.js';
import fs from 'fs';

const cases = JSON.parse(fs.readFileSync('./frontend/src/data/cases.json', 'utf8'));
const caseData = cases[0];
const patientView = buildPatientView(caseData);

console.log("Patient View presenting concern:", patientView.presenting_concern);
console.log("Patient View progression:", patientView.progression);

const plan1 = planPatientAnswer("Is this getting better or worse?", patientView, []);
console.log("Plan for 'Is this getting better or worse?':", JSON.stringify(plan1, null, 2));

const answer1 = renderPatientAnswer(plan1, patientView);
console.log("Rendered answer:", answer1);

const validated = validatePatientSpeech(answer1, plan1, patientView, []);
console.log("Validated answer:", validated);
