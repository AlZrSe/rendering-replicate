import { useCallback, useEffect, useState } from "react";

export interface Settings {
  token: string;
  apiBaseUrl: string;
  theme: "light" | "dark";
  wsReconnectMs: number;
  pollIntervalMs: number;
}

const KEY = "shc.settings";

export const defaultSettings: Settings = {
  token: "",
  apiBaseUrl: "http://localhost:8000/api/v1",
  theme: "dark",
  wsReconnectMs: 3000,
  pollIntervalMs: 7000,
};

let cache: Settings | null = null;
const listeners = new Set<(s: Settings) => void>();

/** Local cluster or Lovable preview: authorisation is skipped entirely. */
export function isLocalhost() {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "[::1]" ||
    h.endsWith(".local") ||
    h.endsWith(".lovable.app") ||
    h.endsWith(".lovableproject.com")
  );
}

export const LOCAL_TOKEN = "localhost-no-auth";

export function getSettings(): Settings {
  if (cache) return cache;
  if (typeof window === "undefined") return defaultSettings;
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = raw ? { ...defaultSettings, ...(JSON.parse(raw) as Partial<Settings>) } : defaultSettings;
  } catch {
    cache = defaultSettings;
  }
  if (!cache.token && isLocalhost()) cache = { ...cache, token: LOCAL_TOKEN };
  return cache;
}


export function setSettings(patch: Partial<Settings>) {
  const next = { ...getSettings(), ...patch };
  cache = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify(next));
    applyTheme(next.theme);
  }
  listeners.forEach((l) => l(next));
}

export function applyTheme(theme: Settings["theme"]) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

/** Settings hook. Returns defaults during SSR/first paint, then hydrates. */
export function useSettings() {
  const [settings, setState] = useState<Settings>(defaultSettings);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const s = getSettings();
    setState(s);
    applyTheme(s.theme);
    setReady(true);
    const l = (n: Settings) => setState({ ...n });
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);


  const update = useCallback((patch: Partial<Settings>) => setSettings(patch), []);
  return { settings, update, ready };
}
