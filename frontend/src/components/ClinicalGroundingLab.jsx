import React, { useMemo, useState } from 'react';
import { prewarmSemanticCache, queryClinicalReferences } from '../services/api';
import clinicalRetrievalMatrix from '../data/clinical_retrieval_matrix.json';
import {
  EvidenceStatusBadge,
  SourceVerificationActions,
  SourceVerificationBadge,
  SourceVerificationDrawer
} from './SourceVerification';

const TASK_OPTIONS = [
  'triage',
  'diagnosis',
  'management',
  'reassessment',
  'sbar',
  'tutor'
];

const SOURCE_MODE_OPTIONS = [
  { value: 'guidelines_first', label: 'Guidelines first' },
  { value: 'public_only', label: 'Public only' },
  { value: 'local_textbook_only', label: 'Local textbook only' },
  { value: 'all_sources', label: 'All sources' }
];

const PRESET_QUERIES = clinicalRetrievalMatrix;

function referenceMatchesPreset(reference, preset) {
  const expectedTags = preset.expected_tags || preset.expectedTags || [preset.expectedTag];
  return expectedTags.some((tag) => (reference?.topic_tags || []).includes(tag));
}

function sourceCounts(references = []) {
  return references.reduce((counts, reference) => {
    counts[reference.source_id] = (counts[reference.source_id] || 0) + 1;
    return counts;
  }, {});
}

function referencesPassPreset(references = [], preset = {}) {
  const expectedFacets = preset.expected_facets || [];
  const allowedSourceIds = preset.allowed_source_ids || [];
  const forbiddenTags = preset.forbidden_topic_tags || [];
  const forbiddenTerms = (preset.forbidden_terms || []).map((term) => term.toLowerCase());
  const counts = sourceCounts(references);
  const uniqueSourceCount = Object.keys(counts).length;
  const maxPerSource = preset.max_per_source || references.length;
  const minUniqueSources = Math.min(preset.min_unique_sources || 1, allowedSourceIds.length || references.length);
  const topText = references.map((reference) => reference.snippet || reference.text || '').join(' ').toLowerCase();
  const hasQuoteBackedCitation = references.some((reference) =>
    reference.quote_backed && reference.supporting_quotes?.length && reference.verification_status === 'human_verified'
  );
  return references.length > 0 &&
    hasQuoteBackedCitation &&
    references.some((reference) => referenceMatchesPreset(reference, preset)) &&
    (!expectedFacets.length || references.some((reference) => expectedFacets.includes(reference.facet_id))) &&
    (!allowedSourceIds.length || references.some((reference) => allowedSourceIds.includes(reference.source_id))) &&
    !references.some((reference) => (reference.topic_tags || []).some((tag) => forbiddenTags.includes(tag))) &&
    !forbiddenTerms.some((term) => topText.includes(term)) &&
    uniqueSourceCount >= minUniqueSources &&
    Object.values(counts).every((count) => count <= maxPerSource);
}

function statusText(result) {
  if (!result) return 'Not run';
  if (result.fail_closed) return 'Fail closed';
  if (result.references?.length) return 'References found';
  return 'No match';
}

function qualityStatusText(result) {
  const quality = result?.retrieval_quality;
  if (!quality) return 'Quality not reported';
  const mode = String(quality.semantic_status || '').replaceAll('_', ' ');
  return `${quality.badge} - ${mode} - top ${quality.top_base_score} / min ${quality.minimum_base_score_required}`;
}

function ClinicalGroundingLab({ knowledgeState }) {
  const [query, setQuery] = useState(PRESET_QUERIES[0].query);
  const [task, setTask] = useState(PRESET_QUERIES[0].task);
  const [maxResults, setMaxResults] = useState(5);
  const [useSemantic, setUseSemantic] = useState(true);
  const [quoteBackedOnly, setQuoteBackedOnly] = useState(true);
  const [sourceMode, setSourceMode] = useState('guidelines_first');
  const [result, setResult] = useState(null);
  const [smokeResults, setSmokeResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [smokeLoading, setSmokeLoading] = useState(false);
  const [warming, setWarming] = useState(false);
  const [warmResult, setWarmResult] = useState(null);
  const [error, setError] = useState('');
  const [verificationReference, setVerificationReference] = useState(null);

  const smokeSummary = useMemo(() => {
    if (!smokeResults.length) return null;
    const passing = smokeResults.filter((item) => item.pass).length;
    return `${passing}/${smokeResults.length} checks passing`;
  }, [smokeResults]);

  const runQuery = async (nextQuery = query, nextTask = task) => {
    setLoading(true);
    setError('');
    try {
      const response = await queryClinicalReferences({
        queryText: nextQuery,
        task: nextTask,
        maxResults: Number(maxResults) || 5,
        includePrivateSources: sourceMode !== 'public_only',
        includeSnippets: true,
        useSemantic,
        quoteBackedOnly,
        sourceMode
      });
      setResult(response);
      setVerificationReference(null);
    } catch (err) {
      setError(err.message || 'Clinical retrieval test failed.');
    } finally {
      setLoading(false);
    }
  };

  const runPreset = (preset) => {
    setQuery(preset.query);
    setTask(preset.task);
    runQuery(preset.query, preset.task);
  };

  const runSmokeSet = async () => {
    setSmokeLoading(true);
    setError('');
    const rows = [];
    try {
      for (const preset of PRESET_QUERIES) {
        const response = await queryClinicalReferences({
          queryText: preset.query,
          task: preset.task,
          maxResults: 5,
          includePrivateSources: false,
          includeSnippets: false,
          useSemantic,
          quoteBackedOnly: true,
          sourceMode: 'public_only'
        });
        const references = response.references || [];
        const matched = referencesPassPreset(references, preset);
        rows.push({
          ...preset,
          pass: matched && !response.fail_closed && response.retrieval_quality?.threshold_passed,
          referenceCount: references.length,
          topReference: references[0] || null,
          uniqueSourceCount: Object.keys(sourceCounts(references)).length,
          warning: response.warnings?.[0] || '',
          failClosed: response.fail_closed,
          retrievalQuality: response.retrieval_quality || null
        });
      }
      setSmokeResults(rows);
    } catch (err) {
      setError(err.message || 'Smoke test failed.');
    } finally {
      setSmokeLoading(false);
    }
  };

  const warmModel = async () => {
    setWarming(true);
    setError('');
    try {
      const response = await prewarmSemanticCache();
      setWarmResult(response);
    } catch (err) {
      setError(err.message || 'Embedding model could not be warmed.');
    } finally {
      setWarming(false);
    }
  };

  return (
    <details className="grounding-test-lab" aria-label="Clinical grounding test lab">
      <summary>
        <span>Retrieval Test Lab</span>
        <span className="grounding-lab-status">{knowledgeState?.total_chunk_count || 0} chunks</span>
      </summary>

      <div className="grounding-lab-body">
        <div className="grounding-lab-meta" aria-label="Clinical knowledge bundle status">
          <span>{knowledgeState?.total_source_count || 0} sources</span>
          <span>{knowledgeState?.total_chunk_count || 0} chunks</span>
          <span>{knowledgeState?.public_bundle?.embedding_model || 'Xenova/bge-small-en-v1.5'}</span>
          <span>{knowledgeState?.public_bundle?.embedding_dimensions || 384}d cosine</span>
          <span>{warmResult?.ready || knowledgeState?.embedding_runtime?.ready ? 'Semantic ready' : 'BM25 fallback ready'}</span>
        </div>

        <div className="grounding-lab-actions">
          <button type="button" className="btn-secondary" onClick={warmModel} disabled={warming}>
            {warming ? 'Loading vector model...' : 'Load vector model'}
          </button>
          <button type="button" className="btn-secondary" onClick={runSmokeSet} disabled={smokeLoading}>
            {smokeLoading ? 'Running checks...' : 'Run smoke set'}
          </button>
        </div>

        {smokeSummary && (
          <div className={`grounding-smoke-summary ${smokeResults.every((item) => item.pass) ? 'pass' : 'review'}`}>
            {smokeSummary}
          </div>
        )}

        {smokeResults.length > 0 && (
          <div className="grounding-smoke-grid" aria-label="Clinical grounding smoke test results">
            {smokeResults.map((item) => (
              <div key={item.label} className={`grounding-smoke-item ${item.pass ? 'pass' : 'review'}`}>
                <strong>{item.label}</strong>
                <span>{item.pass ? 'Matched expected topic' : 'Needs review'}</span>
                <small>{item.topReference?.citation_label || 'No citation'} {item.topReference?.source_title || ''} - {item.uniqueSourceCount || 0} sources - {item.retrievalQuality?.badge || 'quality pending'}</small>
              </div>
            ))}
          </div>
        )}

        <div className="grounding-preset-grid" aria-label="Preset clinical retrieval queries">
          {PRESET_QUERIES.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="grounding-preset-button"
              onClick={() => runPreset(preset)}
              disabled={loading}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <form
          className="grounding-query-form"
          onSubmit={(event) => {
            event.preventDefault();
            runQuery();
          }}
        >
          <label className="premium-textarea-label" htmlFor="grounding-query">
            Retrieval query
          </label>
          <textarea
            id="grounding-query"
            className="premium-textarea"
            rows={3}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="grounding-query-controls">
            <label>
              <span>Task</span>
              <select className="premium-input" value={task} onChange={(event) => setTask(event.target.value)}>
                {TASK_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Results</span>
              <input
                className="premium-input"
                type="number"
                min="1"
                max="10"
                value={maxResults}
                onChange={(event) => setMaxResults(event.target.value)}
              />
            </label>
            <label>
              <span>Sources</span>
              <select className="premium-input" value={sourceMode} onChange={(event) => setSourceMode(event.target.value)}>
                {SOURCE_MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="grounding-toggle-row">
              <input
                type="checkbox"
                checked={useSemantic}
                onChange={(event) => setUseSemantic(event.target.checked)}
              />
              <span>Semantic rerank</span>
            </label>
            <label className="grounding-toggle-row">
              <input
                type="checkbox"
                checked={quoteBackedOnly}
                onChange={(event) => setQuoteBackedOnly(event.target.checked)}
              />
              <span>Quote-backed only</span>
            </label>
          </div>
          <button type="submit" className="btn-primary" disabled={loading || !query.trim()}>
            {loading ? 'Retrieving...' : 'Run retrieval'}
          </button>
        </form>

        {error && <div className="error-message compact-message">{error}</div>}

        {result && (
          <div className="grounding-results" aria-label="Clinical retrieval results">
            <div className="grounding-result-header">
              <strong>{statusText(result)}</strong>
              <span>{result.references?.length || 0} references</span>
              <span>{result.retrieval_mode}</span>
              <span>{SOURCE_MODE_OPTIONS.find((option) => option.value === result.source_mode)?.label || result.source_mode}</span>
              <span>{result.semantic_ready ? 'semantic ready' : 'lexical fallback'}</span>
              <span>{result.vector_assets_loaded ? 'vector assets loaded' : 'runtime vectors pending'}</span>
              <span className={`retrieval-quality-badge ${result.retrieval_quality?.fail_closed ? 'fail' : 'pass'}`}>
                {result.retrieval_quality?.badge || 'Quality pending'}
              </span>
            </div>

            {result.retrieval_quality && (
              <div className={`retrieval-quality-panel ${result.retrieval_quality.fail_closed ? 'review' : 'pass'}`} aria-label="Retrieval quality badge">
                <strong>{qualityStatusText(result)}</strong>
                <span>{result.retrieval_quality.threshold_passed ? 'threshold passed' : 'threshold not met'}</span>
                <span>{result.retrieval_quality.quote_backed_only_required ? 'quote-backed required' : 'reviewed evidence allowed'}</span>
                <span>{result.retrieval_quality.semantic_fallback_visible ? 'fallback visible' : 'semantic status visible'}</span>
                {result.retrieval_quality.fail_closed_reasons?.length > 0 && (
                  <small>{result.retrieval_quality.fail_closed_reasons.join(', ')}</small>
                )}
              </div>
            )}

            {result.warnings?.length > 0 && (
              <ul className="grounding-warning-list">
                {result.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}

            <ol className="grounding-reference-list">
              {(result.references || []).map((reference) => (
                <li key={reference.reference_chunk_id} className="grounding-reference-card">
                  <div className="grounding-reference-title">
                    <span>{reference.citation_label}</span>
                    {reference.source_url ? (
                      <a href={reference.source_url} target="_blank" rel="noreferrer">
                        {reference.citation_title}
                      </a>
                    ) : (
                      <strong>{reference.citation_title}</strong>
                    )}
                    <SourceVerificationBadge status={reference.verification_status} auditable={reference.auditable} />
                    <EvidenceStatusBadge status={reference.evidence_status} quoteBacked={reference.quote_backed} />
                    {reference.private_source && <span className="source-verification-badge private-source">Private</span>}
                    {reference.source_tier === 'textbook' && <span className="source-verification-badge local-textbook">Local textbook</span>}
                  </div>
                  <div className="grounding-reference-meta">
                    <span>score {reference.score}</span>
                    <span>semantic {reference.semantic_score}</span>
                    <span>lexical {reference.lexical_score}</span>
                    <span>{reference.facet_id || 'chunk'}</span>
                    <span>{reference.source_tier}</span>
                    <span>{reference.publication_date}</span>
                  </div>
                  <SourceVerificationActions reference={reference} onVerify={setVerificationReference} />
                  {reference.original_quote && (
                    <blockquote className="grounding-reference-quote">
                      <strong>Original quote</strong>
                      <span>{reference.original_quote}</span>
                    </blockquote>
                  )}
                  <p>{reference.snippet}</p>
                  <small>{reference.reference_chunk_id}</small>
                </li>
              ))}
            </ol>
            <SourceVerificationDrawer
              reference={verificationReference}
              onClose={() => setVerificationReference(null)}
            />
          </div>
        )}
      </div>
    </details>
  );
}

export default ClinicalGroundingLab;
