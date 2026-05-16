const KOKORO_MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const KOKORO_DEVICE = 'wasm';
const KOKORO_DTYPE = 'q8';
const PATIENT_VOICE_ID = 'af_heart';
const PATIENT_VOICE_SPEED = 0.98;
const VOICE_CACHE_VERSION = 'kokoro_wasm_q8_af_heart_v3';
const VOICE_STORAGE_KEY = 'ed_triage_patient_voice_enabled';
const audioCache = new Map();

let ttsPromise = null;
let currentAudio = null;
let audioContext = null;
let activeSource = null;
let playbackToken = 0;

function mockVoiceConfig() {
  if (typeof window === 'undefined') return null;
  return window.__ED_TRIAGE_MOCK_PATIENT_VOICE__ || null;
}

function voiceForPatientSex(sex) {
  return PATIENT_VOICE_ID;
}

function speechSafeText(text) {
  return String(text || '')
    .replace(/^[\s"'`]+|[\s"'`]+$/g, '')
    .replace(/\b(\d+)\s*\/\s*10\b/g, '$1 out of 10')
    .replace(/\bBP\b/g, 'blood pressure')
    .replace(/\bSOB\b/gi, 'shortness of breath')
    .replace(/\bN\/V\b/gi, 'nausea and vomiting')
    .replace(/\bNPO\b/gi, 'nothing by mouth')
    .replace(/\bIV\b/g, 'I V')
    .replace(/\bTKO\b/g, 'to keep open')
    .replace(/\bSDH\b/gi, 'head injury')
    .replace(/\bHR\b/g, 'heart rate')
    .replace(/\bRR\b/g, 'respiratory rate')
    .replace(/\bSpO2\b/gi, 'oxygen level')
    .replace(/\b(\d+)\s*-\s*year\s*-\s*old\b/gi, '$1 year old')
    .replace(/\b(\d+)\s*yo\b/gi, '$1 year old')
    .replace(/&/g, ' and ')
    .replace(/[<>[\]{}|~^]/g, ' ')
    .replace(/([,.;:!?])(?=\S)/g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 420);
}

function splitSpeechChunks(text) {
  const safe = speechSafeText(text);
  if (!safe) return [];

  const sentences = safe
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const chunks = [];
  sentences.forEach((sentence) => {
    if (sentence.length <= 80) {
      chunks.push(sentence);
      return;
    }
    sentence
      .split(/,\s+|\s+-\s+|\s+\band\b\s+/i)
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((part) => chunks.push(part));
  });

  return chunks.slice(0, 4);
}

function hashVoiceText(text, voice) {
  const source = `${VOICE_CACHE_VERSION}:${voice}:${String(text || '')}`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function patientVoiceSupported() {
  return typeof window !== 'undefined' && (
    typeof window.Audio !== 'undefined' ||
    typeof window.AudioContext !== 'undefined' ||
    typeof window.webkitAudioContext !== 'undefined'
  );
}

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext) audioContext = new AudioContextClass();
  return audioContext;
}

export async function preparePatientVoicePlayback() {
  const context = getAudioContext();
  if (!context) return false;
  if (context.state === 'suspended') {
    await context.resume();
  }

  if (context.state !== 'running') return false;

  const source = context.createBufferSource();
  source.buffer = context.createBuffer(1, 1, context.sampleRate);
  source.connect(context.destination);
  source.start(0);
  return true;
}

async function loadKokoro(onStatus) {
  if (ttsPromise) return ttsPromise;

  ttsPromise = (async () => {
    const { KokoroTTS } = await import('kokoro-js');
    return KokoroTTS.from_pretrained(KOKORO_MODEL_ID, {
      device: KOKORO_DEVICE,
      dtype: KOKORO_DTYPE,
      progress_callback: () => {
        if (onStatus) onStatus('Loading patient voice');
      }
    });
  })();

  try {
    return await ttsPromise;
  } catch (error) {
    ttsPromise = null;
    throw error;
  }
}

function stopPatientVoice() {
  playbackToken += 1;
  if (activeSource) {
    try {
      activeSource.stop();
    } catch {
      // The source may already have ended.
    }
    activeSource = null;
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
}

async function mockSpeak(text, { onStatus } = {}) {
  const config = mockVoiceConfig();
  const delayMs = typeof config === 'object' ? Number(config.delayMs || 0) : 0;
  if (onStatus) onStatus('Loading patient voice');
  await Promise.resolve();
  if (onStatus) onStatus('Speaking');
  if (delayMs > 0) {
    await new Promise((resolve) => window.setTimeout(resolve, delayMs));
  }
  return { mocked: true, text };
}

async function synthesizePatientAnswer(text, { sex, onStatus } = {}) {
  const voice = voiceForPatientSex(sex);
  const cleanedText = speechSafeText(text);
  if (!cleanedText) throw new Error('No patient answer text is available for speech.');
  const cacheKey = hashVoiceText(cleanedText, voice);
  if (audioCache.has(cacheKey)) return audioCache.get(cacheKey);

  if (onStatus) onStatus('Loading patient voice');
  const tts = await loadKokoro(onStatus);
  if (onStatus) onStatus('Preparing patient voice');
  const rawAudio = await tts.generate(cleanedText, { voice, speed: PATIENT_VOICE_SPEED });
  const blob = rawAudio.toBlob();
  const objectUrl = URL.createObjectURL(blob);
  const result = { blob, objectUrl };
  audioCache.set(cacheKey, result);
  return result;
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function playWithAudioContext(blob) {
  const context = getAudioContext();
  if (!context) throw new Error('AudioContext is not available.');
  if (context.state === 'suspended') {
    await context.resume();
  }
  if (context.state !== 'running') {
    throw new Error('Audio playback is blocked until the browser receives a listen action.');
  }

  const buffer = await blob.arrayBuffer();
  const decoded = await context.decodeAudioData(buffer.slice(0));

  return new Promise((resolve, reject) => {
    try {
      if (activeSource) {
        try {
          activeSource.stop();
        } catch {
          // The source may already have ended.
        }
      }
      const source = context.createBufferSource();
      activeSource = source;
      source.buffer = decoded;
      source.connect(context.destination);
      source.onended = () => {
        if (activeSource === source) activeSource = null;
        resolve({ spoken: true, method: 'audio-context' });
      };
      source.start(0);
    } catch (error) {
      reject(error);
    }
  });
}

function playWithAudioElement(objectUrl) {
  const audio = new Audio(objectUrl);
  currentAudio = audio;

  return new Promise((resolve, reject) => {
    audio.onended = () => {
      if (currentAudio === audio) currentAudio = null;
      resolve({ spoken: true, method: 'audio-element' });
    };
    audio.onerror = () => {
      if (currentAudio === audio) currentAudio = null;
      reject(new Error('Patient voice playback failed.'));
    };
    const playResult = audio.play();
    if (playResult?.catch) {
      playResult.catch((error) => {
        if (currentAudio === audio) currentAudio = null;
        reject(error);
      });
    }
  });
}

export function getStoredPatientVoiceEnabled() {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(VOICE_STORAGE_KEY) === 'true';
}

export function setStoredPatientVoiceEnabled(enabled) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(VOICE_STORAGE_KEY, enabled ? 'true' : 'false');
}

export async function warmPatientVoice({ onStatus } = {}) {
  if (mockVoiceConfig()) {
    if (onStatus) onStatus('Loading patient voice');
    await Promise.resolve();
    if (onStatus) onStatus('Patient voice ready');
    return { mocked: true };
  }
  if (!patientVoiceSupported()) {
    throw new Error('Patient voice is unavailable in this browser.');
  }
  await preparePatientVoicePlayback();
  if (onStatus) onStatus('Loading patient voice');
  await loadKokoro(onStatus);
  if (onStatus) onStatus('Patient voice ready');
  return { loaded: true };
}

export async function speakPatientAnswer(text, options = {}) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return null;

  if (mockVoiceConfig()) {
    stopPatientVoice();
    return mockSpeak(trimmed, options);
  }

  if (!patientVoiceSupported()) {
    throw new Error('Patient voice is unavailable in this browser.');
  }

  stopPatientVoice();
  const token = playbackToken;
  await preparePatientVoicePlayback();
  const chunks = splitSpeechChunks(trimmed);
  if (!chunks.length) return null;
  if (options.onStatus) options.onStatus('Loading patient voice');

  let nextAudio = synthesizePatientAnswer(chunks[0], options);
  let lastResult = null;

  for (let index = 0; index < chunks.length; index += 1) {
    if (token !== playbackToken) return { cancelled: true };
    const audio = await nextAudio;
    if (index + 1 < chunks.length) {
      nextAudio = synthesizePatientAnswer(chunks[index + 1], options);
    }
    if (token !== playbackToken) return { cancelled: true };
    if (options.onStatus) options.onStatus('Speaking');
    try {
      lastResult = await playWithAudioContext(audio.blob);
    } catch {
      lastResult = await playWithAudioElement(audio.objectUrl);
    }
    if (token !== playbackToken) return { cancelled: true };
    if (index + 1 < chunks.length) await wait(90);
  }

  return lastResult;
}

export { stopPatientVoice, voiceForPatientSex };
