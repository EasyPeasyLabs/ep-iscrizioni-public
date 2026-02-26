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

// Nuova interfaccia per lo Slot Pubblico Strutturato
export interface PublicSlot {
  id: string; // Identificativo univoco per la selezione
  type: 'LAB' | 'SG';
  dayOfWeek: number;
  dayName: string;
  startTime: string;
  endTime: string;
  minAge?: number;
  maxAge?: number;
}

// Nuova interfaccia per le Sedi Pubbliche
export interface PublicLocation {
  id: string;
  name: string;
  city: string;
  address: string;
  slots: PublicSlot[];
}

export const sendLeadToGestionale = async (data: LeadData) => {
  try {
    // Sanitizzazione finale per evitare riferimenti circolari
    const cleanData = JSON.parse(JSON.stringify(data));
    
    const docRef = await addDoc(collection(gestionaleDb, "incoming_leads"), {
      ...cleanData,
      source: "projectB_site",
      createdAt: new Date().toISOString(),
      status: "pending",
      email: data.email,
      nome: data.nome,
      cognome: data.cognome
    });
    return { success: true, id: docRef.id };
  } catch (error: any) {
    console.error("Errore invio lead:", error);
    // Restituisci solo il messaggio di errore stringa, non l'oggetto errore completo (che potrebbe essere circolare)
    return { success: false, error: error.message || "Errore sconosciuto" };
  }
};

export const getLocationsFromGestionale = async (): Promise<PublicLocation[]> => {
  try {
    const suppliersSnap = await getDocs(collection(gestionaleDb, "suppliers"));
    const locationsList: PublicLocation[] = [];
    const daysMap = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

    suppliersSnap.forEach(doc => {
      const data = doc.data();
      if (data.isDeleted) return;

      if (data.locations && Array.isArray(data.locations)) {
        data.locations.forEach((loc: any) => {
          if (loc.closedAt) return;
          if (loc.isPubliclyVisible === false) return;

          // Mappa gli slot in oggetti strutturati
          const slots: PublicSlot[] = (loc.availability || [])
            .filter((slot: any) => slot.isPubliclyVisible !== false)
            .map((slot: any, index: number) => ({
              id: `${loc.id || loc.name}-slot-${index}`,
              type: slot.type || 'LAB',
              dayOfWeek: slot.dayOfWeek,
              dayName: daysMap[slot.dayOfWeek],
              startTime: slot.startTime,
              endTime: slot.endTime,
              minAge: slot.minAge ? Number(slot.minAge) : undefined,
              maxAge: slot.maxAge ? Number(slot.maxAge) : undefined
            }));

          if (slots.length > 0) {
            locationsList.push({
              id: loc.id || `${data.companyName}-${loc.name}`.replace(/\s+/g, '-'),
              name: loc.name,
              city: loc.city || data.city || '',
              address: loc.address || data.address || '',
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