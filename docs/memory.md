# MEMORY

## Role

Documentation technique et scripts d'integration non servis au navigateur.

## Contenu

- `google-apps-script.gs`: logique cote Google Apps Script pour synchroniser formulaire, feuille et JSON.
- `sync-prestataires-json.mjs`: script CI qui recupere le JSON Google Apps Script et ecrase `data/prestataires.json`.

## Vigilance

- Si le flux externe change, mettre a jour ce fichier et `WebSiteUMH/memory.md`.
