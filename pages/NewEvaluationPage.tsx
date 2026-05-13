
import React, { useState, useEffect } from 'react';
import { 
  User as UserIcon, 
  FileVideo, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight,
  FileText,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Patient, User, Evaluation } from '../types';
import { EvaluationStatus } from '../types';
import { transcribeVideo, getClinicalAnalysis } from '../services/geminiService';
import { saveEvaluation, getPatients } from '../services/firestoreService';
import FileUpload from '../components/FileUpload';
import { firebaseStorage } from '../services/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

import { generateClinicalPDF } from '../lib/pdfGenerator';

interface NewEvaluationPageProps {
    user: User;
}

const NewEvaluationPage: React.FC<NewEvaluationPageProps> = ({ user }) => {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [selectedPatient, setSelectedPatient] = useState<string>('');
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string>('');
    const [transcription, setTranscription] = useState<string>('');
    const [analysis, setAnalysis] = useState<string>('');
    const [isFetchingPatients, setIsFetchingPatients] = useState(true);
    const [lastEvaluationId, setLastEvaluationId] = useState<string>('');

    useEffect(() => {
        const fetchPatients = async () => {
            try {
                const data = await getPatients(user.uid);
                setPatients(data);
            } catch (error) {
                console.error("Error fetching patients:", error);
            } finally {
                setIsFetchingPatients(false);
            }
        };
        fetchPatients();
    }, [user.uid]);

    const handleFileChange = (file: File | null) => {
        setVideoFile(file);
    };

    const handleDownloadPDF = () => {
        const patient = patients.find(p => p.id === selectedPatient);
        if (!patient) return;

        generateClinicalPDF({
            patientName: patient.name,
            patientAge: patient.age,
            transcription,
            analysis,
            date: new Date().toLocaleDateString(),
            id: lastEvaluationId || 'PENDIENTE'
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPatient || !videoFile) {
            setError('Por favor, seleccione un paciente y cargue un registro de video.');
            return;
        }

        const patient = patients.find(p => p.id === selectedPatient);
        if (!patient) return;

        setError('');
        setIsLoading(true);
        setTranscription('');
        setAnalysis('');

        try {
            let videoInput: File | string = videoFile;
            
            // Si el archivo es mayor a 4MB, lo subimos primero a Firebase Storage
            // para evitar el límite de 4.5MB de Vercel.
            if (videoFile.size > 4 * 1024 * 1024) {
                console.log("Archivo grande detectado, subiendo a Firebase Storage...");
                const storageRef = ref(firebaseStorage, `evaluations/${user.uid}/${Date.now()}_${videoFile.name}`);
                
                // Usamos una Promesa para manejar la subida con uploadBytesResumable, que es más estable
                const uploadPromise = new Promise<string>((resolve, reject) => {
                    const uploadTask = uploadBytesResumable(storageRef, videoFile);
                    
                    uploadTask.on('state_changed', 
                        null, // Podríamos rastrear el progreso aquí si fuera necesario
                        (error) => {
                            console.error("Error en la subida a Storage:", error);
                            reject(error);
                        }, 
                        async () => {
                            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                            resolve(downloadURL);
                        }
                    );
                });

                videoInput = await uploadPromise;
                console.log("Subida completada, URL obtenida:", videoInput);
            }

            // First simulation/transcription
            const transcriptionResult = await transcribeVideo(videoInput, videoFile.type);
            setTranscription(transcriptionResult);
            
            // AI Analysis
            const analysisResult = await getClinicalAnalysis(transcriptionResult);
            setAnalysis(analysisResult);

            // Persist to Firestore
            const evaluationId = await saveEvaluation({
                patientId: selectedPatient,
                patientName: patient.name,
                videoName: videoFile.name,
                status: EvaluationStatus.Completed,
                transcription: transcriptionResult,
                analysis: analysisResult
            }, user.uid);
            
            if (evaluationId) setLastEvaluationId(evaluationId);

        } catch (err) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : 'Error en el sistema de procesamiento.';
            setError(`Fallo crítico: ${errorMessage}`);
            
            // Optionally save failed evaluation
            await saveEvaluation({
                patientId: selectedPatient,
                patientName: patient?.name || 'Paciente Desconocido',
                videoName: videoFile.name,
                status: EvaluationStatus.Failed
            }, user.uid);
        } finally {
            setIsLoading(false);
        }
    };
    
    const isSubmitDisabled = !selectedPatient || !videoFile || isLoading;

    return (
        <div className="space-y-10 font-sans pb-20">
            <header>
                <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Nueva Evaluación</h1>
                <p className="text-slate-500 font-medium text-lg mt-2">Procesamiento de registros fonéticos asistido por IA.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
                <form onSubmit={handleSubmit} className="space-y-8">
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6"
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                                <UserIcon className="w-5 h-5 text-blue-600" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-800 tracking-tight">1. Selección de Paciente</h2>
                        </div>
                        <div className="relative group">
                            <select
                                value={selectedPatient}
                                onChange={(e) => setSelectedPatient(e.target.value)}
                                className="w-full pl-6 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 appearance-none transition-all font-bold text-slate-800"
                            >
                                <option value="" disabled>Seleccione un perfil clínico...</option>
                                {patients.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} ({p.age} años)</option>
                                ))}
                            </select>
                            <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-blue-600 transition-colors">
                                <ArrowRight className="w-5 h-5 rotate-90" />
                            </div>
                        </div>
                    </motion.div>

                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6"
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                                <FileVideo className="w-5 h-5 text-blue-600" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-800 tracking-tight">2. Registro Audiovisual</h2>
                        </div>
                        <FileUpload onFileChange={handleFileChange} />
                    </motion.div>
                    
                    <AnimatePresence>
                        {error && (
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="flex items-center gap-3 p-5 bg-red-50 text-red-700 rounded-2xl border border-red-100 text-sm font-bold"
                            >
                                <AlertCircle className="w-6 h-6 shrink-0" />
                                {error}
                            </motion.div>
                        )}
                    </AnimatePresence>
                    
                    <button
                        type="submit"
                        disabled={isSubmitDisabled}
                        className="w-full bg-slate-900 text-white font-black py-5 px-6 rounded-2xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed group shadow-2xl transition-all flex items-center justify-center gap-3"
                    >
                        {isLoading ? (
                            <>
                               <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                                <span className="uppercase tracking-widest text-sm">Procesando Análisis...</span>
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-6 h-6 group-hover:scale-125 transition-transform" />
                                <span className="uppercase tracking-widest text-sm">Generar Diagnóstico Asistido</span>
                            </>
                        )}
                    </button>
                </form>

                <div className="space-y-8">
                    <AnimatePresence mode="wait">
                        {!transcription && !analysis && !isLoading && (
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[3rem] p-12 flex flex-col items-center text-center justify-center min-h-[400px]"
                            >
                                <div className="w-24 h-24 bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 flex items-center justify-center mb-8">
                                    <Activity className="w-10 h-10 text-slate-200" />
                                </div>
                                <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-3 uppercase">Sala de Espera</h3>
                                <p className="text-slate-400 font-medium max-w-xs text-lg">Inicie la carga del registro para visualizar los resultados analíticos en este panel.</p>
                            </motion.div>
                        )}

                        {isLoading && (
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="bg-white border border-slate-100 rounded-[3rem] p-12 flex flex-col items-center text-center justify-center min-h-[400px] shadow-sm relative overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent"></div>
                                <div className="relative z-10">
                                    <div className="w-24 h-24 bg-blue-600 rounded-[2rem] shadow-2xl shadow-blue-600/40 flex items-center justify-center mb-8 animate-pulse mx-auto">
                                        <Sparkles className="w-10 h-10 text-white" />
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-3 uppercase">IA Procesando</h3>
                                    <p className="text-slate-400 font-medium max-w-xs text-lg">Extrayendo fonemas y generando hipótesis clínicas de alto nivel...</p>
                                </div>
                            </motion.div>
                        )}

                        {(transcription || analysis) && !isLoading && (
                            <motion.div 
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="bg-white p-10 rounded-[3rem] border border-blue-600/20 shadow-2xl shadow-blue-600/5 space-y-10"
                            >
                                <div className="flex items-center justify-between">
                                    <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Informe Clínico</h2>
                                    <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full border border-green-100 text-[10px] font-black uppercase tracking-widest">
                                        <CheckCircle2 className="w-4 h-4" />
                                        Generado con Éxito
                                    </div>
                                </div>

                                {transcription && (
                                    <section className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <FileText className="w-5 h-5 text-blue-600" />
                                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Transcripción Literal</h3>
                                        </div>
                                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 italic text-slate-600 leading-relaxed font-serif text-lg">
                                            "{transcription}"
                                        </div>
                                    </section>
                                )}

                                {analysis && (
                                    <section className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <Activity className="w-5 h-5 text-blue-600" />
                                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Análisis Descriptivo</h3>
                                        </div>
                                        <div className="prose prose-slate max-w-none prose-headings:text-slate-900 prose-headings:font-black prose-p:text-slate-600 prose-p:leading-relaxed prose-strong:text-blue-600 prose-strong:font-bold">
                                            <div dangerouslySetInnerHTML={{ __html: analysis.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br />') }} />
                                        </div>
                                    </section>
                                )}

                                <button 
                                    onClick={handleDownloadPDF}
                                    className="w-full py-4 bg-blue-50 hover:bg-blue-100 text-blue-600 font-black rounded-2xl transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                                >
                                    Descargar PDF Clínico
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default NewEvaluationPage;
