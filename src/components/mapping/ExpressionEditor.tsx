import { Select, Input, InputNumber, Row, Col, Tag, Typography } from 'antd'
import type { ExpressionConfig, ExpressionOp } from '../../lib/mappingLogic'

const { Text } = Typography

const OP_OPTIONS: { value: ExpressionOp; label: string }[] = [
  { value: 'code_map', label: '码值映射（如 46→VietQR）' },
  { value: 'scale', label: '数值 scale（如 分→元 ÷100）' },
  { value: 'date_fmt', label: '日期格式转换' },
  { value: 'trim', label: '去首尾空白' },
]

interface Props {
  value: ExpressionConfig;
  onChange: (cfg: ExpressionConfig) => void;
  columns: string[];
}

/** 表达式转译编辑器：选择式算子，无需写代码 */
export default function ExpressionEditor({ value, onChange, columns }: Props) {
  const v: ExpressionConfig = value || { op: 'none', from: '' }

  const set = (patch: Partial<ExpressionConfig>) => onChange({ ...v, ...patch })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 320 }}>
      <Row gutter={8} align="middle">
        <Col flex="120px">
          <Text type="secondary" style={{ fontSize: 12 }}>源列</Text>
        </Col>
        <Col flex="auto">
          <Select
            size="small" style={{ width: '100%' }} showSearch
            value={v.from || undefined} placeholder="选择源列"
            onChange={(from) => set({ from })}
            options={columns.map((c) => ({ value: c, label: c }))}
          />
        </Col>
      </Row>
      <Row gutter={8} align="middle">
        <Col flex="120px">
          <Text type="secondary" style={{ fontSize: 12 }}>算子</Text>
        </Col>
        <Col flex="auto">
          <Select
            size="small" style={{ width: '100%' }}
            value={v.op}
            onChange={(op) => set({ op })}
            options={OP_OPTIONS}
          />
        </Col>
      </Row>

      {v.op === 'code_map' && (
        <Row gutter={8} align="middle">
          <Col flex="120px">
            <Text type="secondary" style={{ fontSize: 12 }}>码值映射表</Text>
          </Col>
          <Col flex="auto">
            <Input.TextArea
              size="small" rows={3}
              placeholder={'每行一条：原始值: 目标值\n例如：\n4: bank_card\n46: qr'}
              value={Object.entries(v.map || {}).map(([k, x]) => `${k}: ${x}`).join('\n')}
              onChange={(e) => {
                const map: Record<string, string> = {}
                for (const line of e.target.value.split('\n')) {
                  const t = line.trim()
                  if (!t) continue
                  const m = t.match(/^([^:：=\s]+)\s*[:：=]\s*(.+)$/)
                  if (m) map[m[1].trim()] = m[2].trim()
                  else map[t] = t
                }
                set({ map })
              }}
            />
          </Col>
        </Row>
      )}

      {v.op === 'scale' && (
        <Row gutter={8} align="middle">
          <Col flex="120px">
            <Text type="secondary" style={{ fontSize: 12 }}>除数（scale）</Text>
          </Col>
          <Col flex="auto">
            <InputNumber
              size="small" min={1} style={{ width: '100%' }}
              value={v.scale || 1}
              onChange={(n) => set({ scale: Number(n) || 1 })}
              addonAfter="值 ÷ 此数"
            />
          </Col>
        </Row>
      )}

      {v.op === 'date_fmt' && (
        <Row gutter={8}>
          <Col span={11}>
            <Text type="secondary" style={{ fontSize: 12 }}>输入格式</Text>
            <Input size="small" value={v.dateFrom || 'yyyy-MM-dd'} placeholder="yyyy-MM-dd"
              onChange={(e) => set({ dateFrom: e.target.value })} />
          </Col>
          <Col span={2} style={{ textAlign: 'center', lineHeight: '30px' }}>→</Col>
          <Col span={11}>
            <Text type="secondary" style={{ fontSize: 12 }}>输出格式</Text>
            <Input size="small" value={v.dateTo || 'yyyy-MM-dd'} placeholder="yyyy-MM-dd"
              onChange={(e) => set({ dateTo: e.target.value })} />
          </Col>
        </Row>
      )}

      {v.op !== 'none' && (
        <div>
          <Tag color="blue" style={{ fontSize: 11 }}>{v.op}</Tag>
          <Text type="secondary" style={{ fontSize: 11 }}>{v.label || '表达式已配置'}</Text>
        </div>
      )}
    </div>
  )
}
