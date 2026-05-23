export function StatusPill({
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
