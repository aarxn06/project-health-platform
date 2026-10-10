import React from 'react';

/**
 * SegmentedBar (Section 2.3 & 2.4):
 * Horizontal stacked bar for risk distribution (Critical / High / Medium / Low)
 * with optional legend list below showing file count and percentage per category.
 */
export function SegmentedBar({
  segments = [],
  height = 'h-3',
  showLegend = true,
  className = '',
}) {
  const total = segments.reduce((acc, s) => acc + (Number(s.count) || 0), 0);

  return (
    <div className={className}>
      {/* Horizontal Stacked Bar */}
      <div
        className={`w-full ${height} rounded-full bg-[#0E0E11] border border-[#1F1F25] overflow-hidden flex p-0.5 gap-0.5`}
        role="img"
        aria-label="Risk distribution segmented bar"
      >
        {total === 0 ? (
          <div className="w-full h-full bg-[#1F1F25] rounded-full" />
        ) : (
          segments.map((seg) => {
            const pct = total > 0 ? ((Number(seg.count) || 0) / total) * 100 : 0;
            if (pct <= 0) return null;
            return (
              <div
                key={seg.key || seg.label}
                style={{
                  width: `${Math.max(pct, 3)}%`,
                  backgroundColor: seg.color,
                }}
                title={`${seg.label}: ${seg.count} files (${pct.toFixed(1)}%)`}
                className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-200"
              />
            );
          })
        )}
      </div>

      {/* Category Legend List */}
      {showLegend && (
        <div className="mt-3 space-y-1.5">
          {segments.map((seg) => {
            const pct =
              seg.percentage !== undefined
                ? Number(seg.percentage).toFixed(1)
                : total > 0
                ? (((Number(seg.count) || 0) / total) * 100).toFixed(1)
                : '0.0';
            return (
              <div
                key={seg.key || seg.label}
                className="flex items-center justify-between text-xs py-1 px-2 rounded-md hover:bg-[#16161A] transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className="text-[#A1A1AA] font-medium truncate">{seg.label}</span>
                  {seg.thresholdHint && (
                    <span className="text-[10px] font-mono text-[#6B6B76] hidden sm:inline">
                      ({seg.thresholdHint})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 font-mono tabular-nums shrink-0">
                  <span className="text-[#F4F4F5] font-semibold">
                    {seg.count} {seg.count === 1 ? 'file' : 'files'}
                  </span>
                  <span className="text-[#6B6B76] w-12 text-right">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * SegmentedBlockBar (Section 2.3 & 2.4 Row 4 Footer Metric Strip):
 * Small segmented-block level bar (4 discrete blocks) with semantic colour.
 */
export function SegmentedBlockBar({
  activeBlocks = 0,
  totalBlocks = 4,
  variant = 'violet',
  className = '',
}) {
  const colorMap = {
    success: '#22C55E',
    blue: '#4C8DFF',
    yellow: '#EAB308',
    orange: '#F97316',
    danger: '#EF4444',
    violet: '#7C5CFF',
    muted: '#6B6B76',
  };
  const activeColor = colorMap[variant] || colorMap.violet;

  return (
    <div
      className={`inline-flex items-center gap-1 ${className}`}
      aria-label={`Status level ${activeBlocks} of ${totalBlocks}`}
    >
      {Array.from({ length: totalBlocks }).map((_, i) => {
        const isFilled = i < activeBlocks;
        return (
          <span
            key={i}
            style={{
              backgroundColor: isFilled ? activeColor : '#1F1F25',
            }}
            className="w-4 h-1.5 rounded-xs transition-colors duration-150"
          />
        );
      })}
    </div>
  );
}

