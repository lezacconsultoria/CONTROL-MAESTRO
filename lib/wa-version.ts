import "server-only";
import { pb, type List } from "./pb";

/**
 * Huella de lo último que hay en WhatsApp: si cambia, hay mensajes nuevos o algún contacto cambió
 * (estado, último mensaje, altas y bajas). Son dos consultas mínimas de una sola fila y un solo campo,
 * así que sirve para preguntar cada pocos segundos sin cargar PocketBase.
 */
export async function versionWhatsapp() {
  const [m, c] = await Promise.all([
    pb<List<{ created: string }>>("collections/wa_mensajes/records?perPage=1&sort=-created&fields=created"),
    pb<List<{ updated: string }>>("collections/wa_contactos/records?perPage=1&sort=-updated&fields=updated"),
  ]);
  return `${m.totalItems}|${m.items[0]?.created ?? ""}|${c.totalItems}|${c.items[0]?.updated ?? ""}`;
}
