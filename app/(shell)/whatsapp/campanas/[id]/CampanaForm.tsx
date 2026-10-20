"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { eliminarCampana, guardarCampana } from "../actions";
import Cargando from "@/components/Cargando";
import { ESTADO_CAMPANA, VARIABLES, rellenar } from "@/lib/wa";

export type CampanaEditable = {
  id: string;
  nombre: string;
  etiqueta: string;
  estado: string;
  mensaje_1: string;
  mensaje_2: string;
  mensaje_3: string;
  espera_horas_2: number;
  espera_horas_3: number;
  espera_cierre_horas: number;
};

const campo =
  "w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent";
const EJEMPLO = { nombre: "Juan", empresa: "Distribuidora Norte" };

export default function CampanaForm({ campana, contactos }: { campana: CampanaEditable; contactos: number }) {
  const [res, action, pending] = useActionState(guardarCampana, { error: null });
  const [textos, setTextos] = useState([campana.mensaje_1, campana.mensaje_2, campana.mensaje_3]);
  const areas = useRef<(HTMLTextAreaElement | null)[]>([]);
  const ultimo = useRef(0); // último mensaje donde estuvo el cursor

  const cambiar = (i: number, v: string) => setTextos((t) => t.map((x, k) => (k === i ? v : x)));

  const insertar = (variable: string) => {
    const i = ultimo.current;
    const el = areas.current[i];
    const marca = `{${variable}}`;
    if (!el) return cambiar(i, textos[i] + marca);
    const ini = el.selectionStart ?? textos[i].length;
    const fin = el.selectionEnd ?? ini;
    cambiar(i, textos[i].slice(0, ini) + marca + textos[i].slice(fin));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(ini + marca.length, ini + marca.length);
    });
  };

  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_320px]">
      <form action={action} className="space-y-5">
        <input type="hidden" name="id" value={campana.id} />

        <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Nombre</span>
            <input name="nombre" required maxLength={120} defaultValue={campana.nombre} placeholder="Ej: Distribuidoras de Cuyo – octubre" className={campo} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Etiqueta</span>
            <input name="etiqueta" defaultValue={campana.etiqueta} placeholder="Ej: distribuidoras" className={campo} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Estado</span>
            <select name="estado" defaultValue={campana.estado} className={campo}>
              {Object.entries(ESTADO_CAMPANA).map(([k, e]) => (
                <option key={k} value={k}>{e.nombre}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>Variables (se reemplazan por los datos de cada contacto):</span>
          {VARIABLES.map((v) => (
            <button key={v} type="button" onClick={() => insertar(v)}
              className="rounded-md bg-surface-2 px-2.5 py-1 font-mono text-xs text-ink hover:text-accent">
              {`{${v}}`}
            </button>
          ))}
          <span>· se insertan en el mensaje donde tengas el cursor</span>
        </div>

        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-lg border border-line bg-surface p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold">Mensaje {i + 1}</span>
              <span className={`text-xs ${textos[i].length > 1000 ? "text-red-400" : "text-muted"}`}>{textos[i].length}/1000</span>
            </div>
            <textarea
              ref={(el) => { areas.current[i] = el; }}
              name={`mensaje_${i + 1}`}
              rows={i === 0 ? 5 : 4}
              value={textos[i]}
              onFocus={() => { ultimo.current = i; }}
              onChange={(e) => cambiar(i, e.target.value)}
              placeholder={i === 0 ? "Hola {nombre}, soy Leandro de Lezac Consultoría…" : i === 1 ? "Mensaje de seguimiento si no responde (opcional)" : "Último intento (opcional)"}
              className={campo}
            />
            {i > 0 && (
              <label className="mt-3 flex items-center gap-2 text-xs text-muted">
                Esperar
                <input type="number" name={`espera_horas_${i + 1}`} min={0} max={1440}
                  defaultValue={i === 1 ? campana.espera_horas_2 : campana.espera_horas_3}
                  className="w-20 rounded-md border border-line bg-surface-2 px-2 py-1 text-sm text-ink outline-none focus:border-accent" />
                horas después del mensaje {i} para enviar este
              </label>
            )}
          </div>
        ))}

        <label className="flex items-center gap-2 text-sm text-muted">
          Cerrar la secuencia (pasa a «sin respuesta»)
          <input type="number" name="espera_cierre_horas" min={0} max={1440} defaultValue={campana.espera_cierre_horas}
            className="w-20 rounded-md border border-line bg-surface-2 px-2 py-1 text-sm text-ink outline-none focus:border-accent" />
          horas después del último mensaje
        </label>

        {res.error && <p className="text-sm text-red-400">{res.error}</p>}
        {pending && <Cargando texto="Guardando la campaña…" />}

        <div className="flex items-center gap-3">
          <button disabled={pending} className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {pending ? "Guardando…" : "Guardar campaña"}
          </button>
          <Link href="/whatsapp/campanas" className="text-sm text-muted hover:text-ink">Cancelar</Link>
        </div>
      </form>

      <aside className="space-y-4">
        <div className="rounded-xl border border-line bg-surface p-3">
          <p className="mb-3 text-xs uppercase tracking-wide text-muted">Así lo ve «{EJEMPLO.nombre}» ({EJEMPLO.empresa})</p>
          <div className="space-y-2">
            {textos.map((t, i) =>
              t.trim() ? (
                <div key={i} className="ml-6 rounded-lg rounded-tr-none bg-[#0f3d2e] px-3 py-2 text-sm">
                  <p className="whitespace-pre-line">{rellenar(t, EJEMPLO)}</p>
                  <p className="mt-1 text-right text-[10px] text-muted">Mensaje {i + 1}</p>
                </div>
              ) : null,
            )}
            {textos.every((t) => !t.trim()) && <p className="text-xs text-muted">Escribí un mensaje para ver la vista previa.</p>}
          </div>
        </div>

        {campana.id && (
          <form action={eliminarCampana} className="rounded-lg border border-line p-3 text-sm">
            <input type="hidden" name="id" value={campana.id} />
            {contactos > 0 ? (
              <p className="text-xs text-muted">Tiene {contactos} contactos asignados, por eso no se puede eliminar. Podés terminarla.</p>
            ) : (
              <button className="text-red-400 hover:underline">Eliminar campaña</button>
            )}
          </form>
        )}
      </aside>
    </div>
  );
}
