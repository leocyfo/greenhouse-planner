import type { MutationState } from './graphModel'
import { STATE_INFO, STATE_ORDER } from './stateInfo'

/** Légende toujours visible : états (icône + texte + couleur) et types de liens. */
export function GraphLegend({ counts }: { readonly counts: ReadonlyMap<MutationState, number> }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-muted" aria-label="Légende du graphe">
      {STATE_ORDER.map((state) => {
        const info = STATE_INFO[state]
        return (
          <span key={state} className="inline-flex items-center gap-1.5" title={info.description}>
            <span aria-hidden="true" className="size-3 rounded-sm border" style={{ borderColor: info.color, background: `color-mix(in srgb, ${info.color} 30%, transparent)` }} />
            <span aria-hidden="true">{info.icon}</span>
            {info.label}
            <span className="tabular-nums">({counts.get(state) ?? 0})</span>
          </span>
        )
      })}
      <span className="inline-flex items-center gap-1.5">
        <svg aria-hidden="true" width="24" height="6">
          <line x1="0" y1="3" x2="24" y2="3" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        à poser autour
      </span>
      <span className="inline-flex items-center gap-1.5">
        <svg aria-hidden="true" width="24" height="6">
          <line x1="0" y1="3" x2="24" y2="3" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 4" />
        </svg>
        prérequis spécial (consommé ou catalyseur)
      </span>
      <span>Bord gauche coloré = rareté</span>
    </div>
  )
}
