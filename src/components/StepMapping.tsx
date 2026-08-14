import React, { useState, useMemo, useEffect } from 'react'
import {
  Card, Table, Select, Tabs, Alert, Typography, Tag, Badge, Button, Space, Tooltip, Popover, message,
} from 'antd'
import {
  CheckCircleOutlined, WarningOutlined, ExperimentOutlined, FunctionOutlined,
  ShopOutlined, LinkOutlined, EyeOutlined, SaveOutlined, DeleteOutlined,
} from '@ant-design/icons'
import type { CountryProfile, MappingTemplate, MappingRow } from '../profiles'
import type { ParsedSheet } from '../lib/parseFiles'
import {
  type MappingType,
  isRowConfigured, previewRow,
} from '../lib/mappingLogic'
import ExpressionEditor from './mapping/ExpressionEditor'
import StoreCodeEditor from './mapping/StoreCodeEditor'
import TripletEditor from './mapping/TripletEditor'

const { Text } = Typography

const TYPE_META: Record<MappingType, { label: string; icon: React.ReactNode; color: string }> = {
  direct: { label: '直接映射', icon: <LinkOutlined />, color: 'blue' },
  expression: { label: '表达式转译', icon: <FunctionOutlined />, color: 'purple' },
  storecode: { label: '门店编码映射', icon: <ShopOutlined />, color: 'geekblue' },
  triplet: { label: '三元组', icon: <ExperimentOutlined />, color: 'magenta' },
}

interface Props {
  profile: CountryProfile;
  /** 表头解析结果（槽位 key → 真实表头/样例），来自上传步骤 */
  parsedFiles?: Record<string, ParsedSheet | null>;
  /** 映射状态变化回调（阶段3：提升到 App，供 runReconciliation 序列化提交后端） */
  onMappingChange?: (mappings: MappingTemplate[]) => void;
}

/** 根据槽位 key 找对应映射模板（映射模板文件标题与槽位标题匹配） */
function slotKeyOf(fileTitle: string, profile: CountryProfile): string | undefined {
  return profile.slots.find((s) => s.title === fileTitle)?.key
}

/** 取一行映射的配置对象（按类型） */
function rowCfg(row: MappingRow): unknown {
  switch (row.type) {
    case 'expression': return row.expr
    case 'storecode': return row.storeCode
    case 'triplet': return row.triplet
    default: return row.source
  }
}

export default function StepMapping({ profile, parsedFiles = {}, onMappingChange }: Props) {
  // 映射状态变化 → 通知 App（用于提交后端前的序列化）
  const [lastNotified, setLastNotified] = useState<MappingTemplate[] | null>(null)
  const templates = profile.mappingTemplates
  const [mappings, setMappings] = useState<MappingTemplate[]>(() => templates)
  const [activeTab, setActiveTab] = useState('0')
  const [advanced, setAdvanced] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(templates.map((_, i) => [String(i), false])),
  )

  // 每次 profile 变化时同步模板（切换国家后重置）
  const [lastProfileId, setLastProfileId] = useState(profile.id)
  if (lastProfileId !== profile.id) {
    setLastProfileId(profile.id)
    setMappings(templates)
    setActiveTab('0')
    setAdvanced(Object.fromEntries(templates.map((_, i) => [String(i), false])))
  }

  // 阶段3：映射变化（含初始化/切换国家重置）→ 通知 App
  const notifyRef = React.useRef(onMappingChange)
  notifyRef.current = onMappingChange
  useEffect(() => {
    if (!notifyRef.current) return
    if (lastNotified !== mappings) {
      notifyRef.current(mappings)
      setLastNotified(mappings)
    }
  }, [mappings, lastNotified])

  // 源列候选：优先用真实上传表头，否则回退模板预置 sourceOptions
  const sourceOptionsFor = (fi: number): string[] => {
    const tpl = mappings[fi]
    const key = slotKeyOf(tpl.file, profile)
    const parsed = key ? parsedFiles[key] : undefined
    if (parsed && parsed.columns.length) return parsed.columns
    return tpl.sourceOptions
  }

  const setRow = (fileIdx: number, rowIdx: number, patch: Partial<MappingRow>) => {
    setMappings((prev) =>
      prev.map((f, i) =>
        i === fileIdx
          ? {
              ...f,
              rows: f.rows.map((r, j) => (j === rowIdx ? { ...r, ...patch } : r)),
            }
          : f,
      ),
    )
  }

  // 动态计算必填完整性（四类映射各自判断是否已配置）
  const requiredOkList = useMemo(
    () =>
      mappings.map((f) =>
        f.rows
          .filter((r) => r.required)
          .every((r) => isRowConfigured(r.type || 'direct', rowCfg(r))),
      ),
    [mappings],
  )
  const missingFiles = mappings.filter((_, i) => !requiredOkList[i])

  // 每行实时预览（读真实上传样例前 3 行，否则占位提示）
  const previewFor = (fi: number, row: MappingRow) => {
    const tpl = mappings[fi]
    const key = slotKeyOf(tpl.file, profile)
    const parsed = key ? parsedFiles[key] : undefined
    const samples = parsed?.sampleRows || []
    if (!samples.length) return { samples: [], note: '上传文件后可预览' }
    const rows = samples.slice(0, 3).map((r) => previewRow(r, row.type || 'direct', rowCfg(row)))
    const allOk = rows.every((r) => r.ok)
    const note = allOk ? '前3行映射正常 ✓' : '存在未命中值'
    return { samples: rows, note, allOk }
  }

  const saveTemplate = () => {
    try {
      localStorage.setItem(`reconcile:mapping:${profile.id}`, JSON.stringify(mappings))
      message.success('映射模板已保存（localStorage）')
    } catch {
      message.warning('保存失败：localStorage 不可用')
    }
  }

  return (
    <div className="fade-up">
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <CheckCircleOutlined style={{ color: '#059669', fontSize: 18, marginTop: 2 }} />
          <div>
            <Typography.Title level={5} style={{ marginBottom: 4 }}>步骤 2 · 字段映射</Typography.Title>
            <Text type="secondary">
              平台已按「{profile.name}」预置映射模板自动推断源列 → 目标字段映射。
              支持四类映射：<Text strong style={{ color: '#1d4ed8' }}>直接 / 表达式转译 / 门店编码 / 三元组</Text>。
              源列候选来自上传文件真实表头（已解析）。必填字段（<Tag color="red">必填</Tag>）缺失时无法进入核对。
            </Text>
          </div>
        </div>
      </Card>

      {missingFiles.length > 0 ? (
        <Alert
          type="warning" showIcon
          message={`存在 ${missingFiles.length} 个文件的必填字段未映射完整，请先修复`}
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
                status={requiredOkList[fi] ? 'success' : 'error'}
                text={f.file}
              />
            ),
            children: (
              <>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                  <Button
                    size="small"
                    icon={advanced[String(fi)] ? <DeleteOutlined /> : <FunctionOutlined />}
                    onClick={() => setAdvanced((p) => ({ ...p, [String(fi)]: !p[String(fi)] }))}
                  >
                    {advanced[String(fi)] ? '收起进阶映射' : '展开进阶映射（表达式 / 门店编码 / 三元组）'}
                  </Button>
                </div>
                <Table
                  size="small"
                  rowKey={(r) => r.target}
                  dataSource={f.rows}
                  pagination={false}
                  columns={[
                    { title: '目标字段', dataIndex: 'target', width: 130, render: (v) => <Text code>{v}</Text> },
                    { title: '含义', dataIndex: 'label', width: 180, ellipsis: true },
                    ...(advanced[String(fi)]
                      ? [{
                          title: '映射类型',
                          key: 'type',
                          width: 140,
                          render: (_: unknown, r: MappingRow, idx: number) => (
                            <Select
                              size="small" style={{ width: 128 }}
                              value={r.type || 'direct'}
                              onChange={(t) => {
                                const patch: Partial<MappingRow> = { type: t as MappingType }
                                // 切换类型时初始化对应配置
                                if (t === 'expression' && !r.expr) patch.expr = { op: 'none', from: r.source || '' }
                                if (t === 'storecode' && !r.storeCode) patch.storeCode = { from: r.source || '', rule: 'raw' }
                                if (t === 'triplet' && !r.triplet) patch.triplet = { storeField: r.source || '', amountField: '', timeField: '', toleranceMin: 5 }
                                setRow(fi, idx, patch)
                              }}
                              options={Object.entries(TYPE_META).map(([k, m]) => ({ value: k, label: m.label }))}
                            />
                          ),
                        }]
                      : []),
                    {
                      title: '源列 / 表达式配置',
                      key: 'config',
                      render: (_, r, idx) => (
                        <RowConfig row={r} columns={sourceOptionsFor(fi)} setCfg={(patch) => setRow(fi, idx, patch)} />
                      ),
                    },
                    {
                      title: '预览示例值（前3行）',
                      key: 'preview',
                      width: 230,
                      render: (_, r) => {
                        const p = previewFor(fi, r)
                        if (!p.samples.length) {
                          return (
                            <Space size={4}>
                              <EyeOutlined style={{ fontSize: 11, color: '#9ca3af' }} />
                              <Text style={{ fontSize: 12 }} type="secondary">{p.note}</Text>
                            </Space>
                          )
                        }
                        return (
                          <Tooltip
                            title={
                              <div>
                                {p.samples.map((s, i) => (
                                  <div key={i} style={{ fontSize: 11 }}>
                                    <Text style={{ color: '#d1d5db' }}>{s.raw}</Text>
                                    <Text style={{ color: s.ok ? '#6ee7b7' : '#fca5a5' }}> → {s.result}</Text>
                                  </div>
                                ))}
                              </div>
                            }
                          >
                            <Space size={4}>
                              <EyeOutlined style={{ fontSize: 11, color: p.allOk ? '#059669' : '#d97706' }} />
                              <Text style={{ fontSize: 12 }} type={p.allOk ? undefined : 'warning'}>
                                {p.note}
                              </Text>
                            </Space>
                          </Tooltip>
                        )
                      },
                    },
                    {
                      title: '必填',
                      dataIndex: 'required',
                      width: 66,
                      render: (v) => (v ? <Tag color="red">必填</Tag> : <Tag>选填</Tag>),
                    },
                  ]}
                />
              </>
            ),
          }))}
        />
      </Card>

      <Card style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {mappings.map((f, fi) => {
              const key = slotKeyOf(f.file, profile)
              const hasReal = key ? Boolean(parsedFiles[key]?.columns.length) : false
              return (
                <div key={f.file}>
                  <Text strong style={{ fontSize: 12 }}>{f.file}</Text>
                  <Tag color={requiredOkList[fi] ? 'green' : 'red'} style={{ marginLeft: 8 }}>
                    {requiredOkList[fi] ? `${f.rows.length}/${f.rows.length} 字段就绪` : '缺必填'}
                  </Tag>
                  <Tag style={{ fontSize: 11 }}>
                    源列候选 {sourceOptionsFor(fi).length}（{hasReal ? '真实表头' : '预置模板'}）
                  </Tag>
                </div>
              )
            })}
          </div>
          <Space>
            <Button size="small" icon={<SaveOutlined />} onClick={saveTemplate}>保存模板</Button>
            <Button size="small" onClick={() => setMappings(templates)}>恢复默认</Button>
          </Space>
        </div>
        <Alert
          type="info" showIcon icon={<WarningOutlined />} style={{ marginTop: 12 }}
          message="预览说明：映射示例基于上传文件前 3 行真实样例实时计算；未上传文件时显示预置模板源列。"
        />
      </Card>
    </div>
  )
}

// ---------- 单行配置区（按类型渲染不同编辑器） ----------
function RowConfig({
  row, columns, setCfg,
}: {
  row: MappingRow;
  columns: string[];
  setCfg: (patch: Partial<MappingRow>) => void;
}) {
  const type = row.type || 'direct'

  switch (type) {
    case 'direct':
      return (
        <Select
          size="small" style={{ minWidth: 220 }}
          value={row.source || undefined}
          onChange={(val) => setCfg({ source: val })}
          options={columns.map((c) => ({ value: c, label: c }))}
          showSearch
          placeholder="选择源列"
        />
      )
    case 'expression':
      return (
        <Popover
          trigger="click" placement="right" title="表达式转译配置"
          content={
            <ExpressionEditor
              value={row.expr || { op: 'none', from: row.source || '' }}
              onChange={(expr) => setCfg({ expr })}
              columns={columns}
            />
          }
        >
          <Button
            size="small" icon={<FunctionOutlined />}
            style={{ color: row.expr?.op && row.expr.op !== 'none' ? '#7c3aed' : undefined }}
          >
            {row.expr?.op && row.expr.op !== 'none' ? `已配置 · ${row.expr.op}` : '配置表达式'}
          </Button>
        </Popover>
      )
    case 'storecode':
      return (
        <Popover
          trigger="click" placement="right" title="门店编码映射"
          content={
            <StoreCodeEditor
              value={row.storeCode || { from: row.source || '', rule: 'raw' }}
              onChange={(storeCode) => setCfg({ storeCode })}
              columns={columns}
            />
          }
        >
          <Button
            size="small" icon={<ShopOutlined />}
            style={{ color: row.storeCode?.from ? '#2563eb' : undefined }}
          >
            {row.storeCode?.from ? `门店归一化 · ${row.storeCode.rule}` : '配置门店编码'}
          </Button>
        </Popover>
      )
    case 'triplet':
      return (
        <Popover
          trigger="click" placement="right" title="三元组匹配参数"
          content={
            <TripletEditor
              value={row.triplet || { storeField: '', amountField: '', timeField: '', toleranceMin: 5 }}
              onChange={(triplet) => setCfg({ triplet })}
              columns={columns}
            />
          }
        >
          <Button
            size="small" icon={<ExperimentOutlined />}
            style={{ color: row.triplet?.storeField ? '#c026d3' : undefined }}
          >
            {row.triplet?.storeField ? `店+额+时 ±${row.triplet.toleranceMin}min` : '配置三元组'}
          </Button>
        </Popover>
      )
    default:
      return null
  }
}
