import { Row, Col, Card, Statistic, Tag } from 'antd'
import {
  ShoppingCartOutlined, WalletOutlined, AimOutlined, WarningOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons'
import { fmtVND } from '../../data/mockData'
import type { ReconSummary } from '../../data/mockData'

export default function MetricCards({ summary }: { summary: ReconSummary }) {
  const cards = [
    {
      title: '总订单笔数', value: summary.totalOrders.toLocaleString(), suffix: '笔',
      icon: <ShoppingCartOutlined />, color: '#1d4ed8', bg: '#eef2ff',
    },
    {
      title: '总金额', value: fmtVND(summary.totalAmount), suffix: 'VND',
      icon: <WalletOutlined />, color: '#059669', bg: '#ecfdf5',
    },
    {
      title: '整体匹配率', value: summary.overallMatchRate, suffix: '',
      icon: <AimOutlined />, color: '#7c3aed', bg: '#f5f3ff',
      extra: <Tag color="green" style={{ marginTop: 4 }}>全通道闭环</Tag>,
    },
    {
      title: '差异笔数', value: summary.diffCount.toLocaleString(), suffix: '笔',
      icon: <ExclamationCircleOutlined />, color: '#d97706', bg: '#fffbeb',
    },
    {
      title: '差异金额', value: fmtVND(summary.diffAmount), suffix: 'VND',
      icon: <WarningOutlined />, color: '#dc2626', bg: '#fef2f2',
    },
    {
      title: '未覆盖组合', value: String(summary.uncovered), suffix: '个',
      icon: <CheckCircleOutlined />, color: '#059669', bg: '#ecfdf5',
    },
  ]
  return (
    <Row gutter={[16, 16]}>
      {cards.map((c) => (
        <Col xs={12} sm={8} lg={4} key={c.title}>
          <Card size="small" style={{ height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: c.bg, color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
                {c.icon}
              </div>
              <span style={{ fontSize: 12, color: '#6b7280' }}>{c.title}</span>
            </div>
            <Statistic
              value={c.value}
              valueStyle={{ fontSize: 20, fontWeight: 700, color: '#111827' }}
              suffix={<span style={{ fontSize: 12, color: '#9ca3af' }}>{c.suffix}</span>}
            />
            {c.extra}
          </Card>
        </Col>
      ))}
    </Row>
  )
}
