import { describe, expect, it, vi } from 'vitest'
import { Anime, AnimeHistory, SNAPSHOT_SCHEMA_VERSION } from './types'
import { normalizeHistory } from './merge'
import { CURRENT_HISTORY_KEY, historyKeyOf, parseCurrentHistory, readVersionedHistory } from './versionedStorage'

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

const storage = (values: Record<string, AnimeHistory | string>): (key: string) => unknown =>
  (key) => typeof values[key] === 'string' ? values[key] : values[key] === undefined ? undefined : JSON.stringify(values[key])

describe('historyKeyOf', () => {
  it('版本 1 沿用舊欄位，之後每個版本各自一個欄位', () => {
    expect(historyKeyOf(1)).toBe('animeHistory')
    expect(historyKeyOf(2)).toBe('animeHistory.v2')
    expect(CURRENT_HISTORY_KEY).toBe(historyKeyOf(SNAPSHOT_SCHEMA_VERSION))
  })
})

describe('readVersionedHistory', () => {
  it('只有舊欄位時升級後讀出，並要求寫回目前版本的欄位', () => {
    // 更新前的本機資料：含 0.5.0 以前剝掉來源的 anime1 副本
    const stripped = { ...anime(), source: undefined, seriesId: undefined }
    const result = readVersionedHistory(storage({ animeHistory: { '@shared': [anime(), stripped] } }))
    expect(result.history).toEqual(normalizeHistory({ '@shared': [anime()] }))
    expect(result.changed).toBe(true)
    expect(JSON.parse(result.raw)).toEqual(result.history)
  })

  it('舊欄位後來又被舊版分頁寫入時，新紀錄會合併進來', () => {
    const current = normalizeHistory({ '@shared': [anime()] })
    const older = { tester: [anime({ source: 'ani-gamer', title: '葬送的芙莉蓮', timestamp: 2000 })] }
    const result = readVersionedHistory(storage({ [CURRENT_HISTORY_KEY]: current, animeHistory: older }))
    expect(result.history).toEqual(normalizeHistory({ ...current, ...older }))
    expect(result.changed).toBe(true)
  })

  it('舊欄位的內容都已合併過時不需要寫回', () => {
    const current = normalizeHistory({ '@shared': [anime({ timestamp: 5000, removeTime: 5000 })] })
    // 舊欄位還留著刪除前的紀錄：合併後維持刪除，不會復活
    const result = readVersionedHistory(storage({ [CURRENT_HISTORY_KEY]: current, animeHistory: { '@shared': [anime()] } }))
    expect(result.history).toEqual(current)
    expect(result.changed).toBe(false)
  })

  it('完全沒有資料時不需要寫回', () => {
    expect(readVersionedHistory(storage({}))).toEqual({ history: {}, raw: '{}', changed: false })
  })

  it('某個欄位無法解析時略過它，其他欄位照常讀出', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const current = normalizeHistory({ '@shared': [anime()] })
    const result = readVersionedHistory(storage({ [CURRENT_HISTORY_KEY]: current, animeHistory: '{broken' }))
    expect(result.history).toEqual(current)
  })
})

describe('parseCurrentHistory', () => {
  it('以目前版本解析，不套用舊版本的轉換', () => {
    const history = { '@shared': [anime({ source: 'ani-gamer' })] }
    expect(parseCurrentHistory(JSON.stringify(history))['@shared'][0].source).toBe('ani-gamer')
  })
})
