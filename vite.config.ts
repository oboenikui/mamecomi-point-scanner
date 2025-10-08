import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
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
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'opencv.js'],
      manifest: {
        name: 'まめコミポイントスキャナ',
        short_name: 'まめコミスキャナ',
        description: 'すこやかミルクのシリアルコードをスキャンしてクリップボードにコピーします',
        theme_color: '#33A852',
        background_color: '#D9F0C8',
        display: 'standalone',
        orientation: 'portrait',
        scope: basePath,
        start_url: basePath,
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024, // 15MB
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'jsdelivr-cdn',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1年
              }
            }
          }
        ]
      }
    })
  ],
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
