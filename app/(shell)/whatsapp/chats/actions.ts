"use server";

import { revalidatePath } from "next/cache";
import { pb, type WaContacto } from "@/lib/pb";
import { enviarPorHermes } from "@/lib/hermes";

export type EstadoEnvio = { error: string | null };

const ID = /^[a-z0-9]{15}$/;
const MAX_TEXTO = 4000;

/** Envía por WhatsApp un mensaje escrito a mano. El motor lo guarda como «Humano» y pausa el agente en ese chat. */
export async function enviarMensaje(_: EstadoEnvio, form: FormData): Promise<EstadoEnvio> {
  const id = String(form.get("contacto") ?? "");
  const texto = String(form.get("texto") ?? "").trim();
  if (!ID.test(id)) return { error: "Contacto inválido." };
  if (!texto) return { error: "Escribí un mensaje." };
  if (texto.length > MAX_TEXTO) return { error: `El mensaje supera los ${MAX_TEXTO} caracteres.` };

  try {
    const contacto = await pb<WaContacto>(`collections/wa_contactos/records/${id}`);
    await enviarPorHermes(contacto.telefono, texto);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/whatsapp", "layout");
  return { error: null };
}
