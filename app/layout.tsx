import type { Metadata, Viewport } from 'next'
import { Gowun_Batang, Gowun_Dodum } from 'next/font/google'
import './globals.css'

const batang = Gowun_Batang({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-gowun-batang',
  display: 'swap',
})

const dodum = Gowun_Dodum({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-gowun-dodum',
  display: 'swap',
})

export const metadata: Metadata = {
  title: '하늘정원',
  description: '하루 한 번, 지금 보이는 하늘색으로 피우는 꽃',
  appleWebApp: { capable: true, title: '하늘정원', statusBarStyle: 'default' },
}

export const viewport: Viewport = {
  themeColor: '#F7F2E9',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${batang.variable} ${dodum.variable}`}>
      <body>{children}</body>
    </html>
  )
}
