import React, { useState } from 'react';
import { Info } from 'lucide-react';

/**
 * Reusable dark surface Card component following Section 2.2:
 * background: var(--bg-card), 1px solid var(--border), border-radius: 12px,
 * padding 16-20px, faint inner highlight, optional hover border transition.
 */
export function Card({
  children,
  className = '',
  padding = 'p-4 sm:p-5',
  interactive = false,
  onClick,
  ...rest
}) {
  return (
    <div
      onClick={onClick}
      className={`ui-card ${padding} ${
        interactive ? 'ui-card-interactive cursor-pointer' : ''
      } ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

/**
 * Reusable CardHeader following Section 2.2 & 2.3:
 * Small, uppercase, letter-spaced (11-12px, text-secondary) section title
 * with a small info icon (Lucide Info) that shows a tooltip explaining the metric,
 * plus an optional right-side control (e.g. PeriodSelect or badge).
 */
export function CardHeader({
  title,
  tooltip,
  subtitle,
  icon: Icon,
  rightControl,
  className = 'mb-3.5',
}) {
  const [showTip, setShowTip] = useState(false);

  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 ${className}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          {Icon && <Icon className="w-3.5 h-3.5 text-[#7C5CFF] shrink-0" />}
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[#A1A1AA] select-none">
            {title}
          </h3>
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
                aria-label={`Info about ${title}`}
                className="text-[#6B6B76] hover:text-[#F4F4F5] focus:outline-none focus:text-[#7C5CFF] transition-colors cursor-help"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
              {showTip && (
                <div
                  role="tooltip"
                  className="absolute left-0 top-5 z-50 w-64 p-2.5 rounded-lg bg-[#16161A] border border-[#2A2A32] text-[11px] font-normal normal-case tracking-normal text-[#A1A1AA] leading-relaxed shadow-xl pointer-events-none"
                >
                  {tooltip}
                </div>
              )}
            </div>
          )}
        </div>
        {subtitle && (
          <p className="text-[11px] text-[#6B6B76] mt-0.5 truncate">{subtitle}</p>
        )}
      </div>
      {rightControl && <div className="flex items-center gap-2 shrink-0">{rightControl}</div>}
    </div>
  );
}

