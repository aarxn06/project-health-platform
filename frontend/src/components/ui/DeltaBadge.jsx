import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { evaluateMetricDelta } from '../../utils/formatters';

/**
 * DeltaBadge (Section 2.3):
 * Displays up/down arrow, percentage or numeric change, and semantic colour based on
 * whether the change is an improvement for that specific metric, not simply up or down.
 *
 * @param {number} delta - Raw difference (current - previous)
 * @param {number} [pctChange] - Percentage difference
 * @param {'higher_is_better' | 'lower_is_better' | 'neutral'} [direction='higher_is_better']
 * @param {string} [suffix=''] - Optional unit suffix when showing raw delta
 * @param {number} [decimals=1] - Decimals to format raw delta
 * @param {boolean} [preferPercentage=false] - Whether to display percentage instead of raw delta
 */
export function DeltaBadge({
  delta,
  pctChange,
  direction = 'higher_is_better',
  suffix = '',
  decimals = 1,
  preferPercentage = false,
  label = '',
  className = '',
}) {
  if (delta === null || delta === undefined || Number.isNaN(Number(delta))) {
    return null;
  }

  const numDelta = Number(delta);
  const status = evaluateMetricDelta(numDelta, direction);

  const colorStyles = {
    improved: 'text-[#22C55E] bg-[#22C55E]/10 border-[#22C55E]/25',
    worsened: 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/25',
    neutral: 'text-[#A1A1AA] bg-[#16161A] border-[#2A2A32]',
    unchanged: 'text-[#6B6B76] bg-[#16161A] border-[#1F1F25]',
  };

  const isZero = Math.abs(numDelta) < 0.001;
  const sign = numDelta > 0 ? '+' : '';

  let displayValue;
  if (isZero) {
    displayValue = '0%';
  } else if (preferPercentage && pctChange !== null && pctChange !== undefined) {
    displayValue = `${sign}${Number(pctChange).toFixed(1)}%`;
  } else {
    const formatted =
      decimals === 0 ? Math.round(numDelta).toLocaleString() : numDelta.toFixed(decimals);
    displayValue = `${sign}${formatted}${suffix}`;
    if (pctChange !== null && pctChange !== undefined && Math.abs(pctChange) > 0.05) {
      displayValue += ` (${sign}${Number(pctChange).toFixed(1)}%)`;
    }
  }

  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-mono font-medium border tabular-nums ${
        colorStyles[status] || colorStyles.neutral
      } ${className}`}
    >
      {isZero ? (
        <Minus className="w-3 h-3 shrink-0" />
      ) : numDelta > 0 ? (
        <ArrowUpRight className="w-3 h-3 shrink-0" />
      ) : (
        <ArrowDownRight className="w-3 h-3 shrink-0" />
      )}
      <span>{displayValue}</span>
      {label && <span className="text-[#6B6B76] font-sans ml-0.5">{label}</span>}
    </span>
  );
}

