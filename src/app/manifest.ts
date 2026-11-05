import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Xưởng Agent',
    short_name: 'Xưởng Agent',
    description: 'Theo dõi các phiên Claude Code theo thời gian thực',
    start_url: '/',
    display: 'standalone',
    background_color: '#020611',
    theme_color: '#020611',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
