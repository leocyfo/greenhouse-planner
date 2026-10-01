import { AppShell } from './app/AppShell'
import { DataErrorScreen } from './components/DataErrorScreen'
import { gameDataLoad } from './data'
import { browserLocale, setLocale } from './i18n/locale'
import { useAppStore } from './store/appStore'

export default function App() {
  // Langue choisie, sinon celle du navigateur. Changer de langue redessine toute l'application
  // (clé de AppShell) : chaque texte, données comprises, est relu dans la nouvelle langue.
  const locale = useAppStore((s) => s.settings.locale) ?? browserLocale()
  setLocale(locale)
  // Si mutations.json est invalide, on n'affiche rien d'autre : tout le reste en dépend.
  if (!gameDataLoad.ok) return <DataErrorScreen issues={gameDataLoad.issues} />
  return <AppShell key={locale} />
}
