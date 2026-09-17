export type AnimeSource = 'ani-gamer' | 'anime1'

export interface Anime {
  id: string
  timestamp: number
  title: string
  episodePicUrl: string
  animePicUrl: string
  episode: string
  videoWatchTime: number
  videoTotalTime: number
  // 來源，舊資料沒有這個欄位時一律視為動畫瘋
  source?: AnimeSource
  // anime1 的系列 id，用來在列表頁比對
  seriesId?: string
  removeTime?: number
  isFavorite?: boolean
  favoriteTime?: number
}

export interface AnimeHistory {
  [bucket: string]: Anime[]
}

// anime1 沒有會員系統，紀錄放在這個 bucket，不綁定使用者，登入與否都看得到
export const SHARED_BUCKET = '@shared'

export const SNAPSHOT_APP = 'ani-gamer-history'
// 資料格式版本：資料格式或合併規則一有變動就要加 1，規則見 docs/schema-version.md
export const SNAPSHOT_SCHEMA_VERSION = 2

export interface HistorySnapshot {
  app: typeof SNAPSHOT_APP
  schemaVersion: typeof SNAPSHOT_SCHEMA_VERSION
  exportedAt: number
  history: AnimeHistory
}
