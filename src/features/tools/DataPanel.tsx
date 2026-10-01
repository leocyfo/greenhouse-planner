import { useRef, useState, type ChangeEvent } from 'react'
import { Panel } from '../../components/Panel'
import { getGameData } from '../../data'
import { wikiImageFiles } from '../../data/wikiImages'
import { tr } from '../../i18n/locale'
import { DEFAULT_STATE, useAppStore } from '../../store/appStore'
import { exportFileName, parseProgressFile, SCHEMA_VERSION, serializeProgressFile } from '../../store/persistence'
import type { PersistedState } from '../../store/state'

const BUTTON = 'h-9 rounded-lg border border-line px-3 text-sm text-ink-muted transition-colors hover:bg-panel-raised hover:text-ink'

/** Télécharge un texte sous forme de fichier. */
function download(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

type Status = { readonly kind: 'success' | 'error'; readonly text: string } | null

/** Sauvegarde : export, import et réinitialisation ; et quelques informations sur les données. */
export function DataPanel() {
  const data = getGameData()
  const replaceState = useAppStore((s) => s.replaceState)
  const resetAll = useAppStore((s) => s.resetAll)
  const fileInput = useRef<HTMLInputElement>(null)
  const [pendingImport, setPendingImport] = useState<PersistedState | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [status, setStatus] = useState<Status>(null)

  function exportProgress() {
    const { progress, settings, calculator, grids, tools } = useAppStore.getState()
    download(exportFileName(), serializeProgressFile({ progress, settings, calculator, grids, tools }))
    setStatus({ kind: 'success', text: tr('Fichier de sauvegarde téléchargé.', 'Save file downloaded.') })
  }

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // pour pouvoir réimporter le même fichier
    if (!file) return
    const result = parseProgressFile(await file.text(), DEFAULT_STATE)
    if (result.ok) {
      setPendingImport(result.state)
      setStatus(null)
    } else {
      setStatus({ kind: 'error', text: result.error })
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title={tr('Sauvegarde', 'Save')}>
        <div className="space-y-3 text-sm">
          <p className="text-ink-muted">
            {tr(
              'Ta progression (inventaire, objectifs, calculateur, grilles, réglages) est enregistrée automatiquement dans ce navigateur. Exporte-la pour la garder ou la passer sur un autre appareil.',
              'Your progress (inventory, goals, calculator, grids, settings) is saved automatically in this browser. Export it to keep it or move it to another device.',
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={exportProgress} className={BUTTON}>
              {tr('Exporter ma progression', 'Export my progress')}
            </button>
            <button type="button" onClick={() => fileInput.current?.click()} className={BUTTON}>
              {tr('Importer un fichier', 'Import a file')}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              onChange={(event) => void readFile(event)}
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
            />
            <button type="button" onClick={() => setConfirmReset(true)} className={`${BUTTON} hover:text-danger`}>
              {tr('Réinitialiser', 'Reset')}
            </button>
          </div>

          {pendingImport && (
            <div role="alertdialog" aria-label={tr("Confirmer l'import", 'Confirm the import')} className="rounded-lg border border-warning/50 bg-warning/10 p-3">
              <p>{tr('Remplacer toute ta progression actuelle par celle de ce fichier ?', 'Replace all your current progress with the one from this file?')}</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    replaceState(pendingImport)
                    setPendingImport(null)
                    setStatus({ kind: 'success', text: tr('Progression importée.', 'Progress imported.') })
                  }}
                  className="h-9 rounded-lg bg-accent px-3 text-sm font-medium text-canvas hover:bg-accent-strong"
                >
                  {tr('Oui, importer', 'Yes, import')}
                </button>
                <button type="button" onClick={() => setPendingImport(null)} className={BUTTON}>
                  {tr('Annuler', 'Cancel')}
                </button>
              </div>
            </div>
          )}

          {confirmReset && (
            <div
              role="alertdialog"
              aria-label={tr('Confirmer la réinitialisation', 'Confirm the reset')}
              className="animate-fade-up rounded-lg border border-danger/50 bg-danger/10 p-3"
            >
              <p>
                {tr(
                  "Tout effacer et revenir aux valeurs de départ ? Exporte d'abord ta progression si tu veux la garder.",
                  'Erase everything and go back to the starting values? Export your progress first if you want to keep it.',
                )}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    resetAll()
                    setConfirmReset(false)
                    setStatus({ kind: 'success', text: tr('Progression réinitialisée.', 'Progress reset.') })
                  }}
                  className="h-9 rounded-lg bg-danger px-3 text-sm font-medium text-canvas"
                >
                  {tr('Oui, tout effacer', 'Yes, erase everything')}
                </button>
                <button type="button" onClick={() => setConfirmReset(false)} className={BUTTON}>
                  {tr('Annuler', 'Cancel')}
                </button>
              </div>
            </div>
          )}

          <p aria-live="polite" className={status?.kind === 'error' ? 'text-danger' : 'text-accent-strong'}>
            <span key={status?.text} className="inline-block animate-fade-in">
              {status?.text}
            </span>
          </p>
          <p className="text-xs text-ink-muted">{tr(`Format de sauvegarde : version ${SCHEMA_VERSION}.`, `Save format: version ${SCHEMA_VERSION}.`)}</p>
        </div>
      </Panel>

      <Panel title={tr('À propos des données', 'About the data')}>
        <div className="space-y-3 text-sm">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
            <dt className="text-ink-muted">Mutations</dt>
            <dd className="tabular-nums">{data.mutations.length}</dd>
            <dt className="text-ink-muted">{tr('Crops de base', 'Base crops')}</dt>
            <dd className="tabular-nums">{data.baseCrops.length}</dd>
            <dt className="text-ink-muted">{tr('Objectifs', 'Goals')}</dt>
            <dd className="tabular-nums">{data.goals.length}</dd>
            <dt className="text-ink-muted">{tr('Plans du guide AVRG', 'AVRG guide layouts')}</dt>
            <dd className="tabular-nums">{data.layouts.length}</dd>
            <dt className="text-ink-muted">{tr('Images du wiki (crédits en bas de page)', 'Wiki images (credits at the bottom of the page)')}</dt>
            <dd className="tabular-nums">{wikiImageFiles().length}</dd>
          </dl>
          <div>
            <p className="text-xs text-ink-muted">Sources</p>
            <ul className="list-disc pl-4 text-ink-muted">
              {data.meta.sources.map((source) => (
                <li key={source}>{source}</li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-ink-muted">
            {tr('Toutes les données viennent de ', 'All the data comes from ')}
            <code className="rounded bg-panel-raised px-1">src/data/mutations.json</code>{' '}
            {tr(
              `(version ${data.meta.dataVersion}) : il suffit de modifier ce fichier pour corriger une valeur.`,
              `(version ${data.meta.dataVersion}): editing this file is enough to fix a value.`,
            )}
          </p>
        </div>
      </Panel>
    </div>
  )
}
