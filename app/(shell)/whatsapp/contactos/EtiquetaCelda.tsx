"use client";

import { useRef, useState } from "react";
import { cambiarEtiqueta } from "./actions";

const NUEVA = "__nueva__";
const chico = "rounded-md border border-line bg-surface-2 px-2 py-1 text-xs outline-none focus:border-accent";

/** Etiqueta de un contacto: se elige de la lista (se guarda sola) o se crea una nueva. */
export default function EtiquetaCelda({ id, actual, etiquetas }: { id: string; actual: string; etiquetas: string[] }) {
  const [creando, setCreando] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const opciones = actual && !etiquetas.includes(actual) ? [...etiquetas, actual].sort() : etiquetas;

  return (
    <form ref={form} action={cambiarEtiqueta} className="flex items-center gap-1">
      <input type="hidden" name="id" value={id} />
      {creando ? (
        <>
          <input name="etiqueta" autoFocus required maxLength={60} placeholder="Nueva etiqueta" className={`${chico} w-32`} />
          <button className="rounded-md bg-accent px-2 py-1 text-xs font-semibold text-white">Poner</button>
          <button type="button" onClick={() => setCreando(false)} className="px-1 text-xs text-muted hover:text-ink" aria-label="Cancelar">✕</button>
        </>
      ) : (
        <select
          key={actual}
          name="etiqueta"
          defaultValue={actual}
          aria-label="Etiqueta del contacto"
          onChange={(e) => (e.target.value === NUEVA ? setCreando(true) : form.current?.requestSubmit())}
          className={`${chico} max-w-[11rem]`}
        >
          <option value="">— sin etiqueta —</option>
          {opciones.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
          <option value={NUEVA}>+ Nueva etiqueta…</option>
        </select>
      )}
    </form>
  );
}
