import { pb, type List, type WaConfig } from "@/lib/pb";
import ConfigForm from "./ConfigForm";

export default async function Config() {
  const r = await pb<List<WaConfig>>("collections/wa_config/records?perPage=1");
  const config = r.items[0];

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Configuración</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Reglas generales del envío de mensajes.</p>
      {config ? (
        <ConfigForm config={config} />
      ) : (
        <p className="rounded-lg border border-dashed border-line p-8 text-sm text-muted">
          No encuentro la fila de configuración (colección wa_config). Tiene que existir una sola fila.
        </p>
      )}
    </div>
  );
}
