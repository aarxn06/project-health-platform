import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  Sparkles,
  FileCode2,
  Cpu,
  BarChart3,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { platformApi, extractApiError } from '../services/api';
import { usePlatform } from '../context/PlatformContext';
import { ErrorBanner } from './ui';

/**
 * EmptyProjectState (Section 2.4):
 * A dark, attractive getting-started panel with a soft violet glow,
 * a short three-step guide (Upload ZIP -> Analyze -> Explore results)
 * and a prominent "Upload Project" button. Shows no fabricated metrics.
 */
export default function EmptyProjectState({
  title = 'Get Started with Java Project Health Intelligence',
  subtitle = 'No Java source-code project has been analyzed yet. Upload a Java .zip archive to extract real AST software metrics, evaluate technical debt, and prioritize files for refactoring.',
}) {
  const navigate = useNavigate();
  const { refreshPlatformState } = usePlatform();
  const [loadingSample, setLoadingSample] = useState(false);
  const [error, setError] = useState(null);

  const handleQuickAnalyzeSample = async () => {
    try {
      setLoadingSample(true);
      setError(null);
      const res = await platformApi.analyzeSample('v1');
      const projId = res.data?.project?.id;
      const runId = res.data?.analysis_run?.id;
      await refreshPlatformState(projId, runId);
      navigate('/');
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setLoadingSample(false);
    }
  };

  const steps = [
    {
      step: '01',
      title: 'Upload ZIP',
      desc: 'Select a .zip archive containing Java (.java) source files with automatic path-traversal and size safeguards.',
      icon: UploadCloud,
    },
    {
      step: '02',
      title: 'Analyze AST',
      desc: 'Extract Cyclomatic Complexity, Halstead Volume, Maintainability Index, Coupling fan-out, and code smells.',
      icon: Cpu,
    },
    {
      step: '03',
      title: 'Explore Results',
      desc: 'Inspect project health scores, risk tiers, statistical correlations, refactoring priorities, and PDF reports.',
      icon: BarChart3,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto my-6">
      <div className="relative ui-card p-6 sm:p-10 overflow-hidden">
        {/* Subtle soft violet glow behind the getting-started header */}
        <div
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 rounded-full blur-3xl opacity-20"
          style={{ background: 'radial-gradient(circle, #7C5CFF 0%, transparent 70%)' }}
          aria-hidden="true"
        />

        <div className="relative z-10 text-center max-w-2xl mx-auto">
          <div className="w-12 h-12 rounded-xl bg-[#7C5CFF]/15 border border-[#7C5CFF]/40 flex items-center justify-center mx-auto mb-4 shadow-[0_0_24px_rgba(124,92,255,0.28)]">
            <FileCode2 className="w-6 h-6 text-[#7C5CFF]" />
          </div>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono uppercase tracking-wider bg-[#0E0E11] border border-[#1F1F25] text-[#A1A1AA] mb-3">
            Zero Fabricated Metrics · Real Java AST Pipeline
          </span>

          <h2 className="text-xl sm:text-2xl font-semibold text-[#F4F4F5] tracking-tight">
            {title}
          </h2>
          <p className="text-xs sm:text-sm text-[#A1A1AA] mt-2 leading-relaxed">
            {subtitle}
          </p>
        </div>

        {error && (
          <div className="mt-5 max-w-xl mx-auto">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
          </div>
        )}

        {/* Three-Step Guide (Upload ZIP -> Analyze -> Explore results) */}
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.step}
                className="p-4 rounded-xl bg-[#0E0E11] border border-[#1F1F25] flex flex-col justify-between text-left"
              >
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[11px] font-mono font-semibold text-[#7C5CFF] bg-[#7C5CFF]/12 px-2 py-0.5 rounded border border-[#7C5CFF]/25">
                      STEP {s.step}
                    </span>
                    <Icon className="w-4 h-4 text-[#A1A1AA]" />
                  </div>
                  <h3 className="text-sm font-semibold text-[#F4F4F5]">{s.title}</h3>
                  <p className="text-xs text-[#A1A1AA] mt-1 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Prominent "Upload Project" button + Real Sample Archive Option */}
        <div className="relative z-10 mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/upload')}
            className="ui-btn-primary px-5 py-2.5 text-xs inline-flex items-center gap-2 cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Project</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleQuickAnalyzeSample}
            disabled={loadingSample}
            className="ui-btn-secondary px-4 py-2.5 text-xs inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {loadingSample ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#7C5CFF]" />
                <span>Analyzing Real Java Sample Archive...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-[#7C5CFF]" />
                <span>Analyze Built-In Java Sample (ecommerce-order-engine-v1.zip)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
