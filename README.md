# Sky-Helper — Hypixel SkyBlock

Planifie, suis et calcule les 40 mutations du Greenhouse de Hypixel SkyBlock, et tout ce qui en
dépend : le pet Rose Dragon, les crafts, les shards, les Mutations Sacks, les paliers d'analyse
(DNA Analysis Milestones) et le bestiary.

L'application est 100 % statique : pas de serveur, pas de compte. Ta progression reste dans ton
navigateur. Seul l'import depuis Hypixel, facultatif, passe par un petit serveur à mettre en ligne
toi-même (voir [Import depuis Hypixel](#import-depuis-hypixel)).

## Ce que fait l'application

| Onglet | Rôle |
| --- | --- |
| Tableau de bord | Ce que le guide dit de faire maintenant, prochaine mutation à faire pousser, et les objectifs : ce que chacun demande (mutations, coûts), son avancement, à cocher pour guider les calculs |
| Inventaire | Le Mutations Sack du jeu (fiche complète au clic) ou une liste : mutations possédées et analysées, besoins restants, recherche et filtres ; stock importable depuis ton profil Hypixel |
| Encyclopédie | Arbre des recettes par rareté ou par étape. Une mutation choisie : ses ingrédients et ce qu'elle permet de faire, ou tout son chemin jusqu'aux crops de base, et dessous son calcul (quantité voulue, mutations à obtenir, temps estimé) ; ou un objectif entier (Rose Dragon, crafts…) avec tout ce qu'il demande ; fiche détaillée |
| Guide | Un guide par objectif (Rose Dragon Pet, analyser les 40 mutations, crafts…) ou tous réunis, avec les fermes du guide AVRG, une chose à la fois : ce qu'il faut poser maintenant d'après ton stock (fermes réunies dans un greenhouse quand elles tiennent ensemble, comme Gloomgourd + Dustgrain), ce qui pousse (durée et decay de chaque ferme), puis la suite ; fermes finies repliées ; stock relu sur Hypixel en un clic ; l'œuf chez Ludleth |
| Grille | Les 3 greenhouses (10 × 10) : spawns possibles, conflits, effets reçus, eau, plans du guide AVRG |
| Outils | Upgrades du Greenhouse (menu au style Minecraft), durée d'un growth stage, Ethereal Vines, aide-mémoire, sauvegarde |

Les données incertaines ne sont jamais inventées : elles restent marquées dans `mutations.json`
(valeur `null`, `verified: false`, conflits entre sources). L'interface ne leur met pas de badge.

## Lancer le projet

Prérequis : [Node.js](https://nodejs.org/) 22.12 ou plus récent dans la branche 22, ou 24 et plus.

```bash
npm install     # une seule fois
npm run dev     # http://localhost:5173
```

| Commande | Effet |
| --- | --- |
| `npm run dev` | Serveur de développement, rechargé à chaque modification |
| `npm test` | Tests (Vitest) : logique, données, sauvegarde |
| `npm run test:watch` | Tests relancés à chaque modification |
| `npm run lint` | Analyse du code (oxlint) |
| `npm run build` | Vérification des types, puis build de production dans `dist/` |
| `npm run preview` | Sert le build de production en local |
| `npm run images` | Retélécharge les images du wiki (voir « Images ») |

## Modifier les données

Toutes les données de jeu sont dans **[src/data/mutations.json](src/data/mutations.json)** :
mutations, crops de base, effets, mécaniques, objectifs, plans du guide AVRG, bestiary. Aucun
composant ne contient de donnée en dur : corriger le JSON suffit. La section `_meta.fieldDocs` du
fichier explique chaque champ particulier.

### Vérifications au chargement

Le fichier est vérifié à chaque démarrage :

1. **Structure** ([src/data/schema.ts](src/data/schema.ts)) : types, valeurs permises, et clés
   inconnues refusées, ce qui attrape les fautes de frappe dans les noms de champs.
2. **Cohérence** ([src/data/load.ts](src/data/load.ts)) : chaque nom cité existe (crops des
   conditions, objectifs, plans, bestiary…), aucune recette n'est circulaire, les conditions
   tiennent autour de la mutation, les plans sont valides.

En cas de problème, l'application n'essaie pas de calculer avec des données fausses : elle affiche
la liste des erreurs avec leur emplacement, par exemple
`mutations[soggybud].conditions[Melon].count`.

### Donnée inconnue ou douteuse

N'invente pas de valeur :

- valeur inconnue : mets `null` ;
- valeur à confirmer en jeu : ajoute le drapeau `<champ>Verified: false`, par exemple
  `"growthStagesVerified": false` ;
- deux sources en désaccord : garde la valeur retenue et ajoute l'autre dans `conflicts`, sous la
  forme `{ "field": "…", "value": …, "source": "…" }`.

Dans les trois cas, la marque reste dans les données, contrôlée au chargement. L'interface
n'affiche pas de badge « à vérifier » (choix du joueur) : une valeur inconnue s'affiche « ? » ou
« inconnu », et un calcul qui compte une quantité inconnue pour 1 le signale.

### Ajouter un champ, une rareté ou un sol

- **Nouveau champ** : ajoute-le aussi dans `schema.ts`, sinon il est refusé comme clé inconnue.
  Si l'application doit s'en servir, ajoute-le ensuite aux types
  ([src/types/game.ts](src/types/game.ts)) et à la normalisation de `load.ts`.
- **Nouvelle rareté ou nouveau sol** : donne-lui une couleur dans
  [src/theme/palette.ts](src/theme/palette.ts), le seul endroit où les couleurs sont définies.
  Sans couleur, un gris neutre est utilisé.

### Plans de ferme (`layouts`)

Un plan se dessine avec une chaîne par rangée et une légende :

```json
{
  "id": "avrg_blastberry_min",
  "name": "Blastberry : minimum",
  "source": "AVRG",
  "legend": {
    "A": "Ashwreath",
    "C": "Chocoberry",
    "s": { "spot": "Sand", "expect": ["Blastberry"] }
  },
  "rows": ["AACAA", "AsCsA", "CCCCC", "AsCsA", "AACAA"]
}
```

- Un caractère de la légende désigne un crop (`"A": "Ashwreath"`), un crop sur un sol précis
  (`{ "crop": …, "surface": … }`), un sol nu (`{ "surface": "Sand" }`) ou un emplacement de spawn
  attendu (`{ "spot": sol, "expect": [mutations] }`).
- Caractères réservés :
  - `.` case vide, sur le sol `defaultSurface` du plan (à défaut, le premier sol de `surfaces` :
    Farmland) ;
  - `#` case couverte par une mutation 2x2 ou 3x3 listée dans `placements` (ancre en haut à
    gauche, coordonnées à partir de 0) ;
  - `x` bloc cassé.

Les plans servent de modèles dans la Grille et de cas de test : pour chaque emplacement, les tests
vérifient que la grille prévoit exactement les mutations de `expect`.

### Après une modification

```bash
npm test
```

Les tests recoupent les données avec le guide AVRG (quantités de la route Rose Dragon, plans de
ferme) et avec les cas du cahier des charges : une erreur de saisie a de bonnes chances d'être
repérée.

## Images

Les images des mutations, des crops, des sols et des objets viennent du
[Hypixel SkyBlock Wiki](https://hypixel-skyblock.fandom.com/) (Fandom), sous licence CC-BY-SA. Les
textures d'origine appartiennent à Mojang Studios et à Hypixel. Les crédits, avec un lien vers la
page de chaque image, sont affichés en bas de chaque page de l'application.

Les images sont servies avec le site : aucune requête vers Fandom quand on utilise l'application.
Le script [scripts/fetch-wiki-images.mjs](scripts/fetch-wiki-images.mjs) les télécharge dans
`src/assets/wiki/` et écrit le manifeste [src/data/wikiImages.json](src/data/wikiImages.json)
(nom affiché → fichier). Après avoir ajouté une mutation, un crop ou un objectif dans
`mutations.json`, relance :

```bash
npm run images
```

Le script suit les redirections du wiki (Moonflower utilise l'image de la Blue Orchid, par exemple)
et liste les noms sans image. Un nom sans image s'affiche simplement sans icône. Pour les sols, il
remet aussi à plat la face du dessus de chaque bloc en texture 16 × 16 (fichiers `*_top.png`),
utilisée comme fond des cases de la grille.

Le fond de l'application est une capture du Garden : [src/assets/background.webp](src/assets/background.webp),
version WebP (240 Ko) de `Background.png` (1,9 Mo). Pour changer de fond, remplace ce fichier
(le style est dans `.app-background`, [src/index.css](src/index.css)).

## Sauvegarde

La progression est enregistrée automatiquement dans le `localStorage` du navigateur, avec un
numéro de version de format. L'onglet **Outils** permet de l'exporter dans un fichier JSON, de la
réimporter sur un autre appareil et de tout réinitialiser.

Pour les développeurs : si tu changes la forme de l'état sauvegardé
([src/store/state.ts](src/store/state.ts)), incrémente `SCHEMA_VERSION` et ajoute une migration
dans [src/store/persistence.ts](src/store/persistence.ts). Une sauvegarde abîmée n'est jamais
jetée en bloc : chaque champ invalide reprend sa valeur par défaut.

## Déployer sur GitHub Pages

Le workflow [.github/workflows/deploy.yml](.github/workflows/deploy.yml) vérifie, construit et
publie le site à chaque push sur la branche principale (`main` ou `master`).

1. Crée un dépôt sur GitHub et pousse le projet :

   ```bash
   git remote add origin https://github.com/<utilisateur>/<dépôt>.git
   git push -u origin HEAD
   ```

2. Dans le dépôt : **Settings → Pages → Build and deployment → Source : GitHub Actions**.
3. Si le premier run a échoué à l'étape de publication parce que Pages n'était pas encore activé,
   relance-le : onglet **Actions** → *Déploiement GitHub Pages* → **Run workflow**.

Le site est ensuite publié à l'adresse `https://<utilisateur>.github.io/<dépôt>/`, affichée aussi
dans le résumé du workflow.

À chaque push, le workflow lance le lint, les tests et le build ; il ne publie que si tout passe.
Sur une pull request, il vérifie sans publier, ce qui permet de valider une correction des
données avant de la fusionner.

Rien d'autre à configurer :

- `base: './'` dans [vite.config.ts](vite.config.ts) : le build utilise des chemins relatifs et
  fonctionne dans n'importe quel sous-dossier ;
- la navigation passe par le hash de l'URL (`#/grille`) : recharger une page ne donne jamais
  d'erreur 404 ;
- aucun serveur pour le site : la progression de chaque visiteur reste dans son navigateur (seul
  l'import depuis Hypixel, facultatif, en demande un petit : voir ci-dessous).

## Import depuis Hypixel

Comme SkyCrypt, le site peut lire un profil SkyBlock à partir du seul pseudo : sacs (dont le
Mutations Sack), inventaire, ender chest, sacs à dos et coffre personnel. Il compte les mutations
et montre un aperçu (avant → après) ; le stock n'est remplacé qu'après confirmation.

L'API Hypixel demande une clé, qui doit rester secrète : un petit serveur (Cloudflare Worker,
dossier [worker/](worker/)) la garde et fait les appels. Il transforme le pseudo en UUID
([PlayerDB](https://playerdb.co), avec l'API Mojang en secours : Mojang refuse les appels venus
de Cloudflare), lit les profils sur Hypixel et ne renvoie au site que les inventaires. Tant
qu'aucun serveur n'est configuré, l'import est masqué sur le site publié.

La clé Hypixel est limitée à 300 requêtes par 5 minutes, et la dépasser pourrait la faire bannir.
Le serveur ne l'utilise qu'à la demande, jamais en tâche de fond, et ne dépasse jamais la limite :

- **Budget global** (Durable Object, [worker/src/budget.ts](worker/src/budget.ts)) : jamais plus
  de 240 requêtes sur 5 minutes glissantes pour tout le site, 60 de marge sous la limite. Tout
  s'arrête aussi dès que Hypixel annonce moins de 20 requêtes restantes (clé utilisée ailleurs),
  jusqu'au quota suivant. Si le compte ne peut pas être vérifié, Hypixel n'est pas appelé.
- **Cache de 5 minutes** (Workers KV) : un profil lu il y a moins de 5 minutes est renvoyé sans
  rappeler Hypixel. Un joueur coûte donc au plus une requête par fenêtre de quota, même cherché
  ou actualisé en boucle. Le site indique depuis quand le profil a été lu.
- **Secours** : quand le budget est atteint ou que Hypixel ne répond pas, le serveur renvoie les
  dernières données connues (gardées un jour), signalées comme telles ; sinon, il dit combien de
  secondes attendre.
- **Limite par visiteur** : 10 recherches par minute et par adresse IP, pour que personne ne
  puisse épuiser le budget à lui seul.

`npx wrangler tail` (dans `worker/`) montre, à chaque appel, le budget utilisé
(« budget Hypixel : 12/240 sur 5 min ») et le quota restant annoncé par Hypixel.

1. **Clé Hypixel** : sur <https://developer.hypixel.net>, crée une application et demande une
   clé de production (une clé de développement suffit pour essayer, mais expire au bout de
   3 jours).
2. **Compte Cloudflare**, gratuit : <https://dash.cloudflare.com/sign-up>.
3. **Adresse du site** : dans [worker/wrangler.toml](worker/wrangler.toml), mets l'adresse du
   site dans `ALLOWED_ORIGINS` (ex. `https://<utilisateur>.github.io,http://localhost:5173`) ;
   les autres sites seront refusés.
4. **Mise en ligne du serveur** :

   ```bash
   cd worker
   npx wrangler login
   npx wrangler kv namespace create PROFILE_CACHE   # copie l'id affiché dans wrangler.toml
   npx wrangler secret put HYPIXEL_API_KEY          # colle la clé Hypixel
   npx wrangler deploy                              # affiche l'adresse du serveur
   ```

5. **Brancher le site** : dans le dépôt GitHub, **Settings → Secrets and variables → Actions →
   Variables**, crée `PROFILE_API_URL` avec l'adresse affichée par `wrangler deploy` (ex.
   `https://greenhouse-planner-profiles.<compte>.workers.dev`), puis relance le workflow. Le
   dépôt d'origine n'en a pas besoin : son serveur est indiqué par défaut dans
   [le workflow](.github/workflows/deploy.yml). En local, mets l'adresse dans un fichier
   `.env.local` : `VITE_PROFILE_API_URL=https://…`.

Côté joueur, l'« Inventory API » doit être activée dans les réglages API de SkyBlock. Les coffres
de l'île et la grille du greenhouse ne sont pas visibles par l'API. Les identifiants Hypixel des
mutations (`itemId` dans mutations.json) viennent de la liste publique des objets
(`/v2/resources/skyblock/items`).

## Organisation du code

```text
src/
├── data/        mutations.json (source de vérité), schéma, vérifications, manifeste des images
├── assets/wiki/ images du wiki (téléchargées par scripts/fetch-wiki-images.mjs)
├── types/       types du domaine
├── logic/       logique pure et testée : recettes, grille, effets, croissance, objectifs…
├── store/       état (Zustand), sauvegarde, migrations, export et import
├── features/    un dossier par onglet
├── components/  composants réutilisables (badges, onglets, compteurs…)
├── theme/       couleurs des raretés et des sols
└── app/         structure de l'application et navigation entre onglets
worker/          petit serveur de l'import Hypixel (Cloudflare Worker, testé avec Vitest)
docs/SPEC.md     cahier des charges et décisions validées
```

Stack : Vite, React, TypeScript (strict), Tailwind CSS, Zustand, zod et Vitest. Le menu
des upgrades utilise la police libre Pixelify Sans, servie avec le site.

## Sources et avertissement

Données : Hypixel SkyBlock Wiki (pages Mutations et Greenhouse), *The Greenhouse Guide* d'AVRG
(quantités optimales pour le Rose Dragon, plans de ferme, astuces) et captures du menu Greenhouse
Upgrades en jeu. Images : Hypixel SkyBlock Wiki (Fandom), CC-BY-SA ; textures © Mojang Studios et
Hypixel Inc.

Outil de fan non officiel, sans lien avec Hypixel ni Mojang.
