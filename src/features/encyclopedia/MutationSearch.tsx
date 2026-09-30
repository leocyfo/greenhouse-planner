/**
 * Recherche d'une mutation par son nom, avec suggestions (combobox : flèches, Entrée, Échap).
 * Pendant la saisie, l'arbre met en avant les cartes qui correspondent.
 */
import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import { WikiIcon } from '../../components/game/WikiIcon'
import { rarityColor } from '../../theme/palette'
import type { Mutation } from '../../types/game'
import type { MutationState } from './graphModel'
import { STATE_INFO } from './stateInfo'

interface MutationSearchProps {
  readonly query: string
  /** Mutations qui correspondent, dans l'ordre des suggestions. */
  readonly results: readonly Mutation[]
  readonly states: ReadonlyMap<string, MutationState>
  readonly onQueryChange: (query: string) => void
  readonly onChoose: (mutationId: string) => void
}

export function MutationSearch({ query, results, states, onQueryChange, onChoose }: MutationSearchProps) {
  const inputId = useId()
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const shown = open && query.trim() !== ''
  const current = results[Math.min(active, results.length - 1)]
  const optionId = (id: string) => `${listId}-${id}`

  useEffect(() => {
    if (shown && current) document.getElementById(optionId(current.id))?.scrollIntoView({ block: 'nearest' })
  })

  const choose = (id: string) => {
    onChoose(id)
    onQueryChange('')
    setOpen(false)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((index) => (results.length === 0 ? 0 : (Math.min(index, results.length - 1) + step + results.length) % results.length))
    } else if (event.key === 'Enter' && shown && current) {
      event.preventDefault()
      choose(current.id)
    } else if (event.key === 'Escape' && (shown || query)) {
      // Échap ferme d'abord les suggestions, puis vide le champ ; ensuite seulement, il revient à tout
      // l'arbre. preventDefault : sinon le navigateur vide lui-même un champ de recherche.
      event.preventDefault()
      event.stopPropagation()
      if (shown) setOpen(false)
      else onQueryChange('')
    }
  }

  return (
    <div className="relative flex w-64 flex-col gap-1 text-xs text-ink-muted">
      <label htmlFor={inputId}>Rechercher une mutation</label>
      <input
        id={inputId}
        type="search"
        role="combobox"
        aria-expanded={shown}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={shown && current ? optionId(current.id) : undefined}
        autoComplete="off"
        spellCheck={false}
        value={query}
        placeholder="Nom, ex. Snoozling"
        onChange={(event) => {
          onQueryChange(event.target.value)
          setOpen(true)
          setActive(0)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className="h-9 rounded-lg border border-line bg-canvas px-3 text-sm text-ink placeholder:text-ink-muted/70"
      />
      {shown && (
        <div className="absolute top-full z-30 mt-1 w-72 rounded-lg border border-line bg-panel-solid p-1 shadow-lg shadow-black/40">
          {results.length === 0 ? (
            <p className="px-2 py-1.5 text-sm">Aucune mutation ne s&apos;appelle ainsi.</p>
          ) : (
            <ul id={listId} role="listbox" aria-label="Suggestions" className="max-h-72 overflow-y-auto">
              {results.map((mutation, index) => {
                const info = STATE_INFO[states.get(mutation.id) ?? 'locked']
                const selected = mutation.id === current?.id
                return (
                  <li
                    key={mutation.id}
                    id={optionId(mutation.id)}
                    role="option"
                    aria-selected={selected}
                    // Garde le focus dans le champ : le clic choisit sans fermer la liste avant.
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(mutation.id)}
                    onMouseEnter={() => setActive(index)}
                    className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm ${selected ? 'bg-panel-raised' : ''}`}
                  >
                    <WikiIcon name={mutation.name} size={18} />
                    <span className="truncate font-medium" style={{ color: rarityColor(mutation.rarity) }}>
                      {mutation.name}
                    </span>
                    <span className="ml-auto shrink-0 text-xs text-ink-muted">
                      <span aria-hidden="true">{info.icon}</span> {info.label}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
