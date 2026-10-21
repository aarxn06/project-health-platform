import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, FileCode2, Cpu, BarChart3, ArrowRight } from 'lucide-react';

/**
 * Honest empty state: no health KPIs, charts, or sample results until
 * the user explicitly uploads a Java project.
 */
export default function EmptyProjectState({
  title = 'No Java project uploaded yet',
  subtitle = 'Your dashboard will show real project health scores, code metrics, risks, and charts after you upload and analyze a Java ZIP archive.',
}) {
  const navigate = useNavigate();
  const steps = [
    { step: '01', title: 'Upload ZIP', desc: 'Choose a ZIP file containing Java (.java) source files.', icon: UploadCloud },
    { step: '02', title: 'Analyze Code', desc: 'Extract AST metrics, complexity, coupling, and maintainability.', icon: Cpu },
    { step: '03', title: 'View Results', desc: 'Explore your actual project metrics, risks, and recommendations.', icon: BarChart3 },
  ];

  return (
    <div className="max-w-4xl mx-auto my-6">
      <div className="relative ui-card p-6 sm:p-10 overflow-hidden">
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 rounded-full blur-3xl opacity-20"
          style={{ background: 'radial-gradient(circle, #7C5CFF 0%, transparent 70%)' }} aria-hidden="true" />
        <div className="relative z-10 text-center max-w-2xl mx-auto">
          <div className="w-12 h-12 rounded-xl bg-[#7C5CFF]/15 border border-[#7C5CFF]/40 flex items-center justify-center mx-auto mb-4">
            <FileCode2 className="w-6 h-6 text-[#7C5CFF]" />
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold text-[#F4F4F5]">{title}</h2>
          <p className="text-xs sm:text-sm text-[#A1A1AA] mt-2 leading-relaxed">{subtitle}</p>
          <p className="text-xs text-[#6B6B76] mt-2">No placeholder data or automatic sample analysis is displayed.</p>
        </div>
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.step} className="p-4 rounded-xl bg-[#0E0E11] border border-[#1F1F25] text-left">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] font-mono font-semibold text-[#7C5CFF]">STEP {s.step}</span>
                  <Icon className="w-4 h-4 text-[#A1A1AA]" />
                </div>
                <h3 className="text-sm font-semibold text-[#F4F4F5]">{s.title}</h3>
                <p className="text-xs text-[#A1A1AA] mt-1 leading-relaxed">{s.desc}</p>
              </div>
            );
          })}
        </div>
        <div className="relative z-10 mt-8 flex items-center justify-center">
          <button type="button" onClick={() => navigate('/upload')}
            className="ui-btn-primary px-5 py-2.5 text-xs inline-flex items-center gap-2 cursor-pointer">
            <UploadCloud className="w-4 h-4" />
            <span>Upload Your First Project</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
