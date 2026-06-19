import type { Metadata } from 'next'
import { Bebas_Neue, DM_Sans, DM_Mono } from 'next/font/google'
import './globals.css'
import { AuthProvider } from './context/AuthContext'

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
})

const dmMono = DM_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
  variable: '--font-dm-mono',
})

export const metadata: Metadata = {
  title: {
    default: 'Rebuttal.Live — Real-Time AI-Judged Debates',
    template: '%s | Rebuttal.Live',
  },
  description: 'Argue live, get scored by AI, climb the global leaderboard. Real-time debate battles on any topic.',
  metadataBase: new URL('https://www.rebuttal.live'),
  openGraph: {
    title: 'Rebuttal.Live',
    description: 'Real-time debate battles scored by AI.',
    url: 'https://www.rebuttal.live',
    siteName: 'Rebuttal.Live',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Rebuttal.Live',
    description: 'Real-time debate battles scored by AI.',
    images: ['/og-image.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className={`${bebasNeue.variable} ${dmSans.variable} ${dmMono.variable}`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}