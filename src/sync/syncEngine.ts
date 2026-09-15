import { AnimeHistory } from '@/history/types'
import { createSnapshot, isSameHistory } from '@/history/merge'
import { ConflictError, HistoryAdapter } from './adapter'

export interface SyncDeps {
  getHistory: () => AnimeHistory
  // 把外部資料合併進本機（不是覆蓋）
  applyHistory: (history: AnimeHistory) => void
  now?: () => number
}

const MAX_ATTEMPTS = 3

// 資料進來：讀取後合併進本機。回傳是否有讀到資料
export const pullFrom = async (adapter: HistoryAdapter, deps: SyncDeps): Promise<boolean> => {
  const snapshot = await adapter.load()
  if (snapshot === null) return false
  deps.applyHistory(snapshot.history)
  return true
}

// 資料出去：把本機資料整份寫到目的地
export const pushTo = async (adapter: HistoryAdapter, deps: SyncDeps): Promise<void> => {
  await adapter.save(createSnapshot(deps.getHistory(), (deps.now ?? Date.now)()))
}

// 雙向同步：讀取 → 合併進本機 → 有差異才寫回；衝突時重新來過
export const syncWith = async (adapter: HistoryAdapter, deps: SyncDeps, maxAttempts = MAX_ATTEMPTS): Promise<{ pushed: boolean }> => {
  for (let attempt = 1; ; attempt++) {
    const remote = await adapter.load()
    if (remote !== null) deps.applyHistory(remote.history)
    const local = deps.getHistory()
    if (remote !== null && isSameHistory(local, remote.history)) return { pushed: false }
    try {
      await adapter.save(createSnapshot(local, (deps.now ?? Date.now)()))
      return { pushed: true }
    } catch (error) {
      if (!(error instanceof ConflictError) || attempt >= maxAttempts) throw error
    }
  }
}

// 同一時間只執行一次；執行中收到的請求合併成結束後再跑一次
export const createSingleFlight = (task: () => Promise<void>): () => Promise<void> => {
  let current: Promise<void> | null = null
  let rerun = false
  const loop = async (): Promise<void> => {
    try {
      do {
        rerun = false
        await task()
      } while (rerun)
    } finally {
      current = null
    }
  }
  return async () => {
    if (current !== null) {
      rerun = true
      return await current
    }
    current = loop()
    return await current
  }
}
