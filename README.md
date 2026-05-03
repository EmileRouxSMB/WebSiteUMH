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
6. Mettre l'URL dans `assets/js/umh-config.js`:
- `apiUrl: "https://script.google.com/macros/s/.../exec"`
7. Le workflow GitHub `.github/workflows/sync-prestataires-json.yml` lance chaque jour une synchronisation du JSON statique.

Notes:
- `POST` ajoute une ligne dans la feuille.
- `GET` retourne le JSON complet (`typeDePrestationOptions` + `prestataires`).
- Le script `docs/sync-prestataires-json.mjs` telecharge ce JSON et remplace `data/prestataires.json`.
- Lors de la sync, si le JSON Google ne fournit pas de champ `photo`, le script conserve le chemin `photo` deja present localement pour ne pas perdre l'association avec `images/partenaires/...`.
- `assets/js/annuaire.js` et le chargement des types dans `assets/js/form-prestataire.js` lisent uniquement `data/prestataires.json`.
- Le workflow est planifie en UTC mais ne synchronise effectivement qu'a minuit heure de Paris.
- Le workflow utilise `actions/checkout@v6` et `actions/setup-node@v6` avec Node.js 24.
