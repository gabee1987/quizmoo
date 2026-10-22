/** Error from the API. `code` is the i18n key the server sent, e.g. 'errors.invalidCredentials'. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    /** Field issues of a 400 `errors.invalidInput`, e.g. `{ path: 'names.3', code: 'custom' }`. */
    readonly issues: { path: string; code: string }[] = [],
  ) {
    super(code)
    this.name = 'ApiError'
  }
}

/** i18n key for any thrown error: the server's code for an ApiError, a generic one otherwise. */
export function errorCode(error: unknown): string {
  return error instanceof ApiError ? error.code : 'errors.internal'
}

/** JSON fetch against the same-origin API. Throws ApiError for non-2xx answers and network failures. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  // JSON bodies are strings; FormData (uploads) must let the browser set its own multipart boundary.
  if (typeof init.body === 'string' && !headers.has('content-type')) headers.set('content-type', 'application/json')

  let res: Response
  try {
    res = await fetch(path, { ...init, headers, credentials: 'same-origin' })
  } catch {
    throw new ApiError(0, 'errors.connectionLost')
  }
  if (res.status === 204) return undefined as T

  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const code =
      typeof body === 'object' && body !== null && typeof (body as { error?: unknown }).error === 'string'
        ? (body as { error: string }).error
        : 'errors.internal'
    const issues = (body as { issues?: unknown } | null)?.issues
    throw new ApiError(res.status, code, Array.isArray(issues) ? issues : [])
  }
  return body as T
}

/**
 * POSTs a form (a file upload) and reports progress from 0 to 1. XMLHttpRequest because fetch
 * cannot report upload progress. Errors are the same ApiError codes as apiFetch.
 */
export function apiUpload<T>(path: string, body: FormData, onProgress: (fraction: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', path)
    xhr.withCredentials = true
    xhr.responseType = 'json'
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total)
    }
    xhr.onerror = () => reject(new ApiError(0, 'errors.connectionLost'))
    xhr.onload = () => {
      const res: unknown = xhr.response
      if (xhr.status >= 200 && xhr.status < 300) return resolve(res as T)
      const code =
        typeof res === 'object' && res !== null && typeof (res as { error?: unknown }).error === 'string'
          ? (res as { error: string }).error
          : 'errors.internal'
      reject(new ApiError(xhr.status, code))
    }
    xhr.send(body)
  })
}
