import { GM_getValue } from '$'
import { Observable } from 'rxjs'
import { GlobalVar } from './util.interface'
export const log = console.log
export const globalVar: GlobalVar = {
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
