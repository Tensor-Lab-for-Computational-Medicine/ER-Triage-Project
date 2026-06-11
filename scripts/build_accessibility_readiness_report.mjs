import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FLOWBOARD_PATH = join(ROOT, 'frontend', 'src', 'components', 'ClinicalFlowboard.jsx');
const FEEDBACK_PATH = join(ROOT, 'frontend', 'src', 'components', 'Feedback.jsx');
const APP_PATH = join(ROOT, 'frontend', 'src', 'App.jsx');
const FLOWBOARD_CSS_PATH = join(ROOT, 'frontend', 'src', 'styles', 'Flowboard.css');
const FLOWBOARD_TEST_PATH = join(ROOT, 'frontend', 'tests', 'flowboard.spec.js');
const JSON_OUTPUT_PATH = join(ROOT, 'docs', 'accessibility_readiness_report.json');
const MD_OUTPUT_PATH = join(ROOT, 'docs', 'accessibility_readiness_report.md');

const SOURCE_TARGETS = [
  { id: 'app_router', route_scope: 'default_and_optional_routes', path: APP_PATH },
  { id: 'default_flowboard', route_scope: 'default_national_route', path: FLOWBOARD_PATH },
  { id: 'default_feedback_surface', route_scope: 'default_feedback_surface', path: FEEDBACK_PATH },
  { id: 'default_flowboard_styles', route_scope: 'default_national_route', path: FLOWBOARD_CSS_PATH }
];

function readText(path) {
  return readFileSync(path, 'utf8');
}

function rel(path) {
  return relative(ROOT, path).replace(/\\/g, '/');
}

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

function hasAttribute(attrs, names) {
  return names.some((name) => new RegExp(`\\b${name}\\s*=`, 'i').test(attrs));
}

function attrValue(attrs, name) {
  const match = attrs.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'));
  return match ? match[1] : null;
}

function stripJsxText(inner) {
  return inner
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{[\s\S]*?\}/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasMeaningfulJsxExpression(inner) {
  return /\{[^{}]*(label|title|tab|item|bundle|action|panel|location|disposition|children|event)[^{}]*\}/i.test(inner)
    || /\{[^{}]*['"][^'"]*[A-Za-z0-9][^'"]*['"][^{}]*\}/.test(inner);
}

function extractButtonBlocks(source) {
  const blocks = [];
  const pattern = /<button\b([^>]*)>([\s\S]*?)<\/button>/g;
  let match = pattern.exec(source);
  while (match) {
    blocks.push({
      attrs: match[1],
      inner: match[2],
      index: match.index,
      sample: match[0].slice(0, 180).replace(/\s+/g, ' ')
    });
    match = pattern.exec(source);
  }
  return blocks;
}

function findTagEnd(source, startIndex) {
  let quote = null;
  let braceDepth = 0;
  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index];
    const previous = source[index - 1];
    if (quote) {
      if (char === quote && previous !== '\\') {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') {
      braceDepth += 1;
      continue;
    }
    if (char === '}' && braceDepth > 0) {
      braceDepth -= 1;
      continue;
    }
    if (char === '>' && braceDepth === 0) {
      return index;
    }
  }
  return -1;
}

function extractOpeningTags(source, tagName) {
  const tags = [];
  const pattern = new RegExp(`<${tagName}\\b`, 'g');
  let match = pattern.exec(source);
  while (match) {
    const endIndex = findTagEnd(source, match.index);
    if (endIndex === -1) {
      match = pattern.exec(source);
      continue;
    }
    const attrs = source.slice(match.index + tagName.length + 1, endIndex);
    tags.push({
      tagName,
      attrs,
      index: match.index,
      sample: source.slice(match.index, endIndex + 1).slice(0, 180).replace(/\s+/g, ' ')
    });
    match = pattern.exec(source);
  }
  return tags;
}

function hasWrappingLabel(source, index) {
  const lastLabelOpen = source.lastIndexOf('<label', index);
  const lastLabelClose = source.lastIndexOf('</label>', index);
  return lastLabelOpen > lastLabelClose;
}

function hasHtmlForLabel(source, attrs) {
  const id = attrValue(attrs, 'id');
  if (!id) return false;
  const htmlForPattern = new RegExp(`<label\\b[^>]*(htmlFor|for)\\s*=\\s*["']${id}["']`, 'i');
  return htmlForPattern.test(source);
}

function formControlHasName(source, control) {
  return hasAttribute(control.attrs, ['aria-label', 'aria-labelledby', 'title'])
    || hasWrappingLabel(source, control.index)
    || hasHtmlForLabel(source, control.attrs);
}

function buttonHasName(block) {
  const visibleText = stripJsxText(block.inner);
  return hasAttribute(block.attrs, ['aria-label', 'aria-labelledby', 'title'])
    || /[A-Za-z0-9]/.test(visibleText)
    || hasMeaningfulJsxExpression(block.inner);
}

function countPositiveTabIndex(source) {
  const matches = [...source.matchAll(/\btabIndex\s*=\s*(?:\{\s*)?["']?([0-9]+)/g)];
  return matches.filter((match) => Number(match[1]) > 0).length;
}

function ariaHiddenFocusableMatches(source) {
  return [
    ...source.matchAll(/<(button|a|input|textarea|select)\b[^>]*aria-hidden\s*=\s*["']true["'][^>]*>/gi),
    ...source.matchAll(/<[^>]*aria-hidden\s*=\s*["']true["'][^>]*(href|onClick|tabIndex)\s*=/gi)
  ];
}

function scanInteractiveControls(target, source) {
  const buttonBlocks = extractButtonBlocks(source);
  const formControls = [
    ...extractOpeningTags(source, 'input'),
    ...extractOpeningTags(source, 'textarea'),
    ...extractOpeningTags(source, 'select')
  ];

  const unnamedButtons = buttonBlocks
    .filter((block) => !buttonHasName(block))
    .map((block) => ({
      file: rel(target.path),
      line: lineNumber(source, block.index),
      sample: block.sample
    }));

  const unnamedFormControls = formControls
    .filter((control) => !formControlHasName(source, control))
    .map((control) => ({
      file: rel(target.path),
      line: lineNumber(source, control.index),
      tag: control.tagName,
      sample: control.sample
    }));

  return {
    file: rel(target.path),
    route_scope: target.route_scope,
    button_count: buttonBlocks.length,
    form_control_count: formControls.length,
    unnamed_button_count: unnamedButtons.length,
    unnamed_form_control_count: unnamedFormControls.length,
    positive_tabindex_count: countPositiveTabIndex(source),
    aria_hidden_focusable_count: ariaHiddenFocusableMatches(source).length,
    unnamed_buttons: unnamedButtons,
    unnamed_form_controls: unnamedFormControls
  };
}

function landmarkCheck(flowboardSource) {
  const checks = [
    {
      id: 'named_main_workspace',
      passed: /<main\b(?=[^>]*className=["'][^"']*learner-workspace)(?=[^>]*aria-label=)/.test(flowboardSource)
    },
    {
      id: 'named_learner_rail',
      passed: /<aside\b(?=[^>]*className=["'][^"']*learner-rail)(?=[^>]*aria-label=)/.test(flowboardSource)
    },
    {
      id: 'named_decision_readiness',
      passed: /<section\b(?=[^>]*decision-readiness)(?=[^>]*aria-label=)/.test(flowboardSource)
    },
    {
      id: 'named_chart_results_drawer',
      passed: /<aside\b(?=[^>]*className=\{?`?["']?[^>]*chart-results)(?=[^>]*aria-label=)/.test(flowboardSource)
        || /<aside\b(?=[^>]*chart-results)(?=[^>]*aria-label=)/.test(flowboardSource)
    },
    {
      id: 'named_chart_tabs_nav',
      passed: /<nav\b(?=[^>]*className=["'][^"']*chart-tabs)(?=[^>]*aria-label=)/.test(flowboardSource)
    }
  ];
  return {
    checks,
    all_present: checks.every((check) => check.passed),
    missing: checks.filter((check) => !check.passed).map((check) => check.id)
  };
}

function markdown(report) {
  const lines = [
    '# Accessibility Readiness Report',
    '',
    `Generated at: ${report.generated_at}`,
    '',
    `Review status: ${report.review_status}`,
    '',
    '## Static Summary',
    '',
    `- Default route static accessibility ready: ${report.summary.default_route_static_accessibility_ready}`,
    `- Critical static issues: ${report.summary.critical_static_issue_count}`,
    `- Buttons scanned: ${report.summary.button_count}`,
    `- Form controls scanned: ${report.summary.form_control_count}`,
    `- Icon-only or unnamed buttons: ${report.summary.unnamed_button_count}`,
    `- Unnamed form controls: ${report.summary.unnamed_form_control_count}`,
    `- Positive tabIndex count: ${report.summary.positive_tabindex_count}`,
    `- Focus-visible rule present: ${report.summary.focus_visible_present}`,
    `- Automated keyboard smoke present: ${report.summary.automated_keyboard_smoke_present}`,
    `- Default route landmarks present: ${report.summary.default_landmarks_present}`,
    '',
    '## Remaining Manual Review',
    '',
    ...report.manual_review_required.map((item) => `- ${item}`),
    '',
    '## Next Actions',
    '',
    ...report.next_actions.map((item) => `- ${item}`)
  ];

  if (report.issues.length) {
    lines.push('', '## Static Issues', '');
    for (const issue of report.issues) {
      lines.push(`- [${issue.severity}] ${issue.id}: ${issue.description}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

const sources = Object.fromEntries(SOURCE_TARGETS.map((target) => [target.id, readText(target.path)]));
const flowboardTestSource = readText(FLOWBOARD_TEST_PATH);
const controlScans = SOURCE_TARGETS
  .filter((target) => target.path.endsWith('.jsx'))
  .map((target) => scanInteractiveControls(target, sources[target.id]));

const defaultRouteScans = controlScans.filter((scan) => scan.route_scope !== 'default_and_optional_routes');
const allControlScans = controlScans;
const landmarkFindings = landmarkCheck(sources.default_flowboard);
const flowboardCss = sources.default_flowboard_styles;
const focusVisiblePresent = /:focus-visible/.test(flowboardCss)
  && /outline\s*:/.test(flowboardCss)
  && /\.flowboard-app/.test(flowboardCss);
const automatedKeyboardSmokePresent = [
  /supports keyboard-only readiness smoke for core Flowboard controls/.test(flowboardTestSource),
  /tabUntilFocused/.test(flowboardTestSource),
  /Pause case/.test(flowboardTestSource),
  /Collapse chart drawer/.test(flowboardTestSource),
  /First 5-minute stabilization sequence/.test(flowboardTestSource),
  /Receiving team/.test(flowboardTestSource)
].every(Boolean);

const defaultButtonCount = defaultRouteScans.reduce((sum, scan) => sum + scan.button_count, 0);
const defaultFormControlCount = defaultRouteScans.reduce((sum, scan) => sum + scan.form_control_count, 0);
const unnamedButtonCount = defaultRouteScans.reduce((sum, scan) => sum + scan.unnamed_button_count, 0);
const unnamedFormControlCount = defaultRouteScans.reduce((sum, scan) => sum + scan.unnamed_form_control_count, 0);
const positiveTabindexCount = allControlScans.reduce((sum, scan) => sum + scan.positive_tabindex_count, 0);
const ariaHiddenFocusableCount = allControlScans.reduce((sum, scan) => sum + scan.aria_hidden_focusable_count, 0);

const issues = [];
if (unnamedButtonCount > 0) {
  issues.push({
    id: 'unnamed_buttons',
    severity: 'critical',
    description: `${unnamedButtonCount} default-route buttons lack a static accessible name.`,
    details: defaultRouteScans.flatMap((scan) => scan.unnamed_buttons)
  });
}
if (unnamedFormControlCount > 0) {
  issues.push({
    id: 'unnamed_form_controls',
    severity: 'critical',
    description: `${unnamedFormControlCount} default-route form controls lack labels or ARIA names.`,
    details: defaultRouteScans.flatMap((scan) => scan.unnamed_form_controls)
  });
}
if (positiveTabindexCount > 0) {
  issues.push({
    id: 'positive_tabindex',
    severity: 'critical',
    description: `${positiveTabindexCount} positive tabIndex values can disrupt keyboard navigation order.`,
    details: controlScans.map((scan) => ({
      file: scan.file,
      positive_tabindex_count: scan.positive_tabindex_count
    })).filter((item) => item.positive_tabindex_count > 0)
  });
}
if (ariaHiddenFocusableCount > 0) {
  issues.push({
    id: 'aria_hidden_focusable',
    severity: 'critical',
    description: `${ariaHiddenFocusableCount} focusable elements appear to be hidden from assistive technology.`,
    details: controlScans.map((scan) => ({
      file: scan.file,
      aria_hidden_focusable_count: scan.aria_hidden_focusable_count
    })).filter((item) => item.aria_hidden_focusable_count > 0)
  });
}
if (!focusVisiblePresent) {
  issues.push({
    id: 'missing_focus_visible_rule',
    severity: 'critical',
    description: 'The default flowboard stylesheet does not expose a scoped :focus-visible outline.',
    details: [{ file: rel(FLOWBOARD_CSS_PATH) }]
  });
}
if (!landmarkFindings.all_present) {
  issues.push({
    id: 'missing_named_landmarks',
    severity: 'critical',
    description: `Default-route landmarks are missing: ${landmarkFindings.missing.join(', ') || 'unknown'}.`,
    details: landmarkFindings.missing
  });
}

const criticalStaticIssueCount = issues.filter((issue) => issue.severity === 'critical').length;
const defaultRouteStaticAccessibilityReady = criticalStaticIssueCount === 0
  && landmarkFindings.all_present
  && focusVisiblePresent;

const report = {
  schema_version: 'accessibility_readiness_report_v1',
  generated_at: new Date().toISOString(),
  review_status: 'automated_static_audit_complete_manual_wcag_required',
  warning: 'This is an automated static accessibility readiness check for the default route. It does not replace manual WCAG 2.2 AA review, screen-reader testing, keyboard walkthroughs, low-vision review, or student accommodation review.',
  scope: {
    default_national_route: 'ClinicalFlowboard',
    optional_legacy_route: 'LegacySimulatorApp is lazy-loaded and must receive separate full accessibility review before required curricular use.',
    scanned_files: SOURCE_TARGETS.map((target) => ({
      id: target.id,
      route_scope: target.route_scope,
      path: rel(target.path)
    })),
    keyboard_smoke_test: rel(FLOWBOARD_TEST_PATH)
  },
  summary: {
    files_scanned: SOURCE_TARGETS.length,
    button_count: defaultButtonCount,
    form_control_count: defaultFormControlCount,
    unnamed_button_count: unnamedButtonCount,
    unnamed_form_control_count: unnamedFormControlCount,
    positive_tabindex_count: positiveTabindexCount,
    aria_hidden_focusable_count: ariaHiddenFocusableCount,
    focus_visible_present: focusVisiblePresent,
    automated_keyboard_smoke_present: automatedKeyboardSmokePresent,
    default_landmarks_present: landmarkFindings.all_present,
    critical_static_issue_count: criticalStaticIssueCount,
    default_route_static_accessibility_ready: defaultRouteStaticAccessibilityReady,
    manual_wcag_required: true
  },
  checks: [
    {
      id: 'interactive_control_names',
      status: unnamedButtonCount === 0 && unnamedFormControlCount === 0 ? 'pass' : 'fail',
      evidence: {
        unnamed_button_count: unnamedButtonCount,
        unnamed_form_control_count: unnamedFormControlCount
      }
    },
    {
      id: 'keyboard_order_static_hazards',
      status: positiveTabindexCount === 0 && ariaHiddenFocusableCount === 0 ? 'pass' : 'fail',
      evidence: {
        positive_tabindex_count: positiveTabindexCount,
        aria_hidden_focusable_count: ariaHiddenFocusableCount
      }
    },
    {
      id: 'visible_keyboard_focus',
      status: focusVisiblePresent ? 'pass' : 'fail',
      evidence: {
        flowboard_css_path: rel(FLOWBOARD_CSS_PATH),
        focus_visible_present: focusVisiblePresent
      }
    },
    {
      id: 'automated_keyboard_smoke',
      status: automatedKeyboardSmokePresent ? 'pass' : 'needs_runtime_review',
      evidence: {
        flowboard_test_path: rel(FLOWBOARD_TEST_PATH),
        coverage: 'Topbar controls, chart drawer, panel navigation, action chip activation, text entry, chart tabs, and handoff entry.'
      }
    },
    {
      id: 'named_default_route_landmarks',
      status: landmarkFindings.all_present ? 'pass' : 'fail',
      evidence: landmarkFindings
    }
  ],
  control_scans: allControlScans,
  issues,
  manual_review_required: [
    'Run a full WCAG 2.2 AA audit on the default flowboard and any required legacy route.',
    'Complete formal keyboard-only walkthroughs beyond the automated smoke for panel navigation, chart drawer use, handoff entry, and feedback review.',
    'Test with NVDA, JAWS, VoiceOver, and browser zoom/reflow across common student devices.',
    'Verify color contrast, target size, reading order, motion tolerance, and error recovery with representative learners.',
    'Document accommodation workflows before required curricular or assessment use.'
  ],
  next_actions: [
    automatedKeyboardSmokePresent
      ? 'Extend the existing Flowboard keyboard smoke with axe or equivalent browser accessibility checks once a stable dependency is selected.'
      : 'Add automated keyboard and axe or equivalent browser accessibility tests to the default route once a stable dev-server test harness is selected.',
    'Create a faculty/student accessibility sign-off checklist tied to institutional disability-services review.',
    'Repeat this report after every default-route UI change and before each cohort release.',
    'Do not treat this report as completed WCAG approval; it only clears static release-blocker checks.'
  ]
};

writeFileSync(JSON_OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
writeFileSync(MD_OUTPUT_PATH, markdown(report), 'utf8');

console.log(JSON.stringify({
  review_status: report.review_status,
  default_route_static_accessibility_ready: report.summary.default_route_static_accessibility_ready,
  critical_static_issue_count: report.summary.critical_static_issue_count,
  unnamed_button_count: report.summary.unnamed_button_count,
  unnamed_form_control_count: report.summary.unnamed_form_control_count,
  focus_visible_present: report.summary.focus_visible_present,
  automated_keyboard_smoke_present: report.summary.automated_keyboard_smoke_present,
  default_landmarks_present: report.summary.default_landmarks_present
}, null, 2));
