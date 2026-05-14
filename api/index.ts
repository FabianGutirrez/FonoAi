import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import { Readable } from "stream";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const readFile = promisify(fs.readFile);

async function extractAudio(inputSource: string | Buffer, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const source = typeof inputSource === "string" ? inputSource : Readable.from(inputSource);
    const command = ffmpeg(source);
    command
      .toFormat("mp3")
      .audioBitrate("96k")
      .audioChannels(1)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .save(outputPath);
  });
}

const app = express();

const upload = multer({ 
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB
  storage: multer.memoryStorage() 
});

app.use(cors());
app.use(express.json({ limit: "50mb" }));

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", environment: "vercel" });
});

// Transcription Endpoint con File API
app.post("/api/transcribe", (req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    upload.single("video")(req, res, next);
  } else {
    next();
  }
}, async (req: any, res: any) => {
  const tempFiles: string[] = [];
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.GOOGLE_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ 
        error: "GEMINI_API_KEY no configurada.",
        details: "Asegúrate de añadir GEMINI_API_KEY en las Environment Variables de Vercel."
      });
    }

    const tempDir = os.tmpdir();
    const audioPath = path.join(tempDir, `api_out_${Date.now()}.mp3`);
    let finalPath = "";
    let finalMimeType = "";

    if (req.body.videoUrl && (req.body.mimeType || "video/mp4").startsWith("video/")) {
      // PROCESADO PROFESIONAL: No descargamos el video completo, FFmpeg hace streaming.
      console.log("Vercel Protect: Usando streaming directo para evitar ENOSPC en videos grandes.");
      try {
        await extractAudio(req.body.videoUrl, audioPath);
        finalPath = audioPath;
        finalMimeType = "audio/mp3";
        tempFiles.push(audioPath);
      } catch (streamError) {
        console.error("Fallo en streaming FFmpeg:", streamError);
        throw new Error("El video es demasiado grande para procesarlo directamente. El streaming ha fallado.");
      }
    } else {
      // FALLBACK: Para archivos pequeños o subidas directas
      let buffer: Buffer;
      let originalMimeType = "video/mp4";

      if (req.file) {
        buffer = req.file.buffer;
        originalMimeType = req.file.mimetype || "video/mp4";
      } else if (req.body.videoUrl) {
        console.log("Descargando archivo pequeño...");
        const fetchResponse = await fetch(req.body.videoUrl);
        if (!fetchResponse.ok) throw new Error("Error bajando de Storage");
        buffer = Buffer.from(await fetchResponse.arrayBuffer());
        originalMimeType = req.body.mimeType || "video/mp4";
      } else {
        return res.status(400).json({ error: "No se proporcionó video" });
      }

      const inPath = path.join(tempDir, `api_in_${Date.now()}${path.extname(originalMimeType) || ".mp4"}`);
      await writeFile(inPath, buffer);
      tempFiles.push(inPath);
      finalPath = inPath;
      finalMimeType = originalMimeType;

      if (originalMimeType.startsWith("video/")) {
        console.log("Extrayendo audio localmente...");
        try {
          await extractAudio(inPath, audioPath);
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
      await new Promise(r => setTimeout(r, 4000));
      file = await fileManager.getFile(uploadResult.file.name);
      attempts++;
    }

    if (file.state !== FileState.ACTIVE) {
      throw new Error(`Google no pudo procesar el archivo: ${file.state}`);
    }

    console.log("Iniciando transcripción con Gemini...");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = req.body.prompt || "Transcribe exactamente este video de forma profesional.";
    
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

    res.json({ transcription: text, text: text }); // Enviamos ambos por retrocompatibilidad

  } catch (error: any) {
    console.error("Error crítico en API:", error);
    res.status(500).json({ 
      error: error.message || "Error interno del servidor",
      details: error.message 
    });
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
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.GOOGLE_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: "Clave de API no configurada." });
    }

    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Falta el prompt de análisis." });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

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

export default app;