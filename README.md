# ER Triage Simulation (MIMIC/MIETIC)

An interactive simulation where users play as triage nurses or clinicians, evaluating patients, performing interventions, and assigning triage classifications based on real MIETIC validation samples.

## Features

- **Real Data**: Uses MIETIC validation samples with expert annotations
- **Interactive Simulation**: CLI-based interface for patient assessment
- **Patient State Tracking**: Realistic deterioration rules and intervention effects
- **Triage Classification**: ESI Level 1-5 classification with expert comparison
- **Comprehensive Feedback**: Detailed analysis of user decisions vs. ground truth
- **Multiple Modes**: Single simulation, practice mode, case studies, and performance tracking

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

### Available Commands During Simulation

- `help` - Show available commands
- `status` - Show current patient status
- `vitals` - Display patient vital signs
- `history` - Review patient medical history
- `complaint` - Review chief complaint
- `interventions` - Show available interventions
- `perform <intervention>` - Perform an intervention
- `advance <minutes>` - Advance simulation time
- `triage` - Assign triage classification
- `quit` - Exit simulation

### Available Interventions

- `oxygen` - Oxygen therapy
- `airway` - Airway management
- `bleeding_control` - Bleeding control
- `iv_fluids` - IV access and fluids
- `pain_management` - Pain medication
- `cardiac_monitoring` - Cardiac monitoring

### Simulation Modes

1. **Single Simulation**: Random case with full feedback
2. **Multiple Simulations**: Practice session with multiple cases
3. **Practice Mode**: Guided learning with hints
4. **Case Study Mode**: Focus on specific acuity levels
5. **Performance Summary**: View overall performance metrics

## Project Structure

- `main_simulation.py` - Main entry point and simulation orchestration
- `data_loader.py` - Loads and processes MIETIC CSV data
- `simulation_engine.py` - Patient state tracking and deterioration rules
- `user_interface.py` - CLI interface and user interactions
- `triage_classification.py` - ESI triage level classification and validation
- `feedback_engine.py` - Comprehensive feedback generation
- `requirements.txt` - Python dependencies
- `MIETIC-validate-samples.csv` - Patient data source

## Data Source

The simulation uses the MIETIC (MIMIC-IV Emergency Department Triage Classification) validation samples, which include:
- Patient demographics and vital signs
- Chief complaints and medical history
- Expert triage classifications (ESI Levels 1-5)
- Clinical outcomes and dispositions
- Expert agreement/disagreement annotations

## Learning Objectives

- Practice emergency department triage decision-making
- Learn ESI (Emergency Severity Index) classification criteria
- Understand critical intervention timing and selection
- Compare decisions with expert assessments
- Improve clinical reasoning and prioritization skills

## Example Session

```
🏥 ER TRIAGE SIMULATION - MIETIC/MIMIC
============================================================

📋 NEW PATIENT ARRIVAL
Patient ID: 18530850_37186254
Age: 62 years
Sex: M
Arrival Method: AMBULANCE
Chief Complaint: Epigastric pain

📊 INITIAL VITAL SIGNS:
  Heart Rate: 85.0 bpm
  Blood Pressure: 184.0/None mmHg
  Respiratory Rate: 16.0 breaths/min
  Oxygen Saturation: 97.0%
  Temperature: 96.6°F
  Pain Level: 10/10

> vitals
📊 DETAILED VITAL SIGNS
  Heart Rate: 85.0 bpm
  Blood Pressure: 184.0/None mmHg
  Respiratory Rate: 16.0 breaths/min
  Oxygen Saturation: 97.0%
  Temperature: 96.6°F
  Pain Level: 10/10
  ⚠️  Abnormal blood pressure

> perform pain_management
✅ Pain medication administered.

> triage
🏷️  TRIAGE CLASSIFICATION
Please select the appropriate triage level:
1. ESI Level 1 - Resuscitation (Immediate life-threatening)
2. ESI Level 2 - Emergent (High risk, unstable)
3. ESI Level 3 - Urgent (Stable but needs prompt care)
4. ESI Level 4 - Less Urgent (Stable, can wait)
5. ESI Level 5 - Non-Urgent (Minor conditions)

Enter triage level (1-5): 2
✅ Triage Level 2 assigned.

📊 SIMULATION FEEDBACK REPORT
============================================================
📋 SESSION SUMMARY
Case ID: 18530850_37186254
Total Time: 5 minutes
Patient Outcome: stable

📈 PERFORMANCE METRICS
Overall Score: 85.0%
Triage Accuracy: ✅ Correct
Intervention Efficiency: 20.0%
Time Efficiency: 50.0%
Critical Intervention Coverage: 100.0%

🏷️  TRIAGE ANALYSIS
Your Decision: ESI Level 2 (Emergent)
Expert Decision: ESI Level 2 (Emergent)
Result: Perfect match
Direction: Correctly triaged

✅ Excellent! Your triage level matches the expert assessment.
```

## Contributing

This simulation is designed for educational purposes. Feel free to extend the functionality, add new intervention types, or improve the feedback system.

## License

This project is for educational use with the MIETIC dataset. Please ensure compliance with any data use agreements for the MIETIC dataset.
