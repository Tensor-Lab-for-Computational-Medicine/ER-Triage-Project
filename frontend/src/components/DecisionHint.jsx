import React, { useEffect, useState } from 'react';
import { getDecisionCoach } from '../services/api';

function compactList(items = [], empty = 'No required gap is open.') {
  if (!items.length) return empty;
  return items.slice(0, 3).join('; ');
}

function DecisionHint({ sessionId, stage, learnerContext = '' }) {
  const [hint, setHint] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setHint(null);
    setError('');
    getDecisionCoach(sessionId, stage)
      .then((data) => {
        if (!cancelled) setHint(data);
      })
      .catch(() => {
        if (!cancelled) setError('Local decision guidance is unavailable.');
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, stage]);

  if (!hint) return null;

  return (
    <aside className="decision-hint" aria-label="Decision hint">
      <div>
        <span>Missing</span>
        <strong>{hint ? compactList(hint.still_missing) : error}</strong>
      </div>
      {hint && (
        <div>
          <span>Next</span>
          <strong>{hint.next_best_action}</strong>
        </div>
      )}
    </aside>
  );
}

export default DecisionHint;
