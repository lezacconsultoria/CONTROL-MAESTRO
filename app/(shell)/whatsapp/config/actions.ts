"use server";

import { revalidatePath } from "next/cache";
import { pbJson } from "@/lib/pb";
import { normalizarTelefono } from "@/lib/whatsapp-import";

export type EstadoConfig = { error: string | null; ok?: boolean };

const entero = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return /^\d+$/.test(s) ? Number(s) : null;
};

export async function guardarConfig(_: EstadoConfig, form: FormData): Promise<EstadoConfig> {
  const id = String(form.get("id") ?? "");
  if (!/^[a-z0-9]{15}$/.test(id)) return { error: "Configuración inválida." };

  const desde = entero(form.get("hora_desde"));
  const hasta = entero(form.get("hora_hasta"));
  const tope = entero(form.get("tope_diario"));
  const min = entero(form.get("intervalo_min_seg"));
  const max = entero(form.get("intervalo_max_seg"));
  const dias = [...new Set(form.getAll("dias").map(Number))].filter((d) => Number.isInteger(d) && d >= 1 && d <= 7).sort();

  if (desde === null || desde > 23) return { error: "«Desde» es una hora entera entre 0 y 23." };
  if (hasta === null || hasta < 1 || hasta > 24) return { error: "«Hasta» es una hora entera entre 1 y 24." };
  if (hasta <= desde) return { error: "«Hasta» tiene que ser posterior a «Desde»." };
  if (!dias.length) return { error: "Elegí al menos un día de envío." };
  if (tope === null || tope < 1 || tope > 1000) return { error: "El tope diario es un número entre 1 y 1000." };
  if (min === null || max === null) return { error: "Los intervalos son segundos enteros." };
  if (max < min) return { error: "El intervalo máximo no puede ser menor que el mínimo." };

  let aviso = String(form.get("aviso_numero") ?? "").trim();
  if (aviso) {
    const n = normalizarTelefono(aviso);
    if (!n) return { error: "El número de aviso no parece un celular argentino (ej: 5491155551234)." };
    aviso = n;
  }

  try {
    await pbJson("PATCH", `collections/wa_config/records/${id}`, {
      activo: form.get("activo") === "on",
      aviso_numero: aviso,
      hora_desde: desde,
      hora_hasta: hasta,
      dias,
      tope_diario: tope,
      intervalo_min_seg: min,
      intervalo_max_seg: max,
    });
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/whatsapp", "layout");
  return { error: null, ok: true };
}
