import { useState, type FormEvent } from 'react'
import { ActionMenu } from '../../components/ActionMenu'
import { tr } from '../../i18n/locale'
import { useAppStore } from '../../store/appStore'
import type { GridLayoutState } from '../../store/state'

const BUTTON = 'h-9 rounded-lg border border-line px-3 text-sm text-ink-muted transition-colors hover:bg-panel-raised hover:text-ink'

interface LayoutToolbarProps {
  readonly greenhouse: number
  readonly layouts: readonly GridLayoutState[]
  readonly active: GridLayoutState
}

/**
 * Plans du greenhouse, dans la barre du haut : le plan affiché, et ses actions dans le menu « ⋯ »
 * (nouveau, dupliquer, renommer, vider, supprimer). Renommer remplace le choix par un champ.
 */
export function LayoutToolbar({ greenhouse, layouts, active }: LayoutToolbarProps) {
  const setActiveLayout = useAppStore((s) => s.setActiveLayout)
  const addLayout = useAppStore((s) => s.addLayout)
  const duplicateLayout = useAppStore((s) => s.duplicateLayout)
  const renameLayout = useAppStore((s) => s.renameLayout)
  const deleteLayout = useAppStore((s) => s.deleteLayout)
  const clearCrops = useAppStore((s) => s.clearCrops)
  const [renaming, setRenaming] = useState<string | null>(null)

  function submitRename(event: FormEvent) {
    event.preventDefault()
    if (renaming !== null) renameLayout(greenhouse, active.id, renaming)
    setRenaming(null)
  }

  if (renaming !== null) {
    return (
      <form onSubmit={submitRename} className="flex items-center gap-2">
        <input
          autoFocus
          aria-label={tr('Nouveau nom du plan', 'New plan name')}
          value={renaming}
          maxLength={60}
          onChange={(event) => setRenaming(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setRenaming(null)
          }}
          className="h-9 w-48 rounded-lg border border-line bg-canvas px-3 text-sm text-ink"
        />
        <button type="submit" className={BUTTON}>
          {tr('Valider', 'Save')}
        </button>
        <button type="button" onClick={() => setRenaming(null)} className={BUTTON}>
          {tr('Annuler', 'Cancel')}
        </button>
      </form>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label={tr('Plan affiché', 'Plan shown')}
        value={active.id}
        onChange={(event) => setActiveLayout(greenhouse, event.target.value)}
        className="h-9 max-w-56 rounded-lg border border-line bg-canvas px-2.5 text-sm text-ink"
      >
        {layouts.map((layout) => (
          <option key={layout.id} value={layout.id}>
            {layout.name}
          </option>
        ))}
      </select>
      <ActionMenu
        label={tr('Actions du plan', 'Plan actions')}
        actions={[
          { label: tr('Nouveau plan', 'New plan'), onSelect: () => addLayout(greenhouse) },
          { label: tr('Dupliquer', 'Duplicate'), onSelect: () => duplicateLayout(greenhouse, active.id) },
          { label: tr('Renommer', 'Rename'), onSelect: () => setRenaming(active.name) },
          {
            label: tr('Vider (garder le sol)', 'Clear (keep the soil)'),
            onSelect: () => {
              if (window.confirm(tr(`Retirer tous les crops de « ${active.name} » ? Le sol est gardé.`, `Remove every crop from “${active.name}”? The soil is kept.`))) {
                clearCrops(greenhouse, active.id)
              }
            },
          },
          {
            label: tr('Supprimer', 'Delete'),
            danger: true,
            onSelect: () => {
              if (window.confirm(tr(`Supprimer le plan « ${active.name} » ?`, `Delete the plan “${active.name}”?`))) deleteLayout(greenhouse, active.id)
            },
          },
        ]}
      />
    </div>
  )
}
