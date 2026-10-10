import React, { useEffect, useState } from 'react';
import {
  FileText,
  Download,
  Scale,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { platformApi, extractApiError } from '../services/api';
import EmptyProjectState from '../components/EmptyProjectState';
import {
  Card,
  CardHeader,
  StatusChip,
  Select,
  Toast,
  LoadingSkeleton,
  ErrorBanner,
} from '../components/ui';
import { formatTimestamp } from '../utils/formatters';

export default function ReportsPage() {
  const {
    activeProject,
    activeRun,
    projectRuns,
    loadingInitial,
    selectRunOnly,
  } = usePlatform();
  const [priorities, setPriorities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!activeRun?.id) return;
    let cancelled = false;
    async function loadReportPreview() {
      try {
        setLoading(true);
        const res = await platformApi.getAnalysisPriorities(activeRun.id);
        if (!cancelled) setPriorities(res.priorities || []);
      } catch (err) {
        if (!cancelled) setError(extractApiError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadReportPreview();
    return () => {
      cancelled = true;
    };
  }, [activeRun?.id]);

  const handleDownloadPdf = async () => {
    if (!activeRun?.id) return;
    try {
      setDownloading(true);
      setError(null);
      setToastMsg(null);
      const res = await platformApi.downloadReportBlob(activeRun.id);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeName = (activeProject?.name || 'java_project')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_');
      const fileName = `${safeName}_run_${activeRun.run_number}_health_report.pdf`;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setToastMsg(`Generated and downloaded PDF report (${fileName})`);
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setDownloading(false);
    }
  };

  if (loadingInitial || loading) {
    return <LoadingSkeleton rows={3} />;
  }

  if (!activeProject || !activeRun) {
    return <EmptyProjectState title="No Analysis Run Available for PDF Report Generation" />;
  }

  const components = Object.values(activeRun.health_breakdown?.components || {});

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      {toastMsg && (
        <Toast message={toastMsg} type="success" onClose={() => setToastMsg(null)} />
      )}

      {/* Report Action Banner */}
      <Card padding="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-[#7C5CFF]/15 text-[#7C5CFF] border border-[#7C5CFF]/35 shadow-[0_0_16px_rgba(124,92,255,0.2)]">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#F4F4F5]">
                Official ReportLab PDF Quality Evaluation Dossier
              </h2>
              <p className="text-xs text-[#A1A1AA] mt-0.5 max-w-2xl leading-relaxed">
                Generates a formatted, multi-section printable PDF report directly from persisted
                SQLite analysis results, including vector charts, health score methodology,
                file-level risk tables, refactoring priorities, and methodological limitations.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {(projectRuns || []).length > 0 && (
              <Select
                aria-label="Select Run for PDF Report"
                value={activeRun.id}
                onChange={(e) => selectRunOnly(Number(e.target.value))}
                className="w-56 font-mono"
              >
                {(projectRuns || []).map((r) => (
                  <option key={r.id} value={r.id}>
                    Run #{r.run_number} — {r.version_label} ({r.health_score}/100)
                  </option>
                ))}
              </Select>
            )}

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="ui-btn-primary px-4 py-2 text-xs inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {downloading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating ReportLab PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download Official PDF Report</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Card>

      {/* Live Dark Preview of PDF Report Contents */}
      <Card padding="p-0" className="overflow-hidden">
        <div className="bg-[#0E0E11] px-6 py-5 border-b border-[#1F1F25] flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-[#7C5CFF] font-semibold">
              REPORT PREVIEW · LIVE DATABASE SNAPSHOT
            </div>
            <h3 className="text-lg font-semibold text-[#F4F4F5] mt-0.5">
              {activeProject.name} — Run #{activeRun.run_number} ({activeRun.version_label})
            </h3>
            <div className="text-xs font-mono text-[#6B6B76] mt-0.5">
              Analyzed: {formatTimestamp(activeRun.created_at)} · Archive:{' '}
              {activeRun.archive_filename || 'N/A'}
            </div>
          </div>
          <div className="bg-[#111114] border border-[#1F1F25] px-4 py-2.5 rounded-xl text-right">
            <div className="text-[10px] font-mono uppercase text-[#6B6B76]">
              Overall Health Score
            </div>
            <div className="text-2xl font-semibold font-mono text-[#22C55E] tabular-nums">
              {activeRun.health_score}/100{' '}
              <span className="text-sm text-[#A1A1AA]">(Grade {activeRun.health_grade})</span>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* 1. Executive Summary */}
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[#A1A1AA] border-b border-[#1F1F25] pb-1.5 mb-3">
              1. Project & Metric Summary Included in PDF
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[#0E0E11] border border-[#1F1F25]">
                <div className="text-[#6B6B76]">Java Files Parsed</div>
                <div className="text-base font-semibold font-mono text-[#F4F4F5] mt-0.5 tabular-nums">
                  {activeRun.parsed_files} / {activeRun.total_files}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#0E0E11] border border-[#1F1F25]">
                <div className="text-[#6B6B76]">Source Lines (LOC)</div>
                <div className="text-base font-semibold font-mono text-[#F4F4F5] mt-0.5 tabular-nums">
                  {activeRun.total_loc?.toLocaleString()}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#0E0E11] border border-[#1F1F25]">
                <div className="text-[#6B6B76]">Avg / Max Complexity</div>
                <div className="text-base font-semibold font-mono text-[#F4F4F5] mt-0.5 tabular-nums">
                  {activeRun.avg_complexity} / {activeRun.max_complexity}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#0E0E11] border border-[#1F1F25]">
                <div className="text-[#6B6B76]">Risk Distribution</div>
                <div className="text-sm font-semibold font-mono text-[#F4F4F5] mt-0.5">
                  <span className="text-[#EF4444]">{activeRun.high_risk_count}H</span> ·{' '}
                  <span className="text-[#EAB308]">{activeRun.medium_risk_count}M</span> ·{' '}
                  <span className="text-[#22C55E]">{activeRun.low_risk_count}L</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Health Breakdown */}
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[#A1A1AA] border-b border-[#1F1F25] pb-1.5 mb-3">
              2. Explainable Health Score Factor Breakdown
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {components.map((c) => (
                <div
                  key={c.label}
                  className="p-3 rounded-xl bg-[#0E0E11] border border-[#1F1F25] flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-semibold text-[#F4F4F5]">{c.label}</div>
                    <div className="text-[11px] font-mono text-[#6B6B76]">
                      Raw: {c.raw_value} · Weight: {(c.weight * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="font-semibold text-[#7C5CFF]">{c.normalized_score}/100</div>
                    <div className="text-[10px] text-[#6B6B76]">+{c.weighted_points} pts</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Top Refactoring Priorities in PDF */}
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[#A1A1AA] border-b border-[#1F1F25] pb-1.5 mb-3">
              3. Top Refactoring Priority Recommendations
            </h4>
            <div className="space-y-2">
              {priorities.slice(0, 5).map((p) => (
                <div
                  key={p.id}
                  className="p-3 rounded-xl bg-[#0E0E11] border border-[#1F1F25] flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-semibold text-[#7C5CFF]">
                      #{p.priority_rank}
                    </span>
                    <span className="font-mono font-semibold text-[#F4F4F5]">{p.file_name}</span>
                    <StatusChip status={p.priority_level} size="xs" />
                  </div>
                  <div className="text-[#A1A1AA] text-[11px] truncate max-w-xl">
                    {p.suggested_actions?.[0]}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Methodological Notes */}
          <div className="p-4 rounded-xl bg-[#0E0E11] border border-[#1F1F25] flex items-start gap-2.5 text-xs text-[#A1A1AA]">
            <Scale className="w-4 h-4 text-[#7C5CFF] shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-[#F4F4F5]">
                Included Limitations & Interpretation Notes:
              </span>{' '}
              The generated ReportLab PDF includes vector graphics charts, full file-level tables,
              and explicit academic disclaimers distinguishing deterministic rule-based heuristics
              from machine-learning defect predictions. Note: The downloadable PDF uses a clean,
              printable paper layout suitable for academic grading while the web platform remains
              strictly dark.
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
