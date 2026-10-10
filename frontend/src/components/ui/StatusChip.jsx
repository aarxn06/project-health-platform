import React from 'react';

/**
 * StatusChip (Section 2.3):
 * Displays semantic status pills such as Excellent / Good / Fair / Poor
 * or risk categories Critical / High / Medium / Low with matching dark-surface colours.
 */
export function StatusChip({ status, variant, size = 'sm', className = '' }) {
  const normalized = String(status || '').toUpperCase();

  let resolvedVariant = variant;
  if (!resolvedVariant) {
    if (['EXCELLENT', 'HEALTHY', 'LOW', 'COMPLETED', 'SUCCESS', 'IMPROVED'].includes(normalized)) {
      resolvedVariant = 'success';
    } else if (['GOOD', 'ML_MODEL_PREDICTION', 'INFO'].includes(normalized)) {
      resolvedVariant = 'blue';
    } else if (['FAIR', 'MEDIUM', 'MODERATE', 'RULE_BASED_HEURISTIC'].includes(normalized)) {
      resolvedVariant = 'yellow';
    } else if (['HIGH', 'WARNING'].includes(normalized)) {
      resolvedVariant = 'orange';
    } else if (['POOR', 'CRITICAL', 'ERROR', 'PARSE_ERROR', 'FAILED', 'WORSENED'].includes(normalized)) {
      resolvedVariant = 'danger';
    } else if (['VIOLET', 'PRIMARY'].includes(normalized)) {
      resolvedVariant = 'violet';
    } else {
      resolvedVariant = 'muted';
    }
  }

  const variantClasses = {
    success: 'bg-[#22C55E]/12 text-[#22C55E] border-[#22C55E]/30',
    blue: 'bg-[#4C8DFF]/12 text-[#4C8DFF] border-[#4C8DFF]/30',
    yellow: 'bg-[#EAB308]/12 text-[#EAB308] border-[#EAB308]/30',
    orange: 'bg-[#F97316]/12 text-[#F97316] border-[#F97316]/30',
    danger: 'bg-[#EF4444]/12 text-[#EF4444] border-[#EF4444]/30',
    violet: 'bg-[#7C5CFF]/15 text-[#7C5CFF] border-[#7C5CFF]/35',
    muted: 'bg-[#16161A] text-[#A1A1AA] border-[#2A2A32]',
  };

  const sizeClasses =
    size === 'xs'
      ? 'px-1.5 py-0.5 text-[10px]'
      : size === 'md'
      ? 'px-2.5 py-1 text-xs'
      : 'px-2 py-0.5 text-[11px]';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-medium border leading-tight select-none ${
        variantClasses[resolvedVariant] || variantClasses.muted
      } ${sizeClasses} ${className}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
          resolvedVariant === 'success'
            ? 'bg-[#22C55E]'
            : resolvedVariant === 'blue'
            ? 'bg-[#4C8DFF]'
            : resolvedVariant === 'yellow'
            ? 'bg-[#EAB308]'
            : resolvedVariant === 'orange'
            ? 'bg-[#F97316]'
            : resolvedVariant === 'danger'
            ? 'bg-[#EF4444]'
            : resolvedVariant === 'violet'
            ? 'bg-[#7C5CFF]'
            : 'bg-[#6B6B76]'
        }`}
      />
      <span>{status}</span>
    </span>
  );
}

