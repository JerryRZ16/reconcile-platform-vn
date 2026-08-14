import { Select, InputNumber, Row, Col, Typography, Tag } from 'antd'
import type { TripletConfig } from '../../lib/mappingLogic'

const { Text } = Typography

interface Props {
  value: TripletConfig;
  onChange: (cfg: TripletConfig) => void;
  columns: string[];
}

/** 三元组编辑器：门店 + 金额 + 时间 组合键 + 时间容差 */
export default function TripletEditor({ value, onChange, columns }: Props) {
  const v: TripletConfig = value || { storeField: '', amountField: '', timeField: '', toleranceMin: 5 }

  const set = (patch: Partial<TripletConfig>) => onChange({ ...v, ...patch })

  const colOpts = columns.map((c) => ({ value: c, label: c }))
  const field = (label: string, key: 'storeField' | 'amountField' | 'timeField') => (
    <Row gutter={8} align="middle" style={{ marginBottom: 6 }}>
      <Col flex="120px"><Text type="secondary" style={{ fontSize: 12 }}>{label}</Text></Col>
      <Col flex="auto">
        <Select
          size="small" style={{ width: '100%' }} showSearch
          value={v[key] || undefined} placeholder="选择字段"
          onChange={(x) => set({ [key]: x } as Partial<TripletConfig>)}
          options={colOpts}
        />
      </Col>
    </Row>
  )

  return (
    <div style={{ minWidth: 320 }}>
      {field('门店号', 'storeField')}
      {field('金额', 'amountField')}
      {field('时间', 'timeField')}
      <Row gutter={8} align="middle">
        <Col flex="120px"><Text type="secondary" style={{ fontSize: 12 }}>时间容差</Text></Col>
        <Col flex="auto">
          <InputNumber
            size="small" min={1} max={1440} style={{ width: '100%' }}
            value={v.toleranceMin}
            onChange={(n) => set({ toleranceMin: Number(n) || 5 })}
            addonAfter="± 分钟"
          />
        </Col>
      </Row>
      <div style={{ marginTop: 6 }}>
        <Tag color="purple" style={{ fontSize: 11 }}>三元组</Tag>
        <Text type="secondary" style={{ fontSize: 11 }}>（门店 + 金额 + 时间）组合键匹配</Text>
      </div>
    </div>
  )
}
