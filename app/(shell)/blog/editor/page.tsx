import Link from "next/link";
import AvisoSinToken from "@/components/AvisoGithub";
import { SLUG_RE, esEditable, type Articulo } from "@/lib/blog";
import { diaAR } from "@/lib/fecha";
import { exigirSesion, githubConfigurado, leerArticulo } from "@/lib/github";
import { borrarArticulo } from "../actions";
import EditorBlog from "./EditorBlog";

export default async function EditorPagina({ searchParams }: { searchParams: Promise<{ slug?: string; listo?: string }> }) {
  const { slug, listo } = await searchParams;
  await exigirSesion();
  if (!githubConfigurado()) return <AvisoSinToken />;

  let articulo: Articulo | null = null;
  let sha = "";
  if (slug) {
    if (!SLUG_RE.test(slug)) return <p className="text-sm text-red-400">Artículo inválido.</p>;
    let error = "";
    try {
      const r = await leerArticulo(slug);
      if (r) {
        articulo = r.articulo;
        sha = r.sha;
      } else {
        error = "No encuentro ese artículo.";
      }
    } catch (e) {
      error = (e as Error).message;
    }
    if (error || !articulo) return <p className="text-sm text-red-400">{error}</p>;
    if (!esEditable(articulo)) {
      return (
        <div>
          <h1 className="font-display text-2xl font-bold">{articulo.h1}</h1>
          <p className="mt-3 text-sm text-muted">Este artículo tiene un diseño propio y no se edita desde acá.</p>
          <Link href="/blog" className="mt-4 inline-block text-sm text-accent">← Volver al listado</Link>
        </div>
      );
    }
  }

  return (
    <div>
      <Link href="/blog" className="text-sm text-muted hover:text-ink">← Artículos</Link>
      <h1 className="mt-2 font-display text-2xl font-bold">{articulo ? "Editar artículo" : "Nuevo artículo"}</h1>
      {listo && (
        <p className="mt-3 rounded-md bg-[#25f5a4]/10 p-3 text-sm text-[#25f5a4]">
          {listo === "publicado"
            ? "Publicado. En 1 o 2 minutos aparece en lezacconsultoria.com/blog."
            : "Borrador guardado. No se muestra en el sitio hasta que lo publiques."}
        </p>
      )}
      <EditorBlog key={`${slug ?? "nuevo"}-${sha}`} articulo={articulo} hoy={diaAR(new Date().toISOString())} />
      {articulo && (
        <form action={borrarArticulo} className="mt-10 max-w-3xl border-t border-line pt-6">
          <input type="hidden" name="slug" value={articulo.slug} />
          <p className="text-xs text-muted">Borrar quita el artículo del sitio y de GitHub. No se puede deshacer desde acá.</p>
          <button className="mt-2 rounded-md bg-surface-2 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/10">
            Borrar artículo
          </button>
        </form>
      )}
    </div>
  );
}
