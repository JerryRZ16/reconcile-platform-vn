import { Select, Tooltip, Typography } from 'antd'
import { GlobalOutlined } from '@ant-design/icons'
import { countries, getCountryOption } from '../profiles'
import type { CountryProfile } from '../profiles'

const { Text } = Typography

interface Props {
  value: string;
  onChange: (id: string) => void;
  profile: CountryProfile;
}

/** 国家选择器：Header 右侧，选中后切换 profile（全局刷新流程） */
export default function CountrySelector({ value, onChange, profile }: Props) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <Tooltip title={`切换国家配置（当前 ${profile.countryZh} ${profile.period} 演示数据）`}>
        <GlobalOutlined style={{ color: '#9ca3af', fontSize: 14 }} />
      </Tooltip>
      <Select
        size="small"
        value={value}
        onChange={onChange}
        options={countries.map(getCountryOption)}
        style={{ minWidth: 168 }}
        popupMatchSelectWidth={false}
      />
      <Text type="secondary" style={{ fontSize: 12 }}>{profile.name}</Text>
    </span>
  )
}
