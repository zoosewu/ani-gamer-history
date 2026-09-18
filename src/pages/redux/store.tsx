import { configureStore } from '@reduxjs/toolkit'
import animeHistoryReducer from './animeHistorySlice'
import syncReducer from './syncSlice'
import preferencesReducer from './preferencesSlice'
import storageReducer from './storageSlice'
import { listenerMiddleware } from './listenerMiddleware'
export const store = configureStore({
  reducer: {
    animeHistory: animeHistoryReducer,
    sync: syncReducer,
    preferences: preferencesReducer,
    storage: storageReducer
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().prepend(listenerMiddleware.middleware)
})

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
