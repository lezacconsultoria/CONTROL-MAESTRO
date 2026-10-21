"use client";

import { useState } from "react";
import { ponerEtiquetaVarios } from "./actions";

const NUEVA = "__nueva__";
const campo = "rounded-md border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent";

/** Marca o desmarca todos los contactos de la tabla. */
export function SeleccionarTodos() {
  return (
    <input
      type="checkbox"
      aria-label="Seleccionar todos los contactos de la página"
      onChange={(e) => {
        document.querySelectorAll<HTMLInputElement>('input[name="ids"][form="masivo"]').forEach((c) => (c.checked = e.target.checked));
      }}
    />
  );
}

/** Pone (o quita) una etiqueta a todos los contactos marcados en la tabla. */
export default function AccionesMasivas({ etiquetas }: { etiquetas: string[] }) {
  const [creando, setCreando] = useState(false);

  return (
    <form id="masivo" action={ponerEtiquetaVarios} className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface p-3">
      <span className="text-xs text-muted">Con los contactos que marques en la tabla:</span>
      {creando ? (
        <>
          <input name="etiqueta" autoFocus required maxLength={60} placeholder="Nombre de la nueva etiqueta" className={`${campo} w-56`} />
          <button type="button" onClick={() => setCreando(false)} className="text-xs text-muted hover:text-ink">Elegir una existente</button>
        </>
      ) : (
        <select name="etiqueta" defaultValue="" onChange={(e) => e.target.value === NUEVA && setCreando(true)} className={campo}>
          <option value="">— quitarles la etiqueta —</option>
          {etiquetas.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
          <option value={NUEVA}>+ Nueva etiqueta…</option>
        </select>
      )}
      <button className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white">Aplicar a los marcados</button>
    </form>
  );
}
