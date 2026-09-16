import { isAnyOf } from '@reduxjs/toolkit'
import { startAppListening } from '@/pages/redux/listenerMiddleware'
import { recordWatch, removeAnime, toggleFavorite } from '@/pages/redux/animeHistorySlice'
import { scheduleUpdateSync } from './syncService'

// 資料更新後推送：開始看動畫（含換集）、刪除、切換最愛。播放中每秒的進度更新不觸發
export const setupSyncTriggers = (): void => {
  startAppListening({
    matcher: isAnyOf(recordWatch, removeAnime, toggleFavorite),
    effect: (action) => {
      if (recordWatch.match(action) && !action.payload.isStart) return
      scheduleUpdateSync()
    }
  })
}
