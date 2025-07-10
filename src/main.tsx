import { of, tap } from 'rxjs'
import home from './pages/home/HomeIndex'
import video from './pages/video/VideoIndex'
import gather from './pages/mygather/MyGatherIndex'
import { globalVar } from '@/util'
import _ from 'lodash'
_.noConflict() // necessary for import lodash
console.log('Init ani-gamer-history', globalVar.animeHistory)
of(new URL(document.URL))
  .pipe(
    tap(gather), // Initialize MyGather page
    tap(video), // Initialize Video page
    tap(home) // Initialize Home page
  ).subscribe()
