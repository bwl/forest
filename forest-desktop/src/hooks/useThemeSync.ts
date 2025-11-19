import { useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useTheme, type ThemePreference } from '../store/theme'

/**
 * Hook to sync theme state with system preferences and Tauri backend
 *
 * This hook should be called once at the app root level.
 * It handles:
 * - Loading initial theme preference from Tauri
 * - Detecting system theme via media query
 * - Listening for system theme changes
 */
export function useThemeSync() {
  const setThemePreference = useTheme((s) => s.setThemePreference)
  const setSystemTheme = useTheme((s) => s.setSystemTheme)

  useEffect(() => {
    // Load initial theme preference from Tauri
    async function loadThemePreference() {
      try {
        const preference = await invoke<string>('get_theme_preference')
        setThemePreference(preference as ThemePreference)
      } catch (error) {
        console.error('Failed to load theme preference:', error)
        // Default to 'system' if load fails
        setThemePreference('system')
      }
    }

    loadThemePreference()
  }, [setThemePreference])

  useEffect(() => {
    // Detect initial system theme
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const initialTheme = mediaQuery.matches ? 'dark' : 'light'
    setSystemTheme(initialTheme)

    // Listen for system theme changes
    const handler = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light')
    }

    mediaQuery.addEventListener('change', handler)

    return () => {
      mediaQuery.removeEventListener('change', handler)
    }
  }, [setSystemTheme])
}

/**
 * Hook to persist theme preference to Tauri backend
 *
 * Call this when the user changes their theme preference
 */
export async function saveThemePreference(preference: ThemePreference) {
  try {
    await invoke('set_theme_preference', { preference })
  } catch (error) {
    console.error('Failed to save theme preference:', error)
    throw error
  }
}
