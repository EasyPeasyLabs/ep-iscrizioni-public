
import React, { useState } from 'react';
import { RegistrationForm } from './features/registration/RegistrationForm';
import { MechaLemon } from './components/ui/MechaLemon';

function App() {
  const [completionCount, setCompletionCount] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formResetKey, setFormResetKey] = useState(0);

  const handleSuccess = () => {
    setIsSuccess(true);
    setCompletionCount(9); // Trigger "Grand Finale" animation (hat removal) - 8 fields + 1

    // Auto-reset after 10 seconds
    setTimeout(() => {
      setIsSuccess(false);
      setCompletionCount(0); // Reset mascot
      setFormResetKey(prev => prev + 1); // Force remount of form to clear data
    }, 10000);
  };

  return (
    <div className="h-[100svh] flex flex-col bg-slate-50 text-slate-800 font-sans selection:bg-brand-yellow selection:text-brand-blue overflow-hidden">
      
      {/* Header + Left Column Container - Sticky on Mobile */}
      <div className="md:static sticky top-0 z-50">
        {/* Header - Fixed */}
        <header className="bg-white/90 backdrop-blur-md border-b-4 border-brand-blue shadow-sm flex-none">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-20 items-center">
              <div className="flex items-center gap-3 group cursor-default">
                {/* Small logo icon */}
                 <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center shadow-sm group-hover:rotate-12 transition-transform duration-300 border-2 border-brand-red ring-2 ring-brand-blue">
                  <span className="text-brand-blue font-heading font-bold text-xl">E</span>
                  <span className="text-brand-red font-heading font-bold text-xl">P</span>
                 </div>
                 <div className="flex flex-col">
                  <span className="text-2xl font-heading font-bold tracking-tight text-brand-blue leading-none">
                    EasyPeasy
                  </span>
                  <span className="text-xs font-bold tracking-widest uppercase text-brand-red font-sans">Public Portal</span>
                 </div>
              </div>
              <div className="hidden md:block text-sm text-slate-400 font-medium font-sans">
                  Benvenuto
              </div>
            </div>
          </div>
        </header>

        {/* Left Column - Static Info & Mascot - Gray Background */}
        <div className="flex-none w-full md:w-1/2 md:h-full flex flex-col items-center justify-center px-6 py-4 relative z-10 overflow-hidden border-b md:border-b-0 md:border-r border-slate-200 bg-slate-100">
            <div className="text-center max-w-lg mx-auto w-full flex flex-col items-center justify-center">
              <div className="flex-none">
                <h1 className="text-2xl md:text-3xl font-heading font-bold text-brand-blue mb-2 leading-tight tracking-tight">
                  Siamo lieti che tu <br/>
                  <span className="text-brand-blue inline-block transform hover:scale-105 transition-transform duration-300">voglia conoscerci</span>
                </h1>
                <div className="w-16 md:w-24 h-1.5 bg-brand-yellow mx-auto rounded-full mb-2 md:mb-3"></div>
                
                <p className="text-base md:text-lg text-slate-600 font-sans font-light mb-0">
                  Registrati, è facile facile:
                </p>
                <span className="text-2xl md:text-3xl text-brand-red font-hand rotate-[-2deg] inline-block drop-shadow-sm cursor-default mb-2">
                  "easy peasy"
                </span>
              </div>
              
              {/* MechaLemon Mascot - Always Centered & Visible */}
              <div className="flex-none flex items-center justify-center w-full">
                  <div className="w-32 h-32 md:w-40 md:h-40 transition-all duration-700 ease-in-out">
                      {/* Update totalSteps to 8 to match the full form fields */}
                      <MechaLemon className="w-full h-full" completionStep={completionCount} totalSteps={8} />
                  </div>
              </div>
            </div>
        </div>
      </div>

      {/* Main Content - Right Column on Desktop, Below on Mobile */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* Background Decoration (Global layer behind split columns) */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none bg-gradient-to-b from-slate-50 to-slate-100">
            <div className="absolute -top-[10%] -left-[5%] w-[40%] h-[40%] rounded-full bg-brand-blue/5 blur-3xl opacity-70"></div>
            <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] rounded-full bg-brand-yellow/10 blur-3xl opacity-70"></div>
        </div>

        {/* Right Column - Scrollable Form Area - White/Transparent Background */}
        <div className="flex-1 w-full md:w-1/2 h-full overflow-y-auto bg-white/60 backdrop-blur-sm shadow-inner relative">
           <div className="min-h-full p-6 flex flex-col justify-center items-center">
              
              {/* Conditional Rendering: Form vs Success Popup */}
              {isSuccess ? (
                <div className="w-full max-w-md animate-fade-in-up mt-4">
                  <div className="bg-white rounded-3xl shadow-2xl border-t-4 border-green-500 p-8 text-center relative overflow-hidden">
                     {/* Success Content */}
                     <div className="absolute top-0 left-0 w-full h-2 bg-green-100">
                        <div className="h-full bg-green-500 animate-shrink-width origin-left"></div>
                     </div>
                     
                     <div className="mb-6 inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full text-green-600 mb-4 mx-auto">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                     </div>

                     <h2 className="text-3xl font-heading font-bold text-brand-blue mb-4">Evviva!</h2>
                     
                     <div className="space-y-0">
                       <p className="text-lg text-slate-700 font-sans font-medium mb-6">
                         L'invio è andato a buon fine.
                       </p>
                       
                       <p className="text-lg text-slate-600 font-sans mb-8">
                         Hai visto? È stato facile facile ... <span className="font-hand text-brand-red text-xl">easy peasy!</span>
                       </p>

                       <p className="text-lg text-slate-600 font-sans font-semibold">
                         Presto sarai ricontattat* dal nostro Staff.
                       </p>
                     </div>
                     
                     <p className="text-xs text-slate-400 italic mt-10">
                       il modulo si resetterà automaticamente tra pochi secondi...
                     </p>
                  </div>
                </div>
              ) : (
                <RegistrationForm 
                  key={formResetKey} // Key change forces re-mount/reset
                  onProgressUpdate={setCompletionCount} 
                  onSuccess={handleSuccess}
                />
              )}
              
              <footer className="mt-12 text-center opacity-60 text-xs font-sans pb-8 md:pb-0">
                <p>&copy; {new Date().getFullYear()} EasyPeasy Labs. All rights reserved.</p>
                <div className="flex justify-center gap-4 mt-2">
                    <a href="#" className="hover:text-brand-blue">Termini</a>
                    <a href="#" className="hover:text-brand-blue">Privacy</a>
                </div>
              </footer>
           </div>
        </div>

      </div>
      <style>{`
        @keyframes shrink-width {
          from { width: 100%; }
          to { width: 0%; }
        }
        .animate-shrink-width {
          animation: shrink-width 10s linear forwards;
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.5s ease-out forwards;
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default App;
