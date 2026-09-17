import { persistValue } from '@/gmPersistence'
import { preferencesReplaced } from '@/pages/redux/preferencesSlice'
import { parsePreferences, PREFERENCES_KEY } from './preferences'

export const setupPreferencesPersistence = (): void => {
  persistValue(PREFERENCES_KEY, (state) => state.preferences, parsePreferences, preferencesReplaced)
}
