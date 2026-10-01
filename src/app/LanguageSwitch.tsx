import { getLocale, LOCALES, tr, type Locale } from '../i18n/locale'
import { useAppStore } from '../store/appStore'

const NAMES: Readonly<Record<Locale, string>> = { fr: 'Français', en: 'English' }

/** Choix de la langue dans l'en-tête : FR ou EN, gardé dans la sauvegarde. */
export function LanguageSwitch() {
  const setLocale = useAppStore((s) => s.setLocale)
  const current = getLocale()
  return (
    <div role="group" aria-label={tr('Langue', 'Language')} className="flex shrink-0 rounded-full border border-line p-0.5 text-xs">
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          aria-pressed={locale === current}
          aria-label={NAMES[locale]}
          title={NAMES[locale]}
          onClick={() => setLocale(locale)}
          className="rounded-full px-2 py-1 font-semibold uppercase text-ink-muted transition-colors hover:text-ink aria-pressed:bg-panel-raised aria-pressed:text-ink"
        >
          {locale}
        </button>
      ))}
    </div>
  )
}
