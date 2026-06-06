import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/file-codec/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      // Only active in production build, not dev
      devOptions: { enabled: false },
      manifest: {
        name: 'FileCodec — AES-256 Encryption',
        short_name: 'FileCodec',
        description: 'Encrypt and decrypt files locally using AES-GCM 256',
        theme_color: '#0d0d14',
        background_color: '#0d0d14',
        display: 'standalone',
        start_url: '/file-codec/',
        scope: '/file-codec/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: '/file-codec/index.html',
      }
    })
  ],
  build: {
    target: 'es2022',
    sourcemap: false,
  }
})
