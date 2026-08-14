import { Select, InputNumber, Row, Col, Typography, Tag, Button } from 'antd'
import type { StoreCodeConfig, StoreRule } from '../../lib/mappingLogic'

const { Text } = Typography

const RULE_OPTIONS: { value: StoreRule; label: string }[] = [
  { value: 'raw', label: '原样（不转换）' },
  { value: 'strip_leading_zero', label: '去前置零（ST0012 → ST12）' },
  { value: 'pad', label: '补零到固定宽度（TH12 → TH0012）' },
]

interface Props {
  value: StoreCodeConfig;
  onChange: (cfg: StoreCodeConfig) => void;
  columns: string[];
}

/** 门店编码映射编辑器：归一化规则 + 可选字典 */
export default function StoreCodeEditor({ value, onChange, columns }: Props) {
  const v: StoreCodeConfig = value || { from: '', rule: 'raw' }

  const set = (patch: Partial<StoreCodeConfig>) => onChange({ ...v, ...patch })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 320 }}>
      <Row gutter={8} align="middle">
        <Col flex="120px"><Text type="secondary" style={{ fontSize: 12 }}>源列</Text></Col>
        <Col flex="auto">
          <Select
            size="small" style={{ width: '100%' }} showSearch
            value={v.from || undefined} placeholder="选择门店号源列"
            onChange={(from) => set({ from })}
            options={columns.map((c) => ({ value: c, label: c }))}
          />
        </Col>
      </Row>
      <Row gutter={8} align="middle">
        <Col flex="120px"><Text type="secondary" style={{ fontSize: 12 }}>归一化规则</Text></Col>
        <Col flex="auto">
          <Select
            size="small" style={{ width: '100%' }}
            value={v.rule}
            onChange={(rule) => set({ rule })}
            options={RULE_OPTIONS}
          />
        </Col>
      </Row>
      {v.rule === 'pad' && (
        <Row gutter={8} align="middle">
          <Col flex="120px"><Text type="secondary" style={{ fontSize: 12 }}>补零宽度</Text></Col>
          <Col flex="auto">
            <InputNumber size="small" min={2} max={8} style={{ width: '100%' }}
              value={v.padWidth || 4} onChange={(n) => set({ padWidth: Number(n) || 4 })} />
          </Col>
        </Row>
      )}
      <Row gutter={8} align="middle">
        <Col flex="120px"><Text type="secondary" style={{ fontSize: 12 }}>编码字典</Text></Col>
        <Col flex="auto">
          <Button size="small">导入门店映射 CSV（可选）</Button>
        </Col>
      </Row>
      <div>
        <Tag color="geekblue" style={{ fontSize: 11 }}>{v.rule}</Tag>
        <Text type="secondary" style={{ fontSize: 11 }}>门店编码归一化（映射到 OMS 侧门店号）</Text>
      </div>
    </div>
  )
}
