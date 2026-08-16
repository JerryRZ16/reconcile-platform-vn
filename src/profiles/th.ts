// ============================================================
// Country Profile · 泰国 (th)
// 泰国 2026-07 对账配置包（真实数据落地：Antom 收单 + Grab 外卖 + 现金 + 银行）。
// 基于 docs/th_recon_platform.md 真实结论：
//   - L1_ANTOM：OMS pay_no ↔ Antom customizedField2，96.53%
//   - L1_GRAB ：OMS ext.thirdOrderNo ↔ Grab Long Order ID，99.80%
//   - L1_CASH ：现金门店缴存（Kbank 无门店号标识，known-gap）
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

// ---------- 文件槽位（泰国：OMS + Antom 收单 + Grab 外卖 + KBank 银行） ----------
const slots: CountryProfile['slots'] = [
  {
    key: 'oms', title: 'OMS 订单', desc: '订单主表导出 · CSV / XLSX',
    required: true, icon: 'excel', color: '#b91c1c', kind: 'oms',
    fields: 'order_no · pay_amt(THB) · pay_no · order_source · pay_type · order_status',
  },
  {
    key: 'antom', title: 'Antom 收单账单', desc: 'Antom transactionItems · CSV（按日合并）',
    required: true, icon: 'text', color: '#b45309', kind: 'bill',
    fields: 'customizedField2(=pay_no) · transactionAmountValue · paymentTime',
  },
  {
    key: 'grab', title: 'Grab 外卖账单', desc: 'Grab Settlement Report · CSV',
    required: true, icon: 'text', color: '#16a34a', kind: 'bill',
    fields: 'Long Order ID · Amount · Transfer Date',
  },
  {
    key: 'bank', title: 'KBank 银行流水', desc: 'Kasikorn 银行对账单 · CSV/XLSX',
    required: true, icon: 'excel', color: '#15803d', kind: 'bank',
    fields: 'Date · Withdrawal · Deposit · Description · Channel',
  },
]

// ---------- 通道定义（泰国 L1：ANTOM / GRAB / CASH） ----------
const channels: CountryProfile['channels'] = [
  {
    channel: 'ANTOM',
    label: 'ANTOM（Online 收单）',
    note: 'OMS pay_no ↔ Antom customizedField2 逐笔匹配；未匹配多为 6 月跨月结算',
  },
  {
    channel: 'GRAB',
    label: 'GRAB（外卖）',
    note: 'OMS ext.thirdOrderNo ↔ Grab Long Order ID 逐笔匹配；近乎完美对平',
  },
  {
    channel: 'CASH',
    label: '现金（pay_type=98 · 门店缴存）',
    note: 'OMS 现金销售按门店聚合 vs 银行缴存；Kbank 无门店号标识（known-gap）',
  },
]

// ---------- 根因枚举（泰国，对齐后端 attribution.root_defs） ----------
const rootEnums: CountryProfile['rootEnums'] = [
  { root: 'R1', label: 'OMS已退款·Antom已收（需回退）', color: 'red' },
  { root: 'R2', label: 'OMS已取消·Antom已收（合规风险）', color: 'volcano' },
  { root: 'R3', label: '调单/时间漂移/补单', color: 'purple' },
  { root: 'R4', label: '账单有单·OMS无（补单/跨月）', color: 'cyan' },
  { root: 'R5', label: '平台代收·需平台账单', color: 'geekblue' },
  { root: 'R6', label: '时间戳/门店格式差异', color: 'magenta' },
  { root: 'C2', label: '现金未及时缴存', color: 'red' },
]

// ---------- 规则元数据 ----------
const rules: CountryProfile['rules'] = [
  { key: 'r1', name: 'OMS 四维总览', desc: 'business_type / order_source / pay_type / order_status 统计' },
  { key: 'r2', name: 'L1 · ANTOM 通道', desc: 'OMS pay_no ↔ Antom customizedField2 逐笔匹配' },
  { key: 'r3', name: 'L1 · GRAB 通道', desc: 'OMS ext.thirdOrderNo ↔ Grab Long Order ID 逐笔匹配' },
  { key: 'r4', name: 'L1 · 现金通道', desc: 'pay_type=98 门店聚合 vs 银行缴存（known-gap）' },
  { key: 'r5', name: 'L2 · 银行对账', desc: 'Antom/Grab 结算 ↔ 银行流水（th_settlement 待实现）' },
  { key: 'r6', name: '免单 / 退款 / 全覆盖', desc: 'pay_type=500 验证 · status 7/8 归集 · 全覆盖检查' },
]

// ---------- 免单 / 退款定义（泰国：free=500 / refund=8 / cancel=7） ----------
const freeRefundDef: CountryProfile['freeRefundDef'] = {
  freePayType: [500],
  refundStatus: [8],
  cancelStatus: [7],
  freeTitle: '免单验证（pay_type=500）',
  refundTitle: '退款 / 取消归集（不计入收入确认）',
  verifyLabels: {
    ok: { label: '正常免单', color: 'green' },
    include: { label: '全额收款 · 纳入收入', color: 'red' },
    manual: { label: '需人工确认', color: 'orange' },
  },
}

// ---------- 全覆盖定义 ----------
const coverageDef: CountryProfile['coverageDef'] = {
  dims: ['order_source', 'pay_type'],
  title: '全覆盖检查（order_source × pay_type 组合归属）',
  colLabel: '金额',
}

// ---------- 结果模块开关 ----------
const showModules: CountryProfile['showModules'] = [
  'metricCards', 'channelCards', 'omsOverview', 'bankRecon',
  'discrepancyTable', 'freeOrders', 'refunds', 'coverageMatrix',
]

// ---------- 文件名归属校验 ----------
const uploadHints: CountryProfile['uploadHints'] = {
  oms: ['order', 'oms'],
  antom: ['antom', 'transaction'],
  grab: ['grab', 'settlement'],
  bank: ['kbank', 'kasikorn', 'bank', 'statement'],
}

// ---------- 预置映射模板（泰国真实字段） ----------
const mappingTemplates: CountryProfile['mappingTemplates'] = [
  {
    file: 'OMS 订单',
    requiredOk: true,
    sourceOptions: ['order_no', 'pay_amt', 'pay_no', 'order_source', 'pay_type', 'order_status', 'store_no', 'order_time', 'ext'],
    rows: [
      { target: 'order_no', label: '订单号', source: 'order_no', required: true },
      { target: 'business_type', label: '业务类型', source: 'business_type', required: true },
      { target: 'order_source', label: '订单来源', source: 'order_source', required: true },
      { target: 'pay_type', label: '支付方式', source: 'pay_type', required: true },
      { target: 'order_status', label: '订单状态', source: 'order_status', required: true },
      { target: 'pay_amt', label: '支付金额（THB）', source: 'pay_amt', required: true },
      { target: 'total_amt', label: '订单总额', source: 'total_amt', required: false },
      { target: 'discount_amt', label: '优惠金额', source: 'discount_amt', required: false, hint: '免单验证用' },
      { target: 'store_no', label: '门店号', source: 'store_no', required: true },
      { target: 'pay_no', label: '支付单号（Antom 桥）', source: 'pay_no', required: true, hint: 'CHP 开头，Antom 匹配键' },
      { target: 'order_time', label: '下单时间', source: 'order_time', required: true },
    ],
  },
  {
    file: 'Antom 收单账单',
    requiredOk: true,
    sourceOptions: ['customizedField2', 'transactionAmountValue', 'customizedField1', 'paymentTime', 'paymentMethodType', 'transactionType'],
    rows: [
      { target: 'order_no', label: '商户订单号', source: 'customizedField2', required: true, hint: '= OMS pay_no（CHP）' },
      { target: 'amount', label: '金额（THB）', source: 'transactionAmountValue', required: true },
      { target: 'store_no', label: '门店号', source: 'customizedField1', required: false },
      { target: 'pay_date', label: '支付时间', source: 'paymentTime', required: true },
      { target: 'pay_method', label: '支付方式', source: 'paymentMethodType', required: false },
    ],
  },
  {
    file: 'Grab 外卖账单',
    requiredOk: true,
    sourceOptions: ['Long Order ID', 'Amount', 'Net Sales', 'Transfer Date', 'Status'],
    rows: [
      { target: 'order_no', label: '平台单号', source: 'Long Order ID', required: true, hint: '= OMS ext.thirdOrderNo' },
      { target: 'amount', label: '金额', source: 'Amount', required: true },
      { target: 'net_sales', label: '净销售额', source: 'Net Sales', required: false },
      { target: 'transfer_date', label: '结算日', source: 'Transfer Date', required: false },
      { target: 'status', label: '状态', source: 'Status', required: false },
    ],
  },
  {
    file: 'KBank 银行流水',
    requiredOk: true,
    sourceOptions: ['Date', 'Withdrawal', 'Deposit', 'Description', 'Channel'],
    rows: [
      { target: 'txn_date', label: '交易日期', source: 'Date', required: true },
      { target: 'withdrawal', label: '支出', source: 'Withdrawal', required: false },
      { target: 'deposit', label: '存入', source: 'Deposit', required: true },
      { target: 'desc', label: '摘要', source: 'Description', required: true },
      { target: 'category', label: '渠道', source: 'Channel', required: false },
    ],
  },
]

// ---------- 界面文案 ----------
const ui: CountryProfile['ui'] = {
  uploadIntro: '拖拽或点击上传文件（CSV / XLSX，≤200MB，UTF-8）。平台即时校验格式与文件名归属，校验通过后进入字段映射。',
  uploadDemo: '演示模式已内置「泰国 2026-07」真实对账数据，可直接继续。',
  uploadFlowHint: '① 上传 OMS 订单与 Antom/Grab/KBank 账单文件 → ② 确认字段映射 → ③ 运行对账规则 → ④ 查看可视化结果',
  runningSubtitle: '已加载泰国 2026-07 数据：OMS 35.4 万笔 · Antom / Grab / KBank 账单文件 3 份',
  resultDemoNote: '本结果基于泰国 2026-07 真实数据预生成（OMS + Antom + Grab + KBank），规则与指标口径参考《对账平台 MVP · PRD》。',
  resultTitle: '泰国 2026-07 全通道对账结果',
}

// ---------- 演示数据生成器（基于真实对账结论） ----------
function buildDemoData(): ReconResult {
  const channelsData: ChannelRecon[] = [
    { channel: 'ANTOM', label: 'ANTOM（Online 收单）', omsCount: 197336, billCount: 196914, matchedCount: 190486, matchRate: 96.53, unmatchedCount: 6850, unmatchedAmt: 29460000, status: 'warning', note: 'OMS pay_no ↔ Antom customizedField2 逐笔匹配；未匹配多为 6 月跨月结算' },
    { channel: 'GRAB', label: 'GRAB（外卖）', omsCount: 104696, billCount: 104772, matchedCount: 104491, matchRate: 99.80, unmatchedCount: 205, unmatchedAmt: 24530000, status: 'success', note: 'OMS ext.thirdOrderNo ↔ Grab Long Order ID 逐笔匹配；近乎完美对平' },
    { channel: 'CASH', label: '现金（pay_type=98 · 门店缴存）', omsCount: 17796, billCount: 1781, matchedCount: 0, matchRate: 0, unmatchedCount: 0, unmatchedAmt: 2780756, status: 'error', note: 'OMS 现金销售按门店聚合 vs 银行缴存；Kbank 无门店号标识（known-gap）' },
  ]

  const bankDaily = Array.from({ length: 31 }, (_, i) => {
    const day = i + 1
    const p = 2900000 + day * 110000 + (day % 3) * 40000
    const t = p + (day % 5 === 0 ? 0 : (day % 2 ? 28000 : -35000))
    return {
      day,
      date: `07-${String(day).padStart(2, '0')}`,
      payooSettle: p,
      tcbCredit: t,
      diff: t - p,
      ...(day % 7 === 0 ? { note: '周日' } : {}),
    }
  })

  const discrepancies: Discrepancy[] = [
    { id: 'D-0001', channel: 'ANTOM', root: 'R4', rootLabel: '账单有单·OMS无（补单/跨月）', orderNo: 'CHP20260630...', storeNo: 'TH009', amount: 27915, time: '2026-07-01', description: 'Antom 账单有该笔（6 月跨月结算），OMS 7 月无对应单。', suggestion: '6 月跨月结算，待 7 月初到账后闭环。', status: 'pending', omsSide: '未找到', billSide: 'Antom PAYMENT · ฿27,915' },
    { id: 'D-0002', channel: 'GRAB', root: 'R4', rootLabel: '账单有单·OMS无（补单/跨月）', orderNo: '0018660286-...', storeNo: 'TH003', amount: 171345, time: '2026-07-31', description: 'Grab 账单有该笔，OMS 无对应（跨月/取消）。', suggestion: '核对跨月结算与取消单。', status: 'pending', omsSide: '未找到', billSide: 'Grab Transferred · ฿171,345' },
    { id: 'D-0003', channel: 'CASH', root: 'C2', rootLabel: '现金未及时缴存', storeNo: 'UNKNOWN', amount: 2780756, expected: 0, diffAmt: 2780756, diffRate: '100%', time: '2026-07', description: 'OMS 现金销售 ฿2.78M，银行无门店缴存明细（Kbank 无门店号）。', suggestion: '需门店缴存明细核对（known-gap）。', status: 'pending', omsSide: '现金销售 ฿2,780,756', billSide: '银行缴存 未识别' },
  ]

  const freeOrders: FreeOrder[] = [
    { id: 'F-0001', orderNo: '202607...', storeNo: 'TH012', amount: 0, total: 650, disc: 650, verify: 'ok', note: '正常免单（全额优惠）' },
    { id: 'F-0002', orderNo: '202607...', storeNo: 'TH005', amount: 450, total: 450, disc: 0, verify: 'include', note: '标记免单但全额收款，须纳入收入' },
  ]

  const refunds: RefundItem[] = [
    { id: 'R-0001', orderNo: '20260709001', storeNo: 'TH010', status: 8, statusLabel: '退款', amount: 320, time: '2026-07-09', root: 'NORMAL', rootLabel: '正常退款闭环' },
    { id: 'R-0002', orderNo: '20260718001', storeNo: 'TH003', status: 7, statusLabel: '取消', amount: 120, time: '2026-07-18', root: 'NORMAL', rootLabel: '正常取消未扣款' },
  ]

  const coverage: CoverageCell[] = [
    { source: 9, payType: 29, cnt: 140922, amt: 29460000, owner: 'ANTOM', cover: true },
    { source: 4, payType: 4, cnt: 18786, amt: 5870000, owner: 'ANTOM', cover: true },
    { source: 11, payType: 504, cnt: 104696, amt: 24530000, owner: 'GRAB', cover: true },
    { source: 4, payType: 98, cnt: 17388, amt: 2780756, owner: '现金缴存', cover: true },
    { source: 4, payType: 500, cnt: 93, amt: 35000, owner: '免单验证', cover: true },
  ]

  return {
    summary: {
      totalOrders: 354251,
      totalAmount: 53900000,
      overallMatchRate: '98.17%',
      diffCount: 3,
      diffAmount: 3140000,
      uncovered: 0,
      taskId: 'TH-202607-001 (mock)',
      runAt: '2026-08-16 09:45',
    },
    omsByBusiness: [
      { key: '3', label: '外送/线上', cnt: 259000, amt: 32000000, pct: 73.1 },
      { key: '1', label: '堂食', cnt: 99000, amt: 15500000, pct: 27.9 },
    ],
    omsBySource: [
      { key: '11', label: '外卖平台', cnt: 104696, amt: 24530000, pct: 29.6 },
      { key: '9', label: 'APP', cnt: 110000, amt: 15600000, pct: 31.0 },
      { key: '4', label: 'POS', cnt: 143796, amt: 17500000, pct: 40.6 },
    ],
    omsByPayType: [
      { key: '29', label: 'POS扫码/钱包', cnt: 140922, amt: 29460000, pct: 39.8 },
      { key: '504', label: 'Grab外卖', cnt: 104696, amt: 24530000, pct: 29.6 },
      { key: '4', label: '卡', cnt: 39602, amt: 5870000, pct: 11.2 },
      { key: '98', label: '现金', cnt: 17796, amt: 2780756, pct: 5.0 },
    ],
    omsByStatus: [
      { key: '6', label: '已完成', cnt: 354251, amt: 53900000, pct: 97.4 },
      { key: '7', label: '取消', cnt: 8500, amt: 1100000, pct: 2.3 },
      { key: '8', label: '退款', cnt: 1100, amt: 98000, pct: 0.3 },
    ],
    channels: channelsData,
    bankDaily,
    bankRecon: {
      payooNet: 53900000,
      bankIn: 55200000,
      prevCross: 1300000,
      monthAttributed: 52600000,
      endUnsettled: 1300000,
      status: 'warning',
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
  period: '2026-07',
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
    settleParty: 'Antom/Grab',
    bankName: 'KBank',
    settleLabel: 'Antom/Grab 结算',
    bankLabel: 'KBank 入账',
    matchRule: 'Antom/Grab 结算 ↔ KBank 流水（th_settlement 待实现）',
    equation: 'Antom/Grab净 = 银行归属本月 + 月末未到账',
    bankNote: 'L2 银行对账 th_settlement 待实现；Kbank 流水可读但结算模型需 Antom/Grab settlement 聚合。',
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
