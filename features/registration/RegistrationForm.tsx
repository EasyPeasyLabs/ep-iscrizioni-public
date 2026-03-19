import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { db, serverTimestamp, collection, addDoc } from '../../lib/firebase';

// -- TYPES --
interface Slot {
  giorno: string;
  orario: string;
  postiRimanenti: number;
  esaurito: boolean;
  minAge: number;
  maxAge: number;
  tipo: string;
}

interface Location {
  sedeId: string;
  nomeSede: string;
  indirizzo: string;
  citta: string;
  googleMapsLink?: string;
  slot: Slot[];
}

// API Response Types
interface ApiSlot {
  dayOfWeek: number;
  startTime: string;
  endTime?: string;
  minAge: number;
  maxAge: number;
  availableSeats: number;
  isFull: boolean;
  type?: string;
}

interface ApiLocation {
  id: string;
  name: string;
  address?: string;
  city?: string;
  googleMapsLink?: string;
  slots: ApiSlot[];
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

const PUBLIC_SLOTS_URL = "https://europe-west1-ep-gestionale-v1.cloudfunctions.net/getPublicSlotsV2";

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
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);

  const prevCountRef = useRef(0);

  // Fetch available slots
  useEffect(() => {
    const fetchSlots = async () => {
      setIsLoadingLocations(true);
      try {
        const response = await fetch(PUBLIC_SLOTS_URL, {
          method: "GET",
          headers: {
            "Accept": "application/json",
            "Authorization": "Bearer EP_V1_BRIDGE_SECURE_KEY_8842_XY"
          }
        });
        
        if (!response.ok) throw new Error("Failed to fetch slots");
        
        const apiResponse: ApiResponse = await response.json();
        
        if (apiResponse.success && Array.isArray(apiResponse.data)) {
          const mappedLocations: Location[] = apiResponse.data.map((loc) => ({
            sedeId: loc.id,
            nomeSede: loc.name || 'Sede senza nome',
            indirizzo: loc.address || '',
            citta: loc.city || '',
            googleMapsLink: loc.googleMapsLink,
            slot: (loc.slots || []).map((s) => ({
              giorno: dayNumberMap[s.dayOfWeek] || 'Sconosciuto',
              orario: s.endTime ? `${s.startTime} - ${s.endTime}` : s.startTime,
              postiRimanenti: typeof s.availableSeats === 'number' ? s.availableSeats : 0,
              esaurito: s.isFull || s.availableSeats === 0,
              minAge: typeof s.minAge === 'number' ? s.minAge : 0,
              maxAge: typeof s.maxAge === 'number' ? s.maxAge : 99,
              tipo: s.type || 'LAB'
            }))
          }));
          setAvailableLocations(mappedLocations);
        } else {
          throw new Error("Invalid response format");
        }
      } catch (error) {
        console.error("Error fetching slots:", error);
        setGlobalError("Impossibile caricare le disponibilità. Riprova più tardi.");
      } finally {
        setIsLoadingLocations(false);
      }
    };

    fetchSlots();
  }, []);

  // Validation Logic Helpers
  const isNomeValid = formData.nome.trim().length > 1;
  const isCognomeValid = formData.cognome.trim().length > 1;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
  const isPhoneValid = formData.telefono.trim().length > 5;
  const isChildNameValid = formData.childName.trim().length > 1;
  const isChildAgeValid = formData.childAge.trim().length > 0;
  const isLocationValid = formData.selectedLocation !== '';
  const isSlotValid = formData.selectedSlot !== '';

  // Calculate completed fields
  useEffect(() => {
    let count = 0;
    if (isNomeValid) count++;
    if (isCognomeValid) count++;
    if (isEmailValid) count++;
    if (isPhoneValid) count++;
    if (isChildNameValid) count++;
    if (isChildAgeValid) count++;
    if (isLocationValid && isSlotValid) count++;
    if (privacyAccepted) count++;
    
    if (onProgressUpdate && count !== prevCountRef.current) {
      onProgressUpdate(count);
      prevCountRef.current = count;
    }
  }, [formData, privacyAccepted, onProgressUpdate, isNomeValid, isCognomeValid, isEmailValid, isPhoneValid, isChildNameValid, isChildAgeValid, isLocationValid, isSlotValid]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { id, value } = e.target;
    
    if (id === 'selectedLocation') {
      setFormData(prev => ({ ...prev, selectedLocation: value, selectedSlot: '' }));
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
      const leadData = {
        parentFirstName: formData.nome,
        parentLastName: formData.cognome,
        parentEmail: formData.email,
        parentPhone: formData.telefono,
        childName: formData.childName, 
        childAge: formData.childAge,
        selectedLocation: formData.selectedLocation,
        selectedSlot: formData.selectedSlot,
        notes: `Selected Slot: ${formData.selectedSlot}. Lead from Public Landing Page (Full Flow)`,
        status: "new",
        privacyConsent: true,
        submittedAt: serverTimestamp(),
        source: "ep_public_web",
        userAgent: navigator.userAgent
      };

      if (!db) {
        throw new Error("Database connection not initialized");
      }

      await addDoc(collection(db, "raw_registrations"), leadData);

      if (onSuccess) {
        onSuccess();
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
  
  const filteredLocations = availableLocations.filter(loc => 
    loc.slot.some(s => isAgeCompatible(childAgeNum, s.minAge, s.maxAge))
  );

  const selectedLocationObj = filteredLocations.find(l => l.sedeId === formData.selectedLocation);
  
  const currentSlots = selectedLocationObj 
    ? selectedLocationObj.slot.filter(s => isAgeCompatible(childAgeNum, s.minAge, s.maxAge))
    : [];

  // Calculate first available date
  let firstAvailableDate: string | null = null;
  if (formData.selectedSlot) {
    const [day] = formData.selectedSlot.split(' ');
    firstAvailableDate = getNextDateString(day);
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
        handleSubmit(e as any);
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
              <Input id="telefono" type="tel" label="Telefono" placeholder="+39 333 1234567" value={formData.telefono} onChange={handleChange} error={errors.telefono} required disabled={!isEmailValid} className={`${inputBaseStyle} ${!isEmailValid ? disabledStyle : enabledStyle}`} />
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
            <h3 className="text-xs font-bold text-brand-red uppercase tracking-wider border-b border-slate-100 pb-1 mb-2">Preferenze</h3>
            {childAgeNum > 0 && (
              <p className="text-[10px] text-gray-500 mb-2">
                Mostra corsi per età: <span className="font-semibold">{childAgeNum} anni</span>
              </p>
            )}
            
            <div className="flex flex-col gap-2 h-full">
              <label className={`block text-xs font-medium mb-0.5 ${!isChildAgeValid ? 'text-slate-400' : 'text-slate-700'}`}>Sede Preferita <span className={!isChildAgeValid ? 'text-slate-300' : 'text-red-500'}>*</span></label>
              
              <div className="flex flex-col gap-2 w-full max-h-[180px] overflow-y-auto pr-1">
                {isLoadingLocations ? (
                  <div className="text-center py-4 text-gray-500 text-xs">Caricamento sedi...</div>
                ) : filteredLocations.length === 0 ? (
                  <div className="text-center py-4 text-gray-500 text-xs">Nessuna sede disponibile per questa età</div>
                ) : (
                  filteredLocations.map(loc => {
                    const isSelected = formData.selectedLocation === loc.sedeId;

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

                    // Filter slots compatible with child age for display
                    const visibleSlots = loc.slot.filter(s => isAgeCompatible(childAgeNum, s.minAge, s.maxAge));

                    return (
                      <div 
                        key={loc.sedeId}
                        onClick={() => {
                          if (isChildAgeValid) {
                            setFormData(prev => ({ ...prev, selectedLocation: loc.sedeId, selectedSlot: '' }));
                          }
                        }}
                        className={`
                          relative p-3 rounded-lg border cursor-pointer transition-all duration-200
                          ${isSelected 
                            ? 'border-brand-blue bg-blue-50 shadow-sm' 
                            : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'}
                          ${!isChildAgeValid ? 'opacity-50 pointer-events-none' : ''}
                        `}
                      >
                        <div className={`absolute top-3 right-3 w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-brand-blue' : 'border-slate-300'}`}>
                          {isSelected && <div className="w-2 h-2 rounded-full bg-brand-blue" />}
                        </div>

                        <h3 className="font-medium text-slate-900 pr-6 text-sm mb-2">
                          <span className="font-bold uppercase">{city}</span> - {loc.nomeSede}
                        </h3>

                        {/* Slot List Display */}
                        <div className="space-y-1.5 mb-2">
                          {visibleSlots.length > 0 ? (
                            visibleSlots.map((slot, idx) => {
                              const min = slot.minAge !== undefined ? slot.minAge : 0;
                              const max = slot.maxAge !== undefined ? slot.maxAge : 99;
                              const ageText = (min === 0 && max === 99) ? "Tutte le età" : `${min}-${max} anni`;
                              const dayShort = slot.giorno.substring(0, 3).toUpperCase();
                              const type = slot.tipo || 'LAB'; // Default to LAB if missing
                              
                              return (
                                <div key={idx} className="flex items-center text-xs text-slate-600">
                                  <span className={`
                                    inline-block px-1.5 py-0.5 rounded text-[10px] font-bold mr-2 w-9 text-center
                                    ${type === 'SG' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}
                                  `}>
                                    {type}
                                  </span>
                                  <span className="font-mono font-medium mr-2 w-8">{dayShort}</span>
                                  <span className="mr-2">{slot.orario}</span>
                                  <span className="text-slate-500 text-[10px]">{ageText}</span>
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-xs text-slate-400 italic">Nessun orario disponibile per questa età.</p>
                          )}
                        </div>

                        {loc.indirizzo && (
                          <div className="mt-2 pt-2 border-t border-slate-100 flex items-start text-[10px] text-slate-500">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1 text-brand-red flex-shrink-0 mt-0.5">
                              <path d="M20 10c0 6-9 13-9 13s-9-7-9-13a9 9 0 0 1 18 0z"></path>
                              <circle cx="12" cy="10" r="3"></circle>
                            </svg>
                            <a 
                              href={loc.googleMapsLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.indirizzo)}`}
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="hover:underline hover:text-brand-blue leading-tight"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {loc.indirizzo}
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              {errors.selectedLocation && <p className="mt-1 text-xs text-red-600">{errors.selectedLocation}</p>}

              <div className="mt-2">
                <label htmlFor="selectedSlot" className={`block text-xs font-medium mb-0.5 ${!isLocationValid ? 'text-slate-400' : 'text-slate-700'}`}>Giorno e Orario <span className={!isLocationValid ? 'text-slate-300' : 'text-red-500'}>*</span></label>
                <select id="selectedSlot" value={formData.selectedSlot} onChange={handleChange} disabled={!isLocationValid} className={`block w-full px-3 py-1.5 border rounded-xl shadow-sm focus:outline-none focus:ring-brand-blue focus:border-brand-blue sm:text-sm ${errors.selectedSlot ? 'border-red-300 ring-1 ring-red-300' : 'border-slate-300'} ${!isLocationValid ? disabledStyle : enabledStyle} ${inputBaseStyle}`}>
                  <option value="" disabled>{formData.selectedLocation ? "Seleziona disponibilità..." : "Prima seleziona una sede"}</option>
                  {currentSlots.map(s => {
                    return (
                      <option 
                        key={`${s.giorno}-${s.orario}`} 
                        value={`${s.giorno} ${s.orario}`}
                        disabled={s.esaurito}
                      >
                        {s.giorno} {s.orario} ({s.tipo}) - {s.esaurito ? 'ESAURITO' : `Posti: ${s.postiRimanenti}`}
                      </option>
                    );
                  })}
                </select>
                {errors.selectedSlot && <p className="mt-1 text-xs text-red-600">{errors.selectedSlot}</p>}
              </div>

              {firstAvailableDate && (
                <div className="mt-2 p-2 bg-blue-50 border border-blue-100 rounded-lg animate-in fade-in slide-in-from-top-2">
                  <p className="text-xs text-brand-blue text-center">
                    <span className="block text-[10px] text-blue-400 uppercase tracking-wider font-semibold mb-0.5">Prima Lezione Disponibile</span>
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
        <div className="w-full overflow-hidden px-1">
          <form onKeyDown={handleKeyDown} className="flex transition-transform duration-500 ease-in-out" style={{ transform: `translateX(-${currentCard * 100}%)` }}>
            {[0, 1, 2, 3, 4].map((index) => (
              <div key={index} className="w-full flex-shrink-0 px-1">
                <Card className="shadow-2xl border-0 rounded-3xl bg-white/95 backdrop-blur-sm pt-3 border-t-4 border-brand-red min-h-[200px] flex flex-col">
                  <CardContent className="px-4 pb-3 pt-1 flex-1 overflow-y-auto">
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
    </>
  );
};
