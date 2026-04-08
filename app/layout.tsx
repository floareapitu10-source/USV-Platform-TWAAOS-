import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from '@/components/ui/sonner'
import { NotificationToastProvider } from '@/components/notifications/notification-toast'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'USV Events - Platforma de Evenimente Universitare',
  description: 'Platforma de gestionare a evenimentelor pentru Universitatea Stefan cel Mare din Suceava',
  generator: 'v0.app',
  icons: {
    icon: '/usvlogo.png',
    apple: '/usvlogo.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ro">
      <body className="font-sans antialiased">
        {children}
        <Analytics />
        <Toaster />
        <NotificationToastProvider />
      </body>
    </html>
  )
}
