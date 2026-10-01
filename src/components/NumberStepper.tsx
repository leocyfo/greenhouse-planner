import { useState, type KeyboardEvent } from 'react'
import { tr } from '../i18n/locale'

interface NumberStepperProps {
  readonly value: number
  readonly onChange: (value: number) => void
  /** Ce que l'on compte, pour les noms accessibles (ex. « Chocoberry »). */
  readonly name: string
  /** Nom accessible du champ (par défaut « <name> : nombre possédé »). */
  readonly inputLabel?: string
  readonly min?: number
  readonly max?: number
}

const BUTTON =
  'flex w-8 items-center justify-center text-base text-ink-muted transition-colors hover:bg-panel-raised hover:text-ink disabled:cursor-not-allowed disabled:opacity-40'

/** Compteur − / champ / + ; les flèches haut et bas du clavier ajustent aussi la valeur. */
export function NumberStepper({
  value,
  onChange,
  name,
  inputLabel,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
}: NumberStepperProps) {
  // Texte en cours de saisie ; null = on affiche la valeur reçue.
  const [draft, setDraft] = useState<string | null>(null)
  const clamp = (next: number) => Math.min(max, Math.max(min, next))

  function change(next: number) {
    setDraft(null)
    onChange(clamp(next))
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      change(value + (event.key === 'ArrowUp' ? 1 : -1))
    } else if (event.key === 'Enter') {
      event.currentTarget.blur()
    }
  }

  return (
    <div className="inline-flex h-8 w-fit items-stretch overflow-hidden rounded-lg border border-line bg-canvas">
      <button
        type="button"
        aria-label={tr(`${name} : retirer 1`, `${name}: remove 1`)}
        disabled={value <= min}
        onClick={() => change(value - 1)}
        className={BUTTON}
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label={inputLabel ?? tr(`${name} : nombre possédé`, `${name}: number owned`)}
        value={draft ?? String(value)}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, '')
          setDraft(digits)
          if (digits !== '') onChange(clamp(Number.parseInt(digits, 10)))
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={handleKeyDown}
        className="w-12 border-x border-line bg-transparent text-center text-sm tabular-nums text-ink"
      />
      <button
        type="button"
        aria-label={tr(`${name} : ajouter 1`, `${name}: add 1`)}
        disabled={value >= max}
        onClick={() => change(value + 1)}
        className={BUTTON}
      >
        +
      </button>
    </div>
  )
}
