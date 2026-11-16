import { Suspense } from "react";
import { pb, type List } from "@/lib/pb";
import { fechaHora, verTelefono } from "@/lib/wa";

const LATIDO_MAX_MS = 3 * 60 * 1000;

type Latido = { estado: string; linea: string; latido: string };

/** Franja roja por cada número cuyo bot perdió la conexión con WhatsApp o dejó de dar señal (caído). */
async function AvisoConexion() {
  const r = await pb<List<Latido>>("collections/wa_latido/records?perPage=20&sort=linea").catch(() => null);
  const problemas = (r?.items ?? [])
    .map((l) => {
      const caido = Date.now() - new Date(l.latido.replace(" ", "T")).getTime() > LATIDO_MAX_MS;
      return { ...l, caido };
    })
    .filter((l) => l.caido || l.estado !== "conectado");
  if (!problemas.length) return null;
  return (
    <div className="mb-5 space-y-2">
      {problemas.map((l) => (
        <div key={l.linea} role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <strong>{l.caido ? "El bot no responde" : l.estado === "colgado" ? "El motor de envíos está detenido" : "WhatsApp está desconectado"}</strong>
          {" "}({verTelefono(l.linea)}). {l.caido ? "Última señal" : "Sin conexión desde"} {fechaHora(l.latido)}. No se envían campañas ni se
          contestan mensajes de ese número hasta que vuelva. Si pasa un rato y sigue así, hay que revisar el servidor o volver a vincular el número.
        </div>
      ))}
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
