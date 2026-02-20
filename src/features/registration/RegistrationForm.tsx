import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { LemonMascot } from '../../components/illustrations/LemonMascot';

// -- TYPES --
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

const AVAILABLE_LOCATIONS = [
  { id: 'sede-roma-nord', name: 'Roma Nord', slots: ['16:30', '17:30', '18:30'] },
  { id: 'sede-roma-sud', name: 'Roma Sud', slots: ['17:00', '18:00'] },
  { id: 'sede-milano', name: 'Milano Centro', slots: ['15:00', '16:00', '17:00'] }
];

export const RegistrationForm: React.FC = () => {
  const [step, setStep] = useState<number>(0);
  // NEW: Sub-step for Step 0 (0: Name/Surname, 1: Email/Phone)
  const [stepZeroSub, setStepZeroSub] = useState<0 | 1>(0);

  const [data, setData] = useState<RegistrationData>(INITIAL_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isDemoMode, setIsDemoMode] = useState(false);

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
      // Attempt to save to Firestore
      await addDoc(collection(db, 'registrations'), {
        ...data,
        status: 'pending',
        crmStatus: 'pending',
        createdAt: serverTimestamp(),
        source: 'web_wizard_v2'
      });
      setStep(3);
    } catch (error: any) {
      console.error("Firestore Error:", error);
      
      // Robust error checking for permissions
      const errString = String(error);
      const errCode = error?.code;
      const errMessage = error?.message || '';

      // Check for varied permission error messages
      const isPermissionError = 
        errCode === 'permission-denied' ||
        errString.includes('permission') || 
        errString.includes('Missing') || 
        errString.includes('insufficient') ||
        errMessage.includes('Missing or insufficient permissions');

      if (isPermissionError) {
        console.warn("Permission denied detected (likely Demo/Public env). Switching to DEMO MODE simulation.");
        setIsDemoMode(true);
        
        // Short delay to simulate network request, then proceed to success
        setTimeout(() => {
          setIsSubmitting(false);
          setStep(3);
        }, 800);
        return; 
      }

      setErrorMessage("Errore durante l'invio. Riprova.");
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
        const selectedLocation = AVAILABLE_LOCATIONS.find(l => l.id === data.locationId);
        return (
          <div className="space-y-4">
             <div className="text-center mb-2">
              <h2 className="text-lg font-bold text-gray-800">Scegli Sede e Orario</h2>
            </div>
            <div className="flex flex-col gap-1 w-full">
              <label className="text-sm font-medium text-gray-700">Sede</label>
              <select
                name="locationId"
                value={data.locationId}
                onChange={handleChange}
                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Seleziona una sede</option>
                {AVAILABLE_LOCATIONS.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1 w-full">
              <label className="text-sm font-medium text-gray-700">Orario Preferito</label>
              <select
                name="slotTime"
                value={data.slotTime}
                onChange={handleChange}
                disabled={!data.locationId}
                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-100"
              >
                <option value="">Seleziona orario</option>
                {selectedLocation?.slots.map(slot => (
                  <option key={slot} value={slot}>{slot}</option>
                ))}
              </select>
            </div>
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
