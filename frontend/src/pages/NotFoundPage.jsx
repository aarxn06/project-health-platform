import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Compass, ArrowLeft, UploadCloud } from 'lucide-react';
import { Card, Button } from '../components/ui';

export default function NotFoundPage() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="py-12 max-w-xl mx-auto">
      <Card padding="p-8" className="text-center border-[#2A2A32]">
        <div className="w-12 h-12 rounded-xl bg-[#7C5CFF]/12 border border-[#7C5CFF]/35 flex items-center justify-center mx-auto mb-4 shadow-[0_0_18px_rgba(124,92,255,0.2)]">
          <Compass className="w-6 h-6 text-[#7C5CFF]" />
        </div>
        <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-[#7C5CFF] font-semibold">
          Error 404 · Route Not Found
        </div>
        <h2 className="text-lg font-semibold text-[#F4F4F5] mt-1">
          The requested workspace route does not exist
        </h2>
        <p className="text-xs text-[#A1A1AA] mt-2 leading-relaxed">
          No view matched path{' '}
          <span className="ui-code-pill text-[#F4F4F5]">{location.pathname}</span>.
          Use the navigation sidebar or return to the main dashboard.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          <Button
            variant="primary"
            icon={ArrowLeft}
            onClick={() => navigate('/')}
          >
            Back to Dashboard
          </Button>
          <Button
            variant="secondary"
            icon={UploadCloud}
            onClick={() => navigate('/upload')}
          >
            Upload Project
          </Button>
        </div>
      </Card>
    </div>
  );
}

