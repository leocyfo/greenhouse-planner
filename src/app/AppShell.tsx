import { lazy, Suspense, useEffect } from 'react'
import { tabElementId, tabPanelId } from '../components/tabIds'
import { Tabs } from '../components/Tabs'
import { DashboardTab } from '../features/dashboard/DashboardTab'
import { GridTab } from '../features/grid/GridTab'
import { GuideTab } from '../features/guide/GuideTab'
import { InventoryTab } from '../features/inventory/InventoryTab'
import { ToolsTab } from '../features/tools/ToolsTab'
import { PlayerButton } from '../features/profile/PlayerButton'
import { PlayerImportDialog } from '../features/profile/PlayerImportDialog'
import { tr } from '../i18n/locale'
import { AppFooter } from './AppFooter'
import { APP_NAME, APP_VERSION, Logo } from './brand'
import { SettingsMenu } from './SettingsMenu'
import { DEFAULT_TAB, FULL_WIDTH_TABS, TAB_IDS, TABS, tabLabel, type TabId } from './tabs'
import { useHashTab } from './useHashTab'

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
    case 'guide':
      return <GuideTab />
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
        En-tête à la manière de SkyCrypt : toute la largeur, en verre dépoli. Le nom et la version à
        gauche (lien vers l'accueil), les onglets au centre, le profil et les réglages à droite.
        Plus étroit : les onglets passent sur une deuxième ligne, qui défile.
      */}
      <header className="app-header-bar sticky top-0 z-20 border-b border-white/10 shadow-lg shadow-black/20">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-2 sm:px-4 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <a
            href={`#/${DEFAULT_TAB}`}
            title={tr('Accueil', 'Home')}
            className="col-start-1 row-start-1 flex min-w-0 items-center gap-2.5 justify-self-start rounded-lg pr-2"
          >
            <Logo className="size-8 shrink-0" />
            <div className="min-w-0 leading-tight">
              <h1 className="truncate text-lg font-bold tracking-tight">{APP_NAME}</h1>
              <p className="text-[11px] text-ink-muted">{APP_VERSION}</p>
            </div>
          </a>
          <Tabs
            tabs={tabs}
            selected={tab.id}
            onSelect={selectTab}
            idPrefix={TAB_PREFIX}
            label={tr("Sections de l'application", 'App sections')}
            variant="nav"
            className="col-span-2 row-start-2 p-0.5 md:justify-center xl:col-span-1 xl:col-start-2 xl:row-start-1"
          />
          <div className="col-start-2 row-start-1 flex items-center justify-end gap-2 xl:col-start-3">
            <PlayerButton />
            <SettingsMenu />
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
