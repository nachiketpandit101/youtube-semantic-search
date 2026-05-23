export function extractVideoId(url: string): string | null {
  const trimmed = url.trim()
  if (!trimmed) return null

  try {
    const parsed = new URL(trimmed)
    if (parsed.hostname === 'youtu.be') {
      return parsed.pathname.slice(1).split('/')[0] || null
    }
    if (parsed.hostname.includes('youtube.com')) {
      const id = parsed.searchParams.get('v')
      if (id) return id
      const embedMatch = parsed.pathname.match(/\/embed\/([^/?]+)/)
      if (embedMatch) return embedMatch[1]
    }
  } catch {
    // fall through for partial paste
  }

  const shortMatch = trimmed.match(/youtu\.be\/([^?&/]+)/)
  if (shortMatch) return shortMatch[1]

  const watchMatch = trimmed.match(/[?&]v=([^&]+)/)
  if (watchMatch) return watchMatch[1]

  return null
}

export function formatTimestamp(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
