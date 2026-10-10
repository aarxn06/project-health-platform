import React, { useState } from 'react';
import { Info } from 'lucide-react';

/**
 * Reusable dark Tooltip component (#16161A background, 1px #2A2A32 border).
 * Can wrap any trigger element or render a default Info icon trigger.
 */
export function Tooltip({
  content,
  children,
  position = 'top',
  widthClass = 'w-64',
  className = '',
}) {
  const [visible, setVisible] = useState(false);

  if (!content) {
    return children || null;
  }

  const posClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <span
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children || (
        <button
          type="button"
          aria-label="More information"
          className="text-[#6B6B76] hover:text-[#F4F4F5] focus:outline-none focus:text-[#7C5CFF] transition-colors cursor-help"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      )}
      {visible && (
        <span
          role="tooltip"
          className={`absolute z-50 ${posClasses[position] || posClasses.top} ${widthClass} p-2.5 rounded-lg bg-[#16161A] border border-[#2A2A32] text-[11px] font-normal normal-case tracking-normal text-[#A1A1AA] leading-relaxed shadow-2xl pointer-events-none`}
        >
          {content}
        </span>
      )}
    </span>
  );
}

