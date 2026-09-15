import { describe, expect, it } from 'vitest'
import { Anime, AnimeHistory } from './types'
import { createSnapshot, isRemoved, isSameHistory, mergeAnime, mergeHistory, normalizeAnime, normalizeHistory, parseSnapshot } from './merge'

const anime = (overrides: Partial<Anime> = {}): Anime => ({
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
  for (const userId of ['alice', 'bob']) {
    if (random() < 0.2) continue
    history[userId] = Array.from({ length: Math.floor(random() * 4) }, () => anime({
      title: pick(['A', 'B', 'C']),
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
    const shuffled = { removeTime: 5, videoTotalTime: 1, title: 'X', favoriteTime: 3, isFavorite: true, id: '9', timestamp: 1, episode: '2', animePicUrl: 'a', episodePicUrl: 'e', videoWatchTime: 0 }
    expect(Object.keys(normalizeAnime(shuffled))).toEqual([
      'id', 'title', 'timestamp', 'episode', 'episodePicUrl', 'animePicUrl', 'videoWatchTime', 'videoTotalTime', 'isFavorite', 'favoriteTime', 'removeTime'
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
