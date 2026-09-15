import { useAppSelector } from '../redux/hooks'
import { describeSyncStatus } from './format'

export const SyncIndicator = (): JSX.Element | null => {
  const sync = useAppSelector((state) => state.sync)
  if (sync.settings.adapterId === null) return null
  return <span className='agh-sync-indicator' title={sync.status.message}>{describeSyncStatus(sync)}</span>
}
