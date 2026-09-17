import { persistValue } from '@/gmPersistence'
import { settingsReplaced, statusReplaced } from '@/pages/redux/syncSlice'
import { parseSyncSettings, parseSyncStatus, SETTINGS_KEY, STATUS_KEY } from './syncStorage'

export const setupSyncPersistence = (): void => {
  persistValue(SETTINGS_KEY, (state) => state.sync.settings, parseSyncSettings, settingsReplaced)
  persistValue(STATUS_KEY, (state) => state.sync.status, parseSyncStatus, statusReplaced)
}
