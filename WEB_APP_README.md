# ER Triage Simulation - Web Application

A modern web-based version of the ER Triage Simulation with Flask backend and React frontend.

## Quick Start

### Prerequisites

- Python 3.7+ with dependencies installed
- Node.js 14+ and npm
- OpenRouter API key in `.env` file

### Running the Application

**Option 1: Use the development script (Recommended)**

```bash
./run_dev.sh
```

This will start both servers and open the app at http://localhost:3000

**Option 2: Manual startup**

Terminal 1 (Backend):
```bash
python app.py
```

Terminal 2 (Frontend):
```bash
cd frontend
npm start
```

Then open http://localhost:3000 in your browser.

## Architecture

### Backend (Flask - Port 5001)

- **File**: `app.py`
- **REST API** endpoints for each workflow step
- **Server-Sent Events (SSE)** for streaming LLM responses
- **In-memory session storage** for stateful interactions
- Reuses existing Python modules (data_loader, simulation_engine, llm_interface, feedback_engine)

### Frontend (React - Port 3000)

- **Single-page application** with 7 step workflow
- **Real-time streaming** of patient responses
- **Component-based architecture**:
  - `PatientInfo.js` - Step 1: Display patient demographics
  - `ChiefComplaint.js` - Step 2: Ask about chief complaint (streaming)
  - `VitalSigns.js` - Step 3: Select and view vital signs
  - `MedicalHistory.js` - Step 4: Ask about medical history (streaming)
  - `TriageAssignment.js` - Step 5: Assign ESI triage level
  - `Interventions.js` - Step 6: Order interventions
  - `Feedback.js` - Step 7: View comprehensive feedback

## API Endpoints

### POST `/api/start-simulation`
Start a new simulation session
- **Response**: `{session_id, age, sex, transport, complaint}`

### GET `/api/stream-chief-complaint/<session_id>?question=<text>`
Stream patient response to chief complaint question
- **Response**: Server-Sent Events stream

### POST `/api/get-vitals/<session_id>`
Get available vitals or selected results
- **Request**: `{vital_indices: [0,1,3]}` (optional)
- **Response**: `{available_vitals}` or `{vitals: [{name, value}, ...]}`

### GET `/api/stream-medical-history/<session_id>?question=<text>`
Stream patient response to medical history question
- **Response**: Server-Sent Events stream

### POST `/api/assign-triage/<session_id>`
Assign triage level
- **Request**: `{level: 2}`
- **Response**: `{success: true, level: 2}`

### GET `/api/get-interventions/<session_id>`
Get available interventions
- **Response**: `{interventions: [{index, value, name}, ...]}`

### POST `/api/select-interventions/<session_id>`
Select and perform interventions
- **Request**: `{intervention_indices: [1,2,6]}`
- **Response**: `{interventions_performed: [{value, name}, ...]}`

### GET `/api/feedback/<session_id>`
Get comprehensive feedback report
- **Response**: Full feedback object with session_summary, triage_analysis, clinical_feedback

### GET `/api/health`
Health check endpoint
- **Response**: `{status, cases_loaded, active_sessions}`

## Session Management

- **In-memory storage**: Sessions stored in Python dict by UUID
- **Automatic cleanup**: Sessions removed after feedback is generated
- **Stateful**: Each API call includes session_id to maintain state
- **No persistence**: Sessions lost on server restart (suitable for local dev)

## Features

- **Streaming LLM Responses**: Patient responses appear character-by-character in real-time
- **Step-by-Step Workflow**: Linear progression through 7 triage steps
- **Interactive UI**: Checkboxes for multi-select (vitals, interventions)
- **Real-time Feedback**: Comprehensive report comparing user decisions to ground truth
- **Medical-Themed Styling**: Clean, professional interface with card-based layout
- **Auto-restart**: Automatically starts new simulation after feedback

## Development Notes

### CORS
Flask-CORS is enabled to allow requests from React dev server (localhost:3000)

### Streaming Implementation
- Uses Server-Sent Events (SSE) via EventSource API
- OpenRouter OpenAI-compatible streaming API with `stream=True` parameter
- Chunks yielded in real-time to frontend

### State Management
Frontend uses React hooks:
- `useState` for component state
- `useEffect` for data fetching
- No external state management library needed

### Error Handling
- Backend returns appropriate HTTP status codes
- Frontend displays user-friendly error messages
- Network errors caught and handled gracefully

## File Structure

```
.
├── app.py                          # Flask backend
├── llm_interface.py                # Updated with streaming support
├── requirements.txt                # Backend dependencies
├── run_dev.sh                     # Development server launcher
└── frontend/
    ├── package.json               # Frontend dependencies
    ├── public/
    │   └── index.html
    └── src/
        ├── App.js                 # Main application component
        ├── index.js               # React entry point
        ├── components/
        │   ├── PatientInfo.js
        │   ├── ChiefComplaint.js
        │   ├── VitalSigns.js
        │   ├── MedicalHistory.js
        │   ├── TriageAssignment.js
        │   ├── Interventions.js
        │   ├── Feedback.js
        │   └── StreamingText.js
        ├── services/
        │   └── api.js             # API client layer
        └── styles/
            └── App.css            # Application styling
```

## Troubleshooting

### Backend won't start
- Check that all Python dependencies are installed: `pip install -r requirements.txt`
- Ensure `.env` file exists with valid `OPENROUTER_API_KEY`
- Verify port 5001 is not already in use

### Frontend won't start
- Run `npm install` in the `frontend/` directory
- Check that Node.js and npm are installed
- Verify port 3000 is not already in use

### "Failed to start simulation" error
- Make sure Flask backend is running on port 5001
- Check browser console for CORS errors
- Verify backend health at http://localhost:5001/api/health

### Streaming not working
- Ensure browser supports EventSource (all modern browsers do)
- Check network tab for SSE connection
- Verify the OpenRouter API key is valid and has credits

### Build for Production
```bash
cd frontend
npm run build
```

The optimized production build will be in `frontend/build/`. You can serve it with Flask by adding static file serving.

## Future Enhancements

- User authentication and accounts
- Database persistence for sessions
- Save/export feedback reports
- Mobile responsive improvements
- Dark mode toggle
- Multiple language support
- Voice input for questions

## License

Educational use with MIETIC dataset. Please ensure compliance with data use agreements.

