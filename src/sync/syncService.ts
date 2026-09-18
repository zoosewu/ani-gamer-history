import { store } from '@/pages/redux/store'
import { SchemaTooNewError } from '@/history/merge'
import { mergeHistory } from '@/pages/redux/animeHistorySlice'
import { syncFinished, syncStarted } from '@/pages/redux/syncSlice'
import { describeLock } from '@/pages/redux/storageSlice'
import { AdapterSettings, CloudAdapterDefinition, exportAdapterSettings } from './adapter'
import { createJsonFileAdapter } from './adapters/jsonFile'
import { writeClipboard } from './clipboard'
import { encodeSettingsTransfer } from './settingsTransfer'
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
    store.dispatch(syncFinished({ ...store.getState().sync.status, ok: false, message: '尚未設定雲端平台', updateRequired: false }))
    return
  }
  store.dispatch(syncStarted())
  try {
    const { pushed } = await syncWith(definition.create(store.getState().sync.settings.adapters[definition.id] ?? {}), deps)
    store.dispatch(syncFinished({ lastSyncAt: Date.now(), ok: true, message: pushed ? '已上傳最新紀錄' : '雲端已是最新', updateRequired: false }))
  } catch (error) {
    console.error('Cloud sync failed', error)
    store.dispatch(syncFinished({ lastSyncAt: Date.now(), ok: false, message: errorMessage(error), updateRequired: error instanceof SchemaTooNewError }))
  }
})

// 手動同步一定執行；顯示時與更新後的自動同步，只在已設定平台且沒有暫停時執行
// 本機資料由較新版本的腳本建立時回傳提示；這個腳本看不懂那份資料，不能同步、匯入或匯出
export const lockedMessage = (): string | null => {
  const { lockedBy } = store.getState().storage
  return lockedBy === null ? null : describeLock(lockedBy)
}

const assertUnlocked = (): void => {
  const message = lockedMessage()
  if (message !== null) throw new Error(message)
}

export const requestCloudSync = async (reason: SyncReason): Promise<void> => {
  if (lockedMessage() !== null) return
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
  assertUnlocked()
  await pushTo(createJsonFileAdapter(), deps)
}

// 回傳是否有匯入（使用者取消選檔時為 false）
export const importJson = async (): Promise<boolean> => {
  assertUnlocked()
  const imported = await pullFrom(createJsonFileAdapter(), deps)
  if (imported) scheduleUpdateSync()
  return imported
}

// 把雲端平台設定加密後放進剪貼簿，方便搬到另一台電腦
export const copyAdapterSettings = async (definition: CloudAdapterDefinition, settings: AdapterSettings): Promise<void> => {
  writeClipboard(await encodeSettingsTransfer({
    adapterId: definition.id,
    settings: exportAdapterSettings(definition, settings)
  }))
}

// 複製目前已儲存的設定（Tampermonkey 選單用）
export const copySavedSettings = async (): Promise<void> => {
  const definition = getCloudAdapter()
  if (definition === undefined) throw new Error('尚未設定雲端平台')
  await copyAdapterSettings(definition, store.getState().sync.settings.adapters[definition.id] ?? {})
}
