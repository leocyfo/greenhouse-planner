import { TREE_COLORS } from '../../theme/palette'
import type { MutationState } from './graphModel'
import { STATE_INFO, STATE_ORDER } from './stateInfo'

function LineSample({ color, dashed = false }: { readonly color: string; readonly dashed?: boolean }) {
  return (
    <svg aria-hidden="true" width="24" height="6">
      <line x1="0" y1="3" x2="24" y2="3" stroke={color} strokeWidth="2" strokeDasharray={dashed ? '5 4' : undefined} />
    </svg>
  )
}

/** Légende toujours visible : états (icône + texte + couleur) et sens des liens. */
export function TreeLegend({ counts }: { readonly counts: ReadonlyMap<MutationState, number> }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-muted" aria-label="Légende de l'arbre">
      {STATE_ORDER.map((state) => {
        const info = STATE_INFO[state]
        return (
          <span key={state} className="inline-flex items-center gap-1.5" title={info.description}>
            <span
              aria-hidden="true"
              className="size-3 rounded-sm border"
              style={{ borderColor: info.color, background: `color-mix(in srgb, ${info.color} 30%, transparent)` }}
            />
            <span aria-hidden="true">{info.icon}</span>
            {info.label}
            <span className="tabular-nums">({counts.get(state) ?? 0})</span>
          </span>
        )
      })}
      <span className="inline-flex items-center gap-1.5">
        <LineSample color={TREE_COLORS.path} />
        chemin
      </span>
      <span className="inline-flex items-center gap-1.5">
        <LineSample color={TREE_COLORS.use} />
        sert à
      </span>
      <span className="inline-flex items-center gap-1.5">
        <LineSample color="currentColor" />
        à poser autour
      </span>
      <span className="inline-flex items-center gap-1.5">
        <LineSample color="currentColor" dashed />
        prérequis spécial (consommé ou catalyseur)
      </span>
      <span>Bord gauche coloré = rareté</span>
    </div>
  )
}
