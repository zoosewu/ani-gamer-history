import { GM_addValueChangeListener, GM_setValue } from '$'
import type { UnknownAction } from '@reduxjs/toolkit'
import { store, RootState } from '@/pages/redux/store'
import { startAppListening } from '@/pages/redux/listenerMiddleware'

// state 改變時寫入 GM storage；其他分頁寫入時同步回來。用序列化結果比對，避免分頁之間來回觸發
export const persistValue = <T>(key: string, select: (state: RootState) => T, parse: (value: unknown) => T, replace: (value: T) => UnknownAction): void => {
  let lastRaw = JSON.stringify(select(store.getState()))

  startAppListening({
    predicate: (_action, currentState, previousState) => select(currentState) !== select(previousState),
    effect: () => {
      const value = select(store.getState())
      const raw = JSON.stringify(value)
      if (raw === lastRaw) return
      lastRaw = raw
      GM_setValue(key, value)
    }
  })

  GM_addValueChangeListener<unknown>(key, (_key, _oldValue, newValue, remote) => {
    if (remote !== true) return
    const value = parse(newValue)
    const raw = JSON.stringify(value)
    if (raw === lastRaw) return
    lastRaw = raw
    store.dispatch(replace(value))
  })
}
