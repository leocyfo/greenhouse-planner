import type { Overlays } from './gridTypes'
import { tr } from '../../i18n/locale'

/** Superpositions (textes lus à l'affichage : ils suivent la langue). */
const options = (): readonly { readonly key: keyof Overlays; readonly label: string }[] => [
  { key: 'spawns', label: tr('Spawns possibles', 'Possible spawns') },
  { key: 'conflicts', label: tr('Conflits', 'Conflicts') },
  { key: 'effects', label: tr('Effets reçus', 'Received effects') },
  { key: 'water', label: tr("Niveau d'eau", 'Water level') },
]

/** Superpositions affichables sur la grille, en pastilles à bascule dans la barre du haut. */
export function OverlayToggles({ value, onChange }: { readonly value: Overlays; readonly onChange: (value: Overlays) => void }) {
  return (
    <div role="group" aria-label={tr('Afficher sur la grille', 'Show on the grid')} className="flex flex-wrap items-center gap-1.5">
      {options().map((option) => {
        const on = value[option.key]
        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange({ ...value, [option.key]: !on })}
            className={`h-8 rounded-full border px-3 text-xs transition-colors ${
              on ? 'border-accent/60 bg-accent/15 text-accent-strong' : 'border-line text-ink-muted hover:text-ink'
            }`}
          >
            <span aria-hidden="true">{on ? '✓ ' : ''}</span>
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
