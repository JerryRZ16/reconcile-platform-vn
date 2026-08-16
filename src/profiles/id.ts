// ============================================================
// Country Profile · 印度尼西亚 (id)
// 印度尼西亚 2026-06 对账配置包（基于真实对账结论）。
// 核心通道：Xendit 聚合（GoPay/OVO/DANA/QRIS/CC）+ Grab(VISIONET) + Gojek(DAB)
//           + BCA 商户直连（QRIS/Debit/CC）；BCA 银行主收款户。
// 结算 Key：Xendit settlement_batch_id；Grab Settlement ID×Store×Transfer Date；
//           Gojek Settlement Date+1天；BCA 商户 Merchant Payment Date×MID×Nett。
// 演示数据基于印尼 6 月真实结论比例（BCA 341.70 亿 IDR，商户收单 304.66 亿 89.16%）。
// ============================================================
import type { CountryProfile } from './types'
import type { ReconResult, ChannelRecon, Discrepancy, FreeOrder, RefundItem, CoverageCell } from '../data/mockData'

// ---------- 印尼盾格式化 ----------
function fmtIDR(n: number): string {
  if (!n) return '0'
  const abs = Math.abs(n)
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)} 十亿`
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)} 百万`
  if (abs >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return n.toLocaleString('en-US')
}
function fmtIDRFull(n: number): string {
  return `Rp ${n.toLocaleString('en-US')}`
}

// ---------- 文件槽位（印尼 settlement 模型：结算账单 + BCA 银行） ----------
const slots: CountryProfile['slots'] = [
  {
    key: 'oms', title: 'OMS 订单', desc: '订单主表导出 · CSV / XLSX',
    required: false, icon: 'excel', color: '#b91c1c', kind: 'oms',
    fields: 'order_no · pay_type · pay_amt · store_no · order_status',
  },
  {
    key: 'xendit', title: 'Xendit 结算账单', desc: 'Xendit 聚合（GoPay/OVO/DANA/QRIS/CC）结算 · CSV',
    required: true, icon: 'text', color: '#b45309', kind: 'bill',
    fields: 'settle_date · amount · batch_id',
  },
  {
    key: 'gojek', title: 'Gojek 结算账单', desc: 'Gojek(DAB) 每日结算 · CSV',
    required: false, icon: 'text', color: '#6d28d9', kind: 'bill',
    fields: 'Settlement Date · Net Amount',
  },
  {
    key: 'grab', title: 'Grab 结算账单', desc: 'Grab(VISIONET) 每日结算 · CSV',
    required: false, icon: 'text', color: '#7c3aed', kind: 'bill',
    fields: '日期 · Total(打款)',
  },
  {
    key: 'bca', title: 'BCA 商户账单', desc: 'BCA 商户直连（QRIS/Debit/CC）· CSV',
    required: false, icon: 'text', color: '#0ea5e9', kind: 'bill',
    fields: '日期 · 账单Nett(TQ)',
  },
  {
    key: 'bank', title: 'BCA 银行流水', desc: 'BCA 主收款户对账单 · CSV/XLSX',
    required: true, icon: 'excel', color: '#15803d', kind: 'bank',
    fields: 'tran_date · amount · Keterangan(摘要)',
  },
]

// ---------- 通道定义（印尼 settlement：XENDIT / GOJEK / GRAB / BCA） ----------
const channels: CountryProfile['channels'] = [
  {
    channel: 'XENDIT',
    label: 'Xendit 聚合（GoPay/OVO/DANA/QRIS/CC）',
    note: 'Xendit 22 大批次结算 ↔ BCA 单笔到账（月累计对平，跨月 23.55 亿）',
  },
  {
    channel: 'GOJEK',
    label: 'Gojek（DAB · GoPay）',
    note: 'Settlement Date + 1 天 = BCA 到账日，按日净额对平',
  },
  {
    channel: 'GRAB',
    label: 'Grab（VISIONET）',
    note: 'Settlement ID×Store×Transfer Date×Total；跨月效应大，月累计对平',
  },
  {
    channel: 'BCA',
    label: 'BCA 商户直连（QRIS/Debit/CC）',
    note: 'Merchant Payment Date × Merchant ID × Nett Amount（TQ=QRIS / TD=Debit / TC=CC）',
  },
]

// ---------- 根因枚举（印尼自定义） ----------
const rootEnums: CountryProfile['rootEnums'] = [
  { root: 'I1', label: '跨月结算（次月到账）', color: 'blue' },
  { root: 'I2', label: '金额不一致', color: 'volcano' },
  { root: 'I3', label: '信用卡 CC 工作日时点差', color: 'purple' },
  { root: 'I4', label: 'Grab Completed 未结算', color: 'cyan' },
  { root: 'I5', label: '非收单流水（FX/BI-FAST/加盟金）', color: 'geekblue' },
  { root: 'B1', label: '银行对账差异', color: 'orange' },
]

// ---------- 规则元数据 ----------
const rules: CountryProfile['rules'] = [
  { key: 'r1', name: 'OMS 四维总览', desc: 'business_type / order_source / pay_type / status 统计' },
  { key: 'r2', name: 'L1 · Xendit 聚合', desc: 'Xendit settlement_batch_id ↔ BCA 单笔到账（22 批次）' },
  { key: 'r3', name: 'L1 · Gojek/Grab', desc: 'Gojek DAB / Grab VISIONET 按结算 Key 匹配' },
  { key: 'r4', name: 'L1 · BCA 商户直连', desc: 'TQ/TD/TC 三类 ↔ BCA 银行流水按日对平' },
  { key: 'r5', name: 'L2 · 银行对账', desc: '通道结算 ↔ BCA 流水按日对平（跨月分解）' },
  { key: 'r6', name: '免单 / 退款 / 全覆盖', desc: '免单验证 · 退款/取消归集 · 全覆盖检查' },
]

// ---------- 免单 / 退款定义（印尼码值，标注需确认） ----------
const freeRefundDef: CountryProfile['freeRefundDef'] = {
  freePayType: [999],          // ⚠️ 印尼免单 pay_type 待确认，先用占位
  refundStatus: [8],           // ⚠️ 待确认
  cancelStatus: [7],
  freeTitle: '免单验证（pay_type=999 · 待确认）',
  refundTitle: '退款 / 取消归集（不计入收入确认）',
  verifyLabels: {
    ok: { label: '正常免单', color: 'green' },
    include: { label: '全额收款 · 纳入收入', color: 'red' },
    manual: { label: '需人工确认', color: 'orange' },
  },
}

// ---------- 全覆盖定义 ----------
const coverageDef: CountryProfile['coverageDef'] = {
  dims: ['pay_type', 'order_source'],
  title: '全覆盖检查（pay_type × order_source 组合归属）',
  colLabel: '金额',
}

// ---------- 结果模块开关 ----------
const showModules: CountryProfile['showModules'] = [
  'metricCards', 'channelCards', 'omsOverview', 'bankRecon',
  'discrepancyTable', 'freeOrders', 'refunds', 'coverageMatrix',
]

// ---------- 文件名归属校验 ----------
const uploadHints: CountryProfile['uploadHints'] = {
  oms: ['oms', 'order', '交易'],
  xendit: ['xendit', 'settlement', '聚合'],
  gojek: ['gojek', 'dab', 'gopay'],
  grab: ['grab', 'visionet'],
  bca: ['bca', '商户', 'qris', 'debit', 'credit'],
  bank: ['bca', 'bank', 'statement', '流水', 'keterangan'],
}

// ---------- 预置映射模板 ----------
const mappingTemplates: CountryProfile['mappingTemplates'] = [
  {
    file: 'OMS 订单',
    requiredOk: true,
    sourceOptions: ['order_no', 'pay_type', 'pay_amt', 'total_amt', 'store_no', 'order_status', 'ext.thirdOrderNo', 'pay_no', 'ext.posOrderNo', 'order_time'],
    rows: [
      { target: 'order_no', label: '订单号', source: 'order_no', required: true, type: 'direct' },
      { target: 'pay_type', label: '支付方式', source: 'pay_type', required: true, type: 'direct' },
      { target: 'pay_amt', label: '支付金额（IDR）', source: 'pay_amt', required: true, type: 'direct' },
      { target: 'total_amt', label: '订单总额（IDR）', source: 'total_amt', required: true, type: 'direct' },
      { target: 'store_no', label: '门店号', source: 'store_no', required: true, type: 'direct' },
      { target: 'order_status', label: '订单状态', source: 'order_status', required: true, type: 'direct' },
      { target: 'pay_no', label: '支付单号（Xendit 桥）', source: 'pay_no', required: false, type: 'direct' },
      { target: 'third_order_no', label: '平台单号（Grab/Gojek）', source: 'ext.thirdOrderNo', required: false, type: 'direct' },
      { target: 'pos_order_no', label: 'POS 单号（BCA 桥）', source: 'ext.posOrderNo', required: false, type: 'direct' },
      { target: 'pay_finished_time', label: '支付完成时间', source: 'order_time', required: false, type: 'direct' },
    ],
  },
  {
    file: 'Xendit 账单',
    requiredOk: true,
    sourceOptions: ['settlement_batch_id', 'amount', 'settle_date', 'channel', 'payment_method'],
    rows: [
      { target: 'batch_id', label: '结算批次号', source: 'settlement_batch_id', required: true, type: 'direct' },
      { target: 'amount', label: '金额（IDR）', source: 'amount', required: true, type: 'direct' },
      { target: 'settle_date', label: '结算日期', source: 'settle_date', required: true, type: 'direct' },
      { target: 'channel', label: '渠道（GoPay/OVO/DANA/QRIS/CC）', source: 'channel', required: false, type: 'direct' },
    ],
  },
  {
    file: 'Gojek 结算账单',
    requiredOk: false,
    sourceOptions: ['Settlement Date', 'Net Amount', 'Amount', '笔数'],
    rows: [
      { target: 'settle_date', label: '结算日期', source: 'Settlement Date', required: true, type: 'direct' },
      { target: 'amount', label: '净额 Net Amount', source: 'Net Amount', required: true, type: 'direct' },
      { target: 'count', label: '笔数', source: '笔数', required: false, type: 'direct' },
    ],
  },
  {
    file: 'Grab 结算账单',
    requiredOk: false,
    sourceOptions: ['日期', 'Total(打款)', 'Amount', 'Net Sales', 'Grab Settlement 数'],
    rows: [
      { target: 'settle_date', label: '结算日期', source: '日期', required: true, type: 'direct' },
      { target: 'amount', label: '打款 Total', source: 'Total(打款)', required: true, type: 'direct' },
      { target: 'count', label: '结算数', source: 'Grab Settlement 数', required: false, type: 'direct' },
    ],
  },
  {
    file: 'BCA 商户账单',
    requiredOk: false,
    sourceOptions: ['日期', '账单Nett(TQ)', '账单笔数', '银行到账(QRIS)'],
    rows: [
      { target: 'settle_date', label: '对账日期', source: '日期', required: true, type: 'direct' },
      { target: 'amount', label: '账单 Nett', source: '账单Nett(TQ)', required: true, type: 'direct' },
      { target: 'count', label: '账单笔数', source: '账单笔数', required: false, type: 'direct' },
    ],
  },
  {
    file: 'BCA 银行流水',
    requiredOk: false,
    sourceOptions: ['tran_date', 'value_date', 'amount', 'description', 'Keterangan'],
    rows: [
      { target: 'tran_date', label: '交易日期', source: 'tran_date', required: false, type: 'direct' },
      { target: 'amount', label: '金额（IDR）', source: 'amount', required: false, type: 'direct' },
      { target: 'description', label: '摘要 Keterangan', source: 'description', required: false, type: 'direct' },
    ],
  },
]

// ---------- 界面文案 ----------
const ui: CountryProfile['ui'] = {
  uploadIntro: '拖拽或点击上传文件（CSV / XLSX，≤200MB，UTF-8）。平台即时校验格式与文件名归属，校验通过后进入字段映射。',
  uploadDemo: '演示模式已内置「印度尼西亚 2026-06」真实比例示例数据，可直接继续。',
  uploadFlowHint: '① 上传 OMS 订单与 Xendit/超级App/BCA 文件 → ② 确认字段映射 → ③ 运行对账规则 → ④ 查看可视化结果',
  runningSubtitle: '已加载印度尼西亚 2026-06 示例数据：OMS 全量 · Xendit / 超级App / BCA 账单文件',
  resultDemoNote: '本结果基于印度尼西亚 2026-06 真实对账比例生成（Xendit 43.8% / Grab 9.8% / Gojek 5.3% / BCA 商户 30.3%），演示多国适配链路。对接后端 API 时替换 runReconciliation 即可。',
  resultTitle: '印度尼西亚 2026-06 全通道对账结果',
}

// ---------- 演示数据生成器（基于印尼 6 月真实结论比例） ----------
function buildDemoData(): ReconResult {
  const channelsData: ChannelRecon[] = [
    { channel: 'XENDIT', label: 'Xendit 聚合（GoPay/OVO/DANA/QRIS/CC）', omsCount: 22, billCount: 22, matchedCount: 22, matchRate: 100, unmatchedCount: 0, unmatchedAmt: 2355000000, status: 'success', note: 'Xendit 大批次结算 ↔ BCA 到账，月累计对平（跨月 23.55 亿）' },
    { channel: 'GOJEK', label: 'Gojek（DAB · GoPay）', omsCount: 30, billCount: 30, matchedCount: 29, matchRate: 96.14, unmatchedCount: 1, unmatchedAmt: 2000000, status: 'success', note: 'Settlement Date + 1 天 = BCA 到账日，按日净额对平' },
    { channel: 'GRAB', label: 'Grab（VISIONET）', omsCount: 31, billCount: 31, matchedCount: 31, matchRate: 100, unmatchedCount: 0, unmatchedAmt: 577000000, status: 'warning', note: 'Settlement ID×Store×Transfer Date×Total；跨月效应大，月累计对平' },
    { channel: 'BCA', label: 'BCA 商户直连（QRIS/Debit/CC）', omsCount: 31, billCount: 31, matchedCount: 29, matchRate: 97.05, unmatchedCount: 2, unmatchedAmt: 498000000, status: 'warning', note: 'TQ=QRIS / TD=Debit / TC=CC，按日对平' },
  ]

  const bankDaily = Array.from({ length: 30 }, (_, i) => {
    const day = i + 1
    const p = 1000000000 + day * 40000000 + (day % 3) * 15000000
    const t = p + (day % 5 === 0 ? 0 : (day % 2 ? 8000000 : -6000000))
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
    { id: 'D-0001', channel: 'XENDIT', root: 'I1', rootLabel: '跨月结算（次月到账）', orderNo: 'XENDIT-20260601001', storeNo: 'ID012', amount: 2355000000, time: '2026-06-30', description: 'Xendit 6 月末结算批次在 7 月到账，跨月 23.55 亿 IDR。', suggestion: '等 7 月 Xendit Settlement 报表补。', status: 'pending', omsSide: 'Xendit 结算 125.98 亿', billSide: 'BCA 到账 149.53 亿' },
    { id: 'D-0002', channel: 'BCA', root: 'I3', rootLabel: '信用卡 CC 工作日时点差', orderNo: 'BCA-20260615022', storeNo: 'ID008', amount: 265000000, time: '2026-06-15', description: '信用卡 CC 每周 5 天银行到账 > TC，疑似 Foreign Card 延迟结算。', suggestion: '与 BCA 确认 Foreign Card / 银联中转通道。', status: 'pending', omsSide: '商户账单 TC 11.73 亿', billSide: 'BCA CC 到账 14.38 亿' },
    { id: 'D-0003', channel: 'GRAB', root: 'I4', rootLabel: 'Grab Completed 未结算', orderNo: 'GRAB-20260625001', storeNo: 'ID006', amount: 473000000, time: '2026-06-25', description: 'Grab Completed 状态订单 6/22-6/30 生成未结算，7 月陆续到账。', suggestion: '等 7 月 Grab Report 补。', status: 'pending', omsSide: 'Grab Total 27.71 亿', billSide: 'BCA VISIONET 到账 33.48 亿' },
    { id: 'D-0004', channel: 'L2', root: 'B1', rootLabel: '非收单流水', amount: 3480000000, expected: 0, diffAmt: 3480000000, time: '2026-06-30', description: 'FX 跨境 / BI-FAST / 加盟金 / 利息 等非商户收单，不纳入对账。', suggestion: '排除非收单流水。', status: 'pending', omsSide: 'BCA 入账 34.80 亿', billSide: '非收单，不核对' },
  ]

  const freeOrders: FreeOrder[] = [
    { id: 'F-0001', orderNo: 'ID-20260611001', storeNo: 'ID012', amount: 0, total: 35000, disc: 35000, verify: 'ok', note: '正常免单（全额优惠）' },
    { id: 'F-0002', orderNo: 'ID-20260615002', storeNo: 'ID005', amount: 25000, total: 25000, disc: 0, verify: 'include', note: '标记免单但全额收款，须纳入收入' },
  ]

  const refunds: RefundItem[] = [
    { id: 'R-0001', orderNo: 'ID-20260609001', storeNo: 'ID010', status: 8, statusLabel: '退款', amount: 32000, time: '2026-06-09', root: 'NORMAL', rootLabel: '正常退款闭环' },
    { id: 'R-0002', orderNo: 'ID-20260618001', storeNo: 'ID003', status: 7, statusLabel: '取消', amount: 12000, time: '2026-06-18', root: 'NORMAL', rootLabel: '正常取消未扣款' },
  ]

  const coverage: CoverageCell[] = [
    { source: 9, payType: 4, cnt: 62000, amt: 5200000000, owner: 'Xendit', cover: true },
    { source: 9, payType: 2, cnt: 48000, amt: 4100000000, owner: 'Xendit GoPay', cover: true },
    { source: 4, payType: 4, cnt: 53000, amt: 4900000000, owner: 'BCA 商户', cover: true },
    { source: 4, payType: 98, cnt: 32000, amt: 2480000000, owner: '现金缴存', cover: true },
    { source: 9, payType: 504, cnt: 26000, amt: 2700000000, owner: 'GrabFood', cover: true },
  ]

  return {
    summary: {
      totalOrders: 341200,
      totalAmount: 30466000000,
      overallMatchRate: '96.63%',
      diffCount: 342,
      diffAmount: 3443000000,
      uncovered: 0,
      taskId: 'ID-202606-001 (mock)',
      runAt: '2026-08-15 11:10',
    },
    omsByBusiness: [
      { key: '1', label: '堂食', cnt: 128000, amt: 9800000000, pct: 37.52 },
      { key: '2', label: '外卖三方', cnt: 86000, amt: 8200000000, pct: 25.22 },
      { key: '3', label: '打包', cnt: 91000, amt: 8300000000, pct: 26.68 },
      { key: '11', label: '外卖自营', cnt: 36200, amt: 4146000000, pct: 10.58 },
    ],
    omsBySource: [
      { key: '4', label: 'POS 门店', cnt: 176000, amt: 15440000000, pct: 51.58 },
      { key: '9', label: 'APP 端', cnt: 165200, amt: 15022000000, pct: 48.42 },
    ],
    omsByPayType: [
      { key: '4', label: 'pay_type=4（卡）', cnt: 115000, amt: 10100000000, pct: 33.15 },
      { key: '2', label: 'pay_type=2（QRIS/GoPay）', cnt: 48000, amt: 4100000000, pct: 13.46 },
      { key: '504', label: 'pay_type=504（GrabFood）', cnt: 26000, amt: 2700000000, pct: 8.86 },
      { key: '98', label: 'pay_type=98（现金）', cnt: 32000, amt: 2480000000, pct: 8.14 },
      { key: '其他', label: 'OVO/DANA/Gojek/CC 等', cnt: 120200, amt: 11056000000, pct: 36.29 },
    ],
    omsByStatus: [
      { key: '6', label: 'status=6（已完成）', cnt: 334000, amt: 29800000000, pct: 97.89 },
      { key: '7', label: 'status=7（取消）', cnt: 4800, amt: 420000000, pct: 1.41 },
      { key: '8', label: 'status=8（退款）', cnt: 2400, amt: 246000000, pct: 0.70 },
    ],
    channels: channelsData,
    bankDaily,
    bankRecon: {
      payooNet: 30466000000,
      bankIn: 34170000000,
      prevCross: 2370000000,
      monthAttributed: 30460000000,
      endUnsettled: 2460000000,
      status: 'success',
    },
    discrepancies,
    freeOrders,
    refunds,
    coverage,
  }
}

export const idProfile: CountryProfile = {
  id: 'id',
  name: '印度尼西亚 (Indonesia)',
  countryZh: '印度尼西亚',
  flag: '🇮🇩',
  period: '2026-06',
  currency: {
    code: 'IDR',
    symbol: 'Rp',
    short: fmtIDR,
    full: fmtIDRFull,
  },
  dateFmt: 'yyyy-MM-dd',
  locale: 'zh-CN',
  slots,
  channels,
  bankDef: {
    settleParty: 'Xendit/超级App/BCA商户',
    bankName: 'BCA',
    settleLabel: '通道结算',
    bankLabel: 'BCA 入账',
    matchRule: 'Xendit settlement_batch_id；Grab Settlement ID×Store×Transfer Date；Gojek Settlement Date+1；BCA 商户 MID×Nett',
    equation: '通道结算 = 银行归属本月 + 月末未到账',
    bankNote: '6 月末未到账 ≈ 23.55 亿 IDR（Xendit 跨月）+ Grab/Gojek/CC 跨月部分；非收单流水 34.80 亿（FX/BI-FAST/加盟金）不纳入对账。',
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
