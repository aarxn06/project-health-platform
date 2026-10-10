import React, { useEffect, useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell,
} from 'recharts';
import {
  SlidersHorizontal,
  Sigma,
  GitCompareArrows,
  BarChart3,
  Activity,
  ShieldAlert,
  AlertTriangle,
} from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { platformApi, extractApiError } from '../services/api';
import EmptyProjectState from '../components/EmptyProjectState';
import {
  Card,
  CardHeader,
  Select,
  ProgressBar,
  LoadingSkeleton,
  ErrorBanner,
  ChartTheme,
  RISK_PALETTE,
  DARK_TOOLTIP_CONTENT_STYLE,
  DARK_AXIS_TICK,
  DARK_AXIS_LINE,
} from '../components/ui';

export default function MetricsExplorerPage() {
  const {
    projects,
    activeProject,
    activeRun,
    loadingInitial,
    selectProjectAndRun,
  } = usePlatform();

  const [metricsData, setMetricsData] = useState(null);
  const [corrData, setCorrData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Interactive Filters: Project, Metric, Scatter X/Y, File, Risk Tier
  const [selectedMetric, setSelectedMetric] = useState('cyclomatic_complexity');
  const [scatterX, setScatterX] = useState('loc');
  const [scatterY, setScatterY] = useState('cyclomatic_complexity');
  const [fileFilter, setFileFilter] = useState('ALL');
  const [riskTierFilter, setRiskTierFilter] = useState('ALL');

  useEffect(() => {
    if (!activeRun?.id) {
      setMetricsData(null);
      setCorrData(null);
      return;
    }
    let cancelled = false;
    async function fetchAnalytics() {
      try {
        setLoading(true);
        setError(null);
        const [mRes, cRes] = await Promise.all([
          platformApi.getAnalysisMetrics(activeRun.id),
          platformApi.getAnalysisCorrelations(activeRun.id),
        ]);
        if (!cancelled) {
          setMetricsData(mRes || null);
          setCorrData(cRes || null);
          setFileFilter('ALL');
        }
      } catch (err) {
        if (!cancelled) setError(extractApiError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchAnalytics();
    return () => {
      cancelled = true;
    };
  }, [activeRun?.id]);

  const filesData = Array.isArray(metricsData?.files_data) ? metricsData.files_data : [];
  const metricsMeta = Array.isArray(metricsData?.metrics_metadata)
    ? metricsData.metrics_metadata
    : [];

  const metricLabelMap = useMemo(() => {
    const map = {};
    (metricsMeta || []).forEach((m) => {
      if (m && m.key) {
        map[m.key] = m.label;
      }
    });
    return map;
  }, [metricsMeta]);

  const filteredFiles = useMemo(() => {
    return (filesData || []).filter((f) => {
      if (!f) return false;
      const matchFile = fileFilter === 'ALL' || f.file_path === fileFilter;
      const matchRisk = riskTierFilter === 'ALL' || f.risk_category === riskTierFilter;
      return matchFile && matchRisk;
    });
  }, [filesData, fileFilter, riskTierFilter]);

  if (loadingInitial || loading) {
    return <LoadingSkeleton rows={3} />;
  }

  if (!activeProject || !activeRun?.id) {
    return <EmptyProjectState title="No Dataset Available for Metrics Explorer" />;
  }

  const currentHistogram = Array.isArray(metricsData?.histograms?.[selectedMetric])
    ? metricsData.histograms[selectedMetric]
    : [];
  const currentBoxPlot = metricsData?.box_plots?.[selectedMetric] || null;
  const summaryStatsList = Object.values(metricsData?.summary_statistics || {});

  // Bar chart comparing software metrics across files
  const sortedBarFiles = [...filteredFiles]
    .sort((a, b) => (Number(b?.[selectedMetric]) || 0) - (Number(a?.[selectedMetric]) || 0))
    .slice(0, 15);

  const selectedMetricLabel = metricLabelMap[selectedMetric] || selectedMetric;
  const scatterXLabel = metricLabelMap[scatterX] || scatterX;
  const scatterYLabel = metricLabelMap[scatterY] || scatterY;

  // Box plot data for Recharts ComposedChart
  const boxPlotChartData = currentBoxPlot
    ? [
        { stage: 'Min', value: currentBoxPlot.min, median: currentBoxPlot.median },
        { stage: 'Whisker Low', value: currentBoxPlot.whisker_low, median: currentBoxPlot.median },
        { stage: 'Q1 (25%)', value: currentBoxPlot.q1, median: currentBoxPlot.median },
        { stage: 'Median (50%)', value: currentBoxPlot.median, median: currentBoxPlot.median },
        { stage: 'Q3 (75%)', value: currentBoxPlot.q3, median: currentBoxPlot.median },
        { stage: 'Whisker High', value: currentBoxPlot.whisker_high, median: currentBoxPlot.median },
        { stage: 'Max', value: currentBoxPlot.max, median: currentBoxPlot.median },
      ]
    : [];

  /**
   * Diverging dark-friendly scale for Pearson Correlation Heatmap:
   * Blue (#4C8DFF) for negative, near-black (#111114) for zero,
   * Violet (#7C5CFF) or Orange (#F97316) for positive, with #F4F4F5 numeric labels.
   */
  const getCorrelationCellStyle = (r) => {
    if (r === null || r === undefined || Number.isNaN(Number(r))) {
      return { backgroundColor: '#111114', color: '#6B6B76', borderColor: '#1F1F25' };
    }
    const numR = Number(r);
    const absR = Math.abs(numR);
    if (absR < 0.08) {
      return { backgroundColor: '#111114', color: '#A1A1AA', borderColor: '#1F1F25' };
    }
    const alpha = Math.min(0.82, Math.max(0.16, absR * 0.85));
    if (numR > 0) {
      if (numR >= 0.75) {
        return {
          backgroundColor: `rgba(249, 115, 22, ${alpha})`,
          color: '#F4F4F5',
          borderColor: 'rgba(249, 115, 22, 0.45)',
        };
      }
      return {
        backgroundColor: `rgba(124, 92, 255, ${alpha})`,
        color: '#F4F4F5',
        borderColor: 'rgba(124, 92, 255, 0.45)',
      };
    }
    return {
      backgroundColor: `rgba(76, 141, 255, ${alpha})`,
      color: '#F4F4F5',
      borderColor: 'rgba(76, 141, 255, 0.45)',
    };
  };

  const corrFeatures = Array.isArray(corrData?.features) ? corrData.features : [];
  const corrMatrix = Array.isArray(corrData?.matrix) ? corrData.matrix : [];
  const notablePairs = Array.isArray(corrData?.notable_pairs)
    ? corrData.notable_pairs
    : Array.isArray(corrData?.notable_correlations)
    ? corrData.notable_correlations
    : [];
  const droppedConstantCols = Array.isArray(corrData?.dropped_constant_columns)
    ? corrData.dropped_constant_columns
    : [];

  const riskTierCounts = metricsData?.defect_distribution?.risk_tier_distribution || {
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  };
  const hasLabelledDefectData = Boolean(
    metricsData?.defect_distribution?.has_labelled_defect_data
  );

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* Small-project warning banner when < 3 parsed files */}
      {(metricsData?.small_project_warning || filesData.length < 3) && (
        <div className="p-3.5 rounded-xl bg-[#EAB308]/10 border border-[#EAB308]/35 flex items-start gap-2.5 text-xs text-[#F4F4F5]">
          <AlertTriangle className="w-4 h-4 text-[#EAB308] shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-[#EAB308]">Small Sample Size Notice: </span>
            <span className="text-[#A1A1AA]">
              {metricsData?.small_project_warning ||
                `Only ${filesData.length} parsed Java file(s) found. At least 3 parsed files are required for meaningful quartiles and Pearson correlation matrices.`}
            </span>
          </div>
        </div>
      )}

      {/* Interactive Filter & Metric Selection Bar (Project, Metric, Scatter X/Y, File, Risk) */}
      <Card padding="p-4">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-[#A1A1AA] mb-3">
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#7C5CFF]" />
          <span>Interactive Analytics Filters (Project, File & Metric)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <Select
            label="Project"
            value={activeProject?.id || ''}
            onChange={(e) => selectProjectAndRun(Number(e.target.value))}
          >
            {(projects || []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>

          <Select
            label="Primary Metric"
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
          >
            {(metricsMeta || []).map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </Select>

          <Select
            label="Scatter X-Axis"
            value={scatterX}
            onChange={(e) => setScatterX(e.target.value)}
          >
            {(metricsMeta || []).map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </Select>

          <Select
            label="Scatter Y-Axis"
            value={scatterY}
            onChange={(e) => setScatterY(e.target.value)}
          >
            {(metricsMeta || []).map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </Select>

          <Select
            label="Filter by File"
            value={fileFilter}
            onChange={(e) => setFileFilter(e.target.value)}
          >
            <option value="ALL">All Parsed Files ({filesData.length})</option>
            {(filesData || []).map((f) => (
              <option key={f.file_path} value={f.file_path}>
                {f.file_name}
              </option>
            ))}
          </Select>

          <Select
            label="Filter by Risk Tier"
            value={riskTierFilter}
            onChange={(e) => setRiskTierFilter(e.target.value)}
          >
            <option value="ALL">All Risk Tiers</option>
            <option value="HIGH">High Risk</option>
            <option value="MEDIUM">Medium Risk</option>
            <option value="LOW">Low Risk</option>
          </Select>
        </div>
      </Card>

      {/* Row 1: File Comparison Bar Chart + Empirical Histogram */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader
            title={`Cross-File Comparison: ${selectedMetricLabel}`}
            icon={BarChart3}
            tooltip="Compares the selected software metric across parsed Java source files, coloured semantically by file risk category."
            subtitle="Top 15 files ordered descending by selected metric"
          />

          <ChartTheme height="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sortedBarFiles}
                margin={{ top: 10, right: 15, left: 5, bottom: 52 }}
              >
                <CartesianGrid
                  stroke="#1F1F25"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="file_name"
                  angle={-30}
                  textAnchor="end"
                  interval={0}
                  tick={DARK_AXIS_TICK}
                  axisLine={DARK_AXIS_LINE}
                  tickLine={false}
                  label={{
                    value: 'Java Source File',
                    position: 'insideBottom',
                    offset: -42,
                    fill: '#6B6B76',
                    fontSize: 11,
                  }}
                />
                <YAxis
                  tick={DARK_AXIS_TICK}
                  axisLine={DARK_AXIS_LINE}
                  tickLine={false}
                  label={{
                    value: selectedMetricLabel,
                    angle: -90,
                    position: 'insideLeft',
                    fill: '#6B6B76',
                    fontSize: 11,
                  }}
                />
                <Tooltip contentStyle={DARK_TOOLTIP_CONTENT_STYLE} />
                <Bar
                  dataKey={selectedMetric}
                  name={selectedMetricLabel}
                  radius={[4, 4, 0, 0]}
                >
                  {(sortedBarFiles || []).map((entry, idx) => (
                    <Cell
                      key={`bar-${idx}`}
                      fill={RISK_PALETTE[entry?.risk_category] || '#7C5CFF'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartTheme>

          <div className="mt-2 pt-2 border-t border-[#1F1F25] flex items-center justify-end gap-4 text-[11px] text-[#A1A1AA]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#F97316]" /> High Risk
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#EAB308]" /> Medium Risk
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#22C55E]" /> Low Risk
            </span>
          </div>
        </Card>

        {/* Empirical Histogram built with BarChart */}
        <Card>
          <CardHeader
            title={`Empirical Distribution Histogram: ${selectedMetricLabel}`}
            icon={Activity}
            tooltip="Frequency histogram computed by NumPy across the parsed Java files in the current run."
            subtitle="Bin frequency distribution across the analyzed codebase"
          />

          <ChartTheme height="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={currentHistogram}
                margin={{ top: 10, right: 15, left: 5, bottom: 32 }}
              >
                <CartesianGrid
                  stroke="#1F1F25"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="bin_label"
                  tick={DARK_AXIS_TICK}
                  axisLine={DARK_AXIS_LINE}
                  tickLine={false}
                  label={{
                    value: `${selectedMetricLabel} Value Range (Bins)`,
                    position: 'insideBottom',
                    offset: -20,
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
                    value: 'File Count',
                    angle: -90,
                    position: 'insideLeft',
                    fill: '#6B6B76',
                    fontSize: 11,
                  }}
                />
                <Tooltip contentStyle={DARK_TOOLTIP_CONTENT_STYLE} />
                <Bar
                  dataKey="count"
                  name="Files in Bin"
                  fill="#7C5CFF"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartTheme>

          <div className="mt-2 pt-2 border-t border-[#1F1F25] text-[11px] text-[#6B6B76]">
            Histogram bins show concentration and skewness of {selectedMetricLabel} across files.
          </div>
        </Card>
      </div>

      {/* Row 2: Quartile Box Plot (ComposedChart + Whisker/Outlier View) + Bivariate Scatter Plot */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="flex flex-col justify-between">
          <div>
            <CardHeader
              title={`Box Plot & Tukey IQR Outliers: ${selectedMetricLabel}`}
              icon={Sigma}
              tooltip="Displays backend-computed quartiles (Min, Whisker Low, Q1, Median, Q3, Whisker High, Max) via ComposedChart and custom IQR box-whisker geometry, plus Tukey 1.5*IQR outliers."
              subtitle="Five-number statistical summary and automated outlier detection"
            />

            {currentBoxPlot ? (
              <div className="space-y-3">
                {/* Recharts ComposedChart of Backend-Computed Quartiles */}
                <ChartTheme height="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={boxPlotChartData}
                      margin={{ top: 8, right: 14, left: 0, bottom: 8 }}
                    >
                      <CartesianGrid
                        stroke="#1F1F25"
                        strokeDasharray="3 3"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="stage"
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
                      <Bar
                        dataKey="value"
                        name={selectedMetricLabel}
                        fill="#7C5CFF"
                        radius={[4, 4, 0, 0]}
                        barSize={26}
                      />
                      <Line
                        type="monotone"
                        dataKey="median"
                        name="Median Reference"
                        stroke="#4C8DFF"
                        strokeWidth={2}
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </ChartTheme>

                {/* Horizontal Box-and-Whisker Shape with Outlier Markers */}
                <div className="p-4 rounded-xl bg-[#0E0E11] border border-[#1F1F25]">
                  {(() => {
                    const minV = Number(currentBoxPlot.min ?? 0);
                    const maxV = Number(currentBoxPlot.max ?? 0);
                    const span = Math.max(maxV - minV, 1e-6);
                    const toPct = (v) =>
                      Math.min(100, Math.max(0, ((Number(v ?? 0) - minV) / span) * 100));

                    const wLowPct = toPct(currentBoxPlot.whisker_low);
                    const q1Pct = toPct(currentBoxPlot.q1);
                    const medPct = toPct(currentBoxPlot.median);
                    const q3Pct = toPct(currentBoxPlot.q3);
                    const wHighPct = toPct(currentBoxPlot.whisker_high);

                    return (
                      <div className="space-y-3">
                        <div className="relative h-9 flex items-center">
                          <div className="w-full h-0.5 bg-[#1F1F25]" />
                          <div
                            className="absolute h-0.5 bg-[#6B6B76]"
                            style={{
                              left: `${wLowPct}%`,
                              width: `${Math.max(0, wHighPct - wLowPct)}%`,
                            }}
                          />
                          <div
                            className="absolute h-4 w-0.5 bg-[#A1A1AA]"
                            style={{ left: `${wLowPct}%` }}
                          />
                          <div
                            className="absolute h-4 w-0.5 bg-[#A1A1AA]"
                            style={{ left: `${wHighPct}%` }}
                          />
                          <div
                            className="absolute h-6 bg-[#7C5CFF]/25 border-2 border-[#7C5CFF] rounded-xs"
                            style={{
                              left: `${q1Pct}%`,
                              width: `${Math.max(2, q3Pct - q1Pct)}%`,
                            }}
                          />
                          <div
                            className="absolute h-8 w-1 bg-[#4C8DFF] rounded-full z-10"
                            style={{ left: `${medPct}%` }}
                            title={`Median: ${currentBoxPlot.median}`}
                          />
                          {(currentBoxPlot.outliers || []).map((o, idx) => (
                            <div
                              key={idx}
                              className="absolute w-3 h-3 rounded-full bg-[#EF4444] border border-[#111114] -translate-x-1/2 z-20"
                              style={{ left: `${toPct(o.value)}%` }}
                              title={`Outlier: ${o.file_name} (${o.value})`}
                            />
                          ))}
                        </div>

                        <div className="grid grid-cols-5 gap-2 text-center font-mono text-xs pt-2 border-t border-[#1F1F25]">
                          <div>
                            <div className="text-[10px] text-[#6B6B76]">Min</div>
                            <div className="font-semibold text-[#F4F4F5]">{currentBoxPlot.min}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-[#7C5CFF]">Q1 (25%)</div>
                            <div className="font-semibold text-[#7C5CFF]">{currentBoxPlot.q1}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-[#4C8DFF]">Median</div>
                            <div className="font-semibold text-[#4C8DFF]">
                              {currentBoxPlot.median}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-[#7C5CFF]">Q3 (75%)</div>
                            <div className="font-semibold text-[#7C5CFF]">{currentBoxPlot.q3}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-[#6B6B76]">Max</div>
                            <div className="font-semibold text-[#F4F4F5]">{currentBoxPlot.max}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Outliers List */}
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#A1A1AA] mb-1.5">
                    Identified Tukey Outliers ({(currentBoxPlot.outliers || []).length}) · IQR ={' '}
                    <span className="font-mono text-[#7C5CFF]">{currentBoxPlot.iqr}</span>
                  </div>
                  {(currentBoxPlot.outliers || []).length > 0 ? (
                    <div className="space-y-1.5 max-h-28 overflow-y-auto">
                      {(currentBoxPlot.outliers || []).map((o, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs p-2 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/30"
                        >
                          <span className="font-mono font-medium text-[#F4F4F5] truncate">
                            {o.file_name}{' '}
                            <span className="text-[#6B6B76]">({o.direction})</span>
                          </span>
                          <span className="font-mono font-semibold text-[#EF4444]">
                            {o.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-2 rounded-lg bg-[#0E0E11] border border-[#1F1F25] text-xs text-[#A1A1AA]">
                      No extreme statistical outliers outside [Q1 − 1.5×IQR, Q3 + 1.5×IQR] for{' '}
                      {selectedMetricLabel}.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-xs text-[#6B6B76]">No box plot data available.</div>
            )}
          </div>
        </Card>

        {/* Bivariate Scatter Plot */}
        <Card>
          <CardHeader
            title={`Bivariate Scatter Plot: ${scatterXLabel} vs ${scatterYLabel}`}
            icon={GitCompareArrows}
            tooltip="Explores bivariate relationships between any two numeric AST metrics across files."
            subtitle="Each point represents a parsed Java source file coloured by risk tier"
          />

          <ChartTheme height="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, left: 5, bottom: 28 }}>
                <CartesianGrid stroke="#1F1F25" strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey={scatterX}
                  name={scatterXLabel}
                  tick={DARK_AXIS_TICK}
                  axisLine={DARK_AXIS_LINE}
                  tickLine={false}
                  label={{
                    value: scatterXLabel,
                    position: 'insideBottom',
                    offset: -18,
                    fill: '#6B6B76',
                    fontSize: 11,
                  }}
                />
                <YAxis
                  type="number"
                  dataKey={scatterY}
                  name={scatterYLabel}
                  tick={DARK_AXIS_TICK}
                  axisLine={DARK_AXIS_LINE}
                  tickLine={false}
                  label={{
                    value: scatterYLabel,
                    angle: -90,
                    position: 'insideLeft',
                    fill: '#6B6B76',
                    fontSize: 11,
                  }}
                />
                <ZAxis type="category" dataKey="file_name" name="File" />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3', stroke: '#7C5CFF' }}
                  contentStyle={DARK_TOOLTIP_CONTENT_STYLE}
                />
                <Scatter name="Java Source Files" data={filteredFiles}>
                  {(filteredFiles || []).map((entry, index) => (
                    <Cell
                      key={`pt-${index}`}
                      fill={RISK_PALETTE[entry?.risk_category] || '#7C5CFF'}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </ChartTheme>
        </Card>
      </div>

      {/* Row 3: Styled CSS Grid Pearson Correlation Heatmap */}
      <Card>
        <CardHeader
          title="Pearson Correlation Matrix (r) Across Software Metrics"
          icon={GitCompareArrows}
          tooltip="Pairwise linear correlation coefficients (-1.00 to +1.00) computed via pandas/NumPy on the current project's real extracted metrics. Constant zero-variance columns are automatically dropped before correlation."
          rightControl={
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-[#A1A1AA]">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#4C8DFF]" /> Negative (r &lt; 0)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#111114] border border-[#2A2A32]" /> Near 0
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#7C5CFF]" /> Positive (r &gt; 0)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#F97316]" /> Strong (r ≥ 0.75)
              </span>
            </div>
          }
        />

        {droppedConstantCols.length > 0 && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-[#0E0E11] border border-[#1F1F25] text-[11px] text-[#A1A1AA]">
            Dropped constant (zero-variance) columns prior to correlation:{' '}
            <span className="font-mono text-[#7C5CFF]">
              {droppedConstantCols.join(', ')}
            </span>
          </div>
        )}

        {corrData?.sufficient_data && corrFeatures.length > 0 ? (
          <div className="space-y-4">
            {/* Styled CSS Grid of Coloured Cells with Numeric Labels */}
            <div className="overflow-x-auto pb-1">
              <div
                className="grid gap-1 min-w-[680px]"
                style={{
                  gridTemplateColumns: `140px repeat(${corrFeatures.length}, minmax(68px, 1fr))`,
                }}
              >
                {/* Header Row */}
                <div className="p-2 rounded-md bg-[#0E0E11] border border-[#1F1F25] text-[11px] font-semibold text-[#A1A1AA] flex items-center">
                  Metric
                </div>
                {(corrFeatures || []).map((feat) => (
                  <div
                    key={`hdr-${feat.key}`}
                    className="p-2 rounded-md bg-[#0E0E11] border border-[#1F1F25] text-[10px] font-semibold text-[#A1A1AA] text-center flex items-center justify-center leading-tight"
                  >
                    {feat.label}
                  </div>
                ))}

                {/* Data Rows in CSS Grid */}
                {(corrMatrix || []).map((row) => (
                  <React.Fragment key={row.feature_key}>
                    <div className="p-2 rounded-md bg-[#0E0E11] border border-[#1F1F25] text-xs font-medium text-[#F4F4F5] flex items-center truncate">
                      {row.feature_label}
                    </div>
                    {(corrFeatures || []).map((colFeat) => {
                      const rVal =
                        row?.values && colFeat.key in row.values
                          ? row.values[colFeat.key]
                          : (row?.correlations || []).find((c) => c.x_key === colFeat.key)
                              ?.coefficient;
                      const cellStyle = getCorrelationCellStyle(rVal);
                      return (
                        <div
                          key={`${row.feature_key}-${colFeat.key}`}
                          style={cellStyle}
                          title={`${row.feature_label} vs ${colFeat.label}: r = ${
                            rVal !== null && rVal !== undefined ? Number(rVal).toFixed(3) : 'N/A'
                          }`}
                          className="p-2 rounded-md border text-center font-mono text-[11px] font-semibold tabular-nums flex items-center justify-center transition-transform duration-150 hover:scale-[1.02]"
                        >
                          {rVal !== null && rVal !== undefined ? Number(rVal).toFixed(2) : 'N/A'}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {notablePairs.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                {(notablePairs || []).slice(0, 3).map((pair, idx) => {
                  const coeff = Number(pair?.r ?? pair?.coefficient ?? 0);
                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-[#0E0E11] border border-[#1F1F25] text-xs"
                    >
                      <div className="flex items-center justify-between font-semibold text-[#F4F4F5]">
                        <span>
                          {pair.feature_a} ↔ {pair.feature_b}
                        </span>
                        <span
                          className={`font-mono px-1.5 py-0.5 rounded ${
                            coeff > 0
                              ? 'bg-[#7C5CFF]/15 text-[#7C5CFF]'
                              : 'bg-[#4C8DFF]/15 text-[#4C8DFF]'
                          }`}
                        >
                          r = {coeff.toFixed(3)}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#A1A1AA] mt-1">
                        {pair.interpretation ||
                          `${pair.strength} ${String(pair.direction || '').toLowerCase()} correlation`}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-[#A1A1AA] p-4 bg-[#0E0E11] rounded-xl border border-[#1F1F25]">
            {corrData?.message ||
              'At least 3 parsed Java files are required to compute meaningful Pearson correlations.'}
          </div>
        )}
      </Card>

      {/* Row 4: Defect / Risk Distribution + Feature Summary Statistics Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Card className="lg:col-span-4 flex flex-col justify-between">
          <div>
            <CardHeader
              title={
                hasLabelledDefectData
                  ? 'ML Defect Prediction Distribution'
                  : 'Preliminary Rule-Based Risk Distribution'
              }
              icon={ShieldAlert}
              tooltip="Shows defect distribution only when labelled defect data / ML classifier is active; otherwise displays preliminary rule-based risk tiers."
            />

            <div className="p-3 rounded-xl bg-[#0E0E11] border border-[#1F1F25] text-xs text-[#A1A1AA] mb-4 leading-relaxed">
              {metricsData?.defect_distribution?.note ||
                'No ground-truth defect labels or trained ML classifier active for this run.'}
            </div>

            {hasLabelledDefectData ? (
              <div className="space-y-3 mb-4 pb-3 border-b border-[#1F1F25]">
                <ProgressBar
                  label={`Predicted Defective (${metricsData?.defect_distribution?.ml_predicted_defect_count || 0} files)`}
                  value={metricsData?.defect_distribution?.ml_predicted_defect_count || 0}
                  max={Math.max(filesData.length, 1)}
                  color="#EF4444"
                  showLabel
                />
                <ProgressBar
                  label={`Predicted Non-Defective (${metricsData?.defect_distribution?.non_defective_count || 0} files)`}
                  value={metricsData?.defect_distribution?.non_defective_count || 0}
                  max={Math.max(filesData.length, 1)}
                  color="#22C55E"
                  showLabel
                />
              </div>
            ) : null}

            <div className="space-y-3">
              {[
                {
                  label: 'High Risk Tier',
                  count: riskTierCounts.HIGH || 0,
                  color: '#F97316',
                },
                {
                  label: 'Medium Risk Tier',
                  count: riskTierCounts.MEDIUM || 0,
                  color: '#EAB308',
                },
                {
                  label: 'Low Risk Tier',
                  count: riskTierCounts.LOW || 0,
                  color: '#22C55E',
                },
              ].map((tier) => {
                const total = Math.max(filesData.length, 1);
                const pct = Math.round((tier.count / total) * 100);
                return (
                  <div key={tier.label} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-[#A1A1AA]">{tier.label}</span>
                      <span className="font-mono text-[#F4F4F5] tabular-nums">
                        {tier.count} files ({pct}%)
                      </span>
                    </div>
                    <ProgressBar value={pct} max={100} color={tier.color} />
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-8" padding="p-0">
          <div className="p-4 sm:p-5 pb-3 border-b border-[#1F1F25]">
            <CardHeader
              title="Feature Summary Statistics (Descriptive Analytics)"
              icon={Sigma}
              tooltip="Descriptive statistics (Count, Mean, Std Dev, Min, Q1, Median, Q3, Max) computed via pandas/NumPy across all parsed Java files."
              className="mb-0"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#0E0E11] border-b border-[#1F1F25] text-[10px] font-semibold uppercase tracking-[0.06em] text-[#A1A1AA]">
                <tr>
                  <th className="py-2.5 px-4">Software Metric</th>
                  <th className="py-2.5 px-2.5 text-right">N</th>
                  <th className="py-2.5 px-2.5 text-right">Mean</th>
                  <th className="py-2.5 px-2.5 text-right">Std Dev</th>
                  <th className="py-2.5 px-2.5 text-right">Min</th>
                  <th className="py-2.5 px-2.5 text-right">Q1 (25%)</th>
                  <th className="py-2.5 px-2.5 text-right">Median</th>
                  <th className="py-2.5 px-2.5 text-right">Q3 (75%)</th>
                  <th className="py-2.5 px-4 text-right">Max</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F1F25] font-mono text-[11px] tabular-nums">
                {(summaryStatsList || []).map((stat) => (
                  <tr key={stat.key} className="hover:bg-[#16161A]">
                    <td className="py-2.5 px-4 font-sans font-medium text-[#F4F4F5]">
                      {stat.label}
                    </td>
                    <td className="py-2.5 px-2.5 text-right text-[#6B6B76]">{stat.count}</td>
                    <td className="py-2.5 px-2.5 text-right text-[#7C5CFF] font-semibold">
                      {stat.mean ?? 'N/A'}
                    </td>
                    <td className="py-2.5 px-2.5 text-right text-[#A1A1AA]">
                      {stat.std ?? 'N/A'}
                    </td>
                    <td className="py-2.5 px-2.5 text-right text-[#A1A1AA]">
                      {stat.min ?? 'N/A'}
                    </td>
                    <td className="py-2.5 px-2.5 text-right text-[#A1A1AA]">
                      {stat.q1 ?? 'N/A'}
                    </td>
                    <td className="py-2.5 px-2.5 text-right text-[#4C8DFF] font-semibold">
                      {stat.median ?? 'N/A'}
                    </td>
                    <td className="py-2.5 px-2.5 text-right text-[#A1A1AA]">
                      {stat.q3 ?? 'N/A'}
                    </td>
                    <td className="py-2.5 px-4 text-right text-[#F4F4F5] font-semibold">
                      {stat.max ?? 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
