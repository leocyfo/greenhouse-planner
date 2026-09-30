import { useId } from 'react'

interface RangeFieldProps {
  readonly label: string
  readonly value: number
  readonly min: number
  readonly max: number
  readonly step: number
  readonly onChange: (value: number) => void
  /** Valeur affichée (et lue par les lecteurs d'écran), ex. « +25 % ». */
  readonly format: (value: number) => string
}

/** Curseur natif (flèches du clavier comprises) avec son libellé et sa valeur. */
export function RangeField({ label, value, min, max, step, onChange, format }: RangeFieldProps) {
  const id = useId()
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id} className="tabular-nums text-ink-muted">
          {format(value)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={format(value)}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1.5 w-full accent-accent"
      />
    </div>
  )
}
