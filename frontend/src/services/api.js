/**
 * API Service Layer
 * Handles all communication with Flask backend
 */

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api';

/**
 * Start a new simulation session
 */
export const startSimulation = async () => {
  const response = await axios.post(`${API_BASE_URL}/start-simulation`);
  return response.data;
};

/**
 * Get available vitals for a session
 */
export const getAvailableVitals = async (sessionId) => {
  const response = await axios.post(`${API_BASE_URL}/get-vitals/${sessionId}`, {});
  return response.data.available_vitals;
};

/**
 * Get selected vitals results
 */
export const getVitals = async (sessionId, vitalIndices) => {
  const response = await axios.post(`${API_BASE_URL}/get-vitals/${sessionId}`, {
    vital_indices: vitalIndices
  });
  return response.data.vitals;
};

/**
 * Stream chief complaint response
 */
export const streamChiefComplaint = (sessionId, question, onChunk, onDone, onError) => {
  const encodedQuestion = encodeURIComponent(question);
  const eventSource = new EventSource(
    `${API_BASE_URL}/stream-chief-complaint/${sessionId}?question=${encodedQuestion}`
  );
  
  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.done) {
      eventSource.close();
      if (onDone) onDone();
    } else if (data.error) {
      eventSource.close();
      if (onError) onError(data.error);
    } else if (data.chunk) {
      if (onChunk) onChunk(data.chunk);
    }
  };
  
  eventSource.onerror = (error) => {
    eventSource.close();
    if (onError) onError('Connection error');
  };
  
  return eventSource;
};

/**
 * Stream medical history response
 */
export const streamMedicalHistory = (sessionId, question, onChunk, onDone, onError) => {
  const encodedQuestion = encodeURIComponent(question);
  const eventSource = new EventSource(
    `${API_BASE_URL}/stream-medical-history/${sessionId}?question=${encodedQuestion}`
  );
  
  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.done) {
      eventSource.close();
      if (onDone) onDone();
    } else if (data.error) {
      eventSource.close();
      if (onError) onError(data.error);
    } else if (data.chunk) {
      if (onChunk) onChunk(data.chunk);
    }
  };
  
  eventSource.onerror = (error) => {
    eventSource.close();
    if (onError) onError('Connection error');
  };
  
  return eventSource;
};

/**
 * Assign triage level
 */
export const assignTriage = async (sessionId, level, rationale = '') => {
  const response = await axios.post(`${API_BASE_URL}/assign-triage/${sessionId}`, {
    level: level,
    rationale: rationale
  });
  return response.data;
};

/**
 * Get available interventions
 */
export const getInterventions = async (sessionId) => {
  const response = await axios.get(`${API_BASE_URL}/get-interventions/${sessionId}`);
  return response.data.interventions;
};

/**
 * Select and perform interventions
 */
export const selectInterventions = async (sessionId, interventionIndices) => {
  const response = await axios.post(`${API_BASE_URL}/select-interventions/${sessionId}`, {
    intervention_indices: interventionIndices
  });
  return response.data.interventions_performed;
};

/**
 * Get comprehensive feedback
 */
export const getFeedback = async (sessionId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/feedback/${sessionId}`);
    return response.data;
  } catch (error) {
    console.error('API Error in getFeedback:', error.response || error);
    if (error.response) {
      throw new Error(error.response.data.error || `Server error: ${error.response.status}`);
    }
    throw error;
  }
};

/**
 * Ask the post-case clinical tutor a question
 */
export const askTutorQuestion = async (sessionId, question) => {
  const response = await axios.post(`${API_BASE_URL}/tutor/${sessionId}`, {
    question: question
  });
  return response.data.answer;
};

/**
 * Health check
 */
export const healthCheck = async () => {
  const response = await axios.get(`${API_BASE_URL}/health`);
  return response.data;
};

