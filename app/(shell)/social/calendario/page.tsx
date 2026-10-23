import Link from "next/link";
import { connection } from "next/server";
import { pb, type List, type SocialPost } from "@/lib/pb";
import { diaAR, horaAR } from "@/lib/fecha";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const TIPO: Record<string, string> = {
  imagen: "Imagen",
  carrusel: "Carrusel",
  reel: "Reel",
  texto: "Texto",
  video: "Video",
  documento: "Documento PDF",
};
const CUANDO: Record<string, string> = {
  idea: "Idea para las",
  borrador: "Borrador para las",
  programado: "Se publica a las",
  publicando: "Publicando desde las",
  publicado: "Publicado a las",
  error: "Falló, era para las",
};
const COLOR: Record<string, string> = {
  idea: "bg-surface-2 text-muted",
  borrador: "bg-surface-2 text-ink",
  programado: "bg-[#38bdf8]/20 text-[#38bdf8]",
  publicando: "bg-[#f5c842]/20 text-[#f5c842]",
  publicado: "bg-[#25f5a4]/15 text-[#25f5a4]",
  error: "bg-red-500/20 text-red-300",
};

export default async function Calendario({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; r?: string }>;
}) {
  const { m, r } = await searchParams;
  const red = r === "instagram" || r === "linkedin" ? r : "";
  await connection(); // la fecha de hoy cambia en cada visita
  const hoy = new Date(Date.now() - 3 * 3600 * 1000);
  const [anio, mes] = (m && /^\d{4}-\d{2}$/.test(m) ? m : hoy.toISOString().slice(0, 7))
    .split("-")
    .map(Number);

  const primero = new Date(Date.UTC(anio, mes - 1, 1));
  const diasMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const offset = (primero.getUTCDay() + 6) % 7; // lunes primero
  const desde = new Date(primero.getTime() - 24 * 3600 * 1000).toISOString().slice(0, 10) + " 00:00:00";
  const hasta = new Date(Date.UTC(anio, mes, 2)).toISOString().slice(0, 10) + " 00:00:00";
  const rango = (c: string) => `(${c}>="${desde}" && ${c}<"${hasta}")`;

  const posts = await pb<List<SocialPost>>(
    `collections/social_posts/records?perPage=500&expand=cuenta&sort=programado_en,publicado_en&filter=${encodeURIComponent(
      `(${rango("programado_en")} || ${rango("publicado_en")}) && estado!="eliminado"${red ? ` && cuenta.plataforma="${red}"` : ""}`,
    )}`,
  );
  const porDia = new Map<string, SocialPost[]>();
  for (const p of posts.items) {
    const k = diaAR(p.programado_en || p.publicado_en);
    porDia.set(k, [...(porDia.get(k) ?? []), p]);
  }

  const mesStr = (a: number, b: number) => {
    const d = new Date(Date.UTC(a, b - 1, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  const enlace = (mm: string, rr = red) => `?${new URLSearchParams({ m: mm, ...(rr ? { r: rr } : {}) })}`;
  const mesActual = `${anio}-${String(mes).padStart(2, "0")}`;
  const titulo = primero.toLocaleDateString("es-AR", { month: "long", year: "numeric", timeZone: "UTC" });
  const celdas = Array.from({ length: Math.ceil((offset + diasMes) / 7) * 7 }, (_, i) => i - offset + 1);
  const hoyKey = hoy.toISOString().slice(0, 10);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={enlace(mesStr(anio, mes - 1))} className="rounded bg-surface-2 px-3 py-1.5 text-sm">←</Link>
          <h1 className="min-w-48 text-center font-display text-2xl font-bold capitalize">{titulo}</h1>
          <Link href={enlace(mesStr(anio, mes + 1))} className="rounded bg-surface-2 px-3 py-1.5 text-sm">→</Link>
        </div>
        <div className="flex rounded-md bg-surface-2 p-0.5 text-sm">
          {[["", "Todas"], ["instagram", "Instagram"], ["linkedin", "LinkedIn"]].map(([v, n]) => (
            <Link key={v} href={enlace(mesActual, v)}
              className={`rounded px-3 py-1.5 ${red === v ? "bg-accent font-semibold text-white" : "text-muted hover:text-ink"}`}>
              {n}
            </Link>
          ))}
        </div>
        <Link href="/social/editor" className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white">
          + Nuevo post
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-line bg-line">
        {DIAS.map((d) => (
          <div key={d} className="bg-surface px-2 py-1.5 text-xs uppercase tracking-wide text-muted">{d}</div>
        ))}
        {celdas.map((n, i) => {
          const dentro = n >= 1 && n <= diasMes;
          const key = dentro ? `${anio}-${String(mes).padStart(2, "0")}-${String(n).padStart(2, "0")}` : "";
          return (
            <div key={i} className={`min-h-28 bg-bg p-1.5 ${dentro ? "" : "opacity-30"}`}>
              {dentro && (
                <>
                  <div className="mb-1 flex items-center justify-between">
                    <span className={`text-xs ${key === hoyKey ? "rounded bg-accent px-1.5 text-white" : "text-muted"}`}>{n}</span>
                    <Link href={`/social/editor?fecha=${key}`} className="text-xs text-muted hover:text-accent">+</Link>
                  </div>
                  <div className="space-y-1">
                    {(porDia.get(key) ?? []).map((p) => {
                      const hora = horaAR(p.programado_en || p.publicado_en);
                      const cuenta = p.expand?.cuenta;
                      const nombreRed = cuenta?.plataforma === "linkedin" ? "LinkedIn" : "Instagram";
                      return (
                        <div key={p.id} className="group relative">
                          <Link href={`/social/editor?id=${p.id}`}
                            className={`block truncate rounded px-1.5 py-0.5 text-[11px] ${COLOR[p.estado]}`}>
                            {hora} · {p.titulo || p.tipo}
                          </Link>
                          <div
                            role="tooltip"
                            className={`pointer-events-none absolute z-20 hidden w-56 rounded-md border border-line bg-surface-2 px-3 py-2 text-xs shadow-lg group-hover:block ${
                              i < 7 ? "top-full mt-1" : "bottom-full mb-1"
                            } ${i % 7 >= 4 ? "right-0" : "left-0"}`}
                          >
                            <div className="font-semibold">{TIPO[p.tipo] ?? p.tipo} en {nombreRed}</div>
                            {cuenta && <div className="text-muted">{cuenta.handle}</div>}
                            <div className="mt-1">{CUANDO[p.estado] ?? "A las"} {hora}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
