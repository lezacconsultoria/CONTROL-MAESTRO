import Link from "next/link";
import { connection } from "next/server";
import { PB_URL, pb, type Cuenta, type List, type SocialPost, type Snapshot } from "@/lib/pb";
import LineaMetrica from "@/components/LineaMetrica";

const fmt = new Intl.NumberFormat("es-AR");
const AR = "America/Argentina/Buenos_Aires";
const cuando = (iso: string) =>
  new Date(iso.replace(" ", "T")).toLocaleString("es-AR", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: AR,
  });
const pbFecha = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");
const consulta = (filtro: string, extra = "") =>
  `collections/social_posts/records?filter=${encodeURIComponent(filtro)}${extra}`;

function Kpi({ label, value, nota, tono }: { label: string; value: string; nota?: string; tono?: "ok" | "mal" }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold">{value}</div>
      {nota && (
        <div className={`mt-1 text-xs ${tono === "ok" ? "text-[#25f5a4]" : tono === "mal" ? "text-red-400" : "text-muted"}`}>
          {nota}
        </div>
      )}
    </div>
  );
}

const ICONO = (c?: Cuenta) => (c?.plataforma === "linkedin" ? "in" : "IG");

export default async function Resumen() {
  await connection();
  const ahora = new Date();
  const hoyAR = new Date(ahora.getTime() - 3 * 3600 * 1000);
  const inicioMes = new Date(Date.UTC(hoyAR.getUTCFullYear(), hoyAR.getUTCMonth(), 1, 3)); // 00:00 hora Argentina

  const [prox, problemas, recientes, delMes, snaps, cuentas] = await Promise.all([
    pb<List<SocialPost>>(
      consulta(`estado="programado" && programado_en>="${pbFecha(ahora)}"`, "&sort=programado_en&perPage=6&expand=cuenta"),
    ),
    pb<List<SocialPost>>(consulta('estado="error" || estado="publicando"', "&sort=-programado_en&perPage=5&expand=cuenta")),
    pb<List<SocialPost>>(consulta('estado="publicado"', "&sort=-publicado_en&perPage=5&expand=cuenta")),
    pb<List<SocialPost>>(consulta(`estado="publicado" && publicado_en>="${pbFecha(inicioMes)}"`, "&perPage=1&fields=id")),
    pb<List<Snapshot>>("collections/ig_cuenta_snapshot/records?perPage=30&sort=-fecha"),
    pb<List<Cuenta & { estado: string }>>("collections/social_cuentas/records?perPage=20"),
  ]);

  const serie = [...snaps.items].reverse();
  const ult = serie.at(-1);
  const hace7 = serie.length > 7 ? serie[serie.length - 8] : undefined;
  const delta = (k: keyof Snapshot) => {
    if (!ult || !hace7 || !Number(hace7[k])) return undefined;
    return ((Number(ult[k]) - Number(hace7[k])) / Number(hace7[k])) * 100;
  };
  const dAlc = delta("alcance_28d");
  const dInt = delta("interacciones_totales");
  const nota = (d?: number) => (d === undefined ? undefined : `${d >= 0 ? "▲" : "▼"} ${Math.abs(d).toFixed(1)}% vs. hace 7 días`);
  const tono = (d?: number) => (d === undefined ? undefined : d >= 0 ? "ok" : "mal");

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Resumen</h1>
          <p className="mt-1 text-sm text-muted">Estado de tu contenido en redes</p>
        </div>
        <Link href="/social/editor" className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white">
          + Nuevo post
        </Link>
      </div>

      {problemas.totalItems > 0 && (
        <div className="mt-5 rounded-lg border border-red-500/40 bg-red-500/10 p-4">
          <p className="text-sm font-semibold text-red-300">
            {problemas.totalItems} {problemas.totalItems === 1 ? "post necesita" : "posts necesitan"} atención
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {problemas.items.map((p) => (
              <li key={p.id}>
                <Link href={`/social/editor?id=${p.id}`} className="hover:underline">
                  <span className="text-red-300">{p.estado === "error" ? "Error" : "Publicando"}</span> ·{" "}
                  {p.titulo || "(sin título)"}
                  {p.error && <span className="text-muted"> — {p.error.slice(0, 90)}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Alcance 28 días" value={ult ? fmt.format(ult.alcance_28d) : "—"} nota={nota(dAlc)} tono={tono(dAlc)} />
        <Kpi label="Interacciones" value={ult ? fmt.format(ult.interacciones_totales) : "—"} nota={nota(dInt)} tono={tono(dInt)} />
        <Kpi label="Programados" value={fmt.format(prox.totalItems)} nota={prox.totalItems ? "próximas publicaciones" : "nada en cola"} />
        <Kpi label="Publicados este mes" value={fmt.format(delMes.totalItems)} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-lg border border-line bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Próximas publicaciones</h2>
            <Link href="/social/calendario" className="text-xs text-muted hover:text-accent">Ver calendario →</Link>
          </div>
          {prox.items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              No hay nada programado.{" "}
              <Link href="/social/editor" className="text-accent hover:underline">Crear un post</Link>
            </p>
          ) : (
            <ul className="space-y-1">
              {prox.items.map((p) => (
                <li key={p.id}>
                  <Link href={`/social/editor?id=${p.id}`}
                    className="flex items-center gap-3 rounded-md p-2 transition hover:bg-surface-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-2 text-[11px] font-bold text-accent">
                      {ICONO(p.expand?.cuenta)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{p.titulo || "(sin título)"}</p>
                      <p className="text-xs capitalize text-muted">{cuando(p.programado_en)}</p>
                    </div>
                    <span className="shrink-0 rounded bg-[#38bdf8]/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#38bdf8]">
                      {p.tipo}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-line bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Últimas publicaciones</h2>
            <Link href="/social/biblioteca" className="text-xs text-muted hover:text-accent">Ver biblioteca →</Link>
          </div>
          <ul className="space-y-1">
            {recientes.items.map((p) => (
              <li key={p.id}>
                <a href={p.permalink} target="_blank" rel="noreferrer"
                  className="flex items-center gap-3 rounded-md p-2 transition hover:bg-surface-2">
                  {p.portada ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`${PB_URL}/api/files/social_posts/${p.id}/${p.portada}?thumb=100x100`} alt=""
                      loading="lazy" className="h-10 w-10 shrink-0 rounded-md object-cover" />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-2 text-[11px] font-bold text-accent">
                      {ICONO(p.expand?.cuenta)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{p.titulo || "(sin título)"}</p>
                    <p className="text-xs capitalize text-muted">{cuando(p.publicado_en)}</p>
                  </div>
                  <span className="shrink-0 rounded bg-surface-2 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                    {p.tipo}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[3fr_2fr]">
        <section className="rounded-lg border border-line bg-surface p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Alcance a 28 días</h2>
            <Link href="/social/analytics" className="text-xs text-muted hover:text-accent">Ver analytics →</Link>
          </div>
          <LineaMetrica datos={serie.map((s) => ({ fecha: s.fecha, valor: s.alcance_28d }))} etiqueta="Alcance" />
        </section>

        <section className="rounded-lg border border-line bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold">Cuentas conectadas</h2>
          <ul className="space-y-2">
            {cuentas.items.map((c) => {
              const ok = c.estado === "conectada";
              return (
                <li key={c.id} className="flex items-center gap-3 text-sm">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-2 text-[11px] font-bold text-accent">
                    {ICONO(c)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{c.handle}</span>
                  <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] uppercase tracking-wide ${ok ? "bg-[#25f5a4]/15 text-[#25f5a4]" : "bg-[#f5c842]/15 text-[#f5c842]"}`}>
                    {ok ? "conectada" : c.estado}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
