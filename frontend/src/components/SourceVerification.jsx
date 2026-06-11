import React, { useState } from 'react';

const STATUS_LABELS = {
  human_verified: 'Human verified',
  anchored: 'Anchored',
  local_extracted: 'Quote extracted',
  source_level_only: 'Source-level only',
  needs_review: 'Needs review'
};

const EVIDENCE_LABELS = {
  quote_backed: 'Quote-backed',
  source_level_only: 'Source-level only',
  generated_needs_review: 'Generated needs review'
};

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function sourceUrl(reference = {}) {
  return cleanText(reference.source_url || reference.locator?.url);
}

function searchPhrases(reference = {}) {
  return (reference.locator?.search_phrases || [])
    .map(cleanText)
    .filter(Boolean);
}

function supportingQuotes(reference = {}) {
  return (reference.supporting_quotes || [])
    .map((quote) => ({
      ...quote,
      text: cleanText(quote.text),
      search_phrase: cleanText(quote.search_phrase)
    }))
    .filter((quote) => quote.text);
}

export function sourceVerificationLabel(status) {
  return STATUS_LABELS[status] || STATUS_LABELS.needs_review;
}

export function primarySearchPhrase(reference = {}) {
  return searchPhrases(reference)[0] ||
    cleanText(reference.locator?.section_heading || reference.section) ||
    cleanText(reference.source_title || reference.citation_title);
}

export function SourceVerificationBadge({ status, auditable }) {
  const normalized = STATUS_LABELS[status] ? status : 'needs_review';
  const className = auditable === false && normalized === 'anchored'
    ? 'needs_review'
    : normalized;
  return (
    <span className={`source-verification-badge ${className}`}>
      {sourceVerificationLabel(className)}
    </span>
  );
}

export function EvidenceStatusBadge({ status, quoteBacked }) {
  const normalized = quoteBacked ? 'quote_backed' : (EVIDENCE_LABELS[status] ? status : 'generated_needs_review');
  return (
    <span className={`source-verification-badge evidence-${normalized}`}>
      {EVIDENCE_LABELS[normalized] || EVIDENCE_LABELS.generated_needs_review}
    </span>
  );
}

export function SourceVerificationActions({ reference, onVerify }) {
  const [copyStatus, setCopyStatus] = useState('');
  const url = sourceUrl(reference);
  const phrase = primarySearchPhrase(reference);
  const quote = supportingQuotes(reference)[0];
  const copyText = quote?.text || phrase;

  const copyQuoteOrPhrase = async () => {
    if (!copyText) {
      setCopyStatus('No quote or phrase');
      return;
    }
    try {
      await navigator.clipboard?.writeText(copyText);
      setCopyStatus(quote?.text ? 'Copied quote' : 'Copied search phrase');
    } catch {
      setCopyStatus(quote?.text ? 'Quote ready' : 'Search phrase ready');
    }
  };

  return (
    <div className="source-verification-actions">
      {url ? (
        <a className="btn-secondary source-action-link" href={url} target="_blank" rel="noreferrer">
          View source
        </a>
      ) : (
        <span className="source-action-disabled">No source URL</span>
      )}
      <button type="button" className="btn-secondary" onClick={() => onVerify?.(reference)}>
        Verify basis
      </button>
      <button type="button" className="btn-secondary" aria-label="Copy quote/search phrase" onClick={copyQuoteOrPhrase}>
        Copy quote/search phrase
      </button>
      {copyStatus && <span className="source-copy-status" role="status">{copyStatus}</span>}
    </div>
  );
}

export function SourceVerificationDrawer({ reference, onClose }) {
  if (!reference) return null;

  const locator = reference.locator || {};
  const phrases = searchPhrases(reference);
  const url = sourceUrl(reference);
  const quotes = supportingQuotes(reference);
  const primaryQuote = quotes[0];
  const weakLocator = !reference.auditable || !reference.quote_backed || ['source_level_only', 'needs_review'].includes(reference.verification_status);

  return (
    <aside className="source-verification-drawer" role="dialog" aria-label="Source verification">
      <div className="source-verification-header">
        <div>
          <span className="eyebrow">Citation audit</span>
          <h3>Source verification</h3>
        </div>
        <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
      </div>

      <div className="source-verification-summary">
        <SourceVerificationBadge status={reference.verification_status} auditable={reference.auditable} />
        <EvidenceStatusBadge status={reference.evidence_status} quoteBacked={reference.quote_backed} />
        {reference.private_source && <span className="source-verification-badge private-source">Private</span>}
        {reference.source_tier === 'textbook' && <span className="source-verification-badge local-textbook">Local textbook</span>}
        <strong>{reference.citation_label || reference.source_citation_label || reference.reference_chunk_id}</strong>
        <span>{reference.facet_id || 'reference chunk'}</span>
      </div>

      {weakLocator && (
        <p className="source-verification-warning">
          This citation does not have verified quote-backed support yet, or is linked only broadly. Use quote-backed references for high-risk teaching.
        </p>
      )}

      {primaryQuote ? (
        <div className="source-verification-quote">
          <strong>Original quote</strong>
          <blockquote>{primaryQuote.text}</blockquote>
          <dl>
            <div>
              <dt>Quote hash</dt>
              <dd>{primaryQuote.quote_hash || 'Not listed'}</dd>
            </div>
            <div>
              <dt>Quote locator</dt>
              <dd>{[primaryQuote.section_heading, primaryQuote.page].filter(Boolean).join(' / ') || 'Search phrase only'}</dd>
            </div>
            <div className="wide">
              <dt>Quote search phrase</dt>
              <dd>{primaryQuote.search_phrase || primaryQuote.text}</dd>
            </div>
          </dl>
        </div>
      ) : (
        <p className="source-verification-warning">
          No original quote is stored for this chunk. Treat it as background until reviewed.
        </p>
      )}

      <dl className="source-verification-detail-grid">
        <div>
          <dt>Source</dt>
          <dd>{reference.source_title || reference.citation_title || 'Clinical source'}</dd>
        </div>
        <div>
          <dt>Organization</dt>
          <dd>{reference.source_organization || reference.organization || 'Not specified'}</dd>
        </div>
        <div>
          <dt>Date/version</dt>
          <dd>{reference.publication_date || 'Not specified'}</dd>
        </div>
        <div>
          <dt>Locator quality</dt>
          <dd>{locator.locator_quality || reference.locator_quality || 'source locator'}</dd>
        </div>
        <div>
          <dt>Section/page</dt>
          <dd>{[locator.section_heading || reference.section, locator.page || reference.page].filter(Boolean).join(' / ') || 'Source-level link only'}</dd>
        </div>
        <div>
          <dt>DOI / PMID / ISBN</dt>
          <dd>{[reference.doi, reference.pmid && `PMID ${reference.pmid}`, reference.isbn && `ISBN ${reference.isbn}`].filter(Boolean).join(' | ') || 'Not listed'}</dd>
        </div>
        <div>
          <dt>Local file</dt>
          <dd>{reference.source_file_name || reference.local_file_id || 'Not a local file'}</dd>
        </div>
        <div>
          <dt>Private snippet AI use</dt>
          <dd>{reference.private_source ? (reference.external_ai_use_allowed ? 'Allowed only after session opt-in' : 'Not allowed') : 'Public source'}</dd>
        </div>
        <div className="wide">
          <dt>Source URL</dt>
          <dd>{url ? <a href={url} target="_blank" rel="noreferrer">{url}</a> : 'No source URL'}</dd>
        </div>
        <div className="wide">
          <dt>Chunk ID</dt>
          <dd>{reference.reference_chunk_id}</dd>
        </div>
      </dl>

      <div className="source-verification-search">
        <strong>Search phrases</strong>
        {phrases.length ? (
          <ul>
            {phrases.map((phrase) => <li key={phrase}>{phrase}</li>)}
          </ul>
        ) : (
          <p>No search phrase is available for this citation.</p>
        )}
      </div>

      <div className="source-verification-snippet">
        <strong>Reviewed summary</strong>
        <p>{reference.snippet || reference.text || 'No summary text was included in this retrieval result.'}</p>
      </div>
    </aside>
  );
}
