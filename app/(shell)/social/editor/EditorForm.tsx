"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { guardarPost, eliminarPost, duplicarPost } from "./actions";
import type { Cuenta } from "@/lib/pb";
import Cargando from "@/components/Cargando";
import BotonReutilizar from "@/components/BotonReutilizar";
import CampoHistorial from "@/components/CampoHistorial";

export type PostEditable = {
  id: string;
  cuenta: string;
  tipo: string;
  caption: string;
  hashtags: string;
  pilar: string;
  portada: string; // imagen de vista previa de posts importados
  tapa: string; // tapa elegida para un reel
  programado_en: string; // ya en formato datetime-local
  estado: string;
  error: string;
  media: { nombre: string; url: string }[];
};

const PERMITIDOS = ["image/jpeg", "video/mp4", "video/quicktime"];
const MAX_ARCHIVOS = 10;
const MAX_MB = 50;
const esVideoMime = (t: string) => t.startsWith("video/");
const esPdfMime = (t: string) => t === "application/pdf";
const mb = (n: number) => (n / 1048576).toFixed(1);

const campo =
  "w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent";

export default function EditorForm({
  post,
  cuentas,
  aviso,
  historial,
}: {
  post: PostEditable;
  cuentas: Cuenta[];
  aviso?: string;
  historial: { hashtags: string[]; pilar: string[] };
}) {
  const [res, action, pending] = useActionState(guardarPost, { error: null });
  const [caption, setCaption] = useState(post.caption);
  const [hashtags, setHashtags] = useState(post.hashtags);
  const [pilar, setPilar] = useState(post.pilar);
  const [cuentaId, setCuentaId] = useState(post.cuenta);
  const [tipo, setTipo] = useState(post.tipo);
  const [nuevos, setNuevos] = useState<File[]>([]);
  const [errArchivos, setErrArchivos] = useState<string[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  const [tapaNueva, setTapaNueva] = useState<File | null>(null);
  const [errTapa, setErrTapa] = useState("");
  const [arrastraTapa, setArrastraTapa] = useState(false);
  const inputTapa = useRef<HTMLInputElement>(null);
  const urlTapa = useMemo(() => (tapaNueva ? URL.createObjectURL(tapaNueva) : ""), [tapaNueva]);
  useEffect(() => () => { if (urlTapa) URL.revokeObjectURL(urlTapa); }, [urlTapa]);
  const inputArchivos = useRef<HTMLInputElement>(null);
  const urlsNuevos = useMemo(() => nuevos.map((f) => URL.createObjectURL(f)), [nuevos]);
  useEffect(() => () => urlsNuevos.forEach((u) => URL.revokeObjectURL(u)), [urlsNuevos]);
  // El input real siempre refleja la lista que se ve en pantalla.
  useEffect(() => {
    if (!inputArchivos.current) return;
    const dt = new DataTransfer();
    nuevos.forEach((f) => dt.items.add(f));
    inputArchivos.current.files = dt.files;
  }, [nuevos]);
  const esLinkedin = cuentas.find((c) => c.id === cuentaId)?.plataforma === "linkedin";
  const limite = esLinkedin ? 3000 : 2200;
  const total = (caption + (hashtags ? "\n\n" + hashtags : "")).length;
  const bloqueado = post.estado === "publicado" || post.estado === "publicando";

  const tipoEf = esLinkedin ? (["imagen", "video", "documento"].includes(tipo) ? tipo : "texto") : tipo;
  const conArchivos = !esLinkedin || tipoEf !== "texto";
  // Tipos de archivo que acepta cada formato de LinkedIn.
  const mimesLi = tipoEf === "video" ? ["video/mp4"] : tipoEf === "documento" ? ["application/pdf"] : ["image/jpeg", "image/png"];
  const textoMimesLi = tipoEf === "video" ? "Video MP4" : tipoEf === "documento" ? "PDF" : "Imagen JPEG o PNG";
  // Los videos se muestran con su proporción real: sin recortes ni barras.
  const videoPreview = nuevos[0] ? esVideoMime(nuevos[0].type) : /\.(mp4|mov)$/i.test(post.media[0]?.nombre ?? "");
  const unSoloArchivo = esLinkedin || tipo !== "carrusel";
  // Si el formato pasa a admitir un solo archivo, se conserva el último elegido.
  const cambiarTipo = (t: string) => {
    setTipo(t);
    if (t !== "carrusel" && nuevos.length > 1) {
      setNuevos(nuevos.slice(-1));
      setErrArchivos(["Este formato admite un solo archivo: se conservó el último que elegiste."]);
    }
  };
  const agregar = (lista: File[]) => {
    const errores: string[] = [];
    const validos = lista.filter((f) => {
      if (esLinkedin ? !mimesLi.includes(f.type) : !PERMITIDOS.includes(f.type)) {
        errores.push(`"${f.name}" no se puede usar: ${esLinkedin ? `este formato admite ${textoMimesLi}.` : "solo imágenes JPEG y videos MP4/MOV."}`);
        return false;
      }
      if (f.size > MAX_MB * 1048576) {
        errores.push(`"${f.name}" pesa ${mb(f.size)} MB y el máximo es ${MAX_MB} MB.`);
        return false;
      }
      return true;
    });
    let siguiente = unSoloArchivo ? validos.slice(-1) : [...nuevos, ...validos];
    if (siguiente.length > MAX_ARCHIVOS) {
      errores.push(`Máximo ${MAX_ARCHIVOS} archivos por post.`);
      siguiente = siguiente.slice(0, MAX_ARCHIVOS);
    }
    setErrArchivos(errores);
    setNuevos(siguiente);
  };
  // El input real siempre refleja la tapa que se ve en pantalla.
  const elegirTapa = (f: File | null) => {
    let error = "";
    if (f && f.type !== "image/jpeg") error = "La tapa tiene que ser una imagen JPEG.";
    else if (f && f.size > 8 * 1048576) error = `La tapa pesa ${mb(f.size)} MB y el máximo es 8 MB.`;
    const ok = error ? null : f;
    if (inputTapa.current) {
      const dt = new DataTransfer();
      if (ok) dt.items.add(ok);
      inputTapa.current.files = dt.files;
    }
    setErrTapa(error);
    setTapaNueva(ok);
  };
  const quitar = (i: number) => setNuevos(nuevos.filter((_, k) => k !== i));

  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_340px]">
      <form action={action} className="space-y-4">
        <input type="hidden" name="id" value={post.id} />
        <input type="hidden" name="media_previos" value={post.media.length} />

        {aviso && (
          <p className="rounded-md border border-[#f5c842]/40 bg-[#f5c842]/10 p-3 text-sm text-[#f5c842]">{aviso}</p>
        )}
        {post.estado === "error" && post.error && (
          <p className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            Falló la publicación: {post.error}
          </p>
        )}
        {bloqueado && (
          <p className="rounded-md border border-line bg-surface p-3 text-sm text-muted">
            Este post ya está {post.estado}. Para reutilizarlo, duplicalo desde la Biblioteca.
          </p>
        )}

        <label className="block text-sm">
          <span className="mb-1 block text-muted">Publicar en</span>
          <select name="cuenta" value={cuentaId} disabled={bloqueado}
            onChange={(e) => setCuentaId(e.target.value)} className={campo}>
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.plataforma === "instagram" ? "Instagram" : "LinkedIn"} · {c.handle}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-muted">Formato</span>
          <select name="tipo" value={tipoEf} onChange={(e) => cambiarTipo(e.target.value)} disabled={bloqueado} className={campo}>
            {esLinkedin ? (
              <>
                <option value="texto">Texto / enlace</option>
                <option value="imagen">Imagen</option>
                <option value="video">Video</option>
                <option value="documento">Documento PDF</option>
              </>
            ) : (
              <>
                <option value="imagen">Imagen</option>
                <option value="carrusel">Carrusel (2–10)</option>
                <option value="reel">Reel</option>
              </>
            )}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 flex justify-between text-muted">
            Caption <span className={total > limite ? "text-red-400" : ""}>{total}/{limite}</span>
          </span>
          <textarea name="caption" rows={9} value={caption} disabled={bloqueado}
            onChange={(e) => setCaption(e.target.value)} className={campo} />
        </label>

        <div className="block text-sm">
          <span className="mb-1 block text-muted">Hashtags{esLinkedin ? "" : " (máx. 30)"}</span>
          <CampoHistorial name="hashtags" value={hashtags} onChange={setHashtags} opciones={historial.hashtags}
            disabled={bloqueado} placeholder="#ventas #distribuidoras" className={campo} />
        </div>

        <div className="block text-sm">
          <span className="mb-1 block text-muted">Pilar / serie (opcional)</span>
          <CampoHistorial name="pilar" value={pilar} onChange={setPilar} opciones={historial.pilar}
            disabled={bloqueado} placeholder="Ej: Brújula Comercial, casos de éxito" className={campo} />
        </div>

        {conArchivos && (
          <div className="text-sm">
            <span className="mb-1 block text-muted">
              Archivos{unSoloArchivo ? " (1 archivo)" : ` (hasta ${MAX_ARCHIVOS})`}
            </span>
            <input
              ref={inputArchivos}
              type="file"
              name="media"
              multiple={!unSoloArchivo}
              disabled={bloqueado}
              accept={esLinkedin ? mimesLi.join(",") : "image/jpeg,video/mp4,video/quicktime"}
              onChange={(e) => agregar(Array.from(e.target.files ?? []))}
              className="sr-only"
              id="archivos"
              tabIndex={-1}
            />
            {!bloqueado && (
              <label
                htmlFor="archivos"
                onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
                onDragLeave={() => setArrastrando(false)}
                onDrop={(e) => { e.preventDefault(); setArrastrando(false); agregar(Array.from(e.dataTransfer.files)); }}
                className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-7 text-center transition ${
                  arrastrando ? "border-accent bg-accent/10" : "border-line bg-surface-2 hover:border-accent"
                }`}
              >
                <span className="text-2xl">⬆️</span>
                <span className="font-semibold">Hacé clic o arrastrá los archivos acá</span>
                <span className="text-xs text-muted">{esLinkedin ? textoMimesLi : "Imágenes JPEG · Videos MP4 o MOV"} · hasta {MAX_MB} MB cada uno</span>
              </label>
            )}

            {errArchivos.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-red-400">
                {errArchivos.map((m) => <li key={m}>{m}</li>)}
              </ul>
            )}

            {nuevos.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {nuevos.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-3 rounded-md border border-line bg-surface p-2">
                    <span className="w-5 text-center text-xs text-muted">{i + 1}</span>
                    {esPdfMime(f.type) ? (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-surface-2 text-xs font-bold">PDF</span>
                    ) : esVideoMime(f.type) ? (
                      <video src={urlsNuevos[i]} muted playsInline className="h-12 w-12 shrink-0 rounded object-cover" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={urlsNuevos[i]} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{f.name}</p>
                      <p className="text-xs text-muted">
                        {esPdfMime(f.type) ? "Documento" : esVideoMime(f.type) ? "Video" : "Imagen"} · {mb(f.size)} MB
                      </p>
                    </div>
                    <button type="button" onClick={() => quitar(i)} aria-label={`Quitar ${f.name}`}
                      className="rounded px-2 py-1 text-sm text-muted hover:bg-surface-2 hover:text-red-400">
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              post.media.length > 0 && (
                <div className="mt-3">
                  <p className="mb-2 text-xs text-muted">
                    Archivos actuales{!bloqueado && " — si subís nuevos, reemplazan a estos"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {post.media.map((m) =>
                      /\.pdf$/i.test(m.nombre) ? (
                        <span key={m.nombre} className="flex h-14 w-14 items-center justify-center rounded bg-surface-2 text-xs font-bold">PDF</span>
                      ) : /\.(mp4|mov)$/i.test(m.nombre) ? (
                        <video key={m.nombre} src={m.url} muted playsInline className="h-14 w-14 rounded object-cover" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={m.nombre} src={m.url} alt="" className="h-14 w-14 rounded object-cover" />
                      ),
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {!esLinkedin && tipoEf === "reel" && (
          <div className="text-sm">
            <span className="mb-1 block text-muted">Tapa del reel (opcional)</span>
            <input
              ref={inputTapa}
              id="tapa"
              type="file"
              name="tapa"
              accept="image/jpeg"
              disabled={bloqueado}
              onChange={(e) => elegirTapa(e.target.files?.[0] ?? null)}
              className="sr-only"
              tabIndex={-1}
            />
            {urlTapa || post.tapa ? (
              <div className="flex items-center gap-4 rounded-lg border border-line bg-surface p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={urlTapa || post.tapa} alt="Tapa del reel" className="aspect-[9/16] h-28 shrink-0 rounded-md object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{tapaNueva ? tapaNueva.name : "Tapa actual"}</p>
                  <p className="text-xs text-muted">
                    {tapaNueva ? `Imagen JPEG · ${mb(tapaNueva.size)} MB` : "Guardada en este post"}
                  </p>
                  {!bloqueado && (
                    <div className="mt-3 flex gap-2">
                      <label htmlFor="tapa" className="cursor-pointer rounded-md bg-surface-2 px-3 py-1.5 text-xs font-semibold hover:text-accent">
                        Cambiar
                      </label>
                      {tapaNueva && (
                        <button type="button" onClick={() => elegirTapa(null)}
                          className="rounded-md px-3 py-1.5 text-xs text-muted hover:bg-surface-2 hover:text-red-400">
                          Quitar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              !bloqueado && (
                <label
                  htmlFor="tapa"
                  onDragOver={(e) => { e.preventDefault(); setArrastraTapa(true); }}
                  onDragLeave={() => setArrastraTapa(false)}
                  onDrop={(e) => { e.preventDefault(); setArrastraTapa(false); elegirTapa(e.dataTransfer.files[0] ?? null); }}
                  className={`flex cursor-pointer items-center gap-4 rounded-lg border-2 border-dashed px-4 py-4 transition ${
                    arrastraTapa ? "border-accent bg-accent/10" : "border-line bg-surface-2 hover:border-accent"
                  }`}
                >
                  <span className="flex aspect-[9/16] h-16 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-xl">🖼️</span>
                  <span>
                    <span className="block font-semibold">Elegí una imagen de tapa</span>
                    <span className="block text-xs text-muted">
                      Hacé clic o arrastrala acá · JPEG hasta 8 MB · proporción 9:16. Si no subís una, Instagram usa el primer cuadro del video.
                    </span>
                  </span>
                </label>
              )
            )}
            {errTapa && <p className="mt-2 text-xs text-red-400">{errTapa}</p>}
          </div>
        )}

        <label className="block text-sm">
          <span className="mb-1 block text-muted">Fecha y hora de publicación (Argentina)</span>
          <input type="datetime-local" name="programado_en" defaultValue={post.programado_en}
            disabled={bloqueado} className={campo} />
        </label>

        {res.error && <p className="text-sm text-red-400">{res.error}</p>}
        {pending && (
          <Cargando texto="Guardando el post…" detalle="Subiendo los archivos y avisando al publicador." />
        )}

        {!bloqueado && (
          <div className="flex gap-3">
            <button name="accion" value="programar" disabled={pending}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {pending ? "Guardando…" : "Programar"}
            </button>
            <button name="accion" value="borrador" disabled={pending}
              className="rounded-md bg-surface-2 px-4 py-2 text-sm font-semibold disabled:opacity-60">
              Guardar borrador
            </button>
          </div>
        )}
      </form>

      <aside className="space-y-4">
        <div className="rounded-xl border border-line bg-surface p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <span className="h-7 w-7 rounded-full bg-accent" /> {cuentas.find((c) => c.id === cuentaId)?.handle}
          </div>
          <div className={`overflow-hidden rounded-md bg-surface-2 ${videoPreview ? "mx-auto w-fit max-w-full" : "aspect-square"}`}>
            {nuevos[0] ? (
              esPdfMime(nuevos[0].type) ? (
                <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-muted">📄 {nuevos[0].name}</div>
              ) : esVideoMime(nuevos[0].type) ? (
                <video key={urlsNuevos[0]} src={urlsNuevos[0]} controls muted playsInline className="block h-auto max-h-[560px] w-auto max-w-full" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={urlsNuevos[0]} alt="" className="h-full w-full object-cover" />
              )
            ) : /\.pdf$/i.test(post.media[0]?.nombre ?? "") ? (
              <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-muted">📄 {post.media[0].nombre}</div>
            ) : /\.(mp4|mov)$/i.test(post.media[0]?.nombre ?? "") ? (
              <video src={post.media[0].url} controls muted playsInline className="block h-auto max-h-[560px] w-auto max-w-full" />
            ) : (
              (post.media[0]?.url || post.portada) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.media[0]?.url || post.portada} alt="" className="h-full w-full object-cover" />
              )
            )}
          </div>
          <p className="mt-2 line-clamp-6 whitespace-pre-line text-xs">
            <b>lezacconsultoria</b> {caption}
          </p>
        </div>
        {post.id && (
          <form action={duplicarPost}>
            <input type="hidden" name="id" value={post.id} />
            <BotonReutilizar
              texto="Duplicar como borrador"
              className="w-full rounded-md bg-surface-2 px-4 py-2 text-sm font-semibold hover:text-accent"
            />
          </form>
        )}
        {post.id && !bloqueado && (
          <form action={eliminarPost}>
            <input type="hidden" name="id" value={post.id} />
            <button className="text-sm text-red-400 hover:underline">Eliminar post</button>
          </form>
        )}
      </aside>
    </div>
  );
}
