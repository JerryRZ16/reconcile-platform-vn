import { useState } from 'react'
import { Card, Table, Select, Tabs, Alert, Typography, Tag, Badge } from 'antd'
import { CheckCircleOutlined, WarningOutlined } from '@ant-design/icons'

const { Text } = Typography

interface MappingRow {
  target: string;
  label: string;
  source: string;
  required: boolean;
  hint?: string;
}

interface FileMapping {
  file: string;
  requiredOk: boolean;
  rows: MappingRow[];
}

const MAPPINGS: FileMapping[] = [
  {
    file: 'OMS 订单',
    requiredOk: true,
    rows: [
      { target: 'order_no', label: '订单号', source: 'order_no', required: true },
      { target: 'business_type', label: '业务类型', source: 'business_type', required: true },
      { target: 'order_source', label: '订单来源', source: 'order_source', required: true },
      { target: 'pay_type', label: '支付方式', source: 'pay_type', required: true },
      { target: 'order_status', label: '订单状态', source: 'order_status', required: true },
      { target: 'pay_amt', label: '支付金额', source: 'pay_amt', required: true },
      { target: 'total_amt', label: '订单总额', source: 'total_amt', required: false },
      { target: 'discount_amt', label: '优惠金额', source: 'discount_amt', required: false, hint: '免单验证用' },
      { target: 'store_no', label: '门店号', source: 'store_no', required: true, hint: 'INSTORE/现金用' },
      { target: 'pay_finished_time', label: '支付完成时间', source: 'pay_finished_time', required: false, hint: '三元组匹配用' },
    ],
  },
  {
    file: 'PAYOO ONLINE 账单',
    requiredOk: true,
    rows: [
      { target: 'order_no', label: '商户订单号', source: 'Merchant order number', required: true },
      { target: 'amount', label: '金额', source: 'Amount', required: true },
      { target: 'paid_time', label: '支付时间', source: 'Time', required: true },
      { target: 'action_type', label: '交易类型', source: 'Action', required: false },
    ],
  },
  {
    file: 'PAYOO INSTORE 账单',
    requiredOk: true,
    rows: [
      { target: 'store_no', label: '门店', source: 'Store', required: true },
      { target: 'amount', label: '金额', source: 'Amount', required: true },
      { target: 'paid_time', label: '时间', source: 'Time', required: true },
      { target: 'merchant_order_no', label: '商户订单号', source: 'Order No', required: false },
    ],
  },
  {
    file: 'TCB 银行流水',
    requiredOk: true,
    rows: [
      { target: 'tran_date', label: '交易日期', source: 'Date', required: true },
      { target: 'amount', label: '金额', source: 'Amount', required: true },
      { target: 'description', label: '摘要', source: 'Description', required: true, hint: 'Payoo 关键词识别' },
      { target: 'settle_type', label: '结算类型', source: 'Remarks', required: false, hint: 'CT DS / TT TD ± QRCODE' },
    ],
  },
]

const SOURCE_OPTIONS = (file: string) => {
  const cols: Record<string, string[]> = {
    'OMS 订单': ['order_no', 'business_type', 'order_source', 'pay_type', 'order_status', 'pay_amt', 'total_amt', 'discount_amt', 'store_no', 'pay_finished_time', 'refund_finished_time'],
    'PAYOO ONLINE 账单': ['Merchant order number', 'Amount', 'Time', 'Action'],
    'PAYOO INSTORE 账单': ['Store', 'Amount', 'Time', 'Order No'],
    'TCB 银行流水': ['Date', 'Amount', 'Description', 'Remarks'],
  }
  return cols[file] || []
}

export default function StepMapping() {
  const [mappings, setMappings] = useState(MAPPINGS)
  const [activeTab, setActiveTab] = useState('0')

  const setSource = (fileIdx: number, rowIdx: number, val: string) => {
    setMappings((prev) =>
      prev.map((f, i) =>
        i === fileIdx
          ? { ...f, rows: f.rows.map((r, j) => (j === rowIdx ? { ...r, source: val } : r)) }
          : f,
      ),
    )
  }

  const missing = mappings.filter((f) => !f.requiredOk)

  return (
    <div className="fade-up">
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <CheckCircleOutlined style={{ color: '#059669', fontSize: 18, marginTop: 2 }} />
          <div>
            <Typography.Title level={5} style={{ marginBottom: 4 }}>步骤 2 · 字段映射</Typography.Title>
            <Text type="secondary">
              平台已按词典自动推断源列 → 目标字段映射，命中率约 95%。请确认或下拉修正；
              必填字段（<Tag color="red">必填</Tag>）缺失时无法进入核对。
            </Text>
          </div>
        </div>
      </Card>

      {missing.length > 0 ? (
        <Alert
          type="warning" showIcon
          message={`存在 ${missing.length} 个文件的必填字段未映射完整，请先修复`}
          style={{ marginBottom: 16 }}
        />
      ) : (
        <Alert
          type="success" showIcon message="所有必填字段已映射，可进入规则核对"
          style={{ marginBottom: 16 }}
        />
      )}

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={mappings.map((f, fi) => ({
            key: String(fi),
            label: (
              <Badge
                status={f.requiredOk ? 'success' : 'error'}
                text={f.file}
              />
            ),
            children: (
              <Table
                size="small"
                rowKey={(r) => r.target}
                dataSource={f.rows}
                pagination={false}
                columns={[
                  { title: '目标字段', dataIndex: 'target', width: 200, render: (v) => <Text code>{v}</Text> },
                  { title: '含义', dataIndex: 'label', width: 150 },
                  {
                    title: '源列（下拉修改）',
                    dataIndex: 'source',
                    render: (v, _r, idx) => (
                      <Select
                        size="small"
                        style={{ minWidth: 240 }}
                        value={v}
                        onChange={(val) => setSource(fi, idx, val)}
                        options={SOURCE_OPTIONS(f.file).map((c) => ({ value: c, label: c }))}
                        showSearch
                      />
                    ),
                  },
                  {
                    title: '必填',
                    dataIndex: 'required',
                    width: 80,
                    render: (v) => (v ? <Tag color="red">必填</Tag> : <Tag>选填</Tag>),
                  },
                  {
                    title: '目标字段',
                    dataIndex: 'hint',
                    render: (v) => (v ? <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text> : '—'),
                  },

                ]}
              />
            ),
          }))}
        />
      </Card>

      <Card style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {['OMS 订单', 'PAYOO ONLINE 账单', 'PAYOO INSTORE 账单', 'TCB 银行流水'].map((f) => (
            <div key={f}>
              <Text strong style={{ fontSize: 12 }}>{f}</Text>
              <Tag color="green" style={{ marginLeft: 8 }}>
                {f === 'OMS 订单' ? '10/10' : f === 'TCB 银行流水' ? '4/4' : '4/4'} 字段
              </Tag>
            </div>
          ))}
        </div>
        <Alert
          type="info" showIcon icon={<WarningOutlined />} style={{ marginTop: 12 }}
          message="映射预览：OMS 前 5 行示例已加载，order_no 解析正常；未发现缺失必填字段。"
        />
      </Card>
    </div>
  )
}
