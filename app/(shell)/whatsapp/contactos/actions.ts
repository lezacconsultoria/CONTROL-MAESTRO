"use server";

import { revalidatePath } from "next/cache";
import { pbJson } from "@/lib/pb";
import { apiPb } from "@/lib/pb-api";
import { normEtiqueta } from "@/lib/wa";
import { guardarContactos, leerContactos } from "@/lib/whatsapp-import";

export type EstadoImportacion = { error: string | null; ok?: string; detalle?: string[] };

const MAX_MB = 10;
const ID = /^[a-z0-9]{15}$/;

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export async function importarContactos(_: EstadoImportacion, form: FormData): Promise<EstadoImportacion> {
  const archivo = form.get("archivo");
  const etiqueta = normEtiqueta(String(form.get("etiqueta") ?? "").slice(0, 60));
  if (!(archivo instanceof File) || archivo.size === 0) return { error: "Elegí el Excel o CSV con los contactos." };
  if (!/\.(xlsx|xls|csv)$/i.test(archivo.name)) return { error: "El archivo tiene que ser .xlsx, .xls o .csv." };
  if (archivo.size > MAX_MB * 1048576) return { error: `El archivo pesa más de ${MAX_MB} MB.` };

  try {
    const filas = leerContactos(await archivo.arrayBuffer());
    if (!filas.length) return { error: "El archivo no tiene filas con datos." };
    if (!etiqueta && filas.every((f) => !f.etiqueta)) {
      return { error: "Poné una etiqueta para estos contactos (o usá una columna «Etiqueta» en el archivo). Sin etiqueta, ninguna campaña los va a encontrar." };
    }
    const r = await guardarContactos(filas, { campana: "", etiqueta, origen: "excel" }, apiPb);
    revalidatePath("/whatsapp", "layout");

    const detalle: string[] = [];
    if (r.repetidos) detalle.push(`${plural(r.repetidos, "fila repetida en el archivo", "filas repetidas en el archivo")} (se juntaron).`);
    if (r.invalidos.length) {
      detalle.push(
        `${plural(r.invalidos.length, "fila sin un celular argentino válido", "filas sin un celular argentino válido")}, no se importaron: ${r.invalidos.slice(0, 8).join(", ")}${r.invalidos.length > 8 ? "…" : ""}`,
      );
    }
    return {
      error: null,
      ok: `Listo: ${plural(r.nuevos, "contacto nuevo", "contactos nuevos")} y ${plural(r.actualizados, "actualizado", "actualizados")} (los que ya existían conservan su estado y su etiqueta).`,
      detalle,
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

function idDe(form: FormData) {
  const id = String(form.get("id") ?? "");
  if (!ID.test(id)) throw new Error("Contacto inválido.");
  return id;
}

export async function cambiarAgente(form: FormData) {
  const id = idDe(form);
  await pbJson("PATCH", `collections/wa_contactos/records/${id}`, { agente_activo: form.get("activo") === "1" });
  revalidatePath("/whatsapp", "layout");
}

export async function marcarNoContactar(form: FormData) {
  const id = idDe(form);
  // Deja de recibir la secuencia y el agente deja de escribirle.
  await pbJson("PATCH", `collections/wa_contactos/records/${id}`, { estado: "no_contactar", agente_activo: false, proximo_envio: "" });
  revalidatePath("/whatsapp", "layout");
}

export async function reactivarContacto(form: FormData) {
  const id = idDe(form);
  await pbJson("PATCH", `collections/wa_contactos/records/${id}`, { estado: "nuevo", paso: 0 });
  revalidatePath("/whatsapp", "layout");
}
