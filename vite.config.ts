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
          {
            src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%230d0d14"/><text y=".9em" font-size="80">🔒</text></svg>',
            sizes: '192x192',
            type: 'image/svg+xml'
          }
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
