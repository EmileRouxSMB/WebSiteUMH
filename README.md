## Service mail de contact
https://formspree.io/

## Service newsletter
https://dashboard.mailerlite.com/

## Lancement du serveur de developpement
```powershell
powershell -ExecutionPolicy Bypass -File .\serve-local.ps1
```

Par defaut, le site est servi sur `http://localhost:8080/`. Si le port est deja pris,
le script essaie automatiquement les ports suivants.

Pour tester depuis un autre appareil du meme Wi-Fi, lancer le serveur avec l'adresse IP
locale de l'ordinateur:

```powershell
powershell -ExecutionPolicy Bypass -File .\serve-local.ps1 -HostName 192.168.1.21
```

## Flux Google Sheets -> JSON statique
Objectif:
- `nouveau-prestataire.html` envoie chaque soumission vers Google Sheets.
- Un workflow GitHub Actions recopie chaque nuit le JSON Google Apps Script vers `data/prestataires.json`.
- L'annuaire lit uniquement `data/prestataires.json`.

Etapes:
1. Creer un Google Sheet vide.
2. Ouvrir `Extensions > Apps Script`.
3. Coller le contenu de `docs/google-apps-script.gs`.
4. `Deploy > New deployment > Web app`:
- Execute as: `Me`
- Who has access: `Anyone`
5. Copier l'URL du Web app (`.../exec`).
6. Ajouter un secret GitHub `SYNC_PRESTATAIRES_API_URL` avec l'URL du Web app:
- `Settings > Secrets and variables > Actions > New repository secret`
7. Le workflow GitHub `.github/workflows/sync-prestataires-json.yml`:
- genere `assets/js/umh-config.js` a partir de `SYNC_PRESTATAIRES_API_URL`
- synchronise `data/prestataires.json` depuis cette meme URL
- commit les fichiers mis a jour

Notes:
- `POST` ajoute une ligne dans la feuille.
- `GET` retourne le JSON complet (`typeDePrestationOptions` + `prestataires`).
- Le script `docs/sync-prestataires-json.mjs` telecharge ce JSON et remplace `data/prestataires.json`.
- En CI, `docs/generate-umh-config.mjs` injecte `SYNC_PRESTATAIRES_API_URL` dans `assets/js/umh-config.js`.
- Ensuite, `docs/sync-prestataires-json.mjs` lit d'abord `SYNC_PRESTATAIRES_API_URL`, puis retombe sur `assets/js/umh-config.js` si le secret n'est pas defini.
- Les photos ne sont pas resolues depuis le JSON. Le front deduit uniquement l'image a partir du handle Instagram dans `images/partenaires/`.
- `assets/js/annuaire.js` et le chargement des types dans `assets/js/form-prestataire.js` lisent uniquement `data/prestataires.json`.
- Le workflow est planifie en UTC mais ne synchronise effectivement qu'a minuit heure de Paris.
- Le workflow utilise `actions/checkout@v6` et `actions/setup-node@v6` avec Node.js 24.

## Workflow des images prestataire
Flux actuel:
1. Le prestataire choisit une image dans `nouveau-prestataire.html`.
2. `assets/js/form-prestataire.js` verifie le type (`JPG`, `PNG`, `WebP`) et la taille max (`5 Mo`).
3. Le front convertit l'image en base64 et l'envoie dans le payload `photoUpload` au `doPost` Google Apps Script.
4. `docs/google-apps-script.gs` decode l'image, cree un fichier dans Google Drive et stocke son URL dans la colonne `photoDepotUrl` du Google Sheet.

Ou arrivent les images:
- Dossier Google Drive: `UMH - Photos prestataires a valider`
- Feuille Google Sheets: colonne `photoDepotUrl`

Automatisation CI:
- Lors du `sync-prestataires-json`, si `enLigne == true` et qu'une image upload existe dans Drive, la CI peut recuperer l'image via Apps Script.
- La CI ne rapatrie l'image que si aucune image locale n'existe deja pour ce handle dans `images/partenaires/`.
- Les fichiers deja presents dans `images/partenaires/` ne sont ni retouches ni retelescharges.

Ce qui reste vrai:
- L'image n'est pas exposee directement dans `data/prestataires.json`
- Le site public n'affiche pas l'URL Drive

Comment le site affiche les images actuellement:
- `assets/js/annuaire.js` ignore `photoDepotUrl`
- Le front reconstruit des chemins locaux a partir du handle Instagram:
- `images/partenaires/<handle>.jpg`
- `images/partenaires/<handle>.jpeg`
- `images/partenaires/<handle>.png`
- `images/partenaires/<handle>.webp`
- Si aucune image locale n'existe, le fallback est `images/logo.png`

Workflow de validation recommande:
1. Verifier la nouvelle ligne dans le Google Sheet.
2. Ouvrir le lien `photoDepotUrl` et controler la photo.
3. Mettre `enLigne` a `true` dans le Google Sheet quand la fiche est prete.
4. Laisser la CI regenerer `data/prestataires.json` via `sync-prestataires-json`.
5. Si aucune image locale n'existe deja pour ce handle, la CI copiera automatiquement l'image Drive dans `images/partenaires/<handle>.*`.
