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

export type List<T> = { items: T[]; totalItems: number };

export type Cuenta = {
  id: string;
  plataforma: "instagram" | "linkedin";
  handle: string;
  autor_urn: string;
};

export type SocialPost = {
  id: string;
  cuenta: string;
  tipo: "imagen" | "carrusel" | "reel" | "texto";
  titulo: string;
  caption: string;
  hashtags: string;
  pilar: string;
  portada: string;
  media: string[];
  estado: "idea" | "borrador" | "programado" | "publicando" | "publicado" | "error";
  programado_en: string;
  error: string;
  publicado_en: string;
  externo_id: string;
  permalink: string;
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
