import type { Language } from "./prefs";

export function speechLocale(language: Language): string {
  return { english: "en-IN", hinglish: "hi-IN", hindi: "hi-IN", marathi: "mr-IN" }[language];
}

export function browserVoiceOptions(voices: SpeechSynthesisVoice[]) {
  return [
    { id: "browser:auto", provider: "browser" as const, name: "Device voice (automatic)", locale: "", labels: { accent: "System default" } },
    ...voices.map((voice) => ({
      id: `browser:${voice.voiceURI}`,
      provider: "browser" as const,
      name: voice.name,
      locale: voice.lang,
      labels: { accent: voice.lang, ...(voice.default ? { gender: "device default" } : {}) },
    })),
  ];
}

export async function availableBrowserVoices(synth: SpeechSynthesis, timeoutMs = 1200): Promise<SpeechSynthesisVoice[]> {
  const current = synth.getVoices();
  if (current.length) return current;

  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout>;
    const finish = () => {
      clearTimeout(timer);
      synth.removeEventListener("voiceschanged", finish);
      resolve(synth.getVoices());
    };
    synth.addEventListener("voiceschanged", finish);
    timer = setTimeout(finish, timeoutMs);
  });
}

export function selectBrowserVoice(voices: SpeechSynthesisVoice[], locale: string, requestedId?: string) {
  const requestedUri = requestedId?.startsWith("browser:") && requestedId !== "browser:auto"
    ? requestedId.slice("browser:".length)
    : "";
  if (requestedUri) {
    const requested = voices.find((voice) => voice.voiceURI === requestedUri);
    if (requested) return requested;
  }

  const normalized = locale.toLowerCase();
  const exact = voices.find((voice) => voice.lang.toLowerCase() === normalized);
  if (exact) return exact;

  const base = normalized.split("-")[0];
  return voices.find((voice) => voice.lang.toLowerCase().startsWith(`${base}-`)) ?? voices.find((voice) => voice.default);
}
