# ER Triage Simulation (MIMIC/MIETIC)

An interactive simulation that provides a structured, realistic ED triage experience using OpenRouter-hosted LLMs for natural patient interactions and real MIETIC validation data.

## Features

- **Structured Workflow**: Follows authentic ED triage process (5 steps, 3-5 minutes)
- **AI-Powered Patient Responses**: Natural language conversations using OpenRouter models
- **Real MIETIC Data**: Patient information grounded in validated emergency department data
- **Interactive Assessment**: Ask questions, select vitals, order interventions
- **Expert Comparison**: Compare your decisions to real ED outcomes and expert assessments
- **Continuous Practice**: Practice multiple cases in succession

## Installation

1. Clone or download the project files
2. Install required dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Create a `.env` file with your OpenRouter API key:
   ```bash
   cp .env.example .env
   # Edit .env and add your OPENROUTER_API_KEY
   ```
4. Ensure `MIETIC-validate-samples.csv` is in the project directory

## Usage

Run the main simulation:
```bash
python main_simulation.py
```

The simulation follows a structured 5-step triage workflow. After completing each case, you'll be asked if you want to continue with another simulation or exit.

### Structured Triage Workflow

The simulation guides you through a realistic ED triage process:

**Step 1: Patient Identification**
- Patient's age, sex, and arrival transport method are displayed

**Step 2: Chief Complaint** 
- Ask the patient about their chief complaint in natural language
- The AI patient responds based on real MIETIC data
- Example: "What brought you to the emergency department today?"

**Step 3: Vital Signs Measurement**
- Select which vitals to check (can select multiple at once)
- Options: Heart Rate, Blood Pressure, Respiratory Rate, O2 Saturation, Temperature, Pain Level
- Results displayed all at once
- You get one chance to select vitals

**Step 4: Medical History**
- Ask one question about the patient's medical history
- The AI patient responds as a layperson based on their actual medical history
- Example: "Do you have any chronic medical conditions?"

**Step 5: Triage Assignment**
- Assign an ESI triage level (1-5)

**Step 6: Intervention Ordering**
- Select interventions to perform (can select multiple at once)
- Available interventions based on real MIETIC data
- You get one chance to order interventions

**Step 7: Feedback Report**
- Comprehensive feedback comparing your assessment to expert decisions
- Patient outcomes from actual ED visit
- Ground truth interventions that were performed

### Available Interventions

Based on MIETIC dataset:
- **Procedures**: Intubation, IV Access, IV Fluids, IM/Oral/Nebulized Medications
- **Medications**: Emergency (Tier 1), Urgent (Tier 2), Stabilizing (Tier 3), Routine (Tier 4)
- **Critical**: Emergency Procedures, Psychotropic Medications

## Project Structure

- `main_simulation.py` - Main entry point and simulation orchestration
- `structured_triage.py` - Manages the 7-step triage workflow
- `llm_interface.py` - OpenRouter/OpenAI-compatible integration for patient responses
- `data_loader.py` - Loads and processes MIETIC CSV data into Case objects
- `simulation_engine.py` - Patient state tracking and intervention management
- `user_interface.py` - CLI interface for user interactions
- `triage_classification.py` - ESI triage level classification
- `feedback_engine.py` - Feedback generation with outcome analysis
- `requirements.txt` - Python dependencies
- `.env` - Local LLM API credentials (create from .env.example; ignored by git)
- `MIETIC-validate-samples.csv` - Patient data source with expert annotations

## Data Source

The simulation uses the MIETIC (MIMIC-IV Emergency Department Triage Classification) validation samples, which include:
- Patient demographics (age, sex, arrival transport) and vital signs
- Chief complaints and medical history
- Expert triage classifications (ESI Levels 1-5)
- Ground truth interventions actually performed in the ED
- Clinical outcomes (disposition, transfers, mortality, transfusions)

## Learning Objectives

- Practice realistic emergency department triage workflows
- Learn ESI (Emergency Severity Index) classification (Levels 1-5)
- Develop systematic patient assessment and interview skills
- Compare decisions with expert assessments and real patient outcomes
- Learn appropriate interventions for different clinical presentations
- Practice natural language patient communication

## Example Session

```
============================================================
ER TRIAGE SIMULATION - MIETIC/MIMIC
============================================================

Data loaded successfully: 150 cases available

============================================================
PATIENT ARRIVAL
============================================================
Age: 62 years
Sex: M
Arrival Transport: AMBULANCE
============================================================

============================================================
STEP 1: CHIEF COMPLAINT
============================================================
Ask the patient about their chief complaint.

What would you like to ask the patient about their chief complaint?
> What brought you to the emergency department today?

Asking patient...

Patient: I've been having really bad pain in my upper stomach, right in the 
middle. It started about 2 hours ago and it's getting worse.

============================================================
STEP 2: VITAL SIGNS MEASUREMENT
============================================================
Select which vital signs you want to measure.
You can select multiple vitals at once.

Available vital signs:
  1. Heart Rate
  2. Blood Pressure
  3. Respiratory Rate
  4. Oxygen Saturation
  5. Temperature
  6. Pain Level

Enter vital sign numbers separated by commas (e.g., 1,2,4)
Or type 'all' to select all vitals:
> 1,2,4,6

============================================================
VITAL SIGNS RESULTS
============================================================
  Heart Rate: 85 bpm
  Blood Pressure: 132/78 mmHg
  Oxygen Saturation: 98%
  Pain Level: 8/10
============================================================

============================================================
STEP 3: MEDICAL HISTORY
============================================================
Ask the patient one question about their medical history.

What would you like to ask the patient about their medical history?
> Do you have any chronic medical conditions?

Asking patient...

Patient: Yes, I have diabetes and high blood pressure. I take metformin and 
lisinopril daily.

============================================================
STEP 4: TRIAGE ASSIGNMENT
============================================================
ESI TRIAGE LEVELS:
1. ESI Level 1 - Resuscitation (Immediate, life-threatening)
2. ESI Level 2 - Emergent (High risk, severe pain/distress)
3. ESI Level 3 - Urgent (Moderate risk, stable vitals)
4. ESI Level 4 - Less Urgent (Minor injuries, stable)
5. ESI Level 5 - Non-Urgent (Minor conditions)

Type the number (1-5) to select triage level.
Enter triage level (1-5): 2

[SUCCESS] Triage Level 2 assigned.

============================================================
STEP 5: INTERVENTION ORDERING
============================================================
Select which interventions you want to perform.
You can select multiple interventions at once.

Available interventions:
  1. Perform Endotracheal Intubation
  2. Start IV Access
  3. Start IV Fluids
  4. Give IM Medication
  5. Give Oral Medication
  6. Give Nebulized Treatment
  7. Administer Emergency Medication
  8. Administer Urgent Medication
  9. Administer Stabilizing Medication
  10. Administer Routine Medication
  11. Perform Emergency Procedure
  12. Administer Psychotropic Medication

Enter intervention numbers separated by commas (e.g., 1,2,7)
Or type 'none' to skip interventions:
> 2,3,7

[SUCCESS] 3 intervention(s) performed.

============================================================
GENERATING FEEDBACK REPORT
============================================================

================================================================================
SIMULATION FEEDBACK REPORT
================================================================================

SESSION SUMMARY
Arrival Method: AMBULANCE
Chief Complaint: Epigastric pain

Questions Asked:
  Chief Complaint: What brought you to the emergency department today?
  Medical History: Do you have any chronic medical conditions?

Vitals Checked:
  - Heart Rate: 85 bpm
  - Blood Pressure: 132/78 mmHg
  - Oxygen Saturation: 98%
  - Pain Level: 8/10

Interventions Performed:
  - Start IV Access
  - Start IV Fluids
  - Administer Emergency Medication

Triage Level Assigned: ESI Level 2

TRIAGE ANALYSIS
Your Decision: ESI Level 2
Expert Decision: ESI Level 2
Result: Correct triage

Patient Outcomes:
  - Disposition: Admitted
  - Patient transferred to surgery within 1 hour
  - Multiple red cell units ordered

ACTUAL INTERVENTIONS IN ED
The following interventions were actually performed:
  - IV access established
  - IV fluids administered
  - Emergency medications (Tier 1) administered

================================================================================

============================================================
Start another simulation? (yes/no):
```

## Contributing

This simulation is designed for educational purposes. Feel free to extend the functionality, add new intervention types, or improve the feedback system.

## License

This project is for educational use with the MIETIC dataset. Please ensure compliance with any data use agreements for the MIETIC dataset.
