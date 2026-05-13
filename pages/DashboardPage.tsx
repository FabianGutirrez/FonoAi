
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  FileText, 
  CheckCircle2, 
  Clock, 
  Plus, 
  TrendingUp, 
  MoreVertical,
  Activity,
  User as UserIcon,
  Trash2,
  Edit2,
  AlertCircle
} from 'lucide-react';
import { motion } from 'motion/react';
import { auth } from '../services/firebase';
import { Evaluation, EvaluationStatus, Patient, User } from '../types';
import { getEvaluations, getPatients, deleteEvaluation } from '../services/firestoreService';
import { generateClinicalPDF } from '../lib/pdfGenerator';

interface DashboardPageProps {
  user: User;
}

const StatCard: React.FC<{ icon: React.ReactNode; title: string; value: string | number; trend?: string }> = ({ icon, title, value, trend }) => (
  <motion.div 
    whileHover={{ y: -4 }}
    className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300"
  >
    <div className="flex items-start justify-between mb-4">
      <div className="bg-blue-50 text-blue-600 rounded-2xl p-3">
        {icon}
      </div>
      {trend && (
        <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">
          <TrendingUp className="w-3 h-3" />
          {trend}
        </span>
      )}
    </div>
    <div>
      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">{title}</p>
      <p className="text-4xl font-black text-slate-800 tracking-tight mt-1">{value}</p>
    </div>
  </motion.div>
);

const EvaluationRow: React.FC<{ 
  evaluation: Evaluation; 
  onDelete: (id: string) => void; 
  patientAge?: number;
}> = ({ evaluation, onDelete, patientAge }) => {
  const statusConfig = {
    [EvaluationStatus.Completed]: { 
      label: 'Completada', 
      classes: 'bg-green-50 text-green-700 border-green-100',
      icon: <CheckCircle2 className="w-4 h-4" />
    },
    [EvaluationStatus.Pending]: { 
      label: 'Pendiente', 
      classes: 'bg-amber-50 text-amber-700 border-amber-100',
      icon: <Clock className="w-4 h-4" />
    },
    [EvaluationStatus.Processing]: { 
      label: 'Procesando', 
      classes: 'bg-blue-50 text-blue-700 border-blue-100',
      icon: <Activity className="w-4 h-4 animate-spin-slow" />
    },
    [EvaluationStatus.Failed]: { 
      label: 'Revisión Necesaria', 
      classes: 'bg-red-50 text-red-700 border-red-100',
      icon: <Activity className="w-4 h-4" />
    },
  };

  const config = statusConfig[evaluation.status] || {
    label: evaluation.status || 'Desconocido',
    classes: 'bg-slate-50 text-slate-500 border-slate-100',
    icon: <Activity className="w-4 h-4" />
  };
  
  return (
    <div className="group flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-white border border-slate-100 rounded-2xl hover:border-blue-600/20 hover:shadow-lg hover:shadow-blue-600/5 transition-all duration-300 gap-4 overflow-hidden">
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center group-hover:bg-blue-50 transition-colors shrink-0">
          <FileText className="w-6 h-6 text-slate-400 group-hover:text-blue-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-slate-800 text-lg group-hover:text-blue-600 transition-colors uppercase tracking-tight truncate">{evaluation.patientName}</p>
          <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
            <span className="truncate font-medium">{evaluation.videoName}</span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
        <div className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-full border ${config.classes}`}>
          {config.icon}
          {config.label}
        </div>
        <div className="flex gap-1">
          {evaluation.status === EvaluationStatus.Completed && (
            <button 
              onClick={() => generateClinicalPDF({
                patientName: evaluation.patientName,
                patientAge: patientAge || document.getElementById(`age-${evaluation.id}`)?.getAttribute('data-age') || 'N/A',
                transcription: evaluation.transcription || '',
                analysis: evaluation.analysis || '',
                date: evaluation.createdAt && new Date(evaluation.createdAt.seconds * 1000).toLocaleDateString() || new Date().toLocaleDateString(),
                id: evaluation.id
              })}
              className="p-2.5 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
              title="Descargar PDF"
            >
              <FileText className="w-5 h-5" />
            </button>
          )}
          <button 
            onClick={() => onDelete(evaluation.id)}
            className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
            title="Eliminar registro"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

const DashboardPage: React.FC<DashboardPageProps> = ({ user }) => {
    const navigate = useNavigate();
    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
    const [patients, setPatients] = useState<Patient[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, [user.uid]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [evs, pts] = await Promise.all([
                getEvaluations(user.uid),
                getPatients(user.uid)
            ]);
            setEvaluations(evs);
            setPatients(pts);
        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteEvaluation = async (id: string) => {
        if (!window.confirm('¿Eliminar esta evaluación? Esta acción no se puede deshacer.')) return;
        try {
            await deleteEvaluation(id);
            setEvaluations(evaluations.filter(e => e.id !== id));
        } catch (error) {
            console.error("Error deleting evaluation:", error);
        }
    };

    const stats = [
        { title: 'Pacientes Directos', value: patients.length, icon: <Users className="w-6 h-6" /> },
        { title: 'Evaluaciones Totales', value: evaluations.length, icon: <FileText className="w-6 h-6" /> },
        { title: 'Completadas', value: evaluations.filter(e => e.status === EvaluationStatus.Completed).length, icon: <CheckCircle2 className="w-6 h-6" /> },
        { title: 'En Proceso', value: evaluations.filter(e => e.status === EvaluationStatus.Processing).length, icon: <Clock className="w-6 h-6" /> }
    ];

    const recentEvaluations = evaluations.slice(0, 5);
    const isEmailVerified = auth.currentUser?.emailVerified;

    if (isLoading) {
        return (
            <div className="min-h-[400px] flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-10 font-sans">
            {!isEmailVerified && (
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-4 text-amber-800"
                >
                    <AlertCircle className="w-6 h-6 shrink-0" />
                    <div className="flex-1">
                        <p className="font-bold text-sm">Verificación de Correo Pendiente</p>
                        <p className="text-xs font-medium text-amber-700/80 mt-0.5">Por favor, verifica tu correo electrónico para habilitar todas las funciones de escritura y el historial completo.</p>
                    </div>
                </motion.div>
            )}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter capitalize">Hola, {user.name.split(' ')[0]}</h1>
                    <p className="text-slate-500 font-medium text-lg mt-2">Bienvenido a su centro de control clínico.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => navigate('/new-evaluation')} 
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-900 border-2 border-blue-600 hover:bg-slate-800 text-white font-bold py-3.5 px-6 rounded-2xl shadow-lg shadow-blue-500/25 transition-all text-sm group"
                    >
                        <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                        <span className="text-white">Nueva Evaluación</span>
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map(stat => <StatCard key={stat.title} {...stat} />)}
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-10">
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <h2 className="text-2xl font-black text-slate-800 tracking-tighter">Historial Reciente</h2>
                        <button onClick={() => navigate('/patients')} className="text-sm font-bold text-blue-600 hover:text-blue-700 decoration-2 underline-offset-4 hover:underline">Ver todo</button>
                    </div>
                    <div className="space-y-4">
                        {recentEvaluations.length > 0 ? (
                            recentEvaluations.map(e => (
                                <EvaluationRow 
                                    key={e.id} 
                                    evaluation={e} 
                                    onDelete={handleDeleteEvaluation}
                                    patientAge={patients.find(p => p.id === e.patientId)?.age}
                                />
                            ))
                        ) : (
                            <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-200 flex flex-col items-center text-center">
                                <FileText className="w-8 h-8 text-slate-200 mb-4" />
                                <p className="text-slate-400 font-medium">No se registran evaluaciones activas.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    <h2 className="text-2xl font-black text-slate-800 tracking-tighter px-2">Acceso Rápido</h2>
                    <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden group">
                        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-32 h-32 bg-blue-600/20 blur-3xl rounded-full group-hover:scale-150 transition-transform duration-700"></div>
                        <h3 className="text-xl font-bold mb-4 relative z-10">Procesamiento Masivo</h3>
                        <p className="text-slate-400 text-sm leading-relaxed mb-8 relative z-10 font-medium">
                            Cargue múltiples archivos para análisis fonéticos simultáneos y optimice su tiempo de reporte.
                        </p>
                        <button 
                            onClick={() => navigate('/new-evaluation')}
                            className="w-full bg-white text-slate-900 font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-blue-50 transition-all shadow-xl relative z-10"
                        >
                            Comenzar Carga
                            <Plus className="w-5 h-5 font-black" />
                        </button>
                    </div>

                    <div className="bg-blue-50 rounded-[2.5rem] p-8 border border-blue-600/20 italic relative overflow-hidden">
                        <div className="absolute -bottom-4 -right-4">
                            <Activity className="w-24 h-24 text-blue-600/10" />
                        </div>
                        <p className="text-blue-600 text-[10px] font-black mb-3 uppercase tracking-[0.2em] relative z-10">Guía Clínica</p>
                        <p className="text-slate-600 text-sm leading-relaxed font-semibold relative z-10">
                            "La validación profesional es fundamental. Utilice los hallazgos de FonoAI como punto de partida para su informe definitivo."
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;
