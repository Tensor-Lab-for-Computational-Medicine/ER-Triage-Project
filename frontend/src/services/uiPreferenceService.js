const COACH_PREFERENCE_KEY = 'ed_triage_coach_enabled';

const DEFAULT_COACH_PREFERENCE = {
  enabled: false
};

let fallbackCoachPreference = DEFAULT_COACH_PREFERENCE;

function getStorage() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  return window.localStorage;
}

export function getCoachPreference() {
  const storage = getStorage();
  if (!storage) return fallbackCoachPreference;

  try {
    const savedValue = storage.getItem(COACH_PREFERENCE_KEY);
    if (savedValue === null) {
      fallbackCoachPreference = DEFAULT_COACH_PREFERENCE;
      return fallbackCoachPreference;
    }

    fallbackCoachPreference = {
      enabled: savedValue === 'true'
    };
    return fallbackCoachPreference;
  } catch {
    fallbackCoachPreference = DEFAULT_COACH_PREFERENCE;
    return fallbackCoachPreference;
  }
}

export function saveCoachPreference({ enabled } = {}) {
  const storage = getStorage();
  if (!storage) {
    fallbackCoachPreference = DEFAULT_COACH_PREFERENCE;
    return fallbackCoachPreference;
  }

  const nextPreference = {
    enabled: Boolean(enabled)
  };

  try {
    storage.setItem(COACH_PREFERENCE_KEY, String(nextPreference.enabled));
    fallbackCoachPreference = nextPreference;
    return fallbackCoachPreference;
  } catch {
    fallbackCoachPreference = DEFAULT_COACH_PREFERENCE;
    return fallbackCoachPreference;
  }
}
