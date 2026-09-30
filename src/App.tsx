import { AppShell } from './app/AppShell'
import { DataErrorScreen } from './components/DataErrorScreen'
import { gameDataLoad } from './data'

export default function App() {
  // Si mutations.json est invalide, on n'affiche rien d'autre : tout le reste en dépend.
  if (!gameDataLoad.ok) return <DataErrorScreen issues={gameDataLoad.issues} />
  return <AppShell />
}
