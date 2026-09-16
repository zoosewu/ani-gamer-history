import { GM_xmlhttpRequest } from '$'
import { HttpClient } from './http'

// 透過 GM_xmlhttpRequest 發送，不受頁面 CORS / CSP 限制，Token 也不會經過頁面上的 fetch
export const gmRequest: HttpClient = async ({ method, url, headers, body }) => await new Promise((resolve, reject) => {
  GM_xmlhttpRequest({
    method,
    url,
    headers,
    data: body,
    nocache: true,
    anonymous: true,
    timeout: 30000,
    onload: (response) => resolve({ status: response.status, text: response.responseText }),
    onerror: () => reject(new Error(`網路錯誤，無法連線到 ${new URL(url).host}`)),
    ontimeout: () => reject(new Error(`連線逾時：${new URL(url).host}`))
  })
})
