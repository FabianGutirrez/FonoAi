
/**
 * Este servicio se ha migrado a una arquitectura full-stack (Backend) para:
 * 1. Proteger la clave de API de Gemini (no exponerla en el navegador).
 * 2. Garantizar que la clave esté disponible en cualquier PC desde el que se abra la app.
 * 3. Manejar archivos de video de forma más robusta.
 */

const transcriptionPrompt = `
Eres un transcriptor fonoaudiológico especializado en lingüística clínica. Tu función es convertir grabaciones de audio a texto siguiendo un protocolo de "Fidelidad Radical".

REGLAS DE ORO:
1. NO CORREGIR: Queda estrictamente prohibido corregir la gramática, la sintaxis o la fonética del hablante.
2. ERRORES FONÉTICOS: Si el niño o adulto dice "pelo" por "perro", "toche" por "coche" o "andó" por "anduvo", transcribe exactamente la forma errónea.
3. DISFLUENCIAS: Registra tartamudeos (ej: "p-p-pelota"), repeticiones de sílabas y sonidos de vacilación (eh, mmm, ah).
4. MARCAS DE CONTEXTO: Si el audio tiene ruidos relevantes (tos, llanto, risa), inclúyelos entre corchetes, ej: [risas].
5. FORMATO DE SALIDA: Entrega solo la transcripción literal. Si detectas un error gramatical grave que dificultelte la lectura, NO lo arregles; mi objetivo es analizar precisamente esos errores.

OBJETIVO: El texto resultante debe ser un espejo exacto del desempeño verbal del sujeto, permitiendo identificar procesos de simplificación fonológica o agramatismos.

Ahora, transcribe el siguiente audio:
`;

const analysisPrompt = `
Eres un fonoaudiólogo experto en análisis del habla y lenguaje. Has recibido la siguiente transcripción literal de un paciente. Tu tarea es generar un informe clínico detallado.

Transcripción del Paciente:
"%%TRANSCRIPTION%%"

Basado en la transcripción, realiza el siguiente análisis:

1.  **Análisis Fonético-Fonológico:**
    *   Identifica y lista todos los Procesos de Simplificación Fonológica (PSF) presentes (ej: sustitución, omisión, asimilación).
    *   Proporciona ejemplos concretos de la transcripción para cada PSF identificado.
    *   Evalúa la inteligibilidad del habla en un porcentaje estimado.

2.  **Análisis Morfosintáctico:**
    *   Describe el uso de estructuras gramaticales. ¿Usa oraciones simples, complejas?
    *   Identifica errores gramaticales (agramatismos), como omisión de nexos, artículos, o conjugaciones verbales incorrectas. Cita ejemplos.
    *   Calcula la Longitud Media del Enunciado (LME) si es posible con la muestra.

3.  **Análisis Semántico:**
    *   Evalúa la coherencia y cohesión del discurso.
    *   ¿El vocabulario es adecuado para la edad esperada? ¿Es variado o restringido?

4.  **Análisis Pragmático:**
    *   Observa el uso del lenguaje en contexto (si la transcripción lo permite). ¿Respeta turnos? ¿Mantiene el tópico?

5.  **Hipótesis Diagnóstica Preliminar:**
    *   Basado en todos los análisis anteriores, formula una o más hipótesis diagnósticas (ej: Trastorno de los Sonidos del Habla (TSH), Trastorno Específico del Lenguaje (TEL) / Trastorno del Desarrollo del Lenguaje (TDL), etc.). Justifica tu hipótesis.

6.  **Sugerencias de Evaluación y Refuerzo:**
    *   **Áreas a Evaluar:** ¿Qué pruebas o evaluaciones formales e informales sugieres para confirmar la hipótesis? (ej: TEPROSIF-R, STSG, evaluación de órganos fonoarticulatorios).
    *   **Áreas a Reforzar:** ¿Qué objetivos terapéuticos priorizarías para la intervención? (ej: trabajar el fonema /r/, aumentar la complejidad de las oraciones, mejorar la conciencia fonológica).

Formato de Salida: El informe debe ser claro, profesional y estar estructurado con los títulos en negrita.
`;

export interface TranscribeResponse {
    text: string;
    transcription: string;
    analysis?: string;
    acousticMetrics?: any;
    diarization?: any[];
    phonemeAlignments?: any[];
}

export const transcribeVideo = async (
    video: File | string, 
    mimeType?: string, 
    mode: 'normal' | 'advanced' = 'normal'
): Promise<TranscribeResponse> => {
    try {
        let body;
        let headers: Record<string, string> = {};

        if (typeof video === 'string') {
            // Si es una URL (archivo grande ya subido a Storage)
            body = JSON.stringify({ 
                videoUrl: video, 
                mimeType: mimeType,
                prompt: transcriptionPrompt,
                mode: mode
            });
            headers['Content-Type'] = 'application/json';
        } else {
            // Si es un archivo (Multer - para archivos pequeños < 4.5MB)
            body = new FormData();
            body.append("video", video);
            body.append("prompt", transcriptionPrompt);
            body.append("mode", mode);
        }

        const response = await fetch("/api/transcribe", {
            method: "POST",
            headers: headers,
            body: body,
        });

        if (!response.ok) {
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                const errorData = await response.json();
                // Mostramos el detalle específico si viene del servidor
                const msg = errorData.details ? `${errorData.error}: ${errorData.details}` : (errorData.error || "Error en el servidor");
                throw new Error(msg);
            } else {
                if (response.status === 413) {
                    throw new Error("El video es demasiado grande para Vercel. Intente con uno más corto.");
                }
                const textError = await response.text();
                throw new Error(`Error ${response.status}: ${textError.substring(0, 100)}`);
            }
        }

        const data = await response.json();
        return data; // Retorna todo el objeto JSON con métricas acústicas si existen
    } catch (error) {
        console.error("Error in transcribeVideo:", error);
        // Ensure we throw a clean error message
        if (error instanceof Error) throw error;
        throw new Error(String(error));
    }
};

export interface StreamProgress {
    step: string;
    message?: string;
    error?: string;
    transcription?: string;
    text?: string;
    analysis?: string;
    acousticMetrics?: any;
    diarization?: any[];
    phonemeAlignments?: any[];
}

export const transcribeVideoStreaming = async (
    video: File | string,
    mimeType: string | undefined,
    mode: 'normal' | 'advanced',
    onProgress: (progress: StreamProgress) => void
): Promise<void> => {
    try {
        let body;
        let headers: Record<string, string> = {
            'Accept': 'text/event-stream'
        };

        if (typeof video === 'string') {
            body = JSON.stringify({ 
                videoUrl: video, 
                mimeType: mimeType,
                prompt: transcriptionPrompt,
                mode: mode,
                stream: true
            });
            headers['Content-Type'] = 'application/json';
        } else {
            body = new FormData();
            body.append("video", video);
            body.append("prompt", transcriptionPrompt);
            body.append("mode", mode);
            body.append("stream", "true");
        }

        const response = await fetch("/api/transcribe", {
            method: "POST",
            headers: headers,
            body: body,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error del servidor (${response.status}): ${errorText.substring(0, 150)}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error("Su navegador no soporta streaming en tiempo real.");
        }

        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            
            // Keep the last incomplete line in buffer
            buffer = lines.pop() || "";

            for (const line of lines) {
                const cleanLine = line.trim();
                if (cleanLine.startsWith("data: ")) {
                    try {
                        const rawJson = cleanLine.substring(6).trim();
                        const progress: StreamProgress = JSON.parse(rawJson);
                        onProgress(progress);
                    } catch (parseErr) {
                        console.warn("Error parsing stream chunk:", parseErr, cleanLine);
                    }
                }
            }
        }

        // Process final line if it remaining and valid
        if (buffer.trim().startsWith("data: ")) {
            try {
                const rawJson = buffer.trim().substring(6).trim();
                const progress: StreamProgress = JSON.parse(rawJson);
                onProgress(progress);
            } catch (e) {}
        }

    } catch (error) {
        console.error("Error in transcribeVideoStreaming:", error);
        if (error instanceof Error) throw error;
        throw new Error(String(error));
    }
};

export const getClinicalAnalysis = async (transcription: string): Promise<string> => {
    try {
        const promptWithTranscription = analysisPrompt.replace('%%TRANSCRIPTION%%', transcription);
        
        const response = await fetch("/api/analyze", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ prompt: promptWithTranscription }),
        });

        if (!response.ok) {
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                const errorData = await response.json();
                const msg = errorData.details ? `${errorData.error}: ${errorData.details}` : (errorData.error || "Error al analizar");
                throw new Error(msg);
            } else {
                throw new Error(`Error del servidor al analizar (${response.status})`);
            }
        }

        const data = await response.json();
        return data.text;
    } catch (error) {
        console.error("Error in getClinicalAnalysis:", error);
        return `Hubo un problema con el servicio de IA. Detalles técnicos: ${error instanceof Error ? error.message : 'Error desconocido'}.`;
    }
};
