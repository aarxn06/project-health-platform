import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  History,
  GitCompare,
  Search,
  ExternalLink,
  Download,
  Info,
  Sparkles,
  UploadCloud,
  Loader2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { usePlatform } from '../context/PlatformContext';
import { platformApi, extractApiError } from '../services/api';
import EmptyProjectState from '../components/EmptyProjectState';
import {
  Card,
  CardHeader,
  DeltaBadge,
  StatusChip,
  LoadingSkeleton,
  ErrorBanner,
  ChartTheme,
  DARK_TOOLTIP_CONTENT_STYLE,
  DARK_AXIS_TICK,
  DARK_AXIS_LINE,
} from '../components/ui';
import { formatTimestamp } from '../utils/formatters';

export default function HistoryComparePage() {
  const navigate = useNavigate();
  const {
    projects,
    activeProject,
    activeRun,
    projectRuns,
    loadingInitial,
    selectProjectAndRun,
    refreshPlatformState,
  } = usePlatform();

  const [allHistory, setAllHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyProjectFilter, setHistoryProjectFilter] = useState('ALL');

  // Comparison state (Section 3H)
  const [firstRunId, setFirstRunId] = useState('');
  const [secondRunId, setSecondRunId] = useState('');
  const [comparisonData, setComparisonData] = useState(null);
  const [loadingComparison, setLoadingComparison] = useState(false);
  const [runningSampleV2, setRunningSampleV2] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchHistory() {
      try {
        setLoadingHistory(true);
        const rows = await platformApi.getAllHistory();
        if (!cancelled) setAllHistory(rows || []);
      } catch (err) {
        if (!cancelled) setError(extractApiError(err));
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    }
    fetchHistory();
    return () => {
      cancelled = true;
    };
  }, [projects, projectRuns]);

  // Auto-select previous and latest runs for activeProject when projectRuns changes
  useEffect(() => {
    if (projectRuns && projectRuns.length >= 2) {
      const sortedAsc = [...projectRuns].sort((a, b) => a.run_number - b.run_number);
      const r1 = sortedAsc[sortedAsc.length - 2].id;
      const r2 = sortedAsc[sortedAsc.length - 1].id;
      setFirstRunId(String(r1));
      setSecondRunId(String(r2));
    } else if (projectRuns && projectRuns.length === 1) {
      setFirstRunId(String(projectRuns[0].id));
      setSecondRunId('');
      setComparisonData(null);
    } else {
      setFirstRunId('');
      setSecondRunId('');
      setComparisonData(null);
    }
  }, [projectRuns]);

  // Fetch comparison whenever both firstRunId and secondRunId are valid and distinct
  const isSameRunSelected = Boolean(firstRunId && secondRunId && String(firstRunId) === String(secondRunId));

  useEffect(() => {
    if (!activeProject?.id || !firstRunId || !secondRunId || String(firstRunId) === String(secondRunId)) {
      setComparisonData(null);
      return;
    }
    let cancelled = false;
    async function runComparison() {
      try {
        setLoadingComparison(true);
        setError(null);
        const res = await platformApi.compareRuns(
          activeProject.id,
          Number(firstRunId),
          Number(secondRunId)
        );
        if (!cancelled) setComparisonData(res);
      } catch (err) {
        if (!cancelled) setError(extractApiError(err));
      } finally {
        if (!cancelled) setLoadingComparison(false);
      }
    }
    runComparison();
    return () => {
      cancelled = true;
    };
  }, [activeProject?.id, firstRunId, secondRunId]);

  const handleAnalyzeRefactoredV2Sample = async () => {
    if (!activeProject?.id) return;
    try {
      setRunningSampleV2(true);
      setError(null);
      const res = await platformApi.analyzeSample('v2', activeProject.id);
      const newRunId = res.data?.analysis_run?.id;
      await refreshPlatformState(activeProject.id, newRunId);
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setRunningSampleV2(false);
    }
  };

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return (allHistory || []).filter((r) => {
      const matchesProj =
        historyProjectFilter === 'ALL' || String(r.project_id) === String(historyProjectFilter);
      const matchesQ =
        !q ||
        (r.project_name || '').toLowerCase().includes(q) ||
        (r.version_label || '').toLowerCase().includes(q) ||
        (r.archive_filename || '').toLowerCase().includes(q);
      return matchesProj && matchesQ;
    });
  }, [allHistory, historySearch, historyProjectFilter]);

  if (loadingInitial) {
    return <LoadingSkeleton rows={3} />;
  }

  if (projects.length === 0) {
    return <EmptyProjectState title="No Analysis History Recorded Yet" />;
  }

  const mapInterpretationToDirection = (metricItem) => {
    if (metricItem?.direction) return metricItem.direction;
    if (metricItem?.direction_rule === 'HIGHER_IS_BETTER') return 'higher_is_better';
    if (metricItem?.direction_rule === 'LOWER_IS_BETTER') return 'lower_is_better';
    return 'neutral';
  };

  const coreMetricsChartData = (comparisonData?.metric_comparisons || [])
    .filter((mc) =>
      ['health_score', 'avg_maintainability', 'avg_complexity', 'total_code_smells'].includes(
        mc.key
      )
    )
    .map((mc) => ({
      metric:
        mc.key === 'health_score'
          ? 'Health Score'
          : mc.key === 'avg_maintainability'
          ? 'Maintainability'
          : mc.key === 'avg_complexity'
          ? 'Avg Complexity'
          : 'Code Smells',
      first_value: mc.first_value,
      second_value: mc.second_value,
    }));

  return (
    <div className="space-y-5">
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* =====================================================================
          SECTION 1: Before-and-After Run Comparison (Section 3H)
         ===================================================================== */}
      <Card padding="p-5">
        <CardHeader
          title={`Before-and-After Run Comparison (${activeProject?.name || 'Select Project'})`}
          icon={GitCompare}
          tooltip="Compare two stored analysis runs for the same project across Health Score, LOC, Complexity, Maintainability, Code Smells, and Risk distribution. Never assumes that reducing every metric is an improvement."
          rightControl={
            projectRuns.length === 1 && (
              <button
                type="button"
                onClick={handleAnalyzeRefactoredV2Sample}
                disabled={runningSampleV2}
                className="ui-btn-primary px-3 py-1.5 text-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {runningSampleV2 ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing v2 Refactored Snapshot...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Run Sample v2 (Refactored) on This Project to Compare</span>
                  </>
                )}
              </button>
            )
          }
        />

        {projectRuns.length < 2 ? (
          <div className="p-5 rounded-xl bg-[#0E0E11] border border-[#1F1F25] text-center space-y-2.5">
            <div className="text-xs font-semibold text-[#F4F4F5]">
              Project &ldquo;{activeProject?.name}&rdquo; currently has 1 stored analysis run.
            </div>
            <p className="text-xs text-[#A1A1AA] max-w-xl mx-auto">
              Upload a second ZIP version on the Upload Project page (using &ldquo;Append Run to
              Existing Project&rdquo;) or click the button above to run the refactored v2 sample
              archive against this project.
            </p>
            <div className="pt-1">
              <button
                type="button"
                onClick={() => navigate('/upload')}
                className="ui-btn-secondary px-3.5 py-1.5 text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <UploadCloud className="w-3.5 h-3.5 text-[#7C5CFF]" />
                <span>Upload Second Run Archive</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Run Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 rounded-xl bg-[#0E0E11] border border-[#1F1F25]">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-[#A1A1AA] mb-1">
                  Baseline Run (Before)
                </label>
                <select
                  value={firstRunId}
                  onChange={(e) => setFirstRunId(e.target.value)}
                  className="w-full px-3 py-2 ui-input font-mono"
                >
                  {(projectRuns || []).map((r) => (
                    <option key={r.id} value={r.id}>
                      Run #{r.run_number} — {r.version_label} (Health: {r.health_score}/100)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-[#A1A1AA] mb-1">
                  Target Run (After)
                </label>
                <select
                  value={secondRunId}
                  onChange={(e) => setSecondRunId(e.target.value)}
                  className="w-full px-3 py-2 ui-input font-mono"
                >
                  {(projectRuns || []).map((r) => (
                    <option key={r.id} value={r.id}>
                      Run #{r.run_number} — {r.version_label} (Health: {r.health_score}/100)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {isSameRunSelected ? (
              <div className="p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/35 text-xs text-[#EF4444] font-medium">
                Cannot compare an analysis run with itself. Please select two distinct runs for Baseline (Before) and Target (After).
              </div>
            ) : loadingComparison ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-[#7C5CFF] mr-2" />
                <span className="text-xs font-mono text-[#A1A1AA]">
                  Computing Run-to-Run Deltas...
                </span>
              </div>
            ) : (
              comparisonData && (
                <>
                  {/* Comparison Cards Grid with DeltaBadge */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(comparisonData.metric_comparisons || []).map((mc) => {
                      const direction = mapInterpretationToDirection(mc);
                      const statusChipVariant =
                        mc.evaluation === 'IMPROVED'
                          ? 'success'
                          : mc.evaluation === 'WORSENED'
                          ? 'danger'
                          : 'muted';

                      return (
                        <div
                          key={mc.key}
                          className="p-3.5 rounded-xl bg-[#0E0E11] border border-[#1F1F25] flex flex-col justify-between gap-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#A1A1AA]">
                              {mc.label}
                            </span>
                            <StatusChip
                              status={mc.evaluation}
                              variant={statusChipVariant}
                              size="xs"
                            />
                          </div>

                          <div className="flex items-baseline justify-between gap-2 my-1">
                            <div className="font-mono text-xs text-[#6B6B76] tabular-nums">
                              Before: <span className="text-[#A1A1AA]">{mc.first_value}</span> →
                              After:{' '}
                              <span className="text-sm font-semibold text-[#F4F4F5]">
                                {mc.second_value} {mc.unit}
                              </span>
                            </div>
                            <DeltaBadge
                              delta={mc.delta}
                              pctChange={mc.pct_change ?? mc.percent_change}
                              direction={direction}
                              decimals={Number.isInteger(mc.delta) ? 0 : 2}
                            />
                          </div>

                          <div className="text-[10px] text-[#6B6B76] flex items-center gap-1 pt-1.5 border-t border-[#1F1F25]">
                            <Info className="w-3 h-3 shrink-0 text-[#6B6B76]" />
                            <span className="truncate">
                              {mc.interpretation || mc.interpretation_note}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Charts + File-Level Deltas Table */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    <div className="lg:col-span-6 p-4 rounded-xl bg-[#0E0E11] border border-[#1F1F25]">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#A1A1AA] mb-3">
                        Core Quality Metrics Comparison (Before vs After)
                      </div>
                      <ChartTheme height="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={coreMetricsChartData}
                            margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                          >
                            <CartesianGrid
                              stroke="#1F1F25"
                              strokeDasharray="3 3"
                              vertical={false}
                            />
                            <XAxis
                              dataKey="metric"
                              tick={DARK_AXIS_TICK}
                              axisLine={DARK_AXIS_LINE}
                              tickLine={false}
                            />
                            <YAxis
                              tick={DARK_AXIS_TICK}
                              axisLine={DARK_AXIS_LINE}
                              tickLine={false}
                            />
                            <Tooltip contentStyle={DARK_TOOLTIP_CONTENT_STYLE} />
                            <Legend wrapperStyle={{ fontSize: '11px', color: '#A1A1AA' }} />
                            <Bar
                              dataKey="first_value"
                              name={`Run #${comparisonData.first_run?.run_number} (Before)`}
                              fill="#4C8DFF"
                              radius={[4, 4, 0, 0]}
                            />
                            <Bar
                              dataKey="second_value"
                              name={`Run #${comparisonData.second_run?.run_number} (After)`}
                              fill="#7C5CFF"
                              radius={[4, 4, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartTheme>
                    </div>

                    <div className="lg:col-span-6 p-4 rounded-xl bg-[#0E0E11] border border-[#1F1F25]">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#A1A1AA] mb-3">
                        Risk Distribution Shift (Before vs After)
                      </div>
                      <ChartTheme height="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={comparisonData.risk_distribution_comparison || []}
                            margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                          >
                            <CartesianGrid
                              stroke="#1F1F25"
                              strokeDasharray="3 3"
                              vertical={false}
                            />
                            <XAxis
                              dataKey="category"
                              tick={DARK_AXIS_TICK}
                              axisLine={DARK_AXIS_LINE}
                              tickLine={false}
                              label={{
                                value: 'Risk Category',
                                position: 'insideBottom',
                                offset: -12,
                                fill: '#6B6B76',
                                fontSize: 11,
                              }}
                            />
                            <YAxis
                              allowDecimals={false}
                              tick={DARK_AXIS_TICK}
                              axisLine={DARK_AXIS_LINE}
                              tickLine={false}
                              label={{
                                value: 'Files',
                                angle: -90,
                                position: 'insideLeft',
                                fill: '#6B6B76',
                                fontSize: 11,
                              }}
                            />
                            <Tooltip contentStyle={DARK_TOOLTIP_CONTENT_STYLE} />
                            <Legend wrapperStyle={{ fontSize: '11px', color: '#A1A1AA' }} />
                            <Bar
                              dataKey="first_count"
                              name={`Run #${comparisonData.first_run?.run_number} (Before)`}
                              fill="#4C8DFF"
                              radius={[4, 4, 0, 0]}
                            />
                            <Bar
                              dataKey="second_count"
                              name={`Run #${comparisonData.second_run?.run_number} (After)`}
                              fill="#7C5CFF"
                              radius={[4, 4, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartTheme>
                    </div>
                  </div>

                  {/* File-Level Deltas Table */}
                  <div className="grid grid-cols-1 gap-4">
                    <div className="rounded-xl bg-[#0E0E11] border border-[#1F1F25] overflow-hidden flex flex-col">
                      <div className="p-3.5 border-b border-[#1F1F25] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#A1A1AA]">
                        File-Level Metric Changes ({comparisonData.file_changes?.length || 0}{' '}
                        files)
                      </div>
                      <div className="overflow-x-auto max-h-64">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="bg-[#111114] text-[10px] font-semibold uppercase text-[#A1A1AA] border-b border-[#1F1F25] sticky top-0">
                            <tr>
                              <th className="py-2 px-3">File</th>
                              <th className="py-2 px-2">Status</th>
                              <th className="py-2 px-2 text-right">Δ LOC</th>
                              <th className="py-2 px-2 text-right">Δ CC</th>
                              <th className="py-2 px-2 text-right">Δ MI</th>
                              <th className="py-2 px-3 text-right">Δ Risk Score</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#1F1F25] font-mono text-[11px] tabular-nums">
                            {comparisonData.file_changes?.map((fc, idx) => (
                              <tr key={idx} className="hover:bg-[#16161A]">
                                <td className="py-2 px-3 text-[#F4F4F5] font-medium truncate max-w-[180px]">
                                  {fc.file_name}
                                </td>
                                <td className="py-2 px-2">
                                  <StatusChip status={fc.change_type} size="xs" />
                                </td>
                                <td className="py-2 px-2 text-right text-[#A1A1AA]">
                                  {fc.loc_delta !== null && fc.loc_delta !== undefined
                                    ? `${fc.loc_delta > 0 ? '+' : ''}${fc.loc_delta}`
                                    : '—'}
                                </td>
                                <td
                                  className={`py-2 px-2 text-right font-semibold ${
                                    fc.complexity_delta < 0
                                      ? 'text-[#22C55E]'
                                      : fc.complexity_delta > 0
                                      ? 'text-[#EF4444]'
                                      : 'text-[#6B6B76]'
                                  }`}
                                >
                                  {fc.complexity_delta !== null &&
                                  fc.complexity_delta !== undefined
                                    ? `${fc.complexity_delta > 0 ? '+' : ''}${
                                        fc.complexity_delta
                                      }`
                                    : '—'}
                                </td>
                                <td
                                  className={`py-2 px-2 text-right font-semibold ${
                                    fc.maintainability_delta > 0
                                      ? 'text-[#22C55E]'
                                      : fc.maintainability_delta < 0
                                      ? 'text-[#EF4444]'
                                      : 'text-[#6B6B76]'
                                  }`}
                                >
                                  {fc.maintainability_delta !== null &&
                                  fc.maintainability_delta !== undefined
                                    ? `${fc.maintainability_delta > 0 ? '+' : ''}${
                                        fc.maintainability_delta
                                      }`
                                    : '—'}
                                </td>
                                <td
                                  className={`py-2 px-3 text-right font-semibold ${
                                    fc.risk_score_delta < 0
                                      ? 'text-[#22C55E]'
                                      : fc.risk_score_delta > 0
                                      ? 'text-[#EF4444]'
                                      : 'text-[#6B6B76]'
                                  }`}
                                >
                                  {fc.risk_score_delta !== null &&
                                  fc.risk_score_delta !== undefined
                                    ? `${fc.risk_score_delta > 0 ? '+' : ''}${
                                        fc.risk_score_delta
                                      }`
                                    : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </>
              )
            )}
          </div>
        )}
      </Card>

      {/* =====================================================================
          SECTION 2: Stored Analysis History Table (Section 3I)
         ===================================================================== */}
      <Card padding="p-0" className="overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#1F1F25] flex flex-wrap items-center justify-between gap-3">
          <CardHeader
            title="Stored Analysis Runs Audit Trail"
            icon={History}
            tooltip="All historical analysis runs persisted in SQLite. Search, filter by project, and reopen any previous snapshot."
            className="mb-0"
          />

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#6B6B76] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search project or run label..."
                className="pl-8 pr-3 py-1.5 ui-input w-56"
              />
            </div>

            <select
              value={historyProjectFilter}
              onChange={(e) => setHistoryProjectFilter(e.target.value)}
              className="px-2.5 py-1.5 ui-input"
            >
              <option value="ALL">All Projects ({projects.length})</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#0E0E11] border-b border-[#1F1F25] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#A1A1AA]">
              <tr>
                <th className="py-3 px-4">Project Name</th>
                <th className="py-3 px-3">Run & Version Label</th>
                <th className="py-3 px-3">Analysis Timestamp</th>
                <th className="py-3 px-3 text-right">Files Analyzed</th>
                <th className="py-3 px-3 text-right">Health Score</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F1F25] text-xs">
              {loadingHistory ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#A1A1AA]">
                    Loading stored analysis runs...
                  </td>
                </tr>
              ) : filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#6B6B76]">
                    No stored analysis runs match your search criteria.
                  </td>
                </tr>
              ) : (
                filteredHistory.map((run) => {
                  const isCurrentActive = activeRun?.id === run.id;
                  return (
                    <tr
                      key={run.id}
                      className={`hover:bg-[#16161A] transition-colors ${
                        isCurrentActive ? 'bg-[#7C5CFF]/10' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-semibold text-[#F4F4F5]">
                        {run.project_name}
                      </td>
                      <td className="py-3 px-3 font-mono text-[#A1A1AA]">
                        <span className="text-[#7C5CFF] font-semibold">#{run.run_number}</span> —{' '}
                        {run.version_label}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-[#6B6B76]">
                        {formatTimestamp(run.created_at)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-[#F4F4F5] tabular-nums">
                        {run.parsed_files}/{run.total_files}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold tabular-nums">
                        <span
                          className={
                            run.health_score >= 75
                              ? 'text-[#22C55E]'
                              : run.health_score >= 55
                              ? 'text-[#EAB308]'
                              : 'text-[#EF4444]'
                          }
                        >
                          {run.health_score}/100 ({run.health_grade})
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <StatusChip status={run.status} variant="success" size="xs" />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              await selectProjectAndRun(run.project_id, run.id);
                              navigate('/');
                            }}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer ${
                              isCurrentActive ? 'ui-btn-primary' : 'ui-btn-secondary'
                            }`}
                          >
                            <span>{isCurrentActive ? 'Active Snapshot' : 'Reopen Run'}</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>

                          <a
                            href={platformApi.getReportDownloadUrl(run.id)}
                            title="Download PDF Report"
                            className="ui-btn-secondary p-1.5 text-[#A1A1AA] hover:text-[#F4F4F5]"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
