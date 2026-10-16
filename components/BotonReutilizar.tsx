"use client";

import { useFormStatus } from "react-dom";
import Cargando from "./Cargando";

export default function BotonReutilizar({ className, texto = "Reutilizar" }: { className: string; texto?: string }) {
  const { pending } = useFormStatus();
  return (
    <>
      <button disabled={pending} className={`${className} disabled:opacity-60`}>
        {texto}
      </button>
      {pending && (
        <Cargando
          texto="Preparando tu borrador…"
          detalle="Copiando el texto y trayendo el archivo original de Instagram. Puede tardar unos segundos."
        />
      )}
    </>
  );
}
