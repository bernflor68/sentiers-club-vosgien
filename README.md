# Sentiers du Club Vosgien — Carte IGN

Application web locale pour préparer une randonnée sur l'ensemble du réseau balisé
Club Vosgien (Vosges et Alsace) : GR5, GR53, GR531 à GR534, et près de 2800 sentiers
locaux PR (rond, triangle, croix, losange... jaune/bleu/vert/rouge), complété par les
chemins et petites routes environnants. Donnez un lieu de départ et un lieu d'arrivée
— même hors sentier (parking, village, domicile) — l'appli calcule le meilleur
itinéraire en rejoignant le réseau balisé par le chemin le plus direct, puis en
empruntant les sentiers en priorité, avec distance, dénivelé, temps estimé et export
GPX.

## Lancer l'application

```bash
node server.js
```

Puis ouvrez http://localhost:5173 dans votre navigateur. Au premier chargement,
l'appli télécharge le réseau complet (~21 Mo compressés) : compter une vingtaine
de secondes.

## Utilisation

- **Recherche par nom** : tapez un lieu-dit, sommet, col, village ou adresse dans un
  champ et choisissez une suggestion — un point hors sentier (parking, place de
  village...) fonctionne tout aussi bien.
- **Étapes** : bouton "+ Ajouter une étape" pour insérer autant de points
  intermédiaires que voulu entre le départ et l'arrivée ; chacun peut être retiré
  avec le "×". L'itinéraire calculé passe alors par tous les points dans l'ordre.
- **Clic sur la carte** : cliquez sur l'icône 📍 à côté d'un champ puis cliquez
  n'importe où sur la carte : le point est automatiquement rattaché à l'accès le
  plus proche (sentier ou chemin).
- **Identifier un sentier** : tapez son nom ou son numéro ("GR5", "532", "jaune"...)
  dans le champ "Identifier un sentier par nom" et choisissez-le dans la liste — ou
  activez "🔍 Ou cliquer sur un sentier sur la carte" puis cliquez sur n'importe quel
  tracé. Le sentier se met en surbrillance sur toute sa longueur, avec son nom/
  balisage et sa distance totale dans une bulle, et la carte se recentre dessus. Un
  deuxième clic sur le même sentier (ou ailleurs sur la carte) referme la
  surbrillance.
- **Fermes-auberges** : 92 fermes-auberges (Vosges/Alsace) sont affichées sur la
  carte (icône 🍴) — cliquez dessus pour voir ses infos (altitude, horaires,
  téléphone, site web) et l'ajouter d'un clic comme étape de l'itinéraire. La liste
  déroulante "Fermes-auberges" du panneau permet aussi de choisir une ferme
  directement par son nom : la carte s'y recentre et ouvre sa fiche.
- **Calcul d'itinéraire** : un algorithme de plus court chemin (A*) parcourt un
  graphe combinant le réseau balisé Club Vosgien et le réseau de chemins/petites
  routes environnant, avec une pondération qui **privilégie les sentiers balisés**
  chaque fois qu'une option raisonnable existe. Les portions hors sentier
  nécessaires (rejoindre un parking, traverser un village...) suivent de vrais
  chemins praticables, jamais une ligne à vol d'oiseau.
- **Signalétique** : chaque sentier est affiché avec la couleur de son balisage réel
  (rouge, bleu, jaune, vert...) ; en zoomant, les pastilles de balisage (rond,
  triangle, croix, losange, rectangle) apparaissent le long des sentiers, comme sur
  le terrain. Le détail de l'itinéraire calculé liste chaque tronçon emprunté avec
  son balisage et sa distance ; les portions hors sentier apparaissent en grisé
  ("Liaison hors sentier").
- **Résultat** : distance, dénivelé positif/négatif, temps estimé et profil
  altimétrique s'affichent automatiquement une fois les deux points posés.
- **Export GPX** : bouton "Exporter en GPX" pour charger l'itinéraire complet
  (sentiers + liaisons) dans un GPS ou une appli de randonnée (à faire *avant* de
  partir, l'appli n'a pas de mode hors-ligne).

## Régénérer les données du réseau

Les données du réseau (`data/network.json`) sont un instantané figé d'OpenStreetMap,
en deux temps :

1. Toutes les relations `route=hiking` avec `operator~"Club Vosgien"` sur l'emprise
   Vosges/Alsace (topologie complète : nœuds + géométrie).
2. Tous les chemins/petites routes (`highway=path|track|footway|bridleway|steps|
   service|unclassified|living_street`, hors voies privées) sur la même emprise.

Les deux jeux sont fusionnés en un graphe unique : les tronçons appartenant à un
sentier balisé gardent leur poids nominal, les autres reçoivent une pénalité
(+25 %) qui fait préférer les sentiers balisés dès qu'une alternative comparable
existe. Les tracés sont simplifiés (Douglas-Peucker, tolérance 4 m, en préservant
toutes les intersections) pour limiter la taille du fichier. Au chargement, l'appli
calcule aussi les composantes connexes du graphe et ignore les milliers de petits
fragments de chemins isolés (données OSM non reliées au reste du réseau), pour ne
router que sur le grand réseau connecté.

Le script utilisé pour cette construction n'est pas inclus dans le dépôt ; contactez-
moi si vous voulez le relancer.

## Sources et licences

- **Fond de carte** : [IGN Géoplateforme](https://www.geoportail.gouv.fr/) — couches
  `GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2` (Plan IGN) et `ORTHOIMAGERY.ORTHOPHOTOS`
  (photos aériennes), servies sans clé d'API depuis `data.geopf.fr`.
- **Géocodage** (recherche de lieux) et **altimétrie** (dénivelé) : API ouvertes
  IGN Géoplateforme (`data.geopf.fr/geocodage`, `data.geopf.fr/altimetrie`).
- **Réseau** : [OpenStreetMap](https://www.openstreetmap.org/) (© contributeurs
  OpenStreetMap, licence ODbL) — 2843 relations de randonnée balisées par le Club
  Vosgien (GR + PR, avec leur symbole `osmc:symbol`), complétées par le réseau de
  chemins et petites routes de la région.
- **Fermes-auberges** : [OpenStreetMap](https://www.openstreetmap.org/) (licence
  ODbL) — établissements dont le nom correspond à "ferme-auberge" dans l'emprise
  Vosges/Alsace ; liste non exhaustive et dépendante du référencement OSM.

## Limites connues

- Le dénivelé est calculé par échantillonnage (~40 points) via l'API altimétrie
  IGN ; le calcul prend quelques secondes et peut légèrement sous-estimer les
  variations très locales.
- Le réseau reflète les données Club Vosgien telles que cartographiées dans
  OpenStreetMap : certaines connexions de sentiers de fond peuvent occasionnellement
  s'étendre légèrement hors Alsace/Vosges (ex. liaisons transfrontalières vers
  l'Allemagne), ce qui est normal — ces sentiers existent réellement.
- Nécessite une connexion internet (fonds de carte, géocodage et altimétrie
  chargés en direct ; seul le réseau de sentiers/chemins est mis en cache localement
  dans `data/network.json`).
