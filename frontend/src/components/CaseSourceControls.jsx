import React, { useRef, useState } from 'react';

function CaseSourceControls({ sourceState, loading, onLoadLocalBundle, onUsePublicDemo }) {
  const inputRef = useRef(null);
  const [error, setError] = useState('');

  const localMode = sourceState?.mode === 'mimic_restricted_local';

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    if (!file.name.toLowerCase().endsWith('.json')) {
      setError('Select the generated restricted JSON bundle, not the raw MIMIC CSV/ZIP files. Run python scripts/generate_mimic_restricted_cases.py, then choose data/restricted/mimic_iv_ext_cases.restricted.json.');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    try {
      const text = await file.text();
      await onLoadLocalBundle(text, file.name);
    } catch (err) {
      setError(`${err.message || 'Local case bundle could not be loaded.'} Choose the generated bundle at data/restricted/mimic_iv_ext_cases.restricted.json, not the raw PhysioNet download folder.`);
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <details className={`case-source-banner ${localMode ? 'restricted-mode' : 'public-mode'}`} aria-label="Case source mode" role="group">
      <summary>
        <span className="data-chip">
          Data: {localMode ? 'Local MIMIC' : 'Public demo'}
        </span>
        <span className="case-source-summary-label">Change data</span>
      </summary>

      <div className="case-source-drawer">
        <div>
          <span className="eyebrow">Case source</span>
          <h2>{sourceState?.label || 'Public demo mode'}</h2>
          <p>
            {localMode
              ? 'MIMIC-IV-Ext-CDS cases are loaded locally for validation and research review only.'
              : 'This public demo uses a nonrestricted case bundle. To use MIMIC, choose the generated restricted JSON bundle, not the raw CSV/ZIP folder.'}
          </p>
          {!localMode && (
            <p className="case-source-path">
              Expected local file: data/restricted/mimic_iv_ext_cases.restricted.json
            </p>
          )}
          <div className="case-source-meta">
            <span>{sourceState?.dataset || 'Nonrestricted demo bundle'}</span>
            <span>{sourceState?.case_count || 0} cases available</span>
            <span>{sourceState?.restriction || 'public_demo'}</span>
            {sourceState?.file_name && <span>{sourceState.file_name}</span>}
          </div>
        </div>

        <div className="case-source-actions">
          <input
            ref={inputRef}
            id="local-case-bundle"
            type="file"
            accept=".json,application/json"
            onChange={handleFile}
            disabled={loading}
          />
          <label className="btn-secondary case-source-file-label" htmlFor="local-case-bundle">
            Load Local MIMIC Bundle
          </label>
          {localMode && (
            <button type="button" className="btn-secondary" onClick={onUsePublicDemo} disabled={loading}>
              Use Public Demo
            </button>
          )}
          <span className="provenance-tag warning-tag">Validation first</span>
        </div>
        {error && <div className="error-message compact-message">{error}</div>}
      </div>
    </details>
  );
}

export default CaseSourceControls;
