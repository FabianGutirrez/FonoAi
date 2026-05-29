
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  PlusCircle, 
  LogOut, 
  Sparkles,
  ChevronLeft
} from 'lucide-react';
import type { User } from '../types';

interface SidebarProps {
  user: User;
  onLogout: () => void;
  onClose?: () => void;
  isMobile?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ user, onLogout, onClose, isMobile }) => {
  const navigate = useNavigate();

  const handleLogoutClick = () => {
    onLogout();
    navigate('/');
  };

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/patients', label: 'Pacientes', icon: Users },
    { to: '/new-evaluation', label: 'Nueva Evaluación', icon: PlusCircle },
  ];

  const navLinkClasses = (isActive: boolean) => 
    `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
      isActive 
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' 
        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
    }`;

  return (
    <div className={`flex flex-col h-full bg-slate-900 border-r border-slate-800 ${isMobile ? 'w-full' : 'w-72'}`}>
      <div className="h-20 flex items-center justify-between px-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-xl font-bold text-white tracking-tight block leading-none">FonoAI</span>
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest leading-none">Precision Platform</span>
          </div>
        </div>
        {isMobile && (
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white">
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-4 py-8 space-y-2">
        {navItems.map((item) => (
          <NavLink 
            key={item.to}
            to={item.to} 
            onClick={onClose}
            className={({ isActive }) => navLinkClasses(isActive)}
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="p-4 bg-slate-800/10 rounded-2xl border border-slate-700/30 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center text-blue-400 font-bold border border-blue-600/20">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user.name}</p>
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mt-0.5">Especialista</p>
            </div>
          </div>
        </div>
        <button 
          onClick={handleLogoutClick}
          className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-red-500/10 hover:text-red-500 rounded-xl transition-all duration-200"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Cerrar Sesión</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
