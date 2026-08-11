import { useMemo, useState } from 'react'
import { Card, Row, Col, Upload, Typography, Alert, Tag, List, Button } from 'antd'
import {
  FileExcelOutlined, FileTextOutlined, CheckCircleOutlined,
  UploadOutlined, DeleteOutlined, InfoCircleOutlined,
} from '@ant-design/icons'
import type { UploadFile } from 'antd'

const { Title, Text } = Typography

export interface SlotFile {
  name: string;
  size: number;
}

interface Props {
  files: Record<string, SlotFile | null>;
  setFiles: React.Dispatch<React.SetStateAction<Record<string, SlotFile | null>>>;
}

const SLOTS = [
  {
    key: 'oms', title: 'OMS 订单', desc: '订单主表导出 · CSV / XLSX',
    required: true, icon: <FileExcelOutlined />, color: '#1d4ed8', fields: 'order_no · pay_amt · order_source · pay_type · order_status',
  },
  {
    key: 'online', title: 'PAYOO ONLINE 账单', desc: '线上支付通道账单 · CSV',
    required: true, icon: <FileTextOutlined />, color: '#0891b2', fields: 'order_no(Merchant order number) · amount · paid_time',
  },
  {
    key: 'instore', title: 'PAYOO INSTORE 账单', desc: '门店收单通道账单 · CSV',
    required: true, icon: <FileTextOutlined />, color: '#7c3aed', fields: 'store_no · amount · paid_time',
  },
  {
    key: 'tcb', title: 'TCB 银行流水', desc: 'Techcombank 银行对账单 · CSV/XLSX',
    required: true, icon: <FileExcelOutlined />, color: '#059669', fields: 'tran_date · amount · description · settle_type',
  },
]

export default function StepUpload({ files, setFiles }: Props) {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [uploadList, setUploadList] = useState<Record<string, UploadFile[]>>({})

  const filledCount = useMemo(
    () => Object.values(files).filter(Boolean).length,
    [files],
  )

  const validate = (key: string, name: string) => {
    const lower = name.toLowerCase()
    if (!/\.(csv|xlsx?)$/.test(lower)) {
      setErrors((p) => ({ ...p, [key]: '仅支持 CSV / Excel 文件' }))
      return false
    }
    const slot = SLOTS.find((s) => s.key === key)!
    const mustContain: Record<string, string[]> = {
      oms: ['order', 'oms'],
      online: ['online', 'payoo'],
      instore: ['instore', 'payoo'],
      tcb: ['tcb', 'bank', 'techcombank', 'statement'],
    }
    const hints = mustContain[key]
    const ok = hints.some((h) => lower.includes(h))
    if (!ok) {
      setErrors((p) => ({
        ...p,
        [key]: `文件名似乎与「${slot.title}」不匹配（提示：需包含 ${hints.join(' / ')}）`,
      }))
      return false
    }
    setErrors((p) => { const n = { ...p }; delete n[key]; return n })
    return true
  }

  const handleFile = (key: string, file: File) => {
    if (validate(key, file.name)) {
      setFiles((p) => ({ ...p, [key]: { name: file.name, size: file.size } }))
    }
    return false // 阻止 antd 默认上传
  }

  return (
    <div className="fade-up">
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <InfoCircleOutlined style={{ color: '#1d4ed8', fontSize: 18, marginTop: 2 }} />
          <div>
            <Title level={5} style={{ marginBottom: 4 }}>步骤 1 · 导入对账文件</Title>
            <Text type="secondary">
              拖拽或点击上传 4 类文件（CSV / XLSX，≤50MB，UTF-8）。平台即时校验格式与文件名归属，
              校验通过后进入字段映射。演示模式已内置「越南 2026-07」真实数据，可直接继续。
            </Text>
          </div>
        </div>
      </Card>

      <Row gutter={[16, 16]}>
        {SLOTS.map((slot) => (
          <Col xs={24} md={12} key={slot.key}>
            <Card
              size="small"
              title={
                <span>
                  <span style={{ color: slot.color, marginRight: 8 }}>{slot.icon}</span>
                  {slot.title}
                  {slot.required && <Tag color="red" style={{ marginLeft: 8 }}>必填</Tag>}
                </span>
              }
              extra={files[slot.key] ? <CheckCircleOutlined style={{ color: '#059669' }} /> : undefined}
              style={{ height: '100%' }}
            >
              <Upload.Dragger
                accept=".csv,.xlsx,.xls"
                multiple={false}
                showUploadList={false}
                beforeUpload={(file) => handleFile(slot.key, file)}
                fileList={uploadList[slot.key] || []}
                onChange={({ fileList }) =>
                  setUploadList((p) => ({ ...p, [slot.key]: fileList }))
                }
              >
                {files[slot.key] ? (
                  <div style={{ padding: '8px 0' }}>
                    <CheckCircleOutlined style={{ fontSize: 28, color: '#059669' }} />
                    <div style={{ marginTop: 8, fontWeight: 600 }}>{files[slot.key]!.name}</div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {(files[slot.key]!.size / 1024).toFixed(0)} KB · 已通过校验
                    </Text>
                    <div style={{ marginTop: 8 }}>
                      <Button
                        size="small" danger icon={<DeleteOutlined />}
                        onClick={(e) => {
                          e.stopPropagation()
                          setFiles((p) => ({ ...p, [slot.key]: null }))
                          setUploadList((p) => ({ ...p, [slot.key]: [] }))
                        }}
                      >
                        替换
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '12px 0' }}>
                    <UploadOutlined style={{ fontSize: 26, color: '#9ca3af' }} />
                    <div style={{ marginTop: 8 }}>
                      点击或拖拽文件到此处
                    </div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {slot.fields}
                    </Text>
                  </div>
                )}
              </Upload.Dragger>
              {errors[slot.key] && (
                <Alert
                  type="error" showIcon message={errors[slot.key]} style={{ marginTop: 8 }}
                  action={<Button size="small" onClick={() => setErrors((p) => { const n = { ...p }; delete n[slot.key]; return n })}>知道了</Button>}
                />
              )}
            </Card>
          </Col>
        ))}
      </Row>

      <Card style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Text strong>上传进度：</Text>
            <Text type="secondary">{filledCount} / 4 个文件已就绪</Text>
            <div style={{ marginTop: 4 }}>
              {Object.entries(files).map(([k, f]) => (
                <Tag key={k} color={f ? 'green' : 'default'} style={{ marginTop: 4 }}>
                  {SLOTS.find((s) => s.key === k)!.title}: {f ? f.name : '未上传'}
                </Tag>
              ))}
            </div>
          </div>
          {filledCount === 4 && (
            <List size="small" style={{ maxWidth: 420 }}>
              <List.Item style={{ padding: 4 }}>✅ 全部文件就绪，可进入字段映射</List.Item>
            </List>
          )}
        </div>
      </Card>
    </div>
  )
}
