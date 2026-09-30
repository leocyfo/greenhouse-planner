import { useEffect, useId, useRef, useState } from 'react'
import { goToTab } from '../../app/navigation'
import { Modal } from '../../components/Modal'
import { getGameData } from '../../data'
import { readInventoryMutations } from '../../logic/hypixel/inventory'
import { useAppStore } from '../../store/appStore'
import { useImportDialog } from './importDialogStore'
import { ImportResult, type FetchedProfile } from './ImportResult'
import { PlayerSearchForm } from './PlayerSearchForm'
import { fetchPlayerProfiles, PROFILE_IMPORT_ENABLED, ProfileApiError, type PlayerProfiles } from './profileApi'

type Step =
  | { readonly kind: 'form'; readonly error: string | null }
  | { readonly kind: 'loading'; readonly name: string }
  | { readonly kind: 'result'; readonly player: PlayerProfiles['player']; readonly profiles: readonly FetchedProfile[] }
  | { readonly kind: 'done'; readonly summary: string }

/** Fenêtre d'import, rendue une fois dans l'application ; une nouvelle recherche repart de zéro. */
export function PlayerImportDialog() {
  const open = useImportDialog((s) => s.open)
  const request = useImportDialog((s) => s.request)
  const hide = useImportDialog((s) => s.hide)
  if (!open) return null
  return (
    <Modal onClose={hide} width="max-w-2xl">
      <ImportFlow key={request?.id ?? 0} initialName={request?.name ?? null} onClose={hide} />
    </Modal>
  )
}

interface ImportFlowProps {
  /** Pseudo à chercher tout de suite (sinon : le formulaire). */
  readonly initialName: string | null
  readonly onClose: () => void
}

/** Étapes : pseudo → recherche → aperçu et confirmation → stock mis à jour. */
function ImportFlow({ initialName, onClose }: ImportFlowProps) {
  const data = getGameData()
  const savedName = useAppStore((s) => s.settings.player.name)
  const titleId = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  const [step, setStep] = useState<Step>(initialName ? { kind: 'loading', name: initialName } : { kind: 'form', error: null })

  // Échap ferme la fenêtre (voir components/Modal) ; le titre reçoit le focus à chaque étape,
  // sauf au formulaire, où le curseur va directement dans le champ.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])
  useEffect(() => {
    if (step.kind !== 'form') heading.current?.focus()
  }, [step.kind])

  useEffect(() => {
    if (step.kind !== 'loading') return
    const controller = new AbortController()
    fetchPlayerProfiles(step.name, controller.signal)
      .then(async (response) => {
        const profiles = await Promise.all(
          response.profiles.map(async (profile) => ({ profile, content: await readInventoryMutations(data, profile.inventory) })),
        )
        if (!controller.signal.aborted) setStep({ kind: 'result', player: response.player, profiles })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setStep({ kind: 'form', error: error instanceof ProfileApiError ? error.message : "L'import a échoué, réessaie plus tard." })
      })
    return () => controller.abort()
  }, [step, data])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="flex max-h-[calc(100dvh-1rem)] flex-col overflow-hidden rounded-2xl border border-line bg-panel-solid shadow-2xl shadow-black/60 sm:max-h-[calc(100dvh-3rem)]"
    >
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <h3 id={titleId} ref={heading} tabIndex={-1} className="flex-1 text-lg font-bold">
          Importer depuis Hypixel
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer l'import"
          className="flex size-8 items-center justify-center rounded-lg text-ink-muted hover:bg-panel-raised hover:text-ink"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </header>

      <div key={step.kind} className="animate-fade-in overflow-y-auto p-4 text-sm">
        {step.kind === 'form' && (
          <div className="space-y-4">
            <p className="text-ink-muted">
              Entre ton pseudo Minecraft : le site lit sur Hypixel tes sacs, ton inventaire, ton ender chest, tes sacs à dos et
              ton coffre personnel, puis compte tes mutations. Tu vois le résultat avant de remplacer ton stock.
            </p>
            {!PROFILE_IMPORT_ENABLED && (
              <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-warning">
                Le serveur de l&apos;import n&apos;est pas configuré : définis VITE_PROFILE_API_URL (voir le README, section
                « Import depuis Hypixel »).
              </p>
            )}
            <PlayerSearchForm
              initialName={savedName}
              onSearch={(name) => setStep({ kind: 'loading', name })}
              disabled={!PROFILE_IMPORT_ENABLED}
              focusOnMount
            />
            {step.error && (
              <p role="alert" className="text-danger">
                {step.error}
              </p>
            )}
            <p className="text-xs text-ink-muted">
              Dans SkyBlock, l&apos;« Inventory API » doit être activée (réglages API) pour que Hypixel partage ton inventaire.
            </p>
          </div>
        )}

        {step.kind === 'loading' && (
          <p role="status" className="flex items-center gap-3 py-6">
            <span aria-hidden="true" className="size-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <span>
              Recherche de <strong>{step.name}</strong> sur Hypixel…
            </span>
          </p>
        )}

        {step.kind === 'result' && (
          <ImportResult
            player={step.player}
            profiles={step.profiles}
            onImported={(summary) => setStep({ kind: 'done', summary })}
            onSearchAgain={() => setStep({ kind: 'form', error: null })}
            onCancel={onClose}
          />
        )}

        {step.kind === 'done' && (
          <div className="space-y-4">
            <p role="status" className="text-accent-strong">
              <span aria-hidden="true">✓ </span>
              {step.summary}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  goToTab('inventaire')
                  onClose()
                }}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-canvas transition hover:bg-accent-strong motion-safe:active:scale-[0.97]"
              >
                Voir mon inventaire
              </button>
              <button type="button" onClick={onClose} className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-panel-raised">
                Fermer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
