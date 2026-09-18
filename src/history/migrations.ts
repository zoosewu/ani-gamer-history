import { CURRENT_DATA_VERSION } from './dataVersion'

// 資料格式的升級轉換：migrations[N] 把 MAJOR 版本 N 的資料轉成 N + 1（MINOR、PATCH 不需要轉換）。
// 每段轉換寫好後就凍結，不要修改，也不要 import 之後可能改變的 helper；規則見 docs/schema-version.md。

type StoredHistory = Record<string, unknown>
type Migration = (history: StoredHistory) => StoredHistory

// 1.x → 2.0.0
// 版本 1 的資料只可能由 0.4.0～0.7.1 寫出，來源只有動畫瘋（使用者 id 分區）與 anime1（'@shared' 分區）。
// 0.5.0 以前的版本會丟掉 source / seriesId，把 anime1 紀錄寫回成沒有來源的副本，0.6.0～0.7.1 讀到後會補成 'ani-gamer'。
// 所以 '@shared' 裡沒有來源或來源是 'ani-gamer' 的紀錄都是 anime1 紀錄；改回來後會和原本那筆合併，seriesId 也會從另一邊補回。
const migrateV1ToV2: Migration = (history) => Object.fromEntries(Object.entries(history).map(([bucket, list]) => [
  bucket,
  bucket === '@shared' && Array.isArray(list) ? list.map(restoreAnime1Source) : list
]))

const restoreAnime1Source = (anime: unknown): unknown => {
  if (typeof anime !== 'object' || anime === null) return anime
  const { source } = anime as { source?: unknown }
  return typeof source === 'string' && source !== '' && source !== 'ani-gamer' ? anime : { ...anime, source: 'anime1' }
}

export const migrations: Record<number, Migration | undefined> = {
  1: migrateV1ToV2
}

export const upgradeHistory = (fromMajor: number, history: StoredHistory): StoredHistory => {
  let upgraded = history
  for (let version = fromMajor; version < CURRENT_DATA_VERSION.major; version++) {
    const migrate = migrations[version]
    if (migrate === undefined) throw new Error(`缺少資料版本 ${version} → ${version + 1} 的升級轉換`)
    upgraded = migrate(upgraded)
  }
  return upgraded
}
