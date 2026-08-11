import { Row, Col, Card, Progress, Descriptions, Tag } from 'antd'
import { fmtVND } from '../../data/mockData'
import type { ChannelRecon } from '../../data/mockData'

export default function ChannelCards({ channels }: { channels: ChannelRecon[] }) {
  return (
    <Card title="L1 三通道对账结果（OMS ↔ PAYOO）" style={{ marginBottom: 16 }}>
      <Row gutter={[16, 16]}>
        {channels.map((c) => {
          const color = c.status === 'success' ? '#059669' : c.status === 'warning' ? '#d97706' : '#dc2626'
          return (
            <Col xs={24} md={8} key={c.channel}>
              <Card
                size="small"
                style={{ height: '100%', borderTop: `3px solid ${color}` }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600 }}>{c.label}</span>
                  <Tag color={c.status === 'success' ? 'green' : c.status === 'warning' ? 'orange' : 'red'}>
                    {c.status === 'success' ? '对平' : c.status === 'warning' ? '有差异' : '异常'}
                  </Tag>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0 12px' }}>
                  <Progress
                    type="dashboard"
                    percent={Number(c.matchRate.toFixed(2))}
                    size={110}
                    strokeColor={color}
                    format={(p) => <span style={{ fontSize: 18, fontWeight: 700, color }}>{p}%</span>}
                  />
                </div>
                <Descriptions
                  size="small" column={1}
                  items={[
                    { key: 'oms', label: 'OMS 侧', children: <span className="stat-number">{c.omsCount.toLocaleString()} 笔</span> },
                    { key: 'bill', label: '账单侧', children: <span className="stat-number">{c.billCount.toLocaleString()} 笔</span> },
                    { key: 'matched', label: '已匹配', children: <span className="stat-number" style={{ color: '#059669' }}>{c.matchedCount.toLocaleString()} 笔</span> },
                    { key: 'unmatched', label: '未匹配', children: <span className="stat-number" style={{ color: '#d97706' }}>{c.unmatchedCount.toLocaleString()} 笔 · {fmtVND(c.unmatchedAmt)}</span> },
                  ]}
                />
                <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280', background: '#f9fafb', padding: 8, borderRadius: 6 }}>
                  {c.note}
                </div>
              </Card>
            </Col>
          )
        })}
      </Row>
    </Card>
  )
}
