import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLE_PATH = join(ROOT, 'frontend', 'src', 'data', 'public_clinical_knowledge_bundle.json');
const JSON_OUTPUT_PATH = join(ROOT, 'docs', 'source_link_quote_verification_report.json');
const MD_OUTPUT_PATH = join(ROOT, 'docs', 'source_link_quote_verification_report.md');
const REQUEST_TIMEOUT_MS = Number(process.env.SOURCE_LINK_TIMEOUT_MS || 8000);
const MAX_FETCH_BYTES = Number(process.env.SOURCE_LINK_MAX_BYTES || 1_500_000);
const MAX_PDF_BYTES = Number(process.env.SOURCE_LINK_MAX_PDF_BYTES || 25_000_000);
const PDF_MAX_PAGES = Number(process.env.SOURCE_LINK_PDF_MAX_PAGES || 160);
const PDF_MAX_TEXT_CHARS = Number(process.env.SOURCE_LINK_PDF_MAX_TEXT_CHARS || 2_000_000);

let pdfjsPromise = null;

async function loadPdfjs() {
  if (!pdfjsPromise) {
    const pdfjsPath = join(ROOT, 'frontend', 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs');
    pdfjsPromise = import(pathToFileURL(pdfjsPath).href);
  }
  return pdfjsPromise;
}

function sha256(value) {
  return createHash('sha256').update(value || '').digest('hex');
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function textFromHtml(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

async function textFromPdf(bytes) {
  if (bytes.byteLength > MAX_PDF_BYTES) {
    return {
      text: '',
      pages: 0,
      pages_extracted: 0,
      extraction_error: `pdf_too_large_${bytes.byteLength}_bytes`
    };
  }

  let document = null;
  try {
    const pdfjs = await loadPdfjs();
    document = await pdfjs.getDocument({
      data: bytes.slice(),
      disableWorker: true,
      isEvalSupported: false,
      useWorkerFetch: false
    }).promise;
    const pagesToExtract = Math.min(document.numPages, PDF_MAX_PAGES);
    const pageTexts = [];
    let totalChars = 0;
    for (let pageNumber = 1; pageNumber <= pagesToExtract; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items.map((item) => item.str || '').join(' ');
      pageTexts.push(pageText);
      totalChars += pageText.length;
      if (totalChars >= PDF_MAX_TEXT_CHARS) break;
    }
    return {
      text: pageTexts.join('\n').slice(0, PDF_MAX_TEXT_CHARS),
      pages: document.numPages,
      pages_extracted: pageTexts.length,
      extraction_error: ''
    };
  } catch (error) {
    return {
      text: '',
      pages: 0,
      pages_extracted: 0,
      extraction_error: String(error?.message || error)
    };
  } finally {
    await document?.destroy?.();
  }
}

async function fetchUrl(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ER-Triage-Project-readiness-source-verifier/1.0',
        Accept: 'text/html,application/pdf,text/plain,*/*'
      },
      redirect: 'follow',
      signal: controller.signal
    });
    const contentType = response.headers.get('content-type') || '';
    const bytes = new Uint8Array(await response.arrayBuffer());
    const bytesRead = bytes.byteLength;
    const bounded = bytes.slice(0, MAX_FETCH_BYTES);
    const isTextLike = /text|html|json|xml/i.test(contentType);
    const isPdf = /pdf/i.test(contentType) || /\.pdf(?:$|[?#])/i.test(url);
    let bodyText = '';
    let pdfExtraction = {
      text: '',
      pages: 0,
      pages_extracted: 0,
      extraction_error: ''
    };
    if (isTextLike) {
      bodyText = new TextDecoder('utf-8', { fatal: false }).decode(bounded);
      if (/html/i.test(contentType) || /<html|<!doctype/i.test(bodyText.slice(0, 500))) {
        bodyText = textFromHtml(bodyText);
      }
    } else if (isPdf && response.ok) {
      pdfExtraction = await textFromPdf(bytes);
      bodyText = pdfExtraction.text;
    }
    return {
      url,
      status: response.status,
      ok: response.ok,
      final_url: response.url,
      content_type: contentType,
      bytes_read: bytesRead,
      truncated: isTextLike
        ? bytesRead > MAX_FETCH_BYTES
        : isPdf && pdfExtraction.pages > PDF_MAX_PAGES,
      text_match_supported: Boolean((isTextLike || isPdf) && bodyText),
      pdf_fetch_only: Boolean(isPdf && !bodyText),
      pdf_text_extracted: Boolean(isPdf && bodyText),
      pdf_pages: pdfExtraction.pages,
      pdf_pages_extracted: pdfExtraction.pages_extracted,
      pdf_extraction_error: pdfExtraction.extraction_error,
      normalized_text: normalizeText(bodyText)
    };
  } catch (error) {
    return {
      url,
      status: null,
      ok: false,
      final_url: '',
      content_type: '',
      bytes_read: 0,
      truncated: false,
      text_match_supported: false,
      pdf_fetch_only: false,
      pdf_text_extracted: false,
      pdf_pages: 0,
      pdf_pages_extracted: 0,
      pdf_extraction_error: '',
      error: error?.name === 'AbortError' ? `timeout_${REQUEST_TIMEOUT_MS}ms` : String(error?.message || error)
    };
  } finally {
    clearTimeout(timeout);
  }
}

function markdownEscape(value) {
  return String(value ?? '').replaceAll('|', '\\|').replace(/\s+/g, ' ').trim();
}

const bundle = JSON.parse(readFileSync(BUNDLE_PATH, 'utf8'));
const chunks = Array.isArray(bundle.chunks) ? bundle.chunks : [];
const quoteBackedChunks = chunks.filter((chunk) => (
  chunk.evidence_status === 'quote_backed'
  || Array.isArray(chunk.supporting_quotes) && chunk.supporting_quotes.length > 0
));

const quoteRecords = [];
for (const chunk of quoteBackedChunks) {
  const supportingQuotes = Array.isArray(chunk.supporting_quotes) ? chunk.supporting_quotes : [];
  for (const [index, quote] of supportingQuotes.entries()) {
    const locator = chunk.locator || {};
    const sourceUrl = quote.source_url || locator.url || chunk.source_url || '';
    const searchPhrases = [
      quote.search_phrase,
      ...(Array.isArray(locator.search_phrases) ? locator.search_phrases : [])
    ].filter(Boolean);
    quoteRecords.push({
      id: `${chunk.id}#quote-${index + 1}`,
      chunk_id: chunk.id,
      source_id: chunk.source_id || '',
      source_title: quote.source_title || chunk.source_title || '',
      source_url: sourceUrl,
      section_heading: quote.section_heading || locator.section_heading || chunk.section || '',
      quote_text: quote.text || '',
      quote_hash: quote.quote_hash || '',
      computed_quote_hash: sha256(quote.text || ''),
      search_phrases: [...new Set(searchPhrases)],
      verification_status: quote.verification_status || chunk.verification_status || 'missing'
    });
  }
}

const uniqueUrls = [...new Set(quoteRecords.map((record) => record.source_url).filter(Boolean))];
const fetchResults = new Map();
for (const url of uniqueUrls) {
  fetchResults.set(url, await fetchUrl(url));
}

const verifiedQuotes = quoteRecords.map((record) => {
  const fetchResult = fetchResults.get(record.source_url) || null;
  const hashMatches = Boolean(record.quote_hash && record.computed_quote_hash === record.quote_hash);
  const quoteNeedle = normalizeText(record.quote_text);
  const searchNeedles = record.search_phrases.map(normalizeText).filter(Boolean);
  const normalizedSource = fetchResult?.normalized_text || '';
  const quoteTextMatchesFetchedSource = Boolean(fetchResult?.text_match_supported && quoteNeedle && normalizedSource.includes(quoteNeedle));
  const matchedSearchPhrase = fetchResult?.text_match_supported
    ? searchNeedles.find((phrase) => normalizedSource.includes(phrase)) || ''
    : '';
  const searchPhraseMatchesFetchedSource = Boolean(matchedSearchPhrase);
  const textMatchStatus = fetchResult?.text_match_supported
    ? quoteTextMatchesFetchedSource || searchPhraseMatchesFetchedSource
      ? 'matched'
      : 'not_matched'
    : fetchResult?.pdf_fetch_only
      ? 'pdf_fetch_only'
      : 'not_supported';
  const issues = [];
  if (!record.source_url) issues.push('missing_source_url');
  if (!record.section_heading && record.search_phrases.length === 0) issues.push('missing_locator');
  if (!record.quote_text) issues.push('missing_quote_text');
  if (!record.quote_hash) issues.push('missing_quote_hash');
  if (record.quote_hash && !hashMatches) issues.push('quote_hash_mismatch');
  if (fetchResult && !fetchResult.ok) issues.push('url_fetch_failed');
  if (fetchResult?.text_match_supported && textMatchStatus === 'not_matched') issues.push('quote_or_search_phrase_not_matched');
  return {
    ...record,
    hash_matches: hashMatches,
    url_fetch_ok: Boolean(fetchResult?.ok),
    url_status: fetchResult?.status ?? null,
    final_url: fetchResult?.final_url || '',
    content_type: fetchResult?.content_type || '',
    text_match_supported: Boolean(fetchResult?.text_match_supported),
    pdf_fetch_only: Boolean(fetchResult?.pdf_fetch_only),
    pdf_text_extracted: Boolean(fetchResult?.pdf_text_extracted),
    pdf_pages: fetchResult?.pdf_pages || 0,
    pdf_pages_extracted: fetchResult?.pdf_pages_extracted || 0,
    pdf_extraction_error: fetchResult?.pdf_extraction_error || '',
    text_match_status: textMatchStatus,
    quote_text_matches_fetched_source: quoteTextMatchesFetchedSource,
    search_phrase_matches_fetched_source: searchPhraseMatchesFetchedSource,
    matched_search_phrase: matchedSearchPhrase,
    issues
  };
});

const sourceResults = uniqueUrls.map((url) => {
  const result = fetchResults.get(url);
  const relatedQuotes = verifiedQuotes.filter((quote) => quote.source_url === url);
  return {
    url,
    status: result?.status ?? null,
    ok: Boolean(result?.ok),
    final_url: result?.final_url || '',
    content_type: result?.content_type || '',
    bytes_read: result?.bytes_read || 0,
    truncated: Boolean(result?.truncated),
    text_match_supported: Boolean(result?.text_match_supported),
    pdf_fetch_only: Boolean(result?.pdf_fetch_only),
    pdf_text_extracted: Boolean(result?.pdf_text_extracted),
    pdf_pages: result?.pdf_pages || 0,
    pdf_pages_extracted: result?.pdf_pages_extracted || 0,
    pdf_extraction_error: result?.pdf_extraction_error || '',
    quote_records: relatedQuotes.length,
    matched_quote_records: relatedQuotes.filter((quote) => quote.text_match_status === 'matched').length,
    unmatched_quote_records: relatedQuotes.filter((quote) => quote.text_match_status === 'not_matched').length,
    error: result?.error || ''
  };
});

function requiredRepairAction(quote) {
  if (quote.issues.includes('quote_hash_mismatch')) {
    return 'Recompute or replace the quote after confirming the exact source passage.';
  }
  if (quote.issues.includes('missing_quote_hash') || quote.issues.includes('missing_locator') || quote.issues.includes('missing_source_url')) {
    return 'Complete quote hash, source URL, and direct locator metadata before learner-facing use.';
  }
  if (quote.issues.includes('url_fetch_failed')) {
    return 'Replace the URL with a reachable open source or record a clinician/librarian-approved alternate locator.';
  }
  if (quote.text_match_status === 'pdf_fetch_only') {
    return 'Add PDF text extraction or record manual page/section verification for this quote.';
  }
  if (quote.text_match_status === 'not_matched') {
    return 'Update the quote/search phrase or source URL after confirming the passage in the fetched source.';
  }
  if (quote.text_match_status === 'not_supported') {
    return 'Use a source format that supports text verification or record manual source review.';
  }
  return 'No source-link repair required.';
}

const quoteRepairQueue = verifiedQuotes
  .filter((quote) => quote.issues.length > 0 || quote.text_match_status !== 'matched')
  .map((quote) => ({
    id: quote.id,
    chunk_id: quote.chunk_id,
    source_id: quote.source_id,
    source_title: quote.source_title,
    source_url: quote.source_url,
    final_url: quote.final_url,
    locator: {
      section_heading: quote.section_heading,
      search_phrases: quote.search_phrases
    },
    text_match_status: quote.text_match_status,
    url_fetch_ok: quote.url_fetch_ok,
    url_status: quote.url_status,
    content_type: quote.content_type,
    pdf_text_extracted: quote.pdf_text_extracted,
    pdf_pages: quote.pdf_pages,
    pdf_pages_extracted: quote.pdf_pages_extracted,
    pdf_extraction_error: quote.pdf_extraction_error,
    issues: quote.issues,
    required_action: requiredRepairAction(quote)
  }));

const repairQueueBySource = [...new Set(quoteRepairQueue.map((quote) => quote.source_url))].map((url) => {
  const quotes = quoteRepairQueue.filter((quote) => quote.source_url === url);
  const source = sourceResults.find((item) => item.url === url) || {};
  return {
    source_url: url,
    source_title: quotes[0]?.source_title || '',
    status: source.status ?? null,
    ok: Boolean(source.ok),
    final_url: source.final_url || '',
    quote_records_requiring_repair: quotes.length,
    issue_counts: quotes.reduce((acc, quote) => {
      const issueKeys = quote.issues.length > 0 ? quote.issues : [quote.text_match_status];
      for (const issue of issueKeys) acc[issue] = (acc[issue] || 0) + 1;
      return acc;
    }, {}),
    recommended_next_action: source.ok
      ? 'Review quote/search phrases against the fetched source or add manual PDF/source-location verification.'
      : 'Replace or review the source URL before this source can support learner-facing feedback.'
  };
});

const summary = {
  public_bundle_chunks: chunks.length,
  quote_backed_chunks: quoteBackedChunks.length,
  quote_records: quoteRecords.length,
  unique_source_urls: uniqueUrls.length,
  source_urls_fetch_ok: sourceResults.filter((source) => source.ok).length,
  source_urls_fetch_failed: sourceResults.filter((source) => !source.ok).length,
  quote_hash_mismatches: verifiedQuotes.filter((quote) => quote.issues.includes('quote_hash_mismatch')).length,
  quote_records_missing_hash: verifiedQuotes.filter((quote) => quote.issues.includes('missing_quote_hash')).length,
  quote_records_missing_locator: verifiedQuotes.filter((quote) => quote.issues.includes('missing_locator')).length,
  quote_records_missing_source_url: verifiedQuotes.filter((quote) => quote.issues.includes('missing_source_url')).length,
  quote_records_with_text_match_support: verifiedQuotes.filter((quote) => quote.text_match_supported).length,
  quote_records_matched_in_fetched_source: verifiedQuotes.filter((quote) => quote.text_match_status === 'matched').length,
  quote_records_unmatched_in_fetched_source: verifiedQuotes.filter((quote) => quote.text_match_status === 'not_matched').length,
  quote_records_pdf_fetch_only: verifiedQuotes.filter((quote) => quote.text_match_status === 'pdf_fetch_only').length,
  quote_records_with_pdf_text_extracted: verifiedQuotes.filter((quote) => quote.pdf_text_extracted).length,
  quote_records_text_match_not_supported: verifiedQuotes.filter((quote) => quote.text_match_status === 'not_supported').length,
  source_urls_with_pdf_text_extracted: sourceResults.filter((source) => source.pdf_text_extracted).length,
  source_urls_pdf_fetch_only: sourceResults.filter((source) => source.pdf_fetch_only).length,
  quote_records_without_machine_text_match: verifiedQuotes.filter((quote) => quote.text_match_status !== 'matched').length,
  quote_records_with_any_issue: verifiedQuotes.filter((quote) => quote.issues.length > 0).length,
  quote_records_requiring_repair: quoteRepairQueue.length,
  source_urls_requiring_repair: repairQueueBySource.length,
  all_quote_hashes_valid: verifiedQuotes.every((quote) => quote.hash_matches),
  all_quote_records_have_locator: verifiedQuotes.every((quote) => quote.section_heading || quote.search_phrases.length > 0),
  all_quote_records_have_source_url: verifiedQuotes.every((quote) => quote.source_url),
  quote_verification_release_ready: false
};

summary.quote_verification_release_ready = summary.all_quote_hashes_valid
  && summary.all_quote_records_have_locator
  && summary.all_quote_records_have_source_url
  && summary.source_urls_fetch_failed === 0
  && summary.quote_records_without_machine_text_match === 0
  && summary.quote_records_with_any_issue === 0;

const report = {
  schema_version: 'source_link_quote_verification_report_v1',
  generated_at: new Date().toISOString(),
  review_status: summary.quote_verification_release_ready
    ? 'source_link_quote_verification_ready_for_evidence_release'
    : summary.quote_hash_mismatches === 0
      && summary.quote_records_missing_hash === 0
      && summary.quote_records_missing_source_url === 0
      && summary.quote_records_missing_locator === 0
        ? 'source_link_quote_verification_has_fetch_or_match_gaps'
        : 'source_link_quote_verification_has_record_issues',
  warning: 'This report verifies URL reachability, quote hashes, and fetched-source phrase matches for the current quote-backed learner-facing subset. It does not approve generated-needs-review chunks or replace clinician/librarian source review.',
  verification_scope: {
    source_bundle: 'frontend/src/data/public_clinical_knowledge_bundle.json',
    quote_backed_subset_only: true,
    generated_needs_review_chunks_approved_by_this_report: 0,
    request_timeout_ms: REQUEST_TIMEOUT_MS,
    max_fetch_bytes: MAX_FETCH_BYTES,
    max_pdf_bytes: MAX_PDF_BYTES,
    pdf_max_pages: PDF_MAX_PAGES,
    pdf_max_text_chars: PDF_MAX_TEXT_CHARS
  },
  summary,
  source_results: sourceResults,
  quote_results: verifiedQuotes,
  repair_queue_by_source: repairQueueBySource,
  quote_repair_queue: quoteRepairQueue,
  readiness_effect: {
    open_evidence_grounding_gate_can_pass_from_current_source_links: summary.quote_verification_release_ready,
    source_url_fetch_failures_block_release: summary.source_urls_fetch_failed > 0,
    unmatched_quote_or_search_phrase_records_block_release: summary.quote_records_unmatched_in_fetched_source > 0,
    pdf_or_unsupported_source_text_records_need_manual_or_machine_verification:
      summary.quote_records_pdf_fetch_only + summary.quote_records_text_match_not_supported,
    source_link_quote_records_requiring_repair: summary.quote_records_requiring_repair
  }
};

const md = [
  '# Source Link And Quote Verification Report',
  '',
  `Generated: ${report.generated_at}`,
  '',
  report.warning,
  '',
  '## Summary',
  '',
  `- Quote-backed chunks checked: ${summary.quote_backed_chunks}`,
  `- Quote records checked: ${summary.quote_records}`,
  `- Unique source URLs checked: ${summary.unique_source_urls}`,
  `- Source URLs fetched successfully: ${summary.source_urls_fetch_ok}`,
  `- Source URL fetch issues: ${summary.source_urls_fetch_failed}`,
  `- Quote hash mismatches: ${summary.quote_hash_mismatches}`,
  `- Missing locators: ${summary.quote_records_missing_locator}`,
  `- Quote/search phrase matches in fetched text: ${summary.quote_records_matched_in_fetched_source}`,
  `- Quote/search phrase unmatched in fetched text: ${summary.quote_records_unmatched_in_fetched_source}`,
  `- PDF fetch-only quote records: ${summary.quote_records_pdf_fetch_only}`,
  `- Quote records with PDF text extracted: ${summary.quote_records_with_pdf_text_extracted}`,
  `- Quote records without machine text match: ${summary.quote_records_without_machine_text_match}`,
  `- Quote records requiring repair or manual verification: ${summary.quote_records_requiring_repair}`,
  `- Source-link quote verification release ready: ${summary.quote_verification_release_ready}`,
  '',
  '## Source URLs',
  '',
  '| URL | Status | Text Match Supported | Quotes | Matched | Unmatched | Error |',
  '|---|---:|---|---:|---:|---:|---|',
  ...sourceResults.map((source) => (
    `| ${markdownEscape(source.url)} | ${source.status ?? 'n/a'} | ${source.text_match_supported ? 'yes' : source.pdf_fetch_only ? 'pdf_fetch_only' : 'no'} | ${source.quote_records} | ${source.matched_quote_records} | ${source.unmatched_quote_records} | ${markdownEscape(source.error)} |`
  )),
  '',
  '## Quote Records With Issues',
  '',
  '| Quote | Source | Status | Issues |',
  '|---|---|---|---|',
  ...verifiedQuotes
    .filter((quote) => quote.issues.length > 0)
    .map((quote) => `| ${quote.id} | ${markdownEscape(quote.source_title)} | ${quote.text_match_status} | ${quote.issues.join(', ')} |`),
  '',
  '## Repair Queue By Source',
  '',
  '| Source | Fetch OK | Quotes Requiring Repair | Recommended Action |',
  '|---|---:|---:|---|',
  ...repairQueueBySource.map((source) =>
    `| ${markdownEscape(source.source_url)} | ${source.ok} | ${source.quote_records_requiring_repair} | ${markdownEscape(source.recommended_next_action)} |`
  ),
  ''
].join('\n');

writeFileSync(JSON_OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
writeFileSync(MD_OUTPUT_PATH, md, 'utf8');

console.log(JSON.stringify({
  review_status: report.review_status,
  quote_backed_chunks: summary.quote_backed_chunks,
  quote_records: summary.quote_records,
  unique_source_urls: summary.unique_source_urls,
  source_urls_fetch_ok: summary.source_urls_fetch_ok,
  quote_hash_mismatches: summary.quote_hash_mismatches,
  quote_records_matched_in_fetched_source: summary.quote_records_matched_in_fetched_source,
  quote_records_with_pdf_text_extracted: summary.quote_records_with_pdf_text_extracted,
  quote_records_without_machine_text_match: summary.quote_records_without_machine_text_match,
  quote_records_requiring_repair: summary.quote_records_requiring_repair,
  quote_verification_release_ready: summary.quote_verification_release_ready,
  report_path: JSON_OUTPUT_PATH
}, null, 2));
