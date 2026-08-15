import { useEffect, useRef, useState } from 'react'
import {
  Layout, Steps, Button, App as AntApp, message, Tag,
} from 'antd'
import {
  UploadOutlined, PartitionOutlined, ThunderboltOutlined, BarChartOutlined,
  PlayCircleOutlined, ReloadOutlined, DatabaseOutlined,
  CloudServerOutlined, ExperimentOutlined, StopOutlined,
} from '@ant-design/icons'
import StepUpload from './components/StepUpload'
import StepMapping from './components/StepMapping'
import StepRunning from './components/StepRunning'
import StepResults from './components/StepResults'
import CountrySelector from './components/CountrySelector'
import { runReconciliation, type RunOutcome } from './data/mockData'
import { getProfile, defaultCountryId } from './profiles'
import type { CountryProfile, MappingTemplate } from './profiles'
import type { ReconResult } from './data/mockData'
import type { ParsedSheet } from './lib/parseFiles'
import type { SlotFile } from './components/StepUpload'
import type { TaskStatus } from './lib/reconcileClient'

const { Header, Content } = Layout

type Stage = 'upload' | 'mapping' | 'running' | 'result'
type DataMode = 'live' | 'demo'

// ---------- 会话状态（任务号 / 演示对账期） ----------
const TASK_STORAGE = 'reconcile:session'
interface SessionState {
  seq: number;         // 任务序号（每国家递增）
  lastCountry: string; // 上次选择国家
}
function loadSession(): SessionState {
  try {
    const raw = localStorage.getItem(TASK_STORAGE)
    if (raw) {
      const parsed = JSON.parse(raw) as SessionState
      if (typeof parsed.seq === 'number' && typeof parsed.lastCountry === 'string') return parsed
    }
  } catch { /* ignore */ }
  return { seq: 1, lastCountry: defaultCountryId }
}
function saveSession(s: SessionState) {
  try { localStorage.setItem(TASK_STORAGE, JSON.stringify(s)) } catch { /* ignore */ }
}
/** 任务号：{国家大写}-{对账期YYYYMM}-{3位序号}，序号按会话递增 */
function buildTaskId(profile: CountryProfile, seq: number): string {
  return `${profile.id.toUpperCase()}-${profile.period.replace('-', '')}-${String(seq).padStart(3, '0')}`
}

export default function App() {
  const [session] = useState<SessionState>(() => loadSession())
  const [countryId, setCountryId] = useState<string>(() => session.lastCountry || defaultCountryId)
  const [stage, setStage] = useState<Stage>('upload')
  const [current, setCurrent] = useState(0)
  const [taskSeq, setTaskSeq] = useState(session.seq)
  const [files, setFiles] = useState<Record<string, SlotFile[] | null>>({})
  const [parsedFiles, setParsedFiles] = useState<Record<string, ParsedSheet | null>>({})
  const [mappings, setMappings] = useState<MappingTemplate[] | null>(null)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<ReconResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null)
  const [mode, setMode] = useState<DataMode | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const profile = getProfile(countryId)
  const taskId = buildTaskId(profile, taskSeq)

  // 动态文档标题：按当前 profile 更新（多国部署时无需改代码）
  useEffect(() => {
    document.title = `对账平台 · ${profile.countryZh} ${profile.period}`
  }, [profile])

  // 切换国家：切换 profile + 清空流程（files/result/stage 回到上传）
  const handleCountryChange = (id: string) => {
    if (id === countryId) return
    abortRef.current?.abort()
    setCountryId(id)
    const nextSession = { seq: 1, lastCountry: id }
    saveSession(nextSession)
    setTaskSeq(1)
    setFiles({})
    setParsedFiles({})
    setMappings(null)
    setResult(null)
    setError(null)
    setTaskStatus(null)
    setMode(null)
    setStage('upload')
    setCurrent(0)
    message.info(`已切换到 ${getProfile(id).name}，请重新上传文件`)
  }

  const go = (to: number) => {
    if (to === 2) setStage('running')
    else if (to === 3) setStage('result')
    else setStage(['upload', 'mapping', 'running', 'result'][to] as Stage)
    setCurrent(to)
  }

  const handleRun = async () => {
    setError(null)
    setTaskStatus(null)
    setMode(null)
    setStage('running')
    setCurrent(2)
    setRunning(true)

    const ctrl = new AbortController()
    abortRef.current = ctrl
    // 组装上传文件集合（槽位 key → File[]，增量追加传全部文件；后端多文件参数 {key}_files）
    const uploadFiles: Record<string, File[]> = {}
    for (const [key, f] of Object.entries(files)) {
      if (f && f.length > 0) {
        uploadFiles[key] = f.map((sf) => sf.file).filter((x): x is File => Boolean(x))
      }
    }

    const outcome: RunOutcome = await runReconciliation(profile, {
      files: uploadFiles,
      mapping: mappings,
      signal: ctrl.signal,
      onProgress: (st) => setTaskStatus(st),
    })

    if (outcome.aborted) {
      setRunning(false)
      setError(null)
      setStage('mapping')
      setCurrent(1)
      message.info('已中止对账，返回字段映射')
      return
    }

    setResult(outcome.result)
    setMode(outcome.mode)
    setTaskStatus((prev) => prev && prev.status === 'success' ? prev : null)
    setRunning(false)

    if (outcome.mode === 'live') {
      setStage('result')
      setCurrent(3)
      setTaskSeq((s) => {
        const ns = s + 1
        saveSession({ seq: ns, lastCountry: countryId })
        return ns
      })
      message.success(`真实对账完成（后端任务 ${outcome.taskId || ''} · ${profile.countryZh} ${profile.period}）`)
    } else {
      // 演示模式：若带 error 说明（后端不可达/失败）展示为失败态；否则正常进结果
      if (outcome.error) {
        setError(outcome.error)
        setStage('running')
      } else {
        setStage('result')
        setCurrent(3)
        setTaskSeq((s) => {
          const ns = s + 1
          saveSession({ seq: ns, lastCountry: countryId })
          return ns
        })
        message.success(`演示对账完成（${profile.countryZh} ${profile.period} · 未上传文件或后端未接入）`)
      }
    }
  }

  const handleRetry = () => {
    // 回到映射步骤重新发起（保留已上传文件）
    setError(null)
    setStage('mapping')
    setCurrent(1)
    message.info('请确认映射后点击「开始核对」重试')
  }

  const handleAbort = () => {
    abortRef.current?.abort()
  }

  const handleReset = () => {
    abortRef.current?.abort()
    setFiles({})
    setParsedFiles({})
    setMappings(null)
    setResult(null)
    setError(null)
    setTaskStatus(null)
    setMode(null)
    setStage('upload')
    setCurrent(0)
    message.info('已重置，开始新任务')
  }

  const stepFlowHint = profile.ui.uploadFlowHint
  return (
    <AntApp>
      <Layout style={{ minHeight: '100vh' }}>
        <Header
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '0 24px', borderBottom: '1px solid #eef0f6',
            boxShadow: '0 1px 2px rgba(16,24,40,.04)', position: 'sticky', top: 0, zIndex: 10,
          }}
        >
          <div style={{
            width: 34, height: 34, borderRadius: 8, background: 'linear-gradient(135deg,#1d4ed8,#7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 17,
          }}>
            <DatabaseOutlined />
          </div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>对账平台 <span style={{ fontSize: 12, fontWeight: 400, color: '#6b7280' }}>Reconcile · MVP</span></div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#4b5563' }}>
            {mode === 'live' && (
              <Tag color="green" icon={<CloudServerOutlined />} style={{ marginInlineEnd: 0 }}>真实对账</Tag>
            )}
            {mode === 'demo' && (
              <Tag color="default" icon={<ExperimentOutlined />} style={{ marginInlineEnd: 0 }}>演示数据</Tag>
            )}
            <span style={{
              background: '#eef2ff', color: '#1d4ed8', padding: '2px 10px', borderRadius: 999,
              fontSize: 12, fontWeight: 600,
            }}>
              {profile.countryZh} · {profile.period}
            </span>
            <span style={{ color: '#9ca3af', fontSize: 12 }}>任务 {taskId}</span>
            <CountrySelector value={countryId} onChange={handleCountryChange} profile={profile} />
          </div>
        </Header>

        <Content style={{ maxWidth: 1280, margin: '0 auto', width: '100%', padding: '20px 24px 48px' }}>
          {/* 步骤条 */}
          <div style={{ background: '#fff', borderRadius: 12, padding: '20px 28px', boxShadow: '0 1px 3px rgba(16,24,40,.06)' }}>
            <Steps
              current={current}
              size="small"
              items={[
                { title: '导入文件', icon: <UploadOutlined /> },
                { title: '字段映射', icon: <PartitionOutlined /> },
                { title: '规则核对', icon: <ThunderboltOutlined /> },
                { title: '结果展示', icon: <BarChartOutlined /> },
              ]}
            />
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                {stage === 'upload' && stepFlowHint}
                {stage === 'mapping' && '确认系统自动推荐的字段映射，缺失必填字段会高亮提示'}
                {stage === 'running' && (mode === 'live'
                  ? `后端引擎执行中（${profile.rules.length} 条内置规则，异步任务进度 ${taskStatus?.progress ?? 0}%）`
                  : `规则引擎按 ${profile.rules.length} 条内置规则自动核对（L1 通道 / L2 银行 / 免单 / 退款 / 全覆盖）`)}
                {stage === 'result' && '一屏总览 + 四维总览 + 通道 + L2 银行 + 差异清单'}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {stage !== 'upload' && (
                  <Button size="small" icon={<ReloadOutlined />} onClick={handleReset}>新任务</Button>
                )}
                {stage === 'running' && running && (
                  <Button size="small" icon={<StopOutlined />} onClick={handleAbort}>中止</Button>
                )}
                {stage !== 'running' && stage !== 'result' && current < 2 && (
                  <Button
                    size="small" type="primary" icon={<PlayCircleOutlined />}
                    onClick={() => {
                      if (current === 0) go(1)
                      else handleRun()
                    }}
                  >
                    {current === 0 ? '下一步：字段映射' : '开始核对'}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            {stage === 'upload' && (
              <StepUpload files={files} setFiles={setFiles} profile={profile} parsedFiles={parsedFiles} setParsedFiles={setParsedFiles} />
            )}
            {stage === 'mapping' && (
              <StepMapping profile={profile} parsedFiles={parsedFiles} onMappingChange={setMappings} />
            )}
            {stage === 'running' && (
              <StepRunning
                running={running}
                error={error}
                profile={profile}
                taskStatus={taskStatus}
                mode={mode}
                onRetry={handleRetry}
                onBackToMapping={handleRetry}
              />
            )}
            {stage === 'result' && result && <StepResults result={result} profile={profile} mode={mode} />}
          </div>
        </Content>
      </Layout>
    </AntApp>
  )
}
