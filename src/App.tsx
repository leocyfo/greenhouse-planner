import { AppShell } from './app/AppShell'
import { DataErrorScreen } from './components/DataErrorScreen'
import { gameDataLoad } from './data'
import { DEFAULT_LOCALE, setLocale } from './i18n/locale'
import { useAppStore } from './store/appStore'

export default function App() {
  // Langue choisie, sinon l'anglais. Changer de langue redessine toute l'application
  // (clé de AppShell) : chaque texte, données comprises, est relu dans la nouvelle langue.
  const locale = useAppStore((s) => s.settings.locale) ?? DEFAULT_LOCALE
  setLocale(locale)
  // Si mutations.json est invalide, on n'affiche rien d'autre : tout le reste en dépend.
  if (!gameDataLoad.ok) return <DataErrorScreen issues={gameDataLoad.issues} />
  return <AppShell key={locale} />
}
