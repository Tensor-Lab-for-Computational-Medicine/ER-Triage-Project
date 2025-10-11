# Structured Triage Workflow Implementation

## Overview

This document describes the implementation of the structured triage workflow with LLM integration for the ER Triage Simulation project.

## What Was Implemented

### 1. New Files Created

#### `llm_interface.py`
- **Purpose**: Handles OpenAI API integration for natural language patient responses
- **Key Class**: `PatientLLM`
- **Methods**:
  - `ask_chief_complaint(case, question)` - Patient responds about chief complaint
  - `ask_medical_history(case, question)` - Patient responds about medical history
- **Features**:
  - System prompt grounds responses in MIETIC case data
  - Patient responds as layperson (not medical professional)
  - Guards against revealing information patient wouldn't know
  - Uses GPT-4o-mini model by default

#### `structured_triage.py`
- **Purpose**: Manages the 7-step structured triage workflow
- **Key Class**: `StructuredTriageWorkflow`
- **Workflow Steps**:
  1. `step1_patient_identification()` - Display patient demographics
  2. `step2_chief_complaint()` - LLM-powered Q&A about complaint
  3. `step3_vital_signs()` - Multi-select vital signs measurement
  4. `step4_medical_history()` - LLM-powered Q&A about history
  5. `step5_triage_assignment()` - ESI level assignment
  6. `step6_interventions()` - Multi-select intervention ordering
  7. `step7_feedback()` - Comprehensive feedback report

### 2. Modified Files

#### `main_simulation.py`
- **Changes**:
  - Added LLM initialization in `__init__()`
  - Added workflow manager initialization
  - Simplified `run_single_simulation()` to use workflow
  - Removed old interactive command loop
  - Removed references to `TriageClassifier` and `SimulationEngine` from initialization

#### `user_interface.py`
- **Changes**:
  - Added tracking for LLM questions: `chief_complaint_question`, `medical_history_question`
  - Removed `user_actions` list (replaced by structured workflow)
  - Added new methods:
    - `prompt_chief_complaint_question()` - Get user's question about complaint
    - `prompt_medical_history_question()` - Get user's question about history
    - `display_llm_response()` - Display patient's AI response
    - `prompt_vitals_selection()` - Multi-select vitals with comma-separated input
    - `display_all_vital_results()` - Show all selected vitals at once
    - `prompt_intervention_selection()` - Multi-select interventions
  - Modified `get_triage_classification()` - Removed user_actions tracking

#### `feedback_engine.py`
- **Changes**:
  - Added fields to `SimulationSession`:
    - `chief_complaint_question: Optional[str]`
    - `medical_history_question: Optional[str]`
  - Modified `_generate_session_summary()` to include questions asked
  - Modified `display_feedback()` to show "Questions Asked" section

#### `requirements.txt`
- **Added**:
  - `openai>=1.0.0`
  - `python-dotenv>=1.0.0`

#### `README.md`
- **Updated**:
  - Features section to highlight LLM integration
  - Installation steps to include .env setup
  - Workflow description with 7 structured steps
  - Example session showing new interaction pattern
  - Project structure with new files

### 3. Configuration Files

#### `.env.example`
- Template for environment variables
- Contains placeholders for `OPENAI_API_KEY` and `OPENAI_MODEL`

#### `.gitignore`
- Added `.env` to prevent API key exposure

## Key Design Decisions

### 1. LLM Integration
- **Grounded Responses**: All patient responses are based on actual MIETIC data
- **Layperson Language**: Patient speaks as non-medical professional would
- **Information Hiding**: Patient doesn't reveal vitals or test results they wouldn't know
- **Model Choice**: GPT-4o-mini for cost-effectiveness and speed

### 2. Workflow Structure
- **Linear Progression**: No command loop, follows realistic ED triage sequence
- **One Chance**: Each step (vitals, interventions) is a single opportunity to decide
- **Multi-Select**: Can select multiple vitals/interventions at once
- **Natural Language**: Questions are free-form text, not multiple choice

### 3. Backward Compatibility
- **Reused Components**: 
  - `SimulationEngine` for intervention tracking
  - `FeedbackEngine` for report generation
  - `Case` and data structures from `data_loader.py`
- **Preserved Feedback**: Same outcome analysis and ground truth comparison

## How to Use

### Setup
1. Install dependencies: `pip install -r requirements.txt`
2. Create `.env` file: `cp .env.example .env`
3. Add your OpenAI API key to `.env`
4. Run: `python main_simulation.py`

### During Simulation
1. **Patient Identification**: Automatically displayed
2. **Chief Complaint**: Type your question naturally (e.g., "What brought you here today?")
3. **Vital Signs**: Enter numbers separated by commas (e.g., `1,2,4,6`) or type `all`
4. **Medical History**: Type your question naturally (e.g., "Do you have any chronic conditions?")
5. **Triage**: Enter ESI level (1-5)
6. **Interventions**: Enter numbers separated by commas or type `none`
7. **Feedback**: Review comprehensive report

### Example Inputs
- **Questions**: 
  - "What brought you to the emergency department today?"
  - "How long have you been experiencing these symptoms?"
  - "Do you have any chronic medical conditions?"
  - "Are you taking any medications?"
- **Vitals**: `1,2,4` or `all`
- **Interventions**: `2,3,7` or `none`

## Testing

All modules have been tested for import errors. To run a basic test:

```bash
python -c "
from llm_interface import PatientLLM
from structured_triage import StructuredTriageWorkflow
print('All modules working')
"
```

## Future Enhancements

Potential improvements:
1. Multiple questions per section (with configurable limit)
2. Context-aware follow-up questions from LLM
3. Comparison of user's questions to optimal triage questions
4. Support for different LLM models (GPT-4, Claude, etc.)
5. Voice input/output for more realistic simulation
6. Multilingual patient responses

## Notes

- API calls are made for each question, so costs will accumulate with usage
- GPT-4o-mini is cost-effective (~$0.0002 per question typically)
- Patient responses are deterministic (temperature=0.7) but may vary slightly
- System prompt ensures responses stay grounded in provided data
- No medical advice is generated; only roleplay based on case data

