import { Suspense } from "react";
import { pb, type List, type WaConfig } from "@/lib/pb";
import { fechaHora, verTelefono } from "@/lib/wa";

const LATIDO_MAX_MS = 3 * 60 * 1000;

/** Franja roja si el bot perdió la conexión con WhatsApp o dejó de dar señal (caído). */
async function AvisoConexion() {
  const r = await pb<List<WaConfig>>("collections/wa_config/records?perPage=1&fields=conexion_estado,conexion_linea,conexion_latido").catch(() => null);
  const c = r?.items[0];
  if (!c?.conexion_latido) return null; // todavía no hay datos (motor sin actualizar)
  const caido = Date.now() - new Date(c.conexion_latido.replace(" ", "T")).getTime() > LATIDO_MAX_MS;
  if (!caido && c.conexion_estado === "conectado") return null;
  const numero = c.conexion_linea ? ` (${verTelefono(c.conexion_linea)})` : "";
  return (
    <div role="alert" className="mb-5 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
      <strong>{caido ? "El bot no responde" : "WhatsApp está desconectado"}</strong>
      {numero}. {caido ? "Última señal" : "Sin conexión desde"} {fechaHora(c.conexion_latido)}. No se envían campañas ni se contestan mensajes hasta que vuelva.
      Si pasa un rato y sigue así, hay que revisar el servidor o volver a vincular el número.
    </div>
  );
}

export default function WhatsappLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <AvisoConexion />
      </Suspense>
      {children}
    </>
  );
}
