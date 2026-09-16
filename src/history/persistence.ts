import { store } from '@/pages/redux/store'
import { startAppListening } from '@/pages/redux/listenerMiddleware'
import { mergeHistory } from '@/pages/redux/animeHistorySlice'
import { onRemoteHistoryChange, writeLocalHistory } from './localStore'

// Redux store 是唯一資料來源：state 改變就寫回本機，其他分頁寫入時合併進來
export const setupHistoryPersistence = (): void => {
  let lastRaw = JSON.stringify(store.getState().animeHistory)

  const persist = (): void => {
    const raw = JSON.stringify(store.getState().animeHistory)
    if (raw === lastRaw) return
    lastRaw = raw
    writeLocalHistory(raw)
  }

  startAppListening({
    predicate: (_action, currentState, previousState) => currentState.animeHistory !== previousState.animeHistory,
    effect: persist
  })

  onRemoteHistoryChange((history, raw) => {
    lastRaw = raw
    store.dispatch(mergeHistory(history))
    // 本分頁有對方沒有的資料時，把合併結果寫回去
    persist()
  })
}
