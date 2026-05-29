import express from "express";
import path from "path";
import cors from "cors";

// Importar rutas modularizadas
import transcribeRouter from "./server/routes/transcribe.js";
import analyzeRouter from "./server/routes/analyze.js";

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);

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
  const isProd = process.env.NODE_ENV === "production" || process.env.K_SERVICE || !process.env.NODE_ENV;

  function serveStaticProduction(expressApp: express.Express) {
    const distPath = path.join(process.cwd(), "dist");
    expressApp.use(express.static(distPath));
    expressApp.get(/.*/, (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (!isProd) {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.warn("[Vite Middleware Warning] No se pudo cargar Vite de desarrollo. Utilizando estáticos de producción:", e);
      serveStaticProduction(app);
    }
  } else {
    serveStaticProduction(app);
  }

  // Escuchar únicamente en el puerto si no es Vercel sin servidor
  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[Clinica Server] Servidor iniciado satisfactoriamente en http://localhost:${PORT}`);
    });
  }
  return app;
}

const appPromise = startServer();

export default appPromise;