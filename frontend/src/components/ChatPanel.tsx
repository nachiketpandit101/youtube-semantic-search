import type { FormEvent, RefObject } from 'react'
import { StatusPill } from './StatusPill'
import { AnswerSkeleton } from './Skeletons'
import { formatTimestamp } from '../lib/youtube'
import type { ChatMessage } from '../chat'

type ChatPanelProps = {
  chatEndRef: RefObject<HTMLDivElement | null>
  messages: ChatMessage[]
  query: string
  askError: string | null
  answerBusy: boolean
  canAsk: boolean
  onQueryChange: (value: string) => void
  onSubmit: (e: FormEvent) => void
  onSeek: (seconds: number) => void
}

export function ChatPanel({
  chatEndRef,
  messages,
  query,
  askError,
  answerBusy,
  canAsk,
  onQueryChange,
  onSubmit,
  onSeek,
}: ChatPanelProps) {
  return (
    <div className="workspace__chat">
      <div className="chat-thread">
        <div className="panel panel--chat">
          <div className="panel__header">
            <h2 className="panel__title">Chat</h2>
            {answerBusy && (
              <StatusPill
                variant="answer"
                label="Generating answer…"
                loading
              />
            )}
          </div>

          <div className="chat-messages">
            {messages.length === 0 && !answerBusy ? (
              <p className="panel__placeholder panel__placeholder--muted">
                Ask a question to start a conversation about this video.
              </p>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`chat-message chat-message--${message.role}`}
                >
                  <p className="chat-message__label">
                    {message.role === 'user' ? 'You' : 'Answer'}
                  </p>
                  <div className="chat-message__bubble">
                    <p>{message.content}</p>
                  </div>
                  {message.role === 'assistant' &&
                    message.sources &&
                    message.sources.length > 0 && (
                      <div className="sources sources--inline">
                        <h3 className="sources__title">Sources</h3>
                        <ul className="results-list">
                          {message.sources.map((s, i) => (
                            <li
                              key={`${message.id}-${s.start}-${i}`}
                              className="result-card"
                            >
                              <div className="result-card__meta">
                                <span className="result-card__score">
                                  {(s.score * 100).toFixed(0)}% match
                                </span>
                                <button
                                  type="button"
                                  className="result-card__timestamp"
                                  onClick={() => onSeek(s.start)}
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
                </div>
              ))
            )}
            {answerBusy && <AnswerSkeleton />}
            <div ref={chatEndRef} />
          </div>
        </div>
      </div>

      <form className="search-form chat-composer" onSubmit={onSubmit}>
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
            onChange={(e) => onQueryChange(e.target.value)}
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
  )
}
