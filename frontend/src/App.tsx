import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from 'react'
import {
  getActiveVideoId,
  loadHistory,
  removeHistoryItem,
  setActiveVideoId,
  thumbnailFor,
  upsertHistoryItem,
  type TranscriptLine,
  type VideoHistoryItem,
} from './history'
import './App.css'

const API = import.meta.env.VITE_API_URL ?? '/api'

type Phase =
  | 'idle'
  | 'loading_transcript'
  | 'transcript_ready'
  | 'generating_answer'
  | 'answer_ready'

type Source = {
  text: string
  start: number
  score: number
}

function extractVideoId(url: string): string | null {
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

function formatTimestamp(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

async function parseApiError(res: Response): Promise<string> {
  try {
    const data = await res.json()
    if (typeof data.detail === 'string') return data.detail
    return JSON.stringify(data.detail ?? data)
  } catch {
    return res.statusText || `Request failed (${res.status})`
  }
}

function SkeletonLine({
  width = '100%',
  className = '',
}: {
  width?: string
  className?: string
}) {
  return (
    <div
      className={`skeleton-line ${className}`}
      style={{ width }}
      aria-hidden="true"
    />
  )
}

function TranscriptSkeleton() {
  return (
    <div className="skeleton-panel transcript-skeleton" aria-busy="true">
      <SkeletonLine width="92%" />
      <SkeletonLine width="78%" />
      <SkeletonLine width="88%" />
      <SkeletonLine width="64%" />
      <SkeletonLine width="85%" />
      <SkeletonLine width="71%" />
      <SkeletonLine width="90%" />
      <SkeletonLine width="55%" />
    </div>
  )
}

function AnswerSkeleton() {
  return (
    <div className="skeleton-panel answer-skeleton" aria-busy="true">
      <SkeletonLine width="38%" className="skeleton-line--heading" />
      <SkeletonLine width="100%" />
      <SkeletonLine width="96%" />
      <SkeletonLine width="88%" />
      <SkeletonLine width="72%" />
    </div>
  )
}

function StatusPill({
  variant,
  label,
  loading = false,
}: {
  variant: 'transcript' | 'answer'
  label: string
  loading?: boolean
}) {
  return (
    <div
      className={`status-pill status-pill--${variant}${loading ? ' status-pill--loading' : ''}`}
      role="status"
    >
      <span className="status-pill__dot" aria-hidden="true" />
      {label}
    </div>
  )
}

function App() {
  const playerRef = useRef<HTMLIFrameElement>(null)
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
  const [answer, setAnswer] = useState<string | null>(null)
  const [sources, setSources] = useState<Source[]>([])

  const clearAnswerState = useCallback(() => {
    setAskError(null)
    setAnswer(null)
    setSources([])
    setQuery('')
  }, [])

  const activateVideo = useCallback(
    (item: VideoHistoryItem) => {
      setVideoId(item.videoId)
      setUrl(item.url)
      setChunkCount(item.chunkCount)
      setTranscriptCached(true)
      setTranscript(item.transcript)
      setPhase('transcript_ready')
      clearAnswerState()
      setActiveVideoId(item.videoId)
    },
    [clearAnswerState],
  )

  useEffect(() => {
    const activeId = getActiveVideoId()
    if (!activeId) return
    const item = loadHistory().find((h) => h.videoId === activeId)
    if (item) activateVideo(item)
  }, [activateVideo])

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

  const handleDeleteHistory = async (
    item: VideoHistoryItem,
    e: MouseEvent,
  ) => {
    e.stopPropagation()
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

    const next = removeHistoryItem(item.videoId)
    setHistory(next)

    if (videoId === item.videoId) {
      setVideoId(null)
      setUrl('')
      setPhase('idle')
      setChunkCount(null)
      setTranscript([])
      setTranscriptCached(false)
      clearAnswerState()
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
    clearAnswerState()
    setChunkCount(null)
    setTranscriptCached(false)
    setTranscript([])
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

    setAskError(null)
    setAnswer(null)
    setSources([])
    setPhase('generating_answer')

    try {
      const res = await fetch(`${API}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query, video_id: videoId }),
      })
      if (!res.ok) throw new Error(await parseApiError(res))
      const data = await res.json()
      setAnswer(data.answer)
      setSources(data.sources ?? [])
      setPhase('answer_ready')
    } catch (err) {
      setPhase('transcript_ready')
      setAskError(err instanceof Error ? err.message : 'Failed to generate answer')
    }
  }

  const transcriptBusy = phase === 'loading_transcript'
  const answerBusy = phase === 'generating_answer'
  const canAsk =
    phase === 'transcript_ready' ||
    phase === 'generating_answer' ||
    phase === 'answer_ready'

  return (
    <main className="app">
      <div className="app-shell">
        <aside className="history-sidebar" aria-label="Video history">
          <h2 className="history-sidebar__title">History</h2>
          {history.length === 0 ? (
            <p className="history-sidebar__empty">
              Loaded videos appear here. Switch instantly without re-indexing.
            </p>
          ) : (
            <ul className="history-list">
              {history.map((item) => (
                <li key={item.videoId}>
                  <button
                    type="button"
                    className={`history-item${item.videoId === videoId ? ' history-item--active' : ''}`}
                    onClick={() => handleSelectHistory(item)}
                  >
                    <img
                      className="history-item__thumb"
                      src={item.thumbnailUrl}
                      alt=""
                      width={80}
                      height={45}
                    />
                    <span className="history-item__body">
                      <span className="history-item__title">{item.title}</span>
                      <span className="history-item__meta">
                        {item.chunkCount} chunks
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="history-item__delete"
                    onClick={(e) => handleDeleteHistory(item, e)}
                    aria-label={`Delete ${item.title}`}
                    title="Delete video and Pinecone data"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="app-main">
          <header className="app-header">
            <h1>Semantic Video Search</h1>
            <p className="app-tagline">
              Paste a YouTube URL, index the transcript, then ask anything about
              the video.
            </p>
          </header>

          <form className="url-form" onSubmit={handleLoadVideo}>
            <label className="url-form__label" htmlFor="youtube-url">
              YouTube URL
            </label>
            <div className="url-form__row">
              <input
                id="youtube-url"
                type="url"
                inputMode="url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value)
                  if (urlError) setUrlError(null)
                }}
                autoComplete="off"
                spellCheck={false}
                disabled={transcriptBusy}
              />
              <button
                type="submit"
                className="btn btn--primary"
                disabled={transcriptBusy}
              >
                {transcriptBusy ? 'Indexing…' : 'Load video'}
              </button>
            </div>
            {urlError && (
              <p className="form-error" role="alert">
                {urlError}
              </p>
            )}
          </form>

          {videoId && (
            <section className="workspace" aria-live="polite">
              <div className="workspace__video">
                <div className="video-embed">
                  <iframe
                    key={videoId}
                    ref={playerRef}
                    src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
                    title="YouTube video player"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>

                <div className="transcript-status-bar">
                  <StatusPill
                    variant="transcript"
                    label={
                      transcriptBusy
                        ? 'Loading transcript…'
                        : chunkCount != null
                          ? transcriptCached
                            ? `Already indexed · ${chunkCount} chunks`
                            : `Transcript ready · ${chunkCount} chunks`
                          : 'Transcript ready'
                    }
                    loading={transcriptBusy}
                  />
                </div>

                <div className="panel panel--transcript">
                  <h2 className="panel__title">
                    Transcript
                    {chunkCount != null && (
                      <span className="panel__badge">
                        {chunkCount} chunks indexed
                      </span>
                    )}
                  </h2>
                  {transcriptBusy ? (
                    <TranscriptSkeleton />
                  ) : transcript.length > 0 ? (
                    <div className="transcript-view">
                      {transcript.map((line, i) => (
                        <div
                          key={`${line.start}-${i}`}
                          className="transcript-line"
                        >
                          <button
                            type="button"
                            className="transcript-line__time"
                            onClick={() => seekTo(line.start)}
                            title="Jump to this moment in the player"
                          >
                            {formatTimestamp(line.start)}
                          </button>
                          <p className="transcript-line__text">{line.text}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="panel__placeholder">
                      No transcript lines returned. Reload the video or pick
                      one with captions.
                    </p>
                  )}
                </div>
              </div>

              <div className="workspace__chat">
                <div className="chat-thread">
                  <div className="panel panel--answer">
                    <div className="panel__header">
                      <h2 className="panel__title">Answer</h2>
                      {answerBusy && (
                        <StatusPill
                          variant="answer"
                          label="Generating answer…"
                          loading
                        />
                      )}
                    </div>

                    {answerBusy ? (
                      <AnswerSkeleton />
                    ) : phase === 'answer_ready' && answer ? (
                      <>
                        <div className="answer-content">
                          <p>{answer}</p>
                        </div>
                        {sources.length > 0 && (
                          <div className="sources">
                            <h3 className="sources__title">Sources</h3>
                            <ul className="results-list">
                              {sources.map((s, i) => (
                                <li
                                  key={`${s.start}-${i}`}
                                  className="result-card"
                                >
                                  <div className="result-card__meta">
                                    <span className="result-card__score">
                                      {(s.score * 100).toFixed(0)}% match
                                    </span>
                                    <button
                                      type="button"
                                      className="result-card__timestamp"
                                      onClick={() => seekTo(s.start)}
                                      title="Jump to this moment in the player"
                                    >
                                      Jump to {formatTimestamp(s.start)}
                                    </button>
                                  </div>
                                  <p className="result-card__text">{s.text}</p>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="panel__placeholder panel__placeholder--muted">
                        Your RAG answer and source chunks will appear here.
                      </p>
                    )}
                  </div>
                </div>

                <form className="search-form chat-composer" onSubmit={handleAsk}>
                  <label className="search-form__label" htmlFor="search-query">
                    Ask about this video
                  </label>
                  <div className="search-form__row">
                    <input
                      id="search-query"
                      type="text"
                      placeholder={
                        canAsk
                          ? 'What does the speaker say about…?'
                          : 'Waiting for transcript…'
                      }
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      disabled={!canAsk || answerBusy}
                    />
                    <button
                      type="submit"
                      className="btn btn--primary"
                      disabled={!canAsk || answerBusy || !query.trim()}
                    >
                      Ask
                    </button>
                  </div>
                  {askError && (
                    <p className="form-error" role="alert">
                      {askError}
                    </p>
                  )}
                </form>
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  )
}

export default App
