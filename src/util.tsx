import { GM_getValue, GM_setValue } from '$'
import { Observable } from 'rxjs'
import { Anime, Global } from './util.interface'
export const log = console.log
export const globalVar: Global = {
  animeHistory: JSON.parse(GM_getValue('animeHistory', '{}'))
}
export const observeOnMutation = (config: MutationObserverInit) => (target: Node) =>
  new Observable<MutationRecord[]>((observer) => {
    const mutation = new MutationObserver((mutations) =>
      observer.next(mutations)
    )
    mutation.observe(target, config)

    const unsubscribe = (): void => mutation.disconnect()
    return unsubscribe
  })

export const isNotNil = <T,> (x: T): x is NonNullable<T> => x != null

export const toArray = <T extends { values: () => IterableIterator<U> }, U> (arrayLike: T | null | undefined): U[] =>
  isNotNil(arrayLike) ? [...arrayLike.values()] : []

export const updateAnimeHistory = (userId: string, { id, time, title, pictureUrl, episode }: Anime): void => {
  log('New History', { id, time, title, pictureUrl, episode })

  const histories = globalVar.animeHistory?.[userId]?.filter((anime) => anime.title !== title) ?? []

  const newHistories = [{ id, time, title, pictureUrl, episode }, ...histories]

  globalVar.animeHistory = { ...globalVar.animeHistory, [userId]: newHistories }
  GM_setValue('animeHistory', JSON.stringify(globalVar.animeHistory))

  log('Updated History', globalVar.animeHistory)
}
