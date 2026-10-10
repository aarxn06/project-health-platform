/**
 * Formatting and semantic evaluation utilities for software engineering metrics.
 * Never assumes that reducing every metric is necessarily an improvement.
 */

export function formatTimestamp(isoStr, short = false) {
  if (!isoStr) return 'N/A';
  const clean = isoStr.slice(0, 19).replace('T', ' ');
  return short ? clean.slice(5, 16) : `${clean} UTC`;
}

export function formatNumber(val, decimals = 0) {
  if (val === null || val === undefined || Number.isNaN(Number(val))) return 'Not available';
  const num = Number(val);
  if (decimals === 0) return Math.round(num).toLocaleString();
  return num.toFixed(decimals);
}

/**
 * Determine whether a numeric change (delta) is an improvement, worsening, or neutral
 * based on the specific metric's documented directionality.
 *
 * @param {number} delta - New value minus previous value
 * @param {'higher_is_better' | 'lower_is_better' | 'neutral'} direction
 * @returns {'improved' | 'worsened' | 'neutral' | 'unchanged'}
 */
export function evaluateMetricDelta(delta, direction = 'higher_is_better') {
  if (delta === null || delta === undefined || Number.isNaN(Number(delta))) return 'unchanged';
  const d = Number(delta);
  if (Math.abs(d) < 0.001) return 'unchanged';
  if (direction === 'neutral') return 'neutral';
  if (direction === 'higher_is_better') {
    return d > 0 ? 'improved' : 'worsened';
  }
  if (direction === 'lower_is_better') {
    return d < 0 ? 'improved' : 'worsened';
  }
  return 'neutral';
}

/**
 * Map a 0-100 health or maintainability score to a status level and 1-4 segmented blocks.
 */
export function getScoreStatusLevel(score) {
  if (score === null || score === undefined || Number.isNaN(Number(score))) {
    return { label: 'Not available', variant: 'muted', blocks: 0 };
  }
  const s = Number(score);
  if (s >= 80) return { label: 'Excellent', variant: 'success', blocks: 4 };
  if (s >= 65) return { label: 'Good', variant: 'blue', blocks: 3 };
  if (s >= 45) return { label: 'Fair', variant: 'yellow', blocks: 2 };
  return { label: 'Poor', variant: 'danger', blocks: 1 };
}

/**
 * Map Comment Ratio (%) to a status level and 1-4 segmented blocks.
 */
export function getCommentRatioStatusLevel(ratioPct) {
  if (ratioPct === null || ratioPct === undefined || Number.isNaN(Number(ratioPct))) {
    return { label: 'Not available', variant: 'muted', blocks: 0 };
  }
  const r = Number(ratioPct);
  if (r >= 15) return { label: 'Excellent', variant: 'success', blocks: 4 };
  if (r >= 10) return { label: 'Good', variant: 'blue', blocks: 3 };
  if (r >= 5) return { label: 'Fair', variant: 'yellow', blocks: 2 };
  return { label: 'Poor', variant: 'danger', blocks: 1 };
}

/**
 * Map Average Coupling (fan-out) to a status level and 1-4 segmented blocks (lower coupling is healthier).
 */
export function getCouplingStatusLevel(avgCoupling) {
  if (avgCoupling === null || avgCoupling === undefined || Number.isNaN(Number(avgCoupling))) {
    return { label: 'Not available', variant: 'muted', blocks: 0 };
  }
  const c = Number(avgCoupling);
  if (c <= 4.0) return { label: 'Excellent', variant: 'success', blocks: 4 };
  if (c <= 7.5) return { label: 'Good', variant: 'blue', blocks: 3 };
  if (c <= 11.0) return { label: 'Fair', variant: 'yellow', blocks: 2 };
  return { label: 'Poor', variant: 'danger', blocks: 1 };
}

/**
 * Map Parse Failures count to a status level and 1-4 segmented blocks (0 failures is Excellent).
 */
export function getParseFailureStatusLevel(failedFiles, totalFiles) {
  if (failedFiles === null || failedFiles === undefined || !totalFiles) {
    return { label: 'Not available', variant: 'muted', blocks: 0 };
  }
  const f = Number(failedFiles);
  if (f === 0) return { label: 'Excellent', variant: 'success', blocks: 4 };
  const ratio = f / Math.max(totalFiles, 1);
  if (ratio <= 0.05) return { label: 'Good', variant: 'blue', blocks: 3 };
  if (ratio <= 0.15) return { label: 'Fair', variant: 'yellow', blocks: 2 };
  return { label: 'Poor', variant: 'danger', blocks: 1 };
}

