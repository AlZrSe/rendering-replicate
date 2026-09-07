import { format, formatDistanceToNowStrict, parseISO } from "date-fns";

export const fmtDate = (iso?: string) => (iso ? format(parseISO(iso), "MMM d, HH:mm:ss") : "—");

export const fmtAgo = (iso?: string) =>
  iso ? `${formatDistanceToNowStrict(parseISO(iso))} ago` : "—";

export const fmtTime = (iso: string) => format(parseISO(iso), "HH:mm");

export function fmtDuration(startIso?: string, endIso?: string) {
  if (!startIso) return "—";
  const start = parseISO(startIso).getTime();
  const end = endIso ? parseISO(endIso).getTime() : Date.now();
  let s = Math.max(0, Math.round((end - start) / 1000));
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  return h ? `${h}h ${m}m` : m ? `${m}m ${s}s` : `${s}s`;
}

export const fmtGb = (mb: number) => `${(mb / 1024).toFixed(1)} GB`;

export function toYaml(value: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    if (!value.length) return "[]";
    return value.map((v) => `${pad}- ${String(v)}`).join("\n");
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([, v]) => v !== undefined && v !== "" && !(typeof v === "object" && v !== null && !Array.isArray(v) && Object.keys(v as object).length === 0),
    );
    return entries
      .map(([k, v]) => {
        if (v !== null && typeof v === "object") {
          const nested = toYaml(v, indent + 1);
          return nested ? `${pad}${k}:\n${nested}` : `${pad}${k}: {}`;
        }
        const needsQuote = typeof v === "string" && /[:#]|^\s|\s$/.test(v);
        return `${pad}${k}: ${needsQuote ? JSON.stringify(v) : String(v)}`;
      })
      .join("\n");
  }
  return `${pad}${String(value)}`;
}
