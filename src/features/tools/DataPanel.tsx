import { useRef, useState, type ChangeEvent } from 'react'
import { Panel } from '../../components/Panel'
import { getGameData } from '../../data'
import { wikiImageFiles } from '../../data/wikiImages'
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
    setStatus({ kind: 'success', text: 'Fichier de sauvegarde téléchargé.' })
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
      <Panel title="Sauvegarde">
        <div className="space-y-3 text-sm">
          <p className="text-ink-muted">
            Ta progression (inventaire, objectifs, calculateur, grilles, réglages) est enregistrée automatiquement dans ce
            navigateur. Exporte-la pour la garder ou la passer sur un autre appareil.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={exportProgress} className={BUTTON}>
              Exporter ma progression
            </button>
            <button type="button" onClick={() => fileInput.current?.click()} className={BUTTON}>
              Importer un fichier
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
              Réinitialiser
            </button>
          </div>

          {pendingImport && (
            <div role="alertdialog" aria-label="Confirmer l'import" className="rounded-lg border border-warning/50 bg-warning/10 p-3">
              <p>Remplacer toute ta progression actuelle par celle de ce fichier ?</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    replaceState(pendingImport)
                    setPendingImport(null)
                    setStatus({ kind: 'success', text: 'Progression importée.' })
                  }}
                  className="h-9 rounded-lg bg-accent px-3 text-sm font-medium text-canvas hover:bg-accent-strong"
                >
                  Oui, importer
                </button>
                <button type="button" onClick={() => setPendingImport(null)} className={BUTTON}>
                  Annuler
                </button>
              </div>
            </div>
          )}

          {confirmReset && (
            <div role="alertdialog" aria-label="Confirmer la réinitialisation" className="animate-fade-up rounded-lg border border-danger/50 bg-danger/10 p-3">
              <p>Tout effacer et revenir aux valeurs de départ ? Exporte d&apos;abord ta progression si tu veux la garder.</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    resetAll()
                    setConfirmReset(false)
                    setStatus({ kind: 'success', text: 'Progression réinitialisée.' })
                  }}
                  className="h-9 rounded-lg bg-danger px-3 text-sm font-medium text-canvas"
                >
                  Oui, tout effacer
                </button>
                <button type="button" onClick={() => setConfirmReset(false)} className={BUTTON}>
                  Annuler
                </button>
              </div>
            </div>
          )}

          <p aria-live="polite" className={status?.kind === 'error' ? 'text-danger' : 'text-accent-strong'}>
            <span key={status?.text} className="inline-block animate-fade-in">
              {status?.text}
            </span>
          </p>
          <p className="text-xs text-ink-muted">Format de sauvegarde : version {SCHEMA_VERSION}.</p>
        </div>
      </Panel>

      <Panel title="À propos des données">
        <div className="space-y-3 text-sm">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
            <dt className="text-ink-muted">Mutations</dt>
            <dd className="tabular-nums">{data.mutations.length}</dd>
            <dt className="text-ink-muted">Crops de base</dt>
            <dd className="tabular-nums">{data.baseCrops.length}</dd>
            <dt className="text-ink-muted">Objectifs</dt>
            <dd className="tabular-nums">{data.goals.length}</dd>
            <dt className="text-ink-muted">Plans du guide AVRG</dt>
            <dd className="tabular-nums">{data.layouts.length}</dd>
            <dt className="text-ink-muted">Images du wiki (crédits en bas de page)</dt>
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
            Toutes les données viennent de <code className="rounded bg-panel-raised px-1">src/data/mutations.json</code> (version{' '}
            {data.meta.dataVersion}) : il suffit de modifier ce fichier pour corriger une valeur.
          </p>
        </div>
      </Panel>
    </div>
  )
}
