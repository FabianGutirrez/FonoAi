
import express from "express";
import path from "path";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import os from "os";
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

async function extractAudio(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .toFormat("mp3")
      .audioBitrate("96k")
      .audioChannels(1)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
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

      let buffer: Buffer;
      let originalMimeType = "video/mp4";

      if (req.file) {
        buffer = req.file.buffer;
        originalMimeType = req.file.mimetype;
      } else if (req.body.videoUrl) {
        console.log("Descargando desde URL externa...");
        const videoResponse = await fetch(req.body.videoUrl);
        if (!videoResponse.ok) throw new Error("Error descargando video");
        buffer = Buffer.from(await videoResponse.arrayBuffer());
        originalMimeType = req.body.mimeType || "video/mp4";
      } else {
        return res.status(400).json({ error: "No se encontró video" });
      }

      const tempDir = os.tmpdir();
      const inputPath = path.join(tempDir, `in_${Date.now()}${path.extname(originalMimeType) || ".mp4"}`);
      const audioPath = path.join(tempDir, `out_${Date.now()}.mp3`);
      
      await writeFile(inputPath, buffer);
      tempFiles.push(inputPath);

      // Decisión inteligente: Si es video, extraemos audio para ahorrar tiempo de subida a la File API
      let finalPath = inputPath;
      let finalMimeType = originalMimeType;

      if (originalMimeType.startsWith("video/")) {
        console.log("Extrayendo audio para optimizar procesamiento...");
        try {
          await extractAudio(inputPath, audioPath);
          finalPath = audioPath;
          finalMimeType = "audio/mp3";
          tempFiles.push(audioPath);
        } catch (e) {
          console.warn("Fallo FFmpeg, usando video original.");
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
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // O gemini-2.0-flash si prefieres

      const prompt = req.body.prompt || "Transcribe el audio de este video de forma literal y profesional.";
      
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
