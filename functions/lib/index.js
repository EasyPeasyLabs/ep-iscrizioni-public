"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPortalTexts = exports.syncRegistrationToGestionale = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const v2_1 = require("firebase-functions/v2");
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
function getAdmin() {
    if (admin.apps.length === 0) {
        admin.initializeApp();
    }
    return admin;
}
// Impostiamo la regione globale per tutte le funzioni (deve coincidere con la regione del database Firestore)
(0, v2_1.setGlobalOptions)({ region: "europe-west1" });
const GESTIONALE_API_URL = "https://receiveleadv2-7wnvtld3xq-ew.a.run.app";
const BRIDGE_SECURE_KEY = "EP_V1_BRIDGE_SECURE_KEY_8842_XY";
exports.syncRegistrationToGestionale = (0, firestore_1.onDocumentCreated)("raw_registrations/{docId}", async (event) => {
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
        const payload = Object.assign({ originalId: docId }, data);
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
        const firebaseAdmin = getAdmin();
        // Aggiorniamo il documento locale in raw_registrations con lo stato di successo
        await snap.ref.update({
            syncStatus: "synced",
            syncedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp()
        });
    }
    catch (error) {
        console.error(`[syncRegistrationToGestionale] Fallimento sincronizzazione per docId: ${docId}`, error);
        const firebaseAdmin = getAdmin();
        // Aggiorniamo il documento locale in raw_registrations con lo stato di errore
        await snap.ref.update({
            syncStatus: "failed",
            syncError: error instanceof Error ? error.message : "Errore sconosciuto durante la sincronizzazione HTTP",
            failedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp()
        });
    }
});
exports.getPortalTexts = (0, https_1.onRequest)({ region: "europe-west1" }, async (req, res) => {
    // Abilitiamo CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'GET') {
        res.status(405).json({ success: false, error: 'Method Not Allowed' });
        return;
    }
    try {
        const firebaseAdmin = getAdmin();
        const portalTextsRef = firebaseAdmin.firestore().collection('portalTexts');
        const snapshot = await portalTextsRef.where('isActive', '==', true).orderBy('order').get();
        const portalTexts = snapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
        res.json({
            success: true,
            data: portalTexts
        });
    }
    catch (error) {
        console.error('Error fetching portal texts:', error);
        res.status(500).json({
            success: false,
            error: 'Internal Server Error'
        });
    }
});
//# sourceMappingURL=index.js.map