import { describe, expect, it, vi } from 'vitest'
import { Anime, DATA_VERSION, SNAPSHOT_APP } from './types'
import { createSnapshot, normalizeHistory } from './merge'
import { LOCAL_HISTORY_KEY, parseLocalHistory, readLocalSnapshot, serializeLocalHistory } from './localSnapshot'

const anime = (overrides: Partial<Anime> = {}): Anime => ({
  source: 'anime1',
  id: '29681',
  title: '暴怒千金發誓復仇。 ～憑藉魔導書之力打垮祖國～',
  timestamp: 1000,
  episode: '5b',
  episodePicUrl: '',
  animePicUrl: '',
  videoWatchTime: 10,
  videoTotalTime: 1400,
  seriesId: '1959',
  ...overrides
})

const storage = (values: Record<string, unknown>): (key: string) => unknown =>
  (key) => values[key] === undefined ? undefined : typeof values[key] === 'string' ? values[key] : JSON.stringify(values[key])

describe('serializeLocalHistory', () => {
  it('和雲端檔案一樣記錄資料版本', () => {
    const stored = JSON.parse(serializeLocalHistory({ '@shared': [anime()] }, 5))
    expect(stored).toEqual(createSnapshot({ '@shared': [anime()] }, 5))
    expect(stored.dataVersion).toBe(DATA_VERSION)
  })
})

describe('readLocalSnapshot', () => {
  it('只有 0.7.1 以前的 animeHistory（含被剝掉來源的副本）時升級合併，寫入新欄位並刪除舊欄位', () => {
    const stripped = { ...anime(), source: undefined, seriesId: undefined }
    const local = readLocalSnapshot(storage({ animeHistory: { '@shared': [anime(), stripped] } }))
    expect(local.history).toEqual(normalizeHistory({ '@shared': [anime()] }))
    expect(local).toMatchObject({ lockedBy: null, legacyKeys: ['animeHistory'], changed: true })
  })

  it('0.8.0 的 animeHistory.v2 與更舊的欄位都併進來', () => {
    const local = readLocalSnapshot(storage({
      animeHistory: { tester: [anime({ source: 'ani-gamer', title: '葬送的芙莉蓮' })] },
      'animeHistory.v2': { '@shared': [anime()] }
    }))
    expect(local.history).toEqual(normalizeHistory({ tester: [anime({ source: 'ani-gamer', title: '葬送的芙莉蓮' })], '@shared': [anime()] }))
    expect(local.legacyKeys).toEqual(['animeHistory', 'animeHistory.v2'])
  })

  it('已經有新欄位時，舊分頁後來寫出的舊欄位也會被收進來並刪除', () => {
    const current = serializeLocalHistory({ '@shared': [anime()] })
    const local = readLocalSnapshot(storage({ [LOCAL_HISTORY_KEY]: current, 'animeHistory.v2': { tester: [anime({ source: 'ani-gamer', title: 'B', timestamp: 2000 })] } }))
    expect(local.history.tester.map((item) => item.title)).toEqual(['B'])
    expect(local).toMatchObject({ legacyKeys: ['animeHistory.v2'], changed: true })
  })

  it('只有新欄位時不需要寫回', () => {
    const local = readLocalSnapshot(storage({ [LOCAL_HISTORY_KEY]: serializeLocalHistory({ '@shared': [anime()] }) }))
    expect(local).toMatchObject({ history: normalizeHistory({ '@shared': [anime()] }), lockedBy: null, legacyKeys: [], changed: false })
  })

  it('完全沒有資料時不需要寫回', () => {
    expect(readLocalSnapshot(storage({}))).toEqual({ history: {}, lockedBy: null, legacyKeys: [], changed: false })
  })

  it('本機資料由較新版本建立時鎖定：不讀取紀錄，也不動舊欄位', () => {
    const newer = { app: SNAPSHOT_APP, dataVersion: '2.1.0', schemaVersion: 3, exportedAt: 1, history: { '@shared': [anime()] } }
    const local = readLocalSnapshot(storage({ [LOCAL_HISTORY_KEY]: newer, animeHistory: { '@shared': [anime()] } }))
    expect(local).toEqual({ history: {}, lockedBy: '2.1.0', legacyKeys: [], changed: false })
  })

  it('新欄位無法解析時視為空的，舊欄位照常讀出', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const local = readLocalSnapshot(storage({ [LOCAL_HISTORY_KEY]: '{broken', animeHistory: { '@shared': [anime()] } }))
    expect(local.history).toEqual(normalizeHistory({ '@shared': [anime()] }))
    expect(local.lockedBy).toBeNull()
  })
})

describe('parseLocalHistory（其他分頁寫入時）', () => {
  it('讀出紀錄，版本太新時回報鎖定', () => {
    expect(parseLocalHistory(serializeLocalHistory({ '@shared': [anime()] }))).toEqual({ history: normalizeHistory({ '@shared': [anime()] }) })
    expect(parseLocalHistory(JSON.stringify({ app: SNAPSHOT_APP, dataVersion: '3.0.0', schemaVersion: 3, history: {} }))).toEqual({ lockedBy: '3.0.0' })
  })
})
