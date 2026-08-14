// ============================================================
// 可选解析依赖的 ambient 类型声明
// papaparse（CSV）与 xlsx（SheetJS）为「可选依赖」：
// 已安装 → 动态 import 真实解析；未安装 → 运行时降级（CSV 用内置轻量解析器，
// XLSX 提示需安装）。这里仅提供最小类型让 tsc 通过，不强制安装。
// 未来 npm i papaparse @types/papaparse xlsx 后由 node_modules 真实类型接管。
// ============================================================
declare module 'papaparse' {
  export interface ParseMeta {
    delimiter?: string
    fields?: string[]
    aborted?: boolean
  }
  export interface ParseError {
    message?: string
    row?: number
  }
  export interface ParseResult<T = unknown> {
    data: T[]
    errors: ParseError[]
    meta: ParseMeta
  }
  export interface ParseConfig {
    header?: boolean
    skipEmptyLines?: boolean | 'greedy'
    [k: string]: unknown
  }
  export function parse<T = unknown>(text: string, config?: ParseConfig): ParseResult<T>
}

declare module 'xlsx' {
  export interface WorkSheet {
    '!ref'?: string
    [cell: string]: unknown
  }
  export interface WorkBook {
    SheetNames: string[]
    Sheets: Record<string, WorkSheet>
  }
  export interface ParsingOptions {
    type?: 'array' | 'base64' | 'binary' | 'buffer' | 'file' | 'string'
    raw?: boolean
    [k: string]: unknown
  }
  export interface Sheet2JSONOpts {
    header?: 1 | 'A' | string[]
    raw?: boolean
    defval?: unknown
    blankrows?: boolean
    [k: string]: unknown
  }
  export function read(data: ArrayBuffer | unknown, opts?: ParsingOptions): WorkBook
  export const utils: {
    sheet_to_json<T = unknown>(ws: WorkSheet, opts?: Sheet2JSONOpts): T[]
  }
}
