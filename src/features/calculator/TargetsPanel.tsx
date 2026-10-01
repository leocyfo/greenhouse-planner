import { useState, type FormEvent } from 'react'
import { CropLabel } from '../../components/game/CropLabel'
import { GoalToggleChips } from '../../components/game/GoalToggleChips'
import { formatRarity } from '../../components/labels'
import { NumberStepper } from '../../components/NumberStepper'
import { Panel } from '../../components/Panel'
import { getGameData } from '../../data'
import { tr } from '../../i18n/locale'
import { useAppStore } from '../../store/appStore'
import { MAX_TARGET_QUANTITY } from '../../store/calculator'

/** Choix des cibles : mutations à la main (+ quantité) et objectifs entiers. */
export function TargetsPanel() {
  const data = getGameData()
  const calculator = useAppStore((s) => s.calculator)
  const addTarget = useAppStore((s) => s.addCalculatorTarget)
  const setQuantity = useAppStore((s) => s.setCalculatorTargetQuantity)
  const removeTarget = useAppStore((s) => s.removeCalculatorTarget)
  const setGoal = useAppStore((s) => s.setCalculatorGoal)
  const clear = useAppStore((s) => s.clearCalculator)
  const [selected, setSelected] = useState(data.mutations[0]?.id ?? '')
  const [quantity, setQuantityToAdd] = useState(1)

  const hasContent = calculator.targets.length > 0 || calculator.goalIds.length > 0

  function submit(event: FormEvent) {
    event.preventDefault()
    if (data.mutationsById.has(selected)) addTarget(selected, quantity)
  }

  return (
    <Panel
      title={tr('Cibles', 'Targets')}
      actions={
        hasContent && (
          <button type="button" onClick={clear} className="text-xs text-ink-muted underline-offset-2 hover:text-ink hover:underline">
            {tr('Tout effacer', 'Clear all')}
          </button>
        )
      }
    >
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs text-ink-muted">
          Mutation
          <select
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            className="h-9 rounded-lg border border-line bg-canvas px-2.5 text-sm text-ink"
          >
            {data.rarities.map((rarity) => (
              <optgroup key={rarity} label={formatRarity(rarity)}>
                {data.mutations
                  .filter((m) => m.rarity === rarity)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-1 text-xs text-ink-muted">
          <span aria-hidden="true">{tr('Quantité', 'Quantity')}</span>
          <NumberStepper
            value={quantity}
            onChange={setQuantityToAdd}
            name={tr('Quantité à ajouter', 'Quantity to add')}
            inputLabel={tr('Quantité à ajouter', 'Quantity to add')}
            min={1}
            max={MAX_TARGET_QUANTITY}
          />
        </div>
        <button
          type="submit"
          className="h-9 rounded-lg bg-accent px-4 text-sm font-medium text-canvas transition-colors hover:bg-accent-strong"
        >
          {tr('Ajouter', 'Add')}
        </button>
      </form>

      {calculator.targets.length > 0 && (
        <ul className="mt-4 space-y-2" aria-label={tr('Mutations ciblées', 'Targeted mutations')}>
          {calculator.targets.map((target) => {
            const name = data.mutationsById.get(target.mutationId)?.name ?? target.mutationId
            return (
              <li key={target.mutationId} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm">
                  <CropLabel crop={{ kind: 'mutation', id: target.mutationId }} />
                </span>
                <NumberStepper
                  value={target.quantity}
                  onChange={(value) => setQuantity(target.mutationId, value)}
                  name={name}
                  inputLabel={tr(`${name} : quantité voulue`, `${name}: wanted quantity`)}
                  min={1}
                  max={MAX_TARGET_QUANTITY}
                />
                <button
                  type="button"
                  aria-label={tr(`Retirer ${name} des cibles`, `Remove ${name} from the targets`)}
                  onClick={() => removeTarget(target.mutationId)}
                  className="flex size-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-panel-raised hover:text-danger"
                >
                  <span aria-hidden="true">✕</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-4 border-t border-line pt-4">
        <p className="mb-2 text-xs text-ink-muted">{tr('Ou ajouter tout un objectif :', 'Or add a whole goal:')}</p>
        <GoalToggleChips selected={calculator.goalIds} onToggle={setGoal} label={tr('Objectifs ajoutés comme cibles', 'Goals added as targets')} />
      </div>
    </Panel>
  )
}
