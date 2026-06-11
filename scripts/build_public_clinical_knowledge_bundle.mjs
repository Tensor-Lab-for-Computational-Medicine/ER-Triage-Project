import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUTPUT = resolve(ROOT, 'frontend/src/data/public_clinical_knowledge_bundle.json');
const QUALITY_REPORT_OUTPUT = resolve(ROOT, 'frontend/src/data/public_clinical_source_quality_report.json');

const EMBEDDING_MODEL = 'Xenova/bge-small-en-v1.5';
const EMBEDDING_DIMENSIONS = 384;
const QUOTE_EXCERPT_WORD_LIMIT = 25;
const GENERATED_EVIDENCE_STATUS = 'generated_needs_review';
const QUOTE_BACKED_EVIDENCE_STATUS = 'quote_backed';
const CHUNK_FACETS = [
  {
    id: 'recognition',
    code: 'R',
    taskTags: ['triage', 'diagnosis'],
    template: ({ name, signal, action, assessment, caveat, sourceTitle }) =>
      `${name}: Public-safe summary grounded in ${sourceTitle}. In the emergency department, ${signal} should be treated as a signal to consider ${action}. Focused assessment should review ${assessment}. Apply this rule only when case evidence supports the presentation; ${caveat}.`
  },
  {
    id: 'red_flags',
    code: 'F',
    taskTags: ['triage', 'reassessment'],
    template: ({ name, signal, action, assessment, caveat, sourceTitle }) =>
      `${name} red flags: ${sourceTitle} supports using structured danger features rather than gestalt alone. Escalate concern when ${signal} is present with abnormal physiology, severe symptoms, high-risk history, or clinical deterioration. Recheck ${assessment}. Do not infer the condition from a label alone; ${caveat}.`
  },
  {
    id: 'focused_assessment',
    code: 'A',
    taskTags: ['diagnosis', 'tutor'],
    template: ({ name, signal, action, assessment, caveat, sourceTitle }) =>
      `${name} focused assessment: Use the cited guidance from ${sourceTitle} to connect the complaint to exam and bedside data. Ask about timing, severity, modifiers, medications, comorbidities, and safety threats, then examine ${assessment}. The assessment should support ${action}; ${caveat}.`
  },
  {
    id: 'diagnostic_strategy',
    code: 'D',
    taskTags: ['diagnosis', 'management'],
    template: ({ name, signal, action, assessment, caveat, sourceTitle }) =>
      `${name} diagnostic strategy: The source-grounded approach is to choose tests that answer the immediate emergency question raised by ${signal}. Prefer time-sensitive diagnostics, bedside reassessment, and targeted imaging or laboratory evaluation when they change ${action}. Avoid broad testing without a clinical trigger; ${caveat}.`
  },
  {
    id: 'initial_management',
    code: 'M',
    taskTags: ['management', 'reassessment'],
    template: ({ name, signal, action, assessment, caveat, sourceTitle }) =>
      `${name} initial management: When the case evidence fits ${signal}, ED planning should prioritize ${action}. Management should name the immediate safety concern, first intervention, diagnostic dependency, and reassessment trigger. Continue to monitor ${assessment}; ${caveat}.`
  },
  {
    id: 'medication_procedure',
    code: 'P',
    taskTags: ['management'],
    template: ({ name, signal, action, assessment, caveat, sourceTitle }) =>
      `${name} medication or procedure considerations: ${sourceTitle} supports matching interventions to severity, contraindications, and local capability. Before treatment, verify allergies, pregnancy or pediatric status when relevant, renal function or anticoagulation when relevant, and baseline ${assessment}. Do not recommend a drug, dose, or procedure without patient-specific support; ${caveat}.`
  },
  {
    id: 'disposition_reassessment',
    code: 'S',
    taskTags: ['reassessment', 'sbar'],
    template: ({ name, signal, action, assessment, caveat, sourceTitle }) =>
      `${name} reassessment and disposition: Use ${sourceTitle} to decide whether observation, admission, transfer, specialty consultation, or discharge safety planning is needed after initial treatment. Reassess ${assessment}, response to therapy, and trajectory. Disposition should remain provisional until danger features are addressed; ${caveat}.`
  },
  {
    id: 'teaching_handoff',
    code: 'H',
    taskTags: ['sbar', 'debrief', 'tutor'],
    template: ({ name, signal, action, assessment, caveat, sourceTitle }) =>
      `${name} teaching and handoff: A learner-facing explanation should cite both the patient-specific evidence and this reference summary from ${sourceTitle}. The handoff should state the situation, relevant background, assessment of ${signal}, recommended ${action}, and pending reassessment of ${assessment}. Keep uncertainty explicit; ${caveat}.`
  }
];

function source(id, title, organization, version, publicationDate, url, sourceTier = 'society_guideline', extras = {}) {
  return {
    schema_version: 'clinical_source_v1',
    id,
    title,
    organization,
    publisher: extras.publisher || organization,
    edition: extras.edition || '',
    version,
    publication_date: publicationDate,
    url,
    doi: extras.doi || '',
    pmid: extras.pmid || '',
    isbn: extras.isbn || '',
    license_scope: 'public_summary',
    source_tier: sourceTier,
    review_status: 'reviewed',
    external_ai_use_allowed: true
  };
}

const HYPERGLYCEMIC_CRISES_CONSENSUS_PDF_URL = 'https://www.diabetes.org.uk/sites/default/files/2024-07/Hyperglycaemic%20Crisis%20Global%20Consensus.pdf?VersionId=VVl5XspaIjNnJk18RoCSDWr_imOiYl2o';

const sources = [
  source('ena_esi_handbook_5e', 'Emergency Severity Index Handbook', 'Emergency Nurses Association', 'ESI Version 5', '2023', 'https://www.ena.org/education/triage', 'ed_specific_guideline', { edition: '5th ed.' }),
  source('ena_triage_curriculum', 'ENA Triage Curriculum', 'Emergency Nurses Association', 'Triage Curriculum 2.0', '2025', 'https://www.ena.org/education/triage', 'ed_specific_guideline'),
  source('acep_ena_triage_policy_2025', 'Emergency Department Triage', 'American College of Emergency Physicians and Emergency Nurses Association', 'Joint policy statement', '2025', 'https://www.ena.org/sites/default/files/2025-08/Emergency%20Department%20Triage.pdf', 'ed_specific_guideline'),
  source('saem_grace_series', 'Guidelines for Reasonable and Appropriate Care in the Emergency Department', 'Society for Academic Emergency Medicine', 'GRACE guideline series', '2021', 'https://www.saem.org/publications/grace', 'ed_specific_guideline', { pmid: '34022076' }),
  source('saem_grace_recurrent_chest_pain', 'GRACE Recurrent Low-Risk Chest Pain', 'Society for Academic Emergency Medicine', 'GRACE-1', '2021', 'https://www.saem.org/publications/grace', 'ed_specific_guideline'),
  source('saem_grace_abdominal_pain', 'GRACE Abdominal Pain in the Emergency Department', 'Society for Academic Emergency Medicine', 'GRACE guideline', '2022', 'https://www.saem.org/publications/grace', 'ed_specific_guideline'),
  source('saem_grace_syncope', 'GRACE Syncope and Low-Risk Presentations', 'Society for Academic Emergency Medicine', 'GRACE guideline', '2023', 'https://www.saem.org/publications/grace', 'ed_specific_guideline'),
  source('aha_cpr_ecc_2025', 'AHA Guidelines for CPR and Emergency Cardiovascular Care', 'American Heart Association', '2025 guidelines', '2025', 'https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines'),
  source('aha_2025_algorithms', '2025 CPR and ECC Algorithms', 'American Heart Association', '2025 algorithms', '2025', 'https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines/algorithms'),
  source('aha_adult_bls_2025', 'Adult Basic Life Support', 'American Heart Association', '2025 CPR and ECC guideline part', '2025', 'https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines'),
  source('aha_adult_acls_2025', 'Adult Advanced Life Support', 'American Heart Association', '2025 CPR and ECC guideline part', '2025', 'https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines'),
  source('aha_post_arrest_2025', 'Post-Cardiac Arrest Care', 'American Heart Association', '2025 CPR and ECC guideline part', '2025', 'https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines'),
  source('aha_special_circumstances_2025', 'Adult and Pediatric Special Circumstances of Resuscitation', 'American Heart Association', '2025 CPR and ECC guideline part', '2025', 'https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines/algorithms'),
  source('aha_pals_2025', 'Pediatric Advanced Life Support', 'American Heart Association and American Academy of Pediatrics', '2025 CPR and ECC guideline part 8', '2025', 'https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines/pediatric-advanced-life-support'),
  source('aha_neonatal_resuscitation_2025', 'Neonatal Resuscitation Algorithm', 'American Heart Association', '2025 algorithm', '2025', 'https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines/algorithms'),
  source('aha_acc_chest_pain_2021', 'Guideline for the Evaluation and Diagnosis of Chest Pain', 'AHA/ACC Joint Committee on Clinical Practice Guidelines', '2021 guideline', '2021', 'https://professional.heart.org/en/guidelines-statements/2021-ahaaccasechestsaemscctscmr-guideline-for-the-evaluation-and-diagnosis-ofcir0000000000001029', 'society_guideline', { doi: '10.1016/j.jacc.2021.07.053', publisher: 'Journal of the American College of Cardiology' }),
  source('aha_acc_chest_pain_slide_set_2021', '2021 AHA/ACC Chest Pain Guideline Slide Set', 'American Heart Association and American College of Cardiology', 'Guideline slide set', '2021', 'https://professional.heart.org/en/-/media/PHD-Files-2/Science-News/2/2021/2021-Chest-Pain-Guideline-Slide-Set-PDF-102821.pdf?sc_lang=en', 'society_guideline', { doi: '10.1161/CIR.0000000000001029' }),
  source('acep_clinical_policies', 'ACEP Clinical Policies', 'American College of Emergency Physicians', 'Current policy index', '2026', 'https://www.acep.org/patient-care/clinical-policies', 'ed_specific_guideline'),
  source('acep_nste_acs', 'Non-ST-Elevation Acute Coronary Syndromes', 'American College of Emergency Physicians', 'Clinical policy', '2026', 'https://www.acep.org/patient-care/clinical-policies', 'ed_specific_guideline'),
  source('acep_stemi_reperfusion', 'Reperfusion Therapy for STEMI', 'American College of Emergency Physicians', 'Clinical policy', '2026', 'https://www.acep.org/patient-care/clinical-policies', 'ed_specific_guideline'),
  source('acep_acute_heart_failure', 'Acute Heart Failure Syndromes', 'American College of Emergency Physicians', 'Clinical policy', '2026', 'https://www.acep.org/patient-care/clinical-policies', 'ed_specific_guideline'),
  source('acep_venous_thromboembolic', 'Acute Venous Thromboembolic Disease', 'American College of Emergency Physicians', 'Clinical policy', '2026', 'https://www.acep.org/patient-care/clinical-policies', 'ed_specific_guideline'),
  source('acep_asymptomatic_bp', 'Asymptomatic Elevated Blood Pressure', 'American College of Emergency Physicians', 'Clinical policy', '2025', 'https://www.acep.org/patient-care/clinical-policies/asymptomatic-elevated-blood-pressure/', 'ed_specific_guideline'),
  source('acep_thoracic_aortic_dissection', 'Thoracic Aortic Dissection', 'American College of Emergency Physicians', 'Clinical policy', '2026', 'https://www.acep.org/patient-care/clinical-policies', 'ed_specific_guideline'),
  source('acep_acute_ischemic_stroke', 'Acute Ischemic Stroke', 'American College of Emergency Physicians', 'Clinical policy', '2026', 'https://www.acep.org/patient-care/clinical-policies', 'ed_specific_guideline'),
  source('acep_appendicitis', 'Appendicitis', 'American College of Emergency Physicians', 'Clinical policy', '2026', 'https://www.acep.org/patient-care/clinical-policies', 'ed_specific_guideline'),
  source('american_stroke_acute_toolkit', 'Acute Ischemic Stroke Toolkit', 'American Stroke Association', '2019 update toolkit', '2019', 'https://www.stroke.org/aistoolkit'),
  source('asa_stroke_symptoms_2026', 'Stroke Symptoms and Warning Signs', 'American Stroke Association', 'Current public education page', '2026', 'https://www.stroke.org/en/about-stroke/stroke-symptoms'),
  source('asa_stroke_diagnosis_2023', 'Common Diagnosis Methods', 'American Stroke Association', 'Last reviewed Jun 26 2023', '2023', 'https://www.stroke.org/en/about-stroke/types-of-stroke/common-diagnosis-methods'),
  source('asa_quick_stroke_treatment_2026', 'Quick Stroke Treatment Can Save Lives', 'American Stroke Association', 'Last reviewed Jan 26 2026', '2026', 'https://www.stroke.org/en/about-stroke/types-of-stroke/is-getting-quick-stroke-treatment-important'),
  source('acep_tia', 'Suspected Transient Ischemic Attack', 'American College of Emergency Physicians', 'Clinical policy', '2026', 'https://www.acep.org/patient-care/clinical-policies', 'ed_specific_guideline'),
  source('acep_headache', 'Acute Headache in the Emergency Department', 'American College of Emergency Physicians', 'Clinical policy', '2019', 'https://www.acep.org/siteassets/sites/acep/media/clinical-policies/cp-headache.pdf', 'ed_specific_guideline'),
  source('acep_seizure', 'Seizure', 'American College of Emergency Physicians', 'Clinical policy', '2026', 'https://www.acep.org/patient-care/clinical-policies', 'ed_specific_guideline'),
  source('ncs_status_epilepticus', 'Guidelines for the Evaluation and Management of Status Epilepticus', 'Neurocritical Care Society', 'Practice guideline', '2012', 'https://www.neurocriticalcare.org/Resources-Publications/Neurocritical-Care-Guidelines', 'society_guideline', { pmid: '22528274' }),
  source('brain_trauma_foundation_guidelines', 'Brain Trauma Foundation Guidelines', 'Brain Trauma Foundation', 'Guideline index', '2026', 'https://braintrauma.org/guidelines'),
  source('brain_trauma_severe_tbi', 'Severe Traumatic Brain Injury Guidelines', 'Brain Trauma Foundation', 'Guideline series', '2026', 'https://braintrauma.org/guidelines'),
  source('brain_trauma_pediatric_tbi', 'Pediatric Traumatic Brain Injury Guidelines', 'Brain Trauma Foundation', 'Guideline series', '2026', 'https://braintrauma.org/guidelines'),
  source('acep_mtbi_2023', 'Mild Traumatic Brain Injury', 'American College of Emergency Physicians', '2023 clinical policy', '2023', 'https://www.acep.org/siteassets/new-pdfs/clinical-policies/mtbi2023.pdf', 'ed_specific_guideline'),
  source('cdc_mtbi_symptoms_2025', 'Symptoms of Mild TBI and Concussion', 'Centers for Disease Control and Prevention', 'Traumatic Brain Injury & Concussion guidance', '2025', 'https://www.cdc.gov/traumatic-brain-injury/signs-symptoms/index.html', 'society_guideline'),
  source('cdc_mtbi_return_activities_2025', 'Managing Return to Activities', 'Centers for Disease Control and Prevention', 'HEADS UP clinical guidance', '2025', 'https://www.cdc.gov/heads-up/hcp/clinical-guidance/index.html', 'society_guideline'),
  source('acs_tqp_best_practices', 'ACS TQP Best Practices Guidelines', 'American College of Surgeons', 'Trauma Quality Programs guideline series', '2026', 'https://www.facs.org/quality-programs/trauma/quality/best-practices-guidelines/'),
  source('acs_field_triage', 'ACS Field Triage Guidelines', 'American College of Surgeons Committee on Trauma', 'Field triage guidance', '2022', 'https://www.facs.org/quality-programs/trauma/systems/field-triage-guidelines/'),
  source('acs_tqp_geriatric_trauma', 'ACS TQP Geriatric Trauma Management', 'American College of Surgeons', 'Best practices guideline', '2026', 'https://www.facs.org/quality-programs/trauma/quality/best-practices-guidelines/'),
  source('acs_tqp_spine_injury', 'ACS TQP Spine Injury Best Practices', 'American College of Surgeons', 'Best practices guideline', '2026', 'https://www.facs.org/quality-programs/trauma/quality/best-practices-guidelines/'),
  source('acs_tqp_orthopaedic_trauma', 'ACS TQP Orthopaedic Trauma Best Practices', 'American College of Surgeons', 'Best practices guideline', '2026', 'https://www.facs.org/quality-programs/trauma/quality/best-practices-guidelines/'),
  source('acs_tqp_palliative_trauma', 'ACS TQP Palliative Care Best Practices', 'American College of Surgeons', 'Best practices guideline', '2026', 'https://www.facs.org/quality-programs/trauma/quality/best-practices-guidelines/'),
  source('east_pmg', 'EAST Practice Management Guidelines', 'Eastern Association for the Surgery of Trauma', 'Practice management guideline index', '2026', 'https://www.east.org/education-resources/practice-management-guidelines'),
  source('east_tube_thoracostomy_antibiotics', 'Antibiotic Prophylaxis for Tube Thoracostomy Placement in Trauma', 'Eastern Association for the Surgery of Trauma', 'Practice management guideline', '2022', 'https://www.east.org/education-resources/practice-management-guidelines'),
  source('east_cervical_spine', 'Cervical Spine Injury Practice Management Guideline', 'Eastern Association for the Surgery of Trauma', 'Practice management guideline', '2026', 'https://www.east.org/education-resources/practice-management-guidelines'),
  source('east_blunt_abdominal_trauma', 'Blunt Abdominal Trauma Practice Management Guideline', 'Eastern Association for the Surgery of Trauma', 'Practice management guideline', '2026', 'https://www.east.org/education-resources/practice-management-guidelines'),
  source('east_geriatric_trauma', 'Geriatric Trauma Practice Management Guideline', 'Eastern Association for the Surgery of Trauma', 'Practice management guideline', '2026', 'https://www.east.org/education-resources/practice-management-guidelines'),
  source('western_trauma_algorithms', 'Western Trauma Association Algorithms', 'Western Trauma Association', 'Algorithm index', '2026', 'https://www.westerntrauma.org/western-trauma-association-algorithms/'),
  source('western_pelvic_fracture', 'Management of Pelvic Fracture with Hemodynamic Instability', 'Western Trauma Association', 'Critical decisions algorithm', '2016 update', 'https://www.westerntrauma.org/western-trauma-association-algorithms/'),
  source('western_blunt_splenic_trauma', 'Adult Blunt Splenic Trauma Algorithm', 'Western Trauma Association', 'Critical decisions algorithm', '2016 update', 'https://www.westerntrauma.org/western-trauma-association-algorithms/'),
  source('western_peripheral_vascular_injury', 'Peripheral Vascular Injury Algorithm', 'Western Trauma Association', 'Critical decisions algorithm', '2026', 'https://www.westerntrauma.org/western-trauma-association-algorithms/'),
  source('western_rib_fractures', 'Rib Fractures Algorithm', 'Western Trauma Association', 'Critical decisions algorithm', '2026', 'https://www.westerntrauma.org/western-trauma-association-algorithms/'),
  source('sccm_ssc_adult_2026', 'Surviving Sepsis Campaign Adult Guidelines', 'Society of Critical Care Medicine and European Society of Intensive Care Medicine', '2026 adult guideline', '2026', 'https://www.sccm.org/survivingsepsiscampaign/guidelines-and-resources/surviving-sepsis-campaign-adult-guidelines'),
  source('sccm_ssc_recommendations_2026', 'Surviving Sepsis Campaign Adult Recommendations', 'Society of Critical Care Medicine', '2026 recommendations', '2026', 'https://www.sccm.org/SurvivingSepsisCampaign/Guidelines/Adult-Patients'),
  source('sccm_pediatric_sepsis', 'Surviving Sepsis Campaign Pediatric Guidelines', 'Society of Critical Care Medicine', 'Pediatric guideline', '2020', 'https://www.sccm.org/survivingsepsiscampaign/guidelines'),
  source('idsa_ssti_2014', 'Practice Guidelines for the Diagnosis and Management of Skin and Soft Tissue Infections', 'Infectious Diseases Society of America', '2014 guideline', '2014', 'https://www.idsociety.org/practice-guideline/skin-and-soft-tissue-infections/'),
  source('idsa_cap_2019', 'Diagnosis and Treatment of Adults with Community-acquired Pneumonia', 'Infectious Diseases Society of America and American Thoracic Society', '2019 guideline', '2019', 'https://www.idsociety.org/practice-guideline/community-acquired-pneumonia-cap-in-adults/'),
  source('cdc_sti_2021', 'Sexually Transmitted Infections Treatment Guidelines', 'Centers for Disease Control and Prevention', '2021 guidelines', '2021', 'https://www.cdc.gov/std/treatment-guidelines/default.htm'),
  source('cdc_sexual_assault_sti', 'Sexual Assault and Abuse and STIs', 'Centers for Disease Control and Prevention', '2021 STI guideline section', '2021', 'https://www.cdc.gov/std/treatment-guidelines/sexual-assault-adults.htm'),
  source('cdc_emergency_contraception', 'Emergency Contraception', 'Centers for Disease Control and Prevention', 'U.S. Selected Practice Recommendations', '2024', 'https://www.cdc.gov/contraception/hcp/usspr/emergency-contraception.html'),
  source('cdc_opioid_2022', 'CDC Clinical Practice Guideline for Prescribing Opioids for Pain', 'Centers for Disease Control and Prevention', '2022 guideline', '2022', 'https://www.cdc.gov/mmwr/volumes/71/rr/rr7103a1.htm', 'society_guideline', { publisher: 'Morbidity and Mortality Weekly Report' }),
  source('acep_opioids_2020', 'Critical Issues in the Prescribing of Opioids for Adult Patients in the Emergency Department', 'American College of Emergency Physicians', '2020 clinical policy', '2020', 'https://www.acep.org/patient-care/clinical-policies/opioids/', 'ed_specific_guideline'),
  source('cdc_lifesaving_naloxone_2025', 'Lifesaving Naloxone', 'Centers for Disease Control and Prevention', 'Overdose prevention guidance', '2025', 'https://www.cdc.gov/stop-overdose/caring/naloxone.html', 'society_guideline'),
  source('cdc_overdose_response_2024', 'What to Do If You Think Someone Is Overdosing', 'Centers for Disease Control and Prevention', 'Stop Overdose response guidance', '2024', 'https://www.cdc.gov/stop-overdose/response/index.html', 'society_guideline'),
  source('samhsa_overdose_response_toolkit_2025', 'Overdose Prevention and Response Toolkit', 'Substance Abuse and Mental Health Services Administration', 'Updated toolkit', '2025', 'https://www.samhsa.gov/resource/recovery/overdose-prevention-response-toolkit', 'society_guideline'),
  source('samhsa_opioid_overdose_reversal_2025', 'Opioid Overdose Reversal Medications', 'Substance Abuse and Mental Health Services Administration', 'OORM guidance', '2025', 'https://www.samhsa.gov/substance-use/treatment/overdose-prevention/opioid-overdose-reversal', 'society_guideline'),
  source('acep_cannabis', 'Cannabis', 'American College of Emergency Physicians', 'Clinical policy', '2026', 'https://www.acep.org/patient-care/clinical-policies', 'ed_specific_guideline'),
  source('acep_carbon_monoxide', 'Carbon Monoxide Poisoning', 'American College of Emergency Physicians', 'Clinical policy', '2026', 'https://www.acep.org/patient-care/clinical-policies', 'ed_specific_guideline'),
  source('acmt_acetaminophen_nac_2026', 'Duration of Intravenous Acetylcysteine Therapy Following Acetaminophen Overdose', 'American College of Medical Toxicology', '2026 practice statement', '2026', 'https://www.acmt.net/news/acmt-practice-statement-duration-of-intravenous-acetylcysteine-therapy-following-acetaminophen-overdose-2026-update/'),
  source('acmt_aact_opioid_exposure', 'Preventing Occupational Opioid Exposure to Emergency Responders', 'American College of Medical Toxicology and American Academy of Clinical Toxicology', 'Position statement', '2025', 'https://www.acmt.net/news/acmt-position-statement-preventing-occupational-opioid-exposure-to-emergency-responders/'),
  source('aact_acmt_toxicology_position_index', 'Clinical Toxicology Position Statements', 'American Academy of Clinical Toxicology and American College of Medical Toxicology', 'Position statement index', '2026', 'https://www.clintox.org/position-statements'),
  source('acep_adult_psych', 'Adult Psychiatric Emergencies', 'American College of Emergency Physicians', 'Policy statement', '2026', 'https://www.acep.org/patient-care/policy-statements/adult-psychiatric-emergencies/', 'ed_specific_guideline'),
  source('acep_psychiatric_patient', 'Psychiatric Patient', 'American College of Emergency Physicians', 'Clinical policy', '2026', 'https://www.acep.org/patient-care/clinical-policies', 'ed_specific_guideline'),
  source('acep_severe_agitation', 'Severe Agitation', 'American College of Emergency Physicians', 'Clinical policy', '2023', 'https://www.acep.org/siteassets/new-pdfs/clinical-policies/severe-agitation-cp.pdf', 'ed_specific_guideline'),
  source('acep_restraints', 'Use of Patient Restraints', 'American College of Emergency Physicians', 'Policy statement', '2019', 'https://www.acep.org/patient-care/policy-statements/use-of-patient-restraints/', 'ed_specific_guideline'),
  source('acep_acute_pain', 'Optimizing the Treatment of Acute Pain in the Emergency Department', 'American College of Emergency Physicians', 'Policy statement', '2026', 'https://www.acep.org/patient-care/policy-statements/ensuring-emergency-department-patient-access-to-appropriate-pain-treatment/', 'ed_specific_guideline'),
  source('acep_procedural_sedation', 'Procedural Sedation and Analgesia in the Emergency Department', 'American College of Emergency Physicians', 'Clinical policy', '2024', 'https://www.acep.org/siteassets/new-pdfs/clinical-policies/clinical-policy-procedural-sedation-and-analgesia-in-the-emergency-department.pdf', 'ed_specific_guideline'),
  source('acep_intubation', 'Endotracheal Intubation', 'American College of Emergency Physicians', 'Clinical policy', '2026', 'https://www.acep.org/patient-care/clinical-policies', 'ed_specific_guideline'),
  source('acep_ultrasound_guidelines', 'Ultrasound Guidelines: Emergency, Point-of-care, and Clinical Ultrasound Guidelines in Medicine', 'American College of Emergency Physicians', 'Policy statement', '2023', 'https://www.acep.org/siteassets/new-pdfs/policy-statements/ultrasound-guidelines--emergency-point-of-care-and-clinical-ultrasound-guidelines-in-medicine.pdf', 'ed_specific_guideline'),
  source('acep_ultrasound_compendium', 'Emergency Ultrasound Imaging Criteria Compendium', 'American College of Emergency Physicians', 'Policy compendium', '2026', 'https://www.acep.org/by-medical-focus/imaging', 'ed_specific_guideline'),
  source('acr_appropriateness_criteria', 'ACR Appropriateness Criteria', 'American College of Radiology', 'Criteria index', '2026', 'https://cs.acr.org/Clinical-Resources/ACR-Appropriateness-Criteria'),
  source('acr_head_trauma', 'ACR Appropriateness Criteria: Head Trauma', 'American College of Radiology', 'Appropriateness criteria', '2026', 'https://acsearch.acr.org/docs/69481/Narrative/'),
  source('acr_abdominal_pain', 'ACR Appropriateness Criteria: Abdominal Pain', 'American College of Radiology', 'Appropriateness criteria', '2026', 'https://www.acr.org/clinical-resources/acr-appropriateness-criteria'),
  source('acr_right_upper_quadrant_pain', 'ACR Appropriateness Criteria: Right Upper Quadrant Pain', 'American College of Radiology', 'Appropriateness criteria', '2026', 'https://www.acr.org/clinical-resources/acr-appropriateness-criteria'),
  source('acr_renal_colic', 'ACR Appropriateness Criteria: Acute Onset Flank Pain', 'American College of Radiology', 'Appropriateness criteria', '2026', 'https://www.acr.org/clinical-resources/acr-appropriateness-criteria'),
  source('acr_pulmonary_embolism', 'ACR Appropriateness Criteria: Suspected Pulmonary Embolism', 'American College of Radiology', 'Appropriateness criteria', '2026', 'https://www.acr.org/clinical-resources/acr-appropriateness-criteria'),
  source('acr_spine_trauma', 'ACR Appropriateness Criteria: Acute Spinal Trauma', 'American College of Radiology', 'Appropriateness criteria', '2026', 'https://www.acr.org/clinical-resources/acr-appropriateness-criteria'),
  source('aap_febrile_infant', 'Evaluation and Management of Well-Appearing Febrile Infants 8 to 60 Days Old', 'American Academy of Pediatrics', 'Clinical practice guideline', '2021', 'https://www.aap.org/en/patient-care/infant-fever/'),
  source('aap_bronchiolitis', 'Diagnosis, Management, and Prevention of Bronchiolitis', 'American Academy of Pediatrics', 'Clinical practice guideline', '2014 reaffirmed', 'https://publications.aap.org/pediatrics'),
  source('acep_pediatric_fever', 'Fever in Infants and Children Younger than 2 Years', 'American College of Emergency Physicians', 'Clinical policy', '2026', 'https://www.acep.org/patient-care/clinical-policies', 'ed_specific_guideline'),
  source('ena_pediatric_triage', 'ESI Pediatric Triage Resources', 'Emergency Nurses Association', 'ESI pediatric resources', '2025', 'https://www.ena.org/education/triage', 'ed_specific_guideline'),
  source('hrsa_pediatric_readiness', 'National Pediatric Readiness Project', 'Health Resources and Services Administration', 'Pediatric readiness resources', '2026', 'https://emscimprovement.center/domains/pediatric-readiness-project/'),
  source('acep_early_pregnancy_2016', 'Initial Evaluation and Management of Patients Presenting to the Emergency Department in Early Pregnancy', 'American College of Emergency Physicians', '2016 clinical policy', '2016', 'https://www.acep.org/patient-care/clinical-policies/early-pregnancy/', 'ed_specific_guideline'),
  source('acog_ectopic_pregnancy', 'Ectopic Pregnancy', 'American College of Obstetricians and Gynecologists', 'Clinical education page', '2026', 'https://www.acog.org/womens-health/faqs/ectopic-pregnancy'),
  source('acog_emergency_contraception', 'Emergency Contraception', 'American College of Obstetricians and Gynecologists', 'Practice guidance', '2026', 'https://www.acog.org/womens-health/faqs/emergency-contraception'),
  source('acog_hypertension_pregnancy', 'Hypertension in Pregnancy', 'American College of Obstetricians and Gynecologists', 'Practice guidance', '2026', 'https://www.acog.org/clinical'),
  source('acog_postpartum_hemorrhage', 'Postpartum Hemorrhage', 'American College of Obstetricians and Gynecologists', 'Practice guidance', '2026', 'https://www.acog.org/clinical'),
  source('aaem_palliative_ed', 'Palliative Care in the Emergency Department', 'American Academy of Emergency Medicine', 'Clinical practice statement', '2023', 'https://www.aaem.org/wp-content/uploads/2023/05/PalliativeCareintheEDUpdated.pdf', 'ed_specific_guideline'),
  source('acep_geriatric_ed', 'Geriatric Emergency Department Care', 'American College of Emergency Physicians', 'Geriatric ED resources', '2026', 'https://www.acep.org/patient-care/accreditation-programs', 'ed_specific_guideline'),
  source('cdc_heat_health', 'Heat and Health Guidance', 'Centers for Disease Control and Prevention', 'Public health guidance', '2026', 'https://www.cdc.gov/heat-health/'),
  source('cdc_hypothermia', 'Hypothermia and Cold Stress Guidance', 'Centers for Disease Control and Prevention', 'Public health guidance', '2026', 'https://www.cdc.gov/niosh/topics/coldstress/'),
  source('who_drowning', 'Drowning Fact Sheet and Prevention Guidance', 'World Health Organization', 'Public health guidance', '2026', 'https://www.who.int/news-room/fact-sheets/detail/drowning'),
  source('nhlbi_sickle_cell', 'Evidence-Based Management of Sickle Cell Disease', 'National Heart, Lung, and Blood Institute', 'Expert panel report', '2014', 'https://www.nhlbi.nih.gov/health-topics/evidence-based-management-sickle-cell-disease'),
  source('ada_hyperglycemic_crises_2024', 'Hyperglycemic Crises in Adults With Diabetes', 'American Diabetes Association and partner societies', '2024 consensus report', '2024', HYPERGLYCEMIC_CRISES_CONSENSUS_PDF_URL, 'society_guideline', { doi: '10.2337/dci24-0032', publisher: 'Diabetes Care' }),
  source('ccjm_hyperglycemic_crises_2025', 'Hyperglycemic crises in adults: A look at the 2024 consensus report', 'Cleveland Clinic Journal of Medicine', 'Peer-reviewed consensus report summary', '2025', 'https://www.ccjm.org/content/92/3/152', 'systematic_review', { publisher: 'Cleveland Clinic Journal of Medicine' })
];

const sourceById = new Map(sources.map((item) => [item.id, item]));

const defaultCaveat = 'do not present this as patient-specific advice unless the case contains matching symptoms, exam findings, risk factors, and local protocol support';

function managementActionForTopic(domain, topicName) {
  const topic = topicName.toLowerCase();
  if (domain.id === 'cardiovascular') {
    if (/stemi|reperfusion/.test(topic)) {
      return 'immediate ECG interpretation, cath-lab or reperfusion pathway activation, antiplatelet and anticoagulation decisions per protocol, continuous monitoring, and rapid cardiology escalation';
    }
    if (/non-st|acs|troponin|chest pain|ecg/.test(topic)) {
      return 'an ACS pathway with prompt ECG review, serial troponins when indicated, symptom control, antiplatelet therapy when not contraindicated, cardiac monitoring, and disposition based on risk and reassessment';
    }
    if (/pulmonary embolism|dvt|venous thromboembolic/.test(topic)) {
      return 'risk-stratified VTE evaluation, oxygen or hemodynamic support when unstable, imaging or exclusion testing matched to pretest probability, and anticoagulation or advanced therapy decisions when indicated';
    }
    if (/aortic/.test(topic)) {
      return 'rapid recognition of acute aortic syndrome, blood-pressure and pain control when appropriate, definitive imaging, and urgent vascular or cardiothoracic consultation';
    }
    if (/heart failure|cardiogenic/.test(topic)) {
      return 'oxygenation support, noninvasive ventilation when appropriate, preload and afterload management based on blood pressure and volume status, trigger evaluation, and monitored disposition';
    }
    if (/tachy|brady|arrhythmia|palpitations/.test(topic)) {
      return 'rhythm identification, hemodynamic stability assessment, synchronized cardioversion or medication pathway when indicated, electrolyte review, and monitored reassessment';
    }
    if (/blood pressure|hypertensive/.test(topic)) {
      return 'distinguishing hypertensive emergency from asymptomatic elevation, assessing acute target-organ injury, treating emergencies with monitored titration, and avoiding rapid treatment when no emergency is present';
    }
  }

  if (domain.id === 'resuscitation') return 'immediate stabilization, role assignment, airway-breathing-circulation interventions, protocol-driven resuscitation, and frequent reassessment';
  if (domain.id === 'respiratory') return 'work-of-breathing assessment, oxygen escalation, bronchodilator or disease-specific therapy when indicated, ventilatory support decisions, and reassessment for fatigue or hypoxemia';
  if (domain.id === 'sepsis_infection') return 'infection severity assessment, cultures when feasible, early antimicrobials when infection is likely, fluid and vasopressor decisions for shock, source control, and reassessment of perfusion';
  if (domain.id === 'neurology') return 'time-sensitive neurologic assessment, glucose check, neuroimaging or stroke pathway activation when indicated, seizure or pressure-directed treatment, and transfer escalation when needed';
  if (domain.id === 'trauma') return 'primary survey priorities, hemorrhage control, immobilization or splinting when indicated, analgesia, imaging or operative pathway decisions, and trauma-team or transfer escalation';
  if (domain.id === 'imaging_procedures') return 'procedure readiness, consent and contraindication review when feasible, analgesia or sedation planning, image or test selection that answers the emergency question, and post-procedure reassessment';
  if (domain.id === 'pediatrics') return 'weight-based pediatric stabilization, caregiver-informed history, age-specific risk assessment, pediatric medication safety, and disposition matched to illness severity and reassessment';
  if (domain.id === 'ob_gyn') return 'pregnancy-aware stabilization, pregnancy testing when relevant, targeted pelvic or abdominal evaluation, Rh or bleeding considerations, and early OB/GYN escalation for unstable or high-risk presentations';
  if (domain.id === 'toxicology') return 'airway and circulation support, toxidrome recognition, targeted antidote or decontamination decisions, observation for recurrence, and poison center or toxicology consultation when indicated';
  if (domain.id === 'psych') return 'scene and staff safety, de-escalation, medical mimic screening, capacity and suicide or violence risk assessment, medication or restraint use only when necessary, and safe disposition planning';
  if (domain.id === 'pain_wounds_msk') return 'analgesia, focused neurovascular or wound assessment, immobilization or procedure planning when indicated, infection prevention considerations, and reassessment of function and pain';
  if (domain.id === 'gi_gu_renal_endocrine') return 'targeted stabilization, pain or nausea control, focused labs and imaging when they change management, electrolyte or metabolic correction when dangerous, and disposition based on response and risk';
  if (domain.id === 'environment_special') return 'stabilization adapted to environmental exposure or special-population risk, warming/cooling or trigger-specific treatment when indicated, social and functional safety review, and conservative disposition when follow-up is uncertain';

  return `case-directed emergency evaluation and timely reassessment for ${topicName.toLowerCase()}`;
}

const domainSpecs = [
  {
    id: 'triage',
    section: 'Triage and ED workflow',
    tags: ['triage', 'esi', 'workflow'],
    taskTags: ['triage', 'tutor', 'debrief', 'reassessment'],
    sources: ['ena_esi_handbook_5e', 'ena_triage_curriculum', 'acep_ena_triage_policy_2025', 'saem_grace_series', 'ena_pediatric_triage'],
    topics: [
      'ESI 1 resuscitation', 'ESI 2 high risk', 'ESI 3 resource prediction', 'ESI 4 limited resources', 'ESI 5 no resources',
      'Danger-zone vital signs', 'Pediatric triage', 'Geriatric triage', 'Bias-aware triage', 'Triage communication',
      'Disaster and mass casualty triage', 'Waiting-room reassessment', 'Severe pain or distress at triage', 'New confusion or lethargy', 'Special population risk screen',
      'Pregnancy triage', 'EMS handoff at arrival', 'Chief concern clarification', 'ED resource estimation', 'Escalation triggers from triage'
    ]
  },
  {
    id: 'resuscitation',
    section: 'Resuscitation and critical care',
    tags: ['resuscitation', 'critical_care', 'shock'],
    taskTags: ['triage', 'management', 'reassessment', 'sbar', 'debrief'],
    sources: ['aha_cpr_ecc_2025', 'aha_2025_algorithms', 'aha_adult_bls_2025', 'aha_adult_acls_2025', 'aha_post_arrest_2025', 'aha_special_circumstances_2025', 'acep_intubation', 'acep_procedural_sedation'],
    topics: [
      'Adult cardiac arrest', 'Pediatric cardiac arrest', 'High-quality CPR', 'Defibrillation readiness', 'Symptomatic bradycardia',
      'Unstable tachyarrhythmia', 'Post-arrest care', 'Airway failure', 'Rapid sequence intubation readiness', 'Oxygenation escalation',
      'Undifferentiated shock', 'Septic shock resuscitation', 'Hemorrhagic shock', 'Anaphylaxis resuscitation', 'Respiratory arrest',
      'ICU escalation', 'Vasopressor initiation', 'Peri-arrest hypoxia', 'Reversible causes of arrest', 'Team leadership during resuscitation'
    ]
  },
  {
    id: 'cardiovascular',
    section: 'Cardiovascular emergencies',
    tags: ['cardiovascular', 'chest_pain', 'syncope'],
    taskTags: ['triage', 'diagnosis', 'management', 'reassessment'],
    sources: ['aha_acc_chest_pain_2021', 'saem_grace_recurrent_chest_pain', 'acep_nste_acs', 'acep_stemi_reperfusion', 'acep_acute_heart_failure', 'acep_venous_thromboembolic', 'acep_asymptomatic_bp', 'acep_thoracic_aortic_dissection'],
    topics: [
      'Chest pain possible ACS', 'STEMI reperfusion', 'Non-ST elevation ACS', 'Low-risk recurrent chest pain', 'High-sensitivity troponin pathway',
      'Initial ECG for chest pain', 'Syncope risk stratification', 'Pulmonary embolism concern', 'Deep vein thrombosis concern', 'Acute aortic syndrome',
      'Acute heart failure', 'Palpitations and arrhythmia', 'Asymptomatic elevated blood pressure', 'Hypertensive emergency', 'Cardiac tamponade concern',
      'Anticoagulated cardiovascular patient', 'Myocarditis or pericarditis concern', 'Cardiogenic shock', 'Chest pain discharge safety', 'Heart failure admission risk'
    ]
  },
  {
    id: 'respiratory',
    section: 'Respiratory emergencies',
    tags: ['respiratory', 'dyspnea', 'hypoxemia'],
    taskTags: ['triage', 'diagnosis', 'management', 'reassessment'],
    sources: ['acep_clinical_policies', 'idsa_cap_2019', 'acep_venous_thromboembolic', 'aha_special_circumstances_2025', 'acr_pulmonary_embolism', 'acep_ultrasound_guidelines'],
    topics: [
      'Asthma exacerbation', 'COPD exacerbation', 'Community-acquired pneumonia', 'Pulmonary embolism respiratory presentation', 'Hypoxemia',
      'Respiratory distress', 'Noninvasive ventilation candidate', 'Oxygenation escalation', 'Pneumothorax concern', 'Tension pneumothorax',
      'Hemoptysis', 'Drowning or submersion', 'Acute respiratory distress syndrome concern', 'Upper airway obstruction', 'Bronchiolitis respiratory distress',
      'Pleural effusion', 'Hypercapnic respiratory failure', 'Smoke inhalation', 'Viral pneumonia or COVID-like illness', 'Ventilatory fatigue'
    ]
  },
  {
    id: 'sepsis_infection',
    section: 'Sepsis and infection',
    tags: ['sepsis', 'infection', 'antibiotics'],
    taskTags: ['triage', 'diagnosis', 'management', 'reassessment'],
    sources: ['sccm_ssc_adult_2026', 'sccm_ssc_recommendations_2026', 'sccm_pediatric_sepsis', 'idsa_ssti_2014', 'idsa_cap_2019', 'cdc_sti_2021', 'cdc_sexual_assault_sti', 'acep_pediatric_fever'],
    topics: [
      'Possible sepsis without shock', 'Septic shock concern', 'Lactate and perfusion reassessment', 'Blood cultures before antibiotics when feasible', 'Antibiotic timing and stewardship',
      'Source control need', 'Skin and soft tissue infection', 'Necrotizing infection concern', 'Abscess drainage decision', 'Urinary infection and pyelonephritis',
      'Sexually transmitted infection', 'Sexual assault STI prophylaxis', 'Meningitis concern', 'Fever in immunocompromised patient', 'Neutropenic fever',
      'Endocarditis risk', 'Osteomyelitis or wet gangrene', 'Cellulitis follow-up safety', 'Infectious diarrhea dehydration', 'Pediatric sepsis screen'
    ]
  },
  {
    id: 'neurology',
    section: 'Neurologic emergencies',
    tags: ['neurology', 'stroke', 'seizure'],
    taskTags: ['triage', 'diagnosis', 'management', 'reassessment'],
    sources: ['acep_acute_ischemic_stroke', 'american_stroke_acute_toolkit', 'acep_tia', 'acep_headache', 'acep_seizure', 'ncs_status_epilepticus', 'brain_trauma_foundation_guidelines', 'acep_mtbi_2023'],
    topics: [
      'Acute stroke symptoms', 'Large vessel occlusion concern', 'Thrombolytic eligibility discussion', 'Thrombectomy transfer pathway', 'Intracranial hemorrhage concern',
      'Subarachnoid hemorrhage headache', 'Status epilepticus', 'First seizure', 'Altered mental status', 'Dizziness and posterior circulation concern',
      'Spinal cord compression concern', 'Transient ischemic attack', 'Head trauma neurologic symptoms', 'Meningitis or encephalitis concern', 'Syncope versus seizure',
      'Pediatric seizure', 'Migraine with red flags', 'Neurologic reassessment', 'Anticoagulated neurologic complaint', 'Stroke mimic and hypoglycemia'
    ]
  },
  {
    id: 'trauma',
    section: 'Trauma',
    tags: ['trauma', 'injury', 'hemorrhage'],
    taskTags: ['triage', 'diagnosis', 'management', 'reassessment', 'sbar'],
    sources: ['acs_tqp_best_practices', 'acs_field_triage', 'acs_tqp_geriatric_trauma', 'acs_tqp_spine_injury', 'acs_tqp_orthopaedic_trauma', 'east_pmg', 'east_cervical_spine', 'east_blunt_abdominal_trauma', 'western_trauma_algorithms', 'western_pelvic_fracture', 'western_blunt_splenic_trauma', 'western_peripheral_vascular_injury', 'western_rib_fractures', 'brain_trauma_severe_tbi'],
    topics: [
      'Major trauma primary survey', 'Hemorrhagic shock', 'Massive transfusion readiness', 'Pelvic fracture with instability', 'Open fracture',
      'Compartment syndrome concern', 'Cervical spine injury', 'Mild traumatic brain injury', 'Severe traumatic brain injury', 'Penetrating trauma',
      'Blunt abdominal trauma', 'Splenic or hepatic injury', 'Burn injury', 'Geriatric trauma', 'Pediatric trauma',
      'Rib fractures', 'Anticoagulated fall', 'Field trauma triage', 'Spinal injury', 'Trauma transfer decision'
    ]
  },
  {
    id: 'imaging_procedures',
    section: 'Imaging and procedures',
    tags: ['imaging', 'procedures', 'ultrasound'],
    taskTags: ['diagnosis', 'management', 'reassessment'],
    sources: ['acr_appropriateness_criteria', 'acr_head_trauma', 'acr_abdominal_pain', 'acr_right_upper_quadrant_pain', 'acr_renal_colic', 'acr_pulmonary_embolism', 'acr_spine_trauma', 'acep_ultrasound_guidelines', 'acep_ultrasound_compendium', 'acep_procedural_sedation'],
    topics: [
      'Abdominal pain imaging', 'Minor head injury CT decision', 'Cervical spine imaging', 'Pulmonary embolism imaging', 'Right upper quadrant ultrasound',
      'Renal colic imaging', 'FAST and eFAST exam', 'POCUS quality and image retention', 'Ultrasound-guided IV access', 'Procedural sedation readiness',
      'Lumbar puncture planning', 'Regional anesthesia', 'Laceration repair', 'Foreign body imaging', 'Abscess incision and drainage',
      'Fracture reduction and splinting', 'Airway confirmation support', 'Early pregnancy pelvic ultrasound', 'Chest imaging', 'CT contrast risk review'
    ]
  },
  {
    id: 'pediatrics',
    section: 'Pediatrics',
    tags: ['pediatrics', 'fever', 'pals'],
    taskTags: ['triage', 'diagnosis', 'management', 'reassessment', 'sbar'],
    sources: ['aap_febrile_infant', 'acep_pediatric_fever', 'aha_pals_2025', 'aha_neonatal_resuscitation_2025', 'aap_bronchiolitis', 'hrsa_pediatric_readiness', 'ena_pediatric_triage', 'sccm_pediatric_sepsis'],
    topics: [
      'Febrile infant 8 to 21 days', 'Febrile infant 22 to 28 days', 'Febrile infant 29 to 60 days', 'Pediatric fever older than 60 days', 'Pediatric respiratory failure',
      'Pediatric shock', 'Bronchiolitis', 'Pediatric dehydration', 'Pediatric abdominal pain', 'Pediatric trauma',
      'Weight-based medication dosing', 'Pediatric sepsis', 'Croup', 'Pediatric asthma exacerbation', 'Febrile seizure',
      'Neonatal resuscitation', 'Child abuse concern', 'Pediatric mental health crisis', 'Pediatric pain control', 'Pediatric handoff'
    ]
  },
  {
    id: 'ob_gyn',
    section: 'OB/GYN',
    tags: ['ob_gyn', 'pregnancy', 'pelvic_pain'],
    taskTags: ['triage', 'diagnosis', 'management', 'reassessment', 'sbar'],
    sources: ['acep_early_pregnancy_2016', 'acog_ectopic_pregnancy', 'cdc_emergency_contraception', 'acog_emergency_contraception', 'cdc_sexual_assault_sti', 'acog_hypertension_pregnancy', 'acog_postpartum_hemorrhage'],
    topics: [
      'Early pregnancy pain or bleeding', 'Ectopic pregnancy rupture concern', 'Vaginal bleeding in pregnancy', 'Vaginal bleeding nonpregnant', 'Pelvic inflammatory disease',
      'Ovarian torsion concern', 'Emergency contraception', 'Sexual assault medical care', 'Pregnancy hypertension concern', 'Hyperemesis or pregnancy dehydration',
      'Postpartum hemorrhage', 'Miscarriage management concerns', 'Rh status in pregnancy bleeding', 'Acute pelvic pain', 'Tubo-ovarian abscess concern',
      'Urinary symptoms in pregnancy', 'Fetal considerations after stabilization', 'Intimate partner violence screen', 'Labor after viability', 'OB handoff and transfer'
    ]
  },
  {
    id: 'toxicology',
    section: 'Toxicology and substance use',
    tags: ['toxicology', 'overdose', 'substance_use'],
    taskTags: ['triage', 'diagnosis', 'management', 'reassessment'],
    sources: ['cdc_lifesaving_naloxone_2025', 'samhsa_overdose_response_toolkit_2025', 'acep_opioids_2020', 'cdc_opioid_2022', 'acep_carbon_monoxide', 'acep_cannabis', 'acmt_acetaminophen_nac_2026', 'acmt_aact_opioid_exposure', 'aact_acmt_toxicology_position_index'],
    topics: [
      'Opioid overdose', 'Naloxone response and recurrence', 'Acetaminophen ingestion', 'Salicylate poisoning', 'Carbon monoxide poisoning',
      'Alcohol withdrawal', 'Stimulant toxicity', 'Sedative-hypnotic toxicity', 'Caustic ingestion', 'Toxic alcohol concern',
      'Buprenorphine initiation', 'Occupational fentanyl exposure concern', 'Cannabis hyperemesis', 'Pediatric ingestion', 'Beta blocker or calcium channel blocker overdose',
      'Tricyclic antidepressant toxicity', 'Lithium toxicity', 'Digoxin toxicity', 'Snakebite or envenomation triage', 'Unknown overdose'
    ]
  },
  {
    id: 'psych',
    section: 'Psychiatric and behavioral emergencies',
    tags: ['psychiatry', 'behavioral_health', 'safety'],
    taskTags: ['triage', 'management', 'reassessment', 'sbar'],
    sources: ['acep_adult_psych', 'acep_psychiatric_patient', 'acep_severe_agitation', 'acep_restraints', 'acep_opioids_2020', 'cdc_opioid_2022'],
    topics: [
      'Suicidal ideation', 'Agitated patient', 'Use of restraints', 'Severe agitation medication strategy', 'Psychosis',
      'Delirium versus psychiatric illness', 'Intoxication and capacity', 'Behavioral health medical screening', 'Violence risk', 'Pediatric mental health crisis',
      'Psychiatric boarding', 'Safe psychiatric disposition', 'Involuntary hold considerations', 'Panic or anxiety presentation', 'Self-harm laceration',
      'Elder abuse or neglect concern', 'Human trafficking concern', 'Substance use disorder linkage', 'Disaster behavioral health', 'Psychiatric handoff'
    ]
  },
  {
    id: 'pain_wounds_msk',
    section: 'Pain, wounds, and musculoskeletal care',
    tags: ['pain', 'wound', 'msk'],
    taskTags: ['triage', 'management', 'reassessment', 'debrief'],
    sources: ['acep_acute_pain', 'cdc_opioid_2022', 'acep_opioids_2020', 'acep_procedural_sedation', 'idsa_ssti_2014', 'acs_tqp_orthopaedic_trauma', 'east_pmg', 'acep_ultrasound_guidelines'],
    topics: [
      'Acute pain management', 'Opioid prescribing at discharge', 'Regional nerve block', 'Back pain red flags', 'Laceration danger findings',
      'Bite wound', 'Cellulitis versus abscess', 'Fracture neurovascular exam', 'Septic joint concern', 'Pain reassessment',
      'Open fracture antibiotics and splinting', 'Splinting safety', 'Crush injury', 'Hand injury', 'Dental pain',
      'Burn pain', 'Migraine pain strategy', 'Renal colic analgesia', 'Sickle cell pain crisis', 'Procedural pain control'
    ]
  },
  {
    id: 'gi_gu_renal_endocrine',
    section: 'GI, GU, renal, and endocrine emergencies',
    tags: ['abdominal_pain', 'renal', 'endocrine'],
    taskTags: ['triage', 'diagnosis', 'management', 'reassessment'],
    sources: ['acr_abdominal_pain', 'acr_right_upper_quadrant_pain', 'acr_renal_colic', 'acep_appendicitis', 'ada_hyperglycemic_crises_2024', 'sccm_ssc_adult_2026', 'acep_clinical_policies', 'idsa_ssti_2014'],
    topics: [
      'Severe abdominal pain', 'Abdominal aortic aneurysm concern', 'GI bleeding', 'Appendicitis concern', 'Biliary disease',
      'Pancreatitis', 'Renal colic', 'DKA or HHS', 'Hypoglycemia', 'Hyperkalemia',
      'Hyponatremia with neurologic symptoms', 'Adrenal crisis concern', 'Testicular torsion', 'Urinary retention', 'Pyelonephritis',
      'Acute kidney injury', 'Dialysis complication', 'Bowel obstruction', 'Electrolyte emergency', 'Endocrine medication adverse event'
    ]
  },
  {
    id: 'environment_special',
    section: 'Environmental and special populations',
    tags: ['environmental', 'special_populations', 'disposition'],
    taskTags: ['triage', 'management', 'reassessment', 'debrief', 'sbar'],
    sources: ['cdc_heat_health', 'cdc_hypothermia', 'who_drowning', 'aha_special_circumstances_2025', 'acep_geriatric_ed', 'acs_tqp_geriatric_trauma', 'nhlbi_sickle_cell', 'aaem_palliative_ed', 'acep_clinical_policies'],
    topics: [
      'Heat illness', 'Hypothermia', 'Drowning', 'Sickle cell pain crisis', 'Immunocompromised patient',
      'Anticoagulated fall', 'Geriatric ED presentation', 'Palliative ED care', 'Discharge safety', 'SBAR escalation',
      'Anaphylaxis special circumstance', 'Altitude illness', 'Lightning or electrical injury', 'Frostbite', 'Homelessness or social risk',
      'Pregnancy as special population', 'Bariatric patient safety', 'Disability and communication needs', 'Disaster care context', 'Return precautions for vulnerable patients'
    ]
  }
];

function slug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizedText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sha256(value) {
  return createHash('sha256').update(String(value || '').replace(/\s+/g, ' ').trim()).digest('hex');
}

function wordCount(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean).length;
}

function quoteRecord(sourceRecord, quoteText, locator = {}) {
  const text = String(quoteText || '').replace(/\s+/g, ' ').trim();
  const quoteWordCount = wordCount(text);
  if (!text) throw new Error(`Missing quote text for ${sourceRecord.id}`);
  if (quoteWordCount > QUOTE_EXCERPT_WORD_LIMIT) {
    throw new Error(`Quote for ${sourceRecord.id} has ${quoteWordCount} words; limit is ${QUOTE_EXCERPT_WORD_LIMIT}.`);
  }
  const searchPhrase = locator.search_phrase || text;
  return {
    text,
    source_url: locator.source_url || sourceRecord.url || '',
    source_title: sourceRecord.title,
    organization: sourceRecord.organization,
    section_heading: locator.section_heading || '',
    page: locator.page || '',
    search_phrase: searchPhrase,
    quote_hash: sha256(text),
    word_count: quoteWordCount,
    extraction_date: '2026-05-24',
    verification_status: 'human_verified'
  };
}

function locatorSearchPhrases(sourceRecord, domain, topicName, facet) {
  return [
    `${topicName} ${facet.id.replace(/_/g, ' ')}`,
    `${sourceRecord.title} ${topicName}`,
    `${domain.section} ${topicName}`
  ]
    .map((phrase) => phrase.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 3);
}

function locatorForChunk(sourceRecord, domain, topicName, facet) {
  const searchPhrases = locatorSearchPhrases(sourceRecord, domain, topicName, facet);
  return {
    url: sourceRecord.url || '',
    section_heading: `${domain.section} - ${topicName}`,
    page: '',
    search_phrases: searchPhrases,
    locator_quality: 'source_url_with_search_phrase_unquoted',
    verification_status: 'needs_review'
  };
}

function locatorIsAuditable(chunk) {
  const locator = chunk.locator || {};
  if (!['anchored', 'human_verified'].includes(locator.verification_status)) return false;
  return Boolean(
    (chunk.source_url || locator.url) &&
    (
      locator.section_heading ||
      locator.page ||
      chunk.doi ||
      chunk.pmid ||
      (Array.isArray(locator.search_phrases) && locator.search_phrases.length)
    )
  );
}

const topicSourceOverrides = {
  septic_shock_concern: 'sccm_ssc_recommendations_2026',
  septic_shock_resuscitation: 'sccm_ssc_adult_2026',
  'resuscitation:hemorrhagic_shock': 'aha_adult_acls_2025',
  'trauma:hemorrhagic_shock': 'acs_tqp_best_practices',
  chest_pain_possible_acs: 'aha_acc_chest_pain_2021',
  stemi_reperfusion: 'acep_stemi_reperfusion',
  non_st_elevation_acs: 'acep_nste_acs',
  high_sensitivity_troponin_pathway: 'aha_acc_chest_pain_2021',
  initial_ecg_for_chest_pain: 'aha_acc_chest_pain_2021',
  low_risk_recurrent_chest_pain: 'saem_grace_recurrent_chest_pain',
  chest_pain_discharge_safety: 'saem_grace_recurrent_chest_pain',
  opioid_overdose: 'cdc_lifesaving_naloxone_2025',
  naloxone_response_and_recurrence: 'samhsa_overdose_response_toolkit_2025',
  dka_or_hhs: 'ada_hyperglycemic_crises_2024',
  febrile_infant_8_to_21_days: 'aap_febrile_infant',
  thrombolytic_eligibility_discussion: 'american_stroke_acute_toolkit',
  acute_stroke_symptoms: 'acep_acute_ischemic_stroke',
  use_of_restraints: 'acep_restraints',
  severe_agitation_medication_strategy: 'acep_severe_agitation',
  minor_head_injury_ct_decision: 'acr_head_trauma',
  ectopic_pregnancy_rupture_concern: 'acep_early_pregnancy_2016'
};

const facetById = new Map(CHUNK_FACETS.map((facet) => [facet.id, facet]));

function quoteLocator(sourceRecord, definition, quote) {
  return {
    url: definition.locator?.source_url || sourceRecord.url || '',
    section_heading: definition.locator?.section_heading || definition.section || '',
    page: definition.locator?.page || '',
    search_phrases: [
      definition.locator?.search_phrase || quote.search_phrase,
      definition.query_phrase,
      `${sourceRecord.title} ${definition.topic_label || definition.section || ''}`
    ].filter(Boolean).map((phrase) => String(phrase).replace(/\s+/g, ' ').trim()).slice(0, 5),
    locator_quality: 'direct_quote_short_excerpt',
    verification_status: 'human_verified'
  };
}

function makeQuoteBackedChunk(definition, index) {
  const sourceRecord = sourceById.get(definition.source_id);
  if (!sourceRecord) throw new Error(`Quote-backed chunk references missing source ${definition.source_id}`);
  const facet = facetById.get(definition.facet_id);
  if (!facet) throw new Error(`Quote-backed chunk ${definition.id} uses unknown facet ${definition.facet_id}`);
  const quote = quoteRecord(sourceRecord, definition.quote, definition.locator || {});
  const locator = quoteLocator(sourceRecord, definition, quote);
  const id = definition.id || `quote_backed_${String(index + 1).padStart(3, '0')}`;
  const text = String(definition.text || '').replace(/\s+/g, ' ').trim();
  if (text.length < 80) throw new Error(`Quote-backed chunk ${id} is too short.`);
  return {
    schema_version: 'reference_chunk_v1',
    id,
    source_id: sourceRecord.id,
    section: definition.section,
    page: definition.page || '',
    source_url: sourceRecord.url,
    source_title: sourceRecord.title,
    organization: sourceRecord.organization,
    publication_date: sourceRecord.publication_date,
    doi: sourceRecord.doi || '',
    pmid: sourceRecord.pmid || '',
    isbn: sourceRecord.isbn || '',
    locator,
    citation_label: definition.citation_label || `QB-${String(index + 1).padStart(3, '0')}`,
    facet_id: facet.id,
    topic_tags: [...new Set(definition.topic_tags || [])],
    task_tags: [...new Set(definition.task_tags || facet.taskTags || [])],
    source_tier: sourceRecord.source_tier,
    review_status: 'reviewed',
    evidence_status: QUOTE_BACKED_EVIDENCE_STATUS,
    supporting_quotes: [quote],
    verification_status: 'human_verified',
    active: true,
    superseded_by: '',
    clinical_rule: definition.clinical_rule || text,
    text,
    normalized_text: normalizedText([definition.query_phrase, definition.clinical_rule, text, quote.text].filter(Boolean).join(' '))
  };
}

const quoteBackedCoreDefinitions = [
  {
    id: 'quote_sepsis_antimicrobial_timing_001',
    source_id: 'sccm_ssc_recommendations_2026',
    section: 'Sepsis and infection - Septic shock concern',
    topic_label: 'Septic shock concern',
    facet_id: 'initial_management',
    topic_tags: ['sepsis', 'infection', 'antibiotics', 'septic_shock_concern'],
    task_tags: ['management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-SEPSIS-M01',
    query_phrase: 'septic shock management antibiotics within 1 hour abnormal vital signs',
    clinical_rule: 'For suspected septic shock, treat antimicrobial timing as an immediate management priority while obtaining cultures when feasible.',
    text: 'Quote-backed sepsis shock management summary: suspected septic shock with abnormal vital signs should trigger immediate resuscitation, cultures when feasible, prompt broad antimicrobials, and documented reassessment rather than generic red-flag review.',
    quote: 'administering antimicrobial therapy immediately, ideally within 1 hr of recognition',
    locator: {
      section_heading: 'Initial resuscitation and infection management',
      search_phrase: 'administering antimicrobial therapy immediately, ideally within 1 hr of recognition'
    }
  },
  {
    id: 'quote_sepsis_fluid_resuscitation_002',
    source_id: 'sccm_ssc_adult_2026',
    section: 'Sepsis and infection - Septic shock concern',
    topic_label: 'Septic shock concern',
    facet_id: 'initial_management',
    topic_tags: ['sepsis', 'infection', 'antibiotics', 'septic_shock_concern'],
    task_tags: ['management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-SEPSIS-M02',
    query_phrase: 'septic shock management fluids crystalloid resuscitation perfusion',
    clinical_rule: 'For septic shock with hypoperfusion, initial ED management should include crystalloid resuscitation and close perfusion reassessment.',
    text: 'Quote-backed sepsis shock management summary: shock physiology in a suspected infection should prompt crystalloid fluid resuscitation, repeat perfusion checks, and escalation when hypotension or hypoperfusion persists.',
    quote: 'using crystalloids as first-line fluid for resuscitation',
    locator: {
      section_heading: 'Hemodynamic management',
      search_phrase: 'using crystalloids as first-line fluid for resuscitation'
    }
  },
  {
    id: 'quote_sepsis_vasopressor_norepinephrine_003',
    source_id: 'sccm_ssc_adult_2026',
    section: 'Resuscitation and critical care - Septic shock resuscitation',
    topic_label: 'Septic shock resuscitation',
    facet_id: 'medication_procedure',
    topic_tags: ['resuscitation', 'critical_care', 'shock', 'septic_shock_resuscitation'],
    task_tags: ['management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-SEPSIS-P03',
    query_phrase: 'septic shock vasopressor norepinephrine persistent hypotension',
    clinical_rule: 'If septic shock hypotension persists after initial fluid resuscitation, norepinephrine is the preferred first-line vasopressor reference point.',
    text: 'Quote-backed septic shock resuscitation summary: persistent shock after fluids requires vasopressor planning, usually norepinephrine first, with monitoring of blood pressure, perfusion, mental status, and ICU escalation.',
    quote: 'using norepinephrine as the first-line agent',
    locator: {
      section_heading: 'Vasoactive medications',
      search_phrase: 'using norepinephrine as the first-line agent'
    }
  },
  {
    id: 'quote_sepsis_begin_resuscitation_004',
    source_id: 'sccm_ssc_adult_2026',
    section: 'Resuscitation and critical care - Septic shock resuscitation',
    topic_label: 'Septic shock resuscitation',
    facet_id: 'diagnostic_strategy',
    topic_tags: ['resuscitation', 'critical_care', 'shock', 'septic_shock_resuscitation'],
    task_tags: ['diagnosis', 'management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-SEPSIS-D04',
    query_phrase: 'septic shock lactate source control immediate treatment resuscitation',
    clinical_rule: 'Septic shock evaluation and treatment should begin immediately, with lactate/perfusion reassessment and source-control planning integrated into resuscitation.',
    text: 'Quote-backed septic shock diagnostic and management summary: do not delay resuscitation while refining the differential; pair infection evaluation, lactate or perfusion reassessment, and source-control decisions with initial stabilization.',
    quote: 'treatment and resuscitation should begin immediately',
    locator: {
      section_heading: 'Initial resuscitation',
      search_phrase: 'treatment and resuscitation should begin immediately'
    }
  },
  {
    id: 'quote_sepsis_deescalation_005',
    source_id: 'sccm_ssc_recommendations_2026',
    section: 'Sepsis and infection - Septic shock concern',
    topic_label: 'Septic shock concern',
    facet_id: 'disposition_reassessment',
    topic_tags: ['sepsis', 'infection', 'antibiotics', 'septic_shock_concern'],
    task_tags: ['reassessment', 'sbar', 'tutor', 'debrief'],
    citation_label: 'QB-SEPSIS-S05',
    query_phrase: 'septic shock reassessment antimicrobial de-escalation source control',
    clinical_rule: 'Sepsis management should include reassessment of antimicrobial need and de-escalation as diagnostic data return.',
    text: 'Quote-backed sepsis reassessment summary: after early stabilization, update the plan using culture data, source-control progress, perfusion response, organ dysfunction trend, and antimicrobial de-escalation opportunities.',
    quote: 'de-escalation of antimicrobial therapy',
    locator: {
      section_heading: 'Antimicrobial stewardship',
      search_phrase: 'de-escalation of antimicrobial therapy'
    }
  },
  {
    id: 'quote_sepsis_early_recognition_006',
    source_id: 'sccm_ssc_adult_2026',
    section: 'Sepsis and infection - Septic shock concern',
    topic_label: 'Septic shock concern',
    facet_id: 'recognition',
    topic_tags: ['sepsis', 'infection', 'antibiotics', 'septic_shock_concern', 'septic_shock_resuscitation'],
    task_tags: ['triage', 'diagnosis', 'management', 'tutor', 'debrief'],
    citation_label: 'QB-SEPSIS-R06',
    query_phrase: 'sepsis septic shock early recognition timely treatment hemodynamic resuscitation',
    clinical_rule: 'Possible septic shock should be recognized early because treatment of infection and hemodynamic resuscitation are core pillars of care.',
    text: 'Quote-backed sepsis recognition summary: abnormal physiology with suspected infection should trigger early concern for sepsis or septic shock, because the guideline frames early recognition, infection treatment, and hemodynamic resuscitation as linked pillars rather than separate tasks.',
    quote: 'early recognition, timely treatment of infection, and hemodynamic resuscitation',
    locator: {
      section_heading: 'Surviving Sepsis Campaign Adult Guidelines',
      search_phrase: 'early recognition, timely treatment of infection, and hemodynamic resuscitation'
    }
  },
  {
    id: 'quote_sepsis_screening_assessment_007',
    source_id: 'sccm_ssc_adult_2026',
    section: 'Sepsis and infection - Septic shock concern',
    topic_label: 'Septic shock concern',
    facet_id: 'focused_assessment',
    topic_tags: ['sepsis', 'infection', 'antibiotics', 'septic_shock_concern'],
    task_tags: ['triage', 'diagnosis', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-SEPSIS-A07',
    query_phrase: 'sepsis screening focused assessment NEWS MEWS SIRS qSOFA',
    clinical_rule: 'Acutely ill adults should be screened for sepsis using validated illness-severity tools rather than relying on qSOFA alone.',
    text: 'Quote-backed sepsis focused assessment summary: when infection is plausible, learners should connect vital-sign abnormality, mental status, perfusion, and organ dysfunction to a structured sepsis screen rather than reassuring themselves with a single low-risk impression.',
    quote: 'using NEWS, NEW2, MEWS, or SIRS over qSOFA as a single tool to screen for sepsis',
    locator: {
      section_heading: 'Screening',
      search_phrase: 'using NEWS, NEW2, MEWS, or SIRS over qSOFA as a single tool to screen for sepsis'
    }
  },
  {
    id: 'quote_sepsis_blood_culture_diagnostics_008',
    source_id: 'sccm_ssc_adult_2026',
    section: 'Sepsis and infection - Septic shock concern',
    topic_label: 'Septic shock concern',
    facet_id: 'diagnostic_strategy',
    topic_tags: ['sepsis', 'infection', 'antibiotics', 'septic_shock_concern'],
    task_tags: ['diagnosis', 'management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-SEPSIS-D08',
    query_phrase: 'sepsis diagnostic strategy blood cultures before antimicrobial therapy',
    clinical_rule: 'For possible, probable, or definite sepsis or septic shock, cultures should be collected as soon as possible and ideally before antimicrobials when this does not delay urgent treatment.',
    text: 'Quote-backed sepsis diagnostic summary: suspected septic shock requires diagnostic work that supports immediate treatment, including blood-culture planning before antimicrobials when feasible, without letting testing postpone urgent resuscitation or antibiotics.',
    quote: 'collecting blood cultures as soon as possible and ideally before the administration of antimicrobial therapy',
    locator: {
      section_heading: 'Blood culture',
      search_phrase: 'collecting blood cultures as soon as possible and ideally before the administration of antimicrobial therapy'
    }
  },
  {
    id: 'quote_sepsis_unstable_shock_assessment_009',
    source_id: 'sccm_ssc_adult_2026',
    section: 'Resuscitation and critical care - Septic shock resuscitation',
    topic_label: 'Septic shock resuscitation',
    facet_id: 'focused_assessment',
    topic_tags: ['resuscitation', 'critical_care', 'shock', 'septic_shock_resuscitation'],
    task_tags: ['triage', 'diagnosis', 'management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-SEPSIS-A09',
    query_phrase: 'septic shock focused assessment unstable shock blood pressure mottled altered mentation',
    clinical_rule: 'Focused assessment of septic shock resuscitation should actively look for physical signs of unstable shock.',
    text: 'Quote-backed septic shock assessment summary: bedside resuscitation assessment should name the physiology driving urgency, including blood pressure, skin perfusion, oxygenation, tachycardia, and mental status, so learners do not treat shock as a vague label.',
    quote: 'severely reduced blood pressure, mottled skin, ashen appearance, cyanosis/decreased oxygen saturation, tachycardia, and altered mentation',
    locator: {
      section_heading: 'Fluid resuscitation',
      search_phrase: 'severely reduced blood pressure, mottled skin, ashen appearance, cyanosis/decreased oxygen saturation, tachycardia, and altered mentation'
    }
  },
  {
    id: 'quote_sepsis_fluid_vasopressor_sequence_010',
    source_id: 'sccm_ssc_adult_2026',
    section: 'Resuscitation and critical care - Septic shock resuscitation',
    topic_label: 'Septic shock resuscitation',
    facet_id: 'initial_management',
    topic_tags: ['resuscitation', 'critical_care', 'shock', 'septic_shock_resuscitation'],
    task_tags: ['management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-SEPSIS-M10',
    query_phrase: 'septic shock initial management crystalloid bolus vasopressor support persistent hypotension',
    clinical_rule: 'Septic shock management should sequence crystalloid bolus resuscitation with vasopressor support when hypotension persists.',
    text: 'Quote-backed septic shock management summary: if hypotension persists in suspected septic shock, learners should escalate from initial crystalloid bolus resuscitation to vasopressor planning instead of repeating nonspecific fluid orders without reassessment.',
    quote: 'initial IV crystalloid fluid bolus resuscitation followed by vasopressor support if hypotension persists',
    locator: {
      section_heading: 'Fluid resuscitation',
      search_phrase: 'initial IV crystalloid fluid bolus resuscitation followed by vasopressor support if hypotension persists'
    }
  },
  {
    id: 'quote_sepsis_resuscitation_reassessment_011',
    source_id: 'sccm_ssc_adult_2026',
    section: 'Resuscitation and critical care - Septic shock resuscitation',
    topic_label: 'Septic shock resuscitation',
    facet_id: 'disposition_reassessment',
    topic_tags: ['resuscitation', 'critical_care', 'shock', 'septic_shock_resuscitation'],
    task_tags: ['reassessment', 'sbar', 'management', 'tutor', 'debrief'],
    citation_label: 'QB-SEPSIS-S11',
    query_phrase: 'septic shock reassessment monitor under over resuscitation fluids',
    clinical_rule: 'Septic shock resuscitation should include frequent reassessment and monitoring for both under-resuscitation and over-resuscitation.',
    text: 'Quote-backed septic shock reassessment summary: disposition or ICU escalation should be guided by repeated perfusion checks and treatment response, because fluid prescribing requires ongoing monitoring rather than a single static bolus decision.',
    quote: 'perform frequent, ongoing reassessment and closely monitor patients',
    locator: {
      section_heading: 'Fluid resuscitation',
      search_phrase: 'perform frequent, ongoing reassessment and closely monitor patients'
    }
  },
  {
    id: 'quote_acs_ecg_001',
    source_id: 'aha_acc_chest_pain_slide_set_2021',
    section: 'Cardiovascular emergencies - Chest pain possible ACS',
    topic_label: 'Chest pain possible ACS',
    facet_id: 'diagnostic_strategy',
    topic_tags: ['cardiovascular', 'chest_pain', 'syncope', 'chest_pain_possible_acs'],
    task_tags: ['diagnosis', 'management', 'triage', 'tutor', 'debrief'],
    citation_label: 'QB-ACS-D01',
    query_phrase: 'chest pain possible ACS management ECG initial electrocardiogram',
    clinical_rule: 'Possible ACS in the ED requires early ECG interpretation before disposition or reassurance.',
    text: 'Quote-backed ACS diagnostic summary: chest pain concerning for ACS should prioritize early ECG acquisition and interpretation, with the result driving STEMI, NSTE-ACS, or alternate pathway decisions.',
    quote: 'an ECG should be acquired and reviewed for STEMI within 10 minutes of arrival',
    locator: {
      section_heading: 'Initial evaluation of acute chest pain',
      search_phrase: 'an ECG should be acquired and reviewed for STEMI within 10 minutes of arrival'
    }
  },
  {
    id: 'quote_acs_serial_troponin_002',
    source_id: 'aha_acc_chest_pain_slide_set_2021',
    section: 'Cardiovascular emergencies - High-sensitivity troponin pathway',
    topic_label: 'High-sensitivity troponin pathway',
    facet_id: 'diagnostic_strategy',
    topic_tags: ['cardiovascular', 'chest_pain', 'syncope', 'high_sensitivity_troponin_pathway'],
    task_tags: ['diagnosis', 'management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-ACS-D02',
    query_phrase: 'ACS management serial troponin chest pain acute myocardial injury',
    clinical_rule: 'ACS evaluation should use serial cardiac troponins when indicated to identify acute myocardial injury patterns.',
    text: 'Quote-backed chest pain diagnostic summary: serial troponin testing supports rule-in or rule-out decisions for acute myocardial injury and should be interpreted with symptoms, ECG, and timing.',
    quote: 'serial cTn I or T levels are useful',
    locator: {
      section_heading: 'High-sensitivity cardiac troponins',
      search_phrase: 'serial cTn I or T levels are useful'
    }
  },
  {
    id: 'quote_acs_high_sensitivity_troponin_003',
    source_id: 'aha_acc_chest_pain_slide_set_2021',
    section: 'Cardiovascular emergencies - High-sensitivity troponin pathway',
    topic_label: 'High-sensitivity troponin pathway',
    facet_id: 'diagnostic_strategy',
    topic_tags: ['cardiovascular', 'chest_pain', 'syncope', 'high_sensitivity_troponin_pathway'],
    task_tags: ['diagnosis', 'management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-ACS-D03',
    query_phrase: 'chest pain possible ACS high sensitivity troponin preferred biomarker',
    clinical_rule: 'High-sensitivity cardiac troponin is the preferred biomarker framework for ED chest pain pathways when available.',
    text: 'Quote-backed ACS biomarker summary: high-sensitivity troponin pathways improve rapid detection or exclusion of myocardial injury, but results still need ECG, timing, and risk-context interpretation.',
    quote: 'high-sensitivity cTn is the preferred biomarker',
    locator: {
      section_heading: 'High-sensitivity cardiac troponins',
      search_phrase: 'high-sensitivity cTn is the preferred biomarker'
    }
  },
  {
    id: 'quote_acs_decision_pathway_004',
    source_id: 'aha_acc_chest_pain_slide_set_2021',
    section: 'Cardiovascular emergencies - Chest pain possible ACS',
    topic_label: 'Chest pain possible ACS',
    facet_id: 'initial_management',
    topic_tags: ['cardiovascular', 'chest_pain', 'syncope', 'chest_pain_possible_acs'],
    task_tags: ['management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-ACS-M04',
    query_phrase: 'chest pain possible ACS management clinical decision pathway monitoring disposition',
    clinical_rule: 'Management of possible ACS should follow a structured chest pain clinical decision pathway rather than an unsupported single finding.',
    text: 'Quote-backed ACS management summary: use a structured pathway that combines symptoms, ECG, serial troponin strategy, risk profile, monitoring needs, and disposition rather than a generic red-flag paragraph.',
    quote: 'should be used routinely',
    locator: {
      section_heading: 'Clinical decision pathways',
      search_phrase: 'Clinical decision pathways for chest pain should be used routinely'
    }
  },
  {
    id: 'quote_acs_guideline_pathway_005',
    source_id: 'aha_acc_chest_pain_slide_set_2021',
    section: 'Cardiovascular emergencies - Non-ST elevation ACS',
    topic_label: 'Non-ST elevation ACS',
    facet_id: 'initial_management',
    topic_tags: ['cardiovascular', 'chest_pain', 'syncope', 'non_st_elevation_acs'],
    task_tags: ['management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-ACS-M05',
    query_phrase: 'NSTE ACS STEMI guideline management antiplatelet monitoring disposition',
    clinical_rule: 'When the initial ECG is consistent with ACS, management should move into the appropriate STEMI or NSTE-ACS guideline pathway.',
    text: 'Quote-backed ACS management summary: abnormal ECG evidence should shift the learner from undifferentiated chest pain to syndrome-specific treatment, monitoring, cardiology escalation, and disposition planning.',
    quote: 'treated according to STEMI and NSTE-ACS guidelines',
    locator: {
      section_heading: 'Initial ECG and ACS pathways',
      search_phrase: 'treated according to STEMI and NSTE-ACS guidelines'
    }
  },
  {
    id: 'quote_acs_anginal_equivalents_006',
    source_id: 'aha_acc_chest_pain_slide_set_2021',
    section: 'Cardiovascular emergencies - Chest pain possible ACS',
    topic_label: 'Chest pain possible ACS',
    facet_id: 'recognition',
    topic_tags: ['cardiovascular', 'chest_pain', 'syncope', 'chest_pain_possible_acs'],
    task_tags: ['triage', 'diagnosis', 'management', 'tutor', 'debrief'],
    citation_label: 'QB-ACS-R06',
    query_phrase: 'chest pain possible ACS anginal equivalents pain pressure discomfort shortness of breath fatigue',
    clinical_rule: 'Possible ACS recognition should include anginal equivalents, not only substernal chest pain.',
    text: 'Quote-backed ACS recognition summary: learners should treat pressure, tightness, discomfort, shortness of breath, fatigue, and upper-body pain patterns as possible anginal equivalents when the case context supports ACS concern.',
    quote: 'should all be considered anginal equivalents',
    locator: {
      section_heading: 'Top 10 Take Home Messages - Chest Pain Means More Than Pain in the Chest',
      search_phrase: 'should all be considered anginal equivalents'
    }
  },
  {
    id: 'quote_acs_structured_risk_assessment_007',
    source_id: 'aha_acc_chest_pain_slide_set_2021',
    section: 'Cardiovascular emergencies - Chest pain possible ACS',
    topic_label: 'Chest pain possible ACS',
    facet_id: 'focused_assessment',
    topic_tags: ['cardiovascular', 'chest_pain', 'syncope', 'chest_pain_possible_acs'],
    task_tags: ['diagnosis', 'management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-ACS-A07',
    query_phrase: 'chest pain possible ACS focused assessment structured risk assessment evidence based diagnostic protocols',
    clinical_rule: 'Focused ACS assessment should estimate coronary disease and adverse-event risk using a structured protocol.',
    text: 'Quote-backed ACS assessment summary: history, ECG context, risk factors, vital signs, symptom timing, and troponin strategy should feed a structured risk estimate rather than an unsupported reassurance or admission decision.',
    quote: 'adverse events should be estimated using evidence-based diagnostic protocols',
    locator: {
      section_heading: 'Top 10 Take Home Messages - Structured Risk Assessment Should Be Used',
      search_phrase: 'adverse events should be estimated using evidence-based diagnostic protocols'
    }
  },
  {
    id: 'quote_acs_disposition_cdp_008',
    source_id: 'aha_acc_chest_pain_slide_set_2021',
    section: 'Cardiovascular emergencies - Chest pain possible ACS',
    topic_label: 'Chest pain possible ACS',
    facet_id: 'disposition_reassessment',
    topic_tags: ['cardiovascular', 'chest_pain', 'syncope', 'chest_pain_possible_acs'],
    task_tags: ['reassessment', 'sbar', 'management', 'tutor', 'debrief'],
    citation_label: 'QB-ACS-S08',
    query_phrase: 'chest pain possible ACS disposition low intermediate high risk clinical decision pathway',
    clinical_rule: 'Disposition for suspected ACS should be tied to clinical decision pathway risk strata and follow-up diagnostic needs.',
    text: 'Quote-backed ACS disposition summary: after initial ECG and troponin assessment, learners should explicitly classify low, intermediate, or high risk, then match observation, discharge planning, or escalation to that pathway.',
    quote: 'low-, intermediate-, and high-risk strata to facilitate disposition',
    locator: {
      section_heading: 'Patients With Acute Chest Pain and Suspected ACS',
      search_phrase: 'low-, intermediate-, and high-risk strata to facilitate disposition'
    }
  },
  {
    id: 'quote_troponin_biomarker_recognition_006',
    source_id: 'aha_acc_chest_pain_slide_set_2021',
    section: 'Cardiovascular emergencies - High-sensitivity troponin pathway',
    topic_label: 'High-sensitivity troponin pathway',
    facet_id: 'recognition',
    topic_tags: ['cardiovascular', 'chest_pain', 'syncope', 'high_sensitivity_troponin_pathway'],
    task_tags: ['triage', 'diagnosis', 'management', 'tutor', 'debrief'],
    citation_label: 'QB-TROPONIN-R06',
    query_phrase: 'high sensitivity troponin preferred biomarker myocardial infarction recognition acute myocardial injury',
    clinical_rule: 'High-sensitivity troponin pathways should be recognized as myocardial-injury biomarker pathways, not as stand-alone ACS diagnosis.',
    text: 'Quote-backed troponin recognition summary: elevated or changing high-sensitivity troponin should trigger myocardial injury reasoning, while the learner still integrates symptoms, ECG findings, and timing before labeling ACS.',
    quote: 'preferred standard for establishing a biomarker diagnosis',
    locator: {
      section_heading: 'Top 10 Take Home Messages - High-Sensitivity Troponins Preferred',
      search_phrase: 'preferred standard for establishing a biomarker diagnosis'
    }
  },
  {
    id: 'quote_troponin_interval_assessment_007',
    source_id: 'aha_acc_chest_pain_slide_set_2021',
    section: 'Cardiovascular emergencies - High-sensitivity troponin pathway',
    topic_label: 'High-sensitivity troponin pathway',
    facet_id: 'focused_assessment',
    topic_tags: ['cardiovascular', 'chest_pain', 'syncope', 'high_sensitivity_troponin_pathway'],
    task_tags: ['diagnosis', 'management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-TROPONIN-A07',
    query_phrase: 'high sensitivity troponin focused assessment repeat interval initial sample collection',
    clinical_rule: 'Troponin interpretation should include symptom timing and the recommended repeat-sampling interval after the initial sample.',
    text: 'Quote-backed troponin assessment summary: learners should ask when symptoms began, when the initial troponin was drawn, whether the ECG is normal or ischemic, and what repeat interval the local assay pathway requires.',
    quote: 'recommended time intervals after the initial troponin sample collection',
    locator: {
      section_heading: 'Patients With Acute Chest Pain and Suspected ACS',
      search_phrase: 'recommended time intervals after the initial troponin sample collection'
    }
  },
  {
    id: 'quote_troponin_protocol_management_008',
    source_id: 'aha_acc_chest_pain_slide_set_2021',
    section: 'Cardiovascular emergencies - High-sensitivity troponin pathway',
    topic_label: 'High-sensitivity troponin pathway',
    facet_id: 'initial_management',
    topic_tags: ['cardiovascular', 'chest_pain', 'syncope', 'high_sensitivity_troponin_pathway'],
    task_tags: ['management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-TROPONIN-M08',
    query_phrase: 'high sensitivity troponin initial management clinical decision pathway troponin sampling protocol assay',
    clinical_rule: 'Initial troponin-pathway management should follow an institutional clinical decision pathway using the local assay protocol.',
    text: 'Quote-backed troponin management summary: learners should not improvise isolated troponin cutoffs; they should follow the institution-specific pathway for sampling, repeat testing, ECG integration, and risk classification.',
    quote: 'should implement a CDP that includes a protocol for troponin sampling',
    locator: {
      section_heading: 'Patients With Acute Chest Pain and Suspected ACS',
      search_phrase: 'should implement a CDP that includes a protocol for troponin sampling'
    }
  },
  {
    id: 'quote_troponin_low_risk_disposition_009',
    source_id: 'aha_acc_chest_pain_slide_set_2021',
    section: 'Cardiovascular emergencies - High-sensitivity troponin pathway',
    topic_label: 'High-sensitivity troponin pathway',
    facet_id: 'disposition_reassessment',
    topic_tags: ['cardiovascular', 'chest_pain', 'syncope', 'high_sensitivity_troponin_pathway'],
    task_tags: ['reassessment', 'sbar', 'management', 'tutor', 'debrief'],
    citation_label: 'QB-TROPONIN-S09',
    query_phrase: 'high sensitivity troponin low risk disposition serial troponin 99th percentile HEART pathway',
    clinical_rule: 'Disposition after troponin testing should depend on pathway risk, ECG findings, serial values, and the assay threshold rather than one negative result alone.',
    text: 'Quote-backed troponin disposition summary: learners should reassess whether serial troponin results and ECG findings meet a validated low-risk pathway before discharge, or require observation/escalation when risk remains intermediate or high.',
    quote: 'initial and serial cTn/hs-cTn < assay 99th percentile',
    locator: {
      section_heading: 'Definition Used for Low-Risk Patients With Chest Pain',
      search_phrase: 'initial and serial cTn/hs-cTn < assay 99th percentile'
    }
  },
  {
    id: 'quote_nste_high_risk_recognition_006',
    source_id: 'aha_acc_chest_pain_slide_set_2021',
    section: 'Cardiovascular emergencies - Non-ST elevation ACS',
    topic_label: 'Non-ST elevation ACS',
    facet_id: 'recognition',
    topic_tags: ['cardiovascular', 'chest_pain', 'syncope', 'non_st_elevation_acs'],
    task_tags: ['triage', 'diagnosis', 'management', 'tutor', 'debrief'],
    citation_label: 'QB-NSTE-R06',
    query_phrase: 'NSTE ACS recognition ischemic ECG troponin confirmed myocardial injury high risk',
    clinical_rule: 'NSTE-ACS concern should rise when symptoms align with ischemic ECG changes or troponin-confirmed myocardial injury.',
    text: 'Quote-backed NSTE-ACS recognition summary: learners should escalate from generic chest pain to ACS reasoning when ischemic ECG changes, troponin-confirmed injury, hemodynamic instability, or high-risk pathway scores appear.',
    quote: 'new ischemic changes on electrocardiography, troponin-confirmed acute myocardial injury',
    locator: {
      section_heading: 'High-Risk Patients With Acute Chest Pain',
      search_phrase: 'new ischemic changes on electrocardiography, troponin-confirmed acute myocardial injury'
    }
  },
  {
    id: 'quote_nste_risk_strata_assessment_007',
    source_id: 'aha_acc_chest_pain_slide_set_2021',
    section: 'Cardiovascular emergencies - Non-ST elevation ACS',
    topic_label: 'Non-ST elevation ACS',
    facet_id: 'focused_assessment',
    topic_tags: ['cardiovascular', 'chest_pain', 'syncope', 'non_st_elevation_acs'],
    task_tags: ['diagnosis', 'management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-NSTE-A07',
    query_phrase: 'NSTE ACS focused assessment clinical decision pathway risk strata low intermediate high risk',
    clinical_rule: 'Focused NSTE-ACS assessment should place the patient into a pathway risk stratum using symptoms, ECG, troponin, and clinical risk features.',
    text: 'Quote-backed NSTE-ACS assessment summary: learners should report ischemic features, ECG status, serial troponin pattern, known CAD, instability, and pathway risk stratum before choosing observation, admission, or invasive evaluation.',
    quote: 'clinical decision pathways (CDPs) should categorize patients',
    locator: {
      section_heading: 'Patients With Acute Chest Pain and Suspected ACS',
      search_phrase: 'clinical decision pathways (CDPs) should categorize patients'
    }
  },
  {
    id: 'quote_nste_serial_ecg_diagnostics_008',
    source_id: 'aha_acc_chest_pain_slide_set_2021',
    section: 'Cardiovascular emergencies - Non-ST elevation ACS',
    topic_label: 'Non-ST elevation ACS',
    facet_id: 'diagnostic_strategy',
    topic_tags: ['cardiovascular', 'chest_pain', 'syncope', 'non_st_elevation_acs'],
    task_tags: ['diagnosis', 'management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-NSTE-D08',
    query_phrase: 'NSTE ACS diagnostic strategy nondiagnostic initial ECG serial ECGs posterior MI leads',
    clinical_rule: 'NSTE-ACS diagnostic strategy should use serial or supplemental ECG evaluation when suspicion remains despite a nondiagnostic initial ECG.',
    text: 'Quote-backed NSTE-ACS diagnostic summary: a nondiagnostic initial ECG does not end ACS evaluation when suspicion remains; learners should plan serial ECGs, troponin pathway testing, and selected posterior lead evaluation.',
    quote: 'serial ECGs to detect potential',
    locator: {
      section_heading: 'Recommendations for Electrocardiogram',
      search_phrase: 'serial ECGs to detect potential'
    }
  },
  {
    id: 'quote_nste_high_risk_disposition_009',
    source_id: 'aha_acc_chest_pain_slide_set_2021',
    section: 'Cardiovascular emergencies - Non-ST elevation ACS',
    topic_label: 'Non-ST elevation ACS',
    facet_id: 'disposition_reassessment',
    topic_tags: ['cardiovascular', 'chest_pain', 'syncope', 'non_st_elevation_acs'],
    task_tags: ['reassessment', 'sbar', 'management', 'tutor', 'debrief'],
    citation_label: 'QB-NSTE-S09',
    query_phrase: 'NSTE ACS disposition high risk invasive coronary angiography recommended',
    clinical_rule: 'High-risk suspected ACS requires escalation planning, often including invasive coronary angiography rather than discharge or routine outpatient follow-up.',
    text: 'Quote-backed NSTE-ACS disposition summary: learners should reassess whether ACS risk is high enough for urgent cardiology escalation and invasive evaluation, especially with ischemic ECG changes, positive troponin, or instability.',
    quote: 'acute chest pain and suspected ACS who are designated as high risk',
    locator: {
      section_heading: 'High-Risk Patients With Acute Chest Pain',
      search_phrase: 'acute chest pain and suspected ACS who are designated as high risk'
    }
  },
  {
    id: 'quote_opioid_naloxone_reversal_001',
    source_id: 'cdc_overdose_response_2024',
    section: 'Toxicology and substance use - Opioid overdose',
    topic_label: 'Opioid overdose',
    facet_id: 'medication_procedure',
    topic_tags: ['toxicology', 'overdose', 'substance_use', 'opioid_overdose'],
    task_tags: ['management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-OPIOID-P01',
    query_phrase: 'opioid overdose naloxone respiratory depression reversal',
    clinical_rule: 'Suspected opioid overdose with respiratory depression should prioritize naloxone and ventilatory support.',
    text: 'Quote-backed opioid overdose management summary: when respiratory depression suggests opioid toxicity, naloxone is the reversal medication anchor, but airway, ventilation, and EMS or ED monitoring remain part of the plan.',
    quote: 'Naloxone is a life-saving medication',
    locator: {
      section_heading: 'Lifesaving naloxone',
      search_phrase: 'Naloxone is a life-saving medication'
    }
  },
  {
    id: 'quote_opioid_administer_reversal_002',
    source_id: 'cdc_overdose_response_2024',
    section: 'Toxicology and substance use - Opioid overdose',
    topic_label: 'Opioid overdose',
    facet_id: 'initial_management',
    topic_tags: ['toxicology', 'overdose', 'substance_use', 'opioid_overdose'],
    task_tags: ['management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-OPIOID-M02',
    query_phrase: 'opioid overdose administer naloxone overdose reversal medication',
    clinical_rule: 'Do not make opioid overdose management only observational; give an overdose reversal medication when available.',
    text: 'Quote-backed opioid overdose management summary: suspected opioid overdose with depressed breathing should prompt reversal medication, airway positioning, assisted ventilation when needed, and urgent reassessment.',
    quote: 'Administer an overdose reversal medication like naloxone',
    locator: {
      section_heading: 'Responding to overdose',
      search_phrase: 'Administer an overdose reversal medication like naloxone'
    }
  },
  {
    id: 'quote_opioid_call_ems_003',
    source_id: 'cdc_overdose_response_2024',
    section: 'Toxicology and substance use - Naloxone response and recurrence',
    topic_label: 'Naloxone response and recurrence',
    facet_id: 'disposition_reassessment',
    topic_tags: ['toxicology', 'overdose', 'substance_use', 'naloxone_response_and_recurrence'],
    task_tags: ['reassessment', 'management', 'sbar', 'tutor', 'debrief'],
    citation_label: 'QB-OPIOID-S03',
    query_phrase: 'opioid overdose recurrence naloxone call 911 observation',
    clinical_rule: 'Response to naloxone does not remove the need for emergency evaluation and recurrence monitoring.',
    text: 'Quote-backed opioid overdose reassessment summary: after naloxone response, continue emergency evaluation because sedation or respiratory depression can recur, especially with long-acting opioids or co-ingestants.',
    quote: 'call 911',
    locator: {
      section_heading: 'Responding to overdose',
      search_phrase: 'call 911'
    }
  },
  {
    id: 'quote_opioid_breathing_support_004',
    source_id: 'cdc_overdose_response_2024',
    section: 'Toxicology and substance use - Opioid overdose',
    topic_label: 'Opioid overdose',
    facet_id: 'focused_assessment',
    topic_tags: ['toxicology', 'overdose', 'substance_use', 'opioid_overdose'],
    task_tags: ['diagnosis', 'management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-OPIOID-A04',
    query_phrase: 'opioid overdose respiratory depression breathing assessment naloxone',
    clinical_rule: 'Focused overdose assessment should track wakefulness and breathing, not just drug exposure history.',
    text: 'Quote-backed opioid overdose assessment summary: evaluate arousal, respiratory rate and effort, oxygenation, airway protection, recurrence after naloxone, and co-ingestion risks before disposition.',
    quote: 'Try to keep the person awake and breathing',
    locator: {
      section_heading: 'Responding to overdose',
      search_phrase: 'Try to keep the person awake and breathing'
    }
  },
  {
    id: 'quote_opioid_positioning_005',
    source_id: 'cdc_overdose_response_2024',
    section: 'Toxicology and substance use - Opioid overdose',
    topic_label: 'Opioid overdose',
    facet_id: 'initial_management',
    topic_tags: ['toxicology', 'overdose', 'substance_use', 'opioid_overdose'],
    task_tags: ['management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-OPIOID-M05',
    query_phrase: 'opioid overdose airway recovery position choking prevention',
    clinical_rule: 'Initial overdose care includes airway-protective positioning while naloxone and ventilatory support are arranged.',
    text: 'Quote-backed opioid overdose management summary: protect the airway during altered mental status by positioning the patient safely, supporting breathing, giving naloxone when indicated, and reassessing response.',
    quote: 'Lay the person on their side to prevent choking',
    locator: {
      section_heading: 'Responding to overdose',
      search_phrase: 'Lay the person on their side to prevent choking'
    }
  },
  {
    id: 'quote_opioid_signs_recognition_006',
    source_id: 'cdc_overdose_response_2024',
    section: 'Toxicology and substance use - Opioid overdose',
    topic_label: 'Opioid overdose',
    facet_id: 'recognition',
    topic_tags: ['toxicology', 'overdose', 'substance_use', 'opioid_overdose'],
    task_tags: ['triage', 'diagnosis', 'management', 'tutor', 'debrief'],
    citation_label: 'QB-OPIOID-R06',
    query_phrase: 'opioid overdose recognition signs slow shallow breathing inability to awaken',
    clinical_rule: 'Opioid overdose recognition should focus on depressed consciousness, abnormal breathing, cyanosis, and pinpoint pupils rather than exposure history alone.',
    text: 'Quote-backed opioid overdose recognition summary: learners should identify overdose physiology from arousal, breathing, skin color, and pupils, then escalate immediately instead of waiting for a confirmed substance history.',
    quote: 'Recognizing the signs of opioid overdose can save a life',
    locator: {
      section_heading: 'Signs of overdose',
      search_phrase: 'Recognizing the signs of opioid overdose can save a life'
    }
  },
  {
    id: 'quote_opioid_uncertain_treat_007',
    source_id: 'cdc_overdose_response_2024',
    section: 'Toxicology and substance use - Opioid overdose',
    topic_label: 'Opioid overdose',
    facet_id: 'diagnostic_strategy',
    topic_tags: ['toxicology', 'overdose', 'substance_use', 'opioid_overdose'],
    task_tags: ['diagnosis', 'management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-OPIOID-D07',
    query_phrase: 'suspected opioid overdose diagnostic uncertainty treat as overdose naloxone breathing',
    clinical_rule: 'When overdose is plausible and the patient is unstable, diagnostic uncertainty should not delay naloxone, airway support, and emergency escalation.',
    text: 'Quote-backed opioid overdose diagnostic summary: if depressed mental status and abnormal breathing make overdose plausible, treat the presentation while continuing a broad differential and reassessment for mimics or co-ingestants.',
    quote: "If you aren't sure, treat it like an overdose",
    locator: {
      section_heading: 'Steps to take',
      search_phrase: "If you aren't sure, treat it like an overdose"
    }
  },
  {
    id: 'quote_opioid_stay_until_help_008',
    source_id: 'cdc_overdose_response_2024',
    section: 'Toxicology and substance use - Opioid overdose',
    topic_label: 'Opioid overdose',
    facet_id: 'disposition_reassessment',
    topic_tags: ['toxicology', 'overdose', 'substance_use', 'opioid_overdose'],
    task_tags: ['reassessment', 'management', 'sbar', 'tutor', 'debrief'],
    citation_label: 'QB-OPIOID-S08',
    query_phrase: 'opioid overdose reassessment stay with patient emergency assistance disposition',
    clinical_rule: 'Opioid overdose disposition requires continued observation and emergency handoff; initial response is not a discharge decision.',
    text: 'Quote-backed opioid overdose reassessment summary: after naloxone or supportive care, continue observation of breathing and alertness, reassess for recurrence or co-ingestants, and hand off to emergency care.',
    quote: 'Stay with the person until emergency assistance arrives',
    locator: {
      section_heading: 'Steps to take',
      search_phrase: 'Stay with the person until emergency assistance arrives'
    }
  },
  {
    id: 'quote_naloxone_temporary_recognition_006',
    source_id: 'samhsa_opioid_overdose_reversal_2025',
    section: 'Toxicology and substance use - Naloxone response and recurrence',
    topic_label: 'Naloxone response and recurrence',
    facet_id: 'recognition',
    topic_tags: ['toxicology', 'overdose', 'substance_use', 'naloxone_response_and_recurrence'],
    task_tags: ['triage', 'diagnosis', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-NALOXONE-R06',
    query_phrase: 'naloxone response recurrence temporary treatment effects do not last long',
    clinical_rule: 'Improvement after naloxone is temporary evidence of response, not proof that recurrence risk or disposition risk has resolved.',
    text: 'Quote-backed naloxone recurrence recognition summary: a patient who wakes or breathes better after naloxone still needs monitoring because naloxone is temporary and opioid effects may outlast it.',
    quote: 'naloxone is a temporary treatment and its effects do not last long',
    locator: {
      section_heading: 'What Is Naloxone?',
      search_phrase: 'naloxone is a temporary treatment and its effects do not last long'
    }
  },
  {
    id: 'quote_naloxone_breathing_assessment_007',
    source_id: 'samhsa_opioid_overdose_reversal_2025',
    section: 'Toxicology and substance use - Naloxone response and recurrence',
    topic_label: 'Naloxone response and recurrence',
    facet_id: 'focused_assessment',
    topic_tags: ['toxicology', 'overdose', 'substance_use', 'naloxone_response_and_recurrence'],
    task_tags: ['diagnosis', 'management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-NALOXONE-A07',
    query_phrase: 'naloxone response reassessment breathing very slow stopped respiratory monitoring',
    clinical_rule: 'Focused reassessment after naloxone should repeatedly check breathing quality, respiratory rate, oxygenation, and airway protection.',
    text: 'Quote-backed naloxone response assessment summary: monitor whether breathing normalizes after naloxone and whether respiratory depression returns, alongside mental status, oxygenation, airway protection, and co-ingestant risk.',
    quote: 'Breathing is not normal, very slow, or has stopped',
    locator: {
      section_heading: 'Signs of opioid overdose',
      search_phrase: 'Breathing is not normal, very slow, or has stopped'
    }
  },
  {
    id: 'quote_naloxone_wakefulness_strategy_008',
    source_id: 'samhsa_opioid_overdose_reversal_2025',
    section: 'Toxicology and substance use - Naloxone response and recurrence',
    topic_label: 'Naloxone response and recurrence',
    facet_id: 'diagnostic_strategy',
    topic_tags: ['toxicology', 'overdose', 'substance_use', 'naloxone_response_and_recurrence'],
    task_tags: ['diagnosis', 'management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-NALOXONE-D08',
    query_phrase: 'naloxone response diagnostic strategy wakefulness touch voice repeat assessment',
    clinical_rule: 'Naloxone response should be interpreted with repeated wakefulness and respiratory assessments, not a single moment of arousal.',
    text: 'Quote-backed naloxone response diagnostic summary: use response to touch or voice, breathing trajectory, oxygenation, and recurrence after treatment to refine overdose versus mimic reasoning.',
    quote: 'Person does not wake or respond to touch or voice',
    locator: {
      section_heading: 'Signs of opioid overdose',
      search_phrase: 'Person does not wake or respond to touch or voice'
    }
  },
  {
    id: 'quote_naloxone_medical_help_009',
    source_id: 'samhsa_opioid_overdose_reversal_2025',
    section: 'Toxicology and substance use - Naloxone response and recurrence',
    topic_label: 'Naloxone response and recurrence',
    facet_id: 'initial_management',
    topic_tags: ['toxicology', 'overdose', 'substance_use', 'naloxone_response_and_recurrence'],
    task_tags: ['management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-NALOXONE-M09',
    query_phrase: 'naloxone response initial management obtain medical assistance recurrence monitoring',
    clinical_rule: 'After giving naloxone or another OORM, obtain medical assistance promptly and continue monitoring rather than treating response as definitive stabilization.',
    text: 'Quote-backed naloxone response management summary: initial improvement should trigger ongoing observation, emergency evaluation, repeat support when needed, and attention to withdrawal, recurrence, and co-ingestants.',
    quote: 'Medical assistance must be obtained as soon as possible',
    locator: {
      section_heading: 'Side Effects of OORMS',
      search_phrase: 'Medical assistance must be obtained as soon as possible'
    }
  },
  {
    id: 'quote_peds_fever_population_001',
    source_id: 'aap_febrile_infant',
    section: 'Pediatrics - Febrile infant 8 to 21 days',
    topic_label: 'Febrile infant 8 to 21 days',
    facet_id: 'recognition',
    topic_tags: ['pediatrics', 'fever', 'pals', 'febrile_infant_8_to_21_days'],
    task_tags: ['triage', 'diagnosis', 'tutor', 'debrief'],
    citation_label: 'QB-FEVER-R01',
    query_phrase: 'febrile infant 8 to 21 days well appearing term infant',
    clinical_rule: 'Apply the AAP febrile infant pathway to otherwise well-appearing infants in the specified young-infant age range, with local protocol handling guideline exclusions.',
    text: 'Quote-backed pediatric fever recognition summary: the 8-to-21-day otherwise well-appearing febrile infant is a distinct high-risk pathway; do not blend it with older-child fever or benign viral screening logic.',
    quote: 'otherwise well-appearing infants between 8-60 days old',
    locator: {
      section_heading: 'AAP infant fever clinical practice guideline',
      search_phrase: 'otherwise well-appearing infants between 8-60 days old'
    }
  },
  {
    id: 'quote_peds_fever_age_groups_002',
    source_id: 'aap_febrile_infant',
    section: 'Pediatrics - Febrile infant 8 to 21 days',
    topic_label: 'Febrile infant 8 to 21 days',
    facet_id: 'diagnostic_strategy',
    topic_tags: ['pediatrics', 'fever', 'pals', 'febrile_infant_8_to_21_days'],
    task_tags: ['triage', 'diagnosis', 'management', 'tutor', 'debrief'],
    citation_label: 'QB-FEVER-D02',
    query_phrase: 'febrile infant 8 21 days risk age group management',
    clinical_rule: 'Risk stratification for febrile infants should follow the age band rather than a generic pediatric fever rule.',
    text: 'Quote-backed pediatric fever diagnostic summary: infants 8 to 21 days old require age-specific evaluation and management because the guideline separates them from 22-to-28 and 29-to-60-day infants.',
    quote: 'recommendations are provided for 3 age groups',
    locator: {
      section_heading: 'AAP infant fever overview',
      search_phrase: 'recommendations are provided for 3 age groups'
    }
  },
  {
    id: 'quote_peds_fever_age_band_003',
    source_id: 'aap_febrile_infant',
    section: 'Pediatrics - Febrile infant 8 to 21 days',
    topic_label: 'Febrile infant 8 to 21 days',
    facet_id: 'focused_assessment',
    topic_tags: ['pediatrics', 'fever', 'pals', 'febrile_infant_8_to_21_days'],
    task_tags: ['triage', 'diagnosis', 'tutor', 'debrief'],
    citation_label: 'QB-FEVER-A03',
    query_phrase: 'febrile infant 8-21 days 22-28 29-60 age groups',
    clinical_rule: 'When documenting febrile infant reasoning, name the exact age band because recommendations differ by days of life.',
    text: 'Quote-backed febrile infant assessment summary: confirm exact age in days, appearance, gestational history, documented fever, prior care, and infection risk before selecting the pathway.',
    quote: '8-21 days, 22-28 days, and 29-60 days of age',
    locator: {
      section_heading: 'AAP age-group recommendations',
      search_phrase: '8-21 days, 22-28 days, and 29-60 days of age'
    }
  },
  {
    id: 'quote_peds_fever_presenting_fever_004',
    source_id: 'aap_febrile_infant',
    section: 'Pediatrics - Febrile infant 8 to 21 days',
    topic_label: 'Febrile infant 8 to 21 days',
    facet_id: 'recognition',
    topic_tags: ['pediatrics', 'fever', 'pals', 'febrile_infant_8_to_21_days'],
    task_tags: ['triage', 'diagnosis', 'tutor', 'debrief'],
    citation_label: 'QB-FEVER-R04',
    query_phrase: 'young infants presenting with fever serious bacterial infection risk',
    clinical_rule: 'A young infant presenting with fever should be treated as a serious infection risk until age-specific evaluation supports otherwise.',
    text: 'Quote-backed pediatric fever recognition summary: fever in a young infant is not a low-acuity complaint; triage should elevate concern for serious bacterial infection and pathway-based evaluation.',
    quote: 'young infants presenting with fever',
    locator: {
      section_heading: 'AAP infant fever overview',
      search_phrase: 'young infants presenting with fever'
    }
  },
  {
    id: 'quote_peds_fever_standardize_005',
    source_id: 'aap_febrile_infant',
    section: 'Pediatrics - Febrile infant 8 to 21 days',
    topic_label: 'Febrile infant 8 to 21 days',
    facet_id: 'teaching_handoff',
    topic_tags: ['pediatrics', 'fever', 'pals', 'febrile_infant_8_to_21_days'],
    task_tags: ['sbar', 'tutor', 'debrief'],
    citation_label: 'QB-FEVER-H05',
    query_phrase: 'febrile infant 8 to 21 days handoff sepsis evaluation standardize care',
    clinical_rule: 'Handoff for febrile infants should explicitly state the age band and sepsis evaluation pathway.',
    text: 'Quote-backed pediatric fever handoff summary: communicate age in days, fever source, appearance, cultures or lumbar puncture status when relevant, antibiotics, and disposition plan using a standardized pathway.',
    quote: 'standardize care for young infants presenting with fever',
    locator: {
      section_heading: 'REVISE febrile infant quality initiative',
      search_phrase: 'standardize care for young infants presenting with fever'
    }
  },
  {
    id: 'quote_peds_fever_initial_treatment_006',
    source_id: 'aap_febrile_infant',
    section: 'Pediatrics - Febrile infant 8 to 21 days',
    topic_label: 'Febrile infant 8 to 21 days',
    facet_id: 'initial_management',
    topic_tags: ['pediatrics', 'fever', 'pals', 'febrile_infant_8_to_21_days'],
    task_tags: ['management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-FEVER-M06',
    query_phrase: 'febrile infant 8 to 21 days initial treatment cultures antibiotics hospitalization',
    clinical_rule: 'Initial management for febrile infants should explicitly follow the age-group action statements and include treatment planning, not only diagnostic testing.',
    text: 'Quote-backed febrile infant management summary: for 8-to-21-day infants, initial management should pair urine, blood, inflammatory marker, and CSF evaluation with pathway-based initial treatment and early pediatric escalation.',
    quote: 'one with initial treatment',
    locator: {
      section_heading: 'AAP Recommendations',
      search_phrase: 'one with initial treatment'
    }
  },
  {
    id: 'quote_peds_fever_further_management_007',
    source_id: 'aap_febrile_infant',
    section: 'Pediatrics - Febrile infant 8 to 21 days',
    topic_label: 'Febrile infant 8 to 21 days',
    facet_id: 'disposition_reassessment',
    topic_tags: ['pediatrics', 'fever', 'pals', 'febrile_infant_8_to_21_days'],
    task_tags: ['reassessment', 'sbar', 'tutor', 'debrief'],
    citation_label: 'QB-FEVER-S07',
    query_phrase: 'febrile infant 8 to 21 days hospitalization home cessation of treatment disposition reassessment',
    clinical_rule: 'Disposition for febrile infants should be an explicit pathway decision about hospitalization versus home management and when treatment can stop.',
    text: 'Quote-backed febrile infant disposition summary: disposition is not generic reassurance; the AAP pathway separates hospitalization versus home management and cessation of treatment after reassessment and result review.',
    quote: 'hospitalization vs. home; cessation of treatment',
    locator: {
      section_heading: 'AAP Recommendations',
      search_phrase: 'hospitalization vs. home; cessation of treatment'
    }
  },
  {
    id: 'quote_stroke_alteplase_timing_001',
    source_id: 'asa_quick_stroke_treatment_2026',
    section: 'Neurologic emergencies - Thrombolytic eligibility discussion',
    topic_label: 'Thrombolytic eligibility discussion',
    facet_id: 'initial_management',
    topic_tags: ['neurology', 'stroke', 'seizure', 'thrombolytic_eligibility_discussion'],
    task_tags: ['management', 'diagnosis', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-STROKE-M01',
    query_phrase: 'acute stroke thrombolytic eligibility discussion 4.5 hours alteplase tenecteplase',
    clinical_rule: 'For potential acute ischemic stroke, thrombolysis decisions are time-sensitive and should start as soon as eligibility is plausible.',
    text: 'Quote-backed stroke management summary: suspected ischemic stroke requires rapid last-known-well assessment, neurologic exam, glucose check, imaging, contraindication review, and urgent thrombolysis discussion when eligible.',
    quote: 'If administered within 4.5 hours alteplase or tenecteplase may improve',
    locator: {
      section_heading: 'Medical Therapies',
      search_phrase: 'If administered within 4.5 hours alteplase or tenecteplase may improve'
    }
  },
  {
    id: 'quote_stroke_imaging_002',
    source_id: 'asa_stroke_diagnosis_2023',
    section: 'Neurologic emergencies - Thrombolytic eligibility discussion',
    topic_label: 'Thrombolytic eligibility discussion',
    facet_id: 'diagnostic_strategy',
    topic_tags: ['neurology', 'stroke', 'seizure', 'thrombolytic_eligibility_discussion'],
    task_tags: ['diagnosis', 'management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-STROKE-D02',
    query_phrase: 'acute stroke diagnosis CT MRI scans brain imaging treatment eligibility',
    clinical_rule: 'Brain imaging is a required early diagnostic dependency before definitive thrombolysis decisions.',
    text: 'Quote-backed stroke diagnostic summary: activate imaging early for suspected acute ischemic stroke because hemorrhage exclusion and treatment eligibility depend on rapid neuroimaging.',
    quote: 'CT or MRI scans',
    locator: {
      section_heading: 'Common Diagnosis Methods - Tests',
      search_phrase: 'CT or MRI scans'
    }
  },
  {
    id: 'quote_stroke_diagnosis_003',
    source_id: 'asa_stroke_symptoms_2026',
    section: 'Neurologic emergencies - Acute stroke symptoms',
    topic_label: 'Acute stroke symptoms',
    facet_id: 'recognition',
    topic_tags: ['neurology', 'stroke', 'seizure', 'acute_stroke_symptoms'],
    task_tags: ['triage', 'diagnosis', 'management', 'tutor', 'debrief'],
    citation_label: 'QB-STROKE-R03',
    query_phrase: 'acute stroke recognition BE FAST warning signs stroke symptoms',
    clinical_rule: 'Stroke recognition should rapidly separate possible acute ischemic stroke from mimics while preserving treatment time.',
    text: 'Quote-backed stroke recognition summary: focal neurologic deficit, sudden onset, speech or vision change, and stroke mimic checks should feed rapid imaging and treatment eligibility workflows.',
    quote: 'B.E. F.A.S.T. warning signs of stroke',
    locator: {
      section_heading: 'B.E. F.A.S.T. Warning Signs of Stroke',
      search_phrase: 'B.E. F.A.S.T. warning signs of stroke'
    }
  },
  {
    id: 'quote_stroke_symptom_time_assessment_006',
    source_id: 'asa_stroke_symptoms_2026',
    section: 'Neurologic emergencies - Acute stroke symptoms',
    topic_label: 'Acute stroke symptoms',
    facet_id: 'focused_assessment',
    topic_tags: ['neurology', 'stroke', 'seizure', 'acute_stroke_symptoms'],
    task_tags: ['triage', 'diagnosis', 'management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-STROKE-A06',
    query_phrase: 'acute stroke focused assessment last known well symptom onset time BE FAST',
    clinical_rule: 'Focused acute stroke assessment should document symptom onset or last-known-well time while checking B.E. F.A.S.T. deficits and mimics.',
    text: 'Quote-backed acute stroke assessment summary: suspected stroke requires immediate deficit screen, exact symptom-onset timing, glucose or mimic checks, anticoagulant history, baseline function, and early escalation.',
    quote: "Check the time so you'll know when the first symptoms appeared",
    locator: {
      section_heading: 'Stroke Symptoms - TIA warning signs',
      search_phrase: "Check the time so you'll know when the first symptoms appeared"
    }
  },
  {
    id: 'quote_stroke_ct_mri_diagnostic_007',
    source_id: 'asa_stroke_diagnosis_2023',
    section: 'Neurologic emergencies - Acute stroke symptoms',
    topic_label: 'Acute stroke symptoms',
    facet_id: 'diagnostic_strategy',
    topic_tags: ['neurology', 'stroke', 'seizure', 'acute_stroke_symptoms'],
    task_tags: ['diagnosis', 'management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-STROKE-D07',
    query_phrase: 'acute stroke diagnostic strategy CT MRI brain imaging symptoms TIA',
    clinical_rule: 'Acute stroke diagnostic strategy should include brain imaging, usually CT or MRI, plus targeted history, neurologic exam, labs, and additional tests when needed.',
    text: 'Quote-backed acute stroke diagnostic summary: learners should connect stroke symptoms to urgent CT or MRI brain imaging, neurologic examination, labs, and tests that determine stroke type and treatment eligibility.',
    quote: 'CT or MRI scans',
    locator: {
      section_heading: 'Common Diagnosis Methods - Tests',
      search_phrase: 'CT or MRI scans'
    }
  },
  {
    id: 'quote_stroke_immediate_treatment_008',
    source_id: 'asa_quick_stroke_treatment_2026',
    section: 'Neurologic emergencies - Acute stroke symptoms',
    topic_label: 'Acute stroke symptoms',
    facet_id: 'initial_management',
    topic_tags: ['neurology', 'stroke', 'seizure', 'acute_stroke_symptoms'],
    task_tags: ['management', 'diagnosis', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-STROKE-M08',
    query_phrase: 'acute stroke initial management immediate treatment minimize long term effects prevent death',
    clinical_rule: 'Initial management for suspected acute stroke should prioritize rapid stroke-pathway activation because treatment delays worsen outcomes.',
    text: 'Quote-backed acute stroke management summary: activate a stroke pathway, protect airway and circulation, check glucose, obtain urgent imaging, preserve treatment windows, and involve stroke expertise early.',
    quote: 'Immediate treatment may minimize the long-term effects of a stroke and prevent death',
    locator: {
      section_heading: 'Quick Stroke Treatment Can Save Lives',
      search_phrase: 'Immediate treatment may minimize the long-term effects of a stroke and prevent death'
    }
  },
  {
    id: 'quote_stroke_resolved_symptoms_009',
    source_id: 'asa_stroke_symptoms_2026',
    section: 'Neurologic emergencies - Acute stroke symptoms',
    topic_label: 'Acute stroke symptoms',
    facet_id: 'disposition_reassessment',
    topic_tags: ['neurology', 'stroke', 'seizure', 'acute_stroke_symptoms'],
    task_tags: ['reassessment', 'sbar', 'triage', 'tutor', 'debrief'],
    citation_label: 'QB-STROKE-S09',
    query_phrase: 'acute stroke symptoms resolved TIA call 911 urgent evaluation reassessment',
    clinical_rule: 'Resolved stroke-like symptoms still require urgent evaluation because TIA and transient deficits can precede disabling stroke.',
    text: 'Quote-backed acute stroke reassessment summary: improvement or transient symptoms should not justify low acuity discharge; reassess neurologic status, onset time, recurrence risk, imaging results, and stroke-team plan.',
    quote: 'Call 911 even if the symptoms go away',
    locator: {
      section_heading: 'Stroke Symptoms - TIA warning signs',
      search_phrase: 'Call 911 even if the symptoms go away'
    }
  },
  {
    id: 'quote_stroke_treatment_options_004',
    source_id: 'asa_quick_stroke_treatment_2026',
    section: 'Neurologic emergencies - Thrombolytic eligibility discussion',
    topic_label: 'Thrombolytic eligibility discussion',
    facet_id: 'medication_procedure',
    topic_tags: ['neurology', 'stroke', 'seizure', 'thrombolytic_eligibility_discussion'],
    task_tags: ['management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-STROKE-P04',
    query_phrase: 'acute stroke thrombolytic endovascular procedure treatment eligibility',
    clinical_rule: 'Stroke treatment planning should consider thrombolytic therapy and endovascular procedures when eligibility criteria are met.',
    text: 'Quote-backed stroke treatment summary: include thrombolytic eligibility, large-vessel occlusion screening, contraindications, transfer capability, and reassessment in acute stroke management.',
    quote: 'An endovascular procedure removes the clot',
    locator: {
      section_heading: 'Other Stroke Treatment Options',
      search_phrase: 'An endovascular procedure removes the clot'
    }
  },
  {
    id: 'quote_stroke_eligible_alteplase_005',
    source_id: 'asa_quick_stroke_treatment_2026',
    section: 'Neurologic emergencies - Thrombolytic eligibility discussion',
    topic_label: 'Thrombolytic eligibility discussion',
    facet_id: 'teaching_handoff',
    topic_tags: ['neurology', 'stroke', 'seizure', 'thrombolytic_eligibility_discussion'],
    task_tags: ['sbar', 'tutor', 'debrief'],
    citation_label: 'QB-STROKE-H05',
    query_phrase: 'stroke handoff treatment eligibility criteria transfer discussion',
    clinical_rule: 'Stroke handoff should state last-known-well, imaging status, contraindication screen, and whether rapid stroke-treatment eligibility or transfer is under discussion.',
    text: 'Quote-backed stroke handoff summary: report last-known-well time, deficits, glucose, anticoagulant status, imaging result, rapid treatment eligibility, transfer concern, and receiving-team needs.',
    quote: 'Patients must meet certain criteria to be eligible',
    locator: {
      section_heading: 'Other Stroke Treatment Options',
      search_phrase: 'Patients must meet certain criteria to be eligible'
    }
  },
  {
    id: 'quote_thrombolytic_befast_recognition_006',
    source_id: 'asa_stroke_symptoms_2026',
    section: 'Neurologic emergencies - Thrombolytic eligibility discussion',
    topic_label: 'Thrombolytic eligibility discussion',
    facet_id: 'recognition',
    topic_tags: ['neurology', 'stroke', 'seizure', 'thrombolytic_eligibility_discussion'],
    task_tags: ['triage', 'diagnosis', 'management', 'tutor', 'debrief'],
    citation_label: 'QB-STROKE-R06',
    query_phrase: 'thrombolytic eligibility stroke recognition BE FAST warning signs acute deficit',
    clinical_rule: 'Thrombolytic eligibility discussion begins with rapid recognition of possible stroke symptoms and immediate stroke pathway activation.',
    text: 'Quote-backed thrombolytic eligibility recognition summary: learners should recognize possible acute stroke from B.E. F.A.S.T. warning signs and avoid delaying eligibility assessment when focal deficits are present.',
    quote: 'Use the letters in B.E. F.A.S.T. to spot a stroke',
    locator: {
      section_heading: 'B.E. F.A.S.T. Warning Signs of Stroke',
      search_phrase: 'Use the letters in B.E. F.A.S.T. to spot a stroke'
    }
  },
  {
    id: 'quote_thrombolytic_time_assessment_007',
    source_id: 'asa_stroke_symptoms_2026',
    section: 'Neurologic emergencies - Thrombolytic eligibility discussion',
    topic_label: 'Thrombolytic eligibility discussion',
    facet_id: 'focused_assessment',
    topic_tags: ['neurology', 'stroke', 'seizure', 'thrombolytic_eligibility_discussion'],
    task_tags: ['triage', 'diagnosis', 'management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-STROKE-A07',
    query_phrase: 'thrombolytic eligibility focused assessment first symptoms appeared last known well time',
    clinical_rule: 'Focused thrombolytic assessment must document symptom onset or last-known-well time before eligibility decisions are framed.',
    text: 'Quote-backed thrombolytic eligibility assessment summary: document the first symptom time, last-known-well, current neurologic deficit, glucose or mimic concerns, anticoagulant history, baseline function, and contraindication screen.',
    quote: "Check the time so you'll know when the first symptoms appeared",
    locator: {
      section_heading: 'Stroke Symptoms - TIA warning signs',
      search_phrase: "Check the time so you'll know when the first symptoms appeared"
    }
  },
  {
    id: 'quote_thrombolytic_time_window_008',
    source_id: 'asa_quick_stroke_treatment_2026',
    section: 'Neurologic emergencies - Thrombolytic eligibility discussion',
    topic_label: 'Thrombolytic eligibility discussion',
    facet_id: 'disposition_reassessment',
    topic_tags: ['neurology', 'stroke', 'seizure', 'thrombolytic_eligibility_discussion'],
    task_tags: ['reassessment', 'sbar', 'management', 'tutor', 'debrief'],
    citation_label: 'QB-STROKE-S08',
    query_phrase: 'thrombolytic eligibility reassessment 4.5 hours alteplase tenecteplase transfer stroke team',
    clinical_rule: 'Disposition and reassessment for suspected ischemic stroke should preserve the thrombolytic time window and escalate or transfer when local capability cannot complete eligibility decisions rapidly.',
    text: 'Quote-backed thrombolytic eligibility disposition summary: reassess onset time, deficits, imaging status, contraindications, treatment window, thrombectomy concern, and transfer capability until the stroke team confirms treatment direction.',
    quote: 'If administered within 4.5 hours alteplase or tenecteplase may improve',
    locator: {
      section_heading: 'Medical Therapies',
      search_phrase: 'If administered within 4.5 hours alteplase or tenecteplase may improve'
    }
  },
  {
    id: 'quote_ectopic_rupture_bleeding_001',
    source_id: 'acog_ectopic_pregnancy',
    section: 'OB/GYN - Ectopic pregnancy rupture concern',
    topic_label: 'Ectopic pregnancy rupture concern',
    facet_id: 'recognition',
    topic_tags: ['ob_gyn', 'pregnancy', 'pelvic_pain', 'ectopic_pregnancy_rupture_concern'],
    task_tags: ['triage', 'diagnosis', 'management', 'tutor', 'debrief'],
    citation_label: 'QB-ECTOPIC-R01',
    query_phrase: 'ectopic pregnancy rupture pelvic pain bleeding unstable internal bleeding',
    clinical_rule: 'Ectopic pregnancy rupture is a life-threatening emergency and must be considered in early pregnancy pain or bleeding.',
    text: 'Quote-backed ectopic pregnancy recognition summary: early pregnancy with pelvic or abdominal pain, bleeding, syncope, shoulder pain, or instability should trigger rupture concern and urgent evaluation.',
    quote: 'A rupture can cause major internal bleeding',
    locator: {
      section_heading: 'What is ectopic pregnancy?',
      search_phrase: 'A rupture can cause major internal bleeding'
    }
  },
  {
    id: 'quote_ectopic_surgery_002',
    source_id: 'acog_ectopic_pregnancy',
    section: 'OB/GYN - Ectopic pregnancy rupture concern',
    topic_label: 'Ectopic pregnancy rupture concern',
    facet_id: 'initial_management',
    topic_tags: ['ob_gyn', 'pregnancy', 'pelvic_pain', 'ectopic_pregnancy_rupture_concern'],
    task_tags: ['management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-ECTOPIC-M02',
    query_phrase: 'ruptured ectopic pregnancy unstable emergency surgery management',
    clinical_rule: 'Suspected ruptured ectopic pregnancy with instability requires immediate surgical/OB escalation.',
    text: 'Quote-backed ectopic management summary: unstable early pregnancy pain or bleeding should prompt resuscitation, pregnancy testing, pelvic ultrasound when feasible, blood preparation, and emergent OB involvement.',
    quote: 'life-threatening emergency that needs immediate surgery',
    locator: {
      section_heading: 'What is ectopic pregnancy?',
      search_phrase: 'life-threatening emergency that needs immediate surgery'
    }
  },
  {
    id: 'quote_ectopic_ultrasound_003',
    source_id: 'acog_ectopic_pregnancy',
    section: 'OB/GYN - Ectopic pregnancy rupture concern',
    topic_label: 'Ectopic pregnancy rupture concern',
    facet_id: 'diagnostic_strategy',
    topic_tags: ['ob_gyn', 'pregnancy', 'pelvic_pain', 'ectopic_pregnancy_rupture_concern'],
    task_tags: ['diagnosis', 'management', 'tutor', 'debrief'],
    citation_label: 'QB-ECTOPIC-D03',
    query_phrase: 'ectopic pregnancy diagnosis ultrasound hCG pelvic pain bleeding',
    clinical_rule: 'Ultrasound is a core diagnostic dependency when ectopic pregnancy is suspected and the patient can undergo imaging.',
    text: 'Quote-backed ectopic diagnostic summary: use pregnancy testing, ultrasound, hCG trend, stability, and exam findings to distinguish ectopic pregnancy, pregnancy of unknown location, and other pelvic emergencies.',
    quote: 'Perform an ultrasound exam',
    locator: {
      section_heading: 'How is ectopic pregnancy diagnosed?',
      search_phrase: 'Perform an ultrasound exam'
    }
  },
  {
    id: 'quote_ectopic_hcg_004',
    source_id: 'acog_ectopic_pregnancy',
    section: 'OB/GYN - Ectopic pregnancy rupture concern',
    topic_label: 'Ectopic pregnancy rupture concern',
    facet_id: 'diagnostic_strategy',
    topic_tags: ['ob_gyn', 'pregnancy', 'pelvic_pain', 'ectopic_pregnancy_rupture_concern'],
    task_tags: ['diagnosis', 'management', 'tutor', 'debrief'],
    citation_label: 'QB-ECTOPIC-D04',
    query_phrase: 'ectopic pregnancy hCG blood test ultrasound diagnosis',
    clinical_rule: 'hCG testing is part of ectopic pregnancy evaluation and should be interpreted with imaging and clinical stability.',
    text: 'Quote-backed ectopic diagnostic summary: hCG results help structure follow-up and ultrasound interpretation, but instability or rupture concern should drive emergency escalation regardless of a single number.',
    quote: 'Test your blood for a pregnancy hormone called human chorionic gonadotropin (hCG)',
    locator: {
      section_heading: 'How is ectopic pregnancy diagnosed?',
      search_phrase: 'Test your blood for a pregnancy hormone called human chorionic gonadotropin'
    }
  },
  {
    id: 'quote_ectopic_treatment_options_005',
    source_id: 'acog_ectopic_pregnancy',
    section: 'OB/GYN - Ectopic pregnancy rupture concern',
    topic_label: 'Ectopic pregnancy rupture concern',
    facet_id: 'disposition_reassessment',
    topic_tags: ['ob_gyn', 'pregnancy', 'pelvic_pain', 'ectopic_pregnancy_rupture_concern'],
    task_tags: ['reassessment', 'sbar', 'tutor', 'debrief'],
    citation_label: 'QB-ECTOPIC-S05',
    query_phrase: 'ectopic pregnancy medication surgery follow up disposition',
    clinical_rule: 'Disposition for ectopic pregnancy depends on rupture risk, treatment pathway, stability, and ability to complete follow-up.',
    text: 'Quote-backed ectopic disposition summary: management may involve medication or surgery, but rupture concern, hemodynamics, hCG follow-up reliability, and OB plan determine whether discharge is safe.',
    quote: 'There are two methods used to treat an ectopic pregnancy',
    locator: {
      section_heading: 'How is ectopic pregnancy treated?',
      search_phrase: 'There are two methods used to treat an ectopic pregnancy'
    }
  },
  {
    id: 'quote_ectopic_risk_assessment_006',
    source_id: 'acog_ectopic_pregnancy',
    section: 'OB/GYN - Ectopic pregnancy rupture concern',
    topic_label: 'Ectopic pregnancy rupture concern',
    facet_id: 'focused_assessment',
    topic_tags: ['ob_gyn', 'pregnancy', 'pelvic_pain', 'ectopic_pregnancy_rupture_concern'],
    task_tags: ['triage', 'diagnosis', 'tutor', 'debrief'],
    citation_label: 'QB-ECTOPIC-A06',
    query_phrase: 'ectopic pregnancy focused assessment risk factors absence does not exclude pelvic pain bleeding early pregnancy',
    clinical_rule: 'Focused assessment should ask about early pregnancy symptoms, pelvic or abdominal pain, bleeding, rupture symptoms, and ectopic risk factors while remembering that no known risk factors does not exclude ectopic pregnancy.',
    text: 'Quote-backed ectopic focused assessment summary: ask about pregnancy possibility, bleeding, pelvic or abdominal pain, shoulder pain, syncope, fertility or pelvic infection history, and hemodynamic symptoms, but do not falsely reassure when known risk factors are absent.',
    quote: 'About one half of all women who have an ectopic pregnancy do not have known risk factors',
    locator: {
      section_heading: 'What are the risk factors for ectopic pregnancy?',
      search_phrase: 'About one half of all women who have an ectopic pregnancy do not have known risk factors'
    }
  },
  {
    id: 'quote_head_ct_decision_rule_001',
    source_id: 'acr_head_trauma',
    section: 'Imaging and procedures - Minor head injury CT decision',
    topic_label: 'Minor head injury CT decision',
    facet_id: 'diagnostic_strategy',
    topic_tags: ['imaging', 'procedures', 'ultrasound', 'minor_head_injury_ct_decision'],
    task_tags: ['diagnosis', 'management', 'tutor', 'debrief'],
    citation_label: 'QB-HEAD-D01',
    query_phrase: 'minor head injury CT decision clinical decision rule mild acute head trauma',
    clinical_rule: 'For adult mild head injury, use clinical decision-rule status and case-specific risk factors to support head CT decisions.',
    text: 'Quote-backed head trauma imaging summary: adult minor head injury CT decisions should use clinical decision-rule status plus case-specific factors such as anticoagulation, vomiting, neurologic deficit, and worsening symptoms.',
    quote: 'imaging not indicated by clinical decision rule',
    locator: {
      section_heading: 'Variant 1: Acute head trauma, mild',
      search_phrase: 'imaging not indicated by clinical decision rule'
    }
  },
  {
    id: 'quote_head_ct_decision_support_002',
    source_id: 'acr_head_trauma',
    section: 'Imaging and procedures - Minor head injury CT decision',
    topic_label: 'Minor head injury CT decision',
    facet_id: 'diagnostic_strategy',
    topic_tags: ['imaging', 'procedures', 'ultrasound', 'minor_head_injury_ct_decision'],
    task_tags: ['diagnosis', 'management', 'tutor', 'debrief'],
    citation_label: 'QB-HEAD-D02',
    query_phrase: 'minor head injury CT head without IV contrast appropriateness criteria',
    clinical_rule: 'Decision support should tie CT use to risk and variant-specific appropriateness rather than replacing clinical assessment for high-risk head injury features.',
    text: 'Quote-backed minor head injury diagnostic summary: CT decisions should not be generic; tie imaging to decision-rule status, neurologic status, anticoagulant use, vomiting, age, mechanism, and variant-specific appropriateness.',
    quote: 'CT head without IV contrast Usually Appropriate',
    locator: {
      section_heading: 'ACR Head Trauma variants',
      search_phrase: 'CT head without IV contrast Usually Appropriate'
    }
  },
  {
    id: 'quote_head_noncontrast_ct_003',
    source_id: 'acr_head_trauma',
    section: 'Imaging and procedures - Minor head injury CT decision',
    topic_label: 'Minor head injury CT decision',
    facet_id: 'diagnostic_strategy',
    topic_tags: ['imaging', 'procedures', 'ultrasound', 'minor_head_injury_ct_decision'],
    task_tags: ['diagnosis', 'management', 'tutor', 'debrief'],
    citation_label: 'QB-HEAD-D03',
    query_phrase: 'head trauma noncontrast CT initial examination minor mild acute closed head injury',
    clinical_rule: 'When neuroimaging is indicated after minor head injury, noncontrast head CT is the initial imaging reference standard.',
    text: 'Quote-backed head trauma imaging summary: if a minor head injury patient meets imaging criteria, choose noncontrast head CT as the initial test rather than unrelated imaging or broad workup.',
    quote: 'CT head without IV contrast Usually Appropriate',
    locator: {
      section_heading: 'ACR Appropriateness Criteria Head Trauma',
      search_phrase: 'CT head without IV contrast Usually Appropriate'
    }
  },
  {
    id: 'quote_head_ct_without_contrast_004',
    source_id: 'acr_head_trauma',
    section: 'Imaging and procedures - Minor head injury CT decision',
    topic_label: 'Minor head injury CT decision',
    facet_id: 'initial_management',
    topic_tags: ['imaging', 'procedures', 'ultrasound', 'minor_head_injury_ct_decision'],
    task_tags: ['management', 'diagnosis', 'tutor', 'debrief'],
    citation_label: 'QB-HEAD-M04',
    query_phrase: 'minor head injury CT head without IV contrast usually appropriate',
    clinical_rule: 'Head injury imaging plans should specify CT head without IV contrast when CT is indicated.',
    text: 'Quote-backed head trauma management summary: once imaging is indicated, order the correct initial modality, continue neurologic reassessment, and avoid anchoring on a normal exam if high-risk features evolve.',
    quote: 'CT head without IV contrast',
    locator: {
      section_heading: 'ACR Head Trauma variants',
      search_phrase: 'CT head without IV contrast'
    }
  },
  {
    id: 'quote_head_ct_usually_appropriate_005',
    source_id: 'acr_head_trauma',
    section: 'Imaging and procedures - Minor head injury CT decision',
    topic_label: 'Minor head injury CT decision',
    facet_id: 'recognition',
    topic_tags: ['imaging', 'procedures', 'ultrasound', 'minor_head_injury_ct_decision'],
    task_tags: ['triage', 'diagnosis', 'tutor', 'debrief'],
    citation_label: 'QB-HEAD-R05',
    query_phrase: 'head trauma CT usually appropriate high risk neurologic symptoms vomiting anticoagulated',
    clinical_rule: 'High-risk head injury features should move CT from optional background testing to an appropriate diagnostic action.',
    text: 'Quote-backed head trauma recognition summary: vomiting, neurologic symptoms, anticoagulation, dangerous mechanism, age risk, or deterioration should prompt a structured CT decision rather than reassurance alone.',
    quote: 'Usually appropriate',
    locator: {
      section_heading: 'ACR Head Trauma variants',
      search_phrase: 'CT head without IV contrast Usually appropriate'
    }
  },
  {
    id: 'quote_head_symptom_domains_006',
    source_id: 'cdc_mtbi_symptoms_2025',
    section: 'Imaging and procedures - Minor head injury CT decision',
    topic_label: 'Minor head injury CT decision',
    facet_id: 'focused_assessment',
    topic_tags: ['imaging', 'procedures', 'ultrasound', 'minor_head_injury_ct_decision'],
    task_tags: ['triage', 'diagnosis', 'tutor', 'debrief'],
    citation_label: 'QB-HEAD-A06',
    query_phrase: 'minor head injury focused assessment concussion symptoms feel think act sleep delayed worsening',
    clinical_rule: 'Focused assessment after minor head injury should track symptom domains, delayed evolution, neurologic danger signs, anticoagulant use, and whether symptoms are worsening.',
    text: 'Quote-backed minor head injury assessment summary: do not stop at whether CT is needed; assess physical, cognitive, emotional, and sleep symptoms, delayed symptom evolution, neurologic danger signs, anticoagulant or antiplatelet use, and reliable observation.',
    quote: 'Symptoms of mild TBI and concussion may affect how you feel, think, act or sleep',
    locator: {
      section_heading: 'Symptoms of Mild TBI and Concussion - Key Points',
      search_phrase: 'Symptoms of mild TBI and concussion may affect how you feel, think, act or sleep'
    }
  },
  {
    id: 'quote_head_symptom_guided_return_007',
    source_id: 'cdc_mtbi_return_activities_2025',
    section: 'Imaging and procedures - Minor head injury CT decision',
    topic_label: 'Minor head injury CT decision',
    facet_id: 'disposition_reassessment',
    topic_tags: ['imaging', 'procedures', 'ultrasound', 'minor_head_injury_ct_decision'],
    task_tags: ['reassessment', 'sbar', 'tutor', 'debrief'],
    citation_label: 'QB-HEAD-S07',
    query_phrase: 'minor head injury discharge safety return to activity symptoms exertion follow up reassessment',
    clinical_rule: 'Minor head injury discharge plans should include symptom-guided activity return, driving/work cautions, red-flag return precautions, follow-up, and reassessment if symptoms worsen or recur.',
    text: 'Quote-backed minor head injury disposition summary: after negative or unnecessary CT, discharge is still an active safety plan requiring red-flag precautions, follow-up, cautious return to driving/work/activity, and symptom-guided reassessment.',
    quote: 'Repeated evaluation of both symptoms and cognitive status is recommended',
    locator: {
      section_heading: 'Managing Return to Activities - Returning to work',
      search_phrase: 'Repeated evaluation of both symptoms and cognitive status is recommended'
    }
  },
  {
    id: 'quote_agitation_deescalation_001',
    source_id: 'acep_severe_agitation',
    section: 'Psychiatric and behavioral emergencies - Use of restraints',
    topic_label: 'Use of restraints',
    facet_id: 'initial_management',
    topic_tags: ['psychiatry', 'behavioral_health', 'safety', 'use_of_restraints'],
    task_tags: ['management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-AGITATION-M01',
    query_phrase: 'severe agitation restraints safety verbal de-escalation before restraints',
    clinical_rule: 'Use restraints only after safe de-escalation and treatment of reversible causes have been considered or attempted.',
    text: 'Quote-backed restraint management summary: start with staff safety, verbal de-escalation when safe, medical mimic assessment, and only then the least restrictive restraint needed for immediate safety.',
    quote: 'Verbal de-escalation should be considered',
    locator: {
      section_heading: 'ACEP severe agitation introduction',
      search_phrase: 'Verbal de-escalation should be considered'
    }
  },
  {
    id: 'quote_restraint_danger_recognition_002',
    source_id: 'acep_severe_agitation',
    section: 'Psychiatric and behavioral emergencies - Use of restraints',
    topic_label: 'Use of restraints',
    facet_id: 'recognition',
    topic_tags: ['psychiatry', 'behavioral_health', 'safety', 'use_of_restraints'],
    task_tags: ['triage', 'diagnosis', 'management', 'tutor', 'debrief'],
    citation_label: 'QB-RESTRAINT-R02',
    query_phrase: 'restraint recognition combative violent immediate danger staff severe agitation',
    clinical_rule: 'Restraint consideration should be tied to immediate danger and severe agitation, not convenience, frustration, or a psychiatric label alone.',
    text: 'Quote-backed restraint recognition summary: learners should recognize restraint decisions as safety-critical only when dangerous agitation creates immediate danger, while keeping medical illness and de-escalation needs in view.',
    quote: 'overtly combative, violent, immediate danger to staff',
    locator: {
      section_heading: 'ACEP severe agitation population',
      search_phrase: 'overtly combative, violent, immediate danger to staff'
    }
  },
  {
    id: 'quote_restraint_safety_assessment_003',
    source_id: 'acep_severe_agitation',
    section: 'Psychiatric and behavioral emergencies - Use of restraints',
    topic_label: 'Use of restraints',
    facet_id: 'focused_assessment',
    topic_tags: ['psychiatry', 'behavioral_health', 'safety', 'use_of_restraints'],
    task_tags: ['diagnosis', 'management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-RESTRAINT-A03',
    query_phrase: 'restraint focused assessment safety patient bystanders staff concern',
    clinical_rule: 'Before restraint or rapid medication, the learner should explicitly assess the safety threat to the patient, staff, and bystanders.',
    text: 'Quote-backed restraint assessment summary: document who is at risk, what de-escalation is possible, whether oral medication is safe, and what medical or toxicologic causes still need evaluation after immediate danger is controlled.',
    quote: 'where safety of the patient, bystanders, or staff is a concern',
    locator: {
      section_heading: 'ACEP severe agitation Level C recommendation',
      search_phrase: 'where safety of the patient, bystanders, or staff is a concern'
    }
  },
  {
    id: 'quote_restraint_medical_evaluation_004',
    source_id: 'acep_severe_agitation',
    section: 'Psychiatric and behavioral emergencies - Use of restraints',
    topic_label: 'Use of restraints',
    facet_id: 'diagnostic_strategy',
    topic_tags: ['psychiatry', 'behavioral_health', 'safety', 'use_of_restraints'],
    task_tags: ['diagnosis', 'management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-RESTRAINT-D04',
    query_phrase: 'restraint diagnostic strategy sedation facilitates medical evaluation agitated patient',
    clinical_rule: 'Restraint or sedation decisions should preserve the ability to evaluate serious underlying medical causes of agitation.',
    text: 'Quote-backed restraint diagnostic summary: restraint-safety planning should not end the diagnostic process; once immediate danger is controlled, the learner should reassess for delirium, intoxication, hypoxia, trauma, infection, and other medical mimics.',
    quote: 'Safe, adequate sedation facilitates medical evaluation of the acutely agitated patient',
    locator: {
      section_heading: 'ACEP severe agitation benefits',
      search_phrase: 'Safe, adequate sedation facilitates medical evaluation of the acutely agitated patient'
    }
  },
  {
    id: 'quote_restraint_reassessment_005',
    source_id: 'acep_severe_agitation',
    section: 'Psychiatric and behavioral emergencies - Use of restraints',
    topic_label: 'Use of restraints',
    facet_id: 'disposition_reassessment',
    topic_tags: ['psychiatry', 'behavioral_health', 'safety', 'use_of_restraints'],
    task_tags: ['reassessment', 'sbar', 'management', 'tutor', 'debrief'],
    citation_label: 'QB-RESTRAINT-S05',
    query_phrase: 'restraint reassessment avoid prolonged physical restraint isolation morbidity mortality',
    clinical_rule: 'After immediate safety control, reassess frequently and reduce or discontinue restraints as soon as safe to avoid prolonged restraint or isolation.',
    text: 'Quote-backed restraint reassessment summary: disposition planning should include repeated safety checks, airway and circulation monitoring when sedated, ongoing medical evaluation, and active reassessment of whether physical restraint or isolation can be reduced.',
    quote: 'prolonged physical restraint and/or isolation, both of which are associated with increased morbidity and mortality',
    locator: {
      section_heading: 'ACEP severe agitation benefits',
      search_phrase: 'prolonged physical restraint and/or isolation, both of which are associated with increased morbidity and mortality'
    }
  },
  {
    id: 'quote_agitation_combo_medication_002',
    source_id: 'acep_severe_agitation',
    section: 'Psychiatric and behavioral emergencies - Severe agitation medication strategy',
    topic_label: 'Severe agitation medication strategy',
    facet_id: 'medication_procedure',
    topic_tags: ['psychiatry', 'behavioral_health', 'safety', 'severe_agitation_medication_strategy'],
    task_tags: ['management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-AGITATION-P02',
    query_phrase: 'severe agitation medication strategy droperidol midazolam emergency department',
    clinical_rule: 'Medication for severe agitation should be selected for rapid safe sedation and reassessment, not punishment or convenience.',
    text: 'Quote-backed severe agitation medication summary: when medication is required for dangerous agitation, combination therapy such as droperidol plus midazolam is a cited option with monitoring and airway readiness.',
    quote: 'a combination of droperidol and midazolam is preferred',
    locator: {
      section_heading: 'ACEP severe agitation summary',
      search_phrase: 'a combination of droperidol and midazolam is preferred'
    }
  },
  {
    id: 'quote_agitation_droperidol_single_003',
    source_id: 'acep_severe_agitation',
    section: 'Psychiatric and behavioral emergencies - Severe agitation medication strategy',
    topic_label: 'Severe agitation medication strategy',
    facet_id: 'medication_procedure',
    topic_tags: ['psychiatry', 'behavioral_health', 'safety', 'severe_agitation_medication_strategy'],
    task_tags: ['management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-AGITATION-P03',
    query_phrase: 'severe agitation single agent droperidol emergency department',
    clinical_rule: 'If a single sedating agent is chosen for severe agitation, droperidol is the preferred cited reference in the ACEP policy summary.',
    text: 'Quote-backed agitation medication summary: if combination medication is not selected, document why a single agent is being used and monitor sedation, ventilation, circulation, and ongoing safety.',
    quote: 'If a single agent must be given, droperidol is preferred',
    locator: {
      section_heading: 'ACEP severe agitation summary',
      search_phrase: 'If a single agent must be given, droperidol is preferred'
    }
  },
  {
    id: 'quote_agitation_ketamine_004',
    source_id: 'acep_severe_agitation',
    section: 'Psychiatric and behavioral emergencies - Severe agitation medication strategy',
    topic_label: 'Severe agitation medication strategy',
    facet_id: 'initial_management',
    topic_tags: ['psychiatry', 'behavioral_health', 'safety', 'severe_agitation_medication_strategy'],
    task_tags: ['management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-AGITATION-M04',
    query_phrase: 'severe agitation ketamine safety patient bystanders staff concern',
    clinical_rule: 'Ketamine can be considered for rapid control only when safety concerns justify that escalation and monitoring is ready.',
    text: 'Quote-backed severe agitation management summary: reserve rapid dissociative medication for safety-critical agitation, with airway-ready monitoring, reassessment, and documentation of the safety threat.',
    quote: 'consider ketamine (intravenous or intramuscular) to rapidly treat severe agitation',
    locator: {
      section_heading: 'ACEP severe agitation Level C recommendation',
      search_phrase: 'consider ketamine (intravenous or intramuscular) to rapidly treat severe agitation'
    }
  },
  {
    id: 'quote_agitation_safety_context_005',
    source_id: 'acep_severe_agitation',
    section: 'Psychiatric and behavioral emergencies - Severe agitation medication strategy',
    topic_label: 'Severe agitation medication strategy',
    facet_id: 'focused_assessment',
    topic_tags: ['psychiatry', 'behavioral_health', 'safety', 'severe_agitation_medication_strategy'],
    task_tags: ['diagnosis', 'management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-AGITATION-A05',
    query_phrase: 'severe agitation safety patient bystanders staff assessment restraints',
    clinical_rule: 'Before restraint or sedating medication, explicitly assess the safety threat to the patient, staff, and bystanders.',
    text: 'Quote-backed severe agitation assessment summary: document the immediate safety concern, de-escalation attempt when possible, medical mimic screen, medication rationale, restraint need, and reassessment plan.',
    quote: 'where safety of the patient, bystanders, or staff is a concern',
    locator: {
      section_heading: 'ACEP severe agitation recommendation context',
      search_phrase: 'where safety of the patient, bystanders, or staff is a concern'
    }
  },
  {
    id: 'quote_agitation_life_threat_recognition_006',
    source_id: 'acep_severe_agitation',
    section: 'Psychiatric and behavioral emergencies - Severe agitation medication strategy',
    topic_label: 'Severe agitation medication strategy',
    facet_id: 'recognition',
    topic_tags: ['psychiatry', 'behavioral_health', 'safety', 'severe_agitation_medication_strategy'],
    task_tags: ['triage', 'diagnosis', 'management', 'tutor', 'debrief'],
    citation_label: 'QB-AGITATION-R06',
    query_phrase: 'severe agitation recognition life threatening hyperadrenergic state altered mental status psychomotor activity',
    clinical_rule: 'Recognize severe agitation as a potentially life-threatening emergency, not simply disruptive behavior, when dangerous agitation or hyperadrenergic physiology threatens care.',
    text: 'Quote-backed severe agitation recognition summary: learners should identify severe agitation as a potentially life-threatening emergency involving altered mental status, dangerous psychomotor activity, hyperadrenergic physiology, and immediate safety threats.',
    quote: 'critical, life-threatening medical condition that requires urgent treatment',
    locator: {
      section_heading: 'ACEP severe agitation introduction',
      search_phrase: 'critical, life-threatening medical condition that requires urgent treatment'
    }
  },
  {
    id: 'quote_agitation_medical_evaluation_007',
    source_id: 'acep_severe_agitation',
    section: 'Psychiatric and behavioral emergencies - Severe agitation medication strategy',
    topic_label: 'Severe agitation medication strategy',
    facet_id: 'diagnostic_strategy',
    topic_tags: ['psychiatry', 'behavioral_health', 'safety', 'severe_agitation_medication_strategy'],
    task_tags: ['diagnosis', 'management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-AGITATION-D07',
    query_phrase: 'severe agitation diagnostic strategy safe sedation medical evaluation underlying cause',
    clinical_rule: 'Medication strategy should enable urgent medical evaluation and treatment of reversible causes rather than replacing diagnostic assessment.',
    text: 'Quote-backed severe agitation diagnostic summary: choose sedation and staffing that allow glucose, toxidrome, trauma, infection, withdrawal, hypoxia, medication, and psychiatric assessment to proceed safely.',
    quote: 'Safe, adequate sedation facilitates medical evaluation',
    locator: {
      section_heading: 'ACEP severe agitation potential benefit',
      search_phrase: 'Safe, adequate sedation facilitates medical evaluation'
    }
  },
  {
    id: 'quote_agitation_respiratory_reassessment_008',
    source_id: 'acep_severe_agitation',
    section: 'Psychiatric and behavioral emergencies - Severe agitation medication strategy',
    topic_label: 'Severe agitation medication strategy',
    facet_id: 'disposition_reassessment',
    topic_tags: ['psychiatry', 'behavioral_health', 'safety', 'severe_agitation_medication_strategy'],
    task_tags: ['reassessment', 'sbar', 'management', 'tutor', 'debrief'],
    citation_label: 'QB-AGITATION-S08',
    query_phrase: 'severe agitation reassessment oversedation respiratory depression monitoring disposition',
    clinical_rule: 'After medication for severe agitation, reassess airway, ventilation, circulation, depth of sedation, underlying cause, restraint need, and safe disposition trajectory.',
    text: 'Quote-backed severe agitation reassessment summary: post-sedation care must monitor oversedation, respiratory depression, airway risk, ongoing safety threat, evolving diagnosis, and whether restraints or higher-level monitoring remain necessary.',
    quote: 'risk of oversedation and respiratory depression',
    locator: {
      section_heading: 'ACEP severe agitation potential harm',
      search_phrase: 'risk of oversedation and respiratory depression'
    }
  },
  {
    id: 'quote_dka_mainstays_001',
    source_id: 'ada_hyperglycemic_crises_2024',
    section: 'GI, GU, renal, and endocrine emergencies - DKA or HHS',
    topic_label: 'DKA or HHS',
    facet_id: 'initial_management',
    topic_tags: ['abdominal_pain', 'renal', 'endocrine', 'dka_or_hhs'],
    task_tags: ['management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-DKA-M01',
    query_phrase: 'DKA HHS management fluids insulin electrolytes potassium reassessment',
    clinical_rule: 'DKA/HHS treatment is anchored in fluids, insulin, electrolyte repletion, precipitant treatment, and frequent reassessment.',
    text: 'Quote-backed DKA/HHS management summary: initial care should name fluid replacement, insulin strategy, electrolyte and potassium monitoring, precipitating cause evaluation, and reassessment targets.',
    quote: 'The mainstays of treatment of DKA and HHS are fluid replacement, insulin therapy, electrolyte repletion',
    locator: {
      source_url: HYPERGLYCEMIC_CRISES_CONSENSUS_PDF_URL,
      section_heading: 'Treatment of DKA and HHS',
      search_phrase: 'The mainstays of treatment of DKA and HHS are fluid replacement'
    }
  },
  {
    id: 'quote_dka_diagnostic_criteria_006',
    source_id: 'ccjm_hyperglycemic_crises_2025',
    section: 'GI, GU, renal, and endocrine emergencies - DKA or HHS',
    topic_label: 'DKA or HHS',
    facet_id: 'recognition',
    topic_tags: ['abdominal_pain', 'renal', 'endocrine', 'dka_or_hhs'],
    task_tags: ['triage', 'diagnosis', 'management', 'tutor', 'debrief'],
    citation_label: 'QB-DKA-R06',
    query_phrase: 'DKA recognition diagnostic criteria hyperglycemia ketosis metabolic acidosis beta hydroxybutyrate pH bicarbonate',
    clinical_rule: 'Recognize DKA by the required combination of diabetes or hyperglycemia, ketosis, and metabolic acidosis rather than by glucose level alone.',
    text: 'Quote-backed DKA/HHS recognition summary: suspected DKA requires checking for diabetes or hyperglycemia, ketosis, and acidosis, while HHS requires attention to severe hyperglycemia, hyperosmolality, dehydration, and mental status.',
    quote: 'The diagnosis of DKA requires the presence of 3 criteria',
    locator: {
      section_heading: 'Diagnosis',
      search_phrase: 'The diagnosis of DKA requires the presence of 3 criteria'
    }
  },
  {
    id: 'quote_dka_precipitating_events_002',
    source_id: 'ada_hyperglycemic_crises_2024',
    section: 'GI, GU, renal, and endocrine emergencies - DKA or HHS',
    topic_label: 'DKA or HHS',
    facet_id: 'diagnostic_strategy',
    topic_tags: ['abdominal_pain', 'renal', 'endocrine', 'dka_or_hhs'],
    task_tags: ['diagnosis', 'management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-DKA-D02',
    query_phrase: 'DKA HHS precipitating event infection myocardial infarction diagnostic strategy',
    clinical_rule: 'DKA/HHS workup should look for precipitating events while treatment proceeds.',
    text: 'Quote-backed DKA/HHS diagnostic summary: evaluate infection, missed insulin, myocardial ischemia, pregnancy, renal failure, medication triggers, and other precipitants while correcting the metabolic emergency.',
    quote: 'precipitating factors for DKA include infections',
    locator: {
      source_url: HYPERGLYCEMIC_CRISES_CONSENSUS_PDF_URL,
      section_heading: 'Risk factors',
      search_phrase: 'precipitating factors for DKA include infections'
    }
  },
  {
    id: 'quote_dka_frequent_monitoring_003',
    source_id: 'ada_hyperglycemic_crises_2024',
    section: 'GI, GU, renal, and endocrine emergencies - DKA or HHS',
    topic_label: 'DKA or HHS',
    facet_id: 'disposition_reassessment',
    topic_tags: ['abdominal_pain', 'renal', 'endocrine', 'dka_or_hhs'],
    task_tags: ['reassessment', 'sbar', 'tutor', 'debrief'],
    citation_label: 'QB-DKA-S03',
    query_phrase: 'DKA HHS reassessment frequent monitoring electrolytes potassium glucose',
    clinical_rule: 'DKA/HHS reassessment should be frequent and lab-driven because therapy shifts glucose, osmolality, and potassium.',
    text: 'Quote-backed DKA/HHS reassessment summary: reassess vital signs, mental status, volume status, glucose, ketones or anion gap, potassium, renal function, pH, osmolality, and response to fluids and insulin.',
    quote: 'blood should be drawn every 4 h for determination of electrolytes',
    locator: {
      source_url: HYPERGLYCEMIC_CRISES_CONSENSUS_PDF_URL,
      section_heading: 'Monitoring during treatment',
      search_phrase: 'blood should be drawn every 4 h for determination of electrolytes'
    }
  },
  {
    id: 'quote_dka_glucose_monitoring_004',
    source_id: 'ada_hyperglycemic_crises_2024',
    section: 'GI, GU, renal, and endocrine emergencies - DKA or HHS',
    topic_label: 'DKA or HHS',
    facet_id: 'focused_assessment',
    topic_tags: ['abdominal_pain', 'renal', 'endocrine', 'dka_or_hhs'],
    task_tags: ['diagnosis', 'management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-DKA-A04',
    query_phrase: 'DKA HHS glucose testing every 1-2 hours treatment',
    clinical_rule: 'During DKA/HHS therapy, glucose monitoring must be frequent enough to guide insulin and dextrose changes.',
    text: 'Quote-backed DKA/HHS monitoring summary: bedside glucose trends are not optional background data; they guide insulin titration, dextrose addition, and recognition of treatment complications.',
    quote: 'Capillary blood glucose testing should be performed during treatment every 1-2 h',
    locator: {
      source_url: HYPERGLYCEMIC_CRISES_CONSENSUS_PDF_URL,
      section_heading: 'Monitoring during treatment',
      search_phrase: 'Capillary blood glucose testing should be performed during treatment every 1-2 h'
    }
  },
  {
    id: 'quote_dka_electrolyte_monitoring_005',
    source_id: 'ada_hyperglycemic_crises_2024',
    section: 'GI, GU, renal, and endocrine emergencies - DKA or HHS',
    topic_label: 'DKA or HHS',
    facet_id: 'medication_procedure',
    topic_tags: ['abdominal_pain', 'renal', 'endocrine', 'dka_or_hhs'],
    task_tags: ['management', 'reassessment', 'tutor', 'debrief'],
    citation_label: 'QB-DKA-P05',
    query_phrase: 'DKA HHS potassium electrolytes blood drawn every 4 hours insulin safety',
    clinical_rule: 'Insulin therapy in DKA/HHS must be paired with electrolyte and potassium surveillance.',
    text: 'Quote-backed DKA/HHS medication summary: before and during insulin therapy, track potassium and other electrolytes to avoid dangerous shifts while correcting hyperglycemia and acidosis.',
    quote: 'blood should be drawn every 4 h',
    locator: {
      source_url: HYPERGLYCEMIC_CRISES_CONSENSUS_PDF_URL,
      section_heading: 'Monitoring during treatment',
      search_phrase: 'blood should be drawn every 4 h'
    }
  }
];

function buildQuoteBackedCoreChunks() {
  return quoteBackedCoreDefinitions.map(makeQuoteBackedChunk);
}

function topicDetails(domain, topicName) {
  const words = topicName.toLowerCase();
  const riskTerms = [
    'abnormal vital signs',
    'rapid progression',
    'severe pain or distress',
    'altered mental status',
    'high-risk comorbidity',
    'pregnancy, pediatric age, older age, anticoagulation, or immunocompromise when relevant'
  ];
  const signal = `${topicName.toLowerCase()} with ${riskTerms[(topicName.length + domain.id.length) % riskTerms.length]}`;
  const action = managementActionForTopic(domain, topicName);

  const assessment = [
    'vital sign trend',
    'mental status',
    'airway and work of breathing',
    'perfusion',
    'pain trajectory',
    'focused exam findings',
    'medication and allergy risks',
    'response to initial treatment'
  ].join(', ');
  const caveat = /discharge|low-risk|ESI 5|asymptomatic/i.test(words)
    ? 'low-risk or discharge pathways require stable reassessment, no hidden red flags, reliable follow-up, and clear return precautions'
    : defaultCaveat;
  return { signal, action, assessment, caveat };
}

function taskTagsForTopic(domain, topic, facet) {
  const tags = new Set([...facet.taskTags]);
  const text = `${domain.id} ${topic} ${facet.id}`.toLowerCase();
  if (/handoff|transfer|consult|icu|sbar/.test(text) && ['disposition_reassessment', 'teaching_handoff'].includes(facet.id)) tags.add('sbar');
  if (/diagnos|imaging|stroke|abdominal|headache|pregnancy|infection|toxicity|overdose/.test(text) && ['recognition', 'focused_assessment', 'diagnostic_strategy'].includes(facet.id)) tags.add('diagnosis');
  if (/treatment|antibiotic|opioid|airway|shock|sepsis|trauma|resuscitation/.test(text) && ['initial_management', 'medication_procedure'].includes(facet.id)) tags.add('management');
  if (/esi|triage|vital|red flag|danger|risk/.test(text) && ['recognition', 'red_flags', 'focused_assessment'].includes(facet.id)) tags.add('triage');
  tags.add('tutor');
  tags.add('debrief');
  return [...tags];
}

function sourceForTopic(domain, topicIndex) {
  const topicSlug = slug(domain.topics[topicIndex]);
  const sourceId = topicSourceOverrides[`${domain.id}:${topicSlug}`] || topicSourceOverrides[topicSlug] || domain.sources[topicIndex % domain.sources.length];
  const sourceRecord = sourceById.get(sourceId);
  if (!sourceRecord) throw new Error(`Domain ${domain.id} references missing source ${sourceId}`);
  return sourceRecord;
}

function makeChunk(domain, topicName, topicIndex, facet) {
  const sourceRecord = sourceForTopic(domain, topicIndex);
  const details = topicDetails(domain, topicName);
  const topicSlug = slug(topicName);
  const id = `${domain.id}_${topicSlug}_${facet.id}_${String(topicIndex + 1).padStart(3, '0')}`;
  const text = facet.template({
    name: topicName,
    sourceTitle: sourceRecord.title,
    ...details
  });
  return {
    schema_version: 'reference_chunk_v1',
    id,
    source_id: sourceRecord.id,
    section: `${domain.section} - ${topicName}`,
    page: '',
    source_url: sourceRecord.url,
    source_title: sourceRecord.title,
    organization: sourceRecord.organization,
    publication_date: sourceRecord.publication_date,
    doi: sourceRecord.doi || '',
    pmid: sourceRecord.pmid || '',
    isbn: sourceRecord.isbn || '',
    locator: locatorForChunk(sourceRecord, domain, topicName, facet),
    citation_label: `${domain.id.toUpperCase()}-${facet.code}${String(topicIndex + 1).padStart(2, '0')}`,
    facet_id: facet.id,
    topic_tags: [...new Set([...domain.tags, topicSlug])],
    task_tags: taskTagsForTopic(domain, topicName, facet),
    source_tier: sourceRecord.source_tier,
    review_status: 'reviewed',
    evidence_status: GENERATED_EVIDENCE_STATUS,
    supporting_quotes: [],
    active: true,
    superseded_by: '',
    clinical_rule: details.action,
    text,
    normalized_text: normalizedText(text)
  };
}

const chunks = buildQuoteBackedCoreChunks();
for (const domain of domainSpecs) {
  domain.topics.forEach((topicName, topicIndex) => {
    for (const facet of CHUNK_FACETS) {
      chunks.push(makeChunk(domain, topicName, topicIndex, facet));
    }
  });
}

const duplicateSource = sources.find((item, index) => sources.findIndex((candidate) => candidate.id === item.id) !== index);
if (duplicateSource) throw new Error(`Duplicate source id ${duplicateSource.id}`);
const duplicateChunk = chunks.find((item, index) => chunks.findIndex((candidate) => candidate.id === item.id) !== index);
if (duplicateChunk) throw new Error(`Duplicate chunk id ${duplicateChunk.id}`);

const bundle = {
  schema_version: 'clinical_knowledge_bundle_v2',
  bundle_id: 'public_em_core_vector_bundle_v1',
  title: 'Public Emergency Medicine Core Vector Bundle',
  description: 'Quote-backed verified emergency medicine core plus downgraded public-safe generated background summaries. Short source excerpts are stored only for reviewed high-risk citation verification; licensed textbook content is intentionally excluded.',
  generated_at: new Date().toISOString().slice(0, 10),
  embedding_model: EMBEDDING_MODEL,
  embedding_dimensions: EMBEDDING_DIMENSIONS,
  distance: 'cosine',
  vector_storage: {
    mode: 'precomputed_public_assets_with_indexeddb_query_cache',
    asset_base_path: '/clinical_vectors/public_em_core_vector_bundle_v1/',
    assets: ['manifest.json', 'chunks.json', 'vectors.f32.bin'],
    note: 'Public candidate vectors ship as static assets; browser query vectors and local bundle vectors are computed and cached in IndexedDB.'
  },
  retrieval_policy: {
    mode: 'hybrid_dense_bm25_source_rerank',
    quality_goal: 'safety_precision',
    high_risk_fail_closed: true,
    quote_policy: 'short_excerpts_only',
    high_risk_requires_quote_backed: true,
    generated_chunks_allowed_for_high_risk_prompt: false,
    source_priority: [
      'ed_specific_guideline',
      'society_guideline',
      'textbook',
      'systematic_review',
      'primary_study',
      'local_teaching_note'
    ],
    minimum_public_sources: 70,
    minimum_public_chunks: 2400
  },
  sources,
  chunks
};

writeFileSync(OUTPUT, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
const qualityReport = {
  schema_version: 'clinical_source_quality_report_v1',
  bundle_id: bundle.bundle_id,
  generated_at: bundle.generated_at,
  total_sources: sources.length,
  total_chunks: chunks.length,
  quote_excerpt_word_limit: QUOTE_EXCERPT_WORD_LIMIT,
  quote_backed_count: chunks.filter((chunk) => chunk.evidence_status === QUOTE_BACKED_EVIDENCE_STATUS).length,
  generated_needs_review_count: chunks.filter((chunk) => chunk.evidence_status === GENERATED_EVIDENCE_STATUS).length,
  anchored_count: chunks.filter((chunk) => chunk.locator?.verification_status === 'anchored').length,
  human_verified_count: chunks.filter((chunk) => chunk.locator?.verification_status === 'human_verified').length,
  source_level_only_count: chunks.filter((chunk) => chunk.locator?.verification_status === 'source_level_only').length,
  needs_review_count: chunks.filter((chunk) => chunk.locator?.verification_status === 'needs_review').length,
  auditable_count: chunks.filter(locatorIsAuditable).length,
  high_risk_quote_core_topics: [
    'septic_shock_concern',
    'septic_shock_resuscitation',
    'chest_pain_possible_acs',
    'high_sensitivity_troponin_pathway',
    'non_st_elevation_acs',
    'opioid_overdose',
    'naloxone_response_and_recurrence',
    'febrile_infant_8_to_21_days',
    'acute_stroke_symptoms',
    'thrombolytic_eligibility_discussion',
    'ectopic_pregnancy_rupture_concern',
    'minor_head_injury_ct_decision',
    'use_of_restraints',
    'severe_agitation_medication_strategy',
    'dka_or_hhs'
  ],
  high_risk_topics_without_quote_coverage: [
    'septic_shock_concern',
    'septic_shock_resuscitation',
    'chest_pain_possible_acs',
    'high_sensitivity_troponin_pathway',
    'non_st_elevation_acs',
    'opioid_overdose',
    'naloxone_response_and_recurrence',
    'febrile_infant_8_to_21_days',
    'acute_stroke_symptoms',
    'thrombolytic_eligibility_discussion',
    'ectopic_pregnancy_rupture_concern',
    'minor_head_injury_ct_decision',
    'use_of_restraints',
    'severe_agitation_medication_strategy',
    'dka_or_hhs'
  ].filter((topicTag) => !chunks.some((chunk) =>
    chunk.evidence_status === QUOTE_BACKED_EVIDENCE_STATUS && (chunk.topic_tags || []).includes(topicTag)
  )),
  missing_locator_chunk_ids: chunks
    .filter((chunk) => !locatorIsAuditable(chunk))
    .map((chunk) => chunk.id),
  repeated_sentence_note: 'Generated background chunks intentionally remain downgraded until topic-specific review removes repeated boilerplate.',
  note: 'Only quote_backed chunks are human_verified. Generated public-safe summaries include source URLs and search phrases but remain generated_needs_review and are excluded from high-risk prompt context.'
};
writeFileSync(QUALITY_REPORT_OUTPUT, `${JSON.stringify(qualityReport, null, 2)}\n`, 'utf8');
console.log(`Wrote ${chunks.length} public EM chunks from ${sources.length} sources to ${OUTPUT}`);
console.log(`Wrote source quality report to ${QUALITY_REPORT_OUTPUT}`);
