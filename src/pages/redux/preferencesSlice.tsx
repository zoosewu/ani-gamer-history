import { GM_getValue } from '$'
import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { parsePreferences, Preferences, PREFERENCES_KEY } from '@/preferences/preferences'

const initialState: Preferences = parsePreferences(GM_getValue<unknown>(PREFERENCES_KEY, null))

export const preferencesSlice = createSlice({
  name: 'preferences',
  initialState,
  reducers: {
    sourceVisibilitySet: (state, action: PayloadAction<{ source: string, visible: boolean }>) => {
      const { source, visible } = action.payload
      const hidden = new Set(state.hiddenSources)
      if (visible) hidden.delete(source)
      else hidden.add(source)
      state.hiddenSources = [...hidden].sort()
    },
    preferencesReplaced: (_state, action: PayloadAction<Preferences>) => action.payload
  }
})

export const { sourceVisibilitySet, preferencesReplaced } = preferencesSlice.actions

export default preferencesSlice.reducer
