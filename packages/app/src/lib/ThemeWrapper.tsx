'use client'

import { ThemeProvider } from 'styled-components'
import { defaultTheme, darkTheme, GlobalStyle } from '@design-system/components'
import { ThemeContextProvider, useThemeMode } from './ThemeContext'

function ThemedContent({ children }: { children: React.ReactNode }) {
  const { mode } = useThemeMode()
  return (
    <ThemeProvider theme={mode === 'dark' ? darkTheme : defaultTheme}>
      <GlobalStyle />
      {children}
    </ThemeProvider>
  )
}

export default function ThemeWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeContextProvider>
      <ThemedContent>{children}</ThemedContent>
    </ThemeContextProvider>
  )
}
