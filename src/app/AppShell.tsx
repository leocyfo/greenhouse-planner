import { lazy, Suspense, useEffect } from 'react'
import { tabElementId, tabPanelId } from '../components/tabIds'
import { Tabs } from '../components/Tabs'
import { CalculatorTab } from '../features/calculator/CalculatorTab'
import { DashboardTab } from '../features/dashboard/DashboardTab'
import { GridTab } from '../features/grid/GridTab'
import { InventoryTab } from '../features/inventory/InventoryTab'
import { ToolsTab } from '../features/tools/ToolsTab'
import { PlayerButton } from '../features/profile/PlayerButton'
import { PlayerImportDialog } from '../features/profile/PlayerImportDialog'
import { tr } from '../i18n/locale'
import { AppFooter } from './AppFooter'
import { LanguageSwitch } from './LanguageSwitch'
import { DEFAULT_TAB, FULL_WIDTH_TABS, TAB_IDS, TABS, tabLabel, type TabId } from './tabs'
import { useHashTab } from './useHashTab'

const APP_NAME = 'Greenhouse Planner'
const TAB_PREFIX = 'main'

// L'Encyclopédie n'est téléchargée qu'à son ouverture.
const EncyclopediaTab = lazy(() =>
  import('../features/encyclopedia/EncyclopediaTab').then((module) => ({ default: module.EncyclopediaTab })),
)

function TabContent({ tabId }: { readonly tabId: TabId }) {
  switch (tabId) {
    case 'tableau-de-bord':
      return <DashboardTab />
    case 'inventaire':
      return <InventoryTab />
    case 'encyclopedie':
      return (
        <Suspense fallback={<p className="animate-pulse text-sm text-ink-muted">{tr("Chargement de l'arbre…", 'Loading the tree…')}</p>}>
          <EncyclopediaTab />
        </Suspense>
      )
    case 'calculateur':
      return <CalculatorTab />
    case 'grille':
      return <GridTab />
    case 'outils':
      return <ToolsTab />
  }
}

/**
 * Lien d'évitement vers le contenu, visible seulement au focus. C'est un bouton et non un
 * lien « #contenu » : le hash de l'URL sert déjà à choisir l'onglet.
 */
function SkipToContent({ targetId }: { readonly targetId: string }) {
  return (
    <button
      type="button"
      onClick={() => document.getElementById(targetId)?.focus()}
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-canvas"
    >
      {tr('Aller au contenu', 'Skip to content')}
    </button>
  )
}

/** Structure de l'application : en-tête, onglets, panneau de l'onglet actif et pied de page. */
export function AppShell() {
  const [tabId, selectTab] = useHashTab(TAB_IDS, DEFAULT_TAB)
  const tab = TABS.find((t) => t.id === tabId) ?? TABS[0]
  const label = tabLabel(tab.id)
  const tabs = TABS.map((t) => ({ id: t.id, label: tabLabel(t.id) }))
  const panelId = tabPanelId(TAB_PREFIX, tab.id)

  // Le titre de la page suit l'onglet (historique du navigateur, onglets, lecteurs d'écran).
  useEffect(() => {
    document.title = `${label} · ${APP_NAME}`
  }, [label])

  return (
    <div className="flex min-h-dvh flex-col">
      <div aria-hidden="true" className="app-background" />
      <SkipToContent targetId={panelId} />
      {/*
        Barre flottante à la manière de SkyCrypt : étroite (largeur du contenu), sur une ligne en
        grand écran, en verre dépoli sur le fond. Les côtés vides laissent passer les clics.
      */}
      <header className="pointer-events-none sticky top-0 z-10 px-2 pt-2 sm:px-4 sm:pt-3">
        <div className="app-header-bar pointer-events-auto mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-white/10 px-3 py-2 shadow-lg shadow-black/30 xl:w-fit xl:flex-nowrap">
          <h1 className="whitespace-nowrap px-1 text-base font-semibold tracking-tight">{APP_NAME}</h1>
          <Tabs
            tabs={tabs}
            selected={tab.id}
            onSelect={selectTab}
            idPrefix={TAB_PREFIX}
            label={tr("Sections de l'application", 'App sections')}
            variant="pills"
            className="order-last w-full xl:order-none xl:w-auto xl:min-w-0"
          />
          <div className="ml-auto flex items-center gap-2 xl:ml-1">
            <LanguageSwitch />
            <PlayerButton />
          </div>
        </div>
      </header>

      <main
        role="tabpanel"
        id={panelId}
        aria-labelledby={tabElementId(TAB_PREFIX, tab.id)}
        tabIndex={0}
        className={`mx-auto w-full flex-1 px-4 py-6 sm:px-6 ${FULL_WIDTH_TABS.has(tab.id) ? '' : 'max-w-7xl'}`}
      >
        {/* Une clé par onglet : le contenu arrive en fondu à chaque changement d'onglet. */}
        <div key={tab.id} className="animate-fade-up">
          <TabContent tabId={tab.id} />
        </div>
      </main>

      <AppFooter />
      <PlayerImportDialog />
    </div>
  )
}
