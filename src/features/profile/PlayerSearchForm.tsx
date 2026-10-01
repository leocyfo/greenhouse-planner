import { useEffect, useId, useRef, useState } from 'react'
import { tr } from '../../i18n/locale'
import { isPlayerName } from './importText'

interface PlayerSearchFormProps {
  readonly initialName?: string
  readonly onSearch: (name: string) => void
  readonly disabled?: boolean
  /** Place le curseur dans le champ à l'affichage (fenêtre d'import). */
  readonly focusOnMount?: boolean
}

/** Champ « pseudo Minecraft » à la manière de SkyCrypt : grand champ arrondi et bouton loupe. */
export function PlayerSearchForm({ initialName = '', onSearch, disabled = false, focusOnMount = false }: PlayerSearchFormProps) {
  const inputId = useId()
  const errorId = useId()
  const input = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(initialName)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (focusOnMount) input.current?.focus()
  }, [focusOnMount])

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        const trimmed = name.trim()
        if (!isPlayerName(trimmed)) {
          setError(tr('Pseudo invalide : lettres, chiffres et _, 16 caractères au plus.', 'Invalid name: letters, digits and _, 16 characters at most.'))
          return
        }
        setError(null)
        onSearch(trimmed)
      }}
    >
      <label htmlFor={inputId} className="sr-only">
        {tr('Pseudo Minecraft', 'Minecraft name')}
      </label>
      <div className="flex items-center gap-2 rounded-2xl border border-line bg-canvas/80 p-1.5 transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
        <input
          ref={input}
          id={inputId}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={tr('Ton pseudo Minecraft', 'Your Minecraft name')}
          maxLength={16}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="h-11 min-w-0 flex-1 bg-transparent px-3 text-base text-ink outline-none placeholder:text-ink-muted/70 focus-visible:outline-none disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={disabled}
          aria-label={tr('Chercher ce joueur', 'Search this player')}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-canvas transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40 motion-safe:active:scale-95"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  )
}
