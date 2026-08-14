import { Card, Table, Tag, Alert, Typography } from 'antd'
import type { CoverageCell } from '../../data/mockData'
import type { CountryProfile } from '../../profiles'

const { Text } = Typography

interface Props {
  data: CoverageCell[];
  profile: CountryProfile;
}

export default function CoverageMatrix({ data, profile }: Props) {
  const uncovered = data.filter((d) => !d.cover)
  const [dimA, dimB] = profile.coverageDef.dims
  return (
    <Card title={profile.coverageDef.title} style={{ marginBottom: 16 }}>
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
          { title: dimA, dataIndex: 'source', width: 110, render: (v) => <Text code>{v}</Text> },
          { title: dimB, dataIndex: 'payType', width: 100, render: (v) => <Text code>{v}</Text> },
          { title: '笔数', dataIndex: 'cnt', align: 'right', render: (v) => <span className="stat-number">{v.toLocaleString()}</span> },
          { title: `金额 (${profile.currency.code})`, dataIndex: 'amt', align: 'right', render: (v) => <span className="stat-number">{profile.currency.short(v)}</span> },
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
