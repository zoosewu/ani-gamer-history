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
// 資料版本（語意化版號），和腳本版本無關；資料格式或合併規則一有變動就要調，規則見 docs/schema-version.md
export const DATA_VERSION = '2.0.0'

// 雲端檔案、匯出的 JSON、本機儲存都是這個格式
export interface HistorySnapshot {
  app: typeof SNAPSHOT_APP
  dataVersion: string
  // 給 0.8.0 以前的腳本看的整數版本，新腳本只看 dataVersion
  schemaVersion: number
  exportedAt: number
  history: AnimeHistory
}
