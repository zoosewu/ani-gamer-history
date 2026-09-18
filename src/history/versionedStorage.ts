import { AnimeHistory, SNAPSHOT_SCHEMA_VERSION } from './types'
import { loadHistoryAt, mergeHistory } from './merge'

// 本機儲存每個資料版本用不同的欄位：舊版分頁不會檢查版本號，只會讀寫自己的欄位，因此碰不到新格式的資料。
// 版本 1 沿用原本的 animeHistory；調版號時這裡不需要修改（見 docs/schema-version.md）。
export const historyKeyOf = (version: number): string => version === 1 ? 'animeHistory' : `animeHistory.v${version}`

export const CURRENT_HISTORY_KEY = historyKeyOf(SNAPSHOT_SCHEMA_VERSION)

const parseStored = (version: number, raw: unknown): AnimeHistory => {
  if (typeof raw !== 'string') return {}
  try {
    return loadHistoryAt(version, JSON.parse(raw))
  } catch (error) {
    console.error(`Failed to parse local ${historyKeyOf(version)}`, error)
    return {}
  }
}

export const parseCurrentHistory = (raw: unknown): AnimeHistory => parseStored(SNAPSHOT_SCHEMA_VERSION, raw)

// 讀出每個版本的欄位，升級後合併。每次載入都重新合併舊欄位：合併是冪等的，
// 也能收進更新前就開著的舊分頁後來寫進舊欄位的紀錄。changed 表示需要寫回目前版本的欄位
export const readVersionedHistory = (read: (key: string) => unknown): { history: AnimeHistory, raw: string, changed: boolean } => {
  const histories = Array.from({ length: SNAPSHOT_SCHEMA_VERSION }, (_, index) => parseStored(index + 1, read(historyKeyOf(index + 1))))
  const history = mergeHistory(...histories)
  const raw = JSON.stringify(history)
  const current = read(CURRENT_HISTORY_KEY)
  return { history, raw, changed: raw !== (typeof current === 'string' ? current : '{}') }
}
