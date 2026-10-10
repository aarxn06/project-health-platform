import React, { useState } from 'react';
import { Info } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';
import { DeltaBadge } from './DeltaBadge';

/**
 * KpiCard (Section 2.3 & 2.4 Row 1):
 * Displays uppercase label with info tooltip, big value (28-36px, semi-bold, text-primary),
 * delta with arrow and semantic colour, and mini sparkline on the right.
 * When fewer than 2 runs exist, hides the sparkline and delta and shows
 * "Run another analysis to see trends".
 */
export function KpiCard({
  label,
  tooltip,
  value,
  unit = '',
  delta,
  pctChange,
  direction = 'higher_is_better',
  deltaDecimals = 1,
  deltaSuffix = '',
  sparklineData = [],
  sparklineKey = 'value',
  sparklineColor = '#7C5CFF',
  hasHistory = false,
  subtitle,
  gradientId = 'kpiSparkGrad',
  className = '',
}) {
  const [showTip, setShowTip] = useState(false);

  return (
    <div className={`p-4 sm:p-5 flex flex-col justify-between gap-3 ${className}`}>
      {/* Header row: uppercase label + info tooltip */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[#A1A1AA] truncate">
            {label}
          </span>
          {tooltip && (
            <div
              className="relative inline-flex items-center"
              onMouseEnter={() => setShowTip(true)}
              onMouseLeave={() => setShowTip(false)}
            >
              <button
                type="button"
                onFocus={() => setShowTip(true)}
                onBlur={() => setShowTip(false)}
                aria-label={`Info about ${label}`}
                className="text-[#6B6B76] hover:text-[#F4F4F5] focus:outline-none transition-colors cursor-help"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
              {showTip && (
                <div
                  role="tooltip"
                  className="absolute left-0 top-5 z-50 w-60 p-2.5 rounded-lg bg-[#16161A] border border-[#2A2A32] text-[11px] font-normal normal-case tracking-normal text-[#A1A1AA] leading-relaxed shadow-xl pointer-events-none"
                >
                  {tooltip}
                </div>
              )}
            </div>
          )}
        </div>
        {subtitle && (
          <span className="text-[11px] font-mono text-[#6B6B76] shrink-0">{subtitle}</span>
        )}
      </div>

      {/* Main Value + Right Sparkline */}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[28px] sm:text-[32px] font-semibold tracking-tight text-[#F4F4F5] font-mono tabular-nums leading-none">
              {value}
            </span>
            {unit && (
              <span className="text-xs font-mono text-[#6B6B76] font-medium">{unit}</span>
            )}
          </div>

          <div className="mt-2.5 flex items-center gap-2 min-h-[22px]">
            {hasHistory && delta !== null && delta !== undefined ? (
              <>
                <DeltaBadge
                  delta={delta}
                  pctChange={pctChange}
                  direction={direction}
                  decimals={deltaDecimals}
                  suffix={deltaSuffix}
                />
                <span className="text-[11px] text-[#6B6B76]">vs previous run</span>
              </>
            ) : (
              <span className="text-[11px] text-[#6B6B76] italic">
                Run another analysis to see trends
              </span>
            )}
          </div>
        </div>

        {/* Mini Sparkline on the right when >= 2 runs exist */}
        {hasHistory && sparklineData && sparklineData.length >= 2 && (
          <div className="w-24 h-12 shrink-0" aria-label={`${label} historical sparkline`}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineData} margin={{ top: 4, right: 2, left: 2, bottom: 2 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={sparklineColor} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={sparklineColor} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey={sparklineKey}
                  stroke={sparklineColor}
                  strokeWidth={1.75}
                  fill={`url(#${gradientId})`}
                  dot={{ r: 2, fill: sparklineColor, strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

