import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { initialLocalHistory } from '@/history/localStore'

export interface StorageState {
  // 本機資料由較新版本的腳本建立時記下它的資料版本；鎖定後不讀寫本機資料、不同步，只提示更新腳本
  lockedBy: string | null
}

const initialState: StorageState = { lockedBy: initialLocalHistory.lockedBy }

export const storageSlice = createSlice({
  name: 'storage',
  initialState,
  reducers: {
    storageLocked: (state, action: PayloadAction<string>) => {
      state.lockedBy = action.payload
    }
  }
})

export const { storageLocked } = storageSlice.actions

export const describeLock = (lockedBy: string): string => `本機資料由較新版本的腳本建立（資料版本 ${lockedBy}），請先更新腳本`

export default storageSlice.reducer
