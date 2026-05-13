
import React, { useState, useCallback } from 'react';
import { Upload, FileVideo, X, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FileUploadProps {
    onFileChange: (file: File | null) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileChange }) => {
    const [fileName, setFileName] = useState<string | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);

    const handleFile = useCallback((file: File | null) => {
        if (file && file.type.startsWith('video/')) {
            setFileName(file.name);
            onFileChange(file);
        } else {
            setFileName(null);
            onFileChange(null);
            // In a real app we'd use a better toast/notif
        }
    }, [onFileChange]);

    const handleDragEnter = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    };

    const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            handleFile(files[0]);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            handleFile(files[0]);
        }
    };

    return (
        <div className="w-full">
            <label
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`
                    relative group flex flex-col items-center justify-center w-full min-h-[220px] px-6 py-10 
                    transition-all duration-300 border-2 border-dashed rounded-[2rem] cursor-pointer
                    ${isDragOver 
                        ? 'border-blue-500 bg-blue-50/50 scale-[0.99] shadow-inner' 
                        : 'border-slate-200 bg-white hover:border-blue-400 hover:bg-slate-50/50 hover:shadow-xl hover:shadow-blue-500/5'
                    }
                `}
            >
                <div className={`p-4 rounded-3xl mb-4 transition-all duration-300 ${isDragOver ? 'bg-blue-100/50 scale-110' : 'bg-slate-50 group-hover:bg-blue-50 group-hover:scale-110'}`}>
                    <Upload className={`w-8 h-8 transition-colors ${isDragOver ? 'text-blue-600' : 'text-slate-400 group-hover:text-blue-500'}`} />
                </div>
                
                <div className="text-center space-y-1">
                    <p className="text-lg font-bold text-slate-700 tracking-tight">
                        {isDragOver ? 'Suelte el archivo aquí' : 'Cargar registro clínico de video'}
                    </p>
                    <p className="text-sm font-medium text-slate-400">
                        Arrastre su grabación o <span className="text-blue-600 font-bold decoration-2 underline-offset-4 hover:underline">explore localmente</span>
                    </p>
                </div>

                <p className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">Formatos: MP4, MOV, AVI (Habilitado hasta 400MB)</p>
                
                <input type="file" name="file_upload" className="hidden" accept="video/mp4,video/quicktime,video/x-msvideo" onChange={handleChange} />
            </label>

            <AnimatePresence>
                {fileName && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="mt-6 p-5 bg-white border border-blue-100 rounded-[1.5rem] shadow-lg shadow-blue-500/5 flex items-center justify-between group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                                <FileVideo className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-800 truncate max-w-[200px] sm:max-w-xs">{fileName}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                                    <p className="text-[10px] font-black text-green-600 uppercase tracking-wider">Archivo Listo</p>
                                </div>
                            </div>
                        </div>
                        <button 
                            onClick={(e) => { 
                                e.preventDefault();
                                setFileName(null); 
                                onFileChange(null); 
                            }} 
                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default FileUpload;
