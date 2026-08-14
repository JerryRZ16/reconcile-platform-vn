// ============================================================
// Country Profile · 类型定义
// 对账平台「配置驱动」核心：每个国家一份配置包（profiles/<id>.ts），
// 前端所有国家相关硬编码点（币种/日期/文案/文件槽位/通道/规则/枚举/映射模板）
// 统一从 profile 读取。新国家接入 = 新增一份配置，不改业务代码。
// ============================================================
import type { ReconResult } from '../data/mockData'
import type {
  ExpressionConfig, StoreCodeConfig, TripletConfig, MappingType,
} from '../lib/mappingLogic'

/** 文件槽位语义分类 */
export type SlotKind = 'oms' | 'bill' | 'bank'
export type SlotIcon = 'excel' | 'text'

export interface UploadSlot {
  key: string        // 槽位 key（OMS 固定 'oms'；账单/银行可多槽位）
  title: string      // 槽位标题，如 'OMS 订单'
  desc: string       // 描述
  required: boolean
  fields: string     // 字段提示
  color: string
  kind: SlotKind     // 语义分类（订单/账单/银行）
  icon: SlotIcon
}

export interface CurrencyDef {
  code: string                          // 'VND'
  symbol: string                        // '₫'
  short: (n: number) => string          // 简写格式（亿/百万/K 等，按国家习惯）
  full: (n: number) => string           // 完整格式（千分位 + 符号）
}

export interface ChannelDef {
  channel: string   // 'ONLINE' | 'INSTORE' | 'CASH' | ...
  label: string
  note?: string
}

export interface BankDef {
  settleParty: string   // 结算方，如 'PAYOO'
  bankName: string      // 银行，如 'TCB'
  settleLabel: string   // 图表/表头「结算方 结算」
  bankLabel: string     // 图表/表头「银行 入账」
  matchRule: string     // 识别规则文案
  equation: string      // 勾稽关系文案
  bankNote?: string     // 月末未到账提示（国家相关，原越南文案硬编码点）
}

export interface DiffRootDef {
  root: string
  label: string
  color: string
}

export interface RuleMeta {
  key: string
  name: string
  desc: string
}

export interface FreeRefundDef {
  freePayType: number[]        // 免单支付类型
  refundStatus: number[]       // 退款状态
  cancelStatus: number[]       // 取消状态
  freeTitle: string            // 免单卡片标题
  refundTitle: string          // 退款/取消卡片标题
  verifyLabels: Record<string, { label: string; color: string }> // FreeOrder.verify 文案
}

export interface CoverageDef {
  dims: [string, string]      // ['order_source','pay_type']
  title: string               // 全覆盖标题
  colLabel: string            // 金额列标题前缀（组件拼币种代码）
}

export interface MappingRow {
  target: string
  label: string
  source: string          // 直接映射时的源列（默认值）
  required: boolean
  hint?: string
  type?: MappingType      // 四类映射：direct | expression | storecode | triplet
  expr?: ExpressionConfig // 表达式转译配置
  storeCode?: StoreCodeConfig // 门店编码映射配置
  triplet?: TripletConfig // 三元组配置
}

export interface MappingTemplate {
  file: string               // 文件标题（对应槽位 title）
  requiredOk: boolean
  rows: MappingRow[]
  sourceOptions: string[]    // 源列候选（真实场景来自上传文件表头）
}

/** 界面文案（国家相关部分） */
export interface ProfileUi {
  uploadIntro: string        // 上传步骤顶部说明（通用部分）
  uploadDemo: string         // 上传步骤演示模式说明（国家相关）
  uploadFlowHint: string     // App 步骤条 upload 阶段提示
  runningSubtitle: string    // 规则核对副标题（演示数据说明）
  resultDemoNote: string     // 结果页底部演示说明
  resultTitle: string        // 结果页大标题（如「越南 2026-07 全通道对账结果」）
}

export interface CountryProfile {
  id: string                 // 'vn'
  name: string               // '越南 (Vietnam)'
  countryZh: string          // '越南'
  flag: string               // '🇻🇳'
  period: string             // 演示对账期 '2026-07'
  currency: CurrencyDef
  dateFmt: string            // 'yyyy-MM-dd'
  locale: string             // 'zh-CN'
  slots: UploadSlot[]        // 文件槽位
  channels: ChannelDef[]     // L1 通道定义
  bankDef: BankDef           // 结算方 + 银行
  rootEnums: DiffRootDef[]   // 差异根因枚举 + 文案
  rules: RuleMeta[]          // 规则元数据
  freeRefundDef: FreeRefundDef
  coverageDef: CoverageDef
  showModules: string[]      // 结果组件开关
  uploadHints: Record<string, string[]> // 文件名归属校验
  mappingTemplates: MappingTemplate[]   // 预置字段映射模板
  ui: ProfileUi
  demoData: () => ReconResult           // 演示数据生成器（降级模式用）
}
