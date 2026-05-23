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

export function TranscriptSkeleton() {
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

export function AnswerSkeleton() {
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
