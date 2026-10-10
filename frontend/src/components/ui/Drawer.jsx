import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Reusable dark slide-over Drawer component (#111114 surface, #1F1F25 border).
 * Used for file detail inspection in Project Analysis and mobile navigation.
 */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  headerBadge,
  children,
  widthClass = 'max-w-2xl',
  side = 'right',
}) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const sideAlign = side === 'left' ? 'justify-start' : 'justify-end';
  const borderClass = side === 'left' ? 'border-r' : 'border-l';

  return (
    <div
      className={`fixed inset-0 z-50 flex ${sideAlign} bg-black/70 backdrop-blur-xs`}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="fixed inset-0"
        onClick={() => onClose && onClose()}
        aria-hidden="true"
      />
      <div
        className={`relative z-10 w-full ${widthClass} bg-[#111114] ${borderClass} border-[#1F1F25] h-full overflow-y-auto shadow-2xl flex flex-col`}
      >
        {title !== undefined && (
          <div className="sticky top-0 z-20 bg-[#111114]/95 backdrop-blur-md border-b border-[#1F1F25] px-5 py-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold font-mono text-[#F4F4F5] truncate">
                  {title}
                </h2>
                {headerBadge}
              </div>
              {subtitle && (
                <p className="text-xs font-mono text-[#6B6B76] mt-0.5 break-all">
                  {subtitle}
                </p>
              )}
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close drawer"
                className="p-1.5 rounded-lg bg-[#0E0E11] border border-[#1F1F25] text-[#A1A1AA] hover:text-[#F4F4F5] hover:border-[#2A2A32] transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
        <div className="flex-1 p-5 space-y-5">{children}</div>
      </div>
    </div>
  );
}

