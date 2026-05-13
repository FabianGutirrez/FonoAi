
import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Sparkles,
  FileText, 
  ShieldCheck, 
  ArrowRight, 
  PlayCircle,
  Stethoscope,
  Microscope
} from 'lucide-react';
import { motion } from 'motion/react';
import type { User } from '../types';

const FeatureCard: React.FC<{ icon: React.ReactNode; title: string; description: string }> = ({ icon, title, description }) => (
  <motion.div 
    whileHover={{ y: -5 }}
    className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-axolotl-pink/20 transition-all duration-300 group"
  >
    <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-axolotl-soft text-axolotl-pink mb-6 group-hover:bg-axolotl-pink group-hover:text-white transition-colors">
      {icon}
    </div>
    <h3 className="text-xl font-bold text-slate-800 mb-3">{title}</h3>
    <p className="text-slate-600 text-sm leading-relaxed">{description}</p>
  </motion.div>
);

interface LandingPageProps {
  user: User | null;
}

const LandingPage: React.FC<LandingPageProps> = ({ user }) => {
  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      <header className="fixed inset-x-0 top-0 z-50 bg-white/70 backdrop-blur-lg border-b border-slate-200/50">
        <nav className="flex items-center justify-between p-4 lg:px-8 max-w-7xl mx-auto" aria-label="Global">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-axolotl-pink rounded-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">FonoAI <span className="text-blue-600 font-black">Precision</span></span>
          </div>
          <div className="flex items-center gap-4 lg:gap-8">
            {!user ? (
              <>
                <Link to="/login" className="text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors hidden sm:block">
                  Acceso Especialista
                </Link>
                <Link 
                  to="/login" 
                  className="rounded-xl bg-axolotl-pink px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-axolotl-pink/25 hover:bg-axolotl-pink/90 hover:scale-105 transition-all text-center"
                >
                  Comenzar Ahora
                </Link>
              </>
            ) : (
              <Link 
                to="/dashboard" 
                className="rounded-xl bg-axolotl-pink px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-axolotl-pink/25 hover:bg-axolotl-pink/90 hover:scale-105 transition-all text-center"
              >
                Panel de Control
              </Link>
            )}
          </div>
        </nav>
      </header>

      <main>
        <div className="relative isolate pt-24 lg:pt-32">
          <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
            <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-blue-200 to-teal-100 opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"></div>
          </div>

          <div className="mx-auto max-w-7xl px-6 lg:px-8 py-16 lg:py-32">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
              >
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold uppercase tracking-wider mb-6">
                  <Sparkles className="w-3.5 h-3.5" />
                  Plataforma Especializada para Fonoaudiólogos
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.1] mb-6">
                  Análisis del Habla <span className="text-blue-600">Especializado.</span>
                </h1>
                <p className="text-lg sm:text-xl leading-relaxed text-slate-600 mb-10 max-w-lg">
                  Potencie su consulta fonoaudiológica con transcripciones de alta fidelidad y diagnósticos asistidos por IA de última generación.
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <Link 
                    to={user ? "/dashboard" : "/login"} 
                    className="w-full sm:w-auto rounded-2xl bg-axolotl-pink px-8 py-4 text-lg font-bold text-white shadow-xl shadow-axolotl-pink/20 hover:bg-axolotl-pink/90 transition-all flex items-center justify-center gap-2"
                  >
                    {user ? "Ir al Dashboard" : "Prueba Gratuita"} <ArrowRight className="w-5 h-5" />
                  </Link>
                  <button className="w-full sm:w-auto px-8 py-4 text-lg font-bold text-slate-600 hover:text-blue-600 flex items-center justify-center gap-2 transition-colors">
                    <PlayCircle className="w-6 h-6" /> Ver Demo
                  </button>
                </div>
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8 }}
                className="relative hidden sm:block"
              >
                <div className="absolute -inset-4 bg-axolotl-pink/10 rounded-[2rem] blur-2xl -z-10"></div>
                <img 
                  src="/assets/hero.png" 
                  alt="Professional Axolotl Mascot" 
                  className="rounded-[2rem] shadow-2xl w-full h-[500px] object-cover border-8 border-white ring-1 ring-slate-200" 
                />
              </motion.div>
            </div>
          </div>
        </div>

        <section className="bg-white py-24 lg:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-20">
              <h2 className="text-base font-bold text-blue-600 uppercase tracking-widest mb-3">Capacidades</h2>
              <p className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Diseñado para la Excelencia Clínica</p>
            </div>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              <FeatureCard 
                icon={<FileText className="w-7 h-7" />} 
                title="Transcripción Fonética" 
                description="Captura matices fonéticos complejos y errores específicos que las herramientas convencionales pasan por alto."
              />
              <FeatureCard 
                icon={<Microscope className="w-7 h-7" />} 
                title="Análisis Morfológico" 
                description="Detección automática de patrones de habla, dislalias y trastornos del lenguaje con terminología CID-11."
              />
              <FeatureCard 
                icon={<ShieldCheck className="w-7 h-7" />}
                title="Privacidad de Grado Médico"
                description="Sus datos están encriptados y protegidos bajo estándares internacionales de seguridad en salud."
              />
            </div>
          </div>
        </section>

        <section className="bg-slate-900 overflow-hidden relative">
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-96 h-96 bg-blue-500/20 blur-[128px] rounded-full"></div>
          <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8 lg:flex lg:items-center lg:justify-between text-center lg:text-left">
            <div className="mb-10 lg:mb-0">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-6">
                Optimice su Tiempo Clínico.<br />
                <span className="text-blue-400">Enfóquese en la Terapia.</span>
              </h2>
              <p className="text-lg text-slate-400 max-w-xl mx-auto lg:mx-0">
                Reduzca hasta un 70% el tiempo de documentación evaluativa y genere informes listos para revisión en minutos.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-6 justify-center">
              <Link 
                to="/login" 
                className="w-full sm:w-auto rounded-2xl bg-blue-600 px-8 py-4 text-lg font-bold text-white shadow-xl shadow-blue-500/20 hover:bg-blue-500 transition-all text-center"
              >
                Comenzar Evaluación
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-white border-t border-slate-100 italic">
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              <span className="font-bold text-slate-900 uppercase tracking-widest text-sm">FonoAI <span className="text-blue-600">Precision</span></span>
            </div>
            <p className="text-sm text-slate-400 text-center">&copy; 2026 FonoAI Clinical Systems. Precisión y Ética en Fonoaudiología.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
