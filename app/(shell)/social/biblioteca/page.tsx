import Link from "next/link";
import { PB_URL, pb, type List, type SocialPost, type IgPost } from "@/lib/pb";
import { duplicarPost } from "../editor/actions";

const fmt = new Intl.NumberFormat("es-AR");
const fecha = (s: string) => (s ? new Date(s).toLocaleDateString("es-AR") : "—");

export default async function Biblioteca({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; q?: string; vista?: string }>;
}) {
  const { tipo, q, vista } = await searchParams;
  const lista = vista === "lista";
  const filtros = ['estado="publicado"'];
  if (tipo) filtros.push(`tipo="${tipo.replace(/"/g, "")}"`);
  if (q) filtros.push(`caption~"${q.replace(/"/g, "")}"`);

  const [posts, metricas] = await Promise.all([
    pb<List<SocialPost>>(
      `collections/social_posts/records?perPage=60&sort=-publicado_en&filter=${encodeURIComponent(filtros.join(" && "))}`,
    ),
    pb<List<IgPost>>("collections/ig_posts/records?perPage=500"),
  ]);
  const m = new Map(metricas.items.map((i) => [i.media_id, i]));

  const enlaceVista = (v: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (tipo) p.set("tipo", tipo);
    p.set("vista", v);
    return `?${p.toString()}`;
  };
  const btnVista = (activo: boolean) =>
    `rounded-md px-3 py-2 text-sm font-semibold ${activo ? "bg-accent text-white" : "bg-surface-2 text-muted hover:text-ink"}`;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Biblioteca</h1>
      <p className="mt-1 text-sm text-muted">{posts.totalItems} posts publicados</p>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <form className="flex gap-2">
          <input name="q" defaultValue={q} placeholder="Buscar en el caption…"
            className="w-72 rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent" />
          <select name="tipo" defaultValue={tipo ?? ""}
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm">
            <option value="">Todos</option>
            <option value="reel">Reels</option>
            <option value="carrusel">Carruseles</option>
            <option value="imagen">Imágenes</option>
          </select>
          <input type="hidden" name="vista" value={lista ? "lista" : "grid"} />
          <button className="rounded-md bg-surface-2 px-4 py-2 text-sm font-semibold">Filtrar</button>
        </form>
        <div className="flex gap-1">
          <Link href={enlaceVista("grid")} className={btnVista(!lista)}>▦ Cuadrícula</Link>
          <Link href={enlaceVista("lista")} className={btnVista(lista)}>☰ Lista</Link>
        </div>
      </div>

      <div className={lista ? "mt-5 flex flex-col gap-2" : "mt-5 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6"}>
        {posts.items.map((p) => {
          const x = m.get(p.externo_id);
          const img = p.portada ? `${PB_URL}/api/files/social_posts/${p.id}/${p.portada}?thumb=400x400` : "";
          const metricasTxt = x && (
            <div className="flex gap-3 text-[11px] text-muted">
              <span>👁 {fmt.format(x.views)}</span>
              <span>♥ {fmt.format(x.likes)}</span>
              <span>💬 {fmt.format(x.comments)}</span>
              <span>🔖 {fmt.format(x.saves)}</span>
            </div>
          );
          const reutilizar = (
            <form action={duplicarPost}>
              <input type="hidden" name="id" value={p.id} />
              <button className="rounded-md bg-surface-2 px-2.5 py-1 text-[11px] font-semibold hover:text-accent">
                Reutilizar
              </button>
            </form>
          );

          if (lista) {
            return (
              <div key={p.id} className="flex items-center gap-4 rounded-lg border border-line bg-surface p-2.5 transition hover:border-accent">
                <a href={p.permalink} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-4">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-md object-cover" />
                  ) : (
                    <div className="h-14 w-14 shrink-0 rounded-md bg-surface-2" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{p.titulo || "(sin título)"}</p>
                    <p className="truncate text-xs text-muted">{p.caption}</p>
                  </div>
                  <span className="hidden w-16 shrink-0 rounded bg-surface-2 px-2 py-0.5 text-center text-[10px] uppercase tracking-wide text-muted sm:block">
                    {p.tipo}
                  </span>
                  <span className="hidden w-20 shrink-0 text-xs text-muted md:block">{fecha(p.publicado_en)}</span>
                  <div className="hidden w-52 shrink-0 lg:block">{metricasTxt}</div>
                </a>
                {reutilizar}
              </div>
            );
          }

          return (
            <div key={p.id} className="flex flex-col rounded-lg border border-line bg-surface p-2.5 transition hover:border-accent">
              <a href={p.permalink} target="_blank" rel="noreferrer" className="block flex-1">
                {img && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt="" loading="lazy" className="mb-2 aspect-square w-full rounded-md object-cover" />
                )}
                <div className="flex items-center justify-between text-[10px] text-muted">
                  <span className="rounded bg-surface-2 px-1.5 py-0.5 uppercase tracking-wide">{p.tipo}</span>
                  <span>{fecha(p.publicado_en)}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs font-semibold">{p.titulo || "(sin título)"}</p>
                {p.pilar && <p className="mt-1 text-[10px] text-accent">{p.pilar}</p>}
                {x && <div className="mt-2">{metricasTxt}</div>}
              </a>
              <div className="mt-2">{reutilizar}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
