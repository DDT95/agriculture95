# Observatoire de l’agriculture du Val-d’Oise

Carte institutionnelle interactive consacrée aux parcelles agricoles, aux exploitations, à l’agriculture biologique, aux haies et aux principales données agricoles du Val-d’Oise.

## Publication sur GitHub Pages

1. Copier tous les fichiers de ce dossier à la racine du dépôt `DDT95/agriculture95`.
2. Envoyer les fichiers sur la branche `main`.
3. Dans **Settings → Pages**, choisir **GitHub Actions** comme source.
4. Le workflow **Déployer sur GitHub Pages** construit et publie automatiquement le site.

URL attendue :

`https://ddt95.github.io/agriculture95/`

## Développement local

```bash
npm install
npm run dev
```

## Vérification avant publication

```bash
npm ci
npm run build
```

## Données et services

- RPG 2020–2024 : ASP / IGN, interrogé via API Carto.
- Parcelles cadastrales : API Carto IGN.
- Limites communales : API Géo.
- Établissements agricoles, coopératives et matériel agricole : SIRENE / API Recherche d’entreprises.
- Agriculture biologique : CartoBio / Agence Bio.
- Haies, hydrographie, orthophotographies : Géoplateforme IGN.
- Fonds cartographiques : OpenStreetMap et IGN.

Les ventes de produits phytosanitaires sont présentées uniquement à l’échelle départementale. Elles ne permettent pas d’attribuer un usage à une parcelle.

## Limites connues

- Les API publiques peuvent être momentanément indisponibles.
- L’historique RPG est recherché au point sélectionné ; les contours et identifiants peuvent varier selon le millésime.
- La présence d’un établissement SIRENE ne correspond pas nécessairement à une exploitation recensée par Agreste.
- Aucune identité d’exploitant agricole n’est publiée à partir du RPG.
