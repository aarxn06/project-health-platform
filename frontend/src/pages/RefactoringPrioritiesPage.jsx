import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ListOrdered,
  Sliders,
  Clock,
  Info,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
} from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { platformApi, extractApiError } from '../services/api';
import EmptyProjectState from '../components/EmptyProjectState';
import {
  Card,
  CardHeader,
  StatusChip,
  LoadingSkeleton,
  ErrorBanner,
} from '../components/ui';

export default function RefactoringPrioritiesPage() {
  const navigate = useNavigate();
  const { activeProject, activeRun, loadingInitial } = usePlatform();
  const [prioData, setPrioData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (!activeRun?.id) {
      setPrioData(null);
      return;
    }
    let cancelled = false;
    async function fetchPriorities() {
      try {
        setLoading(true);
        setError(null);
        const res = await platformApi.getAnalysisPriorities(activeRun.id);
        if (!cancelled) {
          setPrioData(res);
          if (res.priorities?.length > 0) {
            setExpandedId(res.priorities[0].id);
          }
        }
      } catch (err) {
        if (!cancelled) setError(extractApiError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchPriorities();
    return () => {
      cancelled = true;
    };
  }, [activeRun?.id]);

  if (loadingInitial || loading) {
    return <LoadingSkeleton rows={3} />;
  }

  if (!activeProject || !activeRun) {
    return <EmptyProjectState title="No Project Available for Refactoring Prioritization" />;
  }

  const priorities = prioData?.priorities || [];
  const weights = prioData?.priority_weights || {};
  const methodology = prioData?.methodology_explanation || {};

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* Methodology & Configurable Weights Header Card (Section 3G) */}
      <Card padding="p-5">
        <CardHeader
          title="Transparent Multi-Criteria Refactoring Prioritization"
          icon={ListOrdered}
          tooltip="Ranks analyzed Java files using configurable weights across Risk Score, Cyclomatic Complexity & Nesting, Maintainability deficit, and Code Smell severity."
          rightControl={
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="ui-btn-secondary px-3 py-1.5 text-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-[#7C5CFF]" />
              <span>Configure Priority Weights</span>
            </button>
          }
        />

        <p className="text-xs text-[#A1A1AA] mb-4 leading-relaxed">
          {methodology.summary}
        </p>

        {/* Active Weights Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="p-3 rounded-xl bg-[#0E0E11] border border-[#1F1F25]">
            <div className="text-[11px] text-[#A1A1AA] font-medium">Risk Score Weight</div>
            <div className="text-lg font-semibold font-mono text-[#7C5CFF] mt-0.5 tabular-nums">
              {((weights.risk_weight ?? 0.35) * 100).toFixed(0)}%
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[#0E0E11] border border-[#1F1F25]">
            <div className="text-[11px] text-[#A1A1AA] font-medium">
              Complexity & Nesting Weight
            </div>
            <div className="text-lg font-semibold font-mono text-[#4C8DFF] mt-0.5 tabular-nums">
              {((weights.complexity_weight ?? 0.25) * 100).toFixed(0)}%
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[#0E0E11] border border-[#1F1F25]">
            <div className="text-[11px] text-[#A1A1AA] font-medium">
              Maintainability Deficit Weight
            </div>
            <div className="text-lg font-semibold font-mono text-[#22C55E] mt-0.5 tabular-nums">
              {((weights.maintainability_weight ?? 0.2) * 100).toFixed(0)}%
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[#0E0E11] border border-[#1F1F25]">
            <div className="text-[11px] text-[#A1A1AA] font-medium">
              Code Smell Severity Weight
            </div>
            <div className="text-lg font-semibold font-mono text-[#EAB308] mt-0.5 tabular-nums">
              {((weights.smell_severity_weight ?? 0.2) * 100).toFixed(0)}%
            </div>
          </div>
        </div>

        {/* Limitations Note */}
        <div className="p-3 rounded-xl bg-[#0E0E11] border border-[#1F1F25] flex items-start gap-2.5 text-xs text-[#A1A1AA]">
          <Info className="w-4 h-4 text-[#7C5CFF] shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-[#F4F4F5]">
              Methodological Scope & Limitations:
            </span>{' '}
            {methodology.limitations} This ranking is a transparent engineering triage heuristic and
            is not claimed as a novel or experimentally validated algorithm.
          </div>
        </div>
      </Card>

      {/* Ranked Priority Table */}
      <Card padding="p-0" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#0E0E11] border-b border-[#1F1F25] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#A1A1AA]">
              <tr>
                <th className="py-3 px-4">Rank</th>
                <th className="py-3 px-4">Java Source File</th>
                <th className="py-3 px-3">Priority Level</th>
                <th className="py-3 px-3 text-right">Priority Score</th>
                <th className="py-3 px-3 text-right">Supporting Metrics</th>
                <th className="py-3 px-3">Relative Effort Band</th>
                <th className="py-3 px-4 text-center">Action Plan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F1F25] text-xs">
              {priorities.map((p) => {
                const isExpanded = expandedId === p.id;
                const sm = p.supporting_metrics || {};
                const scoreColor =
                  p.priority_score >= 65
                    ? 'text-[#EF4444]'
                    : p.priority_score >= 40
                    ? 'text-[#F97316]'
                    : 'text-[#22C55E]';

                return (
                  <React.Fragment key={p.id}>
                    <tr
                      onClick={() => setExpandedId(isExpanded ? null : p.id)}
                      className={`hover:bg-[#16161A] transition-colors cursor-pointer ${
                        isExpanded ? 'bg-[#7C5CFF]/10' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-semibold text-[#A1A1AA]">
                        #{p.priority_rank}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono font-medium text-[#F4F4F5]">{p.file_name}</div>
                        <div className="text-[11px] font-mono text-[#6B6B76] truncate max-w-xs">
                          {p.file_path}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <StatusChip status={p.priority_level} size="xs" />
                      </td>
                      <td
                        className={`py-3 px-3 text-right font-mono font-semibold tabular-nums ${scoreColor}`}
                      >
                        {p.priority_score?.toFixed(1)}
                        <span className="text-[#6B6B76] font-normal"> / 100</span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-[11px] text-[#A1A1AA] tabular-nums">
                        CC: <strong className="text-[#F4F4F5]">{sm.cyclomatic_complexity ?? 'N/A'}</strong>{' '}
                        · MI:{' '}
                        <strong className="text-[#F4F4F5]">
                          {sm.maintainability_index ?? 'N/A'}
                        </strong>{' '}
                        · Smells:{' '}
                        <strong className="text-[#F4F4F5]">{sm.code_smell_count ?? 0}</strong>
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[#A1A1AA]">
                          <Clock className="w-3 h-3 text-[#7C5CFF] shrink-0" />
                          <span>{p.estimated_effort}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          className="ui-btn-secondary px-2.5 py-1 text-[11px] inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>{isExpanded ? 'Hide' : 'Reasons & Actions'}</span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5 text-[#7C5CFF]" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-[#7C5CFF]" />
                          )}
                        </button>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-[#0E0E11]">
                        <td colSpan={7} className="p-4 border-t border-[#1F1F25]">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-3.5 rounded-xl bg-[#111114] border border-[#1F1F25]">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#EAB308] mb-2">
                                Assigned Priority Reasons
                              </div>
                              <ul className="space-y-1.5 text-xs text-[#A1A1AA] list-disc list-inside leading-relaxed">
                                {p.primary_reasons?.map((reason, idx) => (
                                  <li key={idx}>{reason}</li>
                                ))}
                              </ul>
                            </div>

                            <div className="p-3.5 rounded-xl bg-[#111114] border border-[#1F1F25] flex flex-col justify-between">
                              <div>
                                <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#22C55E] mb-2">
                                  Recommended Refactoring Actions
                                </div>
                                <ul className="space-y-1.5 text-xs text-[#A1A1AA] list-disc list-inside leading-relaxed">
                                  {p.suggested_actions?.map((act, idx) => (
                                    <li key={idx}>{act}</li>
                                  ))}
                                </ul>
                              </div>

                              <div className="pt-3 mt-3 border-t border-[#1F1F25] flex items-center justify-between">
                                <span className="text-[11px] font-mono text-[#6B6B76]">
                                  LOC: {sm.loc} · Max Method CC: {sm.max_method_complexity} ·
                                  Fan-Out: {sm.fan_out}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    navigate(
                                      `/analysis?file=${encodeURIComponent(p.file_path)}`
                                    )
                                  }
                                  className="text-xs font-semibold text-[#7C5CFF] hover:underline inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <span>Open in File Analyzer</span>
                                  <ArrowUpRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
