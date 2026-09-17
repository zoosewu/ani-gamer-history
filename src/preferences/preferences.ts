export const PREFERENCES_KEY = 'preferences'

// 每台電腦自己的顯示偏好，和「自動同步」一樣不上傳到雲端
export interface Preferences {
  // 不在動畫瘋首頁顯示的來源；隱藏只影響清單顯示，仍會繼續記錄與同步
  hiddenSources: string[]
}

export const defaultPreferences: Preferences = { hiddenSources: [] }

export const parsePreferences = (value: unknown): Preferences => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return defaultPreferences
  const { hiddenSources } = value as { hiddenSources?: unknown }
  if (!Array.isArray(hiddenSources)) return defaultPreferences
  return { hiddenSources: [...new Set(hiddenSources.filter((item): item is string => typeof item === 'string'))].sort() }
}

export const isSourceVisible = (preferences: Preferences, source: string): boolean =>
  !preferences.hiddenSources.includes(source)
