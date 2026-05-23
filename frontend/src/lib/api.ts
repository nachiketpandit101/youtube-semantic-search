export const API = import.meta.env.VITE_API_URL ?? '/api'

export async function parseApiError(res: Response): Promise<string> {
  try {
    const data = await res.json()
    if (typeof data.detail === 'string') return data.detail
    return JSON.stringify(data.detail ?? data)
  } catch {
    return res.statusText || `Request failed (${res.status})`
  }
}
