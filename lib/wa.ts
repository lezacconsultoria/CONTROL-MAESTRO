import { diaAR, horaAR } from "./fecha";

// Textos y colores compartidos por las pantallas del módulo Bots WhatsApp.

export const ESTADO_CONTACTO: Record<string, { nombre: string; clase: string }> = {
  nuevo: { nombre: "Nuevo", clase: "bg-surface-2 text-muted" },
  en_secuencia: { nombre: "En secuencia", clase: "bg-[#38bdf8]/20 text-[#38bdf8]" },
  respondio: { nombre: "Respondió", clase: "bg-[#25f5a4]/15 text-[#25f5a4]" },
  sin_respuesta: { nombre: "Sin respuesta", clase: "bg-[#f5c842]/20 text-[#f5c842]" },
  no_contactar: { nombre: "No contactar", clase: "bg-red-500/20 text-red-300" },
  entrante: { nombre: "Entrante", clase: "bg-accent/20 text-accent" },
};

export const ESTADO_CAMPANA: Record<string, { nombre: string; clase: string }> = {
  borrador: { nombre: "Borrador", clase: "bg-surface-2 text-muted" },
  activa: { nombre: "Activa", clase: "bg-[#25f5a4]/15 text-[#25f5a4]" },
  pausada: { nombre: "Pausada", clase: "bg-[#f5c842]/20 text-[#f5c842]" },
  terminada: { nombre: "Terminada", clase: "bg-surface-2 text-muted" },
};

export const AUTOR: Record<string, string> = {
  contacto: "Contacto",
  agente: "Agente",
  campana: "Campaña",
  humano: "Humano",
};

// 1 = lunes … 7 = domingo (numeración ISO).
export const DIAS_SEMANA = [
  { n: 1, nombre: "Lun" },
  { n: 2, nombre: "Mar" },
  { n: 3, nombre: "Mié" },
  { n: 4, nombre: "Jue" },
  { n: 5, nombre: "Vie" },
  { n: 6, nombre: "Sáb" },
  { n: 7, nombre: "Dom" },
];

export const VARIABLES = ["nombre", "empresa"] as const;

/** Reemplaza {nombre} y {empresa}; lo que falte queda vacío. */
export function rellenar(texto: string, datos: { nombre?: string; empresa?: string }) {
  return texto.replace(/\{(nombre|empresa)\}/g, (_, k: "nombre" | "empresa") => datos[k] ?? "");
}

/** Variables entre llaves que no existen (para avisar antes de guardar). */
export function variablesDesconocidas(texto: string) {
  return [...texto.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1]).filter((v) => !(VARIABLES as readonly string[]).includes(v));
}

/** "20/10 14:30" en hora Argentina; vacío si no hay fecha. */
export function fechaHora(iso?: string) {
  if (!iso) return "";
  const [, m, d] = diaAR(iso).split("-");
  return `${d}/${m} ${horaAR(iso)}`;
}

/** 5491155551234 → +54 9 1155551234 */
export function verTelefono(t: string) {
  return /^549\d{10}$/.test(t) ? `+54 9 ${t.slice(3)}` : t;
}

/** Comillas y barras para usar un texto dentro de un filtro de PocketBase. */
export const escapar = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
