import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  ListOrdered,
  TrendingUp,
  Activity,
  PieChart as PieChartIcon,
  ArrowUpRight,
  Download,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  Loader2,
  Sliders,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { usePlatform } from '../context/PlatformContext';
import { platformApi, extractApiError } from '../services/api';
import { useDashboardData } from '../hooks/useDashboardData';
import EmptyProjectState from '../components/EmptyProjectState';
import {
  Card,
  CardHeader,
  KpiCard,
  DeltaBadge,
  PeriodSelect,
  SegmentedBar,
  SegmentedBlockBar,
  StatusChip,
  LoadingSkeleton,
  ErrorBanner,
  ChartTheme,
  DARK_TOOLTIP_CONTENT_STYLE,
  DARK_AXIS_TICK,
  DARK_AXIS_LINE,
  renderDonutPercentageLabel,
} from '../components/ui';
import { formatTimestamp, formatNumber } from '../utils/formatters';

const DONUT_PALETTE = ['#7C5CFF', '#4C8DFF', '#F97316', '#EAB308', '#EF4444', '#22C55E'];

export default function DashboardPage() {
  const navigate = useNavigate();
  const {
    activeProject,
    activeRun,
    globalError,
    loadingInitial,
    refreshPlatformState,
    selectProjectAndRun,
  } = usePlatform();

  const {
    dashboard,
    loading: loadingDashboard,
    error: dashboardError,
    reloadDashboard,
  } = useDashboardData(activeProject?.id, activeRun?.id);

  const [stabilityPeriod, setStabilityPeriod] = useState('last');
  const [trendPeriod, setTrendPeriod] = useState('10');
  const [breakdownMode, setBreakdownMode] = useState('smells'); // 'smells' | 'complexity'
  const [runningV2Sample, setRunningV2Sample] = useState(false);
  const [actionError, setActionError] = useState(null);

  const handleRunV2RefactoredDemo = async () => {
    if (!activeProject?.id) return;
    try {
      setRunningV2Sample(true);
      setActionError(null);
      const res = await platformApi.analyzeSample('v2', activeProject.id);
      const newRunId = res.data?.analysis_run?.id;
      await refreshPlatformState(activeProject.id, newRunId);
      await reloadDashboard();
    } catch (err) {
      setActionError(extractApiError(err));
    } finally {
      setRunningV2Sample(false);
    }
  };

  // Loading Skeleton State (Section 2.3)
  if (loadingInitial || (loadingDashboard && !dashboard)) {
    return <LoadingSkeleton rows={4} />;
  }

  // API Unavailable Error State
  if (globalError && !activeProject) {
    return (
      <div className="max-w-2xl mx-auto my-8">
        <ErrorBanner
          title="Backend Telemetry API Unavailable"
          message={globalError}
          onRetry={() => refreshPlatformState()}
        />
      </div>
    );
  }

  // Empty State when no project has been analyzed (Section 2.4)
  if (!activeProject || !activeRun || (dashboard && !dashboard.has_project)) {
    return <EmptyProjectState />;
  }

  const summary = dashboard?.active_run || activeRun;
  const hasHistory = Boolean(dashboard?.has_history);
  const historySeries = dashboard?.history_series || [];
  const deltas = dashboard?.kpi_deltas || {};
  const stability = dashboard?.stability_overview || {};
  const topPriorities = dashboard?.top_refactoring_priorities || [];
  const recentActivity = dashboard?.recent_activity || [];
  const breakdownCharts = dashboard?.breakdown_charts || {};
  const footerMetrics = dashboard?.footer_metrics || {};

  // Filter history series for Quality Trend chart based on PeriodSelect
  const filteredTrendSeries =
    trendPeriod === 'all'
      ? historySeries
      : historySeries.slice(-Number(trendPeriod || 10));

  // Health score semantic color
  const healthScoreVal = Number(summary.health_score || 0);
  const healthColorClass =
    healthScoreVal >= 75
      ? 'text-[#22C55E]'
      : healthScoreVal >= 55
      ? 'text-[#EAB308]'
      : healthScoreVal >= 40
      ? 'text-[#F97316]'
      : 'text-[#EF4444]';

  // Explainable Health Score factor breakdown (Section 6)
  const healthComponents = Object.values(
    stability.health_breakdown?.components || summary.health_breakdown?.components || {}
  );

  // Donut chart data (Code Smells vs Method Complexity Bands)
  const smellSlices = (breakdownCharts.code_smells || []).map((item, idx) => ({
    name: item.name,
    value: item.count,
    percentage: item.percentage,
    color:
      item.severity === 'HIGH'
        ? '#EF4444'
        : item.severity === 'MEDIUM'
        ? '#F97316'
        : DONUT_PALETTE[idx % DONUT_PALETTE.length],
  }));

  const complexityBandSlices = (breakdownCharts.complexity_bands || []).map((item) => ({
    name: item.name,
    value: item.count,
    percentage: item.percentage,
    color: item.color,
  }));

  const activeDonutSlices =
    breakdownMode === 'smells' && smellSlices.length > 0
      ? smellSlices
      : complexityBandSlices;

  const getRiskTextClass = (cat) => {
    const c = String(cat || '').toUpperCase();
    if (c === 'CRITICAL' || c === 'HIGH') return 'text-[#EF4444]';
    if (c === 'MEDIUM') return 'text-[#F97316]';
    return 'text-[#22C55E]';
  };

  return (
    <div className="space-y-4">
      {(dashboardError || actionError) && (
        <ErrorBanner
          message={dashboardError || actionError}
          onDismiss={() => setActionError(null)}
          onRetry={reloadDashboard}
        />
      )}

      {/* Compact Context Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#A1A1AA]">
          <StatusChip
            status={
              summary.scoring_mode === 'ML_MODEL_PREDICTION'
                ? `ML Defect Model (${summary.ml_model_used})`
                : 'Rule-Based Heuristic Analysis'
            }
            variant={summary.scoring_mode === 'ML_MODEL_PREDICTION' ? 'blue' : 'violet'}
          />
          <span className="font-mono text-[11px] text-[#6B6B76]">
            Run #{summary.run_number} ({summary.version_label}) · {summary.parsed_files}/
            {summary.total_files} Java files parsed
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!hasHistory && (
            <button
              type="button"
              onClick={handleRunV2RefactoredDemo}
              disabled={runningV2Sample}
              className="ui-btn-secondary px-2.5 py-1 text-[11px] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              title="Run the refactored v2 sample on this project to populate multi-run sparklines and deltas"
            >
              {runningV2Sample ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#7C5CFF]" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-[#7C5CFF]" />
              )}
              <span>Run v2 Refactored Snapshot (Enable Trends)</span>
            </button>
          )}
          <a
            href={platformApi.getReportDownloadUrl(summary.id)}
            className="ui-btn-secondary px-2.5 py-1 text-[11px] inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-[#7C5CFF]" />
            <span>Download PDF Report</span>
          </a>
        </div>
      </div>

      {/* =====================================================================
          ROW 1: KPI Cards with Sparklines (4-column strip with thin dividers)
         ===================================================================== */}
      <div className="ui-card overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#1F1F25]">
          <KpiCard
            label="Project Health Score"
            tooltip="Explainable 0–100 composite quality index combining Maintainability, Cyclomatic Complexity, Code Smells, and Risk Exposure."
            value={formatNumber(summary.health_score, 1)}
            unit="/ 100"
            subtitle={`Grade ${summary.health_grade}`}
            delta={deltas.health_score?.delta}
            pctChange={deltas.health_score?.pct_change}
            direction="higher_is_better"
            deltaDecimals={1}
            hasHistory={hasHistory}
            sparklineData={historySeries}
            sparklineKey="health_score"
            sparklineColor="#7C5CFF"
            gradientId="sparkHealth"
          />

          <KpiCard
            label="Total Lines of Code"
            tooltip="Physical non-blank, non-comment Java source lines (LOC) across all analyzed files."
            value={formatNumber(summary.total_loc, 0)}
            unit="LOC"
            subtitle={`${formatNumber(summary.total_lines, 0)} total lines`}
            delta={deltas.total_loc?.delta}
            pctChange={deltas.total_loc?.pct_change}
            direction="neutral"
            deltaDecimals={0}
            hasHistory={hasHistory}
            sparklineData={historySeries}
            sparklineKey="total_loc"
            sparklineColor="#4C8DFF"
            gradientId="sparkLoc"
          />

          <KpiCard
            label="Average Cyclomatic Complexity"
            tooltip="Mean file-level McCabe Cyclomatic Complexity extracted from Java AST branching statements. A decrease indicates simpler control flow and is shown green."
            value={formatNumber(summary.avg_complexity, 2)}
            unit="CC / file"
            subtitle={`Max CC: ${summary.max_complexity}`}
            delta={deltas.avg_complexity?.delta}
            pctChange={deltas.avg_complexity?.pct_change}
            direction="lower_is_better"
            deltaDecimals={2}
            hasHistory={hasHistory}
            sparklineData={historySeries}
            sparklineKey="avg_complexity"
            sparklineColor="#22C55E"
            gradientId="sparkCc"
          />

          <KpiCard
            label="Total Analyzed Files"
            tooltip="Total Java (.java) source files discovered and processed in the uploaded archive."
            value={formatNumber(summary.total_files, 0)}
            unit="files"
            subtitle={`${summary.total_methods} methods · ${summary.total_classes} types`}
            delta={deltas.total_files?.delta}
            pctChange={deltas.total_files?.pct_change}
            direction="neutral"
            deltaDecimals={0}
            hasHistory={hasHistory}
            sparklineData={historySeries}
            sparklineKey="total_files"
            sparklineColor="#7C5CFF"
            gradientId="sparkFiles"
          />
        </div>
      </div>

      {/* =====================================================================
          ROW 2: Code Stability Overview (Left) + Top Refactoring Priorities (Right)
         ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Panel: Code Stability Overview */}
        <Card className="lg:col-span-5 flex flex-col justify-between">
          <div>
            <CardHeader
              title="Code Stability Overview"
              icon={ShieldAlert}
              tooltip="Distribution of analyzed Java files across configured risk tiers. 'Critical' is shown only when a Critical Risk Threshold is defined in Settings."
              rightControl={
                <PeriodSelect
                  value={stabilityPeriod}
                  onChange={setStabilityPeriod}
                  options={[
                    { value: 'last', label: 'Current run' },
                    { value: 'compare', label: 'With factor breakdown' },
                  ]}
                />
              }
            />

            {/* Large "<score>/100 Overall Health" */}
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-2xl sm:text-3xl font-semibold font-mono tabular-nums tracking-tight ${healthColorClass}`}
                >
                  {formatNumber(summary.health_score, 1)}/100 Overall Health
                </span>
              </div>
              <StatusChip
                status={
                  healthScoreVal >= 80
                    ? 'Excellent'
                    : healthScoreVal >= 65
                    ? 'Good'
                    : healthScoreVal >= 45
                    ? 'Fair'
                    : 'Poor'
                }
              />
            </div>

            {/* Horizontal Segmented Bar & Legend List */}
            <SegmentedBar
              segments={stability.categories || []}
              height="h-3.5"
              showLegend={true}
            />

            {/* One-line comparison summary vs previous run when history exists */}
            {stability.comparison_summary_line && (
              <div className="mt-3 px-3 py-2 rounded-lg bg-[#0E0E11] border border-[#1F1F25] text-xs text-[#A1A1AA] flex items-center justify-between gap-2">
                <span>{stability.comparison_summary_line}</span>
              </div>
            )}
          </div>

          {/* Explainable Health Score Factor Breakdown (Section 6) */}
          {healthComponents.length > 0 && (
            <div className="mt-4 pt-3.5 border-t border-[#1F1F25]">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.06em] text-[#A1A1AA] font-semibold mb-2">
                <span>Health Score Factor Breakdown</span>
                <button
                  type="button"
                  onClick={() => navigate('/settings')}
                  className="text-[10px] font-mono text-[#7C5CFF] hover:underline normal-case tracking-normal inline-flex items-center gap-1 cursor-pointer"
                >
                  <Sliders className="w-3 h-3" />
                  <span>Weights</span>
                </button>
              </div>
              <div className="space-y-2">
                {healthComponents.map((comp) => {
                  const score = Number(comp.normalized_score || 0);
                  const barColor =
                    score >= 75
                      ? '#22C55E'
                      : score >= 50
                      ? '#EAB308'
                      : '#EF4444';
                  return (
                    <div key={comp.label} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#A1A1AA] truncate">
                          {comp.label}{' '}
                          <span className="text-[#6B6B76] font-mono">
                            ({Math.round((comp.weight || 0) * 100)}%)
                          </span>
                        </span>
                        <span className="font-mono text-[#F4F4F5] tabular-nums">
                          {score.toFixed(1)}/100
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-[#0E0E11] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-200"
                          style={{
                            width: `${Math.min(100, Math.max(3, score))}%`,
                            backgroundColor: barColor,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>

        {/* Right Panel: Top Refactoring Priorities (compact table) */}
        <Card className="lg:col-span-7 flex flex-col justify-between" padding="p-0">
          <div className="p-4 sm:p-5 pb-3 border-b border-[#1F1F25]">
            <CardHeader
              title="Top Refactoring Priorities"
              icon={ListOrdered}
              tooltip="Files ranked highest for engineering attention using weighted Risk Score, Cyclomatic Complexity, Maintainability deficit, and Code Smell severity. Click any row to inspect file details."
              className="mb-0"
              rightControl={
                <button
                  type="button"
                  onClick={() => navigate('/priorities')}
                  className="text-[11px] font-medium text-[#7C5CFF] hover:text-[#4C8DFF] inline-flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>View all ({topPriorities.length})</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              }
            />
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#0E0E11] border-b border-[#1F1F25] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#A1A1AA]">
                <tr>
                  <th className="py-2.5 px-4">File</th>
                  <th className="py-2.5 px-3 text-right">Priority Score</th>
                  <th className="py-2.5 px-3 text-right">Complexity</th>
                  <th className="py-2.5 px-3 text-right">LOC</th>
                  <th className="py-2.5 px-4 text-right">Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F1F25] text-xs">
                {topPriorities.slice(0, 7).map((item) => {
                  const prioColor =
                    item.priority_score >= 65
                      ? 'text-[#EF4444]'
                      : item.priority_score >= 40
                      ? 'text-[#F97316]'
                      : 'text-[#22C55E]';
                  const ccColor =
                    item.cyclomatic_complexity >= 20
                      ? 'text-[#EF4444]'
                      : item.cyclomatic_complexity >= 10
                      ? 'text-[#F97316]'
                      : 'text-[#22C55E]';

                  return (
                    <tr
                      key={item.id || item.file_path}
                      onClick={() =>
                        navigate(`/analysis?file=${encodeURIComponent(item.file_path)}`)
                      }
                      className="hover:bg-[#16161A] transition-colors cursor-pointer group"
                    >
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-[10px] text-[#6B6B76] w-5">
                            #{item.priority_rank}
                          </span>
                          <div className="min-w-0">
                            <div className="font-mono font-medium text-[#F4F4F5] group-hover:text-[#7C5CFF] transition-colors truncate">
                              {item.file_name}
                            </div>
                            <div className="font-mono text-[10px] text-[#6B6B76] truncate max-w-[230px]">
                              {item.file_path}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono font-semibold tabular-nums ${prioColor}`}
                      >
                        {Number(item.priority_score).toFixed(1)}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono font-semibold tabular-nums ${ccColor}`}
                      >
                        {item.cyclomatic_complexity}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[#A1A1AA] tabular-nums">
                        {item.loc}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <span
                            className={`font-mono text-[11px] font-semibold tabular-nums ${getRiskTextClass(
                              item.risk_category
                            )}`}
                          >
                            {Number(item.risk_score).toFixed(1)}
                          </span>
                          <StatusChip status={item.risk_category} size="xs" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-2.5 bg-[#0E0E11] border-t border-[#1F1F25] text-[11px] text-[#6B6B76] flex items-center justify-between">
            <span>Click any file row to open its full AST metric & smell diagnostic drawer</span>
            <span className="font-mono text-[#A1A1AA]">
              High Risk: {summary.high_risk_count} · Medium: {summary.medium_risk_count} · Low:{' '}
              {summary.low_risk_count}
            </span>
          </div>
        </Card>
      </div>

      {/* =====================================================================
          ROW 3: Quality Trend (Left) + Recent Analysis Activity (Centre) + Breakdown (Right)
         ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Quality Trend (Purple area chart across runs) */}
        <Card className="lg:col-span-5 flex flex-col justify-between">
          <CardHeader
            title="Quality Trend"
            icon={TrendingUp}
            tooltip="Project Health Score (0–100) trajectory across stored analysis runs for the current project."
            rightControl={
              <PeriodSelect
                value={trendPeriod}
                onChange={setTrendPeriod}
                options={[
                  { value: '5', label: 'Last 5 runs' },
                  { value: '10', label: 'Last 10 runs' },
                  { value: 'all', label: 'All runs' },
                ]}
              />
            }
          />

          <ChartTheme height="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={filteredTrendSeries}
                margin={{ top: 10, right: 12, left: 0, bottom: 16 }}
              >
                <defs>
                  <linearGradient id="qualityTrendViolet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7C5CFF" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="#7C5CFF" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="#1F1F25"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={DARK_AXIS_TICK}
                  axisLine={DARK_AXIS_LINE}
                  tickLine={false}
                  label={{
                    value: 'Analysis Run',
                    position: 'insideBottom',
                    offset: -10,
                    fill: '#6B6B76',
                    fontSize: 11,
                  }}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={DARK_AXIS_TICK}
                  axisLine={DARK_AXIS_LINE}
                  tickLine={false}
                  width={36}
                  label={{
                    value: 'Health (0–100)',
                    angle: -90,
                    position: 'insideLeft',
                    fill: '#6B6B76',
                    fontSize: 11,
                  }}
                />
                <Tooltip contentStyle={DARK_TOOLTIP_CONTENT_STYLE} />
                <Area
                  type="monotone"
                  dataKey="health_score"
                  name="Health Score"
                  stroke="#7C5CFF"
                  strokeWidth={2.25}
                  fill="url(#qualityTrendViolet)"
                  dot={{ r: 3.5, fill: '#7C5CFF', stroke: '#111114', strokeWidth: 1.5 }}
                  activeDot={{ r: 5, fill: '#7C5CFF', stroke: '#F4F4F5', strokeWidth: 1.5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartTheme>

          <div className="mt-2 pt-2 border-t border-[#1F1F25] flex items-center justify-between text-[11px] text-[#6B6B76]">
            <span>
              {hasHistory
                ? `Showing ${filteredTrendSeries.length} stored analysis run(s)`
                : 'Single run stored — run another analysis to compare longitudinal trend'}
            </span>
            <button
              type="button"
              onClick={() => navigate('/history')}
              className="text-[#7C5CFF] hover:underline font-medium cursor-pointer"
            >
              Compare Runs →
            </button>
          </div>
        </Card>

        {/* Centre: Recent Analysis Activity */}
        <Card className="lg:col-span-4 flex flex-col justify-between">
          <div>
            <CardHeader
              title="Recent Analysis Activity"
              icon={Activity}
              tooltip="Chronological audit log of recent Java static-analysis executions stored in SQLite."
              rightControl={
                <span className="text-[11px] font-mono text-[#6B6B76]">
                  {recentActivity.length} {recentActivity.length === 1 ? 'run' : 'runs'}
                </span>
              }
            />

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {recentActivity.map((act) => {
                const isCurrent = act.id === summary.id;
                const scoreVal = Number(act.health_score || 0);
                const chipVariant =
                  scoreVal >= 75
                    ? 'success'
                    : scoreVal >= 55
                    ? 'yellow'
                    : scoreVal >= 40
                    ? 'orange'
                    : 'danger';

                return (
                  <div
                    key={act.id}
                    onClick={() => selectProjectAndRun(act.project_id, act.id)}
                    className={`p-2.5 rounded-lg border transition-colors cursor-pointer flex items-center justify-between gap-2.5 ${
                      isCurrent
                        ? 'bg-[#7C5CFF]/10 border-[#7C5CFF]/35'
                        : 'bg-[#0E0E11] border-[#1F1F25] hover:bg-[#16161A] hover:border-[#2A2A32]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 border ${
                          isCurrent
                            ? 'bg-[#7C5CFF]/20 border-[#7C5CFF]/40 text-[#7C5CFF]'
                            : 'bg-[#111114] border-[#1F1F25] text-[#A1A1AA]'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-[#F4F4F5] truncate">
                          {act.project_name} ·{' '}
                          <span className="font-mono text-[#A1A1AA]">{act.version_label}</span>
                        </div>
                        <div className="text-[10px] font-mono text-[#6B6B76] truncate">
                          {formatTimestamp(act.created_at)} · {act.total_files} files
                        </div>
                      </div>
                    </div>

                    <StatusChip
                      status={`${scoreVal.toFixed(1)}`}
                      variant={chipVariant}
                      size="xs"
                      className="font-mono shrink-0"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-2 pt-2 border-t border-[#1F1F25] flex items-center justify-between text-[11px] text-[#6B6B76]">
            <span>Click any run to load its snapshot</span>
            <button
              type="button"
              onClick={() => navigate('/history')}
              className="text-[#7C5CFF] hover:underline font-medium cursor-pointer"
            >
              Full History →
            </button>
          </div>
        </Card>

        {/* Right: Complexity / Code-Smell Breakdown (Donut chart with white % labels) */}
        <Card className="lg:col-span-3 flex flex-col justify-between">
          <div>
            <CardHeader
              title="Complexity / Smell Breakdown"
              icon={PieChartIcon}
              tooltip="Proportional breakdown of detected static code smells or method-level Cyclomatic Complexity bands (1–5 Simple, 6–10 Moderate, 11+ Complex)."
              rightControl={
                <div className="inline-flex rounded-full bg-[#0E0E11] border border-[#1F1F25] p-0.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setBreakdownMode('smells')}
                    className={`px-2 py-0.5 rounded-full transition-colors cursor-pointer ${
                      breakdownMode === 'smells'
                        ? 'bg-[#7C5CFF] text-[#F4F4F5] font-semibold'
                        : 'text-[#A1A1AA] hover:text-[#F4F4F5]'
                    }`}
                  >
                    Smells
                  </button>
                  <button
                    type="button"
                    onClick={() => setBreakdownMode('complexity')}
                    className={`px-2 py-0.5 rounded-full transition-colors cursor-pointer ${
                      breakdownMode === 'complexity'
                        ? 'bg-[#7C5CFF] text-[#F4F4F5] font-semibold'
                        : 'text-[#A1A1AA] hover:text-[#F4F4F5]'
                    }`}
                  >
                    CC Bands
                  </button>
                </div>
              }
            />

            <ChartTheme height="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={activeDonutSlices}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={34}
                    outerRadius={62}
                    paddingAngle={2}
                    stroke="#111114"
                    strokeWidth={2}
                    labelLine={false}
                    label={renderDonutPercentageLabel}
                    isAnimationActive={false}
                  >
                    {activeDonutSlices.map((entry, index) => (
                      <Cell
                        key={`slice-${index}`}
                        fill={entry.color || DONUT_PALETTE[index % DONUT_PALETTE.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={DARK_TOOLTIP_CONTENT_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            </ChartTheme>

            {/* Swatch Legend */}
            <div className="mt-2 space-y-1 max-h-28 overflow-y-auto pr-1">
              {activeDonutSlices.map((slice, idx) => (
                <div
                  key={slice.name || idx}
                  className="flex items-center justify-between text-[11px] py-0.5"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2 h-2 rounded-xs shrink-0"
                      style={{
                        backgroundColor:
                          slice.color || DONUT_PALETTE[idx % DONUT_PALETTE.length],
                      }}
                    />
                    <span className="text-[#A1A1AA] truncate">{slice.name}</span>
                  </div>
                  <span className="font-mono text-[#F4F4F5] tabular-nums shrink-0 ml-2">
                    {slice.value} ({slice.percentage}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-2 pt-2 border-t border-[#1F1F25] text-[11px] text-[#6B6B76] flex items-center justify-between">
            <span>
              {breakdownMode === 'smells' && smellSlices.length > 0
                ? `Total Smells: ${summary.total_code_smells}`
                : `Total Methods: ${summary.total_methods}`}
            </span>
            <button
              type="button"
              onClick={() => navigate('/metrics')}
              className="text-[#7C5CFF] hover:underline font-medium cursor-pointer"
            >
              Metrics Explorer →
            </button>
          </div>
        </Card>
      </div>

      {/* =====================================================================
          ROW 4: Footer Metric Strip (4 compact tiles with level bars & chips)
         ===================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          footerMetrics.maintainability || {
            label: 'Average Maintainability',
            supported: summary.parsed_files > 0 && summary.avg_maintainability !== null,
            value: summary.avg_maintainability,
            unit: '/ 100',
            status_chip: 'Good',
            variant: 'blue',
            level_blocks: 3,
            delta: deltas.avg_maintainability,
            tooltip:
              'Normalized SEI Maintainability Index (0–100) calculated from Halstead Volume, Cyclomatic Complexity, and LOC.',
          },
          footerMetrics.comment_ratio || {
            label: 'Average Comment Ratio',
            supported: summary.total_files > 0,
            value: summary.avg_comment_ratio,
            unit: '%',
            status_chip: 'Good',
            variant: 'blue',
            level_blocks: 3,
            delta: deltas.avg_comment_ratio,
            tooltip: 'Percentage of source lines containing single-line, block, or Javadoc comments.',
          },
          footerMetrics.coupling || {
            label: 'Average Coupling',
            supported: summary.parsed_files > 0,
            value: summary.avg_coupling,
            unit: 'fan-out',
            status_chip: 'Good',
            variant: 'blue',
            level_blocks: 3,
            delta: deltas.avg_coupling,
            tooltip: 'Mean structural coupling score combining imported packages and referenced AST types.',
          },
          footerMetrics.parse_failures || {
            label: 'Parse Failures / Files with Errors',
            supported: true,
            value: summary.failed_files,
            unit: `of ${summary.total_files} files`,
            status_chip: summary.failed_files === 0 ? 'Excellent' : 'Fair',
            variant: summary.failed_files === 0 ? 'success' : 'yellow',
            level_blocks: summary.failed_files === 0 ? 4 : 2,
            delta: deltas.failed_files,
            tooltip: 'Number of Java files that failed AST syntax parsing during analysis.',
          },
        ].map((tile) => (
          <Card key={tile.label} padding="p-4" className="flex flex-col justify-between gap-2.5">
            <CardHeader
              title={tile.label}
              tooltip={
                tile.supported
                  ? tile.tooltip
                  : 'Not available: This metric could not be calculated because no valid Java AST files were parsed.'
              }
              className="mb-0"
              rightControl={
                <StatusChip
                  status={tile.supported ? tile.status_chip : 'Not available'}
                  variant={tile.supported ? tile.variant : 'muted'}
                  size="xs"
                />
              }
            />

            <div className="flex items-baseline justify-between gap-2 my-1">
              {tile.supported && tile.value !== null && tile.value !== undefined ? (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-semibold font-mono text-[#F4F4F5] tabular-nums">
                    {tile.value}
                  </span>
                  <span className="text-xs font-mono text-[#6B6B76]">{tile.unit}</span>
                </div>
              ) : (
                <span className="text-sm font-mono text-[#6B6B76]">Not available</span>
              )}

              {hasHistory && tile.delta && (
                <DeltaBadge
                  delta={tile.delta.delta}
                  pctChange={tile.delta.pct_change}
                  direction={tile.delta.direction}
                  decimals={tile.label.includes('Failures') ? 0 : 1}
                />
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#1F1F25]">
              <span className="text-[11px] text-[#6B6B76]">Quality Level</span>
              <SegmentedBlockBar
                activeBlocks={tile.supported ? tile.level_blocks : 0}
                totalBlocks={4}
                variant={tile.supported ? tile.variant : 'muted'}
              />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
