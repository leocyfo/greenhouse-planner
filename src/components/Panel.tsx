import { useId, type ReactNode } from 'react'

interface PanelProps {
  readonly title: string
  /** Éléments à droite du titre (boutons, badges…). */
  readonly actions?: ReactNode
  readonly children: ReactNode
  readonly className?: string
}

/** Carte titrée, reliée à son titre pour les lecteurs d'écran. */
export function Panel({ title, actions, children, className = '' }: PanelProps) {
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} className={`rounded-xl border border-line bg-panel p-4 ${className}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 id={titleId} className="font-semibold">
          {title}
        </h3>
        {actions}
      </div>
      {children}
    </section>
  )
}
