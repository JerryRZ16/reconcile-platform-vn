import { Card, Table, Tag, Alert } from 'antd'
import { fmtVND } from '../../data/mockData'
import type { CoverageCell } from '../../data/mockData'

export default function CoverageMatrix({ data }: { data: CoverageCell[] }) {
  const uncovered = data.filter((d) => !d.cover)
  return (
    <Card title="全覆盖检查（order_source × pay_type 组合归属）" style={{ marginBottom: 16 }}>
      <Alert
        type={uncovered.length ? 'error' : 'success'} showIcon style={{ marginBottom: 12 }}
        message={
          uncovered.length
            ? `存在 ${uncovered.length} 个组合无归属，请核查`
            : `全部 ${data.length} 个组合均找到通道归属，无漏网订单 ✅`
        }
      />
      <Table
        size="small" rowKey={(r) => `${r.source}-${r.payType}`} dataSource={data} pagination={false}
        columns={[
          { title: 'order_source', dataIndex: 'source', width: 110, render: (v) => <Text code>{v}</Text> },
          { title: 'pay_type', dataIndex: 'payType', width: 100, render: (v) => <Text code>{v}</Text> },
          { title: '笔数', dataIndex: 'cnt', align: 'right', render: (v) => <span className="stat-number">{v.toLocaleString()}</span> },
          { title: '金额 (VND)', dataIndex: 'amt', align: 'right', render: (v) => <span className="stat-number">{fmtVND(v)}</span> },
          {
            title: '归属通道', dataIndex: 'owner',
            render: (v, r) => <Tag color={r.cover ? 'blue' : 'red'}>{v}</Tag>,
          },
          { title: '备注', dataIndex: 'note', render: (v) => v || '—' },
        ]}
      />
    </Card>
  )
}

import { Typography } from 'antd'
const { Text } = Typography
