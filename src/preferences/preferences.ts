export const PREFERENCES_KEY = 'preferences'

// 每台電腦自己的顯示偏好，和「自動同步」一樣不上傳到雲端；只影響畫面，仍會繼續記錄與同步
export interface Preferences {
  // 不在動畫瘋首頁清單顯示的來源
  hiddenSources: string[]
  // 不在該網站頁面上畫「上次觀看」標記的來源
  hiddenMarkers: string[]
}

export const defaultPreferences: Preferences = { hiddenSources: [], hiddenMarkers: [] }

// 各欄位分別容錯，一個欄位格式不對不會連帶清掉其他設定
const parseSources = (value: unknown): string[] =>
  Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === 'string'))].sort() : []

export const parsePreferences = (value: unknown): Preferences => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return defaultPreferences
  const { hiddenSources, hiddenMarkers } = value as { hiddenSources?: unknown, hiddenMarkers?: unknown }
  return { hiddenSources: parseSources(hiddenSources), hiddenMarkers: parseSources(hiddenMarkers) }
}

export const isSourceVisible = (preferences: Preferences, source: string): boolean =>
  !preferences.hiddenSources.includes(source)

export const isMarkerVisible = (preferences: Preferences, source: string): boolean =>
  !preferences.hiddenMarkers.includes(source)
