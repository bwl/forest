import { create } from 'zustand'

export type ThemePreference = 'system' | 'light' | 'dark'
export type Theme = 'light' | 'dark'

interface ThemeState {
  // User's explicit preference (from Tauri settings)
  themePreference: ThemePreference
  // System theme detected from media query
  systemTheme: Theme
  // Computed effective theme (based on preference + system)
  effectiveTheme: Theme
  // Actions
  setThemePreference: (preference: ThemePreference) => void
  setSystemTheme: (theme: Theme) => void
}

// Compute effective theme based on preference and system theme
function computeEffectiveTheme(
  preference: ThemePreference,
  systemTheme: Theme
): Theme {
  if (preference === 'system') {
    return systemTheme
  }
  return preference as Theme
}

export const useTheme = create<ThemeState>((set, get) => ({
  themePreference: 'system',
  systemTheme: 'light',
  effectiveTheme: 'light',

  setThemePreference: (preference) => {
    const { systemTheme } = get()
    const effectiveTheme = computeEffectiveTheme(preference, systemTheme)
    set({ themePreference: preference, effectiveTheme })
  },

  setSystemTheme: (theme) => {
    const { themePreference } = get()
    const effectiveTheme = computeEffectiveTheme(themePreference, theme)
    set({ systemTheme: theme, effectiveTheme })
  },
}))
