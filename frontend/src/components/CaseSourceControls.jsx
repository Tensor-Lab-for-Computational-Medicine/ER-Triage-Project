import React, { useRef, useState } from 'react';
import ClinicalGroundingLab from './ClinicalGroundingLab';
import { buildLocalTextbookKnowledgeBundle } from '../services/localTextbookIngestionService';

function CaseSourceControls({
  sourceState,
  knowledgeState,
  loading,
  onLoadLocalBundle,
  onUsePublicDemo,
  onLoadKnowledgeBundle,
  onClearKnowledgeBundle
}) {
  const inputRef = useRef(null);
  const knowledgeInputRef = useRef(null);
  const [error, setError] = useState('');
  const [knowledgeError, setKnowledgeError] = useState('');
  const [knowledgeImportStatus, setKnowledgeImportStatus] = useState(null);
  const [localSourceAcknowledged, setLocalSourceAcknowledged] = useState(false);

  const localMode = sourceState?.mode === 'mimic_restricted_local';
  const localKnowledge = knowledgeState?.local_bundle;
  const publicKnowledge = knowledgeState?.public_bundle || {};
  const embeddingRuntime = knowledgeState?.embedding_runtime || {};

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    if (!file.name.toLowerCase().endsWith('.json')) {
      setError('Select a generated restricted JSON bundle, not the raw MIMIC CSV/ZIP files. Choose data/restricted/mietic_mimic_main_ed_enriched_cases.restricted.json or data/restricted/mimic_iv_ed_supplemental_cases.restricted.json when validating local case banks.');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    try {
      const text = await file.text();
      await onLoadLocalBundle(text, file.name);
    } catch (err) {
      setError(`${err.message || 'Local case bundle could not be loaded.'} Choose a generated bundle such as data/restricted/mietic_mimic_main_ed_enriched_cases.restricted.json or data/restricted/mimic_iv_ed_supplemental_cases.restricted.json, not the raw PhysioNet download folder.`);
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleKnowledgeFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setKnowledgeError('');
    setKnowledgeImportStatus(null);
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.json') && !lowerName.endsWith('.pdf')) {
      setKnowledgeError('Select a clinical_knowledge_bundle JSON file or a locally licensed PDF reference.');
      if (knowledgeInputRef.current) knowledgeInputRef.current.value = '';
      return;
    }
    if (lowerName.endsWith('.pdf') && !localSourceAcknowledged) {
      setKnowledgeError('Confirm that you have rights to use this source locally before importing a PDF.');
      if (knowledgeInputRef.current) knowledgeInputRef.current.value = '';
      return;
    }
    try {
      if (lowerName.endsWith('.pdf')) {
        const bundle = await buildLocalTextbookKnowledgeBundle(file, {}, setKnowledgeImportStatus);
        await onLoadKnowledgeBundle(bundle, file.name);
      } else {
        const text = await file.text();
        await onLoadKnowledgeBundle(text, file.name);
      }
    } catch (err) {
      setKnowledgeError(err.message || 'Clinical knowledge bundle could not be loaded.');
    } finally {
      if (knowledgeInputRef.current) knowledgeInputRef.current.value = '';
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
              Expected local file: data/restricted/mietic_mimic_main_ed_enriched_cases.restricted.json or data/restricted/mimic_iv_ed_supplemental_cases.restricted.json
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
            tabIndex={-1}
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

        <div className="knowledge-source-panel">
          <div>
            <span className="eyebrow">Clinical knowledge</span>
            <h3>Reference grounding bundle</h3>
            <p>
              {localKnowledge
                ? 'A local clinical reference bundle is loaded in browser memory for citation retrieval.'
                : 'The public emergency medicine reference bundle is active. You can add a local licensed textbook bundle for private citation retrieval.'}
            </p>
            <div className="case-source-meta">
              <span>{knowledgeState?.public_bundle?.chunk_count || 0} public chunks</span>
              <span>{knowledgeState?.total_chunk_count || 0} total chunks</span>
              <span>{publicKnowledge.embedding_model || 'Xenova/bge-small-en-v1.5'}</span>
              <span>{publicKnowledge.embedding_dimensions || 384}d {publicKnowledge.distance || 'cosine'}</span>
              <span>{embeddingRuntime.storage || 'IndexedDB'} vectors</span>
              {localKnowledge && <span>{localKnowledge.file_name || localKnowledge.title}</span>}
              {localKnowledge?.source_tier === 'textbook' && <span>Local textbook</span>}
              {localKnowledge?.page_count ? <span>{localKnowledge.page_count} pages</span> : null}
            </div>
          </div>
          <label className="local-source-acknowledgement">
            <input
              type="checkbox"
              checked={localSourceAcknowledged}
              onChange={(event) => setLocalSourceAcknowledged(event.target.checked)}
              disabled={loading}
            />
            <span>I have rights to use uploaded sources locally.</span>
          </label>
          <div className="case-source-actions">
            <input
              ref={knowledgeInputRef}
              id="local-clinical-knowledge-bundle"
              type="file"
              accept=".json,.pdf,application/json,application/pdf"
              onChange={handleKnowledgeFile}
              disabled={loading}
              tabIndex={-1}
            />
            <label className="btn-secondary case-source-file-label" htmlFor="local-clinical-knowledge-bundle">
              Load Knowledge / PDF
            </label>
            {localKnowledge && (
              <button type="button" className="btn-secondary" onClick={onClearKnowledgeBundle} disabled={loading}>
                Clear Knowledge Bundle
              </button>
            )}
            <span className="provenance-tag inference-tag">Citations on</span>
          </div>
          {knowledgeImportStatus && (
            <div className="knowledge-import-status" role="status">
              <strong>{knowledgeImportStatus.message || 'Importing local source'}</strong>
              {knowledgeImportStatus.total ? (
                <span>{knowledgeImportStatus.current || 0}/{knowledgeImportStatus.total}</span>
              ) : null}
            </div>
          )}
          {knowledgeError && <div className="error-message compact-message">{knowledgeError}</div>}
          <ClinicalGroundingLab knowledgeState={knowledgeState} />
        </div>
      </div>
    </details>
  );
}

export default CaseSourceControls;
