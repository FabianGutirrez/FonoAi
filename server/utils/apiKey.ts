export function getApiKey(): string | undefined {
  const keySources = [
    { name: "GEMINI_API_KEY", value: process.env.GEMINI_API_KEY },
    { name: "API_KEY", value: process.env.API_KEY },
    { name: "VITE_GEMINI_API_KEY", value: process.env.VITE_GEMINI_API_KEY },
    { name: "GOOGLE_API_KEY", value: process.env.GOOGLE_API_KEY }
  ];
  
  for (const source of keySources) {
    if (source.value && typeof source.value === "string") {
      const trimmed = source.value.trim();
      if (trimmed !== "" && trimmed !== "undefined" && trimmed !== "null" && trimmed !== "placeholder") {
        console.log(`[getApiKey] Cargando API Key desde la variable de entorno: ${source.name}`);
        return trimmed;
      }
    }
  }
  return undefined;
}
