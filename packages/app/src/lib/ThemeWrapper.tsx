'use client'

import { ThemeProvider } from 'styled-components'
import { defaultTheme, GlobalStyle } from '@design-system/components'

export default function ThemeWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={defaultTheme}>
      <GlobalStyle />
      {children}
    </ThemeProvider>
  )
}
