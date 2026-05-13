import express from "express";
import cors from "cors";
import multer from "multer";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();

const upload = multer({ 
  limits: { fileSize: 400 * 1024 * 1024 }, // 400MB
  storage: multer.memoryStorage() 
});

app.use(cors());
app.use(express.json());

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", environment: "vercel" });
});

// Transcription Endpoint
app.post("/api/transcribe", (req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    upload.single("video")(req, res, next);
  } else {
    next();
  }
}, async (req: any, res: any) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.GOOGLE_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ 
        error: "GEMINI_API_KEY no configurada.",
        details: "Asegúrate de añadir GEMINI_API_KEY en las Environment Variables de Vercel."
      });
    }

    console.log("Servidor: Iniciando proceso de transcripción");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
    });

    const transcriptionPrompt = req.body.prompt || "Transcribe este video exactamente.";
    let videoPart;

    if (req.file) {
      console.log("Servidor: Procesando archivo directo (Multer)");
      videoPart = {
        inlineData: {
          data: req.file.buffer.toString("base64"),
          mimeType: req.file.mimetype || "video/mp4"
        }
      };
    } else if (req.body.videoUrl) {
      console.log("Servidor: Intentando descargar desde URL:", req.body.videoUrl);
      try {
        const fetchResponse = await fetch(req.body.videoUrl);
        if (!fetchResponse.ok) {
           const fetchErrorText = await fetchResponse.text();
           throw new Error(`Error descargando de Storage (Status ${fetchResponse.status}): ${fetchErrorText}`);
        }
        
        const arrayBuffer = await fetchResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        console.log(`Servidor: Video descargado exitosamente. Tamaño: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

        videoPart = {
          inlineData: {
            data: buffer.toString("base64"),
            mimeType: req.body.mimeType || "video/mp4"
          }
        };
      } catch (downloadError) {
        console.error("Error crítico al descargar video de URL:", downloadError);
        return res.status(400).json({ 
          error: "Error al descargar el video desde Firebase Storage.",
          details: downloadError instanceof Error ? downloadError.message : String(downloadError)
        });
      }
    } else {
      console.error("Servidor: No se detectó ni archivo ni URL.");
      return res.status(400).json({ 
        error: "No se proporcionó video de forma procesable por el servidor.",
        debug: { has_body: !!req.body, body_keys: Object.keys(req.body) }
      });
    }

    console.log("Servidor: Enviando a Gemini...");
    try {
      const result = await model.generateContent([
        transcriptionPrompt,
        videoPart
      ]);
      const response = await result.response;
      const text = response.text();
      console.log("Servidor: Respuesta recibida de Gemini.");
      return res.json({ text });
    } catch (geminiError: any) {
      console.error("Error directo de Gemini API:", geminiError);
      return res.status(400).json({ 
        error: "Error en la API de Gemini",
        details: geminiError?.message || String(geminiError)
      });
    }
  } catch (error) {
    console.error("Error inesperado en /api/transcribe:", error);
    res.status(500).json({ 
      error: "Fallo interno en el servidor",
      details: error instanceof Error ? error.message : String(error)
    });
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

export default app;