import { GM_getValue } from '$'
import { AdapterSettings } from './adapter'

export const SETTINGS_KEY = 'syncSettings'
export const STATUS_KEY = 'syncStatus'

export interface SyncSettings {
  adapterId: string | null
  autoSync: boolean
  adapters: Record<string, AdapterSettings>
}

export interface SyncStatus {
  lastSyncAt: number | null
  ok: boolean | null
  message: string
  // 雲端資料由較新版本的腳本建立，需要更新腳本才能同步
  updateRequired: boolean
}

export const defaultSyncSettings: SyncSettings = { adapterId: null, autoSync: true, adapters: {} }
export const defaultSyncStatus: SyncStatus = { lastSyncAt: null, ok: null, message: '', updateRequired: false }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const parseSyncSettings = (value: unknown): SyncSettings => {
  if (!isRecord(value)) return defaultSyncSettings
  return {
    adapterId: typeof value.adapterId === 'string' ? value.adapterId : null,
    autoSync: value.autoSync !== false,
    adapters: isRecord(value.adapters) ? value.adapters as Record<string, AdapterSettings> : {}
  }
}

export const parseSyncStatus = (value: unknown): SyncStatus => {
  if (!isRecord(value)) return defaultSyncStatus
  return {
    lastSyncAt: typeof value.lastSyncAt === 'number' ? value.lastSyncAt : null,
    ok: typeof value.ok === 'boolean' ? value.ok : null,
    message: typeof value.message === 'string' ? value.message : '',
    updateRequired: value.updateRequired === true
  }
}

export const readSyncSettings = (): SyncSettings => parseSyncSettings(GM_getValue<unknown>(SETTINGS_KEY, null))
export const readSyncStatus = (): SyncStatus => parseSyncStatus(GM_getValue<unknown>(STATUS_KEY, null))
