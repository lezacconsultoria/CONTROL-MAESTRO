// Tipos y reglas del módulo Blog (se usan tanto en el servidor como en el formulario).

export type EstadoArticulo = "borrador" | "publicado";

// Un artículo es un JSON en el repo del sitio (tools/articulos/<slug>.json). Los creados desde acá
// llevan el texto en `body` (Markdown). Los que traen `blocks` tienen un diseño propio y no se editan desde acá.
export type Articulo = {
  slug: string;
  h1: string;
  description: string;
  category?: string;
  subtitle?: string;
  date: string; // YYYY-MM-DD
  updated?: string;
  status?: EstadoArticulo;
  body?: string;
  toc?: boolean;
  cover?: string;
  blocks?: unknown;
};

export type ArticuloRemoto = { articulo: Articulo; sha: string };

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const CATEGORIAS = [
  "Inteligencia comercial",
  "Dirección comercial",
  "Clientes y cobertura",
  "Ventas y equipos",
  "IA y automatización",
  "WhatsApp",
];

export function slugify(t: string) {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
}

export const esEditable = (a: Articulo) => !a.blocks;

export const URL_SITIO = "https://lezacconsultoria.com";
