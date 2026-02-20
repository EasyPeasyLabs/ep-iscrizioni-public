import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import fetch from "node-fetch";

// Initialize Admin SDK
admin.initializeApp();

const db = admin.firestore();

/**
 * Interface representing the updated Lead data structure in Firestore (Wizard V2)
 */
interface RegistrationData {
  // Parent Data
  parentFirstName: string;
  parentLastName: string;
  parentEmail: string;
  parentPhone: string;
  
  // Child Data
  childName: string;
  childDob: string;
  
  // Selection
  locationId: string;
  slotTime: string;
  
  // Metadata
  [key: string]: any;
}

/**
 * Configuration for the external Gestionale V1 Bridge
 */
const GESTIONALE_CONFIG = {
  ENDPOINT: "https://europe-west1-ep-gestionale-v1.cloudfunctions.net/receiveLead",
  AUTH_KEY: "EP_V1_BRIDGE_SECURE_KEY_8842_XY"
};

const runtimeOpts: functions.RuntimeOptions = {
  timeoutSeconds: 300,
  memory: "256MB",
};

/**
 * Trigger: Firestore onCreate at 'registrations/{docId}'
 */
export const forwardLeadToCrm = functions
  .runWith(runtimeOpts)
  .region('us-central1')
  .firestore.document("registrations/{docId}")
  .onCreate(async (snap, context) => {
    const docId = context.params.docId;
    const data = snap.data() as RegistrationData;

    console.log(`[START] Processing registration ${docId} for Gestionale forwarding (Wizard V2).`);

    if (!data) {
      console.error(`[ERROR] Document ${docId} exists but has no data.`);
      return;
    }

    try {
      // Format details string for the generic "interest.details" field
      // This allows passing Child/Location info without changing the CRM API schema
      const detailsString = `Figlio: ${data.childName}, Nato il: ${data.childDob}, Sede: ${data.locationId}, Orario: ${data.slotTime}`;

      // 1. Prepare payload for the external CRM / Gestionale
      // Mapping new specific fields to the generic structure
      const crmPayload = {
        lead_source: "web_registration_wizard",
        external_ref_id: docId,
        contact: {
          first_name: data.parentFirstName,
          last_name: data.parentLastName,
          email: data.parentEmail,
          phone: data.parentPhone,
        },
        interest: {
          course_type: data.courseType || "standard",
          details: detailsString, // Consolidated details
        },
        submitted_at: new Date().toISOString(),
      };

      console.log(`[INFO] Sending payload to ${GESTIONALE_CONFIG.ENDPOINT}`);

      // 2. Send to Gestionale via HTTP POST
      const response = await fetch(GESTIONALE_CONFIG.ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GESTIONALE_CONFIG.AUTH_KEY}`
        },
        body: JSON.stringify(crmPayload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`External API responded with status ${response.status}: ${errorText}`);
      }

      console.log(`[SUCCESS] Data successfully sent to Gestionale.`);

      // 3. Update Firestore document with success status
      await db.collection("registrations").doc(docId).update({
        crmStatus: "synced",
        crmSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
        crmMessage: "Successfully forwarded to ep-gestionale-v1"
      });

    } catch (error) {
      console.error(`[ERROR] Failed to forward registration ${docId} to Gestionale:`, error);

      await db.collection("registrations").doc(docId).update({
        crmStatus: "error",
        crmError: error instanceof Error ? error.message : "Unknown error occurred",
        crmLastAttempt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });

export const testFunction = functions.https.onRequest((request, response) => {
  functions.logger.info("Test function invoked", { structuredData: true });
  response.send("Cloud Functions are operational!");
});
