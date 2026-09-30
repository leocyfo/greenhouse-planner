interface ProgressBarProps {
  readonly value: number
  readonly max: number
  /** Nom accessible, ex. « Chocoberry : 8 sur 17 ». */
  readonly label: string
  readonly className?: string
}

/** Barre d'avancement ; le texte « x / y » est affiché à côté par le parent. */
export function ProgressBar({ value, max, label, className = '' }: ProgressBarProps) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  const complete = max > 0 && value >= max
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      className={`h-1.5 overflow-hidden rounded-full bg-line ${className}`}
    >
      <div
        className={`h-full rounded-full transition-[width,background-color] duration-500 ease-out ${complete ? 'bg-accent-strong' : 'bg-accent'}`}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  )
}
