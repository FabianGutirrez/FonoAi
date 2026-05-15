
import express from "express";
import path from "path";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import os from "os";
import { Readable } from "stream";
import { promisify } from "util";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import { createServer as createViteServer } from "vite";

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const readFile = promisify(fs.readFile);

async function extractAudio(inputSource: string | Buffer, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const input = typeof inputSource === "string" ? inputSource : Readable.from(inputSource);
    let command = ffmpeg(input);
    
    command
      .toFormat("mp3")
      .audioBitrate("96k")
      .audioChannels(1)
      .on("start", (cmd) => console.log("FFmpeg iniciado:", cmd))
      .on("end", () => resolve())
      .on("error", (err) => {
        console.error("Error en FFmpeg:", err);
        reject(err);
      })
      .save(outputPath);
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Multer con límite de 1GB
  const upload = multer({ 
    limits: { fileSize: 1024 * 1024 * 1024 }, 
    storage: multer.memoryStorage() 
  });

  app.use(cors());
  app.use(express.json({ limit: "50mb" }));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Transcription Endpoint con File API
  app.post("/api/transcribe", (req, res, next) => {
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
      upload.single("video")(req, res, next);
    } else {
      next();
    }
  }, async (req, res) => {
    const tempFiles: string[] = [];
    try {
      console.log("--- Iniciando Proceso Profesional de Transcripción (File API) ---");
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({ error: "API Key no configurada." });
      }

      // --- DETERMINAR ORIGEN DE PROCESAMIENTO ---
      const tempDir = os.tmpdir();
      const audioPath = path.join(tempDir, `out_${Date.now()}.mp3`);
      let finalPath = "";
      let finalMimeType = "";

      if (req.body.videoUrl && (req.body.mimeType || "video/mp4").startsWith("video/")) {
        // CASO ÓPTIMO: Streaming directo desde URL para videos grandes
        // Esto evita descargar el archivo de 600MB al disco (ENOSPC error fix)
        console.log("Optimizando video GRANDE mediante streaming directo desde URL...");
        try {
          await extractAudio(req.body.videoUrl, audioPath);
          finalPath = audioPath;
          finalMimeType = "audio/mp3";
          tempFiles.push(audioPath);
        } catch (e) {
          console.error("Fallo streaming de FFmpeg:", e);
          throw new Error("No se pudo procesar el video pesado mediante streaming. Intenta con un archivo más pequeño.");
        }
      } else {
        // CASO FALLBACK: Archivos pequeños o subidas directas via Multer
        let buffer: Buffer;
        let originalMimeType = "video/mp4";

        if (req.file) {
          buffer = req.file.buffer;
          originalMimeType = req.file.mimetype;
        } else if (req.body.videoUrl) {
          console.log("Descargando archivo pequeño para procesamiento local...");
          const videoResponse = await fetch(req.body.videoUrl);
          if (!videoResponse.ok) throw new Error("Error descargando video");
          buffer = Buffer.from(await videoResponse.arrayBuffer());
          originalMimeType = req.body.mimeType || "video/mp4";
        } else {
          return res.status(400).json({ error: "No se encontró video o URL procesable" });
        }

        const inputPath = path.join(tempDir, `in_${Date.now()}${path.extname(originalMimeType) || ".mp4"}`);
        await writeFile(inputPath, buffer);
        tempFiles.push(inputPath);
        finalPath = inputPath;
        finalMimeType = originalMimeType;

        if (originalMimeType.startsWith("video/")) {
          console.log("Extrayendo audio de archivo descargado...");
          try {
            await extractAudio(inputPath, audioPath);
            finalPath = audioPath;
            finalMimeType = "audio/mp3";
            tempFiles.push(audioPath);
          } catch (e) {
            console.warn("Fallo FFmpeg local, usando original.");
          }
        }
      }

      // --- SUBIDA A GOOGLE FILE API ---
      const fileManager = new GoogleAIFileManager(apiKey);
      console.log("Subiendo a Google AI File API...");
      const uploadResult = await fileManager.uploadFile(finalPath, {
        mimeType: finalMimeType,
        displayName: "TranscriptionJob",
      });

      // Esperar a que el archivo sea ACTIVE
      let file = await fileManager.getFile(uploadResult.file.name);
      let attempts = 0;
      while (file.state === FileState.PROCESSING && attempts < 20) {
        process.stdout.write(".");
        await new Promise(r => setTimeout(r, 3000));
        file = await fileManager.getFile(uploadResult.file.name);
        attempts++;
      }

      if (file.state !== FileState.ACTIVE) {
        throw new Error(`Google no pudo procesar el archivo: ${file.state}`);
      }

      console.log("\nEnviando prompt a Gemini...");
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash",
        systemInstruction: {
        role: "system",
        parts: [{ text: `Eres un transcriptor fonoaudiológico de alta precisión. Tu objetivo es la transcripción ACÚSTICA PURA.
REGLAS INQUEBRANTABLES:
1. DESACTIVA la autocorrección.
2. DESACTIVA la normalización gramatical.
3. SI EL PACIENTE TIENE UN DEFECTO DE HABLA, ESCRIBE EL DEFECTO. (Ejemplo: si dice 'totola' en vez de 'cocacola', escribe 'totola').
4. SI TARTAMUDEA, ESCRIBE CADA SÍLABA. (Ejemplo: 'p-p-p-perro').
5. SI DICE UNA PALABRA INVENTADA, ESCRÍBELA.
6. INCLUYE muletillas (eh, mmm, este) y pausas.
TU ÉXITO DEPENDE DE QUE NO CORRIJAS NADA. UN TEXTO PERFECTAMENTE ESCRITO ES UN FRACASO EN ESTE PROYECTO.` }]
        },
        generationConfig: {
          temperature: 0,
          topP: 0.1,
          topK: 16,
        },
      });
      

      const prompt = req.body.prompt || `Queda estrictamente prohibido corregir la gramática, la sintaxis o la fonética del hablante, 
Si el niño o adulto dice "pelo" por "perro", "toche" por "coche" o "andó" por "anduvo", transcribe exactamente la forma errónea,
Registra tartamudeos (ej: "p-p-pelota"), repeticiones de sílabas y sonidos de vacilación (eh, mmm, ah),
Si el audio tiene ruidos relevantes (tos, llanto, risa), inclúyelos entre corchetes, ej: [risas],
El texto resultante debe ser un espejo exacto del desempeño verbal del sujeto. No omitas palabras, muletillas ni sonidos,
Transcribe TODO exactamente como se escucha. Si hay errores de pronunciación, mantenlos. Si hay tartamudez, mantenla. No modifiques ni una sola letra para que 'suene bien'. El objetivo es capturar la realidad acústica del paciente, no producir un texto legible.

OBJETIVO: El texto resultante debe ser un espejo exacto del desempeño verbal del sujeto, permitiendo identificar procesos de simplificación fonológica o agramatismos.`;
      
      const result = await model.generateContent([
        {
          fileData: {
            mimeType: file.mimeType,
            fileUri: file.uri,
          },
        },
        { text: prompt },
      ]);

      const text = result.response.text();
      
      // Limpieza en Google
      await fileManager.deleteFile(file.name).catch(() => {});

      res.json({ text });

    } catch (error: any) {
      console.error("Error crítico:", error);
      res.status(500).json({ error: error.message || "Error interno del servidor" });
    } finally {
      // Limpiar archivos locales
      for (const f of tempFiles) {
        if (fs.existsSync(f)) await unlink(f).catch(() => {});
      }
    }
  });

  // Clinical Analysis Endpoint
  app.post("/api/analyze", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      
      if (!apiKey || apiKey === "undefined" || apiKey === "null" || apiKey === "") {
        return res.status(500).json({ error: "Clave de API no configurada en el servidor." });
      }

      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Falta el prompt de análisis." });
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      res.json({ text });
    } catch (error) {
      console.error("Error en el análisis:", error);
      res.status(400).json({ 
        error: "Error generando el análisis clínico",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // Use *all for Express 5 matching
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor iniciado en http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Fallo al iniciar el servidor:", err);
});
