# Agriculture 95 — Observatoire cartographique

Site web statique destiné à GitHub Pages pour explorer l'agriculture du Val-d'Oise.

## Fonctionnalités

- identité visuelle institutionnelle inspirée du système de design de l'État ;
- carte Leaflet responsive, ordinateur et mobile ;
- limites des 183 communes chargées depuis l'API géographique de l'État ;
- recherche de commune ;
- interrogation du Registre parcellaire graphique au clic et selon le zoom ;
- styles automatiques par familles de cultures ;
- identification de la commune et du code INSEE ;
- recherche d'opérateurs biologiques via l'API de l'Agence Bio ;
- fonds OpenStreetMap, orthophotographie et hydrographie IGN ;
- panneau latéral sur ordinateur et volet inférieur sur mobile ;
- messages explicites lorsqu'une API est indisponible ;
- aucun téléchargement automatique de document.

## Publication sur GitHub Pages

1. Décompresser l'archive.
2. Déposer **le contenu du dossier** à la racine de `DDT95/agriculture95`.
3. Dans GitHub : **Settings > Pages**.
4. Choisir **Deploy from a branch**, branche `main`, dossier `/ (root)`.
5. Le site sera ensuite disponible à l'adresse `https://ddt95.github.io/agriculture95/`.

## Structure

```text
index.html
css/style.css
js/config.js
js/app.js
assets/icons/favicon.svg
data/
README.md
```

## Sources et services utilisés

- IGN — API Carto, module RPG : `https://apicarto.ign.fr/api/rpg/v2`
- API géographique de l'État — communes : `https://geo.api.gouv.fr/`
- Agence Bio — données publiques des opérateurs : `https://opendata.agencebio.org/`
- IGN Géoplateforme — orthophotographies et hydrographie
- OpenStreetMap — fond cartographique

## Limites connues

- Le RPG recense principalement les parcelles déclarées dans le cadre de la PAC. Il ne s'agit pas d'un inventaire exhaustif de toutes les terres agricoles.
- Les API distantes peuvent appliquer des limites, modifier leur schéma ou être temporairement indisponibles.
- Le chargement du RPG est volontairement déclenché à partir du zoom 13 pour limiter les volumes et préserver les performances.
- L'API Bio peut nécessiter un ajustement léger si son schéma de réponse évolue. Une redirection vers l'annuaire officiel reste disponible.
- La typographie Marianne n'est pas embarquée dans l'archive. Le navigateur utilise Marianne lorsqu'elle est installée, sinon Arial. Les fichiers officiels peuvent être ajoutés ultérieurement dans `assets/fonts/` selon les conditions de diffusion applicables.

## Contrôles effectués

- validation syntaxique JavaScript avec Node.js ;
- vérification de l'arborescence et des chemins relatifs ;
- vérification de l'adaptation responsive dans les feuilles de style ;
- vérification de la présence de messages d'erreur et d'états de chargement ;
- vérification des liens externes avec `target="_blank"` et `rel="noopener noreferrer"`.

Les appels API ne peuvent pas être garantis hors ligne. Après publication, tester plusieurs communes et plusieurs parcelles à différents niveaux de zoom.
