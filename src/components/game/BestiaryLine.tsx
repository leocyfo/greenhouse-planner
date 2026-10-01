import type { BestiaryEntry } from '../../types/game'
import { tr } from '../../i18n/locale'

interface BestiaryLineProps {
  readonly entry: BestiaryEntry
  /** Affiche aussi d'où vient le mob (inutile sur la fiche de la mutation liée). */
  readonly showSource?: boolean
}

/** « Timestalk Clone : 10 kills max » (ou « kills max inconnus »). */
export function BestiaryLine({ entry, showSource = false }: BestiaryLineProps) {
  return (
    <div>
      <p className="flex flex-wrap items-center gap-1.5">
        <span className="text-ink">{entry.mob}</span>
        <span>
          {tr(' : ', ': ')}
          {entry.maxKills === null ? tr('kills max inconnus', 'unknown max kills') : tr(`${entry.maxKills} kills max`, `${entry.maxKills} max kills`)}
        </span>
      </p>
      {showSource && <p className="text-xs text-ink-muted">{entry.source}</p>}
    </div>
  )
}
