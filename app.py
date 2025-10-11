"""
Flask Backend for ER Triage Simulation Web App
Provides REST API endpoints for the React frontend
"""

from flask import Flask, jsonify, request, Response
from flask_cors import CORS
import uuid
import json
from typing import Dict, Any

# Import existing modules
from data_loader import DataLoader
from simulation_engine import SimulationEngine, InterventionType
from llm_interface import PatientLLM
from feedback_engine import FeedbackEngine

app = Flask(__name__)
CORS(app)  # Enable CORS for React dev server
app.config['SECRET_KEY'] = 'dev-secret-key-change-in-production'

# Initialize components
print("Initializing components...")
data_loader = DataLoader('MIETIC-validate-samples.csv')
llm = PatientLLM()
feedback_engine = FeedbackEngine()
print(f"Loaded {len(data_loader.cases)} cases")

# In-memory session storage (dict by session_id)
sessions: Dict[str, Dict[str, Any]] = {}


@app.route('/api/start-simulation', methods=['POST'])
def start_simulation():
    """Start a new simulation session with a random case"""
    try:
        # Get a random case
        case = data_loader.get_random_case()
        if not case:
            return jsonify({'error': 'No cases available'}), 500
        
        # Create new session
        session_id = str(uuid.uuid4())
        simulation = SimulationEngine(case)
        
        sessions[session_id] = {
            'case': case,
            'simulation': simulation,
            'checked_vitals': [],
            'chief_complaint_question': '',
            'chief_complaint_response': '',
            'medical_history_question': '',
            'medical_history_response': '',
            'triage_level': None,
            'interventions': []
        }
        
        # Return patient identification info
        return jsonify({
            'session_id': session_id,
            'age': int(case.demographics.age),
            'sex': case.demographics.sex,
            'transport': case.demographics.transport,
            'complaint': case.complaint
        })
    
    except Exception as e:
        print(f"Error starting simulation: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/stream-chief-complaint/<session_id>', methods=['GET'])
def stream_chief_complaint(session_id):
    """Stream LLM response for chief complaint question"""
    try:
        question = request.args.get('question', '')
        
        if session_id not in sessions:
            return jsonify({'error': 'Invalid session'}), 404
        
        session = sessions[session_id]
        session['chief_complaint_question'] = question
        case = session['case']
        
        def generate():
            full_response = []
            try:
                for chunk in llm.ask_with_streaming(case, question):
                    full_response.append(chunk)
                    yield f"data: {json.dumps({'chunk': chunk})}\n\n"
                
                # Store full response
                session['chief_complaint_response'] = ''.join(full_response)
                yield f"data: {json.dumps({'done': True})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
        
        return Response(generate(), mimetype='text/event-stream')
    
    except Exception as e:
        print(f"Error in stream_chief_complaint: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/get-vitals/<session_id>', methods=['POST'])
def get_vitals(session_id):
    """Get available vitals and selected results"""
    try:
        if session_id not in sessions:
            return jsonify({'error': 'Invalid session'}), 404
        
        session = sessions[session_id]
        case = session['case']
        vitals = case.vitals
        
        # Get request data
        data = request.get_json()
        
        # If no indices provided, return available vitals
        if 'vital_indices' not in data:
            available_vitals = []
            if vitals.hr is not None:
                available_vitals.append({'index': 0, 'name': 'Heart Rate', 'value': f"{vitals.hr} bpm"})
            if vitals.sbp is not None or vitals.dbp is not None:
                sbp_str = str(int(vitals.sbp)) if vitals.sbp is not None else '?'
                dbp_str = str(int(vitals.dbp)) if vitals.dbp is not None else '?'
                available_vitals.append({'index': 1, 'name': 'Blood Pressure', 'value': f"{sbp_str}/{dbp_str} mmHg"})
            if vitals.rr is not None:
                available_vitals.append({'index': 2, 'name': 'Respiratory Rate', 'value': f"{vitals.rr} breaths/min"})
            if vitals.o2 is not None:
                available_vitals.append({'index': 3, 'name': 'Oxygen Saturation', 'value': f"{vitals.o2}%"})
            if vitals.temp is not None:
                available_vitals.append({'index': 4, 'name': 'Temperature', 'value': f"{vitals.temp}°F"})
            if vitals.pain is not None:
                available_vitals.append({'index': 5, 'name': 'Pain Level', 'value': f"{vitals.pain}/10"})
            
            return jsonify({'available_vitals': available_vitals})
        
        # Get selected vitals
        vital_indices = data.get('vital_indices', [])
        all_vitals = []
        
        if vitals.hr is not None:
            all_vitals.append({'name': 'Heart Rate', 'value': f"{vitals.hr} bpm"})
        if vitals.sbp is not None or vitals.dbp is not None:
            sbp_str = str(int(vitals.sbp)) if vitals.sbp is not None else '?'
            dbp_str = str(int(vitals.dbp)) if vitals.dbp is not None else '?'
            all_vitals.append({'name': 'Blood Pressure', 'value': f"{sbp_str}/{dbp_str} mmHg"})
        if vitals.rr is not None:
            all_vitals.append({'name': 'Respiratory Rate', 'value': f"{vitals.rr} breaths/min"})
        if vitals.o2 is not None:
            all_vitals.append({'name': 'Oxygen Saturation', 'value': f"{vitals.o2}%"})
        if vitals.temp is not None:
            all_vitals.append({'name': 'Temperature', 'value': f"{vitals.temp}°F"})
        if vitals.pain is not None:
            all_vitals.append({'name': 'Pain Level', 'value': f"{vitals.pain}/10"})
        
        selected_vitals = [all_vitals[i] for i in vital_indices if i < len(all_vitals)]
        session['checked_vitals'] = selected_vitals
        
        return jsonify({'vitals': selected_vitals})
    
    except Exception as e:
        print(f"Error in get_vitals: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/stream-medical-history/<session_id>', methods=['GET'])
def stream_medical_history(session_id):
    """Stream LLM response for medical history question"""
    try:
        question = request.args.get('question', '')
        
        if session_id not in sessions:
            return jsonify({'error': 'Invalid session'}), 404
        
        session = sessions[session_id]
        session['medical_history_question'] = question
        case = session['case']
        
        def generate():
            full_response = []
            try:
                for chunk in llm.ask_with_streaming(case, question):
                    full_response.append(chunk)
                    yield f"data: {json.dumps({'chunk': chunk})}\n\n"
                
                # Store full response
                session['medical_history_response'] = ''.join(full_response)
                yield f"data: {json.dumps({'done': True})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
        
        return Response(generate(), mimetype='text/event-stream')
    
    except Exception as e:
        print(f"Error in stream_medical_history: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/assign-triage/<session_id>', methods=['POST'])
def assign_triage(session_id):
    """Assign triage level"""
    try:
        if session_id not in sessions:
            return jsonify({'error': 'Invalid session'}), 404
        
        data = request.get_json()
        triage_level = data.get('level')
        
        if triage_level not in [1, 2, 3, 4, 5]:
            return jsonify({'error': 'Invalid triage level'}), 400
        
        sessions[session_id]['triage_level'] = triage_level
        
        return jsonify({'success': True, 'level': triage_level})
    
    except Exception as e:
        print(f"Error in assign_triage: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/get-interventions/<session_id>', methods=['GET'])
def get_interventions(session_id):
    """Get available interventions"""
    try:
        if session_id not in sessions:
            return jsonify({'error': 'Invalid session'}), 404
        
        session = sessions[session_id]
        simulation = session['simulation']
        
        available = simulation.get_available_interventions()
        
        # Map to display names
        display_names = {
            "invasive_ventilation": "Perform Endotracheal Intubation",
            "intravenous": "Start IV Access",
            "intravenous_fluids": "Start IV Fluids",
            "intramuscular": "Give IM Medication",
            "oral_medications": "Give Oral Medication",
            "nebulized_medications": "Give Nebulized Treatment",
            "tier1_med_usage_1h": "Administer Emergency Medication",
            "tier2_med_usage": "Administer Urgent Medication",
            "tier3_med_usage": "Administer Stabilizing Medication",
            "tier4_med_usage": "Administer Routine Medication",
            "critical_procedure": "Perform Emergency Procedure",
            "psychotropic_med_within_120min": "Administer Psychotropic Medication"
        }
        
        interventions_list = []
        for i, intervention in enumerate(available):
            interventions_list.append({
                'index': i,
                'value': intervention.value,
                'name': display_names.get(intervention.value, intervention.value.replace('_', ' ').title())
            })
        
        return jsonify({'interventions': interventions_list})
    
    except Exception as e:
        print(f"Error in get_interventions: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/select-interventions/<session_id>', methods=['POST'])
def select_interventions(session_id):
    """Select and perform interventions"""
    try:
        if session_id not in sessions:
            return jsonify({'error': 'Invalid session'}), 404
        
        session = sessions[session_id]
        simulation = session['simulation']
        data = request.get_json()
        intervention_indices = data.get('intervention_indices', [])
        
        available = simulation.get_available_interventions()
        
        # Map to display names
        display_names = {
            "invasive_ventilation": "Perform Endotracheal Intubation",
            "intravenous": "Start IV Access",
            "intravenous_fluids": "Start IV Fluids",
            "intramuscular": "Give IM Medication",
            "oral_medications": "Give Oral Medication",
            "nebulized_medications": "Give Nebulized Treatment",
            "tier1_med_usage_1h": "Administer Emergency Medication",
            "tier2_med_usage": "Administer Urgent Medication",
            "tier3_med_usage": "Administer Stabilizing Medication",
            "tier4_med_usage": "Administer Routine Medication",
            "critical_procedure": "Perform Emergency Procedure",
            "psychotropic_med_within_120min": "Administer Psychotropic Medication"
        }
        
        performed = []
        for idx in intervention_indices:
            if idx < len(available):
                intervention = available[idx]
                result = simulation.perform_intervention(intervention)
                if result['success']:
                    performed.append({
                        'value': intervention.value,
                        'name': display_names.get(intervention.value, intervention.value.replace('_', ' ').title())
                    })
        
        session['interventions'] = performed
        
        return jsonify({'interventions_performed': performed})
    
    except Exception as e:
        print(f"Error in select_interventions: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/feedback/<session_id>', methods=['GET'])
def get_feedback(session_id):
    """Generate and return comprehensive feedback"""
    try:
        print(f"Feedback request for session: {session_id}")
        print(f"Active sessions: {list(sessions.keys())}")
        
        if session_id not in sessions:
            print(f"Session {session_id} not found!")
            return jsonify({'error': 'Session not found or already completed'}), 404
        
        session = sessions[session_id]
        case = session['case']
        simulation = session['simulation']
        triage_level = session['triage_level']
        
        print(f"Triage level: {triage_level}")
        
        if triage_level is None:
            print("Triage level not assigned!")
            return jsonify({'error': 'Triage level not assigned'}), 400
        
        # Create session record
        user_actions = [
            {'action': 'chief_complaint_question', 'question': session['chief_complaint_question']},
            {'action': 'medical_history_question', 'question': session['medical_history_question']},
            {'action': 'triage', 'level': triage_level}
        ]
        
        print("Creating feedback session record...")
        feedback_session = feedback_engine.create_session_record(
            case, simulation, triage_level, user_actions,
            session['checked_vitals']
        )
        
        # Add questions to session
        feedback_session.chief_complaint_question = session['chief_complaint_question']
        feedback_session.medical_history_question = session['medical_history_question']
        
        # Generate feedback
        print("Generating comprehensive feedback...")
        feedback = feedback_engine.generate_comprehensive_feedback(
            feedback_session, case, simulation
        )
        
        print("Feedback generated successfully!")
        
        # Clean up session
        del sessions[session_id]
        print(f"Session {session_id} cleaned up")
        
        return jsonify(feedback)
    
    except Exception as e:
        import traceback
        print(f"Error in get_feedback: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'cases_loaded': len(data_loader.cases),
        'active_sessions': len(sessions)
    })


if __name__ == '__main__':
    print("Starting Flask server on http://localhost:5001")
    app.run(debug=True, port=5001, threaded=True)

