// Todo el sistema muestra hora de Argentina (UTC-3, sin horario de verano).
const AR_MS = 3 * 60 * 60 * 1000;

/** ISO/UTC de PocketBase → "YYYY-MM-DDTHH:mm" para <input type="datetime-local"> */
export function aInputLocal(iso?: string) {
  if (!iso) return "";
  return new Date(new Date(iso.replace(" ", "T")).getTime() - AR_MS).toISOString().slice(0, 16);
}

/** "YYYY-MM-DDTHH:mm" (hora Argentina) → ISO UTC */
export function desdeInputLocal(s: string) {
  return new Date(`${s}:00-03:00`).toISOString();
}

/** Clave de día "YYYY-MM-DD" en hora Argentina */
export function diaAR(iso: string) {
  return new Date(new Date(iso.replace(" ", "T")).getTime() - AR_MS).toISOString().slice(0, 10);
}

export function horaAR(iso: string) {
  return new Date(new Date(iso.replace(" ", "T")).getTime() - AR_MS).toISOString().slice(11, 16);
}
