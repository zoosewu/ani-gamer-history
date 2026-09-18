import { AnimeHistory } from './types'
import { createSnapshot, loadHistoryAt, loadSnapshotHistory, mergeHistory, SchemaTooNewError } from './merge'
import { DataVersion } from './dataVersion'

// 本機只存一份資料，格式和雲端檔案相同（含資料版本）。之後調資料版本時欄位名稱不變，
// 版本太新的資料一律拒絕使用（見 docs/schema-version.md）
export const LOCAL_HISTORY_KEY = 'history'

// 0.8.0 以前的欄位：讀出來升級後併進 LOCAL_HISTORY_KEY，再刪掉
export const LEGACY_KEYS: ReadonlyArray<{ key: string, version: DataVersion }> = [
  { key: 'animeHistory', version: { major: 1, minor: 0, patch: 0 } },
  { key: 'animeHistory.v2', version: { major: 2, minor: 0, patch: 0 } }
]

export interface LocalHistory {
  history: AnimeHistory
  // 本機資料由較新版本的腳本建立時記下它的資料版本，此時不讀、不寫本機資料
  lockedBy: string | null
  // 已經併進來、可以刪除的舊欄位
  legacyKeys: string[]
  // 需要把 history 寫回 LOCAL_HISTORY_KEY
  changed: boolean
}

type ParseResult = { history: AnimeHistory } | { lockedBy: string }

const parseStored = (raw: unknown, load: (value: unknown) => AnimeHistory, key: string): ParseResult => {
  if (typeof raw !== 'string') return { history: {} }
  try {
    return { history: load(JSON.parse(raw)) }
  } catch (error) {
    if (error instanceof SchemaTooNewError) return { lockedBy: error.version }
    console.error(`Failed to parse local ${key}`, error)
    return { history: {} }
  }
}

// 解析 LOCAL_HISTORY_KEY 的內容，其他分頁寫入時也用這個
export const parseLocalHistory = (raw: unknown): ParseResult => parseStored(raw, loadSnapshotHistory, LOCAL_HISTORY_KEY)

export const serializeLocalHistory = (history: AnimeHistory, now = Date.now()): string => JSON.stringify(createSnapshot(history, now))

export const readLocalSnapshot = (read: (key: string) => unknown): LocalHistory => {
  const current = parseLocalHistory(read(LOCAL_HISTORY_KEY))
  // 本機資料比腳本新：舊欄位也不動，交給新版本的腳本處理
  if ('lockedBy' in current) return { history: {}, lockedBy: current.lockedBy, legacyKeys: [], changed: false }

  const legacy = LEGACY_KEYS.filter(({ key }) => typeof read(key) === 'string')
  const histories = legacy.map(({ key, version }) => {
    const parsed = parseStored(read(key), (value) => loadHistoryAt(version, value), key)
    return 'history' in parsed ? parsed.history : {}
  })
  return {
    history: mergeHistory(current.history, ...histories),
    lockedBy: null,
    legacyKeys: legacy.map(({ key }) => key),
    changed: legacy.length > 0
  }
}
