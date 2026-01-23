
# EP Public Portal

Questa è la landing page pubblica per la raccolta iscrizioni di **EasyPeasy English School**.

## Funzionalità

-   **Gamification**: Mascotte "MechaLemon" interattiva che reagisce alla compilazione del form.
-   **Mobile First**: Layout ottimizzato per smartphone con vista a colonne su desktop.
-   **Lead Generation**: Form multi-step per raccolta dati genitore, figlio e preferenze orarie.
-   **Backendless**: Integrazione diretta con Firebase Firestore (collezione `raw_registrations` per sicurezza, mappata sullo schema `new_leads`).

## Stack Tecnologico

-   React 18+
-   Vite
-   TailwindCSS
-   Firebase (Firestore)
-   TypeScript

## Installazione e Sviluppo

1.  Clona il repository.
2.  Installa le dipendenze: `npm install`
3.  Avvia il server di sviluppo: `npm run dev`
4.  Costruisci per produzione: `npm run build`

## Deploy

Vedi `DEPLOY_GUIDE.md` per istruzioni dettagliate su come pubblicare su Vercel.
