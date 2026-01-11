import { GetNodeObserver, globalVar, isNotNil } from '@/util'
import { of, map, filter, switchMap, from, delay, tap, fromEvent, Observable, Subscription, interval, take } from 'rxjs'
import { updateAnimeHistory } from './util'
import fp from 'lodash/fp'
let lastEpisode = '0'
export default (URL: URL): Subscription => of(URL)
  .pipe(
    map(fp.get('pathname')),
    filter(fp.eq('/animeVideo.php'))
  )
  .subscribe((pathname) => {
    getCurrentEpisodeButton(pathname)
    listenAdultButton(pathname)
  })

const updateCurrentEpisodeButtonStyle = (button: Element): void => {
  button.parentElement?.classList.add('saw-custom')
  console.log('Updated episode button style', button)
  lastEpisode = button.innerHTML
}

const removeLastEpisodeButtonStyle = (button: Element): void => {
  button.parentElement?.classList.remove('saw-custom')
  console.log('Removed episode button style', button)
}

const getEpisodeButton = (episode: string): Observable<Element> => from(document.querySelectorAll('.season a'))
  .pipe(filter((e) => e.innerHTML === episode))

const getCurrentEpisodeButton = (pathname: string): Subscription => of(pathname)
  .pipe(
    map(() => document.getElementsByClassName('user-id')[0]?.innerHTML),
    map((userId) => globalVar.animeHistory[userId]),
    filter(isNotNil),
    switchMap((histories) => from(histories)),
    filter(history => history.title === document.querySelector('img.data-img')?.getAttribute('alt')),
    map(fp.get('episode')),
    filter(fp.lt(0)),
    delay(1000),
    switchMap(getEpisodeButton)
  )
  .subscribe(updateCurrentEpisodeButtonStyle)

const updateEpisodeButton = (episode: string): Subscription => getEpisodeButton(lastEpisode)
  .pipe(
    tap(removeLastEpisodeButtonStyle),
    switchMap(() => getEpisodeButton(episode))
  )
  .subscribe(updateCurrentEpisodeButtonStyle)

const listenAdultButton$ = (pathname: string): Observable<Element> => of(pathname)
  .pipe(
    switchMap(() => GetNodeObserver('body')),
    filter(isNotNil),
    switchMap((container) => fromEvent<MouseEvent>(container, 'click')),
    filter((event) => (event.target as Element)?.id === 'adult' || (event.target as Element)?.closest('#adult') != null),
    map((event) => event.target as Element)
  )
const listenAdultButton = (pathname: string): Subscription => listenAdultButton$(pathname)
  .pipe(
    switchMap(() => interval(500)),
    map(() => document.getElementById('ani_video_html5_api') as HTMLVideoElement),
    filter<HTMLVideoElement | undefined>((video) => video?.paused === false),
    take(1)
  )
  .subscribe(() => {
    const userId = document.getElementsByClassName('user-id')[0].innerHTML
    let lastEpisode = getAnimeStatus().episode
    setInterval(() => {
      const video = document?.getElementById('ani_video_html5_api') as HTMLVideoElement
      if (video?.paused !== false) return

      const anineStatus = getAnimeStatus()
      updateAnimeHistory(userId, anineStatus)
      if (anineStatus.episode !== lastEpisode) {
        console.log(`Episode changed to ${anineStatus.episode} from ${lastEpisode}`)
        lastEpisode = anineStatus.episode
        updateEpisodeButton(lastEpisode)
      }
    }, 1000)
  })

const getAnimeStatus = () => {
  const id = new URL(document.URL).searchParams.get('sn') ?? ''
  const timestamp = new Date().getTime()
  const img = document.querySelector<HTMLElement>('img.data-img')
  const title = img?.getAttribute('alt') ?? ''
  const episodePicUrl = img?.getAttribute('src') ?? ''
  const animePicUrl = document.getElementById('video-container')?.getAttribute('data-video-poster') ?? ''
  const episode = document.querySelector('.playing a')?.innerHTML ?? '1'
  const video = document?.getElementById('ani_video_html5_api') as HTMLVideoElement
  const videoWatchTime = video?.currentTime ?? 0
  const videoTotalTime = video?.duration
  return { id, timestamp, title, episodePicUrl, animePicUrl, episode, videoWatchTime, videoTotalTime }
}