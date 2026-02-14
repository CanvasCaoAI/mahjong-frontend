import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Deploy under a sub-path (e.g. /majiang/) on static hosting.
// Use relative base so built index.html references assets like "./assets/..."
// and works no matter which folder it is served from.
export default defineConfig({
  base: './',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      // Ensure manifest path works under subfolder deploy
      manifestFilename: 'manifest.webmanifest',
      manifest: {
        name: 'Mahjong',
        short_name: 'Mahjong',
        description: 'Mahjong game',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#05060B',
        theme_color: '#05060B',
        icons: [
          { src: './pwa/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: './pwa/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      includeAssets: ['pwa/icon-192.png', 'pwa/icon-512.png'],
    })
  ]
});
