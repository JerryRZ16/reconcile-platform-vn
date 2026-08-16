// ============================================================
// 后端 run_all 结果 → 前端 ReconResult 适配器（阶段3）
// ------------------------------------------------------------
// 后端 GET /api/reconcile/task/{id}/result 返回「引擎 run_all 全量结果」
// （与既有 /api/reconcile 同构）：meta / overview / free_refund /
// channels(L1_ONLINE|L1_INSTORE|L1_CASH) / L2_BANK / coverage / dashboard。
// 本模块把它适配为前端 Results 组件消费的 ReconResult（逐字段对齐 mockData 类型）。
//
// 设计约束：
//  - 文案 / 币种 / 通道标签 / 根因枚举一律从 profile 读取（与阶段1/2一致）
//  - 覆盖矩阵（coverage）：沿用 profile.demoData().coverage 作为基线
//    （后端 coverage.combos 只含 order_source/pay_type/count/amount/label，
//     owner 归属与免单语义属国家业务口径，由 profile 提供 —— 与阶段2 一致）
// ============================================================
import type { CountryProfile } from '../profiles/types'
import type {
  ReconResult, ReconSummary, DimRow, ChannelRecon, BankDailyRow,
  BankReconSummary, Discrepancy, FreeOrder, RefundItem,
} from '../data/mockData'
import { pct } from './format'

/** 后端 run_all 结果的最小类型（宽松，字段缺省兜底） */
export interface BackendRunAllResult {
  meta?: {
    generated_at?: string
    month?: string
    currency?: string
    source?: string
  }
  overview?: Record<string, Array<{ key: number | string; label: string; count: number; amount: number }>>
  free_refund?: {
    free_orders?: Array<Record<string, unknown>>
    refunds?: Array<Record<string, unknown>>
    cancels?: Array<Record<string, unknown>>
  }
  channels?: Record<string, Record<string, unknown>>
  L2_BANK?: {
    kinds?: Record<string, { matched?: Array<Record<string, unknown>>; diff?: Array<Record<string, unknown>> }>
    summary?: Record<string, unknown>
  }
  coverage?: { combos?: Array<Record<string, unknown>>; total?: number }
  dashboard?: Record<string, unknown>
  attribution?: {
    sections?: Record<string, {
      unmatched_bill?: Array<Record<string, unknown>>
      unmatched_bill_detail?: Array<Record<string, unknown>>
      unmatched_oms?: Array<Record<string, unknown>>
      unmatched_oms_detail?: Array<Record<string, unknown>>
      diff?: Array<Record<string, unknown>>
      diff_detail?: Array<Record<string, unknown>>
    }>
    overall?: Array<Record<string, unknown>>
    total_unmatched?: number
    total_unmatched_amount?: number
  }
}

/** overview 数组 → DimRow[]（key/label/cnt/amt/pct） */
function toDims(arr?: Array<{ key: number | string; label: string; count: number; amount: number }>): DimRow[] {
  if (!arr || !arr.length) return []
  const total = arr.reduce((s, x) => s + (Number(x.count) || 0), 0) || 1
  return arr.map((r) => ({
    key: String(r.key),
    label: r.label,
    cnt: Number(r.count) || 0,
    amt: Number(r.amount) || 0,
    pct: (Number(r.count) || 0) * 100 / total,
  }))
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * 适配后端 run_all 结果 → ReconResult。
 * @param raw   GET /result 返回体
 * @param profile 当前国家 profile（文案/币种/通道/根因）
 * @param taskId  后端任务 ID（用于 summary.taskId；缺省用本地生成规则）
 */
export function adaptBackendResult(
  raw: BackendRunAllResult,
  profile: CountryProfile,
  taskId?: string,
): ReconResult {
  const { currency, bankDef, channels: chDefs } = profile
  const full = currency.full
  const chLabel = (ch: string) => chDefs.find((d) => d.channel === ch)?.label || ch
  const chNote = (ch: string) => chDefs.find((d) => d.channel === ch)?.note

  const ch = raw.channels || {}
  const l2 = raw.L2_BANK || {}
  const l2kinds = (l2.kinds || {}) as Record<string, { matched?: any[]; diff?: any[] }>
  const dash = (raw.dashboard || {}) as Record<string, any>

  // vn 兼容别名（fallback 无归因分支使用；泛化后仍能取到）
  const online = (ch.L1_ONLINE || ch.ONLINE || {}) as Record<string, any>
  const instore = (ch.L1_INSTORE || ch.INSTORE || {}) as Record<string, any>
  const cash = (ch.L1_CASH || ch.CASH || {}) as Record<string, any>

  // ---- 通道汇总（遍历化：所有通道键动态渲染，不写死 vn 三通道） ----
  const channels: ChannelRecon[] = []
  for (const [key, body] of Object.entries(ch)) {
    const b = body as Record<string, any>
    const scope = b.scope || {}
    const matched = b.matched || {}
    const rateByCount = num(matched.rate_by_count)
    const rateByAmount = num(matched.rate_by_amount)
    // bill 通道用 rate_by_count；cash 通道用 rate_by_amount（后端语义）
    const isCash = key.replace('L1_', '') === 'CASH' || key.endsWith('CASH')
    const rate = isCash ? rateByAmount : rateByCount
    channels.push({
      channel: key.replace('L1_', ''),
      label: chLabel(key.replace('L1_', '')),
      omsCount: num(scope.oms_count ?? scope.oms_cash_count),
      billCount: num(scope.bill_count ?? scope.bank_deposit_rows),
      matchedCount: num(matched.count ?? matched.amount),
      matchRate: rate,
      unmatchedCount: num(b.unmatched_bill_count),
      unmatchedAmt: num(b.totals?.unmatched_bill_amount ?? (num(scope.oms_cash_amount) - num(matched.amount))),
      status: (rate >= 99 ? 'success' : rate >= 95 ? 'warning' : 'error') as ChannelRecon['status'],
      note: chNote(key.replace('L1_', '')),
    })
  }

  // ---- 银行按日对平（L2） ----
  const monthPrefix = (profile.period.split('-')[1] || '07').padStart(2, '0')
  const bankDaily: BankDailyRow[] = []
  const matchedByDay: Record<number, { bank: number; expected: number }> = {}
  for (const kind of Object.keys(l2kinds)) {
    for (const m of l2kinds[kind]?.matched || []) {
      const d = m.settle_date as string | undefined
      if (!d) continue
      const day = parseInt(String(d).slice(8, 10), 10)
      if (!Number.isFinite(day)) continue
      matchedByDay[day] = matchedByDay[day] || { bank: 0, expected: 0 }
      matchedByDay[day].bank += num(m.bank_amount)
      matchedByDay[day].expected += num(m.expected_amount)
    }
  }
  for (const [d, v] of Object.entries(matchedByDay)) {
    const day = parseInt(d, 10)
    bankDaily.push({
      day,
      date: `${monthPrefix}-${String(day).padStart(2, '0')}`,
      payooSettle: v.expected,
      tcbCredit: v.bank,
      diff: v.bank - v.expected,
    })
  }
  // 补齐 1-31 日空数据（图表连贯）
  for (let i = 1; i <= 31; i++) {
    if (!bankDaily.find((x) => x.day === i)) {
      bankDaily.push({ day: i, date: `${monthPrefix}-${String(i).padStart(2, '0')}`, payooSettle: 0, tcbCredit: 0, diff: 0, note: '—' })
    }
  }
  bankDaily.sort((a, b) => a.day - b.day)

  // ---- 银行对账汇总 ----
  const bankIn = num((l2.summary || {}).matched_bank_amount)
  const payooNet = num(dash.payoo_bill?.online_amount) + num(dash.payoo_bill?.instore_amount)
  const bankRecon: BankReconSummary = {
    payooNet,
    bankIn,
    prevCross: 0,
    monthAttributed: payooNet,
    endUnsettled: payooNet - bankIn,
    status: 'warning',
  }

  // ---- 差异清单（优先真实归因 attribution；回退拼接 4 类） ----
  const diffs: Discrepancy[] = []
  let did = 0
  const add = (d: Partial<Discrepancy>) => {
    did += 1
    diffs.push({
      id: `D-${String(did).padStart(4, '0')}`,
      channel: 'ONLINE',
      root: 'R3',
      rootLabel: '—',
      amount: 0,
      description: '',
      suggestion: '',
      status: 'pending',
      ...d,
    } as Discrepancy)
  }

  const att = raw.attribution
  const attSections = att?.sections || {}
  const hasAttribution = Boolean(Object.keys(attSections).length)

  // 真实归因明细 → Discrepancy（全量，不截断；section 名动态映射到前端通道名）
  if (hasAttribution) {
    for (const [sec, body] of Object.entries(attSections)) {
      const channel = sec.replace('L1_', '')
      const push = (d: Record<string, unknown>) => {
        const amount = num(d.amount)
        const expected = num(d.expected)
        const diffAmt = d.diff !== undefined ? num(d.diff) : amount - (d.expected !== undefined ? expected : 0)
        add({
          channel,
          root: String(d.root || 'OTHER'),
          rootLabel: String(d.rootLabel || '—'),
          orderNo: d.order_no ? String(d.order_no) : d.orderNo ? String(d.orderNo) : undefined,
          storeNo: d.store_no ? String(d.store_no) : d.storeNo ? String(d.storeNo) : undefined,
          amount,
          expected: d.expected !== undefined ? expected : undefined,
          diffAmt: diffAmt !== 0 ? diffAmt : undefined,
          time: d.pay_date ? String(d.pay_date) : d.txn_date ? String(d.txn_date) : d.order_date ? String(d.order_date) : undefined,
          description: d.suggestion
            ? `${String(d.rootLabel || '')}。${String(d.suggestion)}`
            : String(d.rootLabel || '未归因'),
          suggestion: String(d.suggestion || ''),
          omsSide: channel === 'CASH' ? `现金销售 ${full(amount)}` : d.order_no ? `OMS ${String(d.order_no)}` : undefined,
          billSide: channel === 'CASH' && expected ? `${bankDef.bankName} 缴存 ${full(expected)}` : undefined,
        })
      }
      for (const d of body.unmatched_bill_detail || []) push(d)
      for (const d of body.unmatched_oms_detail || []) push(d)
      for (const d of body.diff_detail || []) push(d)
    }
  } else {
    // ---- 回退：拼接 4 类（无 attribution 时的旧逻辑） ----
    for (const r of (online.unmatched_bill || []).slice(0, 5)) {
      add({
        channel: 'ONLINE',
        root: 'R4',
        rootLabel: 'PAYOO 有 · OMS 无（补单/补单延迟）',
        orderNo: r.order_no,
        storeNo: r.store_no,
        amount: num(r.amount),
        time: r.pay_date,
        description: `OMS 未找到该笔订单号（PAYOO ONLINE 已收款 ${full(num(r.amount))}）。`,
        suggestion: '核对 OMS 是否漏单 / 跨日时间戳，确认补录后重跑。',
        omsSide: '未找到',
        billSide: `PAYOO Completed · ${full(num(r.amount))}`,
      })
    }
    for (const r of (instore.unmatched_bill || []).slice(0, 3)) {
      add({
        channel: 'INSTORE',
        root: 'R3',
        rootLabel: '时间超容差（±5min）',
        orderNo: '',
        storeNo: r.store_no,
        amount: num(r.amount),
        time: r.date,
        description: `门店+金额匹配失败，可能为时间漂移或金额取整。`,
        suggestion: 'POS 调单延迟；同店同额可手动关联，阈值建议放宽至 60 分钟。',
        omsSide: 'OMS 未找到（时间或金额漂移）',
        billSide: `INSTORE ${r.payoo_code || ''} · ${full(num(r.amount))}`,
      })
    }
    for (const d of (cash.diff_rows || []).slice(0, 3)) {
      add({
        channel: 'CASH',
        root: 'CASH',
        rootLabel: '门店缴存异常',
        storeNo: d.store_no,
        amount: num(d.oms_cash),
        expected: num(d.bank_deposit),
        diffAmt: num(d.diff),
        diffRate: num(d.oms_cash) ? `${(Math.abs(num(d.diff)) * 100 / num(d.oms_cash)).toFixed(1)}%` : '0%',
        description: `${d.store_no} 现金销售 ${full(num(d.oms_cash))}，银行缴存 ${full(num(d.bank_deposit))}，差 ${full(num(d.diff))}。`,
        suggestion: '门店盘点 + 备用金政策核查，疑似现金未及时缴存。',
        omsSide: `现金销售 ${full(num(d.oms_cash))}`,
        billSide: `${bankDef.bankName} 缴存 ${full(num(d.bank_deposit))}`,
      })
    }
    for (const kind of Object.keys(l2kinds)) {
      for (const d of (l2kinds[kind]?.diff || []).slice(0, 2)) {
        add({
          channel: 'L2',
          root: 'L2',
          rootLabel: 'T+N 跨月 / 多日合并结算',
          storeNo: '—',
          orderNo: '—',
          amount: num(d.bank_amount),
          expected: num(d.expected_amount),
          diffAmt: num(d.bank_amount) - num(d.expected_amount),
          time: d.txn_date,
          description: d.reason || `银行入账 ${full(num(d.bank_amount))}，期望 ${full(num(d.expected_amount))}，无匹配 PAYOO 结算。`,
          suggestion: '合并结算（如 N3.7-5.7.2026）需展开日期范围；月末 T+N 跨月需待次月初到账。',
          omsSide: `银行入账 ${full(num(d.bank_amount))}`,
          billSide: `期望 ${full(num(d.expected_amount))}`,
        })
      }
    }
  }

  // ---- 免单 / 退款 ----
  const free = raw.free_refund || {}
  const freeOrders: FreeOrder[] = (free.free_orders || []).slice(0, 8).map((f: any, i: number) => ({
    id: `F-${String(i + 1).padStart(4, '0')}`,
    orderNo: f.order_no,
    storeNo: f.store_no,
    amount: num(f.pay_amt),
    total: num(f.total_amt),
    disc: num(f.discount_amt),
    verify: f.full_collected ? 'include' : 'ok',
    note: f.full_collected
      ? '标记免单但全额收款，须纳入收入'
      : '正常免单（全额优惠）',
  }))
  const refunds: RefundItem[] = (free.refunds || []).slice(0, 6).map((r: any, i: number) => ({
    id: `R-${String(i + 1).padStart(4, '0')}`,
    orderNo: r.order_no,
    storeNo: r.store_no,
    status: num(r.order_status),
    statusLabel: profile.freeRefundDef.refundStatus.includes(num(r.order_status)) ? '退款' : '取消',
    amount: num(r.pay_amt),
    time: '',
    root: 'NORMAL',
    rootLabel: '正常退款闭环',
  }))

  // ---- 覆盖矩阵（沿用 profile 演示基线，见文件头说明） ----
  const coverage = profile.demoData().coverage.map((x) => ({ ...x }))

  // ---- 汇总 ----
  const totalOrders = num(dash.total_orders)
  const totalAmount = num(dash.total_sales)
  const diffCount = diffs.length
  const diffAmount = diffs.reduce((s, d) => s + Math.abs(d.diffAmt || d.amount || 0), 0)
  const summary: ReconSummary = {
    totalOrders,
    totalAmount,
    overallMatchRate: channels.length
      ? pct(channels.reduce((s, c) => s + c.matchRate, 0) / channels.length)
      : '0.00',
    diffCount,
    diffAmount,
    uncovered: 0,
    taskId: taskId || `${profile.id.toUpperCase()}-${profile.period.replace('-', '')}-001`,
    runAt: raw.meta?.generated_at || new Date().toISOString().slice(0, 16).replace('T', ' '),
  }

  return {
    summary,
    omsByBusiness: toDims(raw.overview?.business_type),
    omsBySource: toDims(raw.overview?.order_source),
    omsByPayType: toDims(raw.overview?.pay_type),
    omsByStatus: toDims(raw.overview?.order_status),
    channels,
    bankDaily,
    bankRecon,
    discrepancies: diffs,
    freeOrders,
    refunds,
    coverage,
  }
}
