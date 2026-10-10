import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Info,
  Wrench,
  FileCode2,
  Cpu,
  ArrowUpRight,
  ShieldAlert,
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

export default function RiskDebtPage() {
  const navigate = useNavigate();
  const { activeProject, activeRun, loadingInitial } = usePlatform();
  const [riskData, setRiskData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  useEffect(() => {
    if (!activeRun?.id) {
      setRiskData(null);
      return;
    }
    let cancelled = false;
    async function fetchRisks() {
      try {
        setLoading(true);
        setError(null);
        const res = await platformApi.getAnalysisRisks(activeRun.id);
        if (!cancelled) setRiskData(res);
      } catch (err) {
        if (!cancelled) setError(extractApiError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchRisks();
    return () => {
      cancelled = true;
    };
  }, [activeRun?.id]);

  if (loadingInitial || loading) {
    return <LoadingSkeleton rows={3} />;
  }

  if (!activeProject || !activeRun) {
    return <EmptyProjectState title="No Project Available for Risk & Technical Debt Analysis" />;
  }

  const risks = riskData?.risks || [];
  const filteredRisks = risks.filter(
    (r) => categoryFilter === 'ALL' || r.risk_category === categoryFilter
  );
  const isMlMode = riskData?.scoring_mode === 'ML_MODEL_PREDICTION';

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* Assessment Mode & Methodological Transparency Banner (Section 3F) */}
      <Card
        padding="p-4"
        className={
          isMlMode ? 'border-[#4C8DFF]/45' : 'border-[#7C5CFF]/45'
        }
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3 max-w-4xl">
            <div
              className={`p-2 rounded-lg shrink-0 mt-0.5 border ${
                isMlMode
                  ? 'bg-[#4C8DFF]/15 text-[#4C8DFF] border-[#4C8DFF]/30'
                  : 'bg-[#7C5CFF]/15 text-[#7C5CFF] border-[#7C5CFF]/30'
              }`}
            >
              {isMlMode ? <Cpu className="w-4 h-4" /> : <Info className="w-4 h-4" />}
            </div>
            <div>
              <div className="text-xs font-semibold text-[#F4F4F5] flex flex-wrap items-center gap-2">
                <span>
                  {isMlMode
                    ? `Connected ML Defect Model Active (${riskData.ml_model_used})`
                    : 'Rule-Based Risk Assessment — Preliminary Rule-Based Heuristic Assessment'}
                </span>
                <StatusChip
                  status={isMlMode ? 'ML_MODEL_PREDICTION' : 'RULE_BASED_HEURISTIC'}
                  variant={isMlMode ? 'blue' : 'violet'}
                  size="xs"
                />
              </div>
              <p className="text-xs text-[#A1A1AA] mt-1 leading-relaxed">
                {riskData?.methodology_disclaimer ||
                  'When no external trained scikit-learn model is connected, risk scores are computed deterministically via Rule-Based Risk Assessment from Cyclomatic Complexity, Maintainability Index deficit, Code Smell severity, and Coupling fan-out. Static code metrics indicate structural complexity and maintainability risk; they do not prove that a runtime defect exists.'}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Risk Category Summary Filter Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            key: 'ALL',
            label: 'All Analyzed Files',
            count: risks.length,
            colorClass: 'text-[#F4F4F5]',
            activeBorder: 'border-[#7C5CFF] bg-[rgba(124,92,255,0.1)]',
          },
          {
            key: 'HIGH',
            label: 'High Risk Files',
            count: riskData?.risk_counts?.HIGH ?? 0,
            colorClass: 'text-[#EF4444]',
            activeBorder: 'border-[#EF4444] bg-[#EF4444]/10',
          },
          {
            key: 'MEDIUM',
            label: 'Medium Risk Files',
            count: riskData?.risk_counts?.MEDIUM ?? 0,
            colorClass: 'text-[#EAB308]',
            activeBorder: 'border-[#EAB308] bg-[#EAB308]/10',
          },
          {
            key: 'LOW',
            label: 'Low Risk Files',
            count: riskData?.risk_counts?.LOW ?? 0,
            colorClass: 'text-[#22C55E]',
            activeBorder: 'border-[#22C55E] bg-[#22C55E]/10',
          },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setCategoryFilter(item.key)}
            className={`ui-card p-3.5 text-left transition-all cursor-pointer ${
              categoryFilter === item.key
                ? item.activeBorder
                : 'hover:border-[#2A2A32]'
            }`}
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#A1A1AA]">
              {item.label}
            </div>
            <div
              className={`text-2xl font-semibold font-mono mt-1 tabular-nums ${item.colorClass}`}
            >
              {item.count}
            </div>
          </button>
        ))}
      </div>

      {/* File Risk Cards List */}
      <div className="space-y-3">
        {filteredRisks.map((r) => {
          const scoreColor =
            r.risk_category === 'HIGH'
              ? 'text-[#EF4444]'
              : r.risk_category === 'MEDIUM'
              ? 'text-[#F97316]'
              : 'text-[#22C55E]';

          return (
            <Card key={r.id} padding="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#1F1F25] pb-3.5">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-[#0E0E11] border border-[#1F1F25] text-[#7C5CFF] shrink-0 mt-0.5">
                    <FileCode2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold font-mono text-[#F4F4F5]">
                        {r.file_name}
                      </span>
                      <StatusChip
                        status={`${r.risk_category} RISK`}
                        variant={
                          r.risk_category === 'HIGH'
                            ? 'danger'
                            : r.risk_category === 'MEDIUM'
                            ? 'yellow'
                            : 'success'
                        }
                        size="xs"
                      />
                      <span className="ui-code-pill text-[10px] text-[#A1A1AA]">
                        {r.assessment_mode === 'ML_MODEL_PREDICTION'
                          ? 'ML Model Prediction'
                          : 'Preliminary Rule-Based Assessment'}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-[#6B6B76] mt-0.5 break-all">
                      {r.file_path}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider font-semibold text-[#6B6B76]">
                      {r.assessment_mode === 'ML_MODEL_PREDICTION'
                        ? 'Predicted Defect Prob.'
                        : 'Heuristic Risk Score'}
                    </div>
                    <div className={`text-xl font-semibold font-mono tabular-nums ${scoreColor}`}>
                      {r.risk_score?.toFixed(1)}
                      <span className="text-xs text-[#6B6B76]"> / 100</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/analysis?file=${encodeURIComponent(r.file_path)}`)
                    }
                    className="ui-btn-secondary px-3 py-1.5 text-xs inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Inspect AST</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-[#7C5CFF]" />
                  </button>
                </div>
              </div>

              {/* Explanation */}
              <p className="text-xs text-[#A1A1AA] mt-3 leading-relaxed bg-[#0E0E11] p-3 rounded-lg border border-[#1F1F25]">
                {r.explanation}
              </p>

              {/* Contributing Factors + Quality Concerns & Suggested Actions */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-4">
                <div className="lg:col-span-5 space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#A1A1AA]">
                    Contributing Software Metrics
                  </div>
                  <div className="space-y-2">
                    {r.contributing_factors?.map((cf, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-lg bg-[#0E0E11] border border-[#1F1F25] text-xs"
                      >
                        <div className="flex items-center justify-between font-medium text-[#F4F4F5]">
                          <span>{cf.factor}</span>
                          <span className="font-mono text-[#7C5CFF]">{cf.raw_value}</span>
                        </div>
                        <div className="w-full h-1.5 bg-[#111114] rounded-full overflow-hidden mt-1.5">
                          <div
                            className={`h-full rounded-full ${
                              cf.normalized_impact >= 65
                                ? 'bg-[#EF4444]'
                                : cf.normalized_impact >= 35
                                ? 'bg-[#EAB308]'
                                : 'bg-[#22C55E]'
                            }`}
                            style={{ width: `${Math.min(100, cf.normalized_impact)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-[#0E0E11] border border-[#1F1F25]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#EAB308] flex items-center gap-1.5 mb-2">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Identified Quality Concerns</span>
                    </div>
                    <ul className="space-y-1.5 text-xs text-[#A1A1AA] list-disc list-inside leading-relaxed">
                      {r.quality_concerns?.map((concern, idx) => (
                        <li key={idx}>{concern}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3 rounded-lg bg-[#0E0E11] border border-[#1F1F25]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#22C55E] flex items-center gap-1.5 mb-2">
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Suggested Improvement Actions</span>
                    </div>
                    <ul className="space-y-1.5 text-xs text-[#A1A1AA] list-disc list-inside leading-relaxed">
                      {(r.suggested_actions?.length > 0
                        ? r.suggested_actions
                        : [
                            'Maintain current modular boundaries and unit test coverage.',
                          ]
                      ).map((act, idx) => (
                        <li key={idx}>{act}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
