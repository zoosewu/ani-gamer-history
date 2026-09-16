import { GM_setClipboard } from '$'

// GM_setClipboard 不受「必須有使用者手勢」限制，加密是非同步也能正常寫入
export const writeClipboard = (text: string): void => {
  GM_setClipboard(text, 'text')
}

// 各瀏覽器對讀取剪貼簿的限制不一致，讀不到時回傳 null，由呼叫端改用手動貼上
export const readClipboard = async (): Promise<string | null> => {
  const clipboard = navigator.clipboard as Clipboard | undefined
  if (clipboard === undefined) return null
  try {
    const text = await clipboard.readText()
    return text === '' ? null : text
  } catch {
    return null
  }
}
