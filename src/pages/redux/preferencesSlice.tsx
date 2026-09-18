import { GM_getValue } from '$'
import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { parsePreferences, Preferences, PREFERENCES_KEY } from '@/preferences/preferences'

interface Visibility { source: string, visible: boolean }

const toggleHidden = (hidden: string[], { source, visible }: Visibility): string[] => {
  const next = new Set(hidden)
  if (visible) next.delete(source)
  else next.add(source)
  return [...next].sort()
}

const initialState: Preferences = parsePreferences(GM_getValue<unknown>(PREFERENCES_KEY, null))

export const preferencesSlice = createSlice({
  name: 'preferences',
  initialState,
  reducers: {
    sourceVisibilitySet: (state, action: PayloadAction<Visibility>) => {
      state.hiddenSources = toggleHidden(state.hiddenSources, action.payload)
    },
    markerVisibilitySet: (state, action: PayloadAction<Visibility>) => {
      state.hiddenMarkers = toggleHidden(state.hiddenMarkers, action.payload)
    },
    preferencesReplaced: (_state, action: PayloadAction<Preferences>) => action.payload
  }
})

export const { sourceVisibilitySet, markerVisibilitySet, preferencesReplaced } = preferencesSlice.actions

export default preferencesSlice.reducer
