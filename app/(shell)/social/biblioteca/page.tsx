import { pb, type List, type SocialPost, type IgPost } from "@/lib/pb";
import { duplicarPost } from "../editor/actions";

const fmt = new Intl.NumberFormat("es-AR");
const fecha = (s: string) => (s ? new Date(s).toLocaleDateString("es-AR") : "—");

export default async function Biblioteca({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; q?: string }>;
}) {
  const { tipo, q } = await searchParams;
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

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Biblioteca</h1>
      <p className="mt-1 text-sm text-muted">{posts.totalItems} posts publicados</p>

      <form className="mt-5 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar en el caption…"
          className="w-72 rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent" />
        <select name="tipo" defaultValue={tipo ?? ""}
          className="rounded-md border border-line bg-surface px-3 py-2 text-sm">
          <option value="">Todos</option>
          <option value="reel">Reels</option>
          <option value="carrusel">Carruseles</option>
          <option value="imagen">Imágenes</option>
        </select>
        <button className="rounded-md bg-surface-2 px-4 py-2 text-sm font-semibold">Filtrar</button>
      </form>

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {posts.items.map((p) => {
          const x = m.get(p.externo_id);
          return (
            <div key={p.id} className="flex flex-col rounded-lg border border-line bg-surface p-4 transition hover:border-accent">
              <a href={p.permalink} target="_blank" rel="noreferrer" className="block flex-1">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span className="rounded bg-surface-2 px-2 py-0.5 uppercase tracking-wide">{p.tipo}</span>
                  <span>{fecha(p.publicado_en)}</span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm font-semibold">{p.titulo || "(sin título)"}</p>
                <p className="mt-1 line-clamp-3 text-xs text-muted">{p.caption}</p>
                {p.pilar && <p className="mt-2 text-[11px] text-accent">{p.pilar}</p>}
                {x && (
                  <div className="mt-3 flex gap-3 text-xs text-muted">
                    <span>👁 {fmt.format(x.views)}</span>
                    <span>♥ {fmt.format(x.likes)}</span>
                    <span>💬 {fmt.format(x.comments)}</span>
                    <span>🔖 {fmt.format(x.saves)}</span>
                  </div>
                )}
              </a>
              <form action={duplicarPost} className="mt-3">
                <input type="hidden" name="id" value={p.id} />
                <button className="rounded-md bg-surface-2 px-3 py-1.5 text-xs font-semibold hover:text-accent">
                  Reutilizar
                </button>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
