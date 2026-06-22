/**
 * Vulpine Command Center — Central API Client
 *
 * All backend requests must go through this module.
 * The backend base URL is read exclusively from NEXT_PUBLIC_API_BASE_URL.
 *
 * Rules:
 * - Never hardcode localhost, VPS IPs, or production URLs in source code.
 * - Never hardcode Vercel preview URLs.
 * - If NEXT_PUBLIC_API_BASE_URL is missing at call time, fail clearly.
 */

function getBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL
  if (!base) {
    throw new Error("Missing required env var: NEXT_PUBLIC_API_BASE_URL")
  }
  return base.replace(/\/$/, "")
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const base = getBaseUrl()
  const url = `${base}${path}`

  const { body, headers, ...rest } = options

  const res = await fetch(url, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(headers as Record<string, string>),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error")
    throw new Error(`API error ${res.status} at ${path}: ${text}`)
  }

  return res.json() as Promise<T>
}

export const apiClient = {
  get<T>(path: string, options?: RequestOptions) {
    return request<T>(path, { ...options, method: "GET" })
  },
  post<T>(path: string, body: unknown, options?: RequestOptions) {
    return request<T>(path, { ...options, method: "POST", body })
  },
  put<T>(path: string, body: unknown, options?: RequestOptions) {
    return request<T>(path, { ...options, method: "PUT", body })
  },
  patch<T>(path: string, body: unknown, options?: RequestOptions) {
    return request<T>(path, { ...options, method: "PATCH", body })
  },
  delete<T>(path: string, options?: RequestOptions) {
    return request<T>(path, { ...options, method: "DELETE" })
  },
}

export default apiClient
