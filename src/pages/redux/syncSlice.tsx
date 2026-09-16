import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { AdapterSettings } from '@/sync/adapter'
import { defaultSyncStatus, readSyncSettings, readSyncStatus, SyncSettings, SyncStatus } from '@/sync/syncStorage'

export interface SyncState {
  settings: SyncSettings // 儲存在 GM storage，跨分頁共用
  status: SyncStatus // 儲存在 GM storage，跨分頁共用
  syncing: boolean // 只屬於目前分頁
}

const initialState: SyncState = {
  settings: readSyncSettings(),
  status: readSyncStatus(),
  syncing: false
}

export const syncSlice = createSlice({
  name: 'sync',
  initialState,
  reducers: {
    adapterSettingsSaved: (state, action: PayloadAction<{ adapterId: string, settings: AdapterSettings }>) => {
      const { adapterId, settings } = action.payload
      state.settings.adapterId = adapterId
      state.settings.adapters[adapterId] = settings
    },
    // 中斷同步：清除目前平台的設定（含 Token），本機紀錄與雲端檔案都保留
    syncDisconnected: (state) => {
      const { adapterId, adapters } = state.settings
      state.settings.adapters = Object.fromEntries(Object.entries(adapters).filter(([id]) => id !== adapterId))
      state.settings.adapterId = null
      state.status = defaultSyncStatus
    },
    autoSyncSet: (state, action: PayloadAction<boolean>) => {
      state.settings.autoSync = action.payload
    },
    syncStarted: (state) => {
      state.syncing = true
    },
    syncFinished: (state, action: PayloadAction<SyncStatus>) => {
      state.syncing = false
      state.status = action.payload
    },
    settingsReplaced: (state, action: PayloadAction<SyncSettings>) => {
      state.settings = action.payload
    },
    statusReplaced: (state, action: PayloadAction<SyncStatus>) => {
      state.status = action.payload
    }
  }
})

export const { adapterSettingsSaved, syncDisconnected, autoSyncSet, syncStarted, syncFinished, settingsReplaced, statusReplaced } = syncSlice.actions

export default syncSlice.reducer
