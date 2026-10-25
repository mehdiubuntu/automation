import { create } from 'zustand'

export type ThemePreference = 'light' | 'dark' | 'system'

export const THEME_PREFERENCES: ThemePreference[] = ['light', 'dark', 'system']

const STORAGE_KEY = 'app.theme'
const media = window.matchMedia('(prefers-color-scheme: dark)')

function readStored(): ThemePreference {
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
}

function apply(pref: ThemePreference) {
  const dark = pref === 'dark' || (pref === 'system' && media.matches)
  document.documentElement.classList.toggle('dark', dark)
}

interface ThemeState {
  theme: ThemePreference
  setTheme: (theme: ThemePreference) => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: readStored(),
  setTheme: (theme) => {
    localStorage.setItem(STORAGE_KEY, theme)
    apply(theme)
    set({ theme })
  },
}))

// Follow OS theme changes while in 'system' mode.
media.addEventListener('change', () => {
  if (useThemeStore.getState().theme === 'system') apply('system')
})

// Applied at module import — main.tsx imports this before React renders,
// so the dark class is on <html> before first paint (no light flash).
apply(readStored())
