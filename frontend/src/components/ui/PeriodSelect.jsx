import React from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * PeriodSelect pill dropdown (Section 2.3):
 * e.g. "Last run", "Last 5 runs", "All runs" styled like a small dark pill with a chevron.
 */
export function PeriodSelect({
  value,
  onChange,
  options = [
    { value: '5', label: 'Last 5 runs' },
    { value: '10', label: 'Last 10 runs' },
    { value: 'all', label: 'All runs' },
  ],
  ariaLabel = 'Select time period or run range',
  className = '',
}) {
  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className="appearance-none bg-[#0E0E11] hover:bg-[#16161A] text-[#A1A1AA] hover:text-[#F4F4F5] border border-[#1F1F25] hover:border-[#2A2A32] focus:border-[#7C5CFF] focus:outline-none rounded-full pl-2.5 pr-6 py-1 text-[11px] font-medium transition-colors cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-[#111114] text-[#F4F4F5]">
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="w-3 h-3 text-[#6B6B76] pointer-events-none absolute right-2" />
    </div>
  );
}

