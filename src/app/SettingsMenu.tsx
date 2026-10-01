import { useEffect, useId, useRef, useState } from 'react'
import { useImportDialog } from '../features/profile/importDialogStore'
import { PROFILE_IMPORT_VISIBLE } from '../features/profile/profileApi'
import { tr } from '../i18n/locale'
import { useAppStore } from '../store/appStore'
import { LanguageSwitch } from './LanguageSwitch'

/**
 * Changer de langue redessine toute l'application (AppShell a la langue pour clé) : le menu,
 * recréé, se rouvre grâce à ce drapeau au lieu de se fermer sous le clic.
 */
let reopenAfterLocaleChange = false

const SECTION_TITLE = 'mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted'
const BUTTON = 'rounded-lg border border-line px-3 py-1.5 text-sm transition-colors hover:border-accent/60 hover:bg-panel-raised'

function GearIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="3" />
      <path
        strokeLinejoin="round"
        d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"
      />
    </svg>
  )
}

/** Profil Hypixel lié : l'actualiser ou en importer un autre. */
function ProfileSettings({ onDone }: { readonly onDone: () => void }) {
  const name = useAppStore((s) => s.settings.player.name)
  const show = useImportDialog((s) => s.show)
  const search = useImportDialog((s) => s.search)
  const run = (action: () => void) => () => {
    onDone()
    action()
  }
  if (!name) {
    return (
      <>
        <p className="mb-2 text-sm text-ink-muted">{tr('Aucun profil importé.', 'No profile imported.')}</p>
        <button type="button" onClick={run(show)} className={BUTTON}>
          {tr('Importer mon profil', 'Import my profile')}
        </button>
      </>
    )
  }
  return (
    <>
      <p className="mb-2 text-sm">
        {tr('Joueur : ', 'Player: ')}
        <strong>{name}</strong>
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={run(() => search(name))} className={BUTTON}>
          {tr('Actualiser', 'Refresh')}
        </button>
        <button type="button" onClick={run(show)} className={BUTTON}>
          {tr('Changer de joueur', 'Change player')}
        </button>
      </div>
    </>
  )
}

/** Bouton « Réglages » de l'en-tête et son menu : langue et profil Hypixel. */
export function SettingsMenu() {
  const panelId = useId()
  const [open, setOpen] = useState(() => {
    const reopen = reopenAfterLocaleChange
    reopenAfterLocaleChange = false
    return reopen
  })
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)

  // Fermé par Échap (le focus revient au bouton) ou par un clic en dehors.
  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpen(false)
      button.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="app-nav-pill flex items-center gap-2"
      >
        <span className="sr-only sm:not-sr-only">{tr('Réglages', 'Settings')}</span>
        <GearIcon />
      </button>
      {open && (
        <div
          id={panelId}
          role="region"
          aria-label={tr('Réglages', 'Settings')}
          className="absolute top-full right-0 z-30 bg-panel-solid/95 mt-2 w-72 animate-fade-up space-y-4 rounded-2xl border border-white/10 p-4 shadow-xl shadow-black/40"
        >
          <section>
            <h2 className={SECTION_TITLE}>{tr('Langue', 'Language')}</h2>
            <LanguageSwitch onChange={() => (reopenAfterLocaleChange = true)} />
          </section>
          {PROFILE_IMPORT_VISIBLE && (
            <section>
              <h2 className={SECTION_TITLE}>{tr('Profil Hypixel', 'Hypixel profile')}</h2>
              <ProfileSettings onDone={() => setOpen(false)} />
            </section>
          )}
        </div>
      )}
    </div>
  )
}
