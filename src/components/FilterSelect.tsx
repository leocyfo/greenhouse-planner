interface FilterSelectProps<T extends string> {
  readonly label: string
  readonly value: T
  readonly options: readonly { readonly value: T; readonly label: string }[]
  readonly onChange: (value: T) => void
}

/** Liste déroulante native avec son libellé visible. */
export function FilterSelect<T extends string>({ label, value, options, onChange }: FilterSelectProps<T>) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs text-ink-muted">
      {label}
      <select
        value={value}
        onChange={(event) => {
          const selected = options.find((option) => option.value === event.target.value)
          if (selected) onChange(selected.value)
        }}
        className="h-9 rounded-lg border border-line bg-canvas px-2.5 text-sm text-ink"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
