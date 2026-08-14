import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ============================================================
// Vite 配置 · 多国部署配置化（阶段3）
// ------------------------------------------------------------
// base path 支持按环境变量覆盖，用于多国多 URL 部署：
//   VITE_BASE_PATH=./            → 相对路径（任意子路径部署）
//   VITE_BASE_PATH=/reconcile-platform-vn/  → 越南（默认，GitHub Pages 现状）
//   VITE_BASE_PATH=/reconcile-platform-th/  → 泰国（示例）
// 未设置时回退默认 /reconcile-platform-vn/（保持现有 GitHub Pages 链接不变）。
//
// /api 代理：开发环境（5173）代理到本地后端 8000；
// 生产静态部署（GitHub Pages）无后端代理，前端会用 API_BASE 直连
// （默认同源，可注入 window.__API_BASE__ 指向后端网关）。
// ============================================================
const BASE_PATH = process.env.VITE_BASE_PATH || '/reconcile-platform-vn/'

// https://vite.dev/config/
export default defineConfig({
  base: BASE_PATH,
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
