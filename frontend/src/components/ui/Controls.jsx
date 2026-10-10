import React from 'react';

/**
 * Reusable dark Button component with primary, secondary, danger, and ghost variants.
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  disabled = false,
  type = 'button',
  className = '',
  onClick,
  ...rest
}) {
  const variants = {
    primary: 'ui-btn-primary',
    secondary: 'ui-btn-secondary',
    danger:
      'bg-[#EF4444]/15 hover:bg-[#EF4444]/25 text-[#EF4444] border border-[#EF4444]/35 rounded-lg font-medium transition-colors',
    ghost:
      'bg-transparent hover:bg-[#16161A] text-[#A1A1AA] hover:text-[#F4F4F5] border border-transparent rounded-lg font-medium transition-colors',
  };

  const sizes = {
    xs: 'px-2.5 py-1 text-[11px]',
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-xs',
    lg: 'px-5 py-2.5 text-sm',
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 ${
        variants[variant] || variants.primary
      } ${sizes[size] || sizes.md} disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...rest}
    >
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
      {children}
    </button>
  );
}

/**
 * Reusable dark Input component (#0E0E11 background, #1F1F25 border, violet focus ring).
 */
export function Input({
  label,
  hint,
  error,
  icon: Icon,
  className = '',
  containerClassName = '',
  ...rest
}) {
  return (
    <div className={containerClassName}>
      {label && (
        <label className="block text-[11px] font-medium text-[#A1A1AA] mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon className="w-3.5 h-3.5 text-[#6B6B76] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        )}
        <input
          className={`ui-input w-full ${
            Icon ? 'pl-8 pr-3' : 'px-3'
          } py-2 text-xs text-[#F4F4F5] placeholder-[#6B6B76] ${
            error ? 'border-[#EF4444]' : ''
          } ${className}`}
          {...rest}
        />
      </div>
      {hint && !error && (
        <p className="text-[10px] text-[#6B6B76] mt-1">{hint}</p>
      )}
      {error && <p className="text-[10px] text-[#EF4444] mt-1">{error}</p>}
    </div>
  );
}

/**
 * Reusable dark Select component (#0E0E11 background, #1F1F25 border, violet focus ring).
 */
export function Select({
  label,
  options = [],
  children,
  className = '',
  containerClassName = '',
  ...rest
}) {
  return (
    <div className={containerClassName}>
      {label && (
        <label className="block text-[11px] font-medium text-[#A1A1AA] mb-1">
          {label}
        </label>
      )}
      <select
        className={`ui-input w-full px-3 py-2 text-xs text-[#F4F4F5] bg-[#0E0E11] ${className}`}
        {...rest}
      >
        {children
          ? children
          : options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
      </select>
    </div>
  );
}

/**
 * Reusable dark Toggle switch component (#7C5CFF active state, #1F1F25 inactive state).
 */
export function Toggle({
  checked = false,
  onChange,
  label,
  description,
  disabled = false,
  className = '',
}) {
  return (
    <label
      className={`inline-flex items-start gap-3 ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${className}`}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange && onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#7C5CFF]/40 ${
          checked
            ? 'bg-[#7C5CFF] border-[#7C5CFF]'
            : 'bg-[#0E0E11] border-[#2A2A32]'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-[#F4F4F5] shadow-xs transition duration-150 ease-in-out mt-0.5 ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
      {(label || description) && (
        <div className="min-w-0">
          {label && (
            <div className="text-xs font-medium text-[#F4F4F5] select-none">
              {label}
            </div>
          )}
          {description && (
            <div className="text-[11px] text-[#6B6B76] mt-0.5 leading-relaxed">
              {description}
            </div>
          )}
        </div>
      )}
    </label>
  );
}

/**
 * Reusable dark ProgressBar component with configurable color and optional label.
 */
export function ProgressBar({
  value = 0,
  max = 100,
  color = '#7C5CFF',
  heightClass = 'h-2',
  showLabel = false,
  label,
  className = '',
}) {
  const safeMax = max > 0 ? max : 100;
  const pct = Math.max(0, Math.min(100, (Number(value || 0) / safeMax) * 100));

  return (
    <div className={`w-full ${className}`}>
      {(showLabel || label) && (
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="text-[#A1A1AA]">{label || 'Progress'}</span>
          <span className="font-mono text-[#F4F4F5] tabular-nums">
            {Math.round(pct)}%
          </span>
        </div>
      )}
      <div
        className={`w-full ${heightClass} bg-[#0E0E11] rounded-full overflow-hidden border border-[#1F1F25]`}
      >
        <div
          className="h-full rounded-full transition-all duration-200"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

