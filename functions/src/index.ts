import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { setGlobalOptions } from "firebase-functions/v2";
import * as admin from "firebase-admin";

admin.initializeApp();

// Impostiamo la regione globale per tutte le funzioni (deve coincidere con la regione del database Firestore)
setGlobalOptions({ region: "europe-west1" });

const GESTIONALE_API_URL = "https://europe-west1-ep-gestionale-v1.cloudfunctions.net/receiveLead";
const BRIDGE_SECURE_KEY = "EP_V1_BRIDGE_SECURE_KEY_8842_XY";

export const syncRegistrationToGestionale = onDocumentCreated(
  "raw_registrations/{docId}",
  async (event) => {
    const snap = event.data;
    if (!snap) {
      console.log("No data associated with the event");
      return;
    }

    const data = snap.data();
    const docId = event.params.docId;
    
    console.log(`[syncRegistrationToGestionale] Avvio sincronizzazione per docId: ${docId}`);

    try {
      // Prepariamo il payload da inviare al gestionale
      const payload = {
        originalId: docId,
        ...data
      };

      // Effettuiamo la chiamata HTTP POST
      const response = await fetch(GESTIONALE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${BRIDGE_SECURE_KEY}`
        },
        body: JSON.stringify(payload)
      });

      // Verifichiamo che la risposta sia positiva (status 200-299)
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Errore API Gestionale (Status ${response.status}): ${errorText}`);
      }

      console.log(`[syncRegistrationToGestionale] Sincronizzazione completata con successo per docId: ${docId}`);

      // Aggiorniamo il documento locale in raw_registrations con lo stato di successo
      await snap.ref.update({
        syncStatus: "synced",
        syncedAt: admin.firestore.FieldValue.serverTimestamp()
      });

    } catch (error: any) {
      console.error(`[syncRegistrationToGestionale] Fallimento sincronizzazione per docId: ${docId}`, error);

      // Aggiorniamo il documento locale in raw_registrations con lo stato di errore
      await snap.ref.update({
        syncStatus: "failed",
        syncError: error.message || "Errore sconosciuto durante la sincronizzazione HTTP",
        failedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  }
);
