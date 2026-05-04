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
