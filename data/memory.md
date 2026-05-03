# MEMORY

## Role

Donnees statiques servies directement au site.

## Contenu

- `prestataires.json`: source unique lue par le site pour l'annuaire et les types de prestation.

## Vigilance

- Toute evolution du schema JSON doit etre documentee ici et dans les scripts qui le consomment.
- Le fichier est mis a jour automatiquement par `docs/sync-prestataires-json.mjs` via GitHub Actions.
- La sync preserve le champ `photo` deja present localement quand la source Google ne le renseigne pas.
