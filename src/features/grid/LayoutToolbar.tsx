import { useState, type FormEvent } from 'react'
import { getGameData } from '../../data'
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
 * Plans du greenhouse : choisir, créer, dupliquer, renommer, supprimer, vider, charger un plan AVRG.
 * Sur une seule ligne quand la place le permet, pour laisser la hauteur à la grille.
 */
export function LayoutToolbar({ greenhouse, layouts, active }: LayoutToolbarProps) {
  const presets = getGameData().layouts
  const setActiveLayout = useAppStore((s) => s.setActiveLayout)
  const addLayout = useAppStore((s) => s.addLayout)
  const duplicateLayout = useAppStore((s) => s.duplicateLayout)
  const renameLayout = useAppStore((s) => s.renameLayout)
  const deleteLayout = useAppStore((s) => s.deleteLayout)
  const clearCrops = useAppStore((s) => s.clearCrops)
  const loadPreset = useAppStore((s) => s.loadPreset)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [presetId, setPresetId] = useState(presets[0]?.id ?? '')
  const preset = presets.find((p) => p.id === presetId)

  function submitRename(event: FormEvent) {
    event.preventDefault()
    if (renaming !== null) renameLayout(greenhouse, active.id, renaming)
    setRenaming(null)
  }

  return (
    <div className="rounded-xl border border-line bg-panel p-3">
      <div className="flex flex-wrap items-end gap-2">
        {renaming === null ? (
          <label className="flex min-w-48 flex-col gap-1 text-xs text-ink-muted">
            {tr('Plan', 'Plan')}
            <select
              value={active.id}
              onChange={(event) => setActiveLayout(greenhouse, event.target.value)}
              className="h-9 rounded-lg border border-line bg-canvas px-2.5 text-sm text-ink"
            >
              {layouts.map((layout) => (
                <option key={layout.id} value={layout.id}>
                  {layout.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <form onSubmit={submitRename} className="flex items-end gap-2">
            <label className="flex min-w-48 flex-col gap-1 text-xs text-ink-muted">
              {tr('Nouveau nom', 'New name')}
              <input
                autoFocus
                value={renaming}
                maxLength={60}
                onChange={(event) => setRenaming(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setRenaming(null)
                }}
                className="h-9 rounded-lg border border-line bg-canvas px-3 text-sm text-ink"
              />
            </label>
            <button type="submit" className={BUTTON}>
              {tr('Valider', 'Save')}
            </button>
            <button type="button" onClick={() => setRenaming(null)} className={BUTTON}>
              {tr('Annuler', 'Cancel')}
            </button>
          </form>
        )}
        {renaming === null && (
          <>
            <button type="button" onClick={() => addLayout(greenhouse)} className={BUTTON}>
              {tr('Nouveau', 'New')}
            </button>
            <button type="button" onClick={() => duplicateLayout(greenhouse, active.id)} className={BUTTON}>
              {tr('Dupliquer', 'Duplicate')}
            </button>
            <button type="button" onClick={() => setRenaming(active.name)} className={BUTTON}>
              {tr('Renommer', 'Rename')}
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(tr(`Retirer tous les crops de « ${active.name} » ? Le sol est gardé.`, `Remove every crop from “${active.name}”? The soil is kept.`))) {
                  clearCrops(greenhouse, active.id)
                }
              }}
              className={BUTTON}
            >
              {tr('Vider', 'Clear')}
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(tr(`Supprimer le plan « ${active.name} » ?`, `Delete the plan “${active.name}”?`))) deleteLayout(greenhouse, active.id)
              }}
              className={`${BUTTON} hover:text-danger`}
            >
              {tr('Supprimer', 'Delete')}
            </button>
          </>
        )}

        {presets.length > 0 && (
          <div className="ml-auto flex flex-wrap items-end gap-2">
            <label className="flex min-w-56 flex-col gap-1 text-xs text-ink-muted">
              {tr('Plan du guide AVRG', 'AVRG guide layout')}
              <select
                value={presetId}
                onChange={(event) => setPresetId(event.target.value)}
                className="h-9 rounded-lg border border-line bg-canvas px-2.5 text-sm text-ink"
              >
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => loadPreset(greenhouse, presetId)}
              className="h-9 rounded-lg bg-accent px-3 text-sm font-medium text-canvas transition-colors hover:bg-accent-strong"
            >
              {tr('Charger dans un nouveau plan', 'Load into a new plan')}
            </button>
          </div>
        )}
      </div>
      {preset?.notes && <p className="mt-2 text-xs text-ink-muted">{preset.notes}</p>}
    </div>
  )
}
