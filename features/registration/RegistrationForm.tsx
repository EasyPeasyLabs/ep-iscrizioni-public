import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { db, serverTimestamp } from '../../lib/firebase';

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

// Mock Data for Slots
const AVAILABLE_SLOTS: Record<string, string[]> = {
  "Bari - Poggiofranco": [
    "Lunedì 16:30 - 18:00",
    "Martedì 17:00 - 18:30", 
    "Giovedì 15:00 - 16:30"
  ],
  "Bari - Murat": [
    "Lunedì 15:00 - 16:30",
    "Mercoledì 18:00 - 19:30",
    "Venerdì 17:00 - 18:30"
  ],
  "Trani": [
    "Martedì 16:00 - 17:30",
    "Giovedì 18:00 - 19:30"
  ],
  "Online": [
    "Lunedì 18:00 - 19:30",
    "Mercoledì 15:00 - 16:30",
    "Sabato 10:00 - 11:30"
  ]
};

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

  // FIX: Track previous count to avoid unnecessary parent re-renders causing cursor jumps
  const prevCountRef = useRef(0);

  // Validation Logic Helpers (Used for Sequential Locking)
  const isNomeValid = formData.nome.trim().length > 1;
  const isCognomeValid = formData.cognome.trim().length > 1;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
  const isPhoneValid = formData.telefono.trim().length > 5;
  const isChildNameValid = formData.childName.trim().length > 1;
  const isChildAgeValid = formData.childAge.trim().length > 0;
  const isLocationValid = formData.selectedLocation !== '';
  const isSlotValid = formData.selectedSlot !== '';

  // Calculate completed fields and notify parent (Gamification)
  useEffect(() => {
    let count = 0;
    // Check sequentially matches the animation logic strictly
    if (isNomeValid) count++;
    if (isCognomeValid) count++;
    if (isEmailValid) count++;
    if (isPhoneValid) count++;
    if (isChildNameValid) count++;
    if (isChildAgeValid) count++;
    if (isLocationValid && isSlotValid) count++; // Combined step
    if (privacyAccepted) count++;
    
    // Only update parent if count HAS CHANGED. 
    // This prevents the parent from re-rendering on every keystroke, fixing the cursor jump.
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
      // ARCHITECTURE COMPLIANCE: Map to 'new_leads' schema structure but save to allowed collection
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

      // Write to 'raw_registrations' to avoid permission errors in 'new_leads'
      await db.collection("raw_registrations").add(leadData);

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

  const currentSlots = formData.selectedLocation ? AVAILABLE_SLOTS[formData.selectedLocation] || [] : [];

  // Style helpers
  const inputBaseStyle = "rounded-xl font-sans transition-all duration-300";
  const disabledStyle = "opacity-50 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200";
  const enabledStyle = "bg-slate-50 focus:bg-white focus:ring-brand-blue focus:border-brand-blue";

  return (
    <>
      <div className="w-full max-w-md mx-auto pb-10">
          <Card className="shadow-2xl border-0 rounded-3xl bg-white/95 backdrop-blur-sm pt-6 border-t-4 border-brand-red">
            <CardContent className="px-6 pb-8 pt-2">
              {/* Header removed as requested */}

              <form onSubmit={handleSubmit} className="space-y-5">
                
                {/* Sezione Genitore */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-brand-red uppercase tracking-wider border-b border-slate-100 pb-1">Dati Genitore</h3>
                  <div className="grid grid-cols-1 gap-3">
                    {/* 1. Nome - Always Enabled */}
                    <Input 
                      id="nome" 
                      label="Nome" 
                      placeholder="Mario" 
                      value={formData.nome}
                      onChange={handleChange}
                      error={errors.nome}
                      required
                      className={`${inputBaseStyle} ${enabledStyle}`}
                    />

                    {/* 2. Cognome - Requires Name */}
                    <Input 
                      id="cognome" 
                      label="Cognome" 
                      placeholder="Rossi" 
                      value={formData.cognome}
                      onChange={handleChange}
                      error={errors.cognome}
                      required
                      disabled={!isNomeValid}
                      className={`${inputBaseStyle} ${!isNomeValid ? disabledStyle : enabledStyle}`}
                    />

                    {/* 3. Email - Requires Cognome */}
                    <Input 
                      id="email" 
                      type="email" 
                      label="Email" 
                      placeholder="mario.rossi@email.com" 
                      value={formData.email}
                      onChange={handleChange}
                      error={errors.email}
                      required
                      disabled={!isCognomeValid}
                      className={`${inputBaseStyle} ${!isCognomeValid ? disabledStyle : enabledStyle}`}
                    />

                    {/* 4. Telefono - Requires Email */}
                    <Input 
                      id="telefono" 
                      type="tel" 
                      label="Telefono" 
                      placeholder="+39 333 1234567" 
                      value={formData.telefono}
                      onChange={handleChange}
                      error={errors.telefono}
                      required
                      disabled={!isEmailValid}
                      className={`${inputBaseStyle} ${!isEmailValid ? disabledStyle : enabledStyle}`}
                    />
                  </div>
                </div>

                {/* Sezione Studente */}
                <div className="space-y-3 pt-2">
                  <h3 className="text-sm font-bold text-brand-red uppercase tracking-wider border-b border-slate-100 pb-1">Figlio/a</h3>
                  <div className="grid grid-cols-1 gap-3">
                     {/* 5. Nome Figlio - Requires Telefono */}
                     <Input 
                      id="childName" 
                      label="Nome" 
                      placeholder="Luca" 
                      value={formData.childName}
                      onChange={handleChange}
                      error={errors.childName}
                      required
                      disabled={!isPhoneValid}
                      className={`${inputBaseStyle} ${!isPhoneValid ? disabledStyle : enabledStyle}`}
                    />
                    
                    {/* 6. Età - Requires Child Name */}
                    <div className="mb-4">
                      <label htmlFor="childAge" className={`block text-sm font-medium mb-1 ${!isChildNameValid ? 'text-slate-400' : 'text-slate-700'}`}>
                        Età <span className={!isChildNameValid ? 'text-slate-300' : 'text-red-500'}>*</span>
                      </label>
                      <input
                        id="childAge"
                        type="number"
                        min="1"
                        max="100"
                        placeholder="es. 8"
                        value={formData.childAge}
                        onChange={handleChange}
                        disabled={!isChildNameValid}
                        className={`appearance-none block w-full px-3 py-2 border rounded-xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-brand-blue focus:border-brand-blue sm:text-sm ${
                          errors.childAge ? 'border-red-300 ring-1 ring-red-300' : 'border-slate-300'
                        } ${!isChildNameValid ? disabledStyle : enabledStyle} ${inputBaseStyle}`}
                      />
                      {errors.childAge && <p className="mt-1 text-sm text-red-600">{errors.childAge}</p>}
                    </div>
                  </div>
                </div>

                 {/* Sezione Preferenze */}
                 <div className="space-y-3 pt-2">
                  <h3 className="text-sm font-bold text-brand-red uppercase tracking-wider border-b border-slate-100 pb-1">Preferenze</h3>
                  
                  {/* 7. Location - Requires Child Age */}
                  <div className="mb-4">
                    <label htmlFor="selectedLocation" className={`block text-sm font-medium mb-1 ${!isChildAgeValid ? 'text-slate-400' : 'text-slate-700'}`}>
                      Sede Preferita <span className={!isChildAgeValid ? 'text-slate-300' : 'text-red-500'}>*</span>
                    </label>
                    <select
                      id="selectedLocation"
                      value={formData.selectedLocation}
                      onChange={handleChange}
                      disabled={!isChildAgeValid}
                      className={`block w-full px-3 py-2 border rounded-xl shadow-sm focus:outline-none focus:ring-brand-blue focus:border-brand-blue sm:text-sm ${
                         errors.selectedLocation ? 'border-red-300 ring-1 ring-red-300' : 'border-slate-300'
                      } ${!isChildAgeValid ? disabledStyle : enabledStyle} ${inputBaseStyle}`}
                    >
                      <option value="" disabled>Seleziona una sede...</option>
                      {Object.keys(AVAILABLE_SLOTS).map(loc => (
                        <option key={loc} value={loc}>{loc}</option>
                      ))}
                    </select>
                    {errors.selectedLocation && <p className="mt-1 text-sm text-red-600">{errors.selectedLocation}</p>}
                  </div>

                  {/* 8. Slot Select - Requires Location */}
                  <div className="mb-4">
                    <label htmlFor="selectedSlot" className={`block text-sm font-medium mb-1 ${!isLocationValid ? 'text-slate-400' : 'text-slate-700'}`}>
                      Giorno e Orario <span className={!isLocationValid ? 'text-slate-300' : 'text-red-500'}>*</span>
                    </label>
                    <select
                      id="selectedSlot"
                      value={formData.selectedSlot}
                      onChange={handleChange}
                      disabled={!isLocationValid}
                      className={`block w-full px-3 py-2 border rounded-xl shadow-sm focus:outline-none focus:ring-brand-blue focus:border-brand-blue sm:text-sm ${
                         errors.selectedSlot ? 'border-red-300 ring-1 ring-red-300' : 'border-slate-300'
                      } ${!isLocationValid ? disabledStyle : enabledStyle} ${inputBaseStyle}`}
                    >
                      <option value="" disabled>
                        {formData.selectedLocation ? "Seleziona disponibilità..." : "Prima seleziona una sede"}
                      </option>
                      {currentSlots.map(slot => (
                        <option key={slot} value={slot}>{slot}</option>
                      ))}
                    </select>
                    {errors.selectedSlot && <p className="mt-1 text-sm text-red-600">{errors.selectedSlot}</p>}
                  </div>
                </div>

                {/* Privacy Checkbox Area - Requires Slot */}
                <div className={`mt-5 pt-3 border-t border-slate-100 transition-opacity duration-300 ${!isSlotValid ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex items-center h-6">
                      <input
                        id="privacy"
                        name="privacy"
                        type="checkbox"
                        checked={privacyAccepted}
                        disabled={!isSlotValid}
                        onChange={(e) => {
                          setPrivacyAccepted(e.target.checked);
                          if (e.target.checked && errors.privacy) {
                            setErrors(prev => ({ ...prev, privacy: undefined }));
                          }
                        }}
                        className={`h-5 w-5 rounded border-gray-300 text-brand-blue focus:ring-brand-blue transition duration-150 ease-in-out cursor-pointer ${
                          errors.privacy ? 'border-red-300 ring-1 ring-red-300' : ''
                        }`}
                      />
                    </div>
                    <div className="text-sm">
                      <label htmlFor="privacy" className="font-medium text-slate-700 cursor-pointer font-sans">
                        Consenso Privacy <span className="text-brand-red">*</span>
                      </label>
                      <p className="text-slate-500 text-xs mt-1 leading-relaxed font-sans">
                        Accetto il trattamento dei miei dati personali secondo la 
                        <button 
                          type="button"
                          onClick={() => setShowPrivacyModal(true)}
                          className="ml-1 text-brand-blue hover:text-brand-red font-bold underline focus:outline-none transition-colors"
                        >
                          Privacy Policy
                        </button> 
                        ai fini della gestione dell'evento.
                      </p>
                    </div>
                  </div>
                  {errors.privacy && (
                    <p className="mt-2 text-sm text-brand-red pl-8 font-medium font-sans">{errors.privacy}</p>
                  )}
                </div>
                
                {globalError && (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-100 animate-pulse">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-brand-red font-serif">Errore</h3>
                        <div className="mt-1 text-sm text-red-700 font-sans">
                          <p>{globalError}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Submit Button - Requires Privacy */}
                <div className={`mt-6 transition-all duration-300 ${!privacyAccepted ? 'opacity-50 pointer-events-none grayscale' : 'opacity-100'}`}>
                  <Button 
                    type="submit" 
                    className="w-full py-4 text-3xl font-bold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 font-sans tracking-wide rounded-xl bg-gradient-to-r from-brand-blue to-[#003399] text-white" 
                    isLoading={loading}
                    disabled={!privacyAccepted}
                  >
                    INVIA
                  </Button>
                  <p className="text-center text-xs text-slate-400 mt-4 flex items-center justify-center font-sans">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"></path></svg>
                    I dati verranno salvati in modo sicuro su Firebase.
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>
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
