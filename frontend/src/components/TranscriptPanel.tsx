import type { RefObject } from 'react'
import { StatusPill } from './StatusPill'
import { TranscriptSkeleton } from './Skeletons'
import { formatTimestamp } from '../lib/youtube'
import type { TranscriptLine } from '../history'

type TranscriptPanelProps = {
  playerRef: RefObject<HTMLIFrameElement | null>
  videoId: string
  transcriptBusy: boolean
  transcriptCached: boolean
  chunkCount: number | null
  transcript: TranscriptLine[]
  onSeek: (seconds: number) => void
}

export function TranscriptPanel({
  playerRef,
  videoId,
  transcriptBusy,
  transcriptCached,
  chunkCount,
  transcript,
  onSeek,
}: TranscriptPanelProps) {
  return (
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
            <span className="panel__badge">{chunkCount} chunks indexed</span>
          )}
        </h2>
        {transcriptBusy ? (
          <TranscriptSkeleton />
        ) : transcript.length > 0 ? (
          <div className="transcript-view">
            {transcript.map((line, i) => (
              <div key={`${line.start}-${i}`} className="transcript-line">
                <button
                  type="button"
                  className="transcript-line__time"
                  onClick={() => onSeek(line.start)}
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
            No transcript lines returned. Reload the video or pick one with
            captions.
          </p>
        )}
      </div>
    </div>
  )
}
