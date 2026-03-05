import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { LemonMascot } from '../../components/illustrations/LemonMascot';

// -- TYPES --
interface Slot {
  giorno: string;
  orario: string;
  postiRimanenti: number;
  esaurito: boolean;
  targetAge?: string[]; // e.g. ["3-5", "6-10"]
}

interface Location {
  sedeId: string;
  nomeSede: string;
  indirizzo: string;
  slot: Slot[];
}

// -- HELPERS --
const calculateAge = (dob: string): number => {
  if (!dob) return 0;
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

const isAgeCompatible = (age: number, targetAges?: string[]): boolean => {
  if (!targetAges || targetAges.length === 0) return true; // If no target age specified, assume compatible
  return targetAges.some(range => {
    if (range.includes('+')) {
      const min = parseInt(range.replace('+', ''), 10);
      return age >= min;
    }
    const parts = range.split('-');
    if (parts.length === 2) {
      const min = parseInt(parts[0], 10);
      const max = parseInt(parts[1], 10);
      return age >= min && age <= max;
    }
    return parseInt(range, 10) === age;
  });
};

const dayMap: { [key: string]: number } = {
  'Domenica': 0, 'Lunedì': 1, 'Martedì': 2, 'Mercoledì': 3, 'Giovedì': 4, 'Venerdì': 5, 'Sabato': 6
};

const getNextDateString = (dayName: string): string | null => {
  const targetDay = dayMap[dayName];
  if (targetDay === undefined) return null;
  
  const date = new Date();
  const currentDay = date.getDay();
  let daysUntil = targetDay - currentDay;
  
  // If today is the day, assume next week (or today if logic permits, usually next week for booking)
  // Let's assume next occurrence (if today is Monday, next Monday is +7)
  if (daysUntil <= 0) {
    daysUntil += 7;
  }
  
  date.setDate(date.getDate() + daysUntil);
  return date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

interface RegistrationData {
  // Step 0: Genitore
  parentFirstName: string;
  parentLastName: string;
  parentEmail: string;
  parentPhone: string;
  
  // Step 1: Figlio
  childName: string;
  childDob: string;

  // Step 2: Sede
  locationId: string;
  slotTime: string;
  
  // Metadata
  courseType: string;
}

const INITIAL_DATA: RegistrationData = {
  parentFirstName: '',
  parentLastName: '',
  parentEmail: '',
  parentPhone: '+39 ',
  childName: '',
  childDob: '',
  locationId: '',
  slotTime: '',
  courseType: 'standard'
};

const GESTIONALE_SLOTS_URL = "https://europe-west1-ep-gestionale-v1.cloudfunctions.net/getAvailableSlots";
const BRIDGE_SECURE_KEY = "EP_V1_BRIDGE_SECURE_KEY_8842_XY";

export const RegistrationForm: React.FC = () => {
  const [step, setStep] = useState<number>(0);
  // NEW: Sub-step for Step 0 (0: Name/Surname, 1: Email/Phone)
  const [stepZeroSub, setStepZeroSub] = useState<0 | 1>(0);

  const [data, setData] = useState<RegistrationData>(INITIAL_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isDemoMode, setIsDemoMode] = useState(false);
  
  // Dynamic locations state
  const [availableLocations, setAvailableLocations] = useState<Location[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);

  // Fetch available slots from Gestionale API
  useEffect(() => {
    const fetchSlots = async () => {
      setIsLoadingLocations(true);
      console.log("[RegistrationForm] Avvio recupero slot da:", GESTIONALE_SLOTS_URL);
      try {
        const response = await fetch(GESTIONALE_SLOTS_URL, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${BRIDGE_SECURE_KEY}`,
            "Accept": "application/json"
          }
        });
        
        if (!response.ok) {
          const errorBody = await response.text();
          console.error(`[RegistrationForm] Errore API (${response.status}):`, errorBody);
          throw new Error(`Impossibile recuperare le disponibilità (Status ${response.status}).`);
        }
        
        const locations: Location[] = await response.json();
        console.log("[RegistrationForm] Sedi caricate con successo:", locations.length);
        setAvailableLocations(locations);
      } catch (error: any) {
        console.error("[RegistrationForm] Errore durante il fetch degli slot:", error);
        
        // Messaggio specifico per errori di rete (CORS o connettività)
        if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
          setErrorMessage("Errore di connessione (CORS). Verifica la configurazione del server gestionale.");
        } else {
          setErrorMessage(error.message || "Errore nel caricamento delle sedi. Riprova più tardi.");
        }
      } finally {
        setIsLoadingLocations(false);
      }
    };

    fetchSlots();
  }, []);

  // Auto-redirect logic for Step 3
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (step === 3) {
      timeout = setTimeout(() => {
        setStep(0);
        setStepZeroSub(0); // Reset sub-step
        setData(INITIAL_DATA);
        setIsDemoMode(false);
      }, 5000);
    }
    return () => clearTimeout(timeout);
  }, [step]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setData(prev => ({ ...prev, [name]: value }));
    // Clear error message when user types to improve UX
    if (errorMessage) setErrorMessage('');
  };

  // Updated validation to handle sub-steps
  const validateCurrentState = (): boolean => {
    switch (step) {
      case 0:
        if (stepZeroSub === 0) {
          return !!data.parentFirstName && !!data.parentLastName;
        } else {
          return !!data.parentEmail && data.parentPhone.length > 4;
        }
      case 1:
        return !!data.childName && !!data.childDob;
      case 2:
        return !!data.locationId && !!data.slotTime;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (!validateCurrentState()) {
      setErrorMessage("Per favore compila tutti i campi obbligatori.");
      return;
    }

    // Clear error if validation passes
    setErrorMessage('');

    if (step === 0) {
      if (stepZeroSub === 0) {
        // Move to Step 0 Part B
        setStepZeroSub(1);
      } else {
        // Move to Step 1
        setStep(prev => prev + 1);
      }
    } else {
      // Normal progression
      setStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setErrorMessage(''); // Clear errors when moving back
    if (step === 0 && stepZeroSub === 1) {
      // Go back to Step 0 Part A
      setStepZeroSub(0);
      return;
    }

    if (step > 0) {
      setStep(prev => prev - 1);
      // If we go back to step 0, we usually want to see the last part (Part B)
      if (step === 1) {
        setStepZeroSub(1);
      }
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      // Attempt to save to Firestore in the raw_registrations collection
      await addDoc(collection(db, 'raw_registrations'), {
        ...data,
        syncStatus: 'pending_sync', // Initial status for the Cloud Function
        createdAt: serverTimestamp(),
        source: 'public_portal_v1'
      });
      setStep(3);
    } catch (error: any) {
      console.error("Firestore Error:", error);
      setErrorMessage("Errore di connessione. Riprova tra poco.");
      setIsSubmitting(false);
    }
  };

  // Helper to render content for each step
  const renderStepContent = (stepIndex: number) => {
    switch (stepIndex) {
      case 0:
        return (
          <div className="space-y-4">
            <div className="text-center mb-2">
              <h2 className="text-lg font-bold text-gray-800">Dati Genitore</h2>
            </div>
            
            {/* Conditional Rendering for Sub-Steps */}
            {stepZeroSub === 0 ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <Input
                  label="Nome"
                  name="parentFirstName"
                  value={data.parentFirstName}
                  onChange={handleChange}
                  placeholder="Mario"
                  autoFocus
                />
                <Input
                  label="Cognome"
                  name="parentLastName"
                  value={data.parentLastName}
                  onChange={handleChange}
                  placeholder="Rossi"
                />
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <Input
                  label="Email"
                  name="parentEmail"
                  type="email"
                  value={data.parentEmail}
                  onChange={handleChange}
                  placeholder="mario@example.com"
                  autoFocus
                />
                <Input
                  label="Telefono"
                  name="parentPhone"
                  type="tel"
                  value={data.parentPhone}
                  onChange={handleChange}
                  placeholder="+39 333 1234567"
                />
              </div>
            )}
          </div>
        );
      case 1:
        return (
          <div className="space-y-4">
            <div className="text-center mb-2">
              <h2 className="text-lg font-bold text-gray-800">Dati Figlio/a</h2>
            </div>
            <Input
              label="Nome e Cognome Figlio"
              name="childName"
              value={data.childName}
              onChange={handleChange}
              placeholder="Luigi Rossi"
            />
            <Input
              label="Data di Nascita"
              name="childDob"
              type="date"
              value={data.childDob}
              onChange={handleChange}
            />
          </div>
        );
      case 2:
        const childAge = calculateAge(data.childDob);
        
        // Filter locations that have at least one slot compatible with the child's age
        const filteredLocations = availableLocations.filter(loc => 
          loc.slot.some(s => isAgeCompatible(childAge, s.targetAge))
        );

        const selectedLocation = filteredLocations.find(l => l.sedeId === data.locationId);
        
        // Filter slots for the selected location based on age
        const filteredSlots = selectedLocation 
          ? selectedLocation.slot.filter(s => isAgeCompatible(childAge, s.targetAge))
          : [];

        // Calculate first available date if a slot is selected
        let firstAvailableDate: string | null = null;
        if (data.slotTime) {
          const [day] = data.slotTime.split(' '); // Assumes format "Lunedì 17:00"
          firstAvailableDate = getNextDateString(day);
        }

        return (
          <div className="space-y-4">
             <div className="text-center mb-2">
              <h2 className="text-lg font-bold text-gray-800">Scegli Sede e Orario</h2>
              {childAge > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Mostrando corsi per età: <span className="font-semibold">{childAge} anni</span>
                </p>
              )}
            </div>
            
            <div className="flex flex-col gap-1 w-full">
              <label className="text-sm font-medium text-gray-700">Sede</label>
              <select
                name="locationId"
                value={data.locationId}
                onChange={(e) => {
                  // Reset slot time when location changes
                  setData(prev => ({ ...prev, locationId: e.target.value, slotTime: '' }));
                }}
                disabled={isLoadingLocations}
                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-100"
              >
                <option value="">
                  {isLoadingLocations 
                    ? "Caricamento sedi..." 
                    : filteredLocations.length === 0 
                      ? "Nessuna sede disponibile per questa età" 
                      : "Seleziona una sede"}
                </option>
                {filteredLocations.map(loc => (
                  <option key={loc.sedeId} value={loc.sedeId}>
                    {loc.nomeSede}{loc.indirizzo ? ` - ${loc.indirizzo}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1 w-full">
              <label className="text-sm font-medium text-gray-700">Orario Preferito</label>
              <select
                name="slotTime"
                value={data.slotTime}
                onChange={handleChange}
                disabled={!data.locationId || isLoadingLocations || filteredSlots.length === 0}
                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-100"
              >
                <option value="">
                  {filteredSlots.length === 0 && data.locationId
                    ? "Nessun orario disponibile per questa età"
                    : "Seleziona orario"}
                </option>
                {filteredSlots.map(s => (
                  <option 
                    key={`${s.giorno}-${s.orario}`} 
                    value={`${s.giorno} ${s.orario}`}
                    disabled={s.esaurito}
                  >
                    {s.giorno} {s.orario} {s.esaurito ? '(ESAURITO)' : `(${s.postiRimanenti} posti)`}
                  </option>
                ))}
              </select>
            </div>

            {/* Display First Available Date */}
            {firstAvailableDate && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-100 rounded-md animate-in fade-in slide-in-from-top-2">
                <p className="text-sm text-blue-800 text-center">
                  <span className="block text-xs text-blue-500 uppercase tracking-wider font-semibold mb-1">Prima Lezione Disponibile</span>
                  <span className="font-bold text-lg capitalize">{firstAvailableDate}</span>
                </p>
              </div>
            )}
          </div>
        );
      case 3:
        return (
          <div className="text-center py-8 space-y-4 animate-in fade-in zoom-in duration-500">
            <h2 className="text-2xl font-bold text-green-600">Registrazione Completata!</h2>
            <p className="text-gray-600">
              Grazie per aver iscritto tuo figlio. Ti abbiamo inviato una email di conferma.
            </p>
            {isDemoMode && (
              <p className="text-xs text-orange-500 mt-4 border border-orange-200 bg-orange-50 p-2 rounded">
                Nota: Modalità Demo attiva (Simulation).
              </p>
            )}
            <p className="text-sm text-gray-500 mt-2">Verrai reindirizzato alla home tra pochi secondi...</p>
          </div>
        );
      default:
        return null;
    }
  };

  // Determine if Back button is disabled (Only at very start)
  const isBackDisabled = step === 0 && stepZeroSub === 0;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg overflow-hidden flex flex-col md:flex-row md:max-w-4xl min-h-[500px]">
        
        {/* Left Side: Mascot/Illustration */}
        <div className="w-full md:w-1/2 bg-blue-50 p-6 flex flex-col items-center justify-center relative transition-colors duration-500 overflow-hidden">
             <LemonMascot step={step} className="w-full h-full" />
             {/* Simple Step Indicator */}
             <div className="absolute bottom-4 flex gap-2">
               {[0, 1, 2].map(i => (
                 <div 
                    key={i} 
                    className={`h-2 w-2 rounded-full transition-all ${step === i ? 'bg-blue-600 w-4' : 'bg-blue-200'}`}
                 />
               ))}
             </div>
        </div>

        {/* Right Side: Form */}
        <div className="w-full md:w-1/2 p-8 flex flex-col justify-between">
           <div className="flex-1">
             {renderStepContent(step)}
             {errorMessage && (
               <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-md text-sm border border-red-100 animate-in fade-in slide-in-from-top-2">
                 {errorMessage}
               </div>
             )}
           </div>

           {/* Buttons */}
           {step < 3 && (
             <div className="mt-8 flex justify-between gap-4">
                <Button 
                  variant="secondary" 
                  onClick={handleBack} 
                  disabled={isBackDisabled}
                  className={isBackDisabled ? 'invisible' : ''}
                >
                  Indietro
                </Button>
                
                {step === 2 ? (
                  <Button 
                    onClick={handleSubmit} 
                    isLoading={isSubmitting}
                    disabled={!validateCurrentState()}
                  >
                    Conferma
                  </Button>
                ) : (
                  <Button onClick={handleNext}>
                    Avanti
                  </Button>
                )}
             </div>
           )}
        </div>
      </div>
    </div>
  );
};
