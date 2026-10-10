import React, { useEffect, useState } from 'react';
import {
  Save,
  RotateCcw,
  Cpu,
  RefreshCw,
  Loader2,
  Activity,
  Sliders,
  ShieldAlert,
  UploadCloud,
} from 'lucide-react';
import { platformApi, extractApiError } from '../services/api';
import { usePlatform } from '../context/PlatformContext';
import {
  Card,
  CardHeader,
  StatusChip,
  Toggle,
  LoadingSkeleton,
  ErrorBanner,
  Toast,
} from '../components/ui';

export default function SettingsPage() {
  const { activeProject, refreshPlatformState } = usePlatform();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const [uploadLimits, setUploadLimits] = useState({
    max_upload_size_mb: 25,
    max_extracted_files: 2000,
    max_extracted_size_mb: 100,
  });
  const [healthWeights, setHealthWeights] = useState({
    maintainability_weight: 0.3,
    complexity_weight: 0.3,
    code_quality_weight: 0.2,
    defect_risk_weight: 0.2,
  });
  const [priorityWeights, setPriorityWeights] = useState({
    risk_weight: 0.35,
    complexity_weight: 0.25,
    maintainability_weight: 0.2,
    smell_severity_weight: 0.2,
  });
  const [riskThresholds, setRiskThresholds] = useState({
    critical_risk_threshold: null,
    high_risk_threshold: 65.0,
    medium_risk_threshold: 35.0,
  });
  const [analysisThresholds, setAnalysisThresholds] = useState({
    god_class_loc: 250,
    god_class_methods: 15,
    long_method_loc: 40,
    high_method_complexity: 10,
    high_file_complexity: 25,
    max_parameters_threshold: 5,
    deep_nesting_threshold: 4,
    min_comment_ratio_pct: 8.0,
    high_fan_out_threshold: 12,
  });
  const [mlConfig, setMlConfig] = useState({
    prefer_ml_when_available: true,
    ml_defect_probability_threshold: 0.5,
  });

  const [mlStatus, setMlStatus] = useState(null);
  const [appInfo, setAppInfo] = useState(null);

  const populateStateFromResponse = (data) => {
    const s = data.settings || {};
    if (s.upload_limits?.value) setUploadLimits(s.upload_limits.value);
    if (s.health_score_weights?.value) setHealthWeights(s.health_score_weights.value);
    if (s.priority_weights?.value) setPriorityWeights(s.priority_weights.value);
    if (s.risk_thresholds?.value) {
      setRiskThresholds({
        critical_risk_threshold: s.risk_thresholds.value.critical_risk_threshold ?? null,
        high_risk_threshold: s.risk_thresholds.value.high_risk_threshold ?? 65.0,
        medium_risk_threshold: s.risk_thresholds.value.medium_risk_threshold ?? 35.0,
      });
    }
    if (s.analysis_thresholds?.value) setAnalysisThresholds(s.analysis_thresholds.value);
    if (s.ml_configuration?.value) setMlConfig(s.ml_configuration.value);
    if (data.ml_status) setMlStatus(data.ml_status);
    if (data.application_info) setAppInfo(data.application_info);
  };

  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true);
        const data = await platformApi.getSettings();
        populateStateFromResponse(data);
      } catch (err) {
        setError(extractApiError(err));
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const healthWeightSum =
    Number(healthWeights.maintainability_weight || 0) +
    Number(healthWeights.complexity_weight || 0) +
    Number(healthWeights.code_quality_weight || 0) +
    Number(healthWeights.defect_risk_weight || 0);

  const priorityWeightSum =
    Number(priorityWeights.risk_weight || 0) +
    Number(priorityWeights.complexity_weight || 0) +
    Number(priorityWeights.maintainability_weight || 0) +
    Number(priorityWeights.smell_severity_weight || 0);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      setSuccessMsg(null);
      const res = await platformApi.updateSettings({
        upload_limits: uploadLimits,
        health_score_weights: healthWeights,
        priority_weights: priorityWeights,
        risk_thresholds: riskThresholds,
        analysis_thresholds: analysisThresholds,
        ml_configuration: mlConfig,
      });
      populateStateFromResponse(res.data);
      setSuccessMsg(res.message || 'Settings validated and persisted successfully.');
      await refreshPlatformState();
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccessMsg(null);
      const res = await platformApi.resetSettings();
      populateStateFromResponse(res.data);
      setSuccessMsg(res.message || 'Settings restored to documented default values.');
      await refreshPlatformState();
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleReanalyzeActiveProject = async () => {
    if (!activeProject?.id) return;
    try {
      setReanalyzing(true);
      setError(null);
      setSuccessMsg(null);
      const res = await platformApi.analyzeProject(
        activeProject.id,
        `Re-Analysis (Updated Settings)`
      );
      const newRunId = res.data?.analysis_run?.id;
      await refreshPlatformState(activeProject.id, newRunId);
      setSuccessMsg(
        `Triggered new analysis run for "${activeProject.name}" using current settings.`
      );
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setReanalyzing(false);
    }
  };

  if (loading) {
    return <LoadingSkeleton rows={3} />;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      {successMsg && (
        <Toast message={successMsg} type="success" onClose={() => setSuccessMsg(null)} />
      )}

      {/* Top Row: ML Integration Status + Application Information */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Card className="lg:col-span-7" padding="p-5">
          <CardHeader
            title="Scikit-Learn Defect Prediction Model Integration Interface"
            icon={Cpu}
            tooltip="Displays real-time verification status of the external scikit-learn defect prediction model interface."
            rightControl={
              <StatusChip
                status={
                  mlStatus?.is_available
                    ? 'MODEL CONNECTED'
                    : 'FALLBACK: RULE-BASED HEURISTIC'
                }
                variant={mlStatus?.is_available ? 'success' : 'yellow'}
                size="xs"
              />
            }
          />

          <p className="text-xs text-[#A1A1AA] leading-relaxed">{mlStatus?.status_message}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 text-xs">
            <div className="p-3 rounded-xl bg-[#0E0E11] border border-[#1F1F25]">
              <div className="text-[10px] uppercase font-mono text-[#6B6B76]">
                Expected Model Path
              </div>
              <div className="font-mono text-[#F4F4F5] mt-0.5 break-all">
                backend/ml/models/defect_predictor.joblib
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[#0E0E11] border border-[#1F1F25]">
              <div className="text-[10px] uppercase font-mono text-[#6B6B76]">
                Active Scoring Mode
              </div>
              <div className="font-mono font-semibold text-[#7C5CFF] mt-0.5">
                {mlStatus?.active_assessment_mode}
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-[#1F1F25] space-y-3">
            <Toggle
              checked={Boolean(mlConfig.prefer_ml_when_available)}
              onChange={(checked) =>
                setMlConfig((prev) => ({
                  ...prev,
                  prefer_ml_when_available: checked,
                }))
              }
              label="Prefer ML Classifier When Compatible Model Artifact Is Loaded"
              description="When enabled, the scoring engine automatically uses the verified scikit-learn model probabilities if present, and falls back to rule-based heuristics otherwise."
            />

            <div>
              <div className="text-[11px] font-semibold text-[#A1A1AA] mb-1.5">
                Supported Extracted Java Features Available for Model Input:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {mlStatus?.supported_java_features?.map((feat) => (
                  <span key={feat} className="ui-code-pill text-[10px] text-[#A1A1AA]">
                    {feat}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-5 flex flex-col justify-between" padding="p-5">
          <div>
            <CardHeader
              title="Application & Runtime Information"
              icon={Activity}
              tooltip="Core backend engine and persistence layer metadata."
            />

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-[#1F1F25]">
                <span className="text-[#A1A1AA]">Application Version</span>
                <span className="font-mono font-semibold text-[#F4F4F5]">
                  {appInfo?.version || '1.0.0'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#1F1F25]">
                <span className="text-[#A1A1AA]">Java Static Parser</span>
                <span className="font-mono text-[#F4F4F5]">{appInfo?.java_parser}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#1F1F25]">
                <span className="text-[#A1A1AA]">Report Engine</span>
                <span className="font-mono text-[#F4F4F5]">{appInfo?.pdf_engine}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[#A1A1AA]">Database Layer</span>
                <span className="font-mono text-[#22C55E] uppercase">
                  {appInfo?.database_engine} (SQLAlchemy ORM)
                </span>
              </div>
            </div>
          </div>

          {activeProject && (
            <div className="mt-4 pt-3 border-t border-[#1F1F25]">
              <button
                type="button"
                onClick={handleReanalyzeActiveProject}
                disabled={reanalyzing}
                className="w-full ui-btn-secondary px-3 py-2 text-xs inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {reanalyzing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#7C5CFF]" />
                    <span>Re-Analyzing {activeProject.name}...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-[#7C5CFF]" />
                    <span>Re-Run Analysis on &ldquo;{activeProject.name}&rdquo;</span>
                  </>
                )}
              </button>
            </div>
          )}
        </Card>
      </div>

      {/* Configurable Settings Form */}
      <form onSubmit={handleSaveSettings} className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 1. Health Score Weights */}
          <Card padding="p-5">
            <CardHeader
              title="Project Health Score Weights"
              icon={Sliders}
              tooltip="Relative weights (must sum to 1.0) for combining normalized quality factors into the 0–100 Project Health Score."
              rightControl={
                <StatusChip
                  status={`Sum: ${healthWeightSum.toFixed(2)}`}
                  variant={Math.abs(healthWeightSum - 1.0) <= 0.01 ? 'success' : 'danger'}
                  size="xs"
                />
              }
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { key: 'maintainability_weight', label: 'Maintainability Weight' },
                { key: 'complexity_weight', label: 'Complexity Weight' },
                { key: 'code_quality_weight', label: 'Code Quality Weight' },
                { key: 'defect_risk_weight', label: 'Defect Risk Weight' },
              ].map((item) => (
                <div key={item.key}>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1">
                    {item.label}
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={healthWeights[item.key]}
                    onChange={(e) =>
                      setHealthWeights({
                        ...healthWeights,
                        [item.key]: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-1.5 ui-input font-mono"
                  />
                </div>
              ))}
            </div>
          </Card>

          {/* 2. Refactoring Priority Weights */}
          <Card padding="p-5">
            <CardHeader
              title="Refactoring Priority Weights"
              icon={Sliders}
              tooltip="Relative weights (must sum to 1.0) for ranking files in Top Refactoring Priorities."
              rightControl={
                <StatusChip
                  status={`Sum: ${priorityWeightSum.toFixed(2)}`}
                  variant={Math.abs(priorityWeightSum - 1.0) <= 0.01 ? 'success' : 'danger'}
                  size="xs"
                />
              }
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { key: 'risk_weight', label: 'Risk Score Weight' },
                { key: 'complexity_weight', label: 'Complexity & Nesting Weight' },
                { key: 'maintainability_weight', label: 'Maintainability Deficit Weight' },
                { key: 'smell_severity_weight', label: 'Code Smell Severity Weight' },
              ].map((item) => (
                <div key={item.key}>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1">
                    {item.label}
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={priorityWeights[item.key]}
                    onChange={(e) =>
                      setPriorityWeights({
                        ...priorityWeights,
                        [item.key]: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-1.5 ui-input font-mono"
                  />
                </div>
              ))}
            </div>
          </Card>

          {/* 3. Risk Thresholds & Upload Limits */}
          <Card padding="p-5" className="space-y-4">
            <div>
              <CardHeader
                title="Risk Categorization Thresholds (0–100)"
                icon={ShieldAlert}
                tooltip="Score boundaries for High, Medium, and Low risk tiers. Defining an optional Critical Risk Threshold (> High) enables the 'Critical' segment in the Dashboard's Code Stability Overview."
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1">
                    Critical Threshold (Optional)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="15"
                    max="99"
                    placeholder="Disabled (None)"
                    value={
                      riskThresholds.critical_risk_threshold === null ||
                      riskThresholds.critical_risk_threshold === undefined
                        ? ''
                        : riskThresholds.critical_risk_threshold
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      setRiskThresholds({
                        ...riskThresholds,
                        critical_risk_threshold: val === '' ? null : parseFloat(val),
                      });
                    }}
                    className="w-full px-3 py-1.5 ui-input font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1">
                    High Risk Threshold (≥)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="10"
                    max="95"
                    value={riskThresholds.high_risk_threshold}
                    onChange={(e) =>
                      setRiskThresholds({
                        ...riskThresholds,
                        high_risk_threshold: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-1.5 ui-input font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1">
                    Medium Risk Threshold (≥)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="5"
                    max="90"
                    value={riskThresholds.medium_risk_threshold}
                    onChange={(e) =>
                      setRiskThresholds({
                        ...riskThresholds,
                        medium_risk_threshold: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-1.5 ui-input font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#1F1F25]">
              <CardHeader
                title="Archive Upload & Extraction Limits"
                icon={UploadCloud}
                tooltip="Configurable size and file-count safeguards against zip bombs."
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1">
                    Max ZIP Upload (MB)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={uploadLimits.max_upload_size_mb}
                    onChange={(e) =>
                      setUploadLimits({
                        ...uploadLimits,
                        max_upload_size_mb: parseFloat(e.target.value) || 1,
                      })
                    }
                    className="w-full px-3 py-1.5 ui-input font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1">
                    Max Extracted Files
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="20000"
                    value={uploadLimits.max_extracted_files}
                    onChange={(e) =>
                      setUploadLimits({
                        ...uploadLimits,
                        max_extracted_files: parseInt(e.target.value, 10) || 5,
                      })
                    }
                    className="w-full px-3 py-1.5 ui-input font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1">
                    Max Uncompressed (MB)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="2000"
                    value={uploadLimits.max_extracted_size_mb}
                    onChange={(e) =>
                      setUploadLimits({
                        ...uploadLimits,
                        max_extracted_size_mb: parseFloat(e.target.value) || 1,
                      })
                    }
                    className="w-full px-3 py-1.5 ui-input font-mono"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* 4. Static Code Smell Detection Thresholds */}
          <Card padding="p-5">
            <CardHeader
              title="Java Code-Smell Detection Thresholds"
              icon={Sliders}
              tooltip="Heuristic thresholds used during Java AST static analysis to identify structural code smells."
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { key: 'god_class_loc', label: 'God Class LOC' },
                { key: 'god_class_methods', label: 'God Class Methods' },
                { key: 'long_method_loc', label: 'Long Method LOC' },
                { key: 'high_method_complexity', label: 'High Method CC' },
                { key: 'high_file_complexity', label: 'High File CC' },
                { key: 'max_parameters_threshold', label: 'Max Method Params' },
                { key: 'deep_nesting_threshold', label: 'Max Nesting Depth' },
                { key: 'min_comment_ratio_pct', label: 'Min Comment %' },
                { key: 'high_fan_out_threshold', label: 'High Fan-Out' },
              ].map((item) => (
                <div key={item.key}>
                  <label className="block text-[11px] font-medium text-[#A1A1AA] mb-1">
                    {item.label}
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={analysisThresholds[item.key]}
                    onChange={(e) =>
                      setAnalysisThresholds({
                        ...analysisThresholds,
                        [item.key]: parseFloat(e.target.value) || 1,
                      })
                    }
                    className="w-full px-2.5 py-1.5 ui-input font-mono"
                  />
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Save & Reset Action Buttons */}
        <Card padding="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleResetDefaults}
              disabled={saving}
              className="ui-btn-secondary px-3.5 py-2 text-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#A1A1AA]" />
              <span>Restore Default Settings</span>
            </button>

            <button
              type="submit"
              disabled={saving}
              className="ui-btn-primary px-5 py-2 text-xs inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Validating & Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save & Persist Configuration</span>
                </>
              )}
            </button>
          </div>
        </Card>
      </form>
    </div>
  );
}
