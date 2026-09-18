import { GM_addValueChangeListener, GM_deleteValue, GM_getValue, GM_setValue } from '$'
import { AnimeHistory } from './types'
import { LocalHistory, LOCAL_HISTORY_KEY, parseLocalHistory, readLocalSnapshot, serializeLocalHistory } from './localSnapshot'

const load = (): LocalHistory => {
  const local = readLocalSnapshot((key) => GM_getValue<unknown>(key, undefined))
  // 舊欄位併進來之後只保留一份最新版的資料
  if (local.changed) GM_setValue(LOCAL_HISTORY_KEY, serializeLocalHistory(local.history))
  local.legacyKeys.forEach((key) => GM_deleteValue(key))
  return local
}

// 腳本載入時讀一次，紀錄與鎖定狀態都從這裡初始化
export const initialLocalHistory: LocalHistory = load()

export const writeLocalHistory = (history: AnimeHistory): void => GM_setValue(LOCAL_HISTORY_KEY, serializeLocalHistory(history))

// 只通知其他分頁造成的變更；資料由較新版本的腳本寫入時通知鎖定
export const onRemoteHistoryChange = (listeners: { onHistory: (history: AnimeHistory) => void, onLocked: (version: string) => void }): void => {
  GM_addValueChangeListener(LOCAL_HISTORY_KEY, (_key, _oldValue, newValue, remote) => {
    if (remote !== true) return
    const parsed = parseLocalHistory(newValue)
    if ('lockedBy' in parsed) listeners.onLocked(parsed.lockedBy)
    else listeners.onHistory(parsed.history)
  })
}
