"use client";

import { useActionState, useRef, useState } from "react";
import { importarContactos } from "./actions";
import Cargando from "@/components/Cargando";

const campo =
  "w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent";

export default function ImportarContactos({ etiquetas }: { etiquetas: string[] }) {
  const [res, action, pending] = useActionState(importarContactos, { error: null });
  const [archivo, setArchivo] = useState<File | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [aviso, setAviso] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const elegir = (f: File | null) => {
    let error = "";
    if (f && !/\.(xlsx|xls|csv)$/i.test(f.name)) error = "Tiene que ser .xlsx, .xls o .csv.";
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
      <h2 className="text-sm font-semibold">Importar contactos</h2>
      <p className="mt-1 text-xs text-muted">
        Subí un Excel o CSV con una columna de <b>Teléfono</b> (también sirve Celular o WhatsApp) y, si querés, <b>Nombre</b>, <b>Empresa</b> y{" "}
        <b>Etiqueta</b>. Los números se pasan solos al formato 549… Los que ya existen no se duplican ni cambian de estado ni de etiqueta.
        Después, en <b>Campañas</b>, elegís a qué etiqueta se le envía cada campaña.
      </p>

      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_2fr_auto] xl:items-stretch">
        <label className="block text-xs text-muted">
          Etiqueta de estos contactos
          <input name="etiqueta" list="etiquetas-existentes" maxLength={60} placeholder="Ej: distribuidoras" className={`${campo} mt-1`} />
          <datalist id="etiquetas-existentes">
            {etiquetas.map((e) => (
              <option key={e} value={e} />
            ))}
          </datalist>
          <span className="mt-1 block text-[11px]">Se aplica a los que no traen una columna «Etiqueta».</span>
        </label>

        <div>
          <input
            ref={input}
            id="archivo-contactos"
            type="file"
            name="archivo"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => elegir(e.target.files?.[0] ?? null)}
            className="sr-only"
            tabIndex={-1}
          />
          <label
            htmlFor="archivo-contactos"
            onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={(e) => { e.preventDefault(); setArrastrando(false); elegir(e.dataTransfer.files[0] ?? null); }}
            className={`flex h-full min-h-[64px] cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed px-4 py-3 transition ${
              arrastrando ? "border-accent bg-accent/10" : "border-line bg-surface-2 hover:border-accent"
            }`}
          >
            <span className="text-2xl">📇</span>
            {archivo ? (
              <span className="min-w-0 text-sm">
                <span className="block truncate font-semibold">{archivo.name}</span>
                <span className="text-xs text-muted">{(archivo.size / 1024).toFixed(0)} KB · hacé clic para cambiarlo</span>
              </span>
            ) : (
              <span className="text-sm">
                <span className="block font-semibold">Hacé clic o arrastrá el archivo acá</span>
                <span className="text-xs text-muted">.xlsx, .xls o .csv · hasta 10 MB</span>
              </span>
            )}
          </label>
        </div>

        <button
          disabled={pending || !archivo}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Importando…" : "Importar"}
        </button>
      </div>

      {(aviso || res.error) && <p className="mt-3 text-sm text-red-400">{aviso || res.error}</p>}
      {res.ok && !pending && (
        <div className="mt-3 text-sm">
          <p className="text-[#25f5a4]">{res.ok}</p>
          {res.detalle?.map((d) => (
            <p key={d} className="mt-1 text-xs text-[#f5c842]">{d}</p>
          ))}
        </div>
      )}
      {pending && <Cargando texto="Importando contactos…" detalle="Leyendo el archivo y guardando sin duplicar." />}
    </form>
  );
}
