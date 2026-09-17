import { Anime, AnimeHistory, AnimeSource, HistorySnapshot, SNAPSHOT_APP, SNAPSHOT_SCHEMA_VERSION } from './types'
import { animeKey, DEFAULT_SOURCE, sourceOf } from './source'
import { upgradeHistory } from './migrations'

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
  // 不認得的來源（未來版本新增的網站）保留原名，不能改成動畫瘋，否則同步回去就會變成另一筆紀錄
  const rawSource: unknown = anime.source
  const source = (typeof rawSource === 'string' && rawSource !== '' ? rawSource : DEFAULT_SOURCE) as AnimeSource
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

// 只檢查結構，不正規化：升級轉換要看到原始的欄位
const readAnime = (value: unknown, where: string): Anime => {
  if (!isRecord(value)) throw new Error(`${where} 不是物件`)
  if (typeof value.title !== 'string') throw new Error(`${where} 缺少 title`)
  if (typeof value.timestamp !== 'number' || !Number.isFinite(value.timestamp)) throw new Error(`${where} 缺少 timestamp`)
  return value as unknown as Anime
}

const readHistory = (value: unknown): AnimeHistory => {
  if (!isRecord(value)) throw new Error('history 格式錯誤')
  return Object.fromEntries(Object.entries(value).map(([userId, list]) => {
    if (!Array.isArray(list)) throw new Error(`使用者 ${userId} 的紀錄不是陣列`)
    return [userId, list.map((anime, index) => readAnime(anime, `使用者 ${userId} 第 ${index + 1} 筆`))]
  }))
}

// 資料由較新版本的腳本建立：不能合併，否則看不懂的部分會被丟掉或改錯後寫回去
export class SchemaTooNewError extends Error {
  readonly version: number

  constructor (version: number) {
    super(`這份資料由較新版本的腳本建立（資料格式版本 ${version}），請先更新腳本`)
    this.name = 'SchemaTooNewError'
    this.version = version
  }
}

// 版本比目前高就拒絕，比目前低就升級轉換；規則見 docs/schema-version.md
const checkSchemaVersion = (version: unknown): number => {
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new Error(`不支援的資料版本：${String(version)}`)
  }
  if (version > SNAPSHOT_SCHEMA_VERSION) throw new SchemaTooNewError(version)
  return version
}

// 雲端檔案與 JSON 匯入：檢查版本與結構，有問題就丟錯
export const parseHistoryAt = (version: unknown, value: unknown): AnimeHistory => {
  const from = checkSchemaVersion(version)
  return normalizeHistory(upgradeHistory(from, readHistory(value)) as AnimeHistory)
}

// 本機儲存：只檢查版本，內容沿用正規化時的寬鬆處理，避免一筆壞資料讓整份紀錄讀不到
export const loadHistoryAt = (version: number, value: unknown): AnimeHistory => {
  const from = checkSchemaVersion(version)
  return normalizeHistory(upgradeHistory(from, value as AnimeHistory) as AnimeHistory)
}

// 接受 HistorySnapshot，也接受雲端同步之前直接存放的 AnimeHistory（視為版本 1）
export const parseSnapshot = (value: unknown): HistorySnapshot => {
  if (isRecord(value) && value.app === SNAPSHOT_APP) {
    return createSnapshot(parseHistoryAt(value.schemaVersion, value.history), finite(value.exportedAt))
  }
  return createSnapshot(parseHistoryAt(1, value), 0)
}
