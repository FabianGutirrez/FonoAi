import express from "express";
import path from "path";
import cors from "cors";

// Importar rutas modularizadas
import transcribeRouter from "./server/routes/transcribe.js";
import analyzeRouter from "./server/routes/analyze.js";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(cors());
  app.use(express.json({ limit: "50mb" }));

  // Endpoint de Salud
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Integrar routers modularizados
  app.use(transcribeRouter);
  app.use(analyzeRouter);

  // Servidor de desarrollo integrado de Vite vs estáticos en producción
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get(".*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Escuchar únicamente en el puerto si no es Vercel sin servidor
  if (!process.env.VERCEL) {
    const PORT = Number(process.env.PORT) || 3000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[Clinica Server] Servidor iniciado satisfactoriamente en http://localhost:${PORT}`);
    });
  }
  return app;
}

const appPromise = startServer();

export default appPromise;
