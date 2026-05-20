import { planPatientAnswer, buildPatientView, renderPatientAnswer, validatePatientSpeech } from '../frontend/src/services/patientDialogueEngine.js';
import fs from 'fs';

const cases = JSON.parse(fs.readFileSync('./frontend/src/data/cases.json', 'utf8'));

let failCount = 0;

cases.forEach((caseData, idx) => {
  const patientView = buildPatientView(caseData);
  const q = "When did this start, and has it been getting better, worse, or changing?";
  const plan = planPatientAnswer(q, patientView, []);
  const answer = renderPatientAnswer(plan, patientView);
  const validated = validatePatientSpeech(answer, plan, patientView);

  if (!validated) {
    console.error(`❌ Case ${idx} (${caseData.case_id || 'unknown'}) FAILED validation!`);
    console.error(`   Plan signature: ${plan.signature}`);
    console.error(`   Rendered answer: "${answer}"`);
    failCount++;
  } else {
    console.log(`✅ Case ${idx} (${caseData.case_id || 'unknown'}) PASSED validation: "${validated}"`);
  }
});

if (failCount > 0) {
  console.error(`\nTotal failures: ${failCount}`);
  process.exit(1);
} else {
  console.log(`\nAll 23 cases successfully passed validation!`);
}
