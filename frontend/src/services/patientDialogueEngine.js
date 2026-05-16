export const PATIENT_DIALOGUE_ENGINE_VERSION = 'patient_dialogue_engine_v1';
export const PATIENT_DIALOGUE_PROMPT_VERSION = 'patient_dialogue_prompt_v4';
export const PATIENT_DIALOGUE_CACHE_VERSION = 'patient_response_v5';

const CATEGORY_ORDER = [
  'general_status',
  'chief_concern',
  'timeline',
  'severity',
  'red_flags',
  'medical_history',
  'medications',
  'prior_episode',
  'pregnancy',
  'allergies'
];

const INTENT_ORDER = [
  'answer_key',
  'diagnosis_clarification',
  'general_status',
  'chief_concern',
  'timeline',
  'severity',
  'associated_symptoms',
  'red_flags',
  'cardiac_history',
  'medical_history',
  'medications',
  'allergies',
  'prior_episode',
  'pregnancy',
  'unknown'
];

const WORD_NUMBERS = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10
};

const FORBIDDEN_BASE_TERMS = [
  'altered level of consciousness',
  'altered mental status',
  'ams',
  'sdh',
  'subdural',
  'subdural hematoma',
  'intracranial hemorrhage',
  'rectal abscess',
  'perianal abscess',
  'dyspnea',
  'pedal edema',
  'chief complaint',
  'presents to the ed',
  'presented to the ed',
  'emergency department with',
  'the patient',
  "patient's wife",
  "patient's husband",
  "i's",
  "my's",
  "he's wife",
  "she's husband",
  'mietic',
  'dataset',
  'recorded ed',
  'esi',
  'acuity',
  'reference',
  'disposition',
  'admitted',
  'admission',
  'icu',
  'triage level',
  'expert opinion',
  'resource use',
  'resources',
  'ivdu',
  'etoh',
  'hcv',
  'iddm',
  'dm2',
  'cva',
  'dvt/pe',
  'bp ',
  'hr ',
  'rr ',
  'spo2'
];

const SYMPTOM_DEFINITIONS = [
  { id: 'chest_pain', label: 'chest pain', patterns: [/\bchest pain\b/i, /\bchest pressure\b/i, /\bchest tightness\b/i] },
  { id: 'shortness_of_breath', label: 'shortness of breath', patterns: [/\bshortness of breath\b/i, /\btrouble breathing\b/i, /\bdifficulty breathing\b/i, /\bdyspnea\b/i, /\bSOB\b/i] },
  { id: 'cough', label: 'cough', patterns: [/\bcough\b/i, /\bsputum\b/i] },
  { id: 'wheezing', label: 'wheezing', patterns: [/\bwheez/i] },
  { id: 'fatigue', label: 'fatigue', patterns: [/\bfatigue\b/i, /\btired\b/i] },
  { id: 'sweating', label: 'sweating', patterns: [/\bdiaphoresis\b/i, /\bsweating\b/i, /\bsweats\b/i] },
  { id: 'palpitations', label: 'palpitations', patterns: [/\bpalpitations?\b/i, /\bheart racing\b/i] },
  { id: 'orthopnea', label: 'trouble breathing when lying flat', patterns: [/\borthopnea\b/i, /\blying flat\b/i] },
  { id: 'leg_swelling', label: 'leg swelling', patterns: [/\bpedal edema\b/i, /\bleg swelling\b/i, /\bedema\b/i, /\bswollen legs?\b/i] },
  { id: 'fever_chills', label: 'fever or chills', patterns: [/\bfever\b/i, /\bchills\b/i] },
  { id: 'nausea_vomiting', label: 'nausea or vomiting', patterns: [/\bnausea\b/i, /\bnauseated\b/i, /\bvomiting\b/i, /\bthrowing up\b/i, /\bemesis\b/i, /\bN\/V\b/i] },
  { id: 'diarrhea', label: 'diarrhea', patterns: [/\bdiarrhea\b/i] },
  { id: 'abdominal_pain', label: 'belly pain', patterns: [/\babdominal pain\b/i, /\blower abdominal pain\b/i, /\bstomach pain\b/i, /\bpelvic pain\b/i] },
  { id: 'headache', label: 'headache', patterns: [/\bheadache\b/i, /\bhead pain\b/i] },
  { id: 'weakness', label: 'weakness', patterns: [/\bweakness\b/i, /\bweak\b/i, /\bflaccid\b/i] },
  { id: 'numbness', label: 'numbness', patterns: [/\bnumbness\b/i, /\bnumb\b/i, /\bsensory changes\b/i] },
  { id: 'slurred_speech', label: 'slurred speech', patterns: [/\bslurred speech\b/i] },
  { id: 'facial_droop', label: 'facial droop', patterns: [/\bfacial droop\b/i, /\bfacial weakness\b/i] },
  { id: 'confusion', label: 'confusion', patterns: [/\bconfus/i, /\bnot oriented\b/i, /\bbizarre conversation\b/i, /\baltered mental\b/i, /\bAMS\b/i] },
  { id: 'seizure', label: 'seizure', patterns: [/\bseizure\b/i] },
  { id: 'fall', label: 'fall', patterns: [/\bfall\b/i, /\bfell\b/i, /\bfallen\b/i, /\bfalling\b/i] },
  { id: 'dizziness', label: 'dizziness or unsteadiness', patterns: [/\bdizz/i, /\bunsteady\b/i, /\bunsteadiness\b/i] },
  { id: 'bleeding', label: 'bleeding', patterns: [/\bbleeding\b/i, /\bblood\b/i, /\bmelena\b/i, /\bhematochezia\b/i, /\bhematemesis\b/i] },
  { id: 'swallowing_trouble', label: 'trouble swallowing', patterns: [/\bdifficulty swallowing\b/i, /\btrouble swallowing\b/i, /\bunable to swallow\b/i, /\bdysphagia\b/i] },
  { id: 'hoarseness', label: 'hoarseness', patterns: [/\bhoarse/i] },
  { id: 'thirst', label: 'thirst', patterns: [/\bthirst\b/i, /\bthirsty\b/i] },
  { id: 'rectal_pain', label: 'painful swelling near my rectum', patterns: [/\brectal abscess\b/i, /\bperianal abscess\b/i, /\bperianal\b/i, /\bhidradenitis\b/i] }
];

const CONDITION_DEFINITIONS = [
  { label: 'atrial fibrillation', group: 'cardiac', patterns: [/\batrial fibrillation\b/i, /\ba[-\s]?fib\b/i, /\bafib\b/i] },
  { label: 'heart failure', group: 'cardiac', patterns: [/\bheart failure\b/i, /\bCHF\b/i] },
  { label: 'aortic stenosis', group: 'cardiac', patterns: [/\baortic stenosis\b/i] },
  { label: 'coronary artery disease', group: 'cardiac', patterns: [/\bcoronary artery disease\b/i, /\bCAD\b/i] },
  { label: 'a prior heart attack', group: 'cardiac', patterns: [/\bmyocardial infarction\b/i, /\bheart attack\b/i, /\bMI\b/i] },
  { label: 'a heart stent', group: 'cardiac', patterns: [/\bcardiac stent\b/i, /\bcoronary stent\b/i] },
  { label: 'high blood pressure', group: 'vascular', patterns: [/\bhypertension\b/i, /\bHTN\b/i] },
  { label: 'high cholesterol', group: 'vascular', patterns: [/\bhyperlipidemia\b/i, /\bhypercholesterolemia\b/i, /\bHLD\b/i] },
  { label: 'COPD', group: 'lung', patterns: [/\bCOPD\b/i] },
  { label: 'asthma', group: 'lung', patterns: [/\basthma\b/i] },
  { label: 'sleep apnea', group: 'lung', patterns: [/\bsleep apnea\b/i] },
  { label: 'diabetes', group: 'endocrine', patterns: [/\bdiabetes\b/i, /\btype II diabetes\b/i, /\btype 2 diabetes\b/i, /\bIDDM\b/i, /\bDM2\b/i] },
  { label: 'kidney disease', group: 'renal', patterns: [/\bkidney disease\b/i, /\bCKD\b/i, /\brenal insufficiency\b/i, /\bend-stage renal disease\b/i, /\bESRD\b/i] },
  { label: 'cirrhosis', group: 'liver', patterns: [/\bcirrhosis\b/i] },
  { label: 'hepatitis C', group: 'liver', patterns: [/\bhepatitis C\b/i, /\bHCV\b/i] },
  { label: 'a stroke', group: 'neuro', patterns: [/\bstroke\b/i, /\bCVA\b/i, /\bbasal ganglia infarct\b/i] },
  { label: 'mini-strokes', group: 'neuro', patterns: [/\bTIA\b/i, /\bTIAs\b/i] },
  { label: 'seizures', group: 'neuro', patterns: [/\bepilepsy\b/i, /\bseizures?\b/i] },
  { label: 'cancer', group: 'oncology', patterns: [/\bcancer\b/i, /\blymphoma\b/i, /\bmalignan/i, /\bcarcinoma\b/i] },
  { label: 'chronic pain', group: 'pain', patterns: [/\bchronic pain\b/i] },
  { label: 'depression', group: 'mental_health', patterns: [/\bdepression\b/i] },
  { label: 'anxiety', group: 'mental_health', patterns: [/\banxiety\b/i] },
  { label: 'PTSD', group: 'mental_health', patterns: [/\bPTSD\b/i] },
  { label: 'reflux', group: 'gi', patterns: [/\bGERD\b/i, /\breflux\b/i] },
  { label: 'blood clots', group: 'vascular', patterns: [/\bDVT\b/i, /\bPE\b/i, /\bpulmonary embol/i, /\bjugular vein thrombosis\b/i] },
  { label: 'gout', group: 'other', patterns: [/\bgout\b/i] },
  { label: 'arthritis', group: 'other', patterns: [/\barthritis\b/i] },
  { label: 'a neck spine problem', group: 'neuro', patterns: [/\bcervical cord compression\b/i, /\bC5\b/i, /\bC6-7\b/i, /\bACDF\b/i] },
  { label: 'HIV', group: 'immune', patterns: [/\bHIV\b/i] },
  { label: 'obesity', group: 'other', patterns: [/\bobesity\b/i] },
  { label: 'an adrenal problem', group: 'endocrine', patterns: [/\badrenal insufficiency\b/i] }
];

const MEDICATION_DEFINITIONS = [
  { label: 'warfarin', patterns: [/\bwarfarin\b/i] },
  { label: 'Pradaxa', patterns: [/\bPradaxa\b/i] },
  { label: 'Harvoni', patterns: [/\bHarvoni\b/i] },
  { label: 'insulin', patterns: [/\binsulin\b/i, /\bIDDM\b/i] },
  { label: 'methadone', patterns: [/\bmethadone\b/i] },
  { label: 'OxyContin', patterns: [/\boxycontin\b/i] },
  { label: 'seizure medicine', patterns: [/\bantiepileptic\b/i, /\bAEDs?\b/i] },
  { label: 'aspirin', patterns: [/\baspirin\b/i] },
  { label: 'Plavix', patterns: [/\bplavix\b/i] },
  { label: 'Eliquis', patterns: [/\beliquis\b/i] },
  { label: 'Xarelto', patterns: [/\bxarelto\b/i] },
  { label: 'a blood thinner', patterns: [/\banticoagulation\b/i, /\banticoagulant\b/i, /\bblood thinner\b/i] }
];

const CLINICAL_SYNONYMS = {
  sdh: 'head injury',
  ams: 'confusion',
  dyspnea: 'shortness of breath',
  sob: 'shortness of breath',
  'pedal edema': 'leg swelling',
  lac: 'cut',
  'n/v': 'nausea and vomiting'
};

function cleanSpaces(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function sentenceSplit(text) {
  return cleanSpaces(text)
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizedText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scrubChartPrefix(text) {
  return cleanSpaces(text)
    .replace(/\b\d+\s*[- ]?year[- ]old\b/gi, '')
    .replace(/\b(white|black|african american|asian|hispanic)\b/gi, '')
    .replace(/\b(male|female|man|woman)\b/gi, '')
    .replace(/\b(the )?patient\b/gi, '')
    .replace(/\bpresents? to the (ED|emergency department)\b/gi, '')
    .replace(/\bpresented to the (ED|emergency department)\b/gi, '')
    .replace(/\barrived by (ambulance|walk[- ]?in|walking in)\b/gi, '')
    .replace(/\bwalked into the ED\b/gi, '')
    .replace(/\bwas transported by ambulance\b/gi, '')
    .replace(/\bvital signs?[^.]*\./gi, '')
    .replace(/\bBP\s+\d+\/\d+[^.]*\./gi, '')
    .replace(/\s+,/g, ',')
    .replace(/^[,.;:\s]+|[,.;:\s]+$/g, '');
}

function capitalizeSentence(text) {
  const value = cleanSpaces(text);
  if (!value) return '';
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function joinItems(items = []) {
  const list = items.filter(Boolean);
  if (!list.length) return '';
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(', ')}, and ${list[list.length - 1]}`;
}

function uniqueItems(items = []) {
  const seen = new Set();
  return items
    .map(cleanSpaces)
    .filter(Boolean)
    .filter((item) => {
      const key = normalizedText(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function hasAnyPattern(text, patterns = []) {
  return patterns.some((pattern) => pattern.test(text));
}

function reviewedDialogueFacts(caseData) {
  const augmentation = caseData?.augmentation || {};
  if (augmentation.review_status !== 'reviewed') return [];
  return (augmentation.inferred_facts || [])
    .filter((fact) => fact.review_status === 'reviewed')
    .filter((fact) => (fact.use_in || []).includes('dialogue'))
    .map((fact) => fact.statement)
    .filter(Boolean);
}

function sourceText(caseData) {
  return cleanSpaces(`${caseData?.complaint || ''}. ${caseData?.history || ''}. ${reviewedDialogueFacts(caseData).join(' ')}`);
}

function sourceWithoutDemographics(caseData) {
  return scrubChartPrefix(sourceText(caseData));
}

function hasSubduralLanguage(text) {
  return /\b(sdh|subdural)\b/i.test(text);
}

function hasAlteredLanguage(text) {
  return /\b(altered level of consciousness|altered mental status|ams|not oriented|bizarre conversation|encephalopathy)\b/i.test(text);
}

function collateralSource(text) {
  const lower = text.toLowerCase();
  if (/\bwife\b/.test(lower)) return 'wife';
  if (/\bhusband\b/.test(lower)) return 'husband';
  if (/\bmother\b/.test(lower)) return 'mother';
  if (/\bfather\b/.test(lower)) return 'father';
  if (/\bfamily\b/.test(lower)) return 'family';
  if (/\bems\b|\bambulance\b/.test(lower)) return 'EMS';
  return '';
}

function isNegated(text, definition) {
  const terms = definition.patterns
    .map((pattern) => String(pattern).replace(/^\/\\b?|\(.*$/g, ''))
    .filter(Boolean);
  const labels = [definition.label, ...terms].map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return labels.some((label) => {
    const re = new RegExp(`\\b(?:denies?|no|without|negative for|no symptoms? of)\\b[^.;]{0,120}\\b${label}\\b`, 'i');
    return re.test(text);
  });
}

function symptomFindings(caseData) {
  const text = sourceText(caseData);
  const present = [];
  const absent = [];
  SYMPTOM_DEFINITIONS.forEach((definition) => {
    const appears = hasAnyPattern(text, definition.patterns);
    const negated = isNegated(text, definition);
    if (appears && !negated) present.push(definition);
    if (negated) absent.push(definition);
  });
  return {
    present: uniqueItems(present.map((item) => item.label)),
    present_ids: uniqueItems(present.map((item) => item.id)),
    absent: uniqueItems(absent.map((item) => item.label)),
    absent_ids: uniqueItems(absent.map((item) => item.id))
  };
}

function matchedDefinitions(text, definitions) {
  return definitions.filter((definition) => hasAnyPattern(text, definition.patterns));
}

function extractConditions(caseData) {
  const text = sourceText(caseData);
  return uniqueItems(matchedDefinitions(text, CONDITION_DEFINITIONS).map((item) => item.label));
}

function extractCardiacConditions(caseData) {
  const text = sourceText(caseData);
  return uniqueItems(
    matchedDefinitions(text, CONDITION_DEFINITIONS)
      .filter((item) => item.group === 'cardiac' || item.label === 'high blood pressure' || item.label === 'high cholesterol' || item.label === 'blood clots')
      .map((item) => item.label)
  );
}

function extractSocialHistory(caseData) {
  const text = sourceText(caseData);
  const items = [];
  if (/\btobacco\b|\bsmok/i.test(text)) items.push('I smoke');
  if (/\balcohol\b|\bEtOH\b/i.test(text)) items.push('I drink alcohol');
  if (/\bmethadone\b/i.test(text)) items.push("I'm on methadone");
  if (/\bcocaine\b/i.test(text)) items.push('I used cocaine recently');
  return uniqueItems(items);
}

function extractMedications(caseData) {
  const text = sourceText(caseData);
  const meds = uniqueItems(matchedDefinitions(text, MEDICATION_DEFINITIONS).map((item) => item.label));
  const negative = [];
  if (/\bnot currently on any antiepileptic|\bnot currently on any AED/i.test(text)) {
    negative.push("I'm not taking seizure medicine right now");
  }
  if (/\bnot on anticoagulation|\bcurrently not on anticoagulation/i.test(text)) {
    negative.push("I'm not taking a blood thinner");
  }
  return {
    medications: meds.filter((item) => {
      if (negative.some((line) => line.toLowerCase().includes('blood thinner')) && item === 'a blood thinner') return false;
      if (negative.some((line) => line.toLowerCase().includes('seizure medicine')) && item === 'seizure medicine') return false;
      return true;
    }),
    negative_medications: uniqueItems(negative)
  };
}

function naturalizeAllergy(raw) {
  return cleanSpaces(raw)
    .replace(/\b(allergies include|allergies to|allergy to|allergic to|known allergy to|has a known allergy to)\b/gi, '')
    .replace(/\b(was transferred|transferred|presented|presents|arrived|came in|with chief complaint).*$/i, '')
    .replace(/\bbase\b/gi, '')
    .replace(/\band\s+NSAIDs\b/gi, 'and NSAIDs')
    .replace(/\.$/, '')
    .trim();
}

function extractAllergies(caseData) {
  const text = sourceText(caseData);
  if (/\bno known (drug )?allerg/i.test(text)) return { none_known: true, allergies: [] };
  const match = text.match(/\b(?:allergies include|allergies to|allergy to|allergic to|known allergy to|has a known allergy to)\s+([^.;]+)/i);
  if (!match?.[1]) return { none_known: false, allergies: [] };
  const allergies = uniqueItems(
    naturalizeAllergy(match[1])
      .split(/,|\band\b/i)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 6)
  );
  return { none_known: false, allergies };
}

function extractPriorEpisodes(caseData) {
  const text = sourceText(caseData);
  if (/\bapproximately\s+three seizures per month/i.test(text)) return "I've been having about three seizures a month.";
  if (/\bfour episodes\b.*\blast year/i.test(text)) return "I've had a few episodes like this over the past year.";
  if (/\bsimilar to previous\b|\bprevious abscess\b|\brecurrent\b|\bprior episodes?\b/i.test(text)) {
    return "I've had something like this before.";
  }
  return '';
}

function extractDurationPhrase(caseData) {
  const text = sourceWithoutDemographics(caseData);
  const lower = text.toLowerCase();

  const overPast = lower.match(/\bover the past\s+((?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:minutes?|hours?|days?|weeks?|months?|years?))/i);
  if (overPast?.[1]) return `over the past ${overPast[1]}`;

  const historyDuration = lower.match(/\b((?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*[- ]?\s*(?:minute|hour|day|week|month|year)s?)\s+history\b/i);
  if (historyDuration?.[1]) return `for about ${historyDuration[1].replace(/\s*-\s*/g, ' ')}`;

  const ago = lower.match(/\b((?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*[- ]?\s*(?:minute|hour|day|week|month|year)s?)\s+(?:ago|prior|before|earlier)\b/i);
  if (ago?.[1]) return `about ${ago[1].replace(/\s*-\s*/g, ' ')} ago`;

  const lasted = lower.match(/\blasting about\s+((?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:minutes?|hours?|days?))/i);
  if (lasted?.[1]) return `it lasted about ${lasted[1]}`;

  if (/\bday before\b|\byesterday\b/i.test(lower)) return 'yesterday';
  if (/\btoday\b|\bon the day of admission\b/i.test(lower)) return 'today';
  return '';
}

function buildTimeline(caseData, symptoms) {
  const text = sourceText(caseData);
  const lower = text.toLowerCase();
  const duration = extractDurationPhrase(caseData);

  if (hasAlteredLanguage(text)) {
    return "I'm not sure exactly when it started. My wife found me confused today.";
  }

  if (hasSubduralLanguage(text)) {
    if (duration) return `I'm not sure of the exact time, but the headache and unsteadiness started ${duration}.`;
    if (/\b(chronic|weeks?|months?|gradual|progressive|worsening)\b/i.test(text)) {
      return "I'm not sure of the exact day, but the headache and unsteadiness have been getting worse over time.";
    }
    return "I'm not sure of the exact time, but the headache and unsteadiness were already going on before I came in.";
  }

  if (symptoms.present_ids.includes('chest_pain') && /\b(rest|radiat|diaphoresis|palpitations|orthopnea)\b/i.test(text)) {
    const parts = ['The chest pain is happening at rest'];
    if (/\bover the past two months\b/i.test(text)) {
      parts.push('my breathing when I lie flat has been worse over the past two months');
    } else if (duration) {
      parts.push(`it has been going on ${duration}`);
    }
    return `${capitalizeSentence(joinItems(parts))}.`;
  }

  if (/\bsudden[- ]onset\b/i.test(text)) return 'It came on suddenly.';
  if (/\bdeveloped gradually\b|\bgradual\b/i.test(text)) return 'It came on gradually.';
  if (/\bafter experiencing a seizure\b/i.test(text)) return 'It happened after I had a seizure and fell.';
  if (/\bafter waking from a nap\b/i.test(text)) return 'It started after I woke up from a nap.';
  if (/\bclinic parking lot\b/i.test(text)) return duration ? `The latest episode started in the clinic parking lot, and ${duration}.` : 'The latest episode started in the clinic parking lot.';
  if (duration) return `It started ${duration}.`;
  if (/\bworsening\b/i.test(lower)) return 'It has been getting worse before I came in.';
  if (/\bintermittent\b/i.test(lower)) return 'It has been coming and going.';
  return "I'm not exactly sure when it started, but it was already going on before I came in.";
}

function buildPresentingConcern(caseData, symptoms) {
  const text = sourceText(caseData);
  const lower = text.toLowerCase();
  const source = collateralSource(text);

  if (hasAlteredLanguage(text)) {
    const who = source && source !== 'EMS' ? `My ${source}` : 'Someone';
    const concerns = [];
    if (symptoms.present_ids.includes('confusion')) concerns.push('I was confused and not making sense');
    if (symptoms.present_ids.includes('fall')) concerns.push('I had fallen');
    if (symptoms.present_ids.includes('slurred_speech')) concerns.push('my speech was slurred');
    if (/\bextra dose|pinpoint pupils|pill bottle|oxycontin|overdose|opioid|narcotic/i.test(text)) {
      concerns.push('there was concern I may have taken too much pain medicine');
    }
    return `I'm not really sure. ${who} said ${joinItems(concerns.length ? concerns : ['I was not acting like myself'])}.`;
  }

  if (hasSubduralLanguage(text)) {
    return 'I have a headache, and I have been unsteady and falling more.';
  }

  if (symptoms.present_ids.includes('rectal_pain') || /\brectal abscess|perianal abscess/i.test(text)) {
    return 'I have a very painful swollen area near my rectum.';
  }
  if (symptoms.present_ids.includes('swallowing_trouble')) {
    const parts = ['I am having trouble swallowing'];
    if (symptoms.present_ids.includes('hoarseness')) parts.push('my voice is hoarse');
    return `${capitalizeSentence(joinItems(parts))}.`;
  }
  if (symptoms.present_ids.includes('seizure') && symptoms.present_ids.includes('fall')) {
    return 'I had a seizure and fell.';
  }
  if (symptoms.present_ids.includes('chest_pain') && symptoms.present_ids.includes('shortness_of_breath')) {
    return 'I am having chest pain and shortness of breath.';
  }
  if (symptoms.present_ids.includes('shortness_of_breath') && symptoms.present_ids.includes('leg_swelling')) {
    return 'I am short of breath, and my legs are swollen.';
  }
  if (symptoms.present_ids.includes('chest_pain')) return 'I am having chest pain.';
  if (symptoms.present_ids.includes('shortness_of_breath')) return 'I am short of breath.';
  if (symptoms.present_ids.includes('weakness') && symptoms.present_ids.includes('numbness')) return 'I am having weakness and numbness.';
  if (symptoms.present_ids.includes('slurred_speech') || symptoms.present_ids.includes('facial_droop')) return 'My speech was slurred and my face felt weak.';
  if (symptoms.present_ids.includes('nausea_vomiting') && symptoms.present_ids.includes('weakness')) return 'I have been throwing up and feeling weak.';
  if (symptoms.present_ids.includes('abdominal_pain')) return lower.includes('pelvic') ? 'I have pelvic pain.' : 'My belly hurts.';
  if (symptoms.present_ids.includes('fever_chills')) return 'I have had a fever.';
  if (symptoms.present_ids.includes('headache')) return 'I have a headache.';
  if (symptoms.present.length) return `${capitalizeSentence(`I have ${symptoms.present.slice(0, 2).join(' and ')}`)}.`;

  return "I'm not feeling well.";
}

function buildAssociatedSymptoms(symptoms) {
  const excluded = new Set(['fall']);
  const present = symptoms.present.filter((item) => !excluded.has(item));
  if (!present.length) return '';
  return `I also have ${joinItems(present.slice(0, 4))}.`;
}

function buildRelevantNegatives(symptoms) {
  if (!symptoms.absent.length) return '';
  return `I do not have ${joinItems(symptoms.absent.slice(0, 4))}.`;
}

function buildSeverity(caseData, symptoms) {
  const pain = caseData?.vitals?.pain;
  if (pain !== null && pain !== undefined && !Number.isNaN(Number(pain))) {
    const value = Number(pain);
    if (value === 0) return "I'm not having pain right now.";
    if (value >= 7) return `The pain is severe, about ${Math.round(value)} out of 10.`;
    return `The pain is about ${Math.round(value)} out of 10.`;
  }
  if (symptoms.present_ids.includes('shortness_of_breath')) return "I'm uncomfortable because it is hard to breathe.";
  if (symptoms.present_ids.includes('weakness')) return 'I feel weak.';
  return 'It felt serious enough that I came in.';
}

function buildRedFlags(caseData, symptoms) {
  const text = sourceText(caseData);
  if (hasAlteredLanguage(text)) {
    return "My wife said I was confused and not making sense, and I had fallen.";
  }
  const highRiskIds = ['chest_pain', 'shortness_of_breath', 'fainting', 'weakness', 'numbness', 'confusion', 'bleeding', 'fever_chills', 'slurred_speech', 'facial_droop'];
  const present = symptoms.present.filter((label, index) => highRiskIds.includes(symptoms.present_ids[index]));
  if (present.length) return `Yes, I have had ${joinItems(present.slice(0, 4))}.`;
  return "No, nothing else scary that I can tell.";
}

function forbiddenTermsForCase(caseData) {
  const terms = [...FORBIDDEN_BASE_TERMS];
  const rawComplaint = String(caseData?.complaint || '').trim();
  if (/^[A-Z0-9\s,\/-]+$/.test(rawComplaint) && rawComplaint.length > 5) terms.push(rawComplaint.toLowerCase());
  if (/\brectal abscess|perianal abscess/i.test(sourceText(caseData))) terms.push('abscess episodes');
  return uniqueItems(terms);
}

function buildUnknownBoundaries(caseData) {
  const text = sourceText(caseData);
  const boundaries = [
    "I don't know the triage level or what tests you should order.",
    "I can tell you what I feel and what history I know."
  ];
  if (hasAlteredLanguage(text)) boundaries.unshift("I may not remember everything clearly right now.");
  return boundaries;
}

function buildGeneralStatus(view) {
  if (view.reliability === 'impaired') return view.presenting_concern;
  if (view.severity && /severe|hard to breathe|weak/i.test(view.severity)) {
    return `I'm not doing well. ${view.presenting_concern}`;
  }
  return `I'm worried. ${view.presenting_concern}`;
}

function buildPatientViewInternal(caseData) {
  const text = sourceText(caseData);
  const symptoms = symptomFindings(caseData);
  const meds = extractMedications(caseData);
  const allergy = extractAllergies(caseData);
  const conditions = extractConditions(caseData);
  const cardiac = extractCardiacConditions(caseData);
  const social = extractSocialHistory(caseData);
  const medicationList = meds.medications.filter((item) =>
    !allergy.allergies.some((allergyName) => normalizedText(allergyName) === normalizedText(item))
  );
  const source = collateralSource(text);
  const reliability = hasAlteredLanguage(text) ? 'impaired' : 'reliable';
  const presenting = buildPresentingConcern(caseData, symptoms);
  const timeline = buildTimeline(caseData, symptoms);
  const severity = buildSeverity(caseData, symptoms);

  return {
    version: PATIENT_DIALOGUE_ENGINE_VERSION,
    case_id: caseData?.id || '',
    reliability,
    collateral_source: source,
    presenting_concern: presenting,
    symptom_summary: presenting,
    timeline,
    severity,
    associated_symptoms: buildAssociatedSymptoms(symptoms),
    relevant_negatives: buildRelevantNegatives(symptoms),
    medical_history: conditions,
    cardiac_history: cardiac,
    social_history: social,
    medications: medicationList,
    negative_medications: meds.negative_medications,
    allergies: allergy.allergies,
    no_known_allergies: allergy.none_known,
    prior_episodes: extractPriorEpisodes(caseData),
    red_flags: buildRedFlags(caseData, symptoms),
    pregnancy_status: pregnancyStatus(caseData),
    unknown_phrase: reliability === 'impaired' ? "I'm not really sure." : "I'm not sure.",
    unknown_boundaries: buildUnknownBoundaries(caseData),
    present_symptoms: symptoms.present,
    present_symptom_ids: symptoms.present_ids,
    absent_symptoms: symptoms.absent,
    absent_symptom_ids: symptoms.absent_ids,
    forbidden_terms: forbiddenTermsForCase(caseData)
  };
}

export function buildPatientView(caseData) {
  return sanitizePatientView(buildPatientViewInternal(caseData));
}

function pregnancyStatus(caseData) {
  const age = Number(caseData?.demographics?.age || 0);
  const sex = String(caseData?.demographics?.sex || '').toUpperCase();
  if (!sex.startsWith('F') || age < 12 || age > 55) return 'No.';
  return "I'm not sure; you would need to check.";
}

function sanitizeSentence(text) {
  let result = cleanSpaces(text)
    .replace(/\bSDH\b/gi, 'head injury')
    .replace(/\bAMS\b/gi, 'confusion')
    .replace(/\bdyspnea\b/gi, 'shortness of breath')
    .replace(/\bpedal edema\b/gi, 'leg swelling')
    .replace(/\bIVDU\b/gi, 'injection drug use')
    .replace(/\bEtOH\b/gi, 'alcohol')
    .replace(/\bHCV\b/gi, 'hepatitis C')
    .replace(/\bIDDM\b/gi, 'diabetes')
    .replace(/\bDM2\b/gi, 'diabetes')
    .replace(/\bCVA\b/gi, 'stroke')
    .replace(/\bDVT\/PE\b/gi, 'blood clots')
    .replace(/\brectal abscess\b/gi, 'painful swollen area near my rectum')
    .replace(/\bperianal abscess\b/gi, 'painful swelling near my rectum')
    .replace(/\bsubstance use\s*\([^)]*\)/gi, 'smoking, alcohol use, and methadone treatment')
    .replace(/\banticoagulation\b/gi, 'blood thinner')
    .replace(/\bthe patient\b/gi, 'I')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();

  Object.entries(CLINICAL_SYNONYMS).forEach(([term, replacement]) => {
    result = result.replace(new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), replacement);
  });
  return result;
}

function sanitizePatientView(view) {
  const scrubString = (value) => sanitizeSentence(value);
  const scrubArray = (items) => uniqueItems((items || []).map(scrubString));
  return {
    ...view,
    presenting_concern: scrubString(view.presenting_concern),
    symptom_summary: scrubString(view.symptom_summary),
    timeline: scrubString(view.timeline),
    severity: scrubString(view.severity),
    associated_symptoms: scrubString(view.associated_symptoms),
    relevant_negatives: scrubString(view.relevant_negatives),
    red_flags: scrubString(view.red_flags),
    medical_history: scrubArray(view.medical_history),
    cardiac_history: scrubArray(view.cardiac_history),
    social_history: scrubArray(view.social_history),
    medications: scrubArray(view.medications),
    negative_medications: scrubArray(view.negative_medications),
    allergies: scrubArray(view.allergies),
    prior_episodes: scrubString(view.prior_episodes),
    present_symptoms: scrubArray(view.present_symptoms),
    absent_symptoms: scrubArray(view.absent_symptoms),
    forbidden_terms: uniqueItems([...(view.forbidden_terms || []), ...FORBIDDEN_BASE_TERMS])
  };
}

function questionText(question) {
  return ` ${normalizedText(question)} `;
}

function isGeneralStatusQuestion(question) {
  const q = normalizedText(question);
  if (['hi', 'hello', 'hey'].includes(q)) return true;
  const general = /\bhow are you\b/.test(q) || /\bhow are you doing\b/.test(q) || /\bhow do you feel\b/.test(q) || /\bhow are you feeling\b/.test(q) || /\bare you okay\b/.test(q);
  const specific = /\bpain\b|\bbreath\b|\bchest\b|\bweak\b|\bnumb\b|\bbleed\b|\bwhen\b|\bstart\b|\bmedical\b|\bmedicine\b|\ballerg\b|\bpregnan\b/.test(q);
  return general && !specific;
}

function isAnswerKeyQuestion(question) {
  const q = normalizedText(question);
  if (/\b(esi|triage level|acuity|disposition|final decision|expert opinion|expert answer|reference answer)\b/.test(q)) return true;
  if (/\b(what|which|why)\b.*\b(resource|resources|intervention|interventions|test|tests|procedure|procedures|treatment|treatments)\b/.test(q)) return true;
  if (/\b(will|would|should|going to)\b.*\b(admit|admitted|admission|icu|discharge|transfer|intubat|iv)\b/.test(q)) return true;
  return false;
}

function isDiagnosisClarification(question) {
  const q = normalizedText(question);
  return /\b(what is|what does|what do you mean|what does that mean|is that|is this|diagnosis|condition|term)\b/.test(q) &&
    /\b(sdh|ams|diagnosis|condition|medical condition|term|mean|altered|subdural)\b/.test(q);
}

function askedSymptomIds(question) {
  const q = questionText(question);
  return SYMPTOM_DEFINITIONS
    .filter((definition) => {
      const label = definition.label.toLowerCase();
      const idWords = definition.id.replace(/_/g, ' ');
      return q.includes(` ${label} `) || q.includes(` ${idWords} `) || definition.patterns.some((pattern) => pattern.test(question));
    })
    .map((item) => item.id);
}

function detectIntents(question) {
  const q = questionText(question);
  if (isAnswerKeyQuestion(question)) return ['answer_key'];
  if (isDiagnosisClarification(question)) return ['diagnosis_clarification'];
  if (isGeneralStatusQuestion(question)) return ['general_status'];

  const intents = [];
  if (/\b(why|what)\b.*\b(came|come|brought|going on|wrong|happened|hospital|today)\b/.test(q) || /\btell me what'?s going on\b/.test(q)) intents.push('chief_concern');
  if (/\b(when|start|started|began|begin|long|duration|sudden|gradual|worse|worsening|changed|course|how long)\b/.test(q)) intents.push('timeline');
  if (/\b(how bad|pain|scale|severity|severe|distress|right now|rate)\b/.test(q)) intents.push('severity');
  if (/\b(other symptoms|associated|also|anything else|red flags|scary symptoms)\b/.test(q)) intents.push('associated_symptoms');
  if (/\b(breath|chest pain|faint|passed out|weak|numb|bleed|vomit|fever|confus|headache|dizzy|slurred|face|droop)\b/.test(q)) intents.push('red_flags');
  if (/\b(heart attack|cardiovascular|cardiac|heart condition|heart conditions|heart disease|afib|atrial fibrillation)\b/.test(q)) intents.push('cardiac_history');
  if (/\b(medical|history|problems|conditions|disease|diabetes|cancer|stroke|copd|kidney|liver)\b/.test(q)) intents.push('medical_history');
  if (/\b(med|medicine|medication|medications|pills|blood thinner|blood thinners|anticoagul|daily|take)\b/.test(q)) intents.push('medications');
  if (/\b(allergy|allergies|allergic)\b/.test(q)) intents.push('allergies');
  if (/\b(before|again|previous|prior|ever had|like this|happen often|happened before)\b/.test(q)) intents.push('prior_episode');
  if (/\b(pregnant|pregnancy|period|lmp)\b/.test(q)) intents.push('pregnancy');

  if (!intents.length) intents.push('chief_concern');
  if (intents.includes('cardiac_history') && intents.includes('medical_history') && !/\b(medical problems|medical history|other conditions|other medical|diabetes|cancer|stroke|copd|kidney|liver)\b/.test(q)) {
    return intents.filter((intent) => intent !== 'medical_history');
  }
  if (intents.includes('chief_concern') && intents.length > 1) {
    return intents.filter((intent) => intent !== 'chief_concern');
  }
  return uniqueItems(INTENT_ORDER.filter((intent) => intents.includes(intent)));
}

function intentToCategory(intent) {
  if (intent === 'cardiac_history') return 'medical_history';
  if (intent === 'associated_symptoms') return 'red_flags';
  if (intent === 'diagnosis_clarification' || intent === 'answer_key' || intent === 'unknown') return 'chief_concern';
  return CATEGORY_ORDER.includes(intent) ? intent : 'chief_concern';
}

function hashText(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function planSignature(intents, details) {
  const core = [
    intents.join('+'),
    (details.asked_symptoms || []).join(','),
    details.term || '',
    details.repeat_count ? 'repeat' : ''
  ].join('|');
  return `${intents.join('+') || 'unknown'}::${hashText(core)}`;
}

export function planPatientAnswer(question, patientView, recentTurns = []) {
  const intents = detectIntents(question);
  const symptoms = askedSymptomIds(question);
  const term = normalizedText(question).match(/\b(sdh|ams|subdural|altered|diagnosis|condition)\b/)?.[1] || '';
  const categories = uniqueItems(intents.map(intentToCategory));
  const primaryCategory = categories[0] || 'chief_concern';
  const priorMatches = (recentTurns || []).filter((turn) => {
    const prior = turn.intent || turn.intent_key || turn.category || '';
    return prior && intents.some((intent) => {
      if (prior.includes(intent)) return true;
      if (intent === 'diagnosis_clarification' || intent === 'answer_key') return false;
      return prior === intentToCategory(intent);
    });
  });
  const details = {
    asked_symptoms: symptoms,
    term,
    repeat_count: priorMatches.length
  };
  const signature = planSignature(intents, details);
  return {
    version: PATIENT_DIALOGUE_ENGINE_VERSION,
    question: String(question || '').trim(),
    intents,
    primary_intent: intents[0] || 'chief_concern',
    primary_category: primaryCategory,
    covered_categories: categories,
    asked_symptoms: symptoms,
    term,
    is_repeat: priorMatches.length > 0,
    signature,
    patient_view_version: patientView?.version || PATIENT_DIALOGUE_ENGINE_VERSION
  };
}

function responseForSpecificSymptoms(view, ids = []) {
  const requested = uniqueItems(ids);
  if (!requested.length) return view.red_flags || view.associated_symptoms || "No, nothing else that I can tell.";
  const present = requested
    .filter((id) => view.present_symptom_ids.includes(id))
    .map((id) => SYMPTOM_DEFINITIONS.find((item) => item.id === id)?.label)
    .filter(Boolean);
  const absent = requested
    .filter((id) => view.absent_symptom_ids.includes(id) || !view.present_symptom_ids.includes(id))
    .map((id) => SYMPTOM_DEFINITIONS.find((item) => item.id === id)?.label)
    .filter(Boolean);

  const parts = [];
  if (present.length) parts.push(`Yes, I have ${joinItems(present.slice(0, 3))}.`);
  if (absent.length) parts.push(`No ${joinItems(absent.slice(0, 3))} that I can tell.`);
  return parts.join(' ') || "No, not that I can tell.";
}

function medicalHistoryResponse(view, intent, plan = {}) {
  if (intent === 'cardiac_history') {
    if (view.cardiac_history.length) {
      const prefix = `I have ${joinItems(view.cardiac_history.slice(0, 4))}.`;
      if (/\bheart attacks?\b/i.test(plan.question || '') && !view.cardiac_history.some((item) => /heart attack|stent|coronary/i.test(item))) {
        return `${prefix} I don't know of a prior heart attack.`;
      }
      return prefix;
    }
    return "I don't know of a prior heart attack or heart condition.";
  }
  const parts = [];
  if (view.medical_history.length) parts.push(`I have ${joinItems(view.medical_history.slice(0, 5))}.`);
  if (view.social_history.length) parts.push(view.social_history.slice(0, 2).join('. ') + '.');
  return parts.join(' ') || "I don't think I have major medical problems that I know of.";
}

function medicationResponse(view) {
  const parts = [];
  if (view.medications.length) parts.push(`I take ${joinItems(view.medications.slice(0, 4))}.`);
  if (view.negative_medications.length) parts.push(view.negative_medications.slice(0, 2).join('. ') + '.');
  return parts.join(' ') || "I don't remember my regular medicines right now.";
}

function allergiesResponse(view) {
  if (view.no_known_allergies) return "I don't have any known medication allergies.";
  if (view.allergies.length) return `I'm allergic to ${joinItems(view.allergies.slice(0, 5))}.`;
  return "I don't know of any medication allergies.";
}

function repeatedResponse(answer, intent) {
  if (intent === 'timeline') return "I don't have a more exact time than that.";
  if (intent === 'chief_concern') return "That's the main reason I came in.";
  if (intent === 'diagnosis_clarification') return "I'm still not sure what that term means.";
  return answer;
}

function renderIntent(intent, plan, view) {
  if (plan.is_repeat && ['timeline', 'chief_concern', 'diagnosis_clarification'].includes(intent)) {
    return repeatedResponse('', intent);
  }
  switch (intent) {
    case 'answer_key':
      return "I don't know that as the patient. I can tell you what I feel and what history I know.";
    case 'diagnosis_clarification':
      return `I'm not sure what that means. I can tell you what brought me in: ${view.presenting_concern
        .replace(/\.$/, '')
        .replace(/^I'm worried\.\s*/i, '')
        .replace(/^I'm not really sure\.\s*/i, '')
        .replace(/^I'm not sure\.\s*/i, '')}.`;
    case 'general_status':
      return buildGeneralStatus(view);
    case 'chief_concern':
      return view.presenting_concern;
    case 'timeline':
      return view.timeline;
    case 'severity':
      return view.severity;
    case 'associated_symptoms':
      return view.associated_symptoms || view.relevant_negatives || "Nothing else that I can tell.";
    case 'red_flags':
      return responseForSpecificSymptoms(view, plan.asked_symptoms);
    case 'cardiac_history':
    case 'medical_history':
      return medicalHistoryResponse(view, intent, plan);
    case 'medications':
      return medicationResponse(view);
    case 'allergies':
      return allergiesResponse(view);
    case 'prior_episode':
      return view.prior_episodes || 'No, this does not happen to me regularly.';
    case 'pregnancy':
      return view.pregnancy_status;
    default:
      return view.unknown_phrase;
  }
}

export function renderPatientAnswer(answerPlan, patientView) {
  const segments = [];
  answerPlan.intents.slice(0, 4).forEach((intent) => {
    const segment = renderIntent(intent, answerPlan, patientView);
    if (segment) segments.push(segment);
  });
  return finalizePatientSpeech(uniqueItems(segments).join(' '));
}

function finalizePatientSpeech(text) {
  const cleaned = sanitizeSentence(text)
    .replace(/\bI am having\b/g, "I'm having")
    .replace(/\bI am short\b/g, "I'm short")
    .replace(/\bI do not\b/g, "I don't")
    .replace(/\bI cannot\b/g, "I can't")
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned
    .split(/(?<=[.!?])\s+/)
    .slice(0, 4)
    .join(' ');
}

function containsForbidden(answer, view) {
  const normalized = normalizedText(answer);
  if (!normalized) return true;
  return (view.forbidden_terms || []).some((term) => {
    const cleaned = normalizedText(term);
    if (!cleaned || cleaned.length < 2) return false;
    return new RegExp(`\\b${cleaned.replace(/\s+/g, '\\s+')}\\b`, 'i').test(normalized);
  });
}

function coversIntent(answer, plan, view) {
  const normalized = normalizedText(answer);
  if (!normalized) return false;
  if (plan.intents.includes('answer_key')) return /\b(don t know|history|feel|feeling)\b/.test(normalized);
  if (plan.intents.includes('diagnosis_clarification')) return /\b(not sure|don t know|brought|came|feel|feeling)\b/.test(normalized);
  if (plan.intents.includes('timeline')) return /\b(start|started|going on|ago|before|since|today|yesterday|week|month|sudden|gradual|worse|exact time|more exact|came on|happened)\b/.test(normalized);
  if (plan.intents.includes('severity')) return /\b(pain|bad|severe|mild|uncomfortable|weak|breathe|serious)\b/.test(normalized);
  if (plan.intents.includes('medical_history') || plan.intents.includes('cardiac_history')) return /\b(have|history|don t know|heart|blood pressure|diabetes|cancer|stroke|copd|kidney|condition)\b/.test(normalized);
  if (plan.intents.includes('medications')) return /\b(take|taking|medicine|medicines|pills|blood thinner|don t remember)\b/.test(normalized);
  if (plan.intents.includes('allergies')) return /\b(allergic|allergies|known medication allergies|don t know)\b/.test(normalized);
  if (plan.intents.includes('red_flags') && plan.asked_symptoms?.length) return /\b(yes|no|have|had|don t have|not that)\b/.test(normalized);
  if (plan.intents.includes('chief_concern')) return normalizedText(view.presenting_concern).split(' ').some((word) => word.length > 4 && normalized.includes(word));
  return true;
}

export function validatePatientSpeech(answer, answerPlan, patientView, recentTurns = []) {
  const cleaned = finalizePatientSpeech(answer);
  if (!cleaned) return null;
  if (containsForbidden(cleaned, patientView)) return null;
  if (/\b(i s|my s|he s wife|she s husband|patient s wife|patient s husband|presents to the ed)\b/i.test(normalizedText(cleaned))) return null;
  if (/\b\d+\s+year\s+old\s+(white|black|asian|hispanic|male|female|man|woman)\b/i.test(cleaned)) return null;
  if (!coversIntent(cleaned, answerPlan, patientView)) return null;

  const differentIntentRepeat = (recentTurns || []).some((turn) => {
    const prior = normalizedText(turn.patient || turn.answer || '');
    const priorIntent = turn.intent || turn.intent_key || turn.category || '';
    return prior && prior === normalizedText(cleaned) && !String(answerPlan.signature || '').includes(priorIntent);
  });
  if (differentIntentRepeat && cleaned.length > 48) return null;
  return cleaned;
}

export function patientViewForModel(patientView) {
  return {
    reliability: patientView.reliability,
    collateral_source: patientView.collateral_source,
    presenting_concern: patientView.presenting_concern,
    timeline: patientView.timeline,
    severity: patientView.severity,
    associated_symptoms: patientView.associated_symptoms,
    relevant_negatives: patientView.relevant_negatives,
    medical_history: patientView.medical_history,
    cardiac_history: patientView.cardiac_history,
    social_history: patientView.social_history,
    medications: patientView.medications,
    negative_medications: patientView.negative_medications,
    allergies: patientView.allergies,
    no_known_allergies: patientView.no_known_allergies,
    prior_episodes: patientView.prior_episodes,
    red_flags: patientView.red_flags,
    pregnancy_status: patientView.pregnancy_status,
    unknown_boundaries: patientView.unknown_boundaries,
    forbidden_terms: patientView.forbidden_terms
  };
}
