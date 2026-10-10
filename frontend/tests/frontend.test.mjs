import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateMetricDelta,
  getScoreStatusLevel,
  getCommentRatioStatusLevel,
  getCouplingStatusLevel,
  getParseFailureStatusLevel,
} from '../src/utils/formatters.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, '..', 'src');

test('All 9 required navigation pages plus 404 NotFoundPage exist and are wired in App.jsx', () => {
  const appSource = fs.readFileSync(path.join(srcDir, 'App.jsx'), 'utf8');
  const requiredRoutes = [
    'path="/"',
    'path="/upload"',
    'path="/analysis"',
    'path="/metrics"',
    'path="/risks"',
    'path="/priorities"',
    'path="/history"',
    'path="/reports"',
    'path="/settings"',
    'path="*"',
    'NotFoundPage',
  ];
  for (const route of requiredRoutes) {
    assert.ok(appSource.includes(route), `Missing route ${route} in App.jsx`);
  }

  const requiredPages = [
    'DashboardPage.jsx',
    'UploadPage.jsx',
    'ProjectAnalysisPage.jsx',
    'MetricsExplorerPage.jsx',
    'RiskDebtPage.jsx',
    'RefactoringPrioritiesPage.jsx',
    'HistoryComparePage.jsx',
    'ReportsPage.jsx',
    'SettingsPage.jsx',
    'NotFoundPage.jsx',
  ];
  for (const pageFile of requiredPages) {
    const fullPath = path.join(srcDir, 'pages', pageFile);
    assert.ok(fs.existsSync(fullPath), `Missing page file ${pageFile}`);
  }
});

test('Mandatory Dark Theme Colour Tokens are defined in tokens.css and index.css', () => {
  const tokensSource = fs.readFileSync(path.join(srcDir, 'styles', 'tokens.css'), 'utf8');
  const cssSource = fs.readFileSync(path.join(srcDir, 'index.css'), 'utf8');
  const combined = (tokensSource + '\n' + cssSource).toUpperCase();

  const requiredTokens = [
    '--BG-APP',
    '#0A0A0C',
    '--BG-SIDEBAR',
    '#08080A',
    '--BG-CARD',
    '#111114',
    '--BG-CARD-HOVER',
    '#16161A',
    '--BG-INPUT',
    '#0E0E11',
    '--BORDER',
    '#1F1F25',
    '--BORDER-STRONG',
    '#2A2A32',
    '--TEXT-PRIMARY',
    '#F4F4F5',
    '--TEXT-SECONDARY',
    '#A1A1AA',
    '--TEXT-MUTED',
    '#6B6B76',
    '--ACCENT-VIOLET',
    '#7C5CFF',
    '--ACCENT-BLUE',
    '#4C8DFF',
    '--SUCCESS',
    '#22C55E',
    '--WARNING-YELLOW',
    '#EAB308',
    '--WARNING-ORANGE',
    '#F97316',
    '--DANGER',
    '#EF4444',
  ];
  for (const token of requiredTokens) {
    assert.ok(
      combined.includes(token),
      `Missing mandatory Section 2.1 design system token ${token}`
    );
  }
});

test('All 23 required reusable UI components exist and are exported from src/components/ui/index.js', () => {
  const uiIndex = fs.readFileSync(path.join(srcDir, 'components', 'ui', 'index.js'), 'utf8');
  const requiredExports = [
    'Card',
    'CardHeader',
    'KpiCard',
    'DeltaBadge',
    'PeriodSelect',
    'SegmentedBar',
    'StatusChip',
    'DataTable',
    'Tabs',
    'Modal',
    'Drawer',
    'Tooltip',
    'Button',
    'Input',
    'Select',
    'Toggle',
    'ProgressBar',
    'Toast',
    'EmptyState',
    'LoadingSkeleton',
    'ErrorBanner',
    'ChartTheme',
    'ErrorBoundary',
  ];
  for (const exp of requiredExports) {
    assert.ok(
      uiIndex.includes(exp),
      `Missing required reusable UI component export "${exp}" in src/components/ui/index.js`
    );
  }
});

test('Layout wraps routed page content in ErrorBoundary and displays required header status line', () => {
  const layoutSource = fs.readFileSync(path.join(srcDir, 'components', 'Layout.jsx'), 'utf8');
  assert.ok(
    layoutSource.includes('<ErrorBoundary'),
    'Layout.jsx must wrap routed page content in ErrorBoundary'
  );
  assert.ok(
    layoutSource.includes('Last analyzed:'),
    'Layout.jsx must show Project | Java | Last analyzed status line'
  );
});

test('DashboardPage implements the four-row layout and empty/error states', () => {
  const dashboardSource = fs.readFileSync(path.join(srcDir, 'pages', 'DashboardPage.jsx'), 'utf8');
  const requiredSections = [
    'Project Health Score',
    'Total Lines of Code',
    'Average Cyclomatic Complexity',
    'Total Analyzed Files',
    'Code Stability Overview',
    'Overall Health',
    'Top Refactoring Priorities',
    'Quality Trend',
    'Recent Analysis Activity',
    'Complexity / Smell Breakdown',
    'Average Maintainability',
    'Average Comment Ratio',
    'Average Coupling',
    'Parse Failures',
  ];
  for (const section of requiredSections) {
    assert.ok(
      dashboardSource.includes(section),
      `Missing required Dashboard tile "${section}" in DashboardPage.jsx`
    );
  }
});

test('Upload flow validates .zip extension, empty files, and configurable size limit', () => {
  const uploadSource = fs.readFileSync(path.join(srcDir, 'pages', 'UploadPage.jsx'), 'utf8');
  assert.ok(
    uploadSource.includes(".endsWith('.zip')"),
    'UploadPage must validate .zip extension'
  );
  assert.ok(
    uploadSource.includes('file.size === 0'),
    'UploadPage must reject 0-byte empty archives'
  );
  assert.ok(
    uploadSource.includes('maxUploadMb'),
    'UploadPage must enforce configurable size limit'
  );
});

test('ProjectAnalysisPage supports table sorting, search/filtering, and Drawer inspection', () => {
  const analysisSource = fs.readFileSync(
    path.join(srcDir, 'pages', 'ProjectAnalysisPage.jsx'),
    'utf8'
  );
  assert.ok(analysisSource.includes('<DataTable'), 'ProjectAnalysisPage must use DataTable');
  assert.ok(analysisSource.includes('<Drawer'), 'ProjectAnalysisPage must use Drawer');
  assert.ok(
    analysisSource.includes('Unavailable Metrics'),
    'ProjectAnalysisPage drawer must separate calculated from unavailable metrics'
  );
});

test('MetricsExplorerPage uses CSS Grid correlation heatmap, ComposedChart box plot, and guards .map() calls', () => {
  const explorerSource = fs.readFileSync(
    path.join(srcDir, 'pages', 'MetricsExplorerPage.jsx'),
    'utf8'
  );
  assert.ok(
    explorerSource.includes('gridTemplateColumns'),
    'MetricsExplorerPage must render correlation heatmap as a styled CSS grid'
  );
  assert.ok(
    explorerSource.includes('ComposedChart'),
    'MetricsExplorerPage must use ComposedChart for quartile box plot visualization'
  );
  assert.ok(
    explorerSource.includes('EmptyProjectState'),
    'MetricsExplorerPage must handle missing run/project with EmptyProjectState'
  );
  assert.ok(
    explorerSource.includes('Small Sample Size Notice'),
    'MetricsExplorerPage must handle projects with fewer than 3 files with a clear message'
  );
});

test('Semantic metric delta evaluation never assumes reducing every metric is an improvement', () => {
  // Higher is better (e.g., Health Score, Maintainability Index)
  assert.equal(evaluateMetricDelta(8.5, 'higher_is_better'), 'improved');
  assert.equal(evaluateMetricDelta(-4.2, 'higher_is_better'), 'worsened');

  // Lower is better (e.g., Cyclomatic Complexity, Coupling, Parse Failures)
  assert.equal(evaluateMetricDelta(-3.1, 'lower_is_better'), 'improved');
  assert.equal(evaluateMetricDelta(2.5, 'lower_is_better'), 'worsened');

  // Neutral / Context-dependent (e.g., Total LOC, Total Files)
  assert.equal(evaluateMetricDelta(-50, 'neutral'), 'neutral');
  assert.equal(evaluateMetricDelta(120, 'neutral'), 'neutral');

  // Status levels for footer metric strip
  assert.equal(getScoreStatusLevel(85).label, 'Excellent');
  assert.equal(getCommentRatioStatusLevel(12).label, 'Good');
  assert.equal(getCouplingStatusLevel(3.2).label, 'Excellent');
  assert.equal(getParseFailureStatusLevel(0, 10).label, 'Excellent');
});

test('API client defines all required backend integration methods including getDashboard', () => {
  const apiSource = fs.readFileSync(path.join(srcDir, 'services', 'api.js'), 'utf8');
  const requiredMethods = [
    'getHealth',
    'getDashboard',
    'listProjects',
    'getProject',
    'uploadProject',
    'analyzeProject',
    'getAnalysisRun',
    'getAnalysisMetrics',
    'getAnalysisCorrelations',
    'getAnalysisRisks',
    'getAnalysisPriorities',
    'getProjectHistory',
    'compareRuns',
    'downloadReportBlob',
    'getSettings',
    'updateSettings',
  ];
  for (const method of requiredMethods) {
    assert.ok(apiSource.includes(method), `Missing API method ${method} in services/api.js`);
  }
});

test('Risk & Technical Debt page clearly distinguishes Rule-Based Heuristics from ML Predictions', () => {
  const riskSource = fs.readFileSync(path.join(srcDir, 'pages', 'RiskDebtPage.jsx'), 'utf8');
  assert.ok(
    riskSource.includes('Rule-Based Risk Assessment'),
    'Risk page must clearly label rule-based assessments'
  );
  assert.ok(
    riskSource.includes('ML_MODEL_PREDICTION'),
    'Risk page must check assessment_mode for ML_MODEL_PREDICTION'
  );
});

test('Zero light-theme leftovers across all frontend source files', () => {
  const walk = (dir) => {
    let list = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) list = list.concat(walk(full));
      else if (entry.name.endsWith('.jsx') || entry.name.endsWith('.js') || entry.name.endsWith('.css'))
        list.push(full);
    }
    return list;
  };

  const allFiles = walk(srcDir);
  const banned = ['bg-white', 'bg-gray-50', 'bg-gray-100', 'text-gray-900', 'border-gray-200', '#fff', '#FFFFFF', 'text-white'];
  for (const file of allFiles) {
    const content = fs.readFileSync(file, 'utf8');
    for (const token of banned) {
      assert.ok(
        !content.includes(token),
        `Found prohibited light class/token "${token}" in ${path.relative(srcDir, file)}`
      );
    }
  }
});
