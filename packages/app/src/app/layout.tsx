import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import StyledComponentsRegistry from '../lib/StyledComponentsRegistry'
import ThemeWrapper from '../lib/ThemeWrapper'
import { TRPCProvider } from '../lib/TRPCProvider'

export const metadata: Metadata = {
  title: 'Volley',
  description: 'Tournament bracket generator',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <StyledComponentsRegistry>
            <ThemeWrapper>
              <TRPCProvider>{children}</TRPCProvider>
            </ThemeWrapper>
          </StyledComponentsRegistry>
        </body>
      </html>
    </ClerkProvider>
  )
}
