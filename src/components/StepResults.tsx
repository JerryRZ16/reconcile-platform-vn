import { Card, Alert, Typography, Tag, Space, Button } from 'antd'
import { DownloadOutlined, FileExcelOutlined, FileMarkdownOutlined, CloudServerOutlined, ExperimentOutlined } from '@ant-design/icons'
import type { ReconResult } from '../data/mockData'
import type { CountryProfile } from '../profiles'
import MetricCards from './Results/MetricCards'
import OmsOverview from './Results/OmsOverview'
import ChannelCards from './Results/ChannelCards'
import BankRecon from './Results/BankRecon'
import DiscrepancyTable from './Results/DiscrepancyTable'
import { FreeOrders, Refunds } from './Results/FreeRefund'
import CoverageMatrix from './Results/CoverageMatrix'

const { Text } = Typography

interface Props {
  result: ReconResult;
  profile: CountryProfile;
  /** 数据来源模式：live=真实对账 / demo=演示数据 */
  mode?: 'live' | 'demo' | null;
}

export default function StepResults({ result, profile, mode }: Props) {
  const r = result
  const show = (m: string) => profile.showModules.includes(m)
  const cur = profile.currency

  return (
    <div className="fade-up">
      <Card style={{ marginBottom: 16, background: 'linear-gradient(135deg,#1d4ed8,#312e81)', color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Space align="center" style={{ marginBottom: 6 }}>
              <Tag color="gold" style={{ margin: 0 }}>对账完成</Tag>
              {mode === 'live' ? (
                <Tag icon={<CloudServerOutlined />} color="green" style={{ margin: 0 }}>真实对账</Tag>
              ) : mode === 'demo' ? (
                <Tag icon={<ExperimentOutlined />} color="default" style={{ margin: 0 }}>演示数据</Tag>
              ) : null}
              <Text style={{ color: 'rgba(255,255,255,.75)' }}>
                任务 {r.summary.taskId} · {profile.countryZh} {profile.period} · 运行于 {r.summary.runAt}
              </Text>
            </Space>
            <div style={{ fontSize: 22, fontWeight: 700 }}>
              {profile.ui.resultTitle}
            </div>
            <div style={{ color: 'rgba(255,255,255,.8)', fontSize: 13, marginTop: 4 }}>
              OMS {r.summary.totalOrders.toLocaleString()} 笔 · {cur.short(r.summary.totalAmount)} {cur.code} ·
              整体匹配率 <b style={{ fontSize: 16 }}>{r.summary.overallMatchRate}</b> ·
              差异 {r.summary.diffCount.toLocaleString()} 笔 / {cur.short(r.summary.diffAmount)} {cur.code}
            </div>
          </div>
          <Space>
            <Button icon={<DownloadOutlined />} ghost>导出报告</Button>
            <Button icon={<FileExcelOutlined />} ghost>差异清单 Excel</Button>
            <Button icon={<FileMarkdownOutlined />} ghost>Markdown</Button>
          </Space>
        </div>
      </Card>

      {show('metricCards') && <MetricCards summary={r.summary} profile={profile} />}

      <div style={{ height: 16 }} />

      {show('channelCards') && <ChannelCards channels={r.channels} profile={profile} />}

      {show('omsOverview') && (
        <OmsOverview
          profile={profile}
          data={{
            byBusiness: r.omsByBusiness,
            bySource: r.omsBySource,
            byPayType: r.omsByPayType,
            byStatus: r.omsByStatus,
          }}
        />
      )}

      {show('bankRecon') && <BankRecon daily={r.bankDaily} summary={r.bankRecon} profile={profile} />}

      {show('discrepancyTable') && <DiscrepancyTable data={r.discrepancies} profile={profile} />}

      {show('freeOrders') && <FreeOrders data={r.freeOrders} profile={profile} />}
      {show('refunds') && <Refunds data={r.refunds} profile={profile} />}
      {show('coverageMatrix') && <CoverageMatrix data={r.coverage} profile={profile} />}

      <Card>
        <Alert
          type="info" showIcon
          message={
            mode === 'live'
              ? `本结果来自真实对账链路（后端任务 ${result.summary.taskId}）· ${profile.ui.resultDemoNote}`
              : `${profile.ui.resultDemoNote}${mode === 'demo' ? '（当前为演示数据，非后端实时结果）' : ''}`
          }
        />
      </Card>
    </div>
  )
}
