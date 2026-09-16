import ReactDOM from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { Provider } from 'react-redux'
import { store } from '../redux/store'
import { SettingsDialog, SettingsPage } from './SettingsDialog'

let root: Root | null = null
let openCount = 0

// 可以在任何頁面打開（首頁齒輪按鈕、Tampermonkey 選單）；每次打開都重新掛載，表單回到已儲存的設定
export const openSettings = (page: SettingsPage = 'status'): void => {
  if (root === null) {
    const container = document.createElement('div')
    container.id = 'agh-settings'
    document.body.append(container)
    root = ReactDOM.createRoot(container)
  }
  const currentRoot = root
  openCount++
  currentRoot.render(
    <Provider store={store}>
      <SettingsDialog key={openCount} initialPage={page} onClosed={() => currentRoot.render(null)} />
    </Provider>
  )
}
