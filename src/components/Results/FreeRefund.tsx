import { Card, Table, Tag, Statistic, Row, Col, Alert, Typography } from 'antd'
import type { FreeOrder, RefundItem } from '../../data/mockData'
import type { CountryProfile } from '../../profiles'

const { Text } = Typography

interface FreeProps {
  data: FreeOrder[];
  profile: CountryProfile;
}

interface RefundProps {
  data: RefundItem[];
  profile: CountryProfile;
}

export function FreeOrders({ data, profile }: FreeProps) {
  const include = data.filter((d) => d.verify === 'include')
  const verify = profile.freeRefundDef.verifyLabels
  const cur = profile.currency
  return (
    <Card title={profile.freeRefundDef.freeTitle} style={{ marginBottom: 16 }}>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={8}><Statistic title="免单单总数" value={data.length} suffix="笔" /></Col>
        <Col span={8}>
          <Statistic
            title="标记免单但全额收款（须纳入收入）"
            value={include.length} suffix="笔" valueStyle={{ color: '#dc2626' }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="全额收款金额（漏记收入风险）"
            value={cur.full(include.reduce((s, d) => s + d.total, 0))}
            valueStyle={{ color: '#dc2626', fontSize: 15 }}
          />
        </Col>
      </Row>
      <Alert
        type="warning" showIcon style={{ marginBottom: 12 }}
        message="关键判定：标记「免单」但 disc=0 且 pay=total 的实际发生全额收款，必须纳入收入确认，避免漏记收入。"
      />
      <Table
        size="small" rowKey="id" pagination={false} dataSource={data}
        columns={[
          { title: '订单号', dataIndex: 'orderNo', render: (v) => <Text code style={{ fontSize: 12 }}>{v}</Text> },
          { title: '门店', dataIndex: 'storeNo', width: 80 },
          { title: 'pay', dataIndex: 'amount', align: 'right', render: (v) => <span className="stat-number">{cur.full(v)}</span> },
          { title: 'total', dataIndex: 'total', align: 'right', render: (v) => <span className="stat-number">{cur.full(v)}</span> },
          { title: 'disc', dataIndex: 'disc', align: 'right', render: (v) => <span className="stat-number">{cur.full(v)}</span> },
          { title: '验证结论', dataIndex: 'verify', render: (v) => <Tag color={verify[v as keyof typeof verify]?.color || 'default'}>{verify[v as keyof typeof verify]?.label || v}</Tag> },
          { title: '备注', dataIndex: 'note' },
        ]}
      />
    </Card>
  )
}

export function Refunds({ data, profile }: RefundProps) {
  const total = data.reduce((s, d) => s + d.amount, 0)
  const cur = profile.currency
  return (
    <Card title={profile.freeRefundDef.refundTitle} style={{ marginBottom: 16 }}>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}><Statistic title={`退款(status=${profile.freeRefundDef.refundStatus.join('/')})`} value={data.filter((d) => profile.freeRefundDef.refundStatus.includes(d.status)).length} suffix="笔" /></Col>
        <Col span={6}><Statistic title={`取消(status=${profile.freeRefundDef.cancelStatus.join('/')})`} value={data.filter((d) => profile.freeRefundDef.cancelStatus.includes(d.status)).length} suffix="笔" /></Col>
        <Col span={6}><Statistic title="归集金额" value={cur.full(total)} /></Col>
        <Col span={6}><Statistic title="R1/R2 风险单" value={data.filter((d) => d.root !== 'NORMAL').length} suffix="笔" valueStyle={{ color: '#d97706' }} /></Col>
      </Row>
      <Table
        size="small" rowKey="id" pagination={false} dataSource={data}
        columns={[
          { title: '订单号', dataIndex: 'orderNo', render: (v) => <Text code style={{ fontSize: 12 }}>{v}</Text> },
          { title: '门店', dataIndex: 'storeNo', width: 80 },
          {
            title: '类型', dataIndex: 'statusLabel', width: 70,
            render: (v, r) => (
              <Tag color={profile.freeRefundDef.refundStatus.includes(r.status) ? 'magenta' : 'gold'}>{v}</Tag>
            ),
          },
          { title: '金额', dataIndex: 'amount', align: 'right', render: (v) => <span className="stat-number">{cur.full(v)}</span> },
          { title: '时间', dataIndex: 'time', width: 130 },
          {
            title: '分类', dataIndex: 'rootLabel', width: 220,
            render: (v, r) => (
              <Tag color={r.root === 'R1' ? 'blue' : r.root === 'R2' ? 'volcano' : 'green'}>{v}</Tag>
            ),
          },
        ]}
      />
    </Card>
  )
}
