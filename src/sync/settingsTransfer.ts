import { AdapterSettings } from './adapter'
import { base64ToBytes, bytesToBase64 } from './base64'

// 把雲端平台設定轉成一段字串，方便在多台電腦之間用剪貼簿搬移。
//
// 注意：加密金鑰就放在腳本裡，只是為了避免不小心貼到別的地方時被一眼看懂，
// 並不是真正的保護。腳本是公開的，任何人都能解開這段字串，
// 請把它當成和 Token 同等級的東西，不要公開張貼。
const PREFIX = 'AGH1.'
const APP = 'ani-gamer-history'
const KIND = 'sync-settings'
const VERSION = 1
const IV_LENGTH = 12
const ITERATIONS = 120000

// 通關碼由兩張表 XOR 還原，避免密鑰以明文字串出現在 build 產物中
const MASK = new Uint8Array([178, 156, 115, 163, 195, 24, 200, 5, 128, 191, 20, 154, 150, 48, 31, 39, 205, 169, 51, 6, 43, 115])
const TABLE = new Uint8Array([211, 251, 27, 140, 176, 97, 166, 102, 173, 204, 113, 238, 226, 89, 113, 64, 190, 134, 75, 49, 122, 5])
const SALT = new Uint8Array([160, 218, 17, 13, 236, 213, 84, 36, 190, 113, 90, 146, 223, 29, 196, 222])

export interface SettingsTransfer {
  adapterId: string
  settings: AdapterSettings
}

const getSubtle = (): SubtleCrypto => {
  const api = globalThis.crypto?.subtle
  if (api === undefined) throw new Error('這個瀏覽器不支援複製 / 貼上同步設定所需的加密功能')
  return api
}

let cachedKey: Promise<CryptoKey> | undefined

const getKey = async (): Promise<CryptoKey> => {
  if (cachedKey === undefined) {
    cachedKey = (async () => {
      const subtle = getSubtle()
      const material = await subtle.importKey('raw', TABLE.map((value, index) => value ^ MASK[index]), 'PBKDF2', false, ['deriveKey'])
      return await subtle.deriveKey(
        { name: 'PBKDF2', salt: SALT, iterations: ITERATIONS, hash: 'SHA-256' },
        material,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      )
    })()
  }
  return await cachedKey
}

const toUrlSafe = (base64: string): string => base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const fromUrlSafe = (text: string): string => text.replace(/-/g, '+').replace(/_/g, '/')

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const BROKEN = '同步設定的內容已損毀，或不是這個腳本產生的'

export const encodeSettingsTransfer = async ({ adapterId, settings }: SettingsTransfer): Promise<string> => {
  const payload = JSON.stringify({ app: APP, kind: KIND, version: VERSION, adapterId, settings })
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const encrypted = await getSubtle().encrypt({ name: 'AES-GCM', iv }, await getKey(), new TextEncoder().encode(payload))
  const bytes = new Uint8Array(IV_LENGTH + encrypted.byteLength)
  bytes.set(iv)
  bytes.set(new Uint8Array(encrypted), IV_LENGTH)
  return `${PREFIX}${toUrlSafe(bytesToBase64(bytes))}`
}

export const decodeSettingsTransfer = async (text: string): Promise<SettingsTransfer> => {
  const trimmed = text.trim()
  if (!trimmed.startsWith(PREFIX)) throw new Error('剪貼簿的內容不是同步設定')

  let bytes: Uint8Array
  try {
    bytes = base64ToBytes(fromUrlSafe(trimmed.slice(PREFIX.length)))
  } catch {
    throw new Error(BROKEN)
  }
  if (bytes.length <= IV_LENGTH) throw new Error(BROKEN)

  let payload: unknown
  try {
    const decrypted = await getSubtle().decrypt(
      { name: 'AES-GCM', iv: bytes.slice(0, IV_LENGTH) },
      await getKey(),
      bytes.slice(IV_LENGTH)
    )
    payload = JSON.parse(new TextDecoder().decode(decrypted))
  } catch {
    throw new Error(BROKEN)
  }

  if (!isRecord(payload) || payload.app !== APP || payload.kind !== KIND) throw new Error('剪貼簿的內容不是同步設定')
  if (payload.version !== VERSION) throw new Error(`同步設定的版本不支援（${String(payload.version)}），請更新腳本`)
  if (typeof payload.adapterId !== 'string' || payload.adapterId === '' || !isRecord(payload.settings)) throw new Error(BROKEN)

  const settings: AdapterSettings = {}
  Object.entries(payload.settings).forEach(([key, value]) => {
    if (typeof value === 'string') settings[key] = value
  })
  return { adapterId: payload.adapterId, settings }
}
