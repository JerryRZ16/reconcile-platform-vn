import { useMemo, useState } from 'react'
import { Card, Table, Tag, Select, Input, Space, Button, Popover, Typography } from 'antd'
import type { Discrepancy, DiffStatus } from '../../data/mockData'
import type { CountryProfile } from '../../profiles'

const { Text } = Typography

const ROOT_COLORS: Record<string, string> = {
  R1: 'blue', R2: 'volcano', R3: 'purple', R4: 'cyan', R5: 'geekblue', R6: 'magenta',
  CASH: 'red', L2: 'orange',
}
const STATUS_COLOR: Record<DiffStatus, string> = { pending: 'orange', processed: 'green', ignored: 'default' }
const STATUS_LABEL: Record<DiffStatus, string> = { pending: '待处理', processed: '已处理', ignored: '可忽略' }
const CHANNEL_COLOR: Record<string, string> = { ONLINE: 'blue', INSTORE: 'purple', CASH: 'red', L2: 'orange', REFUND: 'green' }

interface Props {
  data: Discrepancy[];
  profile: CountryProfile;
}

export default function DiscrepancyTable({ data, profile }: Props) {
  const [channel, setChannel] = useState<string>()
  const [root, setRoot] = useState<string>()
  const [status, setStatus] = useState<string>()
  const [kw, setKw] = useState('')
  const cur = profile.currency

  const filtered = useMemo(
    () =>
      data.filter(
        (d) =>
          (!channel || d.channel === channel) &&
          (!root || d.root === root) &&
          (!status || d.status === status) &&
          (!kw ||
            (d.orderNo || '').includes(kw) ||
            (d.storeNo || '').includes(kw) ||
            d.description.includes(kw)),
      ),
    [data, channel, root, status, kw],
  )

  // 通道/根因选项从数据动态提取（不再写死 5 个枚举）
  const channelOptions = [...new Set(data.map((d) => d.channel).filter(Boolean))]
    .map((c) => ({ value: c, label: c }))
  const rootOptions = [...new Set(data.map((d) => d.root))].map((r) => ({
    value: r,
    label: `${r} · ${data.find((d) => d.root === r)!.rootLabel}`,
  }))

  return (
    <Card
      title={
        <span>
          差异与未匹配清单{' '}
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
            （共 {data.length} 条 · 已筛选 {filtered.length} 条）
          </Text>
        </span>
      }
      style={{ marginBottom: 16 }}
      extra={
        <Space wrap>
          <Select
            allowClear placeholder="通道" style={{ width: 110 }} size="small"
            value={channel} onChange={setChannel} options={channelOptions}
          />
          <Select
            allowClear placeholder="根因" style={{ width: 180 }} size="small"
            value={root} onChange={setRoot} options={rootOptions}
          />
          <Select
            allowClear placeholder="状态" style={{ width: 100 }} size="small"
            value={status} onChange={setStatus}
            options={Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l }))}
          />
          <Input.Search
            placeholder="订单号 / 门店 / 描述" allowClear size="small" style={{ width: 220 }}
            value={kw} onChange={(e) => setKw(e.target.value)}
          />
        </Space>
      }
    >
      <Table
        size="small"
        rowKey="id"
        dataSource={filtered}
        pagination={{ pageSize: 6, showSizeChanger: false }}
        columns={[
          {
            title: 'ID', dataIndex: 'id', width: 70,
            render: (v) => <Text code style={{ fontSize: 12 }}>{v}</Text>,
          },
          {
            title: '通道', dataIndex: 'channel', width: 90,
            render: (v) => <Tag color={CHANNEL_COLOR[v as string] || 'default'}>{v}</Tag>,
          },
          {
            title: '根因', dataIndex: 'root', width: 70,
            render: (v) => <Tag color={ROOT_COLORS[v as string] || 'default'}>{v}</Tag>,
          },
          { title: '根因说明', dataIndex: 'rootLabel', width: 170, ellipsis: true },
          { title: '门店', dataIndex: 'storeNo', width: 70, render: (v) => v || '—' },
          {
            title: '金额', dataIndex: 'amount', align: 'right', width: 130,
            render: (v, r) => (
              <div>
                <div className="stat-number">{cur.full(v)}</div>
                {r.diffAmt ? (
                  <Text type="danger" style={{ fontSize: 11 }}>
                    差异 {cur.full(r.diffAmt)}
                  </Text>
                ) : null}
              </div>
            ),
          },
          {
            title: '状态', dataIndex: 'status', width: 90,
            render: (v) => <Tag color={STATUS_COLOR[v as DiffStatus]}>{STATUS_LABEL[v as DiffStatus]}</Tag>,
          },
          {
            title: '操作', width: 100,
            render: (_, d) => (
              <Space size={0}>
                <Popover
                  content={
                    <div style={{ maxWidth: 260 }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {(['pending', 'processed', 'ignored'] as DiffStatus[]).map((st) => (
                          <Button key={st} size="small" onClick={() => alert('演示环境：状态更新已记录')}>
                            {STATUS_LABEL[st]}
                          </Button>
                        ))}
                      </div>
                    </div>
                  }
                  title="更新处理状态"
                  trigger="click"
                >
                  <Button size="small" type="link">标记</Button>
                </Popover>
                <Popover
                  content={
                    <div style={{ maxWidth: 420 }}>
                      <Text strong>{d.description}</Text>
                      <div style={{ marginTop: 8 }}>
                        <Text type="secondary">OMS 侧：</Text> <Text code>{d.omsSide}</Text>
                      </div>
                      <div style={{ marginTop: 4 }}>
                        <Text type="secondary">账单侧：</Text> <Text code>{d.billSide}</Text>
                      </div>
                      <div style={{ marginTop: 8, background: '#fef3c7', color: '#92400e', padding: '6px 10px', borderRadius: 6, fontSize: 12 }}>
                        建议：{d.suggestion}
                      </div>
                    </div>
                  }
                  title={`差异详情 · ${d.id}`}
                  trigger="click"
                >
                  <Button size="small" type="link">详情</Button>
                </Popover>
              </Space>
            ),
          },
        ]}
      />
    </Card>
  )
}
