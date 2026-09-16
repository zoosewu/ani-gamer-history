// btoa / atob 只接受 Latin-1，內容含中文時要先轉成 UTF-8 位元組
const CHUNK_SIZE = 0x8000

export const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE))
  }
  return btoa(binary)
}

export const base64ToBytes = (base64: string): Uint8Array =>
  Uint8Array.from(atob(base64.replace(/\s/g, '')), (char) => char.charCodeAt(0))

export const encodeBase64Utf8 = (text: string): string => bytesToBase64(new TextEncoder().encode(text))

export const decodeBase64Utf8 = (base64: string): string => new TextDecoder().decode(base64ToBytes(base64))
