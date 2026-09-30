/** Petits éléments de la fiche d'une mutation, au style du wiki de skymutations.eu. */
import type { ReactNode } from 'react'

/** Section de la fiche : titre court en capitales, puis son contenu (jamais coupée entre deux colonnes). */
export function Section({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section className="mb-4 break-inside-avoid">
      <h4 className="mb-1.5 text-xs font-bold tracking-wider text-ink uppercase">{title}</h4>
      {children}
    </section>
  )
}

/** Pastille « TAILLE 1x1 » : libellé discret, valeur en chasse fixe. */
export function StatChip({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-md border border-line bg-canvas px-2.5 py-1.5">
      <span className="text-[10px] font-bold tracking-wider text-ink-muted uppercase">{label}</span>
      <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-accent-strong">{children}</span>
    </span>
  )
}

interface FieldChipProps {
  readonly label: string
  readonly children: ReactNode
  /** « label » quand la pastille entoure une case à cocher (tout le libellé la coche). */
  readonly as?: 'div' | 'label'
}

/** Réglage de la bande du haut (stock, besoin, analyse) : petit libellé, puis la commande. */
export function FieldChip({ label, children, as: Tag = 'div' }: FieldChipProps) {
  return (
    <Tag
      className={`inline-flex items-center gap-2 rounded-md border border-line bg-canvas px-2.5 py-1 ${Tag === 'label' ? 'cursor-pointer' : ''}`}
    >
      <span className="text-[10px] font-bold tracking-wider text-ink-muted uppercase">{label}</span>
      {children}
    </Tag>
  )
}

/** Ligne encadrée d'une liste de la fiche (condition, usage). */
export function DetailRow({ children }: { readonly children: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-md border border-line bg-canvas/60 px-2.5 py-1">
      {children}
    </li>
  )
}
