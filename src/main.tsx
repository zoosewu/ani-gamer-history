import { of, tap } from 'rxjs'
import home from './pages/home/main'
import video from './pages/video/main'
import gather from './pages/mygather/main'
import { globalVar, log } from '@/util'
import _ from 'lodash'
_.noConflict() // necessary for import lodash
log('Init ani-gamer-history', globalVar.animeHistory)
of(new URL(document.URL))
  .pipe(
    tap(gather),
    tap(video),
    tap(home)
  ).subscribe()
