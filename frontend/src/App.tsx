import { useState, type FormEvent } from 'react'
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
  const [url, setUrl] = useState('')
  const [videoId, setVideoId] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [query, setQuery] = useState('')
  const [urlError, setUrlError] = useState<string | null>(null)
  const [askError, setAskError] = useState<string | null>(null)
  const [chunkCount, setChunkCount] = useState<number | null>(null)
  const [answer, setAnswer] = useState<string | null>(null)
  const [sources, setSources] = useState<Source[]>([])

  const handleLoadVideo = async (e: FormEvent) => {
    e.preventDefault()
    const id = extractVideoId(url)
    if (!id) {
      setUrlError('Paste a valid YouTube link (watch or youtu.be).')
      return
    }

    setUrlError(null)
    setAskError(null)
    setAnswer(null)
    setSources([])
    setChunkCount(null)
    setVideoId(id)
    setQuery('')
    setPhase('loading_transcript')

    try {
      const res = await fetch(`${API}/transcript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      if (!res.ok) throw new Error(await parseApiError(res))
      const data = await res.json()
      setChunkCount(data.chunk_count)
      setPhase('transcript_ready')
    } catch (err) {
      setPhase('idle')
      setVideoId(null)
      setUrlError(
        err instanceof Error ? err.message : 'Failed to load transcript',
      )
    }
  }

  const handleAsk = async (e: FormEvent) => {
    e.preventDefault()
    if (!query.trim() || !videoId || phase !== 'transcript_ready') return

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
      <header className="app-header">
        <h1>Semantic Video Search</h1>
        <p className="app-tagline">
          Paste a YouTube URL, index the transcript, then ask anything about the
          video.
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
                src={`https://www.youtube.com/embed/${videoId}`}
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
                      ? `Transcript ready · ${chunkCount} chunks`
                      : 'Transcript ready'
                }
                loading={transcriptBusy}
              />
            </div>

            <div className="panel panel--transcript">
              <h2 className="panel__title">Transcript</h2>
              {transcriptBusy ? (
                <TranscriptSkeleton />
              ) : (
                <p className="panel__placeholder">
                  {chunkCount != null
                    ? `Indexed ${chunkCount} chunks. Ready for semantic Q&A.`
                    : 'Transcript indexed.'}
                </p>
              )}
            </div>
          </div>

          <div className="workspace__search">
            <form className="search-form" onSubmit={handleAsk}>
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
                          <li key={`${s.start}-${i}`} className="result-card">
                            <div className="result-card__meta">
                              <span className="result-card__score">
                                {(s.score * 100).toFixed(0)}% match
                              </span>
                              <a
                                className="result-card__timestamp"
                                href={`https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(s.start)}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Jump to {formatTimestamp(s.start)}
                              </a>
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
        </section>
      )}
    </main>
  )
}

export default App
