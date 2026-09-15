import { store } from '@/pages/redux/store'
import { mergeHistory } from '@/pages/redux/animeHistorySlice'
import { syncFinished, syncStarted } from '@/pages/redux/syncSlice'
import { createJsonFileAdapter } from './adapters/jsonFile'
import { findCloudAdapter } from './cloudAdapters'
import { createSingleFlight, pullFrom, pushTo, syncWith, SyncDeps } from './syncEngine'

// 本機資料的進出口：一律透過 Redux store，外部資料一律合併進來
const deps: SyncDeps = {
  getHistory: () => store.getState().animeHistory,
  applyHistory: (history) => { store.dispatch(mergeHistory(history)) }
}

const UPDATE_DELAY_MS = 2000

export type SyncReason = 'manual' | 'display' | 'update'

export const errorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error)

export const getCloudAdapter = (): ReturnType<typeof findCloudAdapter> => findCloudAdapter(store.getState().sync.settings.adapterId)

const runCloudSync = createSingleFlight(async () => {
  const definition = getCloudAdapter()
  if (definition === undefined) {
    store.dispatch(syncFinished({ ...store.getState().sync.status, ok: false, message: '尚未設定雲端平台' }))
    return
  }
  store.dispatch(syncStarted())
  try {
    const { pushed } = await syncWith(definition.create(store.getState().sync.settings.adapters[definition.id] ?? {}), deps)
    store.dispatch(syncFinished({ lastSyncAt: Date.now(), ok: true, message: pushed ? '已上傳最新紀錄' : '雲端已是最新' }))
  } catch (error) {
    console.error('Cloud sync failed', error)
    store.dispatch(syncFinished({ lastSyncAt: Date.now(), ok: false, message: errorMessage(error) }))
  }
})

// 手動同步一定執行；顯示時與更新後的自動同步，只在已設定平台且沒有暫停時執行
export const requestCloudSync = async (reason: SyncReason): Promise<void> => {
  const { autoSync } = store.getState().sync.settings
  if (reason !== 'manual' && (!autoSync || getCloudAdapter() === undefined)) return
  await runCloudSync()
}

let updateTimer: ReturnType<typeof setTimeout> | undefined

// 資料更新後稍等一下再同步，連續操作只會產生一次上傳
export const scheduleUpdateSync = (): void => {
  clearTimeout(updateTimer)
  updateTimer = setTimeout(() => { void requestCloudSync('update') }, UPDATE_DELAY_MS)
}

export const exportJson = async (): Promise<void> => {
  await pushTo(createJsonFileAdapter(), deps)
}

// 回傳是否有匯入（使用者取消選檔時為 false）
export const importJson = async (): Promise<boolean> => {
  const imported = await pullFrom(createJsonFileAdapter(), deps)
  if (imported) scheduleUpdateSync()
  return imported
}
