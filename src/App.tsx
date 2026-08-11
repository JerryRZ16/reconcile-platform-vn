import { useState } from 'react'
import {
  Layout, Steps, Button, App as AntApp, message,
} from 'antd'
import {
  UploadOutlined, PartitionOutlined, ThunderboltOutlined, BarChartOutlined,
  PlayCircleOutlined, ReloadOutlined, DatabaseOutlined,
} from '@ant-design/icons'
import StepUpload from './components/StepUpload'
import StepMapping from './components/StepMapping'
import StepRunning from './components/StepRunning'
import StepResults from './components/StepResults'
import { runReconciliation, RECON_COUNTRY, RECON_PERIOD } from './data/mockData'
import type { ReconResult } from './data/mockData'

const { Header, Content } = Layout

type Stage = 'upload' | 'mapping' | 'running' | 'result'

export default function App() {
  const [stage, setStage] = useState<Stage>('upload')
  const [current, setCurrent] = useState(0)
  const [files, setFiles] = useState<Record<string, { name: string; size: number } | null>>({
    oms: null, online: null, instore: null, tcb: null,
  })
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<ReconResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const go = (to: number) => {
    if (to === 2) setStage('running')
    else if (to === 3) setStage('result')
    else setStage(['upload', 'mapping', 'running', 'result'][to] as Stage)
    setCurrent(to)
  }

  // 首次进入或重跑：展示"演示数据"说明
  const handleRun = async () => {
    setError(null)
    setStage('running')
    setCurrent(2)
    setRunning(true)
    try {
      const res = await runReconciliation()
      setResult(res)
      setStage('result')
      setCurrent(3)
      setRunning(false)
      message.success('对账完成，结果已生成（越南 2026-07 演示数据）')
    } catch (e) {
      setError('规则引擎执行失败：' + (e as Error).message)
      setRunning(false)
      setStage('running')
    }
  }

  const handleReset = () => {
    setFiles({ oms: null, online: null, instore: null, tcb: null })
    setResult(null)
    setError(null)
    setStage('upload')
    setCurrent(0)
    message.info('已重置，开始新任务')
  }

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
            <span style={{
              background: '#eef2ff', color: '#1d4ed8', padding: '2px 10px', borderRadius: 999,
              fontSize: 12, fontWeight: 600,
            }}>
              {RECON_COUNTRY} · {RECON_PERIOD}
            </span>
            <span style={{ color: '#9ca3af', fontSize: 12 }}>任务 VN-202607-001</span>
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
                {stage === 'upload' && '① 上传 OMS 订单与 PAYOO/TCB 账单文件 → ② 确认字段映射 → ③ 运行对账规则 → ④ 查看可视化结果'}
                {stage === 'mapping' && '确认系统自动推荐的字段映射，缺失必填字段会高亮提示'}
                {stage === 'running' && '规则引擎按 6 条内置规则自动核对（L1 三通道 / L2 银行 / 免单 / 退款 / 全覆盖）'}
                {stage === 'result' && '一屏总览 + 四维总览 + 三通道 + L2 银行 + 差异清单'}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {stage !== 'upload' && (
                  <Button size="small" icon={<ReloadOutlined />} onClick={handleReset}>新任务</Button>
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
            {stage === 'upload' && <StepUpload files={files} setFiles={setFiles} />}
            {stage === 'mapping' && <StepMapping />}
            {stage === 'running' && <StepRunning running={running} error={error} />}
            {stage === 'result' && result && <StepResults result={result} />}
          </div>
        </Content>
      </Layout>
    </AntApp>
  )
}
