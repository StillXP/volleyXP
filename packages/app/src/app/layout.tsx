import type { Metadata } from 'next'
import '@lockin/tokens/css/themes/arena'
import '@lockin/react/styles.css'
import './globals.css'
import StyledComponentsRegistry from '../lib/StyledComponentsRegistry'
import { TRPCProvider } from '../lib/TRPCProvider'
import { AccountLink } from '../components/AccountLink'

export const metadata: Metadata = {
  title: 'Volley',
  description: 'Tournament bracket generator',
}

// Applies the saved Lock In color mode before first paint to avoid a theme flash.
const colorModeScript = `try{var m=localStorage.getItem('ds-color-mode');if(m==='light'||m==='dark')document.documentElement.dataset.theme=m}catch(e){}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: colorModeScript }} />
      </head>
      <body>
        <StyledComponentsRegistry>
          <TRPCProvider>
            <a className="skip-link" href="#main-content">Skip to main content</a>
            <AccountLink />
            {/* The one main landmark for every page; the skip link jumps here. */}
            <main id="main-content" tabIndex={-1}>{children}</main>
          </TRPCProvider>
        </StyledComponentsRegistry>
      </body>
    </html>
  )
}
