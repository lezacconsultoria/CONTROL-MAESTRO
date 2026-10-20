"use client";

import { useState } from "react";

// El texto vive en el estado del cliente: las actualizaciones automáticas de la página no lo tocan.
export default function CajaMensaje() {
  const [texto, setTexto] = useState("");

  return (
    <footer className="flex items-end gap-2 border-t border-line p-3">
      <textarea
        rows={2}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Escribí un borrador… el envío desde el panel se habilita cuando esté el motor de envío."
        className="flex-1 resize-none rounded-md border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <button disabled title="Disponible cuando esté el motor de envío" className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white opacity-40">
        Enviar
      </button>
    </footer>
  );
}
