import Link from "next/link";
import { PB_URL, pb, type List, type IgPost, type Snapshot } from "@/lib/pb";
import LineaMetrica from "@/components/LineaMetrica";

const fmt = new Intl.NumberFormat("es-AR");

const FORMATO: Record<string, string> = { reel: "Reels", image: "Imágenes", carousel: "Carruseles" };
const METRICAS = {
  alcance: { nombre: "Alcance", campo: "alcance_28d" },
  interacciones: { nombre: "Interacciones", campo: "interacciones_totales" },
  clics: { nombre: "Clics al sitio", campo: "clics_sitio" },
} as const;
const ORDENES = {
  reach: "Alcance",
  likes: "Me gusta",
  saves: "Guardados",
  shares: "Compartidos",
} as const;

type MetricaKey = keyof typeof METRICAS;
type OrdenKey = keyof typeof ORDENES;

function Kpi({ label, value, anterior, sinDatos }: { label: string; value: number; anterior?: number; sinDatos?: boolean }) {
  const delta = anterior ? ((value - anterior) / anterior) * 100 : undefined;
  const igual = delta === undefined || Math.abs(delta) < 0.05;
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      {sinDatos ? (
        <div className="mt-1 font-display text-2xl font-bold text-muted">—</div>
      ) : (
        <div className="mt-1 font-display text-2xl font-bold">{fmt.format(value)}</div>
      )}
      <div className={`mt-1 text-xs ${sinDatos || igual ? "text-muted" : delta! >= 0 ? "text-[#25f5a4]" : "text-red-400"}`}>
        {sinDatos
          ? "sin datos"
          : igual
            ? "sin cambios vs. hace 7 días"
            : `${delta! >= 0 ? "▲" : "▼"} ${Math.abs(delta!).toFixed(1)}% vs. hace 7 días`}
      </div>
    </div>
  );
}

const pestana = (activo: boolean) =>
  `rounded-md px-3 py-1.5 text-xs font-semibold ${activo ? "bg-accent text-white" : "bg-surface-2 text-muted hover:text-ink"}`;

export default async function Analytics({
  searchParams,
}: {
  searchParams: Promise<{ metrica?: string; orden?: string }>;
}) {
  const sp = await searchParams;
  const metrica: MetricaKey = sp.metrica && sp.metrica in METRICAS ? (sp.metrica as MetricaKey) : "alcance";
  const orden: OrdenKey = sp.orden && sp.orden in ORDENES ? (sp.orden as OrdenKey) : "reach";

  const [snaps, posts, portadas] = await Promise.all([
    pb<List<Snapshot>>("collections/ig_cuenta_snapshot/records?perPage=90&sort=fecha"),
    pb<List<IgPost>>(`collections/ig_posts/records?perPage=500&sort=-${orden}`),
    pb<List<{ id: string; externo_id: string; portada: string }>>(
      `collections/social_posts/records?perPage=500&fields=id,externo_id,portada&filter=${encodeURIComponent('portada!=""')}`,
    ),
  ]);
  const s = snaps.items;
  const ult = s.at(-1);
  const hace7 = s.length > 7 ? s[s.length - 8] : undefined;
  const imagen = new Map(portadas.items.map((p) => [p.externo_id, `${PB_URL}/api/files/social_posts/${p.id}/${p.portada}?thumb=100x100`]));

  const visitasSinDatos = s.slice(-7).every((x) => !x.visitas_perfil);
  const campo = METRICAS[metrica].campo;
  const serie = s.map((x) => ({ fecha: x.fecha, valor: Number(x[campo]) }));

  const interaccion = (p: IgPost) => p.likes + p.comments + p.saves + p.shares;
  const porFormato = Object.entries(
    posts.items.reduce<Record<string, { n: number; reach: number; inter: number }>>((a, p) => {
      const t = (a[p.tipo] ??= { n: 0, reach: 0, inter: 0 });
      t.n++;
      t.reach += p.reach;
      t.inter += interaccion(p);
      return a;
    }, {}),
  ).sort((a, b) => b[1].reach / b[1].n - a[1].reach / a[1].n);
  const maxFormato = Math.max(...porFormato.map(([, v]) => v.reach / v.n), 1);
  const top = posts.items.slice(0, 8);
  const maxTop = Math.max(...top.map((p) => p[orden]), 1);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Analytics</h1>
      <p className="mt-1 text-sm text-muted">
        Instagram · último dato: {ult ? new Date(ult.fecha).toLocaleDateString("es-AR", { timeZone: "UTC" }) : "sin datos"} ·{" "}
        {posts.totalItems} posts con métricas
      </p>

      {ult && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Alcance 28 días" value={ult.alcance_28d} anterior={hace7?.alcance_28d} />
          <Kpi label="Interacciones" value={ult.interacciones_totales} anterior={hace7?.interacciones_totales} />
          <Kpi label="Cuentas que interactuaron" value={ult.cuentas_interactuaron} anterior={hace7?.cuentas_interactuaron} />
          <Kpi label="Clics al sitio" value={ult.clics_sitio} anterior={hace7?.clics_sitio} />
          <Kpi label="Guardados" value={ult.guardados_28d} anterior={hace7?.guardados_28d} />
          <Kpi label="Compartidos" value={ult.compartidos_28d} anterior={hace7?.compartidos_28d} />
          <Kpi label="Comentarios" value={ult.comentarios_28d} anterior={hace7?.comentarios_28d} />
          <Kpi label="Visitas al perfil" value={ult.visitas_perfil} anterior={hace7?.visitas_perfil} sinDatos={visitasSinDatos} />
        </div>
      )}

      <section className="mt-6 rounded-lg border border-line bg-surface p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{METRICAS[metrica].nombre} · evolución diaria (ventana de 28 días)</h2>
          <div className="flex gap-1">
            {(Object.keys(METRICAS) as MetricaKey[]).map((k) => (
              <Link key={k} href={`?metrica=${k}&orden=${orden}`} className={pestana(k === metrica)}>
                {METRICAS[k].nombre}
              </Link>
            ))}
          </div>
        </div>
        <LineaMetrica datos={serie} etiqueta={METRICAS[metrica].nombre} />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[3fr_2fr]">
        <section className="rounded-lg border border-line bg-surface p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Mejores posts</h2>
            <div className="flex gap-1">
              {(Object.keys(ORDENES) as OrdenKey[]).map((k) => (
                <Link key={k} href={`?metrica=${metrica}&orden=${k}`} className={pestana(k === orden)}>
                  {ORDENES[k]}
                </Link>
              ))}
            </div>
          </div>
          <ol className="space-y-2">
            {top.map((p, i) => {
              const img = imagen.get(p.media_id);
              return (
                <li key={p.media_id}>
                  <a href={p.permalink} target="_blank" rel="noreferrer"
                    className="flex items-center gap-3 rounded-md p-1.5 transition hover:bg-surface-2">
                    <span className="w-5 text-center text-xs text-muted">{i + 1}</span>
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-md object-cover" />
                    ) : (
                      <div className="h-11 w-11 shrink-0 rounded-md bg-surface-2" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm">{p.titulo || p.media_id}</p>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${(p[orden] / maxTop) * 100}%` }} />
                      </div>
                    </div>
                    <div className="w-16 shrink-0 text-right">
                      <div className="text-sm font-semibold">{fmt.format(p[orden])}</div>
                      <div className="text-[10px] text-muted">{FORMATO[p.tipo] ?? p.tipo}</div>
                    </div>
                  </a>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="rounded-lg border border-line bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold">Rendimiento por formato</h2>
          <ul className="space-y-4">
            {porFormato.map(([t, v]) => (
              <li key={t}>
                <div className="flex items-baseline justify-between text-sm">
                  <span>
                    {FORMATO[t] ?? t} <span className="text-xs text-muted">({v.n} posts)</span>
                  </span>
                  <span className="font-semibold">{fmt.format(Math.round(v.reach / v.n))}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(v.reach / v.n / maxFormato) * 100}%` }} />
                </div>
                <div className="mt-1 text-[11px] text-muted">
                  alcance medio · {fmt.format(Math.round(v.inter / v.n))} interacciones por post
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
