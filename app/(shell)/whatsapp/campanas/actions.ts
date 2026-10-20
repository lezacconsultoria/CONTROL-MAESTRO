"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { pb, pbJson, type List } from "@/lib/pb";
import { variablesDesconocidas } from "@/lib/wa";

export type EstadoCampana = { error: string | null };

const ID = /^[a-z0-9]{15}$/;
const ESTADOS = ["borrador", "activa", "pausada", "terminada"];
const MAX_TEXTO = 1000;

const horas = (v: FormDataEntryValue | null) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 24 * 60 ? n : null;
};

export async function guardarCampana(_: EstadoCampana, form: FormData): Promise<EstadoCampana> {
  const id = String(form.get("id") ?? "");
  if (id && !ID.test(id)) return { error: "Campaña inválida." };

  const nombre = String(form.get("nombre") ?? "").trim();
  const etiqueta = String(form.get("etiqueta") ?? "").trim();
  const estado = String(form.get("estado") ?? "borrador");
  const mensajes = [1, 2, 3].map((n) => String(form.get(`mensaje_${n}`) ?? "").trim());
  const espera2 = horas(form.get("espera_horas_2"));
  const espera3 = horas(form.get("espera_horas_3"));
  const cierre = horas(form.get("espera_cierre_horas"));

  if (!nombre) return { error: "Poné un nombre para la campaña." };
  if (nombre.length > 120) return { error: "El nombre es demasiado largo." };
  if (!ESTADOS.includes(estado)) return { error: "Estado inválido." };
  if (espera2 === null || espera3 === null || cierre === null) return { error: "Las esperas son horas enteras (0 o más)." };
  for (const [i, m] of mensajes.entries()) {
    if (m.length > MAX_TEXTO) return { error: `El mensaje ${i + 1} supera los ${MAX_TEXTO} caracteres.` };
    const raras = variablesDesconocidas(m);
    if (raras.length) return { error: `El mensaje ${i + 1} usa {${raras[0]}}, que no existe. Las variables son {nombre} y {empresa}.` };
  }
  if (!mensajes[0] && estado === "activa") return { error: "Para activar la campaña escribí al menos el mensaje 1." };
  if (mensajes[2] && !mensajes[1]) return { error: "Escribí el mensaje 2 antes del mensaje 3." };

  const datos = {
    nombre,
    etiqueta,
    estado,
    mensaje_1: mensajes[0],
    mensaje_2: mensajes[1],
    mensaje_3: mensajes[2],
    espera_horas_2: espera2,
    espera_horas_3: espera3,
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
    const c = await pb<{ mensaje_1: string }>(`collections/wa_campanas/records/${id}`);
    if (!c.mensaje_1) throw new Error("La campaña no tiene mensaje 1: completala antes de activarla.");
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
