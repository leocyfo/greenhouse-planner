# Projet : Greenhouse Planner — Hypixel SkyBlock

> Spécification d'origine, reprise telle quelle. Les décisions prises ensuite, après lecture du
> guide AVRG, sont regroupées à la fin : **elles priment sur la spec quand les deux diffèrent**.

Tu vas construire une application web complète pour planifier, suivre et
calculer TOUTES les mutations du Greenhouse de Hypixel SkyBlock, et tout ce
qui en a besoin dans la progression du jeu (Rose Dragon Pet, crafts, pets,
shards, Mutations Sacks, DNA Analysis Milestones, bestiary).

Le fichier `mutations.json` à la racine du projet est la SOURCE UNIQUE de
vérité. Il contient les 40 mutations (conditions, taille, sol, growth
stages, drops, effets, notes, quantités optimales du guide AVRG pour le Rose
Dragon), les 12 effets de crop, les mécaniques du greenhouse, les objectifs
et le bestiary. Lis-le en entier avant de commencer.

## Règles de travail
- Commence en mode plan : propose l'architecture, les types et l'ordre des
  étapes, puis attends ma validation avant d'écrire du code.
- Travaille par étapes. À la fin de chaque étape : `npm run build` et
  `npm test` doivent passer, puis tu me fais un court résumé.
- Ne code jamais de données de jeu en dur dans les composants. Tout vient
  de `mutations.json` (déplacé dans `src/data/`).
- Si une donnée manque ou est ambiguë, n'invente rien : garde le champ vide
  et affiche un badge "à vérifier". Les champs `verified: false` s'affichent
  aussi avec ce badge.
  (Modifié à la demande du joueur, 30/09/2026 : plus aucun badge « à vérifier »
  dans l'interface ; les marques restent dans les données.)
- Code propre, découpé en petits composants, typé strictement, commenté là
  où la logique n'est pas évidente.

## Stack
- Vite + React + TypeScript (strict)
- Tailwind CSS
- Zustand pour l'état global (inventaire, objectifs, grilles, réglages)
- Vitest pour les tests de la logique
- (React Flow a servi au premier graphe de l'Encyclopédie, remplacé par un arbre maison en SVG)
- Aucun backend : 100 % statique, déployable sur GitHub Pages

## Architecture attendue (à ajuster dans ton plan)
```
src/
  data/mutations.json
  types/            → types dérivés du JSON (Mutation, Effect, Goal, Surface...)
  logic/            → fonctions pures, testées, sans React :
    recipes.ts      → arbre récursif des besoins
    goals.ts        → fusion des besoins de plusieurs objectifs
    grid.ts         → conditions de spawn, conflits, effets reçus
    growth.ts       → durée des growth stages, estimation du temps
    water.ts        → simulation du niveau d'eau
  store/            → stores Zustand + persistance localStorage
  components/       → UI réutilisable (Badge, Card, ProgressBar, Tooltip...)
  features/         → un dossier par onglet
  App.tsx
```

## Logique métier (le cœur de l'app, à tester avec Vitest)

1. Calcul récursif des recettes
   - Pour une cible × quantité : additionner récursivement les ingrédients
     de chaque condition, en soustrayant l'inventaire à chaque niveau.
   - Séparer le résultat en : mutations à faire pousser, crops de base à
     acheter (Wheat, Cocoa Beans, Melon, Dead Plant, Fermento, etc.) et
     conditions spéciales (Shellfruit, Godseed, Jerryflower : afficher le
     texte de `specialCondition`).
   - Ordre de farm = tri topologique (les ingrédients avant ce qu'ils
     permettent de faire).
   - Modes : "Minimum" (juste assez pour UN spawn de chaque cible) et
     "Optimum" (utilise `roseDragonOptimum` quand l'objectif est le Rose
     Dragon).
   - Important : les ingrédients d'une mutation ne sont PAS consommés au
     spawn (ils restent plantés). Un même set d'ingrédients peut donc
     entourer plusieurs cases de spawn. Le calcul donne le nombre de crops
     à placer autour d'UN spawn ; le planificateur de grille gère le partage
     entre plusieurs spawns.

2. Objectifs
   - Chaque objectif du JSON (`goals`) peut être coché.
   - Les besoins des objectifs cochés sont fusionnés : pour une même
     mutation, on garde le maximum requis quand elle sert d'ingrédient
     planté, et on additionne quand elle est consommée (ex. l'œuf du Rose
     Dragon consomme 1 de chaque légendaire). Explique clairement ce choix
     dans le code.
   - "Analyser les 40" : progression = mutations cochées "analysée".

3. Grille et conditions de spawn
   - 3 greenhouses de 10x10. Chaque case a un sol (Farmland, Dirt, Soul
     Sand, Mycelium, Sand, End Stone) et un contenu (vide, crop de base,
     mutation).
   - Les mutations 2x2 et 3x3 occupent plusieurs cases (empreinte avec
     ancre en haut à gauche).
   - Voisins d'une case vide = les 8 cases autour (cases de l'anneau autour
     de l'empreinte pour une mutation 2x2 / 3x3). Une mutation multi-cases
     présente dans l'anneau compte UNE fois par case qu'elle y occupe
     (c'est pourquoi le guide dit qu'un Snoozling ou un PlantBoy "compte
     pour plusieurs cases"). Mets cette règle dans UNE seule fonction bien
     isolée pour que je puisse la corriger facilement si le jeu fonctionne
     autrement.
   - Pour chaque case vide : liste des mutations dont les conditions sont
     remplies ET dont le sol correspond. Lonelily = aucun crop adjacent.
   - Conflits : si plusieurs mutations peuvent spawn sur la même case,
     afficher une alerte avec la liste. Le Godseed a la priorité sur toutes
     les autres.
   - Effets reçus par chaque case : additionner les effets des voisins
     (Harvest Boost, XP Boost, Water Retain...), appliquer Immunity (annule
     les effets négatifs) et Effect Spread (propage les effets du crop à
     ses voisins). Montrer le détail dans un tooltip.
   - Vérificateur Godseed : pour une zone 3x3 vide, indiquer quels effets
     positifs au niveau max sont présents ou manquants.

4. Growth et eau
   - Durée d'un growth stage = 4h / (1 + upgrades + bonus 12 crops uniques
     + Crop Growth / 1000), avec upgrades 0 à 0,5, bonus crops uniques
     0 à 0,6 et Crop Growth 0 à 200. Tout maxé = environ 1h 44m.
     Cette formule est une estimation (verified: false) : affiche le badge.
   - Temps estimé pour une mutation = growth stages × durée d'un stage.
   - Niveau d'eau : -2 à -3 par stage, modifié par Water Retain (+50 %),
     Improved Water Retain (+100 %) et Water Drain (-30 %). Si le niveau est
     négatif pendant un stage, le crop peut ne pas avancer.

## Onglets (navigation par onglets, un rôle chacun)

1. Tableau de bord (regroupe les objectifs)
   - "Prochaine action recommandée" : la mutation à faire pousser
     maintenant (ingrédients déjà disponibles + nécessaire pour un objectif
     actif + le plus bas dans l'arbre en premier)
   - Objectifs : une ligne cochable par objectif (nom, type, avancement),
     dont le détail se déplie : ce qu'il demande (mutations et coûts : coins,
     copper, Condensed Helianthus...), paliers DNA Analysis Milestone, notes
   - Section "usages à confirmer" alimentée par `unmappedUsages`, repliée

2. Inventaire
   - Vue « Mutations Sack » (par défaut) : le sac du jeu, une case par objet
     dans l'ordre du jeu ; clic = fiche complète dans une petite fenêtre
   - Vue « Liste » (à la manière du wiki de skymutations.eu) : une section
     par rareté avec « tout cocher », une carte par mutation
   - Par mutation : possédé (+/-, champ éditable), besoin total selon les
     objectifs et ce qui manque, grande case "analysée", badges sol, taille et
     growth stages ; un clic sur la carte ouvre la fiche complète
   - Recherche + filtres : rareté, sol, taille, complété, analysé

3. Encyclopédie
   - Arbre des recettes par étape (voir « Encyclopédie : arbre par étape ») :
     chaque mutation reliée à ses ingrédients, tous les liens de gauche à droite
   - Couleur de l'état : verrouillée / disponible / complétée / spéciale
   - Survol : tout le chemin de la mutation et ce qu'elle permet de faire ;
     clic = la fiche en fenêtre (la même que depuis l'Inventaire) : conditions,
     sol, taille, growth stages, aperçu de la plantation, effets, drops,
     mécanique spéciale (`notes`), usages, bouton "calculer"

4. Calculateur
   - Une ou plusieurs cibles + quantités, mode Minimum ou Optimum
   - Résultat : arbre dépliable + liste de courses dans l'ordre de farm +
     crops de base à acheter + estimation du temps total
   - Option "ignorer mon inventaire"

5. Grille
   - Onglets Greenhouse 1 / 2 / 3, grille 10x10
   - Palette à gauche (crops de base + mutations, avec recherche), placement
     par clic ou glisser, clic droit pour effacer, pinceau de sol
   - Superpositions activables : spawns possibles, conflits, effets reçus,
     niveau d'eau
   - Compteur : ce que la grille consomme vs l'inventaire
   - Plusieurs layouts sauvegardés, dupliquer, renommer
   - Légende des sols et des couleurs toujours visible

6. Outils
   - Calculateur de durée d'un growth stage (curseurs)
   - Suivi des Ethereal Vines : 88 (1er greenhouse), 100 (2e), 150 (3e),
     338 au total
   - Estimation des Lonelily (~1 par plot vide tous les 2 growth stages)
   - Aide-mémoire des mécaniques (Harvest Bounty, rosewater flasks, decay
     après ~3 jours, lock-in après le 1er stage)

## Réglages et données
- Sauvegarde automatique de tout dans localStorage (avec numéro de version
  du schéma pour les migrations futures)
- Export / Import JSON de la progression
- Bouton "réinitialiser" avec confirmation

## Design
- Thème sombre par défaut, moderne et épuré, inspiré de Minecraft mais
  sobre (pas de texture pixelisée partout)
- Couleurs de rareté : Common gris, Uncommon vert, Rare bleu, Epic violet,
  Legendary or. Couleurs de sol fixes et distinctes. Les deux palettes sont
  définies à UN seul endroit et réutilisées partout.
- Beaucoup d'espace, cartes alignées, typographie lisible, tooltips pour
  les mécaniques compliquées
- Responsive : utilisable sur téléphone (la grille défile horizontalement,
  la palette devient un tiroir)
- Accessible : contraste suffisant, navigation clavier, la couleur n'est
  jamais le seul indicateur

## Tests (Vitest) — obligatoires
- recipes : arbre complet du Rose Dragon, soustraction de l'inventaire,
  ordre topologique, conditions spéciales
- grid : spawn de base (2 Wheat → Dustgrain), mauvais sol refusé,
  Lonelily, empreintes 2x2 et 3x3, conflits, priorité du Godseed
- effects : Immunity, Effect Spread, cumul des effets
- growth : durée de base (4h) et tout maxé (~1h44)

## Ordre de construction
1. Setup du projet + types + chargement et validation du JSON
2. Logique pure + tests (recipes, goals, growth)
3. Store + persistance + Inventaire
4. Calculateur
5. Objectifs + Tableau de bord
6. Encyclopédie (arbre des recettes)
7. Grille (logique + tests, puis UI)
8. Outils, export/import, responsive, finitions
9. README (lancer le projet, modifier les données, déployer sur GitHub
   Pages) + configuration du déploiement

---

## Décisions validées (après lecture du guide AVRG)

Source : *The Greenhouse Guide* by AVRG (changelog du 22/04/2026). Le guide concorde avec
`mutations.json` : ses 38 totaux finaux sont exactement les `roseDragonOptimum`, et tous les sols
et toutes les recettes qu'il donne sont identiques.

### Calcul des besoins
- **Les conditions comptent des cases.** Une mutation 2x2 ou 3x3 compte une fois par case
  qu'elle occupe autour de l'emplacement de spawn. Vérifié sur les plans AVRG : l'anneau du
  Snoozling (16 cases) = 4 + 3 + 3 + 3 + 3 ; celui du Glasscorn (12) = 6 + 6 ; dans le Snoozling
  Complex, le Stoplight Petal touche 2 Snoozlings et 2 Noctilumes, soit 4 cases de chaque.
- **Conversion cases → mutations.** Une mutation de côté N apporte au plus N cases à un même
  spawn. Nombre de mutations = arrondi supérieur de (cases / N). Ex. « 2 PlantBoy » pour
  All-in Aloe = 1 PlantBoy ; « 6 Snoozling » pour PlantBoy = 2 Snoozlings. Cette conversion vit
  dans le même module que la règle des voisins.
- **Règle de somme (remplace le « max » de la spec).** Après son premier growth stage, une
  mutation posée ne peut plus être ramassée (lock-in) : un ingrédient posé pour une recette ne
  sert plus ailleurs. Donc :
  - chaque recette compte ses ingrédients **une seule fois**, quelle que soit la quantité
    voulue (le même anneau fait spawn plusieurs fois) ;
  - deux recettes **différentes** qui utilisent le même ingrédient **s'additionnent**.

  Cette règle redonne exactement les minimums AVRG de Chloronite (11 = 6 + 5), Duskbloom
  (12 = 3 + 6 + 3), Soggybud, Creambloom, Thornshade, Cindershade, Do-not-eat-shroom, Coalroot,
  Fleshtrap, Blastberry et Cheesebite ; la règle du max se trompe sur six d'entre elles. Quand
  AVRG demande moins que la somme (Snoozling 3 au lieu de 5), c'est que ses plans partagent un
  crop entre deux recettes : ce partage relève de la grille.
- **Fusion des objectifs au niveau des cibles.** Les quantités consommées (œuf, crafts,
  analyse) s'additionnent, puis un seul arbre est calculé. Une même recette demandée par deux
  objectifs ne compte ses ingrédients qu'une fois ; deux recettes différentes s'additionnent.
- **L'analyse consomme un exemplaire** (« 7 blastberrys (+1 for analyzing) »). Les totaux
  AVRG ne le comptent pas : « Analyser les 40 » ajoute +1 par mutation.
- **Optimum :** pour la route Rose Dragon, les totaux AVRG (`roseDragonOptimum`) *remplacent*
  le calcul au lieu d'en prendre le maximum, car ils intègrent déjà les partages de ses plans.
  L'objectif concerné porte `avrgRoute: true` dans le JSON. Un total AVRG s'applique tant
  qu'une recette de la route a besoin de la mutation ; si une partie de la route est déjà faite,
  les intermédiaires peuvent être surestimés (le mode Minimum reste exact à chaque niveau).
  Les crops de base restent comptés au minimum. `roseDragonMinimum` (minimums AVRG) est affiché
  comme référence.
- **Shellfruit :** 1 Turtlellini consommée par Shellfruit (`role: consumed`) et une ferme de
  Blastberry (`role: catalyst` : compte dans l'ordre de farm, sans ajouter de Blastberry).

### Temps et croissance
- La formule de la spec est conservée (4 h de base, 1h 44m 20s tout maxé). La mesure AVRG
  (2h 00m sans crop unique, le reste maxé, contre 2h 21m pour la formule) est affichée en tooltip.
- Les estimations utilisent le stage de récolte quand la mutation se récolte avant la fin
  (`harvest` : Magic Jellybean 12/36, Glasscorn 7-8, All-in Aloe 6).
- Temps affiché = minimum théorique (spawns instantanés), avec une alerte quand un plan dépasse
  la durée de vie des ingrédients (~3 jours après maturité). Un emplacement produit une mutation
  par tour ; le nombre d'emplacements par recette est réglable (1 = mode Minimum). Ce modèle
  retrouve les 60 stages du Snoozling Complex annoncés par AVRG (6 Thunderlings sur
  2 emplacements = 48 stages, puis le PlantBoy Advance = 12).

### Upgrades du Greenhouse (captures du menu en jeu, 29/09/2026)
- Growth Speed : 9 tiers, +10 % pour le IX et 50 % au total ; les tiers I à VIII sont déduits
  (+5 % chacun). Plant Yield : 9 tiers, 8 % au tier 4 (+2 % par tier supposé, V à IX inconnus).
  Plot Limit : 2 tiers de +1 plot, soit les greenhouses 2 et 3, qui arrivent entièrement ouverts.
- Menu interactif dans l'onglet Outils, au style Minecraft (comme le Mutations Sack de
  l'Inventaire). Growth Speed règle la durée des stages, Plot Limit les greenhouses achetés (même état
  que le suivi des Ethereal Vines), Plant Yield est affiché seulement.

### Images (demande du joueur)
- Images du Hypixel SkyBlock Wiki (Fandom, CC-BY-SA) pour les mutations, les crops, les sols, les
  objectifs et les objets, y compris les textures du menu des upgrades. Elles sont téléchargées
  par `npm run images` et servies avec le site. Les crédits (source, licence, droits de Mojang et
  Hypixel, lien vers chaque image) sont en bas de page.
- Fond de l'application (image du joueur, 30/09/2026) : capture du Garden (Background.png),
  réencodée en WebP (src/assets/background.webp, 240 Ko au lieu de 1,9 Mo), fixe, floutée et
  assombrie (dégradé plus sombre vers le bas). Panneaux à 86 % d'opacité pour laisser voir le fond ;
  opaques pour les fenêtres et les cartes de l'arbre de l'Encyclopédie (`bg-panel-solid`), et partout
  si le système demande moins de transparence ou plus de contraste.
- Sols : texture de la face du dessus des blocs du wiki, remise à plat (grille, légende, pinceau,
  badges), posée sur la couleur du sol.
- Précision du joueur : Farmland et Dirt sont le même sol dans le Greenhouse. Seul Dirt est gardé
  dans les données (les 28 mutations et les plans AVRG qui disaient Farmland disent Dirt) ; la
  sauvegarde v8 change les cases Farmland des grilles en Dirt.

### Tableau de bord et objectifs (demande du joueur)
- Les onglets Tableau de bord et Objectifs sont réunis : prochaine action, puis les cartes des
  objectifs (cocher « Suivi » met la prochaine action à jour aussitôt), puis les usages à
  confirmer. Sans objectif coché, « Choisir mes objectifs » amène le focus sur la section.
- Retirés car en double avec les cartes : la liste « Objectifs suivis » (barres d'avancement) et
  la carte « Analyses » (même compteur, même description et mêmes paliers que les cartes
  « Analyser les 40 mutations » et « Mutations Sacks »). Le badge « à vérifier » des paliers
  (seuils absents des données) passe sur la carte de l'objectif.
- Un ancien lien #/objectifs ouvre le tableau de bord (onglet par défaut).
- Version compacte (demande du joueur) : la page tient sur un écran. Grand écran : prochaine
  action et usages à confirmer (repliés) à gauche, objectifs à droite ; mobile : prochaine action,
  objectifs, usages. Un objectif = une ligne (case « Suivre », nom, type, badge « à vérifier »,
  barre d'avancement) ; son détail (demande, coûts, paliers, notes, « Calculer cet objectif ») se
  déplie dessous.

### Inventaire (demande du joueur)
- Vue « Mutations Sack » par défaut, à la manière du sac du jeu (liste et capacités de la page
  Mutations Sack du wiki, `mutationsSack` dans le JSON) : 42 cases dans l'ordre du sac, soit les
  40 mutations plus All-in Aloe Fragment et Dead Plant, affichés sans être suivis. Nombre = en
  stock, objet pâle = aucun, ✓ = besoin des objectifs couvert, reflet violet = analysée ; les
  filtres assombrissent les cases qui ne correspondent pas.
- Un clic ouvre la fiche complète de la mutation dans une petite fenêtre (la fiche de
  l'Encyclopédie, où le stock et « analysée » se modifient désormais aussi) ; Échap ou un clic à
  côté la ferme. La vue « Liste » reste pour saisir vite beaucoup de quantités.
- Le chargement vérifie que chaque mutation est dans le sac, sans doublon.
- Vue « Liste » à la manière du wiki de skymutations.eu (demande du joueur) : titre par rareté
  (point de couleur, nom en capitales) avec « Tout cocher / Tout décocher » (analysée, pour les
  mutations affichées de la rareté, en une seule mise à jour), cartes sur 3 colonnes : image,
  nom dans la couleur de la rareté, grande case « analysée » (carte verte),
  badges, puis stock et besoin sous un trait. Eau, prix et copper, affichés par skymutations.eu,
  ne sont pas repris : ils ne sont pas dans les données.
- Toute la carte ouvre la fiche (demande du joueur) : le nom est un bouton étiré sur la carte, la
  case, le compteur et les badges passent au-dessus. Petite animation : la carte se soulève au
  survol et s'enfonce au clic, la fenêtre apparaît en fondu ; rien ne bouge avec « réduire les
  animations ». Les infobulles s'affichent dans le body pour ne pas suivre la carte animée.
- Mise en page (demande du joueur : « l'inventaire fait toute la page ») : sur grand écran,
  affichage, chiffres clés, filtres et légende forment une colonne à gauche, et le sac prend toute
  la largeur restante, agrandi comme la « GUI scale » du jeu sans dépasser la hauteur de l'écran
  (toutes les mesures du style Minecraft dépendent de `--mc-px`). Les infobulles gardent leur
  taille, une seule à la fois. Sur mobile : réglages, sac, puis légende.
- Nombre des cases abrégé dès 1000, arrondi vers le bas comme les mods SkyBlock (1463 → 1.4k,
  14609 → 14k) : les stocks importés dépassent souvent 999 et débordaient sur la case voisine.
  L'infobulle donne le nombre exact, avec séparateur de milliers.

### Fiche d'une mutation (demande du joueur)
- Même fiche, dans une fenêtre, depuis l'Encyclopédie et l'Inventaire (sac ou liste), au style du
  wiki de skymutations.eu : en-tête à la couleur de la rareté, pastilles taille / sol / stages,
  conditions en lignes, « Sert à » en pastilles cliquables.
- Tout visible sans défiler (demande du joueur) : fenêtre large (1024 px) ; une bande sous le titre
  réunit taille, sol, stages, stock, besoin, analyse et « Calculer » ; les sections suivent en colonnes
  équilibrées par le navigateur (colonnes CSS, sections jamais coupées). Vérifié sur les 40 fiches en
  1764 × 887 et 1366 × 768. Une seule colonne sur mobile, où la fiche défile.

### Encyclopédie : arbre par étape (demande du joueur : « change l'affichage, change d'outil ou
recrée tout »)
- L'ancien graphe (React Flow, colonnes par rareté) était illisible : les ingrédients d'une
  mutation étaient dans n'importe quelle colonne, d'où des liens dans tous les sens. Refait de zéro,
  sans bibliothèque : cartes en HTML, liens en SVG, positions calculées par une logique pure et
  testée (`encyclopedia/graphModel.ts`). React Flow est retiré du projet (chunk de l'onglet : 10 Ko).
- Une colonne par étape : étape = 1 + niveau de recette (logic/graph, `recipeLevels`), donc chaque
  ingrédient est à gauche de sa recette et tous les liens vont de gauche à droite : 9, 8, 8, 7, 5 et
  1 mutations, 57 liens. Dans une colonne : rareté puis nom, puis 4 passes du barycentre (moins de
  croisements) ; points d'attache répartis sur les bords des cartes, dans l'ordre de l'autre bout.
  Godseed et Jerryflower (conditions spéciales, sans recette) sont à part, sous l'arbre.
- Au repos, liens discrets. Survol ou focus clavier d'une carte : tout son chemin (ingrédients,
  jusqu'au départ) en bleu, les recettes qui l'utilisent en orange, le reste estompé ; les
  ingrédients directs portent leur quantité (×6, « 1 consommé », « 2 catalyseur ») et un résumé
  écrit (recette, « sert à », longueur du chemin) s'affiche au-dessus, à hauteur fixe pour que
  l'arbre ne bouge pas. Clic : la fiche en fenêtre, et la mutation reste en avant après fermeture
  (Échap ou clic dans le vide pour l'enlever). « Trouver une mutation » fait de même.
- Crops de base en option (colonne à gauche). Les 6 étapes tiennent dans la largeur du site
  (1 230 px) ; au-delà (crops de base, petits écrans, mobile), l'arbre défile horizontalement.
- Aperçu de la plantation (repliable) : la mutation au centre (vert) et ses ingrédients autour
  (orange), les mutations 2x2 et 3x3 posées le long de l'emplacement (`logic/plantingPreview.ts`).
  Chaque exemple est vérifié par la logique de la Grille ; un test le vérifie pour toutes les
  mutations. Pas d'aperçu pour les mutations à obtenir à la main (Shellfruit, Jerryflower) ni pour
  le Godseed (effets requis autour) ; la Lonelily est montrée seule, anneau vide.

### Animations (demande du joueur)
- Règles : courtes (120 à 260 ms), utiles (retour d'action, continuité, repère), jamais en boucle
  (sauf le texte « Chargement de l'arbre… », le temps du chargement), toutes coupées par « réduire
  les animations ». Définies une seule fois dans index.css (fade-in, fade-up, pop-in, pop, bump,
  tooltip-in).
- Où : changement d'onglet et passage Sac / Liste (fondu), infobulles, barres d'avancement (500 ms),
  fiche (ouverture, passage à une autre mutation), arbre de l'Encyclopédie (cartes qui s'éclairent
  au survol, chemin qui s'allume en fondu, quantités qui « pop »), détail d'un objectif, sections repliables, branches de l'arbre du
  calculateur (flèche qui pivote), recommandation du tableau de bord quand elle change, cartes de la
  liste (case qui « pop »), sac (nombre qui rebondit, ✓ qui apparaît, reflet d'enchantement qui balaie
  l'objet au survol comme dans le jeu), grille (crop posé, spawns possibles), palette, messages
  d'erreur et d'import, confirmation de réinitialisation, boutons principaux (s'enfoncent).
- Les messages lus à voix haute (aria-live) restent en place : seul leur texte est animé. Les
  infobulles s'affichent dans le body (portail) pour ne pas suivre un élément animé.

### Import depuis Hypixel (demande du joueur)
- Comme SkyCrypt : le joueur donne son pseudo (invitation au premier lancement sur le tableau de
  bord, bouton dans l'en-tête), le site lit son profil et compte ses mutations. Choix du joueur :
  un petit serveur (Cloudflare Worker, dossier worker/) garde la clé Hypixel secrète ; le site reste
  statique. Sans serveur configuré (VITE_PROFILE_API_URL), l'import est masqué sur le site publié.
- Le serveur : pseudo → UUID, puis /v2/skyblock/profiles. Mojang refuse les appels venus de
  Cloudflare (403, vérifié en ligne) : PlayerDB (service public) est interrogé d'abord, les deux
  adresses de Mojang ensuite, en secours ; chaque échec est journalisé (`wrangler tail`). Il ne
  renvoie que le nom, l'état actif, le mode de jeu et l'inventaire du joueur pour chaque profil
  (ni pièces, ni banque, ni autres membres). Origines limitées (ALLOWED_ORIGINS), pseudo vérifié,
  erreurs traduites (joueur introuvable, clé refusée, quota épuisé avec le temps à attendre, tiré
  de RateLimit-Reset). Testé avec Vitest.
- Quota de la clé (demande du joueur : 300 requêtes par 5 minutes) : une requête Hypixel par
  recherche, jamais en tâche de fond. L'ancien cache de Cloudflare (`cf.cacheTtl`) ne marchait pas
  sur workers.dev (vérifié en ligne : `cf-cache-status: DYNAMIC`, quota 299 → 298 → 297 pour trois
  recherches du même joueur). Remplacé par :
  - un cache Workers KV par pseudo (en minuscules) : profil réutilisé 5 minutes sans appeler
    PlayerDB ni Hypixel, soit au plus une requête par joueur et par fenêtre de quota ; gardé un
    jour pour servir de secours (`stale: true`) quand Hypixel refuse ou ne répond pas. Offre
    gratuite de KV : 1 000 écritures par jour, au-delà les réponses partent sans cache ;
  - 10 recherches par minute et par IP (Rate Limiting de Cloudflare), vérifiées avant tout appel ;
  - le quota restant journalisé après chaque appel (RateLimit-Remaining, `wrangler tail`).
  Le site affiche l'âge de la lecture (`fetchedAt`) et prévient quand ce sont des données de secours.
- Ne jamais dépasser la limite (demande du joueur : un dépassement pourrait faire bannir la clé) :
  budget global dans un Durable Object (un seul pour tout le serveur, compte exact où que soient
  les visiteurs ; offre gratuite, stockage SQLite). Au plus 240 requêtes sur 5 minutes glissantes
  (60 de marge) ; pause jusqu'au quota suivant dès que Hypixel annonce 20 requêtes restantes ou
  moins (clé utilisée ailleurs aussi). Demandé juste avant chaque appel à Hypixel, après le cache
  et la recherche du pseudo. Refus : données de secours si le joueur est en cache, sinon 429 avec
  l'attente. Budget injoignable : pas d'appel (503), la limite passe avant l'import. Le compte est
  gardé dans le stockage du Durable Object et survit aux redéploiements (vérifié en ligne).
- Sources lues : sacs (`sacks_counts`, dont le Mutations Sack), inventaire, ender chest, sacs à dos,
  coffre personnel. Les contenus (NBT en gzip et base64) sont décodés dans le navigateur
  (logic/hypixel, lecteur NBT maison, testé) ; chaque objet est reconnu par son identifiant.
- `itemId` de chaque mutation : liste publique des objets Hypixel (/v2/resources/skyblock/items),
  40 mutations sur 40 retrouvées par leur nom exact (elle écrit « Turtlellini »).
- Aperçu avant tout changement : mutations trouvées (avant → après, détail par source), choix du
  profil (le dernier choisi, sinon le profil actif). Le stock est remplacé ; les mutations non
  trouvées passent à 0, sauf option « garder ». Import bloqué si Hypixel ne montre pas l'inventaire
  (Inventory API désactivée), pour ne pas vider le stock à tort. Les coffres de l'île et la grille
  du greenhouse ne sont pas visibles par l'API.
- Sauvegarde v9 : `settings.player` (pseudo, profil choisi, invitation écartée).

### Interface allégée (demande du joueur, 30/09/2026)
- Plus d'en-tête visible (titre et phrase) en haut des onglets : chaque onglet garde un titre h2
  masqué pour les lecteurs d'écran (et, pour l'Encyclopédie, l'indication « Entrée ouvre la fiche »).
- Barre du haut à la manière de SkyCrypt : flottante, centrée, de la largeur de son contenu, sur une
  ligne en grand écran (titre, onglets en pastilles, import), en verre dépoli sur le fond ; deux
  lignes sous 1280 px. Les côtés vides laissent passer les clics ; opaque si le système demande
  moins de transparence ou plus de contraste. Le sous-titre « Hypixel SkyBlock » est retiré.
- Retirés de l'Inventaire : le choix Minimum / Optimum et la case « les mutations analysées
  s'achètent au bazar » ; la légende sous les filtres (la case « ? » du sac l'explique toujours).
- Retiré du Calculateur : le panneau Options (mode, inventaire ignoré, bazar, emplacements par
  recette, cases pour les Lonelily).
- Les calculs gardent les valeurs enregistrées : besoins en mode Optimum par défaut, option du bazar
  désactivée, inventaire pris en compte, 1 emplacement par recette, un greenhouse entier pour les
  Lonelily. Le mode du calculateur suit les boutons qui l'ouvrent (route AVRG : Optimum). La logique
  et la sauvegarde ne changent pas.

### Grille
- Affichage inspiré de skymutations.eu (demande du joueur) : aucun texte dans les cases. Crop posé
  = bordure orange sur son sol en pleine lumière ; spawn possible = image pâle et bordure verte (une
  seule image sur une empreinte 2x2 ou 3x3) ; conflit = bordure rouge ; effets reçus = pastille,
  eau = goutte. Les Lonelily (spawn au hasard) ne sont pas dessinées, leurs conflits oui. Le détail
  reste dans le panneau Case et le nom accessible des cases. Palette en grille de cartes.
- Poser une mutation met ses cases à son sol (Blastberry → Sand) ; un crop de base garde le sol.
- Les greenhouses 2 et 3 ne se modifient qu'une fois débloqués dans Outils (Plot Limit) : sinon leur
  onglet porte un cadenas et affiche le prix avec un lien vers les upgrades. « Ce que la grille
  consomme » ne compte que les greenhouses débloqués.
- Greenhouse 1 : 12 cases ouvertes au départ, 1 Ethereal Vine par case (88). Les greenhouses 2
  et 3 arrivent entièrement ouverts. État « verrouillé » à peindre dans le greenhouse 1.
- Précision du joueur : les greenhouses 2 et 3 s'achètent au NPC en une fois (100 et 150 vines),
  dans l'ordre. Ils se règlent avec l'upgrade Plot Limit (menu des upgrades, un seul endroit) :
  le tier 1 ouvre tout le 1er greenhouse, le tier 2 ajoute le 3e ; revenir au tier 0 retire les
  deux. Le suivi des Ethereal Vines les compte sans les régler. Seuls les greenhouses débloqués
  comptent pour les Lonelily.
- Un réglage = un seul endroit : le Growth Speed se règle dans la fenêtre Minecraft des upgrades.
  À la demande du joueur, crops uniques et Crop Growth ne se règlent plus : ils sont comptés au
  maximum (12 et 200). La sauvegarde ne garde que le Growth Speed (format 7). Le panneau « Durée
  d'un growth stage » n'affiche que le résultat.
- État de case « bloc cassé » (douve autour du Devourer).
- Les crops de base peuvent avoir des effets (Cocoa Beans : Immunity ; Nether Wart : bonus de
  yield de niveau inconnu).
- Les plans AVRG sont transcrits à l'étape 7, comme modèles chargeables et comme tests : chaque
  emplacement de spawn d'un plan doit remplir ses conditions.
- Règle de spawn par mutation (`spawnRule` dans le JSON) : conditions de voisinage par défaut,
  `noAdjacentCrops` (Lonelily), `requiredEffectsAround` (Godseed, avec `spawnPriority`), `manual`
  (Shellfruit, Jerryflower : jamais depuis la grille).
- 21 plans AVRG transcrits (`layouts`) ; un test vérifie que chaque emplacement fait spawn la
  mutation annoncée, et rien d'autre. Deux conflits non mentionnés par AVRG ont été détectés et
  sont gardés dans les plans : Lonelily au centre des zones 3x3 du Snoozling, Witherbloom sur les
  emplacements du Zombud (4 Dead Plants autour).
- Effets reçus : hypothèses regroupées dans `receivedEffects` (logic/grid.ts) et affichées avec
  le badge « à vérifier » : un crop voisin donne ses effets une fois, les effets s'additionnent,
  Effect Spread relaie sur un niveau, Immunity annule les effets négatifs. Le vérificateur Godseed
  compte les effets émis directement par les crops autour de la zone.

### Données à vérifier
- Badges « à vérifier » et marques ⚠ d'incertitude retirés de toute l'interface (demande du joueur,
  30/09/2026) : cartes, fiches, objectifs, sac, arbre, outils, infobulles Minecraft. Les marques
  restent dans mutations.json (`null`, `verified: false`, `conflicts`) et dans le modèle chargé
  (`unverified`), sans affichage. Gardés : les avertissements utiles au calcul (quantité inconnue
  comptée 1, durée inconnue, decay, conflit de spawn sur la grille). Les lignes ci-dessous décrivent
  les données concernées.
- Conflits gardés avec le badge « à vérifier » et les deux valeurs affichées : growth stages du
  Soggybud (10 contre 8), bestiary du Timestalk Clone (10 contre 20 kills), nom
  Turtlellini / Turtellini.
- Bestiary : chaque entrée est reliée à sa mutation (champ `mutation`, vérifié au chargement) et
  s'affiche sur sa fiche et dans l'aide-mémoire. Un nombre de kills absent est « à vérifier ».
- Option « les mutations analysées s'achètent au bazar » (dit par AVRG pour Dustgrain et
  Gloomgourd) : désactivée par défaut, badge « à vérifier ». Réglage commun, dans l'Inventaire et
  le Calculateur : une mutation analysée qui manque est achetée au lieu d'être cultivée, et sa
  recette n'est pas lancée (ses ingrédients ne sont plus demandés).
