// ============================================================
// Country Profile · 泰国 (th)
// 泰国 2026-06 对账配置包（示例：验证多国适配链路，不做真实对账）。
// 与越南同构的 CountryProfile 接口；演示数据生成器输出简化但字段齐全的
// ReconResult，用于验证 CountrySelector 切换 + 7 个 Results 组件非越南渲染。
// ============================================================
import type { CountryProfile } from './types'
import type { ReconResult, ChannelRecon, Discrepancy, FreeOrder, RefundItem, CoverageCell } from '../data/mockData'

// ---------- 泰铢格式化 ----------
function fmtTHB(n: number): string {
  if (!n) return '0'
  const abs = Math.abs(n)
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`      // Billion
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return n.toLocaleString('en-US')
}
function fmtTHBFull(n: number): string {
  return `${n.toLocaleString('en-US')} ฿`
}

// ---------- 文件槽位（泰国：OMS + 单一支付通道 + 银行） ----------
const slots: CountryProfile['slots'] = [
  {
    key: 'oms', title: 'OMS 订单', desc: '订单主表导出 · CSV / XLSX',
    required: true, icon: 'excel', color: '#b91c1c', kind: 'oms',
    fields: 'order_id · amount_baht · channel · store_code · status',
  },
  {
    key: 'pg', title: 'PG 支付通道账单', desc: 'PG Gateway 账单 · CSV',
    required: true, icon: 'text', color: '#b45309', kind: 'bill',
    fields: 'merchant_ref · amount · paid_at',
  },
  {
    key: 'bank', title: 'KBank 银行流水', desc: 'Kasikorn 银行对账单 · CSV/XLSX',
    required: true, icon: 'excel', color: '#15803d', kind: 'bank',
    fields: 'value_date · amount · description',
  },
]

// ---------- 通道定义（泰国 L1：ONLINE / INSTORE / CASH） ----------
const channels: CountryProfile['channels'] = [
  {
    channel: 'ONLINE',
    label: 'ONLINE（Web/Mobile · 卡）',
    note: 'order channel=web/mobile ↔ PG 按 merchant_ref 逐笔匹配',
  },
  {
    channel: 'INSTORE',
    label: 'INSTORE（POS · 卡/QR）',
    note: 'order channel=pos ↔ PG 按「门店+金额+时间±10min」三元组匹配',
  },
  {
    channel: 'CASH',
    label: '现金（channel=cash · 门店缴存）',
    note: 'OMS 现金销售按门店聚合 vs KBank「BK cash deposit」缴存',
  },
]

// ---------- 根因枚举（泰国自定义，非越南 R1-R6） ----------
const rootEnums: CountryProfile['rootEnums'] = [
  { root: 'T1', label: '金额不一致', color: 'blue' },
  { root: 'T2', label: '状态异常', color: 'volcano' },
  { root: 'T3', label: '时间超容差（±10min）', color: 'purple' },
  { root: 'T4', label: 'PG 有 · OMS 无（补单）', color: 'cyan' },
  { root: 'T5', label: '门店缴存异常', color: 'geekblue' },
  { root: 'B1', label: '银行对账差异', color: 'orange' },
]

// ---------- 规则元数据 ----------
const rules: CountryProfile['rules'] = [
  { key: 'r1', name: 'OMS 四维总览', desc: 'channel / source / pay_type / status 统计' },
  { key: 'r2', name: 'L1 · ONLINE 通道', desc: 'channel=web/mobile ↔ PG 按 merchant_ref 逐笔匹配' },
  { key: 'r3', name: 'L1 · INSTORE 通道', desc: 'channel=pos ↔ PG 按「店+额+时±10min」三元组匹配' },
  { key: 'r4', name: 'L1 · 现金通道', desc: 'channel=cash 门店聚合 ↔ KBank 缴存核对' },
  { key: 'r5', name: 'L2 · 银行对账', desc: 'PG 结算 ↔ KBank 流水按日对平' },
  { key: 'r6', name: '免单 / 退款 / 全覆盖', desc: 'pay_type=800 验证 · status 8/9 归集 · 全覆盖检查' },
]

// ---------- 免单 / 退款定义（泰国码值不同） ----------
const freeRefundDef: CountryProfile['freeRefundDef'] = {
  freePayType: [800],
  refundStatus: [9],
  cancelStatus: [8],
  freeTitle: '免单验证（pay_type=800）',
  refundTitle: '退款 / 取消归集（不计入收入确认）',
  verifyLabels: {
    ok: { label: '正常免单', color: 'green' },
    include: { label: '全额收款 · 纳入收入', color: 'red' },
    manual: { label: '需人工确认', color: 'orange' },
  },
}

// ---------- 全覆盖定义 ----------
const coverageDef: CountryProfile['coverageDef'] = {
  dims: ['channel', 'pay_type'],
  title: '全覆盖检查（channel × pay_type 组合归属）',
  colLabel: '金额',
}

// ---------- 结果模块开关（泰国全开，验证 7 组件渲染） ----------
const showModules: CountryProfile['showModules'] = [
  'metricCards', 'channelCards', 'omsOverview', 'bankRecon',
  'discrepancyTable', 'freeOrders', 'refunds', 'coverageMatrix',
]

// ---------- 文件名归属校验 ----------
const uploadHints: CountryProfile['uploadHints'] = {
  oms: ['order', 'oms'],
  pg: ['pg', 'payment', 'gateway'],
  bank: ['kbank', 'kasikorn', 'bank', 'statement'],
}

// ---------- 预置映射模板（含四类映射示例，验证 StepMapping 升级 UI） ----------
const mappingTemplates: CountryProfile['mappingTemplates'] = [
  {
    file: 'OMS 订单',
    requiredOk: true,
    sourceOptions: ['order_id', 'amount_baht', 'channel', 'store_code', 'status', 'pay_type', 'created_at'],
    rows: [
      { target: 'order_no', label: '订单号', source: 'order_id', required: true, type: 'direct' },
      { target: 'business_type', label: '业务类型', source: 'channel', required: true, type: 'direct' },
      { target: 'pay_type', label: '支付方式', source: 'pay_type', required: true, type: 'expression', expr: { op: 'code_map', from: 'pay_type', map: { '1': 'card', '2': 'qr', '3': 'cash', '800': 'free' }, label: '码值映射 1→card / 2→qr' } },
      { target: 'order_status', label: '订单状态', source: 'status', required: true, type: 'direct' },
      { target: 'pay_amt', label: '支付金额（分→฿）', source: 'amount_baht', required: true, type: 'expression', expr: { op: 'scale', from: 'amount_baht', scale: 100, label: '金额 分→฿ (÷100)' } },
      { target: 'store_no', label: '门店号', source: 'store_code', required: true, type: 'storecode', storeCode: { from: 'store_code', rule: 'strip_leading_zero' } },
      { target: 'pay_finished_time', label: '支付完成时间', source: 'created_at', required: false, type: 'expression', expr: { op: 'date_fmt', from: 'created_at', dateFrom: 'dd/MM/yyyy', dateTo: 'yyyy-MM-dd', label: '日期 dd/MM/yyyy → yyyy-MM-dd' } },
      { target: 'triplet', label: '三元组匹配（INSTORE）', source: '', required: true, type: 'triplet', triplet: { storeField: 'store_code', amountField: 'amount_baht', timeField: 'created_at', toleranceMin: 10, label: '门店+金额+时间 ±10min' } },
    ],
  },
  {
    file: 'PG 支付通道账单',
    requiredOk: true,
    sourceOptions: ['merchant_ref', 'amount', 'paid_at', 'txn_status'],
    rows: [
      { target: 'order_no', label: '商户订单号', source: 'merchant_ref', required: true, type: 'direct' },
      { target: 'amount', label: '金额', source: 'amount', required: true, type: 'direct' },
      { target: 'paid_time', label: '支付时间', source: 'paid_at', required: true, type: 'direct' },
      { target: 'txn_status', label: '交易状态', source: 'txn_status', required: false, type: 'direct' },
    ],
  },
  {
    file: 'KBank 银行流水',
    requiredOk: true,
    sourceOptions: ['value_date', 'amount', 'description'],
    rows: [
      { target: 'tran_date', label: '交易日期', source: 'value_date', required: true, type: 'direct' },
      { target: 'amount', label: '金额', source: 'amount', required: true, type: 'direct' },
      { target: 'description', label: '摘要', source: 'description', required: true, type: 'direct' },
    ],
  },
]

// ---------- 界面文案 ----------
const ui: CountryProfile['ui'] = {
  uploadIntro: '拖拽或点击上传文件（CSV / XLSX，≤50MB，UTF-8）。平台即时校验格式与文件名归属，校验通过后进入字段映射。',
  uploadDemo: '演示模式已内置「泰国 2026-06」示例数据，可直接继续。',
  uploadFlowHint: '① 上传 OMS 订单与 PG/KBank 账单文件 → ② 确认字段映射 → ③ 运行对账规则 → ④ 查看可视化结果',
  runningSubtitle: '已加载泰国 2026-06 示例数据：OMS 52,000 笔 · PG / KBank 账单文件 2 份',
  resultDemoNote: '本结果基于泰国 2026-06 示例数据生成（仅演示多国适配链路，非真实对账）。对接后端 API 时替换 runReconciliation 即可。',
  resultTitle: '泰国 2026-06 全通道对账结果',
}

// ---------- 演示数据生成器（简化但字段齐全，验证 7 组件非越南渲染） ----------
function buildDemoData(): ReconResult {
  const channelsData: ChannelRecon[] = [
    { channel: 'ONLINE', label: 'ONLINE（Web/Mobile · 卡）', omsCount: 31200, billCount: 31050, matchedCount: 30980, matchRate: 99.29, unmatchedCount: 70, unmatchedAmt: 245000, status: 'warning', note: 'order channel=web/mobile ↔ PG 按 merchant_ref 逐笔匹配' },
    { channel: 'INSTORE', label: 'INSTORE（POS · 卡/QR）', omsCount: 15800, billCount: 15780, matchedCount: 15760, matchRate: 99.87, unmatchedCount: 20, unmatchedAmt: 86000, status: 'success', note: 'order channel=pos ↔ PG 按「门店+金额+时间±10min」三元组匹配' },
    { channel: 'CASH', label: '现金（channel=cash · 门店缴存）', omsCount: 5000, billCount: 60, matchedCount: 4520, matchRate: 90.40, unmatchedCount: 6, unmatchedAmt: 1280000, status: 'error', note: 'OMS 现金销售按门店聚合 vs KBank「BK cash deposit」缴存' },
  ]

  const bankDaily = Array.from({ length: 30 }, (_, i) => {
    const day = i + 1
    const p = 3000000 + day * 120000 + (day % 3) * 50000
    const t = p + (day % 5 === 0 ? 0 : (day % 2 ? 30000 : -40000))
    return {
      day,
      date: `06-${String(day).padStart(2, '0')}`,
      payooSettle: p,
      tcbCredit: t,
      diff: t - p,
      ...(day % 7 === 0 ? { note: '周日' } : {}),
    }
  })

  const discrepancies: Discrepancy[] = [
    { id: 'D-0001', channel: 'ONLINE', root: 'T4', rootLabel: 'PG 有 · OMS 无（补单）', orderNo: 'PG-20260601001', storeNo: 'TH012', amount: 890, time: '2026-06-01', description: 'OMS 未找到该笔订单号（PG 已收款 ฿890）。', suggestion: '核对 OMS 是否漏单。', status: 'pending', omsSide: '未找到', billSide: 'PG Success · ฿890' },
    { id: 'D-0002', channel: 'ONLINE', root: 'T1', rootLabel: '金额不一致', orderNo: 'PG-20260601022', storeNo: 'TH008', amount: 1230, time: '2026-06-01', description: 'OMS 与 PG 金额差 ฿30，疑似取整。', suggestion: '核对金额口径。', status: 'pending', omsSide: 'OMS ฿1200', billSide: 'PG ฿1230' },
    { id: 'D-0003', channel: 'CASH', root: 'T5', rootLabel: '门店缴存异常', storeNo: 'TH006', amount: 890000, expected: 720000, diffAmt: 170000, diffRate: '19.1%', time: '2026-06-02', description: 'TH006 现金销售 ฿890K，缴存仅 ฿720K，缺 ฿170K。', suggestion: '门店盘点。', status: 'pending', omsSide: '现金销售 ฿890,000', billSide: 'KBank 缴存 ฿720,000' },
    { id: 'D-0004', channel: 'L2', root: 'B1', rootLabel: 'T+N 跨月', amount: 1250000, expected: 0, diffAmt: 1250000, time: '2026-06-30', description: '6/29 结算 ฿1.25M 在 6/30 到账，跨日。', suggestion: '按 T+N 分解。', status: 'pending', omsSide: '银行入账 ฿1,250,000', billSide: '期望 0' },
  ]

  const freeOrders: FreeOrder[] = [
    { id: 'F-0001', orderNo: 'PG-20260611001', storeNo: 'TH012', amount: 0, total: 650, disc: 650, verify: 'ok', note: '正常免单（全额优惠）' },
    { id: 'F-0002', orderNo: 'PG-20260615002', storeNo: 'TH005', amount: 450, total: 450, disc: 0, verify: 'include', note: '标记免单但全额收款，须纳入收入' },
  ]

  const refunds: RefundItem[] = [
    { id: 'R-0001', orderNo: 'PG-20260609001', storeNo: 'TH010', status: 9, statusLabel: '退款', amount: 320, time: '2026-06-09', root: 'NORMAL', rootLabel: '正常退款闭环' },
    { id: 'R-0002', orderNo: 'PG-20260618001', storeNo: 'TH003', status: 8, statusLabel: '取消', amount: 120, time: '2026-06-18', root: 'NORMAL', rootLabel: '正常取消未扣款' },
  ]

  const coverage: CoverageCell[] = [
    { source: 1, payType: 1, cnt: 18500, amt: 8210000, owner: 'ONLINE', cover: true },
    { source: 1, payType: 2, cnt: 12700, amt: 5940000, owner: 'ONLINE', cover: true },
    { source: 2, payType: 1, cnt: 9800, amt: 4120000, owner: 'INSTORE', cover: true },
    { source: 2, payType: 3, cnt: 5000, amt: 2110000, owner: '现金缴存', cover: true },
    { source: 2, payType: 800, cnt: 60, amt: 35000, owner: '免单验证', cover: true },
  ]

  return {
    summary: {
      totalOrders: 52000,
      totalAmount: 20380000,
      overallMatchRate: '99.03%',
      diffCount: 96,
      diffAmount: 245000,
      uncovered: 0,
      taskId: 'TH-202606-001 (mock)',
      runAt: '2026-08-14 17:40',
    },
    omsByBusiness: [
      { key: 'web', label: 'channel=web', cnt: 20100, amt: 8210000, pct: 38.65 },
      { key: 'mobile', label: 'channel=mobile', cnt: 11100, amt: 4860000, pct: 21.35 },
      { key: 'pos', label: 'channel=pos', cnt: 15800, amt: 5210000, pct: 30.38 },
      { key: 'cash', label: 'channel=cash', cnt: 5000, amt: 2110000, pct: 9.62 },
    ],
    omsBySource: [
      { key: 'web', label: 'Web 端', cnt: 20100, amt: 8210000, pct: 38.65 },
      { key: 'mobile', label: 'Mobile 端', cnt: 11100, amt: 4860000, pct: 21.35 },
      { key: 'pos', label: 'POS 门店', cnt: 15800, amt: 5210000, pct: 30.38 },
      { key: 'cash', label: '现金', cnt: 5000, amt: 2110000, pct: 9.62 },
    ],
    omsByPayType: [
      { key: '1', label: 'pay_type=1（卡）', cnt: 28300, amt: 12330000, pct: 54.42 },
      { key: '2', label: 'pay_type=2（QR）', cnt: 12700, amt: 5940000, pct: 24.42 },
      { key: '3', label: 'pay_type=3（现金）', cnt: 5000, amt: 2110000, pct: 9.62 },
      { key: '800', label: 'pay_type=800（免单）', cnt: 60, amt: 35000, pct: 0.12 },
    ],
    omsByStatus: [
      { key: '6', label: 'status=6（已完成）', cnt: 51100, amt: 19980000, pct: 98.27 },
      { key: '8', label: 'status=8（取消）', cnt: 500, amt: 182000, pct: 0.96 },
      { key: '9', label: 'status=9（退款）', cnt: 400, amt: 120000, pct: 0.77 },
    ],
    channels: channelsData,
    bankDaily,
    bankRecon: {
      payooNet: 13260000,
      bankIn: 13980000,
      prevCross: 1250000,
      monthAttributed: 12710000,
      endUnsettled: 550000,
      status: 'success',
    },
    discrepancies,
    freeOrders,
    refunds,
    coverage,
  }
}

export const thProfile: CountryProfile = {
  id: 'th',
  name: '泰国 (Thailand)',
  countryZh: '泰国',
  flag: '🇹🇭',
  period: '2026-06',
  currency: {
    code: 'THB',
    symbol: '฿',
    short: fmtTHB,
    full: fmtTHBFull,
  },
  dateFmt: 'yyyy-MM-dd',
  locale: 'zh-CN',
  slots,
  channels,
  bankDef: {
    settleParty: 'PG',
    bankName: 'KBank',
    settleLabel: 'PG 结算',
    bankLabel: 'KBank 入账',
    matchRule: 'PG 关键词 · web/mobile→ONLINE / pos→INSTORE / BK cash→CASH',
    equation: 'PG净 = 银行归属本月 + 月末未到账',
    bankNote: '6 月末未到账 ฿55 万 ≈ 5 月末未到账 ฿60 万（差 ฿5 万，含手续费口径），建议补 7 月初流水闭环。',
  },
  rootEnums,
  rules,
  freeRefundDef,
  coverageDef,
  showModules,
  uploadHints,
  mappingTemplates,
  ui,
  demoData: buildDemoData,
}
