import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Reusable dark Modal component (#111114 surface, #1F1F25 border, Escape key close).
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'max-w-lg',
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="fixed inset-0"
        onClick={() => onClose && onClose()}
        aria-hidden="true"
      />
      <div
        className={`relative z-10 w-full ${maxWidth} rounded-xl bg-[#111114] border border-[#2A2A32] shadow-2xl overflow-hidden`}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[#1F1F25] bg-[#0E0E11]">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[#F4F4F5]">{title}</h3>
            {subtitle && (
              <p className="text-xs text-[#6B6B76] mt-0.5">{subtitle}</p>
            )}
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="p-1.5 rounded-lg text-[#6B6B76] hover:text-[#F4F4F5] hover:bg-[#16161A] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="p-5 max-h-[75vh] overflow-y-auto text-xs text-[#A1A1AA]">
          {children}
        </div>
        {footer && (
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#1F1F25] bg-[#0E0E11]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

