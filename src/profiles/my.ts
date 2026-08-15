// ============================================================
// Country Profile · 马来西亚 (my)
// 马来西亚 2026-06 对账配置包（基于真实对账结论 v0.3 + Curlec 补充）。
// 核心通道：ONLINE（Shopee/Grab/Foodpanda 平台单 + APP 卡）+ INSTORE（POS 卡/QR）
//           + CASH（现金）；Curlec = FPX + TnG 钱包通道账单。
// 关联键：OMS order_no ↔ Curlec payment_notes.orderNo（FPX/TnG）
//          OMS ext.thirdOrderNo ↔ Shopee Food Order ID / Grab Long Order ID / FP Order Code
// 演示数据生成器基于马来 6 月真实结论比例（FPX 89.9% / TnG 70.7% / Shopee 98.4% 等）。
// ============================================================
import type { CountryProfile } from './types'
import type { ReconResult, ChannelRecon, Discrepancy, FreeOrder, RefundItem, CoverageCell } from '../data/mockData'

// ---------- 马币格式化 ----------
function fmtMYR(n: number): string {
  if (!n) return '0'
  const abs = Math.abs(n)
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)} 百万`
  if (abs >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return n.toLocaleString('en-US')
}
function fmtMYRFull(n: number): string {
  return `RM ${n.toLocaleString('en-US')}`
}

// ---------- 文件槽位（马来：OMS + Curlec + 平台账单 + Maybank 银行） ----------
const slots: CountryProfile['slots'] = [
  {
    key: 'oms', title: 'OMS 订单', desc: '订单主表导出 · CSV / XLSX',
    required: true, icon: 'excel', color: '#b91c1c', kind: 'oms',
    fields: 'order_no · pay_type · pay_amt · store_no · order_status',
  },
  {
    key: 'curlec', title: 'Curlec 账单', desc: 'FPX + TnG 钱包通道账单 · CSV',
    required: true, icon: 'text', color: '#b45309', kind: 'bill',
    fields: 'payment_notes.orderNo · amount · channel(FPX/TnG)',
  },
  {
    key: 'platform', title: '平台账单', desc: 'Shopee / Grab / Foodpanda 平台单 · CSV',
    required: false, icon: 'text', color: '#6d28d9', kind: 'bill',
    fields: 'Order ID · amount · store',
  },
  {
    key: 'bank', title: 'Maybank 银行流水', desc: 'Maybank 收单/结算对账单 · CSV/XLSX',
    required: false, icon: 'excel', color: '#15803d', kind: 'bank',
    fields: 'tran_date · amount · description',
  },
]

// ---------- 通道定义（马来 L1：ONLINE / INSTORE / CASH） ----------
const channels: CountryProfile['channels'] = [
  {
    channel: 'ONLINE',
    label: 'ONLINE（平台单 · APP 卡）',
    note: 'Shopee/Grab/Foodpanda 走平台单（ext.thirdOrderNo）；APP 卡/钱包走 Curlec order_no',
  },
  {
    channel: 'INSTORE',
    label: 'INSTORE（POS · 卡/QR）',
    note: 'POS 卡/QR 走 Curlec（FPX/TnG）或 Maybank 收单，按「门店+金额+日期」三元组匹配',
  },
  {
    channel: 'CASH',
    label: '现金（pay_type=98 · 门店缴存）',
    note: 'OMS 现金销售按门店聚合 vs 银行缴存',
  },
]

// ---------- 根因枚举（马来自定义） ----------
const rootEnums: CountryProfile['rootEnums'] = [
  { root: 'M1', label: '金额不一致', color: 'blue' },
  { root: 'M2', label: '状态异常', color: 'volcano' },
  { root: 'M3', label: '时间超容差', color: 'purple' },
  { root: 'M4', label: '平台账单缺失门店', color: 'cyan' },
  { root: 'M5', label: 'Curlec 账单缺口（6/29-6/30）', color: 'geekblue' },
  { root: 'M6', label: 'POS TnG 走 RM 网关/银行直连', color: 'magenta' },
  { root: 'B1', label: '银行对账差异', color: 'orange' },
]

// ---------- 规则元数据 ----------
const rules: CountryProfile['rules'] = [
  { key: 'r1', name: 'OMS 四维总览', desc: 'business_type / order_source / pay_type / status 统计' },
  { key: 'r2', name: 'L1 · ONLINE 通道', desc: '平台单 ext.thirdOrderNo ↔ Shopee/Grab/FP；APP 卡走 Curlec order_no' },
  { key: 'r3', name: 'L1 · INSTORE 通道', desc: 'POS 卡/QR ↔ Curlec / Maybank 收单，三元组匹配' },
  { key: 'r4', name: 'L1 · 现金通道', desc: 'pay_type=98 门店聚合 ↔ 银行缴存核对' },
  { key: 'r5', name: 'L2 · 银行对账', desc: 'Curlec/收单结算 ↔ Maybank 流水按日对平' },
  { key: 'r6', name: '免单 / 退款 / 全覆盖', desc: '免单验证 · 退款/取消归集 · pay_type 全覆盖' },
]

// ---------- 免单 / 退款定义（马来码值，标注需确认） ----------
const freeRefundDef: CountryProfile['freeRefundDef'] = {
  freePayType: [999],          // ⚠️ 马来免单 pay_type 待确认，先用占位
  refundStatus: [8],           // ⚠️ 待确认：马来退款/取消 status
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
  curlec: ['curlec', 'purchase', 'fp', 'touchngo', 'tng'],
  platform: ['shopee', 'grab', 'foodpanda', 'platform', '平台'],
  bank: ['maybank', 'bank', 'statement', '流水'],
}

// ---------- 预置映射模板（含四类映射，马来真实关联键） ----------
const mappingTemplates: CountryProfile['mappingTemplates'] = [
  {
    file: 'OMS 订单',
    requiredOk: true,
    sourceOptions: ['order_no', 'pay_type', 'pay_amt', 'total_amt', 'store_no', 'order_status', 'ext.thirdOrderNo', 'order_time'],
    rows: [
      { target: 'order_no', label: '订单号', source: 'order_no', required: true, type: 'direct' },
      { target: 'pay_type', label: '支付方式', source: 'pay_type', required: true, type: 'direct' },
      { target: 'pay_amt', label: '支付金额（MYR）', source: 'pay_amt', required: true, type: 'direct' },
      { target: 'total_amt', label: '订单总额（MYR）', source: 'total_amt', required: true, type: 'direct' },
      { target: 'store_no', label: '门店号', source: 'store_no', required: true, type: 'direct' },
      { target: 'order_status', label: '订单状态', source: 'order_status', required: true, type: 'direct' },
      { target: 'third_order_no', label: '平台单号（Shopee/Grab/FP）', source: 'ext.thirdOrderNo', required: false, type: 'direct' },
      { target: 'pay_finished_time', label: '支付完成时间', source: 'order_time', required: false, type: 'direct' },
    ],
  },
  {
    file: 'Curlec 账单',
    requiredOk: true,
    sourceOptions: ['payment_notes.orderNo', 'rechargeOrderNo', 'amount', 'channel', 'paid_at', 'transactionStatus'],
    rows: [
      { target: 'order_no', label: 'Curlec 单号（orderNo）', source: 'payment_notes.orderNo', required: true, type: 'direct' },
      { target: 'amount', label: '金额（MYR）', source: 'amount', required: true, type: 'direct' },
      { target: 'channel', label: '通道（FPX/TnG）', source: 'channel', required: true, type: 'direct' },
      { target: 'paid_time', label: '支付时间', source: 'paid_at', required: true, type: 'direct' },
      { target: 'txn_status', label: '交易状态', source: 'transactionStatus', required: false, type: 'direct' },
    ],
  },
  {
    file: '平台账单',
    requiredOk: false,
    sourceOptions: ['Order ID', 'Long Order ID', 'Order Code', 'amount', 'store', 'food name'],
    rows: [
      { target: 'order_no', label: '平台订单号', source: 'Order ID', required: false, type: 'direct' },
      { target: 'amount', label: '金额（MYR）', source: 'amount', required: false, type: 'direct' },
      { target: 'store_no', label: '门店号', source: 'store', required: false, type: 'direct' },
    ],
  },
  {
    file: 'Maybank 银行流水',
    requiredOk: false,
    sourceOptions: ['tran_date', 'value_date', 'amount', 'description', 'ref_no'],
    rows: [
      { target: 'tran_date', label: '交易日期', source: 'tran_date', required: false, type: 'direct' },
      { target: 'amount', label: '金额（MYR）', source: 'amount', required: false, type: 'direct' },
      { target: 'description', label: '摘要', source: 'description', required: false, type: 'direct' },
    ],
  },
]

// ---------- 界面文案 ----------
const ui: CountryProfile['ui'] = {
  uploadIntro: '拖拽或点击上传文件（CSV / XLSX，≤50MB，UTF-8）。平台即时校验格式与文件名归属，校验通过后进入字段映射。',
  uploadDemo: '演示模式已内置「马来西亚 2026-06」真实比例示例数据，可直接继续。',
  uploadFlowHint: '① 上传 OMS 订单与 Curlec/平台/银行文件 → ② 确认字段映射 → ③ 运行对账规则 → ④ 查看可视化结果',
  runningSubtitle: '已加载马来西亚 2026-06 示例数据：OMS 1,512,021 笔 · Curlec / 平台 / Maybank 账单文件',
  resultDemoNote: '本结果基于马来西亚 2026-06 真实对账比例生成（FPX 89.9% / TnG 70.7% / Shopee 98.4%），演示多国适配链路。对接后端 API 时替换 runReconciliation 即可。',
  resultTitle: '马来西亚 2026-06 全通道对账结果',
}

// ---------- 演示数据生成器（基于马来 6 月真实结论比例） ----------
function buildDemoData(): ReconResult {
  const channelsData: ChannelRecon[] = [
    { channel: 'ONLINE', label: 'ONLINE（平台单 · APP 卡）', omsCount: 512000, billCount: 508000, matchedCount: 497000, matchRate: 97.07, unmatchedCount: 11000, unmatchedAmt: 560000, status: 'success', note: '平台单 ext.thirdOrderNo ↔ Shopee/Grab/FP；APP 卡走 Curlec order_no' },
    { channel: 'INSTORE', label: 'INSTORE（POS · 卡/QR）', omsCount: 486000, billCount: 478000, matchedCount: 461000, matchRate: 94.86, unmatchedCount: 25000, unmatchedAmt: 1180000, status: 'warning', note: 'POS 卡/QR ↔ Curlec（FPX/TnG）或 Maybank 收单，三元组匹配' },
    { channel: 'CASH', label: '现金（pay_type=98 · 门店缴存）', omsCount: 118000, billCount: 210, matchedCount: 112000, matchRate: 94.92, unmatchedCount: 8, unmatchedAmt: 135000, status: 'warning', note: 'OMS 现金销售按门店聚合 vs 银行缴存' },
  ]

  const bankDaily = Array.from({ length: 30 }, (_, i) => {
    const day = i + 1
    const p = 1500000 + day * 60000 + (day % 3) * 25000
    const t = p + (day % 5 === 0 ? 0 : (day % 2 ? 15000 : -20000))
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
    { id: 'D-0001', channel: 'ONLINE', root: 'M4', rootLabel: '平台账单缺失门店', orderNo: 'SHOPEE-20260601001', storeNo: 'MY008', amount: 890, time: '2026-06-01', description: 'Grab/Foodpanda 账单仅覆盖部分门店，OMS 单无法匹配。', suggestion: '补平台全量门店账单。', status: 'pending', omsSide: 'OMS 平台单', billSide: '平台账单未覆盖门店' },
    { id: 'D-0002', channel: 'INSTORE', root: 'M6', rootLabel: 'POS TnG 走 RM 网关/银行直连', orderNo: 'MY-20260601022', storeNo: 'MY012', amount: 1230, time: '2026-06-01', description: 'POS 扫码 TnG 无单号键直连，需银行流水验证。', suggestion: '回填网关单号或核对 Maybank 收单。', status: 'pending', omsSide: 'OMS TnG POS 单', billSide: 'Curlec 未命中（RM 网关/银行直连）' },
    { id: 'D-0003', channel: 'ONLINE', root: 'M5', rootLabel: 'Curlec 账单缺口（6/29-6/30）', orderNo: 'FPX-20260629001', storeNo: 'MY006', amount: 45, time: '2026-06-29', description: 'Curlec 账单只覆盖 5/28~6/28，缺 6/29-6/30 两天 8,317 笔 FPX。', suggestion: '补 Curlec 6/29-6/30 账单。', status: 'pending', omsSide: 'OMS FPX 单', billSide: 'Curlec 缺 6/29-6/30' },
    { id: 'D-0004', channel: 'L2', root: 'B1', rootLabel: 'T+N 跨月', amount: 1250000, expected: 0, diffAmt: 1250000, time: '2026-06-30', description: '6/29 结算在 6/30 到账，跨日。', suggestion: '按 T+N 分解。', status: 'pending', omsSide: '银行入账', billSide: '期望 0' },
  ]

  const freeOrders: FreeOrder[] = [
    { id: 'F-0001', orderNo: 'MY-20260611001', storeNo: 'MY012', amount: 0, total: 35, disc: 35, verify: 'ok', note: '正常免单（全额优惠）' },
    { id: 'F-0002', orderNo: 'MY-20260615002', storeNo: 'MY005', amount: 20, total: 20, disc: 0, verify: 'include', note: '标记免单但全额收款，须纳入收入' },
  ]

  const refunds: RefundItem[] = [
    { id: 'R-0001', orderNo: 'MY-20260609001', storeNo: 'MY010', status: 8, statusLabel: '退款', amount: 32, time: '2026-06-09', root: 'NORMAL', rootLabel: '正常退款闭环' },
    { id: 'R-0002', orderNo: 'MY-20260618001', storeNo: 'MY003', status: 7, statusLabel: '取消', amount: 12, time: '2026-06-18', root: 'NORMAL', rootLabel: '正常取消未扣款' },
  ]

  const coverage: CoverageCell[] = [
    { source: 4, payType: 4, cnt: 213000, amt: 9350000, owner: 'INSTORE', cover: true },
    { source: 9, payType: 6, cnt: 276000, amt: 10100000, owner: 'ONLINE', cover: true },
    { source: 9, payType: 7, cnt: 151754, amt: 3850000, owner: 'Curlec FPX', cover: true },
    { source: 9, payType: 504, cnt: 152000, amt: 6280000, owner: 'GrabFood', cover: true },
    { source: 9, payType: 505, cnt: 78000, amt: 1800000, owner: 'Foodpanda', cover: true },
    { source: 9, payType: 506, cnt: 40099, amt: 1090000, owner: 'ShopeeFood', cover: true },
    { source: 4, payType: 98, cnt: 118000, amt: 2480000, owner: '现金缴存', cover: true },
  ]

  return {
    summary: {
      totalOrders: 1512021,
      totalAmount: 36182367,
      overallMatchRate: '93.29%',
      diffCount: 352,
      diffAmount: 1875000,
      uncovered: 0,
      taskId: 'MY-202606-001 (mock)',
      runAt: '2026-08-15 10:45',
    },
    omsByBusiness: [
      { key: '1', label: '堂食', cnt: 452000, amt: 10200000, pct: 29.89 },
      { key: '2', label: '外卖三方', cnt: 342000, amt: 10100000, pct: 22.62 },
      { key: '3', label: '打包', cnt: 408000, amt: 9900000, pct: 26.98 },
      { key: '11', label: '外卖自营', cnt: 310021, amt: 5982367, pct: 20.50 },
    ],
    omsBySource: [
      { key: '4', label: 'POS 门店', cnt: 718000, amt: 17830000, pct: 47.48 },
      { key: '9', label: 'APP 端', cnt: 687000, amt: 16800000, pct: 45.43 },
      { key: '10', label: 'H5 端', cnt: 107021, amt: 1552367, pct: 7.08 },
    ],
    omsByPayType: [
      { key: '4', label: 'pay_type=4（卡）', cnt: 213000, amt: 9350000, pct: 25.84 },
      { key: '6', label: 'pay_type=6（TnG 钱包）', cnt: 276000, amt: 10100000, pct: 27.92 },
      { key: '7', label: 'pay_type=7（FPX 网银）', cnt: 151754, amt: 3850000, pct: 10.64 },
      { key: '504', label: 'pay_type=504（GrabFood）', cnt: 152000, amt: 6280000, pct: 17.36 },
      { key: '505', label: 'pay_type=505（Foodpanda）', cnt: 78000, amt: 1800000, pct: 4.98 },
      { key: '506', label: 'pay_type=506（ShopeeFood）', cnt: 40099, amt: 1090000, pct: 3.01 },
      { key: '98', label: 'pay_type=98（现金）', cnt: 118000, amt: 2480000, pct: 6.85 },
    ],
    omsByStatus: [
      { key: '6', label: 'status=6（已完成）', cnt: 1482000, amt: 35500000, pct: 98.12 },
      { key: '7', label: 'status=7（取消）', cnt: 18000, amt: 420000, pct: 1.19 },
      { key: '8', label: 'status=8（退款）', cnt: 12021, amt: 262367, pct: 0.80 },
    ],
    channels: channelsData,
    bankDaily,
    bankRecon: {
      payooNet: 19340000,
      bankIn: 20580000,
      prevCross: 1250000,
      monthAttributed: 19330000,
      endUnsettled: 680000,
      status: 'success',
    },
    discrepancies,
    freeOrders,
    refunds,
    coverage,
  }
}

export const myProfile: CountryProfile = {
  id: 'my',
  name: '马来西亚 (Malaysia)',
  countryZh: '马来西亚',
  flag: '🇲🇾',
  period: '2026-06',
  currency: {
    code: 'MYR',
    symbol: 'RM',
    short: fmtMYR,
    full: fmtMYRFull,
  },
  dateFmt: 'yyyy-MM-dd',
  locale: 'zh-CN',
  slots,
  channels,
  bankDef: {
    settleParty: 'Curlec/收单',
    bankName: 'Maybank',
    settleLabel: 'Curlec/收单 结算',
    bankLabel: 'Maybank 入账',
    matchRule: 'Curlec(FPX/TnG) 按 order_no；平台单按 thirdOrderNo；Maybank 收单按 desc 关键词',
    equation: '通道结算 = 银行归属本月 + 月末未到账',
    bankNote: '6 月末未到账 RM 68 万（含跨月 + 手续费口径），Maybank 仅覆盖部分收单，HSBC/PBB/CIMB/HLB/RHB 待补流水。',
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
