import { describe, expect, it } from 'vitest'
import { Anime, AnimeHistory } from './types'
import { createSnapshot, isRemoved, isSameHistory, mergeAnime, mergeHistory, normalizeAnime, normalizeHistory, parseSnapshot } from './merge'

const anime = (overrides: Partial<Anime> = {}): Anime => ({
  source: 'ani-gamer',
  id: '1',
  timestamp: 1000,
  title: '葬送的芙莉蓮',
  episodePicUrl: 'episode.jpg',
  animePicUrl: 'anime.jpg',
  episode: '1',
  videoWatchTime: 10,
  videoTotalTime: 1400,
  ...overrides
})

const serialize = (history: AnimeHistory): string => JSON.stringify(history)

// 可重現的亂數，用來做合併性質測試
const createRandom = (seed: number) => (): number => {
  seed = (seed * 1103515245 + 12345) % 2147483648
  return seed / 2147483648
}

const randomHistory = (random: () => number): AnimeHistory => {
  const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)]
  const history: AnimeHistory = {}
  for (const userId of ['alice', 'bob', '@shared']) {
    if (random() < 0.2) continue
    history[userId] = Array.from({ length: Math.floor(random() * 4) }, () => anime({
      title: pick(['A', 'B', 'C']),
      source: pick(['ani-gamer', 'anime1', 'future-site' as Anime['source'], undefined]),
      seriesId: pick([undefined, 's1']),
      id: pick(['1', '2']),
      episode: pick(['1', '2']),
      timestamp: pick([100, 200, 300]),
      videoWatchTime: pick([0, 50]),
      isFavorite: pick([undefined, true, false]),
      favoriteTime: pick([undefined, 150, 250]),
      removeTime: pick([undefined, 150, 250, 350])
    }))
  }
  return history
}

describe('isRemoved', () => {
  it('沒有 removeTime 時不算刪除', () => {
    expect(isRemoved(anime())).toBe(false)
  })

  it('removeTime 不早於最後觀看時間時算刪除', () => {
    expect(isRemoved(anime({ timestamp: 100, removeTime: 100 }))).toBe(true)
    expect(isRemoved(anime({ timestamp: 100, removeTime: 200 }))).toBe(true)
  })

  it('刪除後又重新觀看時恢復顯示', () => {
    expect(isRemoved(anime({ timestamp: 300, removeTime: 200 }))).toBe(false)
  })
})

describe('normalizeAnime', () => {
  it('去掉舊版的 isFavorite: false，並把非有限數字轉成 0', () => {
    expect(normalizeAnime(anime({ isFavorite: false, videoTotalTime: NaN }))).toEqual(anime({ videoTotalTime: 0 }))
  })

  it('屬性順序固定', () => {
    const shuffled = { removeTime: 5, videoTotalTime: 1, title: 'X', favoriteTime: 3, isFavorite: true, id: '9', timestamp: 1, episode: '2', animePicUrl: 'a', episodePicUrl: 'e', videoWatchTime: 0, seriesId: 's1', source: 'anime1' as const }
    expect(Object.keys(normalizeAnime(shuffled))).toEqual([
      'source', 'id', 'title', 'timestamp', 'episode', 'episodePicUrl', 'animePicUrl', 'videoWatchTime', 'videoTotalTime', 'seriesId', 'isFavorite', 'favoriteTime', 'removeTime'
    ])
  })
})

describe('mergeAnime', () => {
  it('觀看進度取較新的，最愛狀態保留另一邊較新的設定', () => {
    const watchedLater = anime({ timestamp: 2000, episode: '5' })
    const favorited = anime({ timestamp: 1000, isFavorite: true, favoriteTime: 1500 })
    expect(mergeAnime(watchedLater, favorited)).toEqual(anime({ timestamp: 2000, episode: '5', isFavorite: true, favoriteTime: 1500 }))
  })

  it('較晚的取消最愛會蓋過較早的加入最愛', () => {
    const favorited = anime({ isFavorite: true, favoriteTime: 100 })
    const unfavorited = anime({ isFavorite: false, favoriteTime: 200 })
    expect(mergeAnime(favorited, unfavorited).isFavorite).toBe(false)
  })

  it('有時間的最愛設定優先於舊版沒有時間的最愛', () => {
    const legacy = anime({ isFavorite: true })
    const unfavorited = anime({ isFavorite: false, favoriteTime: 100 })
    expect(mergeAnime(legacy, unfavorited).isFavorite).toBe(false)
  })

  it('A 刪除後 B 又看了，合併結果恢復顯示', () => {
    const removed = anime({ timestamp: 1000, removeTime: 1500 })
    const rewatched = anime({ timestamp: 2000 })
    expect(isRemoved(mergeAnime(removed, rewatched))).toBe(false)
  })

  it('B 的觀看早於 A 的刪除，合併結果維持刪除', () => {
    const removed = anime({ timestamp: 1000, removeTime: 3000 })
    const watched = anime({ timestamp: 2000 })
    expect(isRemoved(mergeAnime(removed, watched))).toBe(true)
  })
})

describe('mergeHistory', () => {
  it('合併不同使用者、依標題去重、依時間由新到舊排序', () => {
    const local: AnimeHistory = { alice: [anime({ title: 'A', timestamp: 100 }), anime({ title: 'B', timestamp: 300 })] }
    const remote: AnimeHistory = { alice: [anime({ title: 'A', timestamp: 200 })], bob: [anime({ title: 'C' })] }
    const merged = mergeHistory(local, remote)
    expect(Object.keys(merged)).toEqual(['alice', 'bob'])
    expect(merged.alice.map((item) => [item.title, item.timestamp])).toEqual([['B', 300], ['A', 200]])
    expect(merged.bob).toHaveLength(1)
  })

  it('同名但不同來源是兩筆完全獨立的紀錄', () => {
    const gamer = anime({ title: '詐欺遊戲', episode: '3', timestamp: 200 })
    const anime1 = anime({ title: '詐欺遊戲', episode: '20', timestamp: 100, source: 'anime1', seriesId: '1898', id: '30152' })
    const merged = mergeHistory({ tester: [gamer] }, { tester: [anime1] })
    expect(merged.tester).toHaveLength(2)
    expect(merged.tester.map((item) => [item.source, item.episode])).toEqual([['ani-gamer', '3'], ['anime1', '20']])
  })

  it('舊資料沒有 source 時視為動畫瘋，會和動畫瘋的紀錄合併成一筆', () => {
    const legacy = { ...anime({ timestamp: 100 }), source: undefined }
    const current = anime({ timestamp: 200, episode: '9' })
    const merged = mergeHistory({ tester: [legacy] }, { tester: [current] })
    expect(merged.tester).toHaveLength(1)
    expect(merged.tester[0]).toEqual(anime({ timestamp: 200, episode: '9' }))
  })

  it('較舊的紀錄沒有 seriesId 時沿用另一邊的', () => {
    const older = anime({ source: 'anime1', timestamp: 100, seriesId: '1898' })
    const newer = { ...anime({ source: 'anime1', timestamp: 200 }), seriesId: undefined }
    expect(mergeHistory({ tester: [older] }, { tester: [newer] }).tester[0].seriesId).toBe('1898')
  })

  it('捨棄沒有標題的紀錄', () => {
    expect(mergeHistory({ alice: [anime({ title: '' })] })).toEqual({ alice: [] })
  })

  it('滿足交換律、結合律與冪等', () => {
    const random = createRandom(42)
    for (let i = 0; i < 500; i++) {
      const a = randomHistory(random)
      const b = randomHistory(random)
      const c = randomHistory(random)
      expect(serialize(mergeHistory(a, b))).toBe(serialize(mergeHistory(b, a)))
      expect(serialize(mergeHistory(mergeHistory(a, b), c))).toBe(serialize(mergeHistory(a, mergeHistory(b, c))))
      expect(serialize(mergeHistory(a, a))).toBe(serialize(normalizeHistory(a)))
      expect(serialize(mergeHistory(a, mergeHistory(a, b)))).toBe(serialize(mergeHistory(a, b)))
    }
  })
})

describe('isSameHistory', () => {
  it('忽略陣列與屬性順序', () => {
    const a: AnimeHistory = { alice: [anime({ title: 'A', timestamp: 1 }), anime({ title: 'B', timestamp: 2 })] }
    const b: AnimeHistory = { alice: [anime({ title: 'B', timestamp: 2 }), anime({ title: 'A', timestamp: 1, isFavorite: false })] }
    expect(isSameHistory(a, b)).toBe(true)
  })

  it('內容不同時回傳 false', () => {
    expect(isSameHistory({ alice: [anime()] }, { alice: [anime({ episode: '2' })] })).toBe(false)
  })
})

describe('parseSnapshot', () => {
  it('JSON 來回轉換後內容不變（含中文）', () => {
    const snapshot = createSnapshot({ 使用者: [anime({ isFavorite: true, favoriteTime: 5, removeTime: 1 })] }, 123)
    expect(parseSnapshot(JSON.parse(JSON.stringify(snapshot)))).toEqual(snapshot)
  })

  it('接受舊版直接存放的 AnimeHistory', () => {
    const legacy = { alice: [anime({ isFavorite: false })] }
    expect(parseSnapshot(legacy)).toEqual(createSnapshot({ alice: [anime()] }, 0))
  })

  it('拒絕不支援的資料版本', () => {
    expect(() => parseSnapshot({ app: 'ani-gamer-history', schemaVersion: 99, history: {} })).toThrow('不支援的資料版本')
  })

  it('拒絕格式錯誤的資料', () => {
    expect(() => parseSnapshot('not json object')).toThrow()
    expect(() => parseSnapshot({ alice: 'oops' })).toThrow('不是陣列')
    expect(() => parseSnapshot({ alice: [{ title: 'A' }] })).toThrow('timestamp')
    expect(() => parseSnapshot({ alice: [null] })).toThrow('不是物件')
  })
})

describe('舊版剝掉來源欄位的副本', () => {
  // 回報的真實資料：同一筆 anime1 紀錄被 0.5.0 以前的版本剝掉 source 與 seriesId 後同步回來
  const stripped: Anime = { source: 'ani-gamer', id: '29681', title: '暴怒千金發誓復仇。 ～憑藉魔導書之力打垮祖國～', timestamp: 1789615380421, episode: '5b', episodePicUrl: '', animePicUrl: '', videoWatchTime: 1.203466, videoTotalTime: 1425.024 }
  const original: Anime = { ...stripped, source: 'anime1', seriesId: '1959' }

  it('回報的重複資料合併回一筆 anime1 紀錄', () => {
    expect(normalizeHistory({ '@shared': [stripped, original] })['@shared']).toEqual([normalizeAnime(original)])
  })

  it('完全沒有 source 欄位的副本（0.5.0 寫回的原始樣子）也會合併', () => {
    const legacy = { ...stripped, source: undefined }
    expect(mergeHistory({ '@shared': [original] }, { '@shared': [legacy] })['@shared']).toEqual([normalizeAnime(original)])
  })

  it('副本的進度比較新時保留較新的進度，seriesId 從另一筆補回', () => {
    const newer = { ...stripped, source: undefined, timestamp: stripped.timestamp + 60000, videoWatchTime: 300 }
    const merged = mergeHistory({ '@shared': [original] }, { '@shared': [newer] })['@shared']
    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({ source: 'anime1', seriesId: '1959', videoWatchTime: 300, timestamp: newer.timestamp })
  })

  it('只修復不綁使用者的 bucket，使用者 bucket 裡的動畫瘋紀錄不受影響', () => {
    expect(normalizeHistory({ tester: [stripped] }).tester[0].source).toBe('ani-gamer')
  })
})

describe('不認得的來源', () => {
  it('保留原本的名稱，不會被改成動畫瘋', () => {
    expect(normalizeAnime(anime({ source: 'future-site' as Anime['source'] })).source).toBe('future-site')
  })

  it('和同名的 anime1 紀錄各自獨立', () => {
    const merged = mergeHistory({ '@shared': [anime({ source: 'anime1', title: 'X' }), anime({ source: 'future-site' as Anime['source'], title: 'X' })] })
    expect(merged['@shared'].map((item) => item.source)).toEqual(['anime1', 'future-site'])
  })
})
