import { Card, Table, Tabs, Progress } from 'antd'
import { fmtVND } from '../../data/mockData'
import type { DimRow } from '../../data/mockData'

function DimTable({ rows, title }: { rows: DimRow[]; title: string }) {
  const max = Math.max(...rows.map((r) => r.cnt))
  return (
    <Table
      size="small"
      rowKey="key"
      pagination={false}
      dataSource={rows}
      title={() => <span style={{ fontWeight: 600 }}>{title}</span>}
      columns={[
        { title: '维度值', dataIndex: 'label', render: (v) => <span>{v}</span> },
        {
          title: '笔数', dataIndex: 'cnt', align: 'right',
          render: (v) => <span className="stat-number">{v.toLocaleString()}</span>,
        },
        {
          title: '笔数占比',
          key: 'pct',
          render: (_, r) => (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 140 }}>
              <Progress
                percent={Number(((r.cnt / max) * 100).toFixed(1))}
                size="small" showInfo={false} strokeColor="#1d4ed8"
                style={{ width: 80, margin: 0 }}
              />
              <span className="stat-number" style={{ fontSize: 12 }}>{r.pct.toFixed(2)}%</span>
            </div>
          ),
        },
        {
          title: '金额 (VND)', dataIndex: 'amt', align: 'right',
          render: (v) => <span className="stat-number">{fmtVND(v)}</span>,
        },
      ]}
    />
  )
}

export default function OmsOverview({ data }: {
  data: { byBusiness: DimRow[]; bySource: DimRow[]; byPayType: DimRow[]; byStatus: DimRow[] }
}) {
  return (
    <Card title="OMS 四维总览" style={{ marginBottom: 16 }}>
      <Tabs
        items={[
          { key: 'bt', label: 'business_type 业务类型', children: <DimTable rows={data.byBusiness} title="按业务类型" /> },
          { key: 'os', label: 'order_source 订单来源', children: <DimTable rows={data.bySource} title="按订单来源" /> },
          { key: 'pt', label: 'pay_type 支付方式', children: <DimTable rows={data.byPayType} title="按支付方式" /> },
          { key: 'st', label: 'order_status 订单状态', children: <DimTable rows={data.byStatus} title="按订单状态" /> },
        ]}
      />
    </Card>
  )
}
