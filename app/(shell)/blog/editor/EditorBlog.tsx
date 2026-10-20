"use client";

import { useActionState, useRef, useState } from "react";
import Cargando from "@/components/Cargando";
import { CATEGORIAS, slugify, type Articulo } from "@/lib/blog";
import { guardarArticulo, subirImagen } from "../actions";

const campo = "w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent";

export default function EditorBlog({ articulo, hoy }: { articulo: Articulo | null; hoy: string }) {
  const nuevo = !articulo;
  const [res, action, pending] = useActionState(guardarArticulo, { error: null });
  const [titulo, setTitulo] = useState(articulo?.h1 ?? "");
  const [slug, setSlug] = useState(articulo?.slug ?? "");
  const [slugManual, setSlugManual] = useState(false);
  const [descripcion, setDescripcion] = useState(articulo?.description ?? "");
  const [cover, setCover] = useState(articulo?.cover ?? "");
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [errorImg, setErrorImg] = useState<string | null>(null);
  const texto = useRef<HTMLTextAreaElement>(null);

  const largo = descripcion.trim().length;
  const largoOk = largo >= 50 && largo <= 170;

  async function subir(file: File | undefined, destino: "portada" | "texto") {
    if (!file) return;
    setErrorImg(null);
    setSubiendo(file.name);
    const fd = new FormData();
    fd.append("archivo", file);
    const r = await subirImagen(fd);
    setSubiendo(null);
    if (r.error || !r.url) return setErrorImg(r.error ?? "No se pudo subir la imagen.");
    if (destino === "portada") return setCover(r.url);
    const t = texto.current;
    if (!t) return;
    const md = `\n\n![Describí la imagen](${r.url})\n\n`;
    const pos = t.selectionStart ?? t.value.length;
    t.setRangeText(md, pos, pos, "end");
    t.focus();
  }

  return (
    <form action={action} className="mt-5 max-w-3xl space-y-6">
      <input type="hidden" name="nuevo" value={nuevo ? "1" : "0"} />
      <input type="hidden" name="cover" value={cover} />

      <section className="space-y-4 rounded-lg border border-line bg-surface p-4">
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Título</span>
          <input
            name="h1"
            value={titulo}
            maxLength={120}
            onChange={(e) => {
              setTitulo(e.target.value);
              if (nuevo && !slugManual) setSlug(slugify(e.target.value));
            }}
            className={campo}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Dirección en el sitio</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">lezacconsultoria.com/blog/</span>
            <input
              name="slug"
              value={slug}
              readOnly={!nuevo}
              onChange={(e) => {
                setSlugManual(true);
                setSlug(slugify(e.target.value));
              }}
              className={`${campo} ${nuevo ? "" : "opacity-60"}`}
            />
          </div>
          {!nuevo && <span className="mt-1 block text-xs text-muted">No se puede cambiar una vez creado el artículo (los links ya compartidos dejarían de funcionar).</span>}
        </label>
        <label className="block text-sm">
          <span className="mb-1 flex justify-between text-muted">
            <span>Descripción para Google y LinkedIn</span>
            <span className={largoOk ? "text-[#25f5a4]" : "text-amber-400"}>{largo} / 50–170</span>
          </span>
          <textarea name="description" rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className={campo} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Bajada (opcional, aparece debajo del título)</span>
          <input name="subtitle" defaultValue={articulo?.subtitle ?? ""} maxLength={220} className={campo} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Categoría</span>
            <input name="category" list="categorias" defaultValue={articulo?.category ?? CATEGORIAS[0]} maxLength={40} className={campo} />
            <datalist id="categorias">{CATEGORIAS.map((c) => <option key={c} value={c} />)}</datalist>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Fecha de publicación</span>
            <input type="date" name="date" defaultValue={articulo?.date ?? hoy} className={campo} />
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">Imagen de portada (opcional)</h2>
        <p className="mt-1 text-xs text-muted">Se muestra arriba del artículo y como imagen al compartir en LinkedIn. JPG, PNG o WebP, hasta 4 MB.</p>
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`https://lezacconsultoria.com${cover}`} alt="Portada" className="mt-3 max-h-40 rounded-md border border-line" />
        )}
        <div className="mt-3 flex items-center gap-3">
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => subir(e.target.files?.[0], "portada")} className="text-xs" />
          {cover && (
            <button type="button" onClick={() => setCover("")} className="text-xs text-muted hover:text-red-400">
              Quitar portada
            </button>
          )}
        </div>
        {cover && <p className="mt-2 text-xs text-muted">La vista previa aparece cuando el sitio termina de publicarse.</p>}
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">Texto</h2>
        <textarea ref={texto} name="body" rows={24} defaultValue={articulo?.body ?? ""} className={`${campo} mt-3 font-mono leading-relaxed`} placeholder="Escribí o pegá tu artículo acá…" />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded-md bg-surface-2 px-3 py-1.5 text-xs font-semibold hover:text-accent">
            Insertar imagen en el texto
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={(e) => { subir(e.target.files?.[0], "texto"); e.target.value = ""; }} />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
            <input type="checkbox" name="toc" defaultChecked={articulo?.toc ?? false} className="h-4 w-4 accent-[var(--accent)]" />
            Mostrar índice al inicio (si hay 3 o más secciones)
          </label>
        </div>
        {errorImg && <p className="mt-2 text-sm text-red-400">{errorImg}</p>}
        <details className="mt-4 text-xs text-muted">
          <summary className="cursor-pointer font-semibold text-ink">Cómo dar formato</summary>
          <pre className="mt-2 whitespace-pre-wrap rounded-md bg-surface-2 p-3 leading-relaxed">{`## Título de una sección
### Subtítulo
Un párrafo normal. **Negrita**, *cursiva*, [texto del link](https://...)
- Punto de una lista
- Otro punto
1. Paso numerado
2. Otro paso
> Una cita destacada
---   (línea separadora)
![Descripción de la imagen](/blog/img/archivo.jpg)`}</pre>
          <p className="mt-2">Dejá una línea en blanco entre párrafos. El título del artículo ya es el título principal: empezá las secciones con ##.</p>
        </details>
      </section>

      {res.error && <p className="text-sm text-red-400">{res.error}</p>}
      {pending && <Cargando texto="Guardando en GitHub…" detalle="Tarda unos segundos." />}
      {subiendo && <Cargando texto="Subiendo imagen…" detalle={subiendo} />}

      <div className="flex flex-wrap gap-3">
        <button name="accion" value="publicado" disabled={pending} className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? "Guardando…" : articulo && articulo.status !== "borrador" ? "Guardar y publicar cambios" : "Publicar"}
        </button>
        <button name="accion" value="borrador" disabled={pending} className="rounded-md bg-surface-2 px-4 py-2 text-sm font-semibold hover:text-accent disabled:opacity-60">
          {articulo && articulo.status !== "borrador" ? "Pasar a borrador (despublicar)" : "Guardar borrador"}
        </button>
      </div>
    </form>
  );
}
