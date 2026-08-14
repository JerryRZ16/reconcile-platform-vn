// ============================================================
// 四类映射 · 纯逻辑层（可单测，无 React 依赖）
// 直接映射 / 表达式转译 / 门店编码映射 / 三元组 的变换与预览计算。
// ============================================================

// ---------- 表达式转译算子 ----------
export type ExpressionOp = 'none' | 'code_map' | 'scale' | 'date_fmt' | 'trim'

export interface ExpressionConfig {
  op: ExpressionOp
  from: string                       // 源列
  map?: Record<string, string>       // code_map：码值映射表
  scale?: number                     // scale：数值缩放（如金额 分/100）
  dateFrom?: string                  // date_fmt：输入格式模板
  dateTo?: string                    // date_fmt：输出格式模板
  label?: string                     // 算子中文说明
}

// ---------- 门店编码映射 ----------
export type StoreRule = 'raw' | 'strip_leading_zero' | 'pad'

export interface StoreCodeConfig {
  from: string                       // 源列
  rule: StoreRule                    // 归一化规则
  padWidth?: number                  // pad：补零宽度
  dict?: Record<string, string>      // 可选门店编码字典（raw → norm）
}

// ---------- 三元组（门店+金额+时间 组合键） ----------
export interface TripletConfig {
  storeField: string
  amountField: string
  timeField: string
  toleranceMin: number               // 时间容差 ±N 分钟
  label?: string
}

/** 每行映射类型 */
export type MappingType = 'direct' | 'expression' | 'storecode' | 'triplet'

// ---------- 码值映射表文本 <-> 对象 ----------
export function parseCodeMapText(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t) continue
    const m = t.match(/^([^:：=\s]+)\s*[:：=]\s*(.+)$/)
    if (m) out[m[1].trim()] = m[2].trim()
    else out[t] = t
  }
  return out
}

export function codeMapToText(map: Record<string, string>): string {
  return Object.entries(map).map(([k, v]) => `${k}: ${v}`).join('\n')
}

// ---------- 日期格式转换 ----------
// 输入 'YYYY-MM-DD'（或 'yyyy/MM/dd'、'dd/MM/yyyy' 等），按 from/to 模板重排。
// 模板支持 token：yyyy | MM | dd | HH | mm
function extractDate(raw: string, fmt: string): Record<string, string> | null {
  const esc = fmt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const toks = ['yyyy', 'MM', 'dd', 'HH', 'mm']
  let re = '^'
  let i = 0
  const groups: string[] = []
  while (i < fmt.length) {
    const hit = toks.find((t) => fmt.startsWith(t, i))
    if (hit) {
      const width = hit === 'yyyy' ? 4 : 2
      re += `(\\d{${width}})`
      groups.push(hit)
      i += hit.length
    } else {
      re += esc[i]
      i++
    }
  }
  re += '$'
  const m = raw.trim().match(new RegExp(re))
  if (!m) return null
  const out: Record<string, string> = {}
  groups.forEach((g, idx) => { out[g] = m[idx + 1] })
  return out
}

export function convertDate(raw: string, fromFmt: string, toFmt: string): string {
  if (!raw) return ''
  const parts = extractDate(raw, fromFmt || 'yyyy-MM-dd')
  if (!parts) return raw
  const toks = ['yyyy', 'MM', 'dd', 'HH', 'mm']
  let out = toFmt
  for (const t of toks) {
    if (parts[t]) out = out.replaceAll(t, parts[t])
  }
  return out
}

// ---------- 表达式转译执行 ----------
export function applyExpression(raw: string, cfg: ExpressionConfig): string {
  switch (cfg.op) {
    case 'code_map': {
      const mapped = cfg.map?.[raw]
      return mapped != null ? mapped : raw
    }
    case 'scale': {
      const n = parseFloat(raw)
      if (!Number.isFinite(n)) return raw
      const s = cfg.scale && cfg.scale > 0 ? cfg.scale : 1
      const v = n / s
      return Number.isInteger(v) ? String(v) : v.toFixed(2)
    }
    case 'date_fmt':
      return convertDate(raw, cfg.dateFrom || 'yyyy-MM-dd', cfg.dateTo || 'yyyy-MM-dd')
    case 'trim':
      return raw.trim()
    case 'none':
    default:
      return raw
  }
}

// ---------- 门店编码归一化执行 ----------
export function applyStoreCode(raw: string, cfg: StoreCodeConfig): string {
  if (!raw) return ''
  if (cfg.dict && cfg.dict[raw] != null) return cfg.dict[raw]
  const m = raw.match(/^(\D*)(\d+)$/)
  if (!m) return raw
  const [, prefix, numStr] = m
  const num = parseInt(numStr, 10)
  switch (cfg.rule) {
    case 'strip_leading_zero':
      return `${prefix}${num}`
    case 'pad':
      return `${prefix}${String(num).padStart(cfg.padWidth || 4, '0')}`
    case 'raw':
    default:
      return raw
  }
}

// ---------- 每行预览计算（读前 3 行样例） ----------
export interface PreviewSample {
  raw: string
  result: string
  ok: boolean
}

/** 给定样例行 + 映射配置，计算预览值（单行） */
export function previewRow(row: Record<string, string>, type: MappingType, cfg: unknown): PreviewSample {
  switch (type) {
    case 'direct': {
      const raw = row[cfg as string] ?? ''
      return { raw, result: raw, ok: raw !== '' }
    }
    case 'expression': {
      const e = cfg as ExpressionConfig
      const raw = row[e.from] ?? ''
      return { raw, result: applyExpression(raw, e), ok: raw !== '' }
    }
    case 'storecode': {
      const s = cfg as StoreCodeConfig
      const raw = row[s.from] ?? ''
      return { raw, result: applyStoreCode(raw, s), ok: raw !== '' }
    }
    case 'triplet': {
      const t = cfg as TripletConfig
      const s = row[t.storeField] ?? ''
      const a = row[t.amountField] ?? ''
      const tm = row[t.timeField] ?? ''
      const ok = s !== '' && a !== '' && tm !== ''
      return {
        raw: `${s} · ${a} · ${tm}`,
        result: ok ? `三元组匹配 ✓（容差 ±${t.toleranceMin}min）` : '缺字段，无法组成三元组',
        ok,
      }
    }
    default:
      return { raw: '', result: '', ok: false }
  }
}

/** 该行是否已完整配置（用于必填校验） */
export function isRowConfigured(type: MappingType, cfg: unknown): boolean {
  switch (type) {
    case 'direct':
      return Boolean(cfg && String(cfg).trim() !== '')
    case 'expression': {
      const e = cfg as ExpressionConfig
      return Boolean(e?.from && e?.op && e.op !== 'none')
    }
    case 'storecode': {
      const s = cfg as StoreCodeConfig
      return Boolean(s?.from && s?.rule)
    }
    case 'triplet': {
      const t = cfg as TripletConfig
      return Boolean(t?.storeField && t?.amountField && t?.timeField)
    }
    default:
      return false
  }
}
