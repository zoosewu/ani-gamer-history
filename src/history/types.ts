export interface Anime {
  id: string
  timestamp: number
  title: string
  episodePicUrl: string
  animePicUrl: string
  episode: string
  videoWatchTime: number
  videoTotalTime: number
  removeTime?: number
  isFavorite?: boolean
  favoriteTime?: number
}

export interface AnimeHistory {
  [userId: string]: Anime[]
}

export const SNAPSHOT_APP = 'ani-gamer-history'
export const SNAPSHOT_SCHEMA_VERSION = 1

export interface HistorySnapshot {
  app: typeof SNAPSHOT_APP
  schemaVersion: typeof SNAPSHOT_SCHEMA_VERSION
  exportedAt: number
  history: AnimeHistory
}
