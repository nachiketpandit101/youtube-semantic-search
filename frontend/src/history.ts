export type TranscriptLine = {
  text: string
  start: number
}

export type VideoHistoryItem = {
  videoId: string
  url: string
  title: string
  thumbnailUrl: string
  chunkCount: number
  transcript: TranscriptLine[]
  indexedAt: number
}

const HISTORY_KEY = 'yt-semantic-video-history'
const ACTIVE_KEY = 'yt-semantic-active-video'
const MAX_ITEMS = 30

export function thumbnailFor(videoId: string) {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
}

export function loadHistory(): VideoHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as VideoHistoryItem[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveHistory(items: VideoHistoryItem[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)))
}

export function upsertHistoryItem(item: VideoHistoryItem): VideoHistoryItem[] {
  const rest = loadHistory().filter((h) => h.videoId !== item.videoId)
  const next = [item, ...rest].slice(0, MAX_ITEMS)
  saveHistory(next)
  return next
}

export function removeHistoryItem(videoId: string): VideoHistoryItem[] {
  const next = loadHistory().filter((h) => h.videoId !== videoId)
  saveHistory(next)
  return next
}

export function setActiveVideoId(videoId: string | null) {
  if (videoId) {
    localStorage.setItem(ACTIVE_KEY, videoId)
  } else {
    localStorage.removeItem(ACTIVE_KEY)
  }
}

export function getActiveVideoId(): string | null {
  return localStorage.getItem(ACTIVE_KEY)
}
