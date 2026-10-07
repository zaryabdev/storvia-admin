import { ClerkProvider } from '@clerk/nextjs'
import { Inter } from 'next/font/google'

import { PwaProvider } from '@/components/pwa-provider'
import { ModalProvider } from '@/providers/modal-provider'
import { ToastProvider } from '@/providers/toast-provider'
import { ThemeProvider } from '@/providers/theme-provider'

import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Storvia Admin',
  description: 'Storvia merchant administration',
  // Installable app (app/manifest.ts; the manifest link is added by Next).
  themeColor: '#0f766e',
  appleWebApp: {
    capable: true,
    title: 'Storvia',
    statusBarStyle: 'default',
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>
          <ThemeProvider 
            attribute="class" 
            defaultTheme="system" 
            enableSystem
          >
            <PwaProvider>
              <ToastProvider />
              <ModalProvider />
              {children}
            </PwaProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
