// ============================================================
// Country Profile · 越南 (vn)
// 越南 2026-07 对账配置包：币种/日期/文件槽位/通道/银行/根因/规则/
// 免单退款/全覆盖/上传校验/映射模板/界面文案 + 演示数据生成器。
// 所有文案与数值与改造前 mockData.ts 完全一致，保证演示主链路结果不变。
// ============================================================
import type { CountryProfile } from './types'
import type {
  ReconResult, ChannelRecon, DiffRoot, Discrepancy,
  DiffStatus, FreeOrder, RefundItem, CoverageCell,
} from '../data/mockData'

// ---------- 越南货币格式化（与旧 fmtVND / fmtVNDFull 一致） ----------
function fmtVND(n: number): string {
  if (!n) return '0'
  const abs = Math.abs(n)
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)} 亿`
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)} 百万`
  if (abs >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return n.toLocaleString()
}
function fmtVNDFull(n: number): string {
  return `${n.toLocaleString('en-US')} ₫`
}

// ---------- 文件槽位（4 固定槽，与旧 StepUpload SLOTS 一致） ----------
const slots: CountryProfile['slots'] = [
  {
    key: 'oms', title: 'OMS 订单', desc: '订单主表导出 · CSV / XLSX',
    required: true, icon: 'excel', color: '#1d4ed8', kind: 'oms',
    fields: 'order_no · pay_amt · order_source · pay_type · order_status',
  },
  {
    key: 'online', title: 'PAYOO ONLINE 账单', desc: '线上支付通道账单 · CSV',
    required: true, icon: 'text', color: '#0891b2', kind: 'bill',
    fields: 'order_no(Merchant order number) · amount · paid_time',
  },
  {
    key: 'instore', title: 'PAYOO INSTORE 账单', desc: '门店收单通道账单 · CSV',
    required: true, icon: 'text', color: '#7c3aed', kind: 'bill',
    fields: 'store_no · amount · paid_time',
  },
  {
    key: 'tcb', title: 'TCB 银行流水', desc: 'Techcombank 银行对账单 · CSV/XLSX',
    required: true, icon: 'excel', color: '#059669', kind: 'bank',
    fields: 'tran_date · amount · description · settle_type',
  },
]

// ---------- 通道定义（L1 三通道） ----------
const channels: CountryProfile['channels'] = [
  {
    channel: 'ONLINE',
    label: 'ONLINE（APP/H5 · 卡+QR）',
    note: 'order_source 9/10 ↔ PAYOO ONLINE 按 order_no 逐笔匹配；未匹配多为金额取整 / 跨日时间戳 / 补单延迟',
  },
  {
    channel: 'INSTORE',
    label: 'INSTORE（POS · 卡+QR）',
    note: 'order_source=4 且 pay_type 4/45/46 ↔ PAYOO INSTORE 按「门店+金额+时间±5min」三元组匹配',
  },
  {
    channel: 'CASH',
    label: '现金（pay_type=98 · 门店缴存）',
    note: 'OMS 现金销售按门店聚合 vs TCB「VNxxx nop sale」缴存；异常门店到账率 <55% 标红',
  },
]

// ---------- 根因枚举（R1-R6 / CASH / L2） ----------
const rootEnums: CountryProfile['rootEnums'] = [
  { root: 'R1', label: '订单金额不一致', color: 'blue' },
  { root: 'R2', label: '订单状态异常', color: 'volcano' },
  { root: 'R3', label: '时间超容差（±5min）', color: 'purple' },
  { root: 'R4', label: 'PAYOO 有 · OMS 无（补单）', color: 'cyan' },
  { root: 'R5', label: '门店缴存异常', color: 'geekblue' },
  { root: 'R6', label: 'T+N 跨月', color: 'magenta' },
  { root: 'CASH', label: '现金缴存差异', color: 'red' },
  { root: 'L2', label: '银行对账差异', color: 'orange' },
]

// ---------- 规则元数据（StepRunning 用，与旧 RULES 一致） ----------
const rules: CountryProfile['rules'] = [
  { key: 'r1', name: 'OMS 四维总览', desc: 'business_type / order_source / pay_type / order_status 笔数金额统计' },
  { key: 'r2', name: 'L1 · ONLINE 通道', desc: 'order_source 9/10 ↔ PAYOO ONLINE 按 order_no 逐笔匹配' },
  { key: 'r3', name: 'L1 · INSTORE 通道', desc: 'order_source=4 且 pay_type 4/45/46 ↔ 店+额+时±5min 三元组匹配' },
  { key: 'r4', name: 'L1 · 现金通道', desc: 'pay_type=98 门店聚合 ↔ TCB 缴存流水核对' },
  { key: 'r5', name: 'L2 · 银行对账', desc: 'PAYOO 结算 ↔ TCB 流水按日对平 + T+N 跨月分解' },
  { key: 'r6', name: '免单 / 退款 / 全覆盖', desc: 'pay_type=500 验证 · status 7/8 归集 · order_source×pay_type 全覆盖检查' },
]

// ---------- 免单 / 退款定义 ----------
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

// ---------- 结果模块开关（越南全开） ----------
const showModules: CountryProfile['showModules'] = [
  'metricCards', 'channelCards', 'omsOverview', 'bankRecon',
  'discrepancyTable', 'freeOrders', 'refunds', 'coverageMatrix',
]

// ---------- 文件名归属校验（与旧 StepUpload mustContain 一致） ----------
const uploadHints: CountryProfile['uploadHints'] = {
  oms: ['order', 'oms'],
  online: ['online', 'payoo'],
  instore: ['instore', 'payoo'],
  tcb: ['tcb', 'bank', 'techcombank', 'statement'],
}

// ---------- 预置映射模板（与旧 StepMapping MAPPINGS / SOURCE_OPTIONS 一致） ----------
const mappingTemplates: CountryProfile['mappingTemplates'] = [
  {
    file: 'OMS 订单',
    requiredOk: true,
    sourceOptions: ['order_no', 'business_type', 'order_source', 'pay_type', 'order_status', 'pay_amt', 'total_amt', 'discount_amt', 'store_no', 'pay_finished_time', 'refund_finished_time'],
    rows: [
      { target: 'order_no', label: '订单号', source: 'order_no', required: true },
      { target: 'business_type', label: '业务类型', source: 'business_type', required: true },
      { target: 'order_source', label: '订单来源', source: 'order_source', required: true },
      { target: 'pay_type', label: '支付方式', source: 'pay_type', required: true },
      { target: 'order_status', label: '订单状态', source: 'order_status', required: true },
      { target: 'pay_amt', label: '支付金额', source: 'pay_amt', required: true },
      { target: 'total_amt', label: '订单总额', source: 'total_amt', required: false },
      { target: 'discount_amt', label: '优惠金额', source: 'discount_amt', required: false, hint: '免单验证用' },
      { target: 'store_no', label: '门店号', source: 'store_no', required: true, hint: 'INSTORE/现金用' },
      { target: 'pay_finished_time', label: '支付完成时间', source: 'pay_finished_time', required: false, hint: '三元组匹配用' },
    ],
  },
  {
    file: 'PAYOO ONLINE 账单',
    requiredOk: true,
    sourceOptions: ['Merchant order number', 'Amount', 'Time', 'Action'],
    rows: [
      { target: 'order_no', label: '商户订单号', source: 'Merchant order number', required: true },
      { target: 'amount', label: '金额', source: 'Amount', required: true },
      { target: 'paid_time', label: '支付时间', source: 'Time', required: true },
      { target: 'action_type', label: '交易类型', source: 'Action', required: false },
    ],
  },
  {
    file: 'PAYOO INSTORE 账单',
    requiredOk: true,
    sourceOptions: ['Store', 'Amount', 'Time', 'Order No'],
    rows: [
      { target: 'store_no', label: '门店', source: 'Store', required: true },
      { target: 'amount', label: '金额', source: 'Amount', required: true },
      { target: 'paid_time', label: '时间', source: 'Time', required: true },
      { target: 'merchant_order_no', label: '商户订单号', source: 'Order No', required: false },
    ],
  },
  {
    file: 'TCB 银行流水',
    requiredOk: true,
    sourceOptions: ['Date', 'Amount', 'Description', 'Remarks'],
    rows: [
      { target: 'tran_date', label: '交易日期', source: 'Date', required: true },
      { target: 'amount', label: '金额', source: 'Amount', required: true },
      { target: 'description', label: '摘要', source: 'Description', required: true, hint: 'Payoo 关键词识别' },
      { target: 'settle_type', label: '结算类型', source: 'Remarks', required: false, hint: 'CT DS / TT TD ± QRCODE' },
    ],
  },
]

// ---------- 界面文案（国家相关部分） ----------
const ui: CountryProfile['ui'] = {
  uploadIntro: '拖拽或点击上传文件（CSV / XLSX，≤50MB，UTF-8）。平台即时校验格式与文件名归属，校验通过后进入字段映射。',
  uploadDemo: '演示模式已内置「越南 2026-07」真实数据，可直接继续。',
  uploadFlowHint: '① 上传 OMS 订单与 PAYOO/TCB 账单文件 → ② 确认字段映射 → ③ 运行对账规则 → ④ 查看可视化结果',
  runningSubtitle: '已加载越南 2026-07 数据：OMS 126,623 笔 · PAYOO / TCB 账单文件 3 份',
  resultDemoNote: '本结果基于越南 2026-07 真实数据预生成（OMS 126,623 笔 + PAYOO + TCB 流水），规则与指标口径参考《对账平台 MVP · PRD》。对接后端 API 时替换 runReconciliation 即可。',
  resultTitle: '越南 2026-07 全通道对账结果',
}

// ---------- 演示数据生成器（降级模式，与原 mockResult 完全一致） ----------
function buildDemoData(): ReconResult {
  const channelsData: ChannelRecon[] = [
    { channel: 'ONLINE', label: 'ONLINE（APP/H5 · 卡+QR）', omsCount: 56605, billCount: 56203, matchedCount: 55913, matchRate: 98.78, unmatchedCount: 290, unmatchedAmt: 58538450, status: 'warning', note: 'order_source 9/10 ↔ PAYOO ONLINE 按 order_no 逐笔匹配；未匹配多为金额取整 / 跨日时间戳 / 补单延迟' },
    { channel: 'INSTORE', label: 'INSTORE（POS · 卡+QR）', omsCount: 39363, billCount: 39377, matchedCount: 39354, matchRate: 99.98, unmatchedCount: 23, unmatchedAmt: 2000000, status: 'success', note: 'order_source=4 且 pay_type 4/45/46 ↔ PAYOO INSTORE 按「门店+金额+时间±5min」三元组匹配' },
    { channel: 'CASH', label: '现金（pay_type=98 · 门店缴存）', omsCount: 25128, billCount: 244, matchedCount: 22222, matchRate: 88.48, unmatchedCount: 23, unmatchedAmt: 372604800, status: 'error', note: 'OMS 现金销售按门店聚合 vs TCB「VNxxx nop sale」缴存；异常门店到账率 <55% 标红' },
  ]

  const bankDaily = (() => {
    // 与旧 mockData.ts 的 bankDaily 逐日完全一致（周日为 0 并标注）
    const exact: Record<number, { p: number; t: number; d: number; note?: string }> = {
      1: { p: 412300000, t: 410800000, d: -1500000 },
      2: { p: 398500000, t: 401200000, d: 2700000 },
      3: { p: 385900000, t: 386400000, d: 500000 },
      4: { p: 402700000, t: 402700000, d: 0 },
      5: { p: 0, t: 0, d: 0, note: '周日' },
      6: { p: 395200000, t: 394900000, d: -300000 },
      7: { p: 421800000, t: 420100000, d: -1700000 },
      8: { p: 437600000, t: 438900000, d: 1300000 },
      9: { p: 451200000, t: 450500000, d: -700000 },
      10: { p: 447300000, t: 447300000, d: 0 },
      11: { p: 0, t: 0, d: 0, note: '周日' },
      12: { p: 438100000, t: 439500000, d: 1400000 },
      13: { p: 442500000, t: 441900000, d: -600000 },
      14: { p: 436800000, t: 436800000, d: 0 },
      15: { p: 452900000, t: 453600000, d: 700000 },
      16: { p: 468400000, t: 467200000, d: -1200000 },
      17: { p: 471600000, t: 472100000, d: 500000 },
      18: { p: 0, t: 0, d: 0, note: '周日' },
      19: { p: 466200000, t: 465800000, d: -400000 },
      20: { p: 479500000, t: 480300000, d: 800000 },
      21: { p: 487100000, t: 486500000, d: -600000 },
      22: { p: 492800000, t: 492800000, d: 0 },
      23: { p: 498200000, t: 499400000, d: 1200000 },
      24: { p: 503700000, t: 502900000, d: -800000 },
      25: { p: 0, t: 0, d: 0, note: '周日' },
      26: { p: 511400000, t: 510600000, d: -800000 },
      27: { p: 518900000, t: 519700000, d: 800000 },
      28: { p: 524600000, t: 523900000, d: -700000 },
      29: { p: 531200000, t: 532400000, d: 1200000 },
      30: { p: 538500000, t: 537300000, d: -1200000 },
      31: { p: 546900000, t: 545800000, d: -1100000 },
    }
    return Array.from({ length: 31 }, (_, i) => {
      const day = i + 1
      const ex = exact[day]
      return {
        day,
        date: `07-${String(day).padStart(2, '0')}`,
        payooSettle: ex.p,
        tcbCredit: ex.t,
        diff: ex.d,
        ...(ex.note ? { note: ex.note } : {}),
      }
    })
  })()

  const mkDiscrepancy = (
    id: string, channel: Discrepancy['channel'], root: DiffRoot, rootLabel: string,
    extra: Partial<Discrepancy> = {},
  ): Discrepancy => ({
    id,
    channel,
    root,
    rootLabel,
    amount: 0,
    description: '',
    suggestion: '',
    status: 'pending' as DiffStatus,
    ...extra,
  })

  const discrepancies: Discrepancy[] = [
    mkDiscrepancy('D-0001', 'ONLINE', 'R4', 'PAYOO 有 · OMS 无（补单）', { orderNo: '20260701092051001012738608', storeNo: 'VN013', amount: 87000, time: '2026-07-01', description: 'OMS 未找到该笔订单号（PAYOO 已收款 87,000 ₫）。', suggestion: 'OMS 漏单或跨日时间戳，确认补录后重跑。', omsSide: '未找到', billSide: 'PAYOO Completed · 87,000 ₫' }),
    mkDiscrepancy('D-0002', 'ONLINE', 'R4', 'PAYOO 有 · OMS 无（补单）', { orderNo: '20260701092051000785236609', storeNo: 'VN008', amount: 213500, time: '2026-07-01', description: 'OMS 未找到该笔订单号（PAYOO 已收款 213,500 ₫）。', suggestion: '核对 OMS 是否漏单。', status: 'pending', omsSide: '未找到', billSide: 'PAYOO Completed · 213,500 ₫' }),
    mkDiscrepancy('D-0003', 'ONLINE', 'R4', 'PAYOO 有 · OMS 无（补单）', { orderNo: '20260701092051000443561476', storeNo: 'VN003', amount: 129500, time: '2026-07-01', description: 'OMS 未找到该笔订单号（PAYOO 已收款 129,500 ₫）。', suggestion: '核对 OMS 是否漏单。', omsSide: '未找到', billSide: 'PAYOO Completed · 129,500 ₫' }),
    mkDiscrepancy('D-0004', 'INSTORE', 'R3', '时间超容差（±5min）', { storeNo: 'VN006', amount: 65000, time: '2026-07-01', description: '门店+金额匹配失败，可能为时间漂移或金额取整。', suggestion: 'POS 调单延迟；同店同额可手动关联，阈值建议放宽至 60 分钟。', omsSide: 'OMS 未找到（时间或金额漂移）', billSide: 'INSTORE 65,000 ₫' }),
    mkDiscrepancy('D-0005', 'INSTORE', 'R3', '时间超容差（±5min）', { storeNo: 'VN018', amount: 75000, time: '2026-07-01', description: '门店+金额匹配失败，可能为时间漂移或金额取整。', suggestion: 'POS 调单延迟。', omsSide: 'OMS 未找到', billSide: 'INSTORE 75,000 ₫' }),
    mkDiscrepancy('D-0006', 'CASH', 'CASH', '现金缴存异常（差 220.69M）', { storeNo: 'UNKNOWN', amount: 0, expected: 220690000, diffAmt: -220690000, diffRate: '100%', description: 'TCB 缴存 desc 中无法提取 VN 门店号的部分（220.69M VND），需手工核对。', suggestion: '门店盘点 + 备用金政策核查。', omsSide: '现金销售 0', billSide: 'TCB 缴存 220,690,000' }),
    mkDiscrepancy('D-0007', 'CASH', 'CASH', '门店缴存异常', { storeNo: 'VN008', amount: 290389000, expected: 166647000, diffAmt: 123742000, diffRate: '42.6%', description: 'VN008 现金销售 290M，缴存仅 166M，缺 123M。', suggestion: '门店盘点 + 备用金政策核查。', omsSide: '现金销售 290,389,000', billSide: 'TCB 缴存 166,647,000' }),
    mkDiscrepancy('D-0008', 'CASH', 'CASH', '门店缴存异常', { storeNo: 'VN012', amount: 123453000, expected: 56048000, diffAmt: 67405000, diffRate: '54.6%', description: 'VN012 现金销售 123M，缴存仅 56M，缺 67M。', suggestion: '门店盘点。', omsSide: '现金销售 123,453,000', billSide: 'TCB 缴存 56,048,000' }),
    mkDiscrepancy('D-0009', 'L2', 'L2', 'T+N 跨月 (N30.6.2026)', { amount: 214495942, expected: 0, diffAmt: 214495942, time: '2026-07-01', description: '6/30 结算 214M 在 7/1 到账，结算日 N30.6.2026 与 7 月 PAYOO 账单不匹配。', suggestion: '已正确归为 DIFF，6 月尾单 T+1 跨月到账。', omsSide: '银行入账 214,495,942', billSide: '期望 0' }),
    mkDiscrepancy('D-0010', 'L2', 'L2', '多日合并 (N10.7-12.7.2026)', { amount: 799158249, expected: 0, diffAmt: 799158249, time: '2026-07-13', description: '10-12 三日合并结算 799M，需展开日期范围匹配 PAYOO ONLINE 7/10-7/12 账单。', suggestion: '解析 "N10.7-12.7.2026" 区间，合并 PAYOO 当日金额。', omsSide: '银行入账 799,158,249', billSide: '期望 0' }),
    mkDiscrepancy('D-0011', 'L2', 'L2', 'TT TD QR 跨日合并 (N3.7_5.7.2026)', { amount: 229923139, expected: 0, diffAmt: 229923139, time: '2026-07-06', description: 'TT TD QR 3-5 三日合并结算 230M，需展开日期范围匹配 INSTORE QR 账单。', suggestion: '解析 "ngay 03.07_05.07.2026" 区间，合并 INSTORE QR 当日金额。', omsSide: '银行入账 229,923,139', billSide: '期望 0' }),
  ]

  const freeOrders: FreeOrder[] = [
    { id: 'F-0001', orderNo: '20260723042051000504930964', storeNo: 'VN008', amount: 75000, total: 75000, disc: 0, verify: 'include', note: '标记免单但全额收款，须纳入收入' },
    { id: 'F-0002', orderNo: '20260723042051001006510982', storeNo: 'VN017', amount: 65000, total: 65000, disc: 0, verify: 'include', note: '标记免单但全额收款，须纳入收入' },
    { id: 'F-0003', orderNo: '20260723042051000932932220', storeNo: 'VN008', amount: 0, total: 100, disc: 100, verify: 'ok', note: '正常免单（全额优惠）' },
    { id: 'F-0004', orderNo: '20260718042051000377460158', storeNo: 'VN019', amount: 0, total: 150000, disc: 150000, verify: 'ok', note: '正常免单（全额优惠）' },
    { id: 'F-0005', orderNo: '20260721042051000377460160', storeNo: 'VN005', amount: 48000, total: 48000, disc: 0, verify: 'include', note: '标记免单但全额收款，须纳入收入' },
    { id: 'F-0006', orderNo: '20260711042051000504931000', storeNo: 'VN013', amount: 0, total: 86000, disc: 86000, verify: 'ok', note: '正常免单（全额优惠）' },
    { id: 'F-0007', orderNo: '20260714042051001006511000', storeNo: 'VN016', amount: 210000, total: 210000, disc: 0, verify: 'include', note: '标记免单但全额收款，须纳入收入' },
    { id: 'F-0008', orderNo: '20260728042051000307801700', storeNo: 'VN019', amount: 32000, total: 32000, disc: 0, verify: 'manual', note: '金额异常小，需人工确认' },
  ]

  const refunds: RefundItem[] = [
    { id: 'R-0001', orderNo: '20260723092051000004604809', storeNo: 'VN020', status: 8, statusLabel: '退款', amount: 247000, time: '2026-07-23', root: 'NORMAL', rootLabel: '正常退款闭环' },
    { id: 'R-0002', orderNo: '20260719042051000377460158', storeNo: 'VN019', status: 8, statusLabel: '退款', amount: 150000, time: '2026-07-19', root: 'NORMAL', rootLabel: '正常退款闭环' },
    { id: 'R-0003', orderNo: '20260718042051000307801400', storeNo: 'VN002', status: 8, statusLabel: '退款', amount: 189000, time: '2026-07-18', root: 'NORMAL', rootLabel: '正常退款闭环' },
    { id: 'R-0004', orderNo: '20260722092051000204547000', storeNo: 'VN006', status: 8, statusLabel: '退款', amount: 250000, time: '2026-07-22', root: 'NORMAL', rootLabel: '正常退款闭环' },
    { id: 'R-0005', orderNo: '20260726042051000307801500', storeNo: 'VN014', status: 7, statusLabel: '取消', amount: 98000, time: '2026-07-26', root: 'NORMAL', rootLabel: '正常取消未扣款' },
    { id: 'R-0006', orderNo: '20260729092051000666821900', storeNo: 'VN018', status: 8, statusLabel: '退款', amount: 312000, time: '2026-07-29', root: 'NORMAL', rootLabel: '正常退款闭环' },
  ]

  const coverage: CoverageCell[] = [
    { source: 4, payType: 4, cnt: 21233, amt: 2745754450, owner: 'INSTORE', cover: true },
    { source: 4, payType: 46, cnt: 18130, amt: 2142458000, owner: 'INSTORE', cover: true },
    { source: 4, payType: 98, cnt: 25126, amt: 3233104700, owner: '现金缴存', cover: true },
    { source: 4, payType: 500, cnt: 486, amt: 36052600, owner: '免单验证', cover: true },
    { source: 9, payType: -1, cnt: 692, amt: 0, owner: '异常（全零待澄清）', cover: true, note: '金额全零，不计收入' },
    { source: 9, payType: 4, cnt: 12617, amt: 1961462250, owner: 'ONLINE', cover: true },
    { source: 9, payType: 45, cnt: 689, amt: 95286750, owner: 'ONLINE', cover: true },
    { source: 9, payType: 46, cnt: 46123, amt: 5926841300, owner: 'ONLINE', cover: true },
    { source: 10, payType: 4, cnt: 43, amt: 6733250, owner: 'ONLINE', cover: true },
    { source: 10, payType: 45, cnt: 1, amt: 97000, owner: 'ONLINE', cover: true },
    { source: 10, payType: 46, cnt: 1474, amt: 114089750, owner: 'ONLINE', cover: true },
    { source: 15, payType: 4, cnt: 3, amt: 332000, owner: 'ONLINE(待确认)', cover: true, note: '来源 15 需确认归属' },
    { source: 15, payType: 46, cnt: 1, amt: 79000, owner: 'ONLINE(待确认)', cover: true },
    { source: 15, payType: 98, cnt: 1, amt: 69000, owner: '现金缴存', cover: true },
    { source: 22, payType: 4, cnt: 2, amt: 277000, owner: 'ONLINE(待确认)', cover: true, note: '来源 22 需确认归属' },
    { source: 22, payType: 98, cnt: 1, amt: 79000, owner: '现金缴存', cover: true },
    { source: 22, payType: 500, cnt: 1, amt: 0, owner: '免单验证', cover: true },
  ]

  return {
    summary: {
      totalOrders: 126623,
      totalAmount: 16262716050,
      overallMatchRate: '99.07%',
      diffCount: 1426,
      diffAmount: 58342000,
      uncovered: 0,
      taskId: 'VN-202607-001 (mock)',
      runAt: '2026-08-11 16:35',
    },
    omsByBusiness: [
      { key: '1', label: '业务类型 1（堂食/外带）', cnt: 41319, amt: 4037404700, pct: 32.63 },
      { key: '2', label: '业务类型 2', cnt: 126, amt: 13297000, pct: 0.10 },
      { key: '3', label: '业务类型 3（外卖）', cnt: 65092, amt: 8511068450, pct: 51.41 },
      { key: '11', label: '业务类型 11（其他）', cnt: 20086, amt: 3700945900, pct: 15.86 },
    ],
    omsBySource: [
      { key: '4', label: 'order_source=4（POS 门店）', cnt: 64975, amt: 8157369750, pct: 51.31 },
      { key: '9', label: 'order_source=9（APP）', cnt: 60121, amt: 7983590300, pct: 47.48 },
      { key: '10', label: 'order_source=10（H5）', cnt: 1518, amt: 120920000, pct: 1.20 },
      { key: '15', label: 'order_source=15', cnt: 5, amt: 480000, pct: 0.00 },
      { key: '22', label: 'order_source=22', cnt: 4, amt: 356000, pct: 0.00 },
    ],
    omsByPayType: [
      { key: '4', label: 'pay_type=4（银行卡）', cnt: 33898, amt: 4714558950, pct: 26.77 },
      { key: '45', label: 'pay_type=45（本地卡）', cnt: 690, amt: 95383750, pct: 0.54 },
      { key: '46', label: 'pay_type=46（VietQR）', cnt: 65728, amt: 8183468050, pct: 51.91 },
      { key: '98', label: 'pay_type=98（现金）', cnt: 25128, amt: 3233252700, pct: 19.84 },
      { key: '500', label: 'pay_type=500（免单）', cnt: 487, amt: 36052600, pct: 0.38 },
      { key: '-1', label: 'pay_type=-1（异常全零）', cnt: 692, amt: 0, pct: 0.55 },
    ],
    omsByStatus: [
      { key: '6', label: 'order_status=6（已完成）', cnt: 121368, amt: 15644990250, pct: 95.85 },
      { key: '7', label: 'order_status=7（取消）', cnt: 4760, amt: 524915700, pct: 3.76 },
      { key: '8', label: 'order_status=8（退款）', cnt: 491, amt: 92281100, pct: 0.39 },
      { key: '3', label: 'order_status=3（其他）', cnt: 4, amt: 529000, pct: 0.00 },
    ],
    channels: channelsData,
    bankDaily,
    bankRecon: {
      payooNet: 13285000000,
      bankIn: 14136000000,
      prevCross: 1269990072,
      monthAttributed: 12866000000,
      endUnsettled: 419000000,
      status: 'success',
    },
    discrepancies,
    freeOrders,
    refunds,
    coverage,
  }
}

export const vnProfile: CountryProfile = {
  id: 'vn',
  name: '越南 (Vietnam)',
  countryZh: '越南',
  flag: '🇻🇳',
  period: '2026-07',
  currency: {
    code: 'VND',
    symbol: '₫',
    short: fmtVND,
    full: fmtVNDFull,
  },
  dateFmt: 'yyyy-MM-dd',
  locale: 'zh-CN',
  slots,
  channels,
  bankDef: {
    settleParty: 'PAYOO',
    bankName: 'TCB',
    settleLabel: 'PAYOO 结算',
    bankLabel: 'TCB 入账',
    matchRule: 'Payoo 关键词 · CT DS→ONLINE / TT TD±QRCODE→QR/Card',
    equation: 'PAYOO净 = 银行归属本月 + 月末未到账',
    bankNote: '7 月末未到账 4.19 亿 ≈ 6 月末未到账 4.31 亿（差 1,225 万，含手续费口径），建议补 8 月初流水闭环。',
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
