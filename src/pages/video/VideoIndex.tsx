import { GetNodeObserver, isNotNil, observeOnMutation, toArray } from '@/util'
import { of, map, filter, switchMap, fromEvent, Observable, Subscription, interval, take } from 'rxjs'
import fp from 'lodash/fp'
import { Anime } from '@/history/types'
import { isRemoved } from '@/history/merge'
import { sourceOf } from '@/history/source'
import { store } from '../redux/store'
import { recordWatch } from '../redux/animeHistorySlice'
import '@/pages/marker.css'
import './VideoIndex.css'

const MARK_CLASS = 'agh-mark'

export default (URL: URL): Subscription => of(URL)
  .pipe(
    map(fp.get('pathname')),
    filter(fp.eq('/animeVideo.php'))
  )
  .subscribe((pathname) => {
    markLastWatchedEpisode()
    listenAdultButton(pathname)
  })

const currentTitle = (): string => document.querySelector('img.data-img')?.getAttribute('alt') ?? ''

const currentUserId = (): string => document.getElementsByClassName('user-id')[0]?.textContent?.trim() ?? ''

// 這部動畫在本機的最後觀看紀錄
const lastWatched = (): Anime | undefined => {
  const title = currentTitle()
  if (title === '') return undefined
  return store.getState().animeHistory[currentUserId()]
    ?.find((anime) => sourceOf(anime) === 'ani-gamer' && anime.title === title && !isRemoved(anime))
}

// 優先用集數的 sn 對應，對不到才退回用集數文字
const findEpisodeLink = (anime: Anime): Element | undefined =>
  document.querySelector(`.season a[data-ani-video-sn="${CSS.escape(anime.id)}"]`) ??
  toArray<NodeListOf<Element>, Element>(document.querySelectorAll('.season a'))
    .find((link) => link.textContent?.trim() === anime.episode)

const renderMark = (): void => {
  const anime = lastWatched()
  const link = anime === undefined ? undefined : findEpisodeLink(anime)
  // 標記放在 <li> 而不是 <a> 裡，才不會污染連結的內容（集數是從連結文字讀出來的）
  const container = link?.closest('li') ?? link
  const existing = document.querySelector(`.${MARK_CLASS}`)
  if (existing?.parentElement === container) return
  existing?.remove()
  if (anime === undefined || container == null) return

  const mark = document.createElement('span')
  mark.className = MARK_CLASS
  mark.title = `本機紀錄：第 ${anime.episode} 集`
  container.append(mark)
}

// 換集、雲端同步拉到新資料、站方重畫分集清單時都要跟著更新
const markLastWatchedEpisode = (): Subscription => {
  renderMark()
  store.subscribe(renderMark)
  return GetNodeObserver('.season')
    .pipe(
      filter(isNotNil),
      switchMap(observeOnMutation({ childList: true, subtree: true })),
      // 忽略自己造成的變動，避免無限迴圈
      filter((mutations) => !mutations.every(isOwnMutation))
    )
    .subscribe(renderMark)
}

const isOwnMutation = (mutation: MutationRecord): boolean =>
  [...mutation.addedNodes, ...mutation.removedNodes]
    .every((node) => node instanceof Element && node.classList.contains(MARK_CLASS))

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
    map(() => document.getElementById('ani_video_html5_api') as HTMLVideoElement | null),
    filter((video) => video !== null && !video.paused),
    take(1)
  )
  .subscribe(() => {
    const userId = currentUserId()
    let lastEpisode = getAnimeStatus().episode
    let started = false
    setInterval(() => {
      const video = document.getElementById('ani_video_html5_api') as HTMLVideoElement | null
      if (video === null || video.paused) return

      const anineStatus = getAnimeStatus()
      const episodeChanged = anineStatus.episode !== lastEpisode
      store.dispatch(recordWatch({ userId, anime: anineStatus, isStart: !started || episodeChanged }))
      started = true
      if (episodeChanged) {
        console.log(`Episode changed to ${anineStatus.episode} from ${lastEpisode}`)
        lastEpisode = anineStatus.episode
      }
    }, 1000)
  })

const getAnimeStatus = (): Anime => {
  const id = new URL(document.URL).searchParams.get('sn') ?? ''
  const timestamp = new Date().getTime()
  const img = document.querySelector<HTMLElement>('img.data-img')
  const title = img?.getAttribute('alt') ?? ''
  const episodePicUrl = img?.getAttribute('src') ?? ''
  const animePicUrl = document.getElementById('video-container')?.getAttribute('data-video-poster') ?? ''
  // 用 textContent 而不是 innerHTML：連結裡可能有我們自己插入的標記元素
  const episode = document.querySelector('.playing a')?.textContent?.trim() ?? '1'
  const video = document?.getElementById('ani_video_html5_api') as HTMLVideoElement
  const videoWatchTime = video?.currentTime ?? 0
  const videoTotalTime = video?.duration
  return { source: 'ani-gamer', id, timestamp, title, episodePicUrl, animePicUrl, episode, videoWatchTime, videoTotalTime }
}
