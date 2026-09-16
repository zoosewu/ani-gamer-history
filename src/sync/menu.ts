import { GM_notification, GM_registerMenuCommand, GM_unregisterMenuCommand } from '$'
import { store } from '@/pages/redux/store'
import { startAppListening } from '@/pages/redux/listenerMiddleware'
import { autoSyncSet } from '@/pages/redux/syncSlice'
import { openSettings } from '@/pages/settings/openSettings'
import { errorMessage, exportJson, requestCloudSync } from './syncService'

const notify = (text: string): void => {
  GM_notification({ title: 'Ani Gamer History', text })
}

// Tampermonkey 選單只放不需要輸入資料的動作；dialog 裡也有相同的按鈕
const menuItems = (autoSync: boolean): Array<[string, () => void]> => [
  ['⚙ 開啟同步設定', () => openSettings()],
  ['↻ 立即同步', () => {
    void requestCloudSync('manual').then(() => {
      const { ok, message } = store.getState().sync.status
      notify(`${ok === true ? '同步完成' : '同步失敗'}：${message}`)
    })
  }],
  [autoSync ? '⏸ 暫停自動同步' : '▶ 恢復自動同步', () => { store.dispatch(autoSyncSet(!store.getState().sync.settings.autoSync)) }],
  ['⤓ 匯出 JSON', () => { exportJson().catch((error) => notify(`匯出失敗：${errorMessage(error)}`)) }]
]

export const setupMenu = (): void => {
  let ids: string[] = []
  // 重新註冊全部項目，才能在更新文字時維持選單順序
  const render = (): void => {
    ids.forEach((id) => GM_unregisterMenuCommand(id))
    ids = menuItems(store.getState().sync.settings.autoSync).map(([caption, onClick]) => GM_registerMenuCommand(caption, onClick))
  }
  render()
  startAppListening({
    predicate: (_action, currentState, previousState) => currentState.sync.settings.autoSync !== previousState.sync.settings.autoSync,
    effect: render
  })
}
