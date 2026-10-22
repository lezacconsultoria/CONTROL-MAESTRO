import "server-only";
import { cookies } from "next/headers";

export const PB_URL = process.env.PB_URL!;
export const COOKIE = "pb_token";

export async function pb<T = unknown>(path: string): Promise<T> {
  const token = (await cookies()).get(COOKIE)?.value ?? "";
  const res = await fetch(`${PB_URL}/api/${path}`, {
    headers: { Authorization: token },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`PocketBase ${res.status} en ${path}`);
  return res.json();
}

export async function pbWrite(method: "POST" | "PATCH" | "DELETE", path: string, body?: FormData) {
  const token = (await cookies()).get(COOKIE)?.value ?? "";
  const res = await fetch(`${PB_URL}/api/${path}`, { method, headers: { Authorization: token }, body });
  if (!res.ok) throw new Error(`PocketBase ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return method === "DELETE" ? null : res.json();
}

export async function pbJson(method: "POST" | "PATCH" | "DELETE", path: string, body?: unknown) {
  const token = (await cookies()).get(COOKIE)?.value ?? "";
  const res = await fetch(`${PB_URL}/api/${path}`, {
    method,
    headers: { Authorization: token, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PocketBase ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return method === "DELETE" ? null : res.json();
}

// Todas las filas de una colección (paginando de a 500).
export async function pbTodos<T = Record<string, unknown>>(coleccion: string, filtro = "", orden = "", campos = ""): Promise<T[]> {
  const out: T[] = [];
  for (let pagina = 1; ; pagina++) {
    const q = new URLSearchParams({ perPage: "500", page: String(pagina) });
    if (filtro) q.set("filter", filtro);
    if (orden) q.set("sort", orden);
    if (campos) q.set("fields", campos);
    const r = await pb<{ items: T[]; totalPages: number }>(`collections/${coleccion}/records?${q}`);
    out.push(...r.items);
    if (pagina >= r.totalPages) return out;
  }
}

export type List<T> = { items: T[]; totalItems: number };

export type Cuenta = {
  id: string;
  plataforma: "instagram" | "linkedin";
  handle: string;
  autor_urn: string;
};

export type SocialPost = {
  id: string;
  expand?: { cuenta?: Cuenta };
  cuenta: string;
  tipo: "imagen" | "carrusel" | "reel" | "texto" | "video" | "documento";
  titulo: string;
  caption: string;
  hashtags: string;
  pilar: string;
  portada: string;
  tapa: string;
  tapa_ms: number;
  media: string[];
  estado: "idea" | "borrador" | "programado" | "publicando" | "publicado" | "error";
  programado_en: string;
  error: string;
  publicado_en: string;
  externo_id: string;
  permalink: string;
};

// ── Bots WhatsApp ──────────────────────────────────────────────
export type WaConfig = {
  id: string;
  activo: boolean;
  aviso_numero: string;
  hora_desde: number;
  hora_hasta: number;
  dias: number[]; // 1 = lunes … 7 = domingo
  tope_diario: number;
  intervalo_min_seg: number;
  intervalo_max_seg: number;
  etiquetas_catalogo?: string; // etiquetas que existen en WhatsApp Business, «|a|b|»
  updated: string;
};

// Un paso de la campaña: se envían sus mensajes uno detrás del otro. espera_horas se ignora en el primero.
export type WaPaso = { espera_horas: number; mensajes: string[] };

export type WaCampana = {
  id: string;
  nombre: string;
  etiqueta: string;
  estado: "borrador" | "activa" | "pausada" | "terminada";
  pasos: WaPaso[] | null;
  modo_respuesta: "" | "avisar" | "agente"; // qué pasa cuando un contacto responde: solo avisar a Leandro, o contesta el agente
  ficha: string; // lo que el agente tiene que saber para contestar esta campaña
  // Formato anterior (3 mensajes fijos): solo se lee si la campaña no tiene `pasos`.
  mensaje_1: string;
  mensaje_2: string;
  mensaje_3: string;
  espera_horas_2: number;
  espera_horas_3: number;
  espera_cierre_horas: number;
  created: string;
  updated: string;
};

export type WaContacto = {
  id: string;
  telefono: string; // formato 549…
  nombre: string;
  empresa: string;
  etiqueta: string;
  etiquetas_wa: string; // etiquetas de WhatsApp Business, «|clientes|campaña1|»: las sincroniza el motor, no se editan acá
  origen: string;
  campana: string;
  estado: "nuevo" | "en_secuencia" | "respondio" | "sin_respuesta" | "no_contactar" | "entrante";
  paso: number; // cantidad de pasos ya enviados (0 = ninguno)
  proximo_envio: string;
  agente_activo: boolean;
  ultimo_mensaje: string;
  created: string;
  updated: string;
  expand?: { campana?: WaCampana };
};

export type WaMensaje = {
  id: string;
  contacto: string;
  direccion: "in" | "out";
  autor: "contacto" | "agente" | "campana" | "humano";
  texto: string;
  wa_id: string;
  media: string;
  created: string;
  expand?: { contacto?: WaContacto };
};

export type IgPost = {
  media_id: string;
  titulo: string;
  tipo: string;
  permalink: string;
  reach: number;
  views: number;
  likes: number;
  saves: number;
  shares: number;
  comments: number;
};

export type Snapshot = {
  fecha: string;
  alcance_28d: number;
  cuentas_interactuaron: number;
  interacciones_totales: number;
  visitas_perfil: number;
  clics_sitio: number;
  guardados_28d: number;
  compartidos_28d: number;
  comentarios_28d: number;
};
