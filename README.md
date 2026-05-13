# Chinese Trainer

Web app PWA per esercitarsi con il cinese.

## 1. Eseguire localmente

La app è statica, quindi basta servirla con un web server locale.

Esempio con Python:

```bash
python -m http.server 8000
```

Poi apri:

```text
http://localhost:8000
```

## 2. Pubblicare su GitHub Pages

1. Carica tutti i file del progetto nel repository GitHub.
2. Vai su `Settings` > `Pages`.
3. In `Build and deployment`, seleziona `Deploy from a branch`.
4. Scegli il branch principale, di solito `main`, e la cartella `/ (root)`.
5. Salva e attendi la pubblicazione.

La web app funzionerà correttamente se `index.html`, `manifest.json`, `service-worker.js` e le icone restano nella root del sito pubblicato.

## 3. Aggiungere alla schermata Home su iPhone

1. Apri la web app in Safari su iPhone.
2. Tocca il pulsante `Condividi`.
3. Seleziona `Aggiungi a schermata Home`.
4. Conferma il nome e salva.

Per una migliore esperienza PWA, usa Safari e assicurati che la pagina sia servita in HTTPS.
