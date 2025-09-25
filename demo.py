#!/usr/bin/env python3
"""
Demo script for ER Triage Simulation
Shows a quick example of how the simulation works
"""

from main_simulation import ERTriageSimulation

def main():
    print("🏥 ER Triage Simulation Demo")
    print("=" * 50)
    
    # Initialize simulation
    simulation = ERTriageSimulation("MIETIC-validate-samples.csv")
    
    # Show dataset statistics
    stats = simulation.data_loader.get_statistics()
    print(f"\n📊 Dataset Overview:")
    print(f"Total Cases: {stats['total_cases']}")
    print(f"Acuity Distribution: {stats['acuity_distribution']}")
    print(f"Age Range: {stats['age_range']['min']:.0f} - {stats['age_range']['max']:.0f} years")
    
    # Get a sample case
    case = simulation.data_loader.get_random_case()
    print(f"\n📋 Sample Case:")
    print(f"ID: {case.id}")
    print(f"Age: {case.demographics.age:.0f} year old {case.demographics.sex}")
    print(f"Complaint: {case.complaint}")
    print(f"Expert Acuity: ESI Level {case.acuity}")
    
    # Show vitals
    vitals = case.vitals
    print(f"\n📊 Vital Signs:")
    if vitals.hr: print(f"  Heart Rate: {vitals.hr} bpm")
    if vitals.sbp and vitals.dbp: print(f"  Blood Pressure: {vitals.sbp}/{vitals.dbp} mmHg")
    if vitals.o2: print(f"  Oxygen Saturation: {vitals.o2}%")
    if vitals.pain is not None: print(f"  Pain Level: {vitals.pain}/10")
    
    # Initialize simulation engine
    from simulation_engine import SimulationEngine
    sim_engine = SimulationEngine(case)
    
    # Show available interventions
    interventions = sim_engine.get_available_interventions()
    print(f"\n🔧 Available Interventions:")
    for intervention in interventions:
        print(f"  - {intervention.value.replace('_', ' ').title()}")
    
    # Show suggested triage level
    suggested = simulation.triage_classifier.suggest_triage_level(case, sim_engine)
    suggested_desc = simulation.triage_classifier.get_triage_description(suggested)
    print(f"\n💡 Suggested Triage Level: {suggested} ({suggested_desc['name']})")
    
    print(f"\n🎯 To run the full interactive simulation:")
    print(f"   python main_simulation.py")
    
    print(f"\n✅ Demo completed successfully!")

if __name__ == "__main__":
    main()
