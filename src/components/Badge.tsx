import type { ReactNode } from 'react'

interface BadgeProps {
  readonly children: ReactNode
  /** Pastille devant le texte : fond CSS (couleur de rareté, texture de sol…). Toujours accompagnée d'un texte. */
  readonly swatch?: string
  readonly className?: string
}

/** Petite étiquette neutre. */
export function Badge({ children, swatch, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-line bg-panel-raised px-2 py-0.5 text-xs text-ink ${className}`}
    >
      {swatch && (
        <span
          aria-hidden="true"
          className="size-3 shrink-0 rounded-sm ring-1 ring-white/25"
          style={{ background: swatch, imageRendering: 'pixelated' }}
        />
      )}
      {children}
    </span>
  )
}
