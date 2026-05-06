'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

type ThemeMode = 'light' | 'dark'

interface ThemeContextValue {
  mode: ThemeMode
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue>({ mode: 'light', toggle: () => {} })

export function ThemeContextProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('light')
  const toggle = () => setMode((m) => (m === 'light' ? 'dark' : 'light'))
  return <ThemeContext.Provider value={{ mode, toggle }}>{children}</ThemeContext.Provider>
}

export function useThemeMode() {
  return useContext(ThemeContext)
}
