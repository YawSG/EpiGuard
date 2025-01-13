import './globals.css'

export const metadata = {
  title: 'EpiGuard',
  description: 'AI-powered medical assistant',
  icons: {
    icon: [
      { url: '/epiguard_shield.png', sizes: '32x32', type: 'image/png' },
      { url: '/epiguard_shield.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [
      { url: '/epiguard_shield.png', sizes: '180x180', type: 'image/png' },
    ],
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}