import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Roesel Transportes',
  description: 'Sistema interno de gestão',
}

const APP_VERSION = '1.0.4'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              var VERSION = '${APP_VERSION}';
              var storedVersion = localStorage.getItem('app_version');
              
              if (storedVersion !== VERSION) {
                localStorage.clear();
                localStorage.setItem('app_version', VERSION);
              }

              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function(registrations) {
                  for (var r of registrations) { r.unregister(); }
                });
              }

              if ('caches' in window) {
                caches.keys().then(function(names) {
                  for (var name of names) { caches.delete(name); }
                });
              }
            })();
          `
        }} />
      </head>
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}