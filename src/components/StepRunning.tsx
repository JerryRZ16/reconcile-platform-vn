import { useEffect, useState } from 'react'
import {
  Card, Steps, Alert, Typography, Result, Button, Space, Badge, Progress,
} from 'antd'
import {
  CheckCircleOutlined, LoadingOutlined, ThunderboltOutlined,
  ReloadOutlined, CloseCircleOutlined, ExperimentOutlined,
  CloudServerOutlined, DatabaseOutlined,
} from '@ant-design/icons'
import type { CountryProfile } from '../profiles'
import type { TaskStatus } from '../lib/reconcileClient'

const { Text } = Typography

interface Props {
  running: boolean;
  error: string | null;
  profile: CountryProfile;
  /** 真实任务进度（后端轮询 / 演示模式模拟），null 表示未开始 */
  taskStatus?: TaskStatus | null;
  /** 当前数据模式：live=真实对账 / demo=演示数据 */
  mode?: 'live' | 'demo' | null;
  /** 点击「重试」：回到映射步骤重新发起 */
  onRetry?: () => void;
  /** 点击「返回映射」：中止当前任务回到映射 */
  onBackToMapping?: () => void;
}

export default function StepRunning({
  running, error, profile, taskStatus, mode, onRetry, onBackToMapping,
}: Props) {
  const rules = profile.rules
  const [step, setStep] = useState(0)

  // 演示模式：无真实任务进度时，按 700ms/规则 模拟推进（保持阶段1/2 体验）
  useEffect(() => {
    if (!running || mode === 'live') return
    setStep(0)
    const timer = setInterval(() => {
      setStep((s) => {
        if (s >= rules.length - 1) {
          clearInterval(timer)
          return s
        }
        return s + 1
      })
    }, 700)
    return () => clearInterval(timer)
  }, [running, mode, rules.length])

  // 失败态：展示后端错误 + 重试/返回映射
  if (error && !running) {
    return (
      <Card>
        <Result
          status="error"
          title="对账执行失败"
          subTitle={error}
          extra={
            <Space>
              <Button type="primary" icon={<ReloadOutlined />} onClick={onRetry}>重试</Button>
              <Button icon={<CloseCircleOutlined />} onClick={onBackToMapping}>返回字段映射</Button>
            </Space>
          }
        />
      </Card>
    )
  }

  // 真实轮询进度：来自后端 taskStatus
  const liveProgress = mode === 'live' && taskStatus
    ? Math.max(5, Math.min(100, Number(taskStatus.progress) || 0))
    : 0
  const liveMsg = taskStatus?.message || '后端引擎执行中…'

  const done = mode === 'live'
    ? liveProgress >= 100
    : step >= rules.length - 1
  const pct = mode === 'live'
    ? Math.round(liveProgress)
    : Math.round(((step + (done ? 1 : 0)) / rules.length) * 100)

  return (
    <div className="fade-up">
      <Card>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
          <ThunderboltOutlined style={{ color: '#1d4ed8', fontSize: 20, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Typography.Title level={5} style={{ margin: 0 }}>对账执行中</Typography.Title>
              <Badge
                status={mode === 'live' ? 'processing' : 'default'}
                text={
                  mode === 'live'
                    ? <Text type="success"><CloudServerOutlined /> 真实对账（后端引擎）</Text>
                    : <Text type="secondary"><ExperimentOutlined /> 演示数据（未上传文件 / 后端不可达）</Text>
                }
              />
            </div>
            <Text type="secondary">
              {mode === 'live'
                ? `后端任务 ${taskStatus?.id ? `#${taskStatus.id}` : ''} · ${liveMsg}`
                : profile.ui.runningSubtitle}
            </Text>
          </div>
        </div>

        {/* 真实模式：展示后端进度条 */}
        {mode === 'live' ? (
          <div style={{ marginBottom: 20 }}>
            <Progress
              percent={pct}
              status={done ? 'success' : 'active'}
              strokeColor={{ from: '#1d4ed8', to: '#7c3aed' }}
              format={(p) => <span style={{ fontWeight: 700 }}>{p}%</span>}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {liveMsg}（轮询后端任务状态，间隔约 1.2s）
            </Text>
          </div>
        ) : (
          <Steps
            direction="vertical"
            size="small"
            current={step}
            items={rules.map((r) => ({
              title: r.name,
              description: r.desc,
              status: step > rules.findIndex((x) => x.key === r.key)
                ? 'finish'
                : step === rules.findIndex((x) => x.key === r.key)
                  ? 'process'
                  : 'wait',
            }))}
          />
        )}

        <div style={{ marginTop: 24 }}>
          <Alert
            type={done ? 'success' : 'info'}
            showIcon
            icon={done ? <CheckCircleOutlined /> : mode === 'live' ? <DatabaseOutlined /> : <LoadingOutlined />}
            message={
              done
                ? mode === 'live'
                  ? `完成！后端对账任务执行成功（${pct}%），即将展示结果`
                  : `完成！${rules.length} 条规则全部执行成功（${pct}%）`
                : mode === 'live'
                  ? `后端任务进行中：${liveMsg}（${pct}%）`
                  : `正在执行第 ${step + 1} / ${rules.length} 条规则：${rules[step].name}（${pct}%）`
            }
          />
        </div>
      </Card>
    </div>
  )
}
