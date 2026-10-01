import type { Overlays } from './gridTypes'
import { tr } from '../../i18n/locale'

/** Superpositions (textes lus à l'affichage : ils suivent la langue). */
const options = (): readonly { readonly key: keyof Overlays; readonly label: string }[] => [
  { key: 'spawns', label: tr('Spawns possibles', 'Possible spawns') },
  { key: 'conflicts', label: tr('Conflits', 'Conflicts') },
  { key: 'effects', label: tr('Effets reçus', 'Received effects') },
  { key: 'water', label: tr("Niveau d'eau", 'Water level') },
]

/** Superpositions affichables sur la grille. */
export function OverlayToggles({ value, onChange }: { readonly value: Overlays; readonly onChange: (value: Overlays) => void }) {
  return (
    <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <legend className="sr-only">{tr('Superpositions', 'Overlays')}</legend>
      <span aria-hidden="true" className="text-xs text-ink-muted">
        {tr('Afficher :', 'Show:')}
      </span>
      {options().map((option) => (
        <label key={option.key} className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={value[option.key]}
            onChange={(event) => onChange({ ...value, [option.key]: event.target.checked })}
            className="size-4 accent-accent"
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  )
}
