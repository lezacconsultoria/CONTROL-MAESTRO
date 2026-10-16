"use server";

import { redirect } from "next/navigation";
import { PB_URL, pb, pbWrite, type Cuenta, type SocialPost } from "@/lib/pb";
import { desdeInputLocal } from "@/lib/fecha";

type Estado = { error: string | null };

// n8n espera hasta la hora programada y vuelve a validar el post; solo recibe el id.
async function avisarPublicador(id: string) {
  const res = await fetch(process.env.N8N_PUBLICAR_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Webhook-Secret": process.env.N8N_WEBHOOK_SECRET! },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error(`Se guardó el post pero no se pudo avisar al publicador (${res.status}).`);
}

export async function guardarPost(_: Estado, form: FormData): Promise<Estado> {
  const id = String(form.get("id") ?? "");
  const tipo = String(form.get("tipo"));
  const accion = String(form.get("accion")); // borrador | programar
  const caption = String(form.get("caption") ?? "").trim();
  const hashtags = String(form.get("hashtags") ?? "").trim();
  const cuando = String(form.get("programado_en") ?? "");
  const archivos = form.getAll("media").filter((f): f is File => f instanceof File && f.size > 0);
  const previos = Number(form.get("media_previos") ?? 0);
  const nMedia = archivos.length || previos;

  const cuentaId = String(form.get("cuenta") ?? "");
  const cuenta = await pb<Cuenta>(`collections/social_cuentas/records/${encodeURIComponent(cuentaId)}`);
  const linkedin = cuenta.plataforma === "linkedin";
  const maxCaption = linkedin ? 3000 : 2200;
  if ((caption + " " + hashtags).trim().length > maxCaption) return { error: `El texto supera los ${maxCaption} caracteres.` };
  if (!linkedin && hashtags.split(/\s+/).filter((h) => h.startsWith("#")).length > 30) return { error: "Máximo 30 hashtags." };
  if (linkedin && tipo !== "texto") return { error: "Por ahora LinkedIn solo admite posts de texto o enlace." };
  if (linkedin && archivos.length) return { error: "LinkedIn todavía no admite archivos adjuntos desde la app." };
  if (linkedin && !caption) return { error: "Escribí el texto del post." };

  if (tipo === "imagen" || tipo === "carrusel") {
    if (archivos.some((f) => f.type === "image/png")) {
      return { error: "Instagram solo acepta imágenes JPEG. Convertí el PNG a JPG." };
    }
  }

  if (accion === "programar") {
    if (!cuando) return { error: "Elegí fecha y hora para programar." };
    if (new Date(desdeInputLocal(cuando)) < new Date()) return { error: "La fecha de publicación ya pasó." };
    if (!linkedin && nMedia === 0) return { error: "Subí al menos un archivo para programar." };
    if (tipo === "carrusel" && (nMedia < 2 || nMedia > 10)) return { error: "Un carrusel necesita entre 2 y 10 archivos." };
    if (tipo !== "carrusel" && tipo !== "texto" && nMedia > 1) return { error: "Este formato admite un solo archivo." };
  }

  const body = new FormData();
  body.set("tipo", tipo);
  body.set("caption", caption);
  body.set("hashtags", hashtags);
  body.set("pilar", String(form.get("pilar") ?? "").trim());
  body.set("titulo", caption.split("\n")[0].slice(0, 80));
  body.set("estado", accion === "programar" ? "programado" : "borrador");
  body.set("programado_en", accion === "programar" && cuando ? desdeInputLocal(cuando) : "");
  body.set("error", "");
  body.set("cuenta", cuenta.id);
  archivos.forEach((f) => body.append("media", f));

  try {
    const r = await (id
      ? pbWrite("PATCH", `collections/social_posts/records/${id}`, body)
      : pbWrite("POST", "collections/social_posts/records", body));
    if (accion === "programar") await avisarPublicador(r.id);
  } catch (e) {
    return { error: (e as Error).message };
  }
  redirect("/social/calendario");
}

// Archivos de un post importado: n8n pregunta a Instagram y devuelve las direcciones;
// la app los descarga y los guarda todos juntos en el borrador.
async function archivosDeInstagram(externo: string): Promise<{ archivos: { blob: Blob; nombre: string }[]; aviso?: string }> {
  try {
    const r = await fetch(process.env.N8N_MEDIA_URL!, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Webhook-Secret": process.env.N8N_WEBHOOK_SECRET! },
      body: JSON.stringify({ externo }),
      signal: AbortSignal.timeout(30000),
    });
    const j = (await r.json()) as { ok: boolean; urls?: string[]; error?: string };
    if (!j.ok || !j.urls?.length) return { archivos: [], aviso: j.error ?? "Instagram no entregó el archivo." };
    const archivos = [];
    for (const url of j.urls) {
      const f = await fetch(url, { signal: AbortSignal.timeout(90000) });
      if (!f.ok) throw new Error(`descarga ${f.status}`);
      const nombre = new URL(url).pathname.split("/").pop() || "archivo";
      archivos.push({ blob: await f.blob(), nombre });
    }
    return { archivos };
  } catch {
    return { archivos: [], aviso: "No se pudo traer el archivo de Instagram. Subilo de nuevo a mano." };
  }
}

// Reutilizar: clona un post como borrador (copia texto, cuenta y archivos) y abre el editor.
export async function duplicarPost(form: FormData) {
  const origen = String(form.get("id"));
  const p = await pb<SocialPost>(`collections/social_posts/records/${encodeURIComponent(origen)}`);
  const base = () => {
    const body = new FormData();
    body.set("tipo", p.tipo);
    body.set("titulo", p.titulo);
    body.set("caption", p.caption);
    body.set("hashtags", p.hashtags);
    body.set("pilar", p.pilar ?? "");
    body.set("cuenta", p.cuenta);
    body.set("estado", "borrador");
    body.set("origen", p.id);
    return body;
  };

  let archivos: { blob: Blob; nombre: string }[] = [];
  let aviso: string | undefined;
  if (p.media?.length) {
    for (const nombre of p.media) {
      const r = await fetch(`${PB_URL}/api/files/social_posts/${p.id}/${nombre}`);
      if (r.ok) archivos.push({ blob: await r.blob(), nombre });
    }
  } else if (p.externo_id) {
    ({ archivos, aviso } = await archivosDeInstagram(p.externo_id));
  }

  const conArchivos = base();
  archivos.forEach((a) => conArchivos.append("media", a.blob, a.nombre));
  let nuevo;
  try {
    nuevo = await pbWrite("POST", "collections/social_posts/records", conArchivos);
  } catch {
    // Si PocketBase rechaza algún archivo, el borrador se crea igual, sin archivos.
    nuevo = await pbWrite("POST", "collections/social_posts/records", base());
    aviso = "El archivo de Instagram no se pudo guardar. Subilo de nuevo a mano.";
  }
  redirect(`/social/editor?id=${nuevo.id}${aviso ? `&aviso=${encodeURIComponent(aviso)}` : ""}`);
}

export async function eliminarPost(form: FormData) {
  await pbWrite("DELETE", `collections/social_posts/records/${String(form.get("id"))}`);
  redirect("/social/calendario");
}
