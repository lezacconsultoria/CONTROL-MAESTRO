import Link from "next/link";
import { pb, pbTodos, type Cuenta, type List } from "@/lib/pb";
import LineaMetrica from "@/components/LineaMetrica";
import SubirAnalitica from "./SubirAnalitica";

const fmt = new Intl.NumberFormat("es-AR");
const fmtFecha = (f: string) =>
  new Date(f.slice(0, 10) + "T00:00:00Z").toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

type Dia = {
  fecha: string;
  impresiones: number;
  interacciones: number;
  clics: number;
  reacciones: number;
  comentarios: number;
  compartidos: number;
  seguidores_nuevos: number;
};
type Post = {
  id: string;
  url: string;
  fecha: string;
  titulo: string;
  tipo_contenido: string;
  impresiones: number;
  interacciones: number;
  reacciones: number;
  clics: number;
};
type Aud = { id: string; origen: string; categoria: string; valor: string; pct: number; pct_texto: string };
type Resumen = {
  cuenta: string;
  desde: string;
  hasta: string;
  impresiones: number;
  alcanzados: number;
  seguidores_total: number;
  actualizado: string;
};

const RANGOS = { "30": "30 días", "90": "90 días", "365": "12 meses" } as const;
const METRICAS_PERFIL = { impresiones: "Impresiones", interacciones: "Interacciones", seguidores_nuevos: "Nuevos seguidores" } as const;
const METRICAS_PAGINA = { impresiones: "Impresiones", interacciones: "Interacciones", clics: "Clics" } as const;
const ORDEN_PERFIL = { interacciones: "Interacciones", impresiones: "Impresiones" } as const;
const ORDEN_PAGINA = { impresiones: "Impresiones", interacciones: "Interacciones", reacciones: "Reacciones" } as const;
const ORIGENES = { publico: "Público", contenido: "Contenido" } as const;

const pestana = (activo: boolean) =>
  `rounded-md px-3 py-1.5 text-xs font-semibold ${activo ? "bg-accent text-white" : "bg-surface-2 text-muted hover:text-ink"}`;

function Kpi({ label, value, anterior, sufijo = "", nota }: { label: string; value: number; anterior?: number; sufijo?: string; nota?: string }) {
  const delta = anterior ? ((value - anterior) / anterior) * 100 : undefined;
  const igual = delta === undefined || Math.abs(delta) < 0.05;
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold">
        {fmt.format(Math.round(value * 10) / 10)}
        {sufijo}
      </div>
      <div className={`mt-1 text-xs ${nota || igual ? "text-muted" : delta! >= 0 ? "text-[#25f5a4]" : "text-red-400"}`}>
        {nota ?? (igual ? "sin datos del período anterior" : `${delta! >= 0 ? "▲" : "▼"} ${Math.abs(delta!).toFixed(1)}% vs. período anterior`)}
      </div>
    </div>
  );
}

export default async function AnalyticsLinkedin({
  searchParams,
}: {
  searchParams: Promise<{ cuenta?: string; rango?: string; metrica?: string; orden?: string; aud?: string }>;
}) {
  const sp = await searchParams;

  const [cuentas, resumenes] = await Promise.all([
    pbTodos<Cuenta>("social_cuentas", 'plataforma="linkedin"'),
    pbTodos<Resumen>("social_li_resumen"),
  ]);
  const conDatos = new Set(resumenes.map((r) => r.cuenta));
  const cuenta = cuentas.find((c) => c.id === sp.cuenta) ?? cuentas.find((c) => conDatos.has(c.id)) ?? cuentas[0];
  if (!cuenta) return <p className="text-sm text-muted">No hay cuentas de LinkedIn configuradas.</p>;

  const pagina = cuenta.autor_urn.startsWith("urn:li:organization");
  const rango = (sp.rango && sp.rango in RANGOS ? sp.rango : "90") as keyof typeof RANGOS;
  const METRICAS: Record<string, string> = pagina ? METRICAS_PAGINA : METRICAS_PERFIL;
  const ORDENES: Record<string, string> = pagina ? ORDEN_PAGINA : ORDEN_PERFIL;
  const metrica = sp.metrica && sp.metrica in METRICAS ? sp.metrica : "impresiones";
  const orden = sp.orden && sp.orden in ORDENES ? sp.orden : "impresiones";
  const origen = sp.aud === "contenido" ? "contenido" : "publico";
  const filtroCuenta = encodeURIComponent(`cuenta="${cuenta.id}"`);

  const [dias, posts, audiencia] = await Promise.all([
    pbTodos<Dia>("social_li_diario", `cuenta="${cuenta.id}"`, "fecha"),
    pb<List<Post>>(`collections/social_li_posts/records?perPage=8&sort=-${orden}&filter=${filtroCuenta}`),
    pagina ? Promise.resolve([] as Aud[]) : pbTodos<Aud>("social_li_audiencia", `cuenta="${cuenta.id}" && origen="${origen}"`),
  ]);
  const resumen = resumenes.find((r) => r.cuenta === cuenta.id);

  const n = Number(rango);
  const ventana = dias.slice(-n);
  const previa = dias.slice(-2 * n, -n);
  const suma = (arr: Dia[], k: keyof Dia) => arr.reduce((s, d) => s + (Number(d[k]) || 0), 0);
  const tasa = (arr: Dia[]) => (suma(arr, "impresiones") ? (suma(arr, "interacciones") / suma(arr, "impresiones")) * 100 : 0);
  const hayPrevia = previa.length >= n;
  const ant = (k: keyof Dia) => (hayPrevia ? suma(previa, k) : undefined);
  const serie = ventana.map((d) => ({ fecha: d.fecha.slice(0, 10) + "T00:00:00Z", valor: Number(d[metrica as keyof Dia]) || 0 }));

  const maxTop = Math.max(...posts.items.map((p) => Number(p[orden as keyof Post]) || 0), 1);
  const hrefBase = (cambios: Record<string, string>) => {
    const q = new URLSearchParams({ cuenta: cuenta.id, rango, metrica, orden, aud: origen, ...cambios });
    return `?${q}`;
  };

  const porCategoria = Object.entries(
    audiencia.reduce<Record<string, Aud[]>>((a, x) => ((a[x.categoria] ??= []).push(x), a), {}),
  );

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Analytics de LinkedIn</h1>
      <p className="mt-1 text-sm text-muted">
        {resumen
          ? `Datos del ${fmtFecha(resumen.desde)} al ${fmtFecha(resumen.hasta)} · actualizado el ${fmtFecha(resumen.actualizado)}`
          : "Todavía no hay datos de esta cuenta."}
      </p>

      <div className="mt-4 flex flex-wrap gap-1">
        {cuentas.map((c) => (
          <Link key={c.id} href={`?cuenta=${c.id}`} className={pestana(c.id === cuenta.id)}>
            {c.handle}
          </Link>
        ))}
      </div>

      <div className="mt-5">
        <SubirAnalitica
          key={cuenta.id}
          cuentas={cuentas.map((c) => ({ id: c.id, handle: c.handle, pagina: c.autor_urn.startsWith("urn:li:organization") }))}
          cuentaActual={cuenta.id}
        />
      </div>

      {dias.length > 0 && (
        <>
          <div className="mt-6 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Período</h2>
            <div className="flex gap-1">
              {(Object.keys(RANGOS) as (keyof typeof RANGOS)[]).map((k) => (
                <Link key={k} href={hrefBase({ rango: k })} className={pestana(k === rango)}>
                  {RANGOS[k]}
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Kpi label="Impresiones" value={suma(ventana, "impresiones")} anterior={ant("impresiones")} />
            {pagina ? (
              <>
                <Kpi label="Clics" value={suma(ventana, "clics")} anterior={ant("clics")} />
                <Kpi label="Reacciones" value={suma(ventana, "reacciones")} anterior={ant("reacciones")} />
                <Kpi label="Comentarios" value={suma(ventana, "comentarios")} anterior={ant("comentarios")} />
                <Kpi label="Compartidos" value={suma(ventana, "compartidos")} anterior={ant("compartidos")} />
              </>
            ) : (
              <>
                <Kpi label="Interacciones" value={suma(ventana, "interacciones")} anterior={ant("interacciones")} />
                <Kpi label="Nuevos seguidores" value={suma(ventana, "seguidores_nuevos")} anterior={ant("seguidores_nuevos")} />
                <Kpi label="Seguidores totales" value={resumen?.seguidores_total ?? 0} nota={resumen ? `al ${fmtFecha(resumen.hasta)}` : ""} />
                <Kpi label="Miembros alcanzados" value={resumen?.alcanzados ?? 0} nota="últimos 12 meses" />
              </>
            )}
            <Kpi label="Tasa de interacción" value={tasa(ventana)} anterior={hayPrevia ? tasa(previa) : undefined} sufijo="%" />
          </div>

          <section className="mt-6 rounded-lg border border-line bg-surface p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">{METRICAS[metrica]} · evolución diaria</h2>
              <div className="flex gap-1">
                {Object.entries(METRICAS).map(([k, nombre]) => (
                  <Link key={k} href={hrefBase({ metrica: k })} className={pestana(k === metrica)}>
                    {nombre}
                  </Link>
                ))}
              </div>
            </div>
            <LineaMetrica datos={serie} etiqueta={METRICAS[metrica]} />
          </section>
        </>
      )}

      {posts.items.length > 0 && (
        <section className="mt-6 rounded-lg border border-line bg-surface p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Mejores publicaciones</h2>
            <div className="flex gap-1">
              {Object.entries(ORDENES).map(([k, nombre]) => (
                <Link key={k} href={hrefBase({ orden: k })} className={pestana(k === orden)}>
                  {nombre}
                </Link>
              ))}
            </div>
          </div>
          <ol className="space-y-2">
            {posts.items.map((p, i) => {
              const valor = Number(p[orden as keyof Post]) || 0;
              return (
                <li key={p.id}>
                  <a href={p.url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-3 rounded-md p-1.5 transition hover:bg-surface-2">
                    <span className="w-5 text-center text-xs text-muted">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm">{p.titulo || (p.fecha ? `Publicación del ${fmtFecha(p.fecha)}` : p.url)}</p>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${(valor / maxTop) * 100}%` }} />
                      </div>
                      <p className="mt-1 text-[11px] text-muted">
                        {p.fecha && fmtFecha(p.fecha)}
                        {p.tipo_contenido && ` · ${p.tipo_contenido}`}
                        {` · ${fmt.format(p.impresiones)} impresiones · ${fmt.format(p.interacciones)} interacciones`}
                      </p>
                    </div>
                    <div className="w-16 shrink-0 text-right text-sm font-semibold">{fmt.format(valor)}</div>
                  </a>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {!pagina && porCategoria.length > 0 && (
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Audiencia</h2>
            <div className="flex gap-1">
              {Object.entries(ORIGENES).map(([k, nombre]) => (
                <Link key={k} href={hrefBase({ aud: k })} className={pestana(k === origen)}>
                  {nombre}
                </Link>
              ))}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {porCategoria.map(([categoria, filas]) => {
              const top = [...filas].sort((a, b) => b.pct - a.pct).slice(0, 5);
              const max = Math.max(...top.map((x) => x.pct), 1);
              return (
                <div key={categoria} className="rounded-lg border border-line bg-surface p-4">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{categoria}</h3>
                  <ul className="space-y-2.5">
                    {top.map((x) => (
                      <li key={x.id}>
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="truncate">{x.valor}</span>
                          <span className="shrink-0 text-xs text-muted">{x.pct_texto}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                          <div className="h-full rounded-full bg-accent" style={{ width: `${(x.pct / max) * 100}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
