import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '하늘정원',
    short_name: '하늘정원',
    description: '하루 한 번, 지금 보이는 하늘색으로 피우는 꽃',
    lang: 'ko',
    start_url: '/garden',
    scope: '/',
    display: 'standalone',
    background_color: '#F7F2E9',
    theme_color: '#F7F2E9',
    icons: [
      { src: '/icons/192', sizes: '192x192', type: 'image/png' },
      { src: '/icons/512', sizes: '512x512', type: 'image/png' },
      { src: '/icons/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
