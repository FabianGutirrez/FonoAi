import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { execSync } from "child_process";
import { Readable } from "stream";

let isFfmpegAvailable: boolean | null = null;

export function checkIfFfmpegAvailable(): boolean {
  if (process.env.VERCEL) {
    console.log("[Vercel Detectado] Omitiendo FFmpeg por limites de plataforma.");
    return false;
  }
  if (isFfmpegAvailable !== null) {
    return isFfmpegAvailable;
  }

  try {
    // 1. Intentar detectar si el comando ffmpeg del sistema está disponible y funciona
    execSync("ffmpeg -version", { stdio: "ignore" });
    console.log("[INFO] FFmpeg del sistema detectado y funcionando correctamente.");
    isFfmpegAvailable = true;
  } catch (e) {
    console.log("[INFO] FFmpeg del sistema no disponible en PATH. Probando ffmpeg-static...");
    if (ffmpegPath) {
      try {
        // 2. Probar si el binario estático funciona (evita SIGSEGV en entornos incompatibles)
        execSync(`"${ffmpegPath}" -version`, { stdio: "ignore" });
        console.log("[INFO] FFmpeg estático verificado y activo.");
        ffmpeg.setFfmpegPath(ffmpegPath);
        isFfmpegAvailable = true;
      } catch (err) {
        console.error("[AVISO] El binario de ffmpeg-static falló la prueba de ejecución (posiblemente SIGSEGV). Se desactivará la transcodificación de audio local para evitar bloqueos.");
        isFfmpegAvailable = false;
      }
    } else {
      isFfmpegAvailable = false;
    }
  }
  return isFfmpegAvailable;
}

export async function extractAudio(inputSource: string | Readable, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let command = ffmpeg(inputSource);
    
    command
      .toFormat("mp3")
      .audioCodec("libmp3lame")
      .audioBitrate("192k")
      .audioFrequency(24000)
      .audioChannels(1)
      .on("start", (cmd) => console.log("FFmpeg para extracion de audio iniciado:", cmd))
      .on("end", () => resolve())
      .on("error", (err) => {
        console.error("Error ejecutando FFmpeg:", err);
        reject(err);
      })
      .save(outputPath);
  });
}
