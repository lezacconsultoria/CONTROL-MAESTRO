import { diaAR, horaAR } from "./fecha";
import type { WaPaso } from "./pb";

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

/** Las etiquetas se guardan en minúscula y sin espacios sobrantes, así «Distribuidoras» y «distribuidoras» son la misma. */
export const normEtiqueta = (s: string) => s.trim().toLowerCase();

export const MAX_PASOS = 6;
export const MAX_MENSAJES_PASO = 4;
export const MAX_TEXTO = 1000;

/** Pasos de una campaña (acepta el formato anterior de 3 mensajes fijos). Se descartan los mensajes vacíos. */
export function pasosDe(c: {
  pasos?: WaPaso[] | null;
  mensaje_1?: string;
  mensaje_2?: string;
  mensaje_3?: string;
  espera_horas_2?: number;
  espera_horas_3?: number;
}): WaPaso[] {
  if (Array.isArray(c.pasos) && c.pasos.length) {
    return c.pasos
      .map((p) => ({ espera_horas: Number(p.espera_horas) || 0, mensajes: (p.mensajes ?? []).filter((m) => m.trim()) }))
      .filter((p) => p.mensajes.length);
  }
  return [
    { espera_horas: 0, mensajes: [c.mensaje_1 ?? ""] },
    { espera_horas: c.espera_horas_2 ?? 0, mensajes: [c.mensaje_2 ?? ""] },
    { espera_horas: c.espera_horas_3 ?? 0, mensajes: [c.mensaje_3 ?? ""] },
  ].filter((p) => p.mensajes[0].trim());
}

export type Enlace = { texto: string; completo: boolean };

const URL_COMPLETA = /https?:\/\/[^\s<>"']+/gi;
const DOMINIO_SUELTO = /(?<![\w@/.-])(?:www\.[^\s<>"']+|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|ar|net|org|io|co|app|me|ly|link|info|biz)(?:\/[^\s<>"']*)?)/gi;

/**
 * Enlaces de un texto. «completo» = empieza con http:// o https://, que es lo que WhatsApp convierte
 * siempre en enlace clickeable (y con vista previa si la página la tiene). Un dominio suelto
 * (www.sitio.com) puede quedar como texto plano.
 */
export function enlacesDe(texto: string): Enlace[] {
  const completos = [...texto.matchAll(URL_COMPLETA)].map((m) => m[0].replace(/[.,;:!?)]+$/, ""));
  const resto = texto.replace(URL_COMPLETA, " ");
  const sueltos = [...resto.matchAll(DOMINIO_SUELTO)].map((m) => m[0].replace(/[.,;:!?)]+$/, ""));
  return [...completos.map((t) => ({ texto: t, completo: true })), ...sueltos.map((t) => ({ texto: t, completo: false }))];
}

/** Parte un texto en tramos normales y enlaces (completos o sueltos) para mostrarlo resaltado. */
export function partesConEnlaces(texto: string): { texto: string; tipo: "texto" | "enlace" | "suelto" }[] {
  const re = new RegExp(`${URL_COMPLETA.source}|${DOMINIO_SUELTO.source}`, "gi");
  const partes: { texto: string; tipo: "texto" | "enlace" | "suelto" }[] = [];
  let desde = 0;
  for (const m of texto.matchAll(re)) {
    const inicio = m.index ?? 0;
    const t = m[0].replace(/[.,;:!?)]+$/, "");
    if (inicio > desde) partes.push({ texto: texto.slice(desde, inicio), tipo: "texto" });
    partes.push({ texto: t, tipo: /^https?:\/\//i.test(t) ? "enlace" : "suelto" });
    desde = inicio + t.length;
  }
  if (desde < texto.length) partes.push({ texto: texto.slice(desde), tipo: "texto" });
  return partes;
}

/** Comillas y barras para usar un texto dentro de un filtro de PocketBase. */
export const escapar = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
