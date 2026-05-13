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
app.post("/api/transcribe", upload.single("video"), async (req: any, res: any) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.GOOGLE_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ 
        error: "GEMINI_API_KEY no configurada.",
        details: "Asegúrate de añadir GEMINI_API_KEY en las Environment Variables de Vercel."
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No se subió ningún archivo de video." });
    }
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const transcriptionPrompt = req.body.prompt || "Transcribe este video exactamente.";

    const videoPart = {
      inlineData: {
        data: req.file.buffer.toString("base64"),
        mimeType: req.file.mimetype
      }
    };

    const result = await model.generateContent([transcriptionPrompt, videoPart]);
    const response = await result.response;
    const text = response.text();

    res.json({ text });
  } catch (error) {
    console.error("Error en la transcripción:", error);
    res.status(400).json({ 
      error: "Fallo en la comunicación con Gemini",
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
