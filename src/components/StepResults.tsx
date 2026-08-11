import { Card, Alert, Typography, Tag, Space, Button } from 'antd'
import { DownloadOutlined, FileExcelOutlined, FileMarkdownOutlined } from '@ant-design/icons'
import { RECON_COUNTRY, RECON_PERIOD } from '../data/mockData'
import type { ReconResult } from '../data/mockData'
import MetricCards from './Results/MetricCards'
import OmsOverview from './Results/OmsOverview'
import ChannelCards from './Results/ChannelCards'
import BankRecon from './Results/BankRecon'
import DiscrepancyTable from './Results/DiscrepancyTable'
import { FreeOrders, Refunds } from './Results/FreeRefund'
import CoverageMatrix from './Results/CoverageMatrix'

const { Text } = Typography

export default function StepResults({ result }: { result: ReconResult }) {
  const r = result
  return (
    <div className="fade-up">
      <Card style={{ marginBottom: 16, background: 'linear-gradient(135deg,#1d4ed8,#312e81)', color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Space align="center" style={{ marginBottom: 6 }}>
              <Tag color="gold" style={{ margin: 0 }}>对账完成</Tag>
              <Text style={{ color: 'rgba(255,255,255,.75)' }}>
                任务 {r.summary.taskId} · {RECON_COUNTRY} {RECON_PERIOD} · 运行于 {r.summary.runAt}
              </Text>
            </Space>
            <div style={{ fontSize: 22, fontWeight: 700 }}>
              越南 2026-07 全通道对账结果
            </div>
            <div style={{ color: 'rgba(255,255,255,.8)', fontSize: 13, marginTop: 4 }}>
              OMS {r.summary.totalOrders.toLocaleString()} 笔 · {r.summary.totalAmount.toLocaleString()} VND ·
              整体匹配率 <b style={{ fontSize: 16 }}>{r.summary.overallMatchRate}</b> ·
              差异 {r.summary.diffCount.toLocaleString()} 笔 / {r.summary.diffAmount.toLocaleString()} VND
            </div>
          </div>
          <Space>
            <Button icon={<DownloadOutlined />} ghost>导出报告</Button>
            <Button icon={<FileExcelOutlined />} ghost>差异清单 Excel</Button>
            <Button icon={<FileMarkdownOutlined />} ghost>Markdown</Button>
          </Space>
        </div>
      </Card>

      <MetricCards summary={r.summary} />

      <div style={{ height: 16 }} />

      <ChannelCards channels={r.channels} />

      <OmsOverview
        data={{
          byBusiness: r.omsByBusiness,
          bySource: r.omsBySource,
          byPayType: r.omsByPayType,
          byStatus: r.omsByStatus,
        }}
      />

      <BankRecon daily={r.bankDaily} summary={r.bankRecon} />

      <DiscrepancyTable data={r.discrepancies} />

      <FreeOrders data={r.freeOrders} />
      <Refunds data={r.refunds} />
      <CoverageMatrix data={r.coverage} />

      <Card>
        <Alert
          type="info" showIcon
          message="演示说明：本结果基于越南 2026-07 真实数据预生成（OMS 126,623 笔 + PAYOO + TCB 流水），规则与指标口径参考《对账平台 MVP · PRD》。对接后端 API 时替换 src/data/mockData.ts 中的 runReconciliation 即可。"
        />
      </Card>
    </div>
  )
}
