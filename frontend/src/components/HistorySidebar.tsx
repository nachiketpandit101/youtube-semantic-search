import type { MouseEvent } from 'react'
import type { VideoHistoryItem } from '../history'

type HistorySidebarProps = {
  history: VideoHistoryItem[]
  activeVideoId: string | null
  onSelect: (item: VideoHistoryItem) => void
  onDelete: (item: VideoHistoryItem, e: MouseEvent) => void
}

export function HistorySidebar({
  history,
  activeVideoId,
  onSelect,
  onDelete,
}: HistorySidebarProps) {
  return (
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
                className={`history-item${item.videoId === activeVideoId ? ' history-item--active' : ''}`}
                onClick={() => onSelect(item)}
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
                onClick={(e) => onDelete(item, e)}
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
  )
}
