
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { Menu, ChevronLeft, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { User } from '../types';

interface DashboardLayoutProps {
  user: User;
  onLogout: () => void;
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ user, onLogout, children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 'Resumen Clínico';
    if (path === '/patients') return 'Gestión de Pacientes';
    if (path === '/new-evaluation') return 'Nueva Evaluación';
    return 'FonoAI';
  };

  const notifications = [
    { id: 1, title: 'Evaluación Completada', time: 'hace 5 min', description: 'El análisis del paciente Juan Pérez está listo.' },
    { id: 2, title: 'Actualización de Sistema', time: 'hace 2h', description: 'Se ha mejorado la precisión en detección de fonemas sibilantes.' },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <div className="hidden lg:block h-full">
        <Sidebar user={user} onLogout={onLogout} />
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-80 z-50 lg:hidden shadow-2xl"
            >
              <Sidebar 
                user={user} 
                onLogout={onLogout} 
                onClose={() => setIsMobileMenuOpen(false)} 
                isMobile 
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0 h-full">
        <header className="h-16 lg:h-20 bg-white border-b border-slate-200 px-4 lg:px-8 flex items-center justify-between sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
            >
              <Menu className="w-6 h-6" />
            </button>
            
            {location.pathname !== '/dashboard' && (
              <button 
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors"
                aria-label="Volver"
              >
                <div className="p-1.5 bg-slate-50 md:bg-transparent hover:bg-blue-50 rounded-lg">
                  <ChevronLeft className="w-5 h-5" />
                </div>
              </button>
            )}
            
            <h2 className="text-lg lg:text-xl font-bold text-slate-800 tracking-tight truncate">
              {getPageTitle()}
            </h2>
          </div>

          <div className="flex items-center gap-2 lg:gap-4 relative">
            <button 
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className="p-2 text-slate-400 hover:text-blue-600 transition-colors relative"
            >
              <Bell className="w-6 h-6" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-blue-600 rounded-full border-2 border-white"></span>
            </button>

            <AnimatePresence>
              {isNotificationsOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsNotificationsOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden"
                  >
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="font-bold text-slate-800">Notificaciones</h3>
                      <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full uppercase">2 Nuevas</span>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.map((notif) => (
                        <div key={notif.id} className="p-4 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                          <div className="flex justify-between items-start mb-1">
                            <h4 className="text-sm font-bold text-slate-800">{notif.title}</h4>
                            <span className="text-[10px] text-slate-400 font-medium">{notif.time}</span>
                          </div>
                          <p className="text-xs text-slate-500 leading-relaxed">{notif.description}</p>
                        </div>
                      ))}
                    </div>
                    <button className="w-full py-3 text-xs font-bold text-blue-600 hover:bg-blue-50 border-t border-slate-100 transition-colors">
                      Ver todas las alertas
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            <div className="h-8 w-px bg-slate-200 hidden sm:block mx-1"></div>
            <div className="hidden sm:flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-700 capitalize leading-none">{user.name}</p>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mt-1">Especialista</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-600/20 flex items-center justify-center font-bold text-blue-600">
                {user.name.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-7xl mx-auto pb-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};


export default DashboardLayout;
