import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Home } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { db, collection, addDoc, serverTimestamp } from '../../lib/firebase';

// -- TYPES --
// ... (rest of types)
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

interface PortalText {
  id: string;
  type: 'absence_recovery_warning' | 'payment_method';
  title: string;
  content: string;
  paymentMethod?: string;
  isActive: boolean;
  order: number;
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
  
  // Dynamic locations state
  const [availableLocations, setAvailableLocations] = useState<Location[]>([]);
  const [pendingRegistrations] = useState<PendingRegistration[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [infoModalContent, setInfoModalContent] = useState<{ title: string, description: string } | null>(null);
  const [portalTexts, setPortalTexts] = useState<PortalText[]>([]);

  const totalCards = useMemo(() => {
    let count = 5; // Base steps: name, contact, child, location/slot, confirmation
    if (portalTexts.some(t => t.type === 'absence_recovery_warning' && t.isActive)) count++;
    if (portalTexts.some(t => t.type === 'payment_method' && t.isActive)) count++;
    return count;
  }, [portalTexts]);

  const prevCountRef = useRef(0);

  const [showScrollIndicator, setShowScrollIndicator] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const resetScrollTimer = () => {
    setShowScrollIndicator(false);
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    
    // Check if we are in step 3 (Preferences)
    const hasAbsenceTexts = portalTexts.some(t => t.type === 'absence_recovery_warning' && t.isActive);
    const hasPaymentTexts = portalTexts.some(t => t.type === 'payment_method' && t.isActive);
    let effectiveStep = currentCard;
    if (hasAbsenceTexts && currentCard >= 4) effectiveStep--;
    if (hasPaymentTexts && currentCard >= (hasAbsenceTexts ? 5 : 4)) effectiveStep--;

    if (effectiveStep === 3 && !formData.selectedSlot) {
      scrollTimeoutRef.current = setTimeout(() => {
        setShowScrollIndicator(true);
      }, 3000);
    }
  };

  useEffect(() => {
    resetScrollTimer();
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [currentCard, formData.selectedLocation, formData.selectedSlot]);

  const handleScroll = () => {
    resetScrollTimer();
  };

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
          console.log("DEBUG: API getPublicSlotsV5 response:", apiResponse.data);
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

  // Fetch portal texts
  useEffect(() => {
    const fetchPortalTexts = async () => {
      try {
        const response = await fetch('/api/getPortalTexts', {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });

        if (response.ok) {
          const apiResponse = await response.json();
          if (apiResponse.success && Array.isArray(apiResponse.data)) {
            setPortalTexts(apiResponse.data);
          }
        }
      } catch (error) {
        console.warn('Warning fetching portal texts:', error);
        // Non blocchiamo il form se i testi non si caricano
      }
    };

    fetchPortalTexts();
  }, []);

  // Real-time availability calculation
  const locationsWithRealAvailability = React.useMemo(() => {
    return availableLocations.map(loc => ({
      ...loc,
      bundles: loc.bundles.map(bundle => {
        const pendingCount = pendingRegistrations.filter(r =>
          r.locationId === loc.sedeId && r.selectedSlot.bundleId === bundle.bundleId
        ).length;

        const realAvailableSeats = Math.max(0, bundle.availableSeats - pendingCount);

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
    const hasAbsenceTexts = portalTexts.some(t => t.type === 'absence_recovery_warning' && t.isActive);
    const hasPaymentTexts = portalTexts.some(t => t.type === 'payment_method' && t.isActive);
    
    let baseIndex = index;
    if (hasAbsenceTexts && index >= 4) baseIndex--;
    if (hasPaymentTexts && index >= (hasAbsenceTexts ? 5 : 4)) baseIndex--;
    
    switch (baseIndex) {
      case 0: return isNomeValid && isCognomeValid;
      case 1: return isEmailValid && isPhoneValid;
      case 2: return isChildNameValid && isChildAgeValid;
      case 3: return isLocationValid && isSlotValid;
      case 4: return privacyAccepted;
      default: return true; // Additional info steps are always valid
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
    const hasAbsenceTexts = portalTexts.some(t => t.type === 'absence_recovery_warning' && t.isActive);
    const hasPaymentTexts = portalTexts.some(t => t.type === 'payment_method' && t.isActive);
    
    // Calculate the effective step index, accounting for inserted info steps
    let effectiveIndex = index;
    let absenceStepIndex = -1;
    let paymentStepIndex = -1;
    
    if (hasAbsenceTexts) {
      absenceStepIndex = 4;
      if (index >= absenceStepIndex) effectiveIndex--;
    }
    if (hasPaymentTexts) {
      paymentStepIndex = hasAbsenceTexts ? 5 : 4;
      if (index >= paymentStepIndex) effectiveIndex--;
    }
    
    // Handle info steps
    if (index === absenceStepIndex) {
      const absenceTexts = portalTexts.filter(t => t.type === 'absence_recovery_warning' && t.isActive);
      return (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-brand-red uppercase tracking-wider border-b border-slate-100 pb-1 mb-2">Assenze e Recuperi</h3>
          <div className="max-h-[300px] overflow-y-auto space-y-3">
            {absenceTexts.map(text => (
              <div key={text.id} className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <h4 className="text-sm font-bold text-amber-800 mb-2">{text.title}</h4>
                <div className="text-xs text-amber-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: text.content }} />
              </div>
            ))}
          </div>
        </div>
      );
    }
    
    if (index === paymentStepIndex) {
      const paymentTexts = portalTexts.filter(t => t.type === 'payment_method' && t.isActive);
      return (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-brand-red uppercase tracking-wider border-b border-slate-100 pb-1 mb-2">Modalità di Pagamento</h3>
          <div className="max-h-[300px] overflow-y-auto space-y-3">
            {paymentTexts.map(text => (
              <div key={text.id} className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="text-sm font-bold text-blue-800 mb-2">
                  {text.paymentMethod ? `${text.paymentMethod}: ${text.title}` : text.title}
                </h4>
                <div className="text-xs text-blue-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: text.content }} />
              </div>
            ))}
          </div>
        </div>
      );
    }
    
    // Handle base steps
    switch (effectiveIndex) {
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
          <div className="space-y-3">
            <div className="flex items-baseline justify-start gap-4 border-b border-slate-100 pb-1 mb-2">
              <h3 className="text-xs font-black text-brand-red uppercase tracking-wider">PREFERENZE</h3>
              {childAgeNum > 0 && (
                <p className="text-[11px] text-slate-400">
                  Mostra corsi per età: <span className="font-black text-slate-600 text-[14px]">{childAgeNum}</span> <span className="font-bold text-slate-400">anni</span>
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1 h-full relative">
              <div 
                ref={scrollContainerRef}
                onScroll={handleScroll}
                onTouchStart={resetScrollTimer}
                className="flex flex-col gap-5 w-full max-h-[420px] overflow-y-auto pr-0.5 scroll-smooth pb-10"
              >
                {isLoadingLocations ? (
                  <div className="text-center py-4 text-gray-500 text-xs italic">Caricamento sedi...</div>
                ) : filteredLocations.length === 0 ? (
                  <div className="text-center py-4 text-gray-500 text-xs italic">Nessuna sede disponibile per questa età</div>
                ) : (
                  filteredLocations.map(loc => {
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

                    const visibleBundles = loc.bundles.filter(b => {
                      const isBundleCompatible = isAgeCompatible(childAgeNum, b.minAge, b.maxAge);
                      if (!isBundleCompatible) return false;
                      return b.includedSlots.some(slot =>
                        isAgeCompatible(childAgeNum, slot.minAge ?? b.minAge, slot.maxAge ?? b.maxAge)
                      );
                    });

                    return (
                      <div key={loc.sedeId} className="space-y-4 mb-6">
                        {/* Location Header - step.png style */}
                        <div className="flex gap-2 h-20 px-1">
                          {/* Sede Info Box */}
                          <div className="flex-[3] bg-[#fdf289] border-[3px] border-slate-300 rounded-[1.5rem] flex items-center p-3 gap-3 shadow-sm">
                            <div className="bg-white border-[3px] border-slate-300 rounded-xl p-1.5 flex-shrink-0 shadow-inner">
                              <Home className="w-8 h-8 text-slate-800" strokeWidth={2.5} />
                            </div>
                            <div className="flex flex-col leading-none overflow-hidden">
                              <span className="font-black text-slate-800 text-[15px] uppercase truncate tracking-tight">{loc.nomeSede}</span>
                              <span className="font-bold text-slate-600 text-[13px] uppercase truncate mt-0.5">({city})</span>
                            </div>
                          </div>

                          {/* Map Button */}
                          {loc.indirizzo && (
                            <a
                              href={loc.googleMapsLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.indirizzo)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 bg-[#9c1b1c] border-[3px] border-slate-300 rounded-[1.5rem] flex flex-col items-center justify-center text-white transition-all active:scale-95 shadow-md hover:bg-red-900"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="bg-white rounded-full p-1 mb-1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9c1b1c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M20 10c0 6-9 13-9 13s-9-7-9-13a9 9 0 0 1 18 0z"></path>
                                  <circle cx="12" cy="10" r="3"></circle>
                                </svg>
                              </div>
                              <span className="text-[9px] font-black uppercase tracking-widest leading-none">MAPPA</span>
                            </a>
                          )}
                        </div>

                        {/* Bundle Cards */}
                        <div className="space-y-5 px-1">
                          {visibleBundles.map((bundle) => {
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
                                  }
                                }}
                                className={`
                                  relative p-5 rounded-[2.2rem] border-[3px] transition-all duration-300 bg-white shadow-xl
                                  ${isFull ? 'opacity-60 cursor-not-allowed border-slate-100' : 'cursor-pointer'}
                                  ${isSelected && !isFull ? 'border-brand-blue ring-4 ring-blue-100 scale-[1.01]' : !isFull ? 'border-slate-100 hover:border-blue-200' : ''}
                                `}
                              >
                                {/* Row 1: Title and Info */}
                                <div className="flex items-center justify-between mb-4">
                                  <h4 className="font-black text-[#1d4f91] text-[22px] tracking-tight leading-none uppercase">
                                    {bundle.publicName}
                                  </h4>
                                  {bundle.description && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setInfoModalContent({ title: bundle.publicName || bundle.name, description: bundle.description || '' });
                                      }}
                                      className="w-10 h-10 rounded-full border-[3px] border-brand-blue flex items-center justify-center text-brand-blue bg-white shadow-sm hover:bg-blue-50 transition-colors"
                                    >
                                      <span className="font-serif italic font-black text-[22px] leading-none">i</span>
                                    </button>
                                  )}
                                </div>

                                {/* Row 2: Day Badge and Select Button */}
                                <div className="flex items-center justify-between mb-5">
                                  <div className="px-5 py-1.5 border-[3px] border-brand-blue rounded-full bg-white shadow-sm">
                                    <span className="text-brand-blue font-black text-[12px] uppercase tracking-wider">{dayName}</span>
                                  </div>
                                  <button
                                    type="button"
                                    className={`px-8 py-1.5 border-[3px] rounded-2xl font-black text-[14px] uppercase transition-all ${isSelected
                                      ? 'bg-green-600 border-green-600 text-white shadow-md'
                                      : 'bg-white border-[#22c55e] text-[#22c55e] hover:bg-green-50'
                                    }`}
                                  >
                                    {isSelected ? 'OK' : 'seleziona'}
                                  </button>
                                </div>

                                {/* Row 3: Slot Details and Availability */}
                                <div className="flex gap-3 items-stretch">
                                  {/* Details Box */}
                                  <div className="flex-[3] bg-blue-50/50 rounded-2xl border-[2px] border-slate-100 p-3.5 flex flex-col justify-center gap-2">
                                    {bundle.includedSlots
                                      .filter(slot => isAgeCompatible(childAgeNum, slot.minAge ?? min, slot.maxAge ?? max))
                                      .map((slot, idx) => {
                                        const sMin = slot.minAge !== undefined ? slot.minAge : min;
                                        const sMax = slot.maxAge !== undefined ? slot.maxAge : max;
                                        const slotAgeText = (sMin === 0 && sMax === 99) ? "Tutte le età" : `${sMin}-${sMax} anni`;

                                        return (
                                          <div key={idx} className="flex flex-col gap-1.5">
                                            <div className="flex items-center gap-3">
                                              <span className="bg-blue-100 text-brand-blue px-2 py-0.5 rounded text-[10px] font-black uppercase shadow-sm">
                                                {slot.type}
                                              </span>
                                              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{dayShort}</span>
                                            </div>
                                            <div className="flex items-baseline justify-between">
                                              <span className="font-black text-slate-800 text-[18px] tracking-tight">{slot.startTime} - {slot.endTime}</span>
                                              <span className="text-slate-400 text-[10px] font-bold italic">{slotAgeText}</span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                  </div>

                                  {/* Availability Box */}
                                  {(() => {
                                    const seats = isFull ? 0 : bundle.availableSeats;
                                    const occupied = bundle.originalCapacity - bundle.availableSeats;
                                    
                                    let badgeBg = '#32CD32'; // Verde Standard
                                    let badgeTextColor = '#171717';
                                    let topText = 'POSTI DISPONIBILI:';
                                    let bottomText = seats.toString();

                                    if (seats === 0) {
                                      badgeBg = '#C0C0C0';
                                      topText = 'POSTI ESAURITI';
                                      bottomText = '';
                                    } else if (occupied <= 1) {
                                      badgeBg = '#017010';
                                      badgeTextColor = '#ffffff';
                                      topText = 'Nuovo corso in partenza!';
                                      bottomText = '';
                                    } else if (seats <= 2) {
                                      badgeBg = '#FFFF00';
                                    }

                                    return (
                                      <div
                                        className="flex-1 rounded-2xl flex flex-col items-center justify-center p-2 text-center shadow-lg border-b-4 border-black/10 min-w-[100px]"
                                        style={{ backgroundColor: badgeBg, color: badgeTextColor }}
                                      >
                                        <div className="text-[9px] font-black leading-tight uppercase opacity-90 px-1 tracking-tighter">
                                          {topText}
                                        </div>
                                        {bottomText && (
                                          <div className="text-[36px] font-black leading-none mt-1">
                                            {bottomText}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              
              {/* Pulsing Scroll Indicator */}
              {showScrollIndicator && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black text-brand-blue uppercase tracking-widest bg-white/95 backdrop-blur-sm px-4 py-1.5 rounded-full mb-1 shadow-md border border-slate-100">SCOPRI ALTRE SEDI</span>
                    <div className="animate-bounce">
                      <svg 
                        width="24" 
                        height="20" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="#2b71b8" 
                        strokeWidth="4" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                        style={{ animation: 'pulse-v 1.5s infinite ease-in-out' }}
                      >
                        <path d="M7 13l5 5 5-5M7 6l5 5 5-5" />
                      </svg>
                    </div>
                  </div>
                </div>
              )}

              {(errors.selectedLocation || errors.selectedSlot) && <p className="mt-2 text-[11px] font-black text-red-600 text-center uppercase animate-pulse">⚠️ Seleziona un pacchetto per continuare</p>}

              <style>{`
                @keyframes pulse-v {
                  0%, 100% { transform: translateY(0) scale(1); opacity: 0.8; }
                  50% { transform: translateY(8px) scale(1.1); opacity: 1; }
                }
              `}</style>

              {firstAvailableDate && (
                <div className="mt-3 p-3 bg-blue-50 border-2 border-blue-100 rounded-[1.5rem] shadow-inner animate-in fade-in slide-in-from-top-4">
                  <p className="text-xs text-brand-blue text-center flex flex-col gap-1">
                    <span className="text-[9px] text-blue-400 tracking-widest uppercase font-black opacity-80">Prima lezione disponibile:</span>
                    <span className="text-[14px] font-black capitalize bg-white/50 py-1 px-4 rounded-full inline-block mx-auto">{firstAvailableDate}</span>
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
            {Array.from({ length: totalCards }, (_, i) => i).map((index) => (
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
        {Array.from({ length: totalCards }, (_, i) => i).map((index) => (
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
              <div className="text-sm text-slate-600 leading-relaxed mb-6 whitespace-pre-wrap">
                {infoModalContent.description}
              </div>
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
