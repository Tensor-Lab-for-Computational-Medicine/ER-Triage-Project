import { planPatientAnswer, buildPatientView } from './frontend/src/services/patientDialogueEngine.js';
import fs from 'fs';

const cases = JSON.parse(fs.readFileSync('./frontend/src/data/cases.json', 'utf8'));
const caseData = cases[0];
const patientView = buildPatientView(caseData);

console.log("Patient View presenting concern:", patientView.presenting_concern);
console.log("Patient View progression:", patientView.progression);

const plan1 = planPatientAnswer("Is this getting better or worse?", patientView, []);
console.log("Plan for 'Is this getting better or worse?':", plan1);

const plan2 = planPatientAnswer("When did this start?", patientView, []);
console.log("Plan for 'When did this start?':", plan2);
