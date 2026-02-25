import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react'; // Assicurati di importare MapPin
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { sendLeadToGestionale, getLocationsFromGestionale, PublicLocation } from '../../services/gestionaleService';

// ... (Interfacce FormErrors e Props rimangono uguali) ...
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

export const RegistrationForm: React.FC<RegistrationFormProps> = ({ onProgressUpdate, onSuccess }) => {
  // ... (Stati formData, privacy, loading, errors rimangono uguali) ...
  const [formData, setFormData] = useState({
    nome: '',
    cognome: '',
    email: '',
    telefono: '',
    childName: '',
    childAge: '',
    selectedLocation: '', // Qui salveremo l'ID della sede
    selectedSlot: ''
  });
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  // NUOVO STATO: Array di oggetti PublicLocation invece di Record
  const [availableLocations, setAvailableLocations] = useState<PublicLocation[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(true);

  const [currentCard, setCurrentCard] = useState(0);
  const totalCards = 5;
  const prevCountRef = useRef(0);

  // ... (Validation Logic Helpers rimangono uguali) ...
  const isNomeValid = formData.nome.trim().length > 1;
  const isCognomeValid = formData.cognome.trim().length > 1;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
  const isPhoneValid = formData.telefono.trim().length > 5;
  const isChildNameValid = formData.childName.trim().length > 1;
  const isChildAgeValid = formData.childAge.trim().length > 0;
  const isLocationValid = formData.selectedLocation !== '';
  const isSlotValid = formData.selectedSlot !== '';

  // Caricamento Sedi
  useEffect(() => {
    const fetchSlots = async () => {
      try {
        setIsLoadingSlots(true);
        const locations = await getLocationsFromGestionale();
        setAvailableLocations(locations);
      } catch (err) {
        console.error("Errore caricamento:", err);
        setGlobalError("Impossibile caricare le disponibilità.");
      } finally {
        setIsLoadingSlots(false);
      }
    };
    fetchSlots();
  }, []);

  // ... (useEffect per onProgressUpdate rimane uguale) ...
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
    setFormData(prev => ({ ...prev, [id]: value }));
    if (errors[id as keyof FormErrors]) setErrors(prev => ({ ...prev, [id]: undefined }));
  };

  // Funzione specifica per la selezione della sede (Card)
  const handleLocationSelect = (locationId: string) => {
    setFormData(prev => ({ 
      ...prev, 
      selectedLocation: locationId, 
      selectedSlot: '' // Resetta lo slot quando cambia la sede
    }));
    if (errors.selectedLocation) setErrors(prev => ({ ...prev, selectedLocation: undefined }));
  };

  // ... (Funzione validate() rimane uguale) ...
  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    let isValid = true;
    if (!isNomeValid) { newErrors.nome = "Il nome è obbligatorio"; isValid = false; }
    if (!isCognomeValid) { newErrors.cognome = "Il cognome è obbligatorio"; isValid = false; }
    if (!formData.email.trim()) { newErrors.email = "L'email è obbligatoria"; isValid = false; } 
    else if (!isEmailValid) { newErrors.email = "Email non valida"; isValid = false; }
    if (!formData.telefono.trim()) { newErrors.telefono = "Telefono obbligatorio"; isValid = false; }
    else if (!isPhoneValid) { newErrors.telefono = "Numero non valido"; isValid = false; }
    if (!isChildNameValid) { newErrors.childName = "Nome studente obbligatorio"; isValid = false; }
    if (!isChildAgeValid) { newErrors.childAge = "Età richiesta"; isValid = false; }
    if (!formData.selectedLocation) { newErrors.selectedLocation = "Seleziona una sede"; isValid = false; }
    if (!formData.selectedSlot) { newErrors.selectedSlot = "Seleziona un orario"; isValid = false; }
    if (!privacyAccepted) { newErrors.privacy = "Consenso obbligatorio"; isValid = false; }
    setErrors(newErrors);
    return isValid;
  };

  // ... (Funzione handleSubmit() rimane uguale) ...
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      // Trova il nome leggibile della sede per le note
      const selectedLocObj = availableLocations.find(l => l.id === formData.selectedLocation);
      const locName = selectedLocObj ? `${selectedLocObj.city} - ${selectedLocObj.name}` : formData.selectedLocation;

      const leadData = {
        nome: formData.nome,
        cognome: formData.cognome,
        email: formData.email,
        telefono: formData.telefono,
        childName: formData.childName, 
        childAge: formData.childAge,
        selectedLocation: locName, // Inviamo il nome leggibile al gestionale
        selectedSlot: formData.selectedSlot,
        notes: `Selected Slot: ${formData.selectedSlot}. Lead from Public Landing Page (Full Flow)`,
        status: "new",
        privacyConsent: true,
        source: "ep_public_web",
        userAgent: navigator.userAgent
      };
      const result = await sendLeadToGestionale(leadData);
      if (result.success) {
        if (onSuccess) onSuccess();
      } else {
        throw new Error("Errore durante l'invio al gestionale: " + result.error);
      }
    } catch (err) {
      console.error("Errore durante l'invio:", err);
      setGlobalError("Si è verificato un errore di connessione. Riprova più tardi.");
    } finally {
      setLoading(false);
    }
  };

  // Calcola gli slot correnti in base alla sede selezionata
  const currentLocationObj = availableLocations.find(l => l.id === formData.selectedLocation);
  const currentSlots = currentLocationObj ? currentLocationObj.slots : [];

  // ... (Style helpers e isCardValid rimangono uguali) ...
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

  const handleNextCard = () => { if (currentCard < totalCards - 1 && isCardValid(currentCard)) setCurrentCard(prev => prev + 1); };
  const handlePrevCard = () => { if (currentCard > 0) setCurrentCard(prev => prev - 1); };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (currentCard < totalCards - 1) handleNextCard();
      else if (isCardValid(currentCard)) handleSubmit(e as any);
    }
  };

  const renderCardContent = (index: number) => {
    switch (index) {
      case 0: // Dati Genitore (Invariato)
        return (
          <div className="space-y-1">
            <h3 className="text-xs font-bold text-brand-red uppercase tracking-wider border-b border-slate-100 pb-1 mb-2">Dati Genitore</h3>
            <div className="grid grid-cols-1 gap-2">
              <Input id="nome" label="Nome" placeholder="Mario" value={formData.nome} onChange={handleChange} error={errors.nome} required className={`${inputBaseStyle} ${enabledStyle}`} />
              <Input id="cognome" label="Cognome" placeholder="Rossi" value={formData.cognome} onChange={handleChange} error={errors.cognome} required disabled={!isNomeValid} className={`${inputBaseStyle} ${!isNomeValid ? disabledStyle : enabledStyle}`} />
            </div>
          </div>
        );
      case 1: // Contatti (Invariato)
        return (
          <div className="space-y-1">
            <h3 className="text-xs font-bold text-brand-red uppercase tracking-wider border-b border-slate-100 pb-1 mb-2">Contatti Genitore</h3>
            <div className="grid grid-cols-1 gap-2">
              <Input id="email" type="email" label="Email" placeholder="mario.rossi@email.com" value={formData.email} onChange={handleChange} error={errors.email} required disabled={!isCognomeValid} className={`${inputBaseStyle} ${!isCognomeValid ? disabledStyle : enabledStyle}`} />
              <Input id="telefono" type="tel" label="Telefono" placeholder="+39 333 1234567" value={formData.telefono} onChange={handleChange} error={errors.telefono} required disabled={!isEmailValid} className={`${inputBaseStyle} ${!isEmailValid ? disabledStyle : enabledStyle}`} />
            </div>
          </div>
        );
      case 2: // Figlio (Invariato)
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
      case 3: // Preferenze (MODIFICATO: Card per le Sedi)
        return (
          <div className="space-y-1">
            <h3 className="text-xs font-bold text-brand-red uppercase tracking-wider border-b border-slate-100 pb-1 mb-2">Preferenze</h3>
            <div className="grid grid-cols-1 gap-4">
              
              {/* Selezione Sede a Card */}
              <div>
                <label className={`block text-xs font-medium mb-2 ${!isChildAgeValid ? 'text-slate-400' : 'text-slate-700'}`}>Sede Preferita <span className={!isChildAgeValid ? 'text-slate-300' : 'text-red-500'}>*</span></label>
                
                {isLoadingSlots ? (
                  <div className="text-xs text-slate-500 italic">Caricamento sedi disponibili...</div>
                ) : (
                  <div className={`grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1 ${!isChildAgeValid ? 'opacity-50 pointer-events-none' : ''}`}>
                    {availableLocations.map(loc => (
                      <div 
                        key={loc.id}
                        onClick={() => handleLocationSelect(loc.id)}
                        className={`
                          relative p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 group
                          ${formData.selectedLocation === loc.id 
                            ? 'border-brand-blue bg-blue-50 shadow-sm' 
                            : 'border-slate-100 bg-white hover:border-brand-blue/30 hover:bg-slate-50'}
                        `}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className={`text-sm font-bold ${formData.selectedLocation === loc.id ? 'text-brand-blue' : 'text-slate-700'}`}>
                              {loc.city} - {loc.name}
                            </div>
                            <div className="flex items-center mt-1 text-xs text-slate-500">
                              <MapPin className="w-3 h-3 mr-1 flex-shrink-0 text-brand-red" />
                              <span className="truncate">{loc.address}</span>
                            </div>
                          </div>
                          {formData.selectedLocation === loc.id && (
                            <div className="h-4 w-4 rounded-full bg-brand-blue flex items-center justify-center">
                              <div className="h-1.5 w-1.5 rounded-full bg-white" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {errors.selectedLocation && <p className="mt-1 text-xs text-red-600">{errors.selectedLocation}</p>}
              </div>

              {/* Selezione Slot (Dropdown) */}
              <div>
                <label htmlFor="selectedSlot" className={`block text-xs font-medium mb-0.5 ${!isLocationValid ? 'text-slate-400' : 'text-slate-700'}`}>Giorno e Orario <span className={!isLocationValid ? 'text-slate-300' : 'text-red-500'}>*</span></label>
                <select id="selectedSlot" value={formData.selectedSlot} onChange={handleChange} disabled={!isLocationValid} className={`block w-full px-3 py-1.5 border rounded-xl shadow-sm focus:outline-none focus:ring-brand-blue focus:border-brand-blue sm:text-sm ${errors.selectedSlot ? 'border-red-300 ring-1 ring-red-300' : 'border-slate-300'} ${!isLocationValid ? disabledStyle : enabledStyle} ${inputBaseStyle}`}>
                  <option value="" disabled>{formData.selectedLocation ? "Seleziona disponibilità..." : "Prima seleziona una sede"}</option>
                  {currentSlots.map(slot => <option key={slot} value={slot}>{slot}</option>)}
                </select>
                {errors.selectedSlot && <p className="mt-1 text-xs text-red-600">{errors.selectedSlot}</p>}
              </div>
            </div>
          </div>
        );
      case 4: // Conferma (Invariato)
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
        <button type="button" onClick={handlePrevCard} disabled={currentCard === 0} className={`absolute left-0 z-10 p-1 sm:p-2 -ml-6 sm:-ml-12 text-brand-blue transition-all duration-300 ${currentCard === 0 ? 'opacity-0 pointer-events-none scale-90' : 'opacity-100 hover:scale-110'}`} aria-label="Indietro"><ChevronLeft className="w-10 h-10 sm:w-12 sm:h-12" strokeWidth={3} /></button>
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
        <button type="button" onClick={handleNextCard} disabled={currentCard === totalCards - 1 || !isCardValid(currentCard)} className={`absolute right-0 z-10 p-1 sm:p-2 -mr-6 sm:-mr-12 text-brand-blue transition-all duration-300 ${currentCard === totalCards - 1 ? 'opacity-0 pointer-events-none scale-90' : 'opacity-100 hover:scale-110'} ${!isCardValid(currentCard) ? 'opacity-30 cursor-not-allowed' : ''}`} aria-label="Avanti"><ChevronRight className="w-10 h-10 sm:w-12 sm:h-12" strokeWidth={3} /></button>
      </div>
      <div className="flex justify-center gap-2 -mt-6 pb-4">
        {[0, 1, 2, 3, 4].map((index) => (<div key={index} className={`h-2 rounded-full transition-all duration-300 ${currentCard === index ? 'w-6 bg-brand-blue' : 'w-2 bg-slate-300'}`} />))}
      </div>
      <Modal isOpen={showPrivacyModal} onClose={() => setShowPrivacyModal(false)} title="Informativa sulla Privacy">
        <div className="space-y-4 text-slate-600 font-serif text-sm leading-relaxed">
          <p>Ai sensi del Regolamento (UE) 2016/679 (GDPR), ti informiamo che i tuoi dati personali saranno trattati da EasyPeasy Labs per le finalità strettamente connesse alla gestione della tua iscrizione all'evento.</p>
          <h4 className="font-bold text-brand-blue font-serif text-base">1. Finalità del trattamento</h4>
          <p>I dati raccolti (nome, cognome, email, telefono, dati studente) saranno utilizzati esclusivamente per l'organizzazione dell'evento, l'invio di comunicazioni logistiche e la gestione degli accessi.</p>
          <h4 className="font-bold text-brand-blue font-serif text-base">2. Conservazione dei dati</h4>
          <p>I tuoi dati saranno conservati per il tempo strettamente necessario all'espletamento delle finalità sopra indicate e successivamente cancellati, salvo obblighi di legge.</p>
          <h4 className="font-bold text-brand-blue font-serif text-base">3. I tuoi diritti</h4>
          <p>Hai il diritto di chiedere al titolare del trattamento l'accesso ai tuoi dati personali, la rettifica, la cancellazione degli stessi o la limitazione del trattamento.</p>
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 mt-4"><p className="italic text-xs text-brand-blue">Cliccando su "Ho capito" confermi di aver letto e compreso l'informativa.</p></div>
        </div>
      </Modal>
    </>
  );
};