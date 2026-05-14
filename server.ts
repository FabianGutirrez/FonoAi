
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
import { createServer as createViteServer } from "vite";
import { buffer } from "stream/consumers";

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
      .audioBitrate("128k")
      .audioChannels(1) // Mono for smaller size
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .save(outputPath);
  });
}



async function startServer() {
  const app = express();
  const PORT = 3000;

  // Configure Multer for video uploads
  const upload = multer({ 
    limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB
    storage: multer.memoryStorage() 
  });

  app.use(cors());
  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Diagnostics Endpoint (Safe)
  app.get("/api/diagnostics", (req, res) => {
    // List all env keys to see what the platform provides
    const keys = Object.keys(process.env);
    
    const mask = (keyName: string) => {
      const val = process.env[keyName];
      if (!val) return "missing";
      if (val === "undefined" || val === "null" || val === "") return "empty-or-string-null";
      if (val.length < 10) return "too-short";
      return `${val.substring(0, 4)}...${val.substring(val.length - 4)}`;
    };

    res.json({
      keys_detected: keys.filter(k => k.includes("API") || k.includes("KEY") || k.includes("GEMINI") || k.includes("GOOGLE")),
      masked_values: {
        GEMINI_API_KEY: mask("GEMINI_API_KEY"),
        API_KEY: mask("API_KEY"),
        VITE_GEMINI_API_KEY: mask("VITE_GEMINI_API_KEY"),
        GOOGLE_API_KEY: mask("GOOGLE_API_KEY")
      },
      node_env: process.env.NODE_ENV,
      instruction: "Si GEMINI_API_KEY aparece como 'missing', por favor haz clic en 'Share' -> 'Publish' para sincronizar los Secretos de AI Studio."
    });
  });

  // Transcription Endpoint
  app.post("/api/transcribe", (req, res, next) => {
    // Si es multipart, usamos multer. Si no, seguimos (express.json() ya parseó el body)
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
      upload.single("video")(req, res, next);
    } else {
      next();
    }
  }, async (req, res) => {
    try {
      console.log("Petición recibida en /api/transcribe");
      console.log("Content-Type:", req.headers['content-type']);
      console.log("¿req.file existe?:", !!req.file);
      console.log("Campos en req.body:", Object.keys(req.body));

      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      
      if (!apiKey || apiKey === "undefined" || apiKey === "null" || apiKey === "") {
        return res.status(500).json({ 
          error: "Clave de API (GEMINI_API_KEY) no encontrada.",
        });
      }

      let videoPart;
      const transcriptionPrompt = req.body.prompt || "Transcribe este video exactamente.";

      let buffer: Buffer;
      let originalMimeType = "string";  

      if (req.file) {
        console.log("Caso 1: Multer (archivo directo)");
        buffer = req.file.buffer;
        originalMimeType = req.file.mimetype;
      } else if (req.body.videoUrl) {
      
        console.log("Caso 2: URL de Storage:", req.body.videoUrl);
        const videoResponse = await fetch(req.body.videoUrl);
        if (!videoResponse.ok) {
          throw new Error(`Error al descargar video de Storage (${videoResponse.status}): ${videoResponse.statusText}`);
        }
        
        buffer = Buffer.from(await videoResponse.arrayBuffer());
        originalMimeType = req.body.mimeType || "video/mp4"; // Asumimos MP4 si no se proporciona
      } else {
        console.error("Error: Ni archivo ni URL detectados en la petición.");
        return res.status(400).json({ 
          error: "No se subió ningún archivo de video ni se proporcionó una URL.",
          debug: {
            has_body: !!req.body,
            body_keys: Object.keys(req.body),
            content_type: req.headers['content-type']
          }
        });
      }

      // OPTIMIZACIÓN: Si es un video, extraemos solo el audio para reducir drásticamente el tamaño
      if (originalMimeType.startsWith("video/")) {
        console.log("Optimizando video para transcripción: Extrayendo audio...");
        const tempDir = os.tmpdir();
        const inputId = `input_${Date.now()}`;
        const outputId = `output_${Date.now()}`;
        const inputPath = path.join(tempDir, `${inputId}${path.extname(originalMimeType) || ".mp4"}`);
        const outputPath = path.join(tempDir, `${outputId}.mp3`);

        try {
          await writeFile(inputPath, buffer);
          await extractAudio(inputPath, outputPath);
          const audioBuffer = await readFile(outputPath);
          
          console.log(`Audio extraído exitosamente. Reducción de tamaño: ${(buffer.length / 1024 / 1024).toFixed(2)}MB -> ${(audioBuffer.length / 1024 / 1024).toFixed(2)}MB`);
          
          videoPart = {
            inlineData: {
              data: audioBuffer.toString("base64"),
              mimeType: "audio/mp3"
            }
          };
        } catch (ffmpegError) {
          console.error("Error al procesar video con FFmpeg (usando video original como fallback):", ffmpegError);
          videoPart = {
            inlineData: {
              data: buffer.toString("base64"),
              mimeType: originalMimeType
            }
          };
        } finally {
          // Limpiar archivos temporales
          try {
            if (fs.existsSync(inputPath)) await unlink(inputPath);
            if (fs.existsSync(outputPath)) await unlink(outputPath);
          } catch (cleanupError) {
            console.error("Error limpiando temporales:", cleanupError);
          }
        }
      } else {
        // No es video, lo enviamos tal cual (imagen o audio directo)
        videoPart = {
          inlineData: {
            data: buffer.toString("base64"),
            mimeType: originalMimeType
          }
        };
      }
      
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      console.log("Enviando a Gemini para transcripción...");
      const result = await model.generateContent([transcriptionPrompt, videoPart]);
      const response = await result.response;
      const text = response.text();

      res.json({ text });
    } catch (error) {
      console.error("Error en la transcripción:", error);
      res.status(400).json({ 
        error: "Fallo en la comunicación con la IA",
        details: error instanceof Error ? error.message : String(error)
      });
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
