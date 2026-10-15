import { pb, type List, type IgPost, type Snapshot } from "@/lib/pb";

const fmt = new Intl.NumberFormat("es-AR");

function Kpi({ label, value, delta }: { label: string; value: number; delta?: number }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold">{fmt.format(value)}</div>
      {delta !== undefined && Number.isFinite(delta) && (
        <div className={`mt-1 text-xs ${delta >= 0 ? "text-[#25f5a4]" : "text-red-400"}`}>
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}% vs. anterior
        </div>
      )}
    </div>
  );
}

function Linea({ datos }: { datos: number[] }) {
  const w = 640, h = 160, p = 8;
  const max = Math.max(...datos, 1);
  const pts = datos.map((y, i) => [
    p + (i * (w - 2 * p)) / Math.max(datos.length - 1, 1),
    h - p - (y / max) * (h - 2 * p),
  ]);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Alcance 28 días">
      <polyline fill="none" stroke="var(--accent)" strokeWidth="2" points={pts.map((q) => q.join(",")).join(" ")} />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.5" fill="var(--accent)" />
      ))}
    </svg>
  );
}

export default async function Analytics() {
  const [snaps, posts] = await Promise.all([
    pb<List<Snapshot>>("collections/ig_cuenta_snapshot/records?perPage=60&sort=fecha"),
    pb<List<IgPost>>("collections/ig_posts/records?perPage=500&sort=-reach"),
  ]);
  const s = snaps.items;
  const ult = s.at(-1);
  const ant = s.at(-2);
  const d = (k: keyof Snapshot) =>
    ult && ant ? ((Number(ult[k]) - Number(ant[k])) / Number(ant[k] || 1)) * 100 : undefined;

  const porTipo = Object.entries(
    posts.items.reduce<Record<string, { n: number; reach: number }>>((a, p) => {
      const t = (a[p.tipo] ??= { n: 0, reach: 0 });
      t.n++;
      t.reach += p.reach;
      return a;
    }, {}),
  );

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Analytics</h1>
      <p className="mt-1 text-sm text-muted">
        Último snapshot: {ult ? new Date(ult.fecha).toLocaleDateString("es-AR") : "sin datos"} ·{" "}
        {posts.totalItems} posts con métricas
      </p>

      {ult && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Alcance 28d" value={ult.alcance_28d} delta={d("alcance_28d")} />
          <Kpi label="Interacciones" value={ult.interacciones_totales} delta={d("interacciones_totales")} />
          <Kpi label="Visitas al perfil" value={ult.visitas_perfil} delta={d("visitas_perfil")} />
          <Kpi label="Clics al sitio" value={ult.clics_sitio} delta={d("clics_sitio")} />
        </div>
      )}

      <section className="mt-6 rounded-lg border border-line bg-surface p-4">
        <h2 className="mb-2 text-sm font-semibold">Alcance a 28 días</h2>
        <Linea datos={s.map((x) => x.alcance_28d)} />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-lg border border-line bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold">Top posts por alcance</h2>
          <ol className="space-y-2 text-sm">
            {posts.items.slice(0, 8).map((p) => (
              <li key={p.media_id} className="flex justify-between gap-3">
                <a href={p.permalink} target="_blank" rel="noreferrer" className="truncate hover:text-accent">
                  {p.titulo || p.media_id}
                </a>
                <span className="shrink-0 text-muted">{fmt.format(p.reach)}</span>
              </li>
            ))}
          </ol>
        </section>
        <section className="rounded-lg border border-line bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold">Alcance medio por formato</h2>
          <ul className="space-y-2 text-sm">
            {porTipo.map(([t, v]) => (
              <li key={t} className="flex justify-between">
                <span className="capitalize">
                  {t} <span className="text-muted">({v.n})</span>
                </span>
                <span className="text-muted">{fmt.format(Math.round(v.reach / v.n))}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
