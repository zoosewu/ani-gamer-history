import { GM_getValue } from '$'
import { Observable, Subject } from 'rxjs'
import { GlobalVar } from './util.interface'
export const globalVar: GlobalVar = {
  animeHistory: JSON.parse(GM_getValue('animeHistory', '{}'))
}

// get Element by selector and return an Observable, if the element is not found, it will observe mutations on the document body until the element is found
export const GetNodeObserver = (selector: string): Observable<Node | null> => {
  const element = document.querySelector(selector)
  if (element != null) {
    return new Observable((observer) => {
      observer.next(element)
      observer.complete()
    })
  }
  const subject = new Subject<Node | null>()
  observeOnMutation({ childList: true, subtree: true })(document.body.parentNode).subscribe((mutations) => {
    const foundElement = document.querySelector(selector)
    if (foundElement != null) {
      subject.next(foundElement)
      subject.complete()
    }
  })
  return subject
}

export const observeOnMutation = (config: MutationObserverInit) => (target: Node | null) =>
  new Observable<MutationRecord[]>((observer) => {
    const mutation = new MutationObserver((mutations) =>
      observer.next(mutations)
    )
    if (target != null) {
      mutation.observe(target, config)
    }

    const unsubscribe = (): void => mutation.disconnect()
    return unsubscribe
  })

export const isNotNil = <T,>(x: T): x is NonNullable<T> => x != null

export const toArray = <T extends { values: () => IterableIterator<U> }, U>(arrayLike: T | null | undefined): U[] =>
  isNotNil(arrayLike) ? [...arrayLike.values()] : []
