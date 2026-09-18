import type { SyncState } from '../redux/syncSlice'

const pad = (value: number): string => String(value).padStart(2, '0')

export const formatSyncTime = (time: number, now = new Date()): string => {
  const date = new Date(time)
  const clock = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  if (date.toDateString() === now.toDateString()) return clock
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${clock}`
}

export const describeSyncStatus = ({ syncing, status }: Pick<SyncState, 'syncing' | 'status'>): string => {
  if (syncing) return '同步中…'
  if (status.ok === null) return '尚未同步'
  if (status.updateRequired) return '無法同步'
  const result = status.ok ? '已同步' : '同步失敗'
  return status.lastSyncAt === null ? result : `${result}（${formatSyncTime(status.lastSyncAt)}）`
}
