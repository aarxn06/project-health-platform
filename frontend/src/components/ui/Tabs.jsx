import React from 'react';

/**
 * Reusable dark Tabs component with violet active indicator and optional count badges.
 */
export function Tabs({
  tabs = [],
  activeTab,
  onChange,
  size = 'sm',
  className = '',
}) {
  const paddingClass = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-xs';

  return (
    <div
      role="tablist"
      className={`inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#0E0E11] border border-[#1F1F25] ${className}`}
    >
      {(tabs || []).map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange && onChange(tab.id)}
            className={`inline-flex items-center gap-1.5 rounded-md font-medium transition-all duration-150 ${paddingClass} ${
              isActive
                ? 'bg-[#7C5CFF]/15 text-[#F4F4F5] border border-[#7C5CFF]/40 shadow-xs'
                : 'text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#16161A] border border-transparent'
            }`}
          >
            {Icon && (
              <Icon
                className={`w-3.5 h-3.5 ${
                  isActive ? 'text-[#7C5CFF]' : 'text-[#6B6B76]'
                }`}
              />
            )}
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count !== null && (
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] font-mono tabular-nums ${
                  isActive
                    ? 'bg-[#7C5CFF]/25 text-[#F4F4F5]'
                    : 'bg-[#16161A] text-[#6B6B76]'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

