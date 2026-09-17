import { GM_addValueChangeListener, GM_getValue, GM_setValue } from '$'
import { AnimeHistory } from './types'
import { CURRENT_HISTORY_KEY, parseCurrentHistory, readVersionedHistory } from './versionedStorage'

export const readLocalHistory = (): AnimeHistory => {
  const { history, raw, changed } = readVersionedHistory((key) => GM_getValue<unknown>(key, undefined))
  // 舊版本欄位升級後有新資料時，立刻寫進目前版本的欄位
  if (changed) GM_setValue(CURRENT_HISTORY_KEY, raw)
  return history
}

// 只寫目前版本的欄位，舊欄位保持原樣
export const writeLocalHistory = (raw: string): void => GM_setValue(CURRENT_HISTORY_KEY, raw)

// 只通知其他分頁造成的變更
export const onRemoteHistoryChange = (listener: (history: AnimeHistory, raw: string) => void): void => {
  GM_addValueChangeListener(CURRENT_HISTORY_KEY, (_key, _oldValue, newValue, remote) => {
    if (remote === true && typeof newValue === 'string') listener(parseCurrentHistory(newValue), newValue)
  })
}
