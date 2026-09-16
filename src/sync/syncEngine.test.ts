import { describe, expect, it } from 'vitest'
import { Anime, AnimeHistory, HistorySnapshot } from '@/history/types'
import { createSnapshot, mergeHistory } from '@/history/merge'
import { ConflictError, HistoryAdapter } from './adapter'
import { createSingleFlight, pullFrom, pushTo, syncWith, SyncDeps } from './syncEngine'

const anime = (title: string, timestamp: number): Anime => ({
  id: '1', timestamp, title, episodePicUrl: '', animePicUrl: '', episode: '1', videoWatchTime: 0, videoTotalTime: 0
})

const createLocal = (initial: AnimeHistory): SyncDeps & { history: AnimeHistory } => {
  const local = {
    history: mergeHistory(initial),
    getHistory: () => local.history,
    applyHistory: (history: AnimeHistory) => { local.history = mergeHistory(local.history, history) },
    now: () => 42
  }
  return local
}

// 記憶體中的 adapter，可以模擬其他裝置在 load 與 save 之間寫入
const createMemoryAdapter = (initial: HistorySnapshot | null, beforeSave: Array<(stored: HistorySnapshot | null) => HistorySnapshot | null> = []): HistoryAdapter & { stored: HistorySnapshot | null, loads: number, saves: number } => {
  let loadedVersion = 0
  let version = 0
  const adapter = {
    stored: initial,
    loads: 0,
    saves: 0,
    load: async () => {
      adapter.loads++
      loadedVersion = version
      return adapter.stored
    },
    save: async (snapshot: HistorySnapshot) => {
      adapter.saves++
      const intercept = beforeSave.shift()
      if (intercept !== undefined) {
        adapter.stored = intercept(adapter.stored)
        version++
      }
      if (loadedVersion !== version) throw new ConflictError()
      adapter.stored = snapshot
      version++
    }
  }
  return adapter
}

describe('pullFrom / pushTo', () => {
  it('pullFrom 合併讀到的資料；沒有資料時回傳 false', async () => {
    const local = createLocal({ alice: [anime('A', 1)] })
    expect(await pullFrom(createMemoryAdapter(null), local)).toBe(false)
    expect(await pullFrom(createMemoryAdapter(createSnapshot({ alice: [anime('B', 2)] })), local)).toBe(true)
    expect(local.history.alice.map((item) => item.title)).toEqual(['B', 'A'])
  })

  it('pushTo 寫出本機整份資料', async () => {
    const local = createLocal({ alice: [anime('A', 1)] })
    const adapter = createMemoryAdapter(null)
    await pushTo(adapter, local)
    expect(adapter.stored).toEqual(createSnapshot(local.history, 42))
  })
})

describe('syncWith', () => {
  it('遠端沒有資料時上傳本機資料', async () => {
    const local = createLocal({ alice: [anime('A', 1)] })
    const adapter = createMemoryAdapter(null)
    expect(await syncWith(adapter, local)).toEqual({ pushed: true })
    expect(adapter.stored?.history).toEqual(local.history)
  })

  it('雙方各有新資料時，本機與遠端都變成合併結果', async () => {
    const local = createLocal({ alice: [anime('A', 1)] })
    const adapter = createMemoryAdapter(createSnapshot({ alice: [anime('B', 2)] }))
    expect(await syncWith(adapter, local)).toEqual({ pushed: true })
    expect(local.history.alice.map((item) => item.title)).toEqual(['B', 'A'])
    expect(adapter.stored?.history).toEqual(local.history)
  })

  it('合併後與遠端相同時不寫入', async () => {
    const local = createLocal({})
    const adapter = createMemoryAdapter(createSnapshot({ alice: [anime('B', 2)] }))
    expect(await syncWith(adapter, local)).toEqual({ pushed: false })
    expect(adapter.saves).toBe(0)
    expect(local.history.alice).toHaveLength(1)
  })

  it('寫入衝突時重新讀取、合併後再寫入，不遺失其他裝置的資料', async () => {
    const local = createLocal({ alice: [anime('A', 1)] })
    const otherDeviceWrites = (stored: HistorySnapshot | null): HistorySnapshot => createSnapshot(mergeHistory(stored?.history ?? {}, { alice: [anime('C', 3)] }))
    const adapter = createMemoryAdapter(null, [otherDeviceWrites])
    expect(await syncWith(adapter, local)).toEqual({ pushed: true })
    expect(adapter.loads).toBe(2)
    expect(adapter.stored?.history.alice.map((item) => item.title)).toEqual(['C', 'A'])
  })

  it('持續衝突超過次數上限時拋出 ConflictError', async () => {
    const local = createLocal({ alice: [anime('A', 1)] })
    const touch = (stored: HistorySnapshot | null): HistorySnapshot | null => stored
    const adapter = createMemoryAdapter(null, [touch, touch, touch])
    await expect(syncWith(adapter, local)).rejects.toBeInstanceOf(ConflictError)
    expect(adapter.saves).toBe(3)
  })

  it('非衝突錯誤直接拋出，不重試', async () => {
    const local = createLocal({ alice: [anime('A', 1)] })
    const adapter: HistoryAdapter = { load: async () => null, save: async () => { throw new Error('boom') } }
    await expect(syncWith(adapter, local)).rejects.toThrow('boom')
  })
})

describe('createSingleFlight', () => {
  it('執行中的多次請求只會在結束後再跑一次', async () => {
    let runs = 0
    let release: () => void = () => {}
    const run = createSingleFlight(async () => {
      runs++
      if (runs === 1) await new Promise<void>((resolve) => { release = resolve })
    })
    const calls = [run(), run(), run()]
    release()
    await Promise.all(calls)
    expect(runs).toBe(2)
    await run()
    expect(runs).toBe(3)
  })

  it('錯誤會傳給等待中的呼叫者，之後可以再次執行', async () => {
    let fail = true
    const run = createSingleFlight(async () => {
      if (fail) throw new Error('offline')
    })
    await expect(run()).rejects.toThrow('offline')
    fail = false
    await expect(run()).resolves.toBeUndefined()
  })
})
