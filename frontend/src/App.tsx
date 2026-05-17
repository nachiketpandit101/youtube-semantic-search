import { useState, type FormEvent } from 'react'
import './App.css'

type Phase =
  | 'idle'
  | 'loading_transcript'
  | 'transcript_ready'
  | 'generating_answer'
  | 'answer_ready'

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

  const handleLoadVideo = (e: FormEvent) => {
    e.preventDefault()
    const id = extractVideoId(url)
    if (!id) {
      setUrlError('Paste a valid YouTube link (watch or youtu.be).')
      return
    }
    setUrlError(null)
    setVideoId(id)
    setQuery('')
    setPhase('loading_transcript')

    // Demo: simulate transcript fetch — replace with API call
    window.setTimeout(() => setPhase('transcript_ready'), 2400)
  }

  const handleSearch = (e: FormEvent) => {
    e.preventDefault()
    if (!query.trim() || phase !== 'transcript_ready') return
    setPhase('generating_answer')

    window.setTimeout(() => setPhase('answer_ready'), 2000)
  }

  const transcriptBusy = phase === 'loading_transcript'
  const answerBusy = phase === 'generating_answer'
  const canSearch =
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
          />
          <button type="submit" className="btn btn--primary">
            Load video
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

            {/* Transcript status lives directly under the player so tied to indexing, not Q&A */}
            <div className="transcript-status-bar">
              <StatusPill
                variant="transcript"
                label={
                  transcriptBusy ? 'Loading transcript…' : 'Transcript ready'
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
                  Transcript text will appear here once indexed. For the demo,
                  imagine caption lines filling this panel.
                </p>
              )}
            </div>
          </div>

          <div className="workspace__search">
            <form className="search-form" onSubmit={handleSearch}>
              <label className="search-form__label" htmlFor="search-query">
                Ask about this video
              </label>
              <div className="search-form__row">
                <input
                  id="search-query"
                  type="text"
                  placeholder={
                    canSearch
                      ? 'What does the speaker say about…?'
                      : 'Waiting for transcript…'
                  }
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  disabled={!canSearch || answerBusy}
                />
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={!canSearch || answerBusy || !query.trim()}
                >
                  Search
                </button>
              </div>
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
              ) : phase === 'answer_ready' ? (
                <div className="answer-content">
                  <p>
                    This is a placeholder answer. Wire this panel to your
                    semantic search API — citations and timestamps can sit
                    here.
                  </p>
                </div>
              ) : (
                <p className="panel__placeholder panel__placeholder--muted">
                  Your synthesized answer will show up here after you search.
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
