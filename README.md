# ER Triage Simulation (MIMIC/MIETIC)

An interactive simulation where users practice emergency department triage by evaluating patients and assigning triage classifications based on real MIETIC validation samples.

## Features

- **Real Data**: Uses MIETIC validation samples with expert annotations
- **Interactive Simulation**: CLI-based interface for patient assessment
- **Selective Assessment**: Check vitals interactively and perform interventions as needed
- **Triage Classification**: ESI Level 1-5 classification with expert comparison
- **Comprehensive Feedback**: Analysis comparing user decisions with ground truth
- **Continuous Practice**: Keep practicing with new cases until you choose to exit

## Installation

1. Clone or download the project files
2. Install required dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Ensure `MIETIC-validate-samples.csv` is in the project directory

## Usage

Run the main simulation:
```bash
python main_simulation.py
```

The simulation will start immediately with a new patient case. After completing each case, you'll be asked if you want to continue with another simulation or exit.

### Available Commands During Simulation

- `help` - Show available commands
- `vitals` - Check patient vital signs (interactive selection)
- `history` - Review patient medical history
- `complaint` - Review chief complaint
- `interventions` - Perform interventions (interactive selection)
- `triage` - Assign triage classification (ESI Level 1-5)
- `quit` - Exit simulation

### Available Interventions (Based on MIETIC Data)

**Procedures:**
- Endotracheal Intubation
- IV Access
- IV Fluids
- IM Medication
- Oral Medication
- Nebulized Treatment

**Medications:**
- Emergency Medication (Tier 1)
- Urgent Medication (Tier 2)
- Stabilizing Medication (Tier 3)
- Routine Medication (Tier 4)

**Critical Procedures:**
- Emergency Procedure
- Psychotropic Medication

### How It Works

1. A patient arrives with limited information (age, sex, transport method, chief complaint)
2. You check vitals and review history/complaint as needed
3. You perform interventions based on your assessment
4. Before each command, you see a summary of vitals checked and interventions performed
5. You assign a triage level (ESI 1-5)
6. You receive feedback comparing your decisions to expert assessment and actual outcomes
7. Continue with another case or exit

## Project Structure

- `main_simulation.py` - Main entry point and continuous simulation loop
- `data_loader.py` - Loads and processes MIETIC CSV data into Case objects
- `simulation_engine.py` - Patient state tracking and intervention management
- `user_interface.py` - CLI interface with interactive vital/intervention selection
- `triage_classification.py` - ESI triage level classification and validation
- `feedback_engine.py` - Feedback generation comparing user actions to ground truth
- `requirements.txt` - Python dependencies (pandas, numpy, jupyter)
- `MIETIC-validate-samples.csv` - Patient data source with expert annotations

## Data Source

The simulation uses the MIETIC (MIMIC-IV Emergency Department Triage Classification) validation samples, which include:
- Patient demographics (age, sex, arrival transport) and vital signs
- Chief complaints and medical history
- Expert triage classifications (ESI Levels 1-5)
- Ground truth interventions actually performed in the ED
- Clinical outcomes (disposition, transfers, mortality, transfusions)

## Learning Objectives

- Practice emergency department triage decision-making
- Learn ESI (Emergency Severity Index) classification criteria (Levels 1-5)
- Develop systematic patient assessment skills
- Compare decisions with expert assessments and real patient outcomes
- Learn which interventions are typically performed for different conditions
- Improve clinical reasoning and prioritization skills

## Example Session

```
============================================================
ER TRIAGE SIMULATION - MIETIC/MIMIC
============================================================

NEW PATIENT ARRIVAL
Age: 62 years
Sex: M
Arrival Transport: AMBULANCE
Chief Complaint: Epigastric pain

Simulation started.
Type 'help' for available commands.

============================================================
VITALS CHECKED: None

INTERVENTIONS PERFORMED: None
============================================================

Enter your next command: vitals

AVAILABLE VITAL SIGNS:
  1. Heart Rate
  2. Blood Pressure
  3. Respiratory Rate
  4. Oxygen Saturation
  5. Temperature
  6. Pain Level

Enter vital sign number (1-6) or 'back' to return: 1

============================================================
VITALS CHECKED:
  - Heart Rate: 85 bpm

INTERVENTIONS PERFORMED: None
============================================================

Enter your next command: vitals

AVAILABLE VITAL SIGNS:
  1. Heart Rate
  2. Blood Pressure
  ...

Enter vital sign number (1-6) or 'back' to return: 6

[ALERT] Severe pain (pain level 10/10)

============================================================
VITALS CHECKED:
  - Heart Rate: 85 bpm
  - Pain Level: 10/10

INTERVENTIONS PERFORMED: None
============================================================

Enter your next command: interventions

AVAILABLE INTERVENTIONS:
  1. Perform Endotracheal Intubation
  2. Start IV Access
  3. Start IV Fluids
  ...

Enter intervention number (1-12) or 'back' to return: 7

[SUCCESS] Administer Emergency Medication performed.

============================================================
VITALS CHECKED:
  - Heart Rate: 85 bpm
  - Pain Level: 10/10

INTERVENTIONS PERFORMED:
  - Administer Emergency Medication
============================================================

Enter your next command: triage

TRIAGE CLASSIFICATION
Please select the appropriate triage level:
1. ESI Level 1 - Resuscitation (Immediate life-threatening)
2. ESI Level 2 - Emergent (High risk, unstable)
3. ESI Level 3 - Urgent (Stable but needs prompt care)
4. ESI Level 4 - Less Urgent (Stable, can wait)
5. ESI Level 5 - Non-Urgent (Minor conditions)

Enter triage level (1-5): 2

[SUCCESS] Triage Level 2 assigned.

================================================================================
SIMULATION FEEDBACK REPORT
================================================================================

SESSION SUMMARY
Arrival Method: AMBULANCE
Chief Complaint: Epigastric pain

Vitals Checked:
  - Heart Rate: 85 bpm
  - Pain Level: 10/10

Interventions Performed:
  - Administer Emergency Medication

Triage Level Assigned: ESI Level 2

TRIAGE ANALYSIS
Your Decision: ESI Level 2
Expert Decision: ESI Level 2
Result: Correct triage

Patient Outcomes:
  - Disposition: ADMIT

ACTUAL INTERVENTIONS IN ED
The following interventions were actually performed:
  - IV access established
  - Emergency medications (Tier 1) administered

================================================================================

Start another simulation? (yes/no):
```

## Contributing

This simulation is designed for educational purposes. Feel free to extend the functionality, add new intervention types, or improve the feedback system.

## License

This project is for educational use with the MIETIC dataset. Please ensure compliance with any data use agreements for the MIETIC dataset.
