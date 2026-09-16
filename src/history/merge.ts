import { Anime, AnimeHistory, AnimeSource, HistorySnapshot, SNAPSHOT_APP, SNAPSHOT_SCHEMA_VERSION } from './types'
import { animeKey, DEFAULT_SOURCE, sourceOf } from './source'

// 合併規則（交換律、結合律、冪等）：
// - 觀看進度：取 timestamp 較大者
// - 最愛：取 (favoriteTime, isFavorite) 字典序較大者
// - 刪除：removeTime 取最大值；刪除後再次觀看（timestamp 較新）即視為恢復

export const isRemoved = (anime: Anime): boolean =>
  anime.removeTime != null && anime.removeTime >= anime.timestamp

const finite = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0

const text = (value: unknown): string => typeof value === 'string' ? value : ''

// 固定屬性順序並去除無意義欄位，讓 JSON.stringify 可以直接比較內容
export const normalizeAnime = (anime: Anime): Anime => {
  const source: AnimeSource = anime.source === 'anime1' ? 'anime1' : DEFAULT_SOURCE
  const normalized: Anime = {
    source,
    id: text(anime.id),
    title: text(anime.title),
    timestamp: finite(anime.timestamp),
    episode: text(anime.episode),
    episodePicUrl: text(anime.episodePicUrl),
    animePicUrl: text(anime.animePicUrl),
    videoWatchTime: finite(anime.videoWatchTime),
    videoTotalTime: finite(anime.videoTotalTime)
  }
  if (text(anime.seriesId) !== '') normalized.seriesId = text(anime.seriesId)
  const favoriteTime = finite(anime.favoriteTime)
  if (favoriteTime > 0) {
    normalized.isFavorite = anime.isFavorite === true
    normalized.favoriteTime = favoriteTime
  } else if (anime.isFavorite === true) {
    normalized.isFavorite = true
  }
  if (anime.removeTime != null && Number.isFinite(anime.removeTime)) {
    normalized.removeTime = anime.removeTime
  }
  return normalized
}

const progressKey = (anime: Anime): string =>
  JSON.stringify([anime.id, anime.episode, anime.episodePicUrl, anime.animePicUrl, anime.videoWatchTime, anime.videoTotalTime])

const pickProgress = (a: Anime, b: Anime): Anime => {
  if (a.timestamp !== b.timestamp) return a.timestamp > b.timestamp ? a : b
  return progressKey(a) >= progressKey(b) ? a : b
}

const pickFavorite = (a: Anime, b: Anime): Anime => {
  const aTime = a.favoriteTime ?? 0
  const bTime = b.favoriteTime ?? 0
  if (aTime !== bTime) return aTime > bTime ? a : b
  return a.isFavorite === true ? a : b
}

const maxRemoveTime = (a: Anime, b: Anime): number | undefined => {
  if (a.removeTime == null) return b.removeTime
  if (b.removeTime == null) return a.removeTime
  return Math.max(a.removeTime, b.removeTime)
}

export const mergeAnime = (left: Anime, right: Anime): Anime => {
  const a = normalizeAnime(left)
  const b = normalizeAnime(right)
  const progress = pickProgress(a, b)
  const favorite = pickFavorite(a, b)
  return normalizeAnime({
    ...progress,
    // 另一邊可能是較舊、還沒有 seriesId 的紀錄
    seriesId: progress.seriesId ?? a.seriesId ?? b.seriesId,
    isFavorite: favorite.isFavorite,
    favoriteTime: favorite.favoriteTime,
    removeTime: maxRemoveTime(a, b)
  })
}

const compareAnime = (a: Anime, b: Anime): number => {
  if (a.timestamp !== b.timestamp) return b.timestamp - a.timestamp
  if (a.title !== b.title) return a.title < b.title ? -1 : 1
  if (sourceOf(a) === sourceOf(b)) return 0
  return sourceOf(a) < sourceOf(b) ? -1 : 1
}

const mergeList = (lists: Anime[][]): Anime[] => {
  const byKey = new Map<string, Anime>()
  lists.flat().forEach((anime) => {
    if (anime.title === '') return // 抓不到標題的紀錄無法辨識，直接捨棄
    const key = animeKey(anime)
    const existing = byKey.get(key)
    byKey.set(key, existing === undefined ? normalizeAnime(anime) : mergeAnime(existing, anime))
  })
  return [...byKey.values()].sort(compareAnime)
}

export const mergeHistory = (...histories: AnimeHistory[]): AnimeHistory => {
  const userIds = [...new Set(histories.flatMap((history) => Object.keys(history)))].sort()
  return Object.fromEntries(userIds.map((userId) => [
    userId,
    mergeList(histories.map((history) => history[userId] ?? []))
  ]))
}

export const normalizeHistory = (history: AnimeHistory): AnimeHistory => mergeHistory(history)

export const isSameHistory = (a: AnimeHistory, b: AnimeHistory): boolean =>
  JSON.stringify(normalizeHistory(a)) === JSON.stringify(normalizeHistory(b))

export const createSnapshot = (history: AnimeHistory, exportedAt = Date.now()): HistorySnapshot => ({
  app: SNAPSHOT_APP,
  schemaVersion: SNAPSHOT_SCHEMA_VERSION,
  exportedAt,
  history: normalizeHistory(history)
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const parseAnime = (value: unknown, where: string): Anime => {
  if (!isRecord(value)) throw new Error(`${where} 不是物件`)
  if (typeof value.title !== 'string') throw new Error(`${where} 缺少 title`)
  if (typeof value.timestamp !== 'number' || !Number.isFinite(value.timestamp)) throw new Error(`${where} 缺少 timestamp`)
  return normalizeAnime(value as unknown as Anime)
}

const parseHistory = (value: unknown): AnimeHistory => {
  if (!isRecord(value)) throw new Error('history 格式錯誤')
  return normalizeHistory(Object.fromEntries(Object.entries(value).map(([userId, list]) => {
    if (!Array.isArray(list)) throw new Error(`使用者 ${userId} 的紀錄不是陣列`)
    return [userId, list.map((anime, index) => parseAnime(anime, `使用者 ${userId} 第 ${index + 1} 筆`))]
  })))
}

// 接受 HistorySnapshot，也接受舊版直接存放的 AnimeHistory
export const parseSnapshot = (value: unknown): HistorySnapshot => {
  if (isRecord(value) && value.app === SNAPSHOT_APP) {
    if (value.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) {
      throw new Error(`不支援的資料版本：${String(value.schemaVersion)}`)
    }
    return createSnapshot(parseHistory(value.history), finite(value.exportedAt))
  }
  return createSnapshot(parseHistory(value), 0)
}
