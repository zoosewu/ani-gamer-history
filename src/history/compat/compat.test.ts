import { describe, expect, it } from 'vitest'
import { Anime, AnimeHistory, SNAPSHOT_APP, SNAPSHOT_SCHEMA_VERSION } from '../types'
import { createSnapshot, loadHistoryAt, mergeHistory, normalizeHistory, parseSnapshot } from '../merge'
import { animeKey } from '../source'
import { bucketOf, currentFixture, fullAnime } from './fixtures'
import { loadReleases } from './releases'
import { v1 } from './v1'

// 已發佈版本與目前程式碼的相容性測試，規則見 docs/schema-version.md

// 每個舊版本號一份凍結的測試資料；調版號時要為舊版本號加一份
const frozenFixtures: Record<number, { history: unknown, upgraded: unknown } | undefined> = {
  1: v1
}

const json = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const snapshotAt = (schemaVersion: number, history: unknown): unknown => ({ app: SNAPSHOT_APP, schemaVersion, exportedAt: 1, history })

const keysOf = (history: AnimeHistory): Record<string, string[]> =>
  Object.fromEntries(Object.entries(history).map(([bucket, list]) => [bucket, list.map(animeKey).sort()]))

// 升級到目前版本後應有的內容：凍結的 upgraded 是「下一個版本號」的資料，再交給目前的程式碼升級剩下的版本
const expectedUpgrade = (version: number): AnimeHistory => {
  const fixture = frozenFixtures[version]
  if (fixture === undefined) throw new Error(`缺少資料版本 ${version} 的凍結測試資料（src/history/compat/）`)
  return parseSnapshot(snapshotAt(version + 1, fixture.upgraded)).history
}

const releases = await loadReleases()

describe('已發佈版本', () => {
  it('至少有一個 tag，而且版本號都不比目前程式碼新', () => {
    expect(releases.length).toBeGreaterThan(0)
    releases.forEach((release) => {
      expect(release.SNAPSHOT_SCHEMA_VERSION, `${release.tag} 的資料版本比目前程式碼新`).toBeLessThanOrEqual(SNAPSHOT_SCHEMA_VERSION)
    })
  })
})

describe.each(Array.from({ length: SNAPSHOT_SCHEMA_VERSION - 1 }, (_, index) => index + 1))('凍結的資料版本 %i', (version) => {
  it('目前版本升級後的內容正確', () => {
    const fixture = frozenFixtures[version]
    expect(parseSnapshot(snapshotAt(version, fixture?.history)).history).toEqual(expectedUpgrade(version))
  })
})

const byTag = (list: typeof releases): Array<[string, (typeof releases)[number]]> => list.map((release) => [release.tag, release])

describe.each(byTag(releases.filter((release) => release.SNAPSHOT_SCHEMA_VERSION < SNAPSHOT_SCHEMA_VERSION)))('%s（較舊的資料版本）', (_tag, release) => {
  const version = release.SNAPSHOT_SCHEMA_VERSION

  it('拒絕讀取目前版本的資料，不會合併後寫回', () => {
    const snapshot = json(createSnapshot(currentFixture(), 1))
    expect(() => release.parseSnapshot(snapshot)).toThrow()
  })

  it('目前版本能升級這個版本寫出的資料，不會重複或遺失', () => {
    const expected = expectedUpgrade(version)
    const written = json(release.createSnapshot(release.parseSnapshot(json(snapshotAt(version, frozenFixtures[version]?.history))).history, 1))
    const upgraded = parseSnapshot(written).history
    // 紀錄的來源與分區正確，沒有多出副本
    expect(keysOf(upgraded)).toEqual(keysOf(expected))
    // 這個版本丟掉的欄位（例如 0.5.0 丟掉 seriesId），和原始資料合併後會完整補回
    expect(mergeHistory(upgraded, expected)).toEqual(expected)
  })
})

describe.each(byTag(releases.filter((release) => release.SNAPSHOT_SCHEMA_VERSION === SNAPSHOT_SCHEMA_VERSION)))('%s（相同的資料版本）', (_tag, release) => {
  it('目前版本的資料經過這個版本讀寫後完全相同', () => {
    const snapshot = createSnapshot(currentFixture(), 1)
    const written = json(release.createSnapshot(release.parseSnapshot(json(snapshot)).history, 1))
    expect(parseSnapshot(written)).toEqual(snapshot)
  })

  it('本機儲存經過這個版本正規化後完全相同', () => {
    const history = normalizeHistory(currentFixture())
    expect(loadHistoryAt(SNAPSHOT_SCHEMA_VERSION, json(release.normalizeHistory(json(history))))).toEqual(history)
  })

  it('和目前版本輪流更新、同步多輪，不會重複或遺失', () => {
    const progress = (anime: Anime, round: number, offset: number): AnimeHistory => ({
      [bucketOf[anime.source ?? 'ani-gamer']]: [{ ...anime, timestamp: anime.timestamp + round * 1000 + offset, videoWatchTime: round * 60 + offset }]
    })
    let expected = normalizeHistory(currentFixture())
    let ours = expected
    let theirs = release.normalizeHistory(json(ours))
    for (let round = 1; round <= 5; round++) {
      // 目前版本更新動畫瘋的紀錄，已發佈版本更新 anime1 的紀錄，再互相同步
      const ourUpdate = progress(fullAnime['ani-gamer'], round, 1)
      const theirUpdate = progress(fullAnime.anime1, round, 2)
      ours = mergeHistory(ours, ourUpdate)
      theirs = release.mergeHistory(theirs, json(ours), json(theirUpdate))
      ours = mergeHistory(ours, parseSnapshot(json(release.createSnapshot(theirs, round))).history)
      expected = mergeHistory(expected, ourUpdate, theirUpdate)
      expect(ours, `第 ${round} 輪`).toEqual(expected)
    }
  })
})
