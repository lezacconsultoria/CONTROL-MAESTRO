"use client";

import { useActionState, useState } from "react";
import { guardarPost, eliminarPost, duplicarPost } from "./actions";
import type { Cuenta } from "@/lib/pb";

export type PostEditable = {
  id: string;
  cuenta: string;
  tipo: string;
  caption: string;
  hashtags: string;
  pilar: string;
  portada: string; // imagen de vista previa de posts importados
  programado_en: string; // ya en formato datetime-local
  estado: string;
  error: string;
  media: { nombre: string; url: string }[];
};

const campo =
  "w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent";

export default function EditorForm({ post, cuentas, aviso }: { post: PostEditable; cuentas: Cuenta[]; aviso?: string }) {
  const [res, action, pending] = useActionState(guardarPost, { error: null });
  const [caption, setCaption] = useState(post.caption);
  const [hashtags, setHashtags] = useState(post.hashtags);
  const [cuentaId, setCuentaId] = useState(post.cuenta);
  const esLinkedin = cuentas.find((c) => c.id === cuentaId)?.plataforma === "linkedin";
  const limite = esLinkedin ? 3000 : 2200;
  const total = (caption + (hashtags ? "\n\n" + hashtags : "")).length;
  const bloqueado = post.estado === "publicado" || post.estado === "publicando";

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
          <select name="tipo" defaultValue={esLinkedin ? "texto" : post.tipo} key={esLinkedin ? "li" : "ig"} disabled={bloqueado} className={campo}>
            {esLinkedin ? (
              <option value="texto">Texto / enlace</option>
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

        <label className="block text-sm">
          <span className="mb-1 block text-muted">Hashtags{esLinkedin ? "" : " (máx. 30)"}</span>
          <input name="hashtags" value={hashtags} disabled={bloqueado}
            onChange={(e) => setHashtags(e.target.value)} placeholder="#ventas #distribuidoras" className={campo} />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-muted">Pilar / serie (opcional)</span>
          <input name="pilar" defaultValue={post.pilar} disabled={bloqueado}
            placeholder="Ej: Brújula Comercial, casos de éxito" className={campo} />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-muted">
            Archivos (imágenes JPEG, videos MP4/MOV){post.media.length > 0 && " — subir nuevos reemplaza los actuales"}
          </span>
          <input type="file" name="media" multiple disabled={bloqueado}
            accept="image/jpeg,video/mp4,video/quicktime" className={campo} />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-muted">Fecha y hora de publicación (Argentina)</span>
          <input type="datetime-local" name="programado_en" defaultValue={post.programado_en}
            disabled={bloqueado} className={campo} />
        </label>

        {res.error && <p className="text-sm text-red-400">{res.error}</p>}

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
          <div className="aspect-square overflow-hidden rounded-md bg-surface-2">
            {/\.(mp4|mov)$/i.test(post.media[0]?.nombre ?? "") ? (
              <video src={post.media[0].url} controls muted playsInline className="h-full w-full object-cover" />
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
            <button className="w-full rounded-md bg-surface-2 px-4 py-2 text-sm font-semibold hover:text-accent">
              Duplicar como borrador
            </button>
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
