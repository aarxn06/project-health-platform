import React from 'react';
import { AlertTriangle, CheckCircle2, Info, X, FileCode2 } from 'lucide-react';

/**
 * LoadingSkeleton (Section 2.3):
 * Dark shimmer skeleton blocks for realistic loading states without white flashes.
 */
export function LoadingSkeleton({ rows = 3, className = '' }) {
  return (
    <div className={`space-y-4 ${className}`} data-testid="loading-skeleton">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="ui-card h-28 dark-shimmer" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 ui-card h-72 dark-shimmer" />
        <div className="lg:col-span-7 ui-card h-72 dark-shimmer" />
      </div>
      {rows >= 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="ui-card h-60 dark-shimmer" />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * ErrorBanner (Section 2.3):
 * Consistent dark error banner with optional retry or dismiss button.
 */
export function ErrorBanner({ message, title = 'Error', onRetry, onDismiss, className = '' }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className={`p-3.5 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/35 text-xs text-[#EF4444] flex items-start justify-between gap-3 ${className}`}
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#EF4444]" />
        <div>
          <div className="font-semibold text-[#F4F4F5]">{title}</div>
          <div className="text-[#EF4444] mt-0.5 leading-relaxed">{message}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-2.5 py-1 rounded-md bg-[#EF4444]/20 hover:bg-[#EF4444]/30 text-[#F4F4F5] font-medium transition-colors cursor-pointer"
          >
            Retry
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss error"
            className="text-[#A1A1AA] hover:text-[#F4F4F5] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Toast (Section 2.3):
 * Compact dark notification banner for success/warning/info feedback.
 */
export function Toast({ message, type = 'success', onClose, className = '' }) {
  if (!message) return null;

  const styles = {
    success: 'bg-[#22C55E]/10 border-[#22C55E]/35 text-[#22C55E]',
    warning: 'bg-[#EAB308]/10 border-[#EAB308]/35 text-[#EAB308]',
    danger: 'bg-[#EF4444]/10 border-[#EF4444]/35 text-[#EF4444]',
    info: 'bg-[#7C5CFF]/12 border-[#7C5CFF]/35 text-[#7C5CFF]',
  };

  return (
    <div
      role="status"
      className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
        styles[type] || styles.info
      } ${className}`}
    >
      <div className="flex items-center gap-2.5">
        {type === 'success' ? (
          <CheckCircle2 className="w-4 h-4 shrink-0" />
        ) : type === 'danger' || type === 'warning' ? (
          <AlertTriangle className="w-4 h-4 shrink-0" />
        ) : (
          <Info className="w-4 h-4 shrink-0" />
        )}
        <span className="text-[#F4F4F5] font-medium">{message}</span>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close notification"
          className="text-[#A1A1AA] hover:text-[#F4F4F5] cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

/**
 * EmptyState (Section 2.3):
 * Reusable dark empty state card for filtered views or missing data.
 */
export function EmptyState({
  icon: Icon = FileCode2,
  title = 'No Data Available',
  description = 'Adjust your filters or run a new Java source-code analysis.',
  actionLabel,
  onAction,
  className = '',
}) {
  return (
    <div className={`ui-card p-8 text-center max-w-xl mx-auto my-6 ${className}`}>
      <div className="w-11 h-11 rounded-xl bg-[#7C5CFF]/12 border border-[#7C5CFF]/30 flex items-center justify-center mx-auto mb-3 shadow-[0_0_20px_rgba(124,92,255,0.18)]">
        <Icon className="w-5 h-5 text-[#7C5CFF]" />
      </div>
      <h3 className="text-sm font-semibold text-[#F4F4F5]">{title}</h3>
      <p className="text-xs text-[#A1A1AA] mt-1.5 leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 ui-btn-primary px-4 py-2 inline-flex items-center gap-2 cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
