// ============================================================
// 通用格式化工具 · 按 CountryProfile 渲染
// 货币格式化委托给 profile.currency（每个国家各自实现 short/full），
// 日期格式化按 profile.dateFmt 模板渲染，页面百分比/进度为通用逻辑。
// ============================================================
import type { CountryProfile } from '../profiles/types'

/** 简写金额（亿/百万/K + 币种符号），按 profile 货币习惯 */
export function fmtShort(n: number, profile: CountryProfile): string {
  return profile.currency.short(n)
}

/** 完整金额（千分位 + 币种符号），按 profile 货币习惯 */
export function fmtFull(n: number, profile: CountryProfile): string {
  return profile.currency.full(n)
}

/** 币种代码（'VND'），用于表头/卡片单位 */
export function currencyCode(profile: CountryProfile): string {
  return profile.currency.code
}

/**
 * 按 profile.dateFmt 格式化日期字符串（'yyyy-MM-dd' | 'dd/MM/yyyy' ...）。
 * 输入 'YYYY-MM-DD'（或含时间戳），输出按目标模板重排。
 */
export function fmtDate(dateStr: string | undefined | null, profile: CountryProfile): string {
  if (!dateStr) return '—'
  const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return String(dateStr)
  const [, y, mo, d] = m
  return profile.dateFmt
    .replace('yyyy', y)
    .replace('MM', mo)
    .replace('dd', d)
}

/** 百分比 */
export function pct(n: number, digits = 2): string {
  return `${n.toFixed(digits)}%`
}

/** 对账期显示（用于 Header 徽标） */
export function periodLabel(profile: CountryProfile): string {
  return `${profile.countryZh} · ${profile.period}`
}
