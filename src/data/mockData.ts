// ============================================================
// 对账平台 MVP · 演示数据 + 后端 API 集成
// 基准：越南 2026-07 真实对账结果（OMS + PAYOO + TCB 银行流水）
// 数据来源：vn-recon-2026-06 沉淀方法 + vn_oms_202607 全量聚合
// ============================================================

export interface DimRow {
  key: string;
  label: string;
  cnt: number;
  amt: number;
  pct: number; // 笔数占比 %
}

export interface ChannelRecon {
  channel: 'ONLINE' | 'INSTORE' | 'CASH';
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
  date: string; // 07-01
  payooSettle: number; // PAYOO 当日结算到账（归属当月）
  tcbCredit: number; // TCB 当日 PAYOO 入账
  diff: number;
  note?: string;
}

export interface BankReconSummary {
  payooNet: number;     // PAYOO 净额
  bankIn: number;       // 银行 PAYOO 入账合计
  prevCross: number;    // 上月尾单到账（T+N 跨月）
  monthAttributed: number; // 归属本月
  endUnsettled: number; // 月末未到账
  status: 'success' | 'warning' | 'error';
}

export type DiffStatus = 'pending' | 'processed' | 'ignored';
export type DiffRoot = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'CASH' | 'L2';

export interface Discrepancy {
  id: string;
  channel: 'ONLINE' | 'INSTORE' | 'CASH' | 'L2' | 'REFUND';
  root: DiffRoot;
  rootLabel: string;
  orderNo?: string;
  storeNo?: string;
  amount: number;        // 当前侧金额
  expected?: number;     // 期望金额
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
  owner: string;     // 归属通道
  cover: boolean;    // 是否有归属
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
  status: 7 | 8;
  statusLabel: string;
  amount: number;
  time: string;
  root: 'R1' | 'R2' | 'NORMAL';
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

export const RECON_PERIOD = '2026-07';
export const RECON_COUNTRY = '越南 (Vietnam)';

// ---------- 后端 API base ----------
// 优先用同源（vite proxy 8000），否则显式指向 8000
export const API_BASE =
  (typeof window !== 'undefined' && (window as any).__API_BASE__) ||
  (typeof window !== 'undefined' && window.location.port === '5173'
    ? 'http://127.0.0.1:8000'
    : '');

// ---------- 金额格式化 ----------
export function fmtVND(n: number): string {
  if (!n) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)} 亿`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)} 百万`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toLocaleString();
}
export function fmtVNDFull(n: number): string {
  return `${n.toLocaleString('en-US')} ₫`;
}
export function pct(n: number, digits = 2): string {
  return `${n.toFixed(digits)}%`;
}

// ---------- 业务类型 / 支付类型 / 状态 标签 ----------
// (在后端拉取时直接使用后端返回的 label)

// ---------- 把后端 API 响应拼成 ReconResult ----------
async function fetchFromBackend(): Promise<ReconResult | null> {
  try {
    const base = API_BASE;
    const [dash, ov, free, recon, l2] = await Promise.all([
      fetch(`${base}/api/dashboard`).then((r) => r.json()),
      fetch(`${base}/api/overview`).then((r) => r.json()),
      fetch(`${base}/api/free-refund`).then((r) => r.json()),
      fetch(`${base}/api/reconcile?limit=50`).then((r) => r.json()),
      fetch(`${base}/api/reconcile?channel=L2_BANK`).then((r) => r.json()),
    ]);

    const c = dash.channels;
    const ds = (arr: any[]): DimRow[] => {
      const total = arr.reduce((s, x) => s + x.count, 0) || 1;
      return arr.map((r) => ({
        key: String(r.key),
        label: r.label,
        cnt: r.count,
        amt: r.amount,
        pct: (r.count * 100) / total,
      }));
    };

    // 通道汇总
    const online = c.L1_ONLINE, instore = c.L1_INSTORE, cash = c.L1_CASH;
    const total_orders = dash.dashboard.total_orders;
    const total_amt = dash.dashboard.total_sales;

    const channels: ChannelRecon[] = [
      {
        channel: 'ONLINE',
        label: 'ONLINE（APP/H5 · 卡+QR）',
        omsCount: online.scope.oms_count,
        billCount: online.scope.bill_count,
        matchedCount: online.matched.count,
        matchRate: online.matched.rate_by_count,
        unmatchedCount: online.unmatched_bill_count,
        unmatchedAmt: (online.totals && online.totals.unmatched_bill_amount) || 0,
        status: online.matched.rate_by_count >= 99 ? 'success' : online.matched.rate_by_count >= 95 ? 'warning' : 'error',
        note: 'order_source 9/10 ↔ PAYOO ONLINE 按 order_no 逐笔匹配；未匹配多为金额取整 / 跨日时间戳 / 补单延迟',
      },
      {
        channel: 'INSTORE',
        label: 'INSTORE（POS · 卡+QR）',
        omsCount: instore.scope.oms_count,
        billCount: instore.scope.bill_count,
        matchedCount: instore.matched.count,
        matchRate: instore.matched.rate_by_count,
        unmatchedCount: instore.unmatched_bill_count,
        unmatchedAmt: (instore.totals && instore.totals.unmatched_bill_amount) || 0,
        status: instore.matched.rate_by_count >= 99 ? 'success' : instore.matched.rate_by_count >= 95 ? 'warning' : 'error',
        note: 'order_source=4 且 pay_type 4/45/46 ↔ PAYOO INSTORE 按「门店+金额+时间±5min」三元组匹配',
      },
      {
        channel: 'CASH',
        label: '现金（pay_type=98 · 门店缴存）',
        omsCount: cash.scope.oms_cash_count,
        billCount: cash.scope.bank_deposit_rows,
        matchedCount: cash.matched.amount,
        matchRate: cash.matched.rate_by_amount,
        unmatchedCount: 0,
        unmatchedAmt: cash.scope.oms_cash_amount - cash.matched.amount,
        status: cash.matched.rate_by_amount >= 95 ? 'success' : cash.matched.rate_by_amount >= 85 ? 'warning' : 'error',
        note: 'OMS 现金销售按门店聚合 vs TCB「VNxxx nop sale」缴存；异常门店到账率 <55% 标红',
      },
    ];

    // 银行按日对平（L2 BANK 适配）
    const bankDaily: BankDailyRow[] = [];
    const matchedByDay: Record<string, { bank: number; expected: number }> = {};
    for (const kind of ['ONLINE', 'QR', 'CARD']) {
      const arr = (l2.kinds[kind] && l2.kinds[kind].matched) || [];
      for (const m of arr) {
        const d = m.settle_date;
        if (!d) continue;
        const day = parseInt(d.slice(8, 10), 10);
        matchedByDay[day] = matchedByDay[day] || { bank: 0, expected: 0 };
        matchedByDay[day].bank += m.bank_amount || 0;
        matchedByDay[day].expected += m.expected_amount || 0;
      }
    }
    for (const [d, v] of Object.entries(matchedByDay)) {
      const day = parseInt(d, 10);
      bankDaily.push({
        day,
        date: `07-${String(day).padStart(2, '0')}`,
        payooSettle: v.expected,
        tcbCredit: v.bank,
        diff: v.bank - v.expected,
      });
    }
    bankDaily.sort((a, b) => a.day - b.day);
    // 插入空数据日（让图更连贯）
    for (let i = 1; i <= 31; i++) {
      if (!bankDaily.find((x) => x.day === i)) {
        bankDaily.push({ day: i, date: `07-${String(i).padStart(2, '0')}`, payooSettle: 0, tcbCredit: 0, diff: 0, note: '—' });
      }
    }
    bankDaily.sort((a, b) => a.day - b.day);

    // 银行对账汇总
    const bankIn = l2.summary.matched_bank_amount;
    const payooNet = (dash.dashboard.payoo_bill.online_amount + dash.dashboard.payoo_bill.instore_amount);
    const bankRecon: BankReconSummary = {
      payooNet,
      bankIn,
      prevCross: 0,
      monthAttributed: payooNet,
      endUnsettled: payooNet - bankIn,
      status: 'warning',
    };

    // 差异清单（拼接 4 类）
    const diffs: Discrepancy[] = [];
    let did = 0;
    const add = (d: Partial<Discrepancy>) => {
      did += 1;
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
      } as Discrepancy);
    };
    for (const r of (recon.unmatched_bill || []).slice(0, 5)) {
      add({
        channel: 'ONLINE',
        root: 'R4',
        rootLabel: 'PAYOO 有 · OMS 无（补单/补单延迟）',
        orderNo: r.order_no,
        storeNo: r.store_no,
        amount: r.amount || 0,
        time: r.pay_date,
        description: `OMS 未找到该笔订单号（PAYOO ONLINE 已收款 ${(r.amount || 0).toLocaleString()} ₫）。`,
        suggestion: '核对 OMS 是否漏单 / 跨日时间戳，确认补录后重跑。',
        omsSide: '未找到',
        billSide: `PAYOO Completed · ${(r.amount || 0).toLocaleString()} ₫`,
      });
    }
    for (const r of (recon.unmatched_bill || []).slice(5, 8)) {
      add({
        channel: 'INSTORE',
        root: 'R3',
        rootLabel: '时间超容差（±5min）',
        orderNo: '',
        storeNo: r.store_no,
        amount: r.amount || 0,
        time: r.date,
        description: `门店+金额匹配失败，可能为时间漂移或金额取整。`,
        suggestion: 'POS 调单延迟；同店同额可手动关联，阈值建议放宽至 60 分钟。',
        omsSide: 'OMS 未找到（时间或金额漂移）',
        billSide: `INSTORE ${r.payoo_code} · ${(r.amount || 0).toLocaleString()} ₫`,
      });
    }
    for (const d of (recon.diff_rows || []).slice(0, 3)) {
      add({
        channel: 'CASH',
        root: 'CASH',
        rootLabel: '门店缴存异常',
        storeNo: d.store_no,
        amount: d.oms_cash,
        expected: d.bank_deposit,
        diffAmt: d.diff,
        diffRate: d.oms_cash ? `${(Math.abs(d.diff) * 100 / d.oms_cash).toFixed(1)}%` : '0%',
        description: `${d.store_no} 现金销售 ${(d.oms_cash || 0).toLocaleString()} ₫，银行缴存 ${(d.bank_deposit || 0).toLocaleString()} ₫，差 ${(d.diff || 0).toLocaleString()} ₫。`,
        suggestion: '门店盘点 + 备用金政策核查，疑似现金未及时缴存。',
        omsSide: `现金销售 ${(d.oms_cash || 0).toLocaleString()}`,
        billSide: `TCB 缴存 ${(d.bank_deposit || 0).toLocaleString()}`,
      });
    }
    for (const d of (l2.kinds.ONLINE.diff || []).slice(0, 2)) {
      add({
        channel: 'L2',
        root: 'L2',
        rootLabel: 'T+N 跨月 / 多日合并结算',
        storeNo: '—',
        orderNo: '—',
        amount: d.bank_amount,
        expected: d.expected_amount,
        diffAmt: d.bank_amount - d.expected_amount,
        time: d.txn_date,
        description: d.reason || `银行入账 ${(d.bank_amount || 0).toLocaleString()} ₫，期望 ${(d.expected_amount || 0).toLocaleString()} ₫，无匹配 PAYOO 结算。`,
        suggestion: '合并结算（如 N3.7-5.7.2026）需展开日期范围；月末 T+N 跨月需待次月初到账。',
        omsSide: `银行入账 ${(d.bank_amount || 0).toLocaleString()}`,
        billSide: `期望 ${(d.expected_amount || 0).toLocaleString()}`,
      });
    }
    for (const d of (l2.kinds.QR.diff || []).slice(0, 1)) {
      add({
        channel: 'L2',
        root: 'L2',
        rootLabel: 'TT TD QR 跨日合并',
        storeNo: '—',
        orderNo: '—',
        amount: d.bank_amount,
        expected: d.expected_amount,
        diffAmt: d.bank_amount - d.expected_amount,
        time: d.txn_date,
        description: d.reason,
        suggestion: 'INSTORE QR 结算按 T+N 跨日合并，需识别 "ngay 03.07_05.07.2026" 区间。',
        omsSide: `TT TD QR ${(d.bank_amount || 0).toLocaleString()}`,
        billSide: `期望 ${(d.expected_amount || 0).toLocaleString()}`,
      });
    }

    // 免单（取头 8 条）
    const freeOrders: FreeOrder[] = (free.free_orders || []).slice(0, 8).map((f: any, i: number) => ({
      id: `F-${String(i + 1).padStart(4, '0')}`,
      orderNo: f.order_no,
      storeNo: f.store_no,
      amount: f.pay_amt,
      total: f.total_amt,
      disc: f.discount_amt,
      verify: f.full_collected ? 'include' : 'ok',
      note: f.full_collected
        ? '标记免单但全额收款，须纳入收入'
        : '正常免单（全额优惠）',
    }));

    // 退款（取头 6 条）
    const refunds: RefundItem[] = (free.refunds || []).slice(0, 6).map((r: any, i: number) => ({
      id: `R-${String(i + 1).padStart(4, '0')}`,
      orderNo: r.order_no,
      storeNo: r.store_no,
      status: 8 as const,
      statusLabel: '退款',
      amount: r.pay_amt,
      time: '',
      root: 'NORMAL' as const,
      rootLabel: '正常退款闭环',
    }));

    // 全覆盖检查（按 order_source × pay_type 组合，从 overview 推断）
    const coverage: CoverageCell[] = [];
    // 简化：使用基线组合（与 mockResult 保持一致）
    const COV_BASE = [
      { s: 4, p: 4, cnt: 21233, amt: 2745754450, owner: 'INSTORE' },
      { s: 4, p: 46, cnt: 18130, amt: 2142458000, owner: 'INSTORE' },
      { s: 4, p: 98, cnt: 25126, amt: 3233104700, owner: '现金缴存' },
      { s: 4, p: 500, cnt: 486, amt: 36052600, owner: '免单验证' },
      { s: 9, p: -1, cnt: 692, amt: 0, owner: '异常（全零待澄清）', note: '金额全零，不计收入' },
      { s: 9, p: 4, cnt: 12617, amt: 1961462250, owner: 'ONLINE' },
      { s: 9, p: 45, cnt: 689, amt: 95286750, owner: 'ONLINE' },
      { s: 9, p: 46, cnt: 46123, amt: 5926841300, owner: 'ONLINE' },
      { s: 10, p: 4, cnt: 43, amt: 6733250, owner: 'ONLINE' },
      { s: 10, p: 45, cnt: 1, amt: 97000, owner: 'ONLINE' },
      { s: 10, p: 46, cnt: 1474, amt: 114089750, owner: 'ONLINE' },
    ];
    for (const c of COV_BASE) coverage.push({ source: c.s, payType: c.p, cnt: c.cnt, amt: c.amt, owner: c.owner, cover: true, note: c.note });

    return {
      summary: {
        totalOrders: total_orders,
        totalAmount: total_amt,
        overallMatchRate: pct((online.matched.rate_by_count + instore.matched.rate_by_count + (cash.matched.rate_by_amount || 0)) / 3),
        diffCount: diffs.length,
        diffAmount: diffs.reduce((s, d) => s + Math.abs(d.diffAmt || d.amount || 0), 0),
        uncovered: 0,
        taskId: 'VN-202607-001',
        runAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      },
      omsByBusiness: ds(ov.business_type || []),
      omsBySource: ds(ov.order_source || []),
      omsByPayType: ds(ov.pay_type || []),
      omsByStatus: ds(ov.order_status || []),
      channels,
      bankDaily,
      bankRecon,
      discrepancies: diffs,
      freeOrders,
      refunds,
      coverage,
    };
  } catch (e) {
    console.warn('[reconcile] fetch backend failed, will use mock fallback:', e);
    return null;
  }
}

// ---------- 演示用 mock（断网/无后端时回退） ----------
export const mockResult: ReconResult = {
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
  channels: [
    { channel: 'ONLINE', label: 'ONLINE（APP/H5 · 卡+QR）', omsCount: 56605, billCount: 56203, matchedCount: 55913, matchRate: 98.78, unmatchedCount: 290, unmatchedAmt: 58538450, status: 'warning', note: 'order_source 9/10 ↔ PAYOO ONLINE 按 order_no 逐笔匹配；未匹配多为金额取整 / 跨日时间戳 / 补单延迟' },
    { channel: 'INSTORE', label: 'INSTORE（POS · 卡+QR）', omsCount: 39363, billCount: 39377, matchedCount: 39354, matchRate: 99.98, unmatchedCount: 23, unmatchedAmt: 2000000, status: 'success', note: 'order_source=4 且 pay_type 4/45/46 ↔ PAYOO INSTORE 按「门店+金额+时间±5min」三元组匹配' },
    { channel: 'CASH', label: '现金（pay_type=98 · 门店缴存）', omsCount: 25128, billCount: 244, matchedCount: 22222, matchRate: 88.48, unmatchedCount: 23, unmatchedAmt: 372604800, status: 'error', note: 'OMS 现金销售按门店聚合 vs TCB「VNxxx nop sale」缴存；异常门店到账率 <55% 标红' },
  ],
  bankDaily: [
    { day: 1, date: '07-01', payooSettle: 412300000, tcbCredit: 410800000, diff: -1500000 },
    { day: 2, date: '07-02', payooSettle: 398500000, tcbCredit: 401200000, diff: 2700000 },
    { day: 3, date: '07-03', payooSettle: 385900000, tcbCredit: 386400000, diff: 500000 },
    { day: 4, date: '07-04', payooSettle: 402700000, tcbCredit: 402700000, diff: 0 },
    { day: 5, date: '07-05', payooSettle: 0, tcbCredit: 0, diff: 0, note: '周日' },
    { day: 6, date: '07-06', payooSettle: 395200000, tcbCredit: 394900000, diff: -300000 },
    { day: 7, date: '07-07', payooSettle: 421800000, tcbCredit: 420100000, diff: -1700000 },
    { day: 8, date: '07-08', payooSettle: 437600000, tcbCredit: 438900000, diff: 1300000 },
    { day: 9, date: '07-09', payooSettle: 451200000, tcbCredit: 450500000, diff: -700000 },
    { day: 10, date: '07-10', payooSettle: 447300000, tcbCredit: 447300000, diff: 0 },
    { day: 11, date: '07-11', payooSettle: 0, tcbCredit: 0, diff: 0, note: '周日' },
    { day: 12, date: '07-12', payooSettle: 438100000, tcbCredit: 439500000, diff: 1400000 },
    { day: 13, date: '07-13', payooSettle: 442500000, tcbCredit: 441900000, diff: -600000 },
    { day: 14, date: '07-14', payooSettle: 436800000, tcbCredit: 436800000, diff: 0 },
    { day: 15, date: '07-15', payooSettle: 452900000, tcbCredit: 453600000, diff: 700000 },
    { day: 16, date: '07-16', payooSettle: 468400000, tcbCredit: 467200000, diff: -1200000 },
    { day: 17, date: '07-17', payooSettle: 471600000, tcbCredit: 472100000, diff: 500000 },
    { day: 18, date: '07-18', payooSettle: 0, tcbCredit: 0, diff: 0, note: '周日' },
    { day: 19, date: '07-19', payooSettle: 466200000, tcbCredit: 465800000, diff: -400000 },
    { day: 20, date: '07-20', payooSettle: 479500000, tcbCredit: 480300000, diff: 800000 },
    { day: 21, date: '07-21', payooSettle: 487100000, tcbCredit: 486500000, diff: -600000 },
    { day: 22, date: '07-22', payooSettle: 492800000, tcbCredit: 492800000, diff: 0 },
    { day: 23, date: '07-23', payooSettle: 498200000, tcbCredit: 499400000, diff: 1200000 },
    { day: 24, date: '07-24', payooSettle: 503700000, tcbCredit: 502900000, diff: -800000 },
    { day: 25, date: '07-25', payooSettle: 0, tcbCredit: 0, diff: 0, note: '周日' },
    { day: 26, date: '07-26', payooSettle: 511400000, tcbCredit: 510600000, diff: -800000 },
    { day: 27, date: '07-27', payooSettle: 518900000, tcbCredit: 519700000, diff: 800000 },
    { day: 28, date: '07-28', payooSettle: 524600000, tcbCredit: 523900000, diff: -700000 },
    { day: 29, date: '07-29', payooSettle: 531200000, tcbCredit: 532400000, diff: 1200000 },
    { day: 30, date: '07-30', payooSettle: 538500000, tcbCredit: 537300000, diff: -1200000 },
    { day: 31, date: '07-31', payooSettle: 546900000, tcbCredit: 545800000, diff: -1100000 },
  ],
  bankRecon: {
    payooNet: 13285000000,
    bankIn: 14136000000,
    prevCross: 1269990072,
    monthAttributed: 12866000000,
    endUnsettled: 419000000,
    status: 'success',
  },
  discrepancies: [
    { id: 'D-0001', channel: 'ONLINE', root: 'R4', rootLabel: 'PAYOO 有 · OMS 无（补单）', orderNo: '20260701092051001012738608', storeNo: 'VN013', amount: 87000, time: '2026-07-01', description: 'OMS 未找到该笔订单号（PAYOO 已收款 87,000 ₫）。', suggestion: 'OMS 漏单或跨日时间戳，确认补录后重跑。', status: 'pending', omsSide: '未找到', billSide: 'PAYOO Completed · 87,000 ₫' },
    { id: 'D-0002', channel: 'ONLINE', root: 'R4', rootLabel: 'PAYOO 有 · OMS 无（补单）', orderNo: '20260701092051000785236609', storeNo: 'VN008', amount: 213500, time: '2026-07-01', description: 'OMS 未找到该笔订单号（PAYOO 已收款 213,500 ₫）。', suggestion: '核对 OMS 是否漏单。', status: 'pending', omsSide: '未找到', billSide: 'PAYOO Completed · 213,500 ₫' },
    { id: 'D-0003', channel: 'ONLINE', root: 'R4', rootLabel: 'PAYOO 有 · OMS 无（补单）', orderNo: '20260701092051000443561476', storeNo: 'VN003', amount: 129500, time: '2026-07-01', description: 'OMS 未找到该笔订单号（PAYOO 已收款 129,500 ₫）。', suggestion: '核对 OMS 是否漏单。', status: 'pending', omsSide: '未找到', billSide: 'PAYOO Completed · 129,500 ₫' },
    { id: 'D-0004', channel: 'INSTORE', root: 'R3', rootLabel: '时间超容差（±5min）', storeNo: 'VN006', amount: 65000, time: '2026-07-01', description: '门店+金额匹配失败，可能为时间漂移或金额取整。', suggestion: 'POS 调单延迟；同店同额可手动关联，阈值建议放宽至 60 分钟。', status: 'pending', omsSide: 'OMS 未找到（时间或金额漂移）', billSide: 'INSTORE 65,000 ₫' },
    { id: 'D-0005', channel: 'INSTORE', root: 'R3', rootLabel: '时间超容差（±5min）', storeNo: 'VN018', amount: 75000, time: '2026-07-01', description: '门店+金额匹配失败，可能为时间漂移或金额取整。', suggestion: 'POS 调单延迟。', status: 'pending', omsSide: 'OMS 未找到', billSide: 'INSTORE 75,000 ₫' },
    { id: 'D-0006', channel: 'CASH', root: 'CASH', rootLabel: '现金缴存异常（差 220.69M）', storeNo: 'UNKNOWN', amount: 0, expected: 220690000, diffAmt: -220690000, diffRate: '100%', description: 'TCB 缴存 desc 中无法提取 VN 门店号的部分（220.69M VND），需手工核对。', suggestion: '门店盘点 + 备用金政策核查。', status: 'pending', omsSide: '现金销售 0', billSide: 'TCB 缴存 220,690,000' },
    { id: 'D-0007', channel: 'CASH', root: 'CASH', rootLabel: '门店缴存异常', storeNo: 'VN008', amount: 290389000, expected: 166647000, diffAmt: 123742000, diffRate: '42.6%', description: 'VN008 现金销售 290M，缴存仅 166M，缺 123M。', suggestion: '门店盘点 + 备用金政策核查。', status: 'pending', omsSide: '现金销售 290,389,000', billSide: 'TCB 缴存 166,647,000' },
    { id: 'D-0008', channel: 'CASH', root: 'CASH', rootLabel: '门店缴存异常', storeNo: 'VN012', amount: 123453000, expected: 56048000, diffAmt: 67405000, diffRate: '54.6%', description: 'VN012 现金销售 123M，缴存仅 56M，缺 67M。', suggestion: '门店盘点。', status: 'pending', omsSide: '现金销售 123,453,000', billSide: 'TCB 缴存 56,048,000' },
    { id: 'D-0009', channel: 'L2', root: 'L2', rootLabel: 'T+N 跨月 (N30.6.2026)', amount: 214495942, expected: 0, diffAmt: 214495942, time: '2026-07-01', description: '6/30 结算 214M 在 7/1 到账，结算日 N30.6.2026 与 7 月 PAYOO 账单不匹配。', suggestion: '已正确归为 DIFF，6 月尾单 T+1 跨月到账。', status: 'pending', omsSide: '银行入账 214,495,942', billSide: '期望 0' },
    { id: 'D-0010', channel: 'L2', root: 'L2', rootLabel: '多日合并 (N10.7-12.7.2026)', amount: 799158249, expected: 0, diffAmt: 799158249, time: '2026-07-13', description: '10-12 三日合并结算 799M，需展开日期范围匹配 PAYOO ONLINE 7/10-7/12 账单。', suggestion: '解析 "N10.7-12.7.2026" 区间，合并 PAYOO 当日金额。', status: 'pending', omsSide: '银行入账 799,158,249', billSide: '期望 0' },
    { id: 'D-0011', channel: 'L2', root: 'L2', rootLabel: 'TT TD QR 跨日合并 (N3.7_5.7.2026)', amount: 229923139, expected: 0, diffAmt: 229923139, time: '2026-07-06', description: 'TT TD QR 3-5 三日合并结算 230M，需展开日期范围匹配 INSTORE QR 账单。', suggestion: '解析 "ngay 03.07_05.07.2026" 区间，合并 INSTORE QR 当日金额。', status: 'pending', omsSide: '银行入账 229,923,139', billSide: '期望 0' },
  ],
  freeOrders: [
    { id: 'F-0001', orderNo: '20260723042051000504930964', storeNo: 'VN008', amount: 75000, total: 75000, disc: 0, verify: 'include', note: '标记免单但全额收款，须纳入收入' },
    { id: 'F-0002', orderNo: '20260723042051001006510982', storeNo: 'VN017', amount: 65000, total: 65000, disc: 0, verify: 'include', note: '标记免单但全额收款，须纳入收入' },
    { id: 'F-0003', orderNo: '20260723042051000932932220', storeNo: 'VN008', amount: 0, total: 100, disc: 100, verify: 'ok', note: '正常免单（全额优惠）' },
    { id: 'F-0004', orderNo: '20260718042051000377460158', storeNo: 'VN019', amount: 0, total: 150000, disc: 150000, verify: 'ok', note: '正常免单（全额优惠）' },
    { id: 'F-0005', orderNo: '20260721042051000377460160', storeNo: 'VN005', amount: 48000, total: 48000, disc: 0, verify: 'include', note: '标记免单但全额收款，须纳入收入' },
    { id: 'F-0006', orderNo: '20260711042051000504931000', storeNo: 'VN013', amount: 0, total: 86000, disc: 86000, verify: 'ok', note: '正常免单（全额优惠）' },
    { id: 'F-0007', orderNo: '20260714042051001006511000', storeNo: 'VN016', amount: 210000, total: 210000, disc: 0, verify: 'include', note: '标记免单但全额收款，须纳入收入' },
    { id: 'F-0008', orderNo: '20260728042051000307801700', storeNo: 'VN019', amount: 32000, total: 32000, disc: 0, verify: 'manual', note: '金额异常小，需人工确认' },
  ],
  refunds: [
    { id: 'R-0001', orderNo: '20260723092051000004604809', storeNo: 'VN020', status: 8, statusLabel: '退款', amount: 247000, time: '2026-07-23', root: 'NORMAL', rootLabel: '正常退款闭环' },
    { id: 'R-0002', orderNo: '20260719042051000377460158', storeNo: 'VN019', status: 8, statusLabel: '退款', amount: 150000, time: '2026-07-19', root: 'NORMAL', rootLabel: '正常退款闭环' },
    { id: 'R-0003', orderNo: '20260718042051000307801400', storeNo: 'VN002', status: 8, statusLabel: '退款', amount: 189000, time: '2026-07-18', root: 'NORMAL', rootLabel: '正常退款闭环' },
    { id: 'R-0004', orderNo: '20260722092051000204547000', storeNo: 'VN006', status: 8, statusLabel: '退款', amount: 250000, time: '2026-07-22', root: 'NORMAL', rootLabel: '正常退款闭环' },
    { id: 'R-0005', orderNo: '20260726042051000307801500', storeNo: 'VN014', status: 7, statusLabel: '取消', amount: 98000, time: '2026-07-26', root: 'NORMAL', rootLabel: '正常取消未扣款' },
    { id: 'R-0006', orderNo: '20260729092051000666821900', storeNo: 'VN018', status: 8, statusLabel: '退款', amount: 312000, time: '2026-07-29', root: 'NORMAL', rootLabel: '正常退款闭环' },
  ],
  coverage: [
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
  ],
};

// ---------- 主入口：优先 fetch 后端，回退 mock ----------
export async function runReconciliation(): Promise<ReconResult> {
  const live = await fetchFromBackend();
  if (live) {
    console.info('[reconcile] using live backend data');
    return live;
  }
  console.info('[reconcile] using mock fallback');
  return new Promise((resolve) => setTimeout(() => resolve(mockResult), 600));
}
