// ============================================================
// 上传文件解析库 · CSV / XLSX 表头与样例预览
// - papaparse（CSV）与 xlsx（SheetJS）为「可选依赖」：已安装则动态 import 真实解析；
//   未安装时 CSV 降级为内置轻量解析器（保留表头/样例能力），XLSX 提示需安装依赖。
// - 统一输出 ParsedSheet = { columns, sampleRows, rowCount }，供 StepUpload 表头预览、
//   StepMapping 源列候选与映射结果实时预览消费。
// - 安全：仅读取用户所选文件（内存中解析），不做大文件全量加载；样例固定前 5 行。
// ============================================================

/** 解析结果：表头 + 前 N 行样例 + 行列数 */
export interface ParsedSheet {
  file: string
  ext: string
  columns: string[]           // 表头列名（去重、去空）
  sampleRows: Record<string, string>[]  // 前 N 行样例（对象映射，列名→值）
  rowCount: number            // 已统计的数据行数（样例行数或全部）
  source: 'papaparse' | 'xlsx' | 'builtin-csv' | 'unparsed'
  error?: string              // 解析失败信息
}

export const MAX_SAMPLE_ROWS = 5   // 样例预览行数
export const MAX_FILE_SIZE = 200 * 1024 * 1024  // ≤200MB（分片/增量追加后单文件上限）

/**
 * 可选依赖的动态导入：用 new Function 间接构造 import 表达式，
 * 使 vite/rollup 静态分析无法解析到该模块（未安装时运行时 catch 兜底，不报构建错）。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function importAny(specifier: string): Promise<any> {
  // eslint-disable-next-line no-new-func
  const doImport = new Function('s', 'return import(s)')
  return doImport(specifier)
}

/** 去除表头中的 BOM / 空白 / 重复列名 */
function cleanHeaders(raw: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const r of raw) {
    let c = String(r ?? '').trim().replace(/^\uFEFF/, '')
    if (!c) continue
    if (seen.has(c)) {  // 重名列加后缀，避免对象 key 冲突
      let i = 2
      while (seen.has(`${c}_${i}`)) i++
      c = `${c}_${i}`
    }
    seen.add(c)
    out.push(c)
  }
  return out
}

/** 裁剪对象到仅包含给定列（保证每行 key 与 columns 一致） */
function pickColumns(row: Record<string, unknown>, columns: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const c of columns) {
    const v = row[c]
    out[c] = v == null ? '' : String(v)
  }
  return out
}

/** 内置轻量 CSV 解析（兼容引号与换行；未安装 papaparse 时兜底） */
function parseCsvBuiltin(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++ }
        else inQuotes = false
      } else cur += ch
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(cur); cur = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cur); cur = ''
      if (row.some((c) => c.trim() !== '') || row.length > 1) rows.push(row)
      row = []
    } else {
      cur += ch
    }
  }
  row.push(cur)
  if (row.some((c) => c.trim() !== '') || row.length > 1) rows.push(row)
  return rows
}

/** 把 CSV 文本解析为结构化表格 */
export function parseCsvText(text: string): { rows: string[][]; errors: string[] } {
  try {
    // 内置轻量解析器（未安装 papaparse 时的兜底路径）
    return { rows: parseCsvBuiltin(text), errors: [] }
  } catch (e) {
    return { rows: [], errors: [(e as Error).message || 'CSV 解析失败'] }
  }
}

/**
 * 解析上传的 File 对象，产出表头 + 样例。
 * CSV：尝试 papaparse（可选依赖），未安装则内置解析器。
 * XLSX：尝试 xlsx（SheetJS，可选依赖），未安装则返回 unparsed 并提示。
 */
export async function parseFile(file: File): Promise<ParsedSheet> {
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  const base: ParsedSheet = {
    file: file.name,
    ext,
    columns: [],
    sampleRows: [],
    rowCount: 0,
    source: 'unparsed',
  }

  // ---------- CSV ----------
  if (ext === 'csv') {
    const text = await file.text()
    // 尝试 papaparse（可选依赖）
    try {
      const pp = await importAny('papaparse')
      const lib: any = (pp as any).default || pp
      const res: { data: unknown[]; meta?: { fields?: unknown }; errors?: unknown[] } = lib.parse
        ? lib.parse(text, {
            header: true,
            skipEmptyLines: 'greedy',
            transformHeader: (h: string) => String(h).trim().replace(/^\uFEFF/, ''),
          })
        : { data: parseCsvText(text).rows, errors: [] }
      const fields = (res.meta?.fields as string[]) || []
      const columns = cleanHeaders(fields)
      const sampleRows = (res.data as Record<string, unknown>[])
        .slice(0, MAX_SAMPLE_ROWS)
        .map((r: Record<string, unknown>) => pickColumns(r, columns))
      return {
        ...base,
        columns,
        sampleRows,
        rowCount: res.data.length,
        source: 'papaparse',
        error: res.errors?.length ? `${res.errors.length} 行解析告警（已尽力兼容）` : undefined,
      }
    } catch {
      // 未安装 papaparse → 内置解析器兜底
      const { rows } = parseCsvText(text)
      const [head = [], ...body] = rows
      const columns = cleanHeaders(head)
      const sampleRows = body.slice(0, MAX_SAMPLE_ROWS).map((vals) => {
        const o: Record<string, string> = {}
        columns.forEach((c, i) => { o[c] = vals[i] ?? '' })
        return o
      })
      return {
        ...base,
        columns,
        sampleRows,
        rowCount: body.length,
        source: 'builtin-csv',
      }
    }
  }

  // ---------- XLSX ----------
  if (ext === 'xlsx' || ext === 'xls') {
    try {
      const XLSX = await importAny('xlsx')
      const lib: any = (XLSX as any).default || (XLSX as any)
      const buf = await file.arrayBuffer()
      const wb = lib.read(buf, { type: 'array' })
      const ws = wb.Sheets?.[wb.SheetNames?.[0]]
      if (!ws) return { ...base, error: 'Excel 文件无工作表' }
      const json: Record<string, unknown>[] = lib.utils.sheet_to_json(ws, {
        defval: '',
        raw: false,
        blankrows: false,
      })
      const columns = cleanHeaders(Object.keys(json[0] || {}))
      const sampleRows = json.slice(0, MAX_SAMPLE_ROWS).map((r: Record<string, unknown>) => pickColumns(r, columns))
      return {
        ...base,
        columns,
        sampleRows,
        rowCount: json.length,
        source: 'xlsx',
      }
    } catch {
      return {
        ...base,
        error: '解析 Excel 需要安装依赖：npm i xlsx（SheetJS）。当前未安装，无法预览表头。',
      }
    }
  }

  return { ...base, error: `不支持的文件类型：.${ext}` }
}

/** 大小/类型/归属校验（返回错误信息，空串表示通过） */
export function validateFile(file: File, slotHint?: string[]): string {
  const name = file.name
  const lower = name.toLowerCase()
  if (!/\.(csv|xlsx?)$/.test(lower)) return '仅支持 CSV / Excel 文件'
  if (file.size > MAX_FILE_SIZE) return `文件超过 200MB 限制（当前 ${(file.size / 1024 / 1024).toFixed(1)}MB）`
  if (slotHint && slotHint.length) {
    const ok = slotHint.some((h) => lower.includes(h.toLowerCase()))
    if (!ok) return `文件名似乎与目标槽位不匹配（提示：需包含 ${slotHint.join(' / ')}）`
  }
  return ''
}

/** 基于表头做列名模糊匹配候选（用于表达式/三元组源列自动推荐） */
export function matchColumn(columns: string[], keywords: string[]): string | undefined {
  const norm = (s: string) => s.toLowerCase().replace(/[\s_\-./]/g, '')
  const target = keywords.map(norm)
  return columns.find((c) => target.some((t) => norm(c).includes(t)))
}
