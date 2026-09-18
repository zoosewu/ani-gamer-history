import { store } from '@/pages/redux/store'
import { startAppListening } from '@/pages/redux/listenerMiddleware'
import { mergeHistory } from '@/pages/redux/animeHistorySlice'
import { storageLocked } from '@/pages/redux/storageSlice'
import { onRemoteHistoryChange, writeLocalHistory } from './localStore'

const isLocked = (): boolean => store.getState().storage.lockedBy !== null

// Redux store 是唯一資料來源：state 改變就寫回本機，其他分頁寫入時合併進來
export const setupHistoryPersistence = (): void => {
  let lastRaw = JSON.stringify(store.getState().animeHistory)

  const persist = (): void => {
    // 本機資料由較新版本的腳本建立：不能寫回，否則會蓋掉看不懂的內容
    if (isLocked()) return
    const raw = JSON.stringify(store.getState().animeHistory)
    if (raw === lastRaw) return
    lastRaw = raw
    writeLocalHistory(store.getState().animeHistory)
  }

  startAppListening({
    predicate: (_action, currentState, previousState) => currentState.animeHistory !== previousState.animeHistory,
    effect: persist
  })

  onRemoteHistoryChange({
    onHistory: (history) => {
      if (isLocked()) return
      lastRaw = JSON.stringify(history)
      store.dispatch(mergeHistory(history))
      // 本分頁有對方沒有的資料時，把合併結果寫回去
      persist()
    },
    // 其他分頁（已更新的腳本）寫入了較新版本的資料：這個分頁之後都不再寫入
    onLocked: (version) => { store.dispatch(storageLocked(version)) }
  })
}
