import { useState } from 'react'
import { Panel } from '../../components/Panel'
import { getGameData } from '../../data'
import { tr } from '../../i18n/locale'
import { useAppStore } from '../../store/appStore'

/** Plans du guide AVRG, chargés dans un nouveau plan du greenhouse (onglet « Nouveau plan »). */
export function PresetLoader({ greenhouse }: { readonly greenhouse: number }) {
  const presets = getGameData().layouts
  const loadPreset = useAppStore((s) => s.loadPreset)
  const [presetId, setPresetId] = useState(presets[0]?.id ?? '')
  const preset = presets.find((p) => p.id === presetId)
  if (presets.length === 0) return null

  return (
    <Panel title={tr('Plan du guide AVRG', 'AVRG guide layout')}>
      <div className="space-y-3">
        <select
          aria-label={tr('Plan du guide AVRG', 'AVRG guide layout')}
          value={presetId}
          onChange={(event) => setPresetId(event.target.value)}
          className="h-9 w-full rounded-lg border border-line bg-canvas px-2.5 text-sm text-ink"
        >
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {preset?.notes && <p className="text-xs text-ink-muted">{preset.notes}</p>}
        <button
          type="button"
          onClick={() => loadPreset(greenhouse, presetId)}
          className="h-9 w-full rounded-lg bg-accent px-3 text-sm font-medium text-canvas transition-colors hover:bg-accent-strong"
        >
          {tr('Charger dans un nouveau plan', 'Load into a new plan')}
        </button>
      </div>
    </Panel>
  )
}
