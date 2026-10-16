"use client";

import { useActionState, useRef, useState } from "react";
import { subirAnalitica } from "./actions";
import Cargando from "@/components/Cargando";

const campo =
  "w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent";

export default function SubirAnalitica({
  cuentas,
  cuentaActual,
}: {
  cuentas: { id: string; handle: string; pagina: boolean }[];
  cuentaActual: string;
}) {
  const [res, action, pending] = useActionState(subirAnalitica, { error: null });
  const [cuenta, setCuenta] = useState(cuentaActual);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [aviso, setAviso] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const esPagina = cuentas.find((c) => c.id === cuenta)?.pagina;

  const elegir = (f: File | null) => {
    let error = "";
    if (f && !/\.xlsx?$/i.test(f.name)) error = "Tiene que ser un Excel (.xlsx o .xls).";
    else if (f && f.size > 10 * 1048576) error = "El archivo pesa más de 10 MB.";
    const ok = error ? null : f;
    if (input.current) {
      const dt = new DataTransfer();
      if (ok) dt.items.add(ok);
      input.current.files = dt.files;
    }
    setAviso(error);
    setArchivo(ok);
  };

  return (
    <form action={action} className="rounded-lg border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold">Actualizar datos</h2>
      <p className="mt-1 text-xs text-muted">
        Subí el Excel que descargás desde LinkedIn ({esPagina ? "Analíticas de la página → Contenido → Exportar" : "Analíticas del perfil → Exportar"}).
        Los días y posts que ya estaban se actualizan y los nuevos se suman, sin duplicar.
      </p>

      <div className="mt-3 grid gap-3 md:grid-cols-[220px_1fr_auto] md:items-stretch">
        <label className="block text-xs text-muted">
          Cuenta
          <select name="cuenta" value={cuenta} onChange={(e) => setCuenta(e.target.value)} className={`${campo} mt-1`}>
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.handle}
              </option>
            ))}
          </select>
        </label>

        <div>
          <input
            ref={input}
            id="archivo-analitica"
            type="file"
            name="archivo"
            accept=".xlsx,.xls"
            onChange={(e) => elegir(e.target.files?.[0] ?? null)}
            className="sr-only"
            tabIndex={-1}
          />
          <label
            htmlFor="archivo-analitica"
            onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={(e) => { e.preventDefault(); setArrastrando(false); elegir(e.dataTransfer.files[0] ?? null); }}
            className={`flex h-full min-h-[64px] cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed px-4 py-3 transition ${
              arrastrando ? "border-accent bg-accent/10" : "border-line bg-surface-2 hover:border-accent"
            }`}
          >
            <span className="text-2xl">📊</span>
            {archivo ? (
              <span className="min-w-0 text-sm">
                <span className="block truncate font-semibold">{archivo.name}</span>
                <span className="text-xs text-muted">{(archivo.size / 1024).toFixed(0)} KB · hacé clic para cambiarlo</span>
              </span>
            ) : (
              <span className="text-sm">
                <span className="block font-semibold">Hacé clic o arrastrá el Excel acá</span>
                <span className="text-xs text-muted">.xlsx o .xls · hasta 10 MB</span>
              </span>
            )}
          </label>
        </div>

        <button
          disabled={pending || !archivo}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Procesando…" : "Actualizar"}
        </button>
      </div>

      {(aviso || res.error) && <p className="mt-3 text-sm text-red-400">{aviso || res.error}</p>}
      {res.ok && !pending && <p className="mt-3 text-sm text-[#25f5a4]">{res.ok}</p>}
      {pending && <Cargando texto="Procesando el archivo…" detalle="Leyendo el Excel y actualizando las métricas." />}
    </form>
  );
}
