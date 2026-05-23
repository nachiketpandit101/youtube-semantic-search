import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import {
  clearChat,
  createMessageId,
  loadChat,
  saveChat,
  type ChatMessage,
} from '../chat'
import {
  getActiveVideoId,
  loadHistory,
  removeHistoryItem,
  setActiveVideoId,
  thumbnailFor,
  upsertHistoryItem,
  type TranscriptLine,
  type VideoHistoryItem,
} from '../history'
import { API, parseApiError } from '../lib/api'
import { extractVideoId } from '../lib/youtube'

export type Phase =
  | 'idle'
  | 'loading_transcript'
  | 'transcript_ready'
  | 'generating_answer'
  | 'answer_ready'

export function useVideoWorkspace() {
  const playerRef = useRef<HTMLIFrameElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [history, setHistory] = useState<VideoHistoryItem[]>(() => loadHistory())
  const [url, setUrl] = useState('')
  const [videoId, setVideoId] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [query, setQuery] = useState('')
  const [urlError, setUrlError] = useState<string | null>(null)
  const [askError, setAskError] = useState<string | null>(null)
  const [chunkCount, setChunkCount] = useState<number | null>(null)
  const [transcriptCached, setTranscriptCached] = useState(false)
  const [transcript, setTranscript] = useState<TranscriptLine[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])

  const resetComposer = useCallback(() => {
    setAskError(null)
    setQuery('')
  }, [])

  const loadMessagesForVideo = useCallback(
    (id: string | null) => {
      setMessages(id ? loadChat(id) : [])
      resetComposer()
    },
    [resetComposer],
  )

  const persistMessages = useCallback((id: string, next: ChatMessage[]) => {
    setMessages(next)
    saveChat(id, next)
  }, [])

  const activateVideo = useCallback(
    (item: VideoHistoryItem) => {
      setVideoId(item.videoId)
      setUrl(item.url)
      setChunkCount(item.chunkCount)
      setTranscriptCached(true)
      setTranscript(item.transcript)
      setPhase('transcript_ready')
      loadMessagesForVideo(item.videoId)
      setActiveVideoId(item.videoId)
    },
    [loadMessagesForVideo],
  )

  useEffect(() => {
    const activeId = getActiveVideoId()
    if (!activeId) return
    const item = loadHistory().find((h) => h.videoId === activeId)
    if (item) activateVideo(item)
  }, [activateVideo])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages, phase])

  const seekTo = useCallback(
    (seconds: number) => {
      const iframe = playerRef.current
      if (!iframe || !videoId) return

      const t = Math.floor(seconds)
      const win = iframe.contentWindow
      if (win) {
        win.postMessage(
          JSON.stringify({ event: 'command', func: 'seekTo', args: [t, true] }),
          '*',
        )
        win.postMessage(
          JSON.stringify({ event: 'command', func: 'playVideo', args: '' }),
          '*',
        )
      }

      iframe
        .closest('.video-embed')
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    },
    [videoId],
  )

  const handleSelectHistory = (item: VideoHistoryItem) => {
    if (item.videoId === videoId && phase === 'transcript_ready') return
    activateVideo(item)
  }

  const handleDeleteHistory = async (item: VideoHistoryItem) => {
    if (
      !window.confirm(
        `Remove "${item.title}" from history and delete its Pinecone index?`,
      )
    ) {
      return
    }

    try {
      const res = await fetch(`${API}/videos/${item.videoId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error(await parseApiError(res))
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : 'Failed to delete from Pinecone',
      )
      return
    }

    clearChat(item.videoId)
    const next = removeHistoryItem(item.videoId)
    setHistory(next)

    if (videoId === item.videoId) {
      setVideoId(null)
      setUrl('')
      setPhase('idle')
      setChunkCount(null)
      setTranscript([])
      setTranscriptCached(false)
      loadMessagesForVideo(null)
      setActiveVideoId(null)
    }
  }

  const handleLoadVideo = async (e: FormEvent) => {
    e.preventDefault()
    const id = extractVideoId(url)
    if (!id) {
      setUrlError('Paste a valid YouTube link (watch or youtu.be).')
      return
    }

    const existing = history.find((h) => h.videoId === id)
    if (existing) {
      setUrlError(null)
      activateVideo(existing)
      return
    }

    setUrlError(null)
    resetComposer()
    setChunkCount(null)
    setTranscriptCached(false)
    setTranscript([])
    setMessages([])
    setVideoId(id)
    setPhase('loading_transcript')

    try {
      const infoRes = await fetch(
        `${API}/video-info?url=${encodeURIComponent(url)}`,
      )
      let title = id
      let thumbnailUrl = thumbnailFor(id)
      if (infoRes.ok) {
        const info = await infoRes.json()
        title = info.title ?? title
        thumbnailUrl = info.thumbnail_url ?? thumbnailUrl
      }

      const res = await fetch(`${API}/transcript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      if (!res.ok) throw new Error(await parseApiError(res))
      const data = await res.json()
      if (!data.chunk_count) {
        throw new Error(
          'Transcript indexed 0 chunks. Try another video with captions enabled.',
        )
      }

      const item: VideoHistoryItem = {
        videoId: id,
        url,
        title,
        thumbnailUrl,
        chunkCount: data.chunk_count,
        transcript: data.transcript ?? [],
        indexedAt: Date.now(),
      }

      setChunkCount(item.chunkCount)
      setTranscriptCached(Boolean(data.cached))
      setTranscript(item.transcript)
      setPhase('transcript_ready')
      loadMessagesForVideo(id)
      setHistory(upsertHistoryItem(item))
      setActiveVideoId(id)
    } catch (err) {
      setPhase('idle')
      setVideoId(null)
      setActiveVideoId(null)
      setTranscriptCached(false)
      setUrlError(
        err instanceof Error ? err.message : 'Failed to load transcript',
      )
    }
  }

  const handleAsk = async (e: FormEvent) => {
    e.preventDefault()
    if (
      !query.trim() ||
      !videoId ||
      (phase !== 'transcript_ready' && phase !== 'answer_ready')
    ) {
      return
    }

    const question = query.trim()
    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: 'user',
      content: question,
      createdAt: Date.now(),
    }
    const pendingMessages = [...messages, userMessage]

    setAskError(null)
    setQuery('')
    persistMessages(videoId, pendingMessages)
    setPhase('generating_answer')

    try {
      const res = await fetch(`${API}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          video_id: videoId,
          history: messages.map(({ role, content }) => ({ role, content })),
        }),
      })
      if (!res.ok) throw new Error(await parseApiError(res))
      const data = await res.json()
      const assistantMessage: ChatMessage = {
        id: createMessageId(),
        role: 'assistant',
        content: data.answer,
        sources: data.sources ?? [],
        createdAt: Date.now(),
      }
      persistMessages(videoId, [...pendingMessages, assistantMessage])
      setPhase('answer_ready')
    } catch (err) {
      persistMessages(videoId, messages)
      setPhase(messages.length > 0 ? 'answer_ready' : 'transcript_ready')
      setAskError(
        err instanceof Error ? err.message : 'Failed to generate answer',
      )
    }
  }

  const transcriptBusy = phase === 'loading_transcript'
  const answerBusy = phase === 'generating_answer'
  const canAsk =
    phase === 'transcript_ready' ||
    phase === 'generating_answer' ||
    phase === 'answer_ready'

  return {
    playerRef,
    chatEndRef,
    history,
    url,
    setUrl,
    videoId,
    query,
    setQuery,
    urlError,
    setUrlError,
    askError,
    chunkCount,
    transcriptCached,
    transcript,
    messages,
    transcriptBusy,
    answerBusy,
    canAsk,
    seekTo,
    handleSelectHistory,
    handleDeleteHistory,
    handleLoadVideo,
    handleAsk,
  }
}
