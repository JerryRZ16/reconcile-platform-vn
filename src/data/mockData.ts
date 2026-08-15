// ============================================================
// 对账平台 MVP · 数据/类型层（已去硬编码）
// - 保留 ReconResult 及全部结果类型定义
// - 越南常量（国家名/对账期/格式化函数/通道语义/文案）已抽到
//   src/profiles/vn.ts（CountryProfile 配置包）
// - 货币/日期格式化统一走 src/lib/format.ts（按 profile 渲染）
// - runReconciliation(profile)：有后端走 live，无后端回退 profile.demoData()
// ============================================================
import type { CountryProfile } from '../profiles/types'

export interface DimRow {
  key: string;
  label: string;
  cnt: number;
  amt: number;
  pct: number; // 笔数占比 %
}

export interface ChannelRecon {
  channel: string;
  label: string;
  omsCount: number;
  billCount: number;
  matchedCount: number;
  matchRate: number; // %
  unmatchedCount: number;
  unmatchedAmt: number;
  status: 'success' | 'warning' | 'error';
  note?: string;
}

export interface BankDailyRow {
  day: number;
  date: string;
  payooSettle: number;
  tcbCredit: number;
  diff: number;
  note?: string;
}

export interface BankReconSummary {
  payooNet: number;
  bankIn: number;
  prevCross: number;
  monthAttributed: number;
  endUnsettled: number;
  status: 'success' | 'warning' | 'error';
}

export type DiffStatus = 'pending' | 'processed' | 'ignored';
export type DiffRoot = string; // 泛化：R1-R6 / CASH / L2 / 自定义

export interface Discrepancy {
  id: string;
  channel: string;      // 泛化：不固定 5 个枚举
  root: DiffRoot;
  rootLabel: string;
  orderNo?: string;
  storeNo?: string;
  amount: number;
  expected?: number;
  diffAmt?: number;
  diffRate?: string;
  time?: string;
  description: string;
  suggestion: string;
  status: DiffStatus;
  omsSide?: string;
  billSide?: string;
}

export interface CoverageCell {
  source: number;
  payType: number;
  cnt: number;
  amt: number;
  owner: string;
  cover: boolean;
  note?: string;
}

export interface FreeOrder {
  id: string;
  orderNo: string;
  storeNo: string;
  amount: number;
  total: number;
  disc: number;
  verify: 'ok' | 'include' | 'manual';
  note: string;
}

export interface RefundItem {
  id: string;
  orderNo: string;
  storeNo: string;
  status: number;
  statusLabel: string;
  amount: number;
  time: string;
  root: string;
  rootLabel: string;
}

export interface ReconSummary {
  totalOrders: number;
  totalAmount: number;
  overallMatchRate: string;
  diffCount: number;
  diffAmount: number;
  uncovered: number;
  taskId: string;
  runAt: string;
}

export interface ReconResult {
  summary: ReconSummary;
  omsByBusiness: DimRow[];
  omsBySource: DimRow[];
  omsByPayType: DimRow[];
  omsByStatus: DimRow[];
  channels: ChannelRecon[];
  bankDaily: BankDailyRow[];
  bankRecon: BankReconSummary;
  discrepancies: Discrepancy[];
  freeOrders: FreeOrder[];
  refunds: RefundItem[];
  coverage: CoverageCell[];
}

// ============================================================
// 主入口：runReconciliation（阶段3 · 真实对账链路 + 降级）
// ------------------------------------------------------------
// 阶段3改造：由「只 fetch 旧版 5 个端点」升级为「上传 → 轮询 → 取结果」
// 完整链路（POST /api/reconcile/upload + GET /task/{id} + GET /task/{id}/result）。
//
// 行为：
//  - 传入真实文件（files）且国家有后端配置（vn）→ 走 runReconcileTask 真实链路
//  - 后端不可达 / 任务失败 / 超时 → 降级 profile.demoData()（演示模式），
//    并在返回里带 error 说明，UI 据此标注「演示数据」还是「真实对账」
//  - 未上传文件 / 他国（无后端配置）→ 直接演示模式
//  - 用户取消（signal.aborted）→ 返回 aborted，UI 回到映射步骤
// ============================================================
import { runReconcileTask, type SlotFiles } from '../lib/reconcileClient'
import type { MappingTemplateState, TaskStatus } from '../lib/reconcileClient'
import { adaptBackendResult, type BackendRunAllResult } from '../lib/backendAdapter'

/** runReconciliation 入参 */
export interface RunOptions {
  /** 已上传的真实文件（槽位 key → File）；缺省/全空 = 演示模式 */
  files?: SlotFiles | null
  /** StepMapping 当前映射状态（四类映射；未改行自动过滤，防回归） */
  mapping?: MappingTemplateState[] | null
  /** 轮询进度回调 */
  onProgress?: (status: TaskStatus) => void
  /** 用户取消信号 */
  signal?: AbortSignal
}

/** runReconciliation 返回 */
export interface RunOutcome {
  result: ReconResult
  mode: 'live' | 'demo'
  taskId?: string
  error?: string
  aborted?: boolean
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * 执行对账（真实链路优先，降级演示模式）。
 * @param profile 当前国家 profile
 * @param opts    文件 / 映射 / 进度回调 / 取消信号
 */
export async function runReconciliation(
  profile: CountryProfile,
  opts: RunOptions = {},
): Promise<RunOutcome> {
  const { files, mapping, onProgress, signal } = opts
  const hasRealFiles = Boolean(
    files && Object.values(files).some((arr) => Array.isArray(arr) && arr.length > 0),
  )

  // ---- 无真实文件 → 演示模式（保持阶段1/2 的一键演示体验） ----
  if (!hasRealFiles) {
    onProgress?.({
      id: '',
      status: 'running',
      progress: 60,
      message: '未上传文件，加载演示数据…',
    })
    await sleep(600)
    if (signal?.aborted) return { result: profile.demoData(), mode: 'demo', aborted: true }
    return { result: profile.demoData(), mode: 'demo' }
  }

  // ---- 他国（无后端配置）→ 直接演示模式，避免向后端传未知国家 ----
  if (profile.id !== 'vn') {
    await sleep(600)
    return {
      result: profile.demoData(),
      mode: 'demo',
      error: `${profile.countryZh} 尚未接入后端配置（configs/${profile.id}.json），使用演示数据`,
    }
  }

  // ---- 真实链路：上传 → 轮询 → 结果；失败自动降级演示 ----
  const out = await runReconcileTask(files as SlotFiles, profile, {
    mapping,
    signal,
    onProgress,
  })

  if (out.aborted) {
    return { result: profile.demoData(), mode: 'demo', taskId: out.taskId, aborted: true }
  }
  if (out.ok && out.mode === 'live') {
    const adapted = adaptBackendResult(out.result as BackendRunAllResult, profile, out.taskId)
    return { result: adapted, mode: 'live', taskId: out.taskId }
  }
  // 降级：result 已是 profile.demoData()
  return {
    result: out.result as ReconResult,
    mode: 'demo',
    taskId: out.taskId,
    error: out.error,
  }
}
