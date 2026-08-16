// ============================================================
// Country Profile · 菲律宾 (ph)
// 菲律宾 2026-06 对账配置包（基于真实对账终稿 v1.0）。
// 核心通道：Online Antom（卡-APP/GCash/Maya）+ Offline Antom（卡-POS/QRPh）
//           + Grab（GrabPay）+ Cash（BDO 门店存款）。
// 双银行：HSBC(026-404012-040) 第三方支付收单 + BDO(001680489818) 门店现金存款。
// 匹配桥：pay_no ↔ customizedField2（Online）；ext.posOrderNo ↔ referenceTransactionId（Offline）；
//           ext.thirdOrderNo ↔ Long Order ID（Grab）。
// 演示数据基于菲律宾 6 月真实结论（OMS 172,687 笔 · PHP 50.09M · 全通道闭环）。
// ============================================================
import type { CountryProfile } from './types'
import type { ReconResult, ChannelRecon, Discrepancy, FreeOrder, RefundItem, CoverageCell } from '../data/mockData'

// ---------- 比索格式化 ----------
function fmtPHP(n: number): string {
  if (!n) return '0'
  const abs = Math.abs(n)
  if (abs >= 1e6) return `PHP ${(n / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `PHP ${(n / 1e3).toFixed(0)}K`
  return `PHP ${n.toLocaleString('en-US')}`
}
function fmtPHPFull(n: number): string {
  return `₱ ${n.toLocaleString('en-US')}`
}

// ---------- 文件槽位（菲律宾：OMS + Online/Offline Antom + Grab + 双银行） ----------
const slots: CountryProfile['slots'] = [
  {
    key: 'oms', title: 'OMS 订单', desc: '订单主表导出 · CSV / XLSX',
    required: true, icon: 'excel', color: '#b91c1c', kind: 'oms',
    fields: 'order_no · pay_type · pay_amt · store_no · order_status',
  },
  {
    key: 'antom_online', title: 'Online Antom 账单', desc: 'Online Antom Settlement · CSV',
    required: true, icon: 'text', color: '#b45309', kind: 'bill',
    fields: 'customizedField2(=pay_no) · transactionAmountValue · paymentTime',
  },
  {
    key: 'antom_offline', title: 'Offline Antom 账单', desc: 'Offline Antom Settlement · CSV',
    required: true, icon: 'text', color: '#7c3aed', kind: 'bill',
    fields: 'referenceTransactionId(=posOrderNo) · transactionAmountValue · paymentTime',
  },
  {
    key: 'grab', title: 'Grab 账单', desc: 'Grab 结算账单 · CSV',
    required: false, icon: 'text', color: '#6d28d9', kind: 'bill',
    fields: 'Long Order ID · Amount · Net Sales · Total',
  },
  {
    key: 'bank', title: 'HSBC / BDO 银行流水', desc: 'HSBC 收单 + BDO 现金存款 · CSV/XLSX',
    required: false, icon: 'excel', color: '#15803d', kind: 'bank',
    fields: 'tran_date · amount · narrative',
  },
]

// ---------- 通道定义（菲律宾 L1：ONLINE/INSTORE/GRAB/CASH） ----------
const channels: CountryProfile['channels'] = [
  {
    channel: 'ONLINE',
    label: 'Online Antom（卡-APP · GCash · Maya）',
    note: 'pay_no ↔ Online customizedField2；结算方 ALIPAY PHILIPPINES → HSBC T+1~3',
  },
  {
    channel: 'INSTORE',
    label: 'Offline Antom（卡-POS · QRPh）',
    note: 'ext.posOrderNo ↔ Offline referenceTransactionId；结算方 RAZER MERCHANT → HSBC T+0',
  },
  {
    channel: 'GRAB',
    label: 'Grab（GrabPay）',
    note: 'ext.thirdOrderNo ↔ Long Order ID；结算方 GPAY NETWORK → HSBC T+0',
  },
  {
    channel: 'CASH',
    label: '现金（pay_type=98 · BDO 门店存款）',
    note: 'OMS 现金销售按门店聚合 vs BDO 存款（跨月递延解释）',
  },
]

// ---------- 根因枚举（菲律宾自定义） ----------
const rootEnums: CountryProfile['rootEnums'] = [
  { root: 'P1', label: '月末 T+1/T+2 结算延迟', color: 'blue' },
  { root: 'P2', label: '金额不一致', color: 'volcano' },
  { root: 'P3', label: '跨月递延（5月末/7月初）', color: 'purple' },
  { root: 'P4', label: 'QRPh 通道缺失', color: 'cyan' },
  { root: 'P5', label: '门店现金缺口', color: 'geekblue' },
  { root: 'B1', label: '银行对账差异', color: 'orange' },
]

// ---------- 规则元数据 ----------
const rules: CountryProfile['rules'] = [
  { key: 'r1', name: 'OMS 四维总览', desc: 'business_type / order_source / pay_type / status 统计' },
  { key: 'r2', name: 'L1 · Online Antom', desc: 'pay_no ↔ customizedField2；卡-APP/GCash/Maya' },
  { key: 'r3', name: 'L1 · Offline Antom', desc: 'ext.posOrderNo ↔ referenceTransactionId；卡-POS/QRPh' },
  { key: 'r4', name: 'L1 · Grab', desc: 'ext.thirdOrderNo ↔ Long Order ID' },
  { key: 'r5', name: 'L1 · 现金', desc: 'pay_type=98 门店聚合 ↔ BDO 存款（跨月递延）' },
  { key: 'r6', name: 'L2 · 银行对账', desc: 'Antom/Grab 结算 ↔ HSBC 流水；Cash ↔ BDO（跨月分解）' },
]

// ---------- 免单 / 退款定义（菲律宾码值，标注需确认） ----------
const freeRefundDef: CountryProfile['freeRefundDef'] = {
  freePayType: [500],          // ⚠️ 菲律宾免单/异常 pay_type 待确认，先用 500（参照越南）
  refundStatus: [8],           // ⚠️ 待确认
  cancelStatus: [7],
  freeTitle: '免单验证（pay_type=500 · 待确认）',
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
  antom_online: ['online', 'antom', 'settlement', 'alipay'],
  antom_offline: ['offline', 'antom', 'settlement', 'razer'],
  grab: ['grab', 'gpay', 'grabpay'],
  bank: ['hsbc', 'bdo', 'bank', 'statement', '流水'],
}

// ---------- 预置映射模板 ----------
const mappingTemplates: CountryProfile['mappingTemplates'] = [
  {
    file: 'OMS 订单',
    requiredOk: true,
    sourceOptions: ['order_no', 'pay_type', 'pay_amt', 'total_amt', 'store_no', 'order_status', 'pay_no', 'ext.posOrderNo', 'ext.thirdOrderNo', 'order_time'],
    rows: [
      { target: 'order_no', label: '订单号', source: 'order_no', required: true, type: 'direct' },
      { target: 'pay_type', label: '支付方式', source: 'pay_type', required: true, type: 'direct' },
      { target: 'pay_amt', label: '支付金额（PHP）', source: 'pay_amt', required: true, type: 'direct' },
      { target: 'total_amt', label: '订单总额（PHP）', source: 'total_amt', required: true, type: 'direct' },
      { target: 'store_no', label: '门店号', source: 'store_no', required: true, type: 'direct' },
      { target: 'order_status', label: '订单状态', source: 'order_status', required: true, type: 'direct' },
      { target: 'pay_no', label: '支付单号（Online Antom 桥）', source: 'pay_no', required: false, type: 'direct' },
      { target: 'pos_order_no', label: 'POS 单号（Offline Antom 桥）', source: 'ext.posOrderNo', required: false, type: 'direct' },
      { target: 'third_order_no', label: 'Grab 平台单号', source: 'ext.thirdOrderNo', required: false, type: 'direct' },
      { target: 'pay_finished_time', label: '支付完成时间', source: 'order_time', required: false, type: 'direct' },
    ],
  },
  {
    file: 'Online Antom 账单',
    requiredOk: true,
    sourceOptions: ['customizedField2', 'transactionAmountValue', 'paymentTime', 'paymentMethodType', 'transactionType'],
    rows: [
      { target: 'order_no', label: '商户订单号', source: 'customizedField2', required: true, hint: '= OMS pay_no（CHP）' },
      { target: 'amount', label: '金额（PHP）', source: 'transactionAmountValue', required: true, type: 'direct' },
      { target: 'pay_date', label: '支付时间', source: 'paymentTime', required: true, type: 'direct' },
      { target: 'pay_method', label: '支付方式（GCASH/CARD/MAYA）', source: 'paymentMethodType', required: false, type: 'direct' },
      { target: 'txn_type', label: '交易类型', source: 'transactionType', required: false, type: 'direct' },
    ],
  },
  {
    file: 'Offline Antom 账单',
    requiredOk: true,
    sourceOptions: ['referenceTransactionId', 'transactionAmountValue', 'paymentTime', 'paymentMethodType', 'transactionType'],
    rows: [
      { target: 'order_no', label: 'POS 单号', source: 'referenceTransactionId', required: true, hint: '= OMS ext.posOrderNo' },
      { target: 'amount', label: '金额（PHP）', source: 'transactionAmountValue', required: true, type: 'direct' },
      { target: 'pay_date', label: '支付时间', source: 'paymentTime', required: true, type: 'direct' },
      { target: 'pay_method', label: '支付方式', source: 'paymentMethodType', required: false, type: 'direct' },
      { target: 'txn_type', label: '交易类型', source: 'transactionType', required: false, type: 'direct' },
    ],
  },
  {
    file: 'Grab 账单',
    requiredOk: false,
    sourceOptions: ['Long Order ID', 'Amount', 'Net Sales', 'Total', 'Store Name', 'Transfer Date'],
    rows: [
      { target: 'long_order_id', label: 'Grab 长单号', source: 'Long Order ID', required: false, type: 'direct' },
      { target: 'amount', label: 'Amount（顾客付）', source: 'Amount', required: false, type: 'direct' },
      { target: 'net_sales', label: 'Net Sales', source: 'Net Sales', required: false, type: 'direct' },
      { target: 'total', label: 'Total（实收）', source: 'Total', required: false, type: 'direct' },
      { target: 'store_name', label: '门店名', source: 'Store Name', required: false, type: 'direct' },
    ],
  },
  {
    file: 'HSBC / BDO 银行流水',
    requiredOk: false,
    sourceOptions: ['tran_date', 'value_date', 'amount', 'narrative', 'description'],
    rows: [
      { target: 'tran_date', label: '交易日期', source: 'tran_date', required: false, type: 'direct' },
      { target: 'amount', label: '金额（PHP）', source: 'amount', required: false, type: 'direct' },
      { target: 'narrative', label: '摘要 narrative', source: 'narrative', required: false, type: 'direct' },
    ],
  },
]

// ---------- 界面文案 ----------
const ui: CountryProfile['ui'] = {
  uploadIntro: '拖拽或点击上传文件（CSV / XLSX，≤200MB，UTF-8）。平台即时校验格式与文件名归属，校验通过后进入字段映射。',
  uploadDemo: '演示模式已内置「菲律宾 2026-06」真实比例示例数据，可直接继续。',
  uploadFlowHint: '① 上传 OMS 订单与 Antom/Grab/银行文件 → ② 确认字段映射 → ③ 运行对账规则 → ④ 查看可视化结果',
  runningSubtitle: '已加载菲律宾 2026-06 示例数据：OMS 172,687 笔 · Antom / Grab / HSBC / BDO 账单文件',
  resultDemoNote: '本结果基于菲律宾 2026-06 真实对账比例生成（Online 99.9999% / Offline 99.6% / Grab 99.8% / Cash 93.5%），演示多国适配链路。对接后端 API 时替换 runReconciliation 即可。',
  resultTitle: '菲律宾 2026-06 全通道对账结果',
}

// ---------- 演示数据生成器（基于菲律宾 6 月真实结论） ----------
function buildDemoData(): ReconResult {
  const channelsData: ChannelRecon[] = [
    { channel: 'ONLINE', label: 'Online Antom（卡-APP · GCash · Maya）', omsCount: 53725, billCount: 70669, matchedCount: 53725, matchRate: 100.00, unmatchedCount: 0, unmatchedAmt: 0, status: 'success', note: 'pay_no ↔ customizedField2；结算方 ALIPAY PHILIPPINES → HSBC' },
    { channel: 'INSTORE', label: 'Offline Antom（卡-POS · QRPh）', omsCount: 44182, billCount: 40827, matchedCount: 41095, matchRate: 93.01, unmatchedCount: 3087, unmatchedAmt: 821765, status: 'warning', note: 'ext.posOrderNo ↔ referenceTransactionId；结算方 RAZER MERCHANT → HSBC' },
    { channel: 'GRAB', label: 'Grab（GrabPay）', omsCount: 24163, billCount: 24335, matchedCount: 24118, matchRate: 99.81, unmatchedCount: 45, unmatchedAmt: 212031, status: 'success', note: 'ext.thirdOrderNo ↔ Long Order ID；GPAY NETWORK → HSBC' },
    { channel: 'CASH', label: '现金（pay_type=98 · BDO 门店存款）', omsCount: 43669, billCount: 531, matchedCount: 43669, matchRate: 100.00, unmatchedCount: 0, unmatchedAmt: 0, status: 'success', note: 'OMS 现金销售按门店聚合 vs BDO 存款（跨月递延解释）' },
  ]

  const bankDaily = Array.from({ length: 30 }, (_, i) => {
    const day = i + 1
    const p = 1700000 + day * 70000 + (day % 3) * 30000
    const t = p + (day % 5 === 0 ? 0 : (day % 2 ? 20000 : -25000))
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
    { id: 'D-0001', channel: 'ONLINE', root: 'P1', rootLabel: '月末 T+1/T+2 结算延迟', orderNo: 'PH-20260628001', storeNo: 'PH012', amount: 342000, time: '2026-06-28', description: '6/28-6/30 订单 T+1/T+2 结算，账单 7 月初才出，占未匹配 85%。', suggestion: '7 月初账单补充后覆盖。', status: 'pending', omsSide: 'OMS 已收', billSide: 'Antom 7 月初结算' },
    { id: 'D-0002', channel: 'INSTORE', root: 'P4', rootLabel: 'QRPh 通道缺失', orderNo: 'PH-20260615022', storeNo: 'PH008', amount: 4320, time: '2026-06-15', description: 'QRPh 4,320 笔 OMS 侧找不到对应通道。', suggestion: '财务/产研追查 QRPh 归属。', status: 'pending', omsSide: 'OMS 待归', billSide: 'Offline QRPH 4,320 笔' },
    { id: 'D-0003', channel: 'CASH', root: 'P3', rootLabel: '跨月递延（5月末/7月初）', orderNo: 'CASH-20260630001', storeNo: 'PH020', amount: 592637, time: '2026-06-30', description: '6/29-6/30 现金销售 7 月才存 BDO（592,637 PHP）；5 月末存款 6 月入账（1,616,804 PHP）。', suggestion: '跨月效应解释，非账务问题。', status: 'pending', omsSide: 'OMS 现金销售', billSide: 'BDO 存款滞后' },
    { id: 'D-0004', channel: 'L2', root: 'B1', rootLabel: '银行跨月差异', amount: 778403, expected: 0, diffAmt: 778403, time: '2026-06-30', description: 'Grab 银行 6/01 到账含 5 月末结算，7/01 Transfer 未在 6 月银行中。', suggestion: '按 T+N 跨月分解。', status: 'pending', omsSide: '银行入账', billSide: '期望 0' },
  ]

  const freeOrders: FreeOrder[] = [
    { id: 'F-0001', orderNo: 'PH-20260611001', storeNo: 'PH012', amount: 0, total: 350, disc: 350, verify: 'ok', note: '正常免单（全额优惠）' },
    { id: 'F-0002', orderNo: 'PH-20260615002', storeNo: 'PH005', amount: 250, total: 250, disc: 0, verify: 'include', note: '标记免单但全额收款，须纳入收入' },
  ]

  const refunds: RefundItem[] = [
    { id: 'R-0001', orderNo: 'PH-20260609001', storeNo: 'PH010', status: 8, statusLabel: '退款', amount: 320, time: '2026-06-09', root: 'NORMAL', rootLabel: '正常退款闭环' },
    { id: 'R-0002', orderNo: 'PH-20260618001', storeNo: 'PH003', status: 7, statusLabel: '取消', amount: 120, time: '2026-06-18', root: 'NORMAL', rootLabel: '正常取消未扣款' },
  ]

  const coverage: CoverageCell[] = [
    { source: 9, payType: 4, cnt: 15481, amt: 4300592, owner: 'Online Antom', cover: true },
    { source: 9, payType: 52, cnt: 34640, amt: 8694492, owner: 'Online Antom', cover: true },
    { source: 9, payType: 53, cnt: 3604, amt: 887872, owner: 'Online Antom', cover: true },
    { source: 4, payType: 4, cnt: 32038, amt: 9070073, owner: 'Offline Antom', cover: true },
    { source: 4, payType: 55, cnt: 12144, amt: 2900250, owner: 'Offline Antom', cover: true },
    { source: 9, payType: 504, cnt: 24163, amt: 12788874, owner: 'Grab', cover: true },
    { source: 4, payType: 98, cnt: 43669, amt: 10549004, owner: 'Cash BDO', cover: true },
    { source: 4, payType: 54, cnt: 3680, amt: 886244, owner: 'QRPh 待办', cover: false },
  ]

  return {
    summary: {
      totalOrders: 172687,
      totalAmount: 50088792,
      overallMatchRate: '97.83%',
      diffCount: 146,
      diffAmount: 2696786,
      uncovered: 0,
      taskId: 'PH-202606-001 (mock)',
      runAt: '2026-08-15 11:20',
    },
    omsByBusiness: [
      { key: '1', label: '堂食', cnt: 52000, amt: 14200000, pct: 30.11 },
      { key: '2', label: '外卖三方', cnt: 41000, amt: 13800000, pct: 23.74 },
      { key: '3', label: '打包', cnt: 58000, amt: 16500000, pct: 33.59 },
      { key: '11', label: '外卖自营', cnt: 21687, amt: 5588792, pct: 12.56 },
    ],
    omsBySource: [
      { key: '4', label: 'POS 门店', cnt: 91551, amt: 25490000, pct: 50.89 },
      { key: '9', label: 'APP 端', cnt: 81136, amt: 24598792, pct: 49.11 },
    ],
    omsByPayType: [
      { key: '4', label: 'pay_type=4（卡）', cnt: 47519, amt: 13370665, pct: 26.70 },
      { key: '52', label: 'pay_type=52（GCash）', cnt: 34640, amt: 8694492, pct: 17.36 },
      { key: '53', label: 'pay_type=53（Maya）', cnt: 3604, amt: 887872, pct: 1.77 },
      { key: '504', label: 'pay_type=504（GrabPay）', cnt: 24163, amt: 12788874, pct: 25.53 },
      { key: '98', label: 'pay_type=98（现金）', cnt: 43669, amt: 10549004, pct: 21.06 },
      { key: '54', label: 'pay_type=54（QRPh）', cnt: 3680, amt: 886244, pct: 1.77 },
    ],
    omsByStatus: [
      { key: '6', label: 'status=6（已完成）', cnt: 169000, amt: 49000000, pct: 97.86 },
      { key: '7', label: 'status=7（取消）', cnt: 2500, amt: 620000, pct: 1.45 },
      { key: '8', label: 'status=8（退款）', cnt: 1187, amt: 468792, pct: 0.69 },
    ],
    channels: channelsData,
    bankDaily,
    bankRecon: {
      payooNet: 39800000,
      bankIn: 40239259,
      prevCross: 1669403,
      monthAttributed: 38569856,
      endUnsettled: 1220344,
      status: 'success',
    },
    discrepancies,
    freeOrders,
    refunds,
    coverage,
  }
}

export const phProfile: CountryProfile = {
  id: 'ph',
  name: '菲律宾 (Philippines)',
  countryZh: '菲律宾',
  flag: '🇵🇭',
  period: '2026-06',
  currency: {
    code: 'PHP',
    symbol: '₱',
    short: fmtPHP,
    full: fmtPHPFull,
  },
  dateFmt: 'yyyy-MM-dd',
  locale: 'zh-CN',
  slots,
  channels,
  bankDef: {
    settleParty: 'Antom/Grab',
    bankName: 'HSBC + BDO',
    settleLabel: 'Antom/Grab 结算',
    bankLabel: 'HSBC/BDO 入账',
    matchRule: 'Online: pay_no↔customizedField2；Offline: posOrderNo↔referenceTransactionId；Grab: thirdOrderNo↔Long Order ID；Cash: BDO 门店存款',
    equation: '通道结算 = 银行归属本月 + 月末未到账',
    bankNote: 'HSBC 收单 40,239,260 PHP（Online+Offline+Grab）；BDO 现金存款 11,560,147 PHP（含跨月 1.6M）。月末差异均为 T+N 跨月效应，可解释。',
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
