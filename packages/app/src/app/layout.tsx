import type { Metadata } from 'next'
import StyledComponentsRegistry from '../lib/StyledComponentsRegistry'
import ThemeWrapper from '../lib/ThemeWrapper'
import { TRPCProvider } from '../lib/TRPCProvider'

export const metadata: Metadata = {
  title: 'Volley',
  description: 'Tournament bracket generator',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StyledComponentsRegistry>
          <ThemeWrapper>
            <TRPCProvider>{children}</TRPCProvider>
          </ThemeWrapper>
        </StyledComponentsRegistry>
      </body>
    </html>
  )
}
