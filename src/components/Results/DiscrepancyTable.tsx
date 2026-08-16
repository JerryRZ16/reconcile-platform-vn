import { useMemo, useState } from 'react'
import { Card, Table, Tag, Select, Input, Space, Button, Popover, Typography } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
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
  const [caseCount, setCaseCount] = useState(5)  // 案例卡展示条数
  const cur = profile.currency

  const filtered = useMemo(() => {
    const arr = data.filter(
      (d) =>
        (!channel || d.channel === channel) &&
        (!root || d.root === root) &&
        (!status || d.status === status) &&
        (!kw ||
          (d.orderNo || '').includes(kw) ||
          (d.storeNo || '').includes(kw) ||
          d.description.includes(kw)),
    )
    // 按差异金额降序（无 diffAmt 则按金额），让最大问题排最前
    return [...arr].sort((a, b) => (b.diffAmt ?? b.amount) - (a.diffAmt ?? a.amount))
  }, [data, channel, root, status, kw])

  // 根因聚合：按 root 汇总条数 + 金额（解决「为什么没对平」）
  const byRoot = useMemo(() => {
    const m = new Map<string, { count: number; amount: number; label: string }>()
    for (const d of data) {
      const cur = m.get(d.root) || { count: 0, amount: 0, label: d.rootLabel || d.root }
      cur.count += 1
      cur.amount += d.diffAmt ?? d.amount ?? 0
      m.set(d.root, cur)
    }
    return [...m.entries()]
      .map(([root, v]) => ({ root, ...v }))
      .sort((a, b) => b.amount - a.amount)
  }, [data])

  // 导出 CSV（导出筛选后的全量，不受分页限制）
  const exportCsv = () => {
    const headers = ['ID', '通道', '根因', '根因说明', '订单号', '门店', '金额', '差异', '时间', 'OMS侧', '账单侧', '建议']
    const rows = filtered.map((d) => [
      d.id, d.channel, d.root, (d.rootLabel || '').replace(/,/g, '，'),
      d.orderNo || '', d.storeNo || '', d.amount ?? 0, d.diffAmt ?? 0,
      d.time || '', (d.omsSide || '').replace(/,/g, '，'), (d.billSide || '').replace(/,/g, '，'),
      (d.suggestion || '').replace(/,/g, '，'),
    ])
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `差异清单_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  // 通道/根因选项从数据动态提取（不再写死 5 个枚举）
  const channelOptions = [...new Set(data.map((d) => d.channel).filter(Boolean))]
    .map((c) => ({ value: c, label: c }))
  const rootOptions = [...new Set(data.map((d) => d.root))].map((r) => ({
    value: r,
    label: `${r} · ${data.find((d) => d.root === r)!.rootLabel}`,
  }))

  // 当前选中根因的代表性案例（按金额降序取前 N 条，便于「一看就懂这类问题长什么样」）
  const rootCases = useMemo(() => {
    if (!root) return []
    const rootLabel = data.find((d) => d.root === root)?.rootLabel || root
    return data
      .filter((d) => d.root === root)
      .sort((a, b) => (b.diffAmt ?? b.amount) - (a.diffAmt ?? a.amount))
      .slice(0, caseCount)
      .map((d, i) => ({ idx: i + 1, ...d, rootLabel }))
  }, [data, root, caseCount])

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
          <Button size="small" icon={<DownloadOutlined />} onClick={exportCsv}>
            导出CSV({filtered.length})
          </Button>
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
      {/* 根因聚合：一眼看清「为什么没对平」 */}
      {byRoot.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {byRoot.map((r) => (
            <div
              key={r.root}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                border: '1px solid #e5e7eb', borderRadius: 8, padding: '4px 10px',
                background: '#f9fafb', cursor: 'pointer',
                outline: root === r.root ? '2px solid #1d4ed8' : 'none',
              }}
              onClick={() => setRoot(root === r.root ? undefined : r.root)}
              title="点击筛选该根因并查看典型案例"
            >
              <Tag color={ROOT_COLORS[r.root] || 'default'} style={{ margin: 0 }}>{r.root}</Tag>
              <span style={{ fontSize: 12 }}>{r.label.split('·')[0]}</span>
              <Text strong style={{ fontSize: 12 }}>{r.count}笔</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>{cur.short(r.amount)}</Text>
            </div>
          ))}
        </div>
      )}

      {/* 典型案例卡：选中根因后展示该根因下的具体案例（订单号/门店/金额） */}
      {root && (
        <div style={{ marginBottom: 12, border: '1px solid #dbeafe', borderRadius: 10, padding: '10px 12px', background: '#f0f7ff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Space>
              <Tag color={ROOT_COLORS[root] || 'default'} style={{ margin: 0 }}>{root}</Tag>
              <Text strong style={{ fontSize: 13 }}>{rootCases[0]?.rootLabel || root}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                典型案例（{byRoot.find((b) => b.root === root)?.count || 0} 笔中取金额最大 {rootCases.length} 笔）
              </Text>
            </Space>
            <Space>
              {[3, 5, 10].map((n) => (
                <Button
                  key={n} size="small" type={caseCount === n ? 'primary' : 'text'}
                  style={{ fontSize: 11, padding: '0 6px', height: 20 }}
                  onClick={() => setCaseCount(n)}
                >
                  {n}条
                </Button>
              ))}
            </Space>
          </div>
          {rootCases.length === 0 ? (
            <Text type="secondary" style={{ fontSize: 12 }}>该根因暂无明细案例</Text>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {rootCases.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
                    padding: '6px 10px', fontSize: 12,
                  }}
                >
                  <Text type="secondary" style={{ width: 22 }}>#{c.idx}</Text>
                  <Text code style={{ fontSize: 12, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.orderNo || '—'}
                  </Text>
                  <Tag color={CHANNEL_COLOR[c.channel] || 'default'} style={{ margin: 0 }}>{c.channel}</Tag>
                  <span style={{ color: '#6b7280', width: 70 }}>{c.storeNo || '—'}</span>
                  <Text strong style={{ fontSize: 12, width: 130, textAlign: 'right' }}>{cur.full(c.amount)}</Text>
                  {c.diffAmt ? (
                    <Text type="danger" style={{ fontSize: 11, width: 130, textAlign: 'right' }}>
                      差 {cur.full(c.diffAmt)}
                    </Text>
                  ) : null}
                  {c.time ? <Text type="secondary" style={{ fontSize: 11, width: 100 }}>{c.time}</Text> : null}
                  <Popover
                    content={
                      <div style={{ maxWidth: 360, fontSize: 12 }}>
                        <div style={{ marginBottom: 6 }}><Text strong>OMS 侧：</Text><Text code>{c.omsSide || '—'}</Text></div>
                        <div style={{ marginBottom: 6 }}><Text strong>账单侧：</Text><Text code>{c.billSide || '—'}</Text></div>
                        <div style={{ background: '#fef3c7', color: '#92400e', padding: '6px 10px', borderRadius: 6 }}>
                          建议：{c.suggestion || '—'}
                        </div>
                      </div>
                    }
                    title={`案例详情 · ${c.id}`}
                    trigger="click"
                  >
                    <Button size="small" type="link" style={{ fontSize: 11, padding: 0, height: 20 }}>详情</Button>
                  </Popover>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Table
        size="small"
        rowKey="id"
        dataSource={filtered}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
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
          { title: '根因说明', dataIndex: 'rootLabel', width: 180, ellipsis: true },
          { title: '订单号', dataIndex: 'orderNo', width: 170, ellipsis: true, render: (v) => v || '—' },
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
