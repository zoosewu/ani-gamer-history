import { describe, expect, it } from 'vitest'
import { Anime, AnimeHistory, SNAPSHOT_APP } from '../types'
import { createSnapshot, loadSnapshotHistory, mergeHistory, normalizeHistory, parseSnapshot } from '../merge'
import { CURRENT_DATA_VERSION, DataVersion, formatDataVersion, legacySchemaVersion, parseDataVersion } from '../dataVersion'
import { animeKey } from '../source'
import { bucketOf, currentFixture, fullAnime } from './fixtures'
import { loadReleases, ReleasedHistory } from './releases'
import { v1 } from './v1'

// 已發佈版本與目前程式碼的相容性測試，規則見 docs/schema-version.md

interface FrozenFixture {
  version: string // 這份資料的資料版本
  history: unknown
  upgradedVersion: string // upgraded 的資料版本（下一個 MAJOR 或 MINOR）
  upgraded: unknown
}

// 每個舊的 MAJOR.MINOR 一份凍結的測試資料；調資料版本時要為舊版本加一份
const frozenFixtures: FrozenFixture[] = [v1]

const minorKey = ({ major, minor }: DataVersion): string => `${major}.${minor}`
const compareMinor = (a: DataVersion, b: DataVersion): number => a.major !== b.major ? a.major - b.major : a.minor - b.minor
const version = (text: string): DataVersion => {
  const parsed = parseDataVersion(text)
  if (parsed === null) throw new Error(`資料版本格式錯誤：${text}`)
  return parsed
}

const json = <T>(value: T): T => JSON.parse(JSON.stringify(value))

// 用指定的資料版本包成 snapshot；schemaVersion 是那個版本的腳本會寫出的整數（1.x 寫 1）
const snapshotAt = (dataVersion: DataVersion, history: unknown): unknown => ({
  app: SNAPSHOT_APP,
  dataVersion: formatDataVersion(dataVersion),
  schemaVersion: dataVersion.major === 1 ? 1 : legacySchemaVersion(dataVersion),
  exportedAt: 1,
  history
})

const keysOf = (history: AnimeHistory): Record<string, string[]> =>
  Object.fromEntries(Object.entries(history).map(([bucket, list]) => [bucket, list.map(animeKey).sort()]))

const fixtureFor = (dataVersion: DataVersion): FrozenFixture => {
  const fixture = frozenFixtures.find((item) => minorKey(version(item.version)) === minorKey(dataVersion))
  if (fixture === undefined) throw new Error(`缺少資料版本 ${minorKey(dataVersion)} 的凍結測試資料（src/history/compat/）`)
  return fixture
}

// 升級到目前版本後應有的內容：upgraded 是下一個版本的資料，剩下的版本交給目前的程式碼升級
const expectedUpgrade = (fixture: FrozenFixture): AnimeHistory =>
  parseSnapshot(snapshotAt(version(fixture.upgradedVersion), fixture.upgraded)).history

const releases = await loadReleases()
const byTag = (list: ReleasedHistory[]): Array<[string, ReleasedHistory]> => list.map((release) => [`${release.tag}（資料版本 ${formatDataVersion(release.dataVersion)}）`, release])

describe('已發佈版本', () => {
  it('至少有一個 tag，而且資料版本都不比目前程式碼新', () => {
    expect(releases.length).toBeGreaterThan(0)
    releases.forEach((release) => {
      expect(compareMinor(release.dataVersion, CURRENT_DATA_VERSION), `${release.tag} 的資料版本比目前程式碼新`).toBeLessThanOrEqual(0)
    })
  })
})

describe.each(frozenFixtures.map((fixture): [string, FrozenFixture] => [fixture.version, fixture]))('凍結的資料版本 %s', (_version, fixture) => {
  it('目前版本升級後的內容正確', () => {
    expect(parseSnapshot(snapshotAt(version(fixture.version), fixture.history)).history).toEqual(expectedUpgrade(fixture))
  })
})

describe.each(byTag(releases.filter((release) => compareMinor(release.dataVersion, CURRENT_DATA_VERSION) < 0)))('%s：較舊的資料版本', (_tag, release) => {
  it('拒絕讀取目前版本的資料，不會合併後寫回', () => {
    const snapshot = json(createSnapshot(currentFixture(), 1))
    expect(() => release.parseSnapshot(snapshot)).toThrow()
  })

  it('目前版本能升級這個版本寫出的資料，不會重複或遺失', () => {
    const fixture = fixtureFor(release.dataVersion)
    const expected = expectedUpgrade(fixture)
    const written = json(release.createSnapshot(release.parseSnapshot(json(snapshotAt(version(fixture.version), fixture.history))).history, 1))
    const upgraded = parseSnapshot(written).history
    // 紀錄的來源與分區正確，沒有多出副本
    expect(keysOf(upgraded)).toEqual(keysOf(expected))
    // 這個版本丟掉的欄位（例如 0.5.0 丟掉 seriesId），和原始資料合併後會完整補回
    expect(mergeHistory(upgraded, expected)).toEqual(expected)
  })
})

describe.each(byTag(releases.filter((release) => compareMinor(release.dataVersion, CURRENT_DATA_VERSION) === 0)))('%s：相同的資料版本', (_tag, release) => {
  it('目前版本的資料經過這個版本讀寫後完全相同', () => {
    const snapshot = createSnapshot(currentFixture(), 1)
    const written = json(release.createSnapshot(release.parseSnapshot(json(snapshot)).history, 1))
    expect(parseSnapshot(written)).toEqual(snapshot)
  })

  it('本機儲存經過這個版本正規化後完全相同', () => {
    const history = normalizeHistory(currentFixture())
    expect(loadSnapshotHistory(snapshotAt(CURRENT_DATA_VERSION, json(release.normalizeHistory(json(history)))))).toEqual(history)
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
