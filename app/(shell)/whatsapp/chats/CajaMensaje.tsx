"use client";

import { useActionState, useRef, useState } from "react";
import { enviarMensaje, type EstadoEnvio } from "./actions";

// El texto vive en el estado del cliente: las actualizaciones automáticas de la página no lo tocan,
// y si el envío falla se conserva para reintentar.
export default function CajaMensaje({ contactoId }: { contactoId: string }) {
  const [texto, setTexto] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const [res, action, pending] = useActionState(async (previo: EstadoEnvio, datos: FormData) => {
    const r = await enviarMensaje(previo, datos);
    if (!r.error) setTexto("");
    return r;
  }, { error: null } as EstadoEnvio);

  return (
    <footer className="border-t border-line p-3">
      <form ref={form} action={action} className="flex items-end gap-2">
        <input type="hidden" name="contacto" value={contactoId} />
        <textarea
          name="texto"
          rows={2}
          value={texto}
          maxLength={4000}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            // Enter envía; Shift+Enter hace un salto de línea.
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (texto.trim() && !pending) form.current?.requestSubmit();
            }
          }}
          placeholder="Escribí un mensaje… Enter envía, Shift+Enter baja de línea."
          className="flex-1 resize-none rounded-md border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          disabled={pending || !texto.trim()}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {pending ? "Enviando…" : "Enviar"}
        </button>
      </form>
      {res.error && <p className="mt-2 text-xs text-red-400">{res.error}</p>}
      <p className="mt-2 text-[11px] text-muted">Al enviar vos, el agente queda pausado en este chat. Podés devolverle el control con el interruptor «Agente».</p>
    </footer>
  );
}
