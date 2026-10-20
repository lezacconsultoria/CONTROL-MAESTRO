"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { diaAR } from "@/lib/fecha";
import { SLUG_RE, slugify, esEditable, type Articulo } from "@/lib/blog";
import {
  borrarArticuloRemoto,
  exigirSesion,
  guardarArticuloRemoto,
  leerArticulo,
  subirImagenRemota,
} from "@/lib/github";

export type EstadoArticuloForm = { error: string | null };
export type EstadoImagen = { error: string | null; url?: string };

const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const hoy = () => diaAR(new Date().toISOString());

export async function guardarArticulo(_: EstadoArticuloForm, form: FormData): Promise<EstadoArticuloForm> {
  try {
    await exigirSesion();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const slug = texto(form, "slug");
  const nuevo = form.get("nuevo") === "1";
  const accion = texto(form, "accion") === "publicado" ? "publicado" : "borrador";
  const h1 = texto(form, "h1");
  const description = texto(form, "description");
  const subtitle = texto(form, "subtitle");
  const category = texto(form, "category");
  const date = texto(form, "date");
  const body = String(form.get("body") ?? "").replace(/\r\n/g, "\n").trim();
  const cover = texto(form, "cover");

  if (!SLUG_RE.test(slug) || slug.length > 80) return { error: "La dirección (slug) solo admite minúsculas, números y guiones." };
  if (!h1 || h1.length > 120) return { error: "Poné un título de hasta 120 caracteres." };
  if (description.length < 50 || description.length > 170)
    return { error: `La descripción para Google tiene que medir entre 50 y 170 caracteres (ahora ${description.length}).` };
  if (subtitle.length > 220) return { error: "La bajada es demasiado larga (máximo 220)." };
  if (category.length > 40) return { error: "La categoría es demasiado larga." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "La fecha no es válida." };
  if (accion === "publicado" && body.length < 200) return { error: "Para publicar, el texto tiene que tener al menos 200 caracteres." };
  if (cover && !/^\/blog\/img\/[a-z0-9._-]+$/.test(cover)) return { error: "La portada no es válida." };

  try {
    const actual = await leerArticulo(slug);
    if (nuevo && actual) return { error: "Ya existe un artículo con esa dirección. Cambiá el título o la dirección." };
    if (!nuevo && !actual) return { error: "No encuentro el artículo para actualizarlo." };
    if (actual && !esEditable(actual.articulo)) return { error: "Este artículo tiene un diseño propio y no se edita desde acá." };

    const publicadoAntes = actual?.articulo.status !== "borrador" && Boolean(actual);
    const articulo: Articulo = {
      slug,
      h1,
      description,
      category: category || "Inteligencia comercial",
      date,
      status: accion,
      body,
      toc: form.get("toc") === "on",
      ...(subtitle ? { subtitle } : {}),
      ...(cover ? { cover } : {}),
      ...(publicadoAntes && accion === "publicado" ? { updated: hoy() } : {}),
    };
    await guardarArticuloRemoto(articulo, actual?.sha, `blog: ${accion === "publicado" ? "publicar" : "guardar borrador"} ${slug}`);
  } catch (e) {
    return { error: (e as Error).message };
  }

  revalidatePath("/blog", "layout");
  redirect(`/blog/editor?slug=${slug}&listo=${accion}`);
}

export async function borrarArticulo(form: FormData) {
  await exigirSesion();
  const slug = texto(form, "slug");
  if (!SLUG_RE.test(slug)) throw new Error("Artículo inválido.");
  const actual = await leerArticulo(slug);
  if (!actual) redirect("/blog");
  if (!esEditable(actual.articulo)) throw new Error("Este artículo tiene un diseño propio y no se borra desde acá.");
  await borrarArticuloRemoto(slug, actual.sha, `blog: borrar ${slug}`);
  revalidatePath("/blog", "layout");
  redirect("/blog?borrado=1");
}

const TIPOS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
const MAX_IMAGEN = 4 * 1024 * 1024;

export async function subirImagen(form: FormData): Promise<EstadoImagen> {
  try {
    await exigirSesion();
    const f = form.get("archivo");
    if (!(f instanceof File) || f.size === 0) return { error: "Elegí una imagen." };
    const ext = TIPOS[f.type];
    if (!ext) return { error: "Solo se admiten imágenes JPG, PNG, WebP o GIF." };
    if (f.size > MAX_IMAGEN) return { error: "La imagen pesa más de 4 MB. Comprimila antes de subirla." };
    const base = slugify(f.name.replace(/\.[^.]+$/, "")) || "imagen";
    const nombre = `${Date.now().toString(36)}-${base}.${ext}`;
    await subirImagenRemota(nombre, Buffer.from(await f.arrayBuffer()));
    return { error: null, url: `/blog/img/${nombre}` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
