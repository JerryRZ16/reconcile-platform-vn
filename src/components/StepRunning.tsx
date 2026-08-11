import { useEffect, useState } from 'react'
import { Card, Steps, Alert, Typography, Result, Button } from 'antd'
import { CheckCircleOutlined, LoadingOutlined, ThunderboltOutlined } from '@ant-design/icons'

const { Text } = Typography

const RULES = [
  { key: 'r1', name: 'OMS 四维总览', desc: 'business_type / order_source / pay_type / order_status 笔数金额统计' },
  { key: 'r2', name: 'L1 · ONLINE 通道', desc: 'order_source 9/10 ↔ PAYOO ONLINE 按 order_no 逐笔匹配' },
  { key: 'r3', name: 'L1 · INSTORE 通道', desc: 'order_source=4 且 pay_type 4/45/46 ↔ 店+额+时±5min 三元组匹配' },
  { key: 'r4', name: 'L1 · 现金通道', desc: 'pay_type=98 门店聚合 ↔ TCB 缴存流水核对' },
  { key: 'r5', name: 'L2 · 银行对账', desc: 'PAYOO 结算 ↔ TCB 流水按日对平 + T+N 跨月分解' },
  { key: 'r6', name: '免单 / 退款 / 全覆盖', desc: 'pay_type=500 验证 · status 7/8 归集 · order_source×pay_type 全覆盖检查' },
]

interface Props {
  running: boolean;
  error: string | null;
}

export default function StepRunning({ running, error }: Props) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!running) return
    setStep(0)
    const timer = setInterval(() => {
      setStep((s) => {
        if (s >= RULES.length - 1) {
          clearInterval(timer)
          return s
        }
        return s + 1
      })
    }, 700)
    return () => clearInterval(timer)
  }, [running])

  if (error) {
    return (
      <Card>
        <Result
          status="error"
          title="规则引擎执行失败"
          subTitle={error}
          extra={<Button type="primary">重试</Button>}
        />
      </Card>
    )
  }

  const done = step >= RULES.length - 1
  const pct = Math.round(((step + (done ? 1 : 0)) / RULES.length) * 100)

  return (
    <div className="fade-up">
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <ThunderboltOutlined style={{ color: '#1d4ed8', fontSize: 20 }} />
          <div>
            <Typography.Title level={5} style={{ margin: 0 }}>规则引擎执行中</Typography.Title>
            <Text type="secondary">已加载越南 2026-07 数据：OMS 126,623 笔 · PAYOO / TCB 账单文件 3 份</Text>
          </div>
        </div>

        <Steps
          direction="vertical"
          size="small"
          current={step}
          items={RULES.map((r) => ({
            title: r.name,
            description: r.desc,
            status: step > RULES.findIndex((x) => x.key === r.key)
              ? 'finish'
              : step === RULES.findIndex((x) => x.key === r.key)
                ? 'process'
                : 'wait',
          }))}
        />

        <div style={{ marginTop: 24 }}>
          <Alert
            type={done ? 'success' : 'info'}
            showIcon
            icon={done ? <CheckCircleOutlined /> : <LoadingOutlined />}
            message={
              done
                ? `完成！6 条规则全部执行成功（${pct}%）`
                : `正在执行第 ${step + 1} / ${RULES.length} 条规则：${RULES[step].name}（${pct}%）`
            }
          />
        </div>
      </Card>
    </div>
  )
}
