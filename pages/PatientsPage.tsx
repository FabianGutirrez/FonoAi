
import React, { useState, useEffect } from 'react';
import { 
  User as UserIcon, 
  Search, 
  Plus, 
  MoreHorizontal, 
  Edit2, 
  Trash2, 
  ChevronRight,
  Filter,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Patient, User } from '../types';
import { getPatients, savePatient, updatePatient, deletePatient, getEvaluationsByPatient } from '../services/firestoreService';
import type { Evaluation } from '../types';
import { generateClinicalPDF } from '../lib/pdfGenerator';

interface PatientsPageProps {
  user: User;
}

const PatientCard: React.FC<{ 
  patient: Patient; 
  onEdit: (p: Patient) => void;
  onDelete: (id: string) => void;
  onViewHistory: (p: Patient) => void;
}> = ({ patient, onEdit, onDelete, onViewHistory }) => (
  <motion.div 
    whileHover={{ y: -4 }}
    className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 group overflow-hidden"
  >
    <div className="flex items-start justify-between mb-6">
      <div className="flex items-center gap-4 min-w-0">
        <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:bg-blue-600 transition-colors duration-300 shrink-0">
          <UserIcon className="w-7 h-7 text-slate-400 group-hover:text-white transition-colors duration-300" />
        </div>
        <div className="min-w-0">
          <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight group-hover:text-blue-600 transition-colors truncate">{patient.name}</h3>
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-0.5">ID: #00{patient.id.substring(0, 4)}</p>
        </div>
      </div>
    </div>

    <div className="space-y-4">
      <div className="flex justify-between items-center py-3 border-y border-slate-50">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Edad</span>
        <span className="font-black text-slate-700">{patient.age} años</span>
      </div>
      
      <div className="flex gap-2">
        <button 
          onClick={() => onViewHistory(patient)}
          className="flex-1 bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-600 font-bold py-3 rounded-xl transition-all text-xs flex items-center justify-center gap-2 group/btn"
        >
          Historial
          <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
        </button>
        <div className="flex gap-1">
          <button 
            onClick={() => onEdit(patient)}
            className="p-3 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button 
            onClick={() => onDelete(patient.id)}
            className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  </motion.div>
);

const PatientsPage: React.FC<PatientsPageProps> = ({ user }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [historyPatient, setHistoryPatient] = useState<Patient | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAge, setNewAge] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (editingPatient) {
      setNewName(editingPatient.name);
      setNewAge(editingPatient.age.toString());
      setIsModalOpen(true);
    } else {
      setNewName('');
      setNewAge('');
    }
  }, [editingPatient]);

  const handleOpenNew = () => {
    setEditingPatient(null);
    setIsModalOpen(true);
  };

  const handleViewHistory = async (patient: Patient) => {
    setHistoryPatient(patient);
    setIsFetchingHistory(true);
    try {
      const data = await getEvaluationsByPatient(patient.id);
      setEvaluations(data);
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setIsFetchingHistory(false);
    }
  };

  useEffect(() => {
    const fetchPatients = async () => {
      setIsLoading(true);
      try {
        const data = await getPatients(user.uid);
        setPatients(data);
      } catch (error) {
        console.error("Error fetching patients:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPatients();
  }, [user.uid]);

  const handleCreateOrUpdatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newAge) return;
    
    setIsSaving(true);
    try {
      if (editingPatient) {
        await updatePatient(editingPatient.id, {
          name: newName,
          age: parseInt(newAge)
        });
        setPatients(patients.map(p => p.id === editingPatient.id ? { ...p, name: newName, age: parseInt(newAge) } : p));
      } else {
        const patientId = await savePatient({
          name: newName,
          age: parseInt(newAge)
        }, user.uid);
        
        const newPatient: Patient = {
          id: patientId || '',
          name: newName,
          age: parseInt(newAge)
        };
        
        setPatients([newPatient, ...patients]);
      }
      setIsModalOpen(false);
      setEditingPatient(null);
      setNewName('');
      setNewAge('');
    } catch (error) {
      console.error("Error saving patient:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePatient = async (id: string) => {
    if (!window.confirm('¿Está seguro de eliminar este perfil?')) return;
    try {
      await deletePatient(id);
      setPatients(patients.filter(p => p.id !== id));
    } catch (error) {
      console.error("Error deleting patient:", error);
    }
  };

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-10 font-sans pb-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Directorio de Pacientes</h1>
          <p className="text-slate-500 font-medium text-lg mt-2">Gestión centralizada de expedientes clínicos.</p>
        </div>
        <button 
          onClick={handleOpenNew}
          className="w-full md:w-auto bg-axolotl-pink hover:bg-axolotl-pink/90 text-slate-900 font-bold py-3.5 px-6 rounded-2xl shadow-lg shadow-axolotl-pink/25 transition-all text-sm flex items-center justify-center gap-2 group"
        >
          <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
          Registrar Paciente
        </button>
      </header>

      {/* Modal de Registro */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] p-10 shadow-2xl"
            >
              <button 
                onClick={() => setIsModalOpen(false)}
                className="absolute right-6 top-6 p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-50"
              >
                <X className="w-6 h-6" />
              </button>
              
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase mb-2">
                {editingPatient ? 'Editar Perfil' : 'Nuevo Perfil'}
              </h2>
              <p className="text-slate-500 font-medium mb-8">
                {editingPatient ? 'Actualice los datos del paciente.' : 'Inicie un nuevo expediente clínico.'}
              </p>
              
              <form onSubmit={handleCreateOrUpdatePatient} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Nombre Completo</label>
                  <input 
                    autoFocus
                    required
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-axolotl-pink/10 focus:border-axolotl-pink transition-all font-bold text-slate-800"
                    placeholder="Ej: Maite Rodríguez"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Edad</label>
                  <input 
                    required
                    type="number"
                    value={newAge}
                    onChange={(e) => setNewAge(e.target.value)}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-axolotl-pink/10 focus:border-axolotl-pink transition-all font-bold text-slate-800"
                    placeholder="Ej: 5"
                  />
                </div>
                
                <button 
                  disabled={isSaving}
                  type="submit"
                  className="w-full bg-slate-900 text-white font-black py-4 rounded-xl hover:bg-slate-800 shadow-xl transition-all disabled:opacity-50"
                >
                  {isSaving ? 'Guardando...' : 'Confirmar Registro'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Modal de Historial */}
      <AnimatePresence>
        {historyPatient && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setHistoryPatient(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2.5rem] p-10 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <button 
                onClick={() => setHistoryPatient(null)}
                className="absolute right-6 top-6 p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-50"
              >
                <X className="w-6 h-6" />
              </button>
              
              <div className="mb-8">
                <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase mb-2">
                  Historial Clínico
                </h2>
                <p className="text-slate-500 font-medium">
                  {historyPatient.name} • {historyPatient.age} años
                </p>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                {isFetchingHistory ? (
                  <div className="py-20 flex justify-center">
                    <div className="w-10 h-10 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin"></div>
                  </div>
                ) : evaluations.length > 0 ? (
                  evaluations.map(e => (
                    <div key={e.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-600/20 transition-all">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white rounded-lg text-blue-600 shadow-sm border border-slate-100">
                            <Plus className="w-4 h-4 font-black" />
                          </div>
                          <span className="text-sm font-bold text-slate-800">{e.videoName}</span>
                        </div>
                        <span className="text-[10px] font-black bg-white border border-slate-100 px-2.5 py-1 rounded-full text-slate-400 uppercase">Enviado</span>
                      </div>
                      {e.transcription && (
                        <p className="text-xs text-slate-500 line-clamp-2 italic mb-2">"{e.transcription}"</p>
                      )}
                      <div className="flex justify-between items-center mt-4">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{e.id.substring(0, 8)}</span>
                        <button 
                          onClick={() => generateClinicalPDF({
                            patientName: historyPatient.name,
                            patientAge: historyPatient.age,
                            transcription: e.transcription || '',
                            analysis: e.analysis || '',
                            date: e.createdAt && new Date(e.createdAt.seconds * 1000).toLocaleDateString() || new Date().toLocaleDateString(),
                            id: e.id
                          })}
                          className="text-xs font-bold text-blue-600 hover:underline"
                        >
                          Descargar PDF
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-20 text-center bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                    <p className="text-slate-400 font-medium">No se registran evaluaciones para este paciente.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-axolotl-pink transition-colors" />
          <input
            type="text"
            placeholder="Buscar por nombre o ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-6 py-4 bg-white border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-axolotl-pink/10 focus:border-axolotl-pink transition-all font-medium text-slate-800 shadow-sm"
          />
        </div>
        <button className="px-6 py-4 bg-white border border-slate-100 rounded-2xl text-slate-600 font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-all shadow-sm">
          <Filter className="w-5 h-5" />
          Filtros
        </button>
      </div>

      {isLoading ? (
        <div className="min-h-[300px] flex items-center justify-center">
           <div className="w-12 h-12 border-4 border-axolotl-pink/30 border-t-axolotl-pink rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredPatients.length > 0 ? (
            filteredPatients.map(p => (
              <PatientCard 
                key={p.id} 
                patient={p} 
                onEdit={setEditingPatient}
                onDelete={handleDeletePatient}
                onViewHistory={handleViewHistory}
              />
            ))
          ) : (
            <div className="col-span-full bg-white p-20 rounded-[3rem] border border-dashed border-slate-200 flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-6">
                <UserIcon className="w-10 h-10 text-slate-200" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">No se encontraron pacientes</h3>
              <p className="text-slate-400 font-medium max-w-xs">Ajuste su búsqueda o registre un nuevo perfil clínico para comenzar.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PatientsPage;
