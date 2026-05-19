import React, { useState, useEffect } from 'react';
import { recordVitalsReview } from '../services/api';

const EXAM_SYSTEMS = [
  {
    id: 'general',
    name: 'General Appearance & Airway',
    description: 'Assess airway patency, work of breathing, and overall distress.',
    keywords: ['airway', 'breathing', 'distress', 'appearance', 'alert', 'general'],
    normal: 'Airway is patent and self-maintained. Breathing is unlabored on room air. Patient is awake, alert, and in no acute distress.'
  },
  {
    id: 'cardio',
    name: 'Cardiovascular & Perfusion',
    description: 'Assess heart sounds, distal pulses, rhythm, and perfusion.',
    keywords: ['pulse', 'capillary', 'refill', 'perfusion', 'heart', 'cardiac', 'rhythm', 'circulation', 'vascular', 'dorsalis pedis', 'radial'],
    normal: 'Regular rate and rhythm. S1 and S2 present with no murmurs, gallops, or rubs. Distal pulses (2+) and capillary refill (<2s) are brisk throughout.'
  },
  {
    id: 'respiratory',
    name: 'Respiratory & Chest',
    description: 'Auscultate breath sounds and assess respiratory effort.',
    keywords: ['breath', 'lungs', 'auscultate', 'wheeze', 'rale', 'rhonchi', 'chest', 'respiratory'],
    normal: 'Lungs are clear to auscultation bilaterally. Good air movement throughout with no wheezes, rales, rhonchi, or retractions.'
  },
  {
    id: 'neuro',
    name: 'Neurological & Mental Status',
    description: 'Evaluate GCS, orientation, motor function, sensation, and focal deficits.',
    keywords: ['neuro', 'sensation', 'motor', 'gcs', 'alert', 'oriented', 'nerve', 'deficit', 'function'],
    normal: 'Awake, alert, and oriented x4 (person, place, time, situation). Normal speech. Cranial nerves II-XII intact. Motor function and light touch sensation intact in all extremities.'
  },
  {
    id: 'msk',
    name: 'Musculoskeletal & Extremity',
    description: 'Inspect for gross deformity, swelling, active range of motion, and point tenderness.',
    keywords: ['wrist', 'foot', 'swelling', 'deformity', 'tenderness', 'bony', 'range of motion', 'fracture', 'sprain', 'joint', 'bear weight', 'extremity', 'musculoskeletal', 'pain'],
    normal: 'Normal inspection with no gross deformity, swelling, or ecchymosis. Full active range of motion and normal strength. No focal point or bony tenderness.'
  },
  {
    id: 'skin',
    name: 'Skin & Soft Tissue',
    description: 'Inspect skin color, temperature, wounds, lacerations, erythema, or warmth.',
    keywords: ['skin', 'wound', 'laceration', 'erythema', 'warmth', 'rash', 'color', 'cellulitis', 'abscess', 'soft tissue', 'cut'],
    normal: 'Skin is warm, dry, and intact with normal color. No rash, petechiae, purpura, active bleeding, open wounds, erythema, or localized warmth.'
  },
  {
    id: 'abd',
    name: 'Abdominal & Gastrointestinal',
    description: 'Palpate for tenderness, rigidity, guarding, rebound, or organomegaly.',
    keywords: ['abdominal', 'abdomen', 'stomach', 'belly', 'guarding', 'rebound', 'gi', 'palpate', 'bowel'],
    normal: 'Abdomen is soft, non-tender, and non-distended. Active bowel sounds in all quadrants. No guarding, rigidity, rebound tenderness, or organomegaly.'
  }
];

function parseFirstNumber(value) {
  const match = String(value).match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function getVitalTone(vital) {
  const value = parseFirstNumber(vital.value);
  if (value === null) return 'neutral';

  if (vital.name === 'Heart Rate') {
    if (value >= 130 || value < 50) return 'critical';
    if (value >= 110 || value < 60) return 'attention';
  }
  if (vital.name === 'Blood Pressure') {
    if (value < 90 || value >= 180) return 'critical';
    if (value < 100 || value >= 160) return 'attention';
  }
  if (vital.name === 'Respiratory Rate') {
    if (value >= 30 || value < 8) return 'critical';
    if (value >= 22 || value < 12) return 'attention';
  }
  if (vital.name === 'Oxygen Saturation') {
    if (value < 90) return 'critical';
    if (value < 94) return 'attention';
  }
  if (vital.name === 'Temperature') {
    if (value >= 103 || value < 95) return 'critical';
    if (value >= 100.4 || value < 96.8) return 'attention';
  }
  if (vital.name === 'Pain Level') {
    if (value >= 8) return 'critical';
    if (value >= 5) return 'attention';
  }
  return 'stable';
}

function getSystemFacts(system, facts) {
  return facts.filter((fact) => {
    const text = `${fact.domain} ${fact.statement} ${fact.rationale || ''} ${fact.practice_rule || ''}`.toLowerCase();
    return system.keywords.some((kw) => text.includes(kw));
  });
}

function getAbnormalFinding(systemId, fact) {
  const factId = String(fact.id || '').toLowerCase();
  const statement = String(fact.statement || '').toLowerCase();
  const anchors = String((fact.source_anchors || []).join(' ')).toLowerCase();
  const fullContext = `${factId} ${statement} ${anchors}`;

  // case_029: Open Tibia/Fibula Fracture (ESI 2)
  if (fullContext.includes('case_029') || fullContext.includes('open left tibia') || fullContext.includes('tibia/fibula')) {
    if (systemId === 'msk') {
      return "Significant gross deformity and angulation of the left lower leg. Anterior calf compartment is firm but compressible with no tense pressure or severe stretch pain signs. Extreme tenderness at fracture site.";
    }
    if (systemId === 'skin') {
      return "A 3cm transverse laceration is present over the anterior mid-tibia. Active oozing is controlled with pressure dressing. Bone ends are visible in the wound bed with moderate soil contamination.";
    }
    if (systemId === 'cardio') {
      return "Left dorsalis pedis and posterior tibial pulses are palpable (2+), but capillary refill in the distal toes is slightly delayed at 2.5 seconds.";
    }
    if (systemId === 'neuro') {
      return "Light touch sensation is intact on the plantar and dorsal aspects of the left foot. Motor function of digits is preserved but limited by severe pain.";
    }
    if (systemId === 'general') {
      return "Awake, alert, in severe distress due to acute left leg pain. Airway is patent and self-maintained.";
    }
  }

  // case_021: Foot Swelling (ESI 3)
  if (fullContext.includes('case_021') || (fullContext.includes('foot') && fullContext.includes('swelling'))) {
    if (systemId === 'msk') {
      return "Moderate non-pitting edema is present over the dorsal aspect of the right foot. Exquisite tenderness on palpation over the midfoot and first metatarsophalangeal (MTP) joint, with painful limitation of active range of motion. Patient is unable to bear weight.";
    }
    if (systemId === 'skin') {
      return "Localized mild erythema and warmth noted over the dorsal right foot. No fluctuance, purulent discharge, or open wounds.";
    }
    if (systemId === 'cardio') {
      return "Right dorsalis pedis and posterior tibial pulses are 2+ and symmetric; capillary refill is brisk (<2s).";
    }
    if (systemId === 'neuro') {
      return "Light touch sensation is intact throughout all dermatomes of the right foot. Motor function of toes is intact.";
    }
  }

  // case_020: Wrist Pain (ESI 4)
  if (fullContext.includes('case_020') || fullContext.includes('wrist')) {
    if (systemId === 'msk') {
      return "Moderate swelling and localized ecchymosis over the dorsal aspect of the right wrist. Palpation elicits sharp point tenderness over the distal radius and anatomic snuffbox. Active range of motion is limited by pain; grip strength is reduced to 4/5.";
    }
    if (systemId === 'neuro') {
      return "Sensation is fully intact to light touch in radial, median, and ulnar nerve distributions. Motor function of digits is intact.";
    }
    if (systemId === 'cardio') {
      return "Right radial pulse is 2+ and symmetric; capillary refill is brisk at <2s.";
    }
    if (systemId === 'skin') {
      return "Skin is warm and dry. No open wounds, lacerations, or active bleeding.";
    }
  }

  // case_030: Foot Pain (ESI 4)
  if (fullContext.includes('case_030') || (fullContext.includes('foot') && fullContext.includes('pain'))) {
    if (systemId === 'msk') {
      return "Mild localized swelling is present over the lateral aspect of the right foot. Tenderness is elicited on palpation over the lateral malleolus and the base of the fifth metatarsal. Patient is able to bear weight and take four steps in the department with a noticeable limp.";
    }
    if (systemId === 'cardio') {
      return "Symmetric 2+ pedal pulses and brisk capillary refill (<2s).";
    }
    if (systemId === 'neuro') {
      return "Intact motor and sensory function throughout the right lower extremity.";
    }
    if (systemId === 'skin') {
      return "Skin is intact with no erythema, warmth, or open wounds.";
    }
  }

  return null;
}

function getSystemFinding(system, matchingFacts, patientData = {}, vitals = []) {
  if (matchingFacts.length > 0) {
    const specific = matchingFacts.map((fact) => getAbnormalFinding(system.id, fact)).filter((res) => res !== null);
    if (specific.length > 0) {
      return specific.join('\n\n');
    }
  }

  const complaint = String(patientData.complaint || '').toLowerCase();
  const history = String(patientData.intake?.triage_narrative || patientData.intake?.history || '').toLowerCase();
  const fullText = `${complaint} ${history}`;

  let spO2 = 100;
  let rr = 16;
  let pain = 0;
  let hr = 80;
  let sbp = 120;
  let dbp = 80;
  let temp = 98.6;

  vitals.forEach((v) => {
    const val = parseFirstNumber(v.value);
    if (val !== null) {
      if (v.name === 'Oxygen Saturation') spO2 = val;
      if (v.name === 'Respiratory Rate') rr = val;
      if (v.name === 'Pain Level') pain = val;
      if (v.name === 'Heart Rate') hr = val;
      if (v.name === 'Blood Pressure') {
        const parts = String(v.value).split('/');
        if (parts[0]) sbp = parseFirstNumber(parts[0]);
        if (parts[1]) dbp = parseFirstNumber(parts[1]);
      }
      if (v.name === 'Temperature') temp = val;
    }
  });

  if (system.id === 'general') {
    if (fullText.includes('unresponsive') || fullText.includes('cardiac arrest') || fullText.includes('cpr')) {
      return `Patient is unresponsive. Apneic or agonal respirations. No palpable central pulses. Immediate resuscitation required.`;
    }
    if (fullText.includes('altered') || fullText.includes('lethargic') || fullText.includes('somnolent') || fullText.includes('confused') || fullText.includes('overdose') || fullText.includes('intoxicat') || fullText.includes('seizure')) {
      return `Patient is somnolent/lethargic but rousable to tactile stimulation. Disoriented. Airway is patent but requires continuous monitoring.`;
    }
    if (fullText.includes('anaphylaxis') || fullText.includes('allergic') || fullText.includes('stridor') || fullText.includes('choking') || fullText.includes('angioedema') || fullText.includes('throat closing')) {
      return `Patient in severe distress. Noticeable facial/lip swelling. Audible stridor and hoarseness on vocalization. Threat to airway patency.`;
    }
    if (fullText.includes('shortness of breath') || fullText.includes('dyspnea') || fullText.includes('breath') || fullText.includes('copd') || fullText.includes('asthma') || fullText.includes('chf') || fullText.includes('pneumonia') || rr >= 26 || spO2 <= 91) {
      return `Patient is awake and alert, but in severe respiratory distress. Speaking in single words. Prominent accessory muscle use and intercostal retractions noted (RR ${rr}). Airway is intact.`;
    }
    if (rr >= 22 || spO2 < 95) {
      return `Patient is awake and alert, in moderate respiratory distress. Speaking in partial sentences. Mild tachypnea noted (RR ${rr}). Airway is patent and self-maintained.`;
    }
    if (pain >= 8 || sbp >= 180 || hr >= 120 || sbp < 90) {
      return `Patient is awake and alert, in moderate to severe distress due to acute presentation. Cradling affected area or restless on gurney. Airway is patent and self-maintained.`;
    }
    if (pain >= 5 || temp >= 101) {
      return `Patient is awake, alert, and cooperative. Appears ill or in mild discomfort secondary to presenting complaint. Airway is patent.`;
    }
    return system.normal;
  }

  if (system.id === 'respiratory') {
    if (fullText.includes('stridor') || fullText.includes('anaphylaxis') || fullText.includes('angioedema')) {
      return `Significant inspiratory stridor audible without stethoscope. Diminished air entry bilaterally secondary to upper airway edema.`;
    }
    if (fullText.includes('wheez') || fullText.includes('asthma') || fullText.includes('copd') || fullText.includes('allergic')) {
      return `Auscultation reveals loud diffuse expiratory wheezing bilaterally with a markedly prolonged expiratory phase. Decreased air movement at the bases. Suprasternal retractions present.`;
    }
    if (fullText.includes('cough') || fullText.includes('sputum') || fullText.includes('pneumonia') || fullText.includes('fever') || fullText.includes('chills') || fullText.includes('infection') || temp >= 100.4) {
      return `Auscultation reveals coarse rhonchi and focal crackles (rales) localized to the affected lung fields. Diminished breath sounds at the base. Tachypnea noted (RR ${rr}).`;
    }
    if (fullText.includes('chf') || fullText.includes('edema') || fullText.includes('orthopnea') || (fullText.includes('swelling') && (fullText.includes('leg') || fullText.includes('ankle')))) {
      return `Auscultation reveals bibasilar crackles (rales) extending halfway up both posterior lung fields. Jugular venous distension noted. Tachypneic on room air.`;
    }
    if (fullText.includes('shortness of breath') || fullText.includes('dyspnea') || fullText.includes('pulmonary embolism') || fullText.includes('chest pain') || rr >= 22 || spO2 < 95) {
      return `Tachypnea present (RR ${rr}). Good bilateral air entry but breath sounds are slightly shallow. No wheezes or rales. Patient exhibits increased respiratory effort.`;
    }
    return system.normal;
  }

  if (system.id === 'cardio') {
    if (fullText.includes('chest pain') || fullText.includes('chest') || fullText.includes('acs') || fullText.includes('mi') || fullText.includes('heart') || fullText.includes('palpitation') || fullText.includes('syncope') || fullText.includes('aortic') || fullText.includes('dissection') || hr >= 100 || hr < 55 || sbp < 90 || sbp >= 180) {
      let findings = `Heart rate is ${hr} bpm (${hr >= 100 ? 'tachycardic' : hr < 60 ? 'bradycardic' : 'normocardic'}) with a regular rhythm. S1 and S2 heart sounds present.`;
      if (sbp < 90) {
        findings += ` Distal radial pulses are weak and thready (1+). Capillary refill is delayed at 3-4 seconds, consistent with peripheral vasoconstriction/hypoperfusion.`;
      } else if (sbp >= 180) {
        findings += ` Bounding peripheral pulses (3+) bilaterally. Blood pressure elevated at ${sbp}/${dbp} mmHg. No audible S3/S4 gallop or new regurgitant murmur.`;
      } else {
        findings += ` Distal pulses are equal and 2+ bilaterally. Capillary refill <2s. No friction rubs or gallops. Patient notes central chest discomfort during exam.`;
      }
      return findings;
    }
    if (fullText.includes('edema') || (fullText.includes('swelling') && (fullText.includes('leg') || fullText.includes('ankle') || fullText.includes('foot'))) || fullText.includes('chf')) {
      return `Regular rhythm (HR ${hr} bpm). 2+ pitting edema in bilateral lower extremities extending up to the mid-tibia. Distal pedal pulses are palpable (2+). Jugular venous distension present at 30 degrees.`;
    }
    return system.normal;
  }

  if (system.id === 'msk') {
    if (fullText.includes('fall') || fullText.includes('trauma') || fullText.includes('mvc') || fullText.includes('accident') || fullText.includes('assault') || fullText.includes('hit') || fullText.includes('collision')) {
      if (fullText.includes('head') || fullText.includes('neck')) {
        return `Inspection reveals contusion/abrasion to the head/neck region. Cervical spine immobilized with collar; palpable posterior midline cervical tenderness. No focal neurological step-off.`;
      }
      if (fullText.includes('leg') || fullText.includes('hip') || fullText.includes('femur') || fullText.includes('knee') || fullText.includes('ankle') || fullText.includes('foot')) {
        return `Inspection reveals localized soft tissue swelling, ecchymosis, and severe tenderness over the affected lower extremity joint/bone. Active range of motion severely limited by pain. Unable to bear weight. Distal pedal pulses intact.`;
      }
      if (fullText.includes('arm') || fullText.includes('shoulder') || fullText.includes('elbow') || fullText.includes('wrist') || fullText.includes('hand')) {
        return `Inspection reveals localized swelling, deformity, and exquisite tenderness over the affected upper extremity. Painful limitation of movement. Distal neurovascular examination intact.`;
      }
      return `Inspection reveals diffuse soft tissue contusions and tenderness across the torso/extremities consistent with mechanism of injury. Range of motion limited by generalized soreness.`;
    }
    if (fullText.includes('wrist') || fullText.includes('arm') || fullText.includes('hand') || fullText.includes('shoulder') || fullText.includes('elbow')) {
      return `Inspection reveals moderate swelling and localized tenderness over the affected upper extremity. Active range of motion restricted by pain. Grip strength reduced due to discomfort. Distal pulses intact.`;
    }
    if (fullText.includes('foot') || fullText.includes('ankle') || fullText.includes('leg') || fullText.includes('knee') || fullText.includes('hip') || fullText.includes('gait') || fullText.includes('limp')) {
      return `Inspection reveals localized swelling and exquisite tenderness over the affected lower extremity. Active range of motion is restricted by pain. Impaired weight-bearing ability with noticeable limp. Pedal pulses 2+ bilaterally.`;
    }
    if (fullText.includes('back') || fullText.includes('spine') || fullText.includes('lumbar') || fullText.includes('sciatica') || fullText.includes('neck')) {
      return `Palpation reveals moderate paraspinous muscle spasm and tenderness in the affected spinal region. No midline vertebral body step-offs or bony point tenderness. Range of motion limited by discomfort. Straight leg raise negative bilaterally.`;
    }
    if (pain >= 7 && (fullText.includes('joint') || fullText.includes('body') || fullText.includes('myalgia') || fullText.includes('ache') || fullText.includes('fever'))) {
      return `Diffuse myalgias and arthralgias noted without focal joint effusion, warmth, or erythema. Full range of motion preserved but elicits subjective discomfort. Normal strength 5/5 throughout.`;
    }
    return system.normal;
  }

  if (system.id === 'skin') {
    if (fullText.includes('burn') || fullText.includes('scald') || fullText.includes('fire') || fullText.includes('chemical') || fullText.includes('smoke')) {
      return `Inspection reveals superficial and partial-thickness skin blistering/burns over the affected anatomical areas. Erythematous wound bed, exquisitely tender to touch. Clean dry dressings applied.`;
    }
    if (fullText.includes('laceration') || fullText.includes('cut') || fullText.includes('bleed') || fullText.includes('wound') || fullText.includes('trauma') || fullText.includes('fall')) {
      return `Inspection reveals a linear soft-tissue laceration/wound with clean margins over the affected area. Hemostasis achieved with direct pressure dressing. Surrounding tissue intact with no foreign body palpable.`;
    }
    if (fullText.includes('rash') || fullText.includes('hives') || fullText.includes('urticaria') || fullText.includes('itch') || fullText.includes('allergic') || fullText.includes('anaphylaxis')) {
      return `Inspection reveals diffuse erythematous, blanching wheals and urticarial plaques across the anterior trunk and extremities. Intensely pruritic. Warm to touch.`;
    }
    if (fullText.includes('cellulitis') || fullText.includes('abscess') || fullText.includes('boil') || fullText.includes('spider bite') || fullText.includes('pus') || (fullText.includes('swelling') && (fullText.includes('red') || fullText.includes('warm') || fullText.includes('tender')))) {
      return `Inspection reveals localized erythema, significant induration, and marked warmth over the affected soft tissue area. Exquisite tenderness to palpation. Surrounding skin intact with no crepitus or fluctuance noted.`;
    }
    if (temp >= 100.4 || fullText.includes('fever') || fullText.includes('chills') || fullText.includes('sweat') || fullText.includes('infection') || fullText.includes('sepsis') || hr >= 110) {
      return `Skin is warm to touch, flushed, and mildly diaphoretic. Capillary refill <2s. No active rashes, petechiae, purpura, or skin breakdown noted.`;
    }
    if (sbp < 90 || spO2 < 94 || fullText.includes('pale') || fullText.includes('clammy') || fullText.includes('syncope')) {
      return `Skin is cool, pale, and clammy/diaphoretic to touch. Capillary refill is delayed at 3 seconds in the nail beds. No cyanosis or jaundice.`;
    }
    return system.normal;
  }

  if (system.id === 'abd') {
    if (fullText.includes('abd') || fullText.includes('stomach') || fullText.includes('belly') || fullText.includes('epigastric') || fullText.includes('nausea') || fullText.includes('vomit') || fullText.includes('diarrhea') || fullText.includes('constipat') || fullText.includes('gi') || fullText.includes('bleed') || fullText.includes('melena') || fullText.includes('hematochezia') || fullText.includes('rectal') || fullText.includes('flank') || fullText.includes('kidney') || fullText.includes('urine') || fullText.includes('dysuria') || fullText.includes('pelvic')) {
      if (fullText.includes('flank') || fullText.includes('kidney') || fullText.includes('renal') || fullText.includes('stone') || fullText.includes('dysuria') || fullText.includes('pyelo')) {
        return `Abdomen is soft and non-distended. Marked costovertebral angle (CVA) tenderness to percussion on the affected flank. Suprapubic area soft without distension. Normoactive bowel sounds.`;
      }
      if (fullText.includes('bleed') || fullText.includes('melena') || fullText.includes('hematochezia') || (fullText.includes('vomit') && fullText.includes('blood')) || fullText.includes('cirrhosis')) {
        return `Abdomen is soft, non-distended, mild diffuse epigastric tenderness to palpation. Hyperactive bowel sounds. Rectal exam (if indicated) reveals heme-positive stool. No organomegaly or shifting dullness.`;
      }
      if (fullText.includes('appendicitis') || fullText.includes('rlq') || fullText.includes('right lower quadrant')) {
        return `Abdomen is firm and moderately distended. Marked focal tenderness to palpation at McBurney's point in the right lower quadrant. Positive guarding and mild rebound tenderness present. Hypoactive bowel sounds.`;
      }
      if (fullText.includes('cholecystitis') || fullText.includes('ruq') || fullText.includes('right upper quadrant') || fullText.includes('gallbladder')) {
        return `Abdomen is soft but tender to deep palpation in the right upper quadrant and epigastrium. Positive Murphy's sign (inspiratory arrest on RUQ palpation). No jaundice or palpable mass.`;
      }
      if (pain >= 7) {
        return `Abdomen is soft but moderately tender to palpation across the mid-abdomen/epigastrium. Voluntary guarding noted on deep palpation; no board-like rigidity or severe rebound tenderness. Active bowel sounds.`;
      }
      return `Abdomen is soft with mild diffuse tenderness to deep palpation. Non-distended. Active bowel sounds in all four quadrants. No hepatosplenomegaly or peritoneal signs.`;
    }
    return system.normal;
  }

  if (system.id === 'neuro') {
    if (fullText.includes('stroke') || fullText.includes('tia') || fullText.includes('slurred') || fullText.includes('speech') || fullText.includes('facial') || fullText.includes('droop') || (fullText.includes('weakness') && (fullText.includes('arm') || fullText.includes('leg') || fullText.includes('side'))) || fullText.includes('numbness') || fullText.includes('paresthesia') || fullText.includes('hemiparesis')) {
      return `Awake, alert, and oriented. Noticeable mild facial asymmetry/droop or slurred speech. Pronator drift positive on the affected upper extremity. Motor strength 4/5 on the affected side compared to 5/5 contralaterally. Decreased sensation to pinprick in the affected distribution.`;
    }
    if (fullText.includes('seizure') || fullText.includes('epilepsy') || fullText.includes('postictal') || fullText.includes('convulsion') || fullText.includes('shaking') || fullText.includes('tongue bite')) {
      return `Patient is in a postictal state: lethargic but rousable to voice. Oriented x2 (person and place, confused on time/situation). Sluggish but equal pupillary response to light. No focal motor deficits noted.`;
    }
    if (fullText.includes('headache') || fullText.includes('migraine') || fullText.includes('meningitis') || fullText.includes('stiff neck') || fullText.includes('photophobia')) {
      if (fullText.includes('meningitis') || fullText.includes('stiff neck') || temp >= 101) {
        return `Awake, alert, in significant distress due to severe throbbing headache. Marked nuchal rigidity (resistance to passive neck flexion). Photophobia present. Cranial nerves II-XII intact. No focal motor or sensory deficits.`;
      }
      return `Awake, alert, in moderate distress due to headache. Pupils equal, round, reactive to light and accommodation. Extraocular movements intact. Normal fundoscopic examination. Cranial nerves II-XII intact. Normal gait.`;
    }
    if (fullText.includes('dizzy') || fullText.includes('vertigo') || fullText.includes('syncope') || fullText.includes('faint') || fullText.includes('lightheaded') || fullText.includes('fall') || fullText.includes('balance') || fullText.includes('gait')) {
      return `Awake, alert, and oriented x4. Cranial nerves intact. Spontaneous horizontal nystagmus or subjective dizziness reproduced on head turning. Romberg test positive for swaying. Motor strength 5/5 bilaterally. No focal sensory deficits.`;
    }
    if (fullText.includes('overdose') || fullText.includes('intoxicat') || fullText.includes('alcohol') || fullText.includes('etoh') || fullText.includes('drug') || fullText.includes('ingestion') || fullText.includes('suicide') || fullText.includes('psych') || fullText.includes('anxiety') || fullText.includes('panic') || fullText.includes('agitat') || fullText.includes('hallucinat')) {
      if (fullText.includes('opioid') || fullText.includes('heroin') || fullText.includes('fentanyl') || rr <= 10) {
        return `Somnolent, minimally responsive to voice. Pinpoint pupils (1mm) with sluggish reactivity. Markedly depressed respiratory drive (RR ${rr}). Requires immediate naloxone and airway positioning.`;
      }
      if (fullText.includes('agitat') || fullText.includes('hallucinat') || fullText.includes('psych') || hr >= 110 || sbp >= 160) {
        return `Awake, restless, and hyper-vigilant. Rapid, pressured speech. Mydriatic pupils (5-6mm) reactive to light. Tremor noted in outstretched hands. Gross motor function intact.`;
      }
      return `Awake, alert, cooperative but anxious/flat affect. Speech clear. Cranial nerves II-XII intact. Motor strength 5/5 throughout. Normal reflexes and sensation.`;
    }
    if (fullText.includes('head') && (fullText.includes('trauma') || fullText.includes('injury') || fullText.includes('hit') || fullText.includes('fall') || fullText.includes('concussion'))) {
      return `Awake and alert. GCS 15. Pupils equal, round, and reactive to light (PERRL). Extraocular movements intact. Mild amnesia to the immediate traumatic event reported. No focal sensory or motor deficits. Normal tandem gait.`;
    }
    return system.normal;
  }

  return system.normal;
}

function VitalSigns({ sessionId, patientData, coachEnabled = false, onNext, onCapture, onClock }) {
  const [vitals, setVitals] = useState([]);
  const [physicalExamFacts, setPhysicalExamFacts] = useState([]);
  const [conductedExams, setConductedExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    const fetchExamineData = async () => {
      try {
        const data = await recordVitalsReview(sessionId);
        if (isMounted) {
          setVitals(data.vitals || []);
          setPhysicalExamFacts(data.physical_exam || []);
          if (onClock && data.clock) onClock(data.clock);
          if (onCapture) {
            onCapture({ vitals: data.vitals || [] });
          }
        }
      } catch (err) {
        if (isMounted) setError('Failed to retrieve objective vitals and physical exam targets.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchExamineData();
    return () => { isMounted = false; };
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleExam = (id) => {
    setConductedExams((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleConductAll = () => {
    setConductedExams(EXAM_SYSTEMS.map((s) => s.id));
  };

  if (loading) {
    return (
      <section className="step-card">
        <div className="loading">Retrieving objective vitals and physical exam findings...</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="step-card">
        <div className="error-message">{error}</div>
      </section>
    );
  }

  return (
    <section className="step-card examine-card" aria-labelledby="examine-heading">
      <div className="section-header">
        <div>
          <span className="eyebrow">
            Step 2 of 6 <span className="provenance-tag source-tag">Source: MIETIC Record</span>
          </span>
          <h2 id="examine-heading">Examine & Vitals Review</h2>
          <p className="subtitle">
            Interpret objective baseline vital signs and conduct focused physical examinations.
          </p>
        </div>
      </div>

      <div className="examine-vitals-container" style={{ marginBottom: '32px' }}>
        <h3>Baseline Objective Vitals</h3>
        <p className="instruction">Recorded vitals upon ED arrival. Look for danger-zone or borderline parameters.</p>
        
        <div className="monitor-grid">
          {vitals.map((vital) => {
            const tone = getVitalTone(vital);
            const isUta = String(vital.value).toLowerCase().includes('uta') || String(vital.value).includes('Unable to assess');
            return (
              <div key={`${vital.name}-${vital.value}`} className={`monitor-card ${tone} ${isUta ? 'missing-data' : ''}`}>
                <span>{vital.name}</span>
                <strong>{isUta ? 'Unable to assess (uta)' : vital.value}</strong>
                <small>
                  {isUta ? 'Missing Data Opportunity' : tone === 'stable' ? 'Within threshold' : 'Abnormal signal'}
                </small>
              </div>
            );
          })}
        </div>
      </div>

      <section className="interactive-physical-exam-section">
        <div className="section-header compact">
          <div>
            <h3>Conduct Focused Physical Examination</h3>
            <p className="instruction">
              Select organ systems below to perform physical exam maneuvers and reveal objective clinical findings.
            </p>
          </div>
          <span className="clinical-badge">{conductedExams.length} / {EXAM_SYSTEMS.length} Systems Examined</span>
        </div>

        <div className="exam-system-chips" aria-label="Physical exam systems">
          {EXAM_SYSTEMS.map((system) => {
            const isConducted = conductedExams.includes(system.id);
            return (
              <button
                type="button"
                key={system.id}
                className={`exam-chip ${isConducted ? 'conducted' : ''}`}
                onClick={() => handleToggleExam(system.id)}
                aria-pressed={isConducted}
                title={system.description}
              >
                <span className="exam-chip-icon">{isConducted ? '✓' : '+'}</span>
                <div className="exam-chip-text">
                  <strong>{system.name}</strong>
                </div>
              </button>
            );
          })}
          <button
            type="button"
            className="btn-secondary conduct-all-button"
            onClick={handleConductAll}
          >
            Conduct Complete Exam
          </button>
        </div>

        <div className="conducted-findings-container" aria-live="polite">
          {conductedExams.length > 0 ? (
            <div className="conducted-cards-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {EXAM_SYSTEMS.filter((s) => conductedExams.includes(s.id)).map((system) => {
                const matchingFacts = getSystemFacts(system, physicalExamFacts);
                const findingText = getSystemFinding(system, matchingFacts, patientData, vitals);
                const isNormal = findingText === system.normal;
                return (
                  <div className={`conducted-system-card ${isNormal ? 'normal-findings' : 'specific-findings'}`} key={system.id}>
                    <div className="system-card-header">
                      <h4>{system.name}</h4>
                      <span className={`finding-status-badge ${isNormal ? 'normal' : 'abnormal'}`}>
                        {isNormal ? 'Normal / Unremarkable' : 'Abnormal Findings'}
                      </span>
                    </div>
                    <div className="system-card-body">
                      {isNormal ? (
                        <p className="normal-finding-text">{system.normal}</p>
                      ) : (
                        <div className="specific-facts-list">
                          <div className="specific-fact-item">
                            <p className="fact-statement">{findingText}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-exam-box">
              <p>No physical exam maneuvers conducted yet. Click a system above to inspect, auscultate, or palpate.</p>
            </div>
          )}
        </div>
      </section>

      <div className="step-actions" style={{ marginTop: '36px' }}>
        <button
          type="button"
          className="btn-primary"
          onClick={onNext}
        >
          Proceed to Definitive ESI Decision
        </button>
      </div>
    </section>
  );
}

export default VitalSigns;
