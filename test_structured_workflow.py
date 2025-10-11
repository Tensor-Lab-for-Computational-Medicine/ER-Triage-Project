"""
Test script for structured triage workflow
Tests module imports and basic initialization without making API calls
"""

def test_imports():
    """Test that all modules import successfully"""
    print("Testing imports...")
    
    try:
        from llm_interface import PatientLLM
        print("✓ llm_interface imported")
    except ImportError as e:
        print(f"✗ Failed to import llm_interface: {e}")
        return False
    
    try:
        from structured_triage import StructuredTriageWorkflow
        print("✓ structured_triage imported")
    except ImportError as e:
        print(f"✗ Failed to import structured_triage: {e}")
        return False
    
    try:
        from user_interface import UserInterface
        print("✓ user_interface imported")
    except ImportError as e:
        print(f"✗ Failed to import user_interface: {e}")
        return False
    
    try:
        from feedback_engine import FeedbackEngine
        print("✓ feedback_engine imported")
    except ImportError as e:
        print(f"✗ Failed to import feedback_engine: {e}")
        return False
    
    try:
        from data_loader import DataLoader
        print("✓ data_loader imported")
    except ImportError as e:
        print(f"✗ Failed to import data_loader: {e}")
        return False
    
    try:
        from simulation_engine import SimulationEngine
        print("✓ simulation_engine imported")
    except ImportError as e:
        print(f"✗ Failed to import simulation_engine: {e}")
        return False
    
    return True


def test_data_loading():
    """Test that data can be loaded"""
    print("\nTesting data loading...")
    
    try:
        from data_loader import DataLoader
        loader = DataLoader('MIETIC-validate-samples.csv')
        print(f"✓ Data loaded: {len(loader.cases)} cases available")
        
        # Get a random case
        case = loader.get_random_case()
        if case:
            print(f"✓ Retrieved sample case: {case.id}")
            print(f"  - Age: {case.demographics.age:.0f}")
            print(f"  - Sex: {case.demographics.sex}")
            print(f"  - Complaint: {case.complaint[:50]}...")
            return True
        else:
            print("✗ Failed to retrieve case")
            return False
    except Exception as e:
        print(f"✗ Data loading failed: {e}")
        return False


def test_ui_initialization():
    """Test UI and workflow components"""
    print("\nTesting UI initialization...")
    
    try:
        from user_interface import UserInterface
        from feedback_engine import FeedbackEngine
        
        ui = UserInterface()
        print("✓ UserInterface initialized")
        
        fe = FeedbackEngine()
        print("✓ FeedbackEngine initialized")
        
        # Check new attributes
        if hasattr(ui, 'chief_complaint_question'):
            print("✓ UI has chief_complaint_question attribute")
        else:
            print("✗ UI missing chief_complaint_question attribute")
            return False
        
        if hasattr(ui, 'medical_history_question'):
            print("✓ UI has medical_history_question attribute")
        else:
            print("✗ UI missing medical_history_question attribute")
            return False
        
        # Check new methods
        if hasattr(ui, 'prompt_chief_complaint_question'):
            print("✓ UI has prompt_chief_complaint_question method")
        else:
            print("✗ UI missing prompt_chief_complaint_question method")
            return False
        
        if hasattr(ui, 'prompt_vitals_selection'):
            print("✓ UI has prompt_vitals_selection method")
        else:
            print("✗ UI missing prompt_vitals_selection method")
            return False
        
        if hasattr(ui, 'prompt_intervention_selection'):
            print("✓ UI has prompt_intervention_selection method")
        else:
            print("✗ UI missing prompt_intervention_selection method")
            return False
        
        return True
    except Exception as e:
        print(f"✗ UI initialization failed: {e}")
        return False


def test_workflow_initialization():
    """Test workflow manager initialization (without API key)"""
    print("\nTesting workflow initialization...")
    
    try:
        from structured_triage import StructuredTriageWorkflow
        from user_interface import UserInterface
        from feedback_engine import FeedbackEngine
        
        ui = UserInterface()
        fe = FeedbackEngine()
        
        # We can't initialize PatientLLM without API key, so we skip that
        print("✓ Workflow components available")
        print("  (Note: LLM initialization requires valid API key in .env)")
        
        return True
    except Exception as e:
        print(f"✗ Workflow initialization failed: {e}")
        return False


def main():
    """Run all tests"""
    print("="*60)
    print("STRUCTURED TRIAGE WORKFLOW TEST SUITE")
    print("="*60)
    
    results = []
    
    results.append(("Module Imports", test_imports()))
    results.append(("Data Loading", test_data_loading()))
    results.append(("UI Initialization", test_ui_initialization()))
    results.append(("Workflow Components", test_workflow_initialization()))
    
    print("\n" + "="*60)
    print("TEST RESULTS")
    print("="*60)
    
    for test_name, passed in results:
        status = "PASS" if passed else "FAIL"
        symbol = "✓" if passed else "✗"
        print(f"{symbol} {test_name}: {status}")
    
    all_passed = all(result[1] for result in results)
    
    print("\n" + "="*60)
    if all_passed:
        print("ALL TESTS PASSED")
        print("\nNext steps:")
        print("1. Add your OpenAI API key to .env file")
        print("2. Run: python main_simulation.py")
    else:
        print("SOME TESTS FAILED")
        print("Please review the errors above")
    print("="*60)
    
    return 0 if all_passed else 1


if __name__ == "__main__":
    import sys
    sys.exit(main())

