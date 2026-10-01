import { getLocale, LOCALES, tr, type Locale } from '../i18n/locale'
import { useAppStore } from '../store/appStore'

const NAMES: Readonly<Record<Locale, string>> = { fr: 'Français', en: 'English' }

/** Choix de la langue (menu Réglages) : français ou anglais, gardé dans la sauvegarde. */
export function LanguageSwitch({ onChange }: { readonly onChange?: () => void }) {
  const setLocale = useAppStore((s) => s.setLocale)
  const current = getLocale()
  return (
    <div role="group" aria-label={tr('Langue', 'Language')} className="grid grid-cols-2 gap-1 rounded-xl border border-line p-1 text-sm">
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          aria-pressed={locale === current}
          onClick={() => {
            if (locale === current) return
            onChange?.()
            setLocale(locale)
          }}
          className="rounded-lg px-3 py-1.5 font-medium text-ink-muted transition-colors hover:text-ink aria-pressed:bg-accent/15 aria-pressed:text-accent-strong"
        >
          {NAMES[locale]}
        </button>
      ))}
    </div>
  )
}
