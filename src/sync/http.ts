export interface HttpRequest {
  method: 'GET' | 'PUT'
  url: string
  headers?: Record<string, string>
  body?: string
}

export interface HttpResponse {
  status: number
  text: string
}

export type HttpClient = (request: HttpRequest) => Promise<HttpResponse>
