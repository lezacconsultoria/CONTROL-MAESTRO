import Link from "next/link";
import { esEditable, URL_SITIO } from "@/lib/blog";
import AvisoSinToken from "@/components/AvisoGithub";
import { exigirSesion, githubConfigurado, listarArticulos } from "@/lib/github";

const fmtFecha = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export default async function Blog({ searchParams }: { searchParams: Promise<{ borrado?: string }> }) {
  const { borrado } = await searchParams;
  await exigirSesion();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Blog</h1>
          <p className="mt-1 text-sm text-muted">Artículos de lezacconsultoria.com/blog. Al publicar, el sitio se actualiza solo en 1 o 2 minutos.</p>
        </div>
        <Link href="/blog/editor" className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white">
          + Nuevo artículo
        </Link>
      </div>
      {borrado && <p className="mt-4 text-sm text-[#25f5a4]">Artículo borrado. En un par de minutos desaparece del sitio.</p>}
      {githubConfigurado() ? <Listado /> : <AvisoSinToken />}
    </div>
  );
}

async function Listado() {
  let articulos;
  try {
    articulos = await listarArticulos();
  } catch (e) {
    return <p className="mt-6 text-sm text-red-400">{(e as Error).message}</p>;
  }
  if (articulos.length === 0) {
    return <p className="mt-8 rounded-lg border border-dashed border-line p-10 text-center text-sm text-muted">Todavía no hay artículos.</p>;
  }
  return (
    <div className="mt-5 grid gap-3">
      {articulos.map(({ articulo: a }) => {
        const publicado = a.status !== "borrador";
        return (
          <article key={a.slug} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface p-4">
            <div className="min-w-0">
              <h2 className="truncate font-semibold">{a.h1}</h2>
              <p className="mt-0.5 text-xs text-muted">
                {fmtFecha(a.date)} · /blog/{a.slug}
                {!esEditable(a) && " · diseño propio"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${publicado ? "bg-[#25f5a4]/15 text-[#25f5a4]" : "bg-surface-2 text-muted"}`}
              >
                {publicado ? "Publicado" : "Borrador"}
              </span>
              {publicado && (
                <a href={`${URL_SITIO}/blog/${a.slug}`} target="_blank" rel="noopener" className="rounded-md bg-surface-2 px-3 py-1.5 text-xs font-semibold hover:text-accent">
                  Ver en el sitio
                </a>
              )}
              {esEditable(a) && (
                <Link href={`/blog/editor?slug=${a.slug}`} className="rounded-md bg-surface-2 px-3 py-1.5 text-xs font-semibold hover:text-accent">
                  Editar
                </Link>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
