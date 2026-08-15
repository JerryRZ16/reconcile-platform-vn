// ============================================================
// Country Profile · 注册表
// 集中导出所有国家配置包；新增国家只需在 countries 中加入一份。
// App 通过 getProfile(id) 获取当前 profile，配合 localStorage 持久化。
// ============================================================
import type { CountryProfile } from './types'
import { vnProfile } from './vn'
import { thProfile } from './th'
import { myProfile } from './my'

export type { CountryProfile }
export type {
  UploadSlot, SlotKind, CurrencyDef, ChannelDef, BankDef,
  DiffRootDef, RuleMeta, FreeRefundDef, CoverageDef,
  MappingTemplate, MappingRow, ProfileUi,
} from './types'

/** 当前可用国家（越南 + 泰国 + 马来西亚；后续国家按配置文件扩展） */
export const countries: CountryProfile[] = [vnProfile, thProfile, myProfile]

export const defaultCountryId = 'vn'

export function getProfile(id: string): CountryProfile {
  return countries.find((c) => c.id === id) || vnProfile
}

export function getCountryOption(p: CountryProfile): { value: string; label: string } {
  return { value: p.id, label: `${p.flag} ${p.name}` }
}
