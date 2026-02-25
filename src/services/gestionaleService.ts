import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs } from "firebase/firestore";

// --- CONFIGURAZIONE PROJECT A (GESTIONALE) ---
// SOSTITUISCI CON I DATI REALI DEL TUO GESTIONALE
const gestionaleConfig = {
  apiKey: "AIzaSyDON9vmJzNvYH7Eqw3c2KlpgOjr3ToIJhM",
  authDomain: "ep-gestionale-v1.firebaseapp.com",
  projectId: "ep-gestionale-v1",
  storageBucket: "ep-gestionale-v1.firebasestorage.app",
  messagingSenderId: "332612800443",
  appId: "1:332612800443:web:d5d434d38a78020dd57e9e"
};

// Inizializza una SECONDA app Firebase
// Usiamo la variabile corretta 'gestionaleConfig' definita sopra
const gestionaleApp = initializeApp(gestionaleConfig, "gestionaleApp");
const gestionaleDb = getFirestore(gestionaleApp);

export interface LeadData {
  nome: string;
  cognome: string;
  email: string;
  telefono: string;
  childName: string;
  childAge: string;
  selectedLocation: string;
  selectedSlot: string;
  notes?: string;
}

export interface LocationSlot {
  sedeId: string;
  nomeSede: string;
  indirizzo: string;
  slot: {
    giorno: string;
    orario: string;
    postiRimanenti: number;
    esaurito: boolean;
  }[];
}

/**
 * Invia un nuovo lead al gestionale
 */
export const sendLeadToGestionale = async (data: LeadData) => {
  try {
    const docRef = await addDoc(collection(gestionaleDb, "incoming_leads"), {
      ...data,
      source: "projectB_site",
      createdAt: new Date().toISOString(),
      status: "pending",
      // Campi richiesti dalle regole di sicurezza
      email: data.email,
      nome: data.nome,
      cognome: data.cognome
    });
    console.log("Lead inviato al gestionale con ID:", docRef.id);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Errore invio lead al gestionale:", error);
    return { success: false, error };
  }
};

/**
 * Recupera le sedi e gli slot disponibili dal gestionale
 */
export const getLocationsFromGestionale = async (): Promise<Record<string, string[]>> => {
  try {
    // 1. Recupera i fornitori (sedi)
    const suppliersSnap = await getDocs(collection(gestionaleDb, "suppliers"));
    const slotsMap: Record<string, string[]> = {};

    suppliersSnap.forEach(doc => {
      const data = doc.data();
      if (data.locations && Array.isArray(data.locations)) {
        data.locations.forEach((loc: any) => {
          // Costruisci la chiave "Città - Nome Sede" o solo "Nome Sede"
          const locationName = loc.city ? `${loc.city} - ${loc.name}` : loc.name;
          
          // Mappa gli slot disponibili
          // Nota: Qui stiamo semplificando. Nel gestionale gli slot sono oggetti complessi.
          // Per ora, assumiamo che 'availability' sia un array di oggetti { dayOfWeek, startTime, endTime }
          // e li convertiamo in stringhe leggibili.
          
          const slots = (loc.availability || []).map((slot: any) => {
            const days = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
            return `${days[slot.dayOfWeek]} ${slot.startTime} - ${slot.endTime}`;
          });

          if (slots.length > 0) {
            slotsMap[locationName] = slots;
          }
        });
      }
    });
    
    return slotsMap;
  } catch (error) {
    console.error("Errore recupero sedi dal gestionale:", error);
    return {}; // Ritorna oggetto vuoto in caso di errore
  }
};