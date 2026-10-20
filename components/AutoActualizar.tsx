"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Mantiene la página al día sin recargarla: cada pocos segundos pregunta si hubo novedades y, solo si
 * las hubo, vuelve a pedir los datos del servidor (router.refresh conserva el estado del cliente:
 * texto escrito, buscador, scroll). Se pausa con la pestaña oculta y al volver revisa de inmediato.
 */
export default function AutoActualizar({ inicial, cadaMs = 3000 }: { inicial: string; cadaMs?: number }) {
  const router = useRouter();
  const ultima = useRef(inicial);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let vivo = true;
    let enCurso = false;
    const visible = () => document.visibilityState === "visible";

    const revisar = async () => {
      if (enCurso || !visible()) return;
      enCurso = true;
      try {
        const r = await fetch("/api/whatsapp/novedades", { cache: "no-store" });
        if (r.ok) {
          const { version } = (await r.json()) as { version: string };
          if (version !== ultima.current) {
            ultima.current = version;
            router.refresh();
          }
        }
      } catch {
        // sin red: se reintenta en el próximo ciclo
      } finally {
        enCurso = false;
      }
    };

    const ciclo = async () => {
      await revisar();
      if (vivo && visible()) timer = setTimeout(ciclo, cadaMs);
    };

    const cambioVisibilidad = () => {
      clearTimeout(timer);
      if (visible()) void ciclo(); // al volver: revisión inmediata y se retoma el ritmo
    };

    void ciclo();
    document.addEventListener("visibilitychange", cambioVisibilidad);
    return () => {
      vivo = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", cambioVisibilidad);
    };
  }, [cadaMs, router]);

  return null;
}
