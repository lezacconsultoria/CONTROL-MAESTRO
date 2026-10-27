"use server";

import { redirect } from "next/navigation";
import { PB_URL, pb, pbJson, pbWrite, type Cuenta, type List, type SocialPost } from "@/lib/pb";
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

// Guarda en el historial lo escrito en hashtags y pilar para poder elegirlo la próxima vez.
// Si falla no frena el guardado del post.
async function recordarEnHistorial(pares: [string, string][]) {
  const ahora = new Date().toISOString().replace("T", " ");
  for (const [campo, valor] of pares) {
    if (!valor) continue;
    try {
      const filtro = encodeURIComponent(`campo="${campo}" && valor="${valor.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`);
      const r = await pb<List<{ id: string; usos: number }>>(`collections/social_historial/records?perPage=1&filter=${filtro}`);
      if (r.items[0]) {
        await pbJson("PATCH", `collections/social_historial/records/${r.items[0].id}`, { usos: (r.items[0].usos ?? 0) + 1, ultimo_uso: ahora });
      } else {
        await pbJson("POST", "collections/social_historial/records", { campo, valor, usos: 1, ultimo_uso: ahora });
      }
    } catch {}
  }
}

// LinkedIn solo acepta MP4: un MOV es el mismo contenedor, alcanza con cambiarle el nombre y el tipo.
const aMp4 = (f: File) =>
  f.type === "video/quicktime" || /\.mov$/i.test(f.name) ? new File([f], f.name.replace(/\.mov$/i, ".mp4"), { type: "video/mp4" }) : f;

export async function guardarPost(_: Estado, form: FormData): Promise<Estado> {
  const id = String(form.get("id") ?? "");
  const tipo = String(form.get("tipo"));
  const accion = String(form.get("accion")); // borrador | programar
  const caption = String(form.get("caption") ?? "").trim();
  const hashtags = String(form.get("hashtags") ?? "").trim();
  const pilar = String(form.get("pilar") ?? "").trim();
  const cuando = String(form.get("programado_en") ?? "");
  const archivosOrig = form.getAll("media").filter((f): f is File => f instanceof File && f.size > 0);
  const previos = Number(form.get("media_previos") ?? 0);
  const nMedia = archivosOrig.length || previos;

  // Un post nuevo puede salir en varias cuentas a la vez: se crea un post independiente por cuenta.
  const idsCuentas = [String(form.get("cuenta") ?? ""), ...(id ? [] : form.getAll("cuenta_extra").map(String))].filter(
    (c, i, a) => c && a.indexOf(c) === i,
  );
  const cuentas = await Promise.all(idsCuentas.map((c) => pb<Cuenta>(`collections/social_cuentas/records/${encodeURIComponent(c)}`)));
  if (!cuentas.length) return { error: "Elegí al menos una cuenta." };
  const esLi = (c: Cuenta) => c.plataforma === "linkedin";
  const hayIG = cuentas.some((c) => !esLi(c));
  const hayLI = cuentas.some(esLi);
  if (hayIG && hayLI && tipo !== "imagen" && tipo !== "video") {
    return { error: "Para publicar en Instagram y LinkedIn a la vez elegí Imagen o Video: los otros formatos existen en una sola red." };
  }
  const tipoDe = (c: Cuenta) => (tipo === "video" && !esLi(c) ? "reel" : tipo); // el video de Instagram es un reel
  const archivosDe = (c: Cuenta) => (esLi(c) ? archivosOrig.map(aMp4) : archivosOrig);

  const maxCaption = hayIG ? 2200 : 3000;
  if ((caption + " " + hashtags).trim().length > maxCaption) return { error: `El texto supera los ${maxCaption} caracteres.` };
  if (hayIG && hashtags.split(/\s+/).filter((h) => h.startsWith("#")).length > 30) return { error: "Máximo 30 hashtags." };
  const mimesLi: Record<string, string[]> = {
    imagen: ["image/jpeg", "image/png"],
    video: ["video/mp4"],
    documento: ["application/pdf"],
  };
  const fechaOk = new Date(desdeInputLocal(cuando)) >= new Date();
  for (const c of cuentas) {
    const t = tipoDe(c);
    const linkedin = esLi(c);
    const archivos = archivosDe(c);
    if (linkedin && t !== "texto" && !mimesLi[t]) return { error: "LinkedIn admite texto, imagen, video o documento PDF." };
    if (linkedin && t === "texto" && archivos.length) return { error: "Un post de texto no lleva archivos: cambiá el formato." };
    if (linkedin && t !== "texto" && archivos.some((f) => !mimesLi[t].includes(f.type))) {
      return { error: `Para este formato LinkedIn admite: ${t === "video" ? "video MP4 o MOV" : t === "documento" ? "PDF" : "imagen JPEG o PNG"}.` };
    }
    if (linkedin && nMedia > 1) return { error: "Por ahora LinkedIn admite un solo archivo por post." };
    if (linkedin && !caption) return { error: "Escribí el texto del post." };
    if (!linkedin && (t === "imagen" || t === "carrusel") && archivos.some((f) => f.type === "image/png")) {
      return { error: "Instagram solo acepta imágenes JPEG. Convertí el PNG a JPG." };
    }
    if (accion === "programar") {
      if (!cuando) return { error: "Elegí fecha y hora para programar." };
      if (!fechaOk) return { error: "La fecha de publicación ya pasó." };
      if ((!linkedin || t !== "texto") && nMedia === 0) return { error: "Subí al menos un archivo para programar." };
      if (t === "carrusel" && (nMedia < 2 || nMedia > 10)) return { error: "Un carrusel necesita entre 2 y 10 archivos." };
      if (t !== "carrusel" && nMedia > 1) return { error: "Este formato admite un solo archivo." };
    }
  }

  const tapaEntrada = form.get("tapa");
  const tapa = tapaEntrada instanceof File && tapaEntrada.size > 0 ? tapaEntrada : null;
  if (tapa && cuentas.some((c) => !esLi(c) && tipoDe(c) === "reel")) {
    if (tapa.type !== "image/jpeg") return { error: "La tapa tiene que ser una imagen JPEG." };
    if (tapa.size > 8 * 1048576) return { error: "La tapa supera los 8 MB." };
  }

  const creados: string[] = [];
  const fallos: string[] = [];
  for (const c of cuentas) {
    const t = tipoDe(c);
    const body = new FormData();
    body.set("tipo", t);
    body.set("caption", caption);
    body.set("hashtags", hashtags);
    body.set("pilar", pilar);
    body.set("titulo", caption.split(/\n/)[0].slice(0, 80));
    body.set("estado", accion === "programar" ? "programado" : "borrador");
    body.set("programado_en", accion === "programar" && cuando ? desdeInputLocal(cuando) : "");
    body.set("error", "");
    body.set("cuenta", c.id);
    archivosDe(c).forEach((f) => body.append("media", f));
    if (tapa && t === "reel" && !esLi(c)) body.set("tapa", tapa);
    try {
      const r = await (id
        ? pbWrite("PATCH", `collections/social_posts/records/${id}`, body)
        : pbWrite("POST", "collections/social_posts/records", body));
      if (accion === "programar") await avisarPublicador(r.id);
      creados.push(c.handle);
    } catch (e) {
      fallos.push(`${c.handle}: ${(e as Error).message}`);
    }
  }
  if (creados.length) await recordarEnHistorial([["hashtags", hashtags], ["pilar", pilar]]);
  if (fallos.length) {
    return {
      error: creados.length
        ? `Se creó en ${creados.join(", ")}, pero falló en ${fallos.join("; ")}. Revisá el calendario antes de reintentar para no duplicar.`
        : fallos.join("; "),
    };
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
