/**
 * 星渊仙途 - ScientificNumber 大数工具类
 *
 * 内部存储：mantissa × 10^exponent，mantissa ∈ [1, 10)
 * 用于无尽模式等数值可能溢出 JS 安全整数范围的场景。
 *
 * 设计参考：设计方案/补充-数值公式统一.md 第十一章
 */

export interface SciNum {
  mantissa: number;
  exponent: number;
  sign: -1 | 1;
  isZero: boolean;
}

// ==================== 构造 ====================

/** 创建零 */
export function sciZero(): SciNum {
  return { mantissa: 1, exponent: 0, sign: 1, isZero: true };
}

/** 从普通 number 创建 */
export function sciFrom(n: number): SciNum {
  if (n === 0) return sciZero();
  const sign: -1 | 1 = n < 0 ? -1 : 1;
  const abs = Math.abs(n);
  const exponent = Math.floor(Math.log10(abs));
  const mantissa = abs / Math.pow(10, exponent);
  return { mantissa, exponent, sign, isZero: false };
}

/** 从 mantissa + exponent 直接创建 */
export function sciOf(mantissa: number, exponent: number, sign: -1 | 1 = 1): SciNum {
  if (mantissa === 0) return sciZero();
  return { mantissa, exponent, sign, isZero: false };
}

// ==================== 转换 ====================

/** 将 number 或 SciNum 统一转为 SciNum */
export function toSci(n: number | SciNum): SciNum {
  if (typeof n === 'number') return sciFrom(n);
  return n;
}

/** 转为普通 number（溢出时截断到 MAX_SAFE_INTEGER） */
export function sciToNumber(s: SciNum): number {
  if (s.isZero) return 0;
  const val = s.mantissa * Math.pow(10, s.exponent);
  const result = s.sign * val;
  // 溢出保护
  if (!isFinite(result)) return s.sign * Number.MAX_SAFE_INTEGER;
  return result;
}

/** 判断是否需要切换到 ScientificNumber（阈值 1e14） */
export function needsSci(n: number): boolean {
  return Math.abs(n) >= 1e14;
}

// ==================== 算术运算 ====================

/** 规范化：确保 mantissa ∈ [1, 10) */
function normalize(s: SciNum): SciNum {
  if (s.isZero) return s;
  let m = s.mantissa;
  let e = s.exponent;

  if (m === 0) return sciZero();

  // 处理 Infinity（幂运算可能溢出）
  if (!isFinite(m)) {
    return { mantissa: 1, exponent: 308, sign: s.sign, isZero: false };
  }

  const absM = Math.abs(m);
  if (absM >= 10) {
    const shift = Math.floor(Math.log10(absM));
    m = m / Math.pow(10, shift);
    e += shift;
  } else if (absM < 1) {
    const shift = Math.floor(-Math.log10(absM)) + 1;
    m = m * Math.pow(10, shift);
    e -= shift;
  }

  return { mantissa: m, exponent: e, sign: s.sign, isZero: false };
}

/** 加法 */
export function sciAdd(a: SciNum, b: SciNum): SciNum {
  if (a.isZero) return b;
  if (b.isZero) return a;

  // 符号相同
  if (a.sign === b.sign) {
    return normalize(sciAddAbs(a, b, a.sign));
  }

  // 符号不同：转为减法
  const cmp = compareAbs(a, b);
  if (cmp === 0) return sciZero();
  if (cmp > 0) {
    return normalize(sciSubAbs(a, b, a.sign));
  } else {
    return normalize(sciSubAbs(b, a, b.sign));
  }
}

/** 减法 */
export function sciSub(a: SciNum, b: SciNum): SciNum {
  const negB: SciNum = { ...b, sign: b.isZero ? 1 : (b.sign === 1 ? -1 : 1) };
  return sciAdd(a, negB);
}

/** 乘法 */
export function sciMul(a: SciNum, b: SciNum): SciNum {
  if (a.isZero || b.isZero) return sciZero();
  return normalize({
    mantissa: a.mantissa * b.mantissa,
    exponent: a.exponent + b.exponent,
    sign: (a.sign === b.sign ? 1 : -1) as -1 | 1,
    isZero: false,
  });
}

/** 除法 */
export function sciDiv(a: SciNum, b: SciNum): SciNum {
  if (b.isZero) throw new Error('Division by zero');
  if (a.isZero) return sciZero();
  return normalize({
    mantissa: a.mantissa / b.mantissa,
    exponent: a.exponent - b.exponent,
    sign: (a.sign === b.sign ? 1 : -1) as -1 | 1,
    isZero: false,
  });
}

/** 幂运算（exponent 为正整数） */
export function sciPow(base: SciNum, exp: number): SciNum {
  if (exp === 0) return sciFrom(1);
  if (base.isZero) return sciZero();
  if (exp === 1) return base;

  // 使用指数对数法：(m × 10^e)^n = m^n × 10^(e×n)
  const newExp = base.exponent * exp;
  const newMantissa = Math.pow(base.mantissa, exp);

  // 如果 mantissa 溢出，需要规范化
  return normalize({
    mantissa: newMantissa,
    exponent: newExp,
    sign: exp % 2 === 0 ? 1 : base.sign,
    isZero: false,
  });
}

// ==================== 比较 ====================

/** 比较绝对值大小（返回 -1/0/1） */
function compareAbs(a: SciNum, b: SciNum): number {
  if (a.isZero && b.isZero) return 0;
  if (a.isZero) return -1;
  if (b.isZero) return 1;

  if (a.exponent !== b.exponent) {
    return a.exponent > b.exponent ? 1 : -1;
  }
  if (a.mantissa !== b.mantissa) {
    return a.mantissa > b.mantissa ? 1 : -1;
  }
  return 0;
}

/** 比较（返回 -1/0/1） */
export function sciCompare(a: SciNum, b: SciNum): number {
  if (a.isZero && b.isZero) return 0;
  if (a.sign !== b.sign) return a.sign;
  const absCmp = compareAbs(a, b);
  return a.sign === 1 ? absCmp : -absCmp;
}

/** 等于 */
export function sciEq(a: SciNum, b: SciNum): boolean {
  return sciCompare(a, b) === 0;
}

/** 大于 */
export function sciGt(a: SciNum, b: SciNum): boolean {
  return sciCompare(a, b) > 0;
}

/** 小于 */
export function sciLt(a: SciNum, b: SciNum): boolean {
  return sciCompare(a, b) < 0;
}

/** 大于等于 */
export function sciGte(a: SciNum, b: SciNum): boolean {
  return sciCompare(a, b) >= 0;
}

/** 小于等于 */
export function sciLte(a: SciNum, b: SciNum): boolean {
  return sciCompare(a, b) <= 0;
}

// ==================== 内部运算 ====================

/** 绝对值加法（假设同号） */
function sciAddAbs(a: SciNum, b: SciNum, sign: -1 | 1): SciNum {
  // 对齐指数
  const maxExp = Math.max(a.exponent, b.exponent);
  const aMant = a.mantissa * Math.pow(10, a.exponent - maxExp);
  const bMant = b.mantissa * Math.pow(10, b.exponent - maxExp);

  return { mantissa: aMant + bMant, exponent: maxExp, sign, isZero: false };
}

/** 绝对值减法（假设 |a| > |b|） */
function sciSubAbs(a: SciNum, b: SciNum, sign: -1 | 1): SciNum {
  const maxExp = Math.max(a.exponent, b.exponent);
  const aMant = a.mantissa * Math.pow(10, a.exponent - maxExp);
  const bMant = b.mantissa * Math.pow(10, b.exponent - maxExp);

  const result = aMant - bMant;
  if (result === 0) return sciZero();
  return { mantissa: result, exponent: maxExp, sign, isZero: false };
}

// ==================== 显示 ====================

/** 格式化为 UI 显示字符串 */
export function sciDisplay(s: SciNum, decimals = 2): string {
  if (s.isZero) return '0';

  const signStr = s.sign === -1 ? '-' : '';
  const e = s.exponent;

  if (e < 4) {
    // 普通数字
    const val = sciToNumber(s);
    return signStr + formatNumber(val, decimals);
  } else if (e < 8) {
    // 万
    const val = s.mantissa * Math.pow(10, e - 4);
    return signStr + val.toFixed(decimals) + '万';
  } else if (e < 12) {
    // 亿
    const val = s.mantissa * Math.pow(10, e - 8);
    return signStr + val.toFixed(decimals) + '亿';
  } else if (e < 16) {
    // 兆
    const val = s.mantissa * Math.pow(10, e - 12);
    return signStr + val.toFixed(decimals) + '兆';
  } else {
    // 科学计数法
    return signStr + s.mantissa.toFixed(decimals) + 'e' + e;
  }
}

/** 普通数字格式化（带千分位） */
function formatNumber(n: number, decimals: number): string {
  if (Number.isInteger(n) && decimals === 0) {
    return n.toLocaleString('zh-CN');
  }
  return n.toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

/** 快捷显示：自动选择普通 number 或 SciNum 格式 */
export function displayValue(n: number | SciNum, decimals = 0): string {
  if (typeof n === 'number') {
    if (needsSci(n)) {
      return sciDisplay(sciFrom(n), decimals);
    }
    return formatNumber(n, decimals);
  }
  return sciDisplay(n, decimals);
}
