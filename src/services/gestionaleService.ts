import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs } from "firebase/firestore";

// --- CONFIGURAZIONE PROJECT A (GESTIONALE) ---
const gestionaleConfig = {
  apiKey: "AIzaSyDON9vmJzNvYH7Eqw3c2KlpgOjr3ToIJhM",
  authDomain: "ep-gestionale-v1.firebaseapp.com",
  projectId: "ep-gestionale-v1",
  storageBucket: "ep-gestionale-v1.firebasestorage.app",
  messagingSenderId: "332612800443",
  appId: "1:332612800443:web:d5d434d38a78020dd57e9e"
};

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

// Nuova interfaccia per le Sedi Pubbliche
export interface PublicLocation {
  id: string;        // ID univoco (es. "Bari-Poggiofranco")
  name: string;      // Nome Sede
  city: string;      // Città
  address: string;   // Indirizzo (Via...)
  slots: string[];   // Lista orari formattati
}

export const sendLeadToGestionale = async (data: LeadData) => {
  try {
    const docRef = await addDoc(collection(gestionaleDb, "incoming_leads"), {
      ...data,
      source: "projectB_site",
      createdAt: new Date().toISOString(),
      status: "pending",
      email: data.email,
      nome: data.nome,
      cognome: data.cognome
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Errore invio lead:", error);
    return { success: false, error };
  }
};

/**
 * Recupera le sedi pubbliche con indirizzi e slot filtrati
 */
export const getLocationsFromGestionale = async (): Promise<PublicLocation[]> => {
  try {
    const suppliersSnap = await getDocs(collection(gestionaleDb, "suppliers"));
    const locationsList: PublicLocation[] = [];

    suppliersSnap.forEach(doc => {
      const data = doc.data();
      if (data.isDeleted) return;

      if (data.locations && Array.isArray(data.locations)) {
        data.locations.forEach((loc: any) => {
          if (loc.closedAt) return;
          if (loc.isPubliclyVisible === false) return;

          // Filtra e formatta gli slot
          const slots = (loc.availability || [])
            .filter((slot: any) => slot.isPubliclyVisible !== false)
            .map((slot: any) => {
              const days = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
              let label = `[${slot.type || 'LAB'}] ${days[slot.dayOfWeek]} ${slot.startTime} - ${slot.endTime}`;
              if (slot.minAge || slot.maxAge) {
                label += ` (${slot.minAge || 0}-${slot.maxAge || '?'} anni)`;
              }
              return label;
            });

          if (slots.length > 0) {
            // Crea l'oggetto PublicLocation
            locationsList.push({
              id: loc.id || `${data.companyName}-${loc.name}`.replace(/\s+/g, '-'),
              name: loc.name,
              city: loc.city || data.city || '',
              address: loc.address || data.address || '', // Recupera l'indirizzo!
              slots: slots
            });
          }
        });
      }
    });
    
    return locationsList;
  } catch (error) {
    console.error("Errore recupero sedi:", error);
    return [];
  }
};