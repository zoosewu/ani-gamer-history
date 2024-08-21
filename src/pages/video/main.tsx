import { observeOnMutation, updateAnimeHistory, globalVar, toArray, isNotNil } from '@/util'
import { of, map, filter, switchMap, from, delay, tap, fromEvent, Observable, Subscription } from 'rxjs'
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
  // button.style.color = "var(--anime-tertiary-color)";
  button.parentElement?.classList.add('saw')
  lastEpisode = button.innerHTML
}

const removeLastEpisodeButtonStyle = (button: Element): void => {
  button.parentElement?.classList.remove('saw')
  // button.style.color = "";
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

const updateEpisode = (episode: string): Subscription => getEpisodeButton(lastEpisode)
  .pipe(
    tap(removeLastEpisodeButtonStyle),
    switchMap(() => getEpisodeButton(episode))
  )
  .subscribe(updateCurrentEpisodeButtonStyle)

const listenAdultButton = (pathname: string): Subscription => of(pathname)
  .pipe(
    map(() => document.getElementById('ani_video') as Node),
    switchMap(observeOnMutation({ childList: true })),
    switchMap((e) => from(e)),
    map(fp.get('addedNodes')),
    filter(isNotNil),
    map(toArray<NodeList, Node>),
    switchMap((e) => from(e)),
    map<Node, Element>(fp.identity),
    filter((node) => node.className.includes('R18')),
    map(() => document.getElementById('adult')),
    filter(isNotNil),
    switchMap((element) => fromEvent(element, 'click'))
  )
  .subscribe(() => {
    const userId = document.getElementsByClassName('user-id')[0].innerHTML
    const id = new URL(document.URL).searchParams.get('sn') ?? ''
    const time = new Date().getTime()
    const img = document.querySelector<HTMLElement>('img.data-img')
    const title = img?.getAttribute('alt') ?? ''
    const episodePicUrl = img?.getAttribute('src') ?? ''
    const animePicUrl = document.getElementById('video-container')?.getAttribute('data-video-poster') ?? ''
    const episode = document.querySelector('.playing a')?.innerHTML ?? ''
    updateAnimeHistory(userId, { id, time, title, episodePicUrl, animePicUrl, episode })
    updateEpisode(episode)
  })
