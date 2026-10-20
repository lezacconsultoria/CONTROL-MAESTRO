"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * Contenedor del historial: arranca en el último mensaje y, cuando llegan mensajes nuevos, baja solo
 * si quien lee ya estaba al final. Si estaba leyendo mensajes viejos, no le mueve la posición.
 */
export default function HistorialScroll({ children }: { children: React.ReactNode }) {
  const caja = useRef<HTMLDivElement>(null);
  const alFinal = useRef(true);

  const alScrollear = () => {
    const el = caja.current;
    if (el) alFinal.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  };

  // Sin lista de dependencias: corre en cada render, o sea cuando el servidor manda mensajes nuevos.
  useLayoutEffect(() => {
    const el = caja.current;
    if (el && alFinal.current) el.scrollTop = el.scrollHeight;
  });

  return (
    <div ref={caja} onScroll={alScrollear} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
      {children}
    </div>
  );
}
