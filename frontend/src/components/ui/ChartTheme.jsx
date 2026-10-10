import React from 'react';

/**
 * Section 2.5 Dark Chart Styling tokens and helpers for every Recharts chart in the app:
 * - Transparent chart background inside dark cards
 * - Grid lines: #1F1F25, dashed, horizontal only where possible
 * - Axis lines hidden or #2A2A32; tick labels #6B6B76 at 11-12px; always include axis titles
 * - Primary series: violet #7C5CFF with gradient area fill (30% opacity fading to 0%)
 * - Secondary series: blue #4C8DFF, green #22C55E, orange #F97316, red #EF4444, yellow #EAB308
 * - Tooltips: dark card style (#16161A, 1px #2A2A32 border, 8px radius, small text, subtle shadow)
 */
export const CHART_COLORS = {
  violet: '#7C5CFF',
  blue: '#4C8DFF',
  success: '#22C55E',
  yellow: '#EAB308',
  orange: '#F97316',
  danger: '#EF4444',
  muted: '#6B6B76',
  grid: '#1F1F25',
  axis: '#2A2A32',
  tick: '#6B6B76',
  cardBg: '#111114',
  tooltipBg: '#16161A',
  tooltipBorder: '#2A2A32',
};

export const RISK_PALETTE = {
  CRITICAL: '#EF4444',
  HIGH: '#F97316',
  MEDIUM: '#EAB308',
  LOW: '#22C55E',
};

export const DARK_TOOLTIP_CONTENT_STYLE = {
  backgroundColor: '#16161A',
  border: '1px solid #2A2A32',
  borderRadius: '8px',
  fontSize: '11px',
  color: '#F4F4F5',
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
  padding: '8px 10px',
};

export const DARK_AXIS_TICK = {
  fill: '#6B6B76',
  fontSize: 11,
  fontFamily: 'JetBrains Mono, ui-monospace, monospace',
};

export const DARK_AXIS_LINE = {
  stroke: '#2A2A32',
};

/**
 * ChartTheme wrapper component that provides standard SVG gradient definitions
 * and consistent dark container styling for Recharts charts.
 */
export function ChartTheme({ children, height = 'h-64', className = '' }) {
  return (
    <div className={`w-full ${height} bg-transparent select-none ${className}`}>
      {children}
    </div>
  );
}

/**
 * Custom dark tooltip component for Recharts when rich formatting is needed.
 */
export function DarkChartTooltip({ active, payload, label, unitMap = {} }) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-[#16161A] border border-[#2A2A32] rounded-lg px-3 py-2 text-[11px] shadow-xl">
      {label !== undefined && label !== '' && (
        <div className="font-mono font-semibold text-[#F4F4F5] mb-1 border-b border-[#1F1F25] pb-1">
          {label}
        </div>
      )}
      <div className="space-y-1">
        {payload.map((entry, idx) => {
          const val = entry.value;
          const unit = unitMap[entry.dataKey] || unitMap[entry.name] || '';
          return (
            <div key={idx} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5 text-[#A1A1AA]">
                <span
                  className="w-2 h-2 rounded-xs shrink-0"
                  style={{ backgroundColor: entry.color || entry.fill || '#7C5CFF' }}
                />
                <span>{entry.name}:</span>
              </div>
              <span className="font-mono font-semibold text-[#F4F4F5] tabular-nums">
                {typeof val === 'number' ? val.toLocaleString() : val}
                {unit}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Custom white percentage label renderer inside Pie/Donut slices (Section 2.5).
 */
export function renderDonutPercentageLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}) {
  if (!percent || percent < 0.06) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.52;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="#F4F4F5"
      textAnchor="middle"
      dominantBaseline="central"
      className="text-[10px] font-mono font-semibold pointer-events-none"
    >
      {`${Math.round(percent * 100)}%`}
    </text>
  );
}

