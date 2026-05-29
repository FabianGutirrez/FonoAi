import { Router } from "express";
import { getGeminiClient } from "../services/gemini.js";
import { getApiKey } from "../utils/apiKey.js";

const router = Router();

router.post("/api/analyze", async (req, res) => {
  try {
    const apiKey = getApiKey();
    if (!apiKey) {
      return res.status(500).json({ 
        error: "Clave de API no configurada en el servidor.",
        details: "No se encontró un GEMINI_API_KEY válido en las variables de entorno del servidor. Por favor, configúrelo en Settings > Secrets."
      });
    }

    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Falta el prompt de análisis." });
    }

    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    const text = response.text || "";
    return res.json({ text });
  } catch (err) {
    const error = err as Error;
    console.error("Error en el análisis clínico:", error);
    return res.status(400).json({ 
      error: "Error generando el análisis clínico",
      details: error.message || String(error)
    });
  }
});

export default router;
