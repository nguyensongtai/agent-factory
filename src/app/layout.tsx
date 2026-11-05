import type { Metadata, Viewport } from 'next'
import { Be_Vietnam_Pro, Chakra_Petch, VT323 } from 'next/font/google'

import './globals.css'

const sans = Be_Vietnam_Pro({
  variable: '--font-be-vietnam',
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '600', '700'],
})

const display = Chakra_Petch({
  variable: '--font-chakra',
  subsets: ['latin', 'vietnamese'],
  weight: ['500', '600', '700'],
})

// The canvas reads --font-vt323 directly for its pixel labels.
const pixel = VT323({
  variable: '--font-vt323',
  subsets: ['latin', 'vietnamese'],
  weight: '400',
})

export const metadata: Metadata = {
  title: { default: 'Xưởng Agent', template: '%s · Xưởng Agent' },
  description: 'Theo dõi các phiên Claude Code và siêu năng lực của chúng theo thời gian thực',
  applicationName: 'Xưởng Agent',
}

export const viewport: Viewport = {
  themeColor: '#020611',
  colorScheme: 'dark',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="vi" className={`${sans.variable} ${display.variable} ${pixel.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}
