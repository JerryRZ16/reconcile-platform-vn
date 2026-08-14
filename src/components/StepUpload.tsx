import { useMemo, useState } from 'react'
import { Card, Row, Col, Upload, Typography, Alert, Tag, List, Button, Tooltip } from 'antd'
import {
  FileExcelOutlined, FileTextOutlined, CheckCircleOutlined,
  UploadOutlined, DeleteOutlined, InfoCircleOutlined, FileSearchOutlined,
} from '@ant-design/icons'
import type { UploadFile } from 'antd'
import type { CountryProfile, UploadSlot } from '../profiles'
import { parseFile, validateFile, type ParsedSheet } from '../lib/parseFiles'

const { Title, Text } = Typography

export interface SlotFile {
  name: string;
  size: number;
  /** 真实 File 引用（阶段3：上传到后端用）；未上传为 null */
  file?: File | null;
}

interface Props {
  files: Record<string, SlotFile | null>;
  setFiles: React.Dispatch<React.SetStateAction<Record<string, SlotFile | null>>>;
  profile: CountryProfile;
  /** 表头解析结果（槽位 key → ParsedSheet），提升到 App 供 StepMapping 消费 */
  parsedFiles: Record<string, ParsedSheet | null>;
  setParsedFiles: React.Dispatch<React.SetStateAction<Record<string, ParsedSheet | null>>>;
}

const ICONS: Record<UploadSlot['icon'], React.ReactNode> = {
  excel: <FileExcelOutlined />,
  text: <FileTextOutlined />,
}

export default function StepUpload({ files, setFiles, profile, parsedFiles, setParsedFiles }: Props) {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [uploadList, setUploadList] = useState<Record<string, UploadFile[]>>({})
  const [parsing, setParsing] = useState<Record<string, boolean>>({})
  const parsed = parsedFiles
  const slots = profile.slots
  const hints = profile.uploadHints

  const filledCount = useMemo(
    () => Object.values(files).filter(Boolean).length,
    [files],
  )

  const handleFile = async (key: string, file: File) => {
    const slot = slots.find((s) => s.key === key)
    const err = validateFile(file, slot ? (hints[key] || []) : undefined)
    if (err) {
      setErrors((p) => ({ ...p, [key]: err }))
      setParsedFiles((p) => ({ ...p, [key]: null }))
      return false
    }
    setErrors((p) => { const n = { ...p }; delete n[key]; return n })
    setFiles((p) => ({ ...p, [key]: { name: file.name, size: file.size, file } }))

    // 真实文件解析：表头 + 前 5 行样例（papaparse / xlsx 可选依赖，未安装则降级）
    setParsing((p) => ({ ...p, [key]: true }))
    try {
      const sheet = await parseFile(file)
      setParsedFiles((p) => ({ ...p, [key]: sheet }))
      if (sheet.error) {
        setErrors((p) => ({ ...p, [key]: sheet.error! }))
      } else {
        setErrors((p) => { const n = { ...p }; delete n[key]; return n })
      }
    } catch (e) {
      setParsedFiles((p) => ({ ...p, [key]: null }))
      setErrors((p) => ({ ...p, [key]: '文件解析失败：' + (e as Error).message }))
    } finally {
      setParsing((p) => ({ ...p, [key]: false }))
    }
    return false // 阻止 antd 默认上传
  }

  const clearSlot = (key: string) => {
    setFiles((p) => ({ ...p, [key]: null }))
    setUploadList((p) => ({ ...p, [key]: [] }))
    setParsedFiles((p) => ({ ...p, [key]: null }))
    setErrors((p) => { const n = { ...p }; delete n[key]; return n })
  }

  return (
    <div className="fade-up">
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <InfoCircleOutlined style={{ color: '#1d4ed8', fontSize: 18, marginTop: 2 }} />
          <div>
            <Title level={5} style={{ marginBottom: 4 }}>步骤 1 · 导入对账文件</Title>
            <Text type="secondary">
              {profile.ui.uploadIntro} {profile.ui.uploadDemo}
            </Text>
          </div>
        </div>
      </Card>

      <Row gutter={[16, 16]}>
        {slots.map((slot) => {
          const sheet = parsed[slot.key]
          const parsingNow = parsing[slot.key]
          return (
            <Col xs={24} md={12} key={slot.key}>
              <Card
                size="small"
                title={
                  <span>
                    <span style={{ color: slot.color, marginRight: 8 }}>{ICONS[slot.icon]}</span>
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
                        {parsingNow ? ' · 解析中…' : ''}
                      </Text>
                      <div style={{ marginTop: 8 }}>
                        <Button
                          size="small" danger icon={<DeleteOutlined />}
                          onClick={(e) => {
                            e.stopPropagation()
                            clearSlot(slot.key)
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

                {/* 表头解析预览：读真实文件首行列名 + 前 3 行样例 */}
                {sheet && !sheet.error && (
                  <div
                    style={{
                      marginTop: 10, background: '#f8fafc', border: '1px solid #e5e7eb',
                      borderRadius: 8, padding: '8px 10px', fontSize: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <FileSearchOutlined style={{ color: '#1d4ed8' }} />
                      <Text strong style={{ fontSize: 12 }}>表头解析（{sheet.columns.length} 列 · 前 {sheet.sampleRows.length} 行样例）</Text>
                      <Tag style={{ marginLeft: 'auto', fontSize: 11 }} color="blue">
                        {sheet.source === 'papaparse' ? 'papaparse' : sheet.source === 'xlsx' ? 'SheetJS' : sheet.source === 'builtin-csv' ? '内置 CSV' : '—'}
                      </Tag>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {sheet.columns.map((c) => (
                        <Tag key={c} style={{ fontSize: 11, marginInlineEnd: 0 }}>{c}</Tag>
                      ))}
                    </div>
                    {sheet.sampleRows.length > 0 && (
                      <div style={{ marginTop: 6, color: '#374151', lineHeight: 1.7 }}>
                        {sheet.sampleRows.slice(0, 3).map((r, i) => (
                          <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, borderTop: '1px dashed #e5e7eb', paddingTop: 4, marginTop: 4 }}>
                            {sheet.columns.slice(0, 6).map((c) => (
                              <span key={c}>
                                <Text type="secondary" style={{ fontSize: 11 }}>{c}=</Text>
                                <Text style={{ fontSize: 11 }}>{r[c] || '—'}</Text>
                              </span>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {errors[slot.key] && (
                  <Alert
                    type="error" showIcon message={errors[slot.key]} style={{ marginTop: 8 }}
                    action={<Button size="small" onClick={() => setErrors((p) => { const n = { ...p }; delete n[slot.key]; return n })}>知道了</Button>}
                  />
                )}
              </Card>
            </Col>
          )
        })}
      </Row>

      <Card style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Text strong>上传进度：</Text>
            <Text type="secondary">{filledCount} / {slots.length} 个文件已就绪</Text>
            <div style={{ marginTop: 4 }}>
              {Object.entries(files).map(([k, f]) => (
                <Tag key={k} color={f ? 'green' : 'default'} style={{ marginTop: 4 }}>
                  {slots.find((s) => s.key === k)!.title}: {f ? f.name : '未上传'}
                </Tag>
              ))}
            </div>
          </div>
          {filledCount === slots.length && (
            <List size="small" style={{ maxWidth: 460 }}>
              <List.Item style={{ padding: 4 }}>✅ 全部文件就绪，可进入字段映射（表头已解析，源列候选已更新）</List.Item>
            </List>
          )}
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: '#9ca3af' }}>
          <Tooltip title="papaparse（CSV）与 xlsx（SheetJS）为可选依赖；未安装时 CSV 走内置解析器，XLSX 提示安装后可预览表头。">
            解析引擎：papaparse / SheetJS（可选依赖，未安装自动降级）
          </Tooltip>
        </div>
      </Card>
    </div>
  )
}
