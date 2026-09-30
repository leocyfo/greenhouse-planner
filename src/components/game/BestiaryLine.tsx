import type { BestiaryEntry } from '../../types/game'

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
        <span>: {entry.maxKills === null ? 'kills max inconnus' : `${entry.maxKills} kills max`}</span>
      </p>
      {showSource && <p className="text-xs text-ink-muted">{entry.source}</p>}
    </div>
  )
}
