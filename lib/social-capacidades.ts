import type { Cuenta } from "./pb";

// Qué se puede y qué no se puede publicar en cada cuenta. Refleja lo que valida el panel (actions.ts del editor) y lo que
// sabe hacer el publicador de n8n; si se amplía uno, hay que actualizar esto para que el editor no prometa de más.

export type Soporte = { ok: boolean; nota: string };

export const FORMATOS = [
  { id: "texto", nombre: "Solo texto / enlace" },
  { id: "imagen", nombre: "Imagen" },
  { id: "carrusel", nombre: "Carrusel" },
  { id: "video", nombre: "Video" },
  { id: "documento", nombre: "Documento PDF" },
] as const;

export type FormatoId = (typeof FORMATOS)[number]["id"];

export const esLinkedin = (c: Cuenta) => c.plataforma === "linkedin";

/** LinkedIn personal o página de empresa, según el identificador del autor. */
export function tipoCuenta(c: Cuenta) {
  if (!esLinkedin(c)) return "Instagram";
  if (c.autor_urn?.includes(":organization:")) return "LinkedIn · empresa";
  if (c.autor_urn?.includes(":person:")) return "LinkedIn · personal";
  return "LinkedIn";
}

const INSTAGRAM: Record<FormatoId, Soporte> = {
  texto: { ok: false, nota: "Instagram no publica solo texto: necesita una imagen o un video." },
  imagen: { ok: true, nota: "1 imagen JPEG (los PNG se convierten solos)." },
  carrusel: { ok: true, nota: "De 2 a 10 archivos." },
  video: { ok: true, nota: "Sale como reel; podés subir una tapa." },
  documento: { ok: false, nota: "Instagram no admite PDF." },
};

const LINKEDIN: Record<FormatoId, Soporte> = {
  texto: { ok: true, nota: "Texto con enlace." },
  imagen: { ok: true, nota: "1 imagen JPEG o PNG." },
  carrusel: { ok: false, nota: "Todavía no está disponible en el panel: LinkedIn lleva un solo archivo por post. Para algo parecido, usá Documento PDF." },
  video: { ok: true, nota: "1 video MP4 (un MOV se convierte solo)." },
  documento: { ok: true, nota: "1 PDF, se ve como carrusel deslizable." },
};

export const soporte = (c: Cuenta, f: FormatoId): Soporte => (esLinkedin(c) ? LINKEDIN : INSTAGRAM)[f];

export const limites = (c: Cuenta) =>
  esLinkedin(c)
    ? "Hasta 3.000 caracteres. Sin tope de hashtags."
    : "Hasta 2.200 caracteres y 30 hashtags.";
