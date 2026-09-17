import { of, tap } from 'rxjs'
import home from './pages/home/HomeIndex'
import video from './pages/video/VideoIndex'
import gather from './pages/mygather/MyGatherIndex'
import anime1 from './pages/anime1/Anime1Index'
import { store } from '@/pages/redux/store'
import { setupHistoryPersistence } from '@/history/persistence'
import { setupSyncPersistence } from '@/sync/syncPersistence'
import { setupPreferencesPersistence } from '@/preferences/persistence'
import { setupSyncTriggers } from '@/sync/triggers'
import { setupMenu } from '@/sync/menu'
import _ from 'lodash'
_.noConflict() // necessary for import lodash
setupHistoryPersistence()
setupSyncPersistence()
setupPreferencesPersistence()
setupSyncTriggers()
setupMenu()
console.log('Init ani-gamer-history', store.getState().animeHistory)
if (window.location.hostname === 'anime1.me') {
  anime1()
} else {
  of(new URL(document.URL))
    .pipe(
      tap(gather), // Initialize MyGather page
      tap(video), // Initialize Video page
      tap(home) // Initialize Home page
    ).subscribe()
}
