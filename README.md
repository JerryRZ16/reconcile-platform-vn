# 对账平台 MVP · 前端

Reconcile Platform MVP — 越南 2026-07 对账演示。

## 技术栈

- **React 19** + **Vite 8** + **TypeScript**
- **antd 6**（中文 locale · 财务工具风蓝色主题）
- **recharts**（L2 银行按日对平柱+线复合图）
- **@ant-design/icons**

## 功能

- 步骤式向导：导入 → 字段映射 → 规则核对 → 结果展示
- 4 类文件上传槽位（OMS / PAYOO ONLINE / PAYOO INSTORE / TCB），含格式与文件名归属校验
- 字段映射页：自动推断源列 → 目标字段，可下拉修正，必填校验
- 规则引擎执行进度条（6 条规则）
- 结果页：
  - 6 张汇总指标卡片（总笔数/总金额/匹配率/差异笔数/差异金额/未覆盖）
  - L1 三通道仪表盘（ONLINE / INSTORE / 现金）
  - OMS 四维总览（business_type / order_source / pay_type / order_status）
  - L2 银行对账（按日柱线图 + 跨月勾稽）
  - 差异与未匹配清单（通道 / 根因 / 状态 / 关键词筛选）
  - 免单验证清单（pay_type=500 全额收款识别）
  - 退款 / 取消归集
  - 全覆盖检查（order_source × pay_type 矩阵）

## 演示数据

内置越南 2026-07 真实数据（来自 `vn-recon-2026-06` 沉淀方法 + `vn_oms_202607` 全量聚合）：

- OMS 126,623 笔 · 16,262,716,050 VND
- L1 三通道：ONLINE 99.40% / INSTORE 99.74% / 现金 98.26%
- L2：PAYOO 净额 13,285M ↔ 银行入账 14,136M（含 T+N 跨月）
- 差异 1,426 笔 / 58.34M VND

后端 API 接入时替换 `src/data/mockData.ts` 中的 `runReconciliation()` 即可。

## 启动

```bash
cd frontend
npm install
npm run dev        # 开发：http://localhost:5173
# 或
npm run build && npm run preview   # 生产构建 + 预览：http://localhost:4173
```

## 目录

```
src/
├── App.tsx                # 步骤式向导主壳
├── main.tsx               # 入口（含 antd ConfigProvider / 中文 locale）
├── index.css              # 全局样式
├── data/mockData.ts       # 越南 2026-07 真实数据 + 模拟 API
└── components/
    ├── StepUpload.tsx     # 步骤 1：4 类文件上传
    ├── StepMapping.tsx    # 步骤 2：字段映射
    ├── StepRunning.tsx    # 步骤 3：规则引擎执行
    ├── StepResults.tsx    # 步骤 4：结果页（组合）
    └── Results/
        ├── MetricCards.tsx
        ├── OmsOverview.tsx
        ├── ChannelCards.tsx
        ├── BankRecon.tsx
        ├── DiscrepancyTable.tsx
        ├── FreeRefund.tsx
        └── CoverageMatrix.tsx
```
