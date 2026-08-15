// ============================================================
// 对账任务客户端 · 真实后端链路（阶段3）
// ------------------------------------------------------------
// 职责：
//  1. 把「上传文件 + country + 四类映射 JSON」提交后端
//     POST /api/reconcile/upload
//  2. 轮询任务状态 GET /api/reconcile/task/{id}
//  3. 成功后拉取结果 GET /api/reconcile/task/{id}/result
//  4. 后端不可达 / 失败 / 超时 → 降级 profile.demoData()（演示模式）
// ------------------------------------------------------------
// 契约（与阶段3后端交付说明对齐）：
//  - upload 响应：{ task_id, status, ds_id, country, slots_uploaded,
//                  status_url, result_url }
//  - 状态响应   ：{ id, status: pending|running|success|failed,
//                  progress, message, error, result_ref }
//  - 结果响应   ：引擎 run_all 全量（overview/free_refund/channels/
//                  L2_BANK/coverage/dashboard/meta）
//
// ⚠️ 映射序列化策略（防回归）：
//  前端模板的「默认 source 列名」是面向展示的人类化名称（如 'Merchant order
//  number'），并非后端 demo 文件真实表头（如 'oms_order_no'）。直接透传默认
//  模板会覆盖后端 configs/{country}.json 的默认列 → ONLINE/INSTORE 匹配归零。
//  因此本客户端只发送「用户主动改过的映射行」；未改动的行不发送 → 后端回退
//  配置默认列 → 越南 demo 主链路基线保持。该策略已用后端引擎实测验证（见交付说明）。
// ============================================================
import type { CountryProfile, MappingRow } from '../profiles/types'

/** 上传文件集合：槽位 key → File */
export type SlotFiles = Record<string, File[] | null>

/** 映射模板（StepMapping 的 mappings 状态）——用于序列化提交后端 */
export interface MappingTemplateState {
  file: string
  rows: MappingRow[]
}

/** 四类映射请求体（与后端 app/upload/mapping.py 对齐） */
export type MappingPayload = Record<string, Record<string, Record<string, unknown>>>

/** 上传响应（POST /api/reconcile/upload） */
export interface UploadResponse {
  task_id: string
  status: string
  ds_id: string
  country: string
  slots_uploaded: string[]
  status_url: string
  result_url: string
}

/** 任务状态快照（GET /api/reconcile/task/{id}） */
export interface TaskStatus {
  id: string
  status: 'pending' | 'running' | 'success' | 'failed'
  created_at?: string
  started_at?: string
  finished_at?: string
  progress: number
  message?: string
  error?: string | null
  result_ref?: string | null
}

/** 轮询/超时配置 */
export interface PollOptions {
  /** 轮询间隔（ms），默认 1200 */
  intervalMs?: number
  /** 总超时（ms），默认 90s */
  timeoutMs?: number
  /** 单次请求超时（ms），默认 8s */
  requestTimeoutMs?: number
  /** 进度回调 */
  onProgress?: (status: TaskStatus) => void
  /** 用户取消信号 */
  signal?: AbortSignal
  /** 四类映射配置（StepMapping 当前状态） */
  mapping?: MappingTemplateState[] | null
}

/** 可识别的客户端错误类型 */
export class ReconcileApiError extends Error {
  status: number
  constructor(message: string, status = 0) {
    super(message)
    this.name = 'ReconcileApiError'
    this.status = status
  }
}

/** 后端 API base（与 mockData.API_BASE 同规则：5173 走 127.0.0.1:8000，否则同源） */
export const API_BASE =
  (typeof window !== 'undefined' && (window as { __API_BASE__?: string }).__API_BASE__) ||
  (typeof window !== 'undefined' && window.location.port === '5173'
    ? 'http://127.0.0.1:8000'
    : '')

// ---------------------------------------------------------------------------
// 请求超时 + 用户取消的组合信号
// ---------------------------------------------------------------------------
function withRequestSignal(
  userSignal: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal; cleanup: () => void } {
  const ctrl = new AbortController()
  const onUserAbort = () => ctrl.abort(userSignal?.reason)
  if (userSignal?.aborted) {
    ctrl.abort(userSignal.reason)
  } else {
    userSignal?.addEventListener('abort', onUserAbort, { once: true })
  }
  const timer = setTimeout(
    () => ctrl.abort(new DOMException(`RequestTimeout ${timeoutMs}ms`, 'TimeoutError')),
    timeoutMs,
  )
  return {
    signal: ctrl.signal,
    cleanup: () => {
      clearTimeout(timer)
      userSignal?.removeEventListener('abort', onUserAbort)
    },
  }
}

// ---------------------------------------------------------------------------
// 映射序列化：只发送「用户改过」的行（防回归，见文件头说明）
// ---------------------------------------------------------------------------
/** 行是否未被用户改动（与模板默认逐字段一致） */
function rowIsUntouched(row: MappingRow, tpl: MappingRow | undefined): boolean {
  if (!tpl) return false
  if ((row.type || 'direct') !== (tpl.type || 'direct')) return false
  switch (row.type || 'direct') {
    case 'direct':
      return (row.source || '') === (tpl.source || '')
    case 'expression': {
      const a = row.expr, b = tpl.expr
      if (!a && !b) return true
      if (!a || !b) return false
      return a.from === b.from && a.op === b.op &&
        JSON.stringify(a.map || {}) === JSON.stringify(b.map || {}) &&
        a.scale === b.scale && a.dateFrom === b.dateFrom && a.dateTo === b.dateTo
    }
    case 'storecode': {
      const a = row.storeCode, b = tpl.storeCode
      if (!a && !b) return true
      if (!a || !b) return false
      return a.from === b.from && a.rule === b.rule && a.padWidth === b.padWidth &&
        JSON.stringify(a.dict || {}) === JSON.stringify(b.dict || {})
    }
    case 'triplet': {
      const a = row.triplet, b = tpl.triplet
      if (!a && !b) return true
      if (!a || !b) return false
      return a.storeField === b.storeField && a.amountField === b.amountField &&
        a.timeField === b.timeField && a.toleranceMin === b.toleranceMin
    }
    default:
      return false
  }
}

/** 按映射类型序列化一行配置（与后端映射契约对齐）；未配置返回 null */
function serializeRowConfig(type: string, row: MappingRow): Record<string, unknown> | null {
  switch (type) {
    case 'direct':
      return row.source?.trim() ? { source: row.source.trim() } : null
    case 'expression': {
      const e = row.expr
      if (!e?.from || e.op === 'none') return null
      return {
        from: e.from,
        op: e.op,
        ...(e.map && Object.keys(e.map).length ? { map: e.map } : {}),
        ...(e.scale != null && e.scale > 0 ? { scale: e.scale } : {}),
        ...(e.dateFrom ? { dateFrom: e.dateFrom } : {}),
        ...(e.dateTo ? { dateTo: e.dateTo } : {}),
      }
    }
    case 'storecode': {
      const s = row.storeCode
      if (!s?.from || !s.rule) return null
      return {
        from: s.from,
        rule: s.rule,
        ...(s.padWidth != null ? { padWidth: s.padWidth } : {}),
        ...(s.dict && Object.keys(s.dict).length ? { dict: s.dict } : {}),
      }
    }
    case 'triplet': {
      const t = row.triplet
      if (!t?.storeField || !t.amountField || !t.timeField) return null
      return {
        storeField: t.storeField,
        amountField: t.amountField,
        timeField: t.timeField,
        toleranceMin: t.toleranceMin,
      }
    }
    default:
      return null
  }
}

/**
 * 把槽位文件 + 映射状态序列化为 FormData。
 * - 槽位 key 直接作为 multipart 字段名（oms/online/instore/tcb，与后端 _SLOT_KEYS 对齐）
 * - 仅发送「用户改过的映射行」（rowIsUntouched 过滤），未改行回退后端配置默认
 */
export function buildFormData(
  files: SlotFiles,
  profile: CountryProfile,
  mapping?: MappingTemplateState[] | null,
): FormData {
  const fd = new FormData()
  fd.append('country', profile.id)

  // 槽位 title → 槽位 key（映射模板 file 标题与槽位 title 匹配）
  const slotKeyByTitle = new Map(profile.slots.map((s) => [s.title, s.key]))
  // 模板默认（用于判断行是否被用户改动）
  const tplByFile = new Map(profile.mappingTemplates.map((t) => [t.file, t]))
  const mappingPayload: MappingPayload = {}

  for (const tpl of mapping || []) {
    const slotKey = slotKeyByTitle.get(tpl.file)
    if (!slotKey) continue
    const tplRows = new Map(
      (tplByFile.get(tpl.file)?.rows || []).map((r) => [r.target, r]),
    )
    const rows: Record<string, Record<string, unknown>> = {}
    for (const row of tpl.rows) {
      const type = row.type || 'direct'
      if (rowIsUntouched(row, tplRows.get(row.target))) continue
      const cfg = serializeRowConfig(type, row)
      if (cfg) rows[row.target] = { type, ...cfg }
    }
    if (Object.keys(rows).length) mappingPayload[slotKey] = rows
  }

  if (Object.keys(mappingPayload).length) {
    fd.append('mapping', JSON.stringify(mappingPayload))
  }

  for (const [key, filesArr] of Object.entries(files)) {
    if (!filesArr || filesArr.length === 0) continue
    // 同槽位多文件（增量追加）：用 {key}_files 字段名，FormData 同名 key 多次 append
    // （与后端 reconcile_upload 的 oms_files 等 List[UploadFile] 参数对齐）
    for (const file of filesArr) {
      fd.append(`${key}_files`, file, file.name)
    }
  }
  return fd
}

// ---------------------------------------------------------------------------
// 三阶段请求：上传 → 轮询 → 结果
// ---------------------------------------------------------------------------
async function upload(
  files: SlotFiles,
  profile: CountryProfile,
  mapping: MappingTemplateState[] | null,
  userSignal: AbortSignal | undefined,
  requestTimeoutMs: number,
): Promise<UploadResponse> {
  const fd = buildFormData(files, profile, mapping)
  const { signal, cleanup } = withRequestSignal(userSignal, requestTimeoutMs)
  let res: Response
  try {
    res = await fetch(`${API_BASE}/api/reconcile/upload`, { method: 'POST', body: fd, signal })
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      if (userSignal?.aborted) throw new DOMException('Aborted', 'AbortError')
      throw new ReconcileApiError(`后端请求超时（${requestTimeoutMs}ms）`, 0)
    }
    throw new ReconcileApiError(`后端不可达（${API_BASE || '同源'}）: ${(e as Error).message}`, 0)
  } finally {
    cleanup()
  }
  if (!res.ok) {
    let detail = ''
    try {
      const j = await res.json()
      detail = j?.detail || res.statusText
    } catch { /* ignore */ }
    throw new ReconcileApiError(`上传失败（HTTP ${res.status}）: ${detail || res.statusText}`, res.status)
  }
  return (await res.json()) as UploadResponse
}

async function fetchStatus(
  taskId: string,
  userSignal: AbortSignal | undefined,
  requestTimeoutMs: number,
): Promise<TaskStatus> {
  const { signal, cleanup } = withRequestSignal(userSignal, requestTimeoutMs)
  let res: Response
  try {
    res = await fetch(`${API_BASE}/api/reconcile/task/${taskId}`, { signal })
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      if (userSignal?.aborted) throw new DOMException('Aborted', 'AbortError')
      throw new ReconcileApiError(`后端请求超时（${requestTimeoutMs}ms）`, 0)
    }
    throw new ReconcileApiError(`后端不可达（${API_BASE || '同源'}）: ${(e as Error).message}`, 0)
  } finally {
    cleanup()
  }
  if (!res.ok) {
    let detail = ''
    try {
      const j = await res.json()
      detail = j?.detail || res.statusText
    } catch { /* ignore */ }
    throw new ReconcileApiError(`查询任务失败（HTTP ${res.status}）: ${detail || res.statusText}`, res.status)
  }
  return (await res.json()) as TaskStatus
}

async function fetchResult(
  taskId: string,
  userSignal: AbortSignal | undefined,
  requestTimeoutMs: number,
): Promise<unknown> {
  const { signal, cleanup } = withRequestSignal(userSignal, requestTimeoutMs)
  let res: Response
  try {
    res = await fetch(`${API_BASE}/api/reconcile/task/${taskId}/result`, { signal })
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      if (userSignal?.aborted) throw new DOMException('Aborted', 'AbortError')
      throw new ReconcileApiError(`后端请求超时（${requestTimeoutMs}ms）`, 0)
    }
    throw new ReconcileApiError(`后端不可达（${API_BASE || '同源'}）: ${(e as Error).message}`, 0)
  } finally {
    cleanup()
  }
  if (!res.ok) {
    let detail = ''
    try {
      const j = await res.json()
      detail = j?.detail || res.statusText
    } catch { /* ignore */ }
    throw new ReconcileApiError(`获取结果失败（HTTP ${res.status}）: ${detail || res.statusText}`, res.status)
  }
  return (await res.json()) as unknown
}

/** 执行结果（模式 / 结果 / 错误信息） */
export interface ReconcileRunResult {
  ok: boolean
  aborted?: boolean
  mode: 'live' | 'demo'
  result: unknown
  taskId?: string
  error?: string
}

/**
 * 执行「上传 → 轮询 → 取结果」全链路。
 * - 成功：{ ok: true, mode: 'live', result, taskId }
 * - 后端不可达 / 失败 / 超时：{ ok: false, mode: 'demo', result: profile.demoData(), error }
 * - 用户取消：{ ok: false, aborted: true }
 */
export async function runReconcileTask(
  files: SlotFiles,
  profile: CountryProfile,
  opts: PollOptions = {},
): Promise<ReconcileRunResult> {
  const {
    intervalMs = 1200,
    timeoutMs = 90_000,
    requestTimeoutMs = 8000,
    signal,
    mapping,
  } = opts
  const throwIfAborted = () => {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  }

  // ---- 0. 后端可用性探针：GET /api/health 快速失败降级 ----
  // 让「后端没启动」在 ~2s 内就给出演示模式，而不是等轮询超时。
  try {
    const { signal: hSignal, cleanup } = withRequestSignal(signal, 2000)
    const probe = await fetch(`${API_BASE}/api/health`, { signal: hSignal })
    cleanup()
    if (!probe.ok) throw new Error(`health ${probe.status}`)
  } catch (e) {
    if ((e as Error).name === 'AbortError' && signal?.aborted) {
      return { ok: false, aborted: true, mode: 'demo', result: profile.demoData() }
    }
    const msg = (e as Error).message
    return {
      ok: false,
      mode: 'demo',
      result: profile.demoData(),
      error: `后端不可达（${API_BASE || '同源'}）· 已降级为演示数据（${msg}）`,
    }
  }

  try {
    // ---- 1. 上传 ----
    throwIfAborted()
    const up = await upload(files, profile, mapping ?? null, signal, requestTimeoutMs)
    const taskId = up.task_id
    opts.onProgress?.({
      id: taskId,
      status: 'running',
      progress: 5,
      message: '文件已上传，任务已创建',
    })

    // ---- 2. 轮询 ----
    const deadline = Date.now() + timeoutMs
    // eslint-disable-next-line no-constant-condition
    while (true) {
      throwIfAborted()
      const st = await fetchStatus(taskId, signal, requestTimeoutMs)
      opts.onProgress?.(st)
      if (st.status === 'success') {
        // ---- 3. 取结果 ----
        throwIfAborted()
        const result = await fetchResult(taskId, signal, requestTimeoutMs)
        return { ok: true, mode: 'live', result, taskId }
      }
      if (st.status === 'failed') {
        return {
          ok: false,
          mode: 'demo',
          result: profile.demoData(),
          taskId,
          error: `对账任务执行失败（${st.error || st.message || '未知错误'}）· 已降级为演示数据`,
        }
      }
      if (Date.now() > deadline) {
        throw new ReconcileApiError(`对账任务轮询超时（${timeoutMs}ms）`, 0)
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
  } catch (e) {
    throwIfAborted()
    if ((e as Error).name === 'AbortError') {
      return { ok: false, aborted: true, mode: 'demo', result: profile.demoData() }
    }
    return {
      ok: false,
      mode: 'demo',
      result: profile.demoData(),
      error: `${(e as Error).message} · 已降级为演示数据`,
    }
  }
}
