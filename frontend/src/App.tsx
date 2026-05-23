import './App.css'
import { ChatPanel } from './components/ChatPanel'
import { HistorySidebar } from './components/HistorySidebar'
import { TranscriptPanel } from './components/TranscriptPanel'
import { useVideoWorkspace } from './hooks/useVideoWorkspace'

function App() {
  const {
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
  } = useVideoWorkspace()

  return (
    <main className="app">
      <div className="app-shell">
        <HistorySidebar
          history={history}
          activeVideoId={videoId}
          onSelect={handleSelectHistory}
          onDelete={handleDeleteHistory}
        />

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
              <TranscriptPanel
                playerRef={playerRef}
                videoId={videoId}
                transcriptBusy={transcriptBusy}
                transcriptCached={transcriptCached}
                chunkCount={chunkCount}
                transcript={transcript}
                onSeek={seekTo}
              />
              <ChatPanel
                chatEndRef={chatEndRef}
                messages={messages}
                query={query}
                askError={askError}
                answerBusy={answerBusy}
                canAsk={canAsk}
                onQueryChange={setQuery}
                onSubmit={handleAsk}
                onSeek={seekTo}
              />
            </section>
          )}
        </div>
      </div>
    </main>
  )
}

export default App
