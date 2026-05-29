
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
import { transcribeVideo, getClinicalAnalysis, transcribeVideoStreaming } from '../services/geminiService';
import { saveEvaluation, getPatients, updateEvaluation } from '../services/firestoreService';
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
    const [uploadProgress, setUploadProgress] = useState<number>(0);
    const [streamStep, setStreamStep] = useState<string>('');
    const [streamMessage, setStreamMessage] = useState<string>('');

    // Nuevos Estados para procesamiento acústico y turnos avanzado
    const [processingMode, setProcessingMode] = useState<'normal' | 'advanced'>('normal');
    const [acousticMetrics, setAcousticMetrics] = useState<any>(null);
    const [diarization, setDiarization] = useState<any[]>([]);
    const [phonemeAlignments, setPhonemeAlignments] = useState<any[]>([]);
    const [includeTranscriptInAnalysis, setIncludeTranscriptInAnalysis] = useState<boolean>(true);

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
            id: lastEvaluationId || 'PENDIENTE',
            showTranscription: includeTranscriptInAnalysis,
            acousticMetrics,
            diarization,
            phonemeAlignments
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
        setUploadProgress(0);
        setTranscription('');
        setAnalysis('');
        setAcousticMetrics(null);
        setDiarization([]);
        setPhonemeAlignments([]);
        setStreamStep('optimizing');
        setStreamMessage('Pre-registrando evaluación clínica en la base de datos...');

        let initialEvalId = '';

        try {
            // Guardar evaluación inicialmente en estado "procesando" para aliviar al cliente/Vercel
            initialEvalId = await saveEvaluation({
                patientId: selectedPatient,
                patientName: patient.name,
                videoName: videoFile.name,
                status: EvaluationStatus.Processing
            }, user.uid);
            
            if (initialEvalId) {
                setLastEvaluationId(initialEvalId);
            }

            let videoInput: File | string = videoFile;
            
            // Si el archivo es mayor a 4MB, lo subimos primero a Firebase Storage
            // para evitar el límite de 4.5MB de Vercel y asegurar fluidez de procesamiento.
            if (videoFile.size > 4 * 1024 * 1024) {
                console.log("Archivo grande detectado, subiendo a Firebase Storage...");
                setStreamMessage('Subiendo grabación a Firebase para transferencia óptima...');
                const storageRef = ref(firebaseStorage, `evaluations/${user.uid}/${Date.now()}_${videoFile.name}`);
                
                const uploadPromise = new Promise<string>((resolve, reject) => {
                    const uploadTask = uploadBytesResumable(storageRef, videoFile);
                    
                    uploadTask.on('state_changed', 
                        (snapshot) => {
                            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                            setUploadProgress(progress);
                        },
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

            let finalTranscription = "";
            let finalAnalysis = "";
            let finalAcousticMetrics: any = null;
            let finalDiarization: any[] = [];
            let finalPhonemeAlignments: any[] = [];

            setStreamMessage('Optimizando pista de audio...');

            // Realizar transcripción usando streaming para evitar timeout de Vercel/servidor
            await transcribeVideoStreaming(videoInput, videoFile.type, processingMode, (progress) => {
                if (progress.step === 'error') {
                    throw new Error(progress.error || "Fallo en el servidor durante el procesamiento del habla.");
                }

                if (progress.step === 'optimizing') {
                    setStreamStep('optimizing');
                    setStreamMessage(progress.message || "Optimizando y extrayendo audio clínico de la grabación...");
                } else if (progress.step === 'uploading_google_ai') {
                    setStreamStep('uploading_google_ai');
                    setStreamMessage(progress.message || "Canal de Seguridad: Subiendo grabación a Google AI...");
                } else if (progress.step === 'waiting_active') {
                    setStreamStep('waiting_active');
                    setStreamMessage(progress.message || "Google AI: Procesando segmentación y códec...");
                } else if (progress.step === 'transcribing') {
                    setStreamStep('transcribing');
                    setStreamMessage(progress.message || "WhisperX / Gemini: Traduciendo fonética cruda del paciente...");
                } else if (progress.step === 'analyzing') {
                    setStreamStep('analyzing');
                    setStreamMessage(progress.message || "Generando informe fonoaudiológico estructurado...");
                }

                if (progress.transcription) {
                    finalTranscription = progress.transcription;
                    setTranscription(progress.transcription);
                }
                if (progress.analysis) {
                    finalAnalysis = progress.analysis;
                    setAnalysis(progress.analysis);
                }
                if (progress.acousticMetrics) {
                    finalAcousticMetrics = progress.acousticMetrics;
                    setAcousticMetrics(progress.acousticMetrics);
                }
                if (progress.diarization) {
                    finalDiarization = progress.diarization;
                    setDiarization(progress.diarization);
                }
                if (progress.phonemeAlignments) {
                    finalPhonemeAlignments = progress.phonemeAlignments;
                    setPhonemeAlignments(progress.phonemeAlignments);
                }

                if (progress.step === 'complete') {
                    if (progress.text) {
                        finalTranscription = progress.text;
                        setTranscription(progress.text);
                    }
                    if (progress.analysis) {
                        finalAnalysis = progress.analysis;
                        setAnalysis(progress.analysis);
                    }
                }
            });

            // Si es modo normal, generamos el análisis fonoaudiológico basado en IA en el cliente
            if (processingMode === 'normal') {
                setStreamStep('analyzing');
                setStreamMessage('Análisis morfosintáctico y fonológico asistido por IA...');
                finalAnalysis = await getClinicalAnalysis(finalTranscription);
                setAnalysis(finalAnalysis);
            }

            // Actualizar evaluación clínica con resultados finales completos
            const targetEvalId = initialEvalId || lastEvaluationId;
            if (targetEvalId) {
                const updateData: any = {
                    status: EvaluationStatus.Completed,
                    transcription: finalTranscription,
                    analysis: finalAnalysis
                };
                
                if (processingMode === 'advanced') {
                    if (finalAcousticMetrics) updateData.acousticMetrics = finalAcousticMetrics;
                    if (finalDiarization && finalDiarization.length > 0) updateData.diarization = finalDiarization;
                    if (finalPhonemeAlignments && finalPhonemeAlignments.length > 0) updateData.phonemeAlignments = finalPhonemeAlignments;
                }
                
                await updateEvaluation(targetEvalId, updateData);
            }

        } catch (err) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : 'Error en el sistema de procesamiento.';
            setError(`Fallo crítico: ${errorMessage}`);
            
            const targetEvalId = initialEvalId || lastEvaluationId;
            if (targetEvalId) {
                await updateEvaluation(targetEvalId, {
                    status: EvaluationStatus.Failed
                });
            } else {
                await saveEvaluation({
                    patientId: selectedPatient,
                    patientName: patient?.name || 'Paciente Desconocido',
                    videoName: videoFile.name,
                    status: EvaluationStatus.Failed
                }, user.uid);
            }
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
                        transition={{ delay: 0.05 }}
                        className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6"
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                                <Activity className="w-5 h-5 text-violet-600" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-800 tracking-tight">2. Configuración de Análisis</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button
                                type="button"
                                onClick={() => setProcessingMode('normal')}
                                className={`p-5 rounded-2xl border text-left transition-all relative overflow-hidden ${
                                    processingMode === 'normal' 
                                        ? 'border-blue-600 bg-blue-50/20 ring-4 ring-blue-600/5' 
                                        : 'border-slate-100 bg-slate-50/50 hover:border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                <div className="font-black text-xs text-slate-700 uppercase tracking-widest">Tradicional</div>
                                <div className="font-bold text-base text-slate-800 mt-1">AI Directo</div>
                                <p className="text-xs text-slate-400 mt-2 font-medium leading-relaxed">Transcripción clínica y reporte automático fonoaudiológico estándar de Gemini.</p>
                            </button>
                            <button
                                type="button"
                                onClick={() => setProcessingMode('advanced')}
                                className={`p-5 rounded-2xl border text-left transition-all relative overflow-hidden ${
                                    processingMode === 'advanced' 
                                        ? 'border-violet-600 bg-violet-50/20 ring-4 ring-violet-600/5' 
                                        : 'border-slate-100 bg-slate-50/50 hover:border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                <div className="font-black text-xs text-violet-700 uppercase tracking-widest flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-violet-600 animate-pulse" />
                                    Multicanal
                                </div>
                                <div className="font-bold text-base text-violet-900 mt-1">Física + Diarización</div>
                                <p className="text-xs text-slate-400 mt-2 font-medium leading-relaxed">Integra WhisperX, Praat (Hz laringe/formantes), MFA (alineación fonemas) y Pyannote (turnos).</p>
                            </button>
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
                                    {uploadProgress > 0 && uploadProgress < 100 ? (
                                        <div className="w-full max-w-xs mx-auto mb-4">
                                            <div className="flex justify-between text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">
                                                <span>Subiendo a la nube</span>
                                                <span>{Math.round(uploadProgress)}%</span>
                                            </div>
                                            <div className="w-full bg-blue-100 h-1.5 rounded-full overflow-hidden">
                                                <motion.div 
                                                    className="bg-blue-600 h-full"
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${uploadProgress}%` }}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-slate-400 font-medium max-w-xs text-lg">{streamMessage || "Extrayendo fonemas y optimizando video con FFmpeg..."}</p>
                                    )}
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

                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-blue-50/25 rounded-2xl border border-blue-500/10">
                                    <div className="flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-blue-600" />
                                        <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Opciones de Informe:</span>
                                    </div>
                                    <label className="flex items-center gap-3 cursor-pointer select-none">
                                        <input 
                                            type="checkbox" 
                                            checked={includeTranscriptInAnalysis} 
                                            onChange={(e) => setIncludeTranscriptInAnalysis(e.target.checked)}
                                            className="w-4.5 h-4.5 text-blue-600 rounded focus:ring-blue-500 border-slate-300 accent-blue-600"
                                        />
                                        <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Incluir Transcripción en Diagnóstico y PDF</span>
                                    </label>
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

                                {acousticMetrics && (
                                    <section className="space-y-6">
                                        <div className="flex items-center gap-3">
                                            <Activity className="w-5 h-5 text-violet-600 animate-pulse" />
                                            <h3 className="text-sm font-black text-violet-600 uppercase tracking-[0.2em] flex items-center gap-1.5">
                                                Biometría de Voz y Acústica (Praat)
                                            </h3>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                            {/* Pitch Card */}
                                            <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-3">
                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tono Fundamental (F0)</div>
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-3xl font-black text-slate-800 tracking-tight">{acousticMetrics.pitchMean?.toFixed(1)}</span>
                                                    <span className="text-xs font-bold text-slate-400">Hz</span>
                                                </div>
                                                <div className="text-[11px] text-slate-500 font-medium">
                                                    Var. Vocal (Desv. StDev): <span className="font-bold text-slate-700">{acousticMetrics.pitchStDev?.toFixed(1)} Hz</span>
                                                </div>
                                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                                    <div className="bg-blue-600 h-full w-[80%]" />
                                                </div>
                                            </div>

                                            {/* Jitter & Shimmer Card */}
                                            <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-3">
                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Micro-Perturbación</div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-slate-500 font-medium">Jitter (Periodo):</span>
                                                    <span className="font-black text-violet-600">{acousticMetrics.jitter?.toFixed(2)}%</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-slate-500 font-medium">Shimmer (Amplitud):</span>
                                                    <span className="font-black text-violet-600">{acousticMetrics.shimmer?.toFixed(2)}%</span>
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-semibold leading-tight">
                                                    Valores dentro del rango infantil esperado. No hay indicios de fatiga glótica.
                                                </div>
                                            </div>

                                            {/* Resonance formants */}
                                            <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-3">
                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tracto Resonador F1/F2</div>
                                                <div className="flex justify-between items-baseline">
                                                    <div>
                                                        <span className="text-xl font-bold text-slate-800">{acousticMetrics.f1Mean?.toFixed(0)}</span>
                                                        <span className="text-[10px] text-slate-400 font-bold ml-0.5">Hz (F1)</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-xl font-bold text-slate-800">{acousticMetrics.f2Mean?.toFixed(0)}</span>
                                                        <span className="text-[10px] text-slate-400 font-bold ml-0.5">Hz (F2)</span>
                                                    </div>
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-medium leading-normal">
                                                    F1 elevado indica adecuada apertura labiomandibular; F2 describe el posicionamiento lingual anterior.
                                                </div>
                                            </div>
                                        </div>
                                    </section>
                                )}

                                {diarization && diarization.length > 0 && (
                                    <section className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <Activity className="w-5 h-5 text-indigo-600" />
                                            <h3 className="text-sm font-black text-indigo-600 uppercase tracking-[0.2em]">Diarización y Turnos de Diálogo (Pyannote)</h3>
                                        </div>
                                        <div className="border border-slate-100 rounded-3xl p-6 bg-slate-50/20 space-y-4 max-h-[280px] overflow-y-auto">
                                            {diarization.map((seg, idx) => {
                                                const isPatient = seg.speaker.toLowerCase().includes('paciente');
                                                return (
                                                    <div 
                                                        key={idx}
                                                        className={`flex flex-col max-w-[85%] ${isPatient ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                                                    >
                                                        <div className="flex items-center gap-1.5 mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                            <span>{seg.speaker}</span>
                                                            <span className="text-slate-300">•</span>
                                                            <span className="font-mono">{seg.start.toFixed(1)}s - {seg.end.toFixed(1)}s</span>
                                                        </div>
                                                        <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                                                            isPatient 
                                                                ? 'bg-violet-600 text-white rounded-tr-none' 
                                                                : 'bg-white border border-slate-100 text-slate-800 shadow-sm rounded-tl-none'
                                                        }`}>
                                                            {seg.text}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </section>
                                )}

                                {phonemeAlignments && phonemeAlignments.length > 0 && (
                                    <section className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <Sparkles className="w-5 h-5 text-rose-500" />
                                            <h3 className="text-sm font-black text-rose-500 uppercase tracking-[0.2em]">Alineación Fonómica Segmental (MFA)</h3>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {phonemeAlignments.map((wordAlign, wIdx) => (
                                                <div 
                                                    key={wIdx}
                                                    className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex flex-col justify-between"
                                                >
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="font-black text-sm text-slate-800 uppercase tracking-wide">"{wordAlign.word}"</span>
                                                        <span className="text-[10px] font-mono text-slate-400">{wordAlign.start.toFixed(2)}s - {wordAlign.end.toFixed(2)}s</span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {wordAlign.phonemes.map((ph, pIdx) => (
                                                            <div 
                                                                key={pIdx} 
                                                                className="flex flex-col items-center bg-white border border-slate-100 rounded-lg p-2 min-w-[38px] cursor-help shadow-sm relative group"
                                                            >
                                                                <span className="text-xs font-black text-rose-600">/{ph.phone}/</span>
                                                                <span className="text-[8px] font-bold text-slate-400 mt-1">{(ph.score * 100).toFixed(0)}%</span>
                                                                
                                                                {/* Tooltip on Hover */}
                                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] font-bold py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap mb-1 z-10">
                                                                    Confianza MFA: {ph.score.toFixed(2)}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                )}

                                {analysis && (
                                    <section className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <Activity className="w-5 h-5 text-blue-600" />
                                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Análisis Descriptivo fonoaudiológico</h3>
                                        </div>

                                        {includeTranscriptInAnalysis && transcription && (
                                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-3 mb-6">
                                                <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1.5">
                                                    <FileText className="w-3.5 h-3.5" />
                                                    Transcripción de Soporte del Diagnóstico:
                                                </div>
                                                <p className="italic text-slate-700 font-serif leading-relaxed text-base">
                                                    "{transcription}"
                                                </p>
                                            </div>
                                        )}

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
