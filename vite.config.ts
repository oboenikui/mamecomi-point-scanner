import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// HTTPS証明書のパス
const httpsKeyPath = path.resolve(__dirname, 'localhost+2-key.pem')
const httpsCertPath = path.resolve(__dirname, 'localhost+2.pem')

// 証明書ファイルの存在確認
const hasCertificates = fs.existsSync(httpsKeyPath) && fs.existsSync(httpsCertPath)

// 環境変数からベースパスを取得（デフォルト: /mamecomi-point-scanner/）
const basePath = process.env.BASE_PATH || '/mamecomi-point-scanner/'

// HTTPS設定
const httpsConfig = hasCertificates ? {
  key: fs.readFileSync(httpsKeyPath),
  cert: fs.readFileSync(httpsCertPath)
} : undefined

export default defineConfig({
  plugins: [react()],
  base: basePath,
  server: {
    port: 3000,
    https: httpsConfig,
    host: true
  },
  preview: {
    port: 3000,
    https: httpsConfig,
    host: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true
  }
})
