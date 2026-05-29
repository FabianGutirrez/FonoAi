import { GoogleGenAI } from "@google/genai";
import { getApiKey } from "../utils/apiKey";

export function getGeminiClient(): GoogleGenAI {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("No se detectó una clave API válida para Gemini en el servidor.");
  }
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

export async function uploadToGoogleAI(filePath: string, mimeType: string) {
  const ai = getGeminiClient();
  console.log(`Subiendo archivo de audio/video a Google AI con MimeType: ${mimeType}`);
  return await ai.files.upload({
    file: filePath,
    mimeType: mimeType,
  });
}

export async function waitForFileActive(fileName: string): Promise<boolean> {
  const ai = getGeminiClient();
  let fileState = await ai.files.get({ name: fileName });
  let attempts = 0;
  while (fileState.state === "PROCESSING" && attempts < 20) {
    process.stdout.write(".");
    await new Promise(r => setTimeout(r, 3000));
    fileState = await ai.files.get({ name: fileName });
    attempts++;
  }
  return fileState.state === "ACTIVE";
}

export async function deleteFileFromGoogleAI(fileName: string): Promise<void> {
  try {
    const ai = getGeminiClient();
    await ai.files.delete({ name: fileName });
    console.log(`Logró eliminar archivo temporal en Google AI: ${fileName}`);
  } catch (err) {
    console.warn(`No se pudo eliminar el archivo ${fileName} de Google AI:`, err);
  }
}
