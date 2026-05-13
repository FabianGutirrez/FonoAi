
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, Mail, Lock, AlertCircle, ArrowRight, User as UserIcon, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from 'firebase/auth';
import { auth } from '../services/firebase';
import { saveUserProfile } from '../services/firestoreService';
import type { User } from '../types';

interface RegisterPageProps {
  onLogin: (user: User) => void;
}

const RegisterPage: React.FC<RegisterPageProps> = ({ onLogin }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError('Por favor, completa todos los campos para el registro.');
      return;
    }
    
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      await updateProfile(firebaseUser, { displayName: name });
      await sendEmailVerification(firebaseUser);
      
      const user: User = { 
        uid: firebaseUser.uid,
        name, 
        email 
      };
      
      await saveUserProfile(user);
      onLogin(user);
      setSuccess('Cuenta creada con éxito. Por favor, verifica tu correo electrónico para habilitar todas las funciones.');
      setTimeout(() => navigate('/dashboard'), 3000);
    } catch (err: any) {
      console.error("Registration error:", err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('El registro con correo/contraseña no está habilitado en Firebase. Por favor, habilítelo en la consola de Firebase (Authentication > Sign-in method).');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Este correo ya está registrado.');
      } else {
        setError('Error al crear la cuenta. Inténtelo de nuevo más tarde.');
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
            <h2 className="text-3xl font-extrabold text-slate-900 mb-2 text-balance">Registro Clínico</h2>
            <p className="text-slate-500 font-medium">Únase a la red de especialistas en fonoaudiología.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 ml-1" htmlFor="name">
                Nombre Completo
              </label>
              <div className="relative group">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 transition-all font-medium text-slate-800 outline-none"
                  placeholder="Dra. ejemplo"
                />
              </div>
            </div>

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
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 transition-all font-medium text-slate-800 outline-none"
                  placeholder="especialista@fonoai.cl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 ml-1" htmlFor="password">
                Crear Contraseña
              </label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 transition-all font-medium text-slate-800 outline-none"
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

            {success && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-4 bg-green-50 text-green-700 rounded-xl border border-green-100 text-sm font-semibold"
              >
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                {success}
              </motion.div>
            )}

            <button
              disabled={isLoading}
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-4 rounded-2xl shadow-xl shadow-blue-500/20 hover:shadow-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed group mt-2"
            >
              {isLoading ? (
                <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  Crear Cuenta Clínica
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm font-semibold text-slate-500 mt-10">
            ¿Ya tiene una cuenta?{' '}
            <Link to="/login" className="text-blue-600 hover:text-blue-700 font-bold decoration-2 underline-offset-4 hover:underline">
              Iniciar Sesión
            </Link>
          </p>

          <Link to="/" className="mt-8 flex items-center justify-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest">
            <ArrowRight className="w-4 h-4 rotate-180" />
            Volver al inicio
          </Link>
        </div>
      </motion.div>

      <div className="hidden lg:block lg:flex-1 relative overflow-hidden bg-slate-50">
        <img 
          src="/assets/register.png" 
          alt="Especialista FonoAI"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/20 to-transparent"></div>
        <div className="absolute bottom-20 left-20 max-w-lg">
          <motion.h3 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-white text-4xl font-black leading-tight tracking-tighter uppercase"
          >
            Digitalizamos la <span className="text-blue-400">Excelencia</span> en el Diagnóstico Fonético
          </motion.h3>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
