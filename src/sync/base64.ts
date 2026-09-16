// btoa / atob 只接受 Latin-1，標題含中文時要先轉成 UTF-8 位元組
const CHUNK_SIZE = 0x8000

export const encodeBase64Utf8 = (text: string): string => {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE))
  }
  return btoa(binary)
}

export const decodeBase64Utf8 = (base64: string): string => {
  const binary = atob(base64.replace(/\s/g, ''))
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)))
}
