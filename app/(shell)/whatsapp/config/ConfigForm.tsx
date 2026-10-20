"use client";

import { useActionState } from "react";
import { guardarConfig } from "./actions";
import Cargando from "@/components/Cargando";
import { DIAS_SEMANA } from "@/lib/wa";
import type { WaConfig } from "@/lib/pb";

const campo =
  "w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent";

export default function ConfigForm({ config }: { config: WaConfig }) {
  const [res, action, pending] = useActionState(guardarConfig, { error: null });

  return (
    <form action={action} className="max-w-2xl space-y-6">
      <input type="hidden" name="id" value={config.id} />

      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface p-4">
        <input type="checkbox" name="activo" defaultChecked={config.activo} className="mt-1 h-4 w-4 accent-[var(--accent)]" />
        <span>
          <span className="block text-sm font-semibold">Envíos activos</span>
          <span className="block text-xs text-muted">
            Es el interruptor general: con esto apagado, ninguna campaña envía mensajes aunque esté activa.
          </span>
        </span>
      </label>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">Cuándo enviar</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Desde (hora, 0-23)</span>
            <input type="number" name="hora_desde" min={0} max={23} defaultValue={config.hora_desde} className={campo} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Hasta (hora, 1-24)</span>
            <input type="number" name="hora_hasta" min={1} max={24} defaultValue={config.hora_hasta} className={campo} />
          </label>
        </div>
        <p className="mt-2 text-xs text-muted">Horario de Argentina.</p>

        <fieldset className="mt-4">
          <legend className="mb-2 text-sm text-muted">Días</legend>
          <div className="flex flex-wrap gap-2">
            {DIAS_SEMANA.map((d) => (
              <label key={d.n} className="cursor-pointer">
                <input type="checkbox" name="dias" value={d.n} defaultChecked={config.dias?.includes(d.n)} className="peer sr-only" />
                <span className="block rounded-md border border-line bg-surface-2 px-3 py-1.5 text-sm text-muted peer-checked:border-accent peer-checked:bg-accent/15 peer-checked:text-ink peer-focus-visible:ring-2 peer-focus-visible:ring-accent">
                  {d.nombre}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">Ritmo</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Tope diario (mensajes)</span>
            <input type="number" name="tope_diario" min={1} max={1000} defaultValue={config.tope_diario} className={campo} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Espera mínima (seg)</span>
            <input type="number" name="intervalo_min_seg" min={0} defaultValue={config.intervalo_min_seg} className={campo} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Espera máxima (seg)</span>
            <input type="number" name="intervalo_max_seg" min={0} defaultValue={config.intervalo_max_seg} className={campo} />
          </label>
        </div>
        <p className="mt-2 text-xs text-muted">Entre un mensaje y el siguiente se espera un tiempo al azar entre el mínimo y el máximo.</p>
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">Aviso</h2>
        <label className="mt-3 block text-sm">
          <span className="mb-1 block text-muted">Número al que avisar cuando alguien responde</span>
          <input name="aviso_numero" defaultValue={config.aviso_numero} placeholder="5491155551234" className={campo} />
        </label>
      </section>

      {res.error && <p className="text-sm text-red-400">{res.error}</p>}
      {res.ok && !pending && <p className="text-sm text-[#25f5a4]">Configuración guardada.</p>}
      {pending && <Cargando texto="Guardando la configuración…" />}

      <button disabled={pending} className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? "Guardando…" : "Guardar configuración"}
      </button>
    </form>
  );
}
