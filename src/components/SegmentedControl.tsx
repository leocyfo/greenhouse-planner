interface SegmentOption<T extends string> {
  readonly value: T
  readonly label: string
  /** Explication affichée au survol. */
  readonly description?: string
}

interface SegmentedControlProps<T extends string> {
  /** Nom accessible du groupe. */
  readonly legend: string
  readonly name: string
  readonly options: readonly SegmentOption<T>[]
  readonly value: T
  readonly onChange: (value: T) => void
}

/** Choix exclusif sous forme de boutons accolés (boutons radio natifs : flèches au clavier). */
export function SegmentedControl<T extends string>({ legend, name, options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>
      <div className="inline-flex rounded-lg border border-line bg-canvas p-0.5">
        {options.map((option) => (
          <label
            key={option.value}
            title={option.description}
            className="cursor-pointer rounded-md px-3 py-1 text-sm text-ink-muted transition-colors hover:text-ink has-checked:bg-panel-raised has-checked:font-medium has-checked:text-ink has-checked:shadow-sm has-focus-visible:outline-2 has-focus-visible:outline-accent"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
