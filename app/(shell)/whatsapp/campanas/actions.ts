"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { pb, pbJson, type List, type WaCampana, type WaPaso } from "@/lib/pb";
import { MAX_FICHA, MAX_MENSAJES_PASO, MAX_PASOS, MAX_TEXTO, escapar, normEtiqueta, pasosDe, variablesDesconocidas } from "@/lib/wa";

export type EstadoCampana = { error: string | null };

const ID = /^[a-z0-9]{15}$/;
const ESTADOS = ["borrador", "activa", "pausada", "terminada"];

/** Por qué esta campaña no se puede activar (o null si se puede): necesita una etiqueta y no puede repetirla con otra activa. */
async function problemaDeActivacion(id: string, etiqueta: string): Promise<string | null> {
  if (!etiqueta) {
    // Campañas viejas con contactos asignados a mano pueden activarse sin etiqueta.
    const asignados = id
      ? await pb<List<{ id: string }>>(`collections/wa_contactos/records?perPage=1&filter=${encodeURIComponent(`campana="${id}"`)}`)
      : null;
    return asignados && asignados.totalItems > 0 ? null : "Para activar la campaña elegí a qué etiqueta se le envía, o dejala en borrador.";
  }
  const filtro = `estado="activa" && etiqueta="${escapar(etiqueta)}"${id ? ` && id!="${id}"` : ""}`;
  const otras = await pb<List<{ id: string; nombre: string }>>(
    `collections/wa_campanas/records?perPage=1&fields=id,nombre&filter=${encodeURIComponent(filtro)}`,
  );
  return otras.items.length
    ? `Ya hay otra campaña activa para la etiqueta «${etiqueta}»: «${otras.items[0].nombre}». Pausala o elegí otra etiqueta.`
    : null;
}

/** Lee y valida los pasos que manda el formulario (JSON). Devuelve los pasos o un mensaje de error. */
function leerPasos(crudo: FormDataEntryValue | null): { pasos: WaPaso[] } | { error: string } {
  let datos: unknown;
  try {
    datos = JSON.parse(String(crudo ?? "[]"));
  } catch {
    return { error: "No pude leer los pasos de la campaña. Recargá la página e intentá de nuevo." };
  }
  if (!Array.isArray(datos)) return { error: "Los pasos de la campaña no son válidos." };
  if (datos.length > MAX_PASOS) return { error: `Una campaña puede tener hasta ${MAX_PASOS} pasos.` };

  const pasos: WaPaso[] = [];
  for (const [i, p] of datos.entries()) {
    const n = i + 1;
    const espera = Number(p?.espera_horas ?? 0);
    if (!Number.isInteger(espera) || espera < 0 || espera > 24 * 60) return { error: `La espera del paso ${n} son horas enteras (0 o más).` };
    if (!Array.isArray(p?.mensajes)) return { error: `El paso ${n} no es válido.` };
    if (p.mensajes.length > MAX_MENSAJES_PASO) return { error: `El paso ${n} puede tener hasta ${MAX_MENSAJES_PASO} mensajes seguidos.` };
    const mensajes: string[] = [];
    for (const [k, m] of p.mensajes.entries()) {
      const t = String(m ?? "").trim();
      if (!t) continue;
      const etiqueta = `El mensaje ${k + 1} del paso ${n}`;
      if (t.length > MAX_TEXTO) return { error: `${etiqueta} supera los ${MAX_TEXTO} caracteres.` };
      const raras = variablesDesconocidas(t);
      if (raras.length) return { error: `${etiqueta} usa {${raras[0]}}, que no existe. Las variables son {nombre} y {empresa}.` };
      mensajes.push(t);
    }
    if (mensajes.length === 0) continue; // paso vacío: se descarta
    pasos.push({ espera_horas: pasos.length === 0 ? 0 : espera, mensajes });
  }
  return { pasos };
}

const horas = (v: FormDataEntryValue | null) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 24 * 60 ? n : null;
};

export async function guardarCampana(_: EstadoCampana, form: FormData): Promise<EstadoCampana> {
  const id = String(form.get("id") ?? "");
  if (id && !ID.test(id)) return { error: "Campaña inválida." };

  const nombre = String(form.get("nombre") ?? "").trim();
  const etiqueta = normEtiqueta(String(form.get("etiqueta") ?? ""));
  const estado = String(form.get("estado") ?? "borrador");
  const cierre = horas(form.get("espera_cierre_horas"));
  const leidos = leerPasos(form.get("pasos"));
  const modo = String(form.get("modo_respuesta") ?? "avisar");
  const ficha = String(form.get("ficha") ?? "").trim();

  if (!nombre) return { error: "Poné un nombre para la campaña." };
  if (nombre.length > 120) return { error: "El nombre es demasiado largo." };
  if (!ESTADOS.includes(estado)) return { error: "Estado inválido." };
  if (cierre === null) return { error: "La espera para cerrar son horas enteras (0 o más)." };
  if ("error" in leidos) return { error: leidos.error };
  if (modo !== "avisar" && modo !== "agente") return { error: "Elegí qué pasa cuando responden." };
  if (ficha.length > MAX_FICHA) return { error: `La ficha supera los ${MAX_FICHA} caracteres.` };
  if (modo === "agente" && !ficha) return { error: "Para que el agente responda, escribí la ficha de la campaña: sin ella no sabría qué contestar." };
  if (leidos.pasos.length === 0 && estado === "activa") return { error: "Para activar la campaña escribí al menos un mensaje en el paso 1." };
  if (estado === "activa") {
    const problema = await problemaDeActivacion(id, etiqueta);
    if (problema) return { error: problema };
  }

  // Los campos del formato anterior (mensaje_1..3) se vacían: desde acá la campaña vive en `pasos`.
  const datos = {
    nombre,
    etiqueta,
    estado,
    pasos: leidos.pasos,
    modo_respuesta: modo,
    ficha,
    mensaje_1: "",
    mensaje_2: "",
    mensaje_3: "",
    espera_horas_2: 0,
    espera_horas_3: 0,
    espera_cierre_horas: cierre,
  };
  try {
    await (id ? pbJson("PATCH", `collections/wa_campanas/records/${id}`, datos) : pbJson("POST", "collections/wa_campanas/records", datos));
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/whatsapp", "layout");
  redirect("/whatsapp/campanas");
}

export async function cambiarEstadoCampana(form: FormData) {
  const id = String(form.get("id") ?? "");
  const estado = String(form.get("estado") ?? "");
  if (!ID.test(id) || !ESTADOS.includes(estado)) throw new Error("Datos inválidos.");
  if (estado === "activa") {
    const c = await pb<WaCampana>(`collections/wa_campanas/records/${id}`);
    if (pasosDe(c).length === 0) throw new Error("La campaña no tiene mensajes: completala antes de activarla.");
    const problema = await problemaDeActivacion(id, normEtiqueta(c.etiqueta ?? ""));
    if (problema) throw new Error(problema);
  }
  await pbJson("PATCH", `collections/wa_campanas/records/${id}`, { estado });
  revalidatePath("/whatsapp", "layout");
}

export async function eliminarCampana(form: FormData) {
  const id = String(form.get("id") ?? "");
  if (!ID.test(id)) throw new Error("Campaña inválida.");
  const usados = await pb<List<{ id: string }>>(`collections/wa_contactos/records?perPage=1&filter=${encodeURIComponent(`campana="${id}"`)}`);
  if (usados.totalItems > 0) throw new Error("La campaña tiene contactos asignados: no se puede eliminar.");
  await pbJson("DELETE", `collections/wa_campanas/records/${id}`);
  revalidatePath("/whatsapp", "layout");
  redirect("/whatsapp/campanas");
}
