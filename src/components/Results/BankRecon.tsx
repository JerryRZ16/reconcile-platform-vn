import { Card, Row, Col, Statistic, Descriptions, Table, Alert, Tag } from 'antd'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { fmtVND, fmtVNDFull } from '../../data/mockData'
import type { BankDailyRow, BankReconSummary } from '../../data/mockData'

export default function BankRecon({ daily, summary }: { daily: BankDailyRow[]; summary: BankReconSummary }) {
  const chartData = daily.map((d) => ({
    day: d.date,
    'PAYOO 结算': Math.round(d.payooSettle / 1e6),
    'TCB 入账': Math.round(d.tcbCredit / 1e6),
    diff: Math.round(d.diff / 1e6),
  }))

  return (
    <Card title="L2 银行对账（PAYOO ↔ TCB · 按日对平）" style={{ marginBottom: 16 }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <Card size="small" style={{ flex: 1, minWidth: 160 }}>
              <Statistic title="PAYOO 净额" value={fmtVNDFull(summary.payooNet)} valueStyle={{ fontSize: 16 }} />
            </Card>
            <Card size="small" style={{ flex: 1, minWidth: 160 }}>
              <Statistic title="银行 PAYOO 入账" value={fmtVNDFull(summary.bankIn)} valueStyle={{ fontSize: 16 }} />
            </Card>
            <Card size="small" style={{ flex: 1, minWidth: 160 }}>
              <Statistic
                title="T+N 跨月到账（上月尾单）"
                value={fmtVNDFull(summary.prevCross)}
                valueStyle={{ fontSize: 16 }}
              />
            </Card>
            <Card size="small" style={{ flex: 1, minWidth: 160 }}>
              <Statistic
                title="归属本月"
                value={fmtVNDFull(summary.monthAttributed)}
                valueStyle={{ fontSize: 16 }}
              />
            </Card>
            <Card size="small" style={{ flex: 1, minWidth: 160 }}>
              <Statistic
                title="月末未到账"
                value={fmtVNDFull(summary.endUnsettled)}
                valueStyle={{ fontSize: 16, color: '#d97706' }}
              />
            </Card>
          </div>
          <Descriptions
            size="small" column={1} style={{ marginTop: 12 }}
            items={[
              { key: 's', label: '对账状态', children: <Tag color="green">✅ 已对平（跨月效应可解）</Tag> },
              { key: 'a', label: '识别规则', children: 'Payoo 关键词 · CT DS→ONLINE / TT TD±QRCODE→QR/Card' },
              { key: 'b', label: '勾稽关系', children: 'PAYOO净 = 银行归属本月 + 月末未到账' },
            ]}
          />
          <Alert
            type="info" showIcon style={{ marginTop: 12 }}
            message="7 月末未到账 4.19 亿 ≈ 6 月末未到账 4.31 亿（差 1,225 万，含手续费口径），建议补 8 月初流水闭环。"
          />
        </Col>
        <Col xs={24} lg={16}>
          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} interval={2} />
                <YAxis tick={{ fontSize: 11 }} unit="M" width={55} />
                <Tooltip formatter={(v) => `${v} 百万 VND`} />
                <Legend />
                <Bar dataKey="PAYOO 结算" fill="#1d4ed8" radius={[3, 3, 0, 0]} barSize={12} />
                <Bar dataKey="TCB 入账" fill="#7c3aed" radius={[3, 3, 0, 0]} barSize={12} />
                <Line type="monotone" dataKey="diff" stroke="#d97706" strokeWidth={2} dot={false} name="当日差异(M)" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <Table
            size="small" pagination={false} scroll={{ x: 520 }}
            style={{ marginTop: 8 }}
            dataSource={daily.filter((d) => d.diff !== 0).slice(0, 8)}
            rowKey="day"
            columns={[
              { title: '日期', dataIndex: 'date', width: 80 },
              {
                title: 'PAYOO 结算', dataIndex: 'payooSettle', align: 'right',
                render: (v) => <span className="stat-number">{fmtVND(v)}</span>,
              },
              {
                title: 'TCB 入账', dataIndex: 'tcbCredit', align: 'right',
                render: (v) => <span className="stat-number">{fmtVND(v)}</span>,
              },
              {
                title: '差异', dataIndex: 'diff', align: 'right',
                render: (v) => (
                  <span className="stat-number" style={{ color: v === 0 ? '#059669' : '#d97706' }}>
                    {v === 0 ? '0' : (v > 0 ? '+' : '') + fmtVND(v)}
                  </span>
                ),
              },
            ]}
          />
        </Col>
      </Row>
    </Card>
  )
}
