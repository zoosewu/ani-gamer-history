import { useAppSelector } from '../redux/hooks'
import { describeSyncStatus } from './format'
import { UpdateScriptLink } from './UpdateScriptLink'
import { describeLock } from '../redux/storageSlice'

export const SyncIndicator = (): JSX.Element | null => {
  const sync = useAppSelector((state) => state.sync)
  const lockedBy = useAppSelector((state) => state.storage.lockedBy)
  // 本機資料由較新版本的腳本建立：沒設定雲端也要提示
  if (lockedBy !== null) {
    return <span className='agh-sync-indicator' title={describeLock(lockedBy)}>無法使用<UpdateScriptLink /></span>
  }
  if (sync.settings.adapterId === null) return null
  return (
    <span className='agh-sync-indicator' title={sync.status.message}>
      {describeSyncStatus(sync)}
      {!sync.syncing && sync.status.updateRequired && <UpdateScriptLink />}
    </span>
  )
}
