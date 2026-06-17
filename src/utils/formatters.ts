/**
 * 星渊仙途 - 数值格式化工具
 *
 * 大数显示（K/M/B/T）、百分比显示、时间格式化
 */

/**
 * 格式化大数字
 */
export function formatNumber(n: number, decimals = 0): string {
  if (!isFinite(n)) return '∞';
  if (n < 0) return '-' + formatNumber(-n, decimals);

  if (n < 1000) {
    return decimals > 0 ? n.toFixed(decimals) : Math.floor(n).toString();
  }

  const suffixes = ['', 'K', 'M', 'B', 'T'];
  const tier = Math.floor(Math.log10(n) / 3);

  if (tier >= suffixes.length) {
    return n.toExponential(decimals);
  }

  const suffix = suffixes[tier] ?? '';
  const scale = Math.pow(10, tier * 3);
  const scaled = n / scale;

  return scaled.toFixed(decimals) + suffix;
}

/**
 * 格式化百分比
 */
export function formatPercent(value: number, decimals = 1): string {
  return (value * 100).toFixed(decimals) + '%';
}

/**
 * 格式化时间（秒 → 时:分:秒）
 */
export function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return '∞';
  if (seconds < 0) return '0秒';

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) return `${h}时${m}分${s}秒`;
  if (m > 0) return `${m}分${s}秒`;
  return `${s}秒`;
}

/**
 * 格式化时间（简短版）
 */
export function formatTimeShort(seconds: number): string {
  if (!isFinite(seconds)) return '∞';
  if (seconds < 0) return '0s';

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  if (m > 0) return `${m}:${s.toString().padStart(2, '0')}`;
  return `${s}s`;
}

/**
 * 格式化日期时间戳
 */
export function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString('zh-CN');
}
