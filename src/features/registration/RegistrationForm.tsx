import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Home } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { db, collection, addDoc, serverTimestamp } from '../../lib/firebase';

// -- TYPES --
interface IncludedSlot {
  type: string;
  startTime: string;
  endTime: string;
  minAge?: number;
  maxAge?: number;
}

interface Bundle {
  bundleId: string;
  name: string;
  publicName?: string;
  description?: string;
  price?: number;
  dayOfWeek: number;
  minAge: number;
  maxAge: number;
  availableSeats: number;
  originalCapacity: number; // Added
  isFull: boolean;
  includedSlots: IncludedSlot[];
}

interface Location {
  sedeId: string;
  nomeSede: string;
  indirizzo: string;
  citta: string;
  googleMapsLink?: string;
  bundles: Bundle[];
}

// API Response Types
interface ApiIncludedSlot {
  type: string;
  startTime: string;
  endTime: string;
  minAge?: number;
  maxAge?: number;
}

interface ApiBundle {
  bundleId: string;
  name: string;
  publicName?: string;
  description?: string;
  price?: number;
  dayOfWeek: number;
  minAge: number;
  maxAge: number;
  availableSeats: number;
  isFull: boolean;
  includedSlots: ApiIncludedSlot[];
}

interface ApiLocation {
  id: string;
  name: string;
  address?: string;
  city?: string;
  googleMapsLink?: string;
  bundles: ApiBundle[];
}

interface ApiResponse {
  success: boolean;
  data: ApiLocation[];
}

interface FormErrors {
  nome?: string;
  cognome?: string;
  email?: string;
  telefono?: string;
  childName?: string;
  childAge?: string;
  selectedLocation?: string;
  selectedSlot?: string;
  privacy?: string;
}

interface PendingRegistration {
  id: string;
  locationId: string;
  selectedSlot: {
    bundleId: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface RegistrationFormProps {
  onProgressUpdate?: (count: number) => void;
  onSuccess?: () => void;
}

// -- HELPERS --
const isAgeCompatible = (age: number, minAge?: number, maxAge?: number): boolean => {
  // If no age limits are defined, assume compatible
  if (minAge === undefined && maxAge === undefined) return true;
  
  const min = minAge !== undefined ? minAge : 0;
  const max = maxAge !== undefined ? maxAge : 99;
  
  return age >= min && age <= max;
};

const dayNumberMap: { [key: number]: string } = {
  1: 'Lunedì',
  2: 'Martedì',
  3: 'Mercoledì',
  4: 'Giovedì',
  5: 'Venerdì',
  6: 'Sabato',
  7: 'Domenica'
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
  
  if (daysUntil <= 0) {
    daysUntil += 7;
  }
  
  date.setDate(date.getDate() + daysUntil);
  return date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

const PUBLIC_SLOTS_URL = "/api/slots";

export const RegistrationForm: React.FC<RegistrationFormProps> = ({ onProgressUpdate, onSuccess }) => {
  const [formData, setFormData] = useState({
    nome: '',
    cognome: '',
    email: '',
    telefono: '',
    childName: '',
    childAge: '',
    selectedLocation: '',
    selectedSlot: ''
  });
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  const [currentCard, setCurrentCard] = useState(0);
  const totalCards = 5;

  // Dynamic locations state
  const [availableLocations, setAvailableLocations] = useState<Location[]>([]);
  const [pendingRegistrations] = useState<PendingRegistration[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [infoModalContent, setInfoModalContent] = useState<{title: string, description: string} | null>(null);

  const prevCountRef = useRef(0);

  // Fetch pending registrations from local Firestore to account for real-time occupancy
  /*
  useEffect(() => {
    if (!db) return;
    
    const unsubscribe = db.collection("raw_registrations")
      .where("syncStatus", "==", "pending_sync")
      .onSnapshot((snapshot) => {
        const pending = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PendingRegistration));
        setPendingRegistrations(pending);
      }, (error) => {
        console.error("Error listening to pending registrations:", error);
      });
      
    return () => unsubscribe();
  }, []);
  */

  // Fetch available slots
  useEffect(() => {
    const fetchSlots = async () => {
      setIsLoadingLocations(true);
      try {
        const response = await fetch(PUBLIC_SLOTS_URL, {
          method: "GET",
          headers: {
            "Accept": "application/json"
          }
        });
        
        if (!response.ok) throw new Error(`Failed to fetch slots: ${response.status}`);
        
        const apiResponse: ApiResponse = await response.json();
        
        if (apiResponse.success && Array.isArray(apiResponse.data)) {
          const mappedLocations: Location[] = apiResponse.data.map((loc) => {
            const bundles = loc.bundles || [];

            return {
              sedeId: loc.id,
              nomeSede: loc.name || 'Sede senza nome',
              indirizzo: loc.address || '',
              citta: loc.city || '',
              googleMapsLink: loc.googleMapsLink,
              bundles: bundles.map((b: any) => ({
                bundleId: b.bundleId,
                name: b.name,
                publicName: b.publicName || b.name,
                description: b.description,
                price: b.price,
                dayOfWeek: b.dayOfWeek,
                minAge: typeof b.minAge === 'number' ? b.minAge : 0,
                maxAge: typeof b.maxAge === 'number' ? b.maxAge : 99,
                availableSeats: b.availableSeats || 0,
                originalCapacity: b.originalCapacity || 10,
                isFull: b.isFull || false,
                includedSlots: b.includedSlots || []
              }))
            };
          });
          setAvailableLocations(mappedLocations);
        } else {
          throw new Error("Invalid response format");
        }
      } catch (error) {
        console.warn("Warning fetching slots:", error);
        setGlobalError("Impossibile caricare le disponibilità. Riprova più tardi.");
      } finally {
        setIsLoadingLocations(false);
      }
    };

    fetchSlots();
  }, []);

  // Real-time availability calculation
  const locationsWithRealAvailability = React.useMemo(() => {
    return availableLocations.map(loc => ({
      ...loc,
      bundles: loc.bundles.map(bundle => {
        const pendingCount = pendingRegistrations.filter(r => 
          r.locationId === loc.sedeId && r.selectedSlot.bundleId === bundle.bundleId
        ).length;
        
        const realAvailableSeats = Math.max(0, bundle.originalCapacity - pendingCount);
        
        return {
          ...bundle,
          availableSeats: realAvailableSeats,
          isFull: realAvailableSeats === 0
        };
      })
    }));
  }, [availableLocations, pendingRegistrations]);

  // Validation Logic Helpers
  const isNomeValid = formData.nome.trim().length > 1;
  const isCognomeValid = formData.cognome.trim().length > 1;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
  const isPhoneValid = formData.telefono.trim().length > 5;
  const isChildNameValid = formData.childName.trim().length > 1;
  const isChildAgeValid = formData.childAge.trim().length > 0;
  const isLocationValid = formData.selectedLocation !== '';
  const isSlotValid = formData.selectedSlot !== '';

  // Calculate current animation frame
  useEffect(() => {
    let frame = 0;
    if (loading) {
      frame = 6;
    } else if (currentCard === 4) {
      frame = privacyAccepted ? 5 : 4;
    } else {
      frame = currentCard;
    }
    
    if (onProgressUpdate && frame !== prevCountRef.current) {
      onProgressUpdate(frame);
      prevCountRef.current = frame;
    }
  }, [currentCard, privacyAccepted, loading, onProgressUpdate]);

  const formatPhoneForDisplay = (phone: string) => {
    if (!phone) return '';
    const cleaned = phone.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+39')) {
      const prefix = '+39';
      const rest = cleaned.substring(3);
      let formatted = prefix;
      if (rest.length > 0) formatted += ' ' + rest.substring(0, 3);
      if (rest.length > 3) formatted += ' ' + rest.substring(3, 6);
      if (rest.length > 6) formatted += ' ' + rest.substring(6, 10);
      if (rest.length > 10) formatted += rest.substring(10);
      return formatted;
    }
    return cleaned;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { id, value } = e.target;
    
    if (id === 'selectedLocation') {
      setFormData(prev => ({ ...prev, selectedLocation: value, selectedSlot: '' }));
    } else if (id === 'telefono') {
      let val = value.replace(/[^\d+]/g, '');
      const oldVal = formData.telefono;
      
      if (val.length > 0) {
        if (val.startsWith('0039')) {
          val = '+39' + val.substring(4);
        } else if (!val.startsWith('+39')) {
          val = val.replace(/^\+?/, ''); // remove leading +
          
          if (oldVal === '+39' && val.length < 3) {
            val = '';
          } else if (val.startsWith('39') && val.length > 3) {
            val = '+' + val;
          } else {
            val = '+39' + val;
          }
        }
      }
      
      setFormData(prev => ({ ...prev, [id]: val }));
    } else {
      setFormData(prev => ({ ...prev, [id]: value }));
    }

    if (errors[id as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [id]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    let isValid = true;

    if (!isNomeValid) { newErrors.nome = "Il nome è obbligatorio"; isValid = false; }
    if (!isCognomeValid) { newErrors.cognome = "Il cognome è obbligatorio"; isValid = false; }
    if (!formData.email.trim()) { newErrors.email = "L'email è obbligatoria"; isValid = false; } 
    else if (!isEmailValid) { newErrors.email = "Email non valida"; isValid = false; }
    
    if (!formData.telefono.trim()) { newErrors.telefono = "Telefono obbligatorio"; isValid = false; }
    else if (!isPhoneValid) {
        newErrors.telefono = "Numero non valido";
        isValid = false;
    }

    if (!isChildNameValid) { newErrors.childName = "Nome studente obbligatorio"; isValid = false; }
    if (!isChildAgeValid) { newErrors.childAge = "Età richiesta"; isValid = false; }

    if (!formData.selectedLocation) { newErrors.selectedLocation = "Seleziona una sede"; isValid = false; }
    if (!formData.selectedSlot) { newErrors.selectedSlot = "Seleziona un orario"; isValid = false; }

    if (!privacyAccepted) { newErrors.privacy = "Consenso obbligatorio"; isValid = false; }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);

    if (!validate()) {
      return;
    }

    setLoading(true);

    try {
      // 1. Prepare data for Gestionale (Project A)
      const selectedLoc = availableLocations.find(l => l.sedeId === formData.selectedLocation);
      const locationName = selectedLoc ? selectedLoc.nomeSede : '';
      
      const selectedBundle = selectedLoc?.bundles.find(b => b.bundleId === formData.selectedSlot);
      
      let dayOfWeek = 0;
      let startTime = "";
      let endTime = "";
      let type = "LAB";
      let bundleName = "";

      if (selectedBundle) {
        dayOfWeek = selectedBundle.dayOfWeek;
        bundleName = selectedBundle.name;
        
        // Concatenate times for backward compatibility
        startTime = selectedBundle.includedSlots.map(s => s.startTime).join(" & ");
        endTime = selectedBundle.includedSlots.map(s => s.endTime).join(" & ");
        
        // If there's only one slot, use its type, otherwise use a generic or combined type
        type = selectedBundle.includedSlots.length === 1 
          ? selectedBundle.includedSlots[0].type 
          : selectedBundle.includedSlots.map(s => s.type).join("+");
      }

      const payloadDati = {
        nome: formData.nome,
        cognome: formData.cognome,
        email: formData.email,
        telefono: formData.telefono,
        childName: formData.childName,
        childLastName: formData.cognome, // Default to parent's last name
        childAge: parseInt(formData.childAge) || 0,
        locationId: formData.selectedLocation,
        locationName: locationName,
        selectedLocation: locationName,
        selectedSlot: {
          bundleId: selectedBundle?.bundleId,
          bundleName: bundleName,
          dayOfWeek: dayOfWeek,
          startTime: startTime,
          endTime: endTime,
          type: type
        },
        notes: `Lead da Pagina Pubblica. Sede: ${locationName}, Pacchetto: ${bundleName}`,
        privacyAccepted: privacyAccepted,
        marketingAccepted: false
      };
      // 2. Save directly to local Firebase (Project B)
      
      const leadData = {
        parentFirstName: formData.nome,
        parentLastName: formData.cognome,
        parentEmail: formData.email,
        parentPhone: formData.telefono,
        childName: formData.childName, 
        childAge: formData.childAge,
        selectedLocation: locationName,
        selectedSlot: payloadDati.selectedSlot,
        notes: `Selected Bundle: ${bundleName}. Lead from Public Landing Page (Event-Driven Flow)`,
        status: "new",
        privacyConsent: true,
        submittedAt: serverTimestamp(),
        source: "ep_public_web",
        userAgent: navigator.userAgent,
        syncStatus: "pending_sync"
      };

      if (db) {
        try {
          await addDoc(collection(db, "raw_registrations"), leadData);
        } catch (e) {
          console.error("Local save failed", e);
          throw new Error("Impossibile salvare i dati localmente. Riprova più tardi.");
        }
      } else {
        throw new Error("Impossibile connettersi al database locale. Riprova più tardi.");
      }

      // 3. DONE. The backend Firebase Cloud Function "syncRegistrationToGestionale" 
      //    (deployed on Project B) will automatically detect this new document 
      //    and sync it to Gestionale securely in the background.

      if (onSuccess) {
        onSuccess();
        // autoresetto dopo pochi secondi
        setTimeout(() => {
          setFormData({
            nome: '',
            cognome: '',
            email: '',
            telefono: '',
            childName: '',
            childAge: '',
            selectedLocation: '',
            selectedSlot: ''
          });
          setPrivacyAccepted(false);
          setCurrentCard(0);
        }, 5000);
      }
      
    } catch (err) {
      console.error("Errore durante l'invio:", err);
      setGlobalError("Si è verificato un errore di connessione. Riprova più tardi.");
    } finally {
      setLoading(false);
    }
  };

  // Filter logic for current slots
  const childAgeNum = parseInt(formData.childAge) || 0;
  
  /*
  // -- NEW MOTOR: Physical Occupancy & Minimo Comune Denominatore --
  const calculateAdjustedLocations = (locations: Location[], pending: PendingRegistration[]) => {
    if (locations.length === 0) return locations;
    // 1. Build local occupancy map for PENDING registrations
    // Key: ${locationId}_${dayOfWeek}_${startTime}
    const pendingOccupancy = new Map<string, number>();
    pending.forEach(reg => {
      const slot = reg.selectedSlot;
      if (!slot || !slot.bundleId) return;
      
      // Find the bundle definition to know all its physical slots
      const bundleDef = locations
        .flatMap(l => l.bundles)
        .find(b => b.bundleId === slot.bundleId);
        
      if (bundleDef) {
        bundleDef.includedSlots.forEach(s => {
          const key = `${reg.locationId}_${bundleDef.dayOfWeek}_${s.startTime}`;
          pendingOccupancy.set(key, (pendingOccupancy.get(key) || 0) + 1);
        });
      }
    });

    // 2. Adjust availability using the "Minimo Comune Denominatore" logic
    return locations.map(loc => ({
      ...loc,
      bundles: loc.bundles.map(bundle => {
        // Start with the base availability from the API (Project A)
        let minAvailable = bundle.availableSeats;
        
        // For each physical slot in the bundle, subtract local pending occupancy
        bundle.includedSlots.forEach(s => {
          const key = `${loc.sedeId}_${bundle.dayOfWeek}_${s.startTime}`;
          const pendingCount = pendingOccupancy.get(key) || 0;
          
          // The availability of this specific slot is the base minus local pending
          const availableForThisSlot = Math.max(0, bundle.availableSeats - pendingCount);
          
          // Logica del Minimo: il bundle è limitato dallo slot più pieno
          if (availableForThisSlot < minAvailable) {
            minAvailable = availableForThisSlot;
          }
        });

        return {
          ...bundle,
          availableSeats: minAvailable,
          isFull: bundle.isFull || minAvailable <= 0
        };
      })
    }));
  };
  */

  const filteredLocations = locationsWithRealAvailability.filter(loc => 
    loc.bundles.some(b => {
      const isBundleCompatible = isAgeCompatible(childAgeNum, b.minAge, b.maxAge);
      // For debug: only check age compatibility, ignore availability
      return isBundleCompatible;
    })
  );

  const selectedLocationObj = filteredLocations.find(l => l.sedeId === formData.selectedLocation);
  
  const currentBundles = selectedLocationObj 
    ? selectedLocationObj.bundles.filter(b => isAgeCompatible(childAgeNum, b.minAge, b.maxAge))
    : [];

  // Calculate first available date
  let firstAvailableDate: string | null = null;
  if (formData.selectedSlot) {
    const selectedBundle = currentBundles.find(b => b.bundleId === formData.selectedSlot);
    if (selectedBundle) {
      const dayName = dayNumberMap[selectedBundle.dayOfWeek] || 'Lunedì';
      firstAvailableDate = getNextDateString(dayName);
    }
  }

  // Style helpers
  const inputBaseStyle = "rounded-xl font-sans transition-all duration-300 py-1.5";
  const disabledStyle = "opacity-50 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200";
  const enabledStyle = "bg-slate-50 focus:bg-white focus:ring-brand-blue focus:border-brand-blue";

  const isCardValid = (index: number) => {
    switch (index) {
      case 0: return isNomeValid && isCognomeValid;
      case 1: return isEmailValid && isPhoneValid;
      case 2: return isChildNameValid && isChildAgeValid;
      case 3: return isLocationValid && isSlotValid;
      case 4: return privacyAccepted;
      default: return false;
    }
  };

  const handleNextCard = () => {
    if (currentCard < totalCards - 1 && isCardValid(currentCard)) {
      setCurrentCard(prev => prev + 1);
    }
  };

  const handlePrevCard = () => {
    if (currentCard > 0) {
      setCurrentCard(prev => prev - 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (currentCard < totalCards - 1) {
        handleNextCard();
      } else if (isCardValid(currentCard)) {
        handleSubmit(e as unknown as React.FormEvent);
      }
    }
  };

  const renderCardContent = (index: number) => {
    switch (index) {
      case 0:
        return (
          <div className="space-y-1">
            <h3 className="text-xs font-bold text-brand-red uppercase tracking-wider border-b border-slate-100 pb-1 mb-2">Dati Genitore</h3>
            <div className="grid grid-cols-1 gap-2">
              <Input id="nome" label="Nome" placeholder="Mario" value={formData.nome} onChange={handleChange} error={errors.nome} required className={`${inputBaseStyle} ${enabledStyle}`} />
              <Input id="cognome" label="Cognome" placeholder="Rossi" value={formData.cognome} onChange={handleChange} error={errors.cognome} required disabled={!isNomeValid} className={`${inputBaseStyle} ${!isNomeValid ? disabledStyle : enabledStyle}`} />
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-1">
            <h3 className="text-xs font-bold text-brand-red uppercase tracking-wider border-b border-slate-100 pb-1 mb-2">Contatti Genitore</h3>
            <div className="grid grid-cols-1 gap-2">
              <Input id="email" type="email" label="Email" placeholder="mario.rossi@email.com" value={formData.email} onChange={handleChange} error={errors.email} required disabled={!isCognomeValid} className={`${inputBaseStyle} ${!isCognomeValid ? disabledStyle : enabledStyle}`} />
              <Input id="telefono" type="tel" label="Telefono" placeholder="+39 333 123 4567" value={formatPhoneForDisplay(formData.telefono)} onChange={handleChange} error={errors.telefono} required disabled={!isEmailValid} className={`${inputBaseStyle} ${!isEmailValid ? disabledStyle : enabledStyle}`} />
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-1">
            <h3 className="text-xs font-bold text-brand-red uppercase tracking-wider border-b border-slate-100 pb-1 mb-2">Figlio/a</h3>
            <div className="grid grid-cols-1 gap-2">
              <Input id="childName" label="Nome" placeholder="Luca" value={formData.childName} onChange={handleChange} error={errors.childName} required disabled={!isPhoneValid} className={`${inputBaseStyle} ${!isPhoneValid ? disabledStyle : enabledStyle}`} />
              <div>
                <label htmlFor="childAge" className={`block text-xs font-medium mb-0.5 ${!isChildNameValid ? 'text-slate-400' : 'text-slate-700'}`}>Età <span className={!isChildNameValid ? 'text-slate-300' : 'text-red-500'}>*</span></label>
                <input id="childAge" type="number" min="1" max="100" placeholder="es. 8" value={formData.childAge} onChange={handleChange} disabled={!isChildNameValid} className={`appearance-none block w-full px-3 py-1.5 border rounded-xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-brand-blue focus:border-brand-blue sm:text-sm ${errors.childAge ? 'border-red-300 ring-1 ring-red-300' : 'border-slate-300'} ${!isChildNameValid ? disabledStyle : enabledStyle} ${inputBaseStyle}`} />
                {errors.childAge && <p className="mt-1 text-xs text-red-600">{errors.childAge}</p>}
              </div>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-1">
            <div className="flex items-baseline justify-start gap-4 border-b border-slate-100 pb-1 mb-1">
              <h3 className="text-xs font-bold text-brand-red uppercase tracking-wider">Preferenze</h3>
              {childAgeNum > 0 && (
                <p className="text-[11px] text-slate-400">
                  Mostra corsi per età: <span className="font-black text-slate-600 text-[14px]">{childAgeNum}</span> <span className="font-bold text-slate-400">anni</span>
                </p>
              )}
            </div>
            
            <div className="flex flex-col gap-1 h-full">
              <div className="flex flex-col gap-2 w-full max-h-[250px] overflow-y-auto pr-0.5">
                {isLoadingLocations ? (
                  <div className="text-center py-4 text-gray-500 text-xs">Caricamento sedi...</div>
                ) : filteredLocations.length === 0 ? (
                  <div className="text-center py-4 text-gray-500 text-xs">Nessuna sede disponibile per questa età</div>
                ) : (
                  filteredLocations.map(loc => {
                    // Extract city from address (last part after comma) or use default
                    let city = loc.citta;
                    if (!city && loc.indirizzo) {
                      const parts = loc.indirizzo.split(',');
                      if (parts.length > 1) {
                        city = parts[parts.length - 1].trim().toUpperCase();
                      } else {
                        city = "CITTÀ";
                      }
                    } else if (!city) {
                      city = "CITTÀ";
                    }

                    // Filter bundles compatible with child age for display
                    const visibleBundles = loc.bundles.filter(b => {
                      const isBundleCompatible = isAgeCompatible(childAgeNum, b.minAge, b.maxAge);
                      if (!isBundleCompatible) return false;
                      return b.includedSlots.some(slot => 
                        isAgeCompatible(childAgeNum, slot.minAge ?? b.minAge, slot.maxAge ?? b.maxAge)
                      );
                    });

                    return (
                      <div key={loc.sedeId} className="mb-3 p-2 rounded-xl border border-slate-200 bg-slate-200 shadow-sm">
                        <div className="flex justify-between items-stretch mb-2 gap-2">
                          <div className="bg-yellow-200 border border-yellow-400 px-3 py-1.5 rounded-xl shadow-sm flex-[3] flex items-center gap-3">
                            <Home className="w-8 h-8 text-yellow-950 flex-shrink-0" fill="white" strokeWidth={2} />
                            <h3 className="text-yellow-950 leading-tight flex flex-col">
                              <span className="uppercase font-black text-[16px] tracking-tight">{city}</span>
                              <span className="font-black text-[13px]">{loc.nomeSede}</span>
                            </h3>
                          </div>
                          
                          {loc.indirizzo && (
                            <a 
                              href={loc.googleMapsLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.indirizzo)}`}
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex flex-col items-center justify-center text-[9px] font-black px-4 flex-1 rounded-2xl border transition-colors bg-red-800 text-white border-red-900 lg:bg-slate-50 lg:text-brand-blue lg:border-slate-200 lg:hover:text-brand-red"
                              onClick={(e) => e.stopPropagation()}
                              title={loc.indirizzo}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="mb-0.5">
                                <path d="M20 10c0 6-9 13-9 13s-9-7-9-13a9 9 0 0 1 18 0z"></path>
                                <circle cx="12" cy="10" r="3"></circle>
                              </svg>
                              <span className="tracking-widest">MAPPA</span>
                            </a>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          {visibleBundles.length > 0 ? (
                            visibleBundles.map((bundle) => {
                              const isSelected = formData.selectedLocation === loc.sedeId && formData.selectedSlot === bundle.bundleId;
                              const min = bundle.minAge !== undefined ? bundle.minAge : 0;
                              const max = bundle.maxAge !== undefined ? bundle.maxAge : 99;
                              const dayName = dayNumberMap[bundle.dayOfWeek] || 'Sconosciuto';
                              const dayShort = dayName.substring(0, 3).toUpperCase();
                              const isFull = bundle.isFull || bundle.availableSeats === 0;
                              
                              return (
                                <div 
                                  key={bundle.bundleId}
                                  onClick={() => {
                                    if (isChildAgeValid && !isFull) {
                                      setFormData(prev => ({ ...prev, selectedLocation: loc.sedeId, selectedSlot: bundle.bundleId }));
                                      if (errors.selectedLocation) setErrors(prev => ({ ...prev, selectedLocation: undefined }));
                                      if (errors.selectedSlot) setErrors(prev => ({ ...prev, selectedSlot: undefined }));
                                    }
                                  }}
                                  className={`
                                    relative p-2.5 rounded-xl border transition-all duration-200
                                    ${isFull ? 'opacity-60 cursor-not-allowed border-slate-200 bg-slate-50' : 'cursor-pointer'}
                                    ${isSelected && !isFull
                                      ? 'border-brand-blue bg-blue-50 shadow-md ring-1 ring-brand-blue' 
                                      : !isFull ? 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50' : ''}
                                    ${!isChildAgeValid ? 'opacity-50 pointer-events-none' : ''}
                                  `}
                                >
                                  <div className="mb-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="font-extrabold text-brand-blue text-lg tracking-tight leading-none">
                                        {bundle.publicName}
                                      </span>
                                      <span className="text-[10px] text-brand-blue font-bold uppercase px-2 py-0.5 bg-white border border-brand-blue rounded-full shadow-sm whitespace-nowrap">
                                        {dayName}
                                      </span>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                      {bundle.description && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setInfoModalContent({ title: bundle.publicName || bundle.name, description: bundle.description || '' });
                                          }}
                                          className="w-8 h-8 rounded-full border-[2.5px] border-[#2b71b8] flex items-center justify-center text-[#2b71b8] hover:bg-blue-50 transition-colors bg-white shadow-sm"
                                        >
                                          <span className="font-serif italic font-bold text-xl leading-none" style={{ fontFamily: 'Georgia, serif' }}>i</span>
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (isChildAgeValid && !isFull) {
                                            setFormData(prev => ({ ...prev, selectedLocation: loc.sedeId, selectedSlot: bundle.bundleId }));
                                            if (errors.selectedLocation) setErrors(prev => ({ ...prev, selectedLocation: undefined }));
                                            if (errors.selectedSlot) setErrors(prev => ({ ...prev, selectedSlot: undefined }));
                                          }
                                        }}
                                        className={`px-3 py-1 rounded-lg border-2 text-sm font-bold transition-colors ${
                                          isSelected 
                                            ? 'bg-green-600 border-green-600 text-white' 
                                            : 'bg-white border-green-600 text-green-600 hover:bg-green-50'
                                        }`}
                                      >
                                        {isSelected ? 'OK' : 'seleziona'}
                                      </button>
                                    </div>
                                  </div>

                                  <div className="flex items-stretch gap-2">
                                    <div className="flex-1 space-y-2 bg-white/60 rounded-lg p-2 border border-slate-100">
                                      {bundle.includedSlots
                                        .filter(slot => isAgeCompatible(childAgeNum, slot.minAge ?? min, slot.maxAge ?? max))
                                        .map((slot, idx) => {
                                          const sMin = slot.minAge !== undefined ? slot.minAge : min;
                                          const sMax = slot.maxAge !== undefined ? slot.maxAge : max;
                                          const slotAgeText = (sMin === 0 && sMax === 99) ? "Tutte le età" : `${sMin}-${sMax} anni`;
                                          
                                          return (
                                            <div key={idx} className="flex flex-col gap-0.5">
                                              <div className="flex items-center gap-2">
                                                <span className={`
                                                  inline-block px-1.5 py-0.5 rounded text-[9px] font-black w-8 text-center
                                                  ${slot.type === 'SG' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}
                                                `}>
                                                  {slot.type}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{dayShort}</span>
                                              </div>
                                              <div className="flex items-center justify-between">
                                                <span className="font-bold text-slate-800 text-[12px] tracking-tight">{slot.startTime} - {slot.endTime}</span>
                                                <span className="text-slate-400 text-[10px] font-medium">{slotAgeText}</span>
                                              </div>
                                            </div>
                                          );
                                        })}
                                    </div>
                                    
                                    {(() => {
                                      const seats = isFull ? 0 : bundle.availableSeats;
                                      let badgeBg = '';
                                      let badgeTextCol = 'text-white';
                                      let topText = 'posti disponibili:';
                                      let bottomText = '';
                                      let bottomTextSize = 'text-2xl';

                                      if (seats === 0) {
                                        badgeBg = '#C0C0C0';
                                        bottomText = 'ESAURITI';
                                        bottomTextSize = 'text-[12px]';
                                      } else if (seats === 1) {
                                        badgeBg = '#FF0000';
                                        bottomText = '1';
                                      } else if (seats === 2) {
                                        badgeBg = '#FF8C00';
                                        bottomText = '2';
                                      } else if (seats === 3) {
                                        badgeBg = '#FFFF00';
                                        badgeTextCol = 'text-slate-900';
                                        bottomText = '3';
                                      } else if (seats === 4 || seats === 5) {
                                        badgeBg = '#32CD32';
                                        bottomText = seats.toString();
                                      } else {
                                        const occupied = bundle.originalCapacity - bundle.availableSeats;
                                        
                                        if (occupied === 0) {
                                          badgeBg = '#191970';
                                          topText = 'Nuovo corso in partenza!';
                                          bottomText = 'Procedi per essere ricontattat*';
                                          bottomTextSize = 'text-[9px]';
                                        } else if (occupied === 1 || occupied === 2) {
                                          badgeBg = '#FFFF00';
                                          badgeTextCol = 'text-slate-900';
                                          topText = 'ancora';
                                          bottomText = `${bundle.availableSeats} posti disponibili`;
                                          bottomTextSize = 'text-[10px]';
                                        } else {
                                          badgeBg = '#32CD32';
                                          topText = 'ancora';
                                          bottomText = `${bundle.availableSeats} posti disponibili`;
                                          bottomTextSize = 'text-[10px]';
                                        }
                                      }

                                      return (
                                        <div 
                                          className={`flex flex-col items-center justify-center px-2 py-2 rounded-xl min-w-[90px] max-w-[90px] text-center shadow-sm ${badgeTextCol}`}
                                          style={{ backgroundColor: badgeBg }}
                                        >
                                          <div className="flex flex-col items-center mb-1">
                                            <span className="text-[8px] leading-tight font-bold uppercase text-center">
                                              {topText}
                                            </span>
                                          </div>
                                          <span className={`${bottomTextSize} font-black leading-none text-center`}>
                                            {bottomText}
                                          </span>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-[10px] text-slate-400 italic">Nessun pacchetto disponibile per questa età.</p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              {(errors.selectedLocation || errors.selectedSlot) && <p className="mt-1 text-xs text-red-600">Seleziona un pacchetto per continuare</p>}

              {firstAvailableDate && (
                <div className="mt-1 p-1.5 bg-blue-50 border border-blue-100 rounded-lg animate-in fade-in slide-in-from-top-2">
                  <p className="text-xs text-brand-blue text-center">
                    <span className="block text-[9px] text-blue-400 tracking-wider font-semibold mb-0 leading-tight">Se decidessi di iscriverti, la tua prima lezione disponibile sarebbe:</span>
                    <span className="font-bold capitalize">{firstAvailableDate}</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-brand-red uppercase tracking-wider border-b border-slate-100 pb-1 mb-2">Conferma</h3>
            <div className={`transition-opacity duration-300 ${!isSlotValid ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
              <div className="flex items-start gap-2">
                <div className="flex items-center h-5">
                  <input id="privacy" name="privacy" type="checkbox" checked={privacyAccepted} disabled={!isSlotValid} onChange={(e) => { setPrivacyAccepted(e.target.checked); if (e.target.checked && errors.privacy) { setErrors(prev => ({ ...prev, privacy: undefined })); } }} className={`h-4 w-4 rounded border-gray-300 text-brand-blue focus:ring-brand-blue transition duration-150 ease-in-out cursor-pointer ${errors.privacy ? 'border-red-300 ring-1 ring-red-300' : ''}`} />
                </div>
                <div className="text-xs">
                  <label htmlFor="privacy" className="font-medium text-slate-700 cursor-pointer font-sans">Consenso Privacy <span className="text-brand-red">*</span></label>
                  <p className="text-slate-500 text-[10px] mt-0.5 leading-tight font-sans">
                    Accetto il trattamento dei miei dati personali secondo la 
                    <button type="button" onClick={() => setShowPrivacyModal(true)} className="ml-1 text-brand-blue hover:text-brand-red font-bold underline focus:outline-none transition-colors">Privacy Policy</button> 
                    ai fini della gestione dell'evento.
                  </p>
                </div>
              </div>
              {errors.privacy && <p className="mt-1 text-xs text-brand-red pl-6 font-medium font-sans">{errors.privacy}</p>}
            </div>
            
            {globalError && (
              <div className="p-2 rounded-xl bg-red-50 border border-red-100 animate-pulse">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-4 w-4 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-2">
                    <h3 className="text-xs font-medium text-brand-red font-serif">Errore</h3>
                    <div className="mt-0.5 text-xs text-red-700 font-sans">
                      <p>{globalError}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className={`pt-1 transition-all duration-300 ${!privacyAccepted ? 'opacity-50 pointer-events-none grayscale' : 'opacity-100'}`}>
              <Button type="button" onClick={handleSubmit} isLoading={loading} disabled={!privacyAccepted} className="w-full bg-brand-red hover:bg-red-700 text-white font-bold py-2 px-4 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 font-sans text-base">
                INVIA
              </Button>
              <p className="text-center text-[10px] text-slate-400 mt-1 flex items-center justify-center font-sans">
                <svg className="w-2.5 h-2.5 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"></path></svg>
                I dati verranno salvati in modo sicuro.
              </p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <div className="w-full max-w-md mx-auto pb-10 relative flex items-center justify-center">
        
        {/* Left Chevron */}
        <button 
          type="button"
          onClick={handlePrevCard}
          disabled={currentCard === 0}
          className={`absolute left-0 z-10 p-1 sm:p-2 -ml-6 sm:-ml-12 text-brand-blue transition-all duration-300 ${currentCard === 0 ? 'opacity-0 pointer-events-none scale-90' : 'opacity-100 hover:scale-110'}`}
          aria-label="Indietro"
        >
          <ChevronLeft className="w-10 h-10 sm:w-12 sm:h-12" strokeWidth={3} />
        </button>

        {/* Card Container */}
        <div className="w-full overflow-hidden px-1 pb-6">
          <form onKeyDown={handleKeyDown} className="flex transition-transform duration-500 ease-in-out" style={{ transform: `translateX(-${currentCard * 100}%)` }}>
            {[0, 1, 2, 3, 4].map((index) => (
              <div key={index} className="w-full flex-shrink-0 px-1">
                <Card className="shadow-2xl border-0 rounded-3xl bg-white/95 backdrop-blur-sm pt-3 border-t-4 border-brand-red min-h-[200px] flex flex-col">
                  <CardContent className="px-4 pb-1 pt-1 flex-1 overflow-y-auto">
                    {renderCardContent(index)}
                  </CardContent>
                </Card>
              </div>
            ))}
          </form>
        </div>

        {/* Right Chevron */}
        <button 
          type="button"
          onClick={handleNextCard}
          disabled={currentCard === totalCards - 1 || !isCardValid(currentCard)}
          className={`absolute right-0 z-10 p-1 sm:p-2 -mr-6 sm:-mr-12 text-brand-blue transition-all duration-300 ${currentCard === totalCards - 1 ? 'opacity-0 pointer-events-none scale-90' : 'opacity-100 hover:scale-110'} ${!isCardValid(currentCard) ? 'opacity-30 cursor-not-allowed' : ''}`}
          aria-label="Avanti"
        >
          <ChevronRight className="w-10 h-10 sm:w-12 sm:h-12" strokeWidth={3} />
        </button>

      </div>

      {/* Pagination Dots */}
      <div className="flex justify-center gap-2 -mt-6 pb-4">
        {[0, 1, 2, 3, 4].map((index) => (
          <div 
            key={index} 
            className={`h-2 rounded-full transition-all duration-300 ${currentCard === index ? 'w-6 bg-brand-blue' : 'w-2 bg-slate-300'}`}
          />
        ))}
      </div>

      {/* Privacy Modal */}
      <Modal 
        isOpen={showPrivacyModal} 
        onClose={() => setShowPrivacyModal(false)}
        title="Informativa sulla Privacy"
      >
        <div className="space-y-4 text-slate-600 font-serif text-sm leading-relaxed">
          <p>
            Ai sensi del Regolamento (UE) 2016/679 (GDPR), ti informiamo che i tuoi dati personali saranno trattati da EasyPeasy Labs per le finalità strettamente connesse alla gestione della tua iscrizione all'evento.
          </p>
          <h4 className="font-bold text-brand-blue font-serif text-base">1. Finalità del trattamento</h4>
          <p>
            I dati raccolti (nome, cognome, email, telefono, dati studente) saranno utilizzati esclusivamente per l'organizzazione dell'evento, l'invio di comunicazioni logistiche e la gestione degli accessi.
          </p>
          <h4 className="font-bold text-brand-blue font-serif text-base">2. Conservazione dei dati</h4>
          <p>
            I tuoi dati saranno conservati per il tempo strettamente necessario all'espletamento delle finalità sopra indicate e successivamente cancellati, salvo obblighi di legge.
          </p>
          <h4 className="font-bold text-brand-blue font-serif text-base">3. I tuoi diritti</h4>
          <p>
            Hai il diritto di chiedere al titolare del trattamento l'accesso ai tuoi dati personali, la rettifica, la cancellazione degli stessi o la limitazione del trattamento.
          </p>
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 mt-4">
            <p className="italic text-xs text-brand-blue">
              Cliccando su "Ho capito" confermi di aver letto e compreso l'informativa.
            </p>
          </div>
        </div>
      </Modal>

      {/* Info Modal */}
      {infoModalContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6">
              <h3 className="text-xl font-extrabold text-brand-blue mb-3">
                {infoModalContent.title}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed mb-6">
                {infoModalContent.description}
              </p>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setInfoModalContent(null)}
                  className="px-5 py-2 bg-brand-blue text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
                >
                  Ho capito
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
