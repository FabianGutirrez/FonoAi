
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, Mail, Lock, AlertCircle, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../services/firebase';
import type { User } from '../types';

interface LoginPageProps {
  onLogin: (user: User) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Por favor, completa todos los campos.');
      return;
    }
    
    setIsLoading(true);
    setError('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      const user: User = { 
        uid: firebaseUser.uid,
        name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Especialista', 
        email: firebaseUser.email || email 
      };
      
      onLogin(user);
      navigate('/dashboard');
    } catch (err: any) {
      console.error("Login error:", err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('El ingreso con correo/contraseña no está habilitado en Firebase. Por favor, habilítelo en la consola de Firebase (Authentication > Sign-in method).');
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Credenciales inválidas. Por favor, verifique su correo y contraseña.');
      } else {
        setError('Error al iniciar sesión. Inténtelo de nuevo más tarde.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans">
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-full lg:w-[40%] flex flex-col justify-center px-8 sm:px-12 lg:px-20 py-12 bg-white shadow-2xl z-10"
      >
        <div className="w-full max-w-sm mx-auto">
          <Link to="/" className="inline-flex items-center gap-2 mb-12 group">
            <div className="p-2 bg-blue-600 rounded-xl group-hover:scale-110 transition-transform">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-black text-slate-800 tracking-tighter">FonoAI <span className="text-blue-600">Precision</span></span>
          </Link>

          <div className="mb-10">
            <h2 className="text-3xl font-extrabold text-slate-900 mb-2 text-balance">Portal Clínico</h2>
            <p className="text-slate-500 font-medium">Acceda a su centro de evaluaciones especializadas.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 ml-1" htmlFor="email">
                Correo Institucional
              </label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 transition-all font-medium text-slate-800"
                  placeholder="ejemplo@clinica.cl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-sm font-bold text-slate-700" htmlFor="password">
                  Contraseña
                </label>
                <button type="button" className="text-xs font-bold text-blue-600 hover:text-blue-700">¿Olvidó su clave?</button>
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 transition-all font-medium text-slate-800"
                  placeholder="••••••••••••"
                />
              </div>
            </div>
            
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm font-semibold"
              >
                <AlertCircle className="w-5 h-5 shrink-0" />
                {error}
              </motion.div>
            )}

            <button
              disabled={isLoading}
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 px-4 rounded-2xl shadow-xl hover:shadow-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed group"
            >
              {isLoading ? (
                <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  Iniciar Sesión
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm font-semibold text-slate-500 mt-12">
            ¿No tiene una cuenta?{' '}
            <Link to="/register" className="text-blue-600 hover:text-blue-700 font-bold decoration-2 underline-offset-4 hover:underline">
              Regístrese aquí
            </Link>
          </p>

          <Link to="/" className="mt-8 flex items-center justify-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest">
            <ArrowRight className="w-4 h-4 rotate-180" />
            Volver al inicio
          </Link>
        </div>
      </motion.div>

      <div className="hidden lg:block lg:flex-1 relative overflow-hidden bg-slate-900 flex items-center justify-center">
        <button
          onClick={() => navigate('/')}
          className="lg:hidden absolute top-6 left-6 p-2 bg-white/10 backdrop-blur-md rounded-xl text-white hover:bg-white/20 transition-all z-20"
        >
          <ArrowRight className="w-5 h-5 rotate-180" />
        </button>

        <motion.img 
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.5 }}
          src="/assets/login.png" 
          alt="Portal Clínico"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/40 via-transparent to-blue-600/20"></div>
        
        {/* Floating Detail */}
        <motion.div
          animate={{ 
            y: [0, -20, 0],
            rotate: [0, 5, 0]
          }}
          transition={{ 
            duration: 6, 
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute top-1/4 right-1/4 w-32 h-32 opacity-20 filter blur-sm"
        >
          <Sparkles className="w-full h-full text-blue-600" />
        </motion.div>

        <div className="absolute bottom-20 left-20 right-20">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="p-8 backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl"
          >
            <p className="italic text-2xl text-white font-serif leading-relaxed mb-6 block">
              "La tecnología FonoAI ha transformado radicalmente la velocidad para la entrega de diagnósticos fonéticos detallados."
            </p>

          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
