
import express from "express";
import path from "path";
import cors from "cors";
import multer from "multer";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Configure Multer for video uploads
  const upload = multer({ 
    limits: { fileSize: 400 * 1024 * 1024 }, // 400MB
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
  app.post("/api/transcribe", upload.single("video"), async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      
      if (!apiKey || apiKey === "undefined" || apiKey === "null" || apiKey === "") {
        return res.status(500).json({ 
          error: "Clave de API (GEMINI_API_KEY) no encontrada.",
          details: "ERROR: El servidor no tiene acceso a la clave. SOLUCIÓN: Pulsa en 'Share' -> 'Publish' para desplegar los Secretos correctamente."
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
